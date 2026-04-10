import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  uploadObject,
  deleteObject,
  getSignedDownloadUrl,
  getSignedPreviewUrl,
} from "../../lib/storage.js";
import {
  campaignIdParamsSchema,
  submissionIdParamsSchema,
  updateSubmissionSchema,
} from "./schemas.js";
import { validateCreative } from "./validate.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/tiff",
]);

const CREATIVE_TYPES = new Set(["PRINT", "DIGITAL", "MASTER_ASSET"]);

const STATUS_ORDER: Record<string, number> = {
  VALIDATION_FAILED: 0,
  UPLOADED: 1,
  UNDER_REVIEW: 2,
  NEEDS_RESIZING: 3,
  READY_FOR_PUBLISHER: 4,
  PUSHED: 5,
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

function getFieldValue(
  fields: Record<string, unknown>,
  name: string,
): string | undefined {
  const field = fields[name] as
    | { type: string; value: string }
    | undefined;
  if (!field || field.type !== "field") return undefined;
  return field.value;
}

export async function submissionRoutes(app: FastifyInstance) {
  // ── List submissions for a campaign ───────────────────────────
  app.get(
    "/campaigns/:campaignId/submissions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { campaignId } = campaignIdParamsSchema.parse(request.params);

      const campaign = await app.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, organizationId: true },
      });
      if (!campaign) {
        return reply.code(404).send({ error: "Campaign not found" });
      }

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(campaign.organizationId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const submissions = await app.prisma.creativeSubmission.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        include: {
          submittedBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      submissions.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
      );

      return { campaignId, submissions };
    },
  );

  // ── Upload a submission (any org member) ──────────────────────
  app.post(
    "/campaigns/:campaignId/submissions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { campaignId } = campaignIdParamsSchema.parse(request.params);

      const campaign = await app.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, organizationId: true },
      });
      if (!campaign) {
        return reply.code(404).send({ error: "Campaign not found" });
      }

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(campaign.organizationId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const file = await request.file({
        limits: { fileSize: MAX_FILE_SIZE },
      });
      if (!file) {
        return reply.code(400).send({ error: "File is required" });
      }

      const buffer = await file.toBuffer();

      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return reply.code(400).send({
          error: `File type "${file.mimetype}" is not allowed. Accepted: PDF, PNG, JPEG, GIF, TIFF.`,
        });
      }

      if (file.file.truncated) {
        return reply.code(413).send({
          error: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit`,
        });
      }

      const title = getFieldValue(file.fields, "title");
      if (!title || title.trim().length === 0) {
        return reply.code(400).send({ error: "Title is required" });
      }

      const creativeType = getFieldValue(file.fields, "creativeType");
      if (!creativeType || !CREATIVE_TYPES.has(creativeType)) {
        return reply.code(400).send({
          error: "creativeType is required (PRINT or DIGITAL)",
        });
      }

      const description =
        getFieldValue(file.fields, "description")?.trim() || null;
      const filename = sanitizeFilename(file.filename);
      const storageKey = `submissions/${campaignId}/${randomUUID()}/${filename}`;

      await uploadObject(storageKey, buffer, file.mimetype);

      const validation = validateCreative(
        creativeType,
        buffer,
        file.mimetype,
        buffer.length,
      );

      const submission = await app.prisma.creativeSubmission.create({
        data: {
          campaignId,
          organizationId: campaign.organizationId,
          title: title.trim(),
          description,
          creativeType: creativeType as "PRINT" | "DIGITAL" | "MASTER_ASSET",
          filename,
          mimeType: file.mimetype,
          sizeBytes: buffer.length,
          storageKey,
          status: validation.status,
          widthPx: validation.widthPx,
          heightPx: validation.heightPx,
          dpi: validation.dpi,
          colorSpace: validation.colorSpace,
          validationSummary:
            validation.validationSummary as unknown as Prisma.InputJsonValue,
          submittedById: request.currentUser!.id,
        },
      });

      return reply.code(201).send(submission);
    },
  );

  // ── Update a submission (admin only) ──────────────────────────
  app.patch(
    "/submissions/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = submissionIdParamsSchema.parse(request.params);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        submission.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = updateSubmissionSchema.parse(request.body);

      const data: Record<string, unknown> = {};
      if (parsed.status !== undefined) data.status = parsed.status;
      if ("reviewNote" in parsed) data.reviewNote = parsed.reviewNote;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.creativeSubmission.update({
        where: { id },
        data,
      });

      return updated;
    },
  );

  // ── Delete a submission (admin only) ──────────────────────────
  app.delete(
    "/submissions/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = submissionIdParamsSchema.parse(request.params);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        submission.organizationId,
        reply,
      );
      if (!manage) return;

      await app.prisma.creativeSubmission.delete({ where: { id } });

      try {
        await deleteObject(submission.storageKey);
      } catch (storageErr) {
        request.log.warn(
          { storageKey: submission.storageKey, err: storageErr },
          "Submission record deleted but storage cleanup failed",
        );
      }

      return { success: true };
    },
  );

  // ── Download a submission (any org member) ────────────────────
  app.get(
    "/submissions/:id/download",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = submissionIdParamsSchema.parse(request.params);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
      }

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(submission.organizationId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const url = await getSignedDownloadUrl(
        submission.storageKey,
        submission.filename,
      );

      return {
        url,
        filename: submission.filename,
        mimeType: submission.mimeType,
      };
    },
  );

  // ── Preview URL (inline viewing) ─────────────────────────────
  const PREVIEWABLE_MIMES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/tiff",
    "application/pdf",
  ]);

  app.get(
    "/submissions/:id/preview",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = submissionIdParamsSchema.parse(request.params);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
      }

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(submission.organizationId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      if (!PREVIEWABLE_MIMES.has(submission.mimeType)) {
        return reply.code(400).send({
          error: "Preview is not available for this file type.",
          previewable: false,
        });
      }

      const url = await getSignedPreviewUrl(
        submission.storageKey,
        submission.mimeType,
      );

      return {
        url,
        mimeType: submission.mimeType,
        previewable: true,
      };
    },
  );
}

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
import {
  notify,
  getClientUserIdsForOrg,
  getAgencyUserIdsForClientOrg,
} from "../../lib/notifications.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/tiff",
]);

const MASTER_ASSET_MIME_TYPES = new Set([
  ...ALLOWED_MIME_TYPES,
  "image/svg+xml",
  "application/postscript",
  "application/illustrator",
  "application/zip",
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

      if (file.file.truncated) {
        return reply.code(413).send({
          error: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit`,
        });
      }

      // Revision upload: if parentSubmissionId is supplied, inherit the
      // parent's title/creativeType/description so the client can post a
      // file-only form. We also resolve the chain ROOT so the stored
      // parentSubmissionId is always the original (flat chain).
      const parentSubmissionIdRaw = getFieldValue(
        file.fields,
        "parentSubmissionId",
      );
      let parent: Awaited<
        ReturnType<typeof app.prisma.creativeSubmission.findUnique>
      > = null;
      let chainRootId: string | null = null;
      if (parentSubmissionIdRaw && parentSubmissionIdRaw.trim().length > 0) {
        parent = await app.prisma.creativeSubmission.findUnique({
          where: { id: parentSubmissionIdRaw.trim() },
        });
        if (!parent) {
          return reply.code(404).send({ error: "Parent submission not found" });
        }
        if (parent.campaignId !== campaignId) {
          return reply
            .code(400)
            .send({ error: "Parent submission is for a different campaign" });
        }
        chainRootId = parent.parentSubmissionId ?? parent.id;
      }

      const providedTitle = getFieldValue(file.fields, "title");
      const title =
        providedTitle && providedTitle.trim().length > 0
          ? providedTitle.trim()
          : parent?.title ?? "";
      if (title.length === 0) {
        return reply.code(400).send({ error: "Title is required" });
      }

      const providedCreativeType = getFieldValue(file.fields, "creativeType");
      const creativeType =
        providedCreativeType && CREATIVE_TYPES.has(providedCreativeType)
          ? providedCreativeType
          : parent?.creativeType;
      if (!creativeType || !CREATIVE_TYPES.has(creativeType)) {
        return reply.code(400).send({
          error: "creativeType is required (PRINT, DIGITAL, or MASTER_ASSET)",
        });
      }

      const allowedMimes =
        creativeType === "MASTER_ASSET"
          ? MASTER_ASSET_MIME_TYPES
          : ALLOWED_MIME_TYPES;
      if (!allowedMimes.has(file.mimetype)) {
        const accepted =
          creativeType === "MASTER_ASSET"
            ? "PDF, PNG, JPEG, GIF, TIFF, SVG, EPS/AI, ZIP"
            : "PDF, PNG, JPEG, GIF, TIFF";
        return reply.code(400).send({
          error: `File type "${file.mimetype}" is not allowed. Accepted: ${accepted}.`,
        });
      }

      const providedDescription = getFieldValue(file.fields, "description");
      const description =
        providedDescription && providedDescription.trim().length > 0
          ? providedDescription.trim()
          : parent?.description ?? null;
      const filename = sanitizeFilename(file.filename);
      const storageKey = `submissions/${campaignId}/${randomUUID()}/${filename}`;

      await uploadObject(storageKey, buffer, file.mimetype);

      const validation = validateCreative(
        creativeType,
        buffer,
        file.mimetype,
        buffer.length,
      );

      /* Compute next version within the chain, if this is a revision. */
      let nextVersion = 1;
      if (chainRootId) {
        const agg = await app.prisma.creativeSubmission.aggregate({
          where: {
            OR: [
              { id: chainRootId },
              { parentSubmissionId: chainRootId },
            ],
          },
          _max: { version: true },
        });
        nextVersion = (agg._max.version ?? 1) + 1;
      }

      const submission = await app.prisma.creativeSubmission.create({
        data: {
          campaignId,
          organizationId: campaign.organizationId,
          title,
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
          parentSubmissionId: chainRootId,
          version: nextVersion,
        },
      });

      // Notify agency staff when this was a real client-uploaded revision
      // (original uploads don't trigger; they're not revisions).
      if (chainRootId) {
        const recipients = await getAgencyUserIdsForClientOrg(
          app.prisma,
          campaign.organizationId,
        );
        await notify(app.prisma, request.log, {
          userIds: recipients,
          type: "CREATIVE_REVISION_UPLOADED",
          title: `Revised creative uploaded: ${submission.title}`,
          body: `Version ${nextVersion} of "${submission.title}" is ready for review.`,
          relatedId: submission.id,
        });
      }

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

      // Notify client users ONLY on a real transition into an
      // action-required status (VALIDATION_FAILED / NEEDS_RESIZING) from
      // a different status. Saving the same status or editing only the
      // reviewNote deliberately does not fire — avoids review-pass spam.
      const prevStatus = submission.status;
      const nextStatus = updated.status;
      const actionRequired =
        nextStatus === "VALIDATION_FAILED" || nextStatus === "NEEDS_RESIZING";
      if (actionRequired && prevStatus !== nextStatus) {
        const recipients = await getClientUserIdsForOrg(
          app.prisma,
          updated.organizationId,
        );
        await notify(app.prisma, request.log, {
          userIds: recipients,
          type: "CREATIVE_REVISION_REQUESTED",
          title: `Revision requested: ${updated.title}`,
          body: updated.reviewNote
            ? `Your agency left a note: ${updated.reviewNote}`
            : "Your agency has requested an updated file.",
          relatedId: updated.id,
        });
      }

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

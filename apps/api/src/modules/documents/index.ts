import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  uploadObject,
  deleteObject,
  getSignedDownloadUrl,
} from "../../lib/storage.js";
import {
  orgIdParamsSchema,
  documentIdParamsSchema,
  documentCategory,
  updateDocumentSchema,
} from "./schemas.js";
import { notify, getClientUserIdsForOrg } from "../../lib/notifications.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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

export async function documentRoutes(app: FastifyInstance) {
  // ── List documents for an organization ──────────────────────────
  app.get(
    "/organizations/:orgId/documents",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { orgId } = orgIdParamsSchema.parse(request.params);

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(orgId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const org = await app.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      const documents = await app.prisma.document.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return { organizationId: orgId, documents };
    },
  );

  // ── Get presigned download URL ──────────────────────────────────
  app.get(
    "/documents/:id/download",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = documentIdParamsSchema.parse(request.params);

      const document = await app.prisma.document.findUnique({
        where: { id },
      });
      if (!document) {
        return reply.code(404).send({ error: "Document not found" });
      }

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(document.organizationId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const url = await getSignedDownloadUrl(
        document.storageKey,
        document.filename,
      );

      return { url, filename: document.filename, mimeType: document.mimeType };
    },
  );

  // ── Upload a document (admin only) ─────────────────────────────
  app.post(
    "/organizations/:orgId/documents",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { orgId } = orgIdParamsSchema.parse(request.params);

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        orgId,
        reply,
      );
      if (!manage) return;

      const file = await request.file({
        limits: { fileSize: MAX_FILE_SIZE },
      });
      if (!file) {
        return reply.code(400).send({ error: "File is required" });
      }

      const buffer = await file.toBuffer();

      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return reply.code(400).send({
          error: `File type "${file.mimetype}" is not allowed. Accepted: PDF, PNG, JPEG, DOC, DOCX, XLS, XLSX.`,
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

      const description =
        getFieldValue(file.fields, "description")?.trim() || null;
      const rawCategory = getFieldValue(file.fields, "category");
      const categoryParsed = rawCategory
        ? documentCategory.safeParse(rawCategory.trim().toUpperCase())
        : null;
      if (rawCategory && !categoryParsed?.success) {
        return reply.code(400).send({
          error: `Invalid category "${rawCategory}".`,
        });
      }
      const filename = sanitizeFilename(file.filename);
      const storageKey = `documents/${orgId}/${randomUUID()}/${filename}`;

      await uploadObject(storageKey, buffer, file.mimetype);

      const document = await app.prisma.document.create({
        data: {
          organizationId: orgId,
          title: title.trim(),
          description,
          filename,
          mimeType: file.mimetype,
          sizeBytes: buffer.length,
          storageKey,
          category: categoryParsed?.data ?? "OTHER",
          uploadedById: request.currentUser!.id,
        },
        include: {
          uploadedBy: { select: { id: true, email: true, name: true } },
        },
      });

      // Notify client users on billing/creative-review-critical document
      // categories. Other categories (contracts, insertion orders, misc)
      // skip the ping for v1 to keep signal-to-noise tight.
      if (
        document.category === "INVOICE" ||
        document.category === "PROOF"
      ) {
        const recipients = await getClientUserIdsForOrg(app.prisma, orgId);
        await notify(app.prisma, request.log, {
          userIds: recipients,
          type:
            document.category === "INVOICE"
              ? "NEW_INVOICE_UPLOADED"
              : "NEW_PROOF_UPLOADED",
          title:
            document.category === "INVOICE"
              ? `New invoice: ${document.title}`
              : `New proof: ${document.title}`,
          body: `${document.title} was shared with your organization.`,
          relatedId: document.id,
        });
      }

      return reply.code(201).send(document);
    },
  );

  // ── Update document metadata (admin only) ──────────────────────
  //
  // Intentionally narrow — changes only the editable metadata fields
  // (category/title/description). The underlying file (storageKey,
  // filename, mimeType) is immutable; to replace the file, delete and
  // re-upload.
  app.patch(
    "/documents/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = documentIdParamsSchema.parse(request.params);

      const existing = await app.prisma.document.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: "Document not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        existing.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = updateDocumentSchema.parse(request.body);
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) data[key] = value;
      }
      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.document.update({
        where: { id },
        data,
        include: {
          uploadedBy: { select: { id: true, email: true, name: true } },
        },
      });
      return updated;
    },
  );

  // ── Delete a document (admin only) ─────────────────────────────
  app.delete(
    "/documents/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = documentIdParamsSchema.parse(request.params);

      const document = await app.prisma.document.findUnique({
        where: { id },
      });
      if (!document) {
        return reply.code(404).send({ error: "Document not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        document.organizationId,
        reply,
      );
      if (!manage) return;

      await app.prisma.document.delete({ where: { id } });

      try {
        await deleteObject(document.storageKey);
      } catch (storageErr) {
        request.log.warn(
          { storageKey: document.storageKey, err: storageErr },
          "Document record deleted but storage cleanup failed; orphan file may remain",
        );
      }

      return { success: true };
    },
  );
}

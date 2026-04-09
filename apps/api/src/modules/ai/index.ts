import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { isStorageConfigured, getObjectBuffer } from "../../lib/storage.js";
import { env } from "../../env.js";
import { reviewCreativeSchema } from "./schemas.js";
import { MAX_AI_REVIEW_DOWNLOAD_BYTES, reviewCreative } from "./service.js";

/** Same as creative upload validation; reject before downloading from storage. */
const ALLOWED_REVIEW_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
]);

export async function aiRoutes(app: FastifyInstance) {
  app.post(
    "/ai/review-creative",
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!isStorageConfigured()) {
        return reply
          .code(503)
          .send({ error: "Object storage is not configured" });
      }

      if (!env.OPENAI_API_KEY?.trim()) {
        return reply
          .code(503)
          .send({ error: "AI review is not configured (missing API key)" });
      }

      const { submissionId } = reviewCreativeSchema.parse(request.body);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id: submissionId },
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

      if (!ALLOWED_REVIEW_MIME_TYPES.has(submission.mimeType)) {
        return reply.code(400).send({
          error:
            "This file type cannot be reviewed. Supported: PDF, PNG, JPEG, GIF.",
        });
      }

      if (submission.sizeBytes > MAX_AI_REVIEW_DOWNLOAD_BYTES) {
        return reply.code(413).send({
          error: `File is too large for AI review (max ${Math.floor(MAX_AI_REVIEW_DOWNLOAD_BYTES / (1024 * 1024))} MB).`,
        });
      }

      let fileBuffer: Buffer;
      try {
        const obj = await getObjectBuffer(submission.storageKey);
        fileBuffer = obj.body;
      } catch (err) {
        request.log.error(
          { storageKey: submission.storageKey, err },
          "Failed to retrieve file from storage for AI review",
        );
        return reply
          .code(502)
          .send({ error: "Could not retrieve file from storage" });
      }

      try {
        const review = await reviewCreative({
          title: submission.title,
          description: submission.description,
          creativeType: submission.creativeType,
          mimeType: submission.mimeType,
          filename: submission.filename,
          fileBuffer,
        });
        return review;
      } catch (err) {
        request.log.error({ err }, "AI creative review failed");
        return reply
          .code(502)
          .send({ error: "AI review could not be completed. Try again later." });
      }
    },
  );
}

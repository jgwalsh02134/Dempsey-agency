import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import { isStorageConfigured, getObjectBuffer } from "../../lib/storage.js";
import { reviewCreativeSchema } from "./schemas.js";
import { reviewCreative } from "./service.js";

export async function aiRoutes(app: FastifyInstance) {
  app.post(
    "/ai/review-creative",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      if (!isStorageConfigured()) {
        return reply
          .code(503)
          .send({ error: "Object storage is not configured" });
      }

      const { submissionId } = reviewCreativeSchema.parse(request.body);

      const submission = await app.prisma.creativeSubmission.findUnique({
        where: { id: submissionId },
      });
      if (!submission) {
        return reply.code(404).send({ error: "Submission not found" });
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

      const review = await reviewCreative({
        title: submission.title,
        description: submission.description,
        creativeType: submission.creativeType,
        mimeType: submission.mimeType,
        filename: submission.filename,
        fileBuffer,
      });

      return review;
    },
  );
}

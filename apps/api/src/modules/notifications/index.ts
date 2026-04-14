import type { FastifyInstance } from "fastify";
import type { NotificationType } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../../plugins/auth.js";

/**
 * Notifications API — current-user scoped reads plus idempotent mark-read
 * writes. Deliberately narrow surface: list / unread-count / mark one /
 * mark all. Keeps in-app UX simple and defers preferences/filters/digests.
 *
 * List responses are enriched server-side with a `link` descriptor so the
 * client can navigate directly without a follow-up lookup to resolve a
 * campaign id from a submission/placement id.
 */

const notificationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 50 : Math.min(Math.max(Number(v) | 0, 1), 200))),
  unread: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

/** NotificationTypes whose relatedId is a CreativeSubmission id. */
const SUBMISSION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "CREATIVE_REVISION_REQUESTED",
  "CREATIVE_REVISION_UPLOADED",
]);

/** NotificationTypes whose relatedId is a Placement id. */
const PLACEMENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "PLACEMENT_AWAITING_APPROVAL",
  "PLACEMENT_APPROVED_BY_CLIENT",
]);

/** NotificationTypes whose relatedId is a Document id (org-scoped — routes
 *  to /documents since there's no campaign context). */
const DOCUMENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "NEW_INVOICE_UPLOADED",
  "NEW_PROOF_UPLOADED",
]);

export async function notificationRoutes(app: FastifyInstance) {
  // ── List current user's notifications ─────────────────────────
  app.get(
    "/notifications",
    { preHandler: [requireAuth] },
    async (request) => {
      const { limit, unread } = listQuerySchema.parse(request.query);
      const userId = request.currentUser!.id;

      const rows = await app.prisma.notification.findMany({
        where: {
          userId,
          ...(unread === true ? { readAt: null } : {}),
          ...(unread === false ? { readAt: { not: null } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      /* Enrich with a `link` object so the client can navigate without a
       * second round-trip to resolve the campaign id from a submission or
       * placement id. Documents route to the org-level /documents page. */
      const submissionIds = new Set<string>();
      const placementIds = new Set<string>();
      for (const r of rows) {
        if (!r.relatedId) continue;
        if (SUBMISSION_TYPES.has(r.type)) submissionIds.add(r.relatedId);
        else if (PLACEMENT_TYPES.has(r.type)) placementIds.add(r.relatedId);
      }

      const [subs, placements] = await Promise.all([
        submissionIds.size > 0
          ? app.prisma.creativeSubmission.findMany({
              where: { id: { in: [...submissionIds] } },
              select: { id: true, campaignId: true },
            })
          : Promise.resolve([] as { id: string; campaignId: string }[]),
        placementIds.size > 0
          ? app.prisma.placement.findMany({
              where: { id: { in: [...placementIds] } },
              select: { id: true, campaignId: true },
            })
          : Promise.resolve([] as { id: string; campaignId: string }[]),
      ]);
      const subCampaign = new Map(subs.map((s) => [s.id, s.campaignId]));
      const plcCampaign = new Map(placements.map((p) => [p.id, p.campaignId]));

      const notifications = rows.map((r) => {
        let link:
          | { type: "CAMPAIGN"; campaignId: string }
          | { type: "DOCUMENTS" }
          | null = null;
        if (r.relatedId) {
          if (SUBMISSION_TYPES.has(r.type)) {
            const campaignId = subCampaign.get(r.relatedId);
            if (campaignId) link = { type: "CAMPAIGN", campaignId };
          } else if (PLACEMENT_TYPES.has(r.type)) {
            const campaignId = plcCampaign.get(r.relatedId);
            if (campaignId) link = { type: "CAMPAIGN", campaignId };
          } else if (DOCUMENT_TYPES.has(r.type)) {
            link = { type: "DOCUMENTS" };
          }
        }
        return { ...r, link };
      });

      return { notifications };
    },
  );

  // ── Unread count ──────────────────────────────────────────────
  app.get(
    "/notifications/unread-count",
    { preHandler: [requireAuth] },
    async (request) => {
      const count = await app.prisma.notification.count({
        where: { userId: request.currentUser!.id, readAt: null },
      });
      return { count };
    },
  );

  // ── Mark one as read (idempotent) ─────────────────────────────
  app.post(
    "/notifications/:id/read",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = notificationIdParamsSchema.parse(request.params);
      const userId = request.currentUser!.id;

      const existing = await app.prisma.notification.findUnique({
        where: { id },
        select: { id: true, userId: true, readAt: true },
      });
      if (!existing || existing.userId !== userId) {
        // Treat cross-user access as not-found to avoid leaking existence.
        return reply.code(404).send({ error: "Notification not found" });
      }

      if (existing.readAt) {
        return { id, readAt: existing.readAt };
      }
      const updated = await app.prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
        select: { id: true, readAt: true },
      });
      return updated;
    },
  );

  // ── Mark all as read ──────────────────────────────────────────
  app.post(
    "/notifications/read-all",
    { preHandler: [requireAuth] },
    async (request) => {
      const result = await app.prisma.notification.updateMany({
        where: { userId: request.currentUser!.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: result.count };
    },
  );
}

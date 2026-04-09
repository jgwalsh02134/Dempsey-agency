import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  orgIdParamsSchema,
  campaignIdParamsSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "./schemas.js";

const STATUS_ORDER: Record<string, number> = {
  ACTIVE: 0,
  PAUSED: 1,
  COMPLETED: 2,
};

export async function campaignRoutes(app: FastifyInstance) {
  // ── List campaigns for an organization ────────────────────────
  app.get(
    "/organizations/:orgId/campaigns",
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

      const campaigns = await app.prisma.campaign.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      campaigns.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
      );

      return { organizationId: orgId, campaigns };
    },
  );

  // ── Create a campaign (admin only) ────────────────────────────
  app.post(
    "/organizations/:orgId/campaigns",
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

      const parsed = createCampaignSchema.parse(request.body);

      const campaign = await app.prisma.campaign.create({
        data: {
          organizationId: orgId,
          title: parsed.title,
          description: parsed.description ?? null,
          status: parsed.status,
          startDate: parsed.startDate ? new Date(parsed.startDate) : null,
          endDate: parsed.endDate ? new Date(parsed.endDate) : null,
          createdById: request.currentUser!.id,
        },
      });

      return reply.code(201).send(campaign);
    },
  );

  // ── Update a campaign (admin only) ────────────────────────────
  app.patch(
    "/campaigns/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = campaignIdParamsSchema.parse(request.params);

      const campaign = await app.prisma.campaign.findUnique({
        where: { id },
      });
      if (!campaign) {
        return reply.code(404).send({ error: "Campaign not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        campaign.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = updateCampaignSchema.parse(request.body);

      const data: Record<string, unknown> = {};
      if (parsed.title !== undefined) data.title = parsed.title;
      if (parsed.description !== undefined)
        data.description = parsed.description;
      if (parsed.status !== undefined) data.status = parsed.status;
      if ("startDate" in parsed)
        data.startDate = parsed.startDate
          ? new Date(parsed.startDate)
          : null;
      if ("endDate" in parsed)
        data.endDate = parsed.endDate ? new Date(parsed.endDate) : null;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.campaign.update({
        where: { id },
        data,
      });

      return updated;
    },
  );

  // ── Delete a campaign (admin only) ────────────────────────────
  app.delete(
    "/campaigns/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = campaignIdParamsSchema.parse(request.params);

      const campaign = await app.prisma.campaign.findUnique({
        where: { id },
      });
      if (!campaign) {
        return reply.code(404).send({ error: "Campaign not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        campaign.organizationId,
        reply,
      );
      if (!manage) return;

      await app.prisma.campaign.delete({ where: { id } });

      return { success: true };
    },
  );
}

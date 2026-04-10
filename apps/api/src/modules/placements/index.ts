import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import type { AuthUser } from "../../plugins/auth.js";
import {
  campaignIdParamsSchema,
  placementIdParamsSchema,
  createPlacementSchema,
  updatePlacementSchema,
} from "./schemas.js";

const AGENCY_ROLES = new Set(["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"]);

function isAgencyUser(user: AuthUser): boolean {
  return user.memberships.some(
    (m) => m.organization.type === "AGENCY" && AGENCY_ROLES.has(m.role),
  );
}

export async function placementRoutes(app: FastifyInstance) {
  // ── List placements for a campaign ───────────────────────────
  app.get(
    "/campaigns/:campaignId/placements",
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

      const placements = await app.prisma.placement.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        include: {
          inventory: {
            include: {
              publisher: {
                select: { id: true, name: true, city: true, state: true },
              },
            },
          },
        },
      });

      const agency = isAgencyUser(request.currentUser!);

      const result = placements.map((p) => {
        const base = {
          id: p.id,
          campaignId: p.campaignId,
          inventoryId: p.inventoryId,
          name: p.name,
          status: p.status,
          grossCostCents: p.grossCostCents,
          quantity: p.quantity,
          notes: p.notes,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          inventory: {
            id: p.inventory.id,
            name: p.inventory.name,
            mediaType: p.inventory.mediaType,
            pricingModel: p.inventory.pricingModel,
            publisher: p.inventory.publisher,
          },
        };
        if (agency) {
          return { ...base, netCostCents: p.netCostCents };
        }
        return base;
      });

      return { campaignId, placements: result };
    },
  );

  // ── Create placement (agency admin via campaign org) ─────────
  app.post(
    "/campaigns/:campaignId/placements",
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

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        campaign.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = createPlacementSchema.parse(request.body);

      // Verify inventory exists
      const inventory = await app.prisma.inventory.findUnique({
        where: { id: parsed.inventoryId },
        select: { id: true },
      });
      if (!inventory) {
        return reply.code(404).send({ error: "Inventory item not found" });
      }

      const placement = await app.prisma.placement.create({
        data: {
          campaignId,
          inventoryId: parsed.inventoryId,
          name: parsed.name,
          status: parsed.status,
          grossCostCents: parsed.grossCostCents,
          netCostCents: parsed.netCostCents ?? null,
          quantity: parsed.quantity ?? null,
          notes: parsed.notes ?? null,
        },
        include: {
          inventory: {
            include: {
              publisher: {
                select: { id: true, name: true, city: true, state: true },
              },
            },
          },
        },
      });

      return reply.code(201).send(placement);
    },
  );

  // ── Update placement (agency admin via campaign org) ──────────
  app.patch(
    "/placements/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = placementIdParamsSchema.parse(request.params);

      const placement = await app.prisma.placement.findUnique({
        where: { id },
        include: { campaign: { select: { organizationId: true } } },
      });
      if (!placement) {
        return reply.code(404).send({ error: "Placement not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        placement.campaign.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = updatePlacementSchema.parse(request.body);
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) data[key] = value;
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.placement.update({
        where: { id },
        data,
      });
      return updated;
    },
  );

  // ── Delete placement (agency admin via campaign org) ──────────
  app.delete(
    "/placements/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = placementIdParamsSchema.parse(request.params);

      const placement = await app.prisma.placement.findUnique({
        where: { id },
        include: { campaign: { select: { organizationId: true } } },
      });
      if (!placement) {
        return reply.code(404).send({ error: "Placement not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        placement.campaign.organizationId,
        reply,
      );
      if (!manage) return;

      await app.prisma.placement.delete({ where: { id } });
      return { success: true };
    },
  );
}

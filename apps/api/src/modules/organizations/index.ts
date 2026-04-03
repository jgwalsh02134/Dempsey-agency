import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import {
  membershipHasOrgAdminRole,
  requireRole,
} from "../../lib/rbac.js";
import {
  resolveVisibleOrganizationIds,
} from "../../lib/org-scope.js";
import { createOrganizationSchema, orgParamsSchema } from "./schemas.js";

export async function organizationRoutes(app: FastifyInstance) {
  app.get("/organizations", { preHandler: [requireAuth] }, async (request) => {
    const visible = await resolveVisibleOrganizationIds(
      app.prisma,
      request.currentUser!,
    );
    const where =
      visible === null
        ? {}
        : { id: { in: visible.length ? visible : ["__none__"] } };

    return app.prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  });

  app.get(
    "/organizations/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = orgParamsSchema.parse(request.params);
      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(id)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const org = await app.prisma.organization.findUnique({
        where: { id },
        include: {
          memberships: {
            include: { user: { omit: { passwordHash: true } } },
          },
          agencyRelationships: { include: { client: true } },
          clientRelationships: { include: { agency: true } },
        },
      });

      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }
      return org;
    },
  );

  app.post(
    "/organizations",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const parsed = createOrganizationSchema.parse(request.body);
      const { agencyOrganizationId, ...rest } = parsed;

      if (rest.type === "AGENCY") {
        const isOwner = request.currentUser!.memberships.some(
          (m) => m.role === "AGENCY_OWNER",
        );
        if (!isOwner) {
          return reply.code(403).send({
            error: "Forbidden: only an agency owner can create a new agency organization",
          });
        }

        const org = await app.prisma.organization.create({
          data: { name: rest.name, type: "AGENCY" },
        });
        return reply.code(201).send(org);
      }

      const agencyId = agencyOrganizationId!;

      if (!membershipHasOrgAdminRole(request.currentUser!, agencyId)) {
        return reply.code(403).send({
          error:
            "Forbidden: must be agency owner or admin of the parent agency organization",
        });
      }

      const agencyOrg = await app.prisma.organization.findUnique({
        where: { id: agencyId },
      });
      if (!agencyOrg || agencyOrg.type !== "AGENCY") {
        return reply.code(400).send({
          error: "agencyOrganizationId must reference an agency organization",
        });
      }

      const org = await app.prisma.organization.create({
        data: { name: rest.name, type: "CLIENT" },
      });

      await app.prisma.agencyClientRelationship.create({
        data: { agencyId, clientId: org.id },
      });

      return reply.code(201).send(org);
    },
  );
}

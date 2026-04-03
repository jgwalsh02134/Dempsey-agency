import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { membershipHasOrgAdminRole, requireRole } from "../../lib/rbac.js";
import { resolveAgencyOrgIdsForUser } from "../../lib/org-scope.js";
import { createAgencyClientSchema } from "./schemas.js";

export async function agencyClientRoutes(app: FastifyInstance) {
  app.get("/agency-clients", { preHandler: [requireAuth] }, async (request) => {
    const agencyIds = resolveAgencyOrgIdsForUser(request.currentUser!);
    const where =
      agencyIds === null
        ? {}
        : {
            agencyId: {
              in: agencyIds.length ? agencyIds : ["__none__"],
            },
          };

    return app.prisma.agencyClientRelationship.findMany({
      where,
      include: { agency: true, client: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/agency-clients",
    {
      preHandler: [requireAuth, requireRole("AGENCY_OWNER", "AGENCY_ADMIN")],
    },
    async (request, reply) => {
      const data = createAgencyClientSchema.parse(request.body);

      if (!membershipHasOrgAdminRole(request.currentUser!, data.agencyId)) {
        return reply.code(403).send({
          error:
            "Forbidden: must be agency owner or admin on the agency organization",
        });
      }

      const agency = await app.prisma.organization.findUnique({
        where: { id: data.agencyId },
      });
      const client = await app.prisma.organization.findUnique({
        where: { id: data.clientId },
      });

      if (!agency || agency.type !== "AGENCY") {
        return reply.code(400).send({ error: "agencyId must be an agency organization" });
      }
      if (!client || client.type !== "CLIENT") {
        return reply.code(400).send({ error: "clientId must be a client organization" });
      }

      const relationship = await app.prisma.agencyClientRelationship.create({
        data,
        include: { agency: true, client: true },
      });
      return reply.code(201).send(relationship);
    },
  );
}

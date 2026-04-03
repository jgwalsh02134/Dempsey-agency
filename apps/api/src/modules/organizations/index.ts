import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import { createOrganizationSchema, orgParamsSchema } from "./schemas.js";

export async function organizationRoutes(app: FastifyInstance) {
  app.get("/organizations", { preHandler: [requireAuth] }, async () => {
    return app.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
    });
  });

  app.get(
    "/organizations/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = orgParamsSchema.parse(request.params);
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
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const data = createOrganizationSchema.parse(request.body);
      const org = await app.prisma.organization.create({ data });
      return reply.code(201).send(org);
    },
  );
}

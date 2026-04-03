import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import { createAgencyClientSchema } from "./schemas.js";

export async function agencyClientRoutes(app: FastifyInstance) {
  app.get("/agency-clients", { preHandler: [requireAuth] }, async () => {
    return app.prisma.agencyClientRelationship.findMany({
      include: { agency: true, client: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/agency-clients",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const data = createAgencyClientSchema.parse(request.body);
      const relationship = await app.prisma.agencyClientRelationship.create({
        data,
        include: { agency: true, client: true },
      });
      return reply.code(201).send(relationship);
    },
  );
}

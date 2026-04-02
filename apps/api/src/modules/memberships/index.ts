import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { createMembershipSchema } from "./schemas.js";

export async function membershipRoutes(app: FastifyInstance) {
  app.get("/memberships", { preHandler: [requireAuth] }, async () => {
    return app.prisma.organizationMembership.findMany({
      include: { user: true, organization: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/memberships",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const data = createMembershipSchema.parse(request.body);
      const membership = await app.prisma.organizationMembership.create({
        data,
        include: { user: true, organization: true },
      });
      return reply.code(201).send(membership);
    },
  );
}

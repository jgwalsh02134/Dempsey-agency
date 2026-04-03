import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import { createMembershipSchema } from "./schemas.js";

export async function membershipRoutes(app: FastifyInstance) {
  app.get("/memberships", { preHandler: [requireAuth] }, async () => {
    return app.prisma.organizationMembership.findMany({
      include: {
        user: { omit: { passwordHash: true } },
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/memberships",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const data = createMembershipSchema.parse(request.body);
      const membership = await app.prisma.organizationMembership.create({
        data,
        include: {
          user: { omit: { passwordHash: true } },
          organization: true,
        },
      });
      return reply.code(201).send(membership);
    },
  );
}

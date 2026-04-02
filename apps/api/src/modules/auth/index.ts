import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.currentUser!.id },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    return user;
  });
}

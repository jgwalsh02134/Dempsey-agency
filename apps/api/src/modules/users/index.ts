import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { createUserSchema, userParamsSchema } from "./schemas.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: [requireAuth] }, async () => {
    return app.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get(
    "/users/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = userParamsSchema.parse(request.params);
      const user = await app.prisma.user.findUnique({
        where: { id },
        include: { memberships: { include: { organization: true } } },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return user;
    },
  );

  app.post("/users", { preHandler: [requireAuth] }, async (request, reply) => {
    const data = createUserSchema.parse(request.body);
    const user = await app.prisma.user.create({ data });
    return reply.code(201).send(user);
  });
}

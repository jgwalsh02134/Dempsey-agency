import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import { hashPassword } from "../../lib/password.js";
import { createUserSchema, userParamsSchema } from "./schemas.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: [requireAuth] }, async () => {
    return app.prisma.user.findMany({
      omit: { passwordHash: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get(
    "/users/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = userParamsSchema.parse(request.params);
      const user = await app.prisma.user.findUnique({
        where: { id },
        omit: { passwordHash: true },
        include: { memberships: { include: { organization: true } } },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return user;
    },
  );

  app.post(
    "/users",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const { password, ...data } = createUserSchema.parse(request.body);
      const passwordHash = await hashPassword(password);
      const user = await app.prisma.user.create({
        data: { ...data, passwordHash },
        omit: { passwordHash: true },
      });
      return reply.code(201).send(user);
    },
  );
}

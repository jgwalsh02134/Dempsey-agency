import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { verifyPassword } from "../../lib/password.js";
import { loginSchema } from "./schemas.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  });

  app.post(
    "/logout",
    { preHandler: [requireAuth] },
    async (_request, _reply) => {
      // Stateless JWT — logout is handled client-side by discarding the token.
      // Add token blacklisting here when Redis is available.
      return { success: true };
    },
  );

  app.get(
    "/me",
    { preHandler: [requireAuth] },
    async (request) => {
      return request.currentUser;
    },
  );
}

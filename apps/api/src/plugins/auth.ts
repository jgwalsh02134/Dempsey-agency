import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface AuthUser {
  id: string;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser: AuthUser | null;
  }
}

/**
 * Decorates every request with `currentUser`.
 * Placeholder implementation: trusts x-user-id / x-user-email headers.
 * Replace the preHandler body with Clerk (or any JWT provider) later.
 */
export default fp(async (app) => {
  app.decorateRequest("currentUser", null);

  app.addHook("preHandler", async (request) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    const userEmail = request.headers["x-user-email"] as string | undefined;

    if (userId && userEmail) {
      request.currentUser = { id: userId, email: userEmail };
    }
  });
});

/** Pre-handler that rejects unauthenticated requests. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.currentUser) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

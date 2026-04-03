import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role, OrganizationType } from "@prisma/client";

export interface AuthMembership {
  id: string;
  organizationId: string;
  role: Role;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  memberships: AuthMembership[];
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser: AuthUser | null;
  }
}

/**
 * Decorates every request with `currentUser`.
 * Verifies the JWT Bearer token and loads user + memberships from DB.
 * Skips silently when no token is present (public routes still work).
 */
export default fp(async (app) => {
  app.decorateRequest("currentUser", null);

  app.addHook("preHandler", async (request) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;

    try {
      const payload = await request.jwtVerify<{
        sub: string;
        email: string;
      }>();

      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
        omit: { passwordHash: true },
        include: {
          memberships: { include: { organization: true } },
        },
      });

      if (user?.active) {
        request.currentUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          memberships: user.memberships.map((m) => ({
            id: m.id,
            organizationId: m.organizationId,
            role: m.role,
            organization: {
              id: m.organization.id,
              name: m.organization.name,
              type: m.organization.type,
            },
          })),
        };
      }
    } catch {
      // invalid / expired token — currentUser stays null
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

import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";

/**
 * Require the authenticated user to hold at least one of the given
 * roles in ANY of their organization memberships.
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const match = request.currentUser.memberships.some((m) =>
      roles.includes(m.role),
    );
    if (!match) {
      return reply.code(403).send({ error: "Forbidden: insufficient role" });
    }
  };
}

/**
 * Require the authenticated user to be a member of the organization
 * identified by `request.params[orgIdParam]`.
 */
export function requireOrgMembership(orgIdParam = "id") {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const orgId = (request.params as Record<string, string>)[orgIdParam];
    if (!orgId) {
      return reply.code(400).send({ error: "Missing organization ID" });
    }
    const isMember = request.currentUser.memberships.some(
      (m) => m.organizationId === orgId,
    );
    if (!isMember) {
      return reply
        .code(403)
        .send({ error: "Forbidden: not a member of this organization" });
    }
  };
}

/**
 * Require the authenticated user to hold one of the given roles
 * inside a specific organization (from route params).
 */
export function requireOrgRole(orgIdParam: string, ...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const orgId = (request.params as Record<string, string>)[orgIdParam];
    if (!orgId) {
      return reply.code(400).send({ error: "Missing organization ID" });
    }
    const membership = request.currentUser.memberships.find(
      (m) => m.organizationId === orgId,
    );
    if (!membership) {
      return reply
        .code(403)
        .send({ error: "Forbidden: not a member of this organization" });
    }
    if (roles.length > 0 && !roles.includes(membership.role)) {
      return reply
        .code(403)
        .send({ error: "Forbidden: insufficient role in this organization" });
    }
  };
}

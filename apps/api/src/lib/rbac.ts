import type { FastifyReply, FastifyRequest } from "fastify";
import type { OrganizationType, PrismaClient, Role } from "@prisma/client";
import type { AuthUser } from "../plugins/auth.js";

const ADMIN_ROLES: Role[] = ["AGENCY_OWNER", "AGENCY_ADMIN"];

export type ManageOrganizationResult =
  | { ok: false }
  | { ok: true; viaAgencyLink: boolean };

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

export function membershipHasOrgAdminRole(
  user: AuthUser,
  organizationId: string,
): boolean {
  const target = organizationId.trim();
  const m = user.memberships.find(
    (x) => x.organizationId.trim() === target || x.organization.id.trim() === target,
  );
  return m != null && ADMIN_ROLES.includes(m.role);
}

/**
 * Authoritative check for “may act as agency admin on this org” using the database.
 * Ensures the org exists, is type AGENCY, and the user is AGENCY_OWNER or AGENCY_ADMIN there.
 * Prefer this for writes (e.g. creating client orgs) so permissions match live data, not only the JWT session snapshot.
 */
export async function userIsAgencyOrganizationAdmin(
  prisma: PrismaClient,
  userId: string,
  agencyOrganizationId: string,
): Promise<boolean> {
  const id = agencyOrganizationId.trim();
  if (!id) return false;

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      organizationId: id,
      role: { in: ADMIN_ROLES },
      organization: { type: "AGENCY" },
    },
  });

  return membership != null;
}

export async function resolveCanManageOrganization(
  prisma: PrismaClient,
  user: AuthUser,
  organizationId: string,
): Promise<ManageOrganizationResult> {
  if (membershipHasOrgAdminRole(user, organizationId)) {
    return { ok: true, viaAgencyLink: false };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) {
    return { ok: false };
  }

  const direct = user.memberships.find(
    (m) => m.organizationId === organizationId,
  );
  if (org.type === "CLIENT" && direct?.role === "CLIENT_ADMIN") {
    return { ok: true, viaAgencyLink: false };
  }

  if (org.type !== "CLIENT") {
    return { ok: false };
  }

  const agencyOrgIds = user.memberships
    .filter(
      (m) =>
        ADMIN_ROLES.includes(m.role) && m.organization.type === "AGENCY",
    )
    .map((m) => m.organizationId);

  if (agencyOrgIds.length === 0) {
    return { ok: false };
  }

  const link = await prisma.agencyClientRelationship.findFirst({
    where: {
      clientId: organizationId,
      agencyId: { in: agencyOrgIds },
    },
  });

  if (!link) {
    return { ok: false };
  }

  return { ok: true, viaAgencyLink: true };
}

export async function assertCanManageOrganization(
  prisma: PrismaClient,
  user: AuthUser,
  organizationId: string,
  reply: FastifyReply,
): Promise<Extract<ManageOrganizationResult, { ok: true }> | null> {
  const result = await resolveCanManageOrganization(
    prisma,
    user,
    organizationId,
  );
  if (!result.ok) {
    await reply
      .code(403)
      .send({ error: "Forbidden: insufficient access to this organization" });
    return null;
  }
  return result;
}

export function assertCanAssignMembershipRole(
  actor: AuthUser,
  targetOrganizationId: string,
  targetOrgType: OrganizationType,
  targetRole: Role,
  manage: ManageOrganizationResult & { ok: true },
  reply: FastifyReply,
): boolean {
  if (targetOrgType === "AGENCY") {
    const m = actor.memberships.find(
      (x) => x.organizationId === targetOrganizationId,
    );
    if (!m || !ADMIN_ROLES.includes(m.role)) {
      reply.code(403).send({ error: "Forbidden" });
      return false;
    }
    const allowed: Role[] = ["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"];
    if (!allowed.includes(targetRole)) {
      reply.code(400).send({
        error: "Invalid role for an agency organization",
      });
      return false;
    }
    if (["AGENCY_OWNER", "AGENCY_ADMIN"].includes(targetRole)) {
      if (m.role !== "AGENCY_OWNER") {
        reply.code(403).send({
          error:
            "Forbidden: only an agency owner can assign owner or admin roles",
        });
        return false;
      }
    }
    return true;
  }

  const allowed: Role[] = ["CLIENT_ADMIN", "CLIENT_USER"];
  if (!allowed.includes(targetRole)) {
    reply.code(400).send({
      error: "Invalid role for a client organization",
    });
    return false;
  }

  const m = actor.memberships.find(
    (x) => x.organizationId === targetOrganizationId,
  );
  const isClientAdmin =
    m?.role === "CLIENT_ADMIN" && m.organization.type === "CLIENT";

  if (manage.viaAgencyLink) {
    return true;
  }
  if (isClientAdmin) {
    if (targetRole !== "CLIENT_USER") {
      reply.code(403).send({
        error:
          "Forbidden: client admins may only assign the CLIENT_USER role",
      });
      return false;
    }
    return true;
  }

  reply.code(403).send({ error: "Forbidden" });
  return false;
}

import type { FastifyReply } from "fastify";
import type { PrismaClient, Role } from "@prisma/client";
import type { AuthUser } from "../plugins/auth.js";
import { isPlatformAgencyOwner } from "./org-scope.js";
import {
  resolveCanManageOrganization,
  userIsAgencyOrganizationAdmin,
} from "./rbac.js";

const AGENCY_OWNER: Role = "AGENCY_OWNER";

/**
 * Who may list members of an organization:
 * - Agency owner/admin on an AGENCY org (for that agency).
 * - Agency owner/admin on the linked agency (for a CLIENT org).
 * - CLIENT_ADMIN in that client org only.
 */
export async function assertCanListOrganizationUsers(
  prisma: PrismaClient,
  user: AuthUser,
  organizationId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const id = organizationId.trim();
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) {
    await reply.code(404).send({ error: "Organization not found" });
    return false;
  }

  if (isPlatformAgencyOwner(user)) {
    return true;
  }

  const direct = user.memberships.find((m) => m.organizationId === id);

  if (org.type === "CLIENT") {
    const isClientAdmin =
      direct?.role === "CLIENT_ADMIN" &&
      direct.organization.type === "CLIENT";
    if (isClientAdmin) return true;

    const link = await prisma.agencyClientRelationship.findFirst({
      where: { clientId: id },
    });
    if (
      link &&
      (await userIsAgencyOrganizationAdmin(prisma, user.id, link.agencyId))
    ) {
      return true;
    }
  } else if (org.type === "AGENCY") {
    if (await userIsAgencyOrganizationAdmin(prisma, user.id, id)) {
      return true;
    }
  }

  await reply.code(403).send({
    error: "Forbidden",
    message: "You cannot list users for this organization",
  });
  return false;
}

export async function countAgencyOwnersInOrganization(
  prisma: PrismaClient,
  organizationId: string,
): Promise<number> {
  return prisma.organizationMembership.count({
    where: { organizationId, role: AGENCY_OWNER },
  });
}

/**
 * Block removing the last AGENCY_OWNER from an agency organization.
 */
export async function assertNotRemovingLastAgencyOwner(
  prisma: PrismaClient,
  membership: { organizationId: string; role: Role },
  organizationType: "AGENCY" | "CLIENT",
  reply: FastifyReply,
): Promise<boolean> {
  if (
    organizationType !== "AGENCY" ||
    membership.role !== AGENCY_OWNER
  ) {
    return true;
  }

  const count = await countAgencyOwnersInOrganization(
    prisma,
    membership.organizationId,
  );
  if (count <= 1) {
    await reply.code(400).send({
      error: "Cannot remove the last agency owner from this organization",
    });
    return false;
  }
  return true;
}

/**
 * Block role changes that would leave an agency with zero AGENCY_OWNERs.
 */
export async function assertRoleChangePreservesAgencyOwner(
  prisma: PrismaClient,
  membership: { organizationId: string; role: Role },
  organizationType: "AGENCY" | "CLIENT",
  newRole: Role,
  reply: FastifyReply,
): Promise<boolean> {
  if (
    organizationType !== "AGENCY" ||
    membership.role !== AGENCY_OWNER ||
    newRole === AGENCY_OWNER
  ) {
    return true;
  }

  const count = await countAgencyOwnersInOrganization(
    prisma,
    membership.organizationId,
  );
  if (count <= 1) {
    await reply.code(400).send({
      error:
        "Cannot change the role of the last agency owner; assign another owner first",
    });
    return false;
  }
  return true;
}

export async function assertActorCanDeactivateTarget(
  prisma: PrismaClient,
  actor: AuthUser,
  targetUserId: string,
  reply: FastifyReply,
): Promise<boolean> {
  if (actor.id === targetUserId) {
    await reply
      .code(400)
      .send({ error: "Cannot deactivate your own account" });
    return false;
  }

  const targetExists = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!targetExists) {
    await reply.code(404).send({ error: "User not found" });
    return false;
  }

  const targetMemberships = await prisma.organizationMembership.findMany({
    where: { userId: targetUserId },
    select: { organizationId: true },
  });

  for (const m of targetMemberships) {
    const manage = await resolveCanManageOrganization(
      prisma,
      actor,
      m.organizationId,
    );
    if (manage.ok) {
      return true;
    }
  }

  await reply.code(403).send({
    error: "Forbidden",
    message: "Insufficient access to deactivate this user",
  });
  return false;
}

import type { FastifyBaseLogger } from "fastify";
import type { NotificationType, PrismaClient } from "@prisma/client";

/**
 * Lightweight notification layer.
 *
 * Persistence-only for v1: call sites write rows and move on. Delivery
 * channels (email, in-app center) read this table later — when they land
 * they won't require changes to upstream call sites.
 *
 * Errors are logged and swallowed. A workflow write (submission, placement,
 * document) must never fail because a fan-out hit a transient DB issue; the
 * notification is a nice-to-have, the business action is not.
 */

interface NotifyArgs {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Opaque pointer into the originating domain row (submission id, etc.). */
  relatedId?: string | null;
}

export async function notify(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  { userIds, type, title, body = null, relatedId = null }: NotifyArgs,
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type,
        title,
        body,
        relatedId,
      })),
    });
  } catch (err) {
    log.warn(
      { err, type, count: unique.length },
      "notification.createMany failed; event will not be persisted",
    );
  }
}

/** Client users (CLIENT_ADMIN, CLIENT_USER) who are members of the given
 *  organization — the recipients for client-facing events on that org's
 *  campaigns. */
export async function getClientUserIdsForOrg(
  prisma: PrismaClient,
  orgId: string,
): Promise<string[]> {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      role: { in: ["CLIENT_ADMIN", "CLIENT_USER"] },
      user: { active: true },
    },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}

/** Agency users (AGENCY_OWNER, AGENCY_ADMIN, STAFF) across all agency
 *  organizations that manage the given client organization. Used to notify
 *  agency-side staff about client-driven events on their client's
 *  campaigns. */
export async function getAgencyUserIdsForClientOrg(
  prisma: PrismaClient,
  clientOrgId: string,
): Promise<string[]> {
  const rels = await prisma.agencyClientRelationship.findMany({
    where: { clientId: clientOrgId },
    select: { agencyId: true },
  });
  const agencyIds = rels.map((r) => r.agencyId);
  if (agencyIds.length === 0) return [];

  const memberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: { in: agencyIds },
      role: { in: ["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"] },
      user: { active: true },
    },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}

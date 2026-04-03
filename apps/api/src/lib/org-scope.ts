import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "../plugins/auth.js";

const ADMIN_ROLES = ["AGENCY_OWNER", "AGENCY_ADMIN"] as const;

/** True if the user is an AGENCY_OWNER in at least one organization. */
export function isPlatformAgencyOwner(user: AuthUser): boolean {
  return user.memberships.some((m) => m.role === "AGENCY_OWNER");
}

/**
 * Organization IDs visible in list endpoints.
 * `null` means no filter (full list — agency owner view).
 */
export async function resolveVisibleOrganizationIds(
  prisma: PrismaClient,
  user: AuthUser,
): Promise<string[] | null> {
  if (isPlatformAgencyOwner(user)) {
    return null;
  }

  const ids = new Set<string>();
  for (const m of user.memberships) {
    ids.add(m.organizationId);
    if (
      ADMIN_ROLES.includes(m.role as (typeof ADMIN_ROLES)[number]) &&
      m.organization.type === "AGENCY"
    ) {
      const rels = await prisma.agencyClientRelationship.findMany({
        where: { agencyId: m.organizationId },
        select: { clientId: true },
      });
      for (const r of rels) {
        ids.add(r.clientId);
      }
    }
  }
  return [...ids];
}

/** Agency org IDs the user belongs to (for scoping agency-client reads). */
export function resolveAgencyOrgIdsForUser(user: AuthUser): string[] | null {
  if (isPlatformAgencyOwner(user)) {
    return null;
  }
  return user.memberships
    .filter((m) => m.organization.type === "AGENCY")
    .map((m) => m.organizationId);
}

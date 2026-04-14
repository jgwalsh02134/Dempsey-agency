import type { FastifyBaseLogger } from "fastify";
import type { NotificationType, PrismaClient } from "@prisma/client";
import { adminBaseUrl, portalBaseUrl, sendEmail } from "./email.js";

/**
 * Lightweight notification layer.
 *
 * Persistence-first: call sites write rows via `notify()`; email delivery
 * piggybacks on the same call for a small set of high-value types. Both the
 * persistence write and the email fan-out are fail-safe — the originating
 * workflow write (submission/placement/document) is never blocked by a
 * notification or email failure.
 */

/** Structured link that mirrors the list-endpoint response so the email CTA
 *  matches in-app navigation. Callers pass what they already have from the
 *  surrounding domain object — no extra DB round-trips. */
export type NotifyLink =
  | { type: "CAMPAIGN"; campaignId: string }
  | { type: "DOCUMENTS" }
  | null;

interface NotifyArgs {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Opaque pointer into the originating domain row (submission id, etc.). */
  relatedId?: string | null;
  /** Optional navigation hint used to build CTA links in outgoing emails
   *  and (implicitly, via stored relatedId) the in-app list. */
  link?: NotifyLink;
}

/** Types that trigger outbound email alongside in-app persistence. Kept
 *  deliberately narrow for v1 — higher-signal events only. Any event NOT
 *  in this set is in-app only. */
const EMAIL_ENABLED_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "CREATIVE_REVISION_REQUESTED",
  "CREATIVE_REVISION_UPLOADED",
  "PLACEMENT_AWAITING_APPROVAL",
  "PLACEMENT_APPROVED_BY_CLIENT",
  "NEW_INVOICE_UPLOADED",
]);

/** Types directed at client users (use portal base for CTA links). */
const CLIENT_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "CREATIVE_REVISION_REQUESTED",
  "PLACEMENT_AWAITING_APPROVAL",
  "NEW_INVOICE_UPLOADED",
  "NEW_PROOF_UPLOADED",
]);

/** Build a CTA URL from the chosen base + structured link. Returns null when
 *  base is unconfigured OR when the link can't be resolved — emails omit the
 *  CTA rather than link to a broken path. */
function buildCtaUrl(
  base: string | null,
  link: NotifyLink | undefined,
): string | null {
  if (!base) return null;
  const trimmed = base.replace(/\/$/, "");
  if (!link) return `${trimmed}/notifications`;
  if (link.type === "CAMPAIGN") {
    return `${trimmed}/campaigns/${encodeURIComponent(link.campaignId)}`;
  }
  if (link.type === "DOCUMENTS") return `${trimmed}/documents`;
  return null;
}

/** Render a plain-text email body from title/body + optional CTA. Kept
 *  minimal — no template engine, no branded HTML. Good enough for v1
 *  transactional mail; upgrade when a design system for email arrives. */
function renderBodies(
  title: string,
  body: string | null | undefined,
  cta: string | null,
): { text: string; html: string } {
  const lines: string[] = [title];
  if (body && body.trim().length > 0) {
    lines.push("", body.trim());
  }
  if (cta) {
    lines.push("", `Open in Dempsey Agency: ${cta}`);
  }
  lines.push("", "— Dempsey Agency");
  const text = lines.join("\n");
  const safe = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const html = [
    `<p><strong>${safe(title)}</strong></p>`,
    body && body.trim().length > 0
      ? `<p>${safe(body.trim()).replace(/\n/g, "<br>")}</p>`
      : "",
    cta
      ? `<p><a href="${safe(cta)}">Open in Dempsey Agency</a></p>`
      : "",
    `<p style="color:#6b7280;font-size:12px;">— Dempsey Agency</p>`,
  ]
    .filter(Boolean)
    .join("");
  return { text, html };
}

export async function notify(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  args: NotifyArgs,
): Promise<void> {
  const { userIds, type, title, body = null, relatedId = null, link } = args;
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return;

  /* ── 1. Persist in-app rows ───────────────────────────────── */
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
    // Fall through: if persistence failed we deliberately skip email too —
    // without an in-app record the user has nowhere to land if they click
    // through. Better to drop entirely than create an orphan email.
    return;
  }

  /* ── 2. Fan out email for enabled types ───────────────────── */
  if (!EMAIL_ENABLED_TYPES.has(type)) return;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: unique }, active: true, email: { not: "" } },
      select: { email: true },
    });
    const addresses = users.map((u) => u.email).filter(Boolean);
    if (addresses.length === 0) return;

    const base = CLIENT_TYPES.has(type) ? portalBaseUrl() : adminBaseUrl();
    const cta = buildCtaUrl(base, link);
    const { text, html } = renderBodies(title, body, cta);

    // One email per recipient — simple, avoids exposing everyone via `to`.
    // If Resend is unconfigured, sendEmail() is a logged no-op.
    for (const to of addresses) {
      try {
        await sendEmail(log, { to, subject: title, text, html });
      } catch (err) {
        log.warn(
          { err, type, to },
          "email delivery failed; in-app notification is intact",
        );
      }
    }
  } catch (err) {
    // Lookup/query error — notifications are already persisted, workflow
    // already completed. Log and move on.
    log.warn(
      { err, type },
      "email fan-out skipped due to recipient lookup failure",
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

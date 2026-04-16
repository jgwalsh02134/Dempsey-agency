import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";

export type InviteRow = {
  id: string;
  token: string;
  email: string;
  name: string | null;
  role: string;
  invited_by: string;
  created_at: Date;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  accepted_by_user_id: string | null;
};

export type InviteStatus = "valid" | "accepted" | "revoked" | "expired";

export const ALLOWED_INVITE_ROLES = ["member", "admin"] as const;
export type InviteRole = (typeof ALLOWED_INVITE_ROLES)[number];

export function generateInviteToken(): string {
  // 32 bytes = 256 bits entropy, base64url (~43 chars, URL-safe).
  return randomBytes(32).toString("base64url");
}

export function inviteStatus(
  invite: InviteRow,
  now: Date = new Date(),
): InviteStatus {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  if (invite.expires_at.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export async function findInviteByToken(
  db: Pool | PoolClient,
  token: string,
): Promise<InviteRow | null> {
  const { rows } = await db.query<InviteRow>(
    `SELECT id, token, email, name, role, invited_by, created_at,
            expires_at, accepted_at, revoked_at, accepted_by_user_id
       FROM workspace_invite
      WHERE token = $1
      LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

/**
 * Revoke any still-pending, still-valid invites for this email. Called when
 * an admin re-invites the same email — the old link should stop working.
 */
export async function revokeOutstandingInvitesForEmail(
  db: Pool | PoolClient,
  email: string,
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE workspace_invite
        SET revoked_at = NOW()
      WHERE email = $1
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > NOW()`,
    [email],
  );
  return rowCount ?? 0;
}

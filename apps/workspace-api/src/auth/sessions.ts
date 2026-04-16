import { randomBytes } from "node:crypto";
import type { Pool } from "pg";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  must_reset_password: boolean;
};

export function generateSessionId(): string {
  // 32 bytes = 256 bits of entropy, base64url encoded (~43 chars).
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  db: Pool,
  userId: string,
  ttlDays: number,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO workspace_session
       (id, user_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, expiresAt, meta.ipAddress ?? null, meta.userAgent ?? null],
  );

  return { id, expiresAt };
}

export async function findSessionUser(
  db: Pool,
  sessionId: string,
): Promise<SessionUser | null> {
  const { rows } = await db.query<SessionUser>(
    `SELECT u.id, u.email, u.name, u.role, u.is_active, u.must_reset_password
       FROM workspace_session s
       JOIN workspace_user u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
        AND u.is_active = TRUE
      LIMIT 1`,
    [sessionId],
  );

  if (rows.length === 0) return null;

  // Touch last_seen_at (best-effort; lookup already succeeded).
  void db
    .query("UPDATE workspace_session SET last_seen_at = NOW() WHERE id = $1", [
      sessionId,
    ])
    .catch(() => {
      /* non-critical */
    });

  return rows[0];
}

export async function destroySession(
  db: Pool,
  sessionId: string,
): Promise<void> {
  await db.query("DELETE FROM workspace_session WHERE id = $1", [sessionId]);
}

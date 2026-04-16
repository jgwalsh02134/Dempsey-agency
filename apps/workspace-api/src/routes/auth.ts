import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { createSession, destroySession } from "../auth/sessions.js";
import {
  sessionClearCookieOptions,
  sessionCookieOptions,
} from "../auth/cookies.js";
import {
  ALLOWED_INVITE_ROLES,
  findInviteByToken,
  generateInviteToken,
  inviteStatus,
  revokeOutstandingInvitesForEmail,
  type InviteRow,
} from "../auth/invites.js";

const loginBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(512),
});

const inviteBody = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().max(200).optional(),
  role: z.enum(ALLOWED_INVITE_ROLES).default("member"),
});

const inviteTokenParam = z.object({
  token: z.string().min(1).max(256),
});

const acceptInviteBody = z.object({
  token: z.string().min(1).max(256),
  password: z.string().min(12).max(512),
  name: z.string().trim().max(200).optional(),
});

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  password_hash: string;
  is_active: boolean;
  must_reset_password: boolean;
};

type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustResetPassword: boolean;
};

const GENERIC_AUTH_ERROR = { error: "Invalid email or password." };

function publicUser(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  must_reset_password: boolean;
}): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    mustResetPassword: row.must_reset_password,
  };
}

function deriveWorkspaceUrl(request: FastifyRequest): string {
  if (env.APP_WORKSPACE_URL) return env.APP_WORKSPACE_URL.replace(/\/$/, "");
  // trustProxy: true is enabled in app.ts, so these honor forwarded headers.
  return `${request.protocol}://${request.hostname}`;
}

function buildAcceptUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function authRoutes(app: FastifyInstance) {
  // ================================================================
  // POST /login — existing
  // ================================================================
  app.post("/login", async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(GENERIC_AUTH_ERROR);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const result = await app.db.query<UserRow>(
      `SELECT id, email, name, role, password_hash, is_active, must_reset_password
         FROM workspace_user
        WHERE email = $1
        LIMIT 1`,
      [email],
    );

    if (result.rows.length === 0) {
      return reply.code(401).send(GENERIC_AUTH_ERROR);
    }

    const user = result.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return reply.code(401).send(GENERIC_AUTH_ERROR);
    }

    if (!user.is_active) {
      return reply.code(403).send({
        error: "Your account is disabled. Contact your administrator.",
      });
    }

    const { id: sessionId, expiresAt } = await createSession(
      app.db,
      user.id,
      env.SESSION_TTL_DAYS,
      {
        ipAddress: request.ip ?? null,
        userAgent: request.headers["user-agent"] ?? null,
      },
    );

    void app.db
      .query("UPDATE workspace_user SET last_login_at = NOW() WHERE id = $1", [
        user.id,
      ])
      .catch((err) => {
        app.log.warn({ err }, "failed to update last_login_at");
      });

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionId,
      sessionCookieOptions(expiresAt),
    );

    return reply.send({ user: publicUser(user) });
  });

  // ================================================================
  // POST /logout — existing
  // ================================================================
  app.post("/logout", async (request, reply) => {
    const cookieValue = request.cookies?.[env.SESSION_COOKIE_NAME];
    if (cookieValue) {
      try {
        await destroySession(app.db, cookieValue);
      } catch (err) {
        app.log.error({ err }, "session destroy failed");
      }
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, sessionClearCookieOptions());
    return reply.send({ ok: true });
  });

  // ================================================================
  // GET /me — existing
  // ================================================================
  app.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    return reply.send({ user: publicUser(request.user) });
  });

  // ================================================================
  // POST /invite — ADMIN ONLY
  //
  // Policy:
  //   - If an account (active or disabled) already exists with that email
  //     → 409. Reactivation is a separate admin operation, not a re-invite.
  //   - If outstanding pending invites exist for the email, they are
  //     revoked and a fresh invite is issued. The old link stops working.
  //   - The workspace_user row is NOT created here — only an invite token.
  //     The user is created atomically on /invite/accept.
  // ================================================================
  app.post("/invite", async (request, reply) => {
    const actor = app.requireAdmin(request);

    const parsed = inviteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid invite data.",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const name = parsed.data.name ?? null;
    const role = parsed.data.role;

    // Reject if any user exists for this email (active or disabled).
    const existing = await app.db.query<{ id: string }>(
      "SELECT id FROM workspace_user WHERE email = $1 LIMIT 1",
      [email],
    );
    if (existing.rows.length > 0) {
      return reply.code(409).send({
        error: "An account already exists for this email.",
      });
    }

    // Revoke-and-recreate policy: prior valid invites for this email are
    // revoked so there is at most one usable link at a time.
    await revokeOutstandingInvitesForEmail(app.db, email);

    const token = generateInviteToken();
    const expiresAt = new Date(
      Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const { rows } = await app.db.query<{
      id: string;
      email: string;
      role: string;
      expires_at: Date;
      token: string;
    }>(
      `INSERT INTO workspace_invite
          (token, email, name, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, expires_at, token`,
      [token, email, name, role, actor.id, expiresAt],
    );

    const invite = rows[0];
    const acceptUrl = buildAcceptUrl(
      deriveWorkspaceUrl(request),
      invite.token,
    );

    return reply.code(201).send({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expires_at.toISOString(),
        acceptUrl,
      },
    });
  });

  // ================================================================
  // GET /invite/:token — public, metadata-only
  //
  // Returns safe invite metadata so the acceptance page can render
  // context (email, role, name hint) before the user submits.
  // Does NOT leak inviter identity or token internals.
  // ================================================================
  app.get("/invite/:token", async (request, reply) => {
    const params = inviteTokenParam.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid invite token." });
    }

    const invite = await findInviteByToken(app.db, params.data.token);
    if (!invite) {
      return reply.code(404).send({ error: "Invite not found." });
    }

    const status = inviteStatus(invite);
    if (status === "accepted") {
      return reply
        .code(410)
        .send({ error: "This invite has already been used." });
    }
    if (status === "revoked") {
      return reply.code(410).send({ error: "This invite has been revoked." });
    }

    return reply.send({
      invite: {
        email: invite.email,
        name: invite.name,
        role: invite.role,
        expiresAt: invite.expires_at.toISOString(),
        isExpired: status === "expired",
      },
    });
  });

  // ================================================================
  // POST /invite/accept — public (token is the credential)
  //
  // Transactionally:
  //   - lock the invite row (FOR UPDATE) to block concurrent acceptance
  //   - re-check status (valid only)
  //   - ensure no workspace_user exists for the email
  //   - create workspace_user with hashed password
  //   - mark invite accepted (accepted_at + accepted_by_user_id)
  //
  // On success, issue a session cookie so the user lands signed in —
  // same safe user payload shape as /login and /me.
  // ================================================================
  app.post("/invite/accept", async (request, reply) => {
    const parsed = acceptInviteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid input.",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { token, password } = parsed.data;
    const nameOverride = parsed.data.name ?? null;

    const client = await app.db.connect();
    let createdUser: PublicUser | null = null;

    try {
      await client.query("BEGIN");

      const { rows: inviteRows } = await client.query<InviteRow>(
        `SELECT id, token, email, name, role, invited_by, created_at,
                expires_at, accepted_at, revoked_at, accepted_by_user_id
           FROM workspace_invite
          WHERE token = $1
          FOR UPDATE
          LIMIT 1`,
        [token],
      );

      if (inviteRows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Invite not found." });
      }

      const invite = inviteRows[0];
      const status = inviteStatus(invite);

      if (status === "accepted") {
        await client.query("ROLLBACK");
        return reply
          .code(410)
          .send({ error: "This invite has already been used." });
      }
      if (status === "revoked") {
        await client.query("ROLLBACK");
        return reply
          .code(410)
          .send({ error: "This invite has been revoked." });
      }
      if (status === "expired") {
        await client.query("ROLLBACK");
        return reply.code(410).send({ error: "This invite has expired." });
      }

      // Guard against a user having appeared for this email between invite
      // creation and acceptance.
      const { rows: existingUser } = await client.query<{ id: string }>(
        "SELECT id FROM workspace_user WHERE email = $1 LIMIT 1",
        [invite.email],
      );
      if (existingUser.length > 0) {
        await client.query("ROLLBACK");
        return reply.code(409).send({
          error: "An account already exists for this email.",
        });
      }

      const passwordHash = await hashPassword(password);
      const finalName = nameOverride ?? invite.name;

      const { rows: created } = await client.query<{
        id: string;
        email: string;
        name: string | null;
        role: string;
        must_reset_password: boolean;
      }>(
        `INSERT INTO workspace_user
            (email, password_hash, name, role, is_active, must_reset_password,
             invited_at, invited_by)
         VALUES ($1, $2, $3, $4, TRUE, FALSE, $5, $6)
         RETURNING id, email, name, role, must_reset_password`,
        [
          invite.email,
          passwordHash,
          finalName,
          invite.role,
          invite.created_at,
          invite.invited_by,
        ],
      );

      const newUser = created[0];

      await client.query(
        `UPDATE workspace_invite
            SET accepted_at = NOW(), accepted_by_user_id = $1
          WHERE id = $2`,
        [newUser.id, invite.id],
      );

      await client.query("COMMIT");
      createdUser = publicUser(newUser);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }

    // Issue session AFTER the transaction has committed — safer than holding
    // the transaction open across session insert.
    const { id: sessionId, expiresAt } = await createSession(
      app.db,
      createdUser.id,
      env.SESSION_TTL_DAYS,
      {
        ipAddress: request.ip ?? null,
        userAgent: request.headers["user-agent"] ?? null,
      },
    );

    void app.db
      .query("UPDATE workspace_user SET last_login_at = NOW() WHERE id = $1", [
        createdUser.id,
      ])
      .catch((err) => {
        app.log.warn({ err }, "failed to update last_login_at on accept");
      });

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionId,
      sessionCookieOptions(expiresAt),
    );

    return reply.code(201).send({ user: createdUser });
  });
}

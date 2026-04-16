import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { verifyPassword } from "../auth/passwords.js";
import { createSession, destroySession } from "../auth/sessions.js";
import {
  sessionClearCookieOptions,
  sessionCookieOptions,
} from "../auth/cookies.js";

const loginBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(512),
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

const GENERIC_AUTH_ERROR = { error: "Invalid email or password." };

function publicUser(row: UserRow | { id: string; email: string; name: string | null; role: string; must_reset_password: boolean }) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    mustResetPassword: row.must_reset_password,
  };
}

export async function authRoutes(app: FastifyInstance) {
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

    // Active-check happens only after password is verified, so we don't
    // leak whether a given email has a disabled account.
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

  app.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    return reply.send({ user: publicUser(request.user) });
  });
}

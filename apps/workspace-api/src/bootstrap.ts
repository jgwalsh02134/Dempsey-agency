/**
 * bootstrap.ts — ensure a workspace admin user exists.
 *
 * Read-only CLI. Does NOT accept HTTP input and does NOT mount a route.
 * Invoked explicitly: `npm run bootstrap:admin` with ADMIN_EMAIL +
 * ADMIN_PASSWORD in the environment.
 *
 * Semantics on re-run for the same email:
 *   - If no row exists        → create with role='admin', is_active=TRUE.
 *   - If row exists            → ensure role='admin' AND is_active=TRUE.
 *                                Password is NEVER overwritten; to reset a
 *                                password, use a separate credential flow.
 *                                This promotes a pre-existing non-admin
 *                                (e.g. a row created via invite-accept or
 *                                an earlier bootstrap that did not set role)
 *                                without touching their credentials.
 */

import pg from "pg";
import { z } from "zod";
import { env } from "./env.js";
import { hashPassword } from "./auth/passwords.js";

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const inputs = z
    .object({
      ADMIN_EMAIL: z.string().email(),
      ADMIN_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH, {
        message: `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
      }),
      ADMIN_NAME: z.string().optional(),
    })
    .safeParse({
      ADMIN_EMAIL: env.ADMIN_EMAIL,
      ADMIN_PASSWORD: env.ADMIN_PASSWORD,
      ADMIN_NAME: env.ADMIN_NAME,
    });

  if (!inputs.success) {
    console.error(
      "[bootstrap] missing or invalid admin inputs.\n" +
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (ADMIN_NAME optional), e.g.:\n" +
        "  ADMIN_EMAIL=admin@dempsey.agency \\\n" +
        "  ADMIN_PASSWORD='some-strong-passphrase' \\\n" +
        "  npm run bootstrap:admin\n\n" +
        JSON.stringify(inputs.error.flatten().fieldErrors, null, 2),
    );
    process.exit(1);
  }

  const email = inputs.data.ADMIN_EMAIL.trim().toLowerCase();
  const name = inputs.data.ADMIN_NAME?.trim() || null;
  const passwordHash = await hashPassword(inputs.data.ADMIN_PASSWORD);

  const pool = new pg.Pool({ connectionString: env.WORKSPACE_DATABASE_URL });
  try {
    const existing = await pool.query<{
      id: string;
      role: string;
      is_active: boolean;
    }>(
      "SELECT id, role, is_active FROM workspace_user WHERE email = $1 LIMIT 1",
      [email],
    );

    if (existing.rowCount === 0) {
      const { rows } = await pool.query<{ id: string; email: string; role: string }>(
        `INSERT INTO workspace_user (email, password_hash, name, role, is_active)
         VALUES ($1, $2, $3, 'admin', TRUE)
         RETURNING id, email, role`,
        [email, passwordHash, name],
      );
      const user = rows[0];
      console.log("[bootstrap] admin user created:");
      console.log(`  id:    ${user.id}`);
      console.log(`  email: ${user.email}`);
      console.log(`  role:  ${user.role}`);
      return;
    }

    const prior = existing.rows[0];
    const needsPromote = prior.role !== "admin" || prior.is_active !== true;

    if (!needsPromote) {
      console.log(
        `[bootstrap] user already admin and active: ${email} (no change)`,
      );
      return;
    }

    await pool.query(
      `UPDATE workspace_user
          SET role = 'admin',
              is_active = TRUE,
              updated_at = NOW()
        WHERE id = $1`,
      [prior.id],
    );
    console.log("[bootstrap] existing user promoted to admin:");
    console.log(`  id:            ${prior.id}`);
    console.log(`  email:         ${email}`);
    console.log(`  previous role: ${prior.role}`);
    console.log(`  previous active: ${prior.is_active}`);
    console.log(`  new role:      admin`);
    console.log(`  new active:    true`);
    console.log("  (password was NOT modified)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[bootstrap] failed:", err);
  process.exit(1);
});

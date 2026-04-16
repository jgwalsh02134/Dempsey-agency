/**
 * bootstrap.ts — create the first internal admin user.
 *
 * Read-only CLI. Does NOT accept HTTP input and does NOT mount a route.
 * Invoked explicitly: `npm run bootstrap:admin` with ADMIN_EMAIL +
 * ADMIN_PASSWORD in the environment. Idempotent: running it again with the
 * same email is a no-op.
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
    const result = await pool.query<{
      id: string;
      email: string;
      role: string;
      created_at: Date;
    }>(
      `INSERT INTO workspace_user (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, 'admin', TRUE)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, role, created_at`,
      [email, passwordHash, name],
    );

    if (result.rowCount === 0) {
      console.log(`[bootstrap] user already exists: ${email} (no change)`);
    } else {
      const user = result.rows[0];
      console.log("[bootstrap] admin user created:");
      console.log(`  id:    ${user.id}`);
      console.log(`  email: ${user.email}`);
      console.log(`  role:  ${user.role}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[bootstrap] failed:", err);
  process.exit(1);
});

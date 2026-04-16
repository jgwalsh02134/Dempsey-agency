import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { env } from "./env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Source runs from src/; built output runs from dist/. migrations/ is at the
// package root in both cases, one level up from the compiled/script dir.
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function ensureMigrationsTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedIds(pool: pg.Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM schema_migrations",
  );
  return new Set(rows.map((r) => r.id));
}

async function main() {
  const pool = new pg.Pool({ connectionString: env.WORKSPACE_DATABASE_URL });

  try {
    await ensureMigrationsTable(pool);
    const applied = await appliedIds(pool);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("[migrate] no migration files found in", MIGRATIONS_DIR);
      return;
    }

    for (const file of files) {
      const id = file.replace(/\.sql$/, "");
      if (applied.has(id)) {
        console.log(`[migrate] skip (already applied): ${id}`);
        continue;
      }

      console.log(`[migrate] applying: ${id}`);
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (id) VALUES ($1)",
          [id],
        );
        await client.query("COMMIT");
        console.log(`[migrate] applied:  ${id}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    console.log("[migrate] done");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});

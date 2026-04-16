import pg from "pg";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { env } from "./env.js";

declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

export const dbPlugin = fp(async (app: FastifyInstance) => {
  const pool = new pg.Pool({ connectionString: env.WORKSPACE_DATABASE_URL });

  pool.on("error", (err) => {
    app.log.error({ err }, "workspace db pool error");
  });

  app.decorate("db", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
});

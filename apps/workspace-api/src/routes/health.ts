import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => {
    return { status: "ok" };
  });

  app.get("/readyz", async (_req, reply) => {
    try {
      await app.db.query("SELECT 1");
      return { status: "ok", db: "ok" };
    } catch (err) {
      app.log.error({ err }, "readiness check failed");
      return reply.code(503).send({ status: "degraded", db: "unavailable" });
    }
  });
}

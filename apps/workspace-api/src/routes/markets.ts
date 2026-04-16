import type { FastifyInstance } from "fastify";

export async function marketsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });
}

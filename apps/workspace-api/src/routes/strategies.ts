import type { FastifyInstance } from "fastify";

export async function strategiesRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });
}

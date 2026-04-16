import type { FastifyInstance } from "fastify";

export async function eventsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });
}

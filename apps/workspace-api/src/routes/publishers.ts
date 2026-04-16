import type { FastifyInstance } from "fastify";

export async function publishersRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });
}

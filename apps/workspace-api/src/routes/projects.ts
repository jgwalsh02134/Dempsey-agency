import type { FastifyInstance } from "fastify";

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });
}

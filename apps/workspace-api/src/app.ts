import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { allowedOrigins } from "./env.js";
import { dbPlugin } from "./db.js";
import { healthRoutes } from "./routes/health.js";
import { publishersRoutes } from "./routes/publishers.js";
import { marketsRoutes } from "./routes/markets.js";
import { eventsRoutes } from "./routes/events.js";
import { strategiesRoutes } from "./routes/strategies.js";
import { projectsRoutes } from "./routes/projects.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.flatten().fieldErrors,
      });
    }

    request.log.error(error);

    const statusCode =
      "statusCode" in error &&
      typeof (error as { statusCode?: number }).statusCode === "number" &&
      (error as { statusCode: number }).statusCode >= 400
        ? (error as { statusCode: number }).statusCode
        : 500;

    reply.code(statusCode).send({ error: error.message || "Internal Server Error" });
  });

  await app.register(cors, {
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  });

  await app.register(dbPlugin);

  await app.register(healthRoutes);
  await app.register(publishersRoutes, { prefix: "/api/workspace/publishers" });
  await app.register(marketsRoutes, { prefix: "/api/workspace/markets" });
  await app.register(eventsRoutes, { prefix: "/api/workspace/events" });
  await app.register(strategiesRoutes, { prefix: "/api/workspace/strategies" });
  await app.register(projectsRoutes, { prefix: "/api/workspace/projects" });

  return app;
}

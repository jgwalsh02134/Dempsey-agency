import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { ZodError } from "zod";
import { allowedOrigins } from "./env.js";
import { dbPlugin } from "./db.js";
import { authPlugin } from "./auth/plugin.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { publishersRoutes } from "./routes/publishers.js";
import { marketsRoutes } from "./routes/markets.js";
import { eventsRoutes } from "./routes/events.js";
import { strategiesRoutes } from "./routes/strategies.js";
import { projectsRoutes } from "./routes/projects.js";

function extractStatusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const code = (error as { statusCode: unknown }).statusCode;
    if (typeof code === "number" && code >= 400 && code < 600) {
      return code;
    }
  }
  return 500;
}

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Validation Error",
        details: error.flatten().fieldErrors,
      });
    }

    request.log.error(error);

    const statusCode = extractStatusCode(error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Internal Server Error";

    reply.code(statusCode).send({ error: message });
  });

  await app.register(cors, {
    // credentials: true is required for cookie-based auth to flow across
    // origins (e.g. workspace.* → workspace-api.*). With credentials, the
    // origin must be an explicit allow-list; wildcard is disallowed.
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  });

  await app.register(cookie);
  await app.register(dbPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/api/workspace/auth" });
  await app.register(publishersRoutes, { prefix: "/api/workspace/publishers" });
  await app.register(marketsRoutes, { prefix: "/api/workspace/markets" });
  await app.register(eventsRoutes, { prefix: "/api/workspace/events" });
  await app.register(strategiesRoutes, { prefix: "/api/workspace/strategies" });
  await app.register(projectsRoutes, { prefix: "/api/workspace/projects" });

  return app;
}

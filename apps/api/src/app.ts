import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import { v1Routes } from "./modules/v1.js";

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

    if (error instanceof Error) {
      const code =
        "statusCode" in error &&
        typeof (error as any).statusCode === "number" &&
        (error as any).statusCode >= 400
          ? (error as any).statusCode
          : 500;
      return reply.code(code).send({ error: error.message });
    }

    reply.code(500).send({ error: "Internal Server Error" });
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: "/api/v1" });

  return app;
}

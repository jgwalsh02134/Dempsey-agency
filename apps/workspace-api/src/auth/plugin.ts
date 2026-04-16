import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { findSessionUser, type SessionUser } from "./sessions.js";

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyInstance {
    requireUser: (request: FastifyRequest) => SessionUser;
    requireAdmin: (request: FastifyRequest) => SessionUser;
  }
}

function unauthorized(): Error & { statusCode: number } {
  const err = new Error("Unauthorized") as Error & { statusCode: number };
  err.statusCode = 401;
  return err;
}

function forbidden(message = "Forbidden"): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = 403;
  return err;
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("user", null);

  app.addHook("preHandler", async (request) => {
    const cookieValue = request.cookies?.[env.SESSION_COOKIE_NAME];
    if (!cookieValue) {
      request.user = null;
      return;
    }
    try {
      request.user = await findSessionUser(app.db, cookieValue);
    } catch (err) {
      app.log.error({ err }, "session lookup failed");
      request.user = null;
    }
  });

  app.decorate("requireUser", (request: FastifyRequest): SessionUser => {
    if (!request.user) throw unauthorized();
    return request.user;
  });

  app.decorate("requireAdmin", (request: FastifyRequest): SessionUser => {
    if (!request.user) throw unauthorized();
    if (request.user.role !== "admin") {
      throw forbidden("Admin privileges required.");
    }
    return request.user;
  });
});

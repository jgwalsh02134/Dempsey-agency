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
  }
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
    if (!request.user) {
      const err = new Error("Unauthorized") as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    return request.user;
  });
});

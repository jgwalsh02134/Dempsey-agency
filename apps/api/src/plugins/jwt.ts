import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { env } from "../env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  if (env.JWT_SECRET === "unsafe-dev-secret") {
    app.log.warn(
      "JWT_SECRET is using the default dev value — set a real secret before deploying",
    );
  }
});

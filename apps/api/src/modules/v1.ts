import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth/index.js";
import { userRoutes } from "./users/index.js";
import { organizationRoutes } from "./organizations/index.js";
import { membershipRoutes } from "./memberships/index.js";
import { agencyClientRoutes } from "./agency-clients/index.js";

export async function v1Routes(app: FastifyInstance) {
  app.get("/", async () => ({ version: "v1", status: "ok" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes);
  await app.register(organizationRoutes);
  await app.register(membershipRoutes);
  await app.register(agencyClientRoutes);
}

import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth/index.js";
import { userRoutes } from "./users/index.js";
import { organizationRoutes } from "./organizations/index.js";
import { membershipRoutes } from "./memberships/index.js";
import { agencyClientRoutes } from "./agency-clients/index.js";
import { documentRoutes } from "./documents/index.js";
import { campaignRoutes } from "./campaigns/index.js";
import { invoiceRoutes } from "./invoices/index.js";
import { submissionRoutes } from "./submissions/index.js";
import { accountRequestRoutes } from "./account-requests/index.js";
import { inviteRoutes } from "./invites/index.js";
import { publisherRoutes } from "./publishers/index.js";
import { placementRoutes } from "./placements/index.js";
import { aiRoutes } from "./ai/index.js";
import { adminRoutes } from "./admin/index.js";

export async function v1Routes(app: FastifyInstance) {
  app.get("/", async () => ({ version: "v1", status: "ok" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(userRoutes);
  await app.register(organizationRoutes);
  await app.register(membershipRoutes);
  await app.register(agencyClientRoutes);
  await app.register(documentRoutes);
  await app.register(campaignRoutes);
  await app.register(invoiceRoutes);
  await app.register(submissionRoutes);
  await app.register(publisherRoutes);
  await app.register(placementRoutes);
  await app.register(accountRequestRoutes);
  await app.register(inviteRoutes);
  await app.register(aiRoutes);
  await app.register(adminRoutes, { prefix: "/admin" });
}

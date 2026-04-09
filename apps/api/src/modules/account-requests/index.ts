import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import {
  createAccountRequestSchema,
  requestIdParamsSchema,
  updateAccountRequestSchema,
} from "./schemas.js";

export async function accountRequestRoutes(app: FastifyInstance) {
  // ── Submit a request (public — no auth) ───────────────────────
  app.post("/account-requests", async (request, reply) => {
    const parsed = createAccountRequestSchema.parse(request.body);

    const existing = await app.prisma.accountRequest.findFirst({
      where: { email: parsed.email, status: "PENDING" },
    });
    if (existing) {
      return reply.code(409).send({
        error:
          "A pending request for this email already exists. We will be in touch.",
      });
    }

    const created = await app.prisma.accountRequest.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        company: parsed.company,
        message: parsed.message ?? null,
      },
    });

    return reply.code(201).send({
      id: created.id,
      message: "Your request has been submitted. We will be in touch.",
    });
  });

  // ── List all requests (admin only) ────────────────────────────
  app.get(
    "/account-requests",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async () => {
      const requests = await app.prisma.accountRequest.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          reviewedBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return { requests };
    },
  );

  // ── Approve or reject (admin only) ────────────────────────────
  app.patch(
    "/account-requests/:id",
    {
      preHandler: [
        requireAuth,
        requireRole("AGENCY_OWNER", "AGENCY_ADMIN"),
      ],
    },
    async (request, reply) => {
      const { id } = requestIdParamsSchema.parse(request.params);
      const { status } = updateAccountRequestSchema.parse(request.body);

      const existing = await app.prisma.accountRequest.findUnique({
        where: { id },
      });
      if (!existing) {
        return reply.code(404).send({ error: "Request not found" });
      }

      if (existing.status !== "PENDING") {
        return reply.code(400).send({
          error: `Request has already been ${existing.status.toLowerCase()}`,
        });
      }

      const updated = await app.prisma.accountRequest.update({
        where: { id },
        data: {
          status,
          reviewedById: request.currentUser!.id,
        },
      });

      return updated;
    },
  );
}

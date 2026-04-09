import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { requireRole } from "../../lib/rbac.js";
import {
  createAccountRequestSchema,
  requestIdParamsSchema,
  updateAccountRequestSchema,
} from "./schemas.js";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

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
      const { status, organizationId, role } =
        updateAccountRequestSchema.parse(request.body);

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

      if (status === "APPROVED" && organizationId) {
        const org = await app.prisma.organization.findUnique({
          where: { id: organizationId },
        });
        if (!org) {
          return reply
            .code(404)
            .send({ error: "Organization not found" });
        }

        const effectiveRole = role ?? "CLIENT_USER";
        const clientRoles = ["CLIENT_ADMIN", "CLIENT_USER"];
        const agencyRoles = ["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"];
        const validRoles =
          org.type === "CLIENT" ? clientRoles : agencyRoles;
        if (!validRoles.includes(effectiveRole)) {
          return reply.code(400).send({
            error: `Role ${effectiveRole} is not valid for a ${org.type.toLowerCase()} organization`,
          });
        }

        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

        const [updated, invite] = await app.prisma.$transaction(
          async (tx) => {
            const ar = await tx.accountRequest.update({
              where: { id },
              data: {
                status,
                reviewedById: request.currentUser!.id,
              },
            });

            const inv = await tx.invite.create({
              data: {
                email: existing.email,
                token,
                organizationId,
                role: effectiveRole,
                accountRequestId: id,
                expiresAt,
                createdById: request.currentUser!.id,
              },
            });

            return [ar, inv] as const;
          },
        );

        return {
          ...updated,
          invite: {
            token: invite.token,
            expiresAt: invite.expiresAt.toISOString(),
          },
        };
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

import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import { hashPassword } from "../../lib/password.js";
import { writeAuditLog } from "../../lib/audit-log.js";
import { activateInviteSchema, inviteTokenParamsSchema } from "./schemas.js";

export async function inviteRoutes(app: FastifyInstance) {
  // ── Validate an invite token (public) ─────────────────────────
  app.get("/invites/:token/validate", async (request, reply) => {
    const { token } = inviteTokenParamsSchema.parse(request.params);

    const invite = await app.prisma.invite.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    if (!invite) {
      return reply.code(404).send({ error: "Invite not found" });
    }

    if (invite.usedAt) {
      return reply
        .code(410)
        .send({ error: "This invite has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return reply.code(410).send({ error: "This invite has expired" });
    }

    return {
      email: invite.email,
      organizationName: invite.organization.name,
    };
  });

  // ── Activate an invite (public) ───────────────────────────────
  app.post("/invites/:token/activate", async (request, reply) => {
    const { token } = inviteTokenParamsSchema.parse(request.params);
    const { password, name } = activateInviteSchema.parse(request.body);

    const invite = await app.prisma.invite.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    if (!invite) {
      return reply.code(404).send({ error: "Invite not found" });
    }

    if (invite.usedAt) {
      return reply
        .code(410)
        .send({ error: "This invite has already been used" });
    }

    if (invite.expiresAt < new Date()) {
      return reply.code(410).send({ error: "This invite has expired" });
    }

    const existingUser = await app.prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      return reply.code(409).send({
        error:
          "An account with this email already exists. Please sign in instead.",
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await app.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name: name ?? null,
          passwordHash,
          active: true,
        },
        omit: { passwordHash: true },
      });

      await tx.organizationMembership.create({
        data: {
          userId: created.id,
          organizationId: invite.organizationId,
          role: invite.role as Role,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      await writeAuditLog(tx, {
        action: "USER_CREATED",
        actorUserId: invite.createdById,
        targetUserId: created.id,
        organizationId: invite.organizationId,
        metadata: {
          email: invite.email,
          role: invite.role,
          source: "invite",
          inviteId: invite.id,
        },
      });

      return created;
    });

    return reply.code(201).send({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  });
}

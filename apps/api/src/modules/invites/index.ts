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

    const passwordHash = await hashPassword(password);

    let user: { id: string; email: string; name: string | null };
    try {
      user = await app.prisma.$transaction(async (tx) => {
        const current = await tx.invite.findUnique({ where: { id: invite.id } });
        if (!current || current.usedAt || current.expiresAt < new Date()) {
          throw Object.assign(new Error("INVITE_CLOSED"), { code: "INVITE_CLOSED" });
        }

        const existingUser = await tx.user.findUnique({
          where: { email: current.email },
        });
        if (existingUser) {
          throw Object.assign(
            new Error(existingUser.active ? "USER_EXISTS" : "USER_INACTIVE"),
            { code: existingUser.active ? "USER_EXISTS" : "USER_INACTIVE" },
          );
        }

        const claimed = await tx.invite.updateMany({
          where: { id: current.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw Object.assign(new Error("INVITE_CLOSED"), { code: "INVITE_CLOSED" });
        }

        const created = await tx.user.create({
          data: {
            email: current.email,
            name: name ?? null,
            passwordHash,
            active: true,
          },
          omit: { passwordHash: true },
        });

        await tx.organizationMembership.create({
          data: {
            userId: created.id,
            organizationId: current.organizationId,
            role: current.role as Role,
          },
        });

        await writeAuditLog(tx, {
          action: "USER_CREATED",
          actorUserId: current.createdById,
          targetUserId: created.id,
          organizationId: current.organizationId,
          metadata: {
            email: current.email,
            role: current.role,
            source: "invite",
            inviteId: current.id,
          },
        });

        return created;
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "USER_EXISTS") {
        return reply.code(409).send({
          error:
            "An account with this email already exists. Please sign in instead.",
        });
      }
      if (code === "USER_INACTIVE") {
        return reply.code(403).send({
          error: "This account is disabled. Contact your agency administrator.",
        });
      }
      if (code === "P2002") {
        return reply.code(409).send({
          error:
            "An account with this email already exists. Please sign in instead.",
        });
      }
      if (code === "INVITE_CLOSED") {
        return reply
          .code(410)
          .send({ error: "This invite has already been used" });
      }
      throw err;
    }

    return reply.code(201).send({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  });
}

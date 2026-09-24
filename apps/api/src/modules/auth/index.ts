import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  generateResetToken,
  resetTokenExpiresAt,
} from "../../lib/reset-token.js";
import { adminBaseUrl, portalBaseUrl, sendEmail } from "../../lib/email.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "./schemas.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !user.active) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  });

  app.post(
    "/logout",
    { preHandler: [requireAuth] },
    async (_request, _reply) => {
      // Stateless JWT — logout is handled client-side by discarding the token.
      // Add token blacklisting here when Redis is available.
      return { success: true };
    },
  );

  app.get(
    "/me",
    { preHandler: [requireAuth] },
    async (request) => {
      return request.currentUser;
    },
  );

  app.get(
    "/session",
    { preHandler: [requireAuth] },
    async (request) => {
      return request.currentUser;
    },
  );

  app.post(
    "/change-password",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(
        request.body,
      );

      const user = await app.prisma.user.findUnique({
        where: { id: request.currentUser!.id },
      });
      if (!user?.passwordHash) {
        return reply
          .code(400)
          .send({ error: "Password change is not available for this account" });
      }

      if (!user.active) {
        return reply.code(403).send({ error: "Account is disabled" });
      }

      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: "Current password is incorrect" });
      }

      const passwordHash = await hashPassword(newPassword);
      await app.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return { success: true };
    },
  );

  app.post("/forgot-password", async (request) => {
    const { email, audience } = forgotPasswordSchema.parse(request.body);
    const requested = audience ?? "portal";

    const user = await app.prisma.user.findUnique({
      where: { email },
      include: { memberships: { select: { role: true } } },
    });
    const agency = user?.memberships.some((m) =>
      m.role === "AGENCY_OWNER" ||
      m.role === "AGENCY_ADMIN" ||
      m.role === "STAFF",
    );
    const base =
      requested === "admin"
        ? agency
          ? adminBaseUrl()
          : null
        : portalBaseUrl();

    if (user?.active && user.passwordHash && base) {
      const token = generateResetToken();
      await app.prisma.passwordReset.create({
        data: {
          token,
          userId: user.id,
          expiresAt: resetTokenExpiresAt(),
        },
      });
      const link = `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendEmail(request.log, {
          to: user.email,
          subject: "Reset your Dempsey Agency password",
          text: `Use this link to choose a new password. It expires soon.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
        });
      } catch (err) {
        request.log.error({ err, userId: user.id }, "password reset email failed");
      }
    } else if (user?.active && user.passwordHash && !base) {
      request.log.warn(
        { audience: requested },
        "password reset email skipped: app base URL is not configured",
      );
    }

    return { success: true };
  });

  app.post("/reset-password", async (request, reply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);

    const reset = await app.prisma.passwordReset.findUnique({
      where: { token },
    });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return reply.code(400).send({
        error: "This reset link is invalid or has expired.",
      });
    }

    const passwordHash = await hashPassword(password);

    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      app.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  });
}

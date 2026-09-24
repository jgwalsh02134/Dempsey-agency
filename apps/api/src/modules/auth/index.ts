import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  generateResetToken,
  resetTokenExpiresAt,
} from "../../lib/reset-token.js";
import { portalBaseUrl, sendEmail } from "../../lib/email.js";
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
    const { email } = forgotPasswordSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (user?.active && user.passwordHash) {
      const token = generateResetToken();
      await app.prisma.passwordReset.create({
        data: {
          token,
          userId: user.id,
          expiresAt: resetTokenExpiresAt(),
        },
      });

      const base = portalBaseUrl();
      const link = base
        ? `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`
        : null;
      const text = link
        ? `Reset your Dempsey Agency password:\n\n${link}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`
        : "A password reset was requested, but the portal URL is not configured. Contact your agency administrator.";
      await sendEmail(request.log, {
        to: user.email,
        subject: "Reset your Dempsey Agency password",
        text,
        html: link
          ? `<p>Reset your Dempsey Agency password:</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in one hour.</p>`
          : `<p>${text}</p>`,
      });
    }

    return { success: true };
  });

  app.post("/reset-password", async (request, reply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);

    const passwordHash = await hashPassword(password);
    const invalid = {
      error: "This reset link is invalid or has expired.",
    };

    const applied = await app.prisma.$transaction(async (tx) => {
      const reset = await tx.passwordReset.findUnique({
        where: { token },
        include: { user: { select: { id: true, active: true } } },
      });
      if (
        !reset ||
        reset.usedAt ||
        reset.expiresAt < new Date() ||
        !reset.user.active
      ) {
        return false;
      }

      const claimed = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;

      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });

    if (!applied) {
      return reply.code(400).send(invalid);
    }

    return { success: true };
  });
}

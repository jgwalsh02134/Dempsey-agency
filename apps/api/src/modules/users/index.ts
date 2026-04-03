import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import type { AuthUser } from "../../plugins/auth.js";
import { requireAuth } from "../../plugins/auth.js";
import {
  assertCanAssignMembershipRole,
  assertCanManageOrganization,
} from "../../lib/rbac.js";
import { hashPassword } from "../../lib/password.js";
import {
  isPlatformAgencyOwner,
  resolveVisibleOrganizationIds,
} from "../../lib/org-scope.js";
import { createUserSchema, userParamsSchema } from "./schemas.js";

async function resolveVisibleUserIds(
  app: FastifyInstance,
  user: AuthUser,
): Promise<string[] | null> {
  if (isPlatformAgencyOwner(user)) {
    return null;
  }
  const orgIds = await resolveVisibleOrganizationIds(app.prisma, user);
  if (!orgIds || orgIds.length === 0) {
    return [];
  }
  const rows = await app.prisma.organizationMembership.findMany({
    where: { organizationId: { in: orgIds } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.map((r) => r.userId);
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/users", { preHandler: [requireAuth] }, async (request) => {
    const userIds = await resolveVisibleUserIds(app, request.currentUser!);
    const where =
      userIds === null ? {} : { id: { in: userIds.length ? userIds : ["__none__"] } };

    return app.prisma.user.findMany({
      where,
      omit: { passwordHash: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get(
    "/users/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = userParamsSchema.parse(request.params);
      const userIds = await resolveVisibleUserIds(app, request.currentUser!);
      if (userIds !== null && !userIds.includes(id) && id !== request.currentUser!.id) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const user = await app.prisma.user.findUnique({
        where: { id },
        omit: { passwordHash: true },
        include: { memberships: { include: { organization: true } } },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return user;
    },
  );

  app.post(
    "/users",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { password, organizationId, role, ...data } =
        createUserSchema.parse(request.body);

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        organizationId,
        reply,
      );
      if (!manage) return;

      const org = await app.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      if (
        !assertCanAssignMembershipRole(
          request.currentUser!,
          organizationId,
          org.type,
          role as Role,
          manage,
          reply,
        )
      ) {
        return;
      }

      const passwordHash = await hashPassword(password);

      const result = await app.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { ...data, passwordHash },
          omit: { passwordHash: true },
        });
        await tx.organizationMembership.create({
          data: {
            userId: created.id,
            organizationId,
            role: role as Role,
          },
        });
        return created;
      });

      return reply.code(201).send(result);
    },
  );
}

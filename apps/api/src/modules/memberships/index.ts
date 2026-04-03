import type { FastifyInstance } from "fastify";
import type { Role } from "@prisma/client";
import { requireAuth } from "../../plugins/auth.js";
import {
  assertCanAssignMembershipRole,
  assertCanManageOrganization,
} from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  assertNotRemovingLastAgencyOwner,
} from "../../lib/org-user-admin.js";
import { createMembershipSchema, membershipParamsSchema } from "./schemas.js";
import { writeAuditLog } from "../../lib/audit-log.js";

export async function membershipRoutes(app: FastifyInstance) {
  app.get("/memberships", { preHandler: [requireAuth] }, async (request) => {
    const visible = await resolveVisibleOrganizationIds(
      app.prisma,
      request.currentUser!,
    );
    const where =
      visible === null
        ? {}
        : { organizationId: { in: visible.length ? visible : ["__none__"] } };

    return app.prisma.organizationMembership.findMany({
      where,
      include: {
        user: { omit: { passwordHash: true } },
        organization: true,
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post(
    "/memberships",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const data = createMembershipSchema.parse(request.body);

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        data.organizationId,
        reply,
      );
      if (!manage) return;

      const org = await app.prisma.organization.findUnique({
        where: { id: data.organizationId },
      });
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      if (
        !assertCanAssignMembershipRole(
          request.currentUser!,
          data.organizationId,
          org.type,
          data.role as Role,
          manage,
          reply,
        )
      ) {
        return;
      }

      const membership = await app.prisma.organizationMembership.create({
        data: {
          userId: data.userId,
          organizationId: data.organizationId,
          role: data.role as Role,
        },
        include: {
          user: { omit: { passwordHash: true } },
          organization: true,
        },
      });
      return reply.code(201).send(membership);
    },
  );

  app.delete(
    "/memberships/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: membershipId } = membershipParamsSchema.parse(request.params);

      const membership = await app.prisma.organizationMembership.findUnique({
        where: { id: membershipId },
        include: { organization: true },
      });
      if (!membership) {
        return reply.code(404).send({ error: "Membership not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        membership.organizationId,
        reply,
      );
      if (!manage) return;

      if (
        !(await assertNotRemovingLastAgencyOwner(
          app.prisma,
          membership,
          membership.organization.type,
          reply,
        ))
      ) {
        return;
      }

      await app.prisma.$transaction(async (tx) => {
        await tx.organizationMembership.delete({
          where: { id: membershipId },
        });
        await writeAuditLog(tx, {
          action: "MEMBERSHIP_REMOVED",
          actorUserId: request.currentUser!.id,
          targetUserId: membership.userId,
          organizationId: membership.organizationId,
          metadata: {
            membershipId,
            role: membership.role,
          },
        });
      });
      return reply.code(204).send();
    },
  );
}

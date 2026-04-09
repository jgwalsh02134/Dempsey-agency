import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../plugins/auth.js";
import { assertCanManageOrganization } from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  orgIdParamsSchema,
  invoiceIdParamsSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
} from "./schemas.js";

const STATUS_ORDER: Record<string, number> = {
  OVERDUE: 0,
  PENDING: 1,
  PAID: 2,
};

export async function invoiceRoutes(app: FastifyInstance) {
  // ── List invoices for an organization ─────────────────────────
  app.get(
    "/organizations/:orgId/invoices",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { orgId } = orgIdParamsSchema.parse(request.params);

      const visible = await resolveVisibleOrganizationIds(
        app.prisma,
        request.currentUser!,
      );
      if (visible !== null && !visible.includes(orgId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const org = await app.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      if (!org) {
        return reply.code(404).send({ error: "Organization not found" });
      }

      const invoices = await app.prisma.invoice.findMany({
        where: { organizationId: orgId },
        orderBy: { invoiceDate: "desc" },
        include: {
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      invoices.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
      );

      return { organizationId: orgId, invoices };
    },
  );

  // ── Create an invoice (admin only) ────────────────────────────
  app.post(
    "/organizations/:orgId/invoices",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { orgId } = orgIdParamsSchema.parse(request.params);

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        orgId,
        reply,
      );
      if (!manage) return;

      const parsed = createInvoiceSchema.parse(request.body);

      const invoice = await app.prisma.invoice.create({
        data: {
          organizationId: orgId,
          title: parsed.title,
          description: parsed.description ?? null,
          amountCents: parsed.amountCents,
          currency: parsed.currency,
          status: parsed.status,
          invoiceDate: new Date(parsed.invoiceDate),
          dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
          createdById: request.currentUser!.id,
        },
      });

      return reply.code(201).send(invoice);
    },
  );

  // ── Update an invoice (admin only) ────────────────────────────
  app.patch(
    "/invoices/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = invoiceIdParamsSchema.parse(request.params);

      const invoice = await app.prisma.invoice.findUnique({
        where: { id },
      });
      if (!invoice) {
        return reply.code(404).send({ error: "Invoice not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        invoice.organizationId,
        reply,
      );
      if (!manage) return;

      const parsed = updateInvoiceSchema.parse(request.body);

      const data: Record<string, unknown> = {};
      if (parsed.title !== undefined) data.title = parsed.title;
      if (parsed.description !== undefined)
        data.description = parsed.description;
      if (parsed.amountCents !== undefined)
        data.amountCents = parsed.amountCents;
      if (parsed.currency !== undefined) data.currency = parsed.currency;
      if (parsed.status !== undefined) data.status = parsed.status;
      if (parsed.invoiceDate !== undefined)
        data.invoiceDate = new Date(parsed.invoiceDate);
      if ("dueDate" in parsed)
        data.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: "No fields to update" });
      }

      const updated = await app.prisma.invoice.update({
        where: { id },
        data,
      });

      return updated;
    },
  );

  // ── Delete an invoice (admin only) ────────────────────────────
  app.delete(
    "/invoices/:id",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = invoiceIdParamsSchema.parse(request.params);

      const invoice = await app.prisma.invoice.findUnique({
        where: { id },
      });
      if (!invoice) {
        return reply.code(404).send({ error: "Invoice not found" });
      }

      const manage = await assertCanManageOrganization(
        app.prisma,
        request.currentUser!,
        invoice.organizationId,
        reply,
      );
      if (!manage) return;

      await app.prisma.invoice.delete({ where: { id } });

      return { success: true };
    },
  );
}

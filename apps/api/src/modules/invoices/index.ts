import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { requireAuth } from "../../plugins/auth.js";
import {
  assertCanManageOrganization,
  resolveCanManageOrganization,
} from "../../lib/rbac.js";
import { resolveVisibleOrganizationIds } from "../../lib/org-scope.js";
import {
  billingReturnUrl,
  checkoutFailure,
  ensureStripeCustomer,
  getStripeClient,
  markInvoicePaid,
  paymentIntentId,
} from "../../lib/stripe.js";
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
      if (parsed.status === "PAID" && invoice.paidAt == null) {
        data.paidAt = new Date();
      }
      if (
        parsed.status !== undefined &&
        parsed.status !== "PAID" &&
        !invoice.stripePaymentIntentId
      ) {
        data.paidAt = null;
      }
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

  // ── Start Stripe Checkout for an unpaid invoice ───────────────
  app.post(
    "/invoices/:id/checkout",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = invoiceIdParamsSchema.parse(request.params);
      const user = request.currentUser!;

      const invoice = await app.prisma.invoice.findUnique({
        where: { id },
        include: { organization: true },
      });
      if (!invoice) {
        return reply.code(404).send({ error: "Invoice not found" });
      }

      const belongs = user.memberships.some(
        (m) => m.organizationId === invoice.organizationId,
      );
      if (!belongs) {
        const manage = await resolveCanManageOrganization(
          app.prisma,
          user,
          invoice.organizationId,
        );
        if (!manage.ok) {
          return reply.code(403).send({ error: "Forbidden" });
        }
      }

      if (invoice.status === "PAID" || invoice.stripePaymentIntentId) {
        return { alreadyPaid: true };
      }
      if (invoice.status !== "PENDING" && invoice.status !== "OVERDUE") {
        return reply.code(409).send({ error: "This invoice cannot be paid" });
      }
      if (invoice.amountCents <= 0) {
        return reply.code(400).send({ error: "This invoice has no amount due" });
      }
      if (!/^[A-Za-z]{3}$/.test(invoice.currency)) {
        return reply
          .code(400)
          .send({ error: "Invoice currency is not a valid ISO code" });
      }

      const stripeClient = getStripeClient();
      if (!stripeClient) {
        return reply.code(503).send({ error: "Card payments are not configured" });
      }

      const successUrl = billingReturnUrl(
        "paid",
        invoice.id,
        invoice.organizationId,
      );
      const cancelUrl = billingReturnUrl(
        "canceled",
        invoice.id,
        invoice.organizationId,
      );
      if (!successUrl || !cancelUrl) {
        return reply
          .code(503)
          .send({ error: "Portal return URL is not configured" });
      }

      try {
        if (invoice.stripeCheckoutSessionId) {
          let existing: Awaited<
            ReturnType<typeof stripeClient.checkout.sessions.retrieve>
          > | null = null;
          try {
            existing = await stripeClient.checkout.sessions.retrieve(
              invoice.stripeCheckoutSessionId,
            );
          } catch (err) {
            const missing =
              err instanceof Stripe.errors.StripeInvalidRequestError &&
              err.code === "resource_missing";
            if (!missing) throw err;
            request.log.warn(
              { invoiceId: invoice.id },
              "Stored Checkout session was not found; creating a new one",
            );
          }
          if (existing) {
            if (existing.payment_status === "paid") {
              await markInvoicePaid(app.prisma, invoice, {
                checkoutSessionId: existing.id,
                paymentIntentId: paymentIntentId(existing.payment_intent),
              });
              return { alreadyPaid: true };
            }
            if (
              existing.status === "complete" &&
              existing.payment_status !== "paid"
            ) {
              return reply.code(409).send({
                error: "A payment is already processing for this invoice",
              });
            }
            const sameAmount =
              existing.amount_total === invoice.amountCents &&
              (existing.currency ?? "").toLowerCase() ===
                invoice.currency.toLowerCase();
            if (existing.status === "open" && existing.url && sameAmount) {
              return { url: existing.url };
            }
            if (existing.status === "open") {
              await stripeClient.checkout.sessions.expire(existing.id);
            }
          }
        }

        const customerId = await ensureStripeCustomer(
          stripeClient,
          app.prisma,
          invoice.organization,
        );

        const session = await stripeClient.checkout.sessions.create(
          {
            mode: "payment",
            customer: customerId,
            client_reference_id: invoice.id,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: invoice.currency.toLowerCase(),
                  unit_amount: invoice.amountCents,
                  product_data: {
                    name: invoice.title,
                    ...(invoice.description
                      ? { description: invoice.description }
                      : {}),
                  },
                },
              },
            ],
            metadata: {
              invoiceId: invoice.id,
              organizationId: invoice.organizationId,
            },
            payment_intent_data: {
              metadata: {
                invoiceId: invoice.id,
                organizationId: invoice.organizationId,
              },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
          {
            idempotencyKey: `invoice_checkout_${invoice.id}_${invoice.amountCents}_${invoice.currency.toLowerCase()}_${invoice.stripeCheckoutSessionId ?? "new"}`,
          },
        );

        await app.prisma.invoice.update({
          where: { id: invoice.id },
          data: { stripeCheckoutSessionId: session.id },
        });

        if (!session.url) {
          return reply
            .code(502)
            .send({ error: "Stripe did not return a checkout URL" });
        }
        return { url: session.url };
      } catch (err) {
        request.log.error(
          { err: err instanceof Error ? err.message : "checkout failed", invoiceId: invoice.id },
          "Stripe checkout failed",
        );
        const failure = checkoutFailure(err);
        return reply.code(failure.status).send({ error: failure.error });
      }
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

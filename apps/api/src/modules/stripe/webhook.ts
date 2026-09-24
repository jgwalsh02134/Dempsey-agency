import type { FastifyInstance } from "fastify";
import type { Invoice } from "@prisma/client";
import Stripe from "stripe";
import { env } from "../../env.js";
import { getStripeClient, markInvoicePaid, paymentIntentId } from "../../lib/stripe.js";

type Log = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

/**
 * Stripe signs the raw request body. This plugin is encapsulated so only
 * `/stripe/webhook` replaces the JSON parser with the exact bytes. Every
 * other route keeps Fastify's normal JSON parser.
 */
export async function stripeWebhookRoutes(app: FastifyInstance) {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.post("/stripe/webhook", async (request, reply) => {
    const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripeClient = getStripeClient();
    if (!secret || !stripeClient) {
      return reply.code(503).send({ error: "Stripe webhooks are not configured" });
    }

    const signature = request.headers["stripe-signature"];
    if (!signature || !Buffer.isBuffer(request.body)) {
      return reply.code(400).send({ error: "Missing Stripe signature or body" });
    }

    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(
        request.body,
        signature,
        secret,
      );
    } catch (err) {
      request.log.warn(
        { err: err instanceof Error ? err.message : "invalid signature" },
        "Stripe webhook signature verification failed",
      );
      return reply.code(400).send({ error: "Invalid Stripe signature" });
    }

    try {
      await handleStripeEvent(app, event, request.log);
    } catch (err) {
      request.log.error(
        {
          err: err instanceof Error ? err.message : "handler failed",
          eventId: event.id,
          type: event.type,
        },
        "Stripe webhook handler failed",
      );
      return reply.code(500).send({ error: "Webhook handler failed" });
    }

    return reply.code(200).send({ received: true });
  });
}

async function handleStripeEvent(
  app: FastifyInstance,
  event: Stripe.Event,
  log: Log,
) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await applyCheckoutSession(app, event.data.object, log);
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    await applyPaymentIntent(app, event.data.object, log);
    return;
  }

  log.info({ type: event.type, eventId: event.id }, "Ignoring Stripe event");
}

async function applyCheckoutSession(
  app: FastifyInstance,
  session: Stripe.Checkout.Session,
  log: Log,
) {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") {
    log.info(
      { sessionId: session.id, paymentStatus: session.payment_status },
      "Checkout session is not paid yet",
    );
    return;
  }
  if (session.amount_total == null || !session.currency) {
    log.error(
      { sessionId: session.id },
      "Paid Checkout session is missing amount or currency",
    );
    return;
  }

  const invoice = await loadInvoiceForPayment(app, {
    invoiceId: session.metadata?.invoiceId,
    organizationId: session.metadata?.organizationId,
    amountCents: session.amount_total,
    currency: session.currency,
    log,
    source: session.id,
  });
  if (!invoice) return;

  await markInvoicePaid(app.prisma, invoice, {
    checkoutSessionId: session.id,
    paymentIntentId: paymentIntentId(session.payment_intent),
  });
  log.info({ invoiceId: invoice.id, sessionId: session.id }, "Invoice marked paid");
}

async function applyPaymentIntent(
  app: FastifyInstance,
  intent: Stripe.PaymentIntent,
  log: Log,
) {
  if (intent.status !== "succeeded") return;

  const invoice = await loadInvoiceForPayment(app, {
    invoiceId: intent.metadata?.invoiceId,
    organizationId: intent.metadata?.organizationId,
    amountCents: intent.amount,
    currency: intent.currency,
    log,
    source: intent.id,
  });
  if (!invoice) return;

  await markInvoicePaid(app.prisma, invoice, {
    paymentIntentId: intent.id,
  });
  log.info(
    { invoiceId: invoice.id, paymentIntentId: intent.id },
    "Invoice marked paid from payment intent",
  );
}

async function loadInvoiceForPayment(
  app: FastifyInstance,
  input: {
    invoiceId: string | undefined;
    organizationId: string | undefined;
    amountCents: number | null | undefined;
    currency: string | null | undefined;
    log: Log;
    source: string;
  },
): Promise<Invoice | null> {
  const { invoiceId, log, source } = input;
  if (!invoiceId) {
    log.warn({ source }, "Stripe event has no invoiceId metadata");
    return null;
  }

  const invoice = await app.prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    log.warn({ invoiceId, source }, "Invoice not found for Stripe event");
    return null;
  }

  if (
    input.organizationId &&
    input.organizationId !== invoice.organizationId
  ) {
    log.error(
      { invoiceId, source },
      "Stripe event organizationId does not match invoice",
    );
    return null;
  }

  if (
    input.amountCents != null &&
    input.amountCents !== invoice.amountCents
  ) {
    log.error(
      {
        invoiceId,
        source,
        expected: invoice.amountCents,
        got: input.amountCents,
      },
      "Stripe amount does not match invoice",
    );
    return null;
  }

  if (
    input.currency &&
    input.currency.toLowerCase() !== invoice.currency.toLowerCase()
  ) {
    log.error(
      { invoiceId, source, expected: invoice.currency, got: input.currency },
      "Stripe currency does not match invoice",
    );
    return null;
  }

  return invoice;
}

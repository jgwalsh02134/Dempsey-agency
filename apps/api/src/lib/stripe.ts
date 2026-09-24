import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { corsConfig, env } from "../env.js";

/**
 * One Stripe client per process. Constructed with the secret key argument
 * (`new Stripe(key)`), never `Stripe.apiKey` / a process-global key.
 */
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function resolvePortalBaseUrl(): string | null {
  const explicit = (env.PORTAL_URL ?? env.APP_PORTAL_URL)?.replace(/\/$/, "");
  if (explicit) return explicit;

  if (corsConfig.mode === "list") {
    const portal = corsConfig.origins.find((origin) => {
      try {
        return new URL(origin).hostname.startsWith("portal.");
      } catch {
        return false;
      }
    });
    if (portal) return portal.replace(/\/$/, "");
  }

  if (env.NODE_ENV !== "production") {
    return "http://localhost:5174";
  }
  return null;
}

export function billingReturnUrl(
  flag: "paid" | "canceled",
  invoiceId: string,
  organizationId: string,
): string | null {
  const base = resolvePortalBaseUrl();
  if (!base) return null;
  const params = new URLSearchParams({
    [flag]: "1",
    invoice: invoiceId,
    org: organizationId,
  });
  return `${base}/billing?${params.toString()}`;
}

export function paymentIntentId(
  paymentIntent:
    | string
    | Stripe.PaymentIntent
    | null
    | undefined,
): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

type PayableInvoice = {
  id: string;
  paidAt: Date | null;
  stripePaymentIntentId: string | null;
};

export async function markInvoicePaid(
  prisma: PrismaClient,
  invoice: PayableInvoice,
  refs: {
    checkoutSessionId?: string | null;
    paymentIntentId?: string | null;
  },
): Promise<void> {
  const data: Prisma.InvoiceUpdateInput = {
    status: "PAID",
    paidAt: invoice.paidAt ?? new Date(),
  };
  if (refs.checkoutSessionId) {
    data.stripeCheckoutSessionId = refs.checkoutSessionId;
  }
  if (refs.paymentIntentId) {
    data.stripePaymentIntentId = refs.paymentIntentId;
  }

  try {
    await prisma.invoice.update({ where: { id: invoice.id }, data });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: invoice.paidAt ?? new Date(),
        },
      });
      return;
    }
    throw err;
  }
}

export async function ensureStripeCustomer(
  stripe: Stripe,
  prisma: PrismaClient,
  org: { id: string; name: string; stripeCustomerId: string | null },
): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create(
    {
      name: org.name,
      metadata: { organizationId: org.id },
    },
    { idempotencyKey: `org_customer_${org.id}` },
  );

  const claimed = await prisma.organization.updateMany({
    where: { id: org.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (claimed.count === 1) return customer.id;

  const fresh = await prisma.organization.findUnique({
    where: { id: org.id },
    select: { stripeCustomerId: true },
  });
  return fresh?.stripeCustomerId ?? customer.id;
}

export function checkoutFailure(err: unknown): { status: number; error: string } {
  if (err instanceof Stripe.errors.StripeAuthenticationError) {
    return { status: 503, error: "Card payments are not configured" };
  }
  if (err instanceof Stripe.errors.StripeInvalidRequestError) {
    return { status: 400, error: err.message };
  }
  if (err instanceof Stripe.errors.StripeError) {
    return { status: 502, error: "Unable to start checkout. Please try again." };
  }
  return { status: 500, error: "Unable to start checkout" };
}

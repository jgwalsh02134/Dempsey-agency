import type { FastifyBaseLogger } from "fastify";
import { env } from "../env.js";

/**
 * Minimal transactional email sender backed by Resend's HTTP API.
 *
 * Design notes:
 *   - No SDK dependency; one `fetch()` to https://api.resend.com/emails.
 *   - When RESEND_API_KEY or EMAIL_FROM is unset, `sendEmail()` is a logged
 *     no-op. This means dev/CI work without credentials and production
 *     degrades gracefully if mail config is temporarily missing.
 *   - Errors throw; callers (notify() in particular) are expected to swallow
 *     and log so email failures never fail a business transaction.
 */

interface SendEmailArgs {
  to: string | string[];
  subject: string;
  /** Plain-text body. Included as the primary body even when `html` is
   *  provided — some mail clients fall back to text. */
  text: string;
  /** Optional HTML body. Keep it simple; we don't want a template engine
   *  in the loop for v1. */
  html?: string;
}

export interface SendEmailResult {
  /** true when the request was actually sent; false for the no-op path. */
  delivered: boolean;
}

const RESEND_URL = "https://api.resend.com/emails";

export async function sendEmail(
  log: FastifyBaseLogger,
  args: SendEmailArgs,
): Promise<SendEmailResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!apiKey || !from) {
    log.info(
      { to: args.to, subject: args.subject },
      "email.send skipped: RESEND_API_KEY or EMAIL_FROM not configured",
    );
    return { delivered: false };
  }

  const to = Array.isArray(args.to) ? args.to : [args.to];
  // Defensive: drop anything obviously-not-an-email so one bad address
  // can't tank the whole batch. The real validation is at recipient-lookup
  // time; this is just belt-and-suspenders.
  const cleaned = to.filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
  if (cleaned.length === 0) {
    log.warn(
      { to, subject: args.subject },
      "email.send skipped: no valid recipient addresses",
    );
    return { delivered: false };
  }

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: cleaned,
      subject: args.subject,
      text: args.text,
      ...(args.html ? { html: args.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(
      `Resend responded ${res.status}: ${body.slice(0, 500)}`,
    );
  }

  return { delivered: true };
}

/** Base URL for the portal (client-facing). Null when not configured — the
 *  caller should omit the CTA in that case rather than send a broken link. */
export function portalBaseUrl(): string | null {
  return env.APP_PORTAL_URL ?? null;
}

/** Base URL for the admin app. Null when not configured. */
export function adminBaseUrl(): string | null {
  return env.APP_ADMIN_URL ?? null;
}

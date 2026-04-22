import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  SlackNotConfiguredError,
  SlackPostError,
  isSlackConfigured,
  postToSlack,
} from "../slack.js";

// In-memory rate limiter: max 5 requests / 60s per IP. Copy of the pattern
// in routes/publishers.ts. When a third caller lands, extract to
// src/util/rateLimit.ts and drop both copies.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(
  ip: string,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000,
    );
    return { allowed: false, retryAfter };
  }
  bucket.count += 1;
  return { allowed: true };
}

function clientIp(request: FastifyRequest): string {
  return request.ip || "unknown";
}

const testBody = z.object({
  text: z.string().max(2000).optional(),
});

export async function notificationsRoutes(app: FastifyInstance) {
  app.post("/test", async (request, reply) => {
    const user = app.requireUser(request);

    const ip = clientIp(request);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfter));
      return reply.code(429).send({
        error: "rate_limited",
        retry_after_seconds: rate.retryAfter,
      });
    }

    if (!isSlackConfigured()) {
      return reply.code(503).send({ error: "slack_not_configured" });
    }

    const body = testBody.parse(request.body ?? {});
    const sentAt = new Date();
    const text =
      body.text ??
      `Workspace test notification from ${user.email} at ${sentAt.toISOString()}`;

    try {
      await postToSlack(text, { logger: request.log });
    } catch (err) {
      if (err instanceof SlackNotConfiguredError) {
        return reply.code(503).send({ error: "slack_not_configured" });
      }
      if (err instanceof SlackPostError) {
        return reply.code(500).send({ error: "slack_post_failed" });
      }
      throw err;
    }

    return reply.send({ ok: true, sent_at: sentAt.toISOString() });
  });
}

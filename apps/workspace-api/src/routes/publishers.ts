import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import { env } from "../env.js";

const SUMMARY_MODEL = "gpt-4o-mini";
const SUMMARY_MAX_OUTPUT_TOKENS = 500;
const CACHE_TTL_DAYS = 30;

// In-memory rate limiter: max 5 requests / 60s per IP. Fine for a single
// instance; if workspace-api ever runs multiple replicas this needs to move
// to Postgres or Redis.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfter: number } {
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

const summaryBody = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1).max(500),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  dma: z.string().min(1).max(200),
});

const summaryQuery = z.object({
  force: z.enum(["1", "true"]).optional(),
});

type CachedSummary = {
  summary: string;
  generated_at: Date;
  model: string;
};

function systemPrompt(): string {
  return [
    "You write brief, neutral summaries of local and regional news publishers for an ad-buying workspace, in structured markdown.",
    "Output exactly these four sections, in this order, using bold markdown for headings (not # headings):",
    "",
    "**What they cover**",
    "- 2 to 3 short bullet points",
    "",
    "**Editorial tone**",
    "A single sentence.",
    "",
    "**Audience**",
    "A single sentence.",
    "",
    "**Standout sections**",
    "- 2 to 3 short bullet points",
    "",
    "Ground every claim in the publisher's URL and location. Do not invent circulation numbers, ownership, awards, or staff names.",
    "If you do not have enough confident public information for a section, emit that section's content as a single bullet or sentence reading exactly: Limited public info available.",
  ].join("\n");
}

function userPrompt(p: z.infer<typeof summaryBody>): string {
  return [
    `Publisher: ${p.name}`,
    `URL: ${p.url}`,
    `Location: ${p.city}, ${p.state}`,
    `DMA: ${p.dma}`,
  ].join("\n");
}

async function fetchCached(
  app: FastifyInstance,
  name: string,
  city: string,
  state: string,
): Promise<CachedSummary | null> {
  const result = await app.db.query<CachedSummary>(
    `SELECT summary, generated_at, model
     FROM publisher_summaries
     WHERE publisher_name = $1 AND city = $2 AND state = $3`,
    [name, city, state],
  );
  return result.rows[0] ?? null;
}

async function upsertSummary(
  app: FastifyInstance,
  name: string,
  city: string,
  state: string,
  summary: string,
  generatedAt: Date,
  model: string,
): Promise<void> {
  await app.db.query(
    `INSERT INTO publisher_summaries
       (publisher_name, city, state, summary, generated_at, model)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (publisher_name, city, state) DO UPDATE
       SET summary = EXCLUDED.summary,
           generated_at = EXCLUDED.generated_at,
           model = EXCLUDED.model`,
    [name, city, state, summary, generatedAt, model],
  );
}

function isFresh(generatedAt: Date): boolean {
  const ageMs = Date.now() - generatedAt.getTime();
  return ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

function clientIp(request: FastifyRequest): string {
  // `trustProxy: true` in Fastify config means `request.ip` already honors
  // X-Forwarded-For when deployed behind Railway's proxy.
  return request.ip || "unknown";
}

type HealthResult =
  | { status: "ok" }
  | {
      status: "down";
      reason:
        | "no_api_key"
        | "openai_unreachable"
        | "openai_auth_failed"
        | "openai_error";
      statusCode?: number;
    };

const HEALTH_CACHE_TTL_MS = 60_000;
const HEALTH_PING_TIMEOUT_MS = 5_000;
let healthCache: { result: HealthResult; expiresAt: number } | null = null;

async function runHealthPing(): Promise<HealthResult> {
  if (!env.OPENAI_API_KEY) {
    return { status: "down", reason: "no_api_key" };
  }
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: HEALTH_PING_TIMEOUT_MS,
  });
  try {
    await client.models.list();
    return { status: "ok" };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const statusCode =
      typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : undefined;
    if (
      name === "APIConnectionError" ||
      name === "APIConnectionTimeoutError" ||
      name === "AbortError"
    ) {
      return { status: "down", reason: "openai_unreachable" };
    }
    if (statusCode === 401) {
      return { status: "down", reason: "openai_auth_failed" };
    }
    return { status: "down", reason: "openai_error", statusCode };
  }
}

export async function publishersRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return { items: [] };
  });

  app.post("/summary", async (request, reply) => {
    app.requireUser(request);

    const ip = clientIp(request);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfter));
      return reply.code(429).send({
        error: "rate_limited",
        retry_after_seconds: rate.retryAfter,
      });
    }

    const body = summaryBody.parse(request.body);
    const query = summaryQuery.parse(request.query);
    const force = query.force === "1" || query.force === "true";

    if (!force) {
      const cached = await fetchCached(app, body.name, body.city, body.state);
      if (cached && isFresh(cached.generated_at)) {
        return reply.send({
          summary: cached.summary,
          generated_at: cached.generated_at.toISOString(),
          model: cached.model,
          cached: true,
        });
      }
    }

    if (!env.OPENAI_API_KEY) {
      app.log.error("publisher summary requested but OPENAI_API_KEY is unset");
      return reply.code(500).send({ error: "summary_generation_failed" });
    }

    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const startedAt = Date.now();
    let summaryText: string;
    try {
      const completion = await client.chat.completions.create({
        model: SUMMARY_MODEL,
        max_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(body) },
        ],
      });
      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("empty_completion");
      }
      summaryText = content;
      app.log.info(
        {
          duration_ms: Date.now() - startedAt,
          model: SUMMARY_MODEL,
          prompt_tokens: completion.usage?.prompt_tokens,
          completion_tokens: completion.usage?.completion_tokens,
        },
        "publisher summary generated",
      );
    } catch (err) {
      app.log.error(
        {
          duration_ms: Date.now() - startedAt,
          // Log error name/status only — never the prompt, completion, or key.
          err_name: err instanceof Error ? err.name : "unknown",
          err_status:
            typeof (err as { status?: unknown })?.status === "number"
              ? (err as { status: number }).status
              : undefined,
        },
        "publisher summary generation failed",
      );
      return reply.code(500).send({ error: "summary_generation_failed" });
    }

    const generatedAt = new Date();
    await upsertSummary(
      app,
      body.name,
      body.city,
      body.state,
      summaryText,
      generatedAt,
      SUMMARY_MODEL,
    );

    return reply.send({
      summary: summaryText,
      generated_at: generatedAt.toISOString(),
      model: SUMMARY_MODEL,
      cached: false,
    });
  });

  app.get("/summary/health", async (request, reply) => {
    app.requireUser(request);

    const ip = clientIp(request);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      reply.header("Retry-After", String(rate.retryAfter));
      return reply.code(429).send({
        error: "rate_limited",
        retry_after_seconds: rate.retryAfter,
      });
    }

    const now = Date.now();
    if (healthCache && healthCache.expiresAt > now) {
      const code = healthCache.result.status === "ok" ? 200 : 503;
      return reply.code(code).send(healthCache.result);
    }

    const result = await runHealthPing();
    healthCache = { result, expiresAt: now + HEALTH_CACHE_TTL_MS };
    const code = result.status === "ok" ? 200 : 503;
    return reply.code(code).send(result);
  });
}

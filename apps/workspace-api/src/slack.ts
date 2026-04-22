import type { FastifyBaseLogger } from "fastify";
import { env } from "./env.js";

const SLACK_POST_TIMEOUT_MS = 5_000;

export class SlackNotConfiguredError extends Error {
  constructor() {
    super("SLACK_WEBHOOK_URL is not configured");
    this.name = "SlackNotConfiguredError";
  }
}

export class SlackPostError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SlackPostError";
    this.status = status;
  }
}

type PostOptions = {
  blocks?: unknown[];
  logger?: FastifyBaseLogger;
};

export function isSlackConfigured(): boolean {
  return Boolean(env.SLACK_WEBHOOK_URL);
}

export async function postToSlack(
  text: string,
  opts: PostOptions = {},
): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new SlackNotConfiguredError();
  }

  const payload: Record<string, unknown> = { text };
  if (opts.blocks) payload.blocks = opts.blocks;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SLACK_POST_TIMEOUT_MS,
  );

  const startedAt = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Slack returns "invalid_token" / "no_service" / etc. as plain text.
      // Include the body in the thrown error message so callers can log a
      // useful reason — but DO NOT log the webhook URL or the user's text.
      const body = await res.text().catch(() => "");
      throw new SlackPostError(
        `slack webhook responded ${res.status}: ${body || "(empty)"}`,
        res.status,
      );
    }

    opts.logger?.info(
      {
        duration_ms: Date.now() - startedAt,
        status: res.status,
      },
      "slack post ok",
    );
  } catch (err) {
    if (err instanceof SlackPostError) {
      opts.logger?.error(
        {
          duration_ms: Date.now() - startedAt,
          status: err.status,
          err_name: err.name,
        },
        "slack post failed",
      );
      throw err;
    }
    // AbortError / network failure / DNS / etc. — log metadata only.
    const err_name = err instanceof Error ? err.name : "unknown";
    opts.logger?.error(
      {
        duration_ms: Date.now() - startedAt,
        err_name,
      },
      "slack post failed",
    );
    throw new SlackPostError(`slack post failed (${err_name})`);
  } finally {
    clearTimeout(timeout);
  }
}

import { apiFetch } from "./api";

export type SlackTestOutcome =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "rate_limited" | "unknown" };

export async function sendSlackTestMessage(): Promise<SlackTestOutcome> {
  const res = await apiFetch("/api/workspace/notifications/test", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (res.status === 200) return { ok: true };
  if (res.status === 503) return { ok: false, reason: "not_configured" };
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "unknown" };
}

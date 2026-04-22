import { apiFetch, apiJson } from "./api";

export type PublisherSummary = {
  summary: string;
  generated_at: string;
  model: string;
  cached: boolean;
};

type SummaryInput = {
  name: string;
  url: string;
  city: string;
  state: string;
  dma: string;
};

export async function fetchPublisherSummary(
  input: SummaryInput,
  options: { force?: boolean } = {},
): Promise<PublisherSummary> {
  const path = options.force
    ? "/api/workspace/publishers/summary?force=1"
    : "/api/workspace/publishers/summary";
  return apiJson<PublisherSummary>(path, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type SummaryHealth =
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

export async function fetchSummaryHealth(): Promise<SummaryHealth> {
  const res = await apiFetch("/api/workspace/publishers/summary/health");
  if (res.status === 200 || res.status === 503) {
    return (await res.json()) as SummaryHealth;
  }
  // Any other status (401, 429, 5xx without a structured body) is surfaced
  // as a thrown error so the caller treats it as "checking", not "down".
  throw new Error(`summary health request failed (${res.status})`);
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

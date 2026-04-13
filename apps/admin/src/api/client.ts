import { apiUrl } from "./config";

const TOKEN_KEY = "dempsey_admin_jwt";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Fastify's stock error envelope is `{ statusCode, error: "<HTTP label>", message }`
 * where `error` is a class label like "Not Found" / "Bad Request" / "Conflict"
 * and the actionable text lives in `message`. Our own handlers instead return
 * `{ error: "<human message>" }`. Prefer a concrete `error`, but fall back to
 * `message` when `error` is only a generic HTTP status label.
 */
const GENERIC_STATUS_LABELS = new Set([
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Method Not Allowed",
  "Conflict",
  "Unprocessable Entity",
  "Too Many Requests",
  "Internal Server Error",
  "Bad Gateway",
  "Service Unavailable",
  "Gateway Timeout",
]);

function extractErrorMessage(data: unknown, res: Response): string {
  if (typeof data === "object" && data !== null) {
    const obj = data as { error?: unknown; message?: unknown };
    const err = typeof obj.error === "string" ? obj.error : undefined;
    const msg = typeof obj.message === "string" ? obj.message : undefined;
    if (err && !GENERIC_STATUS_LABELS.has(err)) return err;
    if (msg) return msg;
    if (err) return err;
  }
  return res.statusText;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const token = options.token ?? getStoredToken();
  const headers = new Headers(options.headers);
  if (
    !headers.has("Content-Type") &&
    options.body !== undefined &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = extractErrorMessage(data, res);
    throw new ApiError(msg || `HTTP ${res.status}`, res.status, data);
  }

  return data as T;
}

import { apiUrl } from "./config";

const TOKEN_KEY = "dempsey_portal_jwt";

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
    /* private browsing fallback */
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
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText;
    throw new ApiError(humanizeError(msg, res.status), res.status, data);
  }

  return data as T;
}

function humanizeError(message: string, status: number): string {
  const trimmed = message.trim();
  if (status === 401 && /invalid email or password/i.test(trimmed)) {
    return "That email or password is incorrect.";
  }
  if (status === 403) {
    return trimmed || "You don't have access to that.";
  }
  if (status >= 500 || trimmed === "Internal Server Error") {
    return "Something went wrong on our side. Please try again.";
  }
  if (!trimmed || trimmed === "Validation Error") {
    return "Please check the form and try again.";
  }
  return trimmed;
}

export function humanApiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  if (error instanceof TypeError) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return fallback;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Base origin of the workspace-api. When unset (local dev), requests stay
// relative and hit the Vite dev-server proxy defined in vite.config.ts.
// In production this MUST be set to the real API origin, e.g.
//   https://workspace-api.dempsey.agency
// Trailing slashes are stripped so callers can safely pass "/api/...".
const API_BASE_URL = (
  (import.meta.env.VITE_WORKSPACE_API_URL as string | undefined) ?? ""
).replace(/\/+$/, "");

export function resolveApiUrl(path: string): string {
  // Allow fully-qualified URLs to pass through untouched.
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    /* non-JSON response */
  }
  if (res.status === 401) return "Not authenticated";
  if (res.status === 403) return "Forbidden";
  return `Request failed (${res.status})`;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(resolveApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

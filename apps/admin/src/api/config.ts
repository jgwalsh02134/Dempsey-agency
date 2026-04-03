/**
 * API origin for fetch().
 * - If VITE_API_BASE_URL is set, use it (browser calls API directly; CORS must allow this origin).
 * - In dev with no env, use same-origin `/api` so Vite proxies to the real API (avoids CORS locally).
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return "https://api.dempsey.agency";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

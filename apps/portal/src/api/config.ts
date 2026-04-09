/**
 * API origin for fetch().
 *
 * Development:
 * - If VITE_API_BASE_URL is set → use it (direct API calls).
 * - Otherwise → "" (same-origin `/api/...` via Vite proxy).
 *
 * Production (static build):
 * - Uses VITE_API_BASE_URL from the build environment.
 * - Falls back to https://api.dempsey.agency only if unset.
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();

  if (import.meta.env.DEV) {
    if (raw) return raw.replace(/\/$/, "");
    return "";
  }

  const productionBase = (raw || "https://api.dempsey.agency").replace(
    /\/$/,
    "",
  );
  return productionBase;
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

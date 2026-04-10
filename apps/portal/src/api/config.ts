/**
 * API origin for fetch().
 *
 * Development (`vite`):
 * - If VITE_API_BASE_URL is set → use it (direct API calls).
 * - Otherwise → "" (same-origin `/api/...` via Vite proxy in vite.config.ts).
 *
 * Production (`vite build`):
 * - Vite loads `apps/portal/.env.production` → sets VITE_API_BASE_URL.
 * - Build-time env (e.g. Railway) overrides the same variable if set.
 * - Code fallback below if still unset after build.
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

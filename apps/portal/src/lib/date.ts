/**
 * Shared date helpers for the client portal.
 *
 * Every page should route date rendering through these so scanning a
 * grid of dates lines up visually and the "how old is this?" signal is
 * consistent.
 */

/** "Apr 10" when the value is in the current calendar year, otherwise
 *  "Apr 10, 2026". The year is suppressed 99% of the time so dense rows
 *  stay scannable. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}

/** Signed, compact relative-time — "now", "21m ago", "4h ago", "2d ago",
 *  "3w ago", "5mo ago" for the past; "in 2d" / "in 3w" for the future.
 *  Falls back to shortDate past ~12 months in either direction. */
export function fromNow(iso: string, now: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - now;
  const abs = Math.abs(diffMs);
  const future = diffMs > 0;
  const minutes = Math.floor(abs / 60_000);
  if (minutes < 1) return "now";
  const suffix = (v: string) => (future ? `in ${v}` : `${v} ago`);
  if (minutes < 60) return suffix(`${minutes}m`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return suffix(`${hours}h`);
  const days = Math.floor(hours / 24);
  if (days < 7) return suffix(`${days}d`);
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return suffix(`${weeks}w`);
  const months = Math.floor(days / 30);
  if (months < 12) return suffix(`${months}mo`);
  return shortDate(iso);
}

/** Long "Apr 10, 2026, 3:45 PM" — used for `title=""` tooltips on relative
 *  times so the precise value is always one hover away. */
export function fullDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Compact date range: "Apr 10 – Jun 30". One-sided ranges read as
 *  directives ("Starts …" / "Ends …") instead of prepositions. */
export function dateRange(
  start: string | null,
  end: string | null,
): string {
  if (start && end) return `${shortDate(start)} – ${shortDate(end)}`;
  if (start) return `Starts ${shortDate(start)}`;
  if (end) return `Ends ${shortDate(end)}`;
  return "Ongoing";
}

/** Proximity bucket for deadline styling. `past` / `soon` (≤14 days) /
 *  `far`. Callers map these to colors/accents. */
export function deadlineProximity(
  iso: string,
  now: number = Date.now(),
): "past" | "soon" | "far" {
  const ms = new Date(iso).getTime() - now;
  if (ms < 0) return "past";
  const days = Math.floor(ms / 86_400_000);
  return days <= 14 ? "soon" : "far";
}

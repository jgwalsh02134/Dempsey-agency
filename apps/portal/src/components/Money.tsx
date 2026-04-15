/**
 * Shared money rendering for the client portal.
 *
 * Every dollar amount on every surface flows through `<Money>`. This
 * guarantees:
 *   • one font stack (Andale Mono via `.money`) with tabular-nums + tnum,
 *   • one format (`$5,000.00` / locale-aware when a currency is passed),
 *   • one prominence scale (sub < base < lead < total).
 *
 * Status: shared replacement for the per-page `formatCents` / `formatCurrency`
 * helpers that previously lived in Dashboard, Campaigns, Billing, and
 * CampaignDetail.
 */

interface MoneyProps {
  /** Amount in minor units (cents). `null` renders an em-dash. */
  cents: number | null;
  /** ISO-4217 code. Defaults to USD. When omitted or invalid, falls back to
   *  a safe `$X,XXX.XX` format. */
  currency?: string;
  /** Prominence variant. `total` is loudest; `sub` is quietest. */
  size?: "sub" | "lead" | "total";
  /** Semantic tone — paints green (positive) or red (negative). */
  tone?: "positive" | "negative";
  /** Extra class hooks for layout contexts (e.g. `money-value`). */
  className?: string;
}

export function formatMoney(
  cents: number | null,
  currency: string = "USD",
): string {
  if (cents == null) return "—";
  const amount = cents / 100;
  try {
    return amount.toLocaleString(undefined, {
      style: "currency",
      currency,
    });
  } catch {
    // Invalid currency codes fall through to a plain dollar format so the
    // app never crashes on bad data.
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function Money({
  cents,
  currency,
  size,
  tone,
  className,
}: MoneyProps) {
  const classes = [
    "money",
    size ? `money-${size}` : null,
    tone ? `money-${tone}` : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{formatMoney(cents, currency)}</span>;
}

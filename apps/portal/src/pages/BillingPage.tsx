import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import * as api from "../api/endpoints";
import { useOrg } from "../auth/OrgContext";
import { formatMoney, Money } from "../components/Money";
import { fromNow, shortDate } from "../lib/date";
import type { Invoice, InvoiceStatus } from "../types";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  PENDING: "report-badge badge-pending",
  PAID: "report-badge badge-paid",
  OVERDUE: "report-badge badge-overdue",
};

function canPay(inv: Invoice): boolean {
  return (
    (inv.status === "PENDING" || inv.status === "OVERDUE") &&
    !inv.stripePaymentIntentId &&
    inv.amountCents > 0
  );
}

export function BillingPage() {
  const { orgId: selectedOrgId, setOrgId: setSelectedOrgId, memberships } = useOrg();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payNotice, setPayNotice] = useState<string | null>(null);

  const paidFlag = params.get("paid") === "1";
  const canceledFlag = params.get("canceled") === "1";
  const returnInvoiceId = params.get("invoice");
  const returnOrgId = params.get("org");

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInvoices([]);
    api
      .fetchOrgInvoices(selectedOrgId)
      .then((res) => {
        if (!cancelled) setInvoices(res.invoices);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError
              ? e.message
              : "Failed to load invoices",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  useEffect(() => {
    if (!returnOrgId) return;
    const member = memberships.some((m) => m.organizationId === returnOrgId);
    if (member && returnOrgId !== selectedOrgId) {
      setSelectedOrgId(returnOrgId);
    }
  }, [returnOrgId, memberships, selectedOrgId, setSelectedOrgId]);

  function dismissReturnFlags() {
    const next = new URLSearchParams(params);
    next.delete("paid");
    next.delete("canceled");
    next.delete("invoice");
    next.delete("org");
    setParams(next, { replace: true });
    setPayNotice(null);
  }

  async function onPay(inv: Invoice) {
    if (payingId || !selectedOrgId) return;
    setPayingId(inv.id);
    setPayError(null);
    setPayNotice(null);
    try {
      const res = await api.createInvoiceCheckout(inv.id);
      if (res.alreadyPaid || !res.url) {
        setPayNotice("This invoice is already paid.");
        const refreshed = await api.fetchOrgInvoices(selectedOrgId);
        setInvoices(refreshed.invoices);
        setPayingId(null);
        return;
      }
      window.location.assign(res.url);
    } catch (e) {
      setPayError(
        e instanceof ApiError ? e.message : "Unable to start checkout",
      );
      setPayingId(null);
    }
  }

  const returnInvoice = returnInvoiceId
    ? invoices.find((inv) => inv.id === returnInvoiceId)
    : undefined;
  const returnBanner = paidFlag
    ? returnInvoice?.status === "PAID"
      ? `Payment confirmed. "${returnInvoice.title}" is paid.`
      : "Thanks. Stripe has your payment. This invoice will show as paid once we confirm it. Refresh in a moment if it still looks unpaid."
    : canceledFlag
      ? "Checkout canceled. No payment was taken. You can pay this invoice when you're ready."
      : payNotice;

  /** Per-currency summary — aggregates outstanding (PENDING + OVERDUE),
   *  overdue alone, and paid-to-date. Grouping keeps the strip safe in
   *  the rare case where a client has invoices in multiple currencies. */
  const summary = useMemo(() => {
    type Bucket = {
      currency: string;
      outstanding: number;
      outstandingCount: number;
      overdue: number;
      overdueCount: number;
      paid: number;
      paidCount: number;
    };
    const byCurrency = new Map<string, Bucket>();
    const getBucket = (currency: string): Bucket => {
      let b = byCurrency.get(currency);
      if (!b) {
        b = {
          currency,
          outstanding: 0,
          outstandingCount: 0,
          overdue: 0,
          overdueCount: 0,
          paid: 0,
          paidCount: 0,
        };
        byCurrency.set(currency, b);
      }
      return b;
    };
    for (const inv of invoices) {
      const b = getBucket(inv.currency);
      if (inv.status === "PAID") {
        b.paid += inv.amountCents;
        b.paidCount += 1;
      } else {
        b.outstanding += inv.amountCents;
        b.outstandingCount += 1;
        if (inv.status === "OVERDUE") {
          b.overdue += inv.amountCents;
          b.overdueCount += 1;
        }
      }
    }
    return Array.from(byCurrency.values());
  }, [invoices]);

  return (
    <>
      <section className="section-welcome section-welcome-compact">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Billing" }]} />
        <h1 className="welcome-heading">Billing</h1>
        {!loading && invoices.length > 0 && (
          <p className="welcome-status">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} on file
          </p>
        )}

        {memberships.length > 1 && (
          <div className="org-selector">
            <label
              className="org-selector-label"
              htmlFor="billing-org-select"
            >
              Organization
            </label>
            <select
              id="billing-org-select"
              className="org-select"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organization.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="list-tools">
          <label className="list-search">
            <span className="visually-hidden">Search invoices</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoices"
            />
          </label>
          <div className="chip-row" role="group" aria-label="Invoice status">
            {(["ALL", "PENDING", "OVERDUE", "PAID"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? "chip active" : "chip"}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === "ALL" ? "All" : STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!loading && !error && summary.length > 0 && (
        <section
          className="section-block billing-summary"
          aria-label="Billing summary"
        >
          {summary.map((b) => {
            const hasOverdue = b.overdueCount > 0;
            const hasOutstanding = b.outstandingCount > 0;
            return (
              <dl className="billing-summary-row" key={b.currency}>
                <div
                  className={`billing-stat${hasOverdue ? " billing-stat-alert" : ""}`}
                >
                  <dt>Outstanding</dt>
                  <dd>
                    <Money
                      cents={b.outstanding}
                      currency={b.currency}
                      size="total"
                      tone={hasOverdue ? "negative" : undefined}
                    />
                  </dd>
                  <dd className="billing-stat-sub">
                    {b.outstandingCount === 0
                      ? "All invoices paid — you're clear."
                      : `${b.outstandingCount} invoice${b.outstandingCount === 1 ? "" : "s"} unpaid`}
                  </dd>
                </div>

                {hasOverdue && (
                  <div className="billing-stat billing-stat-overdue">
                    <dt>Overdue</dt>
                    <dd>
                      <Money
                        cents={b.overdue}
                        currency={b.currency}
                        size="lead"
                        tone="negative"
                      />
                    </dd>
                    <dd className="billing-stat-sub">
                      {b.overdueCount} invoice{b.overdueCount === 1 ? "" : "s"}
                      {" — please pay soon."}
                    </dd>
                  </div>
                )}

                <div className="billing-stat">
                  <dt>Paid to date</dt>
                  <dd>
                    <Money
                      cents={b.paid}
                      currency={b.currency}
                      size="lead"
                    />
                  </dd>
                  <dd className="billing-stat-sub">
                    {b.paidCount} invoice{b.paidCount === 1 ? "" : "s"} settled
                  </dd>
                </div>

                {summary.length > 1 && (
                  <div className="billing-stat-currency">{b.currency}</div>
                )}
                {!hasOutstanding && !hasOverdue && b.paidCount === 0 && (
                  <div className="billing-stat-sub">No activity yet.</div>
                )}
              </dl>
            );
          })}
        </section>
      )}

      <section className="section-block">
        <h2 className="section-heading">Invoices</h2>

        {returnBanner && (
          <p
            className={
              canceledFlag && !paidFlag && !payNotice
                ? "billing-banner billing-banner-neutral"
                : "form-success billing-banner"
            }
            role="status"
          >
            {returnBanner}
            <button
              type="button"
              className="billing-banner-dismiss"
              onClick={dismissReturnFlags}
            >
              Dismiss
            </button>
          </p>
        )}

        {payError && (
          <p className="form-error billing-banner" role="alert">
            {payError}
          </p>
        )}

        {loading && (
          <p className="text-muted">Loading invoices…</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && invoices.length === 0 && (
          <EmptyState
            title="No invoices yet"
            body="Invoices your agency issues will show up here with their status and due date."
            action={{ href: "/documents", label: "Check documents" }}
          />
        )}

        {!loading && invoices.length > 0 && (
          <ul className="report-list">
            {invoices
              .filter((inv) => {
                if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
                return inv.title.toLowerCase().includes(query.trim().toLowerCase());
              })
              .map((inv) => (
              <li key={inv.id} className="report-item">
                <div className="report-info">
                  <span className="report-name">{inv.title}</span>
                  {inv.description && (
                    <span className="report-description">
                      {inv.description}
                    </span>
                  )}
                  <div className="money-block" style={{ marginTop: "0.25rem" }}>
                    <Money
                      cents={inv.amountCents}
                      currency={inv.currency}
                      className="money-value money-lead"
                    />
                  </div>
                  <div className="invoice-meta">
                    <span
                      className="mono"
                      title={new Date(inv.invoiceDate).toLocaleString()}
                    >
                      Issued {shortDate(inv.invoiceDate)}
                    </span>
                    {inv.dueDate && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span
                          className={`mono invoice-due${inv.status === "OVERDUE" ? " invoice-due-overdue" : inv.status === "PAID" ? " invoice-due-paid" : ""}`}
                          title={new Date(inv.dueDate).toLocaleString()}
                        >
                          {inv.status === "PAID"
                            ? `Due ${shortDate(inv.dueDate)}`
                            : inv.status === "OVERDUE"
                              ? `Overdue ${fromNow(inv.dueDate)}`
                              : `Due ${shortDate(inv.dueDate)} · ${fromNow(inv.dueDate)}`}
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    className="text-muted mono"
                    style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}
                    title={`Invoice amount: ${formatMoney(inv.amountCents, inv.currency)}`}
                  >
                    {inv.currency}
                  </div>
                  {inv.status === "PAID" && inv.paidAt && (
                    <div className="invoice-meta">
                      <span className="mono">Paid {shortDate(inv.paidAt)}</span>
                    </div>
                  )}
                </div>
                <div className="invoice-side">
                  {canPay(inv) && (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={payingId !== null}
                      aria-busy={payingId === inv.id}
                      onClick={() => void onPay(inv)}
                    >
                      {payingId === inv.id ? "Redirecting…" : "Pay"}
                    </button>
                  )}
                  <span className={STATUS_BADGE[inv.status]}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

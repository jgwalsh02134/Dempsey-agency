import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return amount.toLocaleString(undefined, {
      style: "currency",
      currency,
    });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function BillingPage() {
  const { session } = useAuth();
  const memberships = session!.memberships;

  const [selectedOrgId, setSelectedOrgId] = useState(
    () => memberships[0]?.organizationId ?? "",
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Billing</h1>
        <p className="welcome-body">
          Invoices and billing history for your account with Dempsey Agency.
        </p>

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
      </section>

      <section className="section-block">
        <h2 className="section-heading">Invoices</h2>

        {loading && (
          <p className="text-muted">Loading invoices…</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && invoices.length === 0 && (
          <p className="text-muted">
            No invoices have been issued for your organization yet.
          </p>
        )}

        {!loading && invoices.length > 0 && (
          <ul className="report-list">
            {invoices.map((inv) => (
              <li key={inv.id} className="report-item">
                <div className="report-info">
                  <span className="report-name">{inv.title}</span>
                  {inv.description && (
                    <span className="report-description">
                      {inv.description}
                    </span>
                  )}
                  <div className="money-block" style={{ marginTop: "0.25rem" }}>
                    <span className="money-value">{formatCurrency(inv.amountCents, inv.currency)}</span>
                  </div>
                  <div className="invoice-meta">
                    <span>
                      Issued {formatDate(inv.invoiceDate)}
                      {inv.dueDate && ` · Due ${formatDate(inv.dueDate)}`}
                    </span>
                  </div>
                </div>
                <span className={STATUS_BADGE[inv.status]}>
                  {STATUS_LABEL[inv.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

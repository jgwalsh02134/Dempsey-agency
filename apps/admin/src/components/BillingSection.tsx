import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Invoice, InvoiceStatus } from "../types";

const STATUSES: InvoiceStatus[] = ["PENDING", "PAID", "OVERDUE"];

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

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function BillingSection({ orgId }: { orgId: string }) {
  /* ── list state ── */
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── create state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<InvoiceStatus>("PENDING");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── action state ── */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ── load invoices ── */
  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchOrgInvoices(orgId);
      setInvoices(res.invoices);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  /* ── create handler ── */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setCreateError("Enter a valid amount");
      return;
    }
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createInvoice>[1] = {
        title: title.trim(),
        amountCents: Math.round(parsed * 100),
        currency: currency.trim().toUpperCase() || "USD",
        status,
        invoiceDate,
      };
      if (description.trim()) body.description = description.trim();
      if (dueDate) body.dueDate = dueDate;
      await api.createInvoice(orgId, body);
      setCreateSuccess(`"${title.trim()}" created.`);
      setTitle("");
      setDescription("");
      setAmount("");
      setCurrency("USD");
      setStatus("PENDING");
      setInvoiceDate("");
      setDueDate("");
      void loadInvoices();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ── status change handler ── */
  async function onStatusChange(id: string, newStatus: InvoiceStatus) {
    setActionError(null);
    setBusyId(id);
    try {
      await api.patchInvoice(id, { status: newStatus });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, status: newStatus } : inv,
        ),
      );
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  /* ── delete handler ── */
  async function onDelete(invoice: Invoice) {
    if (
      !window.confirm(
        `Delete "${invoice.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setBusyId(invoice.id);
    try {
      await api.deleteInvoice(invoice.id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Billing</h2>
      <p className="muted">
        Organization <code>{orgId}</code>
      </p>

      {/* ── Create form ── */}
      <h3 className="h3-spaced">Create invoice</h3>
      <form onSubmit={onCreate} className="stack">
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            placeholder="e.g. April 2026 Media Services"
          />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Invoice details or line-item summary"
          />
        </label>
        <div className="two-col">
          <label className="field">
            <span>Amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
            />
          </label>
          <label className="field">
            <span>Currency</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
              placeholder="USD"
            />
          </label>
        </div>
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="two-col">
          <label className="field">
            <span>Invoice date</span>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Due date (optional)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        {createError && (
          <p className="error" role="alert">
            {createError}
          </p>
        )}
        {createSuccess && (
          <p className="success" role="status">
            {createSuccess}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={creating}>
          {creating ? "Creating…" : "Create invoice"}
        </button>
      </form>

      {/* ── Invoice list ── */}
      <h3 className="h3-spaced">Invoices</h3>
      {loading && <p className="muted">Loading…</p>}
      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {!loading && invoices.length === 0 && !listError && (
        <p className="muted">No invoices yet.</p>
      )}
      {!loading && invoices.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div>{inv.title}</div>
                    {inv.description && (
                      <span className="small">{inv.description}</span>
                    )}
                  </td>
                  <td>{formatCurrency(inv.amountCents, inv.currency)}</td>
                  <td>
                    <select
                      className="inline-select"
                      value={inv.status}
                      disabled={busyId === inv.id}
                      onChange={(e) =>
                        onStatusChange(
                          inv.id,
                          e.target.value as InvoiceStatus,
                        )
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td>
                    {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn danger ghost"
                      disabled={busyId === inv.id}
                      onClick={() => onDelete(inv)}
                    >
                      {busyId === inv.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

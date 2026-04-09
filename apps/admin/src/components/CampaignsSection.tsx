import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Campaign, CampaignStatus } from "../types";

const STATUSES: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function dateRange(
  start: string | null,
  end: string | null,
): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "—";
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function CampaignsSection({ orgId }: { orgId: string }) {
  /* ── list state ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── create state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("ACTIVE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── action state ── */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ── load campaigns ── */
  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchOrgCampaigns(orgId);
      setCampaigns(res.campaigns);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  /* ── create handler ── */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createCampaign>[1] = {
        title: title.trim(),
        status,
      };
      if (description.trim()) body.description = description.trim();
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      await api.createCampaign(orgId, body);
      setCreateSuccess(`"${title.trim()}" created.`);
      setTitle("");
      setDescription("");
      setStatus("ACTIVE");
      setStartDate("");
      setEndDate("");
      void loadCampaigns();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ── status change handler ── */
  async function onStatusChange(id: string, newStatus: CampaignStatus) {
    setActionError(null);
    setBusyId(id);
    try {
      await api.patchCampaign(id, { status: newStatus });
      setCampaigns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  /* ── delete handler ── */
  async function onDelete(campaign: Campaign) {
    if (
      !window.confirm(
        `Delete "${campaign.title}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setBusyId(campaign.id);
    try {
      await api.deleteCampaign(campaign.id);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Campaigns</h2>
      <p className="muted">
        Organization <code>{orgId}</code>
      </p>

      {/* ── Create form ── */}
      <h3 className="h3-spaced">Create campaign</h3>
      <form onSubmit={onCreate} className="stack">
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            placeholder="e.g. Q2 Print Campaign"
          />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Brief summary of campaign objectives"
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CampaignStatus)}
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
            <span>Start date (optional)</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>End date (optional)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
          {creating ? "Creating…" : "Create campaign"}
        </button>
      </form>

      {/* ── Campaign list ── */}
      <h3 className="h3-spaced">Active campaigns</h3>
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
      {!loading && campaigns.length === 0 && !listError && (
        <p className="muted">No campaigns yet.</p>
      )}
      {!loading && campaigns.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div>{c.title}</div>
                    {c.description && (
                      <span className="small">{c.description}</span>
                    )}
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={c.status}
                      disabled={busyId === c.id}
                      onChange={(e) =>
                        onStatusChange(
                          c.id,
                          e.target.value as CampaignStatus,
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
                  <td>
                    <span className="small">
                      {dateRange(c.startDate, c.endDate)}
                    </span>
                  </td>
                  <td>
                    <div>{formatDate(c.createdAt)}</div>
                    {c.createdBy && (
                      <span className="small">
                        {c.createdBy.name || c.createdBy.email}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn danger ghost"
                      disabled={busyId === c.id}
                      onClick={() => onDelete(c)}
                    >
                      {busyId === c.id ? "…" : "Delete"}
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

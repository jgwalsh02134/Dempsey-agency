import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  AdminSubmission,
  AICreativeReview,
  CreativeType,
  Organization,
  SubmissionStatus,
} from "../types";

const ALL_STATUSES: SubmissionStatus[] = [
  "SUBMITTED",
  "APPROVED",
  "REVISION_REQUESTED",
];
const ALL_TYPES: CreativeType[] = ["PRINT", "DIGITAL"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function CreativesQueuePage() {
  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterType, setFilterType] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Record<string, AICreativeReview>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      setOrgs(await api.fetchOrganizations());
    } catch {
      /* non-critical */
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchAdminSubmissions({
        status: filterStatus || undefined,
        organizationId: filterOrg || undefined,
        creativeType: filterType || undefined,
      });
      setSubs(res.submissions);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterOrg, filterType]);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function onStatusChange(sub: AdminSubmission, newStatus: SubmissionStatus) {
    setActionError(null);
    setBusyId(sub.id);
    try {
      let reviewNote: string | null | undefined;
      if (newStatus === "REVISION_REQUESTED") {
        const note = window.prompt("Review note (optional):");
        if (note !== null) reviewNote = note || null;
      }
      await api.patchSubmission(sub.id, {
        status: newStatus,
        ...(reviewNote !== undefined ? { reviewNote } : {}),
      });
      setSubs((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? { ...s, status: newStatus, ...(reviewNote !== undefined ? { reviewNote } : {}) }
            : s,
        ),
      );
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(sub: AdminSubmission) {
    if (!window.confirm(`Delete "${sub.title}"? This cannot be undone.`)) return;
    setActionError(null);
    setBusyId(sub.id);
    try {
      await api.deleteSubmission(sub.id);
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onAIReview(sub: AdminSubmission) {
    setReviewError(null);
    setReviewingId(sub.id);
    try {
      const review = await api.reviewCreative(sub.id);
      setReviews((prev) => ({ ...prev, [sub.id]: review }));
    } catch (e) {
      setReviewError(errMsg(e));
    } finally {
      setReviewingId(null);
    }
  }

  const clientOrgs = orgs.filter((o) => o.type === "CLIENT");
  const submittedCount = subs.filter((s) => s.status === "SUBMITTED").length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Creatives Queue</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {subs.length} submission{subs.length !== 1 ? "s" : ""}
              {submittedCount > 0 && ` · ${submittedCount} awaiting review`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={loadSubmissions}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="q-filters">
        <label className="q-filter-field">
          <span className="small">Status</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="q-filter-field">
          <span className="small">Client</span>
          <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)}>
            <option value="">All clients</option>
            {clientOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
        <label className="q-filter-field">
          <span className="small">Type</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {reviewError && <p className="error" role="alert">{reviewError}</p>}

      {loading && <p className="muted">Loading submissions…</p>}

      {!loading && subs.length === 0 && !error && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          No submissions match the current filters.
        </p>
      )}

      {!loading && subs.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Client</th>
                <th>Campaign</th>
                <th>Type</th>
                <th>File</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>{s.title}</div>
                    {s.description && (
                      <span className="small">{s.description}</span>
                    )}
                    {s.reviewNote && (
                      <span className="small warning">Note: {s.reviewNote}</span>
                    )}
                    {reviews[s.id] && (
                      <div className="q-ai-review">
                        <div className="q-ai-label">AI Review</div>
                        <div>{reviews[s.id].summary}</div>
                        {reviews[s.id].suggestions.length > 0 && (
                          <ul className="q-ai-suggestions">
                            {reviews[s.id].suggestions.map((sug, i) => (
                              <li key={i}>{sug}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="small">{s.organization.name}</td>
                  <td className="small">{s.campaign.title}</td>
                  <td><span className="type-badge">{s.creativeType}</span></td>
                  <td>
                    <code className="small">{s.filename}</code>
                    <br />
                    <span className="small">{formatBytes(s.sizeBytes)}</span>
                  </td>
                  <td>
                    <select
                      className="inline-select"
                      value={s.status}
                      disabled={busyId === s.id}
                      onChange={(e) =>
                        onStatusChange(s, e.target.value as SubmissionStatus)
                      }
                    >
                      {ALL_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div>{formatDate(s.createdAt)}</div>
                    {s.submittedBy && (
                      <span className="small">
                        {s.submittedBy.name || s.submittedBy.email}
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busyId === s.id || reviewingId === s.id}
                      onClick={() => onAIReview(s)}
                      style={{ marginRight: "0.375rem" }}
                    >
                      {reviewingId === s.id
                        ? "Reviewing…"
                        : reviews[s.id]
                          ? "Re-review"
                          : "AI Review"}
                    </button>
                    <button
                      type="button"
                      className="btn danger ghost"
                      disabled={busyId === s.id}
                      onClick={() => onDelete(s)}
                    >
                      {busyId === s.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

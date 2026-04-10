import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  AdminSubmission,
  AICreativeReview,
  CreativeType,
  Organization,
  SubmissionStatus,
  ValidationSummary,
} from "../types";

const ALL_STATUSES: SubmissionStatus[] = [
  "UPLOADED",
  "VALIDATION_FAILED",
  "UNDER_REVIEW",
  "NEEDS_RESIZING",
  "READY_FOR_PUBLISHER",
  "PUSHED",
];
const ALL_TYPES: CreativeType[] = ["DIGITAL", "PRINT", "MASTER_ASSET"];

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  UPLOADED: "Uploaded",
  VALIDATION_FAILED: "Validation Failed",
  UNDER_REVIEW: "Under Review",
  NEEDS_RESIZING: "Changes Requested",
  READY_FOR_PUBLISHER: "Ready for Publisher",
  PUSHED: "Sent to Publisher",
};

const TYPE_LABEL: Record<CreativeType, string> = {
  DIGITAL: "Digital",
  PRINT: "Print",
  MASTER_ASSET: "Master Asset",
};

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
  const [searchParams] = useSearchParams();
  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState(
    () => searchParams.get("status") ?? "",
  );
  const [filterOrg, setFilterOrg] = useState("");
  const [filterType, setFilterType] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Record<string, AICreativeReview>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewMimes, setPreviewMimes] = useState<Record<string, string>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const loadOrgs = useCallback(async () => {
    try { setOrgs(await api.fetchOrganizations()); } catch { /* non-critical */ }
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

  useEffect(() => { void loadOrgs(); }, [loadOrgs]);
  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  /* ── status transition ── */
  async function transitionStatus(
    sub: AdminSubmission,
    newStatus: SubmissionStatus,
    reviewNote?: string | null,
  ) {
    setActionError(null);
    setBusyId(sub.id);
    try {
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
      if (expandedId === sub.id) setExpandedId(null);
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

  function toggleExpand(id: string, mimeType?: string) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    setNoteText("");
    if (next && !previewUrls[id] && mimeType) {
      void loadPreview(id);
    }
  }

  async function loadPreview(id: string) {
    try {
      const res = await api.fetchSubmissionPreviewUrl(id);
      if (res.previewable) {
        setPreviewUrls((p) => ({ ...p, [id]: res.url }));
        setPreviewMimes((p) => ({ ...p, [id]: res.mimeType }));
      }
    } catch { /* non-critical */ }
  }

  const clientOrgs = orgs.filter((o) => o.type === "CLIENT");
  const pendingCount = subs.filter(
    (s) => s.status === "UPLOADED" || s.status === "VALIDATION_FAILED",
  ).length;

  const STATUS_ACCENT: Record<SubmissionStatus, string> = {
    UPLOADED: "q-status-uploaded",
    VALIDATION_FAILED: "q-status-failed",
    UNDER_REVIEW: "q-status-review",
    NEEDS_RESIZING: "q-status-resize",
    READY_FOR_PUBLISHER: "q-status-ready",
    PUSHED: "q-status-pushed",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Creatives Queue</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {subs.length} submission{subs.length !== 1 ? "s" : ""}
              {pendingCount > 0 && ` · ${pendingCount} awaiting review`}
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
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
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
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {reviewError && <p className="error" role="alert">{reviewError}</p>}

      {loading && <p className="muted">Loading submissions…</p>}

      {!loading && subs.length === 0 && !error && (
        <p className="muted" style={{ marginTop: "1rem" }}>No submissions match the current filters.</p>
      )}

      {!loading && subs.length > 0 && (
        <ul className="q-list">
          {subs.map((s) => {
            const expanded = expandedId === s.id;
            const vs = s.validationSummary as ValidationSummary | null;
            const busy = busyId === s.id;
            return (
              <li key={s.id} className={`q-row${expanded ? " q-row-expanded" : ""}`}>
                {/* ── Summary row ── */}
                <button
                  type="button"
                  className="q-row-summary"
                  onClick={() => toggleExpand(s.id, s.mimeType)}
                  aria-expanded={expanded}
                >
                  <div className="q-row-primary">
                    <span className="q-row-title">{s.title}</span>
                    <span className="q-row-meta">
                      {s.organization.name} · {s.campaign.title}
                    </span>
                  </div>
                  <div className="q-row-badges">
                    <span className="type-badge">{TYPE_LABEL[s.creativeType] ?? s.creativeType}</span>
                    <span className={`q-status-badge ${STATUS_ACCENT[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <div className="q-row-file">
                    <span>{s.filename}</span>
                    <span className="muted">
                      {formatBytes(s.sizeBytes)}
                      {s.widthPx != null && s.heightPx != null && ` · ${s.widthPx}×${s.heightPx}`}
                    </span>
                  </div>
                  <div className="q-row-date">
                    <span>{formatDate(s.createdAt)}</span>
                    {s.submittedBy && (
                      <span className="muted">
                        {s.submittedBy.name || s.submittedBy.email}
                      </span>
                    )}
                  </div>
                  <span className="q-row-chevron" aria-hidden="true">
                    {expanded ? "▾" : "▸"}
                  </span>
                </button>

                {/* ── Detail panel ── */}
                {expanded && (() => {
                  const pUrl = previewUrls[s.id];
                  const pMime = previewMimes[s.id];
                  const isImage = s.mimeType.startsWith("image/") && s.mimeType !== "image/tiff";
                  const isPdf = s.mimeType === "application/pdf";
                  const review = reviews[s.id];

                  return (
                    <div className="q-detail">
                      {/* Preview */}
                      {pUrl && (isImage || isPdf) && (
                        <div className="q-preview">
                          {isImage && pMime?.startsWith("image/") && (
                            <img src={pUrl} alt={s.title} className="q-preview-img" />
                          )}
                          {isPdf && (
                            <iframe src={pUrl} title={`Preview: ${s.title}`} className="q-preview-pdf" />
                          )}
                        </div>
                      )}

                      <div className="q-detail-grid">
                        {/* Left: info + validation + AI */}
                        <div className="q-detail-col">
                          {s.description && (
                            <p className="q-detail-desc">{s.description}</p>
                          )}
                          {s.reviewNote && (
                            <p className="q-detail-note">
                              <strong>Client-facing note:</strong> {s.reviewNote}
                            </p>
                          )}

                          {/* Validation */}
                          {vs && (
                            <div className="q-detail-validation">
                              <div className="q-detail-section-label">
                                Preflight {vs.passed ? "Passed" : "Failed"}
                              </div>
                              {vs.errors.length > 0 && (
                                <ul className="q-val-list warning">
                                  {vs.errors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                              )}
                              {vs.warnings.length > 0 && (
                                <ul className="q-val-list muted">
                                  {vs.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                              )}
                            </div>
                          )}

                          {/* AI Review */}
                          {review && (
                            <div className="q-ai-review">
                              <div className="q-ai-header">
                                <span className="q-ai-label">AI Review</span>
                                <span className={`q-ai-verdict q-ai-verdict-${review.verdict}`}>
                                  {review.verdict === "approve" ? "Approve" : review.verdict === "reject" ? "Reject" : "Revise"}
                                </span>
                              </div>
                              <p className="q-ai-summary">{review.summary}</p>
                              {review.issues.length > 0 && (
                                <>
                                  <div className="q-ai-section-label">Issues</div>
                                  <ul className="q-ai-issues">
                                    {review.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                  </ul>
                                </>
                              )}
                              {review.suggestions.length > 0 && (
                                <>
                                  <div className="q-ai-section-label">Suggestions</div>
                                  <ul className="q-ai-suggestions">
                                    {review.suggestions.map((sug, i) => <li key={i}>{sug}</li>)}
                                  </ul>
                                </>
                              )}
                              <p className="q-ai-next">
                                <strong>Next:</strong> {review.nextAction}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: workflow actions */}
                        <div className="q-detail-actions">
                          {/* ── Workflow buttons (context-sensitive) ── */}
                          <div className="q-wf-section">
                            <span className="q-wf-label">Workflow</span>

                            {/* Begin review */}
                            {(s.status === "UPLOADED" || s.status === "VALIDATION_FAILED") && (
                              <button
                                type="button"
                                className="btn primary"
                                disabled={busy}
                                onClick={() => transitionStatus(s, "UNDER_REVIEW")}
                              >
                                {busy ? "…" : "Begin review"}
                              </button>
                            )}

                            {/* Under review → approve or request changes */}
                            {s.status === "UNDER_REVIEW" && (
                              <>
                                <button
                                  type="button"
                                  className="btn primary"
                                  disabled={busy}
                                  onClick={() => transitionStatus(s, "READY_FOR_PUBLISHER")}
                                >
                                  {busy ? "…" : "Approve"}
                                </button>
                                <div className="q-wf-note-group">
                                  <textarea
                                    className="q-wf-textarea"
                                    placeholder="Feedback for client (optional)"
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={2}
                                    maxLength={2000}
                                  />
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    disabled={busy}
                                    onClick={() => {
                                      void transitionStatus(
                                        s,
                                        "NEEDS_RESIZING",
                                        noteText.trim() || null,
                                      );
                                      setNoteText("");
                                    }}
                                  >
                                    {busy ? "…" : "Request changes"}
                                  </button>
                                </div>
                              </>
                            )}

                            {/* Changes requested → back to review */}
                            {s.status === "NEEDS_RESIZING" && (
                              <button
                                type="button"
                                className="btn ghost"
                                disabled={busy}
                                onClick={() => transitionStatus(s, "UNDER_REVIEW")}
                              >
                                {busy ? "…" : "Resume review"}
                              </button>
                            )}

                            {/* Ready → send to publisher */}
                            {s.status === "READY_FOR_PUBLISHER" && (
                              <button
                                type="button"
                                className="btn primary"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(
                                    `Mark "${s.title}" as sent to publisher?\n\nThis records delivery — it does not send the file automatically.`,
                                  )) {
                                    void transitionStatus(s, "PUSHED");
                                  }
                                }}
                              >
                                {busy ? "…" : "Mark sent to publisher"}
                              </button>
                            )}

                            {/* Sent — completed */}
                            {s.status === "PUSHED" && (
                              <p className="q-wf-done">Delivered to publisher.</p>
                            )}
                          </div>

                          {/* ── Status override ── */}
                          <details className="q-status-override">
                            <summary className="small">Manual status override</summary>
                            <select
                              className="inline-select"
                              value={s.status}
                              disabled={busy}
                              onChange={(e) =>
                                transitionStatus(s, e.target.value as SubmissionStatus)
                              }
                            >
                              {ALL_STATUSES.map((st) => (
                                <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                              ))}
                            </select>
                          </details>

                          {/* ── Tools ── */}
                          <div className="q-action-buttons">
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={busy || reviewingId === s.id}
                              onClick={() => onAIReview(s)}
                            >
                              {reviewingId === s.id ? "Reviewing…" : review ? "Re-review" : "AI Review"}
                            </button>
                            <button
                              type="button"
                              className="btn danger ghost"
                              disabled={busy}
                              onClick={() => onDelete(s)}
                            >
                              {busy ? "…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

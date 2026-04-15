import { type FormEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type {
  Campaign,
  CreativeSubmission,
  CreativeType,
  SubmissionStatus,
  ValidationSummary,
} from "../types";

/* ── Constants ── */

const CREATIVE_TYPES: CreativeType[] = ["DIGITAL", "PRINT", "MASTER_ASSET"];

const CREATIVE_TYPE_LABEL: Record<CreativeType, string> = {
  DIGITAL: "Digital Display",
  PRINT: "Print-Ready",
  MASTER_ASSET: "Master / Source File",
};

const CREATIVE_TYPE_DESC: Record<CreativeType, string> = {
  DIGITAL:
    "Standard display ad — PNG, JPEG, or GIF. Max 5 MB. Must match a standard IAB size (300\u00d7250, 728\u00d790, 320\u00d750, or 300\u00d7600).",
  PRINT:
    "Print-ready file — PDF or TIFF. Confirm resolution (typically 300 DPI) and color space (typically CMYK) with your publisher.",
  MASTER_ASSET:
    "Original design files for your agency team — AI, EPS, SVG, PSD (as PDF), TIFF, PNG, JPEG, or ZIP. No dimension or format validation is applied.",
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  UPLOADED: "Submitted",
  VALIDATION_FAILED: "Needs Attention",
  UNDER_REVIEW: "Under Review",
  NEEDS_RESIZING: "Changes Requested",
  READY_FOR_PUBLISHER: "Approved",
  PUSHED: "Sent to Publisher",
};

const STATUS_DESC: Record<SubmissionStatus, string> = {
  UPLOADED: "Received — in queue for agency review. Nothing for you to do right now.",
  VALIDATION_FAILED: "Automated checks failed. Review the errors below, fix the file, and upload a new version.",
  UNDER_REVIEW: "Agency is reviewing. We'll reach out if anything needs to change.",
  NEEDS_RESIZING: "Changes required — read the agency note below, then upload a corrected version.",
  READY_FOR_PUBLISHER: "Approved. Scheduled to send to the publisher — no action needed from you.",
  PUSHED: "Sent to the publisher. This submission is closed.",
};

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  UPLOADED: "report-badge badge-pending",
  VALIDATION_FAILED: "report-badge badge-overdue",
  UNDER_REVIEW: "report-badge badge-pending",
  NEEDS_RESIZING: "report-badge badge-overdue",
  READY_FOR_PUBLISHER: "report-badge badge-paid",
  PUSHED: "report-badge badge-completed",
};

const ACCEPT_BY_TYPE: Record<CreativeType, string> = {
  DIGITAL: ".png,.jpg,.jpeg,.gif",
  PRINT: ".pdf,.tif,.tiff",
  MASTER_ASSET: ".pdf,.png,.jpg,.jpeg,.gif,.tif,.tiff,.svg,.eps,.ai,.zip",
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

/* ── Component ── */

export function CreativesPage() {
  const { session } = useAuth();
  const memberships = session!.memberships;

  const [selectedOrgId, setSelectedOrgId] = useState(
    () => memberships[0]?.organizationId ?? "",
  );

  /* ── campaign state ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campsLoading, setCampsLoading] = useState(true);
  const [campsError, setCampsError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  /* ── submissions state ── */
  const [subs, setSubs] = useState<CreativeSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── upload state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creativeType, setCreativeType] = useState<CreativeType>("DIGITAL");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ── last validation result ── */
  const [lastValidation, setLastValidation] =
    useState<ValidationSummary | null>(null);
  const [lastUploadType, setLastUploadType] = useState<CreativeType | null>(null);

  /* ── preview state ── */
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewMimes, setPreviewMimes] = useState<Record<string, string>>({});
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  /* ── download state ── */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /* ── load campaigns ── */
  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setCampsLoading(true);
    setCampsError(null);
    setCampaigns([]);
    setSelectedCampaignId("");
    api
      .fetchOrgCampaigns(selectedOrgId)
      .then((res) => {
        if (cancelled) return;
        setCampaigns(res.campaigns);
        setSelectedCampaignId(res.campaigns[0]?.id ?? "");
      })
      .catch((e) => {
        if (!cancelled)
          setCampsError(e instanceof ApiError ? e.message : "Failed to load campaigns");
      })
      .finally(() => {
        if (!cancelled) setCampsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedOrgId]);

  /* ── load submissions ── */
  useEffect(() => {
    if (!selectedCampaignId) { setSubs([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSubs([]);
    api
      .fetchCampaignSubmissions(selectedCampaignId)
      .then((res) => { if (!cancelled) setSubs(res.submissions); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load submissions");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCampaignId]);

  useEffect(() => {
    return () => { if (successTimer.current) clearTimeout(successTimer.current); };
  }, []);

  /* ── drag and drop ── */
  function onDragOver(e: DragEvent) { e.preventDefault(); setDragOver(true); }
  function onDragLeave() { setDragOver(false); }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (fileRef.current) {
        const dt = new DataTransfer();
        dt.items.add(dropped);
        fileRef.current.files = dt.files;
      }
    }
  }

  /* ── upload ── */
  const onUpload = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!file || !selectedCampaignId) return;
      setUploadError(null);
      setUploadSuccess(null);
      setLastValidation(null);
      setLastUploadType(creativeType);
      if (successTimer.current) clearTimeout(successTimer.current);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("title", title.trim());
        if (description.trim()) fd.append("description", description.trim());
        fd.append("creativeType", creativeType);
        fd.append("file", file);
        const result = await api.uploadSubmission(selectedCampaignId, fd);
        if (result.validationSummary) {
          setLastValidation(result.validationSummary as ValidationSummary);
        }
        const label =
          result.status === "VALIDATION_FAILED"
            ? `"${title.trim()}" was uploaded but did not pass validation.`
            : `"${title.trim()}" submitted successfully.`;
        setUploadSuccess(label);
        setTitle("");
        setDescription("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        successTimer.current = setTimeout(
          () => { setUploadSuccess(null); setLastValidation(null); setLastUploadType(null); },
          20000,
        );
        const res = await api.fetchCampaignSubmissions(selectedCampaignId);
        setSubs(res.submissions);
      } catch (err) {
        setUploadError(err instanceof ApiError ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [file, selectedCampaignId, title, description, creativeType],
  );

  /* ── preview ── */
  async function togglePreview(sub: CreativeSubmission) {
    if (expandedSubId === sub.id) { setExpandedSubId(null); return; }
    setExpandedSubId(sub.id);
    if (!previewUrls[sub.id]) {
      try {
        const res = await api.fetchSubmissionPreviewUrl(sub.id);
        if (res.previewable) {
          setPreviewUrls((p) => ({ ...p, [sub.id]: res.url }));
          setPreviewMimes((p) => ({ ...p, [sub.id]: res.mimeType }));
        }
      } catch { /* non-critical */ }
    }
  }

  /* ── download ── */
  async function download(sub: CreativeSubmission) {
    setDownloadingId(sub.id);
    setDownloadError(null);
    try {
      const { url } = await api.fetchSubmissionDownloadUrl(sub.id);
      const a = document.createElement("a");
      a.href = url; a.rel = "noopener"; a.style.display = "none";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  /* ── helpers ── */
  const canPreview = (mime: string) =>
    (mime.startsWith("image/") && mime !== "image/tiff") || mime === "application/pdf";

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Creatives</h1>
        <p className="welcome-body">
          Review your submissions, respond to agency feedback, and upload new files when you're ready.
        </p>

        {memberships.length > 1 && (
          <div className="org-selector">
            <label className="org-selector-label" htmlFor="creative-org-select">
              Organization
            </label>
            <select
              id="creative-org-select"
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

      {/* ── Campaign selector ── */}
      <section className="section-block">
        <h2 className="section-heading">Campaign</h2>
        {campsLoading && <p className="text-muted">Loading campaigns…</p>}
        {campsError && <p className="form-error" role="alert">{campsError}</p>}
        {!campsLoading && !campsError && campaigns.length === 0 && (
          <p className="text-muted">
            No campaigns available yet. Creative submissions open after a campaign is set up by your agency team.
          </p>
        )}
        {campaigns.length > 0 && (
          <div className="org-selector">
            <label className="org-selector-label" htmlFor="creative-campaign-select">
              Select campaign
            </label>
            <select
              id="creative-campaign-select"
              className="org-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Wrapper: CSS flips order so Submissions render before Upload */}
      <div className="cr-work-area">

      {/* ── Upload section (collapsible, secondary) ── */}
      {selectedCampaignId && (
        <section className="section-block cr-upload-section">
          <details className="cr-upload-disclosure">
            <summary className="cr-upload-summary">
              <span className="cr-upload-summary-label">+ Upload a new creative</span>
              <span className="cr-upload-summary-hint">Drag &amp; drop, preview, and submit</span>
            </summary>

          <form className="creative-form" onSubmit={onUpload}>
            {/* Creative type selector with contextual help */}
            <div className="field">
              <label htmlFor="creative-type">Creative type</label>
              <div className="cr-type-group">
                {CREATIVE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`cr-type-btn${creativeType === t ? " cr-type-active" : ""}`}
                    onClick={() => setCreativeType(t)}
                    disabled={uploading}
                  >
                    {CREATIVE_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <p className="cr-type-hint">{CREATIVE_TYPE_DESC[creativeType]}</p>
            </div>

            <div className="field">
              <label htmlFor="creative-title">Title</label>
              <input
                id="creative-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={255}
                placeholder={
                  creativeType === "DIGITAL"
                    ? "e.g. Homepage Banner — 728\u00d790"
                    : creativeType === "PRINT"
                      ? "e.g. Full Page Ad — Spring Issue"
                      : "e.g. Brand Logo — Master File"
                }
                disabled={uploading}
              />
            </div>
            <div className="field">
              <label htmlFor="creative-desc">Notes for reviewer (optional)</label>
              <input
                id="creative-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Placement details, version info, or special instructions"
                disabled={uploading}
              />
            </div>

            {/* Drop zone */}
            <div
              className={`cr-dropzone${dragOver ? " cr-dropzone-active" : ""}${file ? " cr-dropzone-has-file" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {file ? (
                <div className="cr-file-selected">
                  <span className="cr-file-name">{file.name}</span>
                  <span className="cr-file-size mono">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="cr-file-remove"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="cr-drop-prompt">
                  <span className="cr-drop-text">
                    Drag a file here or{" "}
                    <button
                      type="button"
                      className="cr-drop-browse"
                      onClick={() => fileRef.current?.click()}
                    >
                      browse
                    </button>
                  </span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_BY_TYPE[creativeType]}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </div>

            {/* Feedback */}
            {uploadError && <p className="form-error" role="alert">{uploadError}</p>}
            {uploadSuccess && (
              <p
                className={lastValidation && !lastValidation.passed ? "form-error" : "form-success"}
                role="status"
              >
                {uploadSuccess}
              </p>
            )}
            {lastValidation && lastUploadType !== "MASTER_ASSET" && (
              <div className="validation-summary">
                {lastValidation.errors.map((e, i) => (
                  <p key={i} className="cr-val-error">{e}</p>
                ))}
                {lastValidation.warnings.map((w, i) => (
                  <p key={i} className="cr-val-warn">{w}</p>
                ))}
                {lastValidation.metadata.widthPx != null &&
                  lastValidation.metadata.heightPx != null && (
                    <p className="validation-meta">
                      Detected: {lastValidation.metadata.widthPx} &times;{" "}
                      {lastValidation.metadata.heightPx}px
                    </p>
                  )}
              </div>
            )}
            <button
              type="submit"
              className="btn-submit"
              style={{ maxWidth: "16rem" }}
              disabled={uploading || !file}
            >
              {uploading ? "Uploading…" : "Submit creative"}
            </button>
          </form>
          </details>
        </section>
      )}

      {/* ── Submissions (primary: shows what exists + what needs action) ── */}
      {selectedCampaignId && (
        <section className="section-block cr-submissions-section">
          <div className="cr-submissions-head">
            <h2 className="section-heading zone-heading" style={{ margin: 0 }}>Your submissions</h2>
            {!loading && !error && subs.length > 0 && (() => {
              const needsAction = subs.filter(
                (s) => s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
              ).length;
              const inReview = subs.filter(
                (s) => s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
              ).length;
              const approved = subs.filter(
                (s) => s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED",
              ).length;
              return (
                <span className="cr-submissions-meta">
                  {subs.length} total
                  {needsAction > 0 && ` · ${needsAction} need your attention`}
                  {inReview > 0 && ` · ${inReview} in review`}
                  {approved > 0 && ` · ${approved} approved`}
                </span>
              );
            })()}
          </div>

          {loading && <p className="text-muted">Loading submissions…</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {downloadError && <p className="form-error" role="alert">{downloadError}</p>}

          {!loading && !error && subs.length === 0 && (
            <div className="cr-empty">
              <p className="cr-empty-text">
                No creatives yet for this campaign. Use the + Upload panel below to submit your first file.
              </p>
            </div>
          )}

          {!loading && subs.length > 0 && (() => {
            // Sort so action-needed rows surface first, then in-review, then approved.
            const priority: Record<SubmissionStatus, number> = {
              VALIDATION_FAILED: 0,
              NEEDS_RESIZING: 1,
              UPLOADED: 2,
              UNDER_REVIEW: 3,
              READY_FOR_PUBLISHER: 4,
              PUSHED: 5,
            };
            const sorted = [...subs].sort((a, b) => {
              const d = priority[a.status] - priority[b.status];
              if (d !== 0) return d;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            return (
            <ul className="cr-sub-list">
              {sorted.map((s) => {
                const vs = s.validationSummary as ValidationSummary | null;
                const expanded = expandedSubId === s.id;
                const pUrl = previewUrls[s.id];
                const pMime = previewMimes[s.id];
                const previewable = canPreview(s.mimeType);
                const isImage = s.mimeType.startsWith("image/") && s.mimeType !== "image/tiff";
                const isPdf = s.mimeType === "application/pdf";

                return (
                  <li key={s.id} className="cr-sub-card">
                    {/* Card header */}
                    <button
                      type="button"
                      className="cr-sub-header"
                      onClick={() => previewable ? togglePreview(s) : undefined}
                      aria-expanded={previewable ? expanded : undefined}
                      style={previewable ? undefined : { cursor: "default" }}
                    >
                      <div className="cr-sub-main">
                        <span className="cr-sub-title">{s.title}</span>
                        <span className="cr-sub-meta">
                          <span className="doc-type-badge">
                            {CREATIVE_TYPE_LABEL[s.creativeType]}
                          </span>
                          {s.widthPx != null && s.heightPx != null && (
                            <span className="mono">{s.widthPx}&times;{s.heightPx}</span>
                          )}
                          <span>{s.filename}</span>
                          <span className="mono">{formatBytes(s.sizeBytes)}</span>
                          <span className="mono">{formatDate(s.createdAt)}</span>
                        </span>
                      </div>
                      <div className="cr-sub-status-area">
                        <span className={STATUS_BADGE[s.status]}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <div className={`cr-sub-detail${expanded ? " cr-sub-detail-open" : ""}`}>
                      {/* Status explanation */}
                      <p className="cr-status-explain">{STATUS_DESC[s.status]}</p>

                      {/* Review note from agency */}
                      {s.reviewNote && (
                        <div className="cr-agency-note">
                          <span className="cr-agency-note-label">Agency feedback</span>
                          <p className="cr-agency-note-text">{s.reviewNote}</p>
                        </div>
                      )}

                      {/* Validation */}
                      {vs && s.creativeType !== "MASTER_ASSET" && (vs.errors.length > 0 || vs.warnings.length > 0) && (
                        <div className="cr-val-block">
                          <span className="cr-val-label">
                            Preflight check — {vs.passed ? "passed with notes" : "issues found"}
                          </span>
                          {vs.errors.map((e, i) => (
                            <p key={i} className="cr-val-error">{e}</p>
                          ))}
                          {vs.warnings.map((w, i) => (
                            <p key={i} className="cr-val-warn">{w}</p>
                          ))}
                        </div>
                      )}

                      {/* Preview */}
                      {pUrl && (
                        <div className="sub-preview">
                          {isImage && pMime?.startsWith("image/") && (
                            <img src={pUrl} alt={s.title} className="sub-preview-img" />
                          )}
                          {isPdf && (
                            <iframe src={pUrl} title={`Preview: ${s.title}`} className="sub-preview-pdf" />
                          )}
                        </div>
                      )}
                      {expanded && !pUrl && !previewable && (
                        <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                          Browser preview is not available for this file type.
                        </p>
                      )}

                      {/* Actions */}
                      <div className="cr-sub-actions">
                        <button
                          type="button"
                          className="doc-download"
                          disabled={downloadingId === s.id}
                          onClick={() => download(s)}
                        >
                          {downloadingId === s.id ? "Preparing…" : "Download file"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            );
          })()}
        </section>
      )}

      </div>
    </>
  );
}

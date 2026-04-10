import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
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

const CREATIVE_TYPES: CreativeType[] = ["DIGITAL", "PRINT", "MASTER_ASSET"];

const CREATIVE_TYPE_LABEL: Record<CreativeType, string> = {
  DIGITAL: "Digital",
  PRINT: "Print",
  MASTER_ASSET: "Master Asset",
};

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  UPLOADED: "Uploaded",
  VALIDATION_FAILED: "Validation Failed",
  UNDER_REVIEW: "Under Review",
  NEEDS_RESIZING: "Needs Resizing",
  READY_FOR_PUBLISHER: "Ready for Publisher",
  PUSHED: "Pushed",
};

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  UPLOADED: "report-badge badge-pending",
  VALIDATION_FAILED: "report-badge badge-overdue",
  UNDER_REVIEW: "report-badge badge-pending",
  NEEDS_RESIZING: "report-badge badge-overdue",
  READY_FOR_PUBLISHER: "report-badge badge-paid",
  PUSHED: "report-badge badge-paid",
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
  const fileRef = useRef<HTMLInputElement>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ── last validation result ── */
  const [lastValidation, setLastValidation] =
    useState<ValidationSummary | null>(null);

  /* ── download state ── */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /* ── load campaigns when org changes ── */
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
          setCampsError(
            e instanceof ApiError
              ? e.message
              : "Failed to load campaigns",
          );
      })
      .finally(() => {
        if (!cancelled) setCampsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  /* ── load submissions when campaign changes ── */
  useEffect(() => {
    if (!selectedCampaignId) {
      setSubs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSubs([]);
    api
      .fetchCampaignSubmissions(selectedCampaignId)
      .then((res) => {
        if (!cancelled) setSubs(res.submissions);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError
              ? e.message
              : "Failed to load submissions",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  /* ── clear success timer on unmount ── */
  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  /* ── upload handler ── */
  const onUpload = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!file || !selectedCampaignId) return;
      setUploadError(null);
      setUploadSuccess(null);
      setLastValidation(null);
      if (successTimer.current) clearTimeout(successTimer.current);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("title", title.trim());
        if (description.trim())
          fd.append("description", description.trim());
        fd.append("creativeType", creativeType);
        fd.append("file", file);
        const result = await api.uploadSubmission(selectedCampaignId, fd);
        if (result.validationSummary) {
          setLastValidation(result.validationSummary as ValidationSummary);
        }
        const label =
          result.status === "VALIDATION_FAILED"
            ? `"${title.trim()}" uploaded but failed validation.`
            : `"${title.trim()}" submitted successfully.`;
        setUploadSuccess(label);
        setTitle("");
        setDescription("");
        setCreativeType("DIGITAL");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        successTimer.current = setTimeout(
          () => { setUploadSuccess(null); setLastValidation(null); },
          15000,
        );
        const res = await api.fetchCampaignSubmissions(selectedCampaignId);
        setSubs(res.submissions);
      } catch (err) {
        setUploadError(
          err instanceof ApiError ? err.message : "Upload failed",
        );
      } finally {
        setUploading(false);
      }
    },
    [file, selectedCampaignId, title, description, creativeType],
  );

  /* ── download handler ── */
  async function download(sub: CreativeSubmission) {
    setDownloadingId(sub.id);
    setDownloadError(null);
    try {
      const { url } = await api.fetchSubmissionDownloadUrl(sub.id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setDownloadError(
        err instanceof ApiError ? err.message : "Download failed",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Creatives</h1>
        <p className="welcome-body">
          Submit creative assets for your campaigns. Your Dempsey Agency
          team will review submissions and provide feedback.
        </p>

        {memberships.length > 1 && (
          <div className="org-selector">
            <label
              className="org-selector-label"
              htmlFor="creative-org-select"
            >
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

      <section className="section-block">
        <h2 className="section-heading">Campaign</h2>

        {campsLoading && (
          <p className="text-muted">Loading campaigns…</p>
        )}

        {campsError && (
          <p className="form-error" role="alert">
            {campsError}
          </p>
        )}

        {!campsLoading && !campsError && campaigns.length === 0 && (
          <p className="text-muted">
            No campaigns are available for this organization yet. Creative
            submissions become available after a campaign has been set up.
          </p>
        )}

        {campaigns.length > 0 && (
          <div className="org-selector">
            <label
              className="org-selector-label"
              htmlFor="creative-campaign-select"
            >
              Select campaign
            </label>
            <select
              id="creative-campaign-select"
              className="org-select"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ── Upload form ── */}
      {selectedCampaignId && (
        <section className="section-block">
          <h2 className="section-heading">Submit Creative</h2>
          <form className="creative-form" onSubmit={onUpload}>
            <div className="field">
              <label htmlFor="creative-title">Title</label>
              <input
                id="creative-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={255}
                placeholder="e.g. Homepage Banner — 728x90"
                disabled={uploading}
              />
            </div>
            <div className="field">
              <label htmlFor="creative-desc">Description (optional)</label>
              <input
                id="creative-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Notes about this creative"
                disabled={uploading}
              />
            </div>
            <div className="field">
              <label htmlFor="creative-type">Creative type</label>
              <select
                id="creative-type"
                className="org-select"
                value={creativeType}
                onChange={(e) =>
                  setCreativeType(e.target.value as CreativeType)
                }
                disabled={uploading}
              >
                {CREATIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CREATIVE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="creative-file">File</label>
              <input
                id="creative-file"
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                disabled={uploading}
              />
            </div>
            {uploadError && (
              <p className="form-error" role="alert">
                {uploadError}
              </p>
            )}
            {uploadSuccess && (
              <p
                className={
                  lastValidation && !lastValidation.passed
                    ? "form-error"
                    : "form-success"
                }
                role="status"
              >
                {uploadSuccess}
              </p>
            )}
            {lastValidation && (
              <div className="validation-summary">
                {lastValidation.errors.length > 0 && (
                  <ul className="validation-errors">
                    {lastValidation.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
                {lastValidation.warnings.length > 0 && (
                  <ul className="validation-warnings">
                    {lastValidation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
                {lastValidation.metadata.widthPx != null &&
                  lastValidation.metadata.heightPx != null && (
                    <p className="validation-meta">
                      Detected: {lastValidation.metadata.widthPx}×
                      {lastValidation.metadata.heightPx}px
                    </p>
                  )}
              </div>
            )}
            <button
              type="submit"
              className="btn-submit"
              style={{ maxWidth: "16rem" }}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Submit creative"}
            </button>
          </form>
        </section>
      )}

      {/* ── Submissions list ── */}
      {selectedCampaignId && (
        <section className="section-block">
          <h2 className="section-heading">Submissions</h2>

          {loading && (
            <p className="text-muted">Loading submissions…</p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {downloadError && (
            <p className="form-error" role="alert">
              {downloadError}
            </p>
          )}

          {!loading && !error && subs.length === 0 && (
            <p className="text-muted">
              No creatives have been submitted for this campaign yet.
            </p>
          )}

          {!loading && subs.length > 0 && (
            <ul className="report-list">
              {subs.map((s) => (
                <li key={s.id} className="report-item">
                  <div className="report-info">
                    <span className="report-name">{s.title}</span>
                    {s.description && (
                      <span className="report-description">
                        {s.description}
                      </span>
                    )}
                    {s.reviewNote && (
                      <div className="review-note">{s.reviewNote}</div>
                    )}
                    <div className="submission-meta">
                      <span className="doc-type-badge">
                        {CREATIVE_TYPE_LABEL[s.creativeType] ?? s.creativeType}
                      </span>
                      {s.widthPx != null && s.heightPx != null && (
                        <span>{s.widthPx}×{s.heightPx}px</span>
                      )}
                      <span>
                        {s.filename} &middot; {formatBytes(s.sizeBytes)}{" "}
                        &middot; {formatDate(s.createdAt)}
                      </span>
                    </div>
                    {s.validationSummary &&
                      !(s.validationSummary as ValidationSummary).passed && (
                        <ul className="validation-errors" style={{ margin: "0.25rem 0 0" }}>
                          {(s.validationSummary as ValidationSummary).errors.map(
                            (e, i) => <li key={i}>{e}</li>,
                          )}
                        </ul>
                      )}
                    {s.validationSummary &&
                      (s.validationSummary as ValidationSummary).warnings.length > 0 && (
                        <ul className="validation-warnings" style={{ margin: "0.25rem 0 0" }}>
                          {(s.validationSummary as ValidationSummary).warnings.map(
                            (w, i) => <li key={i}>{w}</li>,
                          )}
                        </ul>
                      )}
                  </div>
                  <div className="submission-actions">
                    <span className={STATUS_BADGE[s.status]}>
                      {STATUS_LABEL[s.status]}
                    </span>
                    <button
                      type="button"
                      className="doc-download"
                      disabled={downloadingId === s.id}
                      onClick={() => download(s)}
                    >
                      {downloadingId === s.id ? "Preparing…" : "Download"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

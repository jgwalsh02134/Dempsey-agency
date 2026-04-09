import { type FormEvent, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type {
  Campaign,
  CreativeSubmission,
  CreativeType,
  SubmissionStatus,
} from "../types";

const CREATIVE_TYPES: CreativeType[] = ["PRINT", "DIGITAL"];

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
};

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  SUBMITTED: "report-badge badge-pending",
  APPROVED: "report-badge badge-paid",
  REVISION_REQUESTED: "report-badge badge-overdue",
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

  /* ── download state ── */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /* ── load campaigns when org changes ── */
  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setCampsLoading(true);
    setCampaigns([]);
    setSelectedCampaignId("");
    api
      .fetchOrgCampaigns(selectedOrgId)
      .then((res) => {
        if (cancelled) return;
        setCampaigns(res.campaigns);
        setSelectedCampaignId(res.campaigns[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
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

  /* ── upload handler ── */
  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !selectedCampaignId) return;
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("creativeType", creativeType);
      fd.append("file", file);
      await api.uploadSubmission(selectedCampaignId, fd);
      setUploadSuccess(`"${title.trim()}" submitted.`);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      const res = await api.fetchCampaignSubmissions(selectedCampaignId);
      setSubs(res.submissions);
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  /* ── download handler ── */
  async function download(sub: CreativeSubmission) {
    setDownloadingId(sub.id);
    try {
      const { url } = await api.fetchSubmissionDownloadUrl(sub.id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* download errors are non-critical */
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

        {!campsLoading && campaigns.length === 0 && (
          <p className="text-muted">
            No campaigns are available for this organization yet.
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
              >
                {CREATIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "PRINT" ? "Print" : "Digital"}
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
              />
            </div>
            {uploadError && (
              <p className="form-error" role="alert">
                {uploadError}
              </p>
            )}
            {uploadSuccess && (
              <p className="text-muted">{uploadSuccess}</p>
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
                      <span className="report-description">
                        <strong>Review note:</strong> {s.reviewNote}
                      </span>
                    )}
                    <div className="submission-meta">
                      <span className="doc-type-badge">
                        {s.creativeType}
                      </span>
                      <span>
                        {s.filename} &middot; {formatBytes(s.sizeBytes)}{" "}
                        &middot; {formatDate(s.createdAt)}
                      </span>
                    </div>
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

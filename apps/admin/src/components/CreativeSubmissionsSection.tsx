import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  Campaign,
  CreativeSubmission,
  CreativeType,
  SubmissionStatus,
} from "../types";

const CREATIVE_TYPES: CreativeType[] = ["PRINT", "DIGITAL"];
const STATUSES: SubmissionStatus[] = [
  "SUBMITTED",
  "APPROVED",
  "REVISION_REQUESTED",
];

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

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function CreativeSubmissionsSection({ orgId }: { orgId: string }) {
  /* ── campaign selector state ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campsLoading, setCampsLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  /* ── submissions list state ── */
  const [subs, setSubs] = useState<CreativeSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  /* ── upload state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creativeType, setCreativeType] = useState<CreativeType>("DIGITAL");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── action state ── */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ── load campaigns for org ── */
  useEffect(() => {
    let cancelled = false;
    setCampsLoading(true);
    api
      .fetchOrgCampaigns(orgId)
      .then((res) => {
        if (cancelled) return;
        setCampaigns(res.campaigns);
        setSelectedCampaignId((prev) => {
          if (prev && res.campaigns.some((c) => c.id === prev)) return prev;
          return res.campaigns[0]?.id ?? "";
        });
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
  }, [orgId]);

  /* ── load submissions for selected campaign ── */
  const loadSubmissions = useCallback(async () => {
    if (!selectedCampaignId) {
      setSubs([]);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchCampaignSubmissions(selectedCampaignId);
      setSubs(res.submissions);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

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
      setUploadSuccess(`"${title.trim()}" uploaded.`);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      void loadSubmissions();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  /* ── status change handler ── */
  async function onStatusChange(
    sub: CreativeSubmission,
    newStatus: SubmissionStatus,
  ) {
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
            ? {
                ...s,
                status: newStatus,
                ...(reviewNote !== undefined
                  ? { reviewNote }
                  : {}),
              }
            : s,
        ),
      );
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  /* ── delete handler ── */
  async function onDelete(sub: CreativeSubmission) {
    if (!window.confirm(`Delete "${sub.title}"? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    setBusyId(sub.id);
    try {
      await api.deleteSubmission(sub.id);
      setSubs((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Creative Submissions</h2>
      <p className="muted">
        Organization <code>{orgId}</code>
      </p>

      {/* ── Campaign selector ── */}
      {campsLoading && <p className="muted">Loading campaigns…</p>}
      {!campsLoading && campaigns.length === 0 && (
        <p className="muted">No campaigns found. Create a campaign first.</p>
      )}
      {campaigns.length > 0 && (
        <label className="field">
          <span>Campaign</span>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.status})
              </option>
            ))}
          </select>
        </label>
      )}

      {/* ── Upload form ── */}
      {selectedCampaignId && (
        <>
          <h3 className="h3-spaced">Upload creative</h3>
          <form onSubmit={onUpload} className="stack">
            <label className="field">
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={255}
                placeholder="e.g. Homepage Banner — 728x90"
              />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                placeholder="Notes about this creative"
              />
            </label>
            <label className="field">
              <span>Creative type</span>
              <select
                value={creativeType}
                onChange={(e) =>
                  setCreativeType(e.target.value as CreativeType)
                }
              >
                {CREATIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>File</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <span>PDF, PNG, JPEG, GIF — max 50 MB</span>
            </label>
            {uploadError && (
              <p className="error" role="alert">
                {uploadError}
              </p>
            )}
            {uploadSuccess && (
              <p className="success" role="status">
                {uploadSuccess}
              </p>
            )}
            <button
              type="submit"
              className="btn primary"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload creative"}
            </button>
          </form>
        </>
      )}

      {/* ── Submissions list ── */}
      {selectedCampaignId && (
        <>
          <h3 className="h3-spaced">Submissions</h3>
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
          {!loading && subs.length === 0 && !listError && (
            <p className="muted">No submissions yet.</p>
          )}
          {!loading && subs.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
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
                          <span className="small warning">
                            Note: {s.reviewNote}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="type-badge">{s.creativeType}</span>
                      </td>
                      <td>
                        <code className="small">{s.filename}</code>
                        <br />
                        <span className="small">
                          {formatBytes(s.sizeBytes)}
                        </span>
                      </td>
                      <td>
                        <select
                          className="inline-select"
                          value={s.status}
                          disabled={busyId === s.id}
                          onChange={(e) =>
                            onStatusChange(
                              s,
                              e.target.value as SubmissionStatus,
                            )
                          }
                        >
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
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
                      <td>
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
        </>
      )}
    </section>
  );
}

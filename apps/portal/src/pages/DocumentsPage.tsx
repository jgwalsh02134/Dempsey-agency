import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type { Document, DocumentCategory } from "../types";

/** Client-friendly labels for document categories. Invoices are intentionally
 *  ordered first so billing items surface above planning artifacts. */
const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  INVOICE: "Invoices",
  PROOF: "Proofs",
  INSERTION_ORDER: "Insertion Orders",
  CONTRACT: "Contracts",
  CREATIVE_ASSET: "Creative Assets",
  OTHER: "Other",
};
const CATEGORY_ORDER: DocumentCategory[] = [
  "INVOICE",
  "PROOF",
  "INSERTION_ORDER",
  "CONTRACT",
  "CREATIVE_ASSET",
  "OTHER",
];

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

function mimeLabel(mime: string): string {
  return MIME_LABELS[mime] ?? mime;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentsPage() {
  const { session } = useAuth();
  const memberships = session!.memberships;

  const [selectedOrgId, setSelectedOrgId] = useState(
    () => memberships[0]?.organizationId ?? "",
  );

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDocs([]);
    api
      .fetchOrgDocuments(selectedOrgId)
      .then((res) => {
        if (!cancelled) setDocs(res.documents);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError ? e.message : "Failed to load documents",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  async function download(doc: Document) {
    setDownloadingId(doc.id);
    setDownloadError(null);
    try {
      const { url } = await api.fetchDocumentDownloadUrl(doc.id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setDownloadError(
        e instanceof ApiError ? e.message : "Download failed",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Documents</h1>
        <p className="welcome-body">
          Campaign files, media plans, and shared deliverables from your
          Dempsey Agency team.
        </p>

        {memberships.length > 1 && (
          <div className="org-selector">
            <label
              className="org-selector-label"
              htmlFor="doc-org-select"
            >
              Organization
            </label>
            <select
              id="doc-org-select"
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
        <h2 className="section-heading">Document Library</h2>

        {loading && (
          <p className="text-muted">Loading documents…</p>
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

        {!loading && !error && docs.length === 0 && (
          <p className="text-muted">
            No documents have been shared with your organization yet.
            Check back soon.
          </p>
        )}

        {!loading && docs.length > 0 && (
          <GroupedDocs
            docs={docs}
            downloadingId={downloadingId}
            onDownload={download}
          />
        )}
      </section>
    </>
  );
}

interface GroupedDocsProps {
  docs: Document[];
  downloadingId: string | null;
  onDownload: (doc: Document) => void;
}

function GroupedDocs({ docs, downloadingId, onDownload }: GroupedDocsProps) {
  const grouped = useMemo(() => {
    const map = new Map<DocumentCategory, Document[]>();
    for (const d of docs) {
      const key = (d.category ?? "OTHER") as DocumentCategory;
      const bucket = map.get(key);
      if (bucket) bucket.push(d);
      else map.set(key, [d]);
    }
    // Render in canonical order; skip empty buckets.
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      docs: map.get(c)!,
    }));
  }, [docs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {grouped.map((g) => (
        <div key={g.category}>
          <h3
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {CATEGORY_LABEL[g.category]}{" "}
            <span
              className="text-muted"
              style={{ fontWeight: 500, fontSize: "0.85rem" }}
            >
              ({g.docs.length})
            </span>
          </h3>
          <ul className="report-list">
            {g.docs.map((doc) => (
              <li key={doc.id} className="report-item">
                <div className="report-info">
                  <span className="report-name">{doc.title}</span>
                  {doc.description && (
                    <span className="report-description">
                      {doc.description}
                    </span>
                  )}
                  <div className="doc-meta">
                    <span className="doc-type-badge">
                      {mimeLabel(doc.mimeType)}
                    </span>
                    <span>
                      {doc.filename} &middot;{" "}
                      <span className="mono">{formatBytes(doc.sizeBytes)}</span>{" "}
                      &middot;{" "}
                      <span className="mono">{formatDate(doc.createdAt)}</span>
                      {doc.uploadedBy?.name && (
                        <> &middot; from {doc.uploadedBy.name}</>
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="doc-download"
                  disabled={downloadingId === doc.id}
                  onClick={() => onDownload(doc)}
                >
                  {downloadingId === doc.id ? "Preparing…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

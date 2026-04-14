import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Document, DocumentCategory } from "../types";

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "PROOF", label: "Proof" },
  { value: "INVOICE", label: "Invoice" },
  { value: "INSERTION_ORDER", label: "Insertion Order" },
  { value: "CONTRACT", label: "Contract" },
  { value: "CREATIVE_ASSET", label: "Creative Asset" },
  { value: "OTHER", label: "Other" },
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

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function DocumentsSection({ orgId }: { orgId: string }) {
  /* ── list state ── */
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── upload state ── */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("OTHER");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── delete state ── */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── inline category edit state ── */
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  /* ── load documents ── */
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchOrgDocuments(orgId);
      setDocs(res.documents);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  /* ── upload handler ── */
  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      if (description.trim()) fd.append("description", description.trim());
      fd.append("category", category);
      fd.append("file", file);
      await api.uploadDocument(orgId, fd);
      setUploadSuccess(`"${title.trim()}" uploaded.`);
      setTitle("");
      setDescription("");
      setCategory("OTHER");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      void loadDocuments();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  /* ── inline category change ── */
  async function onCategoryChange(doc: Document, next: DocumentCategory) {
    if (doc.category === next) return;
    setCategoryError(null);
    setSavingCategoryId(doc.id);
    try {
      const updated = await api.patchDocument(doc.id, { category: next });
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
    } catch (e) {
      setCategoryError(errorMessage(e));
    } finally {
      setSavingCategoryId(null);
    }
  }

  /* ── delete handler ── */
  async function onDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
      return;
    }
    setDeleteError(null);
    setDeletingId(doc.id);
    try {
      await api.deleteDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card">
      <h2>Documents</h2>
      <p className="muted">
        Organization <code>{orgId}</code>
      </p>

      {/* ── Upload form ── */}
      <h3 className="h3-spaced">Upload document</h3>
      <form onSubmit={onUpload} className="stack">
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            placeholder="e.g. Q2 Media Plan"
          />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Brief summary of the document"
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as DocumentCategory)
            }
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>File</span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <span>PDF, PNG, JPEG, DOC, DOCX, XLS, XLSX — max 50 MB</span>
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
        <button type="submit" className="btn primary" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload document"}
        </button>
      </form>

      {/* ── Document list ── */}
      <h3 className="h3-spaced">Uploaded documents</h3>
      {loading && <p className="muted">Loading…</p>}
      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}
      {deleteError && (
        <p className="error" role="alert">
          {deleteError}
        </p>
      )}
      {categoryError && (
        <p className="error" role="alert">
          {categoryError}
        </p>
      )}
      {!loading && docs.length === 0 && !listError && (
        <p className="muted">No documents yet.</p>
      )}
      {!loading && docs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div>{doc.title}</div>
                    {doc.description && (
                      <span className="small">{doc.description}</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={doc.category ?? "OTHER"}
                      disabled={savingCategoryId === doc.id}
                      onChange={(e) =>
                        onCategoryChange(
                          doc,
                          e.target.value as DocumentCategory,
                        )
                      }
                      aria-label={`Category for ${doc.title}`}
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {savingCategoryId === doc.id && (
                      <span className="small muted"> saving…</span>
                    )}
                  </td>
                  <td>
                    <code className="small">{doc.filename}</code>
                  </td>
                  <td>
                    <span className="type-badge">{mimeLabel(doc.mimeType)}</span>
                  </td>
                  <td>{formatBytes(doc.sizeBytes)}</td>
                  <td>
                    <div>{formatDate(doc.createdAt)}</div>
                    {doc.uploadedBy && (
                      <span className="small">
                        {doc.uploadedBy.name || doc.uploadedBy.email}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn danger ghost"
                      disabled={deletingId === doc.id}
                      onClick={() => onDelete(doc)}
                    >
                      {deletingId === doc.id ? "Deleting…" : "Delete"}
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

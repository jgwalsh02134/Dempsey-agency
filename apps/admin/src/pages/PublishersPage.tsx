import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { parseCsvToObjects } from "../lib/csv";
import type { Publisher, PublisherImportResult } from "../types";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/**
 * Canonical CSV column set — grouped by the six publisher categories and
 * strictly separated: URL fields and email fields never share a column.
 */
const IMPORT_COLUMNS = [
  // Identity
  "name",
  "parentCompany",
  "publicationType",
  "frequency",
  "circulation",
  "yearEstablished",
  // Location
  "streetAddress",
  "streetAddress2",
  "city",
  "state",
  "zipCode",
  "county",
  "country",
  // Contacts
  "phone",
  "officeHours",
  "contactName",
  "contactTitle",
  // Website / reference links (URLs)
  "websiteUrl",
  "rateCardUrl",
  "mediaKitUrl",
  "adSpecsUrl",
  // Emails
  "generalEmail",
  "advertisingEmail",
  "editorialEmail",
  "billingEmail",
  "transactionEmail",
  "corporateEmail",
  // Other
  "notes",
] as const;

const NUMERIC_COLUMNS = new Set(["circulation", "yearEstablished"]);

function csvTemplateString(): string {
  const header = IMPORT_COLUMNS.join(",");
  const example = [
    // Identity
    "Boston Globe",
    "Boston Globe Media",
    "Broadsheet",
    "Daily",
    "250000",
    "1872",
    // Location
    "1 Exchange Pl",
    "Suite 100",
    "Boston",
    "MA",
    "02109",
    "Suffolk",
    "USA",
    // Contacts
    "617-555-1000",
    "Mon–Fri 9–5",
    "Ada Lovelace",
    "Advertising Director",
    // URLs
    "https://www.bostonglobe.com",
    "https://www.bostonglobe.com/rate-card.pdf",
    "https://www.bostonglobe.com/media-kit.pdf",
    "https://www.bostonglobe.com/ad-specs.pdf",
    // Emails
    "info@bostonglobe.com",
    "ads@bostonglobe.com",
    "editor@bostonglobe.com",
    "billing@bostonglobe.com",
    "transactions@bostonglobe.com",
    "corporate@bostonglobe.com",
    // Other
    "",
  ]
    .map((v) => (v.includes(",") ? `"${v}"` : v))
    .join(",");
  return `${header}\n${example}\n`;
}

function rowToPayload(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of IMPORT_COLUMNS) {
    const raw = row[col];
    if (raw == null) continue;
    const v = raw.trim();
    if (v.length === 0) continue;
    if (NUMERIC_COLUMNS.has(col)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[col] = Math.trunc(n);
    } else {
      out[col] = v;
    }
  }
  return out;
}

export function PublishersPage() {
  /* ── list state ── */
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── filters ── */
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  /* ── import panel ── */
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<
    Record<string, string>[]
  >([]);
  const [importFilename, setImportFilename] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<
    PublisherImportResult | null
  >(null);

  const loadPublishers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchPublishers();
      setPublishers(res.publishers);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublishers();
  }, [loadPublishers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publishers.filter((p) => {
      if (activeFilter === "true" && !p.isActive) return false;
      if (activeFilter === "false" && p.isActive) return false;
      if (q.length === 0) return true;
      const haystack = [
        p.name,
        p.city,
        p.state,
        p.county,
        p.country,
        p.parentCompany,
        p.publicationType,
        p.generalEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [publishers, search, activeFilter]);

  const activeCount = publishers.filter((p) => p.isActive).length;

  /* ── CSV import handlers ── */
  function openImport() {
    setImportOpen(true);
    setImportHeaders([]);
    setImportPreview([]);
    setImportFilename("");
    setImportError(null);
    setImportResult(null);
  }

  function closeImport() {
    setImportOpen(false);
    setImportHeaders([]);
    setImportPreview([]);
    setImportFilename("");
    setImportError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const { headers, rows } = parseCsvToObjects(text);
      if (rows.length === 0) {
        setImportError("CSV has no data rows.");
        setImportHeaders([]);
        setImportPreview([]);
        setImportFilename(file.name);
        return;
      }
      if (!headers.includes("name")) {
        setImportError(
          "Missing required column: 'name'. Download the template below.",
        );
      }
      setImportHeaders(headers);
      setImportPreview(rows);
      setImportFilename(file.name);
    } catch (err) {
      setImportError(errorMessage(err));
    }
  }

  async function onRunImport() {
    if (importPreview.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const payload = importPreview.map(rowToPayload);
      const res = await api.importPublishers(payload);
      setImportResult(res);
      void loadPublishers();
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplateString()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "publishers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Publishers</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {publishers.length} publisher{publishers.length !== 1 ? "s" : ""}
              {activeCount > 0 && ` · ${activeCount} active`}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn ghost"
            onClick={loadPublishers}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {!importOpen && (
            <button
              type="button"
              className="btn ghost"
              onClick={openImport}
              disabled={loading}
            >
              Import CSV
            </button>
          )}
          <Link to="/publishers/new" className="btn primary">
            + New Publisher
          </Link>
        </div>
      </div>

      {/* ── Import panel ── */}
      {importOpen && (
        <section
          className="card"
          style={{ marginBottom: "1rem" }}
          aria-label="Import publishers CSV"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.75rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
              Import publishers from CSV
            </h2>
            <button
              type="button"
              className="btn ghost"
              onClick={closeImport}
              disabled={importing}
            >
              Close
            </button>
          </div>

          <p className="muted small" style={{ marginTop: 0 }}>
            CSV must include a <code>name</code> column. Supported columns:{" "}
            {IMPORT_COLUMNS.join(", ")}. Duplicates are matched on
            case-insensitive name + city + state and updated in place. URL
            fields and email fields are kept strictly separate.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
              margin: "0.5rem 0 0.75rem",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={downloadTemplate}
            >
              Download template
            </button>
            {importFilename && (
              <span className="muted small">{importFilename}</span>
            )}
          </div>

          {importError && (
            <p className="error" role="alert">
              {importError}
            </p>
          )}

          {importPreview.length > 0 && !importResult && (
            <>
              <p className="small">
                <strong>{importPreview.length}</strong> row
                {importPreview.length !== 1 ? "s" : ""} detected. Preview
                (first 10):
              </p>
              <div className="table-wrap" style={{ maxHeight: "14rem" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {importHeaders.map((h) => (
                        <th
                          key={h}
                          style={{
                            color: IMPORT_COLUMNS.includes(
                              h as (typeof IMPORT_COLUMNS)[number],
                            )
                              ? undefined
                              : "var(--color-secondary, #888)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {importHeaders.map((h) => (
                          <td key={h} className="small">
                            {row[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}
              >
                <button
                  type="button"
                  className="btn primary"
                  onClick={onRunImport}
                  disabled={importing}
                >
                  {importing
                    ? "Importing…"
                    : `Import ${importPreview.length} rows`}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setImportHeaders([]);
                    setImportPreview([]);
                    setImportFilename("");
                    if (fileInputRef.current)
                      fileInputRef.current.value = "";
                  }}
                  disabled={importing}
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {importResult && (
            <div style={{ marginTop: "0.75rem" }}>
              <p className="success" role="status">
                Import complete. {importResult.created} created ·{" "}
                {importResult.updated} updated · {importResult.skipped}{" "}
                skipped (of {importResult.total}).
              </p>
              {importResult.errors.length > 0 && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary className="small">
                    {importResult.errors.length} row error
                    {importResult.errors.length !== 1 ? "s" : ""}
                  </summary>
                  <ul className="small" style={{ marginTop: "0.5rem" }}>
                    {importResult.errors.slice(0, 50).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                    {importResult.errors.length > 50 && (
                      <li>… and {importResult.errors.length - 50} more</li>
                    )}
                  </ul>
                </details>
              )}
              <div
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}
              >
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeImport}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Filters ── */}
      <div className="q-filters">
        <label className="q-filter-field">
          <span className="small">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, city, state, parent, type…"
          />
        </label>
        <label className="q-filter-field">
          <span className="small">Status</span>
          <select
            value={activeFilter}
            onChange={(e) =>
              setActiveFilter(e.target.value as "" | "true" | "false")
            }
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}

      {loading && <p className="muted">Loading publishers…</p>}

      {!loading && filtered.length === 0 && !listError && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {publishers.length === 0
            ? "No publishers yet. Create one or import a CSV."
            : "No publishers match the current filters."}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Type</th>
                <th>Frequency</th>
                <th>Circulation</th>
                <th>Email</th>
                <th>Website</th>
                <th>Inventory</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const location = [p.city, p.state].filter(Boolean).join(", ");
                return (
                  <tr
                    key={p.id}
                    style={p.isActive ? undefined : { opacity: 0.55 }}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        <Link
                          to={`/publishers/${p.id}`}
                          style={{ color: "inherit", textDecoration: "none" }}
                        >
                          {p.name}
                        </Link>
                      </div>
                      {p.parentCompany && (
                        <span className="small muted">{p.parentCompany}</span>
                      )}
                    </td>
                    <td className="small">{location || "—"}</td>
                    <td className="small">{p.publicationType ?? "—"}</td>
                    <td className="small">{p.frequency ?? "—"}</td>
                    <td className="small" style={{ whiteSpace: "nowrap" }}>
                      {p.circulation != null
                        ? p.circulation.toLocaleString()
                        : "—"}
                    </td>
                    <td className="small">
                      {p.generalEmail ? (
                        <a href={`mailto:${p.generalEmail}`}>
                          {p.generalEmail}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="small">
                      {p.websiteUrl ? (
                        <a
                          href={p.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {p.websiteUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="small">{p._count?.inventory ?? 0}</td>
                    <td className="small">
                      {p.isActive ? "Active" : "Inactive"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link
                        to={`/publishers/${p.id}`}
                        className="btn ghost"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

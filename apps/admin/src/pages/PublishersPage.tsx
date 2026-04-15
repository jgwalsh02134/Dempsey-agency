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
  "latitude",
  "longitude",
  // Contacts
  "phone",
  "officeHours",
  "contactName",
  "contactTitle",
  // Website / reference links (URLs)
  "websiteUrl",
  "logoUrl",
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
const FLOAT_COLUMNS = new Set(["latitude", "longitude"]);

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
    "42.35699",
    "-71.05331",
    // Contacts
    "617-555-1000",
    "Mon–Fri 9–5",
    "Ada Lovelace",
    "Advertising Director",
    // URLs
    "https://www.bostonglobe.com",
    "https://www.bostonglobe.com/logo.png",
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
    } else if (FLOAT_COLUMNS.has(col)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[col] = n;
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
  // DMA filter is applied client-side: server `q` doesn't cover DMA, and the
  // publisher catalog is small enough that in-browser filtering is simpler
  // than plumbing a new query param.
  const [dmaFilter, setDmaFilter] = useState("");

  /* ── per-row delete state ── */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const loadPublishers = useCallback(
    async (filters?: { q?: string; isActive?: boolean }) => {
      setLoading(true);
      setListError(null);
      try {
        const res = await api.fetchPublishers(filters);
        setPublishers(res.publishers);
      } catch (e) {
        setListError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Server-side filtering: debounce `search` → `q`; send `isActive` directly.
  // Server `q` covers name/city/state/parentCompany (case-insensitive).
  const currentFilters = useMemo(() => {
    const q = search.trim();
    return {
      q: q.length > 0 ? q : undefined,
      isActive:
        activeFilter === "" ? undefined : activeFilter === "true",
    };
  }, [search, activeFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadPublishers(currentFilters);
    }, 200);
    return () => clearTimeout(handle);
  }, [currentFilters, loadPublishers]);

  const hasFilters =
    currentFilters.q !== undefined ||
    currentFilters.isActive !== undefined ||
    dmaFilter.trim().length > 0;

  /* ── client-side DMA filter on top of server results ── */
  const visiblePublishers = useMemo(() => {
    const needle = dmaFilter.trim().toLowerCase();
    if (!needle) return publishers;
    return publishers.filter((p) => {
      const name = (p.dmaName ?? "").toLowerCase();
      const code = (p.dmaCode ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    });
  }, [publishers, dmaFilter]);

  const activeCount = visiblePublishers.filter((p) => p.isActive).length;
  const dmaCoverage = useMemo(() => {
    const set = new Set<string>();
    for (const p of visiblePublishers) {
      const key = (p.dmaCode ?? p.dmaName ?? "").trim();
      if (key) set.add(key);
    }
    return set.size;
  }, [visiblePublishers]);
  const totalCirculation = useMemo(
    () =>
      visiblePublishers.reduce(
        (sum, p) => sum + (p.circulation ?? 0),
        0,
      ),
    [visiblePublishers],
  );

  function resetFilters() {
    setSearch("");
    setActiveFilter("");
    setDmaFilter("");
  }

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
      void loadPublishers(currentFilters);
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  async function onDelete(p: Publisher) {
    const msg =
      `Delete publisher "${p.name}"? This cannot be undone.\n\n` +
      `If the publisher has inventory or is attached to campaigns, the deletion will be blocked.`;
    if (!window.confirm(msg)) return;
    setDeletingId(p.id);
    setDeleteError(null);
    try {
      await api.deletePublisher(p.id);
      setPublishers((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeletingId(null);
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
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "0.25rem 1rem",
                marginTop: "0.25rem",
                fontSize: "0.85rem",
                color: "var(--color-secondary, #475569)",
              }}
            >
              <span>
                <strong style={{ color: "var(--color-midnight, #0F172A)" }}>
                  {visiblePublishers.length.toLocaleString()}
                </strong>{" "}
                total
              </span>
              <span>
                <strong style={{ color: "var(--color-midnight, #0F172A)" }}>
                  {activeCount.toLocaleString()}
                </strong>{" "}
                active
              </span>
              <span>
                <strong style={{ color: "var(--color-midnight, #0F172A)" }}>
                  {dmaCoverage.toLocaleString()}
                </strong>{" "}
                DMA{dmaCoverage === 1 ? "" : "s"} covered
              </span>
              {totalCirculation > 0 && (
                <span>
                  <strong
                    className="mono"
                    style={{ color: "var(--color-midnight, #0F172A)" }}
                  >
                    {totalCirculation.toLocaleString()}
                  </strong>{" "}
                  total circulation
                </span>
              )}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link to="/publishers/new" className="btn primary">
            + New publisher
          </Link>
          {!importOpen && (
            <button
              type="button"
              className="btn"
              onClick={openImport}
              disabled={loading}
              title="Bulk-create or update publishers from a CSV file"
            >
              Import CSV
            </button>
          )}
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: "1.5rem",
              background: "var(--color-border, #E2E8F0)",
              margin: "0 0.1rem",
            }}
          />
          <Link
            to="/publishers/explorer"
            className="btn ghost"
            title="Open the interactive map explorer"
          >
            Open map
          </Link>
          <button
            type="button"
            className="btn ghost"
            onClick={() => loadPublishers(currentFilters)}
            disabled={loading}
            title="Reload the publisher list from the server"
            aria-label="Reload"
          >
            {loading ? "Reloading…" : "Reload"}
          </button>
        </div>
      </div>

      {/* ── Import panel (3-step workflow: select → preview → import) ── */}
      {importOpen && (
        <section
          className="card"
          style={{
            marginBottom: "1rem",
            borderLeft: "3px solid var(--color-primary, #2563EB)",
          }}
          aria-label="Import publishers CSV"
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.5rem",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                Import publishers from CSV
              </h2>
              <p
                className="muted small"
                style={{ margin: "0.2rem 0 0", maxWidth: "56ch" }}
              >
                Duplicates matched on name + city + state are updated in
                place. Only the{" "}
                <code>name</code> column is required.
              </p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={closeImport}
              disabled={importing}
            >
              Close
            </button>
          </div>

          {/* Step 1 — select a file */}
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem 0.85rem",
              background: "var(--color-surface-alt, #F8FAFC)",
              border: "1px solid var(--color-border, #E2E8F0)",
              borderRadius: "0.4rem",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-secondary, #475569)",
                marginBottom: "0.4rem",
              }}
            >
              Step 1 — Select file
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                alignItems: "center",
                flexWrap: "wrap",
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
                <span className="small" style={{ fontWeight: 500 }}>
                  {importFilename}
                </span>
              )}
            </div>
            <details style={{ marginTop: "0.55rem" }}>
              <summary
                className="muted small"
                style={{ cursor: "pointer" }}
              >
                Supported columns ({IMPORT_COLUMNS.length})
              </summary>
              <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
                {IMPORT_COLUMNS.join(", ")}. URL fields and email fields are
                kept strictly separate.
              </p>
            </details>
          </div>

          {importError && (
            <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>
              {importError}
            </p>
          )}

          {/* Step 2 — preview */}
          {importPreview.length > 0 && !importResult && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem 0.85rem",
                border: "1px solid var(--color-border, #E2E8F0)",
                borderRadius: "0.4rem",
                background: "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-secondary, #475569)",
                    }}
                  >
                    Step 2 — Review
                  </div>
                  <div className="small" style={{ marginTop: "0.2rem" }}>
                    <strong>{importPreview.length.toLocaleString()}</strong>{" "}
                    row{importPreview.length !== 1 ? "s" : ""} detected ·
                    showing first {Math.min(10, importPreview.length)}
                  </div>
                </div>
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
                  Clear file
                </button>
              </div>
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
                          title={
                            IMPORT_COLUMNS.includes(
                              h as (typeof IMPORT_COLUMNS)[number],
                            )
                              ? "Recognized column"
                              : "Column not recognized — will be ignored"
                          }
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

              {/* Step 3 — commit */}
              <div
                style={{
                  marginTop: "0.85rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--color-border, #E2E8F0)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-secondary, #475569)",
                  }}
                >
                  Step 3 — Import
                </div>
                <button
                  type="button"
                  className="btn primary"
                  onClick={onRunImport}
                  disabled={importing}
                >
                  {importing
                    ? "Importing…"
                    : `Import ${importPreview.length.toLocaleString()} row${importPreview.length !== 1 ? "s" : ""}`}
                </button>
                <span className="muted small">
                  Existing matches will be updated in place.
                </span>
              </div>
            </div>
          )}

          {importResult && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem 0.85rem",
                border: "1px solid #BBF7D0",
                background: "#F0FDF4",
                borderRadius: "0.4rem",
              }}
            >
              <p
                className="success"
                role="status"
                style={{ margin: 0, fontWeight: 600 }}
              >
                Import complete — {importResult.total.toLocaleString()} row
                {importResult.total !== 1 ? "s" : ""} processed
              </p>
              <div
                className="small"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.25rem 1rem",
                  marginTop: "0.35rem",
                }}
              >
                <span>
                  <strong>{importResult.created}</strong> created
                </span>
                <span>
                  <strong>{importResult.updated}</strong> updated
                </span>
                <span>
                  <strong>{importResult.skipped}</strong> skipped
                </span>
              </div>
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
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                }}
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
      <div
        role="group"
        aria-label="Publisher filters"
        style={{
          marginTop: "0.5rem",
          padding: "0.75rem 0.9rem",
          background: "var(--color-surface-alt, #F8FAFC)",
          border: "1px solid var(--color-border, #E2E8F0)",
          borderRadius: "0.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "0.5rem",
            flexWrap: "wrap",
            marginBottom: "0.55rem",
          }}
        >
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-secondary, #475569)",
            }}
          >
            Filters
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn ghost"
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
            >
              Reset filters
            </button>
          )}
        </div>
        <div className="q-filters" style={{ margin: 0 }}>
          <label className="q-filter-field" style={{ flex: "2 1 18rem" }}>
            <span className="small" style={{ fontWeight: 600 }}>
              Search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, city, state, parent company…"
            />
          </label>
          <label className="q-filter-field">
            <span className="small" style={{ fontWeight: 600 }}>
              DMA
            </span>
            <input
              type="search"
              value={dmaFilter}
              onChange={(e) => setDmaFilter(e.target.value)}
              placeholder="DMA name or code"
            />
          </label>
          <label className="q-filter-field" style={{ flex: "0 1 10rem" }}>
            <span className="small" style={{ fontWeight: 600 }}>
              Status
            </span>
            <select
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as "" | "true" | "false")
              }
            >
              <option value="">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </label>
        </div>
      </div>

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

      {loading && <p className="muted">Loading publishers…</p>}

      {!loading && visiblePublishers.length === 0 && !listError && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {hasFilters
            ? "No publishers match the current filters."
            : "No publishers yet. Create one or import a CSV."}
        </p>
      )}

      {!loading && visiblePublishers.length > 0 && (
        <div
          className="table-wrap publishers-grid"
          style={{ marginTop: "0.75rem" }}
        >
          <style>{`
            .publishers-grid table.data-table td,
            .publishers-grid table.data-table th {
              padding-top: 0.45rem;
              padding-bottom: 0.45rem;
              line-height: 1.3;
            }
            .publishers-grid tbody tr:nth-child(even) td {
              background: rgba(15, 23, 42, 0.02);
            }
            .publishers-grid tbody tr:hover td {
              background: rgba(37, 99, 235, 0.05);
            }
            .publishers-grid .col-num {
              text-align: right;
              font-variant-numeric: tabular-nums;
              font-feature-settings: "tnum" 1;
              white-space: nowrap;
            }
            .publishers-grid th.col-num {
              text-align: right;
            }
            .publishers-grid .pub-name-cell a {
              color: var(--color-midnight, #0F172A);
              text-decoration: none;
            }
            .publishers-grid .pub-name-cell a:hover {
              color: var(--color-primary, #2563EB);
              text-decoration: underline;
            }
            .publishers-grid .status-pill {
              display: inline-block;
              padding: 0.1rem 0.5rem;
              border-radius: 999px;
              font-size: 0.72rem;
              font-weight: 600;
              letter-spacing: 0.02em;
            }
            .publishers-grid .status-pill-active {
              background: #DCFCE7;
              color: #15803D;
            }
            .publishers-grid .status-pill-inactive {
              background: #F1F5F9;
              color: #64748B;
            }
            .publishers-grid .circ-strong {
              font-weight: 600;
              color: var(--color-midnight, #0F172A);
            }
          `}</style>
          <table className="data-table">
            <thead>
              <tr>
                <th>Publisher</th>
                <th>Location</th>
                <th>DMA</th>
                <th>Type</th>
                <th>Frequency</th>
                <th className="col-num">Circulation</th>
                <th className="col-num">Inventory</th>
                <th>Email</th>
                <th>Website</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visiblePublishers.map((p) => {
                const location = [p.city, p.state].filter(Boolean).join(", ");
                const dmaCity = p.dmaName
                  ? p.dmaName
                      .split(/[-·,]/)[0]
                      .trim()
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "";
                const dmaLabel = p.dmaName
                  ? p.dmaCode
                    ? `${dmaCity} (${p.dmaCode})`
                    : dmaCity
                  : p.dmaCode ?? "—";
                const hasCirc =
                  p.circulation != null && p.circulation > 0;
                return (
                  <tr
                    key={p.id}
                    style={p.isActive ? undefined : { opacity: 0.6 }}
                  >
                    <td className="pub-name-cell">
                      <Link
                        to={`/publishers/${p.id}`}
                        style={{
                          display: "block",
                          fontWeight: 600,
                          fontSize: "0.925rem",
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {p.name}
                      </Link>
                      {p.parentCompany && (
                        <span
                          className="small muted"
                          style={{ display: "block", marginTop: "0.05rem" }}
                        >
                          {p.parentCompany}
                        </span>
                      )}
                    </td>
                    <td className="small">{location || "—"}</td>
                    <td className="small mono" title={p.dmaName ?? undefined}>
                      {dmaLabel}
                    </td>
                    <td className="small">{p.publicationType ?? "—"}</td>
                    <td className="small">{p.frequency ?? "—"}</td>
                    <td
                      className={`small mono col-num${hasCirc ? " circ-strong" : ""}`}
                    >
                      {hasCirc ? p.circulation!.toLocaleString() : "—"}
                    </td>
                    <td className="small mono col-num">
                      {p._count?.inventory ?? 0}
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
                    <td>
                      <span
                        className={`status-pill ${p.isActive ? "status-pill-active" : "status-pill-inactive"}`}
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <Link
                          to={`/publishers/${p.id}`}
                          className="btn ghost"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="btn-remove"
                          onClick={() => onDelete(p)}
                          disabled={deletingId === p.id}
                          aria-label={`Delete ${p.name}`}
                        >
                          {deletingId === p.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
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

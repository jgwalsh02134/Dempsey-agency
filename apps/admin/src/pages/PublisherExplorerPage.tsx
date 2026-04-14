import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Publisher } from "../types";

/**
 * Publisher Explorer — admin-only browse view over the publisher catalog.
 *
 * The catalog is fetched once and then sliced client-side along two axes:
 *   - Browse by State  → groups on normalized `state`
 *   - Browse by DMA    → groups on normalized `dmaName` (codes fall back)
 * A single search input filters publishers in place; summary counts are
 * derived from the full (unfiltered) catalog so operators always see the
 * true shape of the dataset.
 */

type BrowseMode = "state" | "dma";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/** Normalize a grouping value. Nulls and whitespace → "—" so they form a
 *  single clearly-labeled bucket rather than scattering blanks. */
function normKey(raw: string | null): string {
  const v = (raw ?? "").trim();
  return v.length === 0 ? "—" : v.toUpperCase();
}

/** Canonical key for DMA grouping. Prefers dmaName; falls back to dmaCode
 *  so publishers with only a code still form a coherent group. */
function dmaKey(p: Publisher): string {
  if (p.dmaName && p.dmaName.trim().length > 0) return normKey(p.dmaName);
  if (p.dmaCode && p.dmaCode.trim().length > 0) return normKey(p.dmaCode);
  return "—";
}

interface Group {
  key: string;
  /** Display label (preserves original casing where possible). */
  label: string;
  /** Optional secondary label (e.g., DMA code next to name). */
  sublabel?: string;
  publishers: Publisher[];
}

function groupBy(
  publishers: Publisher[],
  mode: BrowseMode,
): Group[] {
  const map = new Map<string, Publisher[]>();
  for (const p of publishers) {
    const k = mode === "state" ? normKey(p.state) : dmaKey(p);
    const bucket = map.get(k);
    if (bucket) bucket.push(p);
    else map.set(k, [p]);
  }
  return Array.from(map.entries())
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      if (mode === "state") {
        return { key, label: key, publishers: sorted };
      }
      // DMA mode: derive a nicer label from the first publisher in the bucket
      // that actually has a dmaName; pick any dmaCode we can find to display
      // alongside it.
      const withName = sorted.find(
        (p) => p.dmaName && p.dmaName.trim().length > 0,
      );
      const withCode = sorted.find(
        (p) => p.dmaCode && p.dmaCode.trim().length > 0,
      );
      const label = withName?.dmaName?.trim() ?? key;
      const sublabel = withCode?.dmaCode?.trim() ?? undefined;
      return { key, label, sublabel, publishers: sorted };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Case-insensitive substring match across the five searchable fields. */
function matchesSearch(p: Publisher, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  const hay = [p.name, p.city, p.state, p.dmaName, p.dmaCode];
  for (const field of hay) {
    if (field && field.toLowerCase().includes(n)) return true;
  }
  return false;
}

export function PublisherExplorerPage() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<BrowseMode>("state");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .fetchPublishers()
      .then((res) => {
        if (!cancelled) setPublishers(res.publishers);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Summary counts: computed from the FULL catalog, not the search-filtered
   *    view, so operators can always see the true shape of the dataset. ── */
  const totalStates = useMemo(
    () => new Set(publishers.map((p) => normKey(p.state))).size,
    [publishers],
  );
  const totalDmas = useMemo(
    () =>
      new Set(
        publishers
          .map((p) => p.dmaName)
          .filter((v): v is string => v != null && v.trim().length > 0)
          .map((v) => v.trim().toUpperCase()),
      ).size,
    [publishers],
  );

  /* ── Search filter applied once, then reused by grid + detail views. ── */
  const needle = search.trim();
  const filtered = useMemo(
    () => publishers.filter((p) => matchesSearch(p, needle)),
    [publishers, needle],
  );

  /* ── Group the filtered list by the active mode. ── */
  const groups = useMemo(() => groupBy(filtered, mode), [filtered, mode]);

  const selected = selectedKey
    ? groups.find((g) => g.key === selectedKey) ?? null
    : null;

  // If the active search hides the currently-selected bucket, drop back to the
  // grid so the user isn't stranded on an empty detail view.
  useEffect(() => {
    if (selectedKey && !groups.find((g) => g.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [selectedKey, groups]);

  /** Switch browse mode; clear any selected bucket since keys don't carry
   *  meaning across modes (a state key is not a DMA key). */
  function switchMode(next: BrowseMode) {
    if (next === mode) return;
    setMode(next);
    setSelectedKey(null);
  }

  const modeNounPlural = mode === "state" ? "states" : "DMAs";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Publisher Explorer</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {publishers.length} publisher
              {publishers.length !== 1 ? "s" : ""} · {totalStates} state
              {totalStates !== 1 ? "s" : ""} · {totalDmas} DMA
              {totalDmas !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link to="/publishers" className="btn ghost">
          ← Back to publishers
        </Link>
      </div>

      {/* ── Controls: search + mode toggle ── */}
      <div
        className="q-filters"
        style={{ alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <label className="q-filter-field" style={{ flex: "1 1 18rem" }}>
          <span className="small">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, city, state, DMA…"
          />
        </label>
        <div
          className="q-filter-field"
          role="group"
          aria-label="Browse mode"
        >
          <span className="small">Browse</span>
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button
              type="button"
              className={`btn ${mode === "state" ? "primary" : "ghost"}`}
              onClick={() => switchMode("state")}
            >
              By state
            </button>
            <button
              type="button"
              className={`btn ${mode === "dma" ? "primary" : "ghost"}`}
              onClick={() => switchMode("dma")}
            >
              By DMA
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading publishers…</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {needle
            ? `No publishers match "${needle}".`
            : "No publishers in the catalog."}
        </p>
      )}

      {/* ── Grid view (no selection) ── */}
      {!loading && !error && filtered.length > 0 && selected === null && (
        <div
          className="explorer-state-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className="card"
              onClick={() => setSelectedKey(g.key)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                background: "var(--color-surface, #fff)",
                border: "1px solid var(--color-border, rgba(15,23,42,0.12))",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
              title={g.label}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  lineHeight: 1.25,
                  wordBreak: "break-word",
                }}
              >
                {g.label}
              </div>
              {g.sublabel && (
                <div
                  className="muted small"
                  style={{ marginTop: "0.15rem" }}
                >
                  Code {g.sublabel}
                </div>
              )}
              <div
                className="muted small"
                style={{ marginTop: "0.25rem" }}
              >
                {g.publishers.length} publisher
                {g.publishers.length !== 1 ? "s" : ""}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail view (a single bucket selected) ── */}
      {!loading && !error && selected !== null && (
        <section className="card" style={{ marginTop: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>{selected.label}</h2>
              <p className="muted small" style={{ margin: "0.15rem 0 0" }}>
                {selected.publishers.length} publisher
                {selected.publishers.length !== 1 ? "s" : ""}
                {selected.sublabel && ` · Code ${selected.sublabel}`}
                {needle && ` · filtered by "${needle}"`}
              </p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSelectedKey(null)}
            >
              ← All {modeNounPlural}
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>{mode === "state" ? "DMA" : "State"}</th>
                  <th>Circulation</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {selected.publishers.map((p) => {
                  const location = [p.city, p.state]
                    .filter(Boolean)
                    .join(", ");
                  const dma =
                    p.dmaName && p.dmaCode
                      ? `${p.dmaName} (${p.dmaCode})`
                      : p.dmaName ?? p.dmaCode ?? "—";
                  // In state detail view, show DMA in that column; in DMA
                  // detail view, show state (DMA is redundant with the header).
                  const third =
                    mode === "state" ? dma : p.state ?? "—";
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link
                          to={`/publishers/${p.id}`}
                          style={{
                            fontWeight: 600,
                            color: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="small">{location || "—"}</td>
                      <td className="small">{third}</td>
                      <td className="small" style={{ whiteSpace: "nowrap" }}>
                        {p.circulation != null
                          ? p.circulation.toLocaleString()
                          : "—"}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}

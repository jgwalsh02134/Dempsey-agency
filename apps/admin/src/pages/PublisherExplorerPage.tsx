import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Publisher } from "../types";

/**
 * Publisher Explorer — admin-only browse view keyed by US state.
 *
 * Fetches the full publisher catalog once and groups client-side by state.
 * No new endpoints, no editing — this is a read-only lens on existing data
 * intended to surface DMA coverage at a glance.
 */

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/** Normalize a publisher's raw state value into a stable grouping key.
 *  Nulls and whitespace collapse to "—" so they form a single bucket. */
function stateKey(raw: string | null): string {
  const v = (raw ?? "").trim();
  return v.length === 0 ? "—" : v.toUpperCase();
}

interface StateGroup {
  key: string;
  publishers: Publisher[];
}

export function PublisherExplorerPage() {
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedState, setSelectedState] = useState<string | null>(null);

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

  /** Stable alphabetical grouping by normalized state key. */
  const groups: StateGroup[] = useMemo(() => {
    const map = new Map<string, Publisher[]>();
    for (const p of publishers) {
      const k = stateKey(p.state);
      const bucket = map.get(k);
      if (bucket) bucket.push(p);
      else map.set(k, [p]);
    }
    return Array.from(map.entries())
      .map(([key, list]) => ({
        key,
        publishers: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [publishers]);

  const selected = selectedState
    ? groups.find((g) => g.key === selectedState) ?? null
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Publisher Explorer</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {publishers.length} publisher
              {publishers.length !== 1 ? "s" : ""} across {groups.length} state
              {groups.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link to="/publishers" className="btn ghost">
          ← Back to publishers
        </Link>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading publishers…</p>}

      {!loading && !error && selected === null && (
        <div
          className="explorer-state-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
            gap: "0.75rem",
            marginTop: "0.5rem",
          }}
        >
          {groups.map((g) => (
            <button
              key={g.key}
              type="button"
              className="card"
              onClick={() => setSelectedState(g.key)}
              style={{
                textAlign: "left",
                cursor: "pointer",
                background: "var(--color-surface, #fff)",
                border: "1px solid var(--color-border, rgba(15,23,42,0.12))",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {g.key}
              </div>
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

      {!loading && !error && selected !== null && (
        <section className="card" style={{ marginTop: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>{selected.key}</h2>
              <p className="muted small" style={{ margin: "0.15rem 0 0" }}>
                {selected.publishers.length} publisher
                {selected.publishers.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSelectedState(null)}
            >
              ← All states
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>DMA</th>
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
                      <td className="small">{dma}</td>
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { CampaignPublisher, Publisher } from "../types";
import { CampaignMapPreview } from "./CampaignMapPreview";

/**
 * Media-planner–style publisher selection for a single campaign.
 *
 * Layout:
 *   ┌ Map preview (selected publishers) ────────────────────────┐
 *   ├────────────────────────────────────────────────────────────┤
 *   │ Catalog (search + filters + Add)  │  Selected (Remove)     │
 *   └────────────────────────────────────────────────────────────┘
 *
 * - Full publisher catalog is fetched once (admin-only endpoint); all
 *   filtering is done client-side for instant feedback.
 * - Add/Remove persist immediately via the existing campaign-publishers
 *   endpoints; local state updates in place, no page reload.
 * - Duplicates are prevented both in the filtered-catalog pass (already-
 *   attached IDs are excluded) and by the server's unique(campaignId,
 *   publisherId) constraint.
 */

interface Props {
  campaignId: string;
}

type Busy = { kind: "adding" | "removing"; publisherId: string } | null;

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/** Bucket circulations into coarse ranges for the filter. */
const CIRC_BUCKETS = [
  { label: "Any", min: null, max: null },
  { label: "< 10k", min: 0, max: 9_999 },
  { label: "10k – 50k", min: 10_000, max: 50_000 },
  { label: "50k – 250k", min: 50_001, max: 250_000 },
  { label: "250k+", min: 250_001, max: null },
] as const;

type CircKey = (typeof CIRC_BUCKETS)[number]["label"];

export function CampaignPublishersSection({ campaignId }: Props) {
  /* ── data state ── */
  const [catalog, setCatalog] = useState<Publisher[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [attached, setAttached] = useState<CampaignPublisher[]>([]);
  const [attachedLoading, setAttachedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── in-flight row ── */
  const [busy, setBusy] = useState<Busy>(null);

  /* ── filters ── */
  const [search, setSearch] = useState("");
  const [fState, setFState] = useState<string>("");
  const [fFrequency, setFFrequency] = useState<string>("");
  const [fFormat, setFFormat] = useState<string>("");
  const [fCirc, setFCirc] = useState<CircKey>("Any");

  /* ── initial load (catalog + attached in parallel) ── */
  const loadAll = useCallback(async () => {
    setError(null);
    setCatalogLoading(true);
    setAttachedLoading(true);
    try {
      const [cat, att] = await Promise.all([
        api.fetchPublishers(),
        api.fetchCampaignPublishers(campaignId),
      ]);
      setCatalog(cat.publishers);
      setAttached(att.publishers);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCatalogLoading(false);
      setAttachedLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* ── derived filter option lists (unique, sorted) ── */
  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((p) => p.state)
            .filter((s): s is string => !!s && s.trim().length > 0),
        ),
      ).sort(),
    [catalog],
  );
  const frequencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((p) => p.frequency)
            .filter((s): s is string => !!s && s.trim().length > 0),
        ),
      ).sort(),
    [catalog],
  );
  const formatOptions = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((p) => p.format)
            .filter((s): s is string => !!s && s.trim().length > 0),
        ),
      ).sort(),
    [catalog],
  );

  const attachedIds = useMemo(
    () => new Set(attached.map((p) => p.id)),
    [attached],
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bucket = CIRC_BUCKETS.find((b) => b.label === fCirc) ?? CIRC_BUCKETS[0];
    return catalog.filter((p) => {
      if (!p.isActive) return false;
      if (attachedIds.has(p.id)) return false;
      if (fState && p.state !== fState) return false;
      if (fFrequency && p.frequency !== fFrequency) return false;
      if (fFormat && p.format !== fFormat) return false;
      if (bucket.min != null) {
        if (p.circulation == null || p.circulation < bucket.min) return false;
      }
      if (bucket.max != null) {
        if (p.circulation == null || p.circulation > bucket.max) return false;
      }
      if (q.length > 0) {
        const hay = [p.name, p.city, p.state, p.country, p.parentCompany]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, attachedIds, search, fState, fFrequency, fFormat, fCirc]);

  function clearFilters() {
    setSearch("");
    setFState("");
    setFFrequency("");
    setFFormat("");
    setFCirc("Any");
  }

  /* ── add / remove handlers (persist immediately; optimistic local update) ── */
  async function onAdd(p: Publisher) {
    setBusy({ kind: "adding", publisherId: p.id });
    setError(null);
    try {
      await api.addCampaignPublishers(campaignId, [p.id]);
      // Reflect locally without a full refetch — shape matches CampaignPublisher.
      setAttached((prev) => [
        ...prev,
        {
          linkId: `local-${p.id}`,
          notes: null,
          id: p.id,
          name: p.name,
          streetAddress: p.streetAddress,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          country: p.country,
          websiteUrl: p.websiteUrl,
          latitude: p.latitude,
          longitude: p.longitude,
          geocodeStatus: p.geocodeStatus,
        },
      ]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function onRemove(publisherId: string) {
    const prev = attached;
    setBusy({ kind: "removing", publisherId });
    setError(null);
    // Optimistic remove; revert on failure.
    setAttached((curr) => curr.filter((p) => p.id !== publisherId));
    try {
      await api.removeCampaignPublisher(campaignId, publisherId);
    } catch (e) {
      setAttached(prev);
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const mappable = attached.filter(
    (p) => p.latitude != null && p.longitude != null,
  ).length;

  /* ── render ── */
  return (
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Publishers</h2>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {attached.length} attached · {mappable} on map
            {attached.length > mappable &&
              ` (${attached.length - mappable} not geocoded)`}
          </p>
        </div>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "0.75rem" }}>
          {error}
        </p>
      )}

      {/* ── Map preview ── */}
      <CampaignMapPreview publishers={attached} />

      {/* ── Two-column planner body ── */}
      <div className="pub-planner" style={{ marginTop: "1rem" }}>
        {/* ── Catalog (left) ── */}
        <div className="pub-planner-pane">
          <div className="pub-planner-pane-header">
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Catalog</h3>
            <span className="muted small">
              {filteredCatalog.length} of {catalog.length}
            </span>
          </div>

          <div className="pub-planner-filters">
            <label className="q-filter-field">
              <span className="small">Search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, city, state…"
              />
            </label>
            <label className="q-filter-field">
              <span className="small">State</span>
              <select
                value={fState}
                onChange={(e) => setFState(e.target.value)}
              >
                <option value="">Any</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="q-filter-field">
              <span className="small">Frequency</span>
              <select
                value={fFrequency}
                onChange={(e) => setFFrequency(e.target.value)}
              >
                <option value="">Any</option>
                {frequencyOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="q-filter-field">
              <span className="small">Type</span>
              <select
                value={fFormat}
                onChange={(e) => setFFormat(e.target.value)}
              >
                <option value="">Any</option>
                {formatOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="q-filter-field">
              <span className="small">Circulation</span>
              <select
                value={fCirc}
                onChange={(e) => setFCirc(e.target.value as CircKey)}
              >
                {CIRC_BUCKETS.map((b) => (
                  <option key={b.label} value={b.label}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn ghost"
              onClick={clearFilters}
              style={{ alignSelf: "end" }}
            >
              Clear
            </button>
          </div>

          {catalogLoading && (
            <p className="muted small">Loading publisher catalog…</p>
          )}

          {!catalogLoading && filteredCatalog.length === 0 && (
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              {catalog.length === 0
                ? "No publishers in the catalog yet."
                : "No publishers match the current filters."}
            </p>
          )}

          {!catalogLoading && filteredCatalog.length > 0 && (
            <div
              className="table-wrap"
              style={{ maxHeight: "22rem", overflowY: "auto" }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Freq.</th>
                    <th>Circ.</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((p) => {
                    const loc = [p.city, p.state].filter(Boolean).join(", ");
                    const adding =
                      busy?.kind === "adding" && busy.publisherId === p.id;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.parentCompany && (
                            <span className="small muted">
                              {p.parentCompany}
                            </span>
                          )}
                        </td>
                        <td className="small">{loc || "—"}</td>
                        <td className="small">{p.frequency ?? "—"}</td>
                        <td className="small" style={{ whiteSpace: "nowrap" }}>
                          {p.circulation != null
                            ? p.circulation.toLocaleString()
                            : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn primary"
                            onClick={() => onAdd(p)}
                            disabled={adding}
                          >
                            {adding ? "Adding…" : "Add"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Selected (right) ── */}
        <div className="pub-planner-pane">
          <div className="pub-planner-pane-header">
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Selected</h3>
            <span className="muted small">
              {attached.length} publisher{attached.length !== 1 ? "s" : ""}
            </span>
          </div>

          {attachedLoading && (
            <p className="muted small">Loading selected publishers…</p>
          )}

          {!attachedLoading && attached.length === 0 && (
            <p className="muted small" style={{ marginTop: "0.5rem" }}>
              No publishers selected. Use the catalog to add some.
            </p>
          )}

          {!attachedLoading && attached.length > 0 && (
            <ul className="pub-planner-selected">
              {attached.map((p) => {
                const loc = [p.city, p.state].filter(Boolean).join(", ");
                const removing =
                  busy?.kind === "removing" && busy.publisherId === p.id;
                return (
                  <li key={p.id} className="pub-planner-selected-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div className="small muted">
                        {loc || "Location unknown"}
                        {p.latitude == null || p.longitude == null
                          ? " · not geocoded"
                          : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => onRemove(p.id)}
                      disabled={removing}
                    >
                      {removing ? "Removing…" : "Remove"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

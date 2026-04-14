import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { CampaignPublisher, Publisher } from "../types";
import { CampaignMapPreview } from "./CampaignMapPreview";

/**
 * Media-planner–style publisher selection for a single campaign.
 *
 * Polished layout:
 *   ┌ Map preview with count badge overlay ─────────────────────┐
 *   ├────────────────────────────────────────────────────────────┤
 *   │  Selected (primary, tinted)      │   Catalog + filters     │
 *   └────────────────────────────────────────────────────────────┘
 */

interface Props {
  campaignId: string;
  /** Fired after a successful attach/remove so the parent can refresh
   *  dependents (e.g., the Placements section header count). */
  onPublishersChanged?: () => void;
}

type Busy = { kind: "adding" | "removing"; publisherId: string } | null;

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

/** Bucket circulations into coarse ranges for the filter. */
const CIRC_BUCKETS = [
  { label: "Any circulation", min: null, max: null },
  { label: "< 10k", min: 0, max: 9_999 },
  { label: "10k – 50k", min: 10_000, max: 50_000 },
  { label: "50k – 250k", min: 50_001, max: 250_000 },
  { label: "250k+", min: 250_001, max: null },
] as const;

type CircKey = (typeof CIRC_BUCKETS)[number]["label"];
const CIRC_ANY: CircKey = "Any circulation";

export function CampaignPublishersSection({
  campaignId,
  onPublishersChanged,
}: Props) {
  /* ── data state ── */
  const [catalog, setCatalog] = useState<Publisher[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [attached, setAttached] = useState<CampaignPublisher[]>([]);
  const [attachedLoading, setAttachedLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── in-flight row ── */
  const [busy, setBusy] = useState<Busy>(null);

  /* ── transient highlight for newly-added Selected rows ── */
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── filters ── */
  const [search, setSearch] = useState("");
  const [fState, setFState] = useState<string>("");
  const [fFrequency, setFFrequency] = useState<string>("");
  const [fFormat, setFFormat] = useState<string>("");
  const [fCirc, setFCirc] = useState<CircKey>(CIRC_ANY);
  // Free-text DMA filter: substring match against dmaName OR dmaCode.
  // Kept as free text (not a select) because the DMA list is large and
  // operators often know only a partial name or a code.
  const [fDma, setFDma] = useState<string>("");

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

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

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
            .map((p) => p.publicationType)
            .filter((s): s is string => !!s && s.trim().length > 0),
        ),
      ).sort(),
    [catalog],
  );

  const attachedIds = useMemo(
    () => new Set(attached.map((p) => p.id)),
    [attached],
  );

  /** Catalog lookup by id — used to back-fill DMA (and other fields not
   *  returned by GET /campaigns/:id/publishers) onto attached rows without
   *  expanding the API. */
  const catalogById = useMemo(() => {
    const map = new Map<string, Publisher>();
    for (const p of catalog) map.set(p.id, p);
    return map;
  }, [catalog]);

  /** Unique DMAs represented across the selected publishers. Derived from
   *  the catalog join above; attached publishers missing from the catalog
   *  (shouldn't happen) simply don't contribute. */
  const attachedDmaCount = useMemo(() => {
    const dmas = new Set<string>();
    for (const a of attached) {
      const dma = catalogById.get(a.id)?.dmaName;
      if (dma && dma.trim().length > 0) dmas.add(dma.trim().toUpperCase());
    }
    return dmas.size;
  }, [attached, catalogById]);

  const activeFilters = useMemo(() => {
    const list: { label: string; clear: () => void }[] = [];
    if (search.trim()) {
      list.push({ label: `“${search.trim()}”`, clear: () => setSearch("") });
    }
    if (fState) list.push({ label: fState, clear: () => setFState("") });
    if (fFrequency)
      list.push({ label: fFrequency, clear: () => setFFrequency("") });
    if (fFormat) list.push({ label: fFormat, clear: () => setFFormat("") });
    if (fCirc !== CIRC_ANY)
      list.push({ label: fCirc, clear: () => setFCirc(CIRC_ANY) });
    if (fDma.trim())
      list.push({
        label: `DMA: ${fDma.trim()}`,
        clear: () => setFDma(""),
      });
    return list;
  }, [search, fState, fFrequency, fFormat, fCirc, fDma]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dmaNeedle = fDma.trim().toLowerCase();
    const bucket =
      CIRC_BUCKETS.find((b) => b.label === fCirc) ?? CIRC_BUCKETS[0];
    return catalog.filter((p) => {
      if (!p.isActive) return false;
      if (attachedIds.has(p.id)) return false;
      if (fState && p.state !== fState) return false;
      if (fFrequency && p.frequency !== fFrequency) return false;
      if (fFormat && p.publicationType !== fFormat) return false;
      if (bucket.min != null) {
        if (p.circulation == null || p.circulation < bucket.min) return false;
      }
      if (bucket.max != null) {
        if (p.circulation == null || p.circulation > bucket.max) return false;
      }
      if (dmaNeedle.length > 0) {
        const name = (p.dmaName ?? "").toLowerCase();
        const code = (p.dmaCode ?? "").toLowerCase();
        if (!name.includes(dmaNeedle) && !code.includes(dmaNeedle)) {
          return false;
        }
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
  }, [
    catalog,
    attachedIds,
    search,
    fState,
    fFrequency,
    fFormat,
    fCirc,
    fDma,
  ]);

  function clearAllFilters() {
    setSearch("");
    setFState("");
    setFFrequency("");
    setFFormat("");
    setFCirc(CIRC_ANY);
    setFDma("");
  }

  /* ── add / remove handlers (persist immediately; optimistic local update) ── */
  async function onAdd(p: Publisher) {
    setBusy({ kind: "adding", publisherId: p.id });
    setError(null);
    try {
      await api.addCampaignPublishers(campaignId, [p.id]);
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
      // Brief highlight on the just-added Selected row.
      setFlashId(p.id);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashId(null), 1200);
      onPublishersChanged?.();
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
    setAttached((curr) => curr.filter((p) => p.id !== publisherId));
    try {
      await api.removeCampaignPublisher(campaignId, publisherId);
      onPublishersChanged?.();
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

  /* ── chip helpers ── */
  function chipsFor(p: {
    frequency: string | null;
    publicationType: string | null;
  }) {
    return (
      <>
        {p.frequency && <span className="pub-chip">{p.frequency}</span>}
        {p.publicationType && (
          <span className="pub-chip pub-chip-alt">{p.publicationType}</span>
        )}
      </>
    );
  }

  /* ── render ── */
  return (
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div className="pub-planner-header">
        <div>
          <h2 style={{ margin: 0 }}>Publishers</h2>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {attached.length} selected · {mappable} on map
            {attached.length > mappable &&
              ` (${attached.length - mappable} not geocoded)`}
            {attached.length > 0 && attachedDmaCount > 0 && (
              <>
                {" "}· across {attachedDmaCount} DMA
                {attachedDmaCount === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginBottom: "0.75rem" }}>
          {error}
        </p>
      )}

      <CampaignMapPreview publishers={attached} />

      <div className="pub-planner pub-planner-flipped" style={{ marginTop: "1rem" }}>
        {/* ── Selected (left, primary) ── */}
        <div className="pub-planner-pane pub-planner-pane-primary">
          <div className="pub-planner-pane-header">
            <h3>Selected publishers</h3>
            <span className="pub-count-pill">
              {attached.length} selected
              {attached.length > 0 && attachedDmaCount > 0 && (
                <> · {attachedDmaCount} DMA{attachedDmaCount === 1 ? "" : "s"}</>
              )}
            </span>
          </div>

          {attachedLoading && (
            <p className="muted small">Loading selected publishers…</p>
          )}

          {!attachedLoading && attached.length === 0 && (
            <div className="pub-empty">
              <div className="pub-empty-title">Nothing selected yet</div>
              <p className="muted small" style={{ margin: 0 }}>
                Use the catalog on the right to add publishers to this
                campaign. Added publishers appear here and on the map above.
              </p>
            </div>
          )}

          {!attachedLoading && attached.length > 0 && (
            <ul className="pub-planner-selected">
              {attached.map((p) => {
                const loc = [p.city, p.state].filter(Boolean).join(", ");
                const removing =
                  busy?.kind === "removing" && busy.publisherId === p.id;
                const geo = p.latitude != null && p.longitude != null;
                const flashed = flashId === p.id;
                // Back-fill DMA from catalog since GET /campaigns/:id/publishers
                // doesn't return it. Safe: catalogById is keyed by publisher id.
                const dmaSource = catalogById.get(p.id);
                const dmaName = dmaSource?.dmaName ?? null;
                const dmaCode = dmaSource?.dmaCode ?? null;
                const dmaLabel =
                  dmaName && dmaCode
                    ? `${dmaName} (${dmaCode})`
                    : dmaName ?? dmaCode ?? null;
                return (
                  <li
                    key={p.id}
                    className={`pub-planner-selected-row${flashed ? " is-flashed" : ""}`}
                  >
                    <div className="pub-planner-selected-main">
                      <div className="pub-planner-selected-name">
                        <span
                          className={`pub-geo-dot${geo ? " is-on" : ""}`}
                          title={
                            geo
                              ? "Geocoded — shown on map"
                              : "Not geocoded — will not appear on map"
                          }
                          aria-hidden="true"
                        />
                        <span>{p.name}</span>
                      </div>
                      <div className="pub-planner-selected-meta small muted">
                        {loc || "Location unknown"}
                        {dmaLabel && <> · DMA {dmaLabel}</>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-remove"
                      onClick={() => onRemove(p.id)}
                      disabled={removing}
                      aria-label={`Remove ${p.name} from campaign`}
                    >
                      {removing ? "Removing…" : "Remove"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Catalog (right) ── */}
        <div className="pub-planner-pane">
          <div className="pub-planner-pane-header">
            <h3>Publisher catalog</h3>
            <span className="muted small">
              {filteredCatalog.length} of{" "}
              {catalog.filter((p) => p.isActive).length} available
            </span>
          </div>

          <div className="pub-planner-search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or state…"
              aria-label="Search publisher catalog"
            />
          </div>

          <div className="pub-planner-search" style={{ marginTop: "0.5rem" }}>
            <input
              type="search"
              value={fDma}
              onChange={(e) => setFDma(e.target.value)}
              placeholder="Filter by DMA (name or code)…"
              aria-label="Filter publisher catalog by DMA"
            />
          </div>

          <div className="pub-planner-filter-bar">
            <select
              value={fState}
              onChange={(e) => setFState(e.target.value)}
              aria-label="Filter by state"
            >
              <option value="">All states</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={fFrequency}
              onChange={(e) => setFFrequency(e.target.value)}
              aria-label="Filter by frequency"
            >
              <option value="">All frequencies</option>
              {frequencyOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={fFormat}
              onChange={(e) => setFFormat(e.target.value)}
              aria-label="Filter by publication type"
            >
              <option value="">All types</option>
              {formatOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={fCirc}
              onChange={(e) => setFCirc(e.target.value as CircKey)}
              aria-label="Filter by circulation"
            >
              {CIRC_BUCKETS.map((b) => (
                <option key={b.label} value={b.label}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {activeFilters.length > 0 && (
            <div className="pub-active-filters">
              <span className="small muted">
                {activeFilters.length} filter
                {activeFilters.length !== 1 ? "s" : ""} applied:
              </span>
              {activeFilters.map((f, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="pub-filter-chip"
                  onClick={f.clear}
                  aria-label={`Remove filter ${f.label}`}
                >
                  {f.label}
                  <span aria-hidden="true"> ×</span>
                </button>
              ))}
              <button
                type="button"
                className="pub-clear-link"
                onClick={clearAllFilters}
              >
                Clear all
              </button>
            </div>
          )}

          {catalogLoading && (
            <p className="muted small">Loading publisher catalog…</p>
          )}

          {!catalogLoading && filteredCatalog.length === 0 && (
            <div className="pub-empty">
              <div className="pub-empty-title">
                {catalog.length === 0
                  ? "No publishers in the catalog"
                  : "No matches"}
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                {catalog.length === 0
                  ? "Add publishers to the catalog to start planning campaigns."
                  : activeFilters.length > 0
                    ? "Try clearing some filters."
                    : "Every active publisher is already attached."}
              </p>
            </div>
          )}

          {!catalogLoading && filteredCatalog.length > 0 && (
            <div className="pub-catalog-list">
              {filteredCatalog.map((p) => {
                const loc = [p.city, p.state].filter(Boolean).join(", ");
                const adding =
                  busy?.kind === "adding" && busy.publisherId === p.id;
                const geo = p.latitude != null && p.longitude != null;
                return (
                  <div key={p.id} className="pub-catalog-row">
                    <div className="pub-catalog-main">
                      <div className="pub-catalog-name">
                        <span
                          className={`pub-geo-dot${geo ? " is-on" : ""}`}
                          title={
                            geo
                              ? "Geocoded"
                              : "Not geocoded — won't appear on map"
                          }
                          aria-hidden="true"
                        />
                        <span>{p.name}</span>
                      </div>
                      <div className="pub-catalog-meta small muted">
                        {loc || "Location unknown"}
                        {p.circulation != null && (
                          <>
                            {" "}
                            · {p.circulation.toLocaleString()} circ.
                          </>
                        )}
                        {(p.dmaName || p.dmaCode) && (
                          <>
                            {" "}· DMA{" "}
                            {p.dmaName && p.dmaCode
                              ? `${p.dmaName} (${p.dmaCode})`
                              : p.dmaName ?? p.dmaCode}
                          </>
                        )}
                      </div>
                      <div className="pub-catalog-chips">{chipsFor(p)}</div>
                    </div>
                    <button
                      type="button"
                      className="btn-add"
                      onClick={() => onAdd(p)}
                      disabled={adding}
                      aria-label={`Add ${p.name} to campaign`}
                      title={`Add ${p.name}`}
                    >
                      {adding ? "…" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

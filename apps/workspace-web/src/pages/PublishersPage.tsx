import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { PublisherMap } from "../components/maps/PublisherMap";
import { Chip } from "../components/publishers/Chip";
import {
  DetailsPanel,
  type Selection,
} from "../components/publishers/DetailsPanel";
import { DmaBrowser } from "../components/publishers/DmaBrowser";
import { ExportCsvButton } from "../components/publishers/ExportCsvButton";
import { Legend } from "../components/publishers/Legend";
import { PublisherOverlay } from "../components/publishers/PublisherOverlay";
import { SearchBar } from "../components/publishers/SearchBar";
import { SnapshotsCard } from "../components/publishers/SnapshotsCard";
import { StateGrid } from "../components/publishers/StateGrid";
import { StatsStrip } from "../components/publishers/StatsStrip";
import { TopDmasCard } from "../components/publishers/TopDmasCard";
import { ViewToggle, type View } from "../components/publishers/ViewToggle";
import {
  interpretQuery,
  loadDmaSummary,
  loadPublishers,
  searchPublishers,
  type DmaSummary,
  type Publisher,
} from "../data/publishers";

const MIN_SEARCH_LEN = 3;
const MOBILE_QUERY = "(max-width: 767px)";

type StateEntry = { state: string; count: number };

function aggregateStates(pubs: Publisher[]): StateEntry[] {
  const counts = new Map<string, number>();
  for (const p of pubs) counts.set(p.state, (counts.get(p.state) ?? 0) + 1);
  return Array.from(counts, ([state, count]) => ({ state, count })).sort(
    (a, b) => b.count - a.count || a.state.localeCompare(b.state),
  );
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export function PublishersPage() {
  const [publishers, setPublishers] = useState<Publisher[] | null>(null);
  const [dmaSummaries, setDmaSummaries] = useState<DmaSummary[] | null>(null);
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPublishers(), loadDmaSummary()])
      .then(([pubs, dmas]) => {
        if (cancelled) return;
        setPublishers(pubs);
        setDmaSummaries(dmas);
      })
      .catch((err: unknown) => {
        console.error("Failed to load publisher data:", err);
        if (!cancelled) {
          setLoadError("Could not load publisher data. Try reloading.");
          setPublishers([]);
          setDmaSummaries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allPublishers = publishers ?? [];
  const allDmas = dmaSummaries ?? [];
  const searchActive = query.trim().length >= MIN_SEARCH_LEN;

  const searched = useMemo(
    () =>
      searchActive
        ? searchPublishers(allPublishers, query)
        : allPublishers,
    [allPublishers, query, searchActive],
  );

  const filtered = useMemo(() => {
    if (selection === null) return searched;
    if (selection.kind === "dma") {
      return searched.filter((p) => p.dma_code === selection.code);
    }
    if (selection.kind === "state") {
      return searched.filter((p) => p.state === selection.state);
    }
    if (selection.kind === "cluster") {
      const set = new Set(selection.names);
      return searched.filter((p) => set.has(p.name));
    }
    return searched.filter((p) => p.name === selection.name);
  }, [searched, selection]);

  const stateCounts = useMemo(() => aggregateStates(searched), [searched]);

  const detailsPublishers = useMemo(() => {
    if (selection !== null) return filtered;
    if (searchActive) return searched;
    return [];
  }, [selection, searchActive, searched, filtered]);

  const filterActive =
    searchActive || selection !== null;

  const clearAll = useCallback(() => {
    setQuery("");
    setSelection(null);
    setView("map");
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);
  const clearSearch = useCallback(() => setQuery(""), []);

  const overlayPublisher = useMemo<Publisher | null>(() => {
    if (selection?.kind !== "publisher") return null;
    return allPublishers.find((p) => p.name === selection.name) ?? null;
  }, [selection, allPublishers]);

  const announce = useMemo(() => {
    if (loadError) return loadError;
    if (!filterActive) return "";
    const n = filtered.length;
    const noun = n === 1 ? "publisher" : "publishers";
    const q = query.trim();
    const interp = searchActive
      ? interpretQuery(allPublishers, q)
      : "text";
    if (selection?.kind === "dma")
      return `${n} ${noun} in ${selection.name} DMA${searchActive ? ` matching "${q}"` : ""}.`;
    if (selection?.kind === "state")
      return `${n} ${noun} in ${selection.state}${searchActive ? ` matching "${q}"` : ""}.`;
    if (selection?.kind === "cluster")
      return `${n} ${noun} in selected cluster.`;
    if (selection?.kind === "publisher")
      return `${selection.name} details shown.`;
    if (interp === "dma-code") {
      const dma = allDmas.find((d) => d.dma_code === q);
      return `${n} ${noun} in ${dma?.dma ?? ""} DMA (${q}).`;
    }
    if (interp === "zip") return `${n} ${noun} with ZIP starting ${q}.`;
    if (searchActive) return `${n} ${noun} match "${q}".`;
    return "";
  }, [
    filtered.length,
    searchActive,
    filterActive,
    selection,
    query,
    loadError,
    allPublishers,
    allDmas,
  ]);

  const selectedDmaCode =
    selection?.kind === "dma" ? selection.code : null;
  const selectedState =
    selection?.kind === "state" ? selection.state : null;

  const stats = [
    { label: "Publications", value: allPublishers.length },
    { label: "DMA zones", value: allDmas.length },
    {
      label: "States",
      value: new Set(allPublishers.map((p) => p.state)).size,
    },
  ];

  const onMarkerSelect = useCallback((p: Publisher) => {
    setSelection({ kind: "publisher", name: p.name });
  }, []);

  const onClusterSelect = useCallback((ps: Publisher[]) => {
    setSelection({ kind: "cluster", names: ps.map((p) => p.name) });
  }, []);

  return (
    <section className="page publishers-page">
      <PageHeader
        eyebrow="Research"
        title="Publishers"
        description={`Reference library · ${allPublishers.length} publications · ${new Set(allPublishers.map((p) => p.state)).size} states · ${allDmas.length} DMA zones`}
        actions={
          <div className="publishers-header-actions">
            <SearchBar value={query} onChange={setQuery} />
            <ExportCsvButton rows={filtered} />
          </div>
        }
      />

      <StatsStrip stats={stats} />

      <a href="#publishers-details" className="publishers-skip-link">
        Skip to publisher list
      </a>

      <div className="publishers-main-grid">
        <div className="publishers-map-col">
          <div className="publishers-view-row">
            <ViewToggle value={view} onChange={setView} />

            {filterActive && (
              <div
                className="publishers-breadcrumb"
                role="list"
                aria-label="Active filters"
              >
                {selection?.kind === "dma" && (
                  <Chip
                    label={`${selection.name} DMA`}
                    onRemove={clearSelection}
                    ariaLabel={`Remove ${selection.name} DMA filter`}
                  />
                )}
                {selection?.kind === "state" && (
                  <Chip
                    label={selection.state}
                    onRemove={clearSelection}
                    ariaLabel={`Remove ${selection.state} filter`}
                  />
                )}
                {selection?.kind === "cluster" && (
                  <Chip
                    label={`Cluster · ${selection.names.length}`}
                    onRemove={clearSelection}
                    ariaLabel="Remove cluster filter"
                  />
                )}
                {selection?.kind === "publisher" && (
                  <Chip
                    label={selection.name}
                    onRemove={clearSelection}
                    ariaLabel={`Remove ${selection.name} filter`}
                  />
                )}
                {searchActive && (
                  <Chip
                    label={`Search: "${query.trim()}"`}
                    onRemove={clearSearch}
                    ariaLabel="Clear search"
                  />
                )}
              </div>
            )}

            {filterActive ? (
              <button
                type="button"
                className="btn btn-primary btn-sm publishers-reset"
                onClick={clearAll}
                title="Reset all filters"
              >
                Clear filter · {filtered.length} of {allPublishers.length}
              </button>
            ) : (
              <button
                type="button"
                className="publishers-counter"
                disabled
                aria-label={`${allPublishers.length} publishers`}
              >
                {filtered.length} of {allPublishers.length}
              </button>
            )}
          </div>

          {view === "map" && (
            <PublisherMap
              markers={filtered}
              totalCount={allPublishers.length}
              onMarkerSelect={onMarkerSelect}
              onClusterSelect={onClusterSelect}
              onEscape={clearAll}
              onMapReady={setMapInstance}
            />
          )}
          {view === "dma" && (
            <DmaBrowser
              summaries={allDmas}
              query={query}
              selectedCode={selectedDmaCode}
              onSelect={(d) =>
                setSelection({ kind: "dma", code: d.dma_code, name: d.dma })
              }
            />
          )}
          {view === "state" && (
            <StateGrid
              states={stateCounts}
              selectedState={selectedState}
              onSelect={(s) => setSelection({ kind: "state", state: s })}
            />
          )}

          <Legend view={view} />
        </div>

        <aside
          id="publishers-details"
          className="publishers-details-col"
          aria-label="Publisher details"
        >
          <DetailsPanel
            selection={selection}
            publishers={detailsPublishers}
            searchActive={searchActive}
          />
        </aside>
      </div>

      <div className="publishers-secondary-grid">
        <TopDmasCard
          summaries={allDmas}
          selectedCode={selectedDmaCode}
          onSelect={(d) => {
            setSelection({ kind: "dma", code: d.dma_code, name: d.dma });
            if (view !== "map" && view !== "dma") setView("dma");
          }}
          onShowAll={() => setView("dma")}
        />
        <SnapshotsCard />
      </div>

      <PublisherOverlay
        publisher={overlayPublisher}
        map={mapInstance}
        mode={isMobile ? "mobile" : "desktop"}
        onClose={clearSelection}
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="visually-hidden"
      >
        {announce}
      </div>
    </section>
  );
}

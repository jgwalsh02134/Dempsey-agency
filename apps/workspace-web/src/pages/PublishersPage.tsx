import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { PublisherMap } from "../components/maps/PublisherMap";
import { DetailsPanel, type Selection } from "../components/publishers/DetailsPanel";
import { DmaBrowser } from "../components/publishers/DmaBrowser";
import { ExportCsvButton } from "../components/publishers/ExportCsvButton";
import { Legend } from "../components/publishers/Legend";
import { SearchBar } from "../components/publishers/SearchBar";
import { SnapshotsCard } from "../components/publishers/SnapshotsCard";
import { StateGrid } from "../components/publishers/StateGrid";
import { StatsStrip } from "../components/publishers/StatsStrip";
import { TopDmasCard } from "../components/publishers/TopDmasCard";
import { ViewToggle, type View } from "../components/publishers/ViewToggle";
import {
  loadDmaSummary,
  loadPublishers,
  searchPublishers,
  type DmaSummary,
  type Publisher,
} from "../data/publishers";

const MIN_SEARCH_LEN = 3;

type AggState = {
  stateCounts: Array<{ state: string; count: number }>;
};

function aggregateStates(pubs: Publisher[]): AggState["stateCounts"] {
  const counts = new Map<string, number>();
  for (const p of pubs) counts.set(p.state, (counts.get(p.state) ?? 0) + 1);
  return Array.from(counts, ([state, count]) => ({ state, count })).sort(
    (a, b) => b.count - a.count || a.state.localeCompare(b.state),
  );
}

export function PublishersPage() {
  const [publishers, setPublishers] = useState<Publisher[] | null>(null);
  const [dmaSummaries, setDmaSummaries] = useState<DmaSummary[] | null>(null);
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
    () => (searchActive ? searchPublishers(allPublishers, query) : allPublishers),
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
    return searched.filter((p) => p.name === selection.name);
  }, [searched, selection]);

  const stateCounts = useMemo(() => aggregateStates(searched), [searched]);

  const detailsPublishers = useMemo(() => {
    if (selection !== null) return filtered;
    if (searchActive) return searched;
    return [];
  }, [selection, searchActive, searched, filtered]);

  const announce = useMemo(() => {
    if (loadError) return loadError;
    if (!searchActive && selection === null) return "";
    const n = filtered.length;
    const noun = n === 1 ? "publisher" : "publishers";
    if (selection?.kind === "dma")
      return `${n} ${noun} in ${selection.name} DMA${searchActive ? ` matching "${query.trim()}"` : ""}.`;
    if (selection?.kind === "state")
      return `${n} ${noun} in ${selection.state}${searchActive ? ` matching "${query.trim()}"` : ""}.`;
    if (searchActive) return `${n} ${noun} match "${query.trim()}".`;
    return `${n} ${noun} selected.`;
  }, [filtered.length, searchActive, selection, query, loadError]);

  const selectedDmaCode =
    selection?.kind === "dma" ? selection.code : null;
  const selectedState =
    selection?.kind === "state" ? selection.state : null;

  const stats = [
    { label: "Publications", value: allPublishers.length },
    { label: "DMA zones", value: allDmas.length },
    { label: "States", value: new Set(allPublishers.map((p) => p.state)).size },
    { label: "Your snapshots", value: 0, hint: "Coming soon" },
  ];

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
            <span className="muted small">
              {filtered.length} of {allPublishers.length}
            </span>
          </div>

          {view === "map" && (
            <PublisherMap markers={filtered} />
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

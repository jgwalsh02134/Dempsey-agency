import type { View } from "./ViewToggle";

type LegendProps = {
  view: View;
};

export function Legend({ view }: LegendProps) {
  if (view === "map") {
    return (
      <div className="publishers-legend" aria-label="Map legend">
        <span className="publishers-legend-label">Cluster size</span>
        <span className="legend-chip legend-chip-sm" aria-hidden="true" />
        <span className="publishers-legend-meta">1–5</span>
        <span className="legend-chip legend-chip-md" aria-hidden="true" />
        <span className="publishers-legend-meta">6–20</span>
        <span className="legend-chip legend-chip-lg" aria-hidden="true" />
        <span className="publishers-legend-meta">21+</span>
        <span className="publishers-legend-hint">
          Click a cluster to drill in.
        </span>
      </div>
    );
  }
  if (view === "dma") {
    return (
      <div className="publishers-legend" aria-label="DMA view legend">
        <span className="publishers-legend-hint">
          87 Nielsen DMA zones, sorted by publisher count. Click a zone to
          filter.
        </span>
      </div>
    );
  }
  return (
    <div className="publishers-legend" aria-label="State view legend">
      <span className="publishers-legend-hint">
        41 states covered. Click a state to filter.
      </span>
    </div>
  );
}

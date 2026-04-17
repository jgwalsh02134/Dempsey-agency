import { useMemo } from "react";
import type { DmaSummary } from "../../data/publishers";

type DmaBrowserProps = {
  summaries: DmaSummary[];
  query: string;
  selectedCode: string | null;
  onSelect: (dma: DmaSummary) => void;
};

const MIN_SEARCH_LEN = 3;

function matches(d: DmaSummary, q: string): boolean {
  return (
    d.dma.toLowerCase().includes(q) ||
    d.dma_code.includes(q) ||
    d.states.some((s) => s.toLowerCase() === q)
  );
}

export function DmaBrowser({
  summaries,
  query,
  selectedCode,
  onSelect,
}: DmaBrowserProps) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q.length >= MIN_SEARCH_LEN
        ? summaries.filter((d) => matches(d, q))
        : summaries,
    [summaries, q],
  );

  if (filtered.length === 0) {
    return (
      <div className="dma-grid-empty">
        <p className="muted">No DMAs match the current search.</p>
      </div>
    );
  }

  return (
    <div className="dma-grid" role="list">
      {filtered.map((d) => {
        const selected = d.dma_code === selectedCode;
        return (
          <button
            key={d.dma_code}
            type="button"
            role="listitem"
            className="dma-card"
            aria-pressed={selected}
            onClick={() => onSelect(d)}
          >
            <div className="dma-card-head">
              <span className="dma-card-name">{d.dma}</span>
              <span className="dma-card-code mono">{d.dma_code}</span>
            </div>
            <div className="dma-card-meta">
              <span className="pill pill-neutral">{d.count} pubs</span>
              <span className="dma-card-states">
                {d.states.join(", ")}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

import type { DmaSummary } from "../../data/publishers";

type TopDmasCardProps = {
  summaries: DmaSummary[];
  limit?: number;
  selectedCode: string | null;
  onSelect: (dma: DmaSummary) => void;
  onShowAll: () => void;
};

export function TopDmasCard({
  summaries,
  limit = 8,
  selectedCode,
  onSelect,
  onShowAll,
}: TopDmasCardProps) {
  const top = summaries.slice(0, limit);
  const total = summaries.length;
  return (
    <section className="card top-dmas-card" aria-labelledby="top-dmas-title">
      <div className="top-dmas-head">
        <h2 id="top-dmas-title" className="top-dmas-title">
          Top DMA zones
        </h2>
        <span className="muted small">by publisher count</span>
      </div>
      <ol className="top-dmas-list">
        {top.map((d) => {
          const selected = d.dma_code === selectedCode;
          return (
            <li key={d.dma_code}>
              <button
                type="button"
                className="top-dmas-row"
                aria-pressed={selected}
                onClick={() => onSelect(d)}
              >
                <span className="top-dmas-name">{d.dma}</span>
                <span className="top-dmas-code mono">{d.dma_code}</span>
                <span className="pill pill-neutral top-dmas-count">
                  {d.count}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {total > limit && (
        <button
          type="button"
          className="btn btn-ghost btn-sm top-dmas-all"
          onClick={onShowAll}
        >
          Show all {total}
        </button>
      )}
    </section>
  );
}

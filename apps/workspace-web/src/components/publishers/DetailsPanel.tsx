import { useState } from "react";
import type { Publisher } from "../../data/publishers";
import { formatCirc } from "../../data/publishers";

export type Selection =
  | { kind: "dma"; code: string; name: string }
  | { kind: "state"; state: string }
  | { kind: "publisher"; name: string }
  | { kind: "cluster"; names: string[] }
  | null;

type DetailsPanelProps = {
  selection: Selection;
  publishers: Publisher[];
  searchActive: boolean;
};

const TRUNCATE_AT = 10;

function headline(selection: Selection, searchActive: boolean): string {
  if (selection === null) {
    return searchActive ? "Search results" : "Details";
  }
  if (selection.kind === "dma") return `${selection.name} DMA (${selection.code})`;
  if (selection.kind === "state") return selection.state;
  if (selection.kind === "cluster")
    return `Cluster · ${selection.names.length} publishers`;
  return selection.name;
}

export function DetailsPanel({
  selection,
  publishers,
  searchActive,
}: DetailsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (selection === null && !searchActive) {
    return (
      <div className="card details-panel details-panel-empty">
        <h2 className="details-panel-title">Details</h2>
        <p className="details-panel-prompt">
          Click a cluster, DMA, or state to see publications here.
        </p>
      </div>
    );
  }

  const total = publishers.length;
  const visible =
    expanded || total <= TRUNCATE_AT
      ? publishers
      : publishers.slice(0, TRUNCATE_AT);

  return (
    <div className="card details-panel">
      <div className="details-panel-head">
        <h2 className="details-panel-title">{headline(selection, searchActive)}</h2>
        <span className="pill pill-neutral">{total}</span>
      </div>

      {total === 0 ? (
        <p className="details-panel-prompt">
          No publishers match the current selection.
        </p>
      ) : (
        <>
          <ul className="details-list">
            {visible.map((p) => (
              <li
                key={`${p.name}-${p.city}-${p.state}`}
                className="details-list-item"
              >
                <div className="details-row-main">
                  <div className="details-row-name">{p.name}</div>
                  <div className="details-row-loc">
                    {p.city}, {p.state}
                    {p.zip ? ` · ${p.zip}` : ""}
                  </div>
                  {p.circ !== null && (
                    <div className="details-row-circ">
                      Circ. {formatCirc(p.circ)}
                    </div>
                  )}
                </div>
                <div className="details-row-aside">
                  <span
                    className="pill pill-neutral details-row-dma"
                    title={p.dma}
                  >
                    {p.dma_code}
                  </span>
                  <a
                    className="btn btn-ghost btn-sm"
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit site →
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {total > TRUNCATE_AT && (
            <button
              type="button"
              className="btn btn-ghost btn-sm details-panel-more"
              onClick={() => setExpanded((x) => !x)}
            >
              {expanded ? "Show fewer" : `Show all ${total}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import type { Publisher } from "../../data/publishers";
import { formatCirc } from "../../data/publishers";
import { ApiError } from "../../lib/api";
import {
  fetchPublisherSummary,
  formatRelativeTime,
  type PublisherSummary,
} from "../../lib/publisher-summary";

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

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: PublisherSummary }
  | { status: "error"; message: string };

const TRUNCATE_AT = 10;

function rowKey(p: Publisher): string {
  return `${p.name}|${p.city}|${p.state}`;
}

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
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});

  // Clear all summaries when the selection changes — spec: "cleared on
  // selection change".
  useEffect(() => {
    setSummaries({});
  }, [selection]);

  async function runSummary(p: Publisher, force: boolean) {
    const key = rowKey(p);
    setSummaries((prev) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const data = await fetchPublisherSummary(
        {
          name: p.name,
          url: p.url,
          city: p.city,
          state: p.state,
          dma: p.dma,
        },
        { force },
      );
      setSummaries((prev) => ({ ...prev, [key]: { status: "ok", data } }));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 429
            ? "Too many requests. Please wait a moment and try again."
            : err.message
          : "Could not reach the server.";
      setSummaries((prev) => ({
        ...prev,
        [key]: { status: "error", message },
      }));
    }
  }

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
            {visible.map((p) => {
              const key = rowKey(p);
              const state: SummaryState = summaries[key] ?? { status: "idle" };
              return (
                <li key={key} className="details-list-item">
                  <div className="details-row-top">
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
                        className="btn btn-ghost"
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Visit site →
                      </a>
                      {state.status === "idle" && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => runSummary(p, false)}
                          aria-label={`Summarize ${p.name}`}
                        >
                          Summarize
                        </button>
                      )}
                    </div>
                  </div>

                  {state.status === "loading" && (
                    <div
                      className="details-summary-skeleton"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <span className="sr-only">Generating summary…</span>
                      <div className="skeleton-line" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line skeleton-line-short" />
                    </div>
                  )}

                  {state.status === "ok" && (
                    <section
                      className="details-summary"
                      aria-label={`Summary of ${p.name}`}
                    >
                      <h4 className="details-summary-heading">Overview</h4>
                      <div className="details-summary-markdown">
                        <Markdown>{state.data.summary}</Markdown>
                      </div>
                      <div className="details-summary-footer">
                        <span>
                          Generated {formatRelativeTime(state.data.generated_at)}
                        </span>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => runSummary(p, true)}
                        >
                          Regenerate
                        </button>
                      </div>
                    </section>
                  )}

                  {state.status === "error" && (
                    <div className="details-summary-error" role="alert">
                      <span>{state.message}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => runSummary(p, false)}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
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

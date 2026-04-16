import { EmptyState } from "../components/EmptyState";

export function OverviewPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Overview</h1>
        <p>
          Landing surface for the internal workspace. Recent activity, pinned
          items, and team scratchpad will live here.
        </p>
      </header>
      <EmptyState
        initial="W"
        title="Nothing to show yet"
        description="Activity across publishers, markets, events, strategies, and projects will appear here as the workspace fills in."
      />
    </section>
  );
}

import { EmptyState } from "../components/EmptyState";

export function MarketsPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Markets</h1>
        <p>
          Vertical and geographic market studies. Captured here for internal
          reuse across pitches and strategies.
        </p>
      </header>
      <EmptyState
        initial="M"
        title="No market studies yet"
        description="Document a vertical deep-dive or a geo landscape and tag it for the team to reuse."
      />
    </section>
  );
}

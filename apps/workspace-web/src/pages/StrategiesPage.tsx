import { EmptyState } from "../components/EmptyState";

export function StrategiesPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Strategies</h1>
        <p>
          Hypotheses, positioning drafts, and strategic frameworks the team is
          developing. Pre-client, pre-commitment.
        </p>
      </header>
      <EmptyState
        initial="S"
        title="No strategies drafted yet"
        description="Start a working strategy — a hypothesis, a positioning angle, or a framework the team is exploring."
      />
    </section>
  );
}

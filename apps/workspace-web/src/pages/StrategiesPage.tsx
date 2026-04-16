import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function StrategiesPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Planning"
        title="Strategies"
        description="Hypotheses, positioning drafts, and strategic frameworks the team is developing. Pre-client, pre-commitment."
      />
      <EmptyState
        initial="S"
        title="No strategies drafted yet"
        description="Start a working strategy — a hypothesis, a positioning angle, or a framework the team is exploring."
      />
    </section>
  );
}

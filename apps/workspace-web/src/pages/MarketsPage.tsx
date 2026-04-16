import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function MarketsPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Research"
        title="Markets"
        description="Vertical and geographic market studies. Captured here for internal reuse across pitches and strategies."
      />
      <EmptyState
        initial="M"
        title="No market studies yet"
        description="Document a vertical deep-dive or a geo landscape and tag it for the team to reuse."
      />
    </section>
  );
}

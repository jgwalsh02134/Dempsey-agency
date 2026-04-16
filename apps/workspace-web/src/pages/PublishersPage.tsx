import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function PublishersPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Research"
        title="Publishers"
        description="Research notes and snapshots on publishers the team is evaluating. Independent of operational publisher records."
      />
      <EmptyState
        initial="P"
        title="No publisher snapshots yet"
        description="Capture notes, audiences, and rate-card observations for any publisher on your research list."
      />
    </section>
  );
}

import { EmptyState } from "../components/EmptyState";

export function PublishersPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Publishers</h1>
        <p>
          Research notes and snapshots on publishers the team is evaluating.
          Independent of operational publisher records.
        </p>
      </header>
      <EmptyState
        initial="P"
        title="No publisher snapshots yet"
        description="Capture notes, audiences, and rate-card observations for any publisher on your research list."
      />
    </section>
  );
}

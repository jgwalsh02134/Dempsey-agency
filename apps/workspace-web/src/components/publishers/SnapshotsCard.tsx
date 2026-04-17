import { EmptyState } from "../EmptyState";

export function SnapshotsCard() {
  return (
    <section className="card snapshots-card" aria-labelledby="snapshots-title">
      <div className="snapshots-head">
        <h2 id="snapshots-title" className="snapshots-title">
          Your research snapshots
        </h2>
      </div>
      <EmptyState
        initial="S"
        title="No snapshots yet"
        description="Research snapshots coming soon — pick a publisher to start a note."
      />
    </section>
  );
}

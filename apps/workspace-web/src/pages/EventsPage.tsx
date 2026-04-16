import { EmptyState } from "../components/EmptyState";

export function EventsPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Events</h1>
        <p>
          Industry events, pitch calendars, and internal milestones relevant to
          planning work.
        </p>
      </header>
      <EmptyState
        initial="E"
        title="No events tracked yet"
        description="Add an industry conference, client window, or internal deadline the team should be aware of."
      />
    </section>
  );
}

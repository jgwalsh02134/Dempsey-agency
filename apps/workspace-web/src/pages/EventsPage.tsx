import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function EventsPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Planning"
        title="Events"
        description="Industry events, pitch calendars, and internal milestones relevant to planning work."
      />
      <EmptyState
        initial="E"
        title="No events tracked yet"
        description="Add an industry conference, client window, or internal deadline the team should be aware of."
      />
    </section>
  );
}

import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function OverviewPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Landing surface for the internal workspace. Recent activity, pinned items, and team scratchpad will live here."
      />
      <EmptyState
        initial="W"
        title="Nothing to show yet"
        description="Activity across publishers, markets, events, strategies, and projects will appear here as the workspace fills in."
      />
    </section>
  );
}

import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function ProjectsPage() {
  return (
    <section className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Internal initiatives grouping research, strategies, and planning artifacts together."
      />
      <EmptyState
        initial="Pr"
        title="No projects yet"
        description="Create a project to group research, strategies, and planning work under a single initiative."
      />
    </section>
  );
}

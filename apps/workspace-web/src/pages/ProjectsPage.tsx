import { EmptyState } from "../components/EmptyState";

export function ProjectsPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Projects</h1>
        <p>
          Internal initiatives grouping research, strategies, and planning
          artifacts together.
        </p>
      </header>
      <EmptyState
        initial="Pr"
        title="No projects yet"
        description="Create a project to group research, strategies, and planning work under a single initiative."
      />
    </section>
  );
}

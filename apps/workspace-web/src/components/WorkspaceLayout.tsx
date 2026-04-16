import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/publishers", label: "Publishers" },
  { to: "/markets", label: "Markets" },
  { to: "/events", label: "Events" },
  { to: "/strategies", label: "Strategies" },
  { to: "/projects", label: "Projects" },
] as const;

export function WorkspaceLayout() {
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-title">Workspace</span>
          <span className="sidebar-subtitle">Internal</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item && item.end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="workspace-content">
        <Outlet />
      </main>
    </div>
  );
}

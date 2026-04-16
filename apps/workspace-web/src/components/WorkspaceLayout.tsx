import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/publishers", label: "Publishers" },
  { to: "/markets", label: "Markets" },
  { to: "/events", label: "Events" },
  { to: "/strategies", label: "Strategies" },
  { to: "/projects", label: "Projects" },
] as const;

export function WorkspaceLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="workspace-shell" data-nav-open={navOpen}>
      <aside
        id="workspace-sidebar"
        className="workspace-sidebar"
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <span className="sidebar-title">Workspace</span>
          <span className="sidebar-subtitle">Internal</span>
        </div>
        <nav className="sidebar-nav" aria-label="Sections">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item && item.end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? " active" : ""}`
              }
            >
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>

      {navOpen && (
        <button
          type="button"
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setNavOpen((v) => !v)}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls="workspace-sidebar"
          >
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
          </button>
          <span className="topbar-title">Workspace</span>
          <ThemeToggle />
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

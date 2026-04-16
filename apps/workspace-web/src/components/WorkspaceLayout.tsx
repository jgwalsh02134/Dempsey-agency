import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { BrandMark } from "./brand/BrandMark";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/publishers", label: "Publishers" },
  { to: "/markets", label: "Markets" },
  { to: "/events", label: "Events" },
  { to: "/strategies", label: "Strategies" },
  { to: "/projects", label: "Projects" },
] as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function WorkspaceLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;

    const mq = window.matchMedia("(max-width: 767.98px)");
    if (!mq.matches) return;

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusables = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);

    const initial = getFocusables();
    initial[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !sidebar.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !sidebar.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (previouslyFocused ?? triggerRef.current)?.focus();
    };
  }, [navOpen]);

  return (
    <div className="workspace-shell" data-nav-open={navOpen}>
      <aside
        id="workspace-sidebar"
        ref={sidebarRef}
        className="workspace-sidebar"
        aria-label="Primary navigation"
      >
        <div className="sidebar-brand">
          <BrandMark variant="mark" className="sidebar-brand-mark" alt="Dempsey" />
          <div className="sidebar-brand-text">
            <span className="sidebar-title">Workspace</span>
            <span className="sidebar-subtitle">Dempsey · Internal</span>
          </div>
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
          {session && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          )}
          <span className="sidebar-meta">
            {session ? (
              <span className="mono" title={session.email}>
                {session.email}
              </span>
            ) : (
              <>
                Workspace <span className="mono">v0.1</span>
              </>
            )}
          </span>
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
            ref={triggerRef}
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
          <BrandMark variant="mark" className="topbar-mark" alt="Dempsey" />
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

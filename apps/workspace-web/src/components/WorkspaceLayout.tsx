import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { FocusModeProvider, useFocusMode } from "../focus/FocusModeProvider";
import { AIStatusIndicator } from "./AIStatusIndicator";
import { BrandMark } from "./brand/BrandMark";
import { ThemeToggle } from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/publishers", label: "Publishers" },
  { to: "/markets", label: "Markets" },
  { to: "/events", label: "Events" },
  { to: "/strategies", label: "Strategies" },
  { to: "/projects", label: "Projects" },
  { to: "/integrations", label: "Integrations" },
] as const;

const ADMIN_NAV_ITEMS = [
  { to: "/admin/invites", label: "Invites" },
] as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const SHORTCUT_LABEL = IS_MAC ? "⌘." : "Ctrl+.";

export function WorkspaceLayout() {
  return (
    <FocusModeProvider>
      <WorkspaceShell />
    </FocusModeProvider>
  );
}

function WorkspaceShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { focusMode, toggle, setFocusMode } = useFocusMode();
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      navigate("/login", { replace: true });
    }
  };

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  const sidebarInert = focusMode && isDesktop;

  return (
    <div
      className="workspace-shell"
      data-nav-open={navOpen}
      data-focus-mode={focusMode}
    >
      <aside
        id="workspace-sidebar"
        ref={sidebarRef}
        className="workspace-sidebar"
        aria-label="Primary navigation"
        inert={sidebarInert}
      >
        <div className="sidebar-brand">
          <BrandMark variant="mark" className="sidebar-brand-mark" alt="Dempsey" />
          <div className="sidebar-brand-text">
            <span className="sidebar-title">Team Workspace</span>
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
          {user?.role === "admin" && (
            <>
              <div className="sidebar-section-header" aria-hidden="true">
                Admin
              </div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? " active" : ""}`
                  }
                >
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <a
            className="exit-link-btn"
            href="https://dempsey.agency/"
            rel="noreferrer"
            aria-label="Exit workspace and return to dempsey.agency"
          >
            ← dempsey.agency
          </a>
          <ThemeToggle />
          {user && (
            <button
              type="button"
              className="focus-toggle-btn"
              onClick={toggle}
              aria-pressed={focusMode}
              aria-keyshortcuts="Meta+Period Control+Period"
              aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
              title={`${focusMode ? "Exit focus mode" : "Focus mode"} (${SHORTCUT_LABEL})`}
            >
              <FocusIcon />
              <span>{focusMode ? "Exit focus mode" : "Focus mode"}</span>
            </button>
          )}
          {user && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
          {user && <AIStatusIndicator />}
          <span className="sidebar-meta">
            {user ? (
              <span className="mono" title={user.email}>
                {user.name ?? user.email}
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

      {focusMode && (
        <button
          type="button"
          className="focus-exit-pill"
          onClick={() => setFocusMode(false)}
          aria-label="Exit focus mode"
        >
          <FocusIcon />
          <span>Exit focus mode</span>
          <kbd>{SHORTCUT_LABEL}</kbd>
        </button>
      )}
    </div>
  );
}

function FocusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6V3H6" />
      <path d="M13 6V3H10" />
      <path d="M3 10V13H6" />
      <path d="M13 10V13H10" />
    </svg>
  );
}

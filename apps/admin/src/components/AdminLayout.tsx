import { useEffect, useId, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/endpoints";
import { subscribeToast } from "../lib/toast";

const GROUPS = [
  {
    label: "Work",
    items: [
      { to: "/", label: "Overview", end: true },
      { to: "/clients", label: "Clients", end: false },
      { to: "/campaigns", label: "Campaigns", end: false },
      { to: "/creatives", label: "Creatives", end: false },
    ],
  },
  {
    label: "Inventory",
    items: [{ to: "/publishers", label: "Publishers", end: false }],
  },
  {
    label: "Account",
    items: [
      { to: "/access", label: "Access", end: false },
      { to: "/notifications", label: "Notifications", end: false },
      { to: "/audit", label: "Audit", end: false },
      { to: "/agency", label: "Agency", end: false },
    ],
  },
] as const;

function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => {
      api
        .fetchUnreadNotificationCount()
        .then((res) => {
          if (!cancelled) setCount(res.count);
        })
        .catch(() => {
          /* keep the last count */
        });
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, location.pathname]);

  return count;
}

export function AdminLayout() {
  const { session, logout } = useAuth();
  const unreadCount = useUnreadCount(Boolean(session));
  const location = useLocation();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin-sidebar") === "collapsed",
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    localStorage.setItem("admin-sidebar", collapsed ? "collapsed" : "open");
  }, [collapsed]);

  useEffect(() => subscribeToast(setToastMessage), []);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className={`admin-shell${collapsed ? " is-collapsed" : ""}${menuOpen ? " is-menu-open" : ""}`}>
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <header className="admin-topbar">
        <button
          type="button"
          className="icon-btn"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <span className="admin-topbar-title">Admin</span>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside id={menuId} className="admin-sidebar">
        <div className="sidebar-brand">
          <img src="/da-logo.svg" alt="" className="sidebar-logo" />
          <span className="sidebar-title">Admin</span>
          <button
            type="button"
            className="icon-btn collapse-toggle"
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Admin">
          {GROUPS.map((group) => (
            <div key={group.label} className="sidebar-group">
              <p className="sidebar-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? " active" : ""}`
                  }
                  title={item.label}
                >
                  <span className="sidebar-label">{item.label}</span>
                  {item.to === "/notifications" && unreadCount > 0 && (
                    <span className="nav-badge" aria-label={`${unreadCount} unread`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {session && (
            <div className="sidebar-user">
              <span className="sidebar-user-name">
                {session.name ?? session.email}
              </span>
              {session.name && (
                <span className="sidebar-user-email muted small">{session.email}</span>
              )}
            </div>
          )}
          <button type="button" className="btn ghost sidebar-logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main id="admin-content" className="admin-content" tabIndex={-1}>
        <Outlet />
      </main>

      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

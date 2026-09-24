import { useEffect, useId, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/endpoints";

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
    items: [
      { to: "/publishers", label: "Publishers", end: true },
      { to: "/publishers/explorer", label: "Explorer", end: false },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/access", label: "Access", end: false },
      { to: "/notifications", label: "Alerts", end: false },
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
        .catch(() => {});
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
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <header className="admin-topbar">
        <button
          type="button"
          className="btn ghost"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <span className="sidebar-title">Admin</span>
      </header>
      {open && (
        <button
          type="button"
          className="admin-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id={menuId} className={`admin-sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/da-logo.svg" alt="" className="sidebar-logo" />
          <span className="sidebar-title">Admin</span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin">
          {GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? " active" : ""}`
                  }
                >
                  <span>{item.label}</span>
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
              <span className="sidebar-user-name">{session.name ?? session.email}</span>
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
    </div>
  );
}

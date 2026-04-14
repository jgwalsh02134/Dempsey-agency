import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/endpoints";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/agency", label: "Agency" },
  { to: "/clients", label: "Clients" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/publishers", label: "Publishers" },
  { to: "/creatives", label: "Creatives" },
  { to: "/notifications", label: "Notifications" },
  { to: "/access", label: "Access" },
] as const;

function useUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      api
        .fetchUnreadNotificationCount()
        .then((res) => setCount(res.count))
        .catch(() => {
          /* non-blocking */
        });
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, location.pathname]);

  return count;
}

export function AdminLayout() {
  const { session, logout } = useAuth();
  const unreadCount = useUnreadCount(Boolean(session));

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src="/da-logo.svg" alt="Dempsey Agency" className="sidebar-logo" />
          <span className="sidebar-title">Admin</span>
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
              style={
                item.to === "/notifications"
                  ? {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }
                  : undefined
              }
            >
              <span>{item.label}</span>
              {item.to === "/notifications" && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread`}
                  style={{
                    display: "inline-block",
                    minWidth: "1.25rem",
                    padding: "0 0.4rem",
                    borderRadius: "999px",
                    background: "#dc2626",
                    color: "#fff",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    lineHeight: "1.25rem",
                    textAlign: "center",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {session && (
            <div className="sidebar-user">
              <span className="sidebar-user-name">
                {session.name ?? session.email}
              </span>
              <span className="sidebar-user-email muted small">
                {session.name ? session.email : ""}
              </span>
            </div>
          )}
          <button type="button" className="btn ghost sidebar-logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}

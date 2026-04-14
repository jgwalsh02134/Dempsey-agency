import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MARKETING_URL } from "../api/config";
import * as api from "../api/endpoints";

/** Poll the unread count while the tab is focused. Keeps the header badge
 *  fresh without a websocket — 60s is plenty for a workflow signal. */
function useUnreadCount(enabled: boolean): {
  count: number;
  refresh: () => void;
} {
  const [count, setCount] = useState(0);
  const location = useLocation();

  const refresh = () => {
    api
      .fetchUnreadNotificationCount()
      .then((res) => setCount(res.count))
      .catch(() => {
        /* non-blocking: count stays stale rather than breaking the shell */
      });
  };

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = window.setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Also refetch whenever the route changes — covers returning from the
  // notifications page where items were just marked read.
  useEffect(() => {
    if (enabled) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, enabled]);

  return { count, refresh };
}

export function PortalLayout() {
  const { session, logout, loading, token } = useAuth();
  const { count: unreadCount } = useUnreadCount(Boolean(session));

  if (loading && token) {
    return (
      <div className="page-center" aria-busy="true">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="portal">
      <header className="portal-header">
        <div className="portal-header-top">
          <div className="portal-brand">
            <img
              src="/d-fav.svg"
              alt="Dempsey Agency"
              className="portal-logo"
            />
            <span className="portal-title">Client Portal</span>
          </div>
          <div className="portal-header-actions">
            <a href={MARKETING_URL} className="btn-back-to-site">
              <span className="back-to-site-full">&larr; Back to site</span>
              <span className="back-to-site-short">&larr; Home</span>
            </a>
            <Link
              to="/notifications"
              className="btn-sign-out"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              style={{ position: "relative" }}
            >
              Notifications
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    marginLeft: "0.4rem",
                    display: "inline-block",
                    minWidth: "1.25rem",
                    padding: "0 0.4rem",
                    borderRadius: "999px",
                    background: "#dc2626",
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    lineHeight: "1.25rem",
                    textAlign: "center",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <button type="button" className="btn-sign-out" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="portal-nav" aria-label="Portal navigation">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/campaigns" className={navLinkClass}>
            Campaigns
          </NavLink>
          <NavLink to="/documents" className={navLinkClass}>
            Documents
          </NavLink>
          <NavLink to="/billing" className={navLinkClass}>
            Billing
          </NavLink>
          <NavLink to="/creatives" className={navLinkClass}>
            Creatives
          </NavLink>
        </nav>
      </header>

      <main className="portal-main">
        <Outlet />
      </main>
    </div>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "portal-nav-link active" : "portal-nav-link";
}

import { useEffect, useId, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MARKETING_URL } from "../api/config";
import * as api from "../api/endpoints";

const PRIMARY_NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/campaigns", label: "Campaigns", end: false },
  { to: "/creatives", label: "Creatives", end: false },
  { to: "/documents", label: "Documents", end: false },
  { to: "/billing", label: "Billing", end: false },
] as const;

const TAB_NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/campaigns", label: "Campaigns", end: false },
  { to: "/creatives", label: "Creatives", end: false },
  { to: "/documents", label: "Docs", end: false },
  { to: "/notifications", label: "Alerts", end: false },
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

export function PortalLayout() {
  const { session, logout, loading, token } = useAuth();
  const unreadCount = useUnreadCount(Boolean(session));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const location = useLocation();

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

  if (loading && token) {
    return (
      <div className="page-center" aria-busy="true">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return null;

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="portal">
      <a className="skip-link" href="#portal-content">
        Skip to content
      </a>
      <header className="portal-header">
        <div className="portal-header-top">
          <Link to="/" className="portal-brand">
            <img src="/d-fav.svg" alt="" className="portal-logo" />
            <span className="portal-title">Client Portal</span>
          </Link>
          <div className="portal-header-actions">
            <Link
              to="/notifications"
              className="icon-button"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
            >
              Alerts
              {unreadCount > 0 && (
                <span className="nav-badge" aria-hidden="true">
                  {badge}
                </span>
              )}
            </Link>
            <a href={MARKETING_URL} className="btn-back-to-site desktop-only">
              Back to site
            </a>
            <button type="button" className="btn-sign-out desktop-only" onClick={logout}>
              Sign out
            </button>
            <button
              type="button"
              className="icon-button menu-toggle"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
        </div>
        <nav className="portal-nav" aria-label="Portal">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div
            id={menuId}
            className="nav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More"
            onClick={(event) => event.stopPropagation()}
          >
            <nav className="nav-sheet-links" aria-label="All sections">
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
              <NavLink to="/notifications" className={navLinkClass}>
                Notifications{unreadCount > 0 ? ` (${badge})` : ""}
              </NavLink>
            </nav>
            <a className="btn-hero" href={MARKETING_URL}>
              Back to dempsey.agency
            </a>
            <button type="button" className="btn-hero" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      )}

      <main id="portal-content" className="portal-main" tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="portal-tabbar" aria-label="Primary">
        {TAB_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
          >
            <span>{item.label}</span>
            {item.to === "/notifications" && unreadCount > 0 && (
              <span className="nav-badge" aria-hidden="true">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "portal-nav-link active" : "portal-nav-link";
}

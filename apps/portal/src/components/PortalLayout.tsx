import { useEffect, useId, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useOrg } from "../auth/OrgContext";
import { MARKETING_URL } from "../api/config";
import * as api from "../api/endpoints";
import type { Campaign, Document, Invoice } from "../types";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/campaigns", label: "Campaigns", end: false },
  { to: "/approvals", label: "Approvals", end: false },
  { to: "/creatives", label: "Creatives", end: false },
  { to: "/documents", label: "Documents", end: false },
  { to: "/billing", label: "Billing", end: false },
] as const;

const TAB_NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/campaigns", label: "Campaigns", end: false },
  { to: "/approvals", label: "Approve", end: false },
  { to: "/creatives", label: "Creatives", end: false },
] as const;

interface FindHit {
  kind: "Campaign" | "Document" | "Invoice";
  title: string;
  detail: string;
  to: string;
}

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

export function PortalLayout() {
  const { session, logout, loading, token } = useAuth();
  const { orgId, setOrgId, memberships, organizationName } = useOrg();
  const unreadCount = useUnreadCount(Boolean(session));
  const [menuOpen, setMenuOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const menuId = useId();
  const findId = useId();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setFindOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen && !findOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setFindOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, findOpen]);

  if (loading && token) {
    return (
      <div className="page-center" aria-busy="true">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return null;

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  const displayName = session.name || session.email;

  return (
    <div className="portal app-shell">
      <a className="skip-link" href="#portal-content">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <Link to="/" className="portal-brand">
          <img src="/d-fav.svg" alt="" className="portal-logo" />
          <span className="portal-title">Client Portal</span>
        </Link>
        {memberships.length > 1 ? (
          <label className="sidebar-org">
            <span>Organization</span>
            <select value={orgId} onChange={(event) => setOrgId(event.target.value)}>
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organization.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          organizationName && <p className="sidebar-org-name">{organizationName}</p>
        )}
        <button
          type="button"
          className="sidebar-find"
          aria-expanded={findOpen}
          aria-controls={findId}
          onClick={() => setFindOpen(true)}
        >
          Find
        </button>
        <nav className="sidebar-nav" aria-label="Portal">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/notifications" className={navLinkClass}>
            Alerts
            {unreadCount > 0 && (
              <span className="nav-badge" aria-hidden="true">
                {badge}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-user">{displayName}</p>
          <a href={MARKETING_URL}>Back to site</a>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-column">
        <header className="portal-header">
          <div className="portal-header-top">
            <Link to="/" className="portal-brand mobile-brand">
              <img src="/d-fav.svg" alt="" className="portal-logo" />
              <span className="portal-title">Portal</span>
            </Link>
            <div className="portal-header-actions">
              <button
                type="button"
                className="icon-button"
                aria-expanded={findOpen}
                aria-controls={findId}
                onClick={() => setFindOpen(true)}
              >
                Find
              </button>
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
              <button
                type="button"
                className="icon-button menu-toggle"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                More
              </button>
            </div>
          </div>
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
              <p className="sidebar-user">{displayName}</p>
              {memberships.length > 1 && (
                <label className="sidebar-org">
                  <span>Organization</span>
                  <select value={orgId} onChange={(event) => setOrgId(event.target.value)}>
                    {memberships.map((m) => (
                      <option key={m.organizationId} value={m.organizationId}>
                        {m.organization.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <nav className="nav-sheet-links" aria-label="All sections">
                {NAV.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                    {item.label}
                  </NavLink>
                ))}
                <NavLink to="/notifications" className={navLinkClass}>
                  Alerts{unreadCount > 0 ? ` (${badge})` : ""}
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

        {findOpen && (
          <FindDialog id={findId} orgId={orgId} onClose={() => setFindOpen(false)} />
        )}

        <main id="portal-content" className="portal-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="portal-tabbar" aria-label="Primary">
        {TAB_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="portal-nav-link" onClick={() => setMenuOpen(true)}>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

function FindDialog({
  id,
  orgId,
  onClose,
}: {
  id: string;
  orgId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<FindHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.fetchOrgCampaigns(orgId).catch(() => ({ campaigns: [] as Campaign[] })),
      api.fetchOrgDocuments(orgId).catch(() => ({ documents: [] as Document[] })),
      api.fetchOrgInvoices(orgId).catch(() => ({ invoices: [] as Invoice[] })),
    ]).then(([campaigns, documents, invoices]) => {
      if (cancelled) return;
      const next: FindHit[] = [
        ...campaigns.campaigns.map((c) => ({
          kind: "Campaign" as const,
          title: c.title,
          detail: c.status,
          to: `/campaigns/${c.id}`,
        })),
        ...documents.documents.map((d) => ({
          kind: "Document" as const,
          title: d.title,
          detail: d.category,
          to: "/documents",
        })),
        ...invoices.invoices.map((inv) => ({
          kind: "Invoice" as const,
          title: inv.title,
          detail: inv.status,
          to: "/billing",
        })),
      ];
      setHits(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hits.slice(0, 8);
    return hits.filter((hit) => hit.title.toLowerCase().includes(q)).slice(0, 12);
  }, [hits, query]);

  return (
    <div className="sheet-backdrop find-backdrop" onClick={onClose}>
      <div
        id={id}
        className="find-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Find"
        onClick={(event) => event.stopPropagation()}
      >
        <label htmlFor={`${id}-q`}>Find a campaign, document, or invoice</label>
        <input
          id={`${id}-q`}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a name"
        />
        {loading && <p className="text-muted">Loading…</p>}
        {!loading && shown.length === 0 && (
          <p className="text-muted">No matches.</p>
        )}
        <ul className="find-results">
          {shown.map((hit) => (
            <li key={`${hit.kind}-${hit.title}-${hit.to}`}>
              <button
                type="button"
                onClick={() => {
                  navigate(hit.to);
                  onClose();
                }}
              >
                <span className="find-kind">{hit.kind}</span>
                <span>{hit.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? "portal-nav-link active" : "portal-nav-link";
}

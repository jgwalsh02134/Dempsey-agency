import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function PortalLayout() {
  const { session, logout, loading, token } = useAuth();

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
              src="/brand-stack.svg"
              alt="Dempsey Agency"
              className="portal-logo"
            />
            <span className="portal-title">Client Portal</span>
          </div>
          <button type="button" className="btn-sign-out" onClick={logout}>
            Sign out
          </button>
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

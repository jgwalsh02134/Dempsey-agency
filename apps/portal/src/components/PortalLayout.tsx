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
        <div className="portal-header-inner">
          <div className="portal-brand">
            <img
              src="/favicon.svg"
              alt=""
              className="portal-mark"
              width="24"
              height="24"
            />
            <span className="portal-title">Client Portal</span>
          </div>
          <div className="portal-header-right">
            <nav className="portal-nav" aria-label="Portal navigation">
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/reports" className={navLinkClass}>
                Reports
              </NavLink>
            </nav>
            <button type="button" className="btn-sign-out" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
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

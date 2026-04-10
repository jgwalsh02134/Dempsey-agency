import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/agency", label: "Agency" },
  { to: "/clients", label: "Clients" },
  { to: "/publishers", label: "Publishers" },
  { to: "/creatives", label: "Creatives" },
  { to: "/access", label: "Access" },
] as const;

export function AdminLayout() {
  const { session, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">DA</span>
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
            >
              {item.label}
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

import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
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

  const displayName = session.name || session.email;

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
          <button type="button" className="btn-sign-out" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="portal-main">
        <section className="section-welcome">
          <h1 className="welcome-heading">Welcome, {displayName}</h1>
          <p className="welcome-body">
            Campaign reports, placement details, and account tools will appear
            here as your portal is built out.
          </p>
        </section>

        <div className="section-grid">
          <section className="section-block">
            <h2 className="section-heading">Account</h2>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Email</dt>
                <dd>{session.email}</dd>
              </div>
              {session.name && (
                <div className="detail-row">
                  <dt>Name</dt>
                  <dd>{session.name}</dd>
                </div>
              )}
            </dl>
          </section>

          {session.memberships.length > 0 && (
            <section className="section-block">
              <h2 className="section-heading">Organizations</h2>
              <ul className="org-list">
                {session.memberships.map((m) => (
                  <li key={m.id} className="org-item">
                    <span className="org-name">{m.organization.name}</span>
                    <span className="org-role">
                      {m.role.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

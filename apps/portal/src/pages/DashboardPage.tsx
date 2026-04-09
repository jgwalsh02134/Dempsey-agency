import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  const displayName = session.name || session.email;

  return (
    <>
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

      <section className="section-status">
        <h2 className="section-heading">Portal Status</h2>
        <ul className="status-list">
          <li className="status-item">
            <span className="status-indicator status-active" />
            <div className="status-content">
              <span className="status-label">Portal access is active</span>
              <span className="status-detail">
                Your account is authenticated and connected.
              </span>
            </div>
          </li>
          <li className="status-item">
            <span className="status-indicator status-pending" />
            <div className="status-content">
              <span className="status-label">Campaign reporting</span>
              <span className="status-detail">
                Placement data and performance reports are being connected.
              </span>
            </div>
          </li>
          <li className="status-item">
            <span className="status-indicator status-pending" />
            <div className="status-content">
              <span className="status-label">Client tools</span>
              <span className="status-detail">
                Document sharing, invoicing, and media plan review are in
                development.
              </span>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}

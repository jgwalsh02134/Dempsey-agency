import type { SessionUser } from "../types";

export function SessionPanel({ session }: { session: SessionUser }) {
  return (
    <section className="card">
      <h2>Session</h2>
      <dl className="dl-grid">
        <dt>User ID</dt>
        <dd>
          <code>{session.id}</code>
        </dd>
        <dt>Email</dt>
        <dd>{session.email}</dd>
        <dt>Name</dt>
        <dd>{session.name ?? "—"}</dd>
      </dl>
      <h3 className="h3-spaced">Memberships</h3>
      <ul className="membership-list">
        {session.memberships.map((m) => (
          <li key={m.id}>
            <strong>{m.organization.name}</strong>
            <span className="muted"> · {m.organization.type}</span>
            <br />
            <code className="small">{m.organizationId}</code>
            <span className="role-pill">{m.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

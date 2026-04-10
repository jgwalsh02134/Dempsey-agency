import { Link } from "react-router-dom";

export function AccessPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Access Management</h1>
      </div>
      <p className="muted">
        Account requests are now managed under{" "}
        <Link to="/clients" style={{ color: "var(--primary)" }}>
          Clients
        </Link>
        .
      </p>
    </div>
  );
}

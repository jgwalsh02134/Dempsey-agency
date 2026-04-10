import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { AccountRequestsSection } from "../components/AccountRequestsSection";
import { CreateClientOrgForm } from "../components/CreateClientOrgForm";
import type { Organization } from "../types";

export function ClientsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.fetchOrganizations();
      setOrgs(list);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Failed to load organizations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientOrgs = orgs.filter((o) => o.type === "CLIENT");
  const agencyOrgs = orgs.filter((o) => o.type === "AGENCY");

  return (
    <div className="clients-page">
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading clients…</p>}

      {!loading && clientOrgs.length === 0 && (
        <p className="muted">No client organizations yet.</p>
      )}

      {clientOrgs.length > 0 && (
        <div className="client-grid">
          {clientOrgs.map((org) => (
            <Link
              key={org.id}
              to={`/clients/${org.id}`}
              className="client-card-link"
            >
              <div className="card client-card">
                <h3 className="client-card-name">{org.name}</h3>
                <span className="muted small">
                  Created{" "}
                  {new Date(org.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section style={{ marginTop: "2rem", maxWidth: "480px" }}>
        <CreateClientOrgForm
          agencyOrganizations={agencyOrgs}
          onCreated={() => void load()}
        />
      </section>

      <div style={{ marginTop: "2rem" }}>
        <AccountRequestsSection organizations={orgs} />
      </div>
    </div>
  );
}

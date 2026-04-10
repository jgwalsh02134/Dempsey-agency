import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { AccountRequestsSection } from "../components/AccountRequestsSection";
import type { Organization } from "../types";

export function AccessPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrgs(await api.fetchOrganizations());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Access Management</h1>
      </div>
      {error && <p className="error">{error}</p>}
      <AccountRequestsSection organizations={orgs} />
    </div>
  );
}

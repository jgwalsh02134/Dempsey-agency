import { type FormEvent, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Organization } from "../types";

export function CreateClientOrgForm({
  agencyOrganizations,
  onCreated,
}: {
  agencyOrganizations: Organization[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [agencyId, setAgencyId] = useState(agencyOrganizations[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agencyOrganizations.length === 0) return;
    setAgencyId((prev) =>
      prev && agencyOrganizations.some((o) => o.id === prev)
        ? prev
        : agencyOrganizations[0].id,
    );
  }, [agencyOrganizations]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const org = await api.createClientOrganization({
        name: name.trim(),
        agencyOrganizationId: agencyId,
      });
      setSuccess(`Created client org “${org.name}” (${org.id})`);
      setName("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (agencyOrganizations.length === 0) {
    return (
      <section className="card muted">
        <h2>Create client organization</h2>
        <p>No agency organizations available.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Create client organization</h2>
      <form onSubmit={onSubmit} className="stack">
        <label className="field">
          <span>Client organization name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
          />
        </label>
        <label className="field">
          <span>Parent agency</span>
          <select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            required
          >
            {agencyOrganizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="success" role="status">
            {success}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Creating…" : "Create client org"}
        </button>
      </form>
    </section>
  );
}

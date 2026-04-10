import { type FormEvent, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Organization, OrganizationType, Role } from "../types";

const AGENCY_ROLES: Role[] = ["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"];
const CLIENT_ROLES: Role[] = ["CLIENT_ADMIN", "CLIENT_USER"];

function rolesForOrgType(t: OrganizationType): Role[] {
  return t === "AGENCY" ? AGENCY_ROLES : CLIENT_ROLES;
}

function emailMatchesAllowedDomains(
  email: string,
  suffixes: string[],
): boolean {
  const norm = email.trim().toLowerCase();
  return suffixes.some((s) => norm.endsWith(s.toLowerCase()));
}

export function CreateUserForm({
  organizations,
  defaultOrgId,
  allowedEmailDomainSuffixes,
  heading = "Create user",
  onCreated,
}: {
  organizations: Organization[];
  defaultOrgId: string;
  /** If set, email must end with one of these suffixes (e.g. "@dempsey.agency"). */
  allowedEmailDomainSuffixes?: string[];
  heading?: string;
  onCreated?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState(defaultOrgId);
  const [role, setRole] = useState<Role>("STAFF");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId),
    [organizations, organizationId],
  );

  const roleOptions = selectedOrg
    ? rolesForOrgType(selectedOrg.type)
    : AGENCY_ROLES;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmedEmail = email.trim();
    if (
      allowedEmailDomainSuffixes?.length &&
      !emailMatchesAllowedDomains(trimmedEmail, allowedEmailDomainSuffixes)
    ) {
      setError(
        `Email must be one of: ${allowedEmailDomainSuffixes.join(", ")}`,
      );
      return;
    }
    setLoading(true);
    try {
      const body: {
        email: string;
        password: string;
        organizationId: string;
        role: Role;
        name?: string;
      } = {
        email: trimmedEmail,
        password,
        organizationId,
        role,
      };
      if (name.trim()) body.name = name.trim();
      await api.createUser(body);
      setSuccess(`User ${body.email} created.`);
      setEmail("");
      setPassword("");
      setName("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <section className="card">
      <h2>{heading}</h2>
      <form onSubmit={onSubmit} className="stack">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password (min 8 characters)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Organization</span>
          <select
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              const o = organizations.find((x) => x.id === e.target.value);
              if (o) {
                setRole(
                  o.type === "AGENCY" ? "STAFF" : "CLIENT_USER",
                );
              }
            }}
            required
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.type})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            required
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
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
          {loading ? "Creating…" : "Create user"}
        </button>
      </form>
    </section>
  );
}

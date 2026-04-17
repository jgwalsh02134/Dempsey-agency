import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { ApiError, apiJson } from "../lib/api";

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

type InvitedBy = {
  id: string;
  email: string | null;
  name: string | null;
};

type Invite = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedBy: InvitedBy | null;
  acceptUrl: string | null;
};

type CreateInviteResponse = {
  invite: {
    id: string;
    email: string;
    role: string;
    expiresAt: string;
    acceptUrl: string;
  };
};

const ROLES: Array<{ value: "member" | "admin"; label: string }> = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

const STATUS_PILL: Record<InviteStatus, string> = {
  pending: "pill-info",
  accepted: "pill-success",
  expired: "pill-warning",
  revoked: "pill-error",
};

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justCreated, setJustCreated] =
    useState<CreateInviteResponse["invite"] | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setListError(null);
    try {
      const res = await apiJson<{ invites: Invite[] }>(
        "/api/workspace/auth/invite",
      );
      setInvites(res.invites);
    } catch (err) {
      setInvites([]);
      if (err instanceof ApiError) setListError(err.message);
      else setListError("Could not load invites.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        email: email.trim(),
        role,
      };
      const trimmedName = name.trim();
      if (trimmedName) body.name = trimmedName;

      const res = await apiJson<CreateInviteResponse>(
        "/api/workspace/auth/invite",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      setJustCreated(res.invite);
      setEmail("");
      setName("");
      setRole("member");
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Could not create invite. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1500);
    } catch {
      // Some browsers require a user gesture + secure context. Fall back to
      // prompt so the admin can still grab the link.
      window.prompt("Copy invite link", url);
    }
  };

  const revoke = async (id: string, email: string) => {
    const ok = window.confirm(
      `Revoke the invite for ${email}? The link will stop working.`,
    );
    if (!ok) return;

    setRevokingId(id);
    try {
      await apiJson<{ invite: Invite }>(
        `/api/workspace/auth/invite/${encodeURIComponent(id)}/revoke`,
        { method: "POST" },
      );
      await reload();
    } catch (err) {
      if (err instanceof ApiError) setListError(err.message);
      else setListError("Could not revoke invite.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="page">
      <PageHeader
        eyebrow="Admin"
        title="Invites"
        description="Provision access to Team Workspace. Invite links are single-use, expire automatically, and can be revoked at any time."
      />

      <section className="card invite-create-card" aria-labelledby="invite-create-heading">
        <h2 id="invite-create-heading" className="invite-create-title">
          Invite a new user
        </h2>
        <form className="invite-create-form" onSubmit={onCreate} noValidate>
          <div className="field">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@dempsey.agency"
              disabled={submitting}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-name-input">Name (optional)</label>
            <input
              id="invite-name-input"
              type="text"
              autoComplete="off"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "member" | "admin")}
              disabled={submitting}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="invite-create-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Send invite"}
            </button>
          </div>
          {formError && (
            <p className="auth-error" role="alert">
              {formError}
            </p>
          )}
        </form>

        {justCreated && (
          <div className="invite-created-callout" role="status">
            <div className="invite-created-text">
              <strong>Invite created for {justCreated.email}.</strong>
              <span className="muted small">
                Share this link — it expires{" "}
                {formatDate(justCreated.expiresAt)}.
              </span>
            </div>
            <div className="invite-created-link">
              <input
                type="text"
                readOnly
                value={justCreated.acceptUrl}
                aria-label="Invite acceptance URL"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => copyLink(justCreated.id, justCreated.acceptUrl)}
              >
                {copiedId === justCreated.id ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        )}
      </section>

      {listError && (
        <p className="auth-error" role="alert" style={{ marginBottom: "1rem" }}>
          {listError}
        </p>
      )}

      {invites === null ? (
        <p className="muted">Loading invites…</p>
      ) : invites.length === 0 ? (
        <EmptyState
          initial="I"
          title="No invites yet"
          description="Admins can create secure single-use invite links for new workspace users. Use the form above to send one."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Invited</th>
                <th scope="col">Expires</th>
                <th scope="col">Accepted</th>
                <th scope="col" className="invite-col-actions">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div className="invite-cell-email">{inv.email}</div>
                    {inv.name && (
                      <div className="muted small">{inv.name}</div>
                    )}
                  </td>
                  <td className="mono">{inv.role}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[inv.status]}`}>
                      {STATUS_LABEL[inv.status]}
                    </span>
                  </td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>{formatDate(inv.expiresAt)}</td>
                  <td>{formatDate(inv.acceptedAt)}</td>
                  <td className="invite-col-actions">
                    <div className="invite-row-actions">
                      {inv.status === "pending" && inv.acceptUrl && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => copyLink(inv.id, inv.acceptUrl!)}
                        >
                          {copiedId === inv.id ? "Copied" : "Copy link"}
                        </button>
                      )}
                      {inv.status === "pending" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => revoke(inv.id, inv.email)}
                          disabled={revokingId === inv.id}
                        >
                          {revokingId === inv.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

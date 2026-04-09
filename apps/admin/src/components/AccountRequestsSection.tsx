import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type {
  AccountRequest,
  AccountRequestStatus,
  Organization,
  Role,
} from "../types";

const CLIENT_ROLES: { value: Role; label: string }[] = [
  { value: "CLIENT_USER", label: "Client User" },
  { value: "CLIENT_ADMIN", label: "Client Admin" },
];
const AGENCY_ROLES: { value: Role; label: string }[] = [
  { value: "STAFF", label: "Staff" },
  { value: "AGENCY_ADMIN", label: "Agency Admin" },
  { value: "AGENCY_OWNER", label: "Agency Owner" },
];

const SITE_BASE = "https://dempsey.agency";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: AccountRequestStatus): string {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "warning";
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

function rolesForOrg(org: Organization | undefined) {
  if (!org) return CLIENT_ROLES;
  return org.type === "AGENCY" ? AGENCY_ROLES : CLIENT_ROLES;
}

export function AccountRequestsSection({
  organizations,
}: {
  organizations: Organization[];
}) {
  const { session } = useAuth();
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  /* Approval panel state — tracks which pending row has the panel open */
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveOrgId, setApproveOrgId] = useState("");
  const [approveRole, setApproveRole] = useState<Role>("CLIENT_USER");

  /* Invite link to display after successful approval */
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchAccountRequests();
      setRequests(res.requests);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function openApprovePanel(req: AccountRequest) {
    setApprovingId(req.id);
    setApproveOrgId(organizations[0]?.id ?? "");
    setApproveRole("CLIENT_USER");
    setActionError(null);
    setActionSuccess(null);
    setInviteUrl(null);
  }

  function closeApprovePanel() {
    setApprovingId(null);
  }

  async function onApprove(req: AccountRequest) {
    if (!approveOrgId) return;
    setActionError(null);
    setActionSuccess(null);
    setInviteUrl(null);
    setBusyId(req.id);
    try {
      const result = await api.patchAccountRequest(req.id, {
        status: "APPROVED",
        organizationId: approveOrgId,
        role: approveRole,
      });
      const reviewedBy = session
        ? { id: session.id, email: session.email, name: session.name }
        : null;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, ...result, reviewedBy } : r,
        ),
      );
      setApprovingId(null);
      if (result.invite?.token) {
        const link = `${SITE_BASE}/activate-account.html?token=${result.invite.token}`;
        setInviteUrl(link);
        setActionSuccess(
          `${req.name}'s request approved. Invite link generated (expires ${formatDate(result.invite.expiresAt)}).`,
        );
      } else {
        setActionSuccess(`${req.name}'s request has been approved.`);
      }
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(req: AccountRequest) {
    if (
      !window.confirm(
        `Reject request from ${req.name} (${req.email})?`,
      )
    ) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setInviteUrl(null);
    setBusyId(req.id);
    try {
      const updated = await api.patchAccountRequest(req.id, {
        status: "REJECTED",
      });
      const reviewedBy = session
        ? { id: session.id, email: session.email, name: session.name }
        : null;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, ...updated, reviewedBy } : r,
        ),
      );
      setActionSuccess(`${req.name}'s request has been rejected.`);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  function onCopyInvite() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
  }

  const selectedApproveOrg = organizations.find(
    (o) => o.id === approveOrgId,
  );
  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <section className="card">
      <h2>Account Requests</h2>

      {loading && <p className="muted">Loading…</p>}
      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p className="success" role="status">
          {actionSuccess}
        </p>
      )}
      {inviteUrl && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.65rem 0.75rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            wordBreak: "break-all",
          }}
        >
          <strong>Invite link:</strong>{" "}
          <code>{inviteUrl}</code>
          <button
            type="button"
            className="btn ghost"
            onClick={onCopyInvite}
            style={{ marginLeft: "0.75rem", fontSize: "0.8rem" }}
          >
            Copy
          </button>
        </div>
      )}

      {!loading && requests.length === 0 && !listError && (
        <p className="muted">No account requests yet.</p>
      )}

      {!loading && pending.length > 0 && (
        <>
          <h3 className="h3-spaced">Pending ({pending.length})</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.name}</div>
                      {r.message && (
                        <span className="small">{r.message}</span>
                      )}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.company}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      {approvingId === r.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "14rem" }}>
                          <label className="field">
                            <span>Organization</span>
                            <select
                              value={approveOrgId}
                              onChange={(e) => {
                                setApproveOrgId(e.target.value);
                                const org = organizations.find(
                                  (o) => o.id === e.target.value,
                                );
                                const roles = rolesForOrg(org);
                                setApproveRole(roles[0].value);
                              }}
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
                              value={approveRole}
                              onChange={(e) =>
                                setApproveRole(e.target.value as Role)
                              }
                            >
                              {rolesForOrg(selectedApproveOrg).map(
                                (opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              className="btn primary"
                              disabled={busyId === r.id || !approveOrgId}
                              onClick={() => onApprove(r)}
                            >
                              {busyId === r.id
                                ? "Approving…"
                                : "Approve & Invite"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={busyId === r.id}
                              onClick={closeApprovePanel}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={
                              busyId === r.id ||
                              organizations.length === 0
                            }
                            onClick={() => openApprovePanel(r)}
                            style={{ marginRight: "0.5rem" }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger ghost"
                            disabled={busyId === r.id}
                            onClick={() => onReject(r)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && resolved.length > 0 && (
        <>
          <h3 className="h3-spaced">Resolved</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Reviewed by</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.name}</div>
                      {r.message && (
                        <span className="small">{r.message}</span>
                      )}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.company}</td>
                    <td>
                      <span className={statusClass(r.status)}>
                        {r.status}
                      </span>
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      {r.reviewedBy && (
                        <span className="small">
                          {r.reviewedBy.name || r.reviewedBy.email}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

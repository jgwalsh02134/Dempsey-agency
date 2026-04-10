import { useCallback, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { OrganizationType, OrgMemberRow, OrgUsersResponse, Role } from "../types";

type ActionFeedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "warning"; message: string };

const AGENCY_ROLES: Role[] = ["AGENCY_OWNER", "AGENCY_ADMIN", "STAFF"];
const CLIENT_ROLES: Role[] = ["CLIENT_ADMIN", "CLIENT_USER"];

function rolesForOrgType(t: OrganizationType): Role[] {
  return t === "AGENCY" ? AGENCY_ROLES : CLIENT_ROLES;
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function OrgMembersTable({
  orgId,
  orgType,
  data,
  loading,
  error,
  onClearListError,
  onLocalRoleUpdated,
  onRefresh,
}: {
  orgId: string;
  orgType: OrganizationType;
  data: OrgUsersResponse | null;
  loading: boolean;
  error: string | null;
  onClearListError: () => void;
  onLocalRoleUpdated: (args: {
    membershipId: string;
    userId: string;
    role: Role;
  }) => void;
  onRefresh: () => Promise<void>;
}) {
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const changeRole = useCallback(
    async (row: OrgMemberRow, newRole: Role) => {
      onClearListError();
      setFeedback(null);
      setBusyUser(row.user.id);

      try {
        try {
          await api.patchUserRole(row.user.id, {
            organizationId: orgId,
            role: newRole,
          });
        } catch (e) {
          setFeedback({ type: "error", message: errMsg(e) });
          return;
        }

        onLocalRoleUpdated({
          membershipId: row.membershipId,
          userId: row.user.id,
          role: newRole,
        });

        setFeedback({ type: "success", message: "Role updated." });
        const t = window.setTimeout(() => {
          setFeedback((f) => (f?.type === "success" ? null : f));
        }, 4000);

        try {
          await onRefresh();
        } catch (refetchErr) {
          window.clearTimeout(t);
          setFeedback({
            type: "warning",
            message: `Role saved, but reloading the member list failed. (${errMsg(refetchErr)})`,
          });
        }
      } finally {
        setBusyUser(null);
      }
    },
    [orgId, onClearListError, onLocalRoleUpdated, onRefresh],
  );

  const deactivate = useCallback(
    async (userId: string) => {
      if (!window.confirm("Deactivate this user? They will not be able to sign in.")) return;
      onClearListError();
      setFeedback(null);
      setBusyUser(userId);
      try {
        await api.deactivateUser(userId);
        setFeedback({ type: "success", message: "User deactivated." });
        try { await onRefresh(); } catch { /* best effort */ }
      } catch (e) {
        setFeedback({ type: "error", message: errMsg(e) });
      } finally {
        setBusyUser(null);
      }
    },
    [onClearListError, onRefresh],
  );

  const reactivate = useCallback(
    async (userId: string) => {
      if (!window.confirm("Reactivate this user? They will be able to sign in again.")) return;
      onClearListError();
      setFeedback(null);
      setBusyUser(userId);
      try {
        await api.reactivateUser(userId);
        setFeedback({ type: "success", message: "User reactivated." });
        try { await onRefresh(); } catch { /* best effort */ }
      } catch (e) {
        setFeedback({ type: "error", message: errMsg(e) });
      } finally {
        setBusyUser(null);
      }
    },
    [onClearListError, onRefresh],
  );

  const removeMember = useCallback(
    async (row: OrgMemberRow) => {
      if (
        !window.confirm(
          `Remove ${row.user.email} from this organization? Their account will still exist but they will lose access to this org.`,
        )
      )
        return;
      onClearListError();
      setFeedback(null);
      setBusyUser(row.user.id);
      try {
        await api.removeMembership(row.membershipId);
        setFeedback({ type: "success", message: "Member removed." });
        try { await onRefresh(); } catch { /* best effort */ }
      } catch (e) {
        setFeedback({ type: "error", message: errMsg(e) });
      } finally {
        setBusyUser(null);
      }
    },
    [onClearListError, onRefresh],
  );

  if (!orgId) {
    return (
      <section className="card muted">
        <h2>Organization members</h2>
        <p>Select an organization above.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Members</h2>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {feedback && (
        <p
          className={feedback.type === "error" ? "error" : feedback.type === "success" ? "success" : "warning"}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      {data && !loading && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">No members</td>
                </tr>
              ) : (
                data.users.map((row) => {
                  const inactive = !row.user.active;
                  const busy = busyUser === row.user.id;
                  return (
                    <tr key={row.membershipId} className={inactive ? "row-inactive" : ""}>
                      <td>
                        <div>
                          {row.user.name && (
                            <span style={{ marginRight: "0.375rem" }}>{row.user.name}</span>
                          )}
                          <span className={row.user.name ? "small" : ""}>{row.user.email}</span>
                        </div>
                      </td>
                      <td>
                        {inactive ? (
                          <span className="status-pill status-inactive">Inactive</span>
                        ) : (
                          <span className="status-pill status-active">Active</span>
                        )}
                      </td>
                      <td>
                        <select
                          className="inline-select"
                          value={row.role}
                          disabled={busy}
                          onChange={(e) => {
                            const v = e.target.value as Role;
                            if (v !== row.role) void changeRole(row, v);
                          }}
                        >
                          {rolesForOrgType(orgType).map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="member-actions">
                          {inactive ? (
                            <button
                              type="button"
                              className="btn ghost"
                              disabled={busy}
                              onClick={() => reactivate(row.user.id)}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn danger ghost"
                              disabled={busy}
                              onClick={() => deactivate(row.user.id)}
                            >
                              Deactivate
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn danger ghost"
                            disabled={busy}
                            onClick={() => removeMember(row)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

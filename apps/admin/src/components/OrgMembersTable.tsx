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

function patchRoleErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Could not update role.";
}

function refetchWarningMessage(prefix: string, e: unknown): string {
  if (e instanceof ApiError) return `${prefix} (${e.message})`;
  if (e instanceof Error && e.message) return `${prefix} (${e.message})`;
  return prefix;
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
          setFeedback({ type: "error", message: patchRoleErrorMessage(e) });
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
            message: refetchWarningMessage(
              "Role saved, but reloading the member list failed.",
              refetchErr,
            ),
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
      if (!window.confirm("Deactivate this user? They will not be able to sign in.")) {
        return;
      }
      onClearListError();
      setFeedback(null);
      setBusyUser(userId);

      try {
        try {
          await api.deactivateUser(userId);
        } catch (e) {
          setFeedback({
            type: "error",
            message:
              e instanceof ApiError
                ? e.message
                : e instanceof Error && e.message
                  ? e.message
                  : "Deactivate failed.",
          });
          return;
        }

        setFeedback({ type: "success", message: "User deactivated." });
        try {
          await onRefresh();
        } catch (refetchErr) {
          setFeedback({
            type: "warning",
            message: refetchWarningMessage(
              "User deactivated, but reloading the member list failed.",
              refetchErr,
            ),
          });
        }
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
      <p className="muted">
        Organization <code>{orgId}</code>
      </p>
      {loading && <p className="muted">Loading…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <p
          className={
            feedback.type === "error"
              ? "error"
              : feedback.type === "success"
                ? "success"
                : "warning"
          }
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
                <th>Active</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No members
                  </td>
                </tr>
              ) : (
                data.users.map((row) => (
                  <tr key={row.membershipId}>
                    <td>
                      <div>{row.user.email}</div>
                      <code className="small">{row.user.id}</code>
                    </td>
                    <td>{row.user.active ? "Yes" : "No"}</td>
                    <td>
                      <select
                        className="inline-select"
                        value={row.role}
                        disabled={busyUser === row.user.id}
                        onChange={(e) => {
                          const v = e.target.value as Role;
                          if (v !== row.role) void changeRole(row, v);
                        }}
                      >
                        {rolesForOrgType(orgType).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn danger ghost"
                        disabled={busyUser === row.user.id || !row.user.active}
                        onClick={() => deactivate(row.user.id)}
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

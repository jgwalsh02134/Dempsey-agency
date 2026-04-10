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

const ROLE_LABEL: Record<Role, string> = {
  AGENCY_OWNER: "Owner",
  AGENCY_ADMIN: "Admin",
  STAFF: "Staff",
  CLIENT_ADMIN: "Admin",
  CLIENT_USER: "User",
};

const ROLE_DESCRIPTION: Record<Role, string> = {
  AGENCY_OWNER: "Full control including admin management",
  AGENCY_ADMIN: "Manage clients, campaigns, and staff",
  STAFF: "View and contribute to campaigns",
  CLIENT_ADMIN: "Manage team members and submissions",
  CLIENT_USER: "Submit creatives and view campaigns",
};

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  function toggleExpand(membershipId: string) {
    setExpandedId((prev) => (prev === membershipId ? null : membershipId));
    setConfirmRemoveId(null);
  }

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

        setFeedback({ type: "success", message: `Role changed to ${ROLE_LABEL[newRole]}.` });
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
      if (
        !window.confirm(
          "Deactivate this user?\n\nThey will not be able to sign in to any organization. This can be reversed later.",
        )
      )
        return;
      onClearListError();
      setFeedback(null);
      setBusyUser(userId);
      try {
        await api.deactivateUser(userId);
        setFeedback({ type: "success", message: "User deactivated." });
        try {
          await onRefresh();
        } catch {
          /* best effort */
        }
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
      if (
        !window.confirm(
          "Reactivate this user?\n\nThey will be able to sign in again with their existing memberships.",
        )
      )
        return;
      onClearListError();
      setFeedback(null);
      setBusyUser(userId);
      try {
        await api.reactivateUser(userId);
        setFeedback({ type: "success", message: "User reactivated." });
        try {
          await onRefresh();
        } catch {
          /* best effort */
        }
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
      onClearListError();
      setFeedback(null);
      setBusyUser(row.user.id);
      try {
        await api.removeMembership(row.membershipId);
        setConfirmRemoveId(null);
        setExpandedId(null);
        setFeedback({
          type: "success",
          message: `${row.user.email} removed from this organization.`,
        });
        try {
          await onRefresh();
        } catch {
          /* best effort */
        }
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

  const roles = rolesForOrgType(orgType);

  return (
    <section className="card">
      <h2>Members</h2>
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
        <>
          {data.users.length === 0 ? (
            <p className="muted">No members in this organization.</p>
          ) : (
            <ul className="m-list">
              {data.users.map((row) => {
                const inactive = !row.user.active;
                const busy = busyUser === row.user.id;
                const expanded = expandedId === row.membershipId;
                const showRemoveConfirm = confirmRemoveId === row.membershipId;

                return (
                  <li
                    key={row.membershipId}
                    className={`m-row${expanded ? " m-row-expanded" : ""}${inactive ? " m-row-inactive" : ""}`}
                  >
                    {/* ── Summary row ── */}
                    <button
                      type="button"
                      className="m-row-summary"
                      onClick={() => toggleExpand(row.membershipId)}
                      aria-expanded={expanded}
                    >
                      <div className="m-row-user">
                        <span className="m-row-name">
                          {row.user.name || row.user.email}
                        </span>
                        {row.user.name && (
                          <span className="m-row-email">{row.user.email}</span>
                        )}
                      </div>
                      <div className="m-row-badges">
                        <span className="m-role-pill">{ROLE_LABEL[row.role]}</span>
                        {inactive ? (
                          <span className="status-pill status-inactive">Inactive</span>
                        ) : (
                          <span className="status-pill status-active">Active</span>
                        )}
                      </div>
                      <span className="m-row-chevron" aria-hidden="true">
                        {expanded ? "▾" : "▸"}
                      </span>
                    </button>

                    {/* ── Expanded detail panel ── */}
                    {expanded && (
                      <div className="m-detail">
                        <div className="m-detail-grid">
                          {/* Left: info */}
                          <div className="m-detail-info">
                            <dl className="m-detail-dl">
                              <div className="m-dl-row">
                                <dt>Email</dt>
                                <dd>{row.user.email}</dd>
                              </div>
                              {row.user.name && (
                                <div className="m-dl-row">
                                  <dt>Name</dt>
                                  <dd>{row.user.name}</dd>
                                </div>
                              )}
                              <div className="m-dl-row">
                                <dt>Joined</dt>
                                <dd>{formatJoinDate(row.joinedAt)}</dd>
                              </div>
                              <div className="m-dl-row">
                                <dt>Account</dt>
                                <dd>
                                  {inactive ? (
                                    <span className="status-pill status-inactive">
                                      Inactive — cannot sign in
                                    </span>
                                  ) : (
                                    <span className="status-pill status-active">
                                      Active
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {/* Right: actions */}
                          <div className="m-detail-actions">
                            {/* Role change */}
                            <label className="m-action-field">
                              <span className="m-action-label">Role</span>
                              <select
                                className="inline-select"
                                value={row.role}
                                disabled={busy}
                                onChange={(e) => {
                                  const v = e.target.value as Role;
                                  if (v !== row.role) void changeRole(row, v);
                                }}
                              >
                                {roles.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABEL[r]}
                                  </option>
                                ))}
                              </select>
                              <span className="m-action-hint">
                                {ROLE_DESCRIPTION[row.role]}
                              </span>
                            </label>

                            {/* Access control */}
                            <div className="m-action-group">
                              <span className="m-action-label">Access</span>
                              {inactive ? (
                                <button
                                  type="button"
                                  className="btn primary"
                                  disabled={busy}
                                  onClick={() => reactivate(row.user.id)}
                                >
                                  {busy ? "…" : "Reactivate user"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={busy}
                                  onClick={() => deactivate(row.user.id)}
                                >
                                  {busy ? "…" : "Deactivate user"}
                                </button>
                              )}
                              <span className="m-action-hint">
                                {inactive
                                  ? "Re-enable sign-in for this user across all organizations."
                                  : "Prevent this user from signing in to any organization."}
                              </span>
                            </div>

                            {/* Remove membership — danger zone */}
                            <div className="m-danger-zone">
                              <span className="m-action-label m-danger-label">
                                Remove from organization
                              </span>
                              {!showRemoveConfirm ? (
                                <button
                                  type="button"
                                  className="btn danger ghost"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirmRemoveId(row.membershipId)
                                  }
                                >
                                  Remove membership…
                                </button>
                              ) : (
                                <div className="m-remove-confirm">
                                  <p className="m-remove-warning">
                                    This will remove{" "}
                                    <strong>{row.user.email}</strong> from this
                                    organization. They will lose access to all
                                    data in this org.
                                    {!inactive && (
                                      <>
                                        {" "}
                                        Their account will remain active — they
                                        can still sign in if they belong to
                                        other organizations.
                                      </>
                                    )}
                                  </p>
                                  <div className="m-remove-buttons">
                                    <button
                                      type="button"
                                      className="btn danger"
                                      disabled={busy}
                                      onClick={() => removeMember(row)}
                                    >
                                      {busy ? "Removing…" : "Confirm removal"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn ghost"
                                      onClick={() => setConfirmRemoveId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                              <span className="m-action-hint">
                                Only removes organization membership. Does not
                                delete or deactivate the user account.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

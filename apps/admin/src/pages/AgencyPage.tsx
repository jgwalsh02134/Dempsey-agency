import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { AccountRequestsSection } from "../components/AccountRequestsSection";
import { OrgMembersTable } from "../components/OrgMembersTable";
import type {
  AuditLogEntry,
  Organization,
  OrgUsersResponse,
  Role,
} from "../types";

const AUDIT_LABELS: Record<string, string> = {
  USER_CREATED: "User created",
  ROLE_CHANGED: "Role changed",
  USER_DEACTIVATED: "User deactivated",
  MEMBERSHIP_REMOVED: "Membership removed",
};

function formatAuditAction(entry: AuditLogEntry): string {
  const label = AUDIT_LABELS[entry.action] ?? entry.action;
  const actor = entry.actorUser?.name ?? entry.actorUser?.email ?? "System";
  const target = entry.targetUser?.name ?? entry.targetUser?.email;
  if (target) return `${actor} — ${label} → ${target}`;
  return `${actor} — ${label}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AgencyPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [agencyOrg, setAgencyOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<OrgUsersResponse | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.fetchOrganizations();
      setOrgs(list);
      const agency = list.find((o) => o.type === "AGENCY") ?? null;
      setAgencyOrg(agency);
      if (!agency) setError("No agency organization found.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!agencyOrg) return;
      if (!opts?.background) {
        setMembersLoading(true);
        setMembersError(null);
      }
      try {
        const data = await api.fetchOrgUsers(agencyOrg.id);
        setMembers(data);
        setMembersError(null);
      } catch (e) {
        if (!opts?.background) {
          setMembers(null);
          setMembersError(
            e instanceof ApiError ? e.message : "Failed to load team members",
          );
        }
      } finally {
        if (!opts?.background) setMembersLoading(false);
      }
    },
    [agencyOrg],
  );

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const overview = await api.fetchAdminOverview();
      setActivity(overview.recentActivity);
    } catch {
      /* non-critical — silently degrade */
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const applyLocalMemberRole = useCallback(
    (args: { membershipId: string; userId: string; role: Role }) => {
      setMembers((prev) => {
        if (!prev || !agencyOrg || prev.organizationId !== agencyOrg.id)
          return prev;
        return {
          ...prev,
          users: prev.users.map((row) =>
            row.membershipId === args.membershipId &&
            row.user.id === args.userId
              ? { ...row, role: args.role }
              : row,
          ),
        };
      });
      setMembersError(null);
    },
    [agencyOrg],
  );

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (agencyOrg) void loadMembers();
  }, [agencyOrg, loadMembers]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Agency</h1>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {!loading && (
        <>
          <AccountRequestsSection organizations={orgs} />

          {agencyOrg && (
            <div style={{ marginTop: "1.25rem" }}>
              <OrgMembersTable
                orgId={agencyOrg.id}
                orgType="AGENCY"
                data={members}
                loading={membersLoading}
                error={membersError}
                onClearListError={() => setMembersError(null)}
                onLocalRoleUpdated={applyLocalMemberRole}
                onRefresh={() => loadMembers({ background: true })}
              />
            </div>
          )}

          <section className="card" style={{ marginTop: "1.25rem" }}>
            <h2>Recent Activity</h2>
            {activityLoading && <p className="muted">Loading…</p>}
            {!activityLoading && activity.length === 0 && (
              <p className="muted">No recent activity.</p>
            )}
            {!activityLoading && activity.length > 0 && (
              <ul className="activity-list">
                {activity.map((entry) => (
                  <li key={entry.id} className="activity-row">
                    <span className="activity-text">
                      {formatAuditAction(entry)}
                    </span>
                    <span className="activity-time muted small">
                      {timeAgo(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

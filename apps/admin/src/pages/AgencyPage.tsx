import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { CreateUserForm } from "../components/CreateUserForm";
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

const INTERNAL_DOMAINS = ["@dempsey.agency", "@adsell.ai", "@vdata.com"];

export function AgencyPage() {
  const { session } = useAuth();

  const agencyOrgId = useMemo(() => {
    const m = session?.memberships.find(
      (mb) => mb.organization.type === "AGENCY",
    );
    return m?.organizationId ?? null;
  }, [session]);

  const [members, setMembers] = useState<OrgUsersResponse | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const [agencyOrganization, setAgencyOrganization] =
    useState<Organization | null>(null);

  const loadMembers = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!agencyOrgId) return;
      if (!opts?.background) {
        setMembersLoading(true);
        setMembersError(null);
      }
      try {
        const data = await api.fetchOrgUsers(agencyOrgId);
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
    [agencyOrgId],
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

  const filteredMembers = useMemo<OrgUsersResponse | null>(() => {
    if (!members) return null;
    return {
      ...members,
      users: members.users.filter((row) => {
        const e = row.user.email.toLowerCase();
        return INTERNAL_DOMAINS.some((d) => e.endsWith(d.toLowerCase()));
      }),
    };
  }, [members]);

  /** Full org row from API when available; otherwise minimal org from session so CreateUserForm still works. */
  const agencyOrgForCreate = useMemo((): Organization | null => {
    if (!agencyOrgId) return null;
    if (agencyOrganization?.id === agencyOrgId) return agencyOrganization;
    const m = session?.memberships.find(
      (mb) =>
        mb.organizationId === agencyOrgId &&
        mb.organization.type === "AGENCY",
    );
    if (!m) return null;
    return {
      id: m.organization.id,
      name: m.organization.name,
      type: m.organization.type,
      createdAt: agencyOrganization?.createdAt ?? "",
      updatedAt: agencyOrganization?.updatedAt ?? "",
    };
  }, [agencyOrgId, agencyOrganization, session]);

  const applyLocalMemberRole = useCallback(
    (args: { membershipId: string; userId: string; role: Role }) => {
      setMembers((prev) => {
        if (!prev || !agencyOrgId || prev.organizationId !== agencyOrgId)
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
    [agencyOrgId],
  );

  useEffect(() => {
    if (agencyOrgId) void loadMembers();
  }, [agencyOrgId, loadMembers]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    if (!agencyOrgId) {
      setAgencyOrganization(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await api.fetchOrganizations();
        if (cancelled) return;
        const org = list.find((o) => o.id === agencyOrgId) ?? null;
        setAgencyOrganization(org);
      } catch {
        if (!cancelled) setAgencyOrganization(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyOrgId]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Agency</h1>
      </div>

      {!agencyOrgId && (
        <p className="error" role="alert">
          Your account does not belong to an agency organization.
        </p>
      )}

      {agencyOrgId && (
        <>
          <section className="card" style={{ marginBottom: "1.25rem" }}>
            <p className="muted" style={{ margin: 0 }}>
              Internal Dempsey Agency administration only. Create staff accounts
              with agency email domains; manage roles and access below. Client
              onboarding and account requests stay under{" "}
              <strong>Clients</strong>.
            </p>
          </section>

          {agencyOrgForCreate && (
            <div style={{ marginBottom: "1.25rem" }}>
              <CreateUserForm
                organizations={[agencyOrgForCreate]}
                defaultOrgId={agencyOrgId}
                allowedEmailDomainSuffixes={INTERNAL_DOMAINS}
                heading="Create internal staff account"
                onCreated={() => {
                  void loadMembers({ background: true });
                  void loadActivity();
                }}
              />
              <p className="muted small" style={{ marginTop: "0.75rem" }}>
                Allowed email domains: {INTERNAL_DOMAINS.join(", ")}.
              </p>
            </div>
          )}

          <OrgMembersTable
              orgId={agencyOrgId}
              orgType="AGENCY"
              data={filteredMembers}
              loading={membersLoading}
              error={membersError}
              onClearListError={() => setMembersError(null)}
              onLocalRoleUpdated={applyLocalMemberRole}
              onRefresh={() => loadMembers({ background: true })}
            />

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

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { getApiBase } from "../api/config";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { CreateClientOrgForm } from "../components/CreateClientOrgForm";
import { CreateUserForm } from "../components/CreateUserForm";
import { CampaignsSection } from "../components/CampaignsSection";
import { DocumentsSection } from "../components/DocumentsSection";
import { OrgMembersTable } from "../components/OrgMembersTable";
import { SessionPanel } from "../components/SessionPanel";
import type { Organization, OrgUsersResponse, Role } from "../types";

export function DashboardPage() {
  const { session, logout, loading: authLoading, token } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [members, setMembers] = useState<OrgUsersResponse | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const loadOrganizations = useCallback(async () => {
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const list = await api.fetchOrganizations();
      setOrgs(list);
      setSelectedOrgId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch (e) {
      setOrgsError(e instanceof ApiError ? e.message : "Failed to load organizations");
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadMembers = useCallback(
    async (orgId: string, opts?: { background?: boolean }) => {
      if (!orgId) {
        setMembers(null);
        return;
      }
      const background = opts?.background === true;
      if (!background) {
        setMembersLoading(true);
        setMembersError(null);
      }
      try {
        const data = await api.fetchOrgUsers(orgId);
        setMembers(data);
        setMembersError(null);
      } catch (e) {
        if (!background) {
          setMembers(null);
          setMembersError(
            e instanceof ApiError ? e.message : "Failed to load members",
          );
        }
        throw e;
      } finally {
        if (!background) {
          setMembersLoading(false);
        }
      }
    },
    [],
  );

  /** Update role from client-known row ids after a successful PATCH (does not depend on response JSON). */
  const applyLocalMemberRole = useCallback(
    (args: { membershipId: string; userId: string; role: Role }) => {
      setMembers((prev) => {
        if (!prev || prev.organizationId !== selectedOrgId) {
          return prev;
        }
        return {
          ...prev,
          users: prev.users.map((row) =>
            row.membershipId === args.membershipId && row.user.id === args.userId
              ? { ...row, role: args.role }
              : row,
          ),
        };
      });
      setMembersError(null);
    },
    [selectedOrgId],
  );

  const clearMembersListError = useCallback(() => {
    setMembersError(null);
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    void loadMembers(selectedOrgId);
  }, [selectedOrgId, loadMembers]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedOrgId),
    [orgs, selectedOrgId],
  );

  const agencyOrgs = useMemo(
    () => orgs.filter((o) => o.type === "AGENCY"),
    [orgs],
  );

  if (authLoading && token) {
    return (
      <div className="page-center muted" aria-busy="true">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="dashboard">
      <header className="top-bar">
        <div>
          <h1>Dempsey Agency — Admin</h1>
          <p className="muted small">
            API: <code>{getApiBase() || "(dev proxy → /api)"}</code>
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="dashboard-main">
        <SessionPanel session={session} />

        <section className="card">
          <h2>Organization</h2>
          {orgsLoading && <p className="muted">Loading organizations…</p>}
          {orgsError && (
            <p className="error" role="alert">
              {orgsError}
            </p>
          )}
          {!orgsLoading && orgs.length === 0 && (
            <p className="muted">No organizations visible to your account.</p>
          )}
          {orgs.length > 0 && (
            <label className="field">
              <span>Select organization</span>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.type})
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {selectedOrg && (
          <OrgMembersTable
            orgId={selectedOrgId}
            orgType={selectedOrg.type}
            data={members}
            loading={membersLoading}
            error={membersError}
            onClearListError={clearMembersListError}
            onLocalRoleUpdated={applyLocalMemberRole}
            onRefresh={() => loadMembers(selectedOrgId, { background: true })}
          />
        )}

        {selectedOrg && (
          <DocumentsSection key={`docs-${selectedOrgId}`} orgId={selectedOrgId} />
        )}

        {selectedOrg && (
          <CampaignsSection key={`camps-${selectedOrgId}`} orgId={selectedOrgId} />
        )}

        <div className="two-col">
          <CreateUserForm
            key={selectedOrgId || "none"}
            organizations={orgs}
            defaultOrgId={selectedOrgId || orgs[0]?.id || ""}
          />
          <CreateClientOrgForm
            agencyOrganizations={agencyOrgs}
            onCreated={() => void loadOrganizations()}
          />
        </div>
      </main>
    </div>
  );
}

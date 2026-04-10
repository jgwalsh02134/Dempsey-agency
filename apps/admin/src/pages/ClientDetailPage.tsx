import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { BillingSection } from "../components/BillingSection";
import { CampaignsSection } from "../components/CampaignsSection";
import { CreativeSubmissionsSection } from "../components/CreativeSubmissionsSection";
import { CreateUserForm } from "../components/CreateUserForm";
import { DocumentsSection } from "../components/DocumentsSection";
import { OrgMembersTable } from "../components/OrgMembersTable";
import type { Organization, OrgUsersResponse, Role } from "../types";

type Tab = "users" | "campaigns" | "documents" | "creatives" | "billing";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "campaigns", label: "Campaigns" },
  { key: "documents", label: "Documents" },
  { key: "creatives", label: "Creatives" },
  { key: "billing", label: "Billing" },
];

export function ClientDetailPage() {
  const { id: orgId } = useParams<{ id: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("users");

  const [members, setMembers] = useState<OrgUsersResponse | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const loadOrg = useCallback(async () => {
    if (!orgId) return;
    setOrgLoading(true);
    setOrgError(null);
    try {
      const list = await api.fetchOrganizations();
      const found = list.find((o) => o.id === orgId) ?? null;
      setOrg(found);
      if (!found) setOrgError("Organization not found");
    } catch (e) {
      setOrgError(e instanceof ApiError ? e.message : "Failed to load org");
    } finally {
      setOrgLoading(false);
    }
  }, [orgId]);

  const loadMembers = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!orgId) return;
      if (!opts?.background) {
        setMembersLoading(true);
        setMembersError(null);
      }
      try {
        const data = await api.fetchOrgUsers(orgId);
        setMembers(data);
        setMembersError(null);
      } catch (e) {
        if (!opts?.background) {
          setMembers(null);
          setMembersError(
            e instanceof ApiError ? e.message : "Failed to load members",
          );
        }
      } finally {
        if (!opts?.background) setMembersLoading(false);
      }
    },
    [orgId],
  );

  const applyLocalMemberRole = useCallback(
    (args: { membershipId: string; userId: string; role: Role }) => {
      setMembers((prev) => {
        if (!prev || prev.organizationId !== orgId) return prev;
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
    [orgId],
  );

  useEffect(() => {
    void loadOrg();
  }, [loadOrg]);

  useEffect(() => {
    if (orgId && tab === "users") void loadMembers();
  }, [orgId, tab, loadMembers]);

  const singleOrgList = useMemo(
    () => (org ? [org] : []),
    [org],
  );

  if (!orgId) return null;

  if (orgLoading) {
    return <p className="muted" style={{ padding: "2rem" }}>Loading…</p>;
  }

  if (orgError || !org) {
    return (
      <div style={{ padding: "2rem" }}>
        <p className="error">{orgError ?? "Organization not found"}</p>
        <Link to="/clients" className="btn ghost" style={{ marginTop: "1rem", display: "inline-block" }}>
          ← Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="client-detail">
      <div className="page-header">
        <div>
          <Link to="/clients" className="muted small" style={{ textDecoration: "none" }}>
            ← Clients
          </Link>
          <h1 className="page-title">{org.name}</h1>
        </div>
      </div>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === "users" && (
          <>
            <OrgMembersTable
              orgId={orgId}
              orgType={org.type}
              data={members}
              loading={membersLoading}
              error={membersError}
              onClearListError={() => setMembersError(null)}
              onLocalRoleUpdated={applyLocalMemberRole}
              onRefresh={() => loadMembers({ background: true })}
            />
            <div style={{ marginTop: "1.25rem", maxWidth: "480px" }}>
              <CreateUserForm
                organizations={singleOrgList}
                defaultOrgId={orgId}
              />
            </div>
          </>
        )}
        {tab === "campaigns" && (
          <CampaignsSection key={`camps-${orgId}`} orgId={orgId} />
        )}
        {tab === "documents" && (
          <DocumentsSection key={`docs-${orgId}`} orgId={orgId} />
        )}
        {tab === "creatives" && (
          <CreativeSubmissionsSection key={`creatives-${orgId}`} orgId={orgId} />
        )}
        {tab === "billing" && (
          <BillingSection key={`billing-${orgId}`} orgId={orgId} />
        )}
      </div>
    </div>
  );
}

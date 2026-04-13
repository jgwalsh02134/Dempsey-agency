import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  AdminSubmission,
  Campaign,
  CampaignStatus,
  Organization,
} from "../types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

const STATUS_ORDER: Record<CampaignStatus, number> = {
  ACTIVE: 0,
  PAUSED: 1,
  COMPLETED: 2,
};

const ALL_STATUSES: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "Ongoing";
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

interface CampaignWithOrg extends Campaign {
  organization: NonNullable<Campaign["organization"]>;
}

export function CampaignsPage() {
  const [searchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<CampaignWithOrg[]>([]);
  const [subs, setSubs] = useState<AdminSubmission[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>(
    () => searchParams.get("status") ?? "",
  );
  const [filterOrg, setFilterOrg] = useState<string>(
    () => searchParams.get("organizationId") ?? "",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgList, subsRes] = await Promise.all([
        api.fetchOrganizations(),
        api.fetchAdminSubmissions().catch(() => ({ submissions: [] })),
      ]);

      setOrgs(orgList);
      setSubs(subsRes.submissions);

      // Fetch campaigns per visible org — merges into a single list.
      const clientOrgs = orgList.filter((o) => o.type === "CLIENT");
      const campResults = await Promise.all(
        clientOrgs.map((o) =>
          api
            .fetchOrgCampaigns(o.id)
            .then((res) =>
              res.campaigns.map<CampaignWithOrg>((c) => ({
                ...c,
                organization: { id: o.id, name: o.name, type: o.type },
              })),
            )
            .catch(() => [] as CampaignWithOrg[]),
        ),
      );
      setCampaigns(campResults.flat());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subCountsByCampaign = useMemo(() => {
    const map = new Map<
      string,
      { total: number; approved: number; pending: number }
    >();
    for (const s of subs) {
      const bucket = map.get(s.campaignId) ?? {
        total: 0,
        approved: 0,
        pending: 0,
      };
      bucket.total += 1;
      if (s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED") {
        bucket.approved += 1;
      } else if (
        s.status === "UPLOADED" ||
        s.status === "UNDER_REVIEW" ||
        s.status === "VALIDATION_FAILED" ||
        s.status === "NEEDS_RESIZING"
      ) {
        bucket.pending += 1;
      }
      map.set(s.campaignId, bucket);
    }
    return map;
  }, [subs]);

  const clientOrgs = useMemo(
    () => orgs.filter((o) => o.type === "CLIENT"),
    [orgs],
  );

  const filtered = useMemo(() => {
    const result = campaigns.filter((c) => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterOrg && c.organizationId !== filterOrg) return false;
      return true;
    });
    result.sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] ?? 9;
      const orderB = STATUS_ORDER[b.status] ?? 9;
      if (orderA !== orderB) return orderA - orderB;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    return result;
  }, [campaigns, filterStatus, filterOrg]);

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;

  const STATUS_ACCENT: Record<CampaignStatus, string> = {
    ACTIVE: "q-status-ready",
    PAUSED: "q-status-resize",
    COMPLETED: "q-status-pushed",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          {!loading && (
            <p
              className="muted"
              style={{ margin: 0, fontSize: "0.85rem" }}
            >
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              {activeCount > 0 && ` · ${activeCount} active`}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="q-filters">
        <label className="q-filter-field">
          <span className="small">Status</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="q-filter-field">
          <span className="small">Client</span>
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
          >
            <option value="">All clients</option>
            {clientOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="muted">Loading campaigns…</p>}

      {!loading && filtered.length === 0 && !error && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          {campaigns.length === 0
            ? "No campaigns yet. Campaigns are created from a client's detail page."
            : "No campaigns match the current filters."}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Client</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Dates</th>
                <th>Creatives</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const counts = subCountsByCampaign.get(c.id) ?? {
                  total: 0,
                  approved: 0,
                  pending: 0,
                };
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      {c.description && (
                        <span className="small">{c.description}</span>
                      )}
                    </td>
                    <td className="small">
                      <Link
                        to={`/clients/${c.organizationId}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {c.organization.name}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`q-status-badge ${STATUS_ACCENT[c.status]}`}
                      >
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatCents(c.budgetCents)}
                    </td>
                    <td className="small" style={{ whiteSpace: "nowrap" }}>
                      {dateRange(c.startDate, c.endDate)}
                    </td>
                    <td className="small" style={{ whiteSpace: "nowrap" }}>
                      {counts.total === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <span>{counts.total}</span>
                          {counts.pending > 0 && (
                            <span
                              className="muted"
                              style={{ marginLeft: "0.375rem" }}
                            >
                              · {counts.pending} pending
                            </span>
                          )}
                          {counts.approved > 0 && (
                            <span
                              style={{
                                marginLeft: "0.375rem",
                                color: "var(--success)",
                              }}
                            >
                              · {counts.approved} approved
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="btn ghost"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

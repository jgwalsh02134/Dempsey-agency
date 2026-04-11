import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type { Campaign, CampaignStatus, CreativeSubmission } from "../types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  ACTIVE: "report-badge badge-active",
  PAUSED: "report-badge badge-pending",
  COMPLETED: "report-badge badge-completed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "Ongoing";
}

export function CampaignsPage() {
  const { session } = useAuth();
  const memberships = session!.memberships;

  const [selectedOrgId, setSelectedOrgId] = useState(
    () => memberships[0]?.organizationId ?? "",
  );

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subsBycamp, setSubsByCamp] = useState<Record<string, CreativeSubmission[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCampaigns([]);
    setSubsByCamp({});

    (async () => {
      try {
        const res = await api.fetchOrgCampaigns(selectedOrgId);
        if (cancelled) return;
        setCampaigns(res.campaigns);

        const subResults = await Promise.all(
          res.campaigns.map((c) =>
            api.fetchCampaignSubmissions(c.id).catch(() => ({
              campaignId: c.id,
              submissions: [] as CreativeSubmission[],
            })),
          ),
        );
        if (cancelled) return;
        const map: Record<string, CreativeSubmission[]> = {};
        for (const r of subResults) map[r.campaignId] = r.submissions;
        setSubsByCamp(map);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Failed to load campaigns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedOrgId]);

  const active = campaigns.filter((c) => c.status === "ACTIVE");
  const other = campaigns.filter((c) => c.status !== "ACTIVE");

  function renderCard(c: Campaign) {
    const subs = subsBycamp[c.id] ?? [];
    const approvedCount = subs.filter(
      (s) => s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED",
    ).length;
    const pendingCount = subs.filter(
      (s) =>
        s.status === "UPLOADED" || s.status === "UNDER_REVIEW" ||
        s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
    ).length;

    return (
      <Link
        key={c.id}
        to={`/campaigns/${c.id}`}
        state={{ campaign: c }}
        className="dash-camp-card-link"
      >
        <div className="dash-camp-card">
          <div className="dash-camp-header">
            <span className="dash-camp-title">{c.title}</span>
            <span className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</span>
          </div>
          {c.description && <p className="dash-camp-desc">{c.description}</p>}
          <div className="camp-card-meta">
            <span>{dateRange(c.startDate, c.endDate)}</span>
          </div>
          {c.budgetCents != null && (
            <div className="money-block">
              <span className="money-label">Budget</span>
              <span className="money-value">{formatCents(c.budgetCents)}</span>
            </div>
          )}
          <div className="dash-camp-stats">
            <span>{subs.length} creative{subs.length !== 1 ? "s" : ""}</span>
            {approvedCount > 0 && <span className="dash-stat-good">{approvedCount} approved</span>}
            {pendingCount > 0 && <span className="dash-stat-pending">{pendingCount} pending</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Campaigns</h1>
        <p className="welcome-body">
          Active and completed campaigns managed by your Dempsey Agency team.
        </p>

        {memberships.length > 1 && (
          <div className="org-selector">
            <label className="org-selector-label" htmlFor="camp-org-select">Organization</label>
            <select
              id="camp-org-select"
              className="org-select"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organization.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {loading && <p className="text-muted" style={{ padding: "0 1rem" }}>Loading campaigns…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loading && !error && campaigns.length === 0 && (
        <section className="section-block">
          <div className="dash-empty">
            <p className="dash-empty-text">
              No campaigns have been set up for your organization yet. Check back soon.
            </p>
          </div>
        </section>
      )}

      {!loading && active.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">Active Campaigns</h2>
          <div className="dash-camp-grid">
            {active.map(renderCard)}
          </div>
        </section>
      )}

      {!loading && other.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">Past Campaigns</h2>
          <div className="dash-camp-grid">
            {other.map(renderCard)}
          </div>
        </section>
      )}
    </>
  );
}

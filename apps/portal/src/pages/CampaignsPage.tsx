import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useOrg } from "../auth/OrgContext";
import { EmptyState } from "../components/EmptyState";
import { Money } from "../components/Money";
import { dateRange } from "../lib/date";
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

export function CampaignsPage() {
  const { orgId: selectedOrgId, setOrgId: setSelectedOrgId, memberships } = useOrg();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CampaignStatus>("ALL");

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

  const q = query.trim().toLowerCase();
  const visible = campaigns.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
  });
  const active = visible.filter((c) => c.status === "ACTIVE");
  const paused = visible.filter((c) => c.status === "PAUSED");
  const completed = visible.filter((c) => c.status === "COMPLETED");

  function renderCard(c: Campaign) {
    const subs = subsBycamp[c.id] ?? [];
    const approvedCount = subs.filter(
      (s) => s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED",
    ).length;
    const attentionCount = subs.filter(
      (s) =>
        s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
    ).length;
    const pendingCount = subs.filter(
      (s) => s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
    ).length;

    return (
      <Link
        key={c.id}
        to={`/campaigns/${c.id}`}
        state={{ campaign: c }}
        className="dash-camp-card-link"
      >
        <div
          className={`dash-camp-card${attentionCount > 0 ? " dash-camp-card-attention" : ""}`}
        >
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
              <Money
                cents={c.budgetCents}
                className="money-value money-lead"
              />
            </div>
          )}
          <div className="dash-camp-stats">
            {attentionCount > 0 ? (
              <span className="dash-camp-action-pill">
                Needs action · {attentionCount}
              </span>
            ) : (
              <span className="dash-camp-ok-pill">On track</span>
            )}
            <span className="dash-camp-stats-sep" aria-hidden="true">·</span>
            <span>
              {subs.length} creative{subs.length !== 1 ? "s" : ""}
            </span>
            {approvedCount > 0 && (
              <span className="dash-stat-good">{approvedCount} approved</span>
            )}
            {pendingCount > 0 && (
              <span className="dash-stat-pending">
                {pendingCount} in review
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  const totalAttention = campaigns.reduce((n, c) => {
    const subs = subsBycamp[c.id] ?? [];
    return (
      n +
      subs.filter(
        (s) =>
          s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
      ).length
    );
  }, 0);

  return (
    <>
      <section className="section-welcome section-welcome-compact">
        <h1 className="welcome-heading">Campaigns</h1>
        {!loading && campaigns.length > 0 && (
          <p className="welcome-status">
            {active.length} active
            {paused.length > 0 && ` · ${paused.length} paused`}
            {completed.length > 0 && ` · ${completed.length} completed`}
            {totalAttention > 0 && (
              <>
                {" · "}
                <span className="welcome-status-alert">
                  {totalAttention} creative
                  {totalAttention === 1 ? "" : "s"} need your action
                </span>
              </>
            )}
          </p>
        )}

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

        <div className="list-tools">
          <label className="list-search">
            <span className="visually-hidden">Search campaigns</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search campaigns"
            />
          </label>
          <div className="chip-row" role="group" aria-label="Campaign status">
            {(["ALL", "ACTIVE", "PAUSED", "COMPLETED"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? "chip active" : "chip"}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === "ALL" ? "All" : STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && <p className="text-muted" style={{ padding: "0 1rem" }}>Loading campaigns…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {!loading && !error && campaigns.length === 0 && (
        <EmptyState
          title="No campaigns yet"
          body="Your agency will add campaigns here. You can still review documents and billing in the meantime."
          action={{ href: "/documents", label: "Open documents" }}
        />
      )}

      {!loading && active.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">
            Active · <span className="mono">{active.length}</span>
          </h2>
          <div className="dash-camp-grid">{active.map(renderCard)}</div>
        </section>
      )}

      {!loading && paused.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">
            Paused · <span className="mono">{paused.length}</span>
          </h2>
          <div className="dash-camp-grid">{paused.map(renderCard)}</div>
        </section>
      )}

      {!loading && completed.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">
            Completed · <span className="mono">{completed.length}</span>
          </h2>
          <div className="dash-camp-grid">{completed.map(renderCard)}</div>
        </section>
      )}
    </>
  );
}

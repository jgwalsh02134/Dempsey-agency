import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type { Campaign, CampaignStatus } from "../types";

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
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCampaigns([]);
    api
      .fetchOrgCampaigns(selectedOrgId)
      .then((res) => {
        if (!cancelled) setCampaigns(res.campaigns);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError
              ? e.message
              : "Failed to load campaigns",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Campaigns</h1>
        <p className="welcome-body">
          Active and completed campaigns managed by your Dempsey Agency team.
        </p>

        {memberships.length > 1 && (
          <div className="org-selector">
            <label
              className="org-selector-label"
              htmlFor="camp-org-select"
            >
              Organization
            </label>
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

      <section className="section-block">
        <h2 className="section-heading">Campaign Overview</h2>

        {loading && (
          <p className="text-muted">Loading campaigns…</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && campaigns.length === 0 && (
          <p className="text-muted">
            No campaigns have been set up for your organization yet.
            Check back soon.
          </p>
        )}

        {!loading && campaigns.length > 0 && (
          <ul className="report-list">
            {campaigns.map((c) => (
              <li key={c.id} className="report-item">
                <Link
                  to={`/campaigns/${c.id}`}
                  state={{ campaign: c }}
                  className="report-info campaign-link"
                >
                  <span className="report-name">{c.title}</span>
                  {c.description && (
                    <span className="report-description">
                      {c.description}
                    </span>
                  )}
                  <div className="campaign-meta">
                    <span>{dateRange(c.startDate, c.endDate)}</span>
                  </div>
                </Link>
                <span className={STATUS_BADGE[c.status]}>
                  {STATUS_LABEL[c.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

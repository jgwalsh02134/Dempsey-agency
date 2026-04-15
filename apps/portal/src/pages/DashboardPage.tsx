import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/endpoints";
import { Money } from "../components/Money";
import { fromNow, shortDate } from "../lib/date";
import type {
  Campaign,
  CreativeSubmission,
  CampaignStatus,
  Placement,
  SubmissionStatus,
} from "../types";

const CAMP_STATUS_LABEL: Record<CampaignStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

const CAMP_STATUS_BADGE: Record<CampaignStatus, string> = {
  ACTIVE: "report-badge badge-active",
  PAUSED: "report-badge badge-pending",
  COMPLETED: "report-badge badge-completed",
};

const SUB_STATUS_LABEL: Record<SubmissionStatus, string> = {
  UPLOADED: "Submitted",
  VALIDATION_FAILED: "Needs Attention",
  UNDER_REVIEW: "Under Review",
  NEEDS_RESIZING: "Changes Requested",
  READY_FOR_PUBLISHER: "Approved",
  PUSHED: "Sent to Publisher",
};

const SUB_STATUS_BADGE: Record<SubmissionStatus, string> = {
  UPLOADED: "report-badge badge-pending",
  VALIDATION_FAILED: "report-badge badge-overdue",
  UNDER_REVIEW: "report-badge badge-pending",
  NEEDS_RESIZING: "report-badge badge-overdue",
  READY_FOR_PUBLISHER: "report-badge badge-paid",
  PUSHED: "report-badge badge-completed",
};


export function DashboardPage() {
  const { session } = useAuth();

  const orgId = useMemo(
    () => session?.memberships[0]?.organizationId ?? "",
    [session],
  );

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allSubs, setAllSubs] = useState<CreativeSubmission[]>([]);
  const [placementsByCampaign, setPlacementsByCampaign] = useState<
    Record<string, Placement[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const campRes = await api.fetchOrgCampaigns(orgId);
        if (cancelled) return;
        setCampaigns(campRes.campaigns);

        // Fetch submissions and placements in parallel, per campaign.
        // Each individual failure is swallowed so one bad campaign doesn't
        // blank the whole dashboard.
        const [subResults, placementResults] = await Promise.all([
          Promise.all(
            campRes.campaigns.map((c) =>
              api
                .fetchCampaignSubmissions(c.id)
                .catch(() => ({
                  campaignId: c.id,
                  submissions: [] as CreativeSubmission[],
                })),
            ),
          ),
          Promise.all(
            campRes.campaigns.map((c) =>
              api
                .fetchCampaignPlacements(c.id)
                .catch(() => ({
                  campaignId: c.id,
                  placements: [] as Placement[],
                })),
            ),
          ),
        ]);
        if (cancelled) return;
        setAllSubs(subResults.flatMap((r) => r.submissions));
        setPlacementsByCampaign(
          Object.fromEntries(
            placementResults.map((r) => [r.campaignId, r.placements]),
          ),
        );
      } catch {
        /* best effort */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgId]);

  if (!session) return null;

  const displayName = session.name || session.email;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const inReview = allSubs.filter(
    (s) => s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
  );
  const needsAttention = allSubs.filter(
    (s) => s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
  );
  const approved = allSubs.filter(
    (s) => s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED",
  );

  const recentSubs = [...allSubs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Attention list: most recent action-needed submissions first.
  const attentionItems = [...needsAttention].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const attentionShown = attentionItems.slice(0, 5);

  const campaignTitleById = new Map(campaigns.map((c) => [c.id, c.title]));

  const headline = loading
    ? "Loading your dashboard…"
    : needsAttention.length > 0
      ? `You have ${needsAttention.length} creative${needsAttention.length === 1 ? "" : "s"} to fix — start in “Act now” below.`
      : activeCampaigns.length > 0
        ? "Nothing needs your action right now. Here's what's running."
        : "Welcome back.";

  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Hi, {displayName}</h1>
        <p className="welcome-body">{headline}</p>
      </section>

      {/* ── Needs your attention (zone 1: act now) ── */}
      {!loading && attentionShown.length > 0 && (
        <section className="dash-zone dash-zone-action" aria-label="Items that need your attention">
          <div className="dash-zone-head">
            <div>
              <span className="dash-zone-eyebrow">Needs your action</span>
              <h2 className="dash-zone-title">
                Fix {attentionItems.length} creative
                {attentionItems.length === 1 ? "" : "s"}
              </h2>
            </div>
            <span className="dash-zone-meta">
              Blocked until you re-upload
            </span>
          </div>
          <ul className="dash-activity">
            {attentionShown.map((s) => {
              const campTitle = campaignTitleById.get(s.campaignId) ?? "—";
              const nextStep =
                s.status === "VALIDATION_FAILED"
                  ? "Fix validation errors, then re-upload"
                  : "Upload a corrected file";
              return (
                <li key={s.id} className="dash-activity-row">
                  <div className="dash-activity-info">
                    <span className="dash-activity-title">{s.title}</span>
                    <span className="dash-activity-meta">
                      {campTitle} · {nextStep}
                    </span>
                  </div>
                  <span className={SUB_STATUS_BADGE[s.status]}>
                    {SUB_STATUS_LABEL[s.status]}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link to="/creatives" className="dash-zone-cta">
            {attentionItems.length > attentionShown.length
              ? `Open Creatives to fix all ${attentionItems.length} →`
              : "Open Creatives to upload fixes →"}
          </Link>
        </section>
      )}

      {/* ── Quick actions (always visible, clear next moves) ── */}
      <section className="section-block">
        <div className="dash-actions">
          <Link to="/creatives" className="dash-action-btn dash-action-primary">
            Upload a creative
          </Link>
          <Link to="/campaigns" className="dash-action-btn">View campaigns</Link>
          <Link to="/documents" className="dash-action-btn">Documents</Link>
          <Link to="/billing" className="dash-action-btn">Billing</Link>
        </div>
      </section>

      {/* ── Active campaigns (zone 2) ── */}
      {!loading && activeCampaigns.length > 0 && (
        <section className="section-block">
          <div className="dash-zone-head dash-zone-head-plain">
            <div>
              <span className="dash-zone-eyebrow">For your awareness</span>
              <h2 className="dash-zone-title">Your active campaigns</h2>
            </div>
            <span className="dash-zone-meta">
              {activeCampaigns.length} running
              {inReview.length > 0 && ` · ${inReview.length} in review`}
              {approved.length > 0 && ` · ${approved.length} approved`}
            </span>
          </div>
          <div className="dash-camp-grid">
            {activeCampaigns.map((c) => {
              const campSubs = allSubs.filter((s) => s.campaignId === c.id);
              const campApproved = campSubs.filter(
                (s) => s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED",
              ).length;
              const campAttention = campSubs.filter(
                (s) =>
                  s.status === "VALIDATION_FAILED" ||
                  s.status === "NEEDS_RESIZING",
              ).length;
              const campPending = campSubs.filter(
                (s) =>
                  s.status === "UPLOADED" || s.status === "UNDER_REVIEW" ||
                  s.status === "VALIDATION_FAILED" || s.status === "NEEDS_RESIZING",
              ).length;
              const campPlacements = placementsByCampaign[c.id] ?? [];

              return (
                <Link
                  key={c.id}
                  to={`/campaigns/${c.id}`}
                  state={{ campaign: c }}
                  className="dash-camp-card-link"
                >
                  <div
                    className={`dash-camp-card${campAttention > 0 ? " dash-camp-card-attention" : ""}`}
                  >
                    <div className="dash-camp-header">
                      <span className="dash-camp-title">{c.title}</span>
                      <span className={CAMP_STATUS_BADGE[c.status]}>
                        {CAMP_STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    {c.description && (
                      <p className="dash-camp-desc">{c.description}</p>
                    )}
                    <div className="dash-camp-meta-row">
                      {c.budgetCents != null && (
                        <span>
                          Budget <Money cents={c.budgetCents} />
                        </span>
                      )}
                      {c.endDate && (() => {
                        const ms =
                          new Date(c.endDate).getTime() - Date.now();
                        const past = ms < 0;
                        const days = Math.floor(Math.abs(ms) / 86_400_000);
                        const soon = !past && days <= 14;
                        const tone = past ? "past" : soon ? "soon" : "far";
                        return (
                          <span
                            className={`deadline-chip deadline-${tone}`}
                            title={new Date(c.endDate).toLocaleDateString()}
                          >
                            {past
                              ? `Ended ${fromNow(c.endDate)}`
                              : `Ends ${shortDate(c.endDate)} · ${fromNow(c.endDate)}`}
                          </span>
                        );
                      })()}
                      <span>
                        {campPlacements.length} placement
                        {campPlacements.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="dash-camp-stats">
                      {campAttention > 0 ? (
                        <span className="dash-camp-action-pill">
                          Needs action · {campAttention}
                        </span>
                      ) : (
                        <span className="dash-camp-ok-pill">
                          On track
                        </span>
                      )}
                      <span className="dash-camp-stats-sep" aria-hidden="true">·</span>
                      <span>
                        {campSubs.length} creative
                        {campSubs.length !== 1 ? "s" : ""}
                      </span>
                      {campApproved > 0 && (
                        <span className="dash-stat-good">
                          {campApproved} approved
                        </span>
                      )}
                      {campPending > 0 && (
                        <span className="dash-stat-pending">
                          {campPending} pending
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent activity (zone 3: context) ── */}
      {!loading && recentSubs.length > 0 && (
        <section className="section-block">
          <div className="dash-zone-head dash-zone-head-plain">
            <div>
              <span className="dash-zone-eyebrow">History</span>
              <h2 className="dash-zone-title">Recent activity</h2>
            </div>
          </div>
          <ul className="dash-activity">
            {recentSubs.map((s) => (
              <li key={s.id} className="dash-activity-row">
                <div className="dash-activity-info">
                  <span className="dash-activity-title">{s.title}</span>
                  <span
                    className="dash-activity-meta mono"
                    title={new Date(s.createdAt).toLocaleString()}
                  >
                    {fromNow(s.createdAt)}
                  </span>
                </div>
                <span className={SUB_STATUS_BADGE[s.status]}>
                  {SUB_STATUS_LABEL[s.status]}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/creatives" className="dash-view-all">View all submissions &rarr;</Link>
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && campaigns.length === 0 && (
        <section className="section-block">
          <div className="dash-empty">
            <p className="dash-empty-text">
              No campaigns have been set up yet. Your Dempsey Agency team
              will create campaigns and you will see them here.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

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

/** Derive a single-sentence "current state" for a campaign card. Priority:
 *  blocking action > in-review > no creatives yet > all approved > neutral.
 *  Each tone maps to a color in the `.dash-camp-pulse-*` CSS rules. */
type PulseTone = "action" | "info" | "positive" | "muted";
interface CampaignPulse {
  tone: PulseTone;
  text: string;
}
function campaignPulse(counts: {
  attention: number;
  inReview: number;
  approved: number;
  creatives: number;
  placements: number;
  live: number;
}): CampaignPulse {
  if (counts.attention > 0) {
    return {
      tone: "action",
      text: `${counts.attention} creative${counts.attention === 1 ? "" : "s"} blocked — needs your action`,
    };
  }
  if (counts.inReview > 0) {
    return {
      tone: "info",
      text: `${counts.inReview} creative${counts.inReview === 1 ? "" : "s"} in agency review`,
    };
  }
  if (counts.placements > 0 && counts.creatives === 0) {
    return { tone: "info", text: "Ready for your creative uploads" };
  }
  if (counts.placements === 0) {
    return { tone: "muted", text: "Media plan in progress with your agency" };
  }
  if (counts.live > 0) {
    return {
      tone: "positive",
      text: `${counts.live} placement${counts.live === 1 ? "" : "s"} running live`,
    };
  }
  if (counts.approved > 0 && counts.approved === counts.creatives) {
    return {
      tone: "positive",
      text: `All ${counts.creatives} creative${counts.creatives === 1 ? "" : "s"} approved`,
    };
  }
  return { tone: "positive", text: "On track" };
}

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

  const headline: { tone: "action" | "info" | "positive" | "muted"; text: string } =
    loading
      ? { tone: "muted", text: "Loading your latest activity…" }
      : needsAttention.length > 0
        ? {
            tone: "action",
            text: `${needsAttention.length} creative${needsAttention.length === 1 ? "" : "s"} need your action — see below.`,
          }
        : activeCampaigns.length === 0
          ? {
              tone: "muted",
              text: "No campaigns yet. Your agency will set these up and they'll appear here.",
            }
          : inReview.length > 0
            ? {
                tone: "info",
                text: `Nothing urgent. ${activeCampaigns.length} campaign${activeCampaigns.length === 1 ? "" : "s"} running · ${inReview.length} creative${inReview.length === 1 ? "" : "s"} with your agency for review.`,
              }
            : {
                tone: "positive",
                text: `Nothing urgent. ${activeCampaigns.length} campaign${activeCampaigns.length === 1 ? "" : "s"} running${approved.length > 0 ? ` · ${approved.length} creative${approved.length === 1 ? "" : "s"} approved` : ""}.`,
              };

  return (
    <>
      {/* ── Hero: command header (identity + status + primary actions) ── */}
      <section className="dash-hero">
        <div className="dash-hero-main">
          <h1 className="dash-hero-name">Hi, {displayName}</h1>
          <p className={`dash-hero-status dash-hero-status-${headline.tone}`}>
            <span
              className="dash-hero-status-dot"
              aria-hidden="true"
            />
            {headline.text}
          </p>
        </div>
        <div className="dash-hero-actions">
          <Link to="/creatives" className="btn-hero btn-hero-primary">
            Upload a creative
          </Link>
          <Link to="/campaigns" className="btn-hero">
            Campaigns
          </Link>
          <Link to="/documents" className="btn-hero">
            Documents
          </Link>
          <Link to="/billing" className="btn-hero">
            Billing
          </Link>
        </div>
      </section>

      {/* ── Act now (only when blocking action exists) ── */}
      {!loading && attentionShown.length > 0 && (
        <section
          className="dash-zone dash-zone-action"
          aria-label="Items that need your attention"
        >
          <div className="dash-zone-head">
            <h2 className="dash-zone-title">
              Fix {attentionItems.length} creative
              {attentionItems.length === 1 ? "" : "s"}
            </h2>
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

      {/* ── Active campaigns: command-center view with pulse + specs ── */}
      {!loading && activeCampaigns.length > 0 && (
        <section className="section-block">
          <div className="dash-section-head">
            <h2 className="dash-section-title">Active campaigns</h2>
            <span className="dash-section-meta">
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
              const campInReview = campSubs.filter(
                (s) =>
                  s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
              ).length;
              const campPlacements = placementsByCampaign[c.id] ?? [];
              const campLive = campPlacements.filter(
                (p) => p.status === "LIVE",
              ).length;
              const pulse = campaignPulse({
                attention: campAttention,
                inReview: campInReview,
                approved: campApproved,
                creatives: campSubs.length,
                placements: campPlacements.length,
                live: campLive,
              });

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

                    <div
                      className={`dash-camp-pulse dash-camp-pulse-${pulse.tone}`}
                    >
                      <span
                        className="dash-camp-pulse-dot"
                        aria-hidden="true"
                      />
                      <span className="dash-camp-pulse-text">{pulse.text}</span>
                    </div>

                    <dl className="dash-camp-specs">
                      <div className="dash-camp-spec">
                        <dt>Budget</dt>
                        <dd>
                          {c.budgetCents != null ? (
                            <Money cents={c.budgetCents} />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </dd>
                      </div>
                      <div className="dash-camp-spec">
                        <dt>{c.endDate ? "Ends" : "Window"}</dt>
                        <dd>
                          {c.endDate ? (
                            (() => {
                              const ms =
                                new Date(c.endDate).getTime() - Date.now();
                              const past = ms < 0;
                              const days = Math.floor(
                                Math.abs(ms) / 86_400_000,
                              );
                              const soon = !past && days <= 14;
                              const tone = past
                                ? "past"
                                : soon
                                  ? "soon"
                                  : "far";
                              return (
                                <span
                                  className={`deadline-chip deadline-${tone}`}
                                  title={new Date(
                                    c.endDate,
                                  ).toLocaleDateString()}
                                >
                                  {past
                                    ? `Ended ${fromNow(c.endDate)}`
                                    : `${shortDate(c.endDate)} · ${fromNow(c.endDate)}`}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="muted">Ongoing</span>
                          )}
                        </dd>
                      </div>
                      <div className="dash-camp-spec">
                        <dt>Placements</dt>
                        <dd className="mono">
                          {campPlacements.length}
                          {campLive > 0 && (
                            <span className="dash-camp-spec-sub">
                              {" "}· {campLive} live
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="dash-camp-spec">
                        <dt>Creatives</dt>
                        <dd className="mono">
                          {campSubs.length}
                          {campApproved > 0 && (
                            <span className="dash-camp-spec-sub">
                              {" "}· {campApproved} approved
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent activity (context feed) ── */}
      {!loading && recentSubs.length > 0 && (
        <section className="section-block">
          <div className="dash-section-head">
            <h2 className="dash-section-title">Recent activity</h2>
            <Link to="/creatives" className="dash-view-all">
              View all submissions &rarr;
            </Link>
          </div>
          <ul className="dash-activity">
            {recentSubs.map((s) => {
              const campTitle = campaignTitleById.get(s.campaignId);
              return (
                <li key={s.id} className="dash-activity-row">
                  <div className="dash-activity-info">
                    <span className="dash-activity-title">{s.title}</span>
                    <span className="dash-activity-meta">
                      {campTitle ? `${campTitle} · ` : ""}
                      <span
                        className="mono"
                        title={new Date(s.createdAt).toLocaleString()}
                      >
                        {fromNow(s.createdAt)}
                      </span>
                    </span>
                  </div>
                  <span className={SUB_STATUS_BADGE[s.status]}>
                    {SUB_STATUS_LABEL[s.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Empty state ── */}
      {!loading && campaigns.length === 0 && (
        <section className="section-block">
          <div className="dash-empty">
            <p className="dash-empty-text">
              No campaigns have been set up yet. Your agency will create
              campaigns and you will see them here.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

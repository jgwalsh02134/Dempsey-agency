import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  Campaign,
  CampaignStatus,
  CreativeSubmission,
  Placement,
  PlacementStatus,
  SubmissionStatus,
} from "../types";

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

const SUB_STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REVISION_REQUESTED: "Revision Requested",
};

const SUB_STATUS_BADGE: Record<SubmissionStatus, string> = {
  SUBMITTED: "report-badge badge-pending",
  APPROVED: "report-badge badge-paid",
  REVISION_REQUESTED: "report-badge badge-overdue",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "Ongoing";
}

const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  DRAFT: "Draft",
  BOOKED: "Booked",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const PLACEMENT_STATUS_BADGE: Record<PlacementStatus, string> = {
  DRAFT: "report-badge",
  BOOKED: "report-badge badge-pending",
  LIVE: "report-badge badge-active",
  COMPLETED: "report-badge badge-completed",
  CANCELLED: "report-badge badge-overdue",
};

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const stateCampaign = (
    location.state as { campaign?: Campaign } | null
  )?.campaign;

  const [campaign, setCampaign] = useState<Campaign | null>(
    stateCampaign?.id === id ? stateCampaign ?? null : null,
  );
  const [campaignLoading, setCampaignLoading] = useState(!campaign);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsError, setPlacementsError] = useState<string | null>(null);

  const [subs, setSubs] = useState<CreativeSubmission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /* ── always fetch fresh campaign data ── */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    if (!campaign) setCampaignLoading(true);

    api
      .fetchCampaign(id)
      .then((fresh) => {
        if (!cancelled) {
          setCampaign(fresh);
          setCampaignError(null);
        }
      })
      .catch((e) => {
        if (!cancelled && !campaign) {
          setCampaignError(
            e instanceof ApiError ? e.message : "Campaign not found",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCampaignLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── fetch placements once campaign is resolved ── */
  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;

    setPlacementsLoading(true);
    setPlacementsError(null);
    setPlacements([]);
    api
      .fetchCampaignPlacements(campaign.id)
      .then((res) => {
        if (!cancelled) setPlacements(res.placements);
      })
      .catch((e) => {
        if (!cancelled)
          setPlacementsError(
            e instanceof ApiError
              ? e.message
              : "Could not load placements.",
          );
      })
      .finally(() => {
        if (!cancelled) setPlacementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaign]);

  /* ── fetch submissions once campaign is resolved ── */
  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;

    setSubsLoading(true);
    setSubsError(null);
    setSubs([]);
    api
      .fetchCampaignSubmissions(campaign.id)
      .then((res) => {
        if (!cancelled) setSubs(res.submissions);
      })
      .catch((e) => {
        if (!cancelled)
          setSubsError(
            e instanceof ApiError
              ? e.message
              : "Could not load submissions.",
          );
      })
      .finally(() => {
        if (!cancelled) setSubsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaign]);

  async function downloadSub(sub: CreativeSubmission) {
    setDownloadingId(sub.id);
    try {
      const { url } = await api.fetchSubmissionDownloadUrl(sub.id);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* non-blocking */
    } finally {
      setDownloadingId(null);
    }
  }

  if (campaignLoading) {
    return (
      <section className="section-welcome">
        <p className="text-muted">Loading campaign…</p>
      </section>
    );
  }

  if (campaignError || !campaign) {
    return (
      <section className="section-welcome">
        <p className="form-error" role="alert">
          {campaignError ?? "Campaign not found"}
        </p>
        <Link to="/campaigns" className="back-link">
          ← Back to campaigns
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="section-welcome">
        <Link to="/campaigns" className="back-link">
          ← Back to campaigns
        </Link>
        <h1 className="welcome-heading" style={{ marginTop: "0.75rem" }}>
          {campaign.title}
        </h1>
        {campaign.description?.trim() ? (
          <p className="welcome-body">{campaign.description}</p>
        ) : (
          <p className="text-muted">No description provided.</p>
        )}
        <div className="detail-header-meta">
          <span className={STATUS_BADGE[campaign.status]}>
            {STATUS_LABEL[campaign.status]}
          </span>
          <span className="text-muted">
            {dateRange(campaign.startDate, campaign.endDate)}
          </span>
          {campaign.budgetCents != null && (
            <span className="text-muted">
              Budget: {formatCents(campaign.budgetCents)}
            </span>
          )}
        </div>
      </section>

      {/* ── Placements ── */}
      <section className="section-block">
        <h2 className="section-heading">Placements</h2>

        {placementsLoading && (
          <p className="text-muted">Loading placements…</p>
        )}

        {placementsError && (
          <p className="form-error" role="alert">
            {placementsError}
          </p>
        )}

        {!placementsLoading && !placementsError && placements.length === 0 && (
          <p className="text-muted">
            No placements have been set up for this campaign yet.
          </p>
        )}

        {!placementsLoading && !placementsError && placements.length > 0 && (
          <ul className="report-list">
            {placements.map((p) => {
              const pub = p.inventory.publisher;
              const loc = [pub.city, pub.state].filter(Boolean).join(", ");
              return (
                <li key={p.id} className="report-item">
                  <div className="report-info">
                    <span className="report-name">{p.name}</span>
                    <span className="report-description">
                      {pub.name}{loc ? ` — ${loc}` : ""}
                    </span>
                    <div className="campaign-meta">
                      <span className="doc-type-badge">
                        {p.inventory.mediaType}
                      </span>
                      <span>{formatCents(p.grossCostCents)}</span>
                      {p.quantity != null && (
                        <>
                          <span>·</span>
                          <span>Qty: {p.quantity}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={PLACEMENT_STATUS_BADGE[p.status]}>
                    {PLACEMENT_STATUS_LABEL[p.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Documents (campaign-specific linking not available yet) ── */}
      <section className="section-block">
        <h2 className="section-heading">Documents</h2>
        <p className="text-muted">
          Campaign-specific documents are not shown here yet. Use{" "}
          <Link to="/documents" className="inline-text-link">
            Documents
          </Link>{" "}
          for files shared with your organization.
        </p>
      </section>

      {/* ── Creative Submissions ── */}
      <section className="section-block">
        <h2 className="section-heading">Creative Submissions</h2>

        {subsLoading && (
          <p className="text-muted">Loading submissions…</p>
        )}

        {subsError && (
          <p className="form-error" role="alert">
            {subsError}
          </p>
        )}

        {!subsLoading && !subsError && subs.length === 0 && (
          <p className="text-muted">
            No creatives have been submitted for this campaign yet.
          </p>
        )}

        {!subsLoading && !subsError && subs.length > 0 && (
          <ul className="report-list">
            {subs.map((s) => (
              <li key={s.id} className="report-item">
                <div className="report-info">
                  <span className="report-name">{s.title}</span>
                  {s.description && (
                    <span className="report-description">
                      {s.description}
                    </span>
                  )}
                  {s.reviewNote && (
                    <div className="review-note">{s.reviewNote}</div>
                  )}
                  <div className="submission-meta">
                    <span className="doc-type-badge">
                      {s.creativeType}
                    </span>
                    <span>
                      {s.filename} &middot; {formatBytes(s.sizeBytes)}{" "}
                      &middot; {formatDate(s.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="submission-actions">
                  <span className={SUB_STATUS_BADGE[s.status]}>
                    {SUB_STATUS_LABEL[s.status]}
                  </span>
                  <button
                    type="button"
                    className="doc-download"
                    disabled={downloadingId === s.id}
                    onClick={() => downloadSub(s)}
                  >
                    {downloadingId === s.id ? "Preparing…" : "Download"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

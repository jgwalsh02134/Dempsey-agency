import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { CampaignMap } from "../components/CampaignMap";
import type {
  Campaign,
  CampaignMapPublisher,
  CampaignStatus,
  CreativeSubmission,
  Placement,
  PlacementStatus,
  PricingModel,
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

/** Client-friendly pricing model labels. Keeps shouty enum values out of
 *  the UI while leaving the raw enum available elsewhere. */
const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  CPM: "CPM",
  VCPM: "vCPM",
  CPC: "CPC",
  CPCV: "CPCV",
  FLAT: "Flat rate",
  COLUMN_INCH: "Column inch",
  PER_LINE: "Per line",
  OTHER: "Other",
};

/** Short, human-readable "next step" for each submission status — rephrased
 *  from the existing enum; no new statuses are invented. */
const SUB_NEXT_STEP: Record<SubmissionStatus, string> = {
  UPLOADED: "Awaiting agency review",
  VALIDATION_FAILED: "Fix validation issues and re-upload",
  UNDER_REVIEW: "Agency is reviewing your creative",
  NEEDS_RESIZING: "Upload a corrected file",
  READY_FOR_PUBLISHER: "Approved — scheduled to send to publisher",
  PUSHED: "Sent to publisher",
};

/** Separator used in inline metadata strips. */
function MetaSep() {
  return (
    <span className="text-muted" aria-hidden="true">
      ·
    </span>
  );
}

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

  const [pubs, setPubs] = useState<CampaignMapPublisher[]>([]);
  const [pubsLoading, setPubsLoading] = useState(false);
  const [pubsError, setPubsError] = useState<string | null>(null);

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

  /* ── fetch campaign publishers (map) once campaign is resolved ── */
  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;

    setPubsLoading(true);
    setPubsError(null);
    setPubs([]);
    api
      .fetchCampaignPublishers(campaign.id)
      .then((res) => {
        if (!cancelled) setPubs(res.publishers);
      })
      .catch((e) => {
        if (!cancelled)
          setPubsError(
            e instanceof ApiError
              ? e.message
              : "Could not load publishers.",
          );
      })
      .finally(() => {
        if (!cancelled) setPubsLoading(false);
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

  /* ── derived stats (UI-only; computed from loaded state) ── */
  const placementTotalCents = placements.reduce(
    (sum, p) => sum + p.grossCostCents,
    0,
  );
  const placementPublisherCount = new Set(
    placements.map((p) => p.inventory.publisher.id),
  ).size;

  /** Unique DMAs (by name) represented across this campaign's placements. Used
   *  for the one-line coverage summary in the overview; hidden when zero. */
  const placementDmaCount = new Set(
    placements
      .map((p) => p.inventory.publisher.dmaName)
      .filter((v): v is string => v != null && v.trim().length > 0),
  ).size;

  /** Group placements by publisher, sorted alphabetically by publisher name;
   *  placements within each group sorted by placement name. Subtotal is the
   *  sum of `grossCostCents` across the group. */
  interface PlacementGroup {
    publisher: Placement["inventory"]["publisher"];
    placements: Placement[];
    subtotalCents: number;
  }
  const placementGroups: PlacementGroup[] = (() => {
    const map = new Map<string, PlacementGroup>();
    for (const p of placements) {
      const pubId = p.inventory.publisher.id;
      const g = map.get(pubId);
      if (g) {
        g.placements.push(p);
        g.subtotalCents += p.grossCostCents;
      } else {
        map.set(pubId, {
          publisher: p.inventory.publisher,
          placements: [p],
          subtotalCents: p.grossCostCents,
        });
      }
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        placements: [...g.placements].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }))
      .sort((a, b) => a.publisher.name.localeCompare(b.publisher.name));
  })();

  const pubsWithCoords = pubs.filter(
    (p) => p.latitude != null && p.longitude != null,
  ).length;

  /** Client-facing status items derived from loaded campaign/placement/submission
   *  state. Order: creative actions → creatives in review → campaign/placement
   *  state. Fallback to a positive "on track" message when nothing else applies. */
  interface NextStep {
    level: "action" | "info" | "positive";
    headline: string;
    detail?: string;
  }
  const nextSteps: NextStep[] = (() => {
    const steps: NextStep[] = [];

    const failed = subs.filter((s) => s.status === "VALIDATION_FAILED").length;
    const resize = subs.filter((s) => s.status === "NEEDS_RESIZING").length;
    const actionCount = failed + resize;
    if (actionCount > 0) {
      const parts: string[] = [];
      if (failed)
        parts.push(
          `${failed} failed validation — fix and re-upload`,
        );
      if (resize)
        parts.push(
          `${resize} need${resize === 1 ? "s" : ""} a corrected size`,
        );
      steps.push({
        level: "action",
        headline: `Action required: ${actionCount} creative${actionCount === 1 ? "" : "s"} need${actionCount === 1 ? "s" : ""} updates`,
        detail: parts.join(" · "),
      });
    }

    const awaiting = subs.filter(
      (s) => s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
    ).length;
    if (awaiting > 0) {
      steps.push({
        level: "info",
        headline: `${awaiting} creative${awaiting === 1 ? "" : "s"} awaiting agency review`,
        detail: "No action needed — we'll reach out if anything's missing.",
      });
    }

    const live = placements.filter((p) => p.status === "LIVE").length;
    const booked = placements.filter((p) => p.status === "BOOKED").length;
    const draft = placements.filter((p) => p.status === "DRAFT").length;
    const completed = placements.filter((p) => p.status === "COMPLETED").length;

    if (campaign.status === "COMPLETED") {
      steps.push({ level: "positive", headline: "Campaign completed" });
    } else if (live > 0) {
      steps.push({ level: "positive", headline: "Campaign is running" });
    } else if (placements.length > 0 && booked === placements.length) {
      steps.push({
        level: "positive",
        headline: "Placements confirmed — awaiting launch",
      });
    } else if (
      placements.length > 0 &&
      completed > 0 &&
      live === 0 &&
      booked === 0 &&
      draft === 0
    ) {
      steps.push({ level: "positive", headline: "All placements completed" });
    } else if (draft > 0) {
      steps.push({
        level: "info",
        headline: "Placements being prepared by your agency",
      });
    }

    if (steps.length === 0 && !placementsLoading && !subsLoading) {
      steps.push({ level: "positive", headline: "Everything is on track" });
    }

    return steps;
  })();
  const hasAction = nextSteps.some((s) => s.level === "action");

  const subCounts = subs.reduce(
    (acc, s) => {
      if (s.status === "READY_FOR_PUBLISHER" || s.status === "PUSHED") {
        acc.approved += 1;
      } else if (
        s.status === "VALIDATION_FAILED" ||
        s.status === "NEEDS_RESIZING"
      ) {
        acc.actionNeeded += 1;
      } else {
        // UPLOADED + UNDER_REVIEW
        acc.awaiting += 1;
      }
      return acc;
    },
    { approved: 0, awaiting: 0, actionNeeded: 0 },
  );

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
        <div
          className="detail-header-meta"
          style={{ flexWrap: "wrap", rowGap: "0.5rem" }}
        >
          <span className={STATUS_BADGE[campaign.status]}>
            {STATUS_LABEL[campaign.status]}
          </span>
          <span className="text-muted">
            {dateRange(campaign.startDate, campaign.endDate)}
          </span>
          {pubs.length > 0 && (
            <>
              <MetaSep />
              <span className="text-muted">
                {pubs.length} publisher{pubs.length === 1 ? "" : "s"}
              </span>
            </>
          )}
          {placements.length > 0 && (
            <>
              <MetaSep />
              <span className="text-muted">
                {placements.length} placement
                {placements.length === 1 ? "" : "s"}
              </span>
            </>
          )}
          {placementDmaCount > 0 && (
            <>
              <MetaSep />
              <span className="text-muted">
                Coverage: {placementPublisherCount} publisher
                {placementPublisherCount === 1 ? "" : "s"} across{" "}
                {placementDmaCount} DMA{placementDmaCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
        {(campaign.budgetCents != null || placements.length > 0) && (
          <div style={{ marginTop: "0.75rem" }}>
            {campaign.budgetCents != null && (
              <div className="money-block">
                <span className="money-label">Budget</span>
                <span className="money-value">
                  {formatCents(campaign.budgetCents)}
                </span>
              </div>
            )}
            {placements.length > 0 && (
              <p
                className="text-muted"
                style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}
              >
                Total planned:{" "}
                <strong style={{ color: "inherit" }}>
                  {formatCents(placementTotalCents)}
                </strong>{" "}
                across {placements.length} placement
                {placements.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Next Steps ── */}
      {!placementsLoading && !subsLoading && nextSteps.length > 0 && (
        <section className="section-block">
          <h2 className="section-heading">Next Steps</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              marginTop: "0.5rem",
            }}
          >
            {nextSteps.map((step, i) => {
              const styleFor = {
                action: {
                  bg: "var(--color-error-bg)",
                  border: "var(--color-error-border)",
                  color: "var(--color-error-text)",
                },
                info: {
                  bg: "var(--color-pending-bg)",
                  border: "#BFDBFE",
                  color: "var(--color-pending-text)",
                },
                positive: {
                  bg: "var(--color-success-bg)",
                  border: "#BBF7D0",
                  color: "var(--color-success-text)",
                },
              }[step.level];
              return (
                <div
                  key={i}
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.5rem",
                    border: `1px solid ${styleFor.border}`,
                    background: styleFor.bg,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: styleFor.color,
                      lineHeight: 1.3,
                    }}
                  >
                    {step.headline}
                  </div>
                  {step.detail && (
                    <div
                      style={{
                        fontSize: "0.9rem",
                        marginTop: "0.25rem",
                        color: styleFor.color,
                      }}
                    >
                      {step.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hasAction && (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}>
              <Link to="/creatives" className="inline-text-link">
                Go to Creatives →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ── Placements ── */}
      <section className="section-block">
        <div
          className="camp-section-header"
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <h2 className="section-heading" style={{ margin: 0 }}>
            Placements
          </h2>
          {placements.length > 0 && (
            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
              {placements.length} placement
              {placements.length === 1 ? "" : "s"} · {placementPublisherCount}{" "}
              publisher{placementPublisherCount === 1 ? "" : "s"} · Total{" "}
              <strong style={{ color: "inherit" }}>
                {formatCents(placementTotalCents)}
              </strong>
            </span>
          )}
        </div>

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
            Your agency is still building out this campaign's media plan.
            Placements will appear here as they're added.
          </p>
        )}

        {!placementsLoading && !placementsError && placements.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.35rem",
              marginTop: "0.75rem",
            }}
          >
            {placementGroups.map((group) => {
              const loc = [group.publisher.city, group.publisher.state]
                .filter(Boolean)
                .join(", ");
              const count = group.placements.length;
              return (
                <div key={group.publisher.id}>
                  {/* Publisher heading (not a card — anchors the cards below) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      flexWrap: "wrap",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                        {group.publisher.name}
                      </div>
                      <div
                        className="text-muted"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {loc || "Location unknown"} · {count} placement
                        {count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div
                      style={{ textAlign: "right", whiteSpace: "nowrap" }}
                    >
                      <span
                        className="text-muted"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Subtotal
                      </span>{" "}
                      <strong>{formatCents(group.subtotalCents)}</strong>
                    </div>
                  </div>

                  {/* Placement cards — each is its own bordered unit of spend */}
                  <ul
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.65rem",
                    }}
                  >
                    {group.placements.map((p) => (
                      <li
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "1rem",
                          flexWrap: "wrap",
                          padding: "0.9rem 1rem",
                          borderRadius: "0.5rem",
                          border: "1px solid rgba(15, 23, 42, 0.12)",
                          background: "var(--color-surface, #fff)",
                          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                        }}
                      >
                        <div style={{ flex: "1 1 16rem", minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "1.2rem",
                              lineHeight: 1.25,
                              color: "var(--color-text, #111827)",
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.9rem",
                              marginTop: "0.25rem",
                              color: "rgb(55, 65, 81)",
                            }}
                          >
                            {p.inventory.name}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.55rem",
                              marginTop: "0.6rem",
                            }}
                          >
                            <span className="doc-type-badge">
                              {p.inventory.mediaType}
                            </span>
                            <span
                              className="text-muted"
                              style={{ fontSize: "0.85rem" }}
                            >
                              {PRICING_MODEL_LABEL[p.inventory.pricingModel]}
                            </span>
                            {p.quantity != null && (
                              <>
                                <span
                                  className="text-muted"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span
                                  className="text-muted"
                                  style={{ fontSize: "0.85rem" }}
                                >
                                  Qty {p.quantity}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "0.5rem",
                            whiteSpace: "nowrap",
                            minWidth: "6rem",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "1.45rem",
                              lineHeight: 1,
                              color: "#0f172a",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {formatCents(p.grossCostCents)}
                          </span>
                          <span
                            className={PLACEMENT_STATUS_BADGE[p.status]}
                            style={{
                              fontSize: "0.82rem",
                              padding: "0.28rem 0.7rem",
                            }}
                          >
                            {PLACEMENT_STATUS_LABEL[p.status]}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Publisher map (only publishers attached to this campaign) ── */}
      <section className="section-block">
        <div
          className="camp-section-header"
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <h2 className="section-heading" style={{ margin: 0 }}>
            Publisher Map
          </h2>
          {pubs.length > 0 && (
            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
              {pubs.length} publisher{pubs.length === 1 ? "" : "s"} attached
              {pubsWithCoords < pubs.length &&
                ` · ${pubsWithCoords} with location data`}
            </span>
          )}
        </div>

        {pubsLoading && (
          <p className="text-muted">Loading publishers…</p>
        )}

        {pubsError && (
          <p className="form-error" role="alert">
            {pubsError}
          </p>
        )}

        {!pubsLoading && !pubsError && pubs.length === 0 && (
          <p className="text-muted">
            No publishers have been selected for this campaign yet.
          </p>
        )}

        {!pubsLoading && !pubsError && pubs.length > 0 && (
          <CampaignMap publishers={pubs} />
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
        <div className="camp-section-header">
          <h2 className="section-heading" style={{ margin: 0 }}>Creative Submissions</h2>
          <Link to="/creatives" className="camp-upload-link">Upload creative &rarr;</Link>
        </div>

        {subs.length > 0 && (
          <p
            className="text-muted"
            style={{ margin: "0.4rem 0 0.75rem", fontSize: "0.9rem" }}
          >
            {subs.length} submission{subs.length === 1 ? "" : "s"}
            {subCounts.approved > 0 && ` · ${subCounts.approved} approved`}
            {subCounts.awaiting > 0 && ` · ${subCounts.awaiting} awaiting review`}
            {subCounts.actionNeeded > 0 &&
              ` · ${subCounts.actionNeeded} need your attention`}
          </p>
        )}

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
            No creatives have been uploaded for this campaign yet.{" "}
            <Link to="/creatives" className="inline-text-link">
              Upload your first creative
            </Link>{" "}
            to get started.
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
                  <div
                    className="text-muted"
                    style={{
                      fontSize: "0.85rem",
                      marginTop: "0.35rem",
                    }}
                  >
                    <strong style={{ color: "inherit", fontWeight: 600 }}>
                      Next step:
                    </strong>{" "}
                    {SUB_NEXT_STEP[s.status]}
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

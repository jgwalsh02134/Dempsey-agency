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
  Document,
  DocumentCategory,
  Placement,
  PlacementStatus,
  PricingModel,
  SubmissionStatus,
} from "../types";

const DOC_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  INVOICE: "Invoices",
  PROOF: "Proofs",
  INSERTION_ORDER: "Insertion Orders",
  CONTRACT: "Contracts",
  CREATIVE_ASSET: "Creative Assets",
  OTHER: "Other",
};
const DOC_CATEGORY_ORDER: DocumentCategory[] = [
  "INVOICE",
  "PROOF",
  "INSERTION_ORDER",
  "CONTRACT",
  "CREATIVE_ASSET",
  "OTHER",
];

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

/** Relative time label for timeline entries. Coarse — days for anything over
 *  a day old — which is appropriate for an activity feed that's read at a
 *  glance, not a precise audit log. */
function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
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

/** Single rendering path for all currency values on this page so every
 *  dollar amount uses the same mono, tabular-nums, tnum treatment and a
 *  shared prominence scale (sub < base < lead < total). */
function Money({
  cents,
  size,
  tone,
  className,
}: {
  cents: number | null;
  size?: "sub" | "lead" | "total";
  tone?: "positive" | "negative";
  className?: string;
}) {
  const classes = [
    "money",
    size ? `money-${size}` : null,
    tone ? `money-${tone}` : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{formatCents(cents)}</span>;
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
  UPLOADED: "In queue for agency review — nothing you need to do right now",
  VALIDATION_FAILED: "Fix the validation errors below and upload a new version",
  UNDER_REVIEW: "Agency is reviewing — we'll update you if anything is needed",
  NEEDS_RESIZING: "Upload a corrected version — see the agency note below",
  READY_FOR_PUBLISHER: "Approved — scheduled to send to publisher",
  PUSHED: "Sent to publisher — no further action needed",
};

/** Statuses that require the client to upload a revised file. */
const ACTION_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  "VALIDATION_FAILED",
  "NEEDS_RESIZING",
]);

/** Tone of the per-submission "Next step" callout — drives the colored
 *  accent bar and background. */
const SUB_NEXT_STEP_TONE: Record<
  SubmissionStatus,
  "action" | "info" | "positive"
> = {
  UPLOADED: "info",
  VALIDATION_FAILED: "action",
  UNDER_REVIEW: "info",
  NEEDS_RESIZING: "action",
  READY_FOR_PUBLISHER: "positive",
  PUSHED: "positive",
};

/** Legend swatch + label used under the Results snapshot progress bar. */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.55rem",
          height: "0.55rem",
          borderRadius: "999px",
          background: color,
          flex: "0 0 auto",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

/** Single stat tile used in the Results snapshot grid. */
function SnapshotStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "0.75rem 0.9rem",
        borderRadius: "0.5rem",
        border: "1px solid rgba(15,23,42,0.1)",
        background: "var(--color-surface, #fff)",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "rgb(107, 114, 128)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "0.2rem",
          fontWeight: 700,
          fontSize: "1.1rem",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.82rem",
            color: "rgb(107, 114, 128)",
            marginTop: "0.15rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

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

  /* ── documents scoped to the campaign's organization ──
   *  The document model is still org-scoped (no campaignId link yet), so
   *  we surface the org's documents categorized here. Clients get a useful
   *  hub on the campaign page without waiting for a fuller campaign-doc
   *  linking model. */
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docDownloadingId, setDocDownloadingId] = useState<string | null>(null);

  /* ── per-placement approval form state ──
   *  Keyed by placement id. Open toggles the inline note/confirm form. */
  const [approval, setApproval] = useState<
    Record<
      string,
      { open: boolean; note: string; submitting: boolean; error: string | null }
    >
  >({});

  /* ── per-chain revision upload state ──
   *  Keyed by the chain's *latest* submission id (what the row represents).
   *  Tracks in-flight upload and any error so multiple chains can revise
   *  independently without blocking each other. */
  const [revising, setRevising] = useState<
    Record<string, { submitting: boolean; error: string | null }>
  >({});

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

  /* ── fetch org documents once campaign is resolved ── */
  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;

    setDocsLoading(true);
    setDocsError(null);
    setDocs([]);
    api
      .fetchOrgDocuments(campaign.organizationId)
      .then((res) => {
        if (!cancelled) setDocs(res.documents);
      })
      .catch((e) => {
        if (!cancelled)
          setDocsError(
            e instanceof ApiError ? e.message : "Could not load documents.",
          );
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
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

  async function downloadDoc(doc: Document) {
    setDocDownloadingId(doc.id);
    try {
      const { url } = await api.fetchDocumentDownloadUrl(doc.id);
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
      setDocDownloadingId(null);
    }
  }

  async function approvePlacement(placementId: string) {
    const draft = approval[placementId] ?? {
      open: true,
      note: "",
      submitting: false,
      error: null,
    };
    setApproval((a) => ({
      ...a,
      [placementId]: { ...draft, submitting: true, error: null },
    }));
    try {
      const updated = await api.respondToPlacement(placementId, {
        response: "CLIENT_APPROVED",
        note: draft.note.trim() || null,
      });
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === placementId
            ? {
                ...p,
                clientResponse: updated.clientResponse,
                clientResponseNote: updated.clientResponseNote,
                clientRespondedAt: updated.clientRespondedAt,
              }
            : p,
        ),
      );
      setApproval((a) => {
        const next = { ...a };
        delete next[placementId];
        return next;
      });
    } catch (e) {
      setApproval((a) => ({
        ...a,
        [placementId]: {
          ...draft,
          submitting: false,
          error:
            e instanceof ApiError
              ? e.message
              : "Could not record approval. Please try again.",
        },
      }));
    }
  }

  /** Upload a revised file against an existing submission's chain. The
   *  server inherits title/creativeType/description from the parent and
   *  writes the new row with parentSubmissionId set to the chain root. */
  async function uploadRevision(parent: CreativeSubmission, file: File) {
    if (!campaign) return;
    setRevising((r) => ({
      ...r,
      [parent.id]: { submitting: true, error: null },
    }));
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("parentSubmissionId", parent.id);
      await api.uploadSubmission(campaign.id, form);
      // Refetch the full list so grouping picks up the new version cleanly.
      const res = await api.fetchCampaignSubmissions(campaign.id);
      setSubs(res.submissions);
      setRevising((r) => {
        const next = { ...r };
        delete next[parent.id];
        return next;
      });
    } catch (e) {
      setRevising((r) => ({
        ...r,
        [parent.id]: {
          submitting: false,
          error:
            e instanceof ApiError
              ? e.message
              : "Upload failed. Please try again.",
        },
      }));
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

  /** Placements still awaiting the client's acknowledgment. Used to surface
   *  a pending-review count in the placements header and the next-steps
   *  panel without rearranging existing sections. */
  const placementsPendingReview = placements.filter(
    (p) => p.clientResponse === "PENDING_CLIENT_REVIEW",
  ).length;

  /** Results snapshot — plan-lifecycle counts + coverage, derived entirely
   *  from data already on the page. Cancellations are excluded from the
   *  progress bar (they're not part of forward progress) but still counted
   *  for transparency below. */
  const placementLifecycle = (() => {
    let draft = 0;
    let booked = 0;
    let live = 0;
    let completed = 0;
    let cancelled = 0;
    let approved = 0;
    let billable = 0;
    for (const p of placements) {
      if (p.status === "DRAFT") draft += 1;
      else if (p.status === "BOOKED") booked += 1;
      else if (p.status === "LIVE") live += 1;
      else if (p.status === "COMPLETED") completed += 1;
      else if (p.status === "CANCELLED") cancelled += 1;
      if (p.status !== "CANCELLED") {
        billable += 1;
        if (p.clientResponse === "CLIENT_APPROVED") approved += 1;
      }
    }
    const progressTotal = draft + booked + live + completed;
    return {
      draft,
      booked,
      live,
      completed,
      cancelled,
      approved,
      billable,
      progressTotal,
    };
  })();

  const stateCount = new Set(
    placements
      .map((p) => p.inventory.publisher.state)
      .filter((s): s is string => s != null && s.trim().length > 0)
      .map((s) => s.trim().toUpperCase()),
  ).size;

  const proofCount = docs.filter((d) => d.category === "PROOF").length;
  const invoiceCount = docs.filter((d) => d.category === "INVOICE").length;

  /** Documents grouped by category in canonical order, empty buckets
   *  dropped. Rendered in the Documents hub section below. */
  const docGroups: { category: DocumentCategory; docs: Document[] }[] = (() => {
    const map = new Map<DocumentCategory, Document[]>();
    for (const d of docs) {
      const key = (d.category ?? "OTHER") as DocumentCategory;
      const bucket = map.get(key);
      if (bucket) bucket.push(d);
      else map.set(key, [d]);
    }
    return DOC_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      docs: map.get(c)!,
    }));
  })();
  const invoiceDocs = docs.filter((d) => d.category === "INVOICE");

  /** Financial summary — derived from existing placement data only.
   *  `planned` excludes CANCELLED placements since they won't be spent.
   *  `approved` additionally requires the client to have approved the row.
   *  `remaining` is null when the campaign has no budget set. */
  const financials = (() => {
    let planned = 0;
    let approved = 0;
    let approvedCount = 0;
    let billableCount = 0;
    for (const p of placements) {
      if (p.status === "CANCELLED") continue;
      billableCount += 1;
      planned += p.grossCostCents;
      if (p.clientResponse === "CLIENT_APPROVED") {
        approved += p.grossCostCents;
        approvedCount += 1;
      }
    }
    const budget = campaign.budgetCents;
    const remaining = budget != null ? budget - planned : null;
    const overBudget = budget != null && planned > budget;
    return {
      budget,
      planned,
      approved,
      remaining,
      overBudget,
      approvedCount,
      billableCount,
    };
  })();

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
  /** The latest submission in each revision chain — used so review-loop counts
   *  reflect one creative per chain instead of every historical version. */
  const latestByChain: CreativeSubmission[] = (() => {
    const map = new Map<string, CreativeSubmission>();
    for (const s of subs) {
      const root = s.parentSubmissionId ?? s.id;
      const prev = map.get(root);
      if (!prev || s.version > prev.version) map.set(root, s);
    }
    return Array.from(map.values());
  })();

  const nextSteps: NextStep[] = (() => {
    const steps: NextStep[] = [];

    const failed = latestByChain.filter(
      (s) => s.status === "VALIDATION_FAILED",
    ).length;
    const resize = latestByChain.filter(
      (s) => s.status === "NEEDS_RESIZING",
    ).length;
    const actionCount = failed + resize;
    if (actionCount > 0) {
      const parts: string[] = [];
      if (failed) parts.push(`${failed} failed validation`);
      if (resize) parts.push(`${resize} needs resizing`);
      steps.push({
        level: "action",
        headline: `Upload fixes for ${actionCount} creative${actionCount === 1 ? "" : "s"}`,
        detail: `${parts.join(" · ")}. Scroll to Files & creatives and use "Upload revised version".`,
      });
    }

    const awaiting = latestByChain.filter(
      (s) => s.status === "UPLOADED" || s.status === "UNDER_REVIEW",
    ).length;
    if (awaiting > 0) {
      steps.push({
        level: "info",
        headline: `Wait — ${awaiting} creative${awaiting === 1 ? "" : "s"} in agency review`,
        detail: "No action from you. We'll message you if anything needs changes.",
      });
    }

    if (placementsPendingReview > 0) {
      steps.push({
        level: "action",
        headline: `Approve ${placementsPendingReview} placement${placementsPendingReview === 1 ? "" : "s"} in the media plan`,
        detail: "Scroll to Media plan and click Approve on each one to confirm.",
      });
    }

    const live = placements.filter((p) => p.status === "LIVE").length;
    const booked = placements.filter((p) => p.status === "BOOKED").length;
    const draft = placements.filter((p) => p.status === "DRAFT").length;
    const completed = placements.filter((p) => p.status === "COMPLETED").length;

    if (campaign.status === "COMPLETED") {
      steps.push({
        level: "positive",
        headline: "Campaign complete — nothing more to do",
      });
    } else if (live > 0) {
      steps.push({
        level: "positive",
        headline: `${live} placement${live === 1 ? "" : "s"} running live`,
        detail: "Watch for proofs in Files & creatives as they land.",
      });
    } else if (placements.length > 0 && booked === placements.length) {
      steps.push({
        level: "positive",
        headline: "All placements confirmed — waiting for launch",
      });
    } else if (
      placements.length > 0 &&
      completed > 0 &&
      live === 0 &&
      booked === 0 &&
      draft === 0
    ) {
      steps.push({
        level: "positive",
        headline: "All placements completed",
      });
    } else if (draft > 0) {
      steps.push({
        level: "info",
        headline: "Wait — your agency is still building the media plan",
        detail: "Placements will appear below when they're ready for your review.",
      });
    }

    if (steps.length === 0 && !placementsLoading && !subsLoading) {
      steps.push({
        level: "positive",
        headline: "Nothing needs your attention right now",
      });
    }

    return steps;
  })();
  const hasAction = nextSteps.some((s) => s.level === "action");

  /** Group submissions into revision chains keyed by the root submission id.
   *  Within each chain, the entry with the highest `version` is the current
   *  creative; older entries are preserved for transparency but rendered
   *  behind a disclosure. */
  interface SubChain {
    rootId: string;
    latest: CreativeSubmission;
    prior: CreativeSubmission[];
  }
  const subChains: SubChain[] = (() => {
    const groups = new Map<string, CreativeSubmission[]>();
    for (const s of subs) {
      const root = s.parentSubmissionId ?? s.id;
      const bucket = groups.get(root);
      if (bucket) bucket.push(s);
      else groups.set(root, [s]);
    }
    // Sort within each chain: newest version first, createdAt as tiebreak.
    const chains = Array.from(groups.entries()).map(([rootId, list]) => {
      const sorted = [...list].sort((a, b) => {
        if (b.version !== a.version) return b.version - a.version;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      return { rootId, latest: sorted[0]!, prior: sorted.slice(1) };
    });
    // Order chains so action-required appears first, then awaiting, then
    // approved; ties broken by the latest createdAt descending.
    const priority: Record<SubmissionStatus, number> = {
      VALIDATION_FAILED: 0,
      NEEDS_RESIZING: 1,
      UPLOADED: 2,
      UNDER_REVIEW: 3,
      READY_FOR_PUBLISHER: 4,
      PUSHED: 5,
    };
    return chains.sort((a, b) => {
      const p = priority[a.latest.status] - priority[b.latest.status];
      if (p !== 0) return p;
      return (
        new Date(b.latest.createdAt).getTime() -
        new Date(a.latest.createdAt).getTime()
      );
    });
  })();

  /** Activity timeline — derived client-side from already-loaded state.
   *  Honest about what timestamps actually represent: each submission row's
   *  createdAt is exact, placement.clientRespondedAt is exact, but the
   *  campaign-completed entry uses `campaign.updatedAt`, which is only a
   *  best-effort proxy (it reflects the most recent write). Events that
   *  can't be honestly sourced (placement status transitions, agency
   *  review-note writes) are intentionally omitted. */
  interface TimelineEvent {
    id: string;
    at: string;
    icon: string;
    title: string;
    detail?: string;
  }
  const timelineEvents: TimelineEvent[] = (() => {
    const events: TimelineEvent[] = [];

    // Every submission row — originals AND revisions.
    for (const s of subs) {
      if (s.version > 1) {
        events.push({
          id: `sub-${s.id}`,
          at: s.createdAt,
          icon: "↻",
          title: `Revised ${s.title} uploaded`,
          detail: `Version ${s.version} · ${s.filename}`,
        });
      } else {
        events.push({
          id: `sub-${s.id}`,
          at: s.createdAt,
          icon: "＋",
          title: `${s.title} uploaded`,
          detail: s.filename,
        });
      }
    }

    // Placement client approvals.
    for (const p of placements) {
      if (
        p.clientResponse === "CLIENT_APPROVED" &&
        p.clientRespondedAt != null
      ) {
        events.push({
          id: `plc-approved-${p.id}`,
          at: p.clientRespondedAt,
          icon: "✓",
          title: `Placement approved: ${p.name}`,
          detail: p.clientResponseNote
            ? `“${p.clientResponseNote}”`
            : p.inventory.publisher.name,
        });
      }
    }

    // Campaign completion — approximate timestamp (see note above).
    if (campaign.status === "COMPLETED") {
      events.push({
        id: `camp-completed-${campaign.id}`,
        at: campaign.updatedAt,
        icon: "★",
        title: "Campaign marked complete",
      });
    }

    return events.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  })();

  /* Counts reflect chains (one per creative) rather than every row, so
   * revisions don't inflate the "N submissions" summary. */
  const subCounts = subChains.reduce(
    (acc, c) => {
      const s = c.latest.status;
      if (s === "READY_FOR_PUBLISHER" || s === "PUSHED") acc.approved += 1;
      else if (s === "VALIDATION_FAILED" || s === "NEEDS_RESIZING")
        acc.actionNeeded += 1;
      else acc.awaiting += 1;
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
        <div className="campaign-hero">
          <div className="campaign-hero-title-row">
            <h1 className="welcome-heading" style={{ margin: 0 }}>
              {campaign.title}
            </h1>
            <span className={STATUS_BADGE[campaign.status]}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          {campaign.description?.trim() ? (
            <p className="welcome-body">{campaign.description}</p>
          ) : (
            <p className="text-muted" style={{ margin: "0.5rem 0 0" }}>
              No description provided.
            </p>
          )}
          <div className="campaign-hero-meta">
            <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
            {pubs.length > 0 && (
              <>
                <MetaSep />
                <span>
                  {pubs.length} publisher{pubs.length === 1 ? "" : "s"}
                </span>
              </>
            )}
            {placements.length > 0 && (
              <>
                <MetaSep />
                <span>
                  {placements.length} placement
                  {placements.length === 1 ? "" : "s"}
                </span>
              </>
            )}
            {placementDmaCount > 0 && (
              <>
                <MetaSep />
                <span>
                  Coverage: {placementPublisherCount} publisher
                  {placementPublisherCount === 1 ? "" : "s"} across{" "}
                  {placementDmaCount} DMA{placementDmaCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
          {(campaign.budgetCents != null || placements.length > 0) && (
            <div className="campaign-hero-budget">
              {campaign.budgetCents != null ? (
                <div className="money-block">
                  <span className="money-label">Budget</span>
                  <Money
                    cents={campaign.budgetCents}
                    className="money-value money-lead"
                  />
                </div>
              ) : (
                <span />
              )}
              {placements.length > 0 && (
                <span className="campaign-hero-budget-total">
                  Total planned{" "}
                  <Money cents={placementTotalCents} />{" "}
                  across {placements.length} placement
                  {placements.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Control: next-action guidance ── */}
      {!placementsLoading && !subsLoading && nextSteps.length > 0 && (
        <section className="section-block zone-section zone-control">
          <div className="zone-label">
            {hasAction ? "Needs your action" : "Status"}
          </div>
          <div className="next-steps-block">
            <h2 className="next-steps-title">
              {hasAction
                ? `Do this next · ${nextSteps.filter((s) => s.level === "action").length} action${nextSteps.filter((s) => s.level === "action").length === 1 ? "" : "s"} open`
                : "Nothing needs your attention right now"}
            </h2>
            <div className="next-steps-list">
              {nextSteps.map((step, i) => (
                <div
                  key={i}
                  className={`next-step-item next-step-item-${step.level}`}
                >
                  <div className="next-step-headline">{step.headline}</div>
                  {step.detail && (
                    <div className="next-step-detail">{step.detail}</div>
                  )}
                </div>
              ))}
            </div>
            {hasAction && (
              <p className="next-steps-cta">
                <Link to="/creatives" className="inline-text-link">
                  Go to Creatives to fix these →
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── FINANCIAL zone: budget ──
          Derived entirely from campaign.budgetCents + placement.grossCostCents
          and placement.clientResponse. Hidden while placements are still
          loading so numbers don't jump, and when there's no budget AND no
          placements to report against. */}
      {!placementsLoading && (financials.budget != null || placements.length > 0) && (
        <section className="section-block zone-section zone-financial">
          <div className="zone-label">Money</div>
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
            <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
              Budget
            </h2>
          </div>

          <dl className="budget-grid">
            {/* Lead tile — the number that drives decisions */}
            {financials.budget != null ? (
              <div
                className={`budget-card budget-card-lead${financials.overBudget ? " budget-card-lead-over" : ""}`}
              >
                <div>
                  <dt className="budget-card-label">
                    {financials.overBudget ? "Over budget by" : "Remaining to spend"}
                  </dt>
                  <dd className="budget-card-sub" style={{ margin: "0.15rem 0 0" }}>
                    {financials.overBudget
                      ? "Planned cost exceeds the campaign budget."
                      : `of ${formatCents(financials.budget)} campaign budget`}
                  </dd>
                </div>
                <dd style={{ margin: 0 }}>
                  <Money
                    cents={Math.abs(financials.remaining ?? 0)}
                    size="total"
                  />
                </dd>
              </div>
            ) : (
              <div className="budget-card budget-card-lead budget-card-lead-none">
                <div>
                  <dt className="budget-card-label">Campaign budget</dt>
                  <dd className="budget-card-sub" style={{ margin: "0.15rem 0 0" }}>
                    Not set yet — your agency can add one at any time.
                  </dd>
                </div>
                <dd style={{ margin: 0 }}>
                  <span className="money money-total">—</span>
                </dd>
              </div>
            )}

            {/* Secondary tiles — the components of the total */}
            <div className="budget-card">
              <dt className="budget-card-label">Campaign budget</dt>
              <dd style={{ margin: 0 }}>
                {financials.budget != null ? (
                  <Money cents={financials.budget} size="lead" />
                ) : (
                  <span className="money money-lead money-sub">Not set</span>
                )}
              </dd>
            </div>

            <div className="budget-card">
              <dt className="budget-card-label">Total planned</dt>
              <dd style={{ margin: 0 }}>
                <Money
                  cents={financials.planned}
                  size="lead"
                  tone={financials.overBudget ? "negative" : undefined}
                />
              </dd>
              <span className="budget-card-sub">
                across {financials.billableCount} placement
                {financials.billableCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="budget-card">
              <dt className="budget-card-label">Approved by you</dt>
              <dd style={{ margin: 0 }}>
                <Money cents={financials.approved} size="lead" />
              </dd>
              {financials.billableCount > 0 && (
                <span className="budget-card-sub">
                  {financials.approvedCount} of {financials.billableCount} approved
                </span>
              )}
            </div>
          </dl>

          {financials.overBudget && (
            <p
              role="alert"
              style={{
                marginTop: "0.65rem",
                fontSize: "0.85rem",
                color: "var(--color-error-text)",
              }}
            >
              Your agency will reconcile this with you.
            </p>
          )}
        </section>
      )}

      {/* ── Execution: placements + publisher map ── */}
      <section className="section-block zone-section zone-execution">
        <div className="zone-label">Media plan</div>
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
          <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
            Placements
          </h2>
          {placements.length > 0 && (
            <span className="text-muted" style={{ fontSize: "0.9rem" }}>
              {placements.length} placement
              {placements.length === 1 ? "" : "s"} · {placementPublisherCount}{" "}
              publisher{placementPublisherCount === 1 ? "" : "s"} · Total{" "}
              <Money cents={placementTotalCents} />
              {placementsPendingReview > 0 && (
                <>
                  {" "}· {placementsPendingReview} awaiting your review
                </>
              )}
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
                      <Money cents={group.subtotalCents} size="lead" />
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
                    {group.placements.map((p) => {
                      const approvalDraft = approval[p.id];
                      const approved = p.clientResponse === "CLIENT_APPROVED";
                      return (
                      <li key={p.id} className="placement-card">
                        <div style={{ flex: "1 1 16rem", minWidth: 0 }}>
                          <div className="placement-card-name">{p.name}</div>
                          <div className="placement-card-inventory">
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
                          <Money
                            cents={p.grossCostCents}
                            className="placement-card-price"
                          />
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

                        {/* Client acknowledgment strip — full width below
                            the main card content. Stacks cleanly on mobile. */}
                        <div
                          style={{
                            flex: "1 0 100%",
                            marginTop: "0.6rem",
                            paddingTop: "0.6rem",
                            borderTop: "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {approved ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "baseline",
                                gap: "0.5rem",
                                fontSize: "0.9rem",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.18rem 0.55rem",
                                  borderRadius: "999px",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  background: "var(--color-success-bg)",
                                  color: "var(--color-success-text)",
                                  border: "1px solid #BBF7D0",
                                }}
                              >
                                ✓ Approved
                              </span>
                              {p.clientRespondedAt && (
                                <span
                                  className="text-muted"
                                  style={{ fontSize: "0.85rem" }}
                                >
                                  {formatDate(p.clientRespondedAt)}
                                </span>
                              )}
                              {p.clientResponseNote && (
                                <span
                                  style={{
                                    fontSize: "0.85rem",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  “{p.clientResponseNote}”
                                </span>
                              )}
                            </div>
                          ) : approvalDraft?.open ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.45rem",
                              }}
                            >
                              <label style={{ fontSize: "0.85rem" }}>
                                Optional note (visible to your agency)
                                <textarea
                                  value={approvalDraft.note}
                                  maxLength={1000}
                                  rows={2}
                                  onChange={(e) =>
                                    setApproval((a) => ({
                                      ...a,
                                      [p.id]: {
                                        ...(a[p.id] ?? {
                                          open: true,
                                          note: "",
                                          submitting: false,
                                          error: null,
                                        }),
                                        note: e.target.value,
                                      },
                                    }))
                                  }
                                  disabled={approvalDraft.submitting}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    marginTop: "0.25rem",
                                    padding: "0.4rem 0.55rem",
                                    borderRadius: "0.35rem",
                                    border: "1px solid rgba(15,23,42,0.18)",
                                    fontSize: "0.9rem",
                                  }}
                                />
                              </label>
                              {approvalDraft.error && (
                                <span
                                  className="form-error"
                                  role="alert"
                                  style={{ fontSize: "0.85rem" }}
                                >
                                  {approvalDraft.error}
                                </span>
                              )}
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={approvalDraft.submitting}
                                  onClick={() => approvePlacement(p.id)}
                                >
                                  {approvalDraft.submitting
                                    ? "Approving…"
                                    : "Approve placement"}
                                </button>
                                <button
                                  type="button"
                                  className="inline-text-link"
                                  disabled={approvalDraft.submitting}
                                  onClick={() =>
                                    setApproval((a) => {
                                      const next = { ...a };
                                      delete next[p.id];
                                      return next;
                                    })
                                  }
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "0.6rem",
                                fontSize: "0.9rem",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.18rem 0.55rem",
                                  borderRadius: "999px",
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  background: "var(--color-pending-bg)",
                                  color: "var(--color-pending-text)",
                                  border: "1px solid #BFDBFE",
                                }}
                              >
                                Awaiting your review
                              </span>
                              <button
                                type="button"
                                className="inline-text-link"
                                onClick={() =>
                                  setApproval((a) => ({
                                    ...a,
                                    [p.id]: {
                                      open: true,
                                      note: "",
                                      submitting: false,
                                      error: null,
                                    },
                                  }))
                                }
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Approve placement →
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Results snapshot ──
          Plan-lifecycle progress bar + coverage + approvals + documents on
          file. Every figure is a count of real rows; no impressions/ROI/
          delivery-quality metrics are invented. Hidden while placements are
          still loading so counts don't jump. */}
      {!placementsLoading && placements.length > 0 && (
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
            <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
              Progress snapshot
            </h2>
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>
              {campaign.status === "COMPLETED"
                ? "Campaign completed"
                : dateRange(campaign.startDate, campaign.endDate)}
            </span>
          </div>

          {/* Placement lifecycle bar. Each segment is proportional to its
              share of non-cancelled placements. Labels below for detail. */}
          {placementLifecycle.progressTotal > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "rgb(55, 65, 81)",
                  marginBottom: "0.35rem",
                }}
              >
                Placement progress
              </div>
              <div
                aria-label="Placement lifecycle progress"
                role="img"
                style={{
                  display: "flex",
                  height: "0.65rem",
                  borderRadius: "999px",
                  overflow: "hidden",
                  background: "rgba(15,23,42,0.08)",
                }}
              >
                {[
                  {
                    key: "completed",
                    count: placementLifecycle.completed,
                    color: "#16a34a",
                  },
                  {
                    key: "live",
                    count: placementLifecycle.live,
                    color: "#2563eb",
                  },
                  {
                    key: "booked",
                    count: placementLifecycle.booked,
                    color: "#60a5fa",
                  },
                  {
                    key: "draft",
                    count: placementLifecycle.draft,
                    color: "#9ca3af",
                  },
                ]
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <div
                      key={s.key}
                      style={{
                        flex: `${s.count} 0 0`,
                        background: s.color,
                      }}
                    />
                  ))}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                  fontSize: "0.85rem",
                }}
              >
                {placementLifecycle.completed > 0 && (
                  <LegendDot color="#16a34a" label={`${placementLifecycle.completed} completed`} />
                )}
                {placementLifecycle.live > 0 && (
                  <LegendDot color="#2563eb" label={`${placementLifecycle.live} live`} />
                )}
                {placementLifecycle.booked > 0 && (
                  <LegendDot color="#60a5fa" label={`${placementLifecycle.booked} booked`} />
                )}
                {placementLifecycle.draft > 0 && (
                  <LegendDot color="#9ca3af" label={`${placementLifecycle.draft} in preparation`} />
                )}
                {placementLifecycle.cancelled > 0 && (
                  <LegendDot
                    color="rgba(15,23,42,0.25)"
                    label={`${placementLifecycle.cancelled} cancelled`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Compact stat grid */}
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
              gap: "0.6rem",
              margin: "1rem 0 0",
            }}
          >
            <SnapshotStat
              label="Coverage"
              value={`${placements.length} placement${placements.length === 1 ? "" : "s"}`}
              sub={`${placementPublisherCount} publisher${placementPublisherCount === 1 ? "" : "s"}${stateCount > 0 ? ` · ${stateCount} state${stateCount === 1 ? "" : "s"}` : ""}${placementDmaCount > 0 ? ` · ${placementDmaCount} DMA${placementDmaCount === 1 ? "" : "s"}` : ""}`}
            />
            <SnapshotStat
              label="Your approvals"
              value={`${placementLifecycle.approved} of ${placementLifecycle.billable}`}
              sub={
                placementLifecycle.billable === placementLifecycle.approved
                  ? "All placements approved"
                  : `${placementLifecycle.billable - placementLifecycle.approved} awaiting your review`
              }
            />
            <SnapshotStat
              label="Reports & proofs"
              value={`${proofCount} proof${proofCount === 1 ? "" : "s"}`}
              sub={`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} on file`}
            />
          </dl>

          <p
            className="text-muted"
            style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}
          >
            Based on current campaign records. Delivery metrics (impressions,
            clicks) aren't shown here — your agency shares those in the proof
            and invoice files above as they become available.
          </p>
        </section>
      )}

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
          <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
            Publisher map
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

      {/* ── ACTIVITY zone: timeline ── */}
      {!placementsLoading && !subsLoading && (
        <section className="section-block zone-section zone-activity">
          <div className="zone-label">Activity log</div>
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
            <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
              Recent events
            </h2>
            {timelineEvents.length > 0 && (
              <span className="text-muted" style={{ fontSize: "0.9rem" }}>
                {timelineEvents.length} event
                {timelineEvents.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {timelineEvents.length === 0 ? (
            <p className="text-muted" style={{ marginTop: "0.5rem" }}>
              No recent activity yet. Events will appear here as creatives are
              uploaded and placements are approved.
            </p>
          ) : (
            <ol className="campaign-timeline">
              {timelineEvents.map((e) => (
                <li key={e.id} className="campaign-timeline-item">
                  <span
                    aria-hidden="true"
                    className="campaign-timeline-icon"
                  >
                    {e.icon}
                  </span>
                  <div className="campaign-timeline-body">
                    <div className="campaign-timeline-row">
                      <span className="campaign-timeline-title">
                        {e.title}
                      </span>
                      <span
                        className="campaign-timeline-time mono"
                        title={new Date(e.at).toLocaleString()}
                      >
                        {formatRelative(e.at)}
                      </span>
                    </div>
                    {e.detail && (
                      <div className="campaign-timeline-detail">
                        {e.detail}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* ── ASSETS zone: creatives (primary) + documents (secondary) ──
          Source order is Documents then Creatives, but CSS on .zone-assets
          flips them visually so creative submissions — the action-bearing
          list — appears first. */}
      <div className="zone-assets">
        <div className="zone-label zone-label-assets">Files &amp; creatives</div>
      {/* ── Documents & Billing hub ──
          Docs are org-scoped, so this surfaces the owning organization's
          library categorized for quick scanning. Invoices are promoted to
          their own sub-list; other categories appear as a count strip that
          deep-links into the full Documents library with none-category
          filtering left for a future pass. */}
      <section className="section-block zone-section zone-assets-docs">
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
          <h2 className="section-heading zone-heading" style={{ margin: 0 }}>
            Documents &amp; Billing
          </h2>
          <Link to="/documents" className="inline-text-link">
            Full document library →
          </Link>
        </div>

        {docsLoading && (
          <p className="text-muted" style={{ marginTop: "0.5rem" }}>
            Loading documents…
          </p>
        )}

        {docsError && (
          <p className="form-error" role="alert">
            {docsError}
          </p>
        )}

        {!docsLoading && !docsError && docs.length === 0 && (
          <p className="text-muted" style={{ marginTop: "0.5rem" }}>
            No documents have been shared with your organization yet. Proofs,
            invoices, and insertion orders will appear here as your agency
            uploads them.
          </p>
        )}

        {!docsLoading && !docsError && docs.length > 0 && (
          <>
            {/* Category count chips — at-a-glance overview of what's on file */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                marginTop: "0.5rem",
              }}
              aria-label="Document category counts"
            >
              {docGroups.map((g) => (
                <span
                  key={g.category}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.3rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "rgba(15,23,42,0.03)",
                    fontSize: "0.82rem",
                  }}
                >
                  <strong>{g.docs.length}</strong>{" "}
                  <span className="text-muted">
                    {DOC_CATEGORY_LABEL[g.category]}
                  </span>
                </span>
              ))}
            </div>

            {/* Invoices — promoted sub-section when any exist */}
            {invoiceDocs.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h3
                  style={{
                    margin: "0 0 0.45rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  Invoices{" "}
                  <span
                    className="text-muted"
                    style={{ fontWeight: 500, fontSize: "0.85rem" }}
                  >
                    ({invoiceDocs.length})
                  </span>
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  {invoiceDocs.map((doc) => (
                    <li
                      key={doc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.6rem",
                        flexWrap: "wrap",
                        padding: "0.55rem 0.7rem",
                        borderRadius: "0.4rem",
                        border: "1px solid rgba(15,23,42,0.1)",
                        background: "var(--color-surface, #fff)",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 16rem" }}>
                        <div
                          style={{ fontWeight: 600, fontSize: "0.95rem" }}
                        >
                          {doc.title}
                        </div>
                        <div
                          className="text-muted"
                          style={{ fontSize: "0.82rem", marginTop: "0.1rem" }}
                        >
                          {doc.filename} ·{" "}
                          <span className="mono">{formatBytes(doc.sizeBytes)}</span>{" "}
                          · <span className="mono">{formatDate(doc.createdAt)}</span>
                          {doc.uploadedBy?.name && (
                            <> · from {doc.uploadedBy.name}</>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="doc-download"
                        disabled={docDownloadingId === doc.id}
                        onClick={() => downloadDoc(doc)}
                      >
                        {docDownloadingId === doc.id
                          ? "Preparing…"
                          : "Download"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p
              className="text-muted"
              style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}
            >
              Organization-wide files appear in the{" "}
              <Link to="/documents" className="inline-text-link">
                full document library
              </Link>
              , grouped by category.
            </p>
          </>
        )}
      </section>

      {/* ── Creative Submissions ── */}
      <section className="section-block zone-section zone-assets-creatives">
        <div className="camp-section-header">
          <h2 className="section-heading zone-heading" style={{ margin: 0 }}>Creative submissions</h2>
          <Link to="/creatives" className="camp-upload-link">Upload creative &rarr;</Link>
        </div>

        {subChains.length > 0 && (
          <p
            className="text-muted"
            style={{ margin: "0.4rem 0 0.75rem", fontSize: "0.9rem" }}
          >
            {subChains.length} creative{subChains.length === 1 ? "" : "s"}
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

        {!subsLoading && !subsError && subChains.length === 0 && (
          <p className="text-muted">
            No creatives have been uploaded for this campaign yet.{" "}
            <Link to="/creatives" className="inline-text-link">
              Upload your first creative
            </Link>{" "}
            to get started.
          </p>
        )}

        {!subsLoading && !subsError && subChains.length > 0 && (
          <ul className="report-list">
            {subChains.map((chain) => {
              const s = chain.latest;
              const revState = revising[s.id];
              const needsAction = ACTION_STATUSES.has(s.status);
              return (
                <li key={chain.rootId} className="report-item">
                  <div className="report-info">
                    <span className="report-name">
                      {s.title}
                      {s.version > 1 && (
                        <span
                          className="text-muted"
                          style={{
                            marginLeft: "0.5rem",
                            fontWeight: 500,
                            fontSize: "0.85rem",
                          }}
                        >
                          · v{s.version}
                        </span>
                      )}
                    </span>
                    {s.description && (
                      <span className="report-description">
                        {s.description}
                      </span>
                    )}

                    {/* Agency feedback callout — prominent when present */}
                    {s.reviewNote && (
                      <div
                        role="note"
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem 0.9rem",
                          borderRadius: "0.5rem",
                          border: `1px solid ${needsAction ? "var(--color-error-border)" : "#BFDBFE"}`,
                          background: needsAction
                            ? "var(--color-error-bg)"
                            : "var(--color-pending-bg)",
                          color: needsAction
                            ? "var(--color-error-text)"
                            : "var(--color-pending-text)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Agency feedback
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {s.reviewNote}
                        </div>
                      </div>
                    )}

                    <div className="submission-meta">
                      <span className="doc-type-badge">{s.creativeType}</span>
                      <span>
                        {s.filename} &middot;{" "}
                        <span className="mono">{formatBytes(s.sizeBytes)}</span>{" "}
                        &middot;{" "}
                        <span className="mono">{formatDate(s.createdAt)}</span>
                      </span>
                    </div>
                    <div
                      className={`submission-next-step submission-next-step-${SUB_NEXT_STEP_TONE[s.status]}`}
                    >
                      <span className="submission-next-step-label">
                        Next step
                      </span>
                      <span>{SUB_NEXT_STEP[s.status]}</span>
                    </div>

                    {/* Inline revised-version upload when action is required */}
                    {needsAction && (
                      <div
                        style={{
                          marginTop: "0.6rem",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                          alignItems: "center",
                        }}
                      >
                        <label
                          className="inline-text-link"
                          style={{
                            cursor: revState?.submitting
                              ? "not-allowed"
                              : "pointer",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                          }}
                        >
                          {revState?.submitting
                            ? "Uploading…"
                            : "Upload revised version"}
                          <input
                            type="file"
                            style={{ display: "none" }}
                            disabled={revState?.submitting}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              // Clear the input so selecting the same file
                              // again still triggers the handler.
                              e.target.value = "";
                              if (f) void uploadRevision(s, f);
                            }}
                          />
                        </label>
                        {revState?.error && (
                          <span
                            className="form-error"
                            role="alert"
                            style={{ fontSize: "0.85rem" }}
                          >
                            {revState.error}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Prior versions disclosure */}
                    {chain.prior.length > 0 && (
                      <details style={{ marginTop: "0.6rem" }}>
                        <summary
                          className="text-muted"
                          style={{
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          View {chain.prior.length} previous version
                          {chain.prior.length === 1 ? "" : "s"}
                        </summary>
                        <ul
                          style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "0.5rem 0 0",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.35rem",
                          }}
                        >
                          {chain.prior.map((old) => (
                            <li
                              key={old.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "0.6rem",
                                padding: "0.4rem 0.6rem",
                                borderRadius: "0.35rem",
                                background: "rgba(15,23,42,0.04)",
                                fontSize: "0.85rem",
                              }}
                            >
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <strong>v{old.version}</strong> · {old.filename}{" "}
                                · {formatDate(old.createdAt)}
                              </span>
                              <button
                                type="button"
                                className="doc-download"
                                disabled={downloadingId === old.id}
                                onClick={() => downloadSub(old)}
                                style={{ fontSize: "0.8rem" }}
                              >
                                {downloadingId === old.id
                                  ? "Preparing…"
                                  : "Download"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
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
              );
            })}
          </ul>
        )}
      </section>
      </div>
    </>
  );
}

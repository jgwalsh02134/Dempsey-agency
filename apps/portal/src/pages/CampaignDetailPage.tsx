import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type {
  Campaign,
  CampaignStatus,
  CreativeSubmission,
  Document,
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

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/gif": "GIF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

function mimeLabel(mime: string): string {
  return MIME_LABELS[mime] ?? mime;
}

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

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return "Ongoing";
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { session } = useAuth();
  const memberships = session!.memberships;

  const stateCampaign = (
    location.state as { campaign?: Campaign } | null
  )?.campaign;

  const [campaign, setCampaign] = useState<Campaign | null>(
    stateCampaign?.id === id ? stateCampaign ?? null : null,
  );
  const [campaignLoading, setCampaignLoading] = useState(!campaign);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [subs, setSubs] = useState<CreativeSubmission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /* ── resolve campaign if not passed via route state ── */
  useEffect(() => {
    if (campaign || !id) return;
    let cancelled = false;
    setCampaignLoading(true);

    (async () => {
      for (const m of memberships) {
        try {
          const res = await api.fetchOrgCampaigns(m.organizationId);
          const found = res.campaigns.find((c) => c.id === id);
          if (found && !cancelled) {
            setCampaign(found);
            setCampaignLoading(false);
            return;
          }
        } catch {
          /* try next org */
        }
      }
      if (!cancelled) {
        setCampaignError("Campaign not found");
        setCampaignLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, campaign, memberships]);

  /* ── fetch documents + submissions once campaign is resolved ── */
  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;

    setDocsLoading(true);
    api
      .fetchOrgDocuments(campaign.organizationId)
      .then((res) => {
        if (!cancelled) setDocs(res.documents);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });

    setSubsLoading(true);
    api
      .fetchCampaignSubmissions(campaign.id)
      .then((res) => {
        if (!cancelled) setSubs(res.submissions);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSubsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaign]);

  async function downloadDoc(doc: Document) {
    setDownloadingId(doc.id);
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
      setDownloadingId(null);
    }
  }

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
        {campaign.description && (
          <p className="welcome-body">{campaign.description}</p>
        )}
        <div className="detail-header-meta">
          <span className={STATUS_BADGE[campaign.status]}>
            {STATUS_LABEL[campaign.status]}
          </span>
          <span className="text-muted">
            {dateRange(campaign.startDate, campaign.endDate)}
          </span>
        </div>
      </section>

      {/* ── Documents ── */}
      <section className="section-block">
        <h2 className="section-heading">Documents</h2>

        {docsLoading && (
          <p className="text-muted">Loading documents…</p>
        )}

        {!docsLoading && docs.length === 0 && (
          <p className="text-muted">
            No documents have been shared with your organization yet.
          </p>
        )}

        {!docsLoading && docs.length > 0 && (
          <ul className="report-list">
            {docs.map((doc) => (
              <li key={doc.id} className="report-item">
                <div className="report-info">
                  <span className="report-name">{doc.title}</span>
                  {doc.description && (
                    <span className="report-description">
                      {doc.description}
                    </span>
                  )}
                  <div className="doc-meta">
                    <span className="doc-type-badge">
                      {mimeLabel(doc.mimeType)}
                    </span>
                    <span>
                      {doc.filename} &middot;{" "}
                      {formatBytes(doc.sizeBytes)} &middot;{" "}
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="doc-download"
                  disabled={downloadingId === doc.id}
                  onClick={() => downloadDoc(doc)}
                >
                  {downloadingId === doc.id ? "Preparing…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Creative Submissions ── */}
      <section className="section-block">
        <h2 className="section-heading">Creative Submissions</h2>

        {subsLoading && (
          <p className="text-muted">Loading submissions…</p>
        )}

        {!subsLoading && subs.length === 0 && (
          <p className="text-muted">
            No creatives have been submitted for this campaign yet.
          </p>
        )}

        {!subsLoading && subs.length > 0 && (
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

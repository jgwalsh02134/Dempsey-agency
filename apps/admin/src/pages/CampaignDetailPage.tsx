import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { PlacementsSection } from "../components/PlacementsSection";
import type { Campaign } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .fetchCampaign(id)
      .then(setCampaign)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Failed to load campaign"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="muted">Loading…</p>;
  }

  if (error || !campaign) {
    return (
      <>
        <p className="error">{error ?? "Campaign not found"}</p>
        <Link to="/" className="btn ghost">
          &larr; Back
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        to={`/clients/${campaign.organizationId}`}
        className="btn ghost"
        style={{ marginBottom: "1rem", display: "inline-block" }}
      >
        &larr; Back to client
      </Link>

      <section className="card">
        <h1>{campaign.title}</h1>
        {campaign.description && (
          <p className="muted">{campaign.description}</p>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginTop: "0.75rem",
          }}
        >
          <div>
            <span className="small muted">Status</span>
            <div>{campaign.status}</div>
          </div>
          <div>
            <span className="small muted">Budget</span>
            <div>{formatCents(campaign.budgetCents)}</div>
          </div>
          <div>
            <span className="small muted">Start</span>
            <div>
              {campaign.startDate ? formatDate(campaign.startDate) : "—"}
            </div>
          </div>
          <div>
            <span className="small muted">End</span>
            <div>{campaign.endDate ? formatDate(campaign.endDate) : "—"}</div>
          </div>
          {campaign.organization && (
            <div>
              <span className="small muted">Organization</span>
              <div>{campaign.organization.name}</div>
            </div>
          )}
        </div>
      </section>

      <PlacementsSection campaignId={campaign.id} />
    </>
  );
}

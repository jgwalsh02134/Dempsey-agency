import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useOrg } from "../auth/OrgContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import { Money } from "../components/Money";
import type { Campaign, Placement } from "../types";

interface QueueItem {
  campaign: Campaign;
  placement: Placement;
}

export function ApprovalsPage() {
  const { orgId } = useOrg();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { campaigns } = await api.fetchOrgCampaigns(orgId);
        const results = await Promise.all(
          campaigns.map((campaign) =>
            api
              .fetchCampaignPlacements(campaign.id)
              .then((res) => ({ campaign, placements: res.placements }))
              .catch(() => ({ campaign, placements: [] as Placement[] })),
          ),
        );
        if (cancelled) return;
        const pending = results.flatMap(({ campaign, placements }) =>
          placements
            .filter((p) => p.clientResponse === "PENDING_CLIENT_REVIEW")
            .map((placement) => ({ campaign, placement })),
        );
        setItems(pending);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Could not load approvals.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.placement.grossCostCents, 0),
    [items],
  );

  async function approve(item: QueueItem) {
    setBusyId(item.placement.id);
    setRowError((prev) => {
      const next = { ...prev };
      delete next[item.placement.id];
      return next;
    });
    try {
      await api.respondToPlacement(item.placement.id, {
        response: "CLIENT_APPROVED",
        note: notes[item.placement.id]?.trim() || null,
      });
      setItems((prev) => prev.filter((row) => row.placement.id !== item.placement.id));
    } catch (e) {
      setRowError((prev) => ({
        ...prev,
        [item.placement.id]:
          e instanceof ApiError ? e.message : "Could not record approval.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <section className="section-welcome section-welcome-compact">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Approvals" }]} />
        <h1 className="welcome-heading">Approvals</h1>
        <p className="welcome-body">
          Placements waiting for you to approve. A note is optional.
        </p>
        {!loading && items.length > 0 && (
          <p className="welcome-status">
            {items.length} waiting · planned total <Money cents={totalCents} />
          </p>
        )}
      </section>

      {loading && (
        <div className="skeleton-stack" aria-busy="true">
          <span />
          <span />
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Nothing to approve"
          body="When your agency sends a placement for review, it shows up here."
          action={{ href: "/campaigns", label: "Open campaigns" }}
        />
      )}

      {!loading && items.length > 0 && (
        <ul className="approval-list">
          {items.map((item) => {
            const place = [item.placement.inventory.publisher.city, item.placement.inventory.publisher.state]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={item.placement.id} className="approval-card">
                <div className="approval-card-main">
                  <p className="approval-kicker">
                    <Link to={`/campaigns/${item.campaign.id}`}>{item.campaign.title}</Link>
                  </p>
                  <h2>{item.placement.name}</h2>
                  <p className="text-muted">
                    {item.placement.inventory.publisher.name}
                    {place ? ` · ${place}` : ""} · {item.placement.inventory.name}
                  </p>
                  <p className="approval-price">
                    <Money cents={item.placement.grossCostCents} />
                  </p>
                </div>
                <form
                  className="approval-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void approve(item);
                  }}
                >
                  <label htmlFor={`note-${item.placement.id}`}>Note (optional)</label>
                  <textarea
                    id={`note-${item.placement.id}`}
                    rows={2}
                    value={notes[item.placement.id] ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({
                        ...prev,
                        [item.placement.id]: event.target.value,
                      }))
                    }
                  />
                  {rowError[item.placement.id] && (
                    <p className="form-error" role="alert">
                      {rowError[item.placement.id]}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={busyId === item.placement.id}
                  >
                    {busyId === item.placement.id ? "Saving…" : "Approve placement"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

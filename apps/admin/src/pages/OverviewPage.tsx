import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { AdminOverview, AuditLogEntry } from "../types";

const AUDIT_LABELS: Record<string, string> = {
  USER_CREATED: "User created",
  ROLE_CHANGED: "Role changed",
  USER_DEACTIVATED: "User deactivated",
  MEMBERSHIP_REMOVED: "Membership removed",
};

function formatAuditAction(entry: AuditLogEntry): string {
  const label = AUDIT_LABELS[entry.action] ?? entry.action;
  const actor = entry.actorUser?.name ?? entry.actorUser?.email ?? "System";
  const target = entry.targetUser?.name ?? entry.targetUser?.email;
  if (target) return `${actor} — ${label} → ${target}`;
  return `${actor} — ${label}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface KpiCardProps {
  label: string;
  value: number;
  accent?: "default" | "warning" | "danger";
  linkTo?: string;
}

function KpiCard({ label, value, accent = "default", linkTo }: KpiCardProps) {
  const inner = (
    <div className={`kpi-card kpi-${accent}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">
        {label}
        {linkTo && <span className="kpi-arrow" aria-hidden="true"> &rarr;</span>}
      </span>
    </div>
  );
  if (linkTo) {
    return (
      <Link to={linkTo} className="kpi-card-link">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function OverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchAdminOverview();
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="overview-page">
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <button type="button" className="btn ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Active Clients"
              value={data.activeClients}
              linkTo="/clients"
            />
            <KpiCard
              label="Active Campaigns"
              value={data.activeCampaigns}
              linkTo="/clients"
            />
            <KpiCard
              label="Pending Reviews"
              value={data.pendingReviews}
              accent={data.pendingReviews > 0 ? "warning" : "default"}
              linkTo="/creatives?status=UPLOADED"
            />
            <KpiCard
              label="Pending Requests"
              value={data.pendingRequests}
              accent={data.pendingRequests > 0 ? "warning" : "default"}
              linkTo="/access"
            />
            <KpiCard
              label="Overdue Invoices"
              value={data.overdueInvoices}
              accent={data.overdueInvoices > 0 ? "danger" : "default"}
              linkTo="/clients"
            />
          </div>

          <section className="card overview-section">
            <h2>Recent Activity</h2>
            {data.recentActivity.length === 0 ? (
              <p className="muted">No recent activity.</p>
            ) : (
              <ul className="activity-list">
                {data.recentActivity.map((entry) => (
                  <li key={entry.id} className="activity-row">
                    <span className="activity-text">
                      {formatAuditAction(entry)}
                    </span>
                    <span className="activity-time muted small">
                      {timeAgo(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {loading && !data && <p className="muted">Loading dashboard…</p>}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { AuditLogEntry } from "../types";

const ACTIONS = [
  "USER_CREATED",
  "ROLE_CHANGED",
  "USER_DEACTIVATED",
  "MEMBERSHIP_REMOVED",
] as const;

const LABELS: Record<string, string> = {
  USER_CREATED: "User created",
  ROLE_CHANGED: "Role changed",
  USER_DEACTIVATED: "User deactivated",
  MEMBERSHIP_REMOVED: "Membership removed",
};

export function AuditPage() {
  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const res = await api.fetchAuditLogs({
        action: action || undefined,
        actorUserId: actorUserId.trim() || undefined,
        organizationId: organizationId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 25,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
        setUnavailable(true);
        setLogs([]);
        setTotal(0);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not load the audit log.");
      }
    } finally {
      setLoading(false);
    }
  }, [action, actorUserId, organizationId, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit log</h1>
      </div>
      <p className="muted">
        User created, role changed, user deactivated, and membership removed. Login failures are not recorded.
      </p>

      <form
        className="filter-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="field">
          <span>Action</span>
          <select
            value={action}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value);
            }}
          >
            <option value="">All</option>
            {ACTIONS.map((value) => (
              <option key={value} value={value}>
                {LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Actor user id</span>
          <input value={actorUserId} onChange={(event) => setActorUserId(event.target.value)} />
        </label>
        <label className="field">
          <span>Organization id</span>
          <input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} />
        </label>
        <label className="field">
          <span>From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="submit" className="btn ghost">
          Apply
        </button>
      </form>

      {loading && <p className="muted">Loading audit log…</p>}
      {unavailable && (
        <p className="muted" role="status">
          The audit read API is not available on this server yet.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !unavailable && logs.length === 0 && !error && (
        <p className="muted">No audit rows match these filters.</p>
      )}

      {logs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id}>
                  <td data-label="When">{new Date(row.createdAt).toLocaleString()}</td>
                  <td data-label="Action">{LABELS[row.action] ?? row.action}</td>
                  <td data-label="Actor">{row.actorUser?.email ?? "—"}</td>
                  <td data-label="Target">{row.targetUser?.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 && (
        <div className="pager">
          <button
            type="button"
            className="btn ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="muted small">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={page >= pages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

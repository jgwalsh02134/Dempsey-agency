import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import type { AccountRequest, AccountRequestStatus } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: AccountRequestStatus): string {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "error";
  return "warning";
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function AccountRequestsSection() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchAccountRequests();
      setRequests(res.requests);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function onDecision(
    req: AccountRequest,
    status: AccountRequestStatus,
  ) {
    const verb = status === "APPROVED" ? "approve" : "reject";
    if (
      !window.confirm(
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} request from ${req.name} (${req.email})?`,
      )
    ) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setBusyId(req.id);
    try {
      const updated = await api.patchAccountRequest(req.id, { status });
      const reviewedBy = session
        ? { id: session.id, email: session.email, name: session.name }
        : null;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, ...updated, reviewedBy } : r,
        ),
      );
      setActionSuccess(
        `${req.name}'s request has been ${status.toLowerCase()}.`,
      );
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <section className="card">
      <h2>Account Requests</h2>

      {loading && <p className="muted">Loading…</p>}
      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <p className="success" role="status">
          {actionSuccess}
        </p>
      )}

      {!loading && requests.length === 0 && !listError && (
        <p className="muted">No account requests yet.</p>
      )}

      {!loading && pending.length > 0 && (
        <>
          <h3 className="h3-spaced">Pending ({pending.length})</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.name}</div>
                      {r.message && (
                        <span className="small">{r.message}</span>
                      )}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.company}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busyId === r.id}
                        onClick={() => onDecision(r, "APPROVED")}
                        style={{ marginRight: "0.5rem" }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn danger ghost"
                        disabled={busyId === r.id}
                        onClick={() => onDecision(r, "REJECTED")}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && resolved.length > 0 && (
        <>
          <h3 className="h3-spaced">Resolved</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Reviewed by</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.name}</div>
                      {r.message && (
                        <span className="small">{r.message}</span>
                      )}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.company}</td>
                    <td>
                      <span className={statusClass(r.status)}>
                        {r.status}
                      </span>
                    </td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      {r.reviewedBy && (
                        <span className="small">
                          {r.reviewedBy.name || r.reviewedBy.email}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

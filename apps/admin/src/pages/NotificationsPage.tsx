import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { Notification, NotificationLink } from "../types";

const TYPE_LABEL: Record<string, string> = {
  CREATIVE_REVISION_REQUESTED: "Creative revision requested",
  CREATIVE_REVISION_UPLOADED: "Revised creative uploaded",
  PLACEMENT_AWAITING_APPROVAL: "Placement awaiting client approval",
  PLACEMENT_APPROVED_BY_CLIENT: "Placement approved by client",
  NEW_INVOICE_UPLOADED: "New invoice uploaded",
  NEW_PROOF_UPLOADED: "New proof uploaded",
};

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
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Admin routes: campaigns are at /campaigns/:id (same as portal);
 *  documents are surfaced org-level only via the client detail page, so
 *  for v1 we don't deep-link document notifications in admin — they
 *  stay in the list without a click target. */
function routeFor(link: NotificationLink): string | null {
  if (!link) return null;
  if (link.type === "CAMPAIGN") return `/campaigns/${link.campaignId}`;
  // Admin has no global /documents page; documents live inside ClientDetailPage.
  // Leave unlinked rather than guess the client org id here.
  return null;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .fetchNotifications({ limit: 100 })
      .then((res) => {
        if (!cancelled) setItems(res.notifications);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load notifications.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadCount = items.filter((n) => n.readAt == null).length;

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id && n.readAt == null
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    );
    api.markNotificationRead(id).catch(() => {
      /* non-blocking */
    });
  }

  function onRowClick(n: Notification) {
    if (n.readAt == null) markRead(n.id);
    const route = routeFor(n.link);
    if (route) navigate(route);
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((n) =>
          n.readAt == null
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      );
    } catch {
      /* non-blocking */
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          {!loading && (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              {items.length} recent · {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn ghost"
            onClick={markAllRead}
            disabled={markingAll}
          >
            {markingAll ? "Marking…" : `Mark all as read (${unreadCount})`}
          </button>
        )}
      </div>

      {loading && <p className="muted">Loading…</p>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          No notifications yet. Key client activity will appear here.
        </p>
      )}

      {!loading && items.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0.75rem 0 0",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {items.map((n) => {
            const unread = n.readAt == null;
            const clickable = routeFor(n.link) != null;
            return (
              <li
                key={n.id}
                onClick={() => onRowClick(n)}
                style={{
                  padding: "0.75rem 0.9rem",
                  borderRadius: "0.5rem",
                  border: `1px solid ${unread ? "#BFDBFE" : "rgba(15,23,42,0.1)"}`,
                  background: unread
                    ? "rgba(191, 219, 254, 0.25)"
                    : "#fff",
                  cursor: clickable ? "pointer" : "default",
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-start",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    marginTop: "0.35rem",
                    width: "0.55rem",
                    height: "0.55rem",
                    borderRadius: "999px",
                    background: unread ? "#2563eb" : "transparent",
                    border: unread
                      ? "none"
                      : "1px solid rgba(15,23,42,0.25)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: unread ? 700 : 500,
                        fontSize: "0.95rem",
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      className="small muted"
                      style={{ whiteSpace: "nowrap" }}
                      title={new Date(n.createdAt).toLocaleString()}
                    >
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <div
                      className="small muted"
                      style={{
                        marginTop: "0.2rem",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                  <div
                    className="small muted"
                    style={{ marginTop: "0.3rem", fontSize: "0.75rem" }}
                  >
                    {TYPE_LABEL[n.type] ?? n.type}
                    {clickable && " · Click to open"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

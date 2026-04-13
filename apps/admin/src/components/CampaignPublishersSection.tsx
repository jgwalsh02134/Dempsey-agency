import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { CampaignPublisher, Publisher } from "../types";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

interface Props {
  campaignId: string;
}

export function CampaignPublishersSection({ campaignId }: Props) {
  const [attached, setAttached] = useState<CampaignPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalog of all publishers for the add-picker.
  const [catalog, setCatalog] = useState<Publisher[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // UI state for the add flow.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadAttached = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchCampaignPublishers(campaignId);
      setAttached(res.publishers);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadAttached();
  }, [loadAttached]);

  async function openPicker() {
    setPickerOpen(true);
    setSelectedIds(new Set());
    setSearch("");
    if (!catalogLoaded) {
      try {
        const res = await api.fetchPublishers();
        setCatalog(res.publishers);
        setCatalogLoaded(true);
      } catch (e) {
        setError(errorMessage(e));
      }
    }
  }

  function closePicker() {
    setPickerOpen(false);
    setSelectedIds(new Set());
    setSearch("");
  }

  const attachedIds = useMemo(
    () => new Set(attached.map((p) => p.id)),
    [attached],
  );

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter((p) => p.isActive && !attachedIds.has(p.id))
      .filter((p) => {
        if (q.length === 0) return true;
        const hay = [p.name, p.city, p.state, p.country, p.parentCompany]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [catalog, attachedIds, search]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onAdd() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    setError(null);
    try {
      await api.addCampaignPublishers(campaignId, Array.from(selectedIds));
      closePicker();
      await loadAttached();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(publisherId: string) {
    setRemoving(publisherId);
    try {
      await api.removeCampaignPublisher(campaignId, publisherId);
      setAttached((prev) => prev.filter((p) => p.id !== publisherId));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRemoving(null);
    }
  }

  const mappable = attached.filter(
    (p) => p.latitude != null && p.longitude != null,
  ).length;

  return (
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Publishers</h2>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {attached.length} attached ·{" "}
            {mappable === attached.length || attached.length === 0
              ? `${mappable} on map`
              : `${mappable} on map (${attached.length - mappable} not geocoded)`}
          </p>
        </div>
        {!pickerOpen && (
          <button
            type="button"
            className="btn primary"
            onClick={openPicker}
            disabled={loading}
          >
            + Add publishers
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>
          {error}
        </p>
      )}

      {pickerOpen && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search publishers…"
              style={{ flex: 1 }}
              autoFocus
            />
            <span className="muted small">
              {selectedIds.size} selected
            </span>
          </div>

          {!catalogLoaded && (
            <p className="muted small">Loading publisher catalog…</p>
          )}

          {catalogLoaded && filteredCatalog.length === 0 && (
            <p className="muted small">
              {catalog.length === 0
                ? "No publishers in the catalog yet."
                : "No publishers match — or all matches are already attached."}
            </p>
          )}

          {filteredCatalog.length > 0 && (
            <div
              className="table-wrap"
              style={{ maxHeight: "20rem", overflowY: "auto" }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "2rem" }} />
                    <th>Name</th>
                    <th>Location</th>
                    <th>Geocoded</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => toggleSelected(p.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>{p.name}</td>
                      <td className="small">
                        {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="small">
                        {p.latitude != null && p.longitude != null
                          ? "Yes"
                          : p.geocodeStatus ?? "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn primary"
              onClick={onAdd}
              disabled={adding || selectedIds.size === 0}
            >
              {adding
                ? "Adding…"
                : `Add ${selectedIds.size} publisher${selectedIds.size === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={closePicker}
              disabled={adding}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && !pickerOpen && (
        <p className="muted small" style={{ marginTop: "0.75rem" }}>
          Loading…
        </p>
      )}

      {!loading && attached.length === 0 && !pickerOpen && (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          No publishers attached yet. Click <em>Add publishers</em> to pick
          from the catalog.
        </p>
      )}

      {!loading && attached.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Website</th>
                <th>Geocoded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {attached.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="small">
                    {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="small">
                    {p.websiteUrl ? (
                      <a
                        href={p.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="small">
                    {p.latitude != null && p.longitude != null
                      ? "Yes"
                      : p.geocodeStatus ?? "No"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => onRemove(p.id)}
                      disabled={removing === p.id}
                    >
                      {removing === p.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

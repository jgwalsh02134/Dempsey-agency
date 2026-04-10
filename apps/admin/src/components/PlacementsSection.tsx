import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  InventoryItem,
  Placement,
  Publisher,
} from "../types";

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

export function PlacementsSection({ campaignId }: { campaignId: string }) {
  /* ── list state ── */
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /* ── publisher + inventory state ── */
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedPublisherId, setSelectedPublisherId] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");

  /* ── create state ── */
  const [name, setName] = useState("");
  const [grossDollars, setGrossDollars] = useState("");
  const [netDollars, setNetDollars] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── action state ── */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* ── load placements ── */
  const loadPlacements = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await api.fetchCampaignPlacements(campaignId);
      setPlacements(res.placements);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadPlacements();
  }, [loadPlacements]);

  /* ── load publishers for create form ── */
  useEffect(() => {
    api
      .fetchPublishers()
      .then((res) => setPublishers(res.publishers))
      .catch(() => {});
  }, []);

  /* ── load inventory when publisher changes ── */
  useEffect(() => {
    if (!selectedPublisherId) {
      setInventory([]);
      setSelectedInventoryId("");
      return;
    }
    api
      .fetchPublisherInventory(selectedPublisherId)
      .then((res) => {
        setInventory(res.inventory.filter((i) => i.isActive));
        setSelectedInventoryId("");
      })
      .catch(() => {});
  }, [selectedPublisherId]);

  /* ── create handler ── */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createPlacement>[1] = {
        inventoryId: selectedInventoryId,
        name: name.trim(),
        grossCostCents: Math.round(parseFloat(grossDollars) * 100),
      };
      if (netDollars.trim())
        body.netCostCents = Math.round(parseFloat(netDollars) * 100);
      if (quantity.trim()) body.quantity = parseInt(quantity, 10);
      if (notes.trim()) body.notes = notes.trim();

      await api.createPlacement(campaignId, body);
      setCreateSuccess(`"${name.trim()}" created.`);
      setName("");
      setGrossDollars("");
      setNetDollars("");
      setQuantity("");
      setNotes("");
      setSelectedPublisherId("");
      setSelectedInventoryId("");
      void loadPlacements();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ── delete handler ── */
  async function onDelete(p: Placement) {
    if (!window.confirm(`Delete placement "${p.name}"? This cannot be undone.`))
      return;
    setActionError(null);
    setBusyId(p.id);
    try {
      await api.deletePlacement(p.id);
      setPlacements((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card">
      <h2>Placements</h2>

      {/* ── Create form ── */}
      <h3 className="h3-spaced">Add placement</h3>
      <form onSubmit={onCreate} className="stack">
        <label className="field">
          <span>Publisher</span>
          <select
            value={selectedPublisherId}
            onChange={(e) => setSelectedPublisherId(e.target.value)}
            required
          >
            <option value="">Select publisher…</option>
            {publishers
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.city ? ` — ${p.city}, ${p.state ?? ""}` : ""}
                </option>
              ))}
          </select>
        </label>

        {selectedPublisherId && (
          <label className="field">
            <span>Inventory</span>
            <select
              value={selectedInventoryId}
              onChange={(e) => setSelectedInventoryId(e.target.value)}
              required
            >
              <option value="">Select inventory…</option>
              {inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.mediaType} · {i.pricingModel})
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>Placement name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="e.g. Full Page — March Issue"
          />
        </label>

        <div className="two-col">
          <label className="field">
            <span>Gross cost (USD)</span>
            <input
              type="number"
              value={grossDollars}
              onChange={(e) => setGrossDollars(e.target.value)}
              required
              min="0"
              step="0.01"
              placeholder="e.g. 2500.00"
            />
          </label>
          <label className="field">
            <span>Net cost (USD, agency only)</span>
            <input
              type="number"
              value={netDollars}
              onChange={(e) => setNetDollars(e.target.value)}
              min="0"
              step="0.01"
              placeholder="e.g. 2000.00"
            />
          </label>
        </div>

        <div className="two-col">
          <label className="field">
            <span>Quantity (optional)</span>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              placeholder="e.g. 1"
            />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Internal notes"
            />
          </label>
        </div>

        {createError && (
          <p className="error" role="alert">
            {createError}
          </p>
        )}
        {createSuccess && (
          <p className="success" role="status">
            {createSuccess}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={creating}>
          {creating ? "Creating…" : "Add placement"}
        </button>
      </form>

      {/* ── Placements list ── */}
      <h3 className="h3-spaced">Current placements</h3>
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
      {!loading && placements.length === 0 && !listError && (
        <p className="muted">No placements yet.</p>
      )}
      {!loading && placements.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Publisher</th>
                <th>Type</th>
                <th>Status</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div>{p.name}</div>
                    {p.notes && <span className="small">{p.notes}</span>}
                  </td>
                  <td>{p.inventory.publisher.name}</td>
                  <td>
                    <span className="small">{p.inventory.mediaType}</span>
                  </td>
                  <td>
                    <span className="small">{p.status}</span>
                  </td>
                  <td>{formatCents(p.grossCostCents)}</td>
                  <td>{formatCents(p.netCostCents)}</td>
                  <td>{p.quantity ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn danger ghost"
                      disabled={busyId === p.id}
                      onClick={() => onDelete(p)}
                    >
                      {busyId === p.id ? "…" : "Delete"}
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

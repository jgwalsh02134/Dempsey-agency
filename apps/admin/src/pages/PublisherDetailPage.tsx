import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type { InventoryItem, MediaType, PricingModel, Publisher } from "../types";

const MEDIA_TYPES: MediaType[] = ["PRINT", "DIGITAL", "EMAIL", "OTHER"];
const PRICING_MODELS: PricingModel[] = [
  "FLAT",
  "CPM",
  "VCPM",
  "CPC",
  "CPCV",
  "COLUMN_INCH",
  "PER_LINE",
  "OTHER",
];

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong";
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PublisherDetailPage() {
  const { id } = useParams<{ id: string }>();

  /* ── publisher state ── */
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [pubLoading, setPubLoading] = useState(true);
  const [pubError, setPubError] = useState<string | null>(null);

  /* ── inventory list state ── */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string | null>(null);

  /* ── create state ── */
  const [cName, setCName] = useState("");
  const [cMediaType, setCMediaType] = useState<MediaType>("PRINT");
  const [cPricingModel, setCPricingModel] = useState<PricingModel>("FLAT");
  const [cRateDollars, setCRateDollars] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── edit state ── */
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eMediaType, setEMediaType] = useState<MediaType>("PRINT");
  const [ePricingModel, setEPricingModel] = useState<PricingModel>("FLAT");
  const [eRateDollars, setERateDollars] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eIsActive, setEIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /* ── load publisher ── */
  useEffect(() => {
    if (!id) return;
    setPubLoading(true);
    api
      .fetchPublishers()
      .then((res) => {
        const found = res.publishers.find((p) => p.id === id);
        setPublisher(found ?? null);
        if (!found) setPubError("Publisher not found");
      })
      .catch((e) => setPubError(errorMessage(e)))
      .finally(() => setPubLoading(false));
  }, [id]);

  /* ── load inventory ── */
  const loadInventory = useCallback(async () => {
    if (!id) return;
    setInvLoading(true);
    setInvError(null);
    try {
      const res = await api.fetchPublisherInventory(id);
      setInventory(res.inventory);
    } catch (e) {
      setInvError(errorMessage(e));
    } finally {
      setInvLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  /* ── create handler ── */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createInventory>[1] = {
        name: cName.trim(),
        mediaType: cMediaType,
        pricingModel: cPricingModel,
      };
      if (cRateDollars.trim())
        body.rateCents = Math.round(parseFloat(cRateDollars) * 100);
      if (cDescription.trim()) body.description = cDescription.trim();

      await api.createInventory(id, body);
      setCreateSuccess(`"${cName.trim()}" created.`);
      setCName("");
      setCMediaType("PRINT");
      setCPricingModel("FLAT");
      setCRateDollars("");
      setCDescription("");
      void loadInventory();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ── start editing ── */
  function startEdit(item: InventoryItem) {
    setEditId(item.id);
    setEName(item.name);
    setEMediaType(item.mediaType);
    setEPricingModel(item.pricingModel);
    setERateDollars(
      item.rateCents != null ? (item.rateCents / 100).toFixed(2) : "",
    );
    setEDescription(item.description ?? "");
    setEIsActive(item.isActive);
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditError(null);
  }

  /* ── save edit handler ── */
  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setEditError(null);
    try {
      const body: Parameters<typeof api.patchInventory>[1] = {};
      const original = inventory.find((i) => i.id === editId);
      if (!original) return;

      if (eName.trim() !== original.name) body.name = eName.trim();
      if (eMediaType !== original.mediaType) body.mediaType = eMediaType;
      if (ePricingModel !== original.pricingModel)
        body.pricingModel = ePricingModel;
      if (eIsActive !== original.isActive) body.isActive = eIsActive;

      const newRateCents = eRateDollars.trim()
        ? Math.round(parseFloat(eRateDollars) * 100)
        : null;
      if (newRateCents !== original.rateCents) body.rateCents = newRateCents;

      const newDesc = eDescription.trim() || null;
      if (newDesc !== original.description) body.description = newDesc;

      if (Object.keys(body).length === 0) {
        setEditId(null);
        return;
      }

      const updated = await api.patchInventory(editId, body);
      setInventory((prev) =>
        prev.map((i) => (i.id === editId ? updated : i)),
      );
      setEditId(null);
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /* ── loading / error states ── */
  if (pubLoading) {
    return <p className="muted">Loading…</p>;
  }

  if (pubError || !publisher) {
    return (
      <>
        <p className="error">{pubError ?? "Publisher not found"}</p>
        <Link to="/publishers" className="btn ghost">
          &larr; Back to publishers
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        to="/publishers"
        className="btn ghost"
        style={{ marginBottom: "1rem", display: "inline-block" }}
      >
        &larr; Back to publishers
      </Link>

      {/* ── Publisher header ── */}
      <section className="card">
        <h1>{publisher.name}</h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1.5rem",
            marginTop: "0.75rem",
          }}
        >
          <div>
            <span className="small muted">Location</span>
            <div>
              {publisher.city || publisher.state
                ? `${publisher.city ?? ""}${publisher.city && publisher.state ? ", " : ""}${publisher.state ?? ""}`
                : "—"}
            </div>
          </div>
          <div>
            <span className="small muted">Contact</span>
            <div>{publisher.contactEmail ?? "—"}</div>
          </div>
          <div>
            <span className="small muted">Circulation</span>
            <div>
              {publisher.circulation != null
                ? publisher.circulation.toLocaleString()
                : "—"}
            </div>
          </div>
          <div>
            <span className="small muted">Status</span>
            <div>{publisher.isActive ? "Active" : "Inactive"}</div>
          </div>
          {publisher.websiteUrl && (
            <div>
              <span className="small muted">Website</span>
              <div>
                <a
                  href={publisher.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {publisher.websiteUrl}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Create inventory form ── */}
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Add inventory</h2>
        <form onSubmit={onCreate} className="stack">
          <label className="field">
            <span>Unit name</span>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              required
              maxLength={255}
              placeholder="e.g. Full Page Ad"
            />
          </label>

          <div className="two-col">
            <label className="field">
              <span>Media type</span>
              <select
                value={cMediaType}
                onChange={(e) => setCMediaType(e.target.value as MediaType)}
              >
                {MEDIA_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Pricing model</span>
              <select
                value={cPricingModel}
                onChange={(e) =>
                  setCPricingModel(e.target.value as PricingModel)
                }
              >
                {PRICING_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="two-col">
            <label className="field">
              <span>Rate (USD, optional)</span>
              <input
                type="number"
                value={cRateDollars}
                onChange={(e) => setCRateDollars(e.target.value)}
                min="0"
                step="0.01"
                placeholder="e.g. 1500.00"
              />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <input
                value={cDescription}
                onChange={(e) => setCDescription(e.target.value)}
                maxLength={1000}
                placeholder="Internal description"
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
            {creating ? "Creating…" : "Add inventory"}
          </button>
        </form>
      </section>

      {/* ── Inventory list ── */}
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>Inventory units</h2>
        {invLoading && <p className="muted">Loading…</p>}
        {invError && (
          <p className="error" role="alert">
            {invError}
          </p>
        )}
        {!invLoading && inventory.length === 0 && !invError && (
          <p className="muted">No inventory units yet.</p>
        )}
        {!invLoading && inventory.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Media</th>
                  <th>Pricing</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) =>
                  editId === item.id ? (
                    <tr key={item.id}>
                      <td colSpan={6}>
                        <form
                          onSubmit={onSaveEdit}
                          className="stack"
                          style={{ padding: "0.5rem 0" }}
                        >
                          <div className="two-col">
                            <label className="field">
                              <span>Unit name</span>
                              <input
                                value={eName}
                                onChange={(e) => setEName(e.target.value)}
                                required
                                maxLength={255}
                              />
                            </label>
                            <label className="field">
                              <span>Description</span>
                              <input
                                value={eDescription}
                                onChange={(e) =>
                                  setEDescription(e.target.value)
                                }
                                maxLength={1000}
                              />
                            </label>
                          </div>
                          <div className="two-col">
                            <label className="field">
                              <span>Media type</span>
                              <select
                                value={eMediaType}
                                onChange={(e) =>
                                  setEMediaType(
                                    e.target.value as MediaType,
                                  )
                                }
                              >
                                {MEDIA_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Pricing model</span>
                              <select
                                value={ePricingModel}
                                onChange={(e) =>
                                  setEPricingModel(
                                    e.target.value as PricingModel,
                                  )
                                }
                              >
                                {PRICING_MODELS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="two-col">
                            <label className="field">
                              <span>Rate (USD)</span>
                              <input
                                type="number"
                                value={eRateDollars}
                                onChange={(e) =>
                                  setERateDollars(e.target.value)
                                }
                                min="0"
                                step="0.01"
                              />
                            </label>
                            <label className="field">
                              <span>Active</span>
                              <select
                                value={eIsActive ? "true" : "false"}
                                onChange={(e) =>
                                  setEIsActive(e.target.value === "true")
                                }
                              >
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </label>
                          </div>
                          {editError && (
                            <p className="error" role="alert">
                              {editError}
                            </p>
                          )}
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="submit"
                              className="btn primary"
                              disabled={saving}
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={item.id}
                      style={
                        item.isActive ? undefined : { opacity: 0.55 }
                      }
                    >
                      <td>
                        <div>{item.name}</div>
                        {item.description && (
                          <span className="small muted">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td>{item.mediaType}</td>
                      <td>{item.pricingModel}</td>
                      <td>{formatCents(item.rateCents)}</td>
                      <td>
                        {item.isActive ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

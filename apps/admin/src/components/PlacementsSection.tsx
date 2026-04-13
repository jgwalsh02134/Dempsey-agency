import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  CampaignPublisher,
  InventoryItem,
  Placement,
  PlacementStatus,
} from "../types";

/**
 * Campaign placement planner — grouped by attached publisher.
 *
 * Workflow:
 *   1. Staff use the Publishers section above to attach publishers to a campaign.
 *   2. Here, each attached publisher becomes a card; its placements are the rows.
 *   3. A per-publisher inline form scopes inventory to that publisher only, so
 *      you never have to re-pick who you're planning for.
 *   4. Placement status is editable inline; cost + notes are editable in a
 *      simple expandable row editor.
 *
 * Net cost is agency-only. The API strips netCostCents for non-agency callers,
 * and this component only runs in the agency admin app.
 */

const STATUS_ORDER: PlacementStatus[] = [
  "DRAFT",
  "BOOKED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABEL: Record<PlacementStatus, string> = {
  DRAFT: "Draft",
  BOOKED: "Booked",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

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

interface Props {
  campaignId: string;
}

interface EditDraft {
  name: string;
  grossDollars: string;
  netDollars: string;
  quantity: string;
  notes: string;
}

function centsToDollarsInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

/** State for one per-publisher add form (keyed by publisher id). */
interface AddFormState {
  inventoryId: string;
  name: string;
  status: PlacementStatus;
  grossDollars: string;
  netDollars: string;
  quantity: string;
  notes: string;
  inventory: InventoryItem[];
  inventoryLoaded: boolean;
  submitting: boolean;
  error: string | null;
}

function emptyAddState(): AddFormState {
  return {
    inventoryId: "",
    name: "",
    status: "DRAFT",
    grossDollars: "",
    netDollars: "",
    quantity: "",
    notes: "",
    inventory: [],
    inventoryLoaded: false,
    submitting: false,
    error: null,
  };
}

export function PlacementsSection({ campaignId }: Props) {
  const [publishers, setPublishers] = useState<CampaignPublisher[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /** Per-publisher open+form state. */
  const [openPublisherId, setOpenPublisherId] = useState<string | null>(null);
  const [addState, setAddState] = useState<Record<string, AddFormState>>({});

  /** Per-placement in-flight state. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  /** Inline row edit state (one row at a time). */
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [pubs, plas] = await Promise.all([
        api.fetchCampaignPublishers(campaignId),
        api.fetchCampaignPlacements(campaignId),
      ]);
      setPublishers(pubs.publishers);
      setPlacements(plas.placements);
    } catch (e) {
      setListError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Placements bucketed by publisher id (for quick render per publisher card). */
  const byPublisher = useMemo(() => {
    const map = new Map<string, Placement[]>();
    for (const p of placements) {
      const pubId = p.inventory.publisher.id;
      const existing = map.get(pubId);
      if (existing) existing.push(p);
      else map.set(pubId, [p]);
    }
    return map;
  }, [placements]);

  /* ── per-publisher form helpers ───────────────────────────── */

  async function openAddFor(publisherId: string) {
    setOpenPublisherId(publisherId);
    setAddState((prev) => {
      if (prev[publisherId]) return prev;
      return { ...prev, [publisherId]: emptyAddState() };
    });
    // Lazy-load that publisher's inventory the first time.
    const existing = addState[publisherId];
    if (existing?.inventoryLoaded) return;
    try {
      const res = await api.fetchPublisherInventory(publisherId);
      setAddState((prev) => ({
        ...prev,
        [publisherId]: {
          ...(prev[publisherId] ?? emptyAddState()),
          inventory: res.inventory.filter((i) => i.isActive),
          inventoryLoaded: true,
        },
      }));
    } catch (e) {
      setAddState((prev) => ({
        ...prev,
        [publisherId]: {
          ...(prev[publisherId] ?? emptyAddState()),
          inventoryLoaded: true,
          error: errorMessage(e),
        },
      }));
    }
  }

  function closeAddFor(publisherId: string) {
    setOpenPublisherId((curr) => (curr === publisherId ? null : curr));
    setAddState((prev) => ({ ...prev, [publisherId]: emptyAddState() }));
  }

  function updateAdd(
    publisherId: string,
    patch: Partial<AddFormState>,
  ) {
    setAddState((prev) => ({
      ...prev,
      [publisherId]: { ...(prev[publisherId] ?? emptyAddState()), ...patch },
    }));
  }

  async function onCreate(e: FormEvent, publisherId: string) {
    e.preventDefault();
    const state = addState[publisherId];
    if (!state) return;
    if (!state.inventoryId) {
      updateAdd(publisherId, { error: "Pick an inventory item." });
      return;
    }
    if (!state.name.trim()) {
      updateAdd(publisherId, { error: "Placement name is required." });
      return;
    }
    const gross = parseFloat(state.grossDollars);
    if (!Number.isFinite(gross) || gross < 0) {
      updateAdd(publisherId, { error: "Gross cost is required." });
      return;
    }
    updateAdd(publisherId, { submitting: true, error: null });
    try {
      const body: Parameters<typeof api.createPlacement>[1] = {
        inventoryId: state.inventoryId,
        name: state.name.trim(),
        status: state.status,
        grossCostCents: Math.round(gross * 100),
      };
      if (state.netDollars.trim()) {
        body.netCostCents = Math.round(parseFloat(state.netDollars) * 100);
      }
      if (state.quantity.trim()) {
        body.quantity = parseInt(state.quantity, 10);
      }
      if (state.notes.trim()) body.notes = state.notes.trim();

      await api.createPlacement(campaignId, body);
      // Refetch only placements — publisher set is unchanged.
      const plas = await api.fetchCampaignPlacements(campaignId);
      setPlacements(plas.placements);
      closeAddFor(publisherId);
    } catch (err) {
      updateAdd(publisherId, { error: errorMessage(err) });
    } finally {
      updateAdd(publisherId, { submitting: false });
    }
  }

  /* ── row-level actions ────────────────────────────────────── */

  async function onStatusChange(p: Placement, next: PlacementStatus) {
    if (next === p.status) return;
    setBusyId(p.id);
    setRowError(null);
    // Optimistic update.
    const prev = placements;
    setPlacements((curr) =>
      curr.map((x) => (x.id === p.id ? { ...x, status: next } : x)),
    );
    try {
      await api.patchPlacement(p.id, { status: next });
    } catch (err) {
      setPlacements(prev);
      setRowError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(p: Placement) {
    if (
      !window.confirm(
        `Delete placement "${p.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(p.id);
    setRowError(null);
    try {
      await api.deletePlacement(p.id);
      setPlacements((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setRowError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  /* ── row edit handlers ─────────────────────────────────────── */

  function startEdit(p: Placement) {
    setEditId(p.id);
    setEditError(null);
    setEditDraft({
      name: p.name,
      grossDollars: centsToDollarsInput(p.grossCostCents),
      netDollars: centsToDollarsInput(p.netCostCents),
      quantity: p.quantity != null ? String(p.quantity) : "",
      notes: p.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft(null);
    setEditError(null);
  }

  function patchDraft(patch: Partial<EditDraft>) {
    setEditDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function onSaveEdit(p: Placement) {
    if (!editDraft) return;
    const name = editDraft.name.trim();
    if (!name) {
      setEditError("Placement name is required.");
      return;
    }
    const gross = parseFloat(editDraft.grossDollars);
    if (!Number.isFinite(gross) || gross < 0) {
      setEditError("Gross cost is required.");
      return;
    }
    const grossCostCents = Math.round(gross * 100);

    let netCostCents: number | null = null;
    const netTrim = editDraft.netDollars.trim();
    if (netTrim !== "") {
      const n = parseFloat(netTrim);
      if (!Number.isFinite(n) || n < 0) {
        setEditError("Net cost must be a non-negative number.");
        return;
      }
      netCostCents = Math.round(n * 100);
    }

    let quantity: number | null = null;
    const qTrim = editDraft.quantity.trim();
    if (qTrim !== "") {
      const q = parseInt(qTrim, 10);
      if (!Number.isFinite(q) || q < 1) {
        setEditError("Quantity must be a positive integer.");
        return;
      }
      quantity = q;
    }

    const notes = editDraft.notes.trim() || null;

    // Build a diff patch so we only send changed fields.
    const body: Parameters<typeof api.patchPlacement>[1] = {};
    if (name !== p.name) body.name = name;
    if (grossCostCents !== p.grossCostCents) body.grossCostCents = grossCostCents;
    if (netCostCents !== p.netCostCents) body.netCostCents = netCostCents;
    if (quantity !== p.quantity) body.quantity = quantity;
    if (notes !== p.notes) body.notes = notes;

    if (Object.keys(body).length === 0) {
      cancelEdit();
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await api.patchPlacement(p.id, body);
      setPlacements((prev) =>
        prev.map((x) => (x.id === p.id ? updated : x)),
      );
      cancelEdit();
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  /* ── rollup totals (agency app, so net is always displayed) ── */

  const totals = useMemo(() => {
    let gross = 0;
    let net = 0;
    let netCount = 0;
    for (const p of placements) {
      gross += p.grossCostCents;
      if (p.netCostCents != null) {
        net += p.netCostCents;
        netCount += 1;
      }
    }
    return { gross, net, netCount };
  }, [placements]);

  /* ── render ────────────────────────────────────────────────── */

  return (
    <section className="card" style={{ marginTop: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Placements</h2>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            {publishers.length} publisher
            {publishers.length !== 1 ? "s" : ""} attached ·{" "}
            {placements.length} placement
            {placements.length !== 1 ? "s" : ""} planned
          </p>
        </div>
        {placements.length > 0 && (
          <div
            className="small"
            style={{ textAlign: "right", whiteSpace: "nowrap" }}
            aria-label="Campaign placement totals"
          >
            <div>
              <span className="muted">Gross total:</span>{" "}
              <strong>{formatCents(totals.gross)}</strong>
            </div>
            <div className="muted">
              Net total (agency only):{" "}
              <strong style={{ color: "inherit" }}>
                {totals.netCount > 0 ? formatCents(totals.net) : "—"}
              </strong>
              {totals.netCount > 0 && totals.netCount < placements.length && (
                <span>
                  {" "}
                  · {totals.netCount}/{placements.length} priced
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {listError && (
        <p className="error" role="alert">
          {listError}
        </p>
      )}
      {rowError && (
        <p className="error" role="alert">
          {rowError}
        </p>
      )}

      {loading && <p className="muted small">Loading placements…</p>}

      {!loading && publishers.length === 0 && (
        <div className="pub-empty">
          <div className="pub-empty-title">No publishers attached yet</div>
          <p className="muted small" style={{ margin: 0 }}>
            Attach publishers in the Publishers section above, then return here
            to plan placements for each one.
          </p>
        </div>
      )}

      {!loading &&
        publishers.length > 0 &&
        publishers.map((pub) => {
          const items = byPublisher.get(pub.id) ?? [];
          const loc = [pub.city, pub.state].filter(Boolean).join(", ");
          const isOpen = openPublisherId === pub.id;
          const form = addState[pub.id];

          return (
            <div
              key={pub.id}
              className="placement-pub-card"
              style={{ marginTop: "0.85rem" }}
            >
              <div className="placement-pub-header">
                <div style={{ minWidth: 0 }}>
                  <div className="placement-pub-name">{pub.name}</div>
                  <div className="small muted">
                    {loc || "Location unknown"}
                    {items.length > 0 && ` · ${items.length} placement${items.length !== 1 ? "s" : ""}`}
                  </div>
                </div>
                {!isOpen ? (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => openAddFor(pub.id)}
                  >
                    + Add placement
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => closeAddFor(pub.id)}
                    disabled={form?.submitting}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* ── per-publisher placement list ── */}
              {items.length > 0 && (
                <div
                  className="table-wrap"
                  style={{ marginTop: "0.65rem" }}
                >
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Gross</th>
                        <th>
                          Net{" "}
                          <span
                            className="small muted"
                            style={{ fontWeight: 400 }}
                          >
                            (agency only)
                          </span>
                        </th>
                        <th>Qty</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => {
                        const busy = busyId === p.id;
                        const editing = editId === p.id && editDraft != null;
                        if (editing) {
                          return (
                            <tr key={p.id}>
                              <td>
                                <input
                                  value={editDraft.name}
                                  onChange={(e) =>
                                    patchDraft({ name: e.target.value })
                                  }
                                  maxLength={255}
                                  aria-label="Placement name"
                                  style={{ width: "100%" }}
                                />
                                <input
                                  value={editDraft.notes}
                                  onChange={(e) =>
                                    patchDraft({ notes: e.target.value })
                                  }
                                  maxLength={2000}
                                  placeholder="Notes (optional)"
                                  aria-label="Notes"
                                  className="small"
                                  style={{ width: "100%", marginTop: "0.25rem" }}
                                />
                              </td>
                              <td className="small">
                                {p.inventory.mediaType}
                                <div className="small muted">
                                  {p.inventory.pricingModel}
                                </div>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <span className="small muted">
                                  {STATUS_LABEL[p.status]}
                                </span>
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <input
                                  type="number"
                                  value={editDraft.grossDollars}
                                  onChange={(e) =>
                                    patchDraft({
                                      grossDollars: e.target.value,
                                    })
                                  }
                                  min="0"
                                  step="0.01"
                                  aria-label="Gross cost"
                                  style={{ width: "7rem" }}
                                />
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <input
                                  type="number"
                                  value={editDraft.netDollars}
                                  onChange={(e) =>
                                    patchDraft({ netDollars: e.target.value })
                                  }
                                  min="0"
                                  step="0.01"
                                  placeholder="—"
                                  aria-label="Net cost"
                                  style={{ width: "7rem" }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  value={editDraft.quantity}
                                  onChange={(e) =>
                                    patchDraft({ quantity: e.target.value })
                                  }
                                  min="1"
                                  placeholder="—"
                                  aria-label="Quantity"
                                  style={{ width: "4.5rem" }}
                                />
                              </td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                <div
                                  style={{ display: "flex", gap: "0.35rem" }}
                                >
                                  <button
                                    type="button"
                                    className="btn primary"
                                    disabled={editSaving}
                                    onClick={() => onSaveEdit(p)}
                                  >
                                    {editSaving ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    disabled={editSaving}
                                    onClick={cancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {editError && (
                                  <div
                                    className="error small"
                                    role="alert"
                                    style={{ marginTop: "0.25rem" }}
                                  >
                                    {editError}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={p.id}>
                            <td>
                              <div style={{ fontWeight: 500 }}>{p.name}</div>
                              {p.notes && (
                                <span className="small muted">{p.notes}</span>
                              )}
                            </td>
                            <td className="small">
                              {p.inventory.mediaType}
                              <div className="small muted">
                                {p.inventory.pricingModel}
                              </div>
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <select
                                value={p.status}
                                disabled={busy || editId !== null}
                                onChange={(e) =>
                                  onStatusChange(
                                    p,
                                    e.target.value as PlacementStatus,
                                  )
                                }
                                className={`placement-status-select placement-status-${p.status.toLowerCase()}`}
                                aria-label={`Status for ${p.name}`}
                              >
                                {STATUS_ORDER.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {formatCents(p.grossCostCents)}
                            </td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              {formatCents(p.netCostCents ?? null)}
                            </td>
                            <td>{p.quantity ?? "—"}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                              <div
                                style={{ display: "flex", gap: "0.35rem" }}
                              >
                                <button
                                  type="button"
                                  className="btn ghost"
                                  disabled={busy || editId !== null}
                                  onClick={() => startEdit(p)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-remove"
                                  disabled={busy || editId !== null}
                                  onClick={() => onDelete(p)}
                                >
                                  {busy ? "…" : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {items.length === 0 && !isOpen && (
                <p
                  className="muted small"
                  style={{ margin: "0.5rem 0 0" }}
                >
                  No placements yet for this publisher.
                </p>
              )}

              {/* ── per-publisher add form ── */}
              {isOpen && form && (
                <form
                  onSubmit={(e) => onCreate(e, pub.id)}
                  className="stack"
                  style={{ marginTop: "0.75rem" }}
                >
                  {!form.inventoryLoaded && (
                    <p className="muted small">Loading inventory…</p>
                  )}
                  {form.inventoryLoaded && form.inventory.length === 0 && (
                    <p className="muted small">
                      This publisher has no active inventory. Add inventory on
                      the publisher page first.
                    </p>
                  )}
                  {form.inventoryLoaded && form.inventory.length > 0 && (
                    <>
                      <div className="two-col">
                        <label className="field">
                          <span>Inventory</span>
                          <select
                            value={form.inventoryId}
                            onChange={(e) =>
                              updateAdd(pub.id, {
                                inventoryId: e.target.value,
                              })
                            }
                            required
                          >
                            <option value="">Select inventory…</option>
                            {form.inventory.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.mediaType} · {i.pricingModel})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Status</span>
                          <select
                            value={form.status}
                            onChange={(e) =>
                              updateAdd(pub.id, {
                                status: e.target.value as PlacementStatus,
                              })
                            }
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="field">
                        <span>Placement name</span>
                        <input
                          value={form.name}
                          onChange={(e) =>
                            updateAdd(pub.id, { name: e.target.value })
                          }
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
                            value={form.grossDollars}
                            onChange={(e) =>
                              updateAdd(pub.id, {
                                grossDollars: e.target.value,
                              })
                            }
                            required
                            min="0"
                            step="0.01"
                            placeholder="e.g. 2500.00"
                          />
                        </label>
                        <label className="field">
                          <span>
                            Net cost (USD)
                            <span className="small muted">
                              {" "}
                              · agency only
                            </span>
                          </span>
                          <input
                            type="number"
                            value={form.netDollars}
                            onChange={(e) =>
                              updateAdd(pub.id, {
                                netDollars: e.target.value,
                              })
                            }
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
                            value={form.quantity}
                            onChange={(e) =>
                              updateAdd(pub.id, {
                                quantity: e.target.value,
                              })
                            }
                            min="1"
                            placeholder="1"
                          />
                        </label>
                        <label className="field">
                          <span>Notes (optional)</span>
                          <input
                            value={form.notes}
                            onChange={(e) =>
                              updateAdd(pub.id, { notes: e.target.value })
                            }
                            maxLength={2000}
                            placeholder="Internal notes"
                          />
                        </label>
                      </div>

                      {form.error && (
                        <p className="error" role="alert">
                          {form.error}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="submit"
                          className="btn primary"
                          disabled={form.submitting}
                        >
                          {form.submitting
                            ? "Creating…"
                            : "Create placement"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => closeAddFor(pub.id)}
                          disabled={form.submitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
          );
        })}
    </section>
  );
}

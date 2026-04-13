import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import type {
  InventoryItem,
  MediaType,
  PricingModel,
  Publisher,
  PublisherInput,
} from "../types";

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

  /* ── publisher edit state ── */
  const [pubEditOpen, setPubEditOpen] = useState(false);
  const [pubForm, setPubForm] = useState<PublisherInput>({});
  const [pubSaving, setPubSaving] = useState(false);
  const [pubEditError, setPubEditError] = useState<string | null>(null);

  /* ── inventory edit state ── */
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

  /* ── publisher edit handlers ── */
  function openPubEdit() {
    if (!publisher) return;
    setPubForm({
      name: publisher.name,
      streetAddress: publisher.streetAddress ?? "",
      city: publisher.city ?? "",
      state: publisher.state ?? "",
      zipCode: publisher.zipCode ?? "",
      county: publisher.county ?? "",
      country: publisher.country ?? "",
      phone: publisher.phone ?? "",
      frequency: publisher.frequency ?? "",
      circulation: publisher.circulation,
      yearEstablished: publisher.yearEstablished,
      officeHours: publisher.officeHours ?? "",
      websiteUrl: publisher.websiteUrl ?? "",
      generalEmail: publisher.generalEmail ?? "",
      transactionEmail: publisher.transactionEmail ?? "",
      corporateEmail: publisher.corporateEmail ?? "",
      contactName: publisher.contactName ?? "",
      parentCompany: publisher.parentCompany ?? "",
      notes: publisher.notes ?? "",
      isActive: publisher.isActive,
    });
    setPubEditError(null);
    setPubEditOpen(true);
  }

  function cancelPubEdit() {
    setPubEditOpen(false);
    setPubEditError(null);
  }

  function updatePub<K extends keyof PublisherInput>(
    key: K,
    value: PublisherInput[K],
  ) {
    setPubForm((f) => ({ ...f, [key]: value }));
  }

  async function onSavePublisher(e: FormEvent) {
    e.preventDefault();
    if (!publisher) return;
    setPubSaving(true);
    setPubEditError(null);
    try {
      // Build a diff vs. the current publisher. Strings: trim; empty → null.
      // Numbers: pass through; undefined means "unchanged".
      const body: PublisherInput = {};
      const stringFields: (keyof PublisherInput)[] = [
        "name",
        "streetAddress",
        "city",
        "state",
        "zipCode",
        "county",
        "country",
        "phone",
        "frequency",
        "officeHours",
        "websiteUrl",
        "generalEmail",
        "transactionEmail",
        "corporateEmail",
        "contactName",
        "parentCompany",
        "notes",
      ];
      for (const key of stringFields) {
        const raw = pubForm[key];
        if (raw === undefined) continue;
        const trimmed = typeof raw === "string" ? raw.trim() : raw;
        const normalized = trimmed === "" ? null : trimmed;
        const current = (publisher as unknown as Record<string, unknown>)[key];
        if (normalized !== current) {
          (body as Record<string, unknown>)[key] = normalized;
        }
      }
      if (pubForm.circulation !== publisher.circulation) {
        body.circulation =
          pubForm.circulation === undefined ? null : pubForm.circulation;
      }
      if (pubForm.yearEstablished !== publisher.yearEstablished) {
        body.yearEstablished =
          pubForm.yearEstablished === undefined
            ? null
            : pubForm.yearEstablished;
      }
      if (
        pubForm.isActive !== undefined &&
        pubForm.isActive !== publisher.isActive
      ) {
        body.isActive = pubForm.isActive;
      }

      if (Object.keys(body).length === 0) {
        setPubEditOpen(false);
        return;
      }

      const updated = await api.patchPublisher(publisher.id, body);
      setPublisher(updated);
      setPubEditOpen(false);
    } catch (err) {
      setPubEditError(errorMessage(err));
    } finally {
      setPubSaving(false);
    }
  }

  /* ── start inventory editing ── */
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>{publisher.name}</h1>
            {publisher.parentCompany && (
              <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                {publisher.parentCompany}
              </p>
            )}
          </div>
          {!pubEditOpen && (
            <button
              type="button"
              className="btn ghost"
              onClick={openPubEdit}
            >
              Edit
            </button>
          )}
        </div>

        {!pubEditOpen && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem 1.5rem",
              marginTop: "1rem",
            }}
          >
            <div>
              <span className="small muted">Address</span>
              <div className="small">
                {publisher.streetAddress ?? "—"}
                {(publisher.city || publisher.state || publisher.zipCode) && (
                  <>
                    <br />
                    {[publisher.city, publisher.state]
                      .filter(Boolean)
                      .join(", ")}
                    {publisher.zipCode ? ` ${publisher.zipCode}` : ""}
                  </>
                )}
                {publisher.country && (
                  <>
                    <br />
                    {publisher.country}
                  </>
                )}
              </div>
            </div>
            <div>
              <span className="small muted">County</span>
              <div>{publisher.county ?? "—"}</div>
            </div>
            <div>
              <span className="small muted">Phone</span>
              <div>{publisher.phone ?? "—"}</div>
            </div>
            <div>
              <span className="small muted">Office hours</span>
              <div>{publisher.officeHours ?? "—"}</div>
            </div>
            <div>
              <span className="small muted">Frequency</span>
              <div>{publisher.frequency ?? "—"}</div>
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
              <span className="small muted">Year established</span>
              <div>{publisher.yearEstablished ?? "—"}</div>
            </div>
            <div>
              <span className="small muted">Contact</span>
              <div>{publisher.contactName ?? "—"}</div>
            </div>
            <div>
              <span className="small muted">General email</span>
              <div>
                {publisher.generalEmail ? (
                  <a href={`mailto:${publisher.generalEmail}`}>
                    {publisher.generalEmail}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <span className="small muted">Transaction email</span>
              <div>
                {publisher.transactionEmail ? (
                  <a href={`mailto:${publisher.transactionEmail}`}>
                    {publisher.transactionEmail}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <span className="small muted">Corporate email</span>
              <div>
                {publisher.corporateEmail ? (
                  <a href={`mailto:${publisher.corporateEmail}`}>
                    {publisher.corporateEmail}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <span className="small muted">Website</span>
              <div>
                {publisher.websiteUrl ? (
                  <a
                    href={publisher.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {publisher.websiteUrl}
                  </a>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div>
              <span className="small muted">Status</span>
              <div>{publisher.isActive ? "Active" : "Inactive"}</div>
            </div>
          </div>
        )}

        {!pubEditOpen && publisher.notes && (
          <div style={{ marginTop: "1rem" }}>
            <span className="small muted">Notes</span>
            <p style={{ margin: "0.25rem 0 0", whiteSpace: "pre-wrap" }}>
              {publisher.notes}
            </p>
          </div>
        )}

        {pubEditOpen && (
          <form
            onSubmit={onSavePublisher}
            className="stack"
            style={{ marginTop: "1rem" }}
          >
            <label className="field">
              <span>Name</span>
              <input
                value={pubForm.name ?? ""}
                onChange={(e) => updatePub("name", e.target.value)}
                required
                maxLength={255}
              />
            </label>

            <div className="two-col">
              <label className="field">
                <span>Parent company</span>
                <input
                  value={pubForm.parentCompany ?? ""}
                  onChange={(e) => updatePub("parentCompany", e.target.value)}
                  maxLength={255}
                />
              </label>
              <label className="field">
                <span>Contact name</span>
                <input
                  value={pubForm.contactName ?? ""}
                  onChange={(e) => updatePub("contactName", e.target.value)}
                  maxLength={255}
                />
              </label>
            </div>

            <label className="field">
              <span>Street address</span>
              <input
                value={pubForm.streetAddress ?? ""}
                onChange={(e) => updatePub("streetAddress", e.target.value)}
                maxLength={255}
              />
            </label>

            <div className="two-col">
              <label className="field">
                <span>City</span>
                <input
                  value={pubForm.city ?? ""}
                  onChange={(e) => updatePub("city", e.target.value)}
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>State / Region</span>
                <input
                  value={pubForm.state ?? ""}
                  onChange={(e) => updatePub("state", e.target.value)}
                  maxLength={100}
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span>ZIP / Postal</span>
                <input
                  value={pubForm.zipCode ?? ""}
                  onChange={(e) => updatePub("zipCode", e.target.value)}
                  maxLength={20}
                />
              </label>
              <label className="field">
                <span>County</span>
                <input
                  value={pubForm.county ?? ""}
                  onChange={(e) => updatePub("county", e.target.value)}
                  maxLength={100}
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span>Country</span>
                <input
                  value={pubForm.country ?? ""}
                  onChange={(e) => updatePub("country", e.target.value)}
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={pubForm.phone ?? ""}
                  onChange={(e) => updatePub("phone", e.target.value)}
                  maxLength={50}
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span>Frequency</span>
                <input
                  value={pubForm.frequency ?? ""}
                  onChange={(e) => updatePub("frequency", e.target.value)}
                  maxLength={100}
                />
              </label>
              <label className="field">
                <span>Circulation</span>
                <input
                  type="number"
                  value={
                    pubForm.circulation == null
                      ? ""
                      : String(pubForm.circulation)
                  }
                  onChange={(e) =>
                    updatePub(
                      "circulation",
                      e.target.value === ""
                        ? null
                        : parseInt(e.target.value, 10),
                    )
                  }
                  min="0"
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span>Year established</span>
                <input
                  type="number"
                  value={
                    pubForm.yearEstablished == null
                      ? ""
                      : String(pubForm.yearEstablished)
                  }
                  onChange={(e) =>
                    updatePub(
                      "yearEstablished",
                      e.target.value === ""
                        ? null
                        : parseInt(e.target.value, 10),
                    )
                  }
                  min="1500"
                  max="2100"
                />
              </label>
              <label className="field">
                <span>Office hours</span>
                <input
                  value={pubForm.officeHours ?? ""}
                  onChange={(e) => updatePub("officeHours", e.target.value)}
                  maxLength={255}
                />
              </label>
            </div>

            <label className="field">
              <span>Website</span>
              <input
                type="url"
                value={pubForm.websiteUrl ?? ""}
                onChange={(e) => updatePub("websiteUrl", e.target.value)}
              />
            </label>

            <div className="two-col">
              <label className="field">
                <span>General email</span>
                <input
                  type="email"
                  value={pubForm.generalEmail ?? ""}
                  onChange={(e) => updatePub("generalEmail", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Transaction email</span>
                <input
                  type="email"
                  value={pubForm.transactionEmail ?? ""}
                  onChange={(e) =>
                    updatePub("transactionEmail", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span>Corporate email</span>
                <input
                  type="email"
                  value={pubForm.corporateEmail ?? ""}
                  onChange={(e) =>
                    updatePub("corporateEmail", e.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  value={pubForm.isActive ? "true" : "false"}
                  onChange={(e) =>
                    updatePub("isActive", e.target.value === "true")
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea
                value={pubForm.notes ?? ""}
                onChange={(e) => updatePub("notes", e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>

            {pubEditError && (
              <p className="error" role="alert">
                {pubEditError}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                className="btn primary"
                disabled={pubSaving}
              >
                {pubSaving ? "Saving…" : "Save publisher"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={cancelPubEdit}
                disabled={pubSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
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

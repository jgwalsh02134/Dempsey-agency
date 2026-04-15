import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { PublisherForm } from "../components/PublisherForm";
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

/** Compact client-facing labels for pricing models so the table doesn't
 *  shout raw enum values at the user. */
const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  FLAT: "Flat",
  CPM: "CPM",
  VCPM: "vCPM",
  CPC: "CPC",
  CPCV: "CPCV",
  COLUMN_INCH: "Col. inch",
  PER_LINE: "Per line",
  OTHER: "Other",
};

const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  PRINT: "Print",
  DIGITAL: "Digital",
  EMAIL: "Email",
  OTHER: "Other",
};

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

/** Produce a diff-patched PublisherInput body by comparing form values
 *  against the current publisher. Empty strings clear to null. */
function buildPatchBody(
  values: PublisherInput,
  publisher: Publisher,
): PublisherInput {
  const stringFields: (keyof PublisherInput)[] = [
    "name",
    "parentCompany",
    "publicationType",
    "frequency",
    "streetAddress",
    "streetAddress2",
    "city",
    "state",
    "zipCode",
    "county",
    "country",
    "dmaName",
    "dmaCode",
    "phone",
    "officeHours",
    "contactName",
    "contactTitle",
    "websiteUrl",
    "logoUrl",
    "rateCardUrl",
    "mediaKitUrl",
    "adSpecsUrl",
    "generalEmail",
    "transactionEmail",
    "corporateEmail",
    "editorialEmail",
    "advertisingEmail",
    "billingEmail",
    "notes",
  ];
  const body: PublisherInput = {};
  for (const key of stringFields) {
    const raw = values[key];
    if (raw === undefined) continue;
    const trimmed = typeof raw === "string" ? raw.trim() : raw;
    const normalized = trimmed === "" ? null : trimmed;
    const current = (publisher as unknown as Record<string, unknown>)[key];
    if (normalized !== current) {
      (body as Record<string, unknown>)[key] = normalized;
    }
  }
  if (values.circulation !== publisher.circulation) {
    body.circulation =
      values.circulation === undefined ? null : values.circulation;
  }
  if (values.yearEstablished !== publisher.yearEstablished) {
    body.yearEstablished =
      values.yearEstablished === undefined ? null : values.yearEstablished;
  }
  if (
    values.isActive !== undefined &&
    values.isActive !== publisher.isActive
  ) {
    body.isActive = values.isActive;
  }
  return body;
}

function publisherToFormValues(p: Publisher): PublisherInput {
  return {
    name: p.name,
    parentCompany: p.parentCompany ?? "",
    publicationType: p.publicationType ?? "",
    frequency: p.frequency ?? "",
    circulation: p.circulation,
    yearEstablished: p.yearEstablished,
    isActive: p.isActive,
    streetAddress: p.streetAddress ?? "",
    streetAddress2: p.streetAddress2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zipCode: p.zipCode ?? "",
    county: p.county ?? "",
    country: p.country ?? "",
    dmaName: p.dmaName ?? "",
    dmaCode: p.dmaCode ?? "",
    phone: p.phone ?? "",
    officeHours: p.officeHours ?? "",
    contactName: p.contactName ?? "",
    contactTitle: p.contactTitle ?? "",
    websiteUrl: p.websiteUrl ?? "",
    logoUrl: p.logoUrl ?? "",
    rateCardUrl: p.rateCardUrl ?? "",
    mediaKitUrl: p.mediaKitUrl ?? "",
    adSpecsUrl: p.adSpecsUrl ?? "",
    generalEmail: p.generalEmail ?? "",
    transactionEmail: p.transactionEmail ?? "",
    corporateEmail: p.corporateEmail ?? "",
    editorialEmail: p.editorialEmail ?? "",
    advertisingEmail: p.advertisingEmail ?? "",
    billingEmail: p.billingEmail ?? "",
    notes: p.notes ?? "",
  };
}

/** Small helper to render an external link or an em-dash. */
function ExternalLink({ url }: { url: string | null }) {
  if (!url) return <>—</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {url.replace(/^https?:\/\//, "")}
    </a>
  );
}

function MailtoLink({ email }: { email: string | null }) {
  if (!email) return <>—</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}

export function PublisherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  /* ── publisher state ── */
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [pubLoading, setPubLoading] = useState(true);
  const [pubError, setPubError] = useState<string | null>(null);

  /* ── inventory list state ── */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string | null>(null);

  /* ── inventory create ── */
  const [addOpen, setAddOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cMediaType, setCMediaType] = useState<MediaType>("PRINT");
  const [cPricingModel, setCPricingModel] = useState<PricingModel>("FLAT");
  const [cRateDollars, setCRateDollars] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  /* ── inventory delete ── */
  const [deletingInventoryId, setDeletingInventoryId] = useState<string | null>(
    null,
  );
  const [inventoryDeleteError, setInventoryDeleteError] = useState<
    string | null
  >(null);

  /* ── inventory edit ── */
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eMediaType, setEMediaType] = useState<MediaType>("PRINT");
  const [ePricingModel, setEPricingModel] = useState<PricingModel>("FLAT");
  const [eRateDollars, setERateDollars] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eIsActive, setEIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /* ── publisher edit ── */
  const [pubEditOpen, setPubEditOpen] = useState(false);
  const [pubSaving, setPubSaving] = useState(false);
  const [pubEditError, setPubEditError] = useState<string | null>(null);

  /* ── geocode state ── */
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);

  /* ── delete state ── */
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── load publisher ──
   * No GET /publishers/:id endpoint exists today; we fetch the catalog and
   * find by id. Acceptable while the catalog is small; revisit by adding a
   * dedicated route once scale or row-level permissions warrant it. */
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

  /* ── publisher edit handlers ── */
  async function onSavePublisher(values: PublisherInput) {
    if (!publisher) return;
    setPubSaving(true);
    setPubEditError(null);
    try {
      const body = buildPatchBody(values, publisher);
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

  /* ── delete handler ── */
  async function onDelete() {
    if (!publisher) return;
    const msg =
      `Delete publisher "${publisher.name}"? This cannot be undone.\n\n` +
      `If the publisher has inventory or is attached to campaigns, the deletion will be blocked.`;
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deletePublisher(publisher.id);
      navigate("/publishers");
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  }

  /* ── geocode handler ── */
  async function onGeocode() {
    if (!publisher) return;
    setGeocoding(true);
    setGeocodeMsg(null);
    try {
      const updated = await api.geocodePublisher(publisher.id);
      setPublisher(updated);
      setGeocodeMsg(
        updated.latitude != null && updated.longitude != null
          ? "Geocoded successfully."
          : `Geocode status: ${updated.geocodeStatus ?? "unknown"}.`,
      );
    } catch (err) {
      setGeocodeMsg(errorMessage(err));
    } finally {
      setGeocoding(false);
    }
  }

  /* ── inventory CRUD handlers (unchanged behavior) ── */
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
      setAddOpen(false);
      void loadInventory();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteInventory(item: InventoryItem) {
    const msg =
      `Delete inventory unit "${item.name}"? This cannot be undone.\n\n` +
      `If this unit is referenced by any placement, the deletion will be blocked.`;
    if (!window.confirm(msg)) return;
    setDeletingInventoryId(item.id);
    setInventoryDeleteError(null);
    try {
      await api.deleteInventory(item.id);
      setInventory((prev) => prev.filter((i) => i.id !== item.id));
      if (editId === item.id) setEditId(null);
    } catch (err) {
      setInventoryDeleteError(errorMessage(err));
    } finally {
      setDeletingInventoryId(null);
    }
  }

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

  const dmaLabel =
    publisher.dmaName && publisher.dmaCode
      ? `${publisher.dmaName} (${publisher.dmaCode})`
      : publisher.dmaName ?? publisher.dmaCode ?? "—";
  const locationLabel =
    [publisher.city, publisher.state].filter(Boolean).join(", ") || "—";
  const activeInventory = inventory.filter((i) => i.isActive).length;

  return (
    <>
      <Link
        to="/publishers"
        className="btn ghost"
        style={{ marginBottom: "0.75rem", display: "inline-block" }}
      >
        &larr; Back to publishers
      </Link>

      {/* ── Compact publisher hero: name, status, actions, quick-facts strip ── */}
      <section
        className={`card pub-hero${publisher.isActive ? "" : " pub-hero-inactive"}`}
      >
        <div className="pub-hero-top">
          <div className="pub-hero-identity">
            <div className="pub-hero-name-row">
              <h1 className="pub-hero-name">{publisher.name}</h1>
              <span
                className={`status-pill ${publisher.isActive ? "status-pill-active" : "status-pill-inactive"}`}
              >
                {publisher.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {publisher.parentCompany && (
              <p className="pub-hero-parent">{publisher.parentCompany}</p>
            )}
          </div>
          {!pubEditOpen && (
            <div className="pub-hero-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={onGeocode}
                disabled={geocoding}
                title="Look up latitude/longitude from address via OpenStreetMap"
              >
                {geocoding ? "Geocoding…" : "Geocode"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPubEditOpen(true);
                  setPubEditError(null);
                }}
              >
                Edit publisher
              </button>
              <button
                type="button"
                className="btn-remove"
                onClick={onDelete}
                disabled={deleting}
                title="Permanently delete this publisher"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>

        {deleteError && !pubEditOpen && (
          <p className="error" role="alert" style={{ marginTop: "0.5rem" }}>
            {deleteError}
          </p>
        )}

        {geocodeMsg && !pubEditOpen && (
          <p
            className="small muted"
            role="status"
            style={{ marginTop: "0.5rem" }}
          >
            {geocodeMsg}
          </p>
        )}

        {!pubEditOpen && (
          <dl className="pub-quick-facts">
            <div className="pub-quick-fact">
              <dt>Location</dt>
              <dd>{locationLabel}</dd>
            </div>
            <div className="pub-quick-fact">
              <dt>DMA</dt>
              <dd className="mono">{dmaLabel}</dd>
            </div>
            <div className="pub-quick-fact">
              <dt>Type</dt>
              <dd>
                {[publisher.publicationType, publisher.frequency]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </div>
            <div className="pub-quick-fact">
              <dt>Circulation</dt>
              <dd className="mono">
                {publisher.circulation != null
                  ? publisher.circulation.toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div className="pub-quick-fact">
              <dt>Website</dt>
              <dd>
                <ExternalLink url={publisher.websiteUrl} />
              </dd>
            </div>
            <div className="pub-quick-fact">
              <dt>Inventory</dt>
              <dd className="mono">
                {inventory.length.toLocaleString()}
                {activeInventory !== inventory.length && (
                  <span className="muted small">
                    {" "}
                    ({activeInventory} active)
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}

        {pubEditOpen && (
          <div style={{ marginTop: "1rem" }}>
            <PublisherForm
              initial={publisherToFormValues(publisher)}
              submitLabel="Save publisher"
              onSubmit={onSavePublisher}
              onCancel={() => {
                setPubEditOpen(false);
                setPubEditError(null);
              }}
              submitting={pubSaving}
              error={pubEditError}
            />
          </div>
        )}
      </section>

      {/* ── INVENTORY (primary focus): header + add-as-action + dense table ── */}
      <section className="card pub-inventory">
        <div className="pub-inventory-head">
          <div>
            <span className="pub-section-eyebrow">Primary data</span>
            <h2 className="pub-inventory-title">
              Inventory{" "}
              <span className="pub-inventory-count">
                {inventory.length.toLocaleString()}
              </span>
            </h2>
            {!invLoading && inventory.length > 0 && (
              <p className="muted small" style={{ margin: "0.15rem 0 0" }}>
                {activeInventory} of {inventory.length} active · sellable units
                on this publisher
              </p>
            )}
          </div>
          {!addOpen && editId === null && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setAddOpen(true);
                setCreateError(null);
                setCreateSuccess(null);
              }}
            >
              + Add inventory unit
            </button>
          )}
        </div>

        {addOpen && (
          <form onSubmit={onCreate} className="pub-inventory-add">
            <div className="pub-inventory-add-head">
              <div>
                <span className="pub-section-eyebrow">New unit</span>
                <h3 className="pub-inventory-add-title">
                  Add a sellable inventory unit
                </h3>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAddOpen(false);
                  setCreateError(null);
                }}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
            <div className="pub-inventory-add-grid">
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Unit name</span>
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  required
                  maxLength={255}
                  placeholder="e.g. Full Page Ad"
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Media type</span>
                <select
                  value={cMediaType}
                  onChange={(e) =>
                    setCMediaType(e.target.value as MediaType)
                  }
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MEDIA_TYPE_LABEL[t]}
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
                      {PRICING_MODEL_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Rate (USD, optional)</span>
                <input
                  type="number"
                  value={cRateDollars}
                  onChange={(e) => setCRateDollars(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="1500.00"
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
            <div className="pub-inventory-add-actions">
              <button
                type="submit"
                className="btn primary"
                disabled={creating}
              >
                {creating ? "Adding…" : "Add inventory unit"}
              </button>
            </div>
          </form>
        )}

        {createSuccess && !addOpen && (
          <p className="success" role="status" style={{ marginTop: "0.5rem" }}>
            {createSuccess}
          </p>
        )}

        {invLoading && <p className="muted">Loading inventory…</p>}
        {invError && (
          <p className="error" role="alert">
            {invError}
          </p>
        )}
        {inventoryDeleteError && (
          <p className="error" role="alert">
            {inventoryDeleteError}
          </p>
        )}

        {!invLoading && inventory.length === 0 && !invError && (
          <div className="pub-inventory-empty">
            <p className="muted" style={{ margin: 0 }}>
              No inventory units yet. Use <strong>+ Add inventory unit</strong>{" "}
              above to create the first sellable unit for this publisher.
            </p>
          </div>
        )}
        {!invLoading && inventory.length > 0 && (
          <div className="table-wrap grid-table pub-inventory-grid">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit name</th>
                  <th>Channel</th>
                  <th>Pricing</th>
                  <th className="col-num">Rate</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) =>
                  editId === item.id ? (
                    <tr key={item.id} className="pub-inventory-edit-row">
                      <td colSpan={6}>
                        <form
                          onSubmit={onSaveEdit}
                          className="pub-inventory-edit-form"
                        >
                          <div className="pub-section-eyebrow">
                            Editing unit
                          </div>
                          <div className="pub-inventory-add-grid">
                            <label
                              className="field"
                              style={{ gridColumn: "1 / -1" }}
                            >
                              <span>Unit name</span>
                              <input
                                value={eName}
                                onChange={(e) => setEName(e.target.value)}
                                required
                                maxLength={255}
                              />
                            </label>
                            <label
                              className="field"
                              style={{ gridColumn: "1 / -1" }}
                            >
                              <span>Description</span>
                              <input
                                value={eDescription}
                                onChange={(e) =>
                                  setEDescription(e.target.value)
                                }
                                maxLength={1000}
                              />
                            </label>
                            <label className="field">
                              <span>Media type</span>
                              <select
                                value={eMediaType}
                                onChange={(e) =>
                                  setEMediaType(e.target.value as MediaType)
                                }
                              >
                                {MEDIA_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {MEDIA_TYPE_LABEL[t]}
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
                                    {PRICING_MODEL_LABEL[m]}
                                  </option>
                                ))}
                              </select>
                            </label>
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
                              <span>Status</span>
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
                          <div className="pub-inventory-add-actions">
                            <button
                              type="submit"
                              className="btn primary"
                              disabled={saving}
                            >
                              {saving ? "Saving…" : "Save changes"}
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
                      style={item.isActive ? undefined : { opacity: 0.6 }}
                    >
                      <td className="pub-inventory-name-cell">
                        <span className="pub-inventory-name">{item.name}</span>
                        {item.description && (
                          <span className="small muted pub-inventory-desc">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="channel-chip">
                          {MEDIA_TYPE_LABEL[item.mediaType]}
                        </span>
                      </td>
                      <td className="mono small">
                        {PRICING_MODEL_LABEL[item.pricingModel]}
                      </td>
                      <td className="col-num">
                        {item.rateCents != null ? (
                          <span className="money-strong">
                            {formatCents(item.rateCents)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${item.isActive ? "status-pill-active" : "status-pill-inactive"}`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => startEdit(item)}
                            disabled={
                              deletingInventoryId === item.id ||
                              editId !== null
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-remove"
                            onClick={() => onDeleteInventory(item)}
                            disabled={
                              deletingInventoryId === item.id ||
                              editId !== null
                            }
                            aria-label={`Delete ${item.name}`}
                          >
                            {deletingInventoryId === item.id
                              ? "Deleting…"
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Secondary: full publisher details (collapsed by default) ── */}
      {!pubEditOpen && (
        <details className="pub-details">
          <summary className="pub-details-summary">
            <span className="pub-details-summary-label">
              Full publisher details
            </span>
            <span className="pub-details-summary-hint">
              Identity · Location · Contacts · Links · Emails · Notes
            </span>
          </summary>
          <div className="pub-sections">
            {/* Identity */}
            <div className="pub-section">
              <h3>Identity</h3>
              <dl className="pub-dl">
                <dt>Name</dt>
                <dd>{publisher.name}</dd>
                <dt>Parent company</dt>
                <dd>{publisher.parentCompany ?? "—"}</dd>
                <dt>Publication type</dt>
                <dd>{publisher.publicationType ?? "—"}</dd>
                <dt>Frequency</dt>
                <dd>{publisher.frequency ?? "—"}</dd>
                <dt>Circulation</dt>
                <dd className="mono">
                  {publisher.circulation != null
                    ? publisher.circulation.toLocaleString()
                    : "—"}
                </dd>
                <dt>Year established</dt>
                <dd className="mono">{publisher.yearEstablished ?? "—"}</dd>
                <dt>DMA</dt>
                <dd className="mono">{dmaLabel}</dd>
                <dt>Status</dt>
                <dd>{publisher.isActive ? "Active" : "Inactive"}</dd>
              </dl>
            </div>

            {/* Location */}
            <div className="pub-section">
              <h3>Location</h3>
              <dl className="pub-dl">
                <dt>Street 1</dt>
                <dd>{publisher.streetAddress ?? "—"}</dd>
                <dt>Street 2</dt>
                <dd>{publisher.streetAddress2 ?? "—"}</dd>
                <dt>City</dt>
                <dd>{publisher.city ?? "—"}</dd>
                <dt>State</dt>
                <dd>{publisher.state ?? "—"}</dd>
                <dt>ZIP</dt>
                <dd>{publisher.zipCode ?? "—"}</dd>
                <dt>County</dt>
                <dd>{publisher.county ?? "—"}</dd>
                <dt>Country</dt>
                <dd>{publisher.country ?? "—"}</dd>
                <dt>Coordinates</dt>
                <dd>
                  {publisher.latitude != null && publisher.longitude != null
                    ? `${publisher.latitude.toFixed(5)}, ${publisher.longitude.toFixed(5)}`
                    : publisher.geocodeStatus ?? "Not geocoded"}
                </dd>
              </dl>
            </div>

            {/* Contacts */}
            <div className="pub-section">
              <h3>Contacts</h3>
              <dl className="pub-dl">
                <dt>Main phone</dt>
                <dd>{publisher.phone ?? "—"}</dd>
                <dt>Office hours</dt>
                <dd>{publisher.officeHours ?? "—"}</dd>
                <dt>Contact name</dt>
                <dd>{publisher.contactName ?? "—"}</dd>
                <dt>Contact title</dt>
                <dd>{publisher.contactTitle ?? "—"}</dd>
              </dl>
            </div>

            {/* Website & reference links */}
            <div className="pub-section">
              <h3>Website &amp; reference links</h3>
              <dl className="pub-dl">
                <dt>Website</dt>
                <dd>
                  <ExternalLink url={publisher.websiteUrl} />
                </dd>
                <dt>Logo</dt>
                <dd>
                  <ExternalLink url={publisher.logoUrl} />
                </dd>
                <dt>Rate card</dt>
                <dd>
                  <ExternalLink url={publisher.rateCardUrl} />
                </dd>
                <dt>Media kit</dt>
                <dd>
                  <ExternalLink url={publisher.mediaKitUrl} />
                </dd>
                <dt>Ad specs</dt>
                <dd>
                  <ExternalLink url={publisher.adSpecsUrl} />
                </dd>
              </dl>
            </div>

            {/* Emails */}
            <div className="pub-section">
              <h3>Emails</h3>
              <dl className="pub-dl">
                <dt>General</dt>
                <dd>
                  <MailtoLink email={publisher.generalEmail} />
                </dd>
                <dt>Advertising</dt>
                <dd>
                  <MailtoLink email={publisher.advertisingEmail} />
                </dd>
                <dt>Editorial</dt>
                <dd>
                  <MailtoLink email={publisher.editorialEmail} />
                </dd>
                <dt>Billing</dt>
                <dd>
                  <MailtoLink email={publisher.billingEmail} />
                </dd>
                <dt>Transactions</dt>
                <dd>
                  <MailtoLink email={publisher.transactionEmail} />
                </dd>
                <dt>Corporate</dt>
                <dd>
                  <MailtoLink email={publisher.corporateEmail} />
                </dd>
              </dl>
            </div>

            {/* Other */}
            <div className="pub-section">
              <h3>Other</h3>
              <dl className="pub-dl">
                <dt>Notes</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>
                  {publisher.notes ?? "—"}
                </dd>
              </dl>
            </div>
          </div>
        </details>
      )}
    </>
  );
}

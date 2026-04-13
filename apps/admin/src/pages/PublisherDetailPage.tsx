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
  const [cName, setCName] = useState("");
  const [cMediaType, setCMediaType] = useState<MediaType>("PRINT");
  const [cPricingModel, setCPricingModel] = useState<PricingModel>("FLAT");
  const [cRateDollars, setCRateDollars] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

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
      void loadInventory();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
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

  return (
    <>
      <Link
        to="/publishers"
        className="btn ghost"
        style={{ marginBottom: "1rem", display: "inline-block" }}
      >
        &larr; Back to publishers
      </Link>

      {/* ── Publisher header + categorized display / edit ── */}
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
            <div style={{ display: "flex", gap: "0.5rem" }}>
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
                className="btn ghost"
                onClick={() => {
                  setPubEditOpen(true);
                  setPubEditError(null);
                }}
              >
                Edit
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
          <p
            className="error"
            role="alert"
            style={{ marginTop: "0.5rem" }}
          >
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
                <dd>
                  {publisher.circulation != null
                    ? publisher.circulation.toLocaleString()
                    : "—"}
                </dd>
                <dt>Year established</dt>
                <dd>{publisher.yearEstablished ?? "—"}</dd>
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
                                  setEMediaType(e.target.value as MediaType)
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
                      <td>{item.isActive ? "Active" : "Inactive"}</td>
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

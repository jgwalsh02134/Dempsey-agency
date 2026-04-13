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

  /* ── geocode state ── */
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);

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
      format: publisher.format ?? "",
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
        "format",
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
                onClick={openPubEdit}
              >
                Edit
              </button>
            </div>
          )}
        </div>

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
                <dt>Street</dt>
                <dd>{publisher.streetAddress ?? "—"}</dd>
                <dt>City</dt>
                <dd>{publisher.city ?? "—"}</dd>
                <dt>State / Region</dt>
                <dd>{publisher.state ?? "—"}</dd>
                <dt>ZIP / Postal</dt>
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

            {/* Contact */}
            <div className="pub-section">
              <h3>Contact</h3>
              <dl className="pub-dl">
                <dt>Phone</dt>
                <dd>{publisher.phone ?? "—"}</dd>
                <dt>General email</dt>
                <dd>
                  {publisher.generalEmail ? (
                    <a href={`mailto:${publisher.generalEmail}`}>
                      {publisher.generalEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Corporate email</dt>
                <dd>
                  {publisher.corporateEmail ? (
                    <a href={`mailto:${publisher.corporateEmail}`}>
                      {publisher.corporateEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Transaction email</dt>
                <dd>
                  {publisher.transactionEmail ? (
                    <a href={`mailto:${publisher.transactionEmail}`}>
                      {publisher.transactionEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
            </div>

            {/* Digital */}
            <div className="pub-section">
              <h3>Digital</h3>
              <dl className="pub-dl">
                <dt>Website</dt>
                <dd>
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
                </dd>
              </dl>
            </div>

            {/* Publication */}
            <div className="pub-section">
              <h3>Publication</h3>
              <dl className="pub-dl">
                <dt>Frequency</dt>
                <dd>{publisher.frequency ?? "—"}</dd>
                <dt>Format</dt>
                <dd>{publisher.format ?? "—"}</dd>
                <dt>Circulation</dt>
                <dd>
                  {publisher.circulation != null
                    ? publisher.circulation.toLocaleString()
                    : "—"}
                </dd>
              </dl>
            </div>

            {/* Operations */}
            <div className="pub-section">
              <h3>Operations</h3>
              <dl className="pub-dl">
                <dt>Office hours</dt>
                <dd>{publisher.officeHours ?? "—"}</dd>
                <dt>Contact name</dt>
                <dd>{publisher.contactName ?? "—"}</dd>
                <dt>Notes</dt>
                <dd style={{ whiteSpace: "pre-wrap" }}>
                  {publisher.notes ?? "—"}
                </dd>
              </dl>
            </div>
          </div>
        )}

        {pubEditOpen && (
          <form
            onSubmit={onSavePublisher}
            className="stack"
            style={{ marginTop: "1rem" }}
          >
            {/* ── Identity ── */}
            <fieldset className="pub-fieldset">
              <legend>Identity</legend>
              <label className="field">
                <span>Publisher name</span>
                <input
                  value={pubForm.name ?? ""}
                  onChange={(e) => updatePub("name", e.target.value)}
                  required
                  maxLength={255}
                />
              </label>
              <div className="two-col">
                <label className="field">
                  <span>Parent company (optional)</span>
                  <input
                    value={pubForm.parentCompany ?? ""}
                    onChange={(e) =>
                      updatePub("parentCompany", e.target.value)
                    }
                    maxLength={255}
                  />
                </label>
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
              </div>
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
            </fieldset>

            {/* ── Location ── */}
            <fieldset className="pub-fieldset">
              <legend>Location</legend>
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
              <label className="field">
                <span>Country</span>
                <input
                  value={pubForm.country ?? ""}
                  onChange={(e) => updatePub("country", e.target.value)}
                  maxLength={100}
                />
              </label>
            </fieldset>

            {/* ── Contact ── */}
            <fieldset className="pub-fieldset">
              <legend>Contact</legend>
              <label className="field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={pubForm.phone ?? ""}
                  onChange={(e) => updatePub("phone", e.target.value)}
                  maxLength={50}
                />
              </label>
              <label className="field">
                <span>General email</span>
                <input
                  type="email"
                  value={pubForm.generalEmail ?? ""}
                  onChange={(e) => updatePub("generalEmail", e.target.value)}
                  placeholder="info@publisher.com"
                />
              </label>
              <div className="two-col">
                <label className="field">
                  <span>Corporate email</span>
                  <input
                    type="email"
                    value={pubForm.corporateEmail ?? ""}
                    onChange={(e) =>
                      updatePub("corporateEmail", e.target.value)
                    }
                    placeholder="corporate@publisher.com"
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
                    placeholder="billing@publisher.com"
                  />
                </label>
              </div>
            </fieldset>

            {/* ── Digital ── */}
            <fieldset className="pub-fieldset">
              <legend>Digital</legend>
              <label className="field">
                <span>Website URL</span>
                <input
                  type="url"
                  value={pubForm.websiteUrl ?? ""}
                  onChange={(e) => updatePub("websiteUrl", e.target.value)}
                  placeholder="https://www.publisher.com"
                />
              </label>
            </fieldset>

            {/* ── Publication ── */}
            <fieldset className="pub-fieldset">
              <legend>Publication</legend>
              <div className="two-col">
                <label className="field">
                  <span>Frequency</span>
                  <input
                    value={pubForm.frequency ?? ""}
                    onChange={(e) => updatePub("frequency", e.target.value)}
                    maxLength={100}
                    placeholder="Daily / Weekly / Monthly"
                  />
                </label>
                <label className="field">
                  <span>Format (optional)</span>
                  <input
                    value={pubForm.format ?? ""}
                    onChange={(e) => updatePub("format", e.target.value)}
                    maxLength={100}
                    placeholder="Broadsheet / Tabloid / Magazine / Digital"
                  />
                </label>
              </div>
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
            </fieldset>

            {/* ── Operations ── */}
            <fieldset className="pub-fieldset">
              <legend>Operations</legend>
              <div className="two-col">
                <label className="field">
                  <span>Office hours</span>
                  <input
                    value={pubForm.officeHours ?? ""}
                    onChange={(e) => updatePub("officeHours", e.target.value)}
                    maxLength={255}
                    placeholder="Mon–Fri 9am–5pm"
                  />
                </label>
                <label className="field">
                  <span>Contact name (optional)</span>
                  <input
                    value={pubForm.contactName ?? ""}
                    onChange={(e) => updatePub("contactName", e.target.value)}
                    maxLength={255}
                  />
                </label>
              </div>
              <label className="field">
                <span>Notes (optional)</span>
                <textarea
                  value={pubForm.notes ?? ""}
                  onChange={(e) => updatePub("notes", e.target.value)}
                  maxLength={2000}
                  rows={3}
                />
              </label>
            </fieldset>

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

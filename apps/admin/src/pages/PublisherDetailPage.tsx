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

/* ─────────────────────────────────────────────────────────────────────
 *  Typed inventory kinds (UI-only simulation — no backend schema change)
 *
 *  The API accepts a flat {name, mediaType, pricingModel, rateCents,
 *  description} shape. We model "real" ad-inventory kinds on top of it by:
 *    • deriving mediaType + pricingModel from the kind,
 *    • storing structured fields as a tagged prefix in `description`,
 *    • parsing that tag back in the table render.
 *
 *  When backend support arrives, the tag-encoding layer can be replaced
 *  without touching the form or the table.
 * ───────────────────────────────────────────────────────────────────── */

type InventoryKind = "PRINT_DISPLAY" | "PRINT_INSERT" | "DIGITAL_DISPLAY";

type PrintDisplayFormat = "FULL" | "HALF" | "QUARTER" | "CUSTOM";

type DigitalAdSize =
  | "728x90"
  | "300x250"
  | "300x600"
  | "320x50"
  | "160x600"
  | "CUSTOM";

const INVENTORY_KIND_LABEL: Record<InventoryKind, string> = {
  PRINT_DISPLAY: "Print Display",
  PRINT_INSERT: "Print Insert",
  DIGITAL_DISPLAY: "Digital Display",
};

const INVENTORY_KIND_SUB: Record<InventoryKind, string> = {
  PRINT_DISPLAY: "Ad units inside the publication — full, half, quarter page",
  PRINT_INSERT: "Pre-printed inserts distributed with the paper",
  DIGITAL_DISPLAY: "IAB-size banner ads on publisher websites",
};

const PRINT_DISPLAY_FORMAT_LABEL: Record<PrintDisplayFormat, string> = {
  FULL: "Full page",
  HALF: "Half page",
  QUARTER: "Quarter page",
  CUSTOM: "Custom",
};

const DIGITAL_AD_SIZE_LABEL: Record<DigitalAdSize, string> = {
  "728x90": "728×90 · Leaderboard",
  "300x250": "300×250 · Medium rectangle",
  "300x600": "300×600 · Half page",
  "320x50": "320×50 · Mobile banner",
  "160x600": "160×600 · Skyscraper",
  CUSTOM: "Custom size",
};

/** Encode typed fields into a tag prefix that survives the description
 *  round-trip through the API. Format:
 *    `[KIND] key1=v1; key2=v2 — free text notes`
 *  Keys use a constrained subset (no `;` `=` `[` `]` in values). */
function encodeInventoryMeta(
  kind: InventoryKind,
  fields: Record<string, string>,
  notes?: string,
): string {
  const entries = Object.entries(fields)
    .filter(([, v]) => v != null && v.toString().trim().length > 0)
    .map(([k, v]) => `${k}=${String(v).replace(/[;\[\]=]/g, " ")}`)
    .join("; ");
  const head = `[${kind}]${entries ? " " + entries : ""}`;
  const trailing = notes?.trim() ? ` — ${notes.trim()}` : "";
  return head + trailing;
}

interface InventoryMeta {
  kind: InventoryKind;
  fields: Record<string, string>;
  notes: string;
}

/** Parse a `[KIND] key=v; ...` tag out of an inventory description.
 *  Returns null for legacy items (shown using the old mediaType fallback). */
function parseInventoryMeta(
  description: string | null | undefined,
): InventoryMeta | null {
  if (!description) return null;
  const match = description.match(
    /^\[(PRINT_DISPLAY|PRINT_INSERT|DIGITAL_DISPLAY)\]\s*([^—]*?)(?:\s+—\s+(.*))?$/s,
  );
  if (!match) return null;
  const kind = match[1] as InventoryKind;
  const pairs = (match[2] ?? "").trim();
  const notes = (match[3] ?? "").trim();
  const fields: Record<string, string> = {};
  if (pairs) {
    for (const chunk of pairs.split(";")) {
      const eq = chunk.indexOf("=");
      if (eq === -1) continue;
      const k = chunk.slice(0, eq).trim();
      const v = chunk.slice(eq + 1).trim();
      if (k) fields[k] = v;
    }
  }
  return { kind, fields, notes };
}

/** Derive a compact "Format" display for the table from parsed meta. */
function metaFormatLabel(meta: InventoryMeta | null): string {
  if (!meta) return "—";
  if (meta.kind === "PRINT_DISPLAY") {
    const f = meta.fields.format as PrintDisplayFormat | undefined;
    return f ? PRINT_DISPLAY_FORMAT_LABEL[f] ?? f : "—";
  }
  if (meta.kind === "PRINT_INSERT") {
    return meta.fields.size || "Insert";
  }
  if (meta.kind === "DIGITAL_DISPLAY") {
    return meta.fields.placement || "Banner";
  }
  return "—";
}

/** Derive a "Size" / spec display for the table. */
function metaSizeLabel(meta: InventoryMeta | null): string {
  if (!meta) return "";
  if (meta.kind === "PRINT_DISPLAY") {
    const cols = meta.fields.columns;
    const h = meta.fields.heightIn;
    if (cols && h) return `${cols} col × ${h} in`;
    if (cols) return `${cols} col`;
    if (h) return `${h} in`;
    return "";
  }
  if (meta.kind === "PRINT_INSERT") {
    return meta.fields.notes ? "" : meta.fields.size ? "" : "";
  }
  if (meta.kind === "DIGITAL_DISPLAY") {
    return meta.fields.size || "";
  }
  return "";
}

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

  /* ── inventory create (typed, backend-agnostic) ──
   *  The API today accepts a flat (name, mediaType, pricingModel, rate,
   *  description) shape. To avoid backend changes we map each inventory
   *  *kind* (PRINT_DISPLAY, PRINT_INSERT, DIGITAL_DISPLAY) onto those
   *  fields and encode structured fields as a tagged prefix in the
   *  description. The table later parses the tag back out. */
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<InventoryKind | null>(null);
  const [cName, setCName] = useState("");
  const [cRateDollars, setCRateDollars] = useState("");
  // Print Display
  const [pdFormat, setPdFormat] = useState<PrintDisplayFormat>("FULL");
  const [pdColumns, setPdColumns] = useState("");
  const [pdHeight, setPdHeight] = useState("");
  // Print Insert
  const [piSize, setPiSize] = useState("");
  const [piRatePerThousand, setPiRatePerThousand] = useState("");
  const [piDistNotes, setPiDistNotes] = useState("");
  // Digital Display
  const [ddPlacement, setDdPlacement] = useState("");
  const [ddSize, setDdSize] = useState<DigitalAdSize>("728x90");
  const [ddCustomSize, setDdCustomSize] = useState("");
  const [ddPricingModel, setDdPricingModel] = useState<"CPM" | "FLAT">("CPM");

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

  function resetCreateForm() {
    setKind(null);
    setCName("");
    setCRateDollars("");
    setPdFormat("FULL");
    setPdColumns("");
    setPdHeight("");
    setPiSize("");
    setPiRatePerThousand("");
    setPiDistNotes("");
    setDdPlacement("");
    setDdSize("728x90");
    setDdCustomSize("");
    setDdPricingModel("CPM");
    setCreateError(null);
  }

  /* ── inventory CRUD handlers ──
   *  Submit derives {mediaType, pricingModel, rateCents, description} from
   *  the currently-selected InventoryKind + its typed inputs. */
  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!id || !kind) return;
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const body: Parameters<typeof api.createInventory>[1] = {
        name: cName.trim(),
        mediaType: "OTHER",
        pricingModel: "FLAT",
      };

      if (kind === "PRINT_DISPLAY") {
        body.mediaType = "PRINT";
        body.pricingModel = "FLAT";
        if (cRateDollars.trim())
          body.rateCents = Math.round(parseFloat(cRateDollars) * 100);
        body.description = encodeInventoryMeta("PRINT_DISPLAY", {
          format: pdFormat,
          columns: pdColumns,
          heightIn: pdHeight,
        });
      } else if (kind === "PRINT_INSERT") {
        body.mediaType = "PRINT";
        body.pricingModel = "CPM"; // per-thousand
        if (piRatePerThousand.trim())
          body.rateCents = Math.round(parseFloat(piRatePerThousand) * 100);
        body.description = encodeInventoryMeta(
          "PRINT_INSERT",
          { size: piSize },
          piDistNotes,
        );
      } else if (kind === "DIGITAL_DISPLAY") {
        body.mediaType = "DIGITAL";
        body.pricingModel = ddPricingModel;
        if (cRateDollars.trim())
          body.rateCents = Math.round(parseFloat(cRateDollars) * 100);
        const resolvedSize =
          ddSize === "CUSTOM" ? ddCustomSize.trim() : ddSize;
        body.description = encodeInventoryMeta("DIGITAL_DISPLAY", {
          placement: ddPlacement,
          size: resolvedSize,
        });
      }

      await api.createInventory(id, body);
      setCreateSuccess(
        `"${cName.trim()}" added as ${INVENTORY_KIND_LABEL[kind]}.`,
      );
      resetCreateForm();
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
          {editId === null && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                resetCreateForm();
                setCreateSuccess(null);
                setAddOpen(true);
              }}
            >
              + Add Inventory
            </button>
          )}
        </div>

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
                  <th>Type</th>
                  <th>Format</th>
                  <th>Size</th>
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
                      <td colSpan={8}>
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
                  ) : (() => {
                    const meta = parseInventoryMeta(item.description);
                    const kindLabel = meta
                      ? INVENTORY_KIND_LABEL[meta.kind]
                      : `${MEDIA_TYPE_LABEL[item.mediaType]} (legacy)`;
                    const kindClass = meta
                      ? `kind-chip kind-${meta.kind.toLowerCase().replace("_", "-")}`
                      : "kind-chip kind-legacy";
                    const formatText = metaFormatLabel(meta);
                    const sizeText = metaSizeLabel(meta);
                    const subText = meta?.notes || null;
                    return (
                    <tr
                      key={item.id}
                      style={item.isActive ? undefined : { opacity: 0.6 }}
                    >
                      <td className="pub-inventory-name-cell">
                        <span className="pub-inventory-name">{item.name}</span>
                        {subText && (
                          <span className="small muted pub-inventory-desc">
                            {subText}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={kindClass}>{kindLabel}</span>
                      </td>
                      <td className="small">
                        {formatText !== "—" ? formatText : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="small mono">
                        {sizeText ? sizeText : <span className="muted">—</span>}
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
                    );
                  })(),
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

      {/* ── Add-inventory drawer (right-side panel with backdrop) ── */}
      {addOpen && (
        <div
          className="inv-drawer-wrap"
          role="dialog"
          aria-label="Add inventory"
          aria-modal="true"
        >
          <div
            className="inv-drawer-backdrop"
            onClick={() => {
              if (!creating) {
                setAddOpen(false);
                setCreateError(null);
              }
            }}
            aria-hidden="true"
          />
          <aside className="inv-drawer">
            <header className="inv-drawer-head">
              <div>
                <span className="pub-section-eyebrow">Add inventory</span>
                <h2 className="inv-drawer-title">
                  {kind
                    ? INVENTORY_KIND_LABEL[kind]
                    : "Choose an inventory type"}
                </h2>
                {kind && (
                  <p className="inv-drawer-sub">
                    {INVENTORY_KIND_SUB[kind]}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAddOpen(false);
                  setCreateError(null);
                }}
                disabled={creating}
                aria-label="Close"
              >
                Close
              </button>
            </header>

            {kind === null && (
              <div className="inv-kind-picker">
                {(
                  [
                    "PRINT_DISPLAY",
                    "PRINT_INSERT",
                    "DIGITAL_DISPLAY",
                  ] as const
                ).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`inv-kind-card inv-kind-${k.toLowerCase().replace("_", "-")}`}
                    onClick={() => setKind(k)}
                  >
                    <span className="inv-kind-card-title">
                      {INVENTORY_KIND_LABEL[k]}
                    </span>
                    <span className="inv-kind-card-sub">
                      {INVENTORY_KIND_SUB[k]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {kind !== null && (
              <form onSubmit={onCreate} className="inv-drawer-form">
                <button
                  type="button"
                  className="inv-drawer-back"
                  onClick={() => setKind(null)}
                  disabled={creating}
                >
                  ← Change inventory type
                </button>

                <label className="field">
                  <span>Unit name</span>
                  <input
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    required
                    maxLength={255}
                    placeholder={
                      kind === "PRINT_DISPLAY"
                        ? "e.g. Full Page — Sunday Edition"
                        : kind === "PRINT_INSERT"
                          ? "e.g. 8.5×11 Glossy Insert"
                          : "e.g. Homepage Leaderboard"
                    }
                    autoFocus
                  />
                </label>

                {/* ── Print Display fields ── */}
                {kind === "PRINT_DISPLAY" && (
                  <>
                    <label className="field">
                      <span>Format</span>
                      <select
                        value={pdFormat}
                        onChange={(e) =>
                          setPdFormat(e.target.value as PrintDisplayFormat)
                        }
                      >
                        {(
                          ["FULL", "HALF", "QUARTER", "CUSTOM"] as const
                        ).map((f) => (
                          <option key={f} value={f}>
                            {PRINT_DISPLAY_FORMAT_LABEL[f]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="inv-drawer-row">
                      <label className="field">
                        <span>Columns</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={pdColumns}
                          onChange={(e) => setPdColumns(e.target.value)}
                          placeholder="5"
                        />
                      </label>
                      <label className="field">
                        <span>Height (inches)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={pdHeight}
                          onChange={(e) => setPdHeight(e.target.value)}
                          placeholder="10.5"
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Rate (USD, flat — optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cRateDollars}
                        onChange={(e) => setCRateDollars(e.target.value)}
                        placeholder="1500.00"
                      />
                    </label>
                  </>
                )}

                {/* ── Print Insert fields ── */}
                {kind === "PRINT_INSERT" && (
                  <>
                    <label className="field">
                      <span>Size</span>
                      <input
                        value={piSize}
                        onChange={(e) => setPiSize(e.target.value)}
                        placeholder='e.g. 8.5" × 11"'
                      />
                    </label>
                    <label className="field">
                      <span>Rate per thousand (CPM, USD)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={piRatePerThousand}
                        onChange={(e) =>
                          setPiRatePerThousand(e.target.value)
                        }
                        placeholder="45.00"
                      />
                      <span className="field-hint">
                        Used for cost = (distribution ÷ 1000) × rate.
                      </span>
                    </label>
                    <label className="field">
                      <span>Distribution notes</span>
                      <textarea
                        value={piDistNotes}
                        onChange={(e) => setPiDistNotes(e.target.value)}
                        rows={3}
                        placeholder="e.g. Delivered Sundays; max weight 3 oz; full run zones A+B."
                      />
                    </label>
                  </>
                )}

                {/* ── Digital Display fields ── */}
                {kind === "DIGITAL_DISPLAY" && (
                  <>
                    <label className="field">
                      <span>Placement</span>
                      <input
                        value={ddPlacement}
                        onChange={(e) => setDdPlacement(e.target.value)}
                        placeholder="e.g. Homepage top · ROS · Article sidebar"
                      />
                    </label>
                    <label className="field">
                      <span>Ad unit size</span>
                      <select
                        value={ddSize}
                        onChange={(e) =>
                          setDdSize(e.target.value as DigitalAdSize)
                        }
                      >
                        {(
                          [
                            "728x90",
                            "300x250",
                            "300x600",
                            "320x50",
                            "160x600",
                            "CUSTOM",
                          ] as const
                        ).map((s) => (
                          <option key={s} value={s}>
                            {DIGITAL_AD_SIZE_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {ddSize === "CUSTOM" && (
                      <label className="field">
                        <span>Custom size (WxH)</span>
                        <input
                          value={ddCustomSize}
                          onChange={(e) => setDdCustomSize(e.target.value)}
                          placeholder="e.g. 970x250"
                        />
                      </label>
                    )}
                    <div className="inv-drawer-row">
                      <label className="field">
                        <span>Pricing model</span>
                        <select
                          value={ddPricingModel}
                          onChange={(e) =>
                            setDdPricingModel(
                              e.target.value as "CPM" | "FLAT",
                            )
                          }
                        >
                          <option value="CPM">CPM (per 1,000)</option>
                          <option value="FLAT">Flat rate</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>
                          Rate (USD, {ddPricingModel === "CPM" ? "CPM" : "flat"})
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cRateDollars}
                          onChange={(e) => setCRateDollars(e.target.value)}
                          placeholder={
                            ddPricingModel === "CPM" ? "8.50" : "500.00"
                          }
                        />
                      </label>
                    </div>
                  </>
                )}

                {createError && (
                  <p className="error" role="alert">
                    {createError}
                  </p>
                )}

                <footer className="inv-drawer-footer">
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
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={creating}
                  >
                    {creating
                      ? "Adding…"
                      : `Add ${INVENTORY_KIND_LABEL[kind]}`}
                  </button>
                </footer>
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

import { type FormEvent, useState } from "react";
import type { PublisherInput } from "../types";

/**
 * Shared publisher form used for both create (/publishers/new) and edit
 * (inline on /publishers/:id). The form is a pure controlled component —
 * parents decide what to do with the submitted values (create vs patch-diff).
 *
 * Categories mirror the publisher data model:
 *   Identity / Location / Contacts / Website · reference links / Emails / Other.
 * Website and email fields are intentionally kept in separate sections so
 * they're never conflated in the UI or by operators filling out the form.
 */

interface Props {
  initial: PublisherInput;
  submitLabel: string;
  onSubmit: (values: PublisherInput) => void | Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}

export function PublisherForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
  error,
}: Props) {
  const [values, setValues] = useState<PublisherInput>(() => ({ ...initial }));

  const set =
    <K extends keyof PublisherInput>(key: K) =>
    (value: PublisherInput[K]) =>
      setValues((prev) => ({ ...prev, [key]: value }));

  function intFieldProps(key: "circulation" | "yearEstablished") {
    return {
      type: "number",
      value: values[key] == null ? "" : String(values[key]),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValues((prev) => ({
          ...prev,
          [key]: e.target.value === "" ? null : parseInt(e.target.value, 10),
        })),
    };
  }

  function strFieldProps(key: keyof PublisherInput) {
    return {
      value: (values[key] as string | null | undefined) ?? "",
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => set(key)(e.target.value as never),
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      {/* ── Identity ── */}
      <fieldset className="pub-fieldset">
        <legend>Identity</legend>
        <label className="field">
          <span>Publication name</span>
          <input
            {...strFieldProps("name")}
            required
            maxLength={255}
            placeholder="e.g. Boston Globe"
            autoFocus
          />
        </label>
        <div className="two-col">
          <label className="field">
            <span>Parent company</span>
            <input
              {...strFieldProps("parentCompany")}
              maxLength={255}
              placeholder="e.g. Boston Globe Media"
            />
          </label>
          <label className="field">
            <span>Publication type</span>
            <input
              {...strFieldProps("publicationType")}
              maxLength={100}
              placeholder="Broadsheet / Tabloid / Magazine / Digital"
            />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>Frequency</span>
            <input
              {...strFieldProps("frequency")}
              maxLength={100}
              placeholder="Daily / Weekly / Monthly"
            />
          </label>
          <label className="field">
            <span>Circulation</span>
            <input {...intFieldProps("circulation")} min={0} />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>Year established</span>
            <input
              {...intFieldProps("yearEstablished")}
              min={1500}
              max={2100}
              placeholder="e.g. 1872"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={values.isActive === false ? "false" : "true"}
              onChange={(e) => set("isActive")(e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>
      </fieldset>

      {/* ── Location ── */}
      <fieldset className="pub-fieldset">
        <legend>Location</legend>
        <div className="two-col">
          <label className="field">
            <span>Street address 1</span>
            <input
              {...strFieldProps("streetAddress")}
              maxLength={255}
              placeholder="123 Main St"
            />
          </label>
          <label className="field">
            <span>Street address 2</span>
            <input
              {...strFieldProps("streetAddress2")}
              maxLength={255}
              placeholder="Suite 400"
            />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>City</span>
            <input {...strFieldProps("city")} maxLength={100} />
          </label>
          <label className="field">
            <span>State / Region</span>
            <input {...strFieldProps("state")} maxLength={100} />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>ZIP / Postal code</span>
            <input {...strFieldProps("zipCode")} maxLength={20} />
          </label>
          <label className="field">
            <span>County</span>
            <input {...strFieldProps("county")} maxLength={100} />
          </label>
        </div>
        <label className="field">
          <span>Country</span>
          <input
            {...strFieldProps("country")}
            maxLength={100}
            placeholder="USA"
          />
        </label>
      </fieldset>

      {/* ── Contacts ── */}
      <fieldset className="pub-fieldset">
        <legend>Contacts</legend>
        <div className="two-col">
          <label className="field">
            <span>Main phone</span>
            <input
              {...strFieldProps("phone")}
              type="tel"
              maxLength={50}
              placeholder="617-555-1000"
            />
          </label>
          <label className="field">
            <span>Office hours</span>
            <input
              {...strFieldProps("officeHours")}
              maxLength={255}
              placeholder="Mon–Fri 9am–5pm"
            />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>Contact name</span>
            <input
              {...strFieldProps("contactName")}
              maxLength={255}
              placeholder="Primary contact"
            />
          </label>
          <label className="field">
            <span>Contact title</span>
            <input
              {...strFieldProps("contactTitle")}
              maxLength={255}
              placeholder="e.g. Advertising Director"
            />
          </label>
        </div>
      </fieldset>

      {/* ── Website / reference links (URLs ONLY — no emails) ── */}
      <fieldset className="pub-fieldset">
        <legend>Website &amp; reference links</legend>
        <div className="two-col">
          <label className="field">
            <span>Website URL</span>
            <input
              {...strFieldProps("websiteUrl")}
              type="url"
              placeholder="https://www.publisher.com"
            />
          </label>
          <label className="field">
            <span>Logo URL</span>
            <input
              {...strFieldProps("logoUrl")}
              type="url"
              placeholder="https://…/logo.png"
            />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>Rate card URL</span>
            <input
              {...strFieldProps("rateCardUrl")}
              type="url"
              placeholder="https://…/rate-card.pdf"
            />
          </label>
          <label className="field">
            <span>Media kit URL</span>
            <input
              {...strFieldProps("mediaKitUrl")}
              type="url"
              placeholder="https://…/media-kit.pdf"
            />
          </label>
        </div>
        <label className="field">
          <span>Ad specs URL</span>
          <input
            {...strFieldProps("adSpecsUrl")}
            type="url"
            placeholder="https://…/ad-specs.pdf"
          />
        </label>
      </fieldset>

      {/* ── Emails (email addresses ONLY — no URLs) ── */}
      <fieldset className="pub-fieldset">
        <legend>Emails</legend>
        <label className="field">
          <span>General email</span>
          <input
            {...strFieldProps("generalEmail")}
            type="email"
            placeholder="info@publisher.com"
          />
        </label>
        <div className="two-col">
          <label className="field">
            <span>Advertising email</span>
            <input
              {...strFieldProps("advertisingEmail")}
              type="email"
              placeholder="ads@publisher.com"
            />
          </label>
          <label className="field">
            <span>Editorial email</span>
            <input
              {...strFieldProps("editorialEmail")}
              type="email"
              placeholder="editor@publisher.com"
            />
          </label>
        </div>
        <div className="two-col">
          <label className="field">
            <span>Billing email</span>
            <input
              {...strFieldProps("billingEmail")}
              type="email"
              placeholder="billing@publisher.com"
            />
          </label>
          <label className="field">
            <span>Transaction email</span>
            <input
              {...strFieldProps("transactionEmail")}
              type="email"
              placeholder="transactions@publisher.com"
            />
          </label>
        </div>
        <label className="field">
          <span>Corporate email</span>
          <input
            {...strFieldProps("corporateEmail")}
            type="email"
            placeholder="corporate@publisher.com"
          />
        </label>
      </fieldset>

      {/* ── Other ── */}
      <fieldset className="pub-fieldset">
        <legend>Other</legend>
        <label className="field">
          <span>Notes</span>
          <textarea
            {...strFieldProps("notes")}
            maxLength={2000}
            rows={3}
            placeholder="Internal notes, special instructions, relationships…"
          />
        </label>
      </fieldset>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

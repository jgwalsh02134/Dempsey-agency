-- Publisher database expansion: add full address/contact/meta fields.
-- Existing `contactEmail` is renamed to `generalEmail` to preserve data.

ALTER TABLE "Publisher" RENAME COLUMN "contactEmail" TO "generalEmail";

ALTER TABLE "Publisher"
  ADD COLUMN "streetAddress"    TEXT,
  ADD COLUMN "zipCode"          TEXT,
  ADD COLUMN "county"           TEXT,
  ADD COLUMN "country"          TEXT,
  ADD COLUMN "phone"            TEXT,
  ADD COLUMN "frequency"        TEXT,
  ADD COLUMN "yearEstablished"  INTEGER,
  ADD COLUMN "officeHours"      TEXT,
  ADD COLUMN "transactionEmail" TEXT,
  ADD COLUMN "corporateEmail"   TEXT,
  ADD COLUMN "contactName"      TEXT,
  ADD COLUMN "parentCompany"    TEXT,
  ADD COLUMN "notes"            TEXT;

CREATE INDEX "Publisher_name_idx" ON "Publisher"("name");
CREATE INDEX "Publisher_state_city_idx" ON "Publisher"("state", "city");

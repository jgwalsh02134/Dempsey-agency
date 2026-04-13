-- Publisher: expanded categorized field set for the publisher database.
-- Rename `format` → `publicationType` to match product vocabulary, and add
-- eight new optional fields across Location, Contacts, Reference links, and
-- Emails categories. All changes are data-preserving.

ALTER TABLE "Publisher" RENAME COLUMN "format" TO "publicationType";

ALTER TABLE "Publisher"
  ADD COLUMN "streetAddress2"   TEXT,
  ADD COLUMN "contactTitle"     TEXT,
  ADD COLUMN "rateCardUrl"      TEXT,
  ADD COLUMN "mediaKitUrl"      TEXT,
  ADD COLUMN "adSpecsUrl"       TEXT,
  ADD COLUMN "editorialEmail"   TEXT,
  ADD COLUMN "advertisingEmail" TEXT,
  ADD COLUMN "billingEmail"     TEXT;

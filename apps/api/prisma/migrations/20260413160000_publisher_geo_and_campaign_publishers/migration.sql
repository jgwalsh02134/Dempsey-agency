-- Publisher: persistent geocoding fields for the campaign-scoped map.
ALTER TABLE "Publisher"
  ADD COLUMN "latitude"      DOUBLE PRECISION,
  ADD COLUMN "longitude"     DOUBLE PRECISION,
  ADD COLUMN "geocodeStatus" TEXT,
  ADD COLUMN "geocodedAt"    TIMESTAMP(3);

-- CampaignPublisher: many-to-many join between campaigns and publishers.
CREATE TABLE "CampaignPublisher" (
  "id"          TEXT NOT NULL,
  "campaignId"  TEXT NOT NULL,
  "publisherId" TEXT NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignPublisher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignPublisher_campaignId_publisherId_key"
  ON "CampaignPublisher"("campaignId", "publisherId");

CREATE INDEX "CampaignPublisher_campaignId_idx"  ON "CampaignPublisher"("campaignId");
CREATE INDEX "CampaignPublisher_publisherId_idx" ON "CampaignPublisher"("publisherId");

ALTER TABLE "CampaignPublisher"
  ADD CONSTRAINT "CampaignPublisher_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignPublisher"
  ADD CONSTRAINT "CampaignPublisher_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

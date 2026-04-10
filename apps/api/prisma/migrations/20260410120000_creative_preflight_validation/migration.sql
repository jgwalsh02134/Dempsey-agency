-- CreativeType: add MASTER_ASSET
ALTER TYPE "CreativeType" ADD VALUE 'MASTER_ASSET';

-- SubmissionStatus: replace enum values with data migration
-- Step 1: Create new enum
CREATE TYPE "SubmissionStatus_new" AS ENUM (
  'UPLOADED',
  'VALIDATION_FAILED',
  'UNDER_REVIEW',
  'NEEDS_RESIZING',
  'READY_FOR_PUBLISHER',
  'PUSHED'
);

-- Step 2: Drop default, convert column with value mapping
ALTER TABLE "CreativeSubmission" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "CreativeSubmission"
  ALTER COLUMN "status" TYPE "SubmissionStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SUBMITTED' THEN 'UPLOADED'
      WHEN 'APPROVED' THEN 'READY_FOR_PUBLISHER'
      WHEN 'REVISION_REQUESTED' THEN 'NEEDS_RESIZING'
    END
  )::"SubmissionStatus_new";

-- Step 3: Restore default with new value
ALTER TABLE "CreativeSubmission"
  ALTER COLUMN "status" SET DEFAULT 'UPLOADED'::"SubmissionStatus_new";

-- Step 4: Drop old enum, rename new
DROP TYPE "SubmissionStatus";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";

-- New nullable columns
ALTER TABLE "CreativeSubmission" ADD COLUMN "placementId" TEXT;
ALTER TABLE "CreativeSubmission" ADD COLUMN "widthPx" INTEGER;
ALTER TABLE "CreativeSubmission" ADD COLUMN "heightPx" INTEGER;
ALTER TABLE "CreativeSubmission" ADD COLUMN "dpi" INTEGER;
ALTER TABLE "CreativeSubmission" ADD COLUMN "colorSpace" TEXT;
ALTER TABLE "CreativeSubmission" ADD COLUMN "validationSummary" JSONB;

-- Foreign key for optional placement link
ALTER TABLE "CreativeSubmission"
  ADD CONSTRAINT "CreativeSubmission_placementId_fkey"
  FOREIGN KEY ("placementId") REFERENCES "Placement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

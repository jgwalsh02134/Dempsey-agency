-- CreateEnum
CREATE TYPE "CreativeType" AS ENUM ('PRINT', 'DIGITAL');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateTable
CREATE TABLE "CreativeSubmission" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "creativeType" "CreativeType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreativeSubmission_campaignId_status_idx" ON "CreativeSubmission"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CreativeSubmission_organizationId_idx" ON "CreativeSubmission"("organizationId");

-- AddForeignKey
ALTER TABLE "CreativeSubmission" ADD CONSTRAINT "CreativeSubmission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeSubmission" ADD CONSTRAINT "CreativeSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeSubmission" ADD CONSTRAINT "CreativeSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

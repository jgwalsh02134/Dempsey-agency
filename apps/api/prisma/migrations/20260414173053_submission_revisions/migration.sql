-- AlterTable
ALTER TABLE "CreativeSubmission" ADD COLUMN     "parentSubmissionId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "CreativeSubmission_parentSubmissionId_idx" ON "CreativeSubmission"("parentSubmissionId");

-- AddForeignKey
ALTER TABLE "CreativeSubmission" ADD CONSTRAINT "CreativeSubmission_parentSubmissionId_fkey" FOREIGN KEY ("parentSubmissionId") REFERENCES "CreativeSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

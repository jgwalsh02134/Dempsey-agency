-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PROOF', 'INVOICE', 'INSERTION_ORDER', 'CONTRACT', 'CREATIVE_ASSET', 'OTHER');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "Document_organizationId_category_idx" ON "Document"("organizationId", "category");

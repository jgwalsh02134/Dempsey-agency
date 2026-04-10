-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PRINT', 'DIGITAL', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('DRAFT', 'BOOKED', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('CPM', 'VCPM', 'CPC', 'CPCV', 'FLAT', 'COLUMN_INCH', 'PER_LINE', 'OTHER');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "budgetCents" INTEGER;

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "circulation" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'FLAT',
    "rateCents" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'DRAFT',
    "grossCostCents" INTEGER NOT NULL,
    "netCostCents" INTEGER,
    "quantity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventory_publisherId_idx" ON "Inventory"("publisherId");

-- CreateIndex
CREATE INDEX "Placement_campaignId_idx" ON "Placement"("campaignId");

-- CreateIndex
CREATE INDEX "Placement_inventoryId_idx" ON "Placement"("inventoryId");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

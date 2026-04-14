-- CreateEnum
CREATE TYPE "PlacementClientResponse" AS ENUM ('PENDING_CLIENT_REVIEW', 'CLIENT_APPROVED');

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "clientRespondedAt" TIMESTAMP(3),
ADD COLUMN     "clientResponse" "PlacementClientResponse" NOT NULL DEFAULT 'PENDING_CLIENT_REVIEW',
ADD COLUMN     "clientResponseNote" TEXT;

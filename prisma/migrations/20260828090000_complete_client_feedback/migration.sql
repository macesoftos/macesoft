-- Complete the remaining operational items from the August 2026 clinic feedback review.
ALTER TABLE "Client"
  ADD COLUMN "storeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "serviceCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "pastMedicalHistory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "aestheticHistory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "familyHistory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "surgicalHistory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "obstetricHistory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "medications" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Service"
  ADD COLUMN "recommendedIntervalValue" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recommendedIntervalUnit" TEXT NOT NULL DEFAULT 'Days',
  ADD COLUMN "maintenanceIntervalValue" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maintenanceIntervalUnit" TEXT NOT NULL DEFAULT 'Days';

UPDATE "Service"
SET "recommendedIntervalValue" = "recommendedIntervalDays",
    "recommendedIntervalUnit" = 'Days';

ALTER TABLE "InventoryItem"
  ADD COLUMN "directions" TEXT NOT NULL DEFAULT '';

ALTER TABLE "InventoryMovement"
  ADD COLUMN "expiry" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "batch" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Sale"
  ADD COLUMN "room" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "arrivalTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "checkoutTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "imported" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Treatment"
  ADD COLUMN "sourceSaleId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sourceSaleItemId" TEXT;

CREATE UNIQUE INDEX "Treatment_sourceSaleItemId_key" ON "Treatment"("sourceSaleItemId");
CREATE INDEX "Treatment_sourceSaleId_idx" ON "Treatment"("sourceSaleId");

ALTER TABLE "GiftCertificate"
  ADD COLUMN "issueType" TEXT NOT NULL DEFAULT 'Client Gift',
  ADD COLUMN "company" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "event" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PosCart"
  ADD COLUMN "room" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "arrivalTime" TEXT NOT NULL DEFAULT '';

-- Clinic packages are redeemable at either branch and do not expire.
UPDATE "ClinicPackage"
SET "branch" = 'All branches', "transferable" = true, "expires" = '';

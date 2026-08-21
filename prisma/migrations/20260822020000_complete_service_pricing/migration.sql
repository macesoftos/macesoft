-- Complete the service pricing and package-purchase workflow.
ALTER TABLE "SaleItem"
  ADD COLUMN "priceModel" TEXT NOT NULL DEFAULT 'Fixed price',
  ADD COLUMN "priceUnit" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ClinicPackage"
  ADD COLUMN "sourceSaleId" TEXT NOT NULL DEFAULT '';

UPDATE "Service" SET "priceUnit" = 'Per ampoule' WHERE LOWER("priceUnit") = 'per ampule';

CREATE INDEX "ClinicPackage_sourceSaleId_idx" ON "ClinicPackage"("sourceSaleId");

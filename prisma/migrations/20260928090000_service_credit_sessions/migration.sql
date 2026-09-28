ALTER TABLE "ClinicPackage"
ADD COLUMN "creditType" TEXT NOT NULL DEFAULT 'Package';

CREATE INDEX "ClinicPackage_creditType_idx" ON "ClinicPackage"("creditType");

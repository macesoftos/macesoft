-- Core data changes requested in the August 2026 clinic workflow review.
ALTER TABLE "Client"
  ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "middleName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "street" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "barangay" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "province" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "civilStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "occupation" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emergencyName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emergencyPhone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "branchesVisited" TEXT NOT NULL DEFAULT '[]';

UPDATE "Client"
SET "branchesVisited" = CASE
  WHEN COALESCE("branch", '') = '' THEN '[]'
  ELSE jsonb_build_array("branch")::text
END;

ALTER TABLE "Branch"
  ADD COLUMN "couches" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StaffMember"
  ADD COLUMN "branches" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "scheduleBranches" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "employmentStatus" TEXT NOT NULL DEFAULT 'Regular',
  ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emergencyContact" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emergencyPhone" TEXT NOT NULL DEFAULT '';

UPDATE "StaffMember"
SET "branches" = CASE
  WHEN COALESCE("branch", '') = '' THEN '[]'
  ELSE jsonb_build_array("branch")::text
END;

UPDATE "StaffMember" SET "role" = 'Aesthetician' WHERE "role" = 'Nurse / Aesthetician';
UPDATE "Account" SET "role" = 'Aesthetician' WHERE "role" = 'Nurse / Aesthetician';
UPDATE "BranchMembership" SET "role" = 'Aesthetician' WHERE "role" = 'Nurse / Aesthetician';
UPDATE "UserInvitation" SET "role" = 'Aesthetician' WHERE "role" = 'Nurse / Aesthetician';

ALTER TABLE "Service"
  ADD COLUMN "serviceType" TEXT NOT NULL DEFAULT 'Regular Service',
  ADD COLUMN "priceModel" TEXT NOT NULL DEFAULT 'Fixed price',
  ADD COLUMN "priceUnit" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "packageSessions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "packagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "serviceValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "recommendedIntervalDays" INTEGER NOT NULL DEFAULT 0;

UPDATE "Service"
SET
  "serviceType" = CASE WHEN LOWER("category") = 'packages' THEN 'Package' ELSE 'Regular Service' END,
  "packagePrice" = CASE WHEN LOWER("category") = 'packages' THEN "price" ELSE 0 END,
  "staff" = REPLACE("staff", '"Nurse / Aesthetician"', '"Nurse","Aesthetician"'),
  "consumables" = '[]';

ALTER TABLE "InventoryMovement"
  ADD COLUMN "supplier" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "receivedBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "checkNumber" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Treatment"
  ADD COLUMN "aftercare" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Sale"
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "testMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleItem"
  ADD COLUMN "originalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'N/A',
  ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "aftercare" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "recommendedIntervalDays" INTEGER NOT NULL DEFAULT 0;

UPDATE "SaleItem" SET "originalPrice" = "price";

ALTER TABLE "ClinicPackage"
  ADD COLUMN "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "nextPayment" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "purchaseDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "serviceValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "paymentHistory" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "sessionHistory" TEXT NOT NULL DEFAULT '[]';

UPDATE "ClinicPackage"
SET
  "serviceValue" = CASE WHEN "sessions" > 0 THEN "price" / "sessions" ELSE 0 END,
  "purchaseDate" = TO_CHAR("createdAt", 'YYYY-MM-DD');

ALTER TABLE "GiftCertificate"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Monetary Value',
  ADD COLUMN "serviceId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "service" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "issueDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "redeemedDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "redeemedBranch" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "transactionId" TEXT NOT NULL DEFAULT '';

UPDATE "GiftCertificate"
SET "issueDate" = TO_CHAR("createdAt", 'YYYY-MM-DD');

CREATE TABLE "PosCart" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL DEFAULT '',
  "client" TEXT NOT NULL DEFAULT 'Walk-in',
  "branch" TEXT NOT NULL,
  "staff" TEXT NOT NULL DEFAULT '',
  "items" TEXT NOT NULL DEFAULT '[]',
  "discountId" TEXT NOT NULL DEFAULT '',
  "saleDate" TEXT NOT NULL DEFAULT '',
  "testMode" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PosCart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosCart_branch_updatedAt_idx" ON "PosCart"("branch", "updatedAt");
CREATE INDEX "PosCart_clientId_branch_idx" ON "PosCart"("clientId", "branch");
CREATE INDEX "PosCart_createdById_idx" ON "PosCart"("createdById");

ALTER TABLE "PosCart" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "PosCart" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

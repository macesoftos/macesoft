-- Introduce normalized organization, branch membership, and per-branch module
-- records without discarding the legacy branch-name columns used by existing
-- application integrations. Existing operational rows are assigned to the
-- current/default branch before relational constraints are installed.

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

INSERT INTO "Organization" ("id", "name", "slug")
VALUES ('org-mace', 'MACE by Dr. Mace', 'mace-by-dr-mace');

ALTER TABLE "Branch"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "email" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  ADD COLUMN "operatingHours" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Branch"
SET
  "organizationId" = 'org-mace',
  "code" = 'BR-' || UPPER(SUBSTRING(md5("id") FROM 1 FOR 8));

INSERT INTO "Branch" (
  "id", "organizationId", "name", "code", "city", "address", "phone",
  "email", "timezone", "hours", "operatingHours", "status", "staff",
  "devices", "image", "createdAt", "updatedAt"
)
SELECT
  'branch-default-mace', 'org-mace', 'Mace Davao', 'MACE-DAVAO', 'Davao',
  '', '', '', 'Asia/Manila', '', '{}', 'Active', 0, '[]', '',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Branch");

UPDATE "Branch"
SET "organizationId" = 'org-mace'
WHERE "organizationId" IS NULL;

UPDATE "Branch"
SET "code" = 'BR-' || UPPER(SUBSTRING(md5("id") FROM 1 FOR 8))
WHERE COALESCE("code", '') = '';

ALTER TABLE "Branch"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Branch_organizationId_code_key" ON "Branch"("organizationId", "code");
CREATE INDEX "Branch_organizationId_status_idx" ON "Branch"("organizationId", "status");
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- All rooms must belong to a durable branch. Branch archival replaces branch
-- deletion, so historical room relationships are restricted rather than cascaded.
UPDATE "Room"
SET "branchId" = (SELECT "id" FROM "Branch" ORDER BY "createdAt", "id" LIMIT 1)
WHERE "branchId" IS NULL;

ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_branchId_fkey";
ALTER TABLE "Room" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Account"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "organizationWideAccess" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "organizationPermissions" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "lastBranchId" TEXT;

UPDATE "Account" SET "organizationId" = 'org-mace';
UPDATE "Account" a
SET "lastBranchId" = COALESCE(
  (SELECT b."id" FROM "Branch" b WHERE b."name" = a."branch" LIMIT 1),
  (SELECT b."id" FROM "Branch" b ORDER BY b."createdAt", b."id" LIMIT 1)
)
WHERE a."role" NOT IN ('Owner', 'Business Owner', 'Super Admin');

UPDATE "Account" a
SET "branch" = b."name"
FROM "Branch" b
WHERE a."lastBranchId" = b."id"
  AND a."role" NOT IN ('Owner', 'Business Owner', 'Super Admin');

ALTER TABLE "Account" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Account_organizationId_status_idx" ON "Account"("organizationId", "status");
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BranchMembership" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'Active',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchMembership_branchId_accountId_key" ON "BranchMembership"("branchId", "accountId");
CREATE INDEX "BranchMembership_accountId_status_idx" ON "BranchMembership"("accountId", "status");
CREATE INDEX "BranchMembership_branchId_role_status_idx" ON "BranchMembership"("branchId", "role", "status");
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchMembership" ADD CONSTRAINT "BranchMembership_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BranchMembership" ("id", "branchId", "accountId", "role", "isPrimary")
SELECT
  'bm-' || md5(a."id" || b."id"), b."id", a."id", a."role", true
FROM "Account" a
JOIN "Branch" b ON b."id" = a."lastBranchId"
WHERE a."role" NOT IN ('Owner', 'Business Owner', 'Super Admin')
ON CONFLICT ("branchId", "accountId") DO NOTHING;

CREATE TABLE "BranchModule" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchModule_branchId_moduleId_key" ON "BranchModule"("branchId", "moduleId");
CREATE INDEX "BranchModule_branchId_enabled_idx" ON "BranchModule"("branchId", "enabled");
ALTER TABLE "BranchModule" ADD CONSTRAINT "BranchModule_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BranchModule" ("id", "branchId", "moduleId", "enabled")
SELECT
  'bmod-' || md5(b."id" || m."moduleId"), b."id", m."moduleId", true
FROM "Branch" b
CROSS JOIN (VALUES
  ('overview'), ('appointments'), ('clients'), ('leads'), ('pos'),
  ('card-view'), ('room-view'), ('treatments'), ('services'), ('packages'),
  ('booking'), ('staff-view'), ('staff'), ('facetrack-attendance'),
  ('inventory'), ('expenses'), ('reports'), ('sms'), ('flipbooks'), ('support')
) AS m("moduleId")
ON CONFLICT ("branchId", "moduleId") DO NOTHING;

-- Treatments previously inherited branch ownership from their client. Store a
-- historical snapshot now so later client or employee transfers cannot rewrite it.
ALTER TABLE "Treatment" ADD COLUMN "branch" TEXT NOT NULL DEFAULT '';
UPDATE "Treatment" t
SET "branch" = COALESCE(
  NULLIF(c."branch", ''),
  (SELECT b."name" FROM "Branch" b ORDER BY b."createdAt", b."id" LIMIT 1)
)
FROM "Client" c
WHERE c."id" = t."clientId";
UPDATE "Treatment"
SET "branch" = (SELECT b."name" FROM "Branch" b ORDER BY b."createdAt", b."id" LIMIT 1)
WHERE "branch" = '';
CREATE INDEX "Treatment_branch_idx" ON "Treatment"("branch");

-- Backfill required operational branch names. Organization-wide catalog and
-- marketing records intentionally retain their existing "All branches" scope.
DO $$
DECLARE
  default_branch TEXT;
BEGIN
  SELECT "name" INTO default_branch FROM "Branch" ORDER BY "createdAt", "id" LIMIT 1;

  UPDATE "Client" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Client"."branch");
  UPDATE "StaffMember" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "StaffMember"."branch");
  UPDATE "AttendanceEvent" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "AttendanceEvent"."branch");
  UPDATE "FaceTrackAttendanceRecord" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "FaceTrackAttendanceRecord"."branch");
  UPDATE "FaceTrackKioskDevice" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "FaceTrackKioskDevice"."branch");
  UPDATE "Appointment" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Appointment"."branch");
  UPDATE "Treatment" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Treatment"."branch");
  UPDATE "InventoryItem" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR "branch" = 'All branches' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "InventoryItem"."branch");
  UPDATE "InventoryMovement" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR "branch" = 'All branches' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "InventoryMovement"."branch");
  UPDATE "Sale" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Sale"."branch");
  UPDATE "Lead" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Lead"."branch");
  UPDATE "Expense" SET "branch" = default_branch
    WHERE COALESCE("branch", '') = '' OR NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."name" = "Expense"."branch");
END $$;

-- These deferred constraints let the existing atomic branch-rename flow update
-- child snapshots and the Branch name within one transaction.
ALTER TABLE "Client" ADD CONSTRAINT "Client_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "FaceTrackAttendanceRecord" ADD CONSTRAINT "FaceTrackAttendanceRecord_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "FaceTrackKioskDevice" ADD CONSTRAINT "FaceTrackKioskDevice_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branch_fkey" FOREIGN KEY ("branch") REFERENCES "Branch"("name") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "AuditLog"
  ADD COLUMN "actorAccountId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "subjectType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "subjectId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "beforeValues" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN "afterValues" TEXT NOT NULL DEFAULT '{}';

CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId", "createdAt");
CREATE INDEX "AuditLog_actorAccountId_createdAt_idx" ON "AuditLog"("actorAccountId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAccountId_fkey"
  FOREIGN KEY ("actorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep direct PostgREST access denied for every new security-sensitive table.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchModule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "Organization" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "BranchMembership" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "BranchModule" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

-- Extend the existing invitation flow with organization ownership, normalized
-- branch assignments, explicit grants, delivery state, and lifecycle actors.
-- Existing invitations are retained and backfilled from their sender/branch.

ALTER TABLE "BranchMembership"
  ADD COLUMN "modules" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "Account"
  ADD COLUMN "organizationModules" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "UserInvitation"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "position" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "modules" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'Not Sent',
  ADD COLUMN "resentAt" TIMESTAMP(3),
  ADD COLUMN "acceptedById" TEXT,
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

UPDATE "UserInvitation" i
SET "organizationId" = a."organizationId"
FROM "Account" a
WHERE a."id" = i."invitedById";

UPDATE "UserInvitation"
SET
  "email" = LOWER(BTRIM("email")),
  "firstName" = CASE
    WHEN STRPOS(BTRIM("name"), ' ') > 0 THEN SPLIT_PART(BTRIM("name"), ' ', 1)
    ELSE BTRIM("name")
  END,
  "lastName" = CASE
    WHEN STRPOS(BTRIM("name"), ' ') > 0 THEN SUBSTRING(BTRIM("name") FROM STRPOS(BTRIM("name"), ' ') + 1)
    ELSE ''
  END,
  "deliveryStatus" = CASE WHEN "status" = 'Failed' THEN 'Failed' ELSE 'Sent' END,
  "status" = CASE WHEN "status" = 'Failed' THEN 'Pending' ELSE "status" END;

-- A historic retry race may have left more than one usable invitation for the
-- same organization/email. Keep the newest and revoke older records without
-- deleting their audit history.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "organizationId", "email"
    ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
  ) AS row_number
  FROM "UserInvitation"
  WHERE "status" = 'Pending'
)
UPDATE "UserInvitation" i
SET "status" = 'Revoked', "revokedAt" = CURRENT_TIMESTAMP, "tokenHash" = NULL
FROM ranked r
WHERE i."id" = r."id" AND r.row_number > 1;

ALTER TABLE "UserInvitation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "UserInvitation" ALTER COLUMN "tokenHash" DROP NOT NULL;
ALTER TABLE "UserInvitation" ALTER COLUMN "branch" SET DEFAULT '';

DROP INDEX IF EXISTS "UserInvitation_email_status_idx";
CREATE INDEX "UserInvitation_organizationId_email_status_idx"
  ON "UserInvitation"("organizationId", "email", "status");
CREATE UNIQUE INDEX "UserInvitation_pending_email_key"
  ON "UserInvitation"("organizationId", "email") WHERE "status" = 'Pending';

ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_acceptedById_fkey"
  FOREIGN KEY ("acceptedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserInvitationBranch" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserInvitationBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserInvitationBranch_invitationId_branchId_key"
  ON "UserInvitationBranch"("invitationId", "branchId");
CREATE INDEX "UserInvitationBranch_branchId_createdAt_idx"
  ON "UserInvitationBranch"("branchId", "createdAt");
ALTER TABLE "UserInvitationBranch" ADD CONSTRAINT "UserInvitationBranch_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "UserInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitationBranch" ADD CONSTRAINT "UserInvitationBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "UserInvitationBranch" ("id", "invitationId", "branchId")
SELECT 'uib-' || md5(i."id" || b."id"), i."id", b."id"
FROM "UserInvitation" i
JOIN "Branch" b ON b."organizationId" = i."organizationId" AND b."name" = i."branch"
WHERE COALESCE(i."branch", '') <> '' AND i."branch" <> 'All branches'
ON CONFLICT ("invitationId", "branchId") DO NOTHING;

ALTER TABLE "AppNotification"
  ADD COLUMN "recipientAccountIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "UserInvitationBranch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "UserInvitationBranch" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

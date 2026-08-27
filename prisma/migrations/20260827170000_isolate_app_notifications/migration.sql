ALTER TABLE "AppNotification" ADD COLUMN "organizationId" TEXT;

UPDATE "AppNotification" AS notification
SET "organizationId" = account."organizationId"
FROM "Account" AS account
WHERE notification."organizationId" IS NULL
  AND account."id" = ANY(notification."recipientAccountIds");

UPDATE "AppNotification" AS notification
SET "organizationId" = branch."organizationId"
FROM "Branch" AS branch
WHERE notification."organizationId" IS NULL
  AND branch."name" = ANY(notification."branches");

CREATE INDEX "AppNotification_organizationId_createdAt_idx"
ON "AppNotification"("organizationId", "createdAt");

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
ADD COLUMN "organizationId" TEXT;

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AppNotification_organizationId_createdAt_idx"
ON "AppNotification"("organizationId", "createdAt");

-- Existing notifications predate tenant ownership and cannot be attributed safely.
-- They intentionally remain unscoped and are excluded by the application query.

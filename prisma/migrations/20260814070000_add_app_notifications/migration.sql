ALTER TABLE "Account" ADD COLUMN "notificationsReadAt" TIMESTAMP(3);

CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recordId" TEXT NOT NULL DEFAULT '',
    "branches" TEXT[] NOT NULL DEFAULT ARRAY['All branches']::TEXT[],
    "actor" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppNotification_createdAt_idx" ON "AppNotification"("createdAt");
CREATE INDEX "AppNotification_module_createdAt_idx" ON "AppNotification"("module", "createdAt");

ALTER TABLE "AppNotification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_direct_api_access" ON "AppNotification";
CREATE POLICY "deny_direct_api_access" ON "AppNotification" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

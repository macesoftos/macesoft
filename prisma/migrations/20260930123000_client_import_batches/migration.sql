CREATE TABLE "ClientImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "createdClientIds" TEXT NOT NULL DEFAULT '[]',
    "updatedSnapshots" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Completed',
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientImportBatch_organizationId_createdAt_idx" ON "ClientImportBatch"("organizationId", "createdAt");
CREATE INDEX "ClientImportBatch_status_createdAt_idx" ON "ClientImportBatch"("status", "createdAt");

ALTER TABLE "ClientImportBatch" ADD CONSTRAINT "ClientImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientImportBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "ClientImportBatch" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

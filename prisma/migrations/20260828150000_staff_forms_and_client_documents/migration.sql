-- Complete the document-backed client record and employee form workflows.
ALTER TABLE "ConsentFormTemplate" ADD COLUMN "sourceDocumentAssetId" TEXT;

CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Legacy record',
    "notes" TEXT NOT NULL DEFAULT '',
    "branch" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffForm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '',
    "formDate" TEXT NOT NULL,
    "employeeDetails" TEXT NOT NULL,
    "employeeSignature" TEXT NOT NULL,
    "adminDetails" TEXT NOT NULL DEFAULT '',
    "adminSignature" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "createdById" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsentFormTemplate_sourceDocumentAssetId_key" ON "ConsentFormTemplate"("sourceDocumentAssetId");
CREATE UNIQUE INDEX "ClientDocument_assetId_key" ON "ClientDocument"("assetId");
CREATE INDEX "ClientDocument_clientId_createdAt_idx" ON "ClientDocument"("clientId", "createdAt");
CREATE INDEX "ClientDocument_branch_createdAt_idx" ON "ClientDocument"("branch", "createdAt");
CREATE INDEX "StaffForm_staffId_submittedAt_idx" ON "StaffForm"("staffId", "submittedAt");
CREATE INDEX "StaffForm_organizationId_submittedAt_idx" ON "StaffForm"("organizationId", "submittedAt");
CREATE INDEX "StaffForm_branch_status_submittedAt_idx" ON "StaffForm"("branch", "status", "submittedAt");
CREATE INDEX "StaffForm_formType_status_idx" ON "StaffForm"("formType", "status");

ALTER TABLE "ConsentFormTemplate" ADD CONSTRAINT "ConsentFormTemplate_sourceDocumentAssetId_fkey" FOREIGN KEY ("sourceDocumentAssetId") REFERENCES "UploadAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UploadAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffForm" ADD CONSTRAINT "StaffForm_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "ClientDocument" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "StaffForm" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "StaffForm" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

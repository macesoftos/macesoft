ALTER TABLE "Treatment"
  ADD COLUMN "arrivalTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "treatmentStartTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "completedTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "checkoutTime" TEXT NOT NULL DEFAULT '';

CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serviceIds" TEXT NOT NULL DEFAULT '[]',
  "packageNames" TEXT NOT NULL DEFAULT '[]',
  "discountType" TEXT NOT NULL DEFAULT 'Percentage',
  "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "branches" TEXT NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Promotion_startDate_endDate_idx" ON "Promotion"("startDate", "endDate");
CREATE INDEX "Promotion_active_idx" ON "Promotion"("active");

CREATE TABLE "ConsentFormTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "serviceIds" TEXT NOT NULL DEFAULT '[]',
  "content" TEXT NOT NULL DEFAULT '',
  "requiredFields" TEXT NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsentFormTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsentFormTemplate_name_version_key" ON "ConsentFormTemplate"("name", "version");

CREATE TABLE "ClientConsentSubmission" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "formName" TEXT NOT NULL,
  "formVersion" TEXT NOT NULL,
  "service" TEXT NOT NULL DEFAULT '',
  "treatmentId" TEXT NOT NULL DEFAULT '',
  "branch" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "witness" TEXT NOT NULL DEFAULT '',
  "answers" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'Signed',
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientConsentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientConsentSubmission_clientId_signedAt_idx" ON "ClientConsentSubmission"("clientId", "signedAt");
CREATE INDEX "ClientConsentSubmission_templateId_idx" ON "ClientConsentSubmission"("templateId");
CREATE INDEX "ClientConsentSubmission_branch_idx" ON "ClientConsentSubmission"("branch");
ALTER TABLE "ClientConsentSubmission" ADD CONSTRAINT "ClientConsentSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientConsentSubmission" ADD CONSTRAINT "ClientConsentSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "Promotion" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "ConsentFormTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "ConsentFormTemplate" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
ALTER TABLE "ClientConsentSubmission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "ClientConsentSubmission" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

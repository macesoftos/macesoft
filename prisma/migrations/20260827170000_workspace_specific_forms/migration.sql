ALTER TABLE "Client"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "workspaceFormId" TEXT;

ALTER TABLE "Lead"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "workspaceFormId" TEXT;

ALTER TABLE "Appointment"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "workspaceFormId" TEXT;

ALTER TABLE "WorkspaceBranding"
  ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#efe4e5',
  ADD COLUMN "paymentInstructions" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "taxRegistration" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  ADD COLUMN "sendingDomain" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emailSenderStatus" TEXT NOT NULL DEFAULT 'Platform fallback';

ALTER TABLE "LeadAutomation"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Draft',
  ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "LeadAutomation" SET "status" = CASE WHEN "active" THEN 'Active' ELSE 'Draft' END;

CREATE TABLE "WorkspaceForm" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "defaultBranchId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'Website',
  "consentVersion" TEXT NOT NULL DEFAULT 'v1',
  "consentText" TEXT NOT NULL DEFAULT 'I consent to the collection and use of my information so the clinic can respond to my request.',
  "defaultWorkflowId" TEXT NOT NULL DEFAULT '',
  "notificationRecipientIds" TEXT NOT NULL DEFAULT '[]',
  "createdById" TEXT NOT NULL DEFAULT '',
  "updatedById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceFormBranch" (
  "formId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceFormBranch_pkey" PRIMARY KEY ("formId", "branchId")
);

UPDATE "Client" AS record
SET "organizationId" = branch."organizationId", "branchId" = branch."id"
FROM "Branch" AS branch
WHERE record."branch" = branch."name";

UPDATE "Lead" AS record
SET "organizationId" = branch."organizationId", "branchId" = branch."id"
FROM "Branch" AS branch
WHERE record."branch" = branch."name";

UPDATE "Appointment" AS record
SET "organizationId" = branch."organizationId", "branchId" = branch."id"
FROM "Branch" AS branch
WHERE record."branch" = branch."name";

CREATE UNIQUE INDEX "WorkspaceForm_slug_key" ON "WorkspaceForm"("slug");
CREATE UNIQUE INDEX "WorkspaceForm_organizationId_type_key" ON "WorkspaceForm"("organizationId", "type");
CREATE INDEX "WorkspaceForm_organizationId_status_idx" ON "WorkspaceForm"("organizationId", "status");
CREATE INDEX "WorkspaceFormBranch_branchId_idx" ON "WorkspaceFormBranch"("branchId");
CREATE INDEX "Client_organizationId_createdAt_idx" ON "Client"("organizationId", "createdAt");
CREATE INDEX "Client_branchId_createdAt_idx" ON "Client"("branchId", "createdAt");
CREATE INDEX "Client_workspaceFormId_idx" ON "Client"("workspaceFormId");
CREATE INDEX "Lead_organizationId_createdAt_idx" ON "Lead"("organizationId", "createdAt");
CREATE INDEX "Lead_branchId_createdAt_idx" ON "Lead"("branchId", "createdAt");
CREATE INDEX "Lead_workspaceFormId_idx" ON "Lead"("workspaceFormId");
CREATE INDEX "Appointment_organizationId_date_idx" ON "Appointment"("organizationId", "date");
CREATE INDEX "Appointment_branchId_date_idx" ON "Appointment"("branchId", "date");
CREATE INDEX "Appointment_workspaceFormId_idx" ON "Appointment"("workspaceFormId");

ALTER TABLE "WorkspaceForm" ADD CONSTRAINT "WorkspaceForm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceForm" ADD CONSTRAINT "WorkspaceForm_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFormBranch" ADD CONSTRAINT "WorkspaceFormBranch_formId_fkey" FOREIGN KEY ("formId") REFERENCES "WorkspaceForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFormBranch" ADD CONSTRAINT "WorkspaceFormBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceFormId_fkey" FOREIGN KEY ("workspaceFormId") REFERENCES "WorkspaceForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceFormId_fkey" FOREIGN KEY ("workspaceFormId") REFERENCES "WorkspaceForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_workspaceFormId_fkey" FOREIGN KEY ("workspaceFormId") REFERENCES "WorkspaceForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."WorkspaceForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WorkspaceFormBranch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "public"."WorkspaceForm" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "public"."WorkspaceFormBranch" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "status" TEXT NOT NULL DEFAULT 'Succeeded',
  "posSaleId" TEXT NOT NULL DEFAULT '',
  "rawSummary" TEXT NOT NULL DEFAULT '{}',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoicePayment_organizationId_provider_providerReference_key" ON "InvoicePayment"("organizationId", "provider", "providerReference");
CREATE INDEX "InvoicePayment_invoiceId_receivedAt_idx" ON "InvoicePayment"("invoiceId", "receivedAt");
CREATE INDEX "InvoicePayment_organizationId_status_receivedAt_idx" ON "InvoicePayment"("organizationId", "status", "receivedAt");
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."InvoicePayment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "public"."InvoicePayment" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

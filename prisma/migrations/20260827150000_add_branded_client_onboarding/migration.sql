ALTER TABLE "LeadAutomation"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'follow_up',
  ADD COLUMN "notifyStaff" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "createInvoice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "invoiceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "invoiceLabel" TEXT NOT NULL DEFAULT 'Consultation deposit',
  ADD COLUMN "invoiceDueDays" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "LeadAutomationRun"
  ADD COLUMN "steps" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "WorkspaceBranding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "logoUrl" TEXT NOT NULL DEFAULT '',
  "primaryColor" TEXT NOT NULL DEFAULT '#9f5964',
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  "invoiceFooter" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "poweredBy" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientInvoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "leadId" TEXT,
  "clientId" TEXT,
  "automationRunId" TEXT,
  "publicToken" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Awaiting Approval',
  "issueDate" TEXT NOT NULL,
  "dueDate" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "brandingSnapshot" TEXT NOT NULL DEFAULT '{}',
  "approvedById" TEXT NOT NULL DEFAULT '',
  "approvedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "paymentProvider" TEXT NOT NULL DEFAULT '',
  "paymentReference" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientInvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceBranding_organizationId_key" ON "WorkspaceBranding"("organizationId");
CREATE UNIQUE INDEX "ClientInvoice_automationRunId_key" ON "ClientInvoice"("automationRunId");
CREATE UNIQUE INDEX "ClientInvoice_publicToken_key" ON "ClientInvoice"("publicToken");
CREATE UNIQUE INDEX "ClientInvoice_organizationId_invoiceNumber_key" ON "ClientInvoice"("organizationId", "invoiceNumber");
CREATE INDEX "ClientInvoice_organizationId_status_createdAt_idx" ON "ClientInvoice"("organizationId", "status", "createdAt");
CREATE INDEX "ClientInvoice_branch_createdAt_idx" ON "ClientInvoice"("branch", "createdAt");
CREATE INDEX "ClientInvoice_leadId_idx" ON "ClientInvoice"("leadId");
CREATE INDEX "ClientInvoiceItem_invoiceId_idx" ON "ClientInvoiceItem"("invoiceId");

ALTER TABLE "WorkspaceBranding" ADD CONSTRAINT "WorkspaceBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "LeadAutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientInvoiceItem" ADD CONSTRAINT "ClientInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."WorkspaceBranding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ClientInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ClientInvoiceItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "public"."WorkspaceBranding" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "public"."ClientInvoice" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "public"."ClientInvoiceItem" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

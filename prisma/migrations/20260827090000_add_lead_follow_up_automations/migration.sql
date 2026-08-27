CREATE TABLE "LeadAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'No-response follow-up',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "branch" TEXT NOT NULL DEFAULT 'All branches',
    "delayHours" INTEGER NOT NULL DEFAULT 48,
    "channel" TEXT NOT NULL DEFAULT 'Email',
    "subject" TEXT NOT NULL DEFAULT 'Following up on your inquiry',
    "prompt" TEXT NOT NULL DEFAULT 'Write a warm, concise follow-up that invites the lead to book an appointment.',
    "messageTemplate" TEXT NOT NULL DEFAULT 'Hi {firstName}, just checking in about your interest in {interest}. We’d be happy to help whenever you’re ready. Book here: {bookingLink}',
    "bookingUrl" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadAutomation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadAutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Processing',
    "reason" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadAutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadAutomation_organizationId_active_idx" ON "LeadAutomation"("organizationId", "active");
CREATE INDEX "LeadAutomation_organizationId_branch_idx" ON "LeadAutomation"("organizationId", "branch");
CREATE UNIQUE INDEX "LeadAutomationRun_automationId_leadId_key" ON "LeadAutomationRun"("automationId", "leadId");
CREATE INDEX "LeadAutomationRun_organizationId_createdAt_idx" ON "LeadAutomationRun"("organizationId", "createdAt");
CREATE INDEX "LeadAutomationRun_status_scheduledAt_idx" ON "LeadAutomationRun"("status", "scheduledAt");
CREATE INDEX "LeadAutomationRun_leadId_createdAt_idx" ON "LeadAutomationRun"("leadId", "createdAt");

ALTER TABLE "LeadAutomation" ADD CONSTRAINT "LeadAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAutomationRun" ADD CONSTRAINT "LeadAutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "LeadAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAutomationRun" ADD CONSTRAINT "LeadAutomationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadAutomationRun" ADD CONSTRAINT "LeadAutomationRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."LeadAutomation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadAutomationRun" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "public"."LeadAutomation" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "deny_direct_api_access" ON "public"."LeadAutomationRun" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

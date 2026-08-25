-- Additive subscription and trial records. Existing organizations intentionally
-- remain without a row and are treated as grandfathered so no existing access
-- or historical business data is changed.
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planCode" TEXT,
    "requestedPlanCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_plan',
    "trialStartAt" TIMESTAMP(3),
    "trialEndAt" TIMESTAMP(3),
    "paidStartAt" TIMESTAMP(3),
    "renewalAt" TIMESTAMP(3),
    "cancellationAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "activationRequestedAt" TIMESTAMP(3),
    "paymentProviderReference" TEXT NOT NULL DEFAULT '',
    "includedWebsitePages" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE INDEX "Subscription_status_trialEndAt_idx" ON "Subscription"("status", "trialEndAt");
CREATE INDEX "Subscription_planCode_status_idx" ON "Subscription"("planCode", "status");

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "Subscription" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

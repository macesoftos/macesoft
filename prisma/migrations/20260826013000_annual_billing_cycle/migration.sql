-- Add monthly versus prepaid annual billing selection without changing or
-- deleting any existing subscription or historical billing data. Existing
-- subscription rows remain monthly by default.
ALTER TABLE "Subscription"
ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN "requestedBillingCycle" TEXT;

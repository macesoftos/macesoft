CREATE TABLE "OnboardingProgress" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "tourVersion" INTEGER NOT NULL DEFAULT 1,
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "checklistProgress" JSONB,
  "checklistMinimized" BOOLEAN NOT NULL DEFAULT false,
  "checklistHiddenAt" TIMESTAMP(3),
  "lastChecklistInteraction" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProgress_accountId_key" ON "OnboardingProgress"("accountId");
CREATE INDEX "OnboardingProgress_tourVersion_completedAt_idx" ON "OnboardingProgress"("tourVersion", "completedAt");

ALTER TABLE "OnboardingProgress"
  ADD CONSTRAINT "OnboardingProgress_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing accounts are returning users. Keep the automatic welcome exclusive to
-- accounts created after this release while preserving manual restart controls.
INSERT INTO "OnboardingProgress" (
  "id",
  "accountId",
  "tourVersion",
  "currentStep",
  "dismissedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy_', "id"),
  "id",
  1,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Account"
ON CONFLICT ("accountId") DO NOTHING;

-- Keep Supabase PostgREST roles denied; the Express API is the only trusted data path.
ALTER TABLE "OnboardingProgress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "OnboardingProgress" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

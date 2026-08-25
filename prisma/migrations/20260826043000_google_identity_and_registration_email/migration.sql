ALTER TABLE "Account"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "registrationEmailSentAt" TIMESTAMP(3);

CREATE TABLE "AccountIdentity" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT NOT NULL DEFAULT '',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountIdentity_provider_providerSubject_key" ON "AccountIdentity"("provider", "providerSubject");
CREATE UNIQUE INDEX "AccountIdentity_accountId_provider_key" ON "AccountIdentity"("accountId", "provider");
CREATE INDEX "AccountIdentity_providerEmail_idx" ON "AccountIdentity"("providerEmail");

ALTER TABLE "AccountIdentity"
ADD CONSTRAINT "AccountIdentity_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountIdentity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "AccountIdentity" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

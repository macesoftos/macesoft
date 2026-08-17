CREATE TABLE "MarketingAudienceMember" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'Manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingAudienceMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingAudienceMember_email_audience_branch_key"
  ON "MarketingAudienceMember"("email", "audience", "branch");

CREATE INDEX "MarketingAudienceMember_branch_audience_idx"
  ON "MarketingAudienceMember"("branch", "audience");

CREATE INDEX "MarketingAudienceMember_email_idx"
  ON "MarketingAudienceMember"("email");

ALTER TABLE "MarketingAudienceMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "MarketingAudienceMember" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

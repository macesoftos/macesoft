ALTER TABLE "MarketingCampaign"
ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "managerApproval" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "MarketingEmailTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "thumbnail" TEXT NOT NULL DEFAULT '',
  "editorMode" TEXT NOT NULL DEFAULT 'visual',
  "html" TEXT NOT NULL DEFAULT '',
  "design" JSONB NOT NULL,
  "branch" TEXT NOT NULL DEFAULT 'All branches',
  "createdById" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingEmailTemplate_name_idx" ON "MarketingEmailTemplate"("name");
CREATE INDEX "MarketingEmailTemplate_branch_updatedAt_idx" ON "MarketingEmailTemplate"("branch", "updatedAt");

CREATE TABLE "MarketingSurveyResponse" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "recipient" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingSurveyResponse_campaignId_blockId_createdAt_idx" ON "MarketingSurveyResponse"("campaignId", "blockId", "createdAt");

ALTER TABLE "MarketingSurveyResponse"
ADD CONSTRAINT "MarketingSurveyResponse_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingEmailTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "MarketingEmailTemplate" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

ALTER TABLE "MarketingSurveyResponse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_direct_api_access" ON "MarketingSurveyResponse" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

-- Keep campaign records inside the clinic workspace that created them.
ALTER TABLE "MarketingCampaign" ADD COLUMN "branch" TEXT NOT NULL DEFAULT 'All branches';

CREATE INDEX "MarketingCampaign_branch_idx" ON "MarketingCampaign"("branch");

-- Keep deleted Marketing campaigns recoverable until an explicit permanent deletion.
ALTER TABLE "MarketingCampaign" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "MarketingCampaign_deletedAt_idx" ON "MarketingCampaign"("deletedAt");

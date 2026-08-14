ALTER TABLE "MarketingCampaign"
ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN "scheduledById" TEXT NOT NULL DEFAULT '',
ADD COLUMN "approvedById" TEXT NOT NULL DEFAULT '',
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "lastDeliveryError" TEXT NOT NULL DEFAULT '';

CREATE INDEX "MarketingCampaign_deliveryStatus_scheduledAt_idx"
ON "MarketingCampaign"("deliveryStatus", "scheduledAt");

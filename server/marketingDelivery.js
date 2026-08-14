import { canManageOrganization } from "../src/organizationRoles.js";

export const marketingDeliveryStates = Object.freeze({
  awaitingApproval: "Awaiting approval",
  queued: "Queued",
  processing: "Processing",
  sent: "Sent",
  partial: "Partial",
  failed: "Failed",
});

export function marketingApprovalRequired(campaign, actorRole) {
  return campaign?.managerApproval !== false && !canManageOrganization(actorRole);
}

export function scheduleMarketingState({ actorId = "", actorRole = "", campaign, scheduledAt, now = new Date() }) {
  const approvalRequired = marketingApprovalRequired(campaign, actorRole);
  return {
    approvalRequired,
    data: {
      approvedAt: approvalRequired ? null : now,
      approvedById: approvalRequired ? "" : actorId,
      deliveryStatus: approvalRequired ? marketingDeliveryStates.awaitingApproval : marketingDeliveryStates.queued,
      lastDeliveryError: "",
      managerApproval: approvalRequired,
      scheduledAt,
      scheduledById: actorId,
      status: approvalRequired ? "Pending approval" : "Scheduled",
    },
  };
}

export function approveMarketingState({ actorId = "", now = new Date() }) {
  return {
    approvedAt: now,
    approvedById: actorId,
    deliveryStatus: marketingDeliveryStates.queued,
    lastDeliveryError: "",
    managerApproval: false,
    status: "Scheduled",
  };
}

export function marketingCampaignIsDue(campaign, now = new Date()) {
  if (campaign?.deliveryStatus !== marketingDeliveryStates.queued || campaign?.status !== "Scheduled" || campaign?.deletedAt) return false;
  const scheduledAt = campaign?.scheduledAt instanceof Date ? campaign.scheduledAt : new Date(campaign?.scheduledAt || "");
  return !Number.isNaN(scheduledAt.getTime()) && scheduledAt.getTime() <= now.getTime();
}

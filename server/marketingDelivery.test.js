import assert from "node:assert/strict";
import test from "node:test";

import {
  approveMarketingState,
  marketingApprovalRequired,
  marketingCampaignIsDue,
  marketingDeliveryStates,
  scheduleMarketingState,
} from "./marketingDelivery.js";

test("admins and owners approve their own Marketing schedules automatically", () => {
  for (const role of ["Admin", "Super Admin", "Owner", "Business Owner"]) {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const scheduledAt = new Date("2026-08-14T13:00:00.000Z");
    const result = scheduleMarketingState({ actorId: `actor-${role}`, actorRole: role, campaign: { managerApproval: true }, scheduledAt, now });

    assert.equal(result.approvalRequired, false);
    assert.equal(result.data.managerApproval, false);
    assert.equal(result.data.status, "Scheduled");
    assert.equal(result.data.deliveryStatus, marketingDeliveryStates.queued);
    assert.equal(result.data.approvedById, `actor-${role}`);
    assert.equal(result.data.approvedAt, now);
  }
});

test("staff schedules wait for an administrator when approval is required", () => {
  const scheduledAt = new Date("2026-08-14T13:00:00.000Z");
  const result = scheduleMarketingState({ actorId: "staff-1", actorRole: "Receptionist", campaign: { managerApproval: true }, scheduledAt });

  assert.equal(marketingApprovalRequired({ managerApproval: true }, "Receptionist"), true);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.data.status, "Pending approval");
  assert.equal(result.data.deliveryStatus, marketingDeliveryStates.awaitingApproval);
  assert.equal(result.data.approvedById, "");
});

test("administrator approval releases a campaign into the delivery queue", () => {
  const now = new Date("2026-08-14T12:30:00.000Z");
  const result = approveMarketingState({ actorId: "admin-1", now });

  assert.equal(result.managerApproval, false);
  assert.equal(result.status, "Scheduled");
  assert.equal(result.deliveryStatus, marketingDeliveryStates.queued);
  assert.equal(result.approvedAt, now);
});

test("only queued scheduled campaigns become due", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  assert.equal(marketingCampaignIsDue({ deliveryStatus: "Queued", status: "Scheduled", scheduledAt: "2026-08-14T11:59:00.000Z", deletedAt: null }, now), true);
  assert.equal(marketingCampaignIsDue({ deliveryStatus: "Awaiting approval", status: "Pending approval", scheduledAt: "2026-08-14T11:59:00.000Z", deletedAt: null }, now), false);
  assert.equal(marketingCampaignIsDue({ deliveryStatus: "Queued", status: "Scheduled", scheduledAt: "2026-08-14T12:01:00.000Z", deletedAt: null }, now), false);
});

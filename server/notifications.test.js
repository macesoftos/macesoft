import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeNotificationBranches,
  notificationIsUnread,
  notificationWhereForActor,
} from "./notifications.js";

test("notification branches are normalized and default to all branches", () => {
  assert.deepEqual(normalizeNotificationBranches(["Mace Davao", "Mace Davao", ""]), ["Mace Davao"]);
  assert.deepEqual(normalizeNotificationBranches('["Mace BGC"]'), ["Mace BGC"]);
  assert.deepEqual(normalizeNotificationBranches([]), ["All branches"]);
});

test("notification queries require an authenticated tenant account", () => {
  assert.deepEqual(notificationWhereForActor(
    { id: "reception-davao", organizationId: "org-davao", role: "Receptionist", branch: "Mace Davao" },
    ["leads", "services"],
  ), {
    organizationId: "org-davao",
    module: { in: ["leads", "services"] },
    recipientAccountIds: { has: "reception-davao" },
  });
  assert.deepEqual(notificationWhereForActor(
    { id: "owner", organizationId: "org-main", role: "Super Admin", branch: "All branches" },
    ["leads"],
  ), { organizationId: "org-main", module: { in: ["leads"] }, recipientAccountIds: { has: "owner" } });
  assert.deepEqual(notificationWhereForActor(
    { role: "Receptionist", branch: "All branches" },
    ["leads"],
  ), { id: { in: [] } });
});

test("unread state is based on each account's read timestamp", () => {
  const notification = { createdAt: "2026-08-14T10:00:00.000Z" };
  assert.equal(notificationIsUnread(notification, null), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T09:59:59.000Z"), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T10:00:00.000Z"), false);
});

test("targeted notifications are visible only to named accounts", () => {
  const where = notificationWhereForActor(
    { id: "manager-davao", organizationId: "org-davao", role: "Branch Manager", branch: "Mace Davao" },
    ["staff"],
  );
  assert.deepEqual(where, {
    organizationId: "org-davao",
    module: { in: ["staff"] },
    recipientAccountIds: { has: "manager-davao" },
  });
});

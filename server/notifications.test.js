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

test("notification queries are scoped by modules and branch", () => {
  assert.deepEqual(notificationWhereForActor(
    { branch: "Mace Davao" },
    ["leads", "services"],
  ), {
    module: { in: ["leads", "services"] },
    OR: [
      { branches: { has: "All branches" } },
      { branches: { has: "Mace Davao" } },
    ],
  });
  assert.deepEqual(notificationWhereForActor(
    { branch: "All branches" },
    ["leads"],
  ), { module: { in: ["leads"] } });
});

test("unread state is based on each account's read timestamp", () => {
  const notification = { createdAt: "2026-08-14T10:00:00.000Z" };
  assert.equal(notificationIsUnread(notification, null), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T09:59:59.000Z"), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T10:00:00.000Z"), false);
});

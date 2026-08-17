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
    { role: "Receptionist", branch: "Mace Davao" },
    ["leads", "services"],
  ), {
    module: { in: ["leads", "services"] },
    OR: [
      {
        recipientAccountIds: { isEmpty: true },
        OR: [
          { branches: { has: "All branches" } },
          { branches: { has: "Mace Davao" } },
        ],
      },
    ],
  });
  assert.deepEqual(notificationWhereForActor(
    { role: "Super Admin", branch: "All branches" },
    ["leads"],
  ), { module: { in: ["leads"] }, OR: [{ recipientAccountIds: { isEmpty: true } }] });
  assert.deepEqual(notificationWhereForActor(
    { role: "Receptionist", branch: "All branches" },
    ["leads"],
  ), { module: { in: ["leads"] }, OR: [{ id: { in: [] } }] });
});

test("unread state is based on each account's read timestamp", () => {
  const notification = { createdAt: "2026-08-14T10:00:00.000Z" };
  assert.equal(notificationIsUnread(notification, null), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T09:59:59.000Z"), true);
  assert.equal(notificationIsUnread(notification, "2026-08-14T10:00:00.000Z"), false);
});

test("targeted notifications are visible only to named accounts", () => {
  const where = notificationWhereForActor(
    { id: "manager-davao", role: "Branch Manager", branch: "Mace Davao" },
    ["staff"],
  );
  assert.deepEqual(where.OR[0], { recipientAccountIds: { has: "manager-davao" } });
  assert.deepEqual(where.OR[1].recipientAccountIds, { isEmpty: true });
});

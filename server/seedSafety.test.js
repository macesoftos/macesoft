import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialStaff } from "../src/data.js";

test("development seed never preloads staff profiles", () => {
  assert.deepEqual(initialStaff, []);
});

test("runtime and development seed contain no demo account provisioning", () => {
  const dataSource = readFileSync(new URL("../src/data.js", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  const seedSource = readFileSync(new URL("./seed.js", import.meta.url), "utf8");

  assert.doesNotMatch(dataSource, /@mace\.test/i);
  assert.doesNotMatch(serverSource, /ensureDefaultAccounts/);
  assert.doesNotMatch(seedSource, /seedAccounts|SEED_STAFF_PASSWORD/);
});

test("the cleanup migration removes only reserved-domain demo accounts", () => {
  const migration = readFileSync(
    new URL("../prisma/migrations/20260813130000_remove_demo_accounts/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /DELETE FROM "Account"/);
  assert.match(migration, /LIKE '%@mace\.test'/i);
  assert.doesNotMatch(migration, /admin@macebydrmace\.com/i);
});

test("the removed Dr. Aria demo profile is unassigned without deleting appointments", () => {
  const migration = readFileSync(
    new URL("../prisma/migrations/20260813234000_unassign_removed_dr_aria_appointments/migration.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /UPDATE "Appointment"/);
  assert.match(migration, /SET "staff" = ''/);
  assert.match(migration, /Dr\. Aria Tan/);
  assert.match(migration, /NOT EXISTS/);
  assert.doesNotMatch(migration, /DELETE FROM "Appointment"/);
});

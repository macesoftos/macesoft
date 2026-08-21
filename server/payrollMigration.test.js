import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repairMigration = readFileSync(
  new URL("../prisma/migrations/20260822013000_repair_payroll_manager_modules/migration.sql", import.meta.url),
  "utf8",
);

test("payroll module backfill repair restores role defaults only for affected organization managers", () => {
  assert.match(repairMigration, /UPDATE "Account"/);
  assert.match(repairMigration, /SET "organizationModules" = '\[\]'/);
  assert.match(repairMigration, /"role" IN \('Super Admin', 'Owner', 'Business Owner'\)/);
  assert.match(repairMigration, /"organizationModules"::jsonb = '\["payroll"\]'::jsonb/);
  assert.doesNotMatch(repairMigration, /DELETE FROM/i);
});

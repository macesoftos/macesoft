import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../prisma/migrations/20260817120000_multi_branch_access_control/migration.sql", import.meta.url), "utf8");
const server = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("multi-branch migration preserves and backfills existing operational data", () => {
  assert.match(migration, /INSERT INTO "Organization"/);
  assert.match(migration, /WHERE NOT EXISTS \(SELECT 1 FROM "Branch"\)/);
  for (const table of ["Client", "StaffMember", "Appointment", "Treatment", "InventoryItem", "Sale", "Lead", "Expense"]) {
    assert.match(migration, new RegExp(`UPDATE "${table}"`), `${table} must be backfilled`);
  }
  assert.match(migration, /UPDATE "Treatment" t[\s\S]*FROM "Client" c/);
  assert.doesNotMatch(migration, /DELETE FROM "(?:Client|Appointment|Treatment|Branch)"/);
});

test("branch archival replaces permanent deletion and keeps historical records", () => {
  assert.match(server, /app\.post\("\/api\/branches\/:id\/archive"/);
  assert.match(server, /app\.post\("\/api\/branches\/:id\/reactivate"/);
  assert.match(server, /permanently deleted through the application API/);
  assert.doesNotMatch(server, /tx\.branch\.delete/);
  const editRoute = server.slice(
    server.indexOf('app.put("/api/branches/:id"'),
    server.indexOf('async function setBranchLifecycle'),
  );
  assert.match(editRoute, /activeCount <= 1/);
  assert.match(editRoute, /must keep at least one active branch/);
});

test("server resolves the requested branch before protected module authorization", () => {
  const resolveIndex = server.indexOf("const actor = await publicAccountWithSubscription(account, request.get(\"x-mace-branch-id\"))");
  const moduleIndex = server.indexOf("const requiredModule = requiredModuleForApiRequest");
  assert.ok(resolveIndex > 0);
  assert.ok(moduleIndex > resolveIndex);
  assert.match(server, /branchScopedPayload\(request, request\.body, config\)/);
  assert.match(server, /request\.params\?\.id[\s\S]*allowLegacyOrganizationScope[\s\S]*isAllBranches\(suppliedBranch\)/);
});

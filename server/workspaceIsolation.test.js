import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../prisma/migrations/20260827170000_workspace_specific_forms/migration.sql", import.meta.url), "utf8");

test("public forms resolve one active workspace before branches or services are returned", () => {
  const handler = serverSource.match(/app\.get\("\/api\/public-leads\/config"[\s\S]*?\n\}\)\);/)?.[0] || "";
  assert.match(handler, /publicWorkspaceForm\(request\.query\.workspace\)/);
  assert.match(handler, /allowedBranchNames/);
  assert.doesNotMatch(handler, /prisma\.branch\.findMany/);
  assert.match(handler, /workspaceBrandingForOrganization\(prisma, form\.organizationId\)/);
});

test("public inquiry services must be assigned to the selected tenant branch", () => {
  const handler = serverSource.match(/app\.post\("\/api\/public-leads"[\s\S]*?app\.get\("\/api\/public-registration\/qr"/)?.[0] || "";
  assert.match(handler, /!serviceBranches\.includes\(branch\.name\)/);
  assert.doesNotMatch(handler, /serviceBranches\.includes\("All branches"\)/);
});

test("inquiry, booking, and registration writes store direct tenant relationships", () => {
  assert.match(serverSource, /organizationId: form\.organizationId/);
  assert.match(serverSource, /branchId: branch\.id/);
  assert.match(serverSource, /workspaceFormId: form\.id/);
  assert.match(serverSource, /publicWorkspaceForm\(values\.workspaceSlug, "registration"\)/);
  assert.match(serverSource, /publicWorkspaceForm\(request\.body\?\.workspaceSlug, "booking"\)/);
  assert.match(schemaSource, /model WorkspaceForm[\s\S]*?organizationId\s+String/);
});

test("unassigned operational identities cannot use organization-wide client selectors", () => {
  assert.match(
    serverSource,
    /config\.directTenantOrganizationWide && !hasOrganizationWideAccess\(actor\) && !hasValidBranchAssignment\(actor\)/,
  );
  assert.match(serverSource, /where = \{ id: "__none__" \}/);
});

test("payment replay protection is organization scoped and paid invoices post once to POS", () => {
  assert.match(schemaSource, /@@unique\(\[organizationId, provider, providerReference\]\)/);
  assert.match(serverSource, /client-invoice-payment:\$\{invoiceId\}/);
  assert.match(serverSource, /Posted automatically from paid client invoice/);
  assert.match(migrationSource, /InvoicePayment_organizationId_provider_providerReference_key/);
});

test("new public tenant tables deny direct browser database access", () => {
  for (const table of ["WorkspaceForm", "WorkspaceFormBranch", "InvoicePayment"]) {
    assert.match(migrationSource, new RegExp(`ALTER TABLE "public"\\."${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(migrationSource, new RegExp(`CREATE POLICY "deny_direct_api_access" ON "public"\\."${table}"`));
  }
});

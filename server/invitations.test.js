import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { roleAccess } from "../src/data.js";
import {
  INVITATION_STATUSES,
  assertAssignableInvitationRole,
  assertPrivilegedConfirmation,
  assertRequestedModules,
  assertRequestedPermissions,
  assignableInvitationRoles,
  canInviteUsers,
  canManageInvitation,
  invitationScopeWhere,
  normalizeEmail,
  sanitizeInvitationMessage,
} from "./invitations.js";

const davao = {
  id: "branch-davao",
  name: "Mace Davao",
  modules: roleAccess["Branch Manager"]
    .filter((moduleId) => !["my-workspace", "applications"].includes(moduleId))
    .map((moduleId) => ({ moduleId, enabled: moduleId !== "reports" })),
};
const owner = { id: "owner", role: "Owner", organizationId: "org-mace", access: { modules: roleAccess.Owner, permissions: [] } };
const manager = {
  id: "manager",
  role: "Branch Manager",
  organizationId: "org-mace",
  access: {
    activeBranchId: davao.id,
    modules: roleAccess["Branch Manager"].filter((moduleId) => moduleId !== "reports"),
    permissions: ["staff.invite", "staff.manage"],
  },
};

test("owners, explicitly authorized managers, and employees have the correct invitation authority", () => {
  assert.equal(canInviteUsers(owner), true);
  assert.equal(canInviteUsers(manager), true);
  assert.equal(canInviteUsers({ role: "Branch Manager", access: { permissions: [] } }), false);
  assert.equal(canInviteUsers({ role: "Employee", access: { permissions: ["staff.invite"] } }), false);

  assert.ok(assignableInvitationRoles(owner, roleAccess).includes("Super Admin"));
  assert.ok(assignableInvitationRoles(owner, roleAccess).includes("Branch Manager"));
  assert.ok(assignableInvitationRoles(manager, roleAccess).includes("Employee"));
  assert.equal(assignableInvitationRoles(manager, roleAccess).includes("Branch Manager"), false);
  assert.throws(() => assertAssignableInvitationRole(manager, "Owner", roleAccess), /not authorized/i);
});

test("a branch manager needs the separate manager-invitation permission", () => {
  const delegated = { ...manager, access: { ...manager.access, permissions: [...manager.access.permissions, "staff.invite_managers"] } };
  assert.ok(assignableInvitationRoles(delegated, roleAccess).includes("Branch Manager"));
  assert.ok(assignableInvitationRoles(delegated, roleAccess).includes("Admin"));
  assert.equal(assignableInvitationRoles(delegated, roleAccess).includes("Super Admin"), false);
});

test("organization-wide roles require an explicit owner confirmation", () => {
  assert.throws(() => assertPrivilegedConfirmation(owner, "Super Admin", false), /confirm organization-wide/i);
  assert.doesNotThrow(() => assertPrivilegedConfirmation(owner, "Super Admin", true));
  assert.throws(() => assertPrivilegedConfirmation(manager, "Super Admin", true), /only an Owner or Super Admin/i);
});

test("managers cannot grant permissions or modules they do not possess", () => {
  assert.deepEqual(assertRequestedPermissions(manager, ["staff.manage"]), ["staff.manage"]);
  assert.throws(() => assertRequestedPermissions(manager, ["staff.invite_managers"]), /do not possess/i);
  assert.throws(() => assertRequestedPermissions(owner, ["billing.superuser"]), /unknown/i);
  assert.throws(
    () => assertRequestedModules(manager, "Employee", ["reports"], [davao], roleAccess),
    /not available|disabled|do not possess/i,
  );
  assert.throws(
    () => assertRequestedModules(owner, "Branch Manager", ["reports"], [davao], roleAccess),
    /disabled/i,
  );
  assert.deepEqual(
    assertRequestedModules(manager, "Employee", ["my-workspace", "appointments", "clients"], [davao], roleAccess),
    ["my-workspace", "appointments", "clients"],
  );
});

test("invitation queries and mutations remain organization and branch scoped", () => {
  assert.deepEqual(invitationScopeWhere(owner), { organizationId: "org-mace" });
  assert.deepEqual(invitationScopeWhere(manager), {
    organizationId: "org-mace",
    branches: { some: { branchId: "branch-davao" } },
  });
  const ownedInvitation = { organizationId: "org-mace", invitedById: "manager", branches: [{ branchId: "branch-davao" }] };
  assert.equal(canManageInvitation(manager, ownedInvitation), true);
  assert.equal(canManageInvitation({ ...manager, id: "other-manager" }, ownedInvitation), false);
  assert.equal(canManageInvitation(manager, { ...ownedInvitation, organizationId: "org-other" }), false);
  assert.equal(canManageInvitation(manager, { ...ownedInvitation, branches: [{ branchId: "branch-other" }] }), false);
});

test("email and optional messages are normalized without executable markup", () => {
  assert.equal(normalizeEmail("  User.Name@Example.COM "), "user.name@example.com");
  assert.equal(sanitizeInvitationMessage(" <script>alert(1)</script> Welcome\u0000 "), "alert(1) Welcome");
  assert.deepEqual(INVITATION_STATUSES, ["Pending", "Accepted", "Expired", "Revoked"]);
});

test("the HTTP lifecycle uses hashed single-use tokens, conditional acceptance, and last-owner protection", () => {
  const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /tokenHash: sessionTokenHash\(token\)/);
  assert.match(source, /status: "Pending",\s*revokedAt: null,\s*expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(source, /app\.patch\("\/api\/invitations\/:id"/);
  assert.match(source, /app\.post\("\/api\/invitations\/:id\/resend"/);
  assert.match(source, /app\.post\("\/api\/invitations\/:id\/cancel"/);
  assert.match(source, /The last active Owner or Super Admin cannot be deactivated or demoted/);
  const invitationSource = source.slice(source.indexOf('app.get("/api/invitations"'), source.indexOf("function requireStaffLinkManager"));
  assert.doesNotMatch(invitationSource, /console\.(?:log|error)/i);
});

test("the secure invitation migration preserves old invitations and adds normalized constraints", () => {
  const migration = readFileSync(new URL("../prisma/migrations/20260817153000_secure_user_invitations/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /UPDATE "UserInvitation" i[\s\S]*"organizationId"/);
  assert.match(migration, /CREATE TABLE "UserInvitationBranch"/);
  assert.match(migration, /UserInvitation_pending_email_key/);
  assert.match(migration, /ALTER COLUMN "tokenHash" DROP NOT NULL/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(migration, /DELETE FROM "UserInvitation"/);
});

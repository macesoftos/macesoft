import test from "node:test";
import assert from "node:assert/strict";
import { roleAccess } from "../src/data.js";
import { canManageOrganization, isAdmin, isBusinessOwner } from "../src/organizationRoles.js";

test("owners, super admins, and isolated demo users can manage branches and organization settings", () => {
  for (const role of ["Demo User", "Super Admin", "Business Owner", "Owner"]) {
    assert.equal(canManageOrganization(role), true);
    assert.equal(roleAccess[role].includes("branches"), true);
    assert.equal(roleAccess[role].includes("settings"), true);
  }
  assert.equal(canManageOrganization("Admin"), false);
  assert.equal(roleAccess.Admin.includes("branches"), false);
  assert.equal(roleAccess.Admin.includes("settings"), false);
});

test("demo users receive the complete owner module catalog", () => {
  assert.deepEqual(roleAccess["Demo User"], roleAccess.Owner);
});

test("operational roles cannot manage the organization", () => {
  for (const role of ["Branch Manager", "Receptionist", "Employee", ""]) {
    assert.equal(canManageOrganization(role), false);
  }
});

test("owner aliases retain owner-only delegation rules", () => {
  assert.equal(isBusinessOwner("Demo User"), true);
  assert.equal(isBusinessOwner("Owner"), true);
  assert.equal(isBusinessOwner("Business Owner"), true);
  assert.equal(isBusinessOwner("Admin"), false);
});

test("the super-admin alias and isolated demo user have organization admin authority", () => {
  assert.equal(isAdmin("Admin"), false);
  assert.equal(isAdmin("Demo User"), true);
  assert.equal(isAdmin("Super Admin"), true);
  assert.equal(isAdmin("Owner"), false);
  assert.equal(isAdmin("Business Owner"), false);
  assert.equal(isAdmin("Branch Manager"), false);
});

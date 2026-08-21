import assert from "node:assert/strict";
import test from "node:test";

import { roleAccess } from "../src/data.js";
import { branchWhere, canAccessBranch, moduleAllowed } from "./accessControl.js";
import { ALL_BRANCHES_ID, normalizeBranchCode, resolveAccountBranchAccess } from "./branchAccess.js";

const modules = (disabled = []) => roleAccess["Branch Manager"]
  .filter((moduleId) => !["my-workspace", "applications"].includes(moduleId))
  .map((moduleId) => ({
  moduleId,
  enabled: !disabled.includes(moduleId),
  }));

const davao = { id: "branch-davao", name: "Mace Davao", code: "DAVAO", status: "Active", modules: modules() };
const makati = { id: "branch-makati", name: "Mace Makati", code: "MAKATI", status: "Active", modules: modules(["reports"]) };
const archived = { id: "branch-old", name: "Mace Old", code: "OLD", status: "Archived", modules: modules() };

function organization(branches = [davao, makati, archived]) {
  return { id: "org-mace", branches };
}

test("owner can select All Branches or any active organization branch", () => {
  const account = { id: "owner", role: "Owner", status: "Active", organizationId: "org-mace", organization: organization(), branchMemberships: [] };
  const all = resolveAccountBranchAccess(account, ALL_BRANCHES_ID, roleAccess);
  assert.equal(all.scope, "all");
  assert.equal(all.organizationWide, true);
  assert.deepEqual(all.branches.map((branch) => branch.id), ["branch-davao", "branch-makati"]);
  assert.equal(moduleAllowed({ role: "Owner", access: all }, "reports", roleAccess), true);

  const selected = resolveAccountBranchAccess(account, "branch-makati", roleAccess);
  assert.equal(selected.scope, "branch");
  assert.equal(selected.activeBranch.name, "Mace Makati");
  assert.deepEqual(branchWhere({ role: "Owner", access: selected }), { branch: "Mace Makati" });
});

test("branch manager receives only active memberships and enabled branch modules", () => {
  const account = {
    id: "manager",
    role: "Branch Manager",
    status: "Active",
    organizationId: "org-mace",
    organization: organization(),
    branchMemberships: [
      { branch: davao, branchId: davao.id, role: "Branch Manager", status: "Active", isPrimary: true, permissions: "[]" },
      { branch: makati, branchId: makati.id, role: "Branch Manager", status: "Active", isPrimary: false, permissions: "[]" },
      { branch: archived, branchId: archived.id, role: "Branch Manager", status: "Active", isPrimary: false, permissions: "[]" },
    ],
  };
  const access = resolveAccountBranchAccess(account, "branch-makati", roleAccess);
  const actor = { ...account, branch: access.activeBranch.name, access };
  assert.deepEqual(access.branches.map((branch) => branch.id), ["branch-davao", "branch-makati"]);
  assert.equal(access.modules.includes("pos"), true);
  assert.equal(access.modules.includes("staff"), true);
  assert.equal(access.modules.includes("reports"), false);
  assert.equal(moduleAllowed(actor, "reports", roleAccess), false);
  assert.equal(canAccessBranch(actor, "Mace Makati"), true);
  assert.equal(canAccessBranch(actor, "Mace Davao"), false);
  assert.equal(resolveAccountBranchAccess({ ...account, lastBranchId: "stale-branch" }, "", roleAccess).activeBranch.id, davao.id);
  assert.throws(() => resolveAccountBranchAccess(account, ALL_BRANCHES_ID, roleAccess), /restricted/i);
  assert.throws(() => resolveAccountBranchAccess(account, "branch-old", roleAccess), /do not have access/i);
});

test("employees cannot manufacture branch access with an unknown request header", () => {
  const account = {
    id: "employee",
    role: "Employee",
    status: "Active",
    organizationId: "org-mace",
    organization: organization([davao, makati]),
    branchMemberships: [{ branch: davao, branchId: davao.id, role: "Employee", status: "Active", isPrimary: true, permissions: "[]" }],
  };
  assert.throws(() => resolveAccountBranchAccess(account, "branch-makati", roleAccess), /do not have access/i);
  const access = resolveAccountBranchAccess(account, "branch-davao", roleAccess);
  assert.deepEqual(access.modules, ["pos"]);
});

test("branch codes are canonical and safe for case-insensitive uniqueness", () => {
  assert.equal(normalizeBranchCode(" mace / bgc 01 "), "MACE-BGC-01");
  assert.equal(normalizeBranchCode("---"), "");
});

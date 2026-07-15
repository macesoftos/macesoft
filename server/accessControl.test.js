import test from "node:test";
import assert from "node:assert/strict";
import {
  branchWhere,
  canAccessBranch,
  filterServiceBranches,
  isPublicApiRequest,
  moduleAllowed,
} from "./accessControl.js";

const roles = { Owner: ["clients", "settings"], Receptionist: ["clients"] };
const owner = { role: "Owner", branch: "All branches" };
const receptionist = { role: "Receptionist", branch: "Mace BGC" };

test("only explicitly public API methods and paths bypass session authentication", () => {
  assert.equal(isPublicApiRequest("POST", "/api/auth/login"), true);
  assert.equal(isPublicApiRequest("POST", "/api/auth/forgot-password"), true);
  assert.equal(isPublicApiRequest("POST", "/api/auth/reset-password"), true);
  assert.equal(isPublicApiRequest("GET", "/api/health/ready"), true);
  assert.equal(isPublicApiRequest("POST", "/api/public-bookings"), true);
  assert.equal(isPublicApiRequest("POST", "/api/facetrack-attendance/kiosk/clock"), true);
  assert.equal(isPublicApiRequest("POST", "/api/facetrack-attendance/kiosks"), false);
  assert.equal(isPublicApiRequest("GET", "/api/bootstrap"), false);
  assert.equal(isPublicApiRequest("GET", "/api/clients"), false);
  assert.equal(isPublicApiRequest("GET", "/api/settings"), false);
  assert.equal(isPublicApiRequest("GET", "/api/leads/webhooks/website"), false);
});

test("module and branch access enforce least privilege", () => {
  assert.equal(moduleAllowed(owner, "settings", roles), true);
  assert.equal(moduleAllowed(receptionist, "settings", roles), false);
  assert.equal(canAccessBranch(receptionist, "Mace BGC"), true);
  assert.equal(canAccessBranch(receptionist, "Mace Davao"), false);
  assert.equal(canAccessBranch(owner, "Mace Davao"), true);
  assert.deepEqual(branchWhere(receptionist), {
    OR: [{ branch: "Mace BGC" }, { branch: "All branches" }],
  });
  assert.equal(canAccessBranch(receptionist, ""), false);
});

test("branch-bound users only receive services offered by their branch", () => {
  const rows = [
    { id: "bgc", branches: JSON.stringify(["Mace BGC"]) },
    { id: "davao", branches: JSON.stringify(["Mace Davao"]) },
    { id: "shared", branches: "[]" },
  ];
  assert.deepEqual(filterServiceBranches(rows, receptionist).map((row) => row.id), ["bgc", "shared"]);
  assert.equal(filterServiceBranches(rows, owner).length, 3);
});

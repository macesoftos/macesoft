import test from "node:test";
import assert from "node:assert/strict";
import {
  accountMatchesStaffIdentity,
  branchWhere,
  canAccessBranch,
  canMutateBranch,
  filterServiceBranches,
  hasOrganizationWideAccess,
  hasValidBranchAssignment,
  isPublicApiRequest,
  moduleAllowed,
  requiredModuleForApiRequest,
} from "./accessControl.js";

const roles = { Owner: ["clients", "settings"], Receptionist: ["clients"] };
const owner = { role: "Owner", branch: "All branches" };
const receptionist = { role: "Receptionist", branch: "Mace Davao" };
const invalidReceptionist = { role: "Receptionist", branch: "All branches" };

test("only explicitly public API methods and paths bypass session authentication", () => {
  assert.equal(isPublicApiRequest("POST", "/api/auth/login"), true);
  assert.equal(isPublicApiRequest("POST", "/api/auth/forgot-password"), true);
  assert.equal(isPublicApiRequest("POST", "/api/auth/reset-password"), true);
  assert.equal(isPublicApiRequest("GET", "/api/health/ready"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public-leads/config"), true);
  assert.equal(isPublicApiRequest("POST", "/api/public-leads"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public-leads"), false);
  assert.equal(isPublicApiRequest("POST", "/api/public-bookings"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public/flipbooks/token-123"), true);
  assert.equal(isPublicApiRequest("POST", "/api/public/flipbooks/token-123/access"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public/flipbooks/token-123/file"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public/flipbooks/token-123/logo"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public/marketing/survey/campaign-1/survey-1?answer=excellent"), true);
  assert.equal(isPublicApiRequest("GET", "/api/public/marketing-assets/asset-123"), true);
  assert.equal(isPublicApiRequest("HEAD", "/api/public/marketing-assets/asset-123"), true);
  assert.equal(isPublicApiRequest("POST", "/api/public/marketing-assets/asset-123"), false);
  assert.equal(isPublicApiRequest("POST", "/api/public/marketing/survey/campaign-1/survey-1"), true);
  assert.equal(isPublicApiRequest("PATCH", "/api/public/flipbooks/token-123"), false);
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
  assert.equal(canAccessBranch(receptionist, "Mace Davao"), true);
  assert.equal(canAccessBranch(receptionist, "Mace Makati"), false);
  assert.equal(canAccessBranch(receptionist, "All branches"), false);
  assert.equal(canMutateBranch(receptionist, "All branches"), false);
  assert.equal(canMutateBranch(receptionist, "Mace Davao"), true);
  assert.equal(canMutateBranch(receptionist, "Mace Makati"), false);
  assert.equal(canMutateBranch(owner, "Mace Davao"), true);
  assert.equal(canAccessBranch(owner, "Mace Davao"), true);
  assert.equal(hasOrganizationWideAccess(owner), true);
  assert.equal(hasOrganizationWideAccess(receptionist), false);
  assert.equal(hasOrganizationWideAccess({ role: "Admin", branch: "" }), false);
  assert.equal(hasValidBranchAssignment(receptionist), true);
  assert.equal(hasValidBranchAssignment(invalidReceptionist), false);
  assert.deepEqual(branchWhere(receptionist), { branch: "Mace Davao" });
  assert.deepEqual(branchWhere(invalidReceptionist), { branch: { in: [] } });
  assert.equal(canAccessBranch(invalidReceptionist, "Mace Davao"), false);
  assert.equal(canAccessBranch(receptionist, ""), false);
});

test("protected API families resolve to their required workspace modules", () => {
  assert.equal(requiredModuleForApiRequest("/api/bootstrap"), "my-workspace");
  assert.equal(requiredModuleForApiRequest("/api/settings"), "settings");
  assert.equal(requiredModuleForApiRequest("/api/settings?tab=tax"), "settings");
  assert.equal(requiredModuleForApiRequest("/api/marketing/send"), "sms");
  assert.equal(requiredModuleForApiRequest("/api/leads/lead-1/stage"), "leads");
  assert.equal(requiredModuleForApiRequest("/api/pos/checkout"), "pos");
  assert.equal(requiredModuleForApiRequest("/api/rooms/room-1"), "room-view");
  assert.equal(requiredModuleForApiRequest("/api/treatments/treatment-1/photos"), "treatments");
  assert.equal(requiredModuleForApiRequest("/api/flipbooks/book-1/publish"), "flipbooks");
  assert.equal(requiredModuleForApiRequest("/api/auth/session"), "");
  assert.equal(requiredModuleForApiRequest("/api/resources/clients"), "");
});

test("staff login connection endpoints are gated behind the staff module", () => {
  assert.equal(requiredModuleForApiRequest("/api/accounts"), "staff");
  assert.equal(requiredModuleForApiRequest("/api/staff/staff-1/account"), "staff");
  assert.equal(isPublicApiRequest("GET", "/api/accounts"), false);
  assert.equal(isPublicApiRequest("PUT", "/api/staff/staff-1/account"), false);
});

test("a personal workspace only accepts the matching staff identity", () => {
  assert.equal(accountMatchesStaffIdentity(
    { name: "Christina Inah J. Pandian", role: "Marketing Staff", branch: "Mace Davao" },
    { name: "  christina inah j. pandian ", role: "Marketing Staff", branch: "Mace Davao" },
  ), true);
  assert.equal(accountMatchesStaffIdentity(
    { name: "MACE Admin", role: "Super Admin", branch: "All branches" },
    { name: "Christina Inah J. Pandian", role: "Marketing Staff", branch: "Mace Davao" },
  ), false);
  assert.equal(accountMatchesStaffIdentity(
    { name: "MACE Admin", role: "Super Admin", branch: "All branches" },
    { name: "MACE Admin", role: "Marketing Staff", branch: "Mace Davao" },
  ), false);
  assert.equal(accountMatchesStaffIdentity(
    { name: "Nurse Bea", role: "Nurse / Aesthetician", branch: "Mace Davao" },
    { name: "Nurse Bea", role: "Nurse / Aesthetician", branch: "Mace Makati" },
  ), false);
});

test("branch-bound users only receive services offered by their branch", () => {
  const rows = [
    { id: "makati", branches: JSON.stringify(["Mace Makati"]) },
    { id: "davao", branches: JSON.stringify(["Mace Davao"]) },
    { id: "shared", branches: "[]" },
  ];
  assert.deepEqual(filterServiceBranches(rows, receptionist).map((row) => row.id), ["davao", "shared"]);
  assert.equal(filterServiceBranches(rows, owner).length, 3);
});

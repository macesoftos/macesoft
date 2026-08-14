import { canManageOrganization } from "../src/organizationRoles.js";

/** @type {Array<[string, RegExp]>} */
const PUBLIC_API_RULES = [
  ["POST", /^\/api\/auth\/login$/],
  ["POST", /^\/api\/auth\/forgot-password$/],
  ["POST", /^\/api\/auth\/reset-password$/],
  ["GET", /^\/api\/invitations\/accept\/[^/]+$/],
  ["POST", /^\/api\/invitations\/accept\/[^/]+$/],
  ["GET", /^\/api\/health(?:\/(?:live|ready))?$/],
  ["GET", /^\/api\/public-leads\/config$/],
  ["POST", /^\/api\/public-leads$/],
  ["POST", /^\/api\/public-bookings$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+$/],
  ["POST", /^\/api\/public\/flipbooks\/[^/]+\/access$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+\/file$/],
  ["HEAD", /^\/api\/public\/flipbooks\/[^/]+\/file$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+\/logo$/],
  ["GET", /^\/api\/public\/marketing\/survey\/[^/]+\/[^/]+$/],
  ["GET", /^\/api\/leads\/webhooks\/meta-facebook$/],
  ["POST", /^\/api\/leads\/webhooks\/[^/]+$/],
  ["GET", /^\/api\/facetrack-attendance\/kiosk\/status$/],
  ["POST", /^\/api\/facetrack-attendance\/kiosk\/(?:challenge|clock|unlock)$/],
];

/** @type {Array<[RegExp, string]>} */
const API_MODULE_RULES = [
  [/^\/api\/bootstrap$/, "my-workspace"],
  [/^\/api\/modules$/, "applications"],
  [/^\/api\/me(?:\/|$)/, "my-workspace"],
  [/^\/api\/invitations(?:\/|$)/, "settings"],
  [/^\/api\/accounts(?:\/|$)/, "staff"],
  [/^\/api\/staff(?:\/|$)/, "staff"],
  [/^\/api\/rooms(?:\/|$)/, "room-view"],
  [/^\/api\/treatments(?:\/|$)/, "treatments"],
  [/^\/api\/branches(?:\/|$)/, "branches"],
  [/^\/api\/facetrack-attendance(?:\/|$)/, "facetrack-attendance"],
  [/^\/api\/settings(?:\/|$)/, "settings"],
  [/^\/api\/flipbooks(?:\/|$)/, "flipbooks"],
  [/^\/api\/marketing(?:\/|$)/, "sms"],
  [/^\/api\/leads(?:\/|$)/, "leads"],
  [/^\/api\/clients(?:\/|$)/, "clients"],
  [/^\/api\/inventory(?:\/|$)/, "inventory"],
  [/^\/api\/packages(?:\/|$)/, "packages"],
  [/^\/api\/transactions(?:\/|$)/, "pos"],
  [/^\/api\/pos(?:\/|$)/, "pos"],
];

export function isPublicApiRequest(method, path) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const normalizedPath = String(path || "").split("?")[0];
  return PUBLIC_API_RULES.some(([allowedMethod, pattern]) => (
    allowedMethod === normalizedMethod && pattern.test(normalizedPath)
  ));
}

export function requiredModuleForApiRequest(path) {
  const normalizedPath = String(path || "").split("?")[0];
  return API_MODULE_RULES.find(([pattern]) => pattern.test(normalizedPath))?.[1] || "";
}

export function isAllBranches(branch) {
  return String(branch || "").trim() === "All branches";
}

export function hasOrganizationWideAccess(actor) {
  return Boolean(actor?.role && String(actor.branch || "").trim() && canManageOrganization(actor.role));
}

export function hasValidBranchAssignment(actor) {
  const branch = String(actor?.branch || "").trim();
  if (!actor?.role || !branch) return false;
  return hasOrganizationWideAccess(actor) || !isAllBranches(branch);
}

export function canAccessBranch(actor, targetBranch) {
  const branch = String(targetBranch || "").trim();
  if (!hasValidBranchAssignment(actor) || !branch) return false;
  if (hasOrganizationWideAccess(actor)) return true;
  if (isAllBranches(branch)) return false;
  return String(actor.branch || "").trim() === branch;
}

export function canMutateBranch(actor, targetBranch) {
  return canAccessBranch(actor, targetBranch);
}

export function moduleAllowed(actor, moduleId, roleAccess) {
  return Boolean(actor?.role && (roleAccess[actor.role] || []).includes(moduleId));
}

function normalizeIdentityValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function accountMatchesStaffIdentity(account, staff) {
  if (!account || !staff) return false;
  const branchMatches = hasOrganizationWideAccess(account)
    || normalizeIdentityValue(account.branch) === normalizeIdentityValue(staff.branch);
  return normalizeIdentityValue(account.name) === normalizeIdentityValue(staff.name)
    && normalizeIdentityValue(account.role) === normalizeIdentityValue(staff.role)
    && branchMatches;
}

export function branchWhere(actor, field = "branch") {
  if (hasOrganizationWideAccess(actor)) return {};
  if (!hasValidBranchAssignment(actor)) return { [field]: { in: [] } };
  return { [field]: String(actor.branch).trim() };
}

export function filterServiceBranches(rows, actor) {
  if (hasOrganizationWideAccess(actor)) return rows;
  if (!hasValidBranchAssignment(actor)) return [];
  return rows.filter((row) => {
    try {
      const branches = Array.isArray(row.branches) ? row.branches : JSON.parse(row.branches || "[]");
      return !branches.length || branches.includes(actor.branch) || branches.includes("All branches");
    } catch {
      return false;
    }
  });
}

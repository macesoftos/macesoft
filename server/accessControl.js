import { canManageOrganization } from "../src/organizationRoles.js";

/** @type {Array<[string, RegExp]>} */
const PUBLIC_API_RULES = [
  ["POST", /^\/api\/auth\/login$/],
  ["POST", /^\/api\/auth\/demo-register$/],
  ["POST", /^\/api\/auth\/register$/],
  ["POST", /^\/api\/auth\/google$/],
  ["POST", /^\/api\/auth\/forgot-password$/],
  ["POST", /^\/api\/auth\/provider-setup$/],
  ["POST", /^\/api\/auth\/reset-password$/],
  ["GET", /^\/api\/auth\/session$/],
  ["GET", /^\/api\/invitations\/accept\/[^/]+$/],
  ["POST", /^\/api\/invitations\/accept\/[^/]+$/],
  ["GET", /^\/api\/health(?:\/(?:live|ready))?$/],
  ["GET", /^\/api\/public\/plans$/],
  ["GET", /^\/api\/public\/auth-config$/],
  ["GET", /^\/api\/public-leads\/config$/],
  ["POST", /^\/api\/public-leads$/],
  ["POST", /^\/api\/public-bookings$/],
  ["GET", /^\/api\/public-registration\/qr$/],
  ["POST", /^\/api\/public-registration$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+$/],
  ["POST", /^\/api\/public\/flipbooks\/[^/]+\/access$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+\/file$/],
  ["HEAD", /^\/api\/public\/flipbooks\/[^/]+\/file$/],
  ["GET", /^\/api\/public\/flipbooks\/[^/]+\/logo$/],
  ["GET", /^\/api\/public\/marketing\/survey\/[^/]+\/[^/]+$/],
  ["GET", /^\/api\/public\/marketing-assets\/[^/]+$/],
  ["HEAD", /^\/api\/public\/marketing-assets\/[^/]+$/],
  ["POST", /^\/api\/public\/marketing\/survey\/[^/]+\/[^/]+$/],
  ["GET", /^\/api\/leads\/webhooks\/meta-facebook$/],
  ["POST", /^\/api\/leads\/webhooks\/[^/]+$/],
  ["GET", /^\/api\/facetrack-attendance\/kiosk\/status$/],
  ["POST", /^\/api\/facetrack-attendance\/kiosk\/(?:challenge|clock|unlock)$/],
];

/** @type {Array<[RegExp, string]>} */
const API_MODULE_RULES = [
  [/^\/api\/bootstrap$/, "pos"],
  [/^\/api\/modules$/, "applications"],
  [/^\/api\/me\/active-branch$/, "pos"],
  [/^\/api\/me(?:\/|$)/, "my-workspace"],
  [/^\/api\/invitations(?:\/|$)/, "staff"],
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
  [/^\/api\/payroll(?:\/|$)/, "payroll"],
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
  return Boolean(actor?.role && (canManageOrganization(actor.role) || actor.organizationWideAccess));
}

export function hasValidBranchAssignment(actor) {
  const branch = String(actor?.branch || "").trim();
  if (!actor?.role) return false;
  if (hasOrganizationWideAccess(actor)) return true;
  if (Array.isArray(actor?.access?.branches)) {
    return actor.access.branches.some((item) => item?.status === "Active" && item?.branchStatus === "Active");
  }
  if (Array.isArray(actor?.branchMemberships)) {
    return actor.branchMemberships.some((item) => item?.status === "Active" && item?.branch?.status === "Active");
  }
  return Boolean(branch && !isAllBranches(branch));
}

export function canAccessBranch(actor, targetBranch) {
  const branch = String(targetBranch || "").trim();
  if (!hasValidBranchAssignment(actor) || !branch) return false;
  if (actor?.access?.scope === "branch") {
    const active = actor.access.activeBranch;
    return Boolean(active && (active.id === branch || active.name === branch));
  }
  if (hasOrganizationWideAccess(actor)) return true;
  if (isAllBranches(branch)) return false;
  if (Array.isArray(actor?.access?.branches)) {
    return actor.access.branches.some((item) => (
      item?.status === "Active"
      && item?.branchStatus === "Active"
      && (item.id === branch || item.name === branch)
    ));
  }
  return String(actor.branch || "").trim() === branch;
}

export function canMutateBranch(actor, targetBranch) {
  return canAccessBranch(actor, targetBranch);
}

export function moduleAllowed(actor, moduleId, roleAccess) {
  if (!actor?.role) return false;
  if (Array.isArray(actor?.access?.modules)) return actor.access.modules.includes(moduleId);
  return (roleAccess[actor.role] || []).includes(moduleId);
}

export function hasOrganizationPermission(actor, permission) {
  if (canManageOrganization(actor?.role)) return true;
  const permissions = Array.isArray(actor?.organizationPermissions)
    ? actor.organizationPermissions
    : parseBranchList(actor?.organizationPermissions);
  return permissions.includes(permission);
}

function normalizeIdentityValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function accountMatchesStaffIdentity(account, staff) {
  if (!account || !staff) return false;
  const branchMatches = hasOrganizationWideAccess(account)
    || normalizeIdentityValue(account.branch) === normalizeIdentityValue(staff.branch);
  return normalizeIdentityValue(account.name) === normalizeIdentityValue(staff.name)
    && normalizeIdentityValue(account.baseRole || account.role) === normalizeIdentityValue(staff.role)
    && branchMatches;
}

export function branchWhere(actor, field = "branch") {
  if (actor?.access?.scope === "all") {
    const branchNames = actor.access.branches?.map((branch) => branch.name).filter(Boolean) || [];
    return { [field]: { in: [...new Set([...branchNames, "All branches"])] } };
  }
  const activeBranch = String(actor?.access?.activeBranch?.name || "").trim();
  if (activeBranch) return { [field]: activeBranch };
  if (hasOrganizationWideAccess(actor)) return {};
  if (!hasValidBranchAssignment(actor)) return { [field]: { in: [] } };
  return { [field]: String(actor.branch).trim() };
}

function parseBranchList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function filterServiceBranches(rows, actor) {
  if (hasOrganizationWideAccess(actor) && !actor?.access) return rows;
  if (actor?.access?.scope === "all") {
    const allowed = new Set(actor.access.branches?.map((branch) => branch.name) || []);
    return rows.filter((row) => {
      const branches = parseBranchList(row.branches);
      return !branches.length || branches.includes("All branches") || branches.some((branch) => allowed.has(branch));
    });
  }
  if (!hasValidBranchAssignment(actor)) return [];
  const activeBranch = String(actor?.access?.activeBranch?.name || actor.branch || "").trim();
  return rows.filter((row) => {
    try {
      const branches = Array.isArray(row.branches) ? row.branches : JSON.parse(row.branches || "[]");
      return !branches.length || branches.includes(activeBranch) || branches.includes("All branches");
    } catch {
      return false;
    }
  });
}

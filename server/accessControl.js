/** @type {Array<[string, RegExp]>} */
const PUBLIC_API_RULES = [
  ["POST", /^\/api\/auth\/login$/],
  ["POST", /^\/api\/auth\/forgot-password$/],
  ["POST", /^\/api\/auth\/reset-password$/],
  ["GET", /^\/api\/invitations\/accept\/[^/]+$/],
  ["POST", /^\/api\/invitations\/accept\/[^/]+$/],
  ["GET", /^\/api\/health(?:\/(?:live|ready))?$/],
  ["POST", /^\/api\/public-bookings$/],
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
  [/^\/api\/branches(?:\/|$)/, "branches"],
  [/^\/api\/facetrack-attendance(?:\/|$)/, "facetrack-attendance"],
  [/^\/api\/settings(?:\/|$)/, "settings"],
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
  return branch === "All branches";
}

export function canAccessBranch(actor, targetBranch) {
  if (!actor || !actor.role) return false;
  if (!targetBranch) return false;
  if (isAllBranches(actor.branch) || isAllBranches(targetBranch)) return true;
  return actor.branch === targetBranch;
}

export function canMutateBranch(actor, targetBranch) {
  if (!actor || !actor.role || !targetBranch) return false;
  return isAllBranches(actor.branch) || actor.branch === targetBranch;
}

export function moduleAllowed(actor, moduleId, roleAccess) {
  return Boolean(actor?.role && (roleAccess[actor.role] || []).includes(moduleId));
}

export function branchWhere(actor, field = "branch") {
  if (!actor || isAllBranches(actor.branch)) return {};
  return { OR: [{ [field]: actor.branch }, { [field]: "All branches" }] };
}

export function filterServiceBranches(rows, actor) {
  if (!actor || isAllBranches(actor.branch)) return rows;
  return rows.filter((row) => {
    try {
      const branches = Array.isArray(row.branches) ? row.branches : JSON.parse(row.branches || "[]");
      return !branches.length || branches.includes(actor.branch) || branches.includes("All branches");
    } catch {
      return false;
    }
  });
}

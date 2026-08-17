import { canManageOrganization } from "../src/organizationRoles.js";

export const ALL_BRANCHES_ID = "all";
export const branchStatuses = Object.freeze(["Active", "Inactive", "Archived"]);

export const accountAccessInclude = Object.freeze({
  staff: true,
  organization: {
    include: {
      branches: {
        include: {
          modules: true,
          memberships: {
            where: { status: "Active" },
            select: { id: true, accountId: true, role: true, permissions: true, modules: true, status: true, isPrimary: true },
          },
        },
        orderBy: [{ name: "asc" }],
      },
    },
  },
  branchMemberships: {
    include: { branch: { include: { modules: true } } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  },
});

function clean(value) {
  return String(value ?? "").trim();
}

export function parsePermissionList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(clean(value) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function normalizeBranchCode(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function enabledModulesForBranch(branch, fallbackModules = []) {
  const moduleRows = Array.isArray(branch?.modules) ? branch.modules : [];
  if (!moduleRows.length) return [...fallbackModules];
  if (!fallbackModules.length) return moduleRows.filter((item) => item.enabled).map((item) => item.moduleId);
  const configured = new Map(moduleRows.map((item) => [item.moduleId, item.enabled]));
  return [...fallbackModules].filter((moduleId) => configured.get(moduleId) !== false);
}

function serializeBranchAccess(branch, membership, fallbackModules) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    status: membership?.status || "Active",
    branchStatus: branch.status,
    role: membership?.role || "",
    permissions: parsePermissionList(membership?.permissions),
    modules: (() => {
      const enabled = enabledModulesForBranch(branch, fallbackModules);
      const explicit = parsePermissionList(membership?.modules);
      return explicit.length ? explicit.filter((moduleId) => enabled.includes(moduleId)) : enabled;
    })(),
    isPrimary: Boolean(membership?.isPrimary),
  };
}

export function resolveAccountBranchAccess(account, requestedBranchId, roleAccess) {
  const organizationWide = Boolean(
    canManageOrganization(account?.role) || account?.organizationWideAccess,
  );
  const roleModules = roleAccess[account?.role] || [];
  const organizationModules = parsePermissionList(account?.organizationModules);
  const baseModules = organizationWide && organizationModules.length
    ? roleModules.filter((moduleId) => organizationModules.includes(moduleId))
    : roleModules;
  const organizationBranches = (account?.organization?.branches || []).filter((branch) => branch.status === "Active");
  const memberships = (account?.branchMemberships || []).filter((membership) => (
    membership.status === "Active" && membership.branch?.status === "Active"
  ));

  let branches = organizationWide
    ? organizationBranches.map((branch) => serializeBranchAccess(branch, null, baseModules))
    : memberships.map((membership) => serializeBranchAccess(
      membership.branch,
      membership,
      roleAccess[membership.role] || baseModules,
    ));
  if (!organizationWide && !branches.length && clean(account?.branch) && account.branch !== "All branches") {
    branches = [{
      id: clean(account?.lastBranchId) || clean(account.branch),
      name: clean(account.branch),
      code: "",
      status: "Active",
      branchStatus: "Active",
      role: account.role,
      permissions: [],
      modules: [...baseModules],
      isPrimary: true,
    }];
  }

  const explicitRequest = clean(requestedBranchId);
  const requested = clean(explicitRequest || account?.lastBranchId || (organizationWide ? ALL_BRANCHES_ID : ""));
  let scope = "branch";
  let activeBranch = null;

  if (organizationWide && (requested.toLowerCase() === ALL_BRANCHES_ID || requested === "All branches")) {
    scope = "all";
  } else {
    const preferredId = requested || clean(account?.lastBranchId);
    activeBranch = branches.find((branch) => branch.id === preferredId)
      || branches.find((branch) => branch.isPrimary)
      || branches[0]
      || null;
  }

  if (explicitRequest && explicitRequest.toLowerCase() !== ALL_BRANCHES_ID && explicitRequest !== "All branches" && !branches.some((branch) => branch.id === explicitRequest)) {
    throw Object.assign(new Error("You do not have access to the requested branch."), { status: 403 });
  }
  if (!organizationWide && (requested.toLowerCase() === ALL_BRANCHES_ID || requested === "All branches")) {
    throw Object.assign(new Error("All Branches is restricted to organization-wide accounts."), { status: 403 });
  }
  if (scope === "branch" && !activeBranch) {
    throw Object.assign(new Error("This account has no active branch assignment."), { status: 403 });
  }

  const activeRole = activeBranch?.role || account?.role || "";
  const activeRoleModules = roleAccess[activeRole] || baseModules;
  let modules = organizationWide
    ? (scope === "branch" ? baseModules.filter((moduleId) => activeBranch.modules.includes(moduleId)) : baseModules)
    : activeRoleModules.filter((moduleId) => activeBranch.modules.includes(moduleId));
  const organizationPermissions = parsePermissionList(account?.organizationPermissions);
  if (organizationPermissions.includes("branches.manage") && !modules.includes("branches")) modules = [...modules, "branches"];

  return {
    active: account?.status === "Active" && modules.length > 0,
    scope,
    organizationWide,
    organizationId: account?.organizationId || "",
    activeBranch,
    activeBranchId: scope === "all" ? ALL_BRANCHES_ID : activeBranch?.id || "",
    branches,
    modules,
    permissions: activeBranch?.permissions || [],
  };
}

export function branchManagementInclude() {
  return {
    rooms: { orderBy: { createdAt: "asc" } },
    modules: { orderBy: { moduleId: "asc" } },
    memberships: {
      where: { status: "Active" },
      include: { account: { select: { id: true, name: true, email: true, role: true, status: true, staffId: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    },
  };
}

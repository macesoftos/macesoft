import { canManageOrganization } from "../src/organizationRoles.js";

export const INVITATION_STATUSES = Object.freeze(["Pending", "Accepted", "Expired", "Revoked"]);
export const INVITATION_DELIVERY_STATUSES = Object.freeze(["Not Sent", "Sent", "Failed"]);
export const BRANCH_MANAGER_ROLES = Object.freeze(["Branch Manager", "Admin"]);
export const INVITATION_PERMISSIONS = Object.freeze([
  "staff.invite",
  "staff.invite_cross_branch",
  "staff.invite_managers",
  "staff.manage",
]);

export const BRANCH_ADMIN_REQUIRED_PERMISSIONS = Object.freeze([
  "staff.invite",
  "staff.invite_cross_branch",
  "staff.manage",
]);

export const INVITATION_PERMISSION_LABELS = Object.freeze({
  "staff.invite": "Invite employees",
  "staff.invite_cross_branch": "Invite employees to other branches",
  "staff.invite_managers": "Invite branch managers",
  "staff.manage": "Manage employee access",
});

function invitationError(message, status) {
  return Object.assign(new Error(message), { status });
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

export function uniqueStrings(value, maximum = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].slice(0, maximum);
}

export function actorPermissions(actor) {
  return uniqueStrings(actor?.access?.permissions);
}

export function isBranchManager(role) {
  return BRANCH_MANAGER_ROLES.includes(String(role || ""));
}

export function canInviteUsers(actor) {
  if (canManageOrganization(actor?.role)) return true;
  return isBranchManager(actor?.role) && actorPermissions(actor).includes("staff.invite");
}

export function canInviteManagers(actor) {
  return canManageOrganization(actor?.role)
    || (isBranchManager(actor?.role) && actorPermissions(actor).includes("staff.invite_managers"));
}

export function canInviteAcrossBranches(actor) {
  return canManageOrganization(actor?.role)
    || (isBranchManager(actor?.role) && actorPermissions(actor).includes("staff.invite_cross_branch"));
}

export function invitationBranchIdsForActor(actor) {
  if (canManageOrganization(actor?.role)) return [];
  if (canInviteAcrossBranches(actor)) {
    return uniqueStrings((actor?.access?.branches || [])
      .filter((branch) => branch?.status === "Active" && branch?.branchStatus === "Active")
      .map((branch) => branch.id));
  }
  return uniqueStrings([actor?.access?.activeBranchId]);
}

export function assignableInvitationRoles(actor, roleAccess) {
  const roles = Object.keys(roleAccess || {});
  if (canManageOrganization(actor?.role)) return roles;
  if (!canInviteUsers(actor)) return [];
  return roles.filter((role) => {
    if (canManageOrganization(role)) return false;
    if (isBranchManager(role)) return canInviteManagers(actor);
    return true;
  });
}

export function assertAssignableInvitationRole(actor, role, roleAccess) {
  if (!assignableInvitationRoles(actor, roleAccess).includes(role)) {
    throw invitationError("You are not authorized to assign this role.", 403);
  }
  return role;
}

export function assertPrivilegedConfirmation(actor, role, confirmed) {
  if (!canManageOrganization(role)) return;
  if (!canManageOrganization(actor?.role)) {
    throw invitationError("Only an Owner or Super Admin may invite an organization-wide administrator.", 403);
  }
  if (confirmed !== true) {
    throw invitationError("Confirm organization-wide access before sending this invitation.", 400);
  }
}

export function assertRequestedPermissions(actor, requested) {
  const permissions = uniqueStrings(requested, INVITATION_PERMISSIONS.length);
  const unknown = permissions.find((permission) => !INVITATION_PERMISSIONS.includes(permission));
  if (unknown) {
    throw invitationError(`Unknown invitation permission: ${unknown}.`, 400);
  }
  if (!canManageOrganization(actor?.role)) {
    const possessed = new Set(actorPermissions(actor));
    const excessive = permissions.find((permission) => !possessed.has(permission));
    if (excessive) {
      throw invitationError("You cannot grant a permission that you do not possess.", 403);
    }
  }
  return permissions;
}

export function assertRequestedModules(actor, role, requested, branches, roleAccess) {
  const roleModules = new Set(roleAccess?.[role] || []);
  const branchModuleSettings = (branches || []).map((branch) => new Map(
    (branch.modules || []).map((module) => [module.moduleId, module.enabled]),
  ));
  const defaults = [...roleModules].filter((moduleId) => (
    branchModuleSettings.every((modules) => modules.get(moduleId) !== false)
  ));
  const modules = requested === undefined ? defaults : uniqueStrings(requested, 100);
  const invalidForRole = modules.find((moduleId) => !roleModules.has(moduleId));
  if (invalidForRole) {
    throw invitationError(`${invalidForRole} is not available to the selected role.`, 403);
  }
  const disabled = modules.find((moduleId) => branchModuleSettings.some((settings) => settings.get(moduleId) === false));
  if (disabled) {
    throw invitationError(`${disabled} is disabled for one or more selected branches.`, 403);
  }
  if (!canManageOrganization(actor?.role)) {
    const possessed = new Set(actor?.access?.modules || []);
    const excessive = modules.find((moduleId) => !possessed.has(moduleId));
    if (excessive) {
      throw invitationError("You cannot grant module access that you do not possess.", 403);
    }
  }
  return modules;
}

export function invitationScopeWhere(actor) {
  if (canManageOrganization(actor?.role)) return { organizationId: actor.organizationId };
  if (canInviteAcrossBranches(actor)) {
    return { organizationId: actor.organizationId, branches: { some: {} } };
  }
  const branchIds = invitationBranchIdsForActor(actor);
  return {
    organizationId: actor.organizationId,
    branches: { some: { branchId: { in: branchIds } } },
  };
}

export function canManageInvitation(actor, invitation) {
  if (!invitation || invitation.organizationId !== actor?.organizationId) return false;
  if (canManageOrganization(actor?.role)) return true;
  if (!canInviteUsers(actor)) return false;
  const branchIds = (invitation.branches || []).map((item) => item.branchId);
  if (canInviteAcrossBranches(actor)) {
    return branchIds.length > 0 && invitation.invitedById === actor.id;
  }
  const allowedBranchIds = new Set(invitationBranchIdsForActor(actor));
  return branchIds.length > 0
    && branchIds.every((branchId) => allowedBranchIds.has(branchId))
    && invitation.invitedById === actor.id;
}

export function sanitizeInvitationMessage(value, maximum = 1000) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maximum);
}

export const ORGANIZATION_MANAGER_ROLES = Object.freeze([
  "Owner",
  "Business Owner",
  "Super Admin",
  "Admin",
]);

export const BUSINESS_OWNER_ROLES = Object.freeze(["Owner", "Business Owner"]);

export function canManageOrganization(role) {
  return ORGANIZATION_MANAGER_ROLES.includes(String(role || ""));
}

export function isBusinessOwner(role) {
  return BUSINESS_OWNER_ROLES.includes(String(role || ""));
}

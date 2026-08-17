import { hasOrganizationWideAccess, hasValidBranchAssignment } from "./accessControl.js";

const allBranchesLabel = "All branches";

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeNotificationBranches(value, fallback = allBranchesLabel) {
  let values = value;
  if (!Array.isArray(values)) {
    try {
      const parsed = JSON.parse(clean(value) || "[]");
      values = Array.isArray(parsed) ? parsed : [];
    } catch {
      values = clean(value) ? clean(value).split(",") : [];
    }
  }

  const branches = [...new Set(values.map(clean).filter(Boolean))];
  return branches.length ? branches : [fallback];
}

export function notificationWhereForActor(actor, allowedModules) {
  const moduleWhere = { module: { in: Array.isArray(allowedModules) ? allowedModules : [] } };
  const branch = clean(actor?.branch);
  const untargetedBranchWhere = actor?.access?.scope === "all" || (hasOrganizationWideAccess(actor) && !actor?.access)
    ? { recipientAccountIds: { isEmpty: true } }
    : !hasValidBranchAssignment(actor)
      ? { id: { in: [] } }
      : {
        recipientAccountIds: { isEmpty: true },
        OR: [
          { branches: { has: allBranchesLabel } },
          { branches: { has: branch } },
        ],
      };
  return {
    ...moduleWhere,
    OR: [
      ...(actor?.id ? [{ recipientAccountIds: { has: actor.id } }] : []),
      untargetedBranchWhere,
    ],
  };
}

export function notificationIsUnread(notification, readAt) {
  if (!readAt) return true;
  return new Date(notification.createdAt).getTime() > new Date(readAt).getTime();
}

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
  const where = {
    module: { in: Array.isArray(allowedModules) ? allowedModules : [] },
  };
  const branch = clean(actor?.branch);
  if (!branch || branch === allBranchesLabel) return where;
  return {
    ...where,
    OR: [
      { branches: { has: allBranchesLabel } },
      { branches: { has: branch } },
    ],
  };
}

export function notificationIsUnread(notification, readAt) {
  if (!readAt) return true;
  return new Date(notification.createdAt).getTime() > new Date(readAt).getTime();
}

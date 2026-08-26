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
  const accountId = clean(actor?.id);
  const organizationId = clean(actor?.organizationId);
  if (!accountId || !organizationId) return { id: { in: [] } };
  return {
    organizationId,
    module: { in: Array.isArray(allowedModules) ? allowedModules : [] },
    recipientAccountIds: { has: accountId },
  };
}

export function notificationIsUnread(notification, readAt) {
  if (!readAt) return true;
  return new Date(notification.createdAt).getTime() > new Date(readAt).getTime();
}

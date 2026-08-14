function posError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizedRole(value) {
  const role = clean(value).toLowerCase();
  if (["business owner", "business-owner", "owner"].includes(role)) return "owner";
  return role;
}

export function inventoryWhereForBranch(id, branch) {
  return {
    id: clean(id),
    OR: [{ branch: clean(branch) }, { branch: "All branches" }],
  };
}

/**
 * @param {any} discount
 * @param {{ role?: string, client?: any, items?: any[], today?: Date }} [options]
 */
export function assertDiscountUsable(discount, { role, client, items = [], today = new Date() } = {}) {
  if (!discount) throw posError("The selected discount does not exist.", 404);
  if (!discount.active) throw posError(`Discount ${discount.name} is inactive.`, 409);

  const actorRole = normalizedRole(role);
  const requiredRole = normalizedRole(discount.permission);
  const allowed = actorRole === "admin"
    || actorRole === "owner"
    || actorRole === requiredRole
    || (actorRole === "branch manager" && ["branch manager", "cashier", "receptionist"].includes(requiredRole));
  if (requiredRole && !allowed) {
    throw posError(`${discount.name} requires ${discount.permission} approval.`, 403);
  }

  const expiry = clean(discount.expiry);
  const todayText = today.toISOString().slice(0, 10);
  if (expiry && expiry.toLowerCase() !== "none" && expiry < todayText) {
    throw posError(`${discount.name} expired on ${expiry}.`, 409);
  }

  const applicable = clean(discount.applicable).toLowerCase();
  const hasService = items.some((item) => clean(item.type).toLowerCase() === "service");
  const hasProduct = items.some((item) => clean(item.type).toLowerCase() === "product");
  if (!applicable || applicable === "services and products") return;
  if (applicable.includes("owner approval")) {
    if (!["owner", "admin"].includes(actorRole)) throw posError(`${discount.name} requires owner approval.`, 403);
    return;
  }
  if (applicable.includes("selected client")) {
    if (!client?.id) throw posError(`${discount.name} requires a selected client.`, 409);
    return;
  }
  if (applicable.includes("birthday")) {
    const birthday = clean(client?.birthday);
    if (!client?.id || !/^\d{4}-\d{2}-\d{2}$/.test(birthday) || birthday.slice(5, 7) !== todayText.slice(5, 7)) {
      throw posError(`${discount.name} is only valid during the selected client's birthday month.`, 409);
    }
    return;
  }
  if (applicable === "services" && (!hasService || hasProduct)) {
    throw posError(`${discount.name} only applies to services.`, 409);
  }
  if (applicable === "products" && (!hasProduct || hasService)) {
    throw posError(`${discount.name} only applies to products.`, 409);
  }
}

export function assertPackageOwnedByClient(pkg, clientId) {
  const selectedClientId = clean(clientId);
  if (!selectedClientId) throw posError("Select the client who owns this package.", 409);
  if (!pkg?.clientId || pkg.clientId !== selectedClientId) {
    throw posError(`Package ${pkg?.name || "selected"} belongs to another client.`, 403);
  }
}

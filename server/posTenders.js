// Validation and settlement rules for non-cash POS tenders: gift
// certificates and prepaid clinic packages. Pure functions so the rules
// stay unit-testable without a database.

function tenderError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function parseExpiry(text) {
  const value = clean(text);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// A record dated "2026-07-15" stays usable through the end of July 15.
export function isExpired(expiryText, today = new Date()) {
  const expiry = parseExpiry(expiryText);
  if (!expiry) return false;
  const endOfExpiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate(), 23, 59, 59, 999);
  return today.getTime() > endOfExpiryDay.getTime();
}

function branchMatches(recordBranch, saleBranch) {
  const record = clean(recordBranch);
  return !record || record === "All branches" || record === clean(saleBranch);
}

/** @param {{ branch?: string, amount?: number, today?: Date }} [options] */
export function assertGiftCertificateUsable(certificate, options = {}) {
  const { branch, amount, today = new Date() } = options;
  if (!certificate) {
    throw tenderError("Gift certificate not found.", 404);
  }
  if (clean(certificate.status) !== "Active") {
    throw tenderError(`Gift certificate ${certificate.code} is ${clean(certificate.status) || "inactive"}.`, 409);
  }
  if (isExpired(certificate.expires, today)) {
    throw tenderError(`Gift certificate ${certificate.code} expired on ${clean(certificate.expires)}.`, 409);
  }
  if (branch && !branchMatches(certificate.branch, branch)) {
    throw tenderError(`Gift certificate ${certificate.code} is only valid at ${certificate.branch}.`, 409);
  }
  const charge = Number(amount || 0);
  if (charge <= 0) {
    throw tenderError("Gift certificate payment amount must be greater than zero.");
  }
  if (charge > Number(certificate.balance || 0)) {
    throw tenderError(`Gift certificate ${certificate.code} only has ${Number(certificate.balance || 0)} remaining.`, 409);
  }
}

export function giftCertificateAfterPayment(certificate, amount) {
  const balance = Math.max(0, Number(certificate.balance || 0) - Number(amount || 0));
  return { balance, status: balance <= 0 ? "Used" : certificate.status };
}

/** @param {{ branch?: string, today?: Date }} [options] */
export function assertPackageRedeemable(pkg, options = {}) {
  const { branch, today = new Date() } = options;
  if (!pkg) {
    throw tenderError("Package not found.", 404);
  }
  if (clean(pkg.status) !== "Active" && clean(pkg.status) !== "") {
    throw tenderError(`Package ${pkg.name} is ${clean(pkg.status)} and cannot be redeemed.`, 409);
  }
  if (Number(pkg.used || 0) >= Number(pkg.sessions || 0)) {
    throw tenderError(`Package ${pkg.name} has no remaining sessions.`, 409);
  }
  if (isExpired(pkg.expires, today)) {
    throw tenderError(`Package ${pkg.name} expired on ${clean(pkg.expires)}.`, 409);
  }
  if (branch && !pkg.transferable && !branchMatches(pkg.branch, branch)) {
    throw tenderError(`Package ${pkg.name} is only valid at ${pkg.branch}.`, 409);
  }
}

export function packageAfterRedemption(pkg, sessionsRedeemed = 1) {
  const used = Math.min(Number(pkg.sessions || 0), Number(pkg.used || 0) + sessionsRedeemed);
  return { used, status: used >= Number(pkg.sessions || 0) ? "Completed" : "Active" };
}

export function packageAfterVoid(pkg, sessionsRestored = 1) {
  const used = Math.max(0, Number(pkg.used || 0) - sessionsRestored);
  return { used, status: used >= Number(pkg.sessions || 0) ? "Completed" : "Active" };
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function list(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isClockedInAtBranch(person, branch) {
  return normalized(person?.status) !== "inactive"
    && person?.clockedIn === true
    && normalized(person?.attendanceBranch) === normalized(branch);
}

export function eligiblePosProviders(staff, service) {
  const allowedRoles = list(service?.staff).map(normalized);
  if (!allowedRoles.length || allowedRoles.includes("all staff")) return staff;
  return staff.filter((person) => allowedRoles.includes(normalized(person?.role)));
}

const apiBase = "";
let apiSessionContext = null;

export function setApiSessionContext(session) {
  apiSessionContext = session
    ? {
        id: session.id,
        name: session.name,
        role: session.role,
        branch: session.branch,
      }
    : null;
}

function sessionHeaders() {
  if (!apiSessionContext) return {};
  return {
    "X-Mace-User-Id": apiSessionContext.id ?? "",
    "X-Mace-User-Name": apiSessionContext.name ?? "",
    "X-Mace-Role": apiSessionContext.role ?? "",
    "X-Mace-Branch": apiSessionContext.branch ?? "All branches",
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...sessionHeaders(),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  if (!response.ok) {
    throw new Error(payload?.error || "The clinic API request failed.");
  }

  if (!isJson) {
    throw new Error("The clinic API did not return JSON.");
  }

  return payload;
}

export function loginAccount(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function restoreAccountSession() {
  return requestJson("/api/auth/session");
}

export function logoutAccount() {
  return requestJson("/api/auth/logout", { method: "POST" });
}

export function changeAccountPassword(currentPassword, newPassword) {
  return requestJson("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function loadMyWorkspace() {
  return requestJson("/api/me/workspace");
}

export function createBranchRecord(values) {
  return requestJson("/api/branches", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function recordAttendance(type, note = "") {
  return requestJson("/api/me/attendance", {
    method: "POST",
    body: JSON.stringify({ type, note }),
  });
}

export function loadFaceTrackOverview() {
  return requestJson("/api/facetrack-attendance/overview");
}

export function createFaceTrackChallenge(purpose) {
  return requestJson("/api/facetrack-attendance/challenge", {
    method: "POST",
    body: JSON.stringify({ purpose }),
  });
}

export function enrollFaceTrackProfile(payload) {
  return requestJson("/api/facetrack-attendance/enroll", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordFaceTrackAttendance(payload) {
  return requestJson("/api/facetrack-attendance/clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createFaceTrackKiosk(payload) {
  return requestJson("/api/facetrack-attendance/kiosks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function kioskHeaders(token) {
  return { "Content-Type": "application/json", "X-FaceTrack-Kiosk-Token": token };
}

export function loadFaceTrackKioskStatus(token) {
  return requestJson("/api/facetrack-attendance/kiosk/status", { headers: kioskHeaders(token) });
}

export function createFaceTrackKioskChallenge(token) {
  return requestJson("/api/facetrack-attendance/kiosk/challenge", {
    method: "POST",
    headers: kioskHeaders(token),
    body: JSON.stringify({ purpose: "KIOSK_CLOCK" }),
  });
}

export function recordFaceTrackKioskAttendance(token, payload) {
  return requestJson("/api/facetrack-attendance/kiosk/clock", {
    method: "POST",
    headers: kioskHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function unlockFaceTrackKiosk(token, pin) {
  return requestJson("/api/facetrack-attendance/kiosk/unlock", {
    method: "POST",
    headers: kioskHeaders(token),
    body: JSON.stringify({ pin }),
  });
}

export function submitFaceTrackCorrection(payload) {
  return requestJson("/api/facetrack-attendance/correction-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reviewFaceTrackCorrection(id, payload) {
  return requestJson(`/api/facetrack-attendance/correction-requests/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveFaceTrackPolicy(payload) {
  return requestJson("/api/facetrack-attendance/policy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function reviewFaceTrackOvertime(id, payload) {
  return requestJson(`/api/facetrack-attendance/records/${encodeURIComponent(id)}/overtime`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkApiHealth() {
  return requestJson("/api/health");
}

export function loadBootstrap() {
  return requestJson("/api/bootstrap");
}

export function loadClients() {
  return requestJson("/api/clients");
}

export function saveClientRecord(client, { existing = false } = {}) {
  const id = encodeURIComponent(client.id);
  return requestJson(existing ? `/api/clients/${id}` : "/api/clients", {
    method: existing ? "PUT" : "POST",
    body: JSON.stringify(client),
  });
}

export function deleteClientRecord(id) {
  return requestJson(`/api/clients/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function sendMarketingCampaign(payload) {
  return requestJson("/api/marketing/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadModuleRegistry() {
  return requestJson("/api/modules");
}

export function saveResourceRecord(resource, record, { existing = false } = {}) {
  const id = encodeURIComponent(record.id);
  return requestJson(existing ? `/api/resources/${resource}/${id}` : `/api/resources/${resource}`, {
    method: existing ? "PUT" : "POST",
    body: JSON.stringify(record),
  });
}

export function deleteResourceRecord(resource, id) {
  return requestJson(`/api/resources/${resource}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function saveSettingsRecord(settings) {
  return requestJson("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function submitPublicBooking(payload) {
  return requestJson("/api/public-bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function postInventoryMovement(id, movement) {
  return requestJson(`/api/inventory/${encodeURIComponent(id)}/movements`, {
    method: "POST",
    body: JSON.stringify(movement),
  });
}

export function loadLeadIntegrations() {
  return requestJson("/api/leads/integrations");
}

export function loadLeadWebhookEvents() {
  return requestJson("/api/leads/webhook-events");
}

export function updateLeadStage(id, payload) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/stage`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addLeadActivity(id, payload) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/activities`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function scheduleLeadFollowUp(id, payload) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/follow-ups`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bookLeadAppointment(id, payload) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function convertLeadToClient(id, payload = {}) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/convert`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function mergeLeadDuplicate(id, payload) {
  return requestJson(`/api/leads/${encodeURIComponent(id)}/merge`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function redeemPackageRecord(id) {
  return requestJson(`/api/packages/${encodeURIComponent(id)}/redeem`, {
    method: "POST",
  });
}

export function voidTransactionRecord(id) {
  return requestJson(`/api/transactions/${encodeURIComponent(id)}/void`, {
    method: "POST",
  });
}

export function completePosCheckout(draft, payment) {
  return requestJson("/api/pos/checkout", {
    method: "POST",
    body: JSON.stringify({ draft, payment }),
  });
}

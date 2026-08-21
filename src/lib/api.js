const apiBase = "";
export const apiAuthenticationRequiredEvent = "macesoft:authentication-required";
export const apiNotificationCreatedEvent = "macesoft:notification-created";

let apiSessionActive = false;
let apiBranchId = "";

export function setApiSessionContext(session) {
  apiSessionActive = Boolean(session);
  apiBranchId = session?.access?.activeBranchId || "";
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Request": "app",
      ...(apiBranchId ? { "X-Mace-Branch-Id": apiBranchId } : {}),
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
    if (response.status === 401 && apiSessionActive && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(apiAuthenticationRequiredEvent));
    }
    throw new Error(payload?.error || "The clinic API request failed.");
  }

  if (!isJson) {
    throw new Error("The clinic API did not return JSON.");
  }

  if (payload?.notification && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(apiNotificationCreatedEvent, { detail: payload.notification }));
  }

  return payload;
}

export function loginAccount(email, password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function requestPasswordReset(email) {
  return requestJson("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetAccountPassword(token, newPassword) {
  return requestJson("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) });
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

export function loadInvitations() {
  return requestJson("/api/invitations");
}

export function loadOrganizationAccounts() {
  return requestJson("/api/accounts");
}

export function linkStaffAccount(staffId, accountId) {
  return requestJson(`/api/staff/${encodeURIComponent(staffId)}/account`, {
    method: "PUT",
    body: JSON.stringify({ accountId }),
  });
}

export function createInvitation(payload) {
  return requestJson("/api/invitations", { method: "POST", body: JSON.stringify(payload) });
}

export function editInvitation(id, payload) {
  return requestJson(`/api/invitations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function resendInvitation(id) {
  return requestJson(`/api/invitations/${encodeURIComponent(id)}/resend`, { method: "POST" });
}

export function revokeInvitation(id) {
  return requestJson(`/api/invitations/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export function inspectInvitation(token) {
  return requestJson(`/api/invitations/accept/${encodeURIComponent(token)}`);
}

export function acceptInvitation(token, payload) {
  return requestJson(`/api/invitations/accept/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify(payload) });
}

export function updateAccountAccess(id, payload) {
  return requestJson(`/api/accounts/${encodeURIComponent(id)}/access`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function loadMyWorkspace() {
  return requestJson("/api/me/workspace");
}

export function selectActiveBranch(branchId) {
  return requestJson("/api/me/active-branch", {
    method: "POST",
    body: JSON.stringify({ branchId }),
  });
}

export function createBranchRecord(values) {
  return requestJson("/api/branches", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateBranchRecord(id, values) {
  return requestJson(`/api/branches/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
}

export function deleteBranchRecord(id, confirmationName, reassignTo = "") {
  return requestJson(`/api/branches/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmationName, reassignTo }),
  });
}

export function archiveBranchRecord(id) {
  return requestJson(`/api/branches/${encodeURIComponent(id)}/archive`, { method: "POST", body: "{}" });
}

export function reactivateBranchRecord(id) {
  return requestJson(`/api/branches/${encodeURIComponent(id)}/reactivate`, { method: "POST", body: "{}" });
}

export function updateBranchModules(id, enabledModules) {
  return requestJson(`/api/branches/${encodeURIComponent(id)}/modules`, {
    method: "PUT",
    body: JSON.stringify({ enabledModules }),
  });
}

export function updateBranchMemberships(id, assignments, { replace = false } = {}) {
  return requestJson(`/api/branches/${encodeURIComponent(id)}/memberships`, {
    method: "PUT",
    body: JSON.stringify({ assignments, replace }),
  });
}

export function createRoomRecord(values) {
  return requestJson("/api/rooms", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function deleteRoomRecord(id) {
  return requestJson(`/api/rooms/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function uploadImageAsset(dataUrl, category, branch, originalName = "") {
  return requestJson("/api/uploads", {
    method: "POST",
    body: JSON.stringify({ dataUrl, category, branch, originalName }),
  });
}

export function loadMarketingMedia({ includeDeleted = false } = {}) {
  return requestJson(`/api/marketing/media${includeDeleted ? "?status=all" : ""}`);
}

export function moveMarketingMediaToDeleted({ ids = [], all = false } = {}) {
  return requestJson("/api/marketing/media/delete", {
    method: "POST",
    body: JSON.stringify({ ids, all }),
  });
}

export function restoreMarketingMedia({ ids = [], all = false } = {}) {
  return requestJson("/api/marketing/media/restore", {
    method: "POST",
    body: JSON.stringify({ ids, all }),
  });
}

export function deleteMarketingMediaForever({ ids = [], all = false } = {}) {
  return requestJson("/api/marketing/media/permanent", {
    method: "DELETE",
    body: JSON.stringify({ ids, all }),
  });
}

export function loadMarketingEmailTemplates() {
  return requestJson("/api/marketing/templates");
}

export function saveMarketingEmailTemplate(template, { existing = false } = {}) {
  const path = existing ? `/api/marketing/templates/${encodeURIComponent(template.id)}` : "/api/marketing/templates";
  return requestJson(path, {
    method: existing ? "PUT" : "POST",
    body: JSON.stringify(template),
  });
}

export function deleteMarketingEmailTemplate(id) {
  return requestJson(`/api/marketing/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function loadMarketingAudienceMembers() {
  return requestJson("/api/marketing/audience-members");
}

export function addMarketingAudienceMember(member) {
  return requestJson("/api/marketing/audience-members", {
    method: "POST",
    body: JSON.stringify(member),
  });
}

export function importMarketingAudienceMembers(payload) {
  return requestJson("/api/marketing/audience-members/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function requestPublicJson(path, options = {}) {
  const { accessToken = "", viewerId = "", headers = {}, ...fetchOptions } = options;
  const response = await fetch(`${apiBase}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { "X-Flipbook-Access": accessToken } : {}),
      ...(viewerId ? { "X-Flipbook-Viewer": viewerId } : {}),
      ...headers,
    },
    ...fetchOptions,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error(payload?.error || "This flipbook is not available."), { status: response.status });
    throw error;
  }
  return payload;
}

export function uploadTreatmentPhoto(treatmentId, dataUrl, kind) {
  return requestJson(`/api/treatments/${encodeURIComponent(treatmentId)}/photos`, {
    method: "POST",
    body: JSON.stringify({ dataUrl, kind }),
  });
}

export function deleteTreatmentPhoto(treatmentId, photoId) {
  return requestJson(`/api/treatments/${encodeURIComponent(treatmentId)}/photos/${encodeURIComponent(photoId)}`, {
    method: "DELETE",
  });
}

export function listFlipbooks() {
  return requestJson("/api/flipbooks");
}

export function listDeletedFlipbooks() {
  return requestJson("/api/flipbooks/deleted");
}

export function getFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}`);
}

export function uploadFlipbookPdf(file, { title, description, pageCount }, onProgress = (_value) => {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${apiBase}/api/flipbooks`);
    request.withCredentials = true;
    request.responseType = "json";
    request.setRequestHeader("Content-Type", "application/pdf");
    request.setRequestHeader("X-Mace-Request", "app");
    if (apiBranchId) request.setRequestHeader("X-Mace-Branch-Id", apiBranchId);
    request.setRequestHeader("X-Flipbook-Title", encodeURIComponent(title));
    request.setRequestHeader("X-Flipbook-Description", encodeURIComponent(description || ""));
    request.setRequestHeader("X-Flipbook-Pages", String(pageCount));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.response);
        return;
      }
      reject(new Error(request.response?.error || "The PDF could not be uploaded."));
    });
    request.addEventListener("error", () => reject(new Error("The PDF upload was interrupted.")));
    request.addEventListener("abort", () => reject(new Error("The PDF upload was cancelled.")));
    request.send(file);
  });
}

export function updateFlipbook(id, values) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(values) });
}

export function publishFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}/publish`, { method: "POST", body: "{}" });
}

export function unpublishFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}/unpublish`, { method: "POST", body: "{}" });
}

export function duplicateFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: "{}" });
}

export function deleteFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function restoreFlipbook(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" });
}

export function deleteFlipbookForever(id) {
  return requestJson(`/api/flipbooks/${encodeURIComponent(id)}/permanent`, { method: "DELETE" });
}

export function loadFlipbookLinks() {
  return requestJson("/api/flipbooks/shared");
}

export function loadFlipbookAnalytics() {
  return requestJson("/api/flipbooks/analytics");
}

export function loadFlipbookSettings() {
  return requestJson("/api/flipbooks/settings");
}

export function saveFlipbookSettings(values) {
  return requestJson("/api/flipbooks/settings", { method: "PUT", body: JSON.stringify(values) });
}

export function loadPublicFlipbook(token, accessToken, viewerId) {
  return requestPublicJson(`/api/public/flipbooks/${encodeURIComponent(token)}`, { accessToken, viewerId });
}

export function unlockPublicFlipbook(token, password) {
  return requestPublicJson(`/api/public/flipbooks/${encodeURIComponent(token)}/access`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function downloadPublicFlipbook(token, accessToken, title = "flipbook") {
  const response = await fetch(`/api/public/flipbooks/${encodeURIComponent(token)}/file?download=1`, {
    cache: "no-store",
    headers: accessToken ? { "X-Flipbook-Access": accessToken } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "The PDF could not be downloaded.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(title).replace(/[^a-z0-9 _.-]+/gi, "").trim() || "flipbook"}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
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

export function createFaceTrackKiosk(payload) {
  return requestJson("/api/facetrack-attendance/kiosks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadFaceTrackKioskStatus() {
  return requestJson("/api/facetrack-attendance/kiosk/status");
}

export function createFaceTrackKioskChallenge() {
  return requestJson("/api/facetrack-attendance/kiosk/challenge", {
    method: "POST",
    body: JSON.stringify({ purpose: "KIOSK_CLOCK" }),
  });
}

export function recordFaceTrackKioskAttendance(payload) {
  return requestJson("/api/facetrack-attendance/kiosk/clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function unlockFaceTrackKiosk(pin) {
  return requestJson("/api/facetrack-attendance/kiosk/unlock", {
    method: "POST",
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

export function loadNotifications(limit = 30) {
  return requestJson(`/api/notifications?limit=${encodeURIComponent(limit)}`);
}

export function markNotificationsRead(limit = 30) {
  return requestJson("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify({ limit }),
  });
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

export function sendMarketingTestEmail(payload) {
  return requestJson("/api/marketing/send-test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function scheduleMarketingCampaign(id, payload) {
  return requestJson(`/api/marketing/campaigns/${encodeURIComponent(id)}/schedule`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveMarketingCampaign(id) {
  return requestJson(`/api/marketing/campaigns/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function moveMarketingCampaignToDeleted(id) {
  return requestJson(`/api/marketing/campaigns/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function restoreMarketingCampaign(id) {
  return requestJson(`/api/marketing/campaigns/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function deleteMarketingCampaignForever(id) {
  return requestJson(`/api/marketing/campaigns/${encodeURIComponent(id)}/permanent`, {
    method: "DELETE",
  });
}

export function loadModuleRegistry() {
  return requestJson("/api/modules");
}

export function listResourceRecords(resource) {
  return requestJson(`/api/resources/${resource}`);
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

export function loadPublicLeadConfig() {
  return requestJson("/api/public-leads/config");
}

export function submitPublicLead(payload) {
  return requestJson("/api/public-leads", {
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

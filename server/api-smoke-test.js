import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { posCalendarDate } from "./posDate.js";
import { prisma } from "./prisma.js";

const port = Number(process.env.API_SMOKE_PORT || 3101);
const baseUrl = `http://127.0.0.1:${port}`;
const ownerHeaders = {
  "Content-Type": "application/json",
  "X-Mace-User-Id": "u-owner",
  "X-Mace-User-Name": "Dr. Mace",
  "X-Mace-Role": "Owner",
  "X-Mace-Branch": "All branches",
  "X-Mace-Organization-Id": "org-mace",
  "X-Mace-Request": "app",
};
const branchHeaders = (role, branch) => ({
  "Content-Type": "application/json",
  "X-Mace-User-Id": `${role}-${branch}`,
  "X-Mace-User-Name": `${branch} ${role}`,
  "X-Mace-Role": role,
  "X-Mace-Branch": branch,
  "X-Mace-Organization-Id": "org-mace",
  "X-Mace-Request": "app",
});

const smtpMessages = [];
const smtpServer = createServer((socket) => {
  socket.setEncoding("utf8");
  socket.write("220 localhost ESMTP MACE smoke test\r\n");
  let buffer = "";
  let receivingData = false;
  let messageLines = [];

  socket.on("data", (chunk) => {
    buffer += chunk;
    if (buffer.length > 2_000_000) {
      socket.destroy(new Error("SMTP smoke message exceeded the safety limit."));
      return;
    }
    while (buffer.includes("\r\n")) {
      const lineEnd = buffer.indexOf("\r\n");
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      if (receivingData) {
        if (line === ".") {
          smtpMessages.push(messageLines.join("\r\n"));
          messageLines = [];
          receivingData = false;
          socket.write("250 2.0.0 queued\r\n");
        } else {
          messageLines.push(line.startsWith("..") ? line.slice(1) : line);
        }
        continue;
      }
      if (/^(?:EHLO|HELO)\b/i.test(line)) {
        socket.write("250-localhost\r\n250-PIPELINING\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n");
      } else if (/^DATA\b/i.test(line)) {
        receivingData = true;
        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      } else if (/^QUIT\b/i.test(line)) {
        socket.write("221 2.0.0 bye\r\n");
        socket.end();
      } else {
        socket.write("250 2.0.0 ok\r\n");
      }
    }
  });
});

await new Promise((resolve, reject) => {
  smtpServer.once("error", reject);
  smtpServer.listen(0, "127.0.0.1", () => resolve(undefined));
});
const smtpAddress = smtpServer.address();
if (!smtpAddress || typeof smtpAddress === "string") throw new Error("SMTP smoke server did not start on a TCP port.");

async function waitForSmtpMessage(count) {
  const startedAt = Date.now();
  while (smtpMessages.length < count && Date.now() - startedAt < 15_000) await delay(25);
  assert(smtpMessages.length >= count, `SMTP smoke server did not receive message ${count}.`);
  return smtpMessages[count - 1]
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=");
}

function invitationTokenFromMessage(message) {
  const match = message.match(/accept-invitation\?token=([A-Za-z0-9_-]{32,})/);
  assert(match, "invitation email did not contain a secure acceptance link");
  return match[1];
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: `Non-JSON response (${response.status})`, body: text.slice(0, 240) };
    }
  }
  return { response, payload };
}

async function waitForApi() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch {
      // Keep waiting while the server starts.
    }
    await delay(250);
  }
  throw new Error("API did not start within 10 seconds.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function jsonRequest(path, body, options = {}) {
  return request(path, {
    method: options.method ?? "POST",
    headers: ownerHeaders,
    body: JSON.stringify(body),
  });
}

async function jsonRequestAs(path, body, headers, options = {}) {
  return request(path, {
    method: options.method ?? "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const server = spawn(process.execPath, ["server/index.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "test",
    API_PORT: String(port),
    APP_ORIGIN: "http://127.0.0.1:5173",
    LEADS_API_KEY: "smoke-leads-key",
    API_ALLOW_TRUSTED_HEADERS: "true",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpAddress.port),
    SMTP_SECURE: "false",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "MACE Smoke Test <no-reply@mace.test>",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const invitationSmokeEmails = [];

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForApi();

  const health = await request("/api/health");
  assert(health.response.ok && health.payload.ok, "health endpoint failed");

  const unauthenticatedBootstrap = await request("/api/bootstrap");
  assert(unauthenticatedBootstrap.response.status === 401, "unauthenticated bootstrap was not blocked");

  const demoPassword = "demo1234";
  async function createAndOpenDemo(index) {
    const email = `private-demo-${Date.now()}-${index}@example.test`;
    const registration = await request("/api/auth/demo-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Prospect ${index}`, email, password: demoPassword }),
    });
    assert(registration.response.status === 201, `demo registration ${index} failed`);
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: demoPassword }),
    });
    assert(login.response.ok && login.payload.account.role === "Demo User", `demo login ${index} failed`);
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
    assert(cookie, `demo login ${index} did not issue a session cookie`);
    const workspace = await request("/api/bootstrap", { headers: { Cookie: cookie } });
    assert(workspace.response.ok, `demo bootstrap ${index} failed`);
    assert(workspace.payload.clients.length === 4, `demo workspace ${index} did not receive its private clients`);
    assert(workspace.payload.appointments.length === 5, `demo workspace ${index} did not receive its private appointments`);
    assert(workspace.payload.transactions.length === 4, `demo workspace ${index} did not receive its private transactions`);
    assert(workspace.payload.inventory.length === 3, `demo workspace ${index} did not receive its private inventory`);
    assert(workspace.payload.leads.length === 3, `demo workspace ${index} did not receive its private leads`);
    return { account: login.payload.account, cookie, workspace: workspace.payload };
  }

  const firstDemo = await createAndOpenDemo(1);
  const secondDemo = await createAndOpenDemo(2);
  assert(firstDemo.account.organizationId !== secondDemo.account.organizationId, "demo signups shared an organization");
  assert(firstDemo.account.branch !== secondDemo.account.branch, "demo signups shared a branch");
  const firstClientIds = new Set(firstDemo.workspace.clients.map((client) => client.id));
  assert(secondDemo.workspace.clients.every((client) => !firstClientIds.has(client.id)), "demo signups shared client records");
  const demoMutation = await request("/api/resources/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Mace-Request": "app", Cookie: firstDemo.cookie },
    body: JSON.stringify({ fullName: "Private Sandbox Client", branch: firstDemo.account.branch }),
  });
  assert(demoMutation.response.status === 201, "a demo account could not use its private sandbox");
  const firstDemoAfterMutation = await request("/api/bootstrap", { headers: { Cookie: firstDemo.cookie } });
  const secondDemoAfterMutation = await request("/api/bootstrap", { headers: { Cookie: secondDemo.cookie } });
  assert(firstDemoAfterMutation.payload.clients.length === 5, "the first demo did not retain its sandbox change");
  assert(secondDemoAfterMutation.payload.clients.length === 4, "a sandbox change leaked into another demo account");

  const bootstrap = await request("/api/bootstrap", { headers: ownerHeaders });
  assert(bootstrap.response.ok, "bootstrap endpoint failed");
  assert(Array.isArray(bootstrap.payload.clients), "bootstrap clients missing");
  assert(Array.isArray(bootstrap.payload.appointments), "bootstrap appointments missing");
  assert(Array.isArray(bootstrap.payload.transactions), "bootstrap transactions missing");

  const missingPublicMarketingImage = await fetch(`${baseUrl}/api/public/marketing-assets/missing-smoke-asset`);
  assert(missingPublicMarketingImage.status === 404, "public Marketing asset route was not reachable without a session");
  const privateWithoutSession = await fetch(`${baseUrl}/api/uploads/missing-smoke-asset`);
  assert(privateWithoutSession.status === 401, "private image route bypassed session authentication");

  const hasObjectStorage = Boolean(process.env.STORAGE_BASE_URL && process.env.STORAGE_BUCKET && process.env.STORAGE_SERVICE_KEY);
  if (hasObjectStorage) {
    const smokeImageDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlcyYoAAAAASUVORK5CYII=";
    const marketingImageUpload = await jsonRequest("/api/uploads", {
      category: "marketing-image",
      branch: "Mace Davao",
      dataUrl: smokeImageDataUrl,
      originalName: "public-marketing-smoke.png",
    });
    assert(marketingImageUpload.response.status === 201, "marketing image upload failed");
    const marketingAssetId = marketingImageUpload.payload.asset.id;
    const publicMarketingImage = await fetch(`${baseUrl}/api/public/marketing-assets/${encodeURIComponent(marketingAssetId)}`);
    assert(publicMarketingImage.status === 200, "marketing image was not publicly readable");
    assert(publicMarketingImage.headers.get("cross-origin-resource-policy") === "cross-origin", "marketing image blocked cross-origin email rendering");
    assert((await publicMarketingImage.arrayBuffer()).byteLength > 0, "public marketing image was empty");

    const privateImageUpload = await jsonRequest("/api/uploads", {
      category: "client-photo",
      branch: "Mace Davao",
      dataUrl: smokeImageDataUrl,
      originalName: "private-client-smoke.png",
    });
    assert(privateImageUpload.response.status === 201, "private image upload failed");
    const privateAssetId = privateImageUpload.payload.asset.id;
    const privateViaPublicRoute = await fetch(`${baseUrl}/api/public/marketing-assets/${encodeURIComponent(privateAssetId)}`);
    assert(privateViaPublicRoute.status === 404, "private image was exposed through the public Marketing route");
    const movedMarketingImage = await request(`/api/uploads/${encodeURIComponent(marketingAssetId)}`, { method: "DELETE", headers: ownerHeaders });
    assert(movedMarketingImage.response.status === 204, "marketing image was not moved to Deleted");
    const deletedMarketingImage = await jsonRequest("/api/marketing/media/permanent", { ids: [marketingAssetId] }, { method: "DELETE" });
    assert(deletedMarketingImage.response.ok && deletedMarketingImage.payload.count === 1, "marketing image was not permanently removed");
    await request(`/api/uploads/${encodeURIComponent(privateAssetId)}`, { method: "DELETE", headers: ownerHeaders });
  }

  const unauthorized = await request("/api/resources/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: "Unauthorized Smoke", branch: "Mace Davao" }),
  });
  assert(unauthorized.response.status === 401, "unauthorized client create was not blocked");

  const suffix = Date.now().toString(36);
  const clientId = `cl-smoke-${suffix}`;
  const bgcClientId = `cl-smoke-bgc-${suffix}`;
  const appointmentId = `ap-smoke-${suffix}`;
  const treatmentId = `tr-smoke-${suffix}`;
  const serviceId = `svc-smoke-${suffix}`;
  const variablePriceServiceId = `svc-variable-${suffix}`;
  const packageServiceId = `svc-package-${suffix}`;
  const appointmentSeed = Number.parseInt(suffix.slice(-6), 36);
  const appointmentAt = new Date(Date.UTC(2080, 0, 1) + (appointmentSeed % 6_000) * 86_400_000);
  if (appointmentAt.getUTCDay() === 0) appointmentAt.setUTCDate(appointmentAt.getUTCDate() + 1);
  const appointmentDate = appointmentAt.toISOString().slice(0, 10);

  const createdBgcBranch = await jsonRequest("/api/branches", {
    name: "Mace BGC",
    code: "BGC",
    city: "Taguig",
    address: "Bonifacio Global City",
    timezone: "Asia/Manila",
    status: "Active",
    roomCount: 1,
  });
  assert([201, 409].includes(createdBgcBranch.response.status), "BGC branch fixture create failed");

  const createdService = await jsonRequest("/api/resources/services", {
    id: serviceId,
    name: "Automated Smoke Consultation",
    category: "Consultations",
    duration: 45,
    price: 1500,
    recommendedIntervalDays: 21,
    commission: "",
    consumables: [
      { item: "Sterile Syringe Kit", qty: 1 },
      { item: "Botox Units", qty: 0.5 },
    ],
    branches: ["Mace Davao"],
    staff: ["Doctor", "Nurse"],
    room: "Room 1",
    active: true,
    pos: true,
    description: "Created by the API smoke test.",
    contraindications: "",
    aftercare: "Keep the treated area clean and avoid direct sun exposure for 48 hours.",
  });
  assert(createdService.response.status === 201, "service create failed");
  assert(
    createdService.payload.record.consumables?.some((entry) => entry.item === "Botox Units" && entry.qty === 0.5),
    "service consumable defaults were not persisted",
  );
  assert(createdService.payload.notification?.title === "New service", "service create did not emit a notification");

  const createdVariablePriceService = await jsonRequest("/api/resources/services", {
    id: variablePriceServiceId,
    name: "Automated Variable Consultation",
    category: "Consultations",
    serviceType: "Regular",
    duration: 30,
    price: 1000,
    priceModel: "Starts at",
    branches: ["Mace Davao"],
    staff: ["Doctor", "Nurse"],
    room: "Room 1",
    active: true,
    pos: true,
  });
  assert(createdVariablePriceService.response.status === 201, "variable-price service create failed");

  const createdPackageService = await jsonRequest("/api/resources/services", {
    id: packageServiceId,
    name: "Automated Three Session Package",
    category: "Packages",
    serviceType: "Package",
    duration: 45,
    price: 3000,
    priceModel: "Fixed price",
    packageSessions: 3,
    packagePrice: 3000,
    serviceValue: 1000,
    branches: ["Mace Davao"],
    staff: ["Doctor", "Nurse"],
    room: "Room 1",
    active: true,
    pos: true,
  });
  assert(createdPackageService.response.status === 201, "package service create failed");

  const notificationFeed = await request("/api/notifications", { headers: ownerHeaders });
  assert(notificationFeed.response.ok, "notification feed failed");
  assert(
    notificationFeed.payload.notifications.some((notification) => notification.id === createdService.payload.notification.id),
    "new service notification was not present in the feed",
  );
  assert(notificationFeed.payload.unreadCount >= 1, "new service notification was not unread");

  const notificationAccounts = await request("/api/accounts", { headers: ownerHeaders });
  assert(
    notificationAccounts.response.ok && Array.isArray(notificationAccounts.payload?.accounts),
    `notification account list failed (${notificationAccounts.response.status}: ${notificationAccounts.payload?.error || "unknown error"})`,
  );
  const notificationOwner = notificationAccounts.payload.accounts.find((account) => account.role === "Owner");
  assert(notificationOwner?.id, "notification read test could not find an owner account");
  const markedNotifications = await request("/api/notifications/read", {
    method: "POST",
    headers: { ...ownerHeaders, "X-Mace-User-Id": notificationOwner.id },
    body: JSON.stringify({}),
  });
  assert(markedNotifications.response.ok, "mark notifications read failed");
  assert(markedNotifications.payload.unreadCount === 0, "mark notifications read did not clear the unread count");

  const invitationHeaders = { ...ownerHeaders, "X-Mace-User-Id": notificationOwner.id };
  const invitationBranch = bootstrap.payload.branches.find((branch) => branch.name === "Mace Davao");
  assert(invitationBranch?.id, "invitation smoke test could not find an active branch");
  const invitationEmail = `invite-${suffix}@release-test.invalid`;
  invitationSmokeEmails.push(invitationEmail);
  const invitationPayload = {
    firstName: "Invitation",
    lastName: "Smoke",
    email: invitationEmail,
    position: "Front Desk Associate",
    role: "Employee",
    branchIds: [invitationBranch.id],
    modules: ["pos"],
    permissions: [],
    message: "<strong>Welcome</strong> to the invitation smoke test.\u0000",
  };
  const existingAccountInvitation = await jsonRequestAs("/api/invitations", {
    ...invitationPayload,
    email: notificationOwner.email,
  }, invitationHeaders);
  assert(existingAccountInvitation.response.status === 409, "an existing organization account could be invited again");
  const createdInvitation = await jsonRequestAs("/api/invitations", invitationPayload, invitationHeaders);
  assert(
    createdInvitation.response.status === 201,
    `invitation create failed (${createdInvitation.response.status}: ${createdInvitation.payload?.error || "unknown error"})`,
  );
  assert(createdInvitation.payload.invitation.deliveryStatus === "Sent", "invitation delivery was not recorded as sent");
  assert(!Object.hasOwn(createdInvitation.payload.invitation, "tokenHash"), "invitation API exposed the token hash");
  assert(!createdInvitation.payload.invitation.message.includes("<"), "invitation message HTML was not sanitized");
  const acceptanceToken = invitationTokenFromMessage(await waitForSmtpMessage(1));
  const storedInvitation = await prisma.userInvitation.findUnique({ where: { id: createdInvitation.payload.invitation.id } });
  assert(storedInvitation?.tokenHash === createHash("sha256").update(acceptanceToken).digest("hex"), "invitation token was not stored as a SHA-256 hash");
  assert(storedInvitation.tokenHash !== acceptanceToken, "raw invitation token was persisted");

  const inspectedInvitation = await request(`/api/invitations/accept/${encodeURIComponent(acceptanceToken)}`);
  assert(inspectedInvitation.response.ok, "public invitation inspection failed");
  assert(inspectedInvitation.payload.invitation.status === "Pending", "new invitation was not pending");
  assert(inspectedInvitation.payload.invitation.accountExists === false, "new invite incorrectly required an existing account");
  const consentBlocked = await request(`/api/invitations/accept/${encodeURIComponent(acceptanceToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass" }),
  });
  assert(consentBlocked.response.status === 400, "invitation acceptance did not require terms and privacy consent");
  const ownerLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: notificationOwner.email, password: process.env.BOOTSTRAP_OWNER_PASSWORD }),
  });
  assert(ownerLogin.response.ok, "invitation wrong-email test could not sign in the owner fixture");
  const ownerSessionCookie = ownerLogin.response.headers.get("set-cookie")?.split(";")[0];
  assert(ownerSessionCookie, "owner login did not issue a session cookie");
  const wrongEmailAcceptance = await request(`/api/invitations/accept/${encodeURIComponent(acceptanceToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: ownerSessionCookie },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass", termsAccepted: true, privacyAccepted: true }),
  });
  assert(wrongEmailAcceptance.response.status === 403, "a session for another email could accept the invitation");
  const acceptedInvitation = await request(`/api/invitations/accept/${encodeURIComponent(acceptanceToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass", termsAccepted: true, privacyAccepted: true }),
  });
  assert(acceptedInvitation.response.ok, "new recipient could not accept the invitation");
  assert(acceptedInvitation.payload.invitation.status === "Accepted", "accepted invitation status was not persisted");
  assert(acceptedInvitation.payload.account.email === invitationEmail, "accepted invitation created the wrong account");
  assert(acceptedInvitation.payload.account.access.branches.some((branch) => branch.id === invitationBranch.id), "accepted account did not receive its branch membership");
  assert(acceptedInvitation.payload.account.access.modules.length === 1 && acceptedInvitation.payload.account.access.modules.includes("pos"), "accepted branch account was not restricted to POS");
  const reusedInvitation = await request(`/api/invitations/accept/${encodeURIComponent(acceptanceToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass", termsAccepted: true, privacyAccepted: true }),
  });
  assert(reusedInvitation.response.status === 409, "accepted invitation token was reusable");
  const acceptanceAudit = await prisma.auditLog.findFirst({
    where: { subjectType: "Account", subjectId: acceptedInvitation.payload.account.id, action: "Invitation accepted" },
  });
  assert(acceptanceAudit, "invitation acceptance audit record was not created");
  const acceptanceNotification = await prisma.appNotification.findFirst({
    where: { recordId: acceptedInvitation.payload.account.id, recipientAccountIds: { has: notificationOwner.id } },
  });
  assert(acceptanceNotification, "invitation acceptance did not notify a relevant administrator");

  const bgcBranch = await prisma.branch.findFirst({ where: { name: "Mace BGC", status: "Active" } });
  assert(bgcBranch?.id, "existing-user branch invitation could not find Mace BGC");
  await prisma.branchMembership.update({
    where: { branchId_accountId: { branchId: invitationBranch.id, accountId: acceptedInvitation.payload.account.id } },
    data: {
      role: "Admin",
      permissions: JSON.stringify(["staff.invite", "staff.invite_cross_branch", "staff.manage"]),
      modules: JSON.stringify(["pos", "staff", "facetrack-attendance"]),
    },
  });
  const existingUserLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: invitationEmail, password: "SmokeInvite2026!Pass" }),
  });
  assert(existingUserLogin.response.ok && existingUserLogin.payload.account.role === "Admin", "delegated branch Admin could not sign in");
  const existingUserCookie = existingUserLogin.response.headers.get("set-cookie")?.split(";")[0];
  assert(existingUserCookie, "existing invited user login did not issue a session cookie");
  const secondBranchInvitation = await jsonRequestAs("/api/invitations", {
    ...invitationPayload,
    branchIds: [bgcBranch.id],
  }, { "Content-Type": "application/json", "X-Mace-Request": "app", Cookie: existingUserCookie });
  assert(
    secondBranchInvitation.response.status === 201,
    `delegated branch Admin could not invite an existing user to another branch (${secondBranchInvitation.response.status}: ${secondBranchInvitation.payload?.error || "unknown error"})`,
  );
  const secondBranchToken = invitationTokenFromMessage(await waitForSmtpMessage(2));
  const acceptedSecondBranch = await request(`/api/invitations/accept/${encodeURIComponent(secondBranchToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: existingUserCookie },
    body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
  });
  assert(acceptedSecondBranch.response.ok, "existing user could not accept access to another branch");
  assert(acceptedSecondBranch.payload.account.access.activeBranchId === bgcBranch.id, "accepted existing user did not enter the invited branch");
  assert(acceptedSecondBranch.payload.account.access.branches.length === 2, "accepted existing user did not retain both branch memberships");
  assert(acceptedSecondBranch.payload.account.role === "Employee", "second-branch invitation overwrote the existing account role");
  const retainedAdminBranch = acceptedSecondBranch.payload.account.access.branches.find((branch) => branch.id === invitationBranch.id);
  assert(retainedAdminBranch?.role === "Admin", "second-branch invitation overwrote the user's first-branch role");

  const lifecycleEmail = `invite-lifecycle-${suffix}@release-test.invalid`;
  invitationSmokeEmails.push(lifecycleEmail);
  const lifecycleInvitation = await jsonRequestAs("/api/invitations", {
    ...invitationPayload,
    firstName: "Lifecycle",
    email: lifecycleEmail,
    message: "Invitation lifecycle smoke test",
  }, invitationHeaders);
  assert(lifecycleInvitation.response.status === 201, "lifecycle invitation create failed");
  const originalLifecycleToken = invitationTokenFromMessage(await waitForSmtpMessage(3));
  const duplicateInvitation = await jsonRequestAs("/api/invitations", {
    ...invitationPayload,
    email: lifecycleEmail,
  }, invitationHeaders);
  assert(duplicateInvitation.response.status === 409, "duplicate pending invitation was not blocked");
  const resentInvitation = await jsonRequestAs(
    `/api/invitations/${encodeURIComponent(lifecycleInvitation.payload.invitation.id)}/resend`,
    {},
    invitationHeaders,
  );
  assert(resentInvitation.response.ok && resentInvitation.payload.invitation.deliveryStatus === "Sent", "invitation resend failed");
  const replacementLifecycleToken = invitationTokenFromMessage(await waitForSmtpMessage(4));
  assert(replacementLifecycleToken !== originalLifecycleToken, "resend did not rotate the invitation token");
  const invalidatedOriginal = await request(`/api/invitations/accept/${encodeURIComponent(originalLifecycleToken)}`);
  assert(invalidatedOriginal.response.status === 404, "resend did not invalidate the previous invitation link");
  const cancelledInvitation = await jsonRequestAs(
    `/api/invitations/${encodeURIComponent(lifecycleInvitation.payload.invitation.id)}/cancel`,
    {},
    invitationHeaders,
  );
  assert(cancelledInvitation.response.ok && cancelledInvitation.payload.invitation.status === "Revoked", "pending invitation cancellation failed");
  const cancelledAcceptance = await request(`/api/invitations/accept/${encodeURIComponent(replacementLifecycleToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass", termsAccepted: true, privacyAccepted: true }),
  });
  assert(cancelledAcceptance.response.status === 410, "cancelled invitation could still be accepted");

  const expiredEmail = `invite-expired-${suffix}@release-test.invalid`;
  invitationSmokeEmails.push(expiredEmail);
  const expiredInvitation = await jsonRequestAs("/api/invitations", {
    ...invitationPayload,
    firstName: "Expired",
    email: expiredEmail,
    message: "Expired invitation smoke test",
  }, invitationHeaders);
  assert(expiredInvitation.response.status === 201, "expiration invitation create failed");
  const expiredToken = invitationTokenFromMessage(await waitForSmtpMessage(5));
  await prisma.userInvitation.update({
    where: { id: expiredInvitation.payload.invitation.id },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });
  const expiredAcceptance = await request(`/api/invitations/accept/${encodeURIComponent(expiredToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SmokeInvite2026!Pass", termsAccepted: true, privacyAccepted: true }),
  });
  assert(expiredAcceptance.response.status === 410, "expired invitation could still be accepted");
  const expiredStored = await prisma.userInvitation.findUnique({ where: { id: expiredInvitation.payload.invitation.id } });
  assert(expiredStored?.status === "Expired", "expired invitation status was not persisted");
  const expirationAudit = await prisma.auditLog.findFirst({
    where: { subjectType: "UserInvitation", subjectId: expiredInvitation.payload.invitation.id, action: "Invitation expired" },
  });
  assert(expirationAudit, "invitation expiration audit record was not created");

  const createdClient = await jsonRequest("/api/resources/clients", {
    id: clientId,
    fullName: "Automated Smoke Client",
    mobile: `0999${suffix.slice(-6)}`,
    email: "automated-smoke@example.test",
    branch: "Mace Davao",
    source: "Automated smoke test",
    marketingOptIn: true,
  });
  assert(createdClient.response.status === 201, "client create failed");

  const syringeStockBeforeTreatment = Number((await prisma.inventoryItem.findUnique({ where: { id: "inv-syringe" } }))?.stock ?? NaN);
  const botoxStockBeforeTreatment = Number((await prisma.inventoryItem.findUnique({ where: { id: "inv-botox" } }))?.stock ?? NaN);
  assert(Number.isFinite(syringeStockBeforeTreatment) && Number.isFinite(botoxStockBeforeTreatment), "treatment consumable fixtures were missing");
  const createdTreatment = await jsonRequest("/api/resources/treatments", {
    id: treatmentId,
    clientId,
    date: posCalendarDate(),
    service: "Automated Smoke Consultation",
    branch: "Mace Davao",
    provider: "N/A",
    room: "Room 1",
    consent: "Signed",
    consumables: createdService.payload.record.consumables,
  });
  assert(createdTreatment.response.status === 201, "treatment with structured consumables failed");
  const expectedNextVisit = new Date(`${posCalendarDate()}T00:00:00Z`);
  expectedNextVisit.setUTCDate(expectedNextVisit.getUTCDate() + 21);
  assert(createdTreatment.payload.record.followUp === expectedNextVisit.toISOString().slice(0, 10), "treatment did not apply the service interval");
  const treatmentClient = await prisma.client.findUnique({ where: { id: clientId } });
  assert(treatmentClient?.lastVisit === posCalendarDate(), "treatment did not update the client's last visit");
  assert(treatmentClient?.nextVisit === expectedNextVisit.toISOString().slice(0, 10), "treatment did not update the client's next-session due date");
  assert(
    Number((await prisma.inventoryItem.findUnique({ where: { id: "inv-syringe" } }))?.stock) === syringeStockBeforeTreatment - 1,
    "treatment did not deduct the actual syringe quantity",
  );
  assert(
    Number((await prisma.inventoryItem.findUnique({ where: { id: "inv-botox" } }))?.stock) === botoxStockBeforeTreatment - 0.5,
    "treatment did not deduct the actual fractional Botox quantity",
  );

  const createdBgcClient = await jsonRequest("/api/resources/clients", {
    id: bgcClientId,
    fullName: "Automated BGC Smoke Client",
    mobile: `0997${suffix.slice(-6)}`,
    email: "automated-bgc-smoke@example.test",
    branch: "Mace BGC",
    source: "Automated branch isolation test",
    marketingOptIn: true,
  });
  assert(createdBgcClient.response.status === 201, "BGC client create failed");

  const davaoReceptionist = branchHeaders("Receptionist", "Mace Davao");
  const bgcReceptionist = branchHeaders("Receptionist", "Mace BGC");
  const invalidAllBranchesReceptionist = branchHeaders("Receptionist", "All branches");
  const blockedDavaoClients = await request("/api/resources/clients", { headers: davaoReceptionist });
  const blockedBgcClients = await request("/api/resources/clients", { headers: bgcReceptionist });
  assert(blockedDavaoClients.response.status === 403, "POS-only Davao user could open the Clients module API");
  assert(blockedBgcClients.response.status === 403, "POS-only BGC user could open the Clients module API");
  const davaoPos = await request("/api/bootstrap", { headers: davaoReceptionist });
  const bgcPos = await request("/api/bootstrap", { headers: bgcReceptionist });
  assert(davaoPos.response.ok && davaoPos.payload.clients.some((client) => client.id === clientId), "Davao POS did not include its own customer selector data");
  assert(davaoPos.payload.clients.some((client) => client.id === bgcClientId), "Davao POS did not include the unified BGC customer selector data");
  assert(bgcPos.response.ok && bgcPos.payload.clients.some((client) => client.id === bgcClientId), "BGC POS did not include its own customer selector data");
  assert(bgcPos.payload.clients.some((client) => client.id === clientId), "BGC POS did not include the unified Davao customer selector data");
  assert(!Object.hasOwn(davaoPos.payload.clients.find((client) => client.id === clientId), "medicalNotes"), "POS bootstrap exposed clinical client fields");
  assert(!Object.hasOwn(davaoPos.payload.clients.find((client) => client.id === bgcClientId), "medicalNotes"), "Unified POS selector exposed cross-branch clinical client fields");

  const crossBranchUpdate = await jsonRequestAs(`/api/resources/clients/${bgcClientId}`, {
    ...createdBgcClient.payload.record,
    fullName: "Cross-branch update must fail",
  }, davaoReceptionist, { method: "PUT" });
  assert(crossBranchUpdate.response.status === 403, "Davao user could update a BGC client");
  const invalidAllBranchesList = await request("/api/bootstrap", { headers: invalidAllBranchesReceptionist });
  assert(invalidAllBranchesList.response.ok && invalidAllBranchesList.payload.clients.length === 0, "an operational All branches account received client records");

  const davaoCampaignId = `cmp-smoke-davao-${suffix}`;
  const bgcCampaignId = `cmp-smoke-bgc-${suffix}`;
  for (const [id, name, branch] of [
    [davaoCampaignId, "Davao branch campaign", "Mace Davao"],
    [bgcCampaignId, "BGC branch campaign", "Mace BGC"],
  ]) {
    const campaign = await jsonRequest("/api/resources/campaigns", {
      id,
      name,
      branch,
      segment: "Inactive clients",
      channel: "SMS",
      message: "Branch isolation smoke test",
      sent: 0,
      booked: 0,
      credits: 0,
      status: "Draft",
    });
    assert(campaign.response.status === 201, `${branch} campaign create failed`);
  }
  const davaoMarketing = branchHeaders("Marketing Staff", "Mace Davao");
  const davaoCampaigns = await request("/api/resources/campaigns", { headers: davaoMarketing });
  assert(davaoCampaigns.response.status === 403, "POS-only Marketing Staff could open campaign data");
  const crossBranchCampaignDelete = await request(`/api/marketing/campaigns/${bgcCampaignId}`, { method: "DELETE", headers: davaoMarketing });
  assert(crossBranchCampaignDelete.response.status === 403, "Davao user could delete a BGC campaign");

  const updatedClient = await jsonRequest(`/api/resources/clients/${clientId}`, {
    id: clientId,
    fullName: "Automated Smoke Client Updated",
    mobile: createdClient.payload.record.mobile,
    email: "automated-smoke@example.test",
    branch: "Mace Davao",
    source: "Automated smoke test",
    marketingOptIn: false,
  }, { method: "PUT" });
  assert(updatedClient.response.ok, "client update failed");
  assert(updatedClient.payload.record.fullName.includes("Updated"), "client update did not persist");

  const appointment = await jsonRequest("/api/resources/appointments", {
    id: appointmentId,
    date: appointmentDate,
    time: "10:30",
    clientId,
    serviceId,
    branch: "Mace Davao",
    room: "Room 1",
    staff: "Dr. Mace",
    status: "Pending",
    deposit: 0,
  });
  assert(
    appointment.response.status === 201,
    `appointment create failed (${appointment.response.status}: ${appointment.payload?.error || "unknown error"})`,
  );

  const conflict = await jsonRequest("/api/resources/appointments", {
    id: `ap-conflict-${suffix}`,
    date: appointmentDate,
    time: "10:30",
    clientId,
    serviceId,
    branch: "Mace Davao",
    room: "Room 1",
    staff: "Dr. Mace",
    status: "Pending",
    deposit: 0,
  });
  assert(conflict.response.status === 409, "appointment conflict was not detected");

  const leadMobile = `0998${suffix.slice(-6).padStart(6, "0")}`;
  const leadPayload = {
    event_id: `lead-event-${suffix}`,
    full_name: `Webhook Smoke ${suffix}`,
    phone_number: leadMobile,
    email_address: `lead-${suffix}@example.test`,
    preferred_service: "Aesthetic Consultation",
    branch: "Mace Davao",
    campaign: "Smoke Test Campaign",
    consent_source: "Smoke form",
    privacy_consent: true,
    permission_to_contact: true,
  };

  const invalidWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadPayload),
  });
  assert(invalidWebhook.response.status === 401, "invalid webhook auth was not rejected");

  const webhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-${suffix}`,
    },
    body: JSON.stringify(leadPayload),
  });
  assert(webhook.response.status === 201, "valid lead webhook did not create a lead");
  assert(webhook.payload.reference === `lead-event-${suffix}`, "webhook response did not include its opaque reference");
  assert(!webhook.payload.lead && !webhook.payload.event, "webhook response disclosed internal lead data");
  const webhookEvents = await request("/api/leads/webhook-events", { headers: ownerHeaders });
  const webhookEvent = webhookEvents.payload.events?.find((event) => event.providerEventId === webhook.payload.reference);
  assert(webhookEvent?.leadId, "authenticated webhook event list did not include the created lead");
  const webhookLeadId = webhookEvent.leadId;

  const retryWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-${suffix}`,
    },
    body: JSON.stringify(leadPayload),
  });
  assert(retryWebhook.response.ok && retryWebhook.payload.duplicateEvent === true, "webhook retry was not idempotent");

  const duplicateWebhook = await request("/api/leads/webhooks/website", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mace-Leads-Token": "smoke-leads-key",
      "Idempotency-Key": `lead-event-duplicate-${suffix}`,
    },
    body: JSON.stringify({ ...leadPayload, event_id: `lead-event-duplicate-${suffix}`, full_name: `Duplicate Smoke ${suffix}` }),
  });
  assert(duplicateWebhook.response.ok && duplicateWebhook.payload.status === "Duplicate", "duplicate lead phone match was not detected");

  const qualifiedLead = await jsonRequest(`/api/leads/${webhookLeadId}/stage`, {
    status: "Qualified",
  });
  assert(qualifiedLead.response.ok && qualifiedLead.payload.lead.status === "Qualified", "lead qualification failed");

  const invalidStage = await jsonRequest(`/api/leads/${webhookLeadId}/stage`, {
    status: "Appointment Booked",
  });
  assert(invalidStage.response.status === 400, "appointment-booked transition without appointment was not blocked");

  const followUp = await jsonRequest(`/api/leads/${webhookLeadId}/follow-ups`, {
    dueAt: "2026-09-15T09:00",
    channel: "Phone",
    purpose: "Smoke follow-up",
  });
  assert(followUp.response.status === 201, "lead follow-up create failed");
  assert(followUp.payload.lead.followUps.length >= 1, "lead follow-up did not persist");

  const convertedLead = await jsonRequest(`/api/leads/${webhookLeadId}/convert`, {
    notes: "Smoke conversion",
  });
  assert(convertedLead.response.status === 201, "lead conversion failed");
  assert(convertedLead.payload.lead.status === "Converted", "lead did not move to Converted");

  const duplicateConversion = await jsonRequest(`/api/leads/${webhookLeadId}/convert`, {
    notes: "Expected duplicate conversion block",
  });
  assert(duplicateConversion.response.status === 409, "duplicate conversion was not blocked");

  const staffLinkId = `st-smoke-${suffix}`;
  const createdStaff = await jsonRequest("/api/resources/staff", {
    id: staffLinkId,
    name: `Automated Smoke Staff ${suffix}`,
    role: "Doctor",
    branch: "Mace BGC",
    commissionRate: 0,
  });
  assert(createdStaff.response.status === 201, "staff create failed");

  const accountList = await request("/api/accounts", { headers: ownerHeaders });
  assert(
    accountList.response.ok,
    `account list failed (${accountList.response.status}: ${accountList.payload?.error || "unknown error"})`,
  );
  assert(Array.isArray(accountList.payload.accounts), "account list did not return accounts");

  const missingStaffLink = await jsonRequest("/api/staff/st-does-not-exist/account", { accountId: "" }, { method: "PUT" });
  assert(missingStaffLink.response.status === 404, "linking an unknown staff profile was not rejected");

  const unlinkedAccount = accountList.payload.accounts.find((account) => !account.staffId);
  if (unlinkedAccount) {
    const linked = await jsonRequest(`/api/staff/${staffLinkId}/account`, { accountId: unlinkedAccount.id }, { method: "PUT" });
    assert(linked.response.ok, "connecting a login to a staff profile failed");
    assert(linked.payload.account.staffId === staffLinkId, "connected login did not record the staff profile");

    const alreadyLinked = await jsonRequest(`/api/staff/${staffLinkId}/account`, { accountId: unlinkedAccount.id }, { method: "PUT" });
    assert(alreadyLinked.response.status === 409, "reconnecting the same login was not rejected");

    const unlinked = await jsonRequest(`/api/staff/${staffLinkId}/account`, { accountId: "" }, { method: "PUT" });
    assert(unlinked.response.ok, "disconnecting a login failed");
    assert(unlinked.payload.account.staffId === null, "disconnected login still records a staff profile");

    const alreadyUnlinked = await jsonRequest(`/api/staff/${staffLinkId}/account`, { accountId: "" }, { method: "PUT" });
    assert(alreadyUnlinked.response.status === 409, "disconnecting an unconnected staff profile was not rejected");
  } else {
    console.log("No unconnected login available; skipped the staff login connection round trip.");
  }

  await request(`/api/resources/staff/${staffLinkId}`, { method: "DELETE", headers: ownerHeaders });

  const payrollStaffId = `st-payroll-${suffix}`;
  const payrollStaffName = `Payroll Nurse ${suffix}`;
  const payrollStaff = await jsonRequest("/api/resources/staff", {
    id: payrollStaffId,
    name: payrollStaffName,
    role: "Nurse",
    branch: "Mace Davao",
    branches: ["Mace Davao", "Mace BGC"],
    commissionRate: 0,
    employmentStatus: "Probationary",
    birthDate: "1994-06-15",
    address: "Davao City",
    emergencyContact: "Payroll Emergency Contact",
    emergencyPhone: "09171234567",
    status: "Available",
  });
  assert(payrollStaff.response.status === 201, "payroll employee fixture create failed");
  assert(payrollStaff.payload.record.employmentStatus === "Probationary" && payrollStaff.payload.record.birthDate === "1994-06-15", "staff employment status or birth date was not saved");
  assert(payrollStaff.payload.record.address === "Davao City" && payrollStaff.payload.record.emergencyPhone === "09171234567", "staff address or emergency contact was not saved");
  assert(payrollStaff.payload.record.branches.includes("Mace Davao") && payrollStaff.payload.record.branches.includes("Mace BGC"), "staff multi-branch assignment was not saved");
  const payrollSwapStaffId = `st-payroll-swap-${suffix}`;
  const payrollSwapStaffName = `Payroll Swap Nurse ${suffix}`;
  const payrollSwapStaff = await jsonRequest("/api/resources/staff", {
    id: payrollSwapStaffId,
    name: payrollSwapStaffName,
    role: "Nurse",
    branch: "Mace Davao",
    branches: ["Mace Davao"],
    commissionRate: 0,
    status: "Available",
  });
  assert(payrollSwapStaff.response.status === 201, "payroll swap employee fixture create failed");

  const payrollOverview = await request("/api/payroll/overview", { headers: ownerHeaders });
  assert(payrollOverview.response.ok, `payroll overview failed (${payrollOverview.response.status}: ${payrollOverview.payload?.error || "unknown error"})`);
  assert(payrollOverview.payload.staff.some((person) => person.id === payrollStaffId), "payroll overview omitted the employee");
  assert(payrollOverview.payload.rules.some((rule) => rule.role === "Nurse" && rule.ruleType === "Percentage" && rule.value === 10), "default Nurse commission rule was not installed");

  const payrollProfile = await jsonRequest(`/api/payroll/profiles/${payrollStaffId}`, {
    payType: "Monthly",
    monthlySalary: 26_000,
    dailyRate: 0,
    hourlyRate: 0,
    periodsPerMonth: 2,
    standardWorkDays: 26,
    standardMinutesPerDay: 480,
    overtimeMultiplier: 1.25,
    workDays: [0, 1, 2, 3, 4, 5, 6],
    paidLeaveCredits: 2,
    active: true,
  }, { method: "PUT" });
  assert(payrollProfile.response.ok && payrollProfile.payload.profile.monthlySalary === 26_000, "payroll profile update failed");

  const payrollToday = posCalendarDate();
  const payrollTodayUtc = Date.parse(`${payrollToday}T00:00:00.000Z`);
  const payrollYesterday = new Date(payrollTodayUtc - 86_400_000).toISOString().slice(0, 10);
  const payrollScheduleOffset = 10 + (Number.parseInt(suffix.slice(-4), 36) % 30);
  const payrollScheduleUtc = payrollTodayUtc - payrollScheduleOffset * 86_400_000;
  const payrollScheduleDate = new Date(payrollScheduleUtc).toISOString().slice(0, 10);
  const paidLeave = await jsonRequest("/api/payroll/schedules", {
    staffId: payrollStaffId,
    workDate: payrollScheduleDate,
    branch: "Mace Davao",
    type: "Sick Leave",
    paid: true,
    scheduledMinutes: 480,
    notes: "Release-test paid leave",
  });
  assert(paidLeave.response.status === 201 && paidLeave.payload.schedule.paid, "paid leave schedule entry failed");
  const conflictingLeave = await jsonRequest("/api/payroll/schedules", {
    staffId: payrollSwapStaffId,
    workDate: payrollScheduleDate,
    branch: "Mace Davao",
    type: "Vacation Leave",
    paid: false,
    scheduledMinutes: 480,
  });
  assert(conflictingLeave.response.status === 409, "a second employee could be placed on leave at the same branch and date");
  const overdrawnLeave = await jsonRequest("/api/payroll/schedules", {
    staffId: payrollStaffId,
    workDate: new Date(payrollScheduleUtc + 86_400_000).toISOString().slice(0, 10),
    branch: "Mace Davao",
    type: "Vacation Leave",
    paid: true,
    scheduledMinutes: 480,
  });
  assert(overdrawnLeave.response.status === 201, "second paid leave credit could not be used");
  const thirdPaidLeave = await jsonRequest("/api/payroll/schedules", {
    staffId: payrollStaffId,
    workDate: new Date(payrollScheduleUtc + 2 * 86_400_000).toISOString().slice(0, 10),
    branch: "Mace Davao",
    type: "Emergency Leave",
    paid: true,
    scheduledMinutes: 480,
  });
  assert(thirdPaidLeave.response.status === 409, "paid leave could exceed the configured credit balance");

  const originalDayOff = new Date(payrollScheduleUtc + 3 * 86_400_000).toISOString().slice(0, 10);
  const coworkerDayOff = new Date(payrollScheduleUtc + 4 * 86_400_000).toISOString().slice(0, 10);
  const dayOffSwap = await jsonRequest("/api/payroll/schedule-swaps", {
    staffId: payrollStaffId,
    originalDayOff,
    swapWithStaffId: payrollSwapStaffId,
    coworkerDayOff,
    branch: "Mace Davao",
    notes: "Release-test approved swap",
  });
  assert(dayOffSwap.response.status === 201 && dayOffSwap.payload.schedules.length === 4, "day-off swap was not recorded atomically");
  assert(dayOffSwap.payload.schedules.filter((entry) => entry.type === "Day Off").length === 2, "day-off swap did not create both replacement days off");
  assert(dayOffSwap.payload.schedules.filter((entry) => entry.type === "Work Day").length === 2, "day-off swap did not create both replacement work days");

  await prisma.faceTrackAttendanceRecord.create({
    data: {
      staffId: payrollStaffId,
      workDate: payrollYesterday,
      branch: "Mace Davao",
      scheduledStart: new Date(`${payrollYesterday}T01:00:00.000Z`),
      scheduledEnd: new Date(`${payrollYesterday}T09:00:00.000Z`),
      originalTimeIn: new Date(`${payrollYesterday}T01:00:00.000Z`),
      originalTimeOut: new Date(`${payrollYesterday}T10:00:00.000Z`),
      timeIn: new Date(`${payrollYesterday}T01:00:00.000Z`),
      timeOut: new Date(`${payrollYesterday}T10:00:00.000Z`),
      workedMinutes: 480,
      calculatedOvertimeMinutes: 60,
      approvedOvertimeMinutes: 60,
      overtimeStatus: "APPROVED",
      status: "CLOSED",
    },
  });

  const payrollCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientId,
      clientName: "Automated Smoke Client Updated",
      branch: "Mace Davao",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [{
        key: `service-${serviceId}`,
        serviceId,
        type: "Service",
        name: "Automated Smoke Consultation",
        qty: 1,
        provider: payrollStaffName,
      }],
    },
    payment: {
      payments: [{ method: "Salary Deduction", amount: 1500, employeeId: payrollStaffId }],
      notes: "Payroll salary-deduction smoke test",
    },
  });
  assert(payrollCheckout.response.status === 201, `payroll POS checkout failed (${payrollCheckout.response.status}: ${payrollCheckout.payload?.error || "unknown error"})`);
  const payrollSaleId = payrollCheckout.payload.sale.id;
  assert(await prisma.payrollSalaryDeduction.count({ where: { saleId: payrollSaleId, staffId: payrollStaffId, status: "Pending" } }) === 1, "POS salary deduction was not recorded immediately");

  const payrollPackage = await jsonRequest("/api/resources/packages", {
    name: `Payroll session package ${suffix}`,
    clientId,
    client: "Automated Smoke Client Updated",
    sessions: 2,
    used: 0,
    branch: "Mace Davao",
    status: "Active",
    price: 4000,
    serviceValue: 2000,
  });
  assert(payrollPackage.response.status === 201, "payroll package fixture create failed");
  const payrollPackageId = payrollPackage.payload.record.id;
  const payrollPackageLineKey = `service-${packageServiceId}-payroll-redemption`;
  const payrollPackageCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientId,
      clientName: "Automated Smoke Client Updated",
      branch: "Mace Davao",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [
        { key: payrollPackageLineKey, serviceId: packageServiceId, type: "Service", name: "Automated Three Session Package", qty: 1, provider: payrollStaffName },
        { key: `service-${variablePriceServiceId}-payroll-cash`, serviceId: variablePriceServiceId, type: "Service", name: "Automated Variable Consultation", qty: 1, resolvedPrice: 1000, provider: payrollStaffName },
      ],
    },
    payment: {
      payments: [
        { method: "Package", amount: 3000, packageId: payrollPackageId, packageLineKey: payrollPackageLineKey },
        { method: "Cash", amount: 1000 },
      ],
      notes: "Mixed package-session and regular-service commission test",
    },
  });
  assert(payrollPackageCheckout.response.status === 201, `package commission checkout failed (${payrollPackageCheckout.response.status}: ${payrollPackageCheckout.payload?.error || "unknown error"})`);
  const payrollPackageSaleId = payrollPackageCheckout.payload.sale.id;
  const storedPackagePayment = payrollPackageCheckout.payload.sale.payments.find((payment) => payment.method === "Package");
  assert(storedPackagePayment?.packageServiceId === packageServiceId && storedPackagePayment?.packageProvider === payrollStaffName, "package payment was not linked to its exact service and provider");

  const payrollRunCreate = await jsonRequest("/api/payroll/runs", {
    cutoffStart: payrollScheduleDate,
    cutoffEnd: payrollToday,
    payDate: payrollToday,
    branch: "Mace Davao",
    notes: "Release-test payroll cutoff",
  });
  assert(payrollRunCreate.response.status === 201, `payroll run create failed (${payrollRunCreate.response.status}: ${payrollRunCreate.payload?.error || "unknown error"})`);
  let payrollRun = payrollRunCreate.payload.run;
  const payrollLine = payrollRun.lines.find((line) => line.staffId === payrollStaffId);
  assert(payrollLine, "payroll run omitted the configured employee");
  assert(payrollLine.paidLeaveDays === 2, "payroll did not include both paid leave entries");
  assert(payrollLine.overtimeMinutes === 60 && payrollLine.overtimePay === 156.25, "approved overtime was not calculated correctly");
  assert(payrollLine.commissions === 450, "Nurse commissions did not combine the package session value and regular service value correctly");
  assert(payrollLine.salaryDeductions === 1500, "POS salary deduction was not included in the cutoff");
  const packageCommissionRows = await prisma.payrollCommissionEarning.findMany({ where: { saleId: payrollPackageSaleId }, orderBy: { serviceName: "asc" } });
  assert(packageCommissionRows.length === 2, "mixed package checkout did not create two distinct service commissions");
  assert(packageCommissionRows.find((earning) => earning.serviceId === packageServiceId)?.baseAmount === 2000, "package commission did not use the configured per-session service value");
  assert(packageCommissionRows.find((earning) => earning.serviceId === variablePriceServiceId)?.baseAmount === 1000, "regular service commission was incorrectly replaced by the package session value");

  const payrollAdjustment = await jsonRequest(`/api/payroll/runs/${payrollRun.id}/lines/${payrollLine.id}/adjustments`, {
    type: "Incentive",
    amount: 250,
    reason: "Release-test approved incentive",
  });
  assert(payrollAdjustment.response.status === 201, "payroll incentive adjustment failed");
  payrollRun = payrollAdjustment.payload.run;
  assert(payrollRun.lines.find((line) => line.staffId === payrollStaffId)?.incentives === 250, "payroll incentive was not recalculated");

  const payrollApproved = await jsonRequest(`/api/payroll/runs/${payrollRun.id}/status`, { status: "Approved" });
  assert(payrollApproved.response.ok && payrollApproved.payload.run.status === "Approved", `payroll approval failed (${payrollApproved.response.status}: ${payrollApproved.payload?.error || "unknown error"})`);
  const payrollFinalized = await jsonRequest(`/api/payroll/runs/${payrollRun.id}/status`, { status: "Finalized" });
  assert(payrollFinalized.response.ok && payrollFinalized.payload.run.status === "Finalized", "payroll finalization failed");
  assert(await prisma.payrollSalaryDeduction.count({ where: { saleId: payrollSaleId, status: "Included" } }) === 1, "finalized salary deduction was not locked as Included");
  assert(await prisma.payrollCommissionEarning.count({ where: { saleId: payrollSaleId, status: "Included" } }) === 1, "finalized commission was not locked as Included");
  const lockedPayrollVoid = await jsonRequest(`/api/transactions/${payrollSaleId}/void`, {});
  assert(lockedPayrollVoid.response.status === 409, "a sale included in finalized payroll could still be voided");
  const finalizedRecalculate = await jsonRequest(`/api/payroll/runs/${payrollRun.id}/recalculate`, {});
  assert(finalizedRecalculate.response.status === 400, "finalized payroll could still be recalculated");

  const impossibleCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientName: "Automated Smoke Client Updated",
      branch: "Mace Davao",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [
        {
          key: "product-inv-cleanser-kit",
          inventoryId: "inv-cleanser-kit",
          type: "Product",
          name: "Cleanser Travel Kit",
          qty: 999999,
        },
      ],
    },
    payment: {
      payments: [{ method: "Cash", amount: 1 }],
      notes: "Expected to fail stock validation",
    },
  });
  assert(impossibleCheckout.response.status === 409, "POS insufficient-stock validation failed");

  const manualDiscountOpenCart = await jsonRequest("/api/pos/carts", {
    clientId: "",
    client: "Walk-in",
    branch: "Mace Davao",
    staff: "Dr. Mace",
    items: [{
      key: `service-${serviceId}-saved-target`,
      serviceId,
      type: "Service",
      name: "Automated Smoke Consultation",
      qty: 1,
    }],
    discountId: "",
    manualDiscountType: "Fixed amount",
    manualDiscountValue: 250,
    manualDiscountScope: "Service",
    manualDiscountTargetKey: `service-${serviceId}-saved-target`,
    saleDate: payrollToday,
    testMode: false,
  });
  assert(manualDiscountOpenCart.response.status === 201, "manual-discount open cart create failed");
  assert(manualDiscountOpenCart.payload.cart.manualDiscountType === "Fixed amount", "open POS cart did not preserve manual discount type");
  assert(manualDiscountOpenCart.payload.cart.manualDiscountValue === 250, "open POS cart did not preserve manual discount value");
  assert(manualDiscountOpenCart.payload.cart.manualDiscountScope === "Service", "open POS cart did not preserve manual discount scope");
  assert(manualDiscountOpenCart.payload.cart.manualDiscountTargetKey === `service-${serviceId}-saved-target`, "open POS cart did not preserve the discounted service line");
  await request(`/api/pos/carts/${manualDiscountOpenCart.payload.cart.id}`, { method: "DELETE", headers: ownerHeaders });

  const manualDiscountCart = {
    clientId,
    clientName: "Automated Smoke Client Updated",
    branch: "Mace Davao",
    staff: "Dr. Mace",
    invoicePrefix: "MACE",
    cart: [
      {
        key: `service-${serviceId}-manual-discount-target`,
        serviceId,
        type: "Service",
        name: "Automated Smoke Consultation",
        qty: 1,
      },
      {
        key: `service-${serviceId}-manual-discount-full-price`,
        serviceId,
        type: "Service",
        name: "Automated Smoke Consultation",
        qty: 1,
      },
    ],
  };
  const excessiveManualDiscount = await jsonRequest("/api/pos/checkout", {
    draft: { ...manualDiscountCart, manualDiscount: { type: "Percentage", value: 101, scope: "Service", targetKey: `service-${serviceId}-manual-discount-target` } },
    payment: { payments: [{ method: "Cash", amount: 1 }] },
  });
  assert(excessiveManualDiscount.response.status === 400, "POS allowed a manual percentage above 100%");

  const missingManualDiscountTarget = await jsonRequest("/api/pos/checkout", {
    draft: { ...manualDiscountCart, manualDiscount: { type: "Percentage", value: 10, scope: "Service", targetKey: "missing-service-line" } },
    payment: { payments: [{ method: "Cash", amount: 1 }] },
  });
  assert(missingManualDiscountTarget.response.status === 400, "POS allowed a manual discount to target a missing service line");

  const excessiveTargetedAmount = await jsonRequest("/api/pos/checkout", {
    draft: { ...manualDiscountCart, manualDiscount: { type: "Fixed amount", value: 1501, scope: "Service", targetKey: `service-${serviceId}-manual-discount-target` } },
    payment: { payments: [{ method: "Cash", amount: 1 }] },
  });
  assert(excessiveTargetedAmount.response.status === 400, "POS allowed a manual discount above the selected service total");

  const unapprovedManualDiscount = await jsonRequestAs("/api/pos/checkout", {
    draft: { ...manualDiscountCart, manualDiscount: { type: "Fixed amount", value: 100, scope: "Transaction" } },
    payment: { payments: [{ method: "Cash", amount: 2900 }] },
  }, branchHeaders("Receptionist", "Mace Davao"));
  assert(unapprovedManualDiscount.response.status === 403, "a branch POS user posted a manual adjustment without Owner or Super Admin approval");

  const manualDiscountCheckout = await jsonRequest("/api/pos/checkout", {
    draft: { ...manualDiscountCart, manualDiscount: { type: "Percentage", value: 10, scope: "Service", targetKey: `service-${serviceId}-manual-discount-target` } },
    payment: { payments: [{ method: "Cash", amount: 2850 }] },
  });
  assert(manualDiscountCheckout.response.status === 201, "manual-discount POS checkout failed");
  assert(manualDiscountCheckout.payload.sale.subtotal === 3000, "targeted manual discount changed the sale subtotal");
  assert(manualDiscountCheckout.payload.sale.discount === 150, "targeted manual percentage discount affected more than the selected service");
  assert(manualDiscountCheckout.payload.sale.total === 2850, "targeted manual discount was not deducted from the POS total");
  assert(/^PAY-\d{8}-[A-F0-9]{8}$/.test(manualDiscountCheckout.payload.sale.payments?.[0]?.referenceNumber || ""), "POS payment reference was not generated by the system");
  assert(manualDiscountCheckout.payload.sale.items.every((item) => item.aftercare === "Keep the treated area clean and avoid direct sun exposure for 48 hours."), "POS sale items did not preserve service aftercare for receipt reprints");
  assert(manualDiscountCheckout.payload.sale.items.every((item) => item.recommendedIntervalDays === 21), "POS sale items did not preserve the service interval for receipt reprints");
  assert(manualDiscountCheckout.payload.auditLog?.details.includes("Manual discount: 10% on Automated Smoke Consultation"), "targeted manual discount was omitted from the POS audit trail");
  const manualDiscountSaleId = manualDiscountCheckout.payload.sale.id;
  const voidedManualDiscountSale = await jsonRequest(`/api/transactions/${manualDiscountSaleId}/void`, {});
  assert(voidedManualDiscountSale.response.ok, "manual-discount sale void failed");
  await request(`/api/resources/transactions/${manualDiscountSaleId}`, { method: "DELETE", headers: ownerHeaders });

  const variablePriceCart = {
    clientId,
    clientName: "Automated Smoke Client Updated",
    branch: "Mace Davao",
    staff: "Dr. Mace",
    invoicePrefix: "MACE",
    cart: [{
      key: `service-${variablePriceServiceId}`,
      serviceId: variablePriceServiceId,
      type: "Service",
      name: "Automated Variable Consultation",
      qty: 1,
    }],
  };
  const belowStartingPrice = await jsonRequest("/api/pos/checkout", {
    draft: {
      ...variablePriceCart,
      cart: variablePriceCart.cart.map((item) => ({ ...item, resolvedPrice: 900 })),
    },
    payment: { payments: [{ method: "Cash", amount: 900 }] },
  });
  assert(belowStartingPrice.response.status === 400, "POS allowed a final service price below its configured starting price");

  const variablePriceCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      ...variablePriceCart,
      cart: variablePriceCart.cart.map((item) => ({ ...item, resolvedPrice: 1350 })),
    },
    payment: { payments: [{ method: "Cash", amount: 1350 }] },
  });
  assert(variablePriceCheckout.response.status === 201, "variable-price POS checkout failed");
  const variablePriceSaleId = variablePriceCheckout.payload.sale.id;
  const variablePriceSaleItem = variablePriceCheckout.payload.sale.items?.[0];
  assert(variablePriceSaleItem?.price === 1350, "POS did not record the final assessed service price");
  assert(variablePriceSaleItem?.originalPrice === 1000, "POS did not preserve the service's starting price");
  assert(variablePriceSaleItem?.priceModel === "Starts at", "POS did not preserve the service pricing model");
  const voidedVariablePriceSale = await jsonRequest(`/api/transactions/${variablePriceSaleId}/void`, {});
  assert(voidedVariablePriceSale.response.ok, "variable-price sale void failed");
  await request(`/api/resources/transactions/${variablePriceSaleId}`, { method: "DELETE", headers: ownerHeaders });

  const packageCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientId,
      clientName: "Automated Smoke Client Updated",
      branch: "Mace Davao",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [{
        key: `service-${packageServiceId}`,
        serviceId: packageServiceId,
        type: "Service",
        name: "Automated Three Session Package",
        qty: 1,
      }],
    },
    payment: { payments: [{ method: "Cash", amount: 3000 }] },
  });
  assert(packageCheckout.response.status === 201, "package POS checkout failed");
  const packageSaleId = packageCheckout.payload.sale.id;
  const issuedPackage = packageCheckout.payload.packages?.find((pkg) => pkg.sourceSaleId === packageSaleId);
  assert(issuedPackage?.sessions === 3 && issuedPackage.used === 0, "package sale did not issue the configured client sessions");
  assert(issuedPackage?.status === "Active", "newly issued package was not active");
  const voidedPackageSale = await jsonRequest(`/api/transactions/${packageSaleId}/void`, {});
  assert(voidedPackageSale.response.ok, "package sale void failed");
  assert(
    voidedPackageSale.payload.packages?.some((pkg) => pkg.id === issuedPackage.id && pkg.status === "Cancelled"),
    "voiding an unused package sale did not cancel the issued sessions",
  );
  await request(`/api/resources/packages/${issuedPackage.id}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/transactions/${packageSaleId}`, { method: "DELETE", headers: ownerHeaders });

  const mixedPackageCheckout = await jsonRequest("/api/pos/checkout", {
    draft: {
      clientId,
      clientName: "Automated Smoke Client Updated",
      branch: "Mace Davao",
      staff: "Dr. Mace",
      invoicePrefix: "MACE",
      cart: [
        { key: `service-${serviceId}-mixed`, serviceId, type: "Service", name: "Automated Smoke Consultation", qty: 1 },
        { key: `service-${packageServiceId}-installment`, serviceId: packageServiceId, type: "Service", name: "Automated Three Session Package", qty: 1 },
      ],
    },
    payment: {
      payments: [{ method: "Cash", amount: 2000 }],
      packageInstallments: [{ lineKey: `service-${packageServiceId}-installment`, amountPaid: 500, nextPayment: "2026-09-15" }],
    },
  });
  assert(mixedPackageCheckout.response.status === 201, "mixed service and package installment checkout failed");
  assert(mixedPackageCheckout.payload.sale.status === "Partially Paid", "partial mixed checkout did not remain partially paid");
  const mixedPackageSaleId = mixedPackageCheckout.payload.sale.id;
  const installmentPackage = mixedPackageCheckout.payload.packages?.find((pkg) => pkg.sourceSaleId === mixedPackageSaleId);
  assert(installmentPackage?.amountPaid === 500, "package did not preserve its explicitly allocated first installment");
  assert(installmentPackage?.outstandingBalance === Number(installmentPackage?.price || 0) - 500, "package installment balance is incorrect");
  assert(installmentPackage?.nextPayment === "2026-09-15", "package next-payment date was not saved");

  const followUpInstallment = await jsonRequest(`/api/packages/${installmentPackage.id}/payments`, {
    amount: 1000,
    date: posCalendarDate(),
    method: "Cash",
    referenceNumber: `INSTALLMENT-${suffix}`,
    nextPayment: "2026-10-15",
  });
  assert(followUpInstallment.response.status === 201, "follow-up package installment failed");
  assert(followUpInstallment.payload.record.amountPaid === 1500, "follow-up installment did not update package paid amount");
  assert(followUpInstallment.payload.record.paymentHistory.length === 2, "package payment history did not preserve both installments");
  assert(/^PKG-\d{8}-[A-F0-9]{8}$/.test(followUpInstallment.payload.record.paymentHistory.at(-1)?.referenceNumber || ""), "package installment reference was not generated by the system");
  assert(followUpInstallment.payload.record.paymentHistory.at(-1)?.referenceNumber !== `INSTALLMENT-${suffix}`, "package installment accepted a caller-supplied reference number");
  assert(followUpInstallment.payload.sale.status === "Partially Paid", "follow-up installment did not update the original sale ledger");
  const voidedMixedPackageSale = await jsonRequest(`/api/transactions/${mixedPackageSaleId}/void`, {});
  assert(voidedMixedPackageSale.response.ok, "mixed package installment sale void failed");
  await request(`/api/resources/packages/${installmentPackage.id}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/transactions/${mixedPackageSaleId}`, { method: "DELETE", headers: ownerHeaders });

  const certificateCreate = await jsonRequest("/api/resources/giftCertificates", {
    code: `GC-SMOKE-${suffix}`,
    client: "Automated Smoke Client Updated",
    branch: "Mace Davao",
    balance: 800,
    expires: "",
    status: "Active",
  });
  assert(certificateCreate.response.status === 201, "gift certificate create failed");
  const certificateId = certificateCreate.payload.record.id;

  const packageCreate = await jsonRequest("/api/resources/packages", {
    name: `Smoke Package ${suffix}`,
    clientId,
    client: "Automated Smoke Client Updated",
    sessions: 2,
    used: 0,
    expires: "2030-12-31",
    branch: "Mace Davao",
    status: "Active",
    price: 0,
  });
  assert(packageCreate.response.status === 201, "package create failed");
  assert(packageCreate.payload.record.expires === "", "service packages must never persist an expiration date");
  const packageId = packageCreate.payload.record.id;

  const stockBefore = Number(
    bootstrap.payload.inventory.find((item) => item.id === "inv-cleanser-kit")?.stock ?? NaN,
  );
  assert(Number.isFinite(stockBefore), "seeded cleanser kit stock missing");

  const tenderCart = {
    clientId,
    clientName: "Automated Smoke Client Updated",
    branch: "Mace Davao",
    staff: "Dr. Mace",
    invoicePrefix: "MACE",
    cart: [
      {
        key: `service-${serviceId}-package-redemption`,
        serviceId,
        type: "Service",
        name: "Automated Smoke Consultation",
        qty: 1,
        provider: "N/A",
      },
      {
        key: "product-inv-cleanser-kit",
        inventoryId: "inv-cleanser-kit",
        type: "Product",
        name: "Cleanser Travel Kit",
        qty: 1,
      },
    ],
  };

  const overdrawnCertificate = await jsonRequest("/api/pos/checkout", {
    draft: tenderCart,
    payment: {
      payments: [{ method: "Gift Certificate", amount: 999999, giftCertificateId: certificateId }],
    },
  });
  assert(overdrawnCertificate.response.status === 409, "gift certificate overdraw was not blocked");

  const missingCertificate = await jsonRequest("/api/pos/checkout", {
    draft: tenderCart,
    payment: { payments: [{ method: "Gift Certificate", amount: 100 }] },
  });
  assert(missingCertificate.response.status === 400, "gift certificate payment without certificate was not blocked");

  const missingPackageService = await jsonRequest("/api/pos/checkout", {
    draft: { ...tenderCart, cart: tenderCart.cart.filter((item) => item.type === "Product") },
    payment: { payments: [{ method: "Package", amount: 1500, packageId }] },
  });
  assert(missingPackageService.response.status === 400, "package payment without a covered service line was not blocked");

  const tenderCheckout = await jsonRequest("/api/pos/checkout", {
    draft: tenderCart,
    payment: {
      payments: [
        { method: "Gift Certificate", amount: 500, giftCertificateId: certificateId },
        { method: "Package", amount: 1500, packageId, packageLineKey: `service-${serviceId}-package-redemption` },
        { method: "Cash", amount: 1000 },
      ],
      notes: "Tender smoke test",
    },
  });
  assert(tenderCheckout.response.status === 201, "tender checkout failed");
  assert(tenderCheckout.payload.giftCertificates?.[0]?.balance === 300, "gift certificate balance was not reduced");
  assert(tenderCheckout.payload.packages?.[0]?.used === 1, "package session was not redeemed");
  const stockAfterSale = Number(
    tenderCheckout.payload.inventory.find((item) => item.id === "inv-cleanser-kit")?.stock ?? NaN,
  );
  assert(stockAfterSale === stockBefore - 1, "sale did not deduct inventory");
  const tenderSaleId = tenderCheckout.payload.sale.id;

  const voided = await jsonRequest(`/api/transactions/${tenderSaleId}/void`, {});
  assert(voided.response.ok && voided.payload.record.status === "Void", "void failed");
  assert(voided.payload.giftCertificates?.[0]?.balance === 800, "void did not restore the gift certificate balance");
  assert(voided.payload.packages?.[0]?.used === 0, "void did not restore the package session");
  assert(Array.isArray(voided.payload.movements) && voided.payload.movements.length >= 1, "void did not write reversal movements");
  const stockAfterVoid = Number(
    voided.payload.inventory?.find((item) => item.id === "inv-cleanser-kit")?.stock ?? NaN,
  );
  assert(stockAfterVoid === stockBefore, "void did not restore inventory stock");

  await request(`/api/resources/transactions/${tenderSaleId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/giftCertificates/${certificateId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/packages/${packageId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });

  await request(`/api/resources/appointments/${appointmentId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/treatments/${treatmentId}`, { method: "DELETE", headers: ownerHeaders });
  await prisma.payrollCommissionEarning.deleteMany({ where: { saleId: { in: [payrollSaleId, payrollPackageSaleId] } } });
  await prisma.payrollSalaryDeduction.deleteMany({ where: { saleId: payrollSaleId } });
  await prisma.payrollRun.deleteMany({ where: { id: payrollRun.id } });
  await prisma.faceTrackAttendanceRecord.deleteMany({ where: { staffId: payrollStaffId } });
  await prisma.payrollScheduleEntry.deleteMany({ where: { staffId: { in: [payrollStaffId, payrollSwapStaffId] } } });
  await prisma.payrollEmployeeProfile.deleteMany({ where: { staffId: payrollStaffId } });
  await request(`/api/resources/transactions/${payrollSaleId}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/transactions/${payrollPackageSaleId}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/packages/${payrollPackageId}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/staff/${payrollStaffId}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/staff/${payrollSwapStaffId}`, { method: "DELETE", headers: ownerHeaders });
  await request(`/api/resources/services/${serviceId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/services/${variablePriceServiceId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/services/${packageServiceId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/clients/${clientId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  await request(`/api/resources/clients/${bgcClientId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  for (const campaignId of [davaoCampaignId, bgcCampaignId]) {
    await request(`/api/marketing/campaigns/${campaignId}`, { method: "DELETE", headers: ownerHeaders });
    await request(`/api/marketing/campaigns/${campaignId}/permanent`, { method: "DELETE", headers: ownerHeaders });
  }
  await request(`/api/resources/leads/${webhookLeadId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  if (convertedLead.payload.client?.id) {
    await request(`/api/resources/clients/${convertedLead.payload.client.id}`, {
      method: "DELETE",
      headers: ownerHeaders,
    });
  }

  console.log("API smoke test passed.");
} catch (error) {
  console.error(serverOutput);
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  try {
    for (const email of invitationSmokeEmails) {
      const account = await prisma.account.findUnique({ where: { email }, select: { id: true, staffId: true } });
      // Accepted accounts are intentionally retained with their append-only
      // audit trail. Release verification runs in a disposable schema, which
      // is the safe cleanup boundary for this lifecycle test.
      if (!account) await prisma.userInvitation.deleteMany({ where: { email } });
    }
  } catch (cleanupError) {
    console.error(`Invitation smoke cleanup failed: ${cleanupError.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await new Promise((resolve) => smtpServer.close(resolve));
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isPublicApiRequest } from "./accessControl.js";

const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const bootstrapSource = readFileSync(new URL("../scripts/create-platform-admin.mjs", import.meta.url), "utf8");

test("provider overview stays authenticated and platform-admin protected", () => {
  assert.equal(isPublicApiRequest("GET", "/api/admin/provider-overview"), false);
  const route = serverSource.slice(
    serverSource.indexOf('app.get("/api/admin/provider-overview"'),
    serverSource.indexOf('app.patch("/api/admin/subscriptions'),
  );
  assert.match(route, /requirePlatformAdministrator\(request\)/);
  assert.match(route, /prisma\.organization\.findMany/);
  assert.match(route, /prisma\.account\.findMany/);
  assert.doesNotMatch(route, /passwordHash|providerSubject/);
  assert.match(serverSource, /account\?\.emailVerifiedAt/);
});

test("provider route is gated in the application before loading overview data", () => {
  assert.match(appSource, /const isProviderView = currentPublicPath === "\/provider"/);
  assert.match(appSource, /if \(isProviderView\) \{\s*return <ProviderWorkspace/);
  const workspace = appSource.slice(
    appSource.indexOf("function ProviderWorkspace"),
    appSource.indexOf("function SubscriptionExpiredPage"),
  );
  assert.match(workspace, /if \(!session\.platformAdmin\)/);
  assert.match(workspace, /loadProviderOverview\(\)/);
  assert.match(workspace, /All product users/);
  assert.match(workspace, /updateProviderUser\(user\.id, action\)/);
});

test("provider setup requires an approved mailbox and a single-use password token", () => {
  assert.equal(isPublicApiRequest("POST", "/api/auth/provider-setup"), true);
  const route = serverSource.slice(
    serverSource.indexOf('app.post("/api/auth/provider-setup"'),
    serverSource.indexOf('app.post("/api/auth/forgot-password"'),
  );
  assert.match(route, /platformAdminEmails\(\)\.has\(email\)/);
  assert.match(route, /passwordResetToken\.create/);
  assert.match(route, /single-use link within 30 minutes/);
  assert.doesNotMatch(route, /passwordHash:\s*hashPassword\(request\.body/);
  assert.match(appSource, /Send provider setup link/);
  assert.match(serverSource, /emailVerifiedAt: new Date\(\)/);
});

test("system-provider user mutations are protected, scoped to safe actions, and audited", () => {
  assert.equal(isPublicApiRequest("PATCH", "/api/admin/users/account-1"), false);
  const route = serverSource.slice(
    serverSource.indexOf('app.patch("/api/admin/users/:accountId"'),
    serverSource.indexOf('app.patch("/api/admin/subscriptions'),
  );
  assert.match(route, /requirePlatformAdministrator\(request\)/);
  assert.match(route, /action === "deactivate"/);
  assert.match(route, /action === "reactivate"/);
  assert.match(route, /action === "unlock"/);
  assert.match(route, /You cannot deactivate your own system-provider account/);
  assert.match(route, /authSession\.deleteMany/);
  assert.match(route, /auditLog\.create/);
  assert.doesNotMatch(route, /delete\(|deleteMany\(\{ where: \{ id: target\.id/);
});

test("platform administrator bootstrap requires an allowlisted email and forces password rotation", () => {
  assert.match(bootstrapSource, /PLATFORM_ADMIN_EMAIL/);
  assert.match(bootstrapSource, /ZENSHOTECH_ADMIN_EMAILS/);
  assert.match(bootstrapSource, /emailVerifiedAt: now/);
  assert.match(bootstrapSource, /mustChangePassword: true/);
  assert.match(bootstrapSource, /authSession\.deleteMany/);
  const logLine = bootstrapSource.split("\n").find((line) => line.startsWith("console.log")) || "";
  assert.doesNotMatch(logLine, /passwordHash|PLATFORM_ADMIN_PASSWORD|[,({]\s*password\s*[,)}]/);
});

test("new customer and demo registrations send non-blocking provider notifications", () => {
  const registrationRoute = serverSource.slice(
    serverSource.indexOf('app.post("/api/auth/register"'),
    serverSource.indexOf('app.use("/api", asyncRoute'),
  );
  assert.match(registrationRoute, /deliverProviderRegistrationNotification\(account, "Email and password"\)/);
  assert.match(registrationRoute, /deliverProviderRegistrationNotification\(account, "Google"\)/);
  assert.match(registrationRoute, /deliverProviderRegistrationNotification\(demoAccount, "Email and password", "demo"\)/);
});

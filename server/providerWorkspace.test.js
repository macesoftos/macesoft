import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isPublicApiRequest } from "./accessControl.js";

const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

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

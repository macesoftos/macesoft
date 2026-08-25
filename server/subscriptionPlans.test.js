import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  INCLUDED_WEBSITE_PAGES,
  TRIAL_DURATION_HOURS,
  assertUsageWithinPlan,
  effectiveSubscriptionStatus,
  getSubscriptionPlan,
  publicSubscriptionPlans,
  serializeSubscription,
  subscriptionAllowsOperations,
  trialWindow,
} from "./subscriptionPlans.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260825153000_subscription_trials_no_setup_fee/migration.sql", import.meta.url), "utf8");

test("canonical plans use the corrected prices and no setup-fee data", () => {
  const plans = Object.fromEntries(publicSubscriptionPlans().map((plan) => [plan.code, plan]));
  assert.equal(plans.starter.monthlyPrice, 3900);
  assert.equal(plans.growth.monthlyPrice, 5900);
  assert.equal(plans.unlimited.monthlyPrice, 7999);
  assert.equal(plans.lifetime.monthlyPrice, 120000);
  assert.equal(plans.growth.recommended, true);
  for (const plan of Object.values(plans)) {
    assert.equal(plan.includedWebsitePages, 8);
    assert.equal(Object.keys(plan).some((key) => /setup.?fee/i.test(key)), false);
  }
});

test("all monthly plans receive one exact 168-hour trial", () => {
  assert.equal(TRIAL_DURATION_HOURS, 168);
  const start = new Date("2026-08-25T00:00:00.000Z");
  const window = trialWindow(start);
  assert.equal(window.start.toISOString(), start.toISOString());
  assert.equal(window.end.toISOString(), "2026-09-01T00:00:00.000Z");
  for (const code of ["starter", "growth", "unlimited"]) {
    const plan = getSubscriptionPlan(code);
    assert.equal(plan.trialAvailable, true);
    assert.equal(plan.trialDurationHours, 168);
  }
  assert.equal(getSubscriptionPlan("lifetime").trialAvailable, false);
});

test("changing plan data cannot reset a stored trial and expiration is server-derived", () => {
  const now = new Date("2026-08-25T12:00:00.000Z");
  const trialEndAt = new Date("2026-08-25T11:59:59.000Z");
  const subscription = { id: "sub-1", planCode: "starter", status: "trialing", trialStartAt: new Date("2026-08-18T11:59:59.000Z"), trialEndAt, includedWebsitePages: 8 };
  assert.equal(effectiveSubscriptionStatus(subscription, now), "expired");
  assert.equal(subscriptionAllowsOperations(subscription, now), false);
  assert.equal(serializeSubscription(subscription, {}, now).status, "expired");
});

test("user and branch limits differ without limiting modules or operational data", () => {
  const starter = getSubscriptionPlan("starter");
  const growth = getSubscriptionPlan("growth");
  const unlimited = getSubscriptionPlan("unlimited");
  assert.equal(assertUsageWithinPlan(starter, { users: 5, branches: 1 }).allowed, true);
  assert.equal(assertUsageWithinPlan(starter, { users: 6, branches: 1 }).resource, "users");
  assert.equal(assertUsageWithinPlan(growth, { users: 10, branches: 3 }).allowed, true);
  assert.equal(assertUsageWithinPlan(growth, { users: 10, branches: 4 }).resource, "branches");
  assert.equal(assertUsageWithinPlan(unlimited, { users: 10000, branches: 1000 }).allowed, true);
  assert.deepEqual(starter.moduleEntitlements, growth.moduleEntitlements);
  assert.deepEqual(growth.moduleEntitlements, unlimited.moduleEntitlements);
  assert.ok(starter.moduleEntitlements.includes("appointments"));
  assert.ok(starter.moduleEntitlements.includes("sms"));
});

test("pricing and registration state the corrected website scope without a setup charge", () => {
  assert.equal(INCLUDED_WEBSITE_PAGES, 8);
  assert.match(appSource, /Free Website Included/);
  assert.match(appSource, /Free website with up to 8 pages/);
  assert.match(appSource, /Additional website pages quoted separately/);
  assert.match(appSource, /Repeated sections on the same route do not count as separate pages/);
  assert.match(appSource, /never limits ZenshoTech modules/);
  assert.doesNotMatch(appSource, /₱\s*20,?000|One-time setup fee/i);
  assert.doesNotMatch(serverSource, /₱\s*20,?000|setupFeeStatus|setupFeePaid/i);
});

test("registration remains pending and trial activation creates no setup charge", () => {
  const registrationRoute = serverSource.slice(serverSource.indexOf('app.post("/api/auth/register"'), serverSource.indexOf('app.post("/api/auth/demo-register"'));
  const trialRoute = serverSource.slice(serverSource.indexOf('app.post("/api/subscription/trial"'), serverSource.indexOf('app.post("/api/subscription/request-activation"'));
  assert.match(registrationRoute, /status: "pending_plan"/);
  assert.doesNotMatch(registrationRoute, /trialStartAt|trialEndAt/);
  assert.match(trialRoute, /trialWindow\(now\)/);
  assert.match(trialRoute, /No payment or setup charge was created/);
  assert.doesNotMatch(trialRoute, /setupFeeStatus|setupFeePaid|20000/);
});

test("subscription migration is additive and preserves historical billing data", () => {
  assert.match(schema, /includedWebsitePages\s+Int\s+@default\(8\)/);
  assert.doesNotMatch(schema, /setupFeeStatus|setupFeePaid/);
  assert.match(migration, /CREATE TABLE "Subscription"/);
  assert.match(migration, /"includedWebsitePages" INTEGER NOT NULL DEFAULT 8/);
  assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|DROP COLUMN/i);
  assert.doesNotMatch(migration, /setupFeeStatus|setupFeePaid/i);
});

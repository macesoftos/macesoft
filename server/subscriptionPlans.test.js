import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ANNUAL_BILLING_MONTHS,
  ANNUAL_DISCOUNT_PERCENT,
  INCLUDED_WEBSITE_PAGES,
  PLAN_WEBSITE_PAGE_ALLOWANCES,
  TRIAL_DURATION_HOURS,
  assertUsageWithinPlan,
  billingDetails,
  effectiveSubscriptionStatus,
  getSubscriptionPlan,
  publicSubscriptionPlans,
  serializeSubscription,
  subscriptionAllowsOperations,
  trialWindow,
  userAdditionWithinPlan,
} from "./subscriptionPlans.js";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260825153000_subscription_trials_no_setup_fee/migration.sql", import.meta.url), "utf8");
const annualBillingMigration = readFileSync(new URL("../prisma/migrations/20260826013000_annual_billing_cycle/migration.sql", import.meta.url), "utf8");
const entitlementMigration = readFileSync(new URL("../prisma/migrations/20260826060000_update_plan_entitlements/migration.sql", import.meta.url), "utf8");

test("canonical plans and the dedicated pricing catalog expose the approved prices", () => {
  const plans = Object.fromEntries(["starter", "growth", "unlimited", "lifetime"].map((code) => [code, getSubscriptionPlan(code)]));
  const publicPlans = Object.fromEntries(publicSubscriptionPlans().map((plan) => [plan.code, plan]));
  assert.equal(plans.starter.monthlyPrice, 2900);
  assert.equal(plans.growth.monthlyPrice, 4900);
  assert.equal(plans.unlimited.monthlyPrice, 6900);
  assert.equal(plans.lifetime.monthlyPrice, 280000);
  assert.equal(plans.growth.recommended, true);
  for (const plan of Object.values(plans)) {
    assert.equal(Object.keys(plan).some((key) => /setup.?fee/i.test(key)), false);
  }
  assert.deepEqual(PLAN_WEBSITE_PAGE_ALLOWANCES, { starter: 8, growth: 15, unlimited: 20, lifetime: 8 });
  assert.equal(plans.starter.maxUsers, 10);
  assert.equal(plans.growth.maxUsers, 15);
  assert.equal(plans.unlimited.maxUsers, null);
  assert.equal(plans.starter.maxBranches, 2);
  assert.equal(plans.growth.maxBranches, 4);
  assert.equal(plans.unlimited.maxBranches, null);
  assert.equal(plans.starter.includedWebsitePages, 8);
  assert.equal(plans.growth.includedWebsitePages, 15);
  assert.equal(plans.unlimited.includedWebsitePages, 20);
  assert.equal(publicPlans.starter.monthlyPrice, 2900);
  assert.equal(publicPlans.growth.monthlyPrice, 4900);
  assert.equal(publicPlans.unlimited.monthlyPrice, 6900);
  assert.equal(publicPlans.lifetime.monthlyPrice, 280000);
  assert.equal(publicPlans.starter.annualPrice, 31320);
  assert.equal(publicPlans.growth.annualPrice, 52920);
  assert.equal(publicPlans.unlimited.annualPrice, 74520);
  assert.equal(publicPlans.starter.currency, "PHP");
});

test("monthly plans support one-month payment or 12 months prepaid with exactly 10 percent off", () => {
  assert.equal(ANNUAL_BILLING_MONTHS, 12);
  assert.equal(ANNUAL_DISCOUNT_PERCENT, 10);
  const expectedAnnualPrices = { starter: 31320, growth: 52920, unlimited: 74520 };
  for (const [code, annualPrice] of Object.entries(expectedAnnualPrices)) {
    const plan = getSubscriptionPlan(code);
    assert.equal(plan.annualPrice, annualPrice);
    assert.equal(billingDetails(plan, "monthly").amount, plan.monthlyPrice);
    assert.equal(billingDetails(plan, "monthly").months, 1);
    assert.equal(billingDetails(plan, "annual").amount, annualPrice);
    assert.equal(billingDetails(plan, "annual").months, 12);
    assert.equal(billingDetails(plan, "annual").discountPercent, 10);
  }
  assert.equal(getSubscriptionPlan("lifetime").annualPrice, null);
  assert.equal(billingDetails(getSubscriptionPlan("lifetime"), "annual").cycle, "one_time");
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
  assert.equal(assertUsageWithinPlan(starter, { users: 10, branches: 2 }).allowed, true);
  assert.equal(assertUsageWithinPlan(starter, { users: 11, branches: 2 }).resource, "users");
  assert.equal(assertUsageWithinPlan(starter, { users: 10, branches: 3 }).resource, "branches");
  assert.equal(assertUsageWithinPlan(growth, { users: 15, branches: 4 }).allowed, true);
  assert.equal(assertUsageWithinPlan(growth, { users: 16, branches: 4 }).resource, "users");
  assert.equal(assertUsageWithinPlan(growth, { users: 15, branches: 5 }).resource, "branches");
  assert.equal(assertUsageWithinPlan(unlimited, { users: 10000, branches: 1000 }).allowed, true);
  assert.deepEqual(starter.moduleEntitlements, growth.moduleEntitlements);
  assert.deepEqual(growth.moduleEntitlements, unlimited.moduleEntitlements);
  assert.ok(starter.moduleEntitlements.includes("appointments"));
  assert.ok(starter.moduleEntitlements.includes("sms"));
});

test("user invitations allow the final plan seat and block only the next seat", () => {
  const starter = getSubscriptionPlan("starter");
  const growth = getSubscriptionPlan("growth");
  const unlimited = getSubscriptionPlan("unlimited");
  assert.deepEqual(userAdditionWithinPlan(starter, 9), { allowed: true, current: 9, nextCount: 10, limit: 10 });
  assert.deepEqual(userAdditionWithinPlan(starter, 10), { allowed: false, current: 10, nextCount: 11, limit: 10 });
  assert.deepEqual(userAdditionWithinPlan(growth, 14), { allowed: true, current: 14, nextCount: 15, limit: 15 });
  assert.deepEqual(userAdditionWithinPlan(growth, 15), { allowed: false, current: 15, nextCount: 16, limit: 15 });
  assert.equal(userAdditionWithinPlan(unlimited, 1000).allowed, true);
  assert.equal(userAdditionWithinPlan(starter, 10, { alreadyCounted: true }).allowed, true);
  const invitationLimiter = serverSource.slice(serverSource.indexOf("async function assertUserPlanLimit"), serverSource.indexOf("async function assertBranchPlanLimit"));
  assert.match(invitationLimiter, /userAdditionWithinPlan\(plan, usage\.users, \{ alreadyCounted \}\)/);
  assert.match(invitationLimiter, /if \(!limitCheck\.allowed\)/);
});

test("pricing and registration state the corrected website scope without a setup charge", () => {
  assert.equal(INCLUDED_WEBSITE_PAGES, 8);
  assert.match(appSource, /Free responsive website with 8–20 pages depending on plan/);
  assert.match(appSource, /Free website up to \{plan\.includedWebsitePages\} pages/);
  assert.match(appSource, /Starter includes 8 pages, Growth includes 15, and Unlimited includes 20/);
  assert.match(appSource, /Additional website pages are quoted separately/);
  assert.match(appSource, /Repeated sections on the same route do not count as separate pages/);
  assert.match(appSource, /never affect your ZenshoTech modules or operational data/);
  assert.doesNotMatch(appSource, /₱\s*20,?000|One-time setup fee/i);
  assert.doesNotMatch(serverSource, /₱\s*20,?000|setupFeeStatus|setupFeePaid/i);
});

test("registration remains pending and trial activation creates no setup charge", () => {
  const registrationWorkspace = serverSource.slice(serverSource.indexOf("async function createOwnerWorkspace"), serverSource.indexOf("async function deliverRegistrationConfirmation"));
  const registrationRoute = serverSource.slice(serverSource.indexOf('app.post("/api/auth/register"'), serverSource.indexOf('app.post("/api/auth/demo-register"'));
  const trialRoute = serverSource.slice(serverSource.indexOf('app.post("/api/subscription/trial"'), serverSource.indexOf('app.post("/api/subscription/request-activation"'));
  assert.match(registrationWorkspace, /status: "pending_plan"/);
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
  assert.match(schema, /billingCycle\s+String\s+@default\("monthly"\)/);
  assert.match(schema, /requestedBillingCycle\s+String\?/);
  assert.match(annualBillingMigration, /ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'monthly'/);
  assert.match(annualBillingMigration, /ADD COLUMN "requestedBillingCycle" TEXT/);
  assert.doesNotMatch(annualBillingMigration, /DELETE FROM|DROP TABLE|DROP COLUMN/i);
  assert.match(entitlementMigration, /WHEN 'growth' THEN 15/);
  assert.match(entitlementMigration, /WHEN 'unlimited' THEN 20/);
  assert.doesNotMatch(entitlementMigration, /DELETE FROM|DROP TABLE|DROP COLUMN/i);
});

test("pricing and activation flows carry the selected billing cycle", () => {
  assert.match(appSource, /Pay monthly/);
  assert.match(appSource, /Pay annually/);
  assert.match(appSource, /Save 10%/);
  assert.match(appSource, /startSubscriptionTrial\(plan\.code, billingCycle\)/);
  assert.match(appSource, /requestSubscriptionActivation\(plan\.code, billingCycle\)/);
  const activationRoute = serverSource.slice(serverSource.indexOf('app.post("/api/subscription/request-activation"'), serverSource.indexOf('app.get("/api/admin/subscriptions"'));
  assert.match(activationRoute, /requestedBillingCycle: billingCycle/);
  assert.match(activationRoute, /subscriptionSalesRecipient\(process\.env\)/);
  assert.match(activationRoute, /sendSmtpEmail\(\{ transporter, \.\.\.email \}\)/);
  assert.match(activationRoute, /notificationSent: true/);
  assert.match(serverSource, /billingCycle === "annual" \? 12 : 1/);
});

test("shareable pricing shows prices and trials while the homepage has no pricing link", () => {
  const pricingSource = appSource.slice(appSource.indexOf("function PricingPage"), appSource.indexOf("function SubscriptionPage"));
  const loginSource = appSource.slice(appSource.indexOf("function LoginScreen"), appSource.indexOf("function ResetPasswordScreen"));
  assert.match(pricingSource, /plan\.monthlyPrice/);
  assert.match(pricingSource, /plan\.annualPrice/);
  assert.match(pricingSource, /planPrice\(lifetimePlan\.monthlyPrice\)/);
  assert.match(pricingSource, /Start free trial/);
  const fixedPlanCards = pricingSource.slice(pricingSource.indexOf('aria-label="Subscription plans"'), pricingSource.indexOf('className="pricing-reassurance"'));
  assert.doesNotMatch(fixedPlanCards, /Request (?:a )?quote/i);
  assert.match(pricingSource, /Request one-time quote/);
  assert.match(pricingSource, /Request an additional-page quote/);
  assert.match(pricingSource, /Compare all features/);
  assert.match(pricingSource, /pricing-info-accordion/);
  assert.doesNotMatch(loginSource, /\/pricing|View pricing/i);
  const subscription = { id: "sub-quote", planCode: "growth", requestedPlanCode: "growth", status: "trialing", billingCycle: "annual", requestedBillingCycle: "annual", trialEndAt: new Date("2026-09-01T00:00:00.000Z") };
  const customerView = serializeSubscription(subscription, {}, new Date("2026-08-26T00:00:00.000Z"));
  assert.equal(customerView.includedWebsitePages, 15);
  assert.equal("monthlyPrice" in customerView.plan, false);
  assert.equal("amount" in customerView.billing, false);
  assert.equal("amount" in customerView.requestedBilling, false);
  const adminView = serializeSubscription(subscription, {}, new Date("2026-08-26T00:00:00.000Z"), { includePricing: true });
  assert.equal(adminView.plan.monthlyPrice, 4900);
  assert.equal(adminView.billing.amount, 52920);
});

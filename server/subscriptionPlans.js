import { sidebarModules } from "./moduleRegistry.js";

export const TRIAL_DURATION_HOURS = 168;
export const INCLUDED_WEBSITE_PAGES = 8;

const completeModuleEntitlements = Object.freeze([
  "my-workspace",
  "applications",
  ...sidebarModules.map((module) => module.id),
]);

const monthlyPlan = ({ code, name, monthlyPrice, maxUsers, maxBranches, recommended = false, displayOrder }) => Object.freeze({
  code,
  name,
  monthlyPrice,
  currency: "PHP",
  billingInterval: "month",
  maxUsers,
  maxBranches,
  moduleEntitlements: completeModuleEntitlements,
  trialAvailable: true,
  trialDurationHours: TRIAL_DURATION_HOURS,
  active: true,
  recommended,
  displayOrder,
  includedWebsitePages: INCLUDED_WEBSITE_PAGES,
});

export const subscriptionPlans = Object.freeze([
  monthlyPlan({ code: "starter", name: "Starter", monthlyPrice: 3900, maxUsers: 5, maxBranches: 1, displayOrder: 1 }),
  monthlyPlan({ code: "growth", name: "Growth", monthlyPrice: 5900, maxUsers: 10, maxBranches: 3, recommended: true, displayOrder: 2 }),
  monthlyPlan({ code: "unlimited", name: "Unlimited", monthlyPrice: 7999, maxUsers: null, maxBranches: null, displayOrder: 3 }),
  Object.freeze({
    code: "lifetime",
    name: "One-Time Purchase",
    monthlyPrice: 120000,
    currency: "PHP",
    billingInterval: "one_time",
    maxUsers: null,
    maxBranches: null,
    moduleEntitlements: completeModuleEntitlements,
    trialAvailable: false,
    trialDurationHours: 0,
    active: true,
    recommended: false,
    displayOrder: 4,
    includedWebsitePages: INCLUDED_WEBSITE_PAGES,
  }),
]);

const planByCode = new Map(subscriptionPlans.map((plan) => [plan.code, plan]));

export function getSubscriptionPlan(code) {
  return planByCode.get(String(code || "").trim().toLowerCase()) || null;
}

export function publicSubscriptionPlans() {
  return subscriptionPlans
    .filter((plan) => plan.active)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((plan) => ({ ...plan, moduleEntitlements: [...plan.moduleEntitlements] }));
}

export function effectiveSubscriptionStatus(subscription, now = new Date()) {
  if (!subscription) return "grandfathered";
  if (subscription.status === "trialing" && subscription.trialEndAt && subscription.trialEndAt <= now) return "expired";
  if (subscription.status === "active" && subscription.expiresAt && subscription.expiresAt <= now) return "expired";
  return subscription.status;
}

export function subscriptionAllowsOperations(subscription, now = new Date()) {
  return ["grandfathered", "trialing", "active", "lifetime"].includes(effectiveSubscriptionStatus(subscription, now));
}

export function isMonthlyPlan(plan) {
  return Boolean(plan?.trialAvailable && plan.billingInterval === "month");
}

export function planLimitMessage(plan, resource) {
  const singular = resource === "branches" ? "branch" : "user";
  const action = resource === "branches" ? "add another branch" : "add more users";
  return `You have reached the ${singular} limit for the ${plan.name} plan. Upgrade your plan to ${action}.`;
}

export function assertUsageWithinPlan(plan, { users = 0, branches = 0 } = {}) {
  if (!plan) throw new Error("A valid subscription plan is required.");
  if (plan.maxUsers !== null && users > plan.maxUsers) {
    return { allowed: false, resource: "users", limit: plan.maxUsers, current: users, message: `Reduce active users and pending invitations to ${plan.maxUsers} before switching to ${plan.name}.` };
  }
  if (plan.maxBranches !== null && branches > plan.maxBranches) {
    return { allowed: false, resource: "branches", limit: plan.maxBranches, current: branches, message: `Reduce active branches to ${plan.maxBranches} before switching to ${plan.name}.` };
  }
  return { allowed: true };
}

export function trialWindow(startedAt = new Date()) {
  const start = new Date(startedAt);
  return { start, end: new Date(start.getTime() + (TRIAL_DURATION_HOURS * 60 * 60 * 1000)) };
}

export function serializeSubscription(subscription, { users = 0, branches = 0 } = {}, now = new Date()) {
  if (!subscription) {
    const plan = getSubscriptionPlan("unlimited");
    return {
      id: null,
      plan,
      planCode: "unlimited",
      status: "grandfathered",
      accessAllowed: true,
      isExistingAccountDefault: true,
      includedWebsitePages: INCLUDED_WEBSITE_PAGES,
      usage: { users, branches },
    };
  }
  const plan = getSubscriptionPlan(subscription.planCode);
  const status = effectiveSubscriptionStatus(subscription, now);
  return {
    id: subscription.id,
    plan,
    planCode: subscription.planCode,
    requestedPlanCode: subscription.requestedPlanCode,
    status,
    accessAllowed: subscriptionAllowsOperations(subscription, now),
    isExistingAccountDefault: false,
    trialStartAt: subscription.trialStartAt,
    trialEndAt: subscription.trialEndAt,
    paidStartAt: subscription.paidStartAt,
    renewalAt: subscription.renewalAt,
    cancellationAt: subscription.cancellationAt,
    expirationAt: subscription.expiresAt,
    activationRequestedAt: subscription.activationRequestedAt,
    includedWebsitePages: subscription.includedWebsitePages || INCLUDED_WEBSITE_PAGES,
    usage: { users, branches },
  };
}

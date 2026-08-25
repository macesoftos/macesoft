import { sidebarModules } from "./moduleRegistry.js";

export const TRIAL_DURATION_HOURS = 168;
export const INCLUDED_WEBSITE_PAGES = 8;
export const PLAN_WEBSITE_PAGE_ALLOWANCES = Object.freeze({
  starter: 8,
  growth: 15,
  unlimited: 20,
  lifetime: 8,
});
export const ANNUAL_BILLING_MONTHS = 12;
export const ANNUAL_DISCOUNT_PERCENT = 10;

const completeModuleEntitlements = Object.freeze([
  "my-workspace",
  "applications",
  ...sidebarModules.map((module) => module.id),
]);

const monthlyPlan = ({ code, name, monthlyPrice, maxUsers, maxBranches, includedWebsitePages, recommended = false, displayOrder }) => Object.freeze({
  code,
  name,
  monthlyPrice,
  currency: "PHP",
  billingInterval: "month",
  annualPrice: Number((monthlyPrice * ANNUAL_BILLING_MONTHS * (1 - (ANNUAL_DISCOUNT_PERCENT / 100))).toFixed(2)),
  annualDiscountPercent: ANNUAL_DISCOUNT_PERCENT,
  maxUsers,
  maxBranches,
  moduleEntitlements: completeModuleEntitlements,
  trialAvailable: true,
  trialDurationHours: TRIAL_DURATION_HOURS,
  active: true,
  recommended,
  displayOrder,
  includedWebsitePages,
});

export const subscriptionPlans = Object.freeze([
  monthlyPlan({ code: "starter", name: "Starter", monthlyPrice: 3900, maxUsers: 10, maxBranches: 1, includedWebsitePages: PLAN_WEBSITE_PAGE_ALLOWANCES.starter, displayOrder: 1 }),
  monthlyPlan({ code: "growth", name: "Growth", monthlyPrice: 5900, maxUsers: 15, maxBranches: 3, includedWebsitePages: PLAN_WEBSITE_PAGE_ALLOWANCES.growth, recommended: true, displayOrder: 2 }),
  monthlyPlan({ code: "unlimited", name: "Unlimited", monthlyPrice: 7999, maxUsers: null, maxBranches: null, includedWebsitePages: PLAN_WEBSITE_PAGE_ALLOWANCES.unlimited, displayOrder: 3 }),
  Object.freeze({
    code: "lifetime",
    name: "One-Time Purchase",
    monthlyPrice: 280000,
    currency: "PHP",
    billingInterval: "one_time",
    annualPrice: null,
    annualDiscountPercent: 0,
    maxUsers: null,
    maxBranches: null,
    moduleEntitlements: completeModuleEntitlements,
    trialAvailable: false,
    trialDurationHours: 0,
    active: true,
    recommended: false,
    displayOrder: 4,
    includedWebsitePages: PLAN_WEBSITE_PAGE_ALLOWANCES.lifetime,
  }),
]);

const planByCode = new Map(subscriptionPlans.map((plan) => [plan.code, plan]));

function planWithoutPricing(plan) {
  if (!plan) return null;
  const { monthlyPrice: _monthlyPrice, annualPrice: _annualPrice, currency: _currency, ...visiblePlan } = plan;
  return { ...visiblePlan, moduleEntitlements: [...plan.moduleEntitlements] };
}

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

export function normalizeBillingCycle(value, plan) {
  if (plan?.billingInterval === "one_time") return "one_time";
  return String(value || "").trim().toLowerCase() === "annual" ? "annual" : "monthly";
}

export function billingDetails(plan, billingCycle = "monthly") {
  if (!plan) return null;
  const cycle = normalizeBillingCycle(billingCycle, plan);
  if (cycle === "one_time") {
    return { cycle, amount: plan.monthlyPrice, months: null, discountPercent: 0 };
  }
  if (cycle === "annual") {
    return {
      cycle,
      amount: plan.annualPrice,
      months: ANNUAL_BILLING_MONTHS,
      discountPercent: ANNUAL_DISCOUNT_PERCENT,
      monthlyEquivalent: Number((plan.annualPrice / ANNUAL_BILLING_MONTHS).toFixed(2)),
    };
  }
  return { cycle, amount: plan.monthlyPrice, months: 1, discountPercent: 0, monthlyEquivalent: plan.monthlyPrice };
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

export function userAdditionWithinPlan(plan, currentUsers = 0, { alreadyCounted = false } = {}) {
  if (!plan) throw new Error("A valid subscription plan is required.");
  const nextCount = Math.max(0, Number(currentUsers) || 0) + (alreadyCounted ? 0 : 1);
  return {
    allowed: plan.maxUsers === null || nextCount <= plan.maxUsers,
    current: Math.max(0, Number(currentUsers) || 0),
    nextCount,
    limit: plan.maxUsers,
  };
}

export function trialWindow(startedAt = new Date()) {
  const start = new Date(startedAt);
  return { start, end: new Date(start.getTime() + (TRIAL_DURATION_HOURS * 60 * 60 * 1000)) };
}

function visibleBillingDetails(plan, billingCycle, includePricing) {
  const details = billingDetails(plan, billingCycle);
  if (!details || includePricing) return details;
  const { amount: _amount, monthlyEquivalent: _monthlyEquivalent, ...visibleDetails } = details;
  return visibleDetails;
}

export function serializeSubscription(subscription, { users = 0, branches = 0 } = {}, now = new Date(), { includePricing = false } = {}) {
  if (!subscription) {
    const plan = getSubscriptionPlan("unlimited");
    return {
      id: null,
      plan: includePricing ? plan : planWithoutPricing(plan),
      planCode: "unlimited",
      status: "grandfathered",
      accessAllowed: true,
      isExistingAccountDefault: true,
      billingCycle: null,
      requestedBillingCycle: null,
      requestedPlan: null,
      requestedBilling: null,
      billing: null,
      includedWebsitePages: plan.includedWebsitePages,
      usage: { users, branches },
    };
  }
  const plan = getSubscriptionPlan(subscription.planCode);
  const status = effectiveSubscriptionStatus(subscription, now);
  const billingCycle = normalizeBillingCycle(subscription.billingCycle, plan);
  const requestedPlan = getSubscriptionPlan(subscription.requestedPlanCode);
  const requestedBillingCycle = subscription.requestedPlanCode
    ? normalizeBillingCycle(subscription.requestedBillingCycle, requestedPlan)
    : null;
  return {
    id: subscription.id,
    plan: includePricing ? plan : planWithoutPricing(plan),
    planCode: subscription.planCode,
    requestedPlanCode: subscription.requestedPlanCode,
    billingCycle,
    requestedBillingCycle,
    billing: visibleBillingDetails(plan, billingCycle, includePricing),
    requestedPlan: includePricing ? requestedPlan : planWithoutPricing(requestedPlan),
    requestedBilling: requestedPlan ? visibleBillingDetails(requestedPlan, requestedBillingCycle, includePricing) : null,
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
    includedWebsitePages: plan?.includedWebsitePages ?? subscription.includedWebsitePages ?? INCLUDED_WEBSITE_PAGES,
    usage: { users, branches },
  };
}

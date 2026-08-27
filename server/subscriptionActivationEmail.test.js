import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SUBSCRIPTION_SALES_EMAIL,
  activationRequestEmail,
  subscriptionSalesRecipient,
} from "./subscriptionActivationEmail.js";

const requestDetails = {
  account: { name: "Jamie Owner", email: "owner@example.com", organizationId: "org-123" },
  organization: { id: "org-123", name: "Glow & Go <Clinic>" },
  plan: { name: "Growth", currency: "PHP", maxUsers: 15, maxBranches: 3, includedWebsitePages: 15 },
  billing: { amount: 4900, discountPercent: 0 },
  billingCycle: "monthly",
  usage: { users: 2, branches: 1 },
  subscription: { status: "trialing", trialEndAt: new Date("2026-09-02T03:28:00.000Z") },
  requestedAt: new Date("2026-08-26T04:00:00.000Z"),
  appOrigin: "https://staging.zenshotech.com,https://zenshotech.com",
};

test("subscription quote requests default to the ZenshoTech sales inbox", () => {
  assert.equal(DEFAULT_SUBSCRIPTION_SALES_EMAIL, "sales@zenshotech.com");
  assert.equal(subscriptionSalesRecipient({}), "sales@zenshotech.com");
  assert.equal(subscriptionSalesRecipient({ SUBSCRIPTION_SALES_EMAIL: " Quotes@ZenshoTech.com " }), "quotes@zenshotech.com");
  assert.equal(subscriptionSalesRecipient({ SUBSCRIPTION_SALES_EMAIL: "not-an-email" }), "sales@zenshotech.com");
});

test("monthly activation email contains the actionable request details and reply address", () => {
  const email = activationRequestEmail({ ...requestDetails, recipient: "sales@zenshotech.com" });
  assert.equal(email.to, "sales@zenshotech.com");
  assert.equal(email.replyTo, "owner@example.com");
  assert.match(email.subject, /Growth monthly quote request/);
  assert.match(email.text, /Quoted catalog amount: ₱4,900\.00/);
  assert.match(email.text, /Current users: 2 \/ 15/);
  assert.match(email.text, /Review in ZenshoTech: https:\/\/staging\.zenshotech\.com\/subscription/);
  assert.match(email.html, /Glow &amp; Go &lt;Clinic&gt;/);
  assert.doesNotMatch(email.html, /Glow & Go <Clinic>/);
});

test("annual activation email identifies the 12-month discounted quote", () => {
  const email = activationRequestEmail({
    ...requestDetails,
    billingCycle: "annual",
    billing: { amount: 52920, discountPercent: 10 },
  });
  assert.match(email.subject, /Growth annual quote request/);
  assert.match(email.text, /Billing cycle: Annual \(12 months\)/);
  assert.match(email.text, /Quoted catalog amount: ₱52,920\.00/);
  assert.match(email.text, /Discount: 10%/);
});

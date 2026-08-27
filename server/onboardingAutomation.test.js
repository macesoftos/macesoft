import test from "node:test";
import assert from "node:assert/strict";
import {
  brandedEmailHtml,
  normalizeOnboardingWorkflowPayload,
  normalizeWorkspaceBranding,
  publicInvoice,
  renderOnboardingContent,
} from "./onboardingAutomation.js";

test("workspace branding is clinic-owned and safely normalized", () => {
  const branding = normalizeWorkspaceBranding({
    businessName: "Lumina Aesthetic Clinic",
    primaryColor: "#A15B67",
    invoicePrefix: "lumina inv!",
    email: "CARE@LUMINA.EXAMPLE",
    logoUrl: "javascript:alert(1)",
  }, {}, { name: "Fallback Clinic" });
  assert.equal(branding.businessName, "Lumina Aesthetic Clinic");
  assert.equal(branding.primaryColor, "#a15b67");
  assert.equal(branding.invoicePrefix, "LUMINAINV");
  assert.equal(branding.email, "care@lumina.example");
  assert.equal(branding.logoUrl, "");
  assert.equal(branding.poweredBy, false);
});

test("onboarding requires a positive amount only when invoice creation is enabled", () => {
  assert.throws(() => normalizeOnboardingWorkflowPayload({ createInvoice: true, invoiceAmount: 0 }), /invoice or deposit amount/i);
  const workflow = normalizeOnboardingWorkflowPayload({ createInvoice: true, invoiceAmount: 2500, requireApproval: true });
  assert.equal(workflow.kind, "onboarding");
  assert.equal(workflow.invoiceAmount, 2500);
  assert.equal(workflow.requireApproval, true);
  assert.equal(workflow.delayHours, 1);
});

test("welcome email and HTML use the clinic brand instead of ZenshoTech", () => {
  const branding = { businessName: "Lumina Aesthetic Clinic", primaryColor: "#a15b67", address: "BGC", phone: "0917", email: "care@lumina.example", website: "", logoUrl: "" };
  const workflow = normalizeOnboardingWorkflowPayload({ subject: "Welcome to {businessName}", messageTemplate: "Hi {firstName}, thanks for asking about {interest} at {branchName}." });
  const content = renderOnboardingContent(workflow, branding, { name: "Jamie Santos", interest: "HydraFacial", branch: "Lumina BGC" });
  const html = brandedEmailHtml({ branding, heading: content.subject, body: content.text });
  assert.equal(content.subject, "Welcome to Lumina Aesthetic Clinic");
  assert.match(content.text, /Jamie/);
  assert.match(content.text, /HydraFacial/);
  assert.match(html, /Lumina Aesthetic Clinic/);
  assert.doesNotMatch(html, /ZenshoTech/);
});

test("public invoice serialization excludes private recipient and provider fields", () => {
  const invoice = publicInvoice({
    invoiceNumber: "LUMINA-20260827-0001",
    recipientName: "Jamie Santos",
    recipientEmail: "private@example.com",
    currency: "PHP",
    subtotal: 2500,
    total: 2500,
    amountPaid: 0,
    status: "Sent",
    issueDate: "2026-08-27",
    dueDate: "2026-08-30",
    brandingSnapshot: JSON.stringify({ businessName: "Lumina Aesthetic Clinic", poweredBy: false }),
    paymentReference: "secret-provider-reference",
    items: [{ description: "Consultation deposit", quantity: 1, unitPrice: 2500, total: 2500 }],
  });
  assert.equal(invoice.branding.businessName, "Lumina Aesthetic Clinic");
  assert.equal(invoice.recipientEmail, undefined);
  assert.equal(invoice.paymentReference, undefined);
  assert.equal(invoice.items[0].description, "Consultation deposit");
});

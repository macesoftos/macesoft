export const DEFAULT_SUBSCRIPTION_SALES_EMAIL = "sales@zenshotech.com";

function clean(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatCurrency(amount, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatLimit(value) {
  return value === null || value === undefined ? "Unlimited" : String(value);
}

export function subscriptionSalesRecipient(env = process.env) {
  const configured = clean(env.SUBSCRIPTION_SALES_EMAIL).toLowerCase();
  return /^\S+@\S+\.\S+$/.test(configured) ? configured : DEFAULT_SUBSCRIPTION_SALES_EMAIL;
}

export function activationRequestEmail({
  recipient = DEFAULT_SUBSCRIPTION_SALES_EMAIL,
  account,
  organization,
  plan,
  billing,
  billingCycle,
  usage,
  subscription,
  requestedAt = new Date(),
  appOrigin = "",
}) {
  const cycleLabel = billingCycle === "annual" ? "Annual (12 months)" : "Monthly";
  const organizationName = clean(organization?.name) || "Unnamed organization";
  const requesterName = clean(account?.name) || "Unnamed account owner";
  const requesterEmail = clean(account?.email).toLowerCase();
  const reviewOrigin = clean(appOrigin).split(",")[0].replace(/\/$/, "");
  const reviewUrl = reviewOrigin ? `${reviewOrigin}/subscription` : "Not configured";
  const rows = [
    ["Organization", organizationName],
    ["Organization ID", clean(organization?.id) || clean(account?.organizationId)],
    ["Requested by", requesterName],
    ["Reply email", requesterEmail],
    ["Plan", clean(plan?.name)],
    ["Billing cycle", cycleLabel],
    ["Quoted catalog amount", formatCurrency(billing?.amount, plan?.currency)],
    ["Discount", `${Number(billing?.discountPercent) || 0}%`],
    ["Current users", `${Number(usage?.users) || 0} / ${formatLimit(plan?.maxUsers)}`],
    ["Current branches", `${Number(usage?.branches) || 0} / ${formatLimit(plan?.maxBranches)}`],
    ["Included website pages", String(plan?.includedWebsitePages ?? 8)],
    ["Current subscription status", clean(subscription?.status) || "Not available"],
    ["Trial expiration", formatDate(subscription?.trialEndAt)],
    ["Requested at", formatDate(requestedAt)],
    ["Review in ZenshoTech", reviewUrl],
  ];
  const subject = `[ZenshoTech] ${plan.name} ${billingCycle} quote request - ${organizationName}`;
  const text = [
    "A client requested a subscription quotation and activation.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "No payment or automatic activation was performed.",
  ].join("\n");
  const htmlRows = rows.map(([label, value]) => (
    `<tr><th style="padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #e7ded3">${escapeHtml(label)}</th>`
    + `<td style="padding:8px 12px;border-bottom:1px solid #e7ded3">${escapeHtml(value)}</td></tr>`
  )).join("");
  const html = [
    '<div style="font-family:Arial,sans-serif;color:#30261f;line-height:1.5">',
    "<h2>Subscription quote and activation request</h2>",
    "<p>A client requested a subscription quotation and activation.</p>",
    `<table style="border-collapse:collapse;width:100%;max-width:680px">${htmlRows}</table>`,
    "<p><strong>No payment or automatic activation was performed.</strong></p>",
    "</div>",
  ].join("");

  return { to: recipient, replyTo: requesterEmail, subject, text, html };
}

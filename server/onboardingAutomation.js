const clean = (value) => String(value ?? "").trim();

const escapeHtml = (value) => clean(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const safeHttpsUrl = (value) => {
  const url = clean(value);
  if (!url) return "";
  return /^https:\/\/[^\s]+$/i.test(url) ? url.slice(0, 500) : "";
};

export const onboardingDefaultSubject = "Thank you for contacting {businessName}";
export const onboardingDefaultMessage = "Hi {firstName}, thank you for contacting {businessName} about {interest}. Our team at {branchName} will review your inquiry and contact you with the next steps.";

export function defaultWorkspaceBranding(organization = {}) {
  return {
    businessName: clean(organization.name) || "Your clinic",
    logoUrl: "",
    primaryColor: "#9f5964",
    address: clean(organization.address),
    phone: clean(organization.phone),
    email: "",
    website: "",
    invoicePrefix: "INV",
    invoiceFooter: "Thank you for choosing our clinic.",
    currency: "PHP",
    poweredBy: false,
  };
}

export function normalizeWorkspaceBranding(payload = {}, current = {}, organization = {}) {
  const defaults = { ...defaultWorkspaceBranding(organization), ...current };
  const color = clean(payload.primaryColor ?? defaults.primaryColor);
  const invoicePrefix = clean(payload.invoicePrefix ?? defaults.invoicePrefix).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16);
  const currency = clean(payload.currency ?? defaults.currency).toUpperCase();
  return {
    businessName: (clean(payload.businessName ?? defaults.businessName) || defaults.businessName).slice(0, 140),
    logoUrl: safeHttpsUrl(payload.logoUrl ?? defaults.logoUrl),
    primaryColor: /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#9f5964",
    address: clean(payload.address ?? defaults.address).slice(0, 500),
    phone: clean(payload.phone ?? defaults.phone).slice(0, 40),
    email: clean(payload.email ?? defaults.email).toLowerCase().slice(0, 160),
    website: safeHttpsUrl(payload.website ?? defaults.website),
    invoicePrefix: invoicePrefix || "INV",
    invoiceFooter: clean(payload.invoiceFooter ?? defaults.invoiceFooter).slice(0, 1000),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "PHP",
    poweredBy: payload.poweredBy === undefined ? Boolean(defaults.poweredBy) : payload.poweredBy === true,
  };
}

export function normalizeOnboardingWorkflowPayload(payload = {}, current = {}) {
  const amount = Number(payload.invoiceAmount ?? current.invoiceAmount ?? 0);
  const dueDays = Math.round(Number(payload.invoiceDueDays ?? current.invoiceDueDays ?? 3));
  const createInvoice = payload.createInvoice === undefined ? Boolean(current.createInvoice) : payload.createInvoice === true;
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) throw new Error("Invoice amount must be between 0 and 10,000,000.");
  if (createInvoice && amount <= 0) throw new Error("Enter an invoice or deposit amount before enabling invoice creation.");
  if (!Number.isFinite(dueDays) || dueDays < 1 || dueDays > 90) throw new Error("Invoice due days must be between 1 and 90.");
  return {
    name: (clean(payload.name ?? current.name) || "New client onboarding").slice(0, 120),
    active: payload.active === undefined ? Boolean(current.active) : payload.active === true,
    branch: clean(payload.branch ?? current.branch) || "All branches",
    channel: "Email",
    subject: (clean(payload.subject ?? current.subject) || onboardingDefaultSubject).slice(0, 180),
    prompt: "Clinic-branded transactional onboarding workflow.",
    messageTemplate: (clean(payload.messageTemplate ?? current.messageTemplate) || onboardingDefaultMessage).slice(0, 3000),
    bookingUrl: clean(payload.bookingUrl ?? current.bookingUrl).slice(0, 500),
    kind: "onboarding",
    notifyStaff: payload.notifyStaff === undefined ? current.notifyStaff !== false : payload.notifyStaff === true,
    createInvoice,
    requireApproval: payload.requireApproval === undefined ? current.requireApproval !== false : payload.requireApproval === true,
    invoiceAmount: Math.round(amount * 100) / 100,
    invoiceLabel: (clean(payload.invoiceLabel ?? current.invoiceLabel) || "Consultation deposit").slice(0, 180),
    invoiceDueDays: dueDays,
    delayHours: 1,
  };
}

export function onboardingMergeValues(branding, lead) {
  const name = clean(lead.name) || "Client";
  return {
    firstName: clean(lead.preferredName || lead.firstName || name.split(/\s+/)[0]) || "there",
    name,
    interest: clean(lead.interest || lead.interestedTreatment || lead.interestedPackage) || "your inquiry",
    businessName: clean(branding.businessName) || "our clinic",
    branchName: clean(lead.branch) || "our clinic",
    businessPhone: clean(branding.phone),
    businessEmail: clean(branding.email),
    bookingLink: "",
  };
}

export function renderTemplate(template, values) {
  let rendered = clean(template);
  for (const [key, value] of Object.entries(values)) rendered = rendered.replaceAll(`{${key}}`, clean(value));
  return rendered.replace(/\{[a-zA-Z]+\}/g, "").replace(/\s+([,.!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

export function renderOnboardingContent(workflow, branding, lead, invoiceUrl = "") {
  const values = { ...onboardingMergeValues(branding, lead), bookingLink: clean(workflow.bookingUrl), invoiceLink: invoiceUrl };
  return {
    subject: renderTemplate(workflow.subject || onboardingDefaultSubject, values),
    text: renderTemplate(workflow.messageTemplate || onboardingDefaultMessage, values),
  };
}

export function brandedEmailHtml({ branding, heading, body, actionLabel = "", actionUrl = "" }) {
  const logo = branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.businessName)}" style="max-height:64px;max-width:220px;margin-bottom:18px">` : "";
  const action = actionLabel && actionUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:${escapeHtml(branding.primaryColor)};color:#fff;text-decoration:none;font-weight:700">${escapeHtml(actionLabel)}</a></p>`
    : "";
  const contact = [branding.phone, branding.email, branding.website].filter(Boolean).map(escapeHtml).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f7f3f2;color:#241f20;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border:1px solid #eadfdd;border-radius:16px;padding:32px">${logo}<h1 style="margin:0 0 18px;color:${escapeHtml(branding.primaryColor)};font-size:26px">${escapeHtml(heading)}</h1><div style="font-size:16px;line-height:1.65;white-space:pre-line">${escapeHtml(body)}</div>${action}<hr style="border:0;border-top:1px solid #eadfdd;margin:28px 0"><strong>${escapeHtml(branding.businessName)}</strong><div style="margin-top:6px;color:#766b6d;font-size:13px">${escapeHtml(branding.address)}</div><div style="margin-top:4px;color:#766b6d;font-size:13px">${contact}</div></div></div></body></html>`;
}

export function invoiceBrandingSnapshot(branding) {
  return JSON.stringify({
    businessName: branding.businessName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    address: branding.address,
    phone: branding.phone,
    email: branding.email,
    website: branding.website,
    invoiceFooter: branding.invoiceFooter,
    poweredBy: branding.poweredBy,
  });
}

export function publicInvoice(invoice) {
  const branding = typeof invoice.brandingSnapshot === "string" ? JSON.parse(invoice.brandingSnapshot || "{}") : invoice.brandingSnapshot || {};
  return {
    invoiceNumber: invoice.invoiceNumber,
    recipientName: invoice.recipientName,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    discount: invoice.discount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    sentAt: invoice.sentAt,
    viewedAt: invoice.viewedAt,
    branding,
    items: (invoice.items || []).map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
  };
}

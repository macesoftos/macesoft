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

export function registrationConfirmationEmail({ account, organization, appOrigin = "", authenticationMethod = "email and password" }) {
  const name = clean(account?.name) || "there";
  const businessName = clean(organization?.name) || "your clinic";
  const origin = clean(appOrigin).split(",")[0].replace(/\/$/, "");
  const signInUrl = origin || "https://zenshotech.com";
  const subject = "Welcome to ZenshoTech - your workspace is ready";
  const text = [
    `Hello ${name},`,
    "",
    `Your ZenshoTech workspace for ${businessName} has been created successfully.`,
    `Registration email: ${clean(account?.email)}`,
    `Sign-in method: ${authenticationMethod}`,
    "",
    `Open ZenshoTech: ${signInUrl}`,
    "",
    "Registration does not start a trial or create a charge. Choose a plan when you are ready to begin the 7-day trial.",
    "",
    "If you did not create this account, contact ZenshoTech support.",
  ].join("\n");
  const html = [
    '<div style="font-family:Arial,sans-serif;color:#30261f;line-height:1.6;max-width:640px">',
    `<h2>Welcome to ZenshoTech, ${escapeHtml(name)}</h2>`,
    `<p>Your ZenshoTech workspace for <strong>${escapeHtml(businessName)}</strong> has been created successfully.</p>`,
    `<p><strong>Registration email:</strong> ${escapeHtml(account?.email)}<br><strong>Sign-in method:</strong> ${escapeHtml(authenticationMethod)}</p>`,
    `<p><a href="${escapeHtml(signInUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#713044;color:#fff;text-decoration:none">Open ZenshoTech</a></p>`,
    "<p>Registration does not start a trial or create a charge. Choose a plan when you are ready to begin the 7-day trial.</p>",
    "<p>If you did not create this account, contact ZenshoTech support.</p>",
    "</div>",
  ].join("");
  return { to: clean(account?.email).toLowerCase(), subject, text, html };
}

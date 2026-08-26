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
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function providerRegistrationEmail({
  recipient,
  account,
  organization,
  authenticationMethod = "email and password",
  registeredAt = new Date(),
  appOrigin = "",
  workspaceType = "customer",
}) {
  const organizationName = clean(organization?.name) || "Unnamed workspace";
  const ownerName = clean(account?.name) || "Unnamed registrant";
  const ownerEmail = clean(account?.email).toLowerCase();
  const primaryBranch = account?.organization?.branches?.[0];
  const phone = clean(organization?.phone) || clean(primaryBranch?.phone);
  const address = clean(organization?.address) || clean(primaryBranch?.address);
  const registrationSource = clean(organization?.registrationSource);
  const origin = clean(appOrigin).split(",")[0].replace(/\/$/, "");
  const providerUrl = origin ? `${origin}/provider` : "https://zenshotech.com/provider";
  const typeLabel = workspaceType === "demo" ? "Demo workspace" : "Customer workspace";
  const rows = [
    ["Workspace", organizationName],
    ["Workspace ID", clean(organization?.id) || clean(account?.organizationId)],
    ["Registrant", ownerName],
    ["Email", ownerEmail],
    ["Phone", phone || "Not provided"],
    ["Business address", address || "Not provided"],
    ["Heard about us", registrationSource || "Not provided"],
    ["Type", typeLabel],
    ["Sign-in method", authenticationMethod],
    ["Registered at", formatDate(registeredAt)],
    ["Review in ZenshoTech", providerUrl],
  ];
  const subject = `[ZenshoTech] New ${workspaceType === "demo" ? "demo " : ""}registration - ${organizationName}`;
  const text = [
    `A new ${typeLabel.toLowerCase()} was registered in ZenshoTech.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
  const htmlRows = rows.map(([label, value]) => (
    `<tr><th style="padding:8px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #eadfe0">${escapeHtml(label)}</th>`
    + `<td style="padding:8px 12px;border-bottom:1px solid #eadfe0">${escapeHtml(value)}</td></tr>`
  )).join("");
  const html = [
    '<div style="font-family:Arial,sans-serif;color:#30261f;line-height:1.5">',
    `<h2>New ${escapeHtml(typeLabel.toLowerCase())} registration</h2>`,
    `<p><strong>${escapeHtml(ownerName)}</strong> created <strong>${escapeHtml(organizationName)}</strong>.</p>`,
    `<table style="border-collapse:collapse;width:100%;max-width:680px">${htmlRows}</table>`,
    `<p><a href="${escapeHtml(providerUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#9d5660;color:#fff;text-decoration:none">Open provider workspace</a></p>`,
    "</div>",
  ].join("");

  return { to: clean(recipient).toLowerCase(), replyTo: ownerEmail, subject, text, html };
}

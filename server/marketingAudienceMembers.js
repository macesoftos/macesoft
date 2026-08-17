export const marketingAudienceIds = Object.freeze([
  "All consented clients",
  "Inactive clients",
  "Inactive 60 days",
  "Inactive 30 days",
  "Birthday month",
  "New clients",
  "Returning clients",
  "VIP",
]);

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeMarketingAudienceEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizeMarketingAudienceMember(values, { defaultAudience = "", defaultBranch = "", source = "Manual" } = {}) {
  const email = normalizeMarketingAudienceEmail(values?.email);
  if (!email) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });

  const audience = clean(values?.audience || defaultAudience);
  if (!marketingAudienceIds.includes(audience)) {
    throw Object.assign(new Error("Choose a valid saved audience."), { status: 400 });
  }

  const branch = clean(values?.branch || defaultBranch);
  if (!branch || branch === "All branches") {
    throw Object.assign(new Error("Choose the clinic branch that owns this contact."), { status: 400 });
  }

  const fallbackName = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    email,
    name: clean(values?.name).slice(0, 160) || fallbackName || "Email contact",
    audience,
    branch,
    source: clean(values?.source || source).slice(0, 40) || source,
  };
}

export function marketingAudienceMemberMatchesSegment(member, segment) {
  const requested = clean(segment) || marketingAudienceIds[0];
  return requested === marketingAudienceIds[0] || clean(member?.audience) === requested;
}

export function marketingAudienceMemberAsClient(member) {
  return {
    id: member.id,
    fullName: clean(member.name) || "Email contact",
    email: normalizeMarketingAudienceEmail(member.email),
    mobile: "",
    branch: clean(member.branch),
    marketingOptIn: true,
    source: clean(member.source) || "Manual",
    audience: clean(member.audience),
    audienceMember: true,
  };
}

export const marketingModuleId = "sms";

export const marketingSections = [
  "overview",
  "campaigns",
  "templates",
  "audiences",
  "automations",
  "media",
  "reports",
  "settings",
];

const marketingSectionSet = new Set(marketingSections);

export function hashRouteSegments(hash) {
  return String(hash ?? "")
    .replace(/^#\/?/, "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

export function marketingSectionFromHash(hash) {
  const [workspace, section] = hashRouteSegments(hash);
  if (workspace !== "marketing") return "";
  if (!section) return "overview";
  return marketingSectionSet.has(section) ? section : "";
}

export function marketingRouteFromHash(hash) {
  const segments = hashRouteSegments(hash);
  if (segments[0] !== "marketing") return null;

  const section = segments[1] || "overview";
  if (!marketingSectionSet.has(section)) return null;

  const campaignMode = segments[2] === "new"
    ? "create"
    : segments[2] === "deleted"
      ? "deleted"
      : "index";

  return {
    section,
    mode: section === "campaigns" ? campaignMode : "index",
  };
}

export function marketingRouteFromPath(pathname) {
  const segments = String(pathname ?? "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  if (segments[0] !== "marketing") return null;

  const section = segments[1] || "overview";
  if (!marketingSectionSet.has(section)) return null;

  const campaignMode = segments[2] === "new"
    ? "create"
    : segments[2] === "deleted"
      ? "deleted"
      : "index";

  return {
    section,
    mode: section === "campaigns" ? campaignMode : "index",
  };
}

export function isLegacySmsHash(hash) {
  const segments = hashRouteSegments(hash);
  return segments.length === 1 && segments[0] === "sms";
}

export function marketingHash(section = "overview", mode = "index") {
  const safeSection = marketingSectionSet.has(section) ? section : "overview";
  if (safeSection === "overview") return "#/marketing";
  if (safeSection === "campaigns" && mode === "create") return "#/marketing/campaigns/new";
  if (safeSection === "campaigns" && mode === "deleted") return "#/marketing/campaigns/deleted";
  return `#/marketing/${safeSection}`;
}

export function marketingPath(section = "overview", mode = "index") {
  const safeSection = marketingSectionSet.has(section) ? section : "overview";
  if (safeSection === "overview") return "/marketing";
  if (safeSection === "campaigns" && mode === "create") return "/marketing/campaigns/new";
  if (safeSection === "campaigns" && mode === "deleted") return "/marketing/campaigns/deleted";
  return `/marketing/${safeSection}`;
}

export function isMarketingHash(hash) {
  return Boolean(marketingRouteFromHash(hash));
}

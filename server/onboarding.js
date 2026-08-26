export const ONBOARDING_TOUR_VERSION = 1;

const ownerRoles = new Set(["Demo User", "Super Admin", "Owner", "Business Owner"]);
const managerRoles = new Set(["Admin", "Branch Manager"]);

export function onboardingRoleKind(role) {
  if (ownerRoles.has(role)) return "owner";
  if (managerRoles.has(role)) return "manager";
  return "staff";
}

const checklistDefinitions = [
  {
    id: "business-profile",
    title: "Complete business profile",
    description: "Add the business and contact details used in bookings, invoices, and messages.",
    modules: ["settings", "branches"],
    signal: "businessProfile",
  },
  {
    id: "first-branch",
    title: "Add your first branch",
    description: "Confirm the branch address, timezone, contact information, and operating status.",
    modules: ["branches"],
    signal: "branch",
  },
  {
    id: "services",
    title: "Add services or treatments",
    description: "Create the services clients can book and your team can sell.",
    modules: ["services", "treatments"],
    signal: "services",
  },
  {
    id: "rooms",
    title: "Configure rooms and resources",
    description: "Add the rooms or resources required for appointment scheduling.",
    modules: ["room-view", "branches"],
    signal: "rooms",
  },
  {
    id: "schedules",
    title: "Set business hours and staff schedules",
    description: "Define when the branch is open and when team members are available.",
    modules: ["staff-view", "staff", "branches"],
    signal: "schedules",
  },
  {
    id: "team",
    title: "Invite your team",
    description: "Invite at least one teammate and give them the right branch access.",
    modules: ["staff"],
    signal: "team",
  },
  {
    id: "client",
    title: "Add your first client",
    description: "Create a client profile so appointments, treatment history, and sales stay connected.",
    modules: ["clients"],
    signal: "client",
  },
  {
    id: "appointment",
    title: "Create your first appointment",
    description: "Book a client, service, room, and staff member into the schedule.",
    modules: ["appointments"],
    signal: "appointment",
  },
  {
    id: "inventory",
    title: "Add products or inventory",
    description: "Add at least one product or consumable and configure its stock level.",
    modules: ["inventory"],
    signal: "inventory",
  },
  {
    id: "pos-settings",
    title: "Configure POS and payment settings",
    description: "Review the payment methods and receipt settings used by your team.",
    modules: ["settings", "pos"],
    signal: "posSettings",
  },
  {
    id: "test-campaign",
    title: "Send a test email campaign",
    description: "Validate a campaign with safe test recipients before contacting clients.",
    modules: ["sms"],
    signal: "testCampaign",
  },
  {
    id: "permissions",
    title: "Review roles and permissions",
    description: "Confirm each teammate can access only the modules required for their work.",
    modules: ["staff", "settings"],
    signal: "permissions",
  },
];

export function buildOnboardingChecklist({ modules = [], signals = {} } = {}) {
  const allowed = new Set(modules);
  const items = checklistDefinitions.flatMap((definition) => {
    const moduleId = definition.modules.find((candidate) => allowed.has(candidate));
    if (!moduleId) return [];
    const complete = Boolean(signals[definition.signal]);
    const inProgressSignal = signals[`${definition.signal}InProgress`];
    const status = complete ? "Complete" : inProgressSignal ? "In progress" : "Not started";
    return [{
      id: definition.id,
      title: definition.title,
      description: definition.description,
      moduleId,
      status,
      complete,
    }];
  });
  const completed = items.filter((item) => item.complete).length;
  const total = items.length;
  return {
    items,
    completed,
    total,
    percentage: total ? Math.round((completed / total) * 100) : 100,
    allComplete: total > 0 && completed === total,
  };
}

export function safeOnboardingStep(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return 0;
  return Math.max(0, Math.min(20, numeric));
}

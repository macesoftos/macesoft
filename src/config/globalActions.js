const actionDefinitions = {
  appointment: {
    id: "appointment",
    label: "New appointment",
    icon: "appointment",
    modal: "appointment",
    requiredModules: ["appointments"],
    payload: (/** @type {{ appointmentDate?: string }} */ { appointmentDate } = {}) => ({
      status: "Draft",
      ...(appointmentDate ? { date: appointmentDate } : {}),
    }),
  },
  client: {
    id: "client",
    label: "New client",
    icon: "client",
    modal: "client",
    requiredModules: ["clients"],
  },
  lead: {
    id: "lead",
    label: "New lead",
    icon: "lead",
    modal: "lead",
    requiredModules: ["leads"],
  },
  service: {
    id: "service",
    label: "New service",
    icon: "service",
    modal: "service",
    requiredModules: ["services"],
  },
  treatment: {
    id: "treatment",
    label: "New treatment record",
    icon: "treatment",
    modal: "treatment",
    requiredModules: ["treatments"],
  },
  package: {
    id: "package",
    label: "Sell package",
    icon: "package",
    modal: "package",
    requiredModules: ["packages"],
  },
  staff: {
    id: "staff",
    label: "New staff member",
    icon: "staff",
    modal: "staff",
    requiredModules: ["staff"],
  },
  inventory: {
    id: "inventory",
    label: "New inventory item",
    icon: "inventory",
    modal: "inventory",
    requiredModules: ["inventory"],
  },
  expense: {
    id: "expense",
    label: "Record expense",
    icon: "expense",
    modal: "expense",
    requiredModules: ["expenses"],
  },
  campaign: {
    id: "campaign",
    label: "New campaign",
    icon: "campaign",
    modal: "campaign",
    requiredModules: ["sms"],
  },
  emailCampaign: {
    id: "email-campaign",
    label: "New email campaign",
    icon: "email",
    modal: "campaign",
    payload: { channel: "Email" },
    requiredModules: ["sms"],
  },
  branch: {
    id: "branch",
    label: "New branch",
    icon: "branch",
    handler: "branch-create",
    requiredModules: ["branches"],
    requiresOrganizationManagement: true,
  },
  room: {
    id: "room",
    label: "New room",
    icon: "room",
    modal: "room",
    payload: (/** @type {{ roomBranch?: string }} */ { roomBranch } = {}) => (
      roomBranch && roomBranch !== "All branches" ? { branch: roomBranch } : {}
    ),
    requiredModules: ["room-view"],
    requiresOrganizationManagement: true,
  },
};

export const globalActionsByModule = {
  overview: ["appointment", "client"],
  "my-workspace": ["appointment", "client"],
  appointments: ["appointment", "client"],
  clients: ["client"],
  leads: ["lead"],
  pos: ["client"],
  "card-view": ["appointment"],
  "staff-view": ["appointment"],
  "room-view": ["appointment", "room"],
  treatments: ["treatment"],
  services: ["service"],
  packages: ["package"],
  staff: ["staff"],
  branches: ["branch"],
  inventory: ["inventory"],
  expenses: ["expense"],
  sms: ["campaign", "emailCampaign"],
};

export function getGlobalCreateActions({
  moduleId,
  sessionModules = [],
  canManageOrganization = false,
  context = {},
}) {
  const allowedModules = new Set(sessionModules);
  const actionIds = globalActionsByModule[moduleId] ?? [];

  return actionIds
    .map((actionId) => actionDefinitions[actionId])
    .filter(Boolean)
    .filter((action) => action.requiredModules.every((module) => allowedModules.has(module)))
    .filter((action) => !action.requiresOrganizationManagement || canManageOrganization)
    .map((action) => ({
      ...action,
      payload: typeof action.payload === "function" ? action.payload(context) : action.payload,
    }));
}

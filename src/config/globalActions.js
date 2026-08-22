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
  clientImport: {
    id: "client-import",
    label: "Import clients",
    icon: "import",
    handler: "client-import",
    requiredModules: ["clients"],
  },
  clientExport: {
    id: "client-export",
    label: "Export clients",
    icon: "export",
    handler: "client-export",
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
  invite: {
    id: "invite",
    label: "Invite user",
    icon: "email",
    handler: "invite-user",
    requiredModules: ["staff"],
    requiresInvitationPermission: true,
  },
  staffUsersExport: {
    id: "staff-users-export",
    label: "Export users & invitations",
    icon: "export",
    handler: "staff-users-export",
    requiredModules: ["staff"],
  },
  staffProfilesExport: {
    id: "staff-profiles-export",
    label: "Export employee profiles",
    icon: "export",
    handler: "staff-profiles-export",
    requiredModules: ["staff"],
  },
  inventory: {
    id: "inventory",
    label: "New inventory item",
    icon: "inventory",
    modal: "inventory",
    requiredModules: ["inventory"],
  },
  inventoryReceive: {
    id: "inventory-receive",
    label: "Receive stock",
    icon: "inventory-receive",
    modal: "inventory-receive",
    requiredModules: ["inventory"],
  },
  inventoryImport: {
    id: "inventory-import",
    label: "Import CSV",
    icon: "import",
    handler: "inventory-import",
    requiredModules: ["inventory"],
  },
  inventoryExport: {
    id: "inventory-export",
    label: "Export CSV",
    icon: "export",
    handler: "inventory-export",
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
  clients: ["client", "clientImport", "clientExport"],
  leads: ["lead"],
  pos: ["client"],
  "card-view": ["appointment"],
  "staff-view": ["appointment"],
  "room-view": ["appointment", "room"],
  treatments: ["treatment"],
  services: ["service"],
  packages: ["package"],
  staff: ["invite", "staff", "staffUsersExport", "staffProfilesExport"],
  branches: ["invite", "branch"],
  inventory: ["inventory", "inventoryReceive", "inventoryImport", "inventoryExport"],
  expenses: ["expense"],
  sms: ["campaign", "emailCampaign"],
};

export function getGlobalCreateActions({
  moduleId,
  sessionModules = [],
  canManageOrganization = false,
  canInviteUsers = false,
  context = {},
}) {
  const allowedModules = new Set(sessionModules);
  const actionIds = globalActionsByModule[moduleId] ?? [];

  return actionIds
    .map((actionId) => actionDefinitions[actionId])
    .filter(Boolean)
    .filter((action) => action.requiredModules.every((module) => allowedModules.has(module)))
    .filter((action) => !action.requiresOrganizationManagement || canManageOrganization)
    .filter((action) => !action.requiresInvitationPermission || canInviteUsers)
    .map((action) => ({
      ...action,
      payload: typeof action.payload === "function" ? action.payload(context) : action.payload,
    }));
}

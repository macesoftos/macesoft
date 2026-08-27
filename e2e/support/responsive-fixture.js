import { publicSubscriptionPlans } from "../../server/subscriptionPlans.js";

export const responsiveModules = [
  "my-workspace",
  "overview",
  "applications",
  "appointments",
  "clients",
  "leads",
  "pos",
  "card-view",
  "staff-view",
  "room-view",
  "treatments",
  "services",
  "packages",
  "booking",
  "staff",
  "facetrack-attendance",
  "branches",
  "inventory",
  "expenses",
  "payroll",
  "reports",
  "sms",
  "flipbooks",
  "settings",
  "support",
];

export const responsiveBranch = {
  id: "branch-responsive-qa",
  name: "ZenshoTech Responsive QA",
  code: "RESP-QA",
  status: "Active",
  enabledModules: responsiveModules,
  rooms: ["Treatment Room 1", "Treatment Room 2"],
};

export const responsiveAccount = {
  id: "responsive-system-admin",
  name: "Responsive System Admin",
  email: "responsive@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  subscription: {
    status: "active",
    accessAllowed: true,
    planCode: "unlimited",
    planName: "Unlimited",
    billingCycle: "monthly",
    includedWebsitePages: 20,
    usage: { users: 1, branches: 1 },
    plan: {
      code: "unlimited",
      name: "Unlimited",
      monthlyPrice: 6900,
      maxUsers: null,
      maxBranches: null,
      includedWebsitePages: 20,
      billingInterval: "month",
    },
  },
  access: {
    active: true,
    scope: "all",
    organizationWide: true,
    activeBranchId: "all",
    modules: responsiveModules,
    branches: [responsiveBranch],
    permissions: ["staff.invite"],
  },
};

export const responsiveBootstrap = {
  clients: [
    {
      id: "client-responsive-qa",
      fullName: "Responsive QA Client With A Deliberately Long Name",
      email: "responsive.client@example.test",
      mobile: "09170000000",
      branch: responsiveBranch.name,
      status: "Active",
    },
  ],
  appointments: [
    {
      id: "appointment-responsive-qa",
      clientId: "client-responsive-qa",
      client: "Responsive QA Client With A Deliberately Long Name",
      serviceId: "service-responsive-qa",
      service: "Comprehensive Responsive Treatment",
      staffId: "staff-responsive-qa",
      provider: "Responsive QA Provider",
      branch: responsiveBranch.name,
      room: "Treatment Room 1",
      date: "2026-08-26",
      time: "10:00",
      duration: 60,
      status: "Confirmed",
    },
  ],
  services: [
    {
      id: "service-responsive-qa",
      name: "Comprehensive Responsive Treatment",
      category: "Aesthetic Treatments",
      price: 5900,
      duration: 60,
      branches: [responsiveBranch.name],
      active: true,
      consumables: [{ item: "Responsive QA Gauze", qty: 1 }],
    },
  ],
  inventory: [
    { id: "inventory-responsive-qa", item: "Responsive QA Gauze", sku: "RESP-001", type: "Consumable", unit: "piece", stock: 100, reorderLevel: 20, branch: responsiveBranch.name },
  ],
  transactions: [
    { id: "transaction-responsive-qa", invoice: "RESP-0001", client: "Responsive QA Client", branch: responsiveBranch.name, total: 5900, status: "Paid", paymentMethod: "Card", date: "2026-08-26", items: [{ type: "Service", name: "Comprehensive Responsive Treatment", qty: 1, price: 5900 }] },
  ],
  treatments: [
    { id: "treatment-responsive-qa", clientId: "client-responsive-qa", client: "Responsive QA Client", service: "Comprehensive Responsive Treatment", provider: "Responsive QA Provider", branch: responsiveBranch.name, date: "2026-08-26", status: "Completed", notes: "Responsive QA record" },
  ],
  packages: [
    { id: "package-responsive-qa", name: "Responsive Wellness Package", clientId: "client-responsive-qa", client: "Responsive QA Client", branch: responsiveBranch.name, totalSessions: 8, usedSessions: 2, price: 24000, status: "Active" },
  ],
  giftCertificates: [],
  leads: [
    { id: "lead-responsive-qa", name: "Responsive Prospect With A Long Name", email: "prospect@example.test", mobile: "09171111111", interest: "Comprehensive Responsive Treatment", source: "Website", status: "New", branch: responsiveBranch.name },
  ],
  expenses: [
    { id: "expense-responsive-qa", description: "Responsive QA clinic supplies", category: "Supplies", amount: 1200, branch: responsiveBranch.name, date: "2026-08-26", status: "Approved" },
  ],
  discounts: [],
  promotions: [],
  consentTemplates: [],
  consentSubmissions: [],
  smsTemplates: [],
  campaigns: [],
  auditLogs: [],
  inventoryMovements: [],
  staff: [
    { id: "staff-responsive-qa", name: "Responsive QA Provider", email: "provider@example.test", role: "Aesthetician", branch: responsiveBranch.name, status: "Available" },
  ],
  leadIntegrations: [],
  webhookEvents: [],
  branches: [responsiveBranch],
  settings: {},
};

export const responsiveFlipbook = {
  id: "flipbook-responsive-qa",
  title: "Responsive QA Flipbook",
  description: "A safe document used only for responsive verification.",
  pageCount: 1,
  status: "Draft",
  branch: responsiveBranch.name,
  publicEnabled: false,
  passwordProtected: false,
  allowDownload: false,
  expiresAt: null,
  publishedAt: null,
  deletedAt: null,
  publicLink: "",
  sourceUrl: "/api/flipbooks/flipbook-responsive-qa/file",
  byteSize: 1024,
  createdBy: responsiveAccount.name,
  views: 0,
  uniqueViewers: 0,
  lastViewed: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
};

export const completedOnboarding = {
  state: {
    tourVersion: 1,
    currentStep: 7,
    startedAt: "2026-08-26T00:00:00.000Z",
    completedAt: "2026-08-26T00:05:00.000Z",
    dismissedAt: null,
    checklistMinimized: false,
    checklistHiddenAt: null,
    lastChecklistInteraction: null,
  },
  roleKind: "owner",
  modules: responsiveModules,
  checklist: {
    completed: 4,
    total: 12,
    percentage: 33,
    allComplete: false,
    items: [
      ["business-profile", "Complete business profile", "Add the business and contact details used in bookings, invoices, and messages.", "settings", true],
      ["first-branch", "Add your first branch", "Confirm branch details and operating status.", "branches", true],
      ["services", "Add services or treatments", "Create services clients can book.", "services", true],
      ["rooms", "Configure rooms and resources", "Add rooms required for scheduling.", "room-view", true],
      ["schedules", "Set business hours and staff schedules", "Define branch and staff availability.", "staff-view", false],
      ["team", "Invite your team", "Invite a teammate with branch access.", "staff", false],
      ["client", "Add your first client", "Create a connected client profile.", "clients", false],
      ["appointment", "Create your first appointment", "Book a client, service, room, and staff member.", "appointments", false],
      ["inventory", "Add products or inventory", "Configure stock for a product or consumable.", "inventory", false],
      ["pos-settings", "Configure POS and payment settings", "Review payment and receipt settings.", "settings", false],
      ["test-campaign", "Send a test email campaign", "Validate a campaign with a safe test recipient.", "sms", false],
      ["permissions", "Review roles and permissions", "Confirm appropriate module access.", "staff", false],
    ].map(([id, title, description, moduleId, complete]) => ({ id, title, description, moduleId, complete, status: complete ? "Complete" : "Not started" })),
  },
};

export async function mockResponsiveApi(page, { account = responsiveAccount, onboarding = completedOnboarding } = {}) {
  let onboardingPayload = structuredClone(onboarding);
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let payload = {};

    if (pathname === "/api/auth/session") payload = { account };
    else if (pathname === "/api/auth/google/config" || pathname === "/api/public/auth-config") payload = { enabled: false };
    else if (pathname === "/api/accounts") payload = { accounts: account ? [account] : [] };
    else if (pathname === "/api/invitations") payload = {
      invitations: [],
      capabilities: {
        roles: ["Super Admin", "Admin", "Branch Manager", "Doctor", "Aesthetician", "Employee"],
        roleModules: { "Super Admin": responsiveModules, Admin: responsiveModules, "Branch Manager": responsiveModules, Doctor: ["overview", "appointments", "clients", "treatments"], Aesthetician: ["overview", "appointments", "clients", "treatments"], Employee: ["my-workspace", "facetrack-attendance"] },
        permissions: [],
        branches: [{ ...responsiveBranch, branchStatus: "Active" }],
        organizationManager: true,
        canSelectBranches: true,
        invitationExpiryDays: 7,
      },
    };
    else if (pathname === "/api/notifications") payload = { notifications: [], readAt: null, unreadCount: 0 };
    else if (pathname === "/api/onboarding") {
      if (request.method() === "PATCH") {
        const update = request.postDataJSON();
        const now = "2026-08-26T01:00:00.000Z";
        if (["start", "restart"].includes(update.action)) onboardingPayload.state = { ...onboardingPayload.state, currentStep: 0, startedAt: now, completedAt: null, dismissedAt: null };
        else if (update.action === "progress") onboardingPayload.state.currentStep = Number(update.currentStep || 0);
        else if (update.action === "dismiss") onboardingPayload.state = { ...onboardingPayload.state, currentStep: Number(update.currentStep || 0), dismissedAt: now };
        else if (update.action === "complete") onboardingPayload.state = { ...onboardingPayload.state, currentStep: Number(update.currentStep || 0), completedAt: now, dismissedAt: null };
        else if (update.action === "minimize-checklist") onboardingPayload.state.checklistMinimized = true;
        else if (update.action === "open-checklist") onboardingPayload.state = { ...onboardingPayload.state, checklistMinimized: false, checklistHiddenAt: null };
        else if (update.action === "hide-checklist") onboardingPayload.state.checklistHiddenAt = now;
      }
      payload = onboardingPayload;
    }
    else if (pathname === "/api/subscription") payload = { subscription: account?.subscription };
    else if (pathname === "/api/invitations/accept/responsive-token") payload = {
      invitation: {
        id: "invitation-responsive-qa",
        firstName: "Responsive",
        name: "Responsive Invitee",
        email: "responsive.invitee@example.test",
        role: "Aesthetician",
        status: "Pending",
        accountExists: false,
        expiresAt: "2026-09-02T00:00:00.000Z",
        organization: { name: "ZenshoTech Responsive QA" },
        branches: [{ name: responsiveBranch.name }],
      },
    };
    else if (pathname === "/api/bootstrap") payload = responsiveBootstrap;
    else if (pathname === "/api/payroll/overview") payload = {
      staff: responsiveBootstrap.staff,
      branches: responsiveBootstrap.branches,
      services: responsiveBootstrap.services,
      runs: [],
      profiles: [],
      schedules: [],
      rules: [],
      pending: { runs: 0, profiles: 1, schedules: 0 },
    };
    else if (pathname === "/api/facetrack-attendance/overview") payload = {
      admin: true,
      staff: responsiveBootstrap.staff,
      profiles: [],
      records: [],
      requests: [],
      auditEntries: [],
      stats: { clockedIn: 0, pendingCorrections: 0, pendingOvertime: 0 },
      policy: { enabled: true, timezone: "Asia/Manila", graceMinutes: 10, matchThreshold: 0.5, overtimeMinimumMinutes: 30, retentionDays: 365, overtimeRequiresApproval: true },
    };
    else if (pathname === "/api/facetrack-attendance/kiosk/status") payload = { device: { id: "kiosk-responsive-qa", name: "Responsive QA Kiosk", branch: responsiveBranch.name }, enrolledEmployees: 1 };
    else if (pathname === "/api/flipbooks") payload = { flipbooks: [responsiveFlipbook] };
    else if (pathname === "/api/flipbooks/flipbook-responsive-qa") payload = { flipbook: responsiveFlipbook };
    else if (pathname === "/api/public/flipbooks/responsive-token") payload = {
      locked: false,
      flipbook: { ...responsiveFlipbook, status: "Published", publicEnabled: true, sourceUrl: "/api/public/flipbooks/responsive-token/file" },
      branding: { businessName: "ZenshoTech Responsive QA", viewerBackground: "#f4f1ed", logo: "" },
      accessToken: "responsive-access-token",
    };
    else if (pathname === "/api/marketing/media") payload = { assets: [] };
    else if (pathname === "/api/public/plans" || pathname === "/api/subscription/plans") payload = { plans: publicSubscriptionPlans(), websitePackage: null };
    else if (pathname === "/api/public-leads/config") payload = { company: "ZenshoTech", tagline: "The brand behind beautiful faces.", branches: [responsiveBranch], services: responsiveBootstrap.services };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  return {
    markChecklistComplete(id) {
      const item = onboardingPayload.checklist.items.find((entry) => entry.id === id);
      if (!item || item.complete) return;
      item.complete = true;
      item.status = "Complete";
      onboardingPayload.checklist.completed = onboardingPayload.checklist.items.filter((entry) => entry.complete).length;
      onboardingPayload.checklist.total = onboardingPayload.checklist.items.length;
      onboardingPayload.checklist.percentage = Math.round((onboardingPayload.checklist.completed / onboardingPayload.checklist.total) * 100);
      onboardingPayload.checklist.allComplete = onboardingPayload.checklist.completed === onboardingPayload.checklist.total;
    },
    snapshot() {
      return structuredClone(onboardingPayload);
    },
  };
}

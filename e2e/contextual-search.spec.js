import { expect, test } from "playwright/test";

const session = {
  id: "search-admin",
  name: "MACE Admin",
  email: "search-admin@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  subscription: { status: "active", accessAllowed: true, planCode: "unlimited", billingCycle: "monthly" },
  access: { active: true, scope: "all", organizationWide: true, activeBranchId: "all", modules: ["overview", "appointments", "clients", "services", "branches"] },
};

const activeBranch = {
  id: "branch-bajada",
  name: "Mace Bajada",
  code: "MACE-BJD",
  city: "Davao City",
  address: "Bajada, Davao City",
  status: "Active",
  enabledModules: ["appointments", "clients", "services"],
  rooms: [{ id: "room-1", name: "Treatment Room 1" }],
};

const archivedBranch = {
  id: "branch-bgc",
  name: "Mace BGC",
  code: "BGC",
  city: "Bonifacio Global City",
  address: "Bonifacio Global City",
  status: "Archived",
  enabledModules: ["appointments", "clients", "services"],
  rooms: [],
};

const client = {
  id: "client-celine",
  fullName: "Celine An Hernandez",
  mobile: "09524412269",
  email: "celine@example.test",
  branch: activeBranch.name,
  branchesVisited: [activeBranch.name],
  retention: "Returning",
};

const appointment = {
  id: "appointment-celine",
  clientId: client.id,
  client: client.fullName,
  serviceId: "service-facial",
  service: "AquaPure Facial",
  staff: "Britney Wingene Sagra",
  room: "Treatment Room 1",
  branch: activeBranch.name,
  date: "2026-08-22",
  time: "10:00",
  duration: 60,
  status: "Confirmed",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let payload = {};
    if (pathname === "/api/auth/session") payload = { account: session };
    if (pathname === "/api/accounts") payload = { accounts: [session] };
    if (pathname === "/api/notifications") payload = { notifications: [], readAt: null, unreadCount: 0 };
    if (pathname === "/api/bootstrap") payload = {
      clients: [client], appointments: [appointment], services: [{ id: "service-facial", name: appointment.service, price: 3500, duration: 60, branches: [activeBranch.name], active: true }],
      inventory: [], transactions: [], treatments: [], packages: [], giftCertificates: [], leads: [], expenses: [], discounts: [], promotions: [],
      consentTemplates: [], consentSubmissions: [], smsTemplates: [], campaigns: [], auditLogs: [], inventoryMovements: [], staff: [{ id: "staff-britney", name: appointment.staff, role: "Aesthetician", branch: activeBranch.name, status: "Active" }],
      leadIntegrations: [], webhookEvents: [], branches: [activeBranch, archivedBranch],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
});

test("uses one appointment search and a compact responsive filter toolbar", async ({ page }) => {
  await page.goto("/appointments");

  await expect(page.getByText("Filter schedule", { exact: true })).toHaveCount(0);
  const search = page.getByRole("combobox", { name: "Search appointments" });
  await expect(search).toHaveCount(1);
  await search.fill("Celine");
  await expect(page.getByRole("option", { name: /Celine An Hernandez/ })).toBeVisible();

  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/appointments\/appointment-celine$/);

  await page.goto("/appointments");
  await page.setViewportSize({ width: 390, height: 844 });
  const filters = page.getByRole("button", { name: /Filters/ });
  await expect(filters).toBeVisible();
  await filters.click();
  await expect(page.getByLabel("Filter by appointment status")).toBeVisible();
  await expect(page.getByLabel("Filter by doctor or staff")).toBeVisible();
});

test("hides archived branches by default and keeps them available through status", async ({ page }) => {
  await page.goto("/branches");

  await expect(page.getByText(activeBranch.name, { exact: true })).toBeVisible();
  await expect(page.getByText(archivedBranch.name, { exact: true })).toHaveCount(0);
  await page.getByLabel("Filter branch status").selectOption("Archived");
  await expect(page.getByText(archivedBranch.name, { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search branches" })).toHaveCount(1);
});

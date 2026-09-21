import { expect, test } from "playwright/test";

const session = {
  id: "notification-admin",
  name: "MACE Admin",
  email: "notification-admin@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  access: { active: true, scope: "all", organizationWide: true, activeBranchId: "all", modules: ["overview", "clients"] },
};

const branch = { id: "branch-bajada", name: "Mace Bajada", status: "Active", rooms: [] };
const otherClient = { id: "client-other", fullName: "Other Client", branch: branch.name, retention: "New" };
const registeredClient = { id: "client-james", fullName: "James Pandian", branch: branch.name, retention: "New" };

test("a QR registration notification opens the matching client in the directory", async ({ page }) => {
  let clientRefreshes = 0;
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let payload = {};
    if (pathname === "/api/auth/session") payload = { account: session };
    if (pathname === "/api/accounts") payload = { accounts: [session] };
    if (pathname === "/api/notifications") payload = {
      notifications: [{
        id: "notification-james",
        title: "New QR client registration",
        message: "James Pandian submitted a new registration.",
        module: "clients",
        recordId: registeredClient.id,
        createdAt: "2026-09-21T09:57:00.000Z",
        unread: true,
      }],
      readAt: null,
      unreadCount: 1,
    };
    if (pathname === "/api/bootstrap") payload = {
      clients: [otherClient], appointments: [], services: [], inventory: [], transactions: [], treatments: [], packages: [],
      giftCertificates: [], leads: [], expenses: [], discounts: [], promotions: [], consentTemplates: [], consentSubmissions: [],
      smsTemplates: [], campaigns: [], auditLogs: [], inventoryMovements: [], staff: [], leadIntegrations: [], webhookEvents: [], branches: [branch],
    };
    if (pathname === "/api/resources/clients") {
      clientRefreshes += 1;
      payload = [otherClient, registeredClient];
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/overview");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await page.getByRole("button", { name: /New QR client registration/ }).click();

  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole("heading", { name: "Client directory" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search clients" })).toHaveValue(registeredClient.id);
  await expect(page.getByRole("row", { name: /James Pandian/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Other Client/ })).toHaveCount(0);
  await expect(page.getByText("Showing 1 to 1 of 1 clients")).toBeVisible();
  expect(clientRefreshes).toBe(1);
});

import { expect, test } from "playwright/test";

const session = {
  id: "branch-manager",
  name: "MACE Admin",
  email: "branch-manager@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  access: { active: true, modules: ["overview", "branches", "settings"] },
};

const branch = {
  id: "branch-davao",
  name: "Mace Tulip Drive Matina",
  city: "Davao",
  address: "Unit 4 Lenma Bldg Tulip Drive Matina, Davao City",
  phone: "",
  hours: "9:00 AM - 7:00 PM",
  devices: ["Mace Thermatight"],
  image: "",
  rooms: [{ id: "room-1", name: "Room 1" }],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let payload = {};

    if (pathname === "/api/auth/session") payload = { account: session };
    if (pathname === "/api/health") payload = { ok: true };
    if (pathname === "/api/accounts") payload = { accounts: [session] };
    if (pathname === "/api/notifications") payload = { notifications: [], readAt: null, unreadCount: 0 };
    if (pathname === "/api/bootstrap") {
      payload = {
        clients: [], appointments: [], services: [], inventory: [], transactions: [], treatments: [],
        packages: [], giftCertificates: [], leads: [], staff: [], expenses: [], discounts: [],
        smsTemplates: [], campaigns: [], auditLogs: [], inventoryMovements: [], branches: [branch],
        leadIntegrations: [], webhookEvents: [],
      };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
});

test("an organization manager can open the add branch form from the Branches page", async ({ page }) => {
  await page.goto("/#/branches");

  const addBranch = page.getByRole("button", { name: "Add branch", exact: true });
  await expect(addBranch).toBeVisible();
  await addBranch.click();

  const dialog = page.getByRole("dialog", { name: "Add a clinic branch" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Branch name")).toBeVisible();
  await expect(dialog.getByLabel("City")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create branch" })).toBeVisible();
});

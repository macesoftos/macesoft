import { expect, test } from "playwright/test";

const branch = {
  id: "branch-form-qa",
  name: "ZenshoTech Form QA",
  code: "FORM-QA",
  status: "Active",
  enabledModules: ["appointments", "clients", "treatments", "services", "inventory", "staff"],
  rooms: ["Treatment Room 1"],
};

const account = {
  id: "form-system-admin",
  name: "Form System Admin",
  email: "form-system@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  subscription: { status: "active", accessAllowed: true, planCode: "unlimited", billingCycle: "monthly" },
  access: {
    active: true,
    scope: "all",
    organizationWide: true,
    activeBranchId: "all",
    modules: ["overview", "appointments", "clients", "treatments", "services", "inventory", "staff"],
  },
};

const bootstrap = {
  clients: [{ id: "client-form-qa", fullName: "Form QA Client", branch: branch.name, mobile: "09170000000" }],
  appointments: [],
  services: [{ id: "service-form-qa", name: "Form QA Treatment", price: 3500, duration: 60, branches: [branch.name], active: true }],
  inventory: [],
  transactions: [],
  treatments: [],
  packages: [],
  giftCertificates: [],
  leads: [],
  expenses: [],
  discounts: [],
  promotions: [],
  consentTemplates: [],
  consentSubmissions: [],
  smsTemplates: [],
  campaigns: [],
  auditLogs: [],
  inventoryMovements: [],
  staff: [{ id: "staff-form-qa", name: "Form QA Provider", role: "Aesthetician", branch: branch.name, status: "Available" }],
  leadIntegrations: [],
  webhookEvents: [],
  branches: [branch],
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error("Form-system page error:", error.stack || error.message));
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let payload = {};
    if (pathname === "/api/auth/session") payload = { account };
    if (pathname === "/api/accounts") payload = { accounts: [account] };
    if (pathname === "/api/notifications") payload = { notifications: [], readAt: null, unreadCount: 0 };
    if (pathname === "/api/bootstrap") payload = bootstrap;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
});

test("long treatment forms use compact controls, logical sections, and a scrolling body", async ({ page }) => {
  await page.goto("/treatments");
  await page.getByRole("button", { name: "Add treatment" }).click();

  const dialog = page.getByRole("dialog", { name: "New Treatment Record" });
  const modal = dialog.locator(".entity-modal");
  await expect(dialog).toBeVisible();
  for (const heading of ["Record Details", "Treatment Timing", "Consumables", "Device Information", "Consent and Follow-up", "Clinical Notes"]) {
    await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  const controlStyle = await dialog.locator("select").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height, radius: style.borderRadius, border: style.borderTopWidth };
  });
  expect(controlStyle.height).toBeGreaterThanOrEqual(42);
  expect(controlStyle.height).toBeLessThanOrEqual(48);
  expect(parseFloat(controlStyle.radius)).toBeLessThanOrEqual(8);
  expect(controlStyle.border).toBe("1px");

  const fieldWrapperBorder = await dialog.locator(".form-grid > label").first().evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(fieldWrapperBorder).toBe("0px");
  const scrollState = await dialog.locator(".form-modal-body").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY }));
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  expect(scrollState.overflowY).toBe("auto");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save treatment" })).toBeVisible();
  await dialog.getByRole("button", { name: "Save treatment" }).click();
  const invalidControls = dialog.locator("input:invalid, select:invalid, textarea:invalid");
  expect(await invalidControls.count()).toBeGreaterThan(0);
  await expect(invalidControls.first()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMetrics = await modal.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, columns: getComputedStyle(element.querySelector(".form-grid")).gridTemplateColumns };
  });
  expect(mobileMetrics.width).toBeLessThanOrEqual(390);
  expect(mobileMetrics.height).toBeLessThanOrEqual(844);
  expect(mobileMetrics.columns.trim().split(/\s+/)).toHaveLength(1);
  await expect(dialog.getByRole("button", { name: "Save treatment" })).toBeVisible();
});

test("appointment drawer keeps compact fields and fixed actions", async ({ page }) => {
  await page.goto("/appointments");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "New appointment" }).click();

  const dialog = page.getByRole("dialog", { name: "New appointment" });
  await expect(dialog).toBeVisible();
  const controlHeights = await dialog.locator("input, select").evaluateAll((elements) => elements.filter((element) => getComputedStyle(element).display !== "none").map((element) => element.getBoundingClientRect().height));
  expect(controlHeights.every((height) => height >= 42 && height <= 48)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm booking" })).toBeVisible();
  await expect(dialog.locator(".booking-step").first()).toBeHidden();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

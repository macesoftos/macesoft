import { expect, test } from "playwright/test";

const branch = {
  id: "branch-form-qa",
  name: "ZenshoTech Form QA",
  code: "FORM-QA",
  status: "Active",
  enabledModules: ["appointments", "clients", "treatments", "services", "packages", "inventory", "expenses", "sms", "staff"],
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
    modules: ["overview", "appointments", "clients", "treatments", "services", "packages", "inventory", "expenses", "sms", "staff"],
  },
};

const bootstrap = {
  clients: [{ id: "client-form-qa", fullName: "Form QA Client", branch: branch.name, mobile: "09170000000" }],
  appointments: [],
  services: [{ id: "service-form-qa", name: "Form QA Treatment", price: 3500, duration: 60, branches: [branch.name], active: true, consumables: [{ item: "Form QA Gauze", qty: 1 }] }],
  inventory: [
    { id: "inventory-form-gauze", item: "Form QA Gauze", type: "Consumable", unit: "piece", stock: 100, branch: branch.name },
    { id: "inventory-form-gloves", item: "Form QA Gloves", type: "Consumable", unit: "pair", stock: 100, branch: branch.name },
  ],
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
  const labelStyle = await dialog.locator(".form-label").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { textTransform: style.textTransform, fontWeight: Number(style.fontWeight) };
  });
  expect(labelStyle.textTransform).toBe("none");
  expect(labelStyle.fontWeight).toBeGreaterThanOrEqual(600);
  const scrollState = await dialog.locator(".form-modal-body").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY }));
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  expect(scrollState.overflowY).toBe("auto");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save treatment" })).toBeVisible();
  await expect(dialog.getByLabel("Consumable item 1")).toHaveValue("Form QA Gauze");
  await dialog.getByRole("button", { name: "Add consumable" }).click();
  await expect(dialog.getByLabel("Consumable item 2")).toHaveValue("Form QA Gloves");
  await dialog.getByRole("button", { name: "Remove Form QA Gloves" }).click();
  await expect(dialog.getByLabel("Consumable item 2")).toHaveCount(0);
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

test("public registration uses the shared compact control range", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ account: null }) }));
  await page.route("**/api/auth/google/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false }) }));
  await page.goto("/register");

  const form = page.locator(".registration-form");
  await expect(form).toBeVisible();
  const controlHeights = await form.locator("input:not([type=checkbox])").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(controlHeights.length).toBeGreaterThan(0);
  expect(controlHeights.every((height) => height >= 42 && height <= 48)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileColumns = await form.locator(".registration-fields").evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
  expect(mobileColumns).toBe(1);
});

test("operational create forms expose concise logical sections", async ({ page }) => {
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "Record expense" }).click();

  const expenseDialog = page.getByRole("dialog", { name: "Record Expense" });
  await expect(expenseDialog.getByRole("heading", { name: "Expense details" })).toBeVisible();
  await expect(expenseDialog.getByRole("heading", { name: "Approval and documentation" })).toBeVisible();
  await expenseDialog.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/packages");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "Sell package" }).click();

  const packageDialog = page.getByRole("dialog", { name: "Sell Package" });
  await expect(packageDialog.getByRole("heading", { name: "Package and client" })).toBeVisible();
  await expect(packageDialog.getByRole("heading", { name: "Purchase and billing" })).toBeVisible();
  await packageDialog.getByRole("button", { name: "Cancel" }).click();
});

test("representative forms fit mobile, tablet, laptop, and desktop viewports", async ({ page }) => {
  await page.goto("/treatments");
  await page.getByRole("button", { name: "Add treatment" }).click();
  const dialog = page.getByRole("dialog", { name: "New Treatment Record" });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await dialog.locator(".entity-modal").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const body = element.querySelector(".form-modal-body");
      return {
        width: rect.width,
        height: rect.height,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: getComputedStyle(body).overflowY,
      };
    });
    expect(metrics.width).toBeLessThanOrEqual(viewport.width);
    expect(metrics.height).toBeLessThanOrEqual(viewport.height);
    expect(metrics.documentOverflow).toBeLessThanOrEqual(0);
    expect(metrics.bodyOverflow).toBe("auto");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save treatment" })).toBeVisible();
  }
});

test("client image upload control remains functional and accessible", async ({ page }) => {
  await page.route("**/api/uploads", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ asset: { id: "asset-form-qa", url: "/brand/zenshotech-logo.svg" } }),
  }));
  await page.goto("/clients");
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menuitem", { name: "New client" }).click();

  const dialog = page.getByRole("dialog", { name: "Add Client" });
  const upload = dialog.locator('input[type="file"][accept="image/*"]');
  await expect(upload).toHaveCount(1);
  await upload.setInputFiles({
    name: "client.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4p8AAAAASUVORK5CYII=", "base64"),
  });
  await expect(dialog.locator(".photo-field img")).toHaveAttribute("src", "/brand/zenshotech-logo.svg");
  await dialog.getByRole("button", { name: "Remove profile photo" }).click();
  await expect(dialog.locator(".photo-field img")).toHaveCount(0);
});

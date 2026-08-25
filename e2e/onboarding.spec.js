import { expect, test } from "playwright/test";
import {
  completedOnboarding,
  mockResponsiveApi,
  responsiveAccount,
  responsiveModules,
} from "./support/responsive-fixture.js";

function newOnboarding(overrides = {}) {
  const payload = structuredClone(completedOnboarding);
  payload.state = {
    ...payload.state,
    currentStep: 0,
    startedAt: null,
    completedAt: null,
    dismissedAt: null,
    checklistMinimized: false,
    checklistHiddenAt: null,
  };
  const next = { ...payload, ...overrides, state: { ...payload.state, ...(overrides.state || {}) } };
  if (overrides.modules) {
    const allowed = new Set(overrides.modules);
    next.checklist.items = next.checklist.items.filter((item) => allowed.has(item.moduleId));
    next.checklist.completed = next.checklist.items.filter((item) => item.complete).length;
    next.checklist.total = next.checklist.items.length;
    next.checklist.percentage = next.checklist.total ? Math.round((next.checklist.completed / next.checklist.total) * 100) : 100;
    next.checklist.allComplete = next.checklist.total > 0 && next.checklist.completed === next.checklist.total;
  }
  return next;
}

async function startTour(page) {
  const welcome = page.getByTestId("onboarding-welcome");
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Start quick tour" }).click();
  await expect(page.getByTestId("onboarding-tour")).toBeVisible();
}

test("a new owner can start, navigate, skip, and manually restart the guided tour", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockResponsiveApi(page, { onboarding: newOnboarding() });
  await page.goto("/dashboard");
  await startTour(page);

  const tour = page.getByTestId("onboarding-tour");
  await expect(tour.getByRole("heading", { name: "Your business at a glance" })).toBeVisible();
  await expect(tour.getByText("Step 1 of 8")).toBeVisible();
  await expect(page.locator(".onboarding-spotlight")).toBeVisible();

  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Access your business tools" })).toBeVisible();
  await tour.getByRole("button", { name: "Previous" }).click();
  await expect(tour.getByRole("heading", { name: "Your business at a glance" })).toBeVisible();
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("onboarding-welcome")).toBeHidden();
  await expect(page.getByTestId("onboarding-tour")).toBeHidden();
  const checklist = page.getByRole("region", { name: "Getting Started checklist" });
  await expect(checklist).toBeVisible();
  await checklist.getByRole("button", { name: /Restart dashboard tour/i }).click();
  await expect(page.getByTestId("onboarding-tour")).toBeVisible();
});

test("tour progress resumes after refresh and completed users are not interrupted again", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const api = await mockResponsiveApi(page, { onboarding: newOnboarding() });
  await page.goto("/dashboard");
  await startTour(page);
  const tour = page.getByTestId("onboarding-tour");
  await tour.getByRole("button", { name: "Next" }).click();
  await tour.getByRole("button", { name: "Next" }).click();
  expect(api.snapshot().state.currentStep).toBe(2);

  await page.reload();
  await expect(tour.getByRole("heading", { name: "Start common tasks quickly" })).toBeVisible();

  for (let index = 2; index < 7; index += 1) {
    await tour.getByRole("button", { name: "Next" }).click();
  }
  await expect(tour.getByRole("heading", { name: "You’re ready to begin" })).toBeVisible();
  await tour.getByRole("button", { name: "Finish tour" }).click();
  await expect(tour).toBeHidden();
  expect(api.snapshot().state.completedAt).toBeTruthy();

  await page.reload();
  await expect(page.getByTestId("onboarding-welcome")).toBeHidden();
  await expect(page.getByTestId("onboarding-tour")).toBeHidden();
});

test("role tours contain only modules granted by the server", async ({ page }) => {
  const cases = [
    {
      role: "Branch Manager",
      roleKind: "manager",
      modules: ["overview", "appointments", "clients", "staff-view", "inventory", "reports"],
      expected: ["Manage your schedule", "Build your client database", "Review your team schedule", "Monitor inventory", "Understand performance"],
      forbidden: ["Record sales and payments", "Attendance and FaceTrack"],
    },
    {
      role: "Aesthetician",
      roleKind: "staff",
      modules: ["overview", "staff-view", "appointments", "clients", "facetrack-attendance"],
      expected: ["Review your team schedule", "Manage your schedule", "Build your client database", "Attendance and FaceTrack"],
      forbidden: ["Monitor inventory", "Manage your team"],
    },
    {
      role: "Cashier",
      roleKind: "staff",
      modules: ["pos"],
      expected: ["Record sales and payments"],
      forbidden: ["Manage your schedule", "Build your client database", "Monitor inventory"],
    },
  ];

  for (const roleCase of cases) {
    await page.unrouteAll({ behavior: "wait" });
    const account = { ...responsiveAccount, id: `account-${roleCase.role}`, role: roleCase.role, access: { ...responsiveAccount.access, modules: roleCase.modules } };
    const onboarding = newOnboarding({ roleKind: roleCase.roleKind, modules: roleCase.modules });
    await mockResponsiveApi(page, { account, onboarding });
    await page.goto("/dashboard");
    await startTour(page);
    const seen = [];
    const tour = page.getByTestId("onboarding-tour");
    for (let index = 0; index < 10; index += 1) {
      const title = await tour.locator("#onboarding-tour-title").textContent();
      seen.push(title);
      if (title === "You’re ready to begin") break;
      await tour.getByRole("button", { name: "Next" }).click();
      await expect.poll(async () => tour.locator("#onboarding-tour-title").textContent()).not.toBe(title);
    }
    for (const title of roleCase.expected) expect(seen).toContain(title);
    for (const title of roleCase.forbidden) expect(seen).not.toContain(title);
  }
});

for (const width of [320, 360, 375, 390, 412, 430]) {
  test(`mobile tour is a safe-area-aware bottom sheet at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await mockResponsiveApi(page, { onboarding: newOnboarding() });
    await page.goto("/dashboard");
    await startTour(page);
    const tooltip = page.locator(".onboarding-tooltip");
    const bounds = await tooltip.boundingBox();
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual((width === 320 ? 568 : 844) + 1);
    for (const button of await tooltip.getByRole("button").all()) {
      const buttonBounds = await button.boundingBox();
      expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
      expect(buttonBounds.y).toBeGreaterThanOrEqual(-1);
      expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual((width === 320 ? 568 : 844) + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test("keyboard focus, Escape, checklist refresh, and account Help controls remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await mockResponsiveApi(page, { onboarding: newOnboarding({ state: { dismissedAt: "2026-08-26T00:00:00.000Z" } }) });
  await page.goto("/dashboard");

  const checklist = page.getByRole("region", { name: "Getting Started checklist" });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByRole("button", { name: /Add your first client/i })).toContainText("Not started");
  await checklist.getByRole("button", { name: /View all 12 steps/i }).click();
  api.markChecklistComplete("client");
  const refreshResponse = page.waitForResponse((response) => response.url().endsWith("/api/onboarding") && response.request().method() === "GET");
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("macesoft:workspace-mutated")));
  await refreshResponse;
  await expect(checklist.getByRole("button", { name: /Add your first client/i })).toContainText("Complete");

  await checklist.getByRole("button", { name: /Restart dashboard tour/i }).click();
  const tooltip = page.locator(".onboarding-tooltip");
  await expect(tooltip).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tooltip.getByRole("button", { name: "Close and pause tour" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("onboarding-tour")).toBeHidden();

  await page.locator(".account-menu > summary").click();
  await expect(page.getByRole("menuitem", { name: /Getting Started/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Restart dashboard tour/i })).toBeVisible();
});

test("a missing tour target is skipped without crashing", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const modules = ["overview", "appointments"];
  await mockResponsiveApi(page, {
    account: { ...responsiveAccount, access: { ...responsiveAccount.access, modules } },
    onboarding: newOnboarding({ roleKind: "manager", modules }),
  });
  await page.goto("/dashboard");
  await page.addStyleTag({ content: '[data-tour="nav-appointments"] { display: none !important; }' });
  await startTour(page);
  const tour = page.getByTestId("onboarding-tour");
  await tour.getByRole("button", { name: "Next" }).click();
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "You’re ready to begin" })).toBeVisible({ timeout: 6_000 });
  await expect(page.locator("body")).toBeVisible();
});

test("sidebar collapse, modal layering, browser history, and sign out remain usable", async ({ page }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  const api = await mockResponsiveApi(page, { onboarding: newOnboarding() });
  await page.goto("/dashboard");
  await startTour(page);
  const tour = page.getByTestId("onboarding-tour");

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Access your business tools" })).toBeVisible();
  await expect(page.locator(".onboarding-spotlight")).toBeVisible();

  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Start common tasks quickly" })).toBeVisible();
  await page.locator(".clinic-dashboard-quick-actions").getByRole("button", { name: "New client" }).evaluate((button) => button.click());
  await expect(page.getByTestId("onboarding-tour")).toBeHidden();
  await expect(page.getByRole("dialog", { name: /Add client/i })).toBeVisible();
  await page.getByRole("button", { name: "Close form" }).click();
  await expect(page.getByTestId("onboarding-tour")).toBeVisible();

  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Manage your schedule" })).toBeVisible();
  await tour.getByRole("button", { name: "Take me there" }).click();
  await expect(page).toHaveURL(/\/appointments$/);
  expect(api.snapshot().state.currentStep).toBe(3);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(tour.getByRole("heading", { name: "Manage your schedule" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/appointments$/);

  await page.locator(".account-menu > summary").click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("desktop and mobile onboarding screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockResponsiveApi(page, { onboarding: newOnboarding() });
  await page.goto("/dashboard");
  await startTour(page);
  await page.screenshot({ path: "docs/onboarding-qa/desktop-tour-1440x900.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("onboarding-tour")).toBeVisible();
  await page.screenshot({ path: "docs/onboarding-qa/mobile-tour-390x844.png", fullPage: false });
});

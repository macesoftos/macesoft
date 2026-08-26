import { expect, test } from "playwright/test";
import { mockResponsiveApi } from "./support/responsive-fixture.js";

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const completeWorkspaceRoutes = [
  "/my-workspace",
  "/dashboard",
  "/applications",
  "/appointments",
  "/appointments/appointment-responsive-qa",
  "/clients",
  "/clients/client-responsive-qa",
  "/leads",
  "/leads/lead-responsive-qa",
  "/pos",
  "/card-view",
  "/room-view",
  "/treatments",
  "/treatments/treatment-responsive-qa",
  "/services",
  "/packages",
  "/online-booking",
  "/staff-schedule",
  "/staff",
  "/staff/staff-responsive-qa",
  "/attendance",
  "/branches",
  "/inventory",
  "/expenses",
  "/payroll",
  "/reports",
  "/settings",
  "/support",
  "/subscription",
  "/subscription/expired",
  "/attendance/kiosk",
  "/marketing",
  "/marketing/campaigns",
  "/marketing/campaigns/new",
  "/marketing/campaigns/deleted",
  "/marketing/templates",
  "/marketing/audiences",
  "/marketing/automations",
  "/marketing/media",
  "/marketing/reports",
  "/marketing/settings",
  "/flipbooks",
  "/flipbooks/overview",
  "/flipbooks/new",
  "/flipbooks/shared",
  "/flipbooks/analytics",
  "/flipbooks/deleted",
  "/flipbooks/settings",
  "/flipbooks/flipbook-responsive-qa",
  "/flipbooks/flipbook-responsive-qa/preview",
];
const workspaceRoutes = process.env.RESPONSIVE_ROUTE ? [process.env.RESPONSIVE_ROUTE] : completeWorkspaceRoutes;

const publicRoutes = [
  "/",
  "/register",
  "/register?branch=ZenshoTech%20Responsive%20QA",
  "/pricing",
  "/pricing?onboarding=1&billing=annual",
  "/inquire",
  "/book",
  "/client-register",
  "/?reset=responsive-token",
  "/accept-invitation?token=responsive-token",
  "/flipbook/view/responsive-token",
];

async function pageMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = root.clientWidth;
    const selectors = "button, a[href], input:not([type='hidden']), select, textarea, summary, [role='button'], [role='tab'], [role='menuitem']";
    const clipped = [];
    const undersized = [];
    const overflowSources = [];

    for (const element of document.querySelectorAll(selectors)) {
      if (element.closest("[aria-hidden='true'], .edge-sidebar-overlay:not(.is-open), .mobile-more-overlay:not(.is-open)")) continue;
      if (element.tagName !== "SUMMARY" && element.closest("details:not([open])")) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0) continue;
      if (rect.width <= 1 && rect.height <= 44) continue;
      if (rect.bottom < 0 || rect.top > root.clientHeight) continue;
      const label = (element.getAttribute("aria-label") || element.textContent || element.getAttribute("name") || element.tagName).trim().replace(/\s+/g, " ").slice(0, 70);
      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        let scrollParent = element.parentElement;
        while (scrollParent) {
          const parentStyle = getComputedStyle(scrollParent);
          if (["auto", "scroll"].includes(parentStyle.overflowX) && scrollParent.scrollWidth > scrollParent.clientWidth) break;
          scrollParent = scrollParent.parentElement;
        }
        if (!scrollParent) clipped.push({ label, left: Math.round(rect.left), right: Math.round(rect.right), viewportWidth });
      }
      const isCompactNativeControl = element.matches("input[type='checkbox'], input[type='radio']") && element.closest("label")?.getBoundingClientRect().height >= 40;
      if (viewportWidth < 600 && !isCompactNativeControl && (rect.width < 40 || rect.height < 40)) {
        undersized.push({ label, width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    }

    if (Math.max(root.scrollWidth, body.scrollWidth) > viewportWidth + 1) {
      for (const element of document.querySelectorAll("body *")) {
        if (element.closest("[aria-hidden='true'], .edge-sidebar-overlay:not(.is-open), .mobile-more-overlay:not(.is-open)")) continue;
        const rect = element.getBoundingClientRect();
        if (rect.right > viewportWidth + 1 || rect.left < -1 || element.scrollWidth > element.clientWidth + 1) {
          overflowSources.push({
            element: `${element.tagName.toLowerCase()}.${String(element.className || "").replace(/\s+/g, ".").slice(0, 90)}`,
            parent: `${element.parentElement?.tagName?.toLowerCase() || ""}.${String(element.parentElement?.className || "").replace(/\s+/g, ".").slice(0, 90)}`,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          });
        }
        if (overflowSources.length >= 10) break;
      }
    }

    return {
      documentOverflow: Math.max(root.scrollWidth, body.scrollWidth) - viewportWidth,
      clipped: clipped.slice(0, 12),
      undersized: undersized.slice(0, 12),
      overflowSources,
    };
  });
}

for (const viewport of viewports) {
  test(`workspace route matrix fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await mockResponsiveApi(page);
    const failures = [];
    const runtimeErrors = [];
    let currentRoute = "";
    page.on("pageerror", (error) => runtimeErrors.push({ route: currentRoute, message: error.message, stack: error.stack }));

    for (const route of workspaceRoutes) {
      currentRoute = route;
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator("body").waitFor({ state: "visible" });
      await page.waitForTimeout(60);
      const metrics = await pageMetrics(page);
      if (metrics.documentOverflow > 1 || metrics.clipped.length) failures.push({ route, ...metrics });

      if (
        viewport.width < 600
        && !route.startsWith("/marketing")
        && !route.startsWith("/flipbooks")
        && !route.startsWith("/subscription")
        && !["/attendance", "/attendance/kiosk"].includes(route)
      ) {
        const navVisible = await page.locator(".mobile-bottom-navigation").isVisible().catch(() => false);
        if (!navVisible) failures.push({ route, missingMobileNavigation: true });
      }
    }

    expect(runtimeErrors, `Runtime errors at ${viewport.width}x${viewport.height}`).toEqual([]);
    expect(failures, `Responsive failures at ${viewport.width}x${viewport.height}`).toEqual([]);
  });
}

for (const viewport of viewports) {
  test(`public route matrix fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await mockResponsiveApi(page, { account: null });
    const failures = [];
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator("body").waitFor({ state: "visible" });
      await page.waitForTimeout(60);
      const metrics = await pageMetrics(page);
      if (metrics.documentOverflow > 1 || metrics.clipped.length) failures.push({ route, ...metrics });
    }

    expect(runtimeErrors, `Runtime errors at ${viewport.width}x${viewport.height}`).toEqual([]);
    expect(failures, `Responsive failures at ${viewport.width}x${viewport.height}`).toEqual([]);
  });
}

test("phone navigation exposes role-filtered primary destinations and More sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockResponsiveApi(page);
  await page.goto("/dashboard");

  const navigation = page.getByRole("navigation", { name: "Mobile primary navigation" });
  await expect(navigation).toBeVisible();
  for (const label of ["Home", "Appointments", "POS", "Clients", "More"]) {
    await expect(navigation.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
  }

  await navigation.getByRole("button", { name: /More/i }).click();
  const menu = page.locator("#mobile-more-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: /Inventory/i })).toBeVisible();
  await expect(menu.getByRole("button", { name: /Settings/i })).toBeVisible();
  await menu.locator(".mobile-more-header").getByRole("button", { name: /Close/i }).click();
  await expect(menu).toBeHidden();
});

test("tablet uses the compact navigation rail and desktop retains the full sidebar", async ({ page }) => {
  await mockResponsiveApi(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/dashboard");
  const tabletSidebar = page.locator(".sidebar");
  await expect(tabletSidebar).toBeVisible();
  expect(await tabletSidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBeLessThanOrEqual(90);
  await expect(page.locator(".mobile-bottom-navigation")).toBeHidden();

  await page.setViewportSize({ width: 1366, height: 768 });
  expect(await tabletSidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(200);
});

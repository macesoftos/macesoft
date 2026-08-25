import { expect, test } from "playwright/test";

import { publicSubscriptionPlans } from "../server/subscriptionPlans.js";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/public/plans") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plans: publicSubscriptionPlans(), websitePackage: null }),
      });
      return;
    }
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Authentication required." }) });
  });
});

test("fixed-price plans start trials without redundant quote actions", async ({ page }) => {
  await page.goto("/pricing?billing=monthly");

  const subscriptionPlans = page.getByRole("region", { name: "Subscription plans" });
  await expect(subscriptionPlans.getByRole("button", { name: "Start free trial" })).toHaveCount(3);
  await expect(subscriptionPlans.getByRole("button", { name: /quote/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request one-time quote" })).toBeVisible();

  await subscriptionPlans.getByRole("button", { name: "Start free trial" }).first().click();
  await expect(page).toHaveURL(/\/register\?plan=starter&billing=monthly$/);
});

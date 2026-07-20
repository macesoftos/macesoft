import { test, expect } from "playwright/test";

test("anonymous users cannot read clinic data", async ({ request }) => {
  for (const path of ["/api/bootstrap", "/api/clients", "/api/settings"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("an authenticated owner can open a scoped workspace and sign out", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("owner@mace.test");
  await page.getByLabel("Password").fill(process.env.SEED_STAFF_PASSWORD || "Mace2026!");
  const loginResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: /sign in securely/i }).click();
  expect((await loginResponse).status()).toBe(200);

  const passwordHeading = page.getByRole("heading", { name: /create your private password/i });
  const accountMenu = page.getByLabel(/open account menu for/i);
  await Promise.race([
    passwordHeading.waitFor({ state: "visible" }),
    accountMenu.waitFor({ state: "visible" }),
  ]);
  if (await passwordHeading.isVisible()) {
    await page.getByLabel("Temporary password").fill(process.env.SEED_STAFF_PASSWORD || "Mace2026!");
    await page.getByLabel("New password", { exact: true }).fill("Mace2026!ReleaseSafe");
    await page.getByLabel("Confirm new password").fill("Mace2026!ReleaseSafe");
    const passwordResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/change-password") && response.request().method() === "POST");
    await page.getByRole("button", { name: /save private password/i }).click();
    expect((await passwordResponse).status()).toBe(200);
  }
  await expect(accountMenu).toBeVisible();

  const authorization = await page.evaluate(async () => {
    const response = await fetch("/api/bootstrap", { credentials: "include" });
    const payload = await response.json();
    return { status: response.status, hasClients: Array.isArray(payload.clients) };
  });
  expect(authorization).toEqual({ status: 200, hasClients: true });

  const serviceId = `svc-e2e-${Date.now()}`;
  const serviceCreation = await page.evaluate(async (id) => {
    const response = await fetch("/api/resources/services", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mace-Request": "app" },
      body: JSON.stringify({
        id,
        name: "Automated E2E Consultation",
        category: "Consultations",
        duration: 45,
        price: 1500,
        commission: "",
        consumables: [],
        branches: ["Mace BGC"],
        staff: ["Doctor"],
        room: "Room 1",
        active: true,
        pos: true,
        description: "Created by the browser test.",
        contraindications: "",
        aftercare: "",
      }),
    });
    return response.status;
  }, serviceId);
  expect(serviceCreation).toBe(201);

  const refreshedBootstrap = page.waitForResponse((response) => response.url().endsWith("/api/bootstrap") && response.request().method() === "GET");
  await page.reload();
  expect((await refreshedBootstrap).status()).toBe(200);
  await expect(accountMenu).toBeVisible();

  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("heading", { name: "Build checkout" })).toBeVisible();

  await page.keyboard.press("F4");
  await expect(page.getByRole("dialog", { name: "Select sale details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Select sale details" })).toBeHidden();

  await page.keyboard.press("F2");
  const catalogSearch = page.getByLabel("Search POS catalog");
  await expect(catalogSearch).toBeFocused();
  await page.keyboard.type("Automated E2E Consultation");
  await expect(page.getByRole("button", { name: /Automated E2E Consultation/i })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("group", { name: /Automated E2E Consultation, quantity 1/i })).toBeVisible();
  await page.keyboard.press("F6");
  await page.keyboard.press("=");
  await expect(page.getByRole("group", { name: /Automated E2E Consultation, quantity 2/i })).toBeFocused();
  await page.keyboard.press("-");
  await expect(page.getByRole("group", { name: /Automated E2E Consultation, quantity 1/i })).toBeFocused();

  await page.keyboard.press("F8");
  await page.keyboard.press("1");
  await expect(page.getByRole("dialog", { name: "Payment form" })).toBeVisible();
  const checkoutResponse = page.waitForResponse((response) => response.url().endsWith("/api/pos/checkout") && response.request().method() === "POST");
  await page.keyboard.press("Control+Enter");
  expect((await checkoutResponse).status()).toBe(201);
  await expect(page.getByRole("dialog", { name: "Payment form" })).toBeHidden();

  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("heading", { name: "My Workspace" })).toBeVisible();
  const serviceDeletion = await page.evaluate(async (id) => {
    const response = await fetch(`/api/resources/services/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-Mace-Request": "app" },
    });
    return response.status;
  }, serviceId);
  expect(serviceDeletion).toBe(204);
  await accountMenu.click();
  const logoutResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/logout") && response.request().method() === "POST");
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByRole("button", { name: /sign in securely/i })).toBeVisible();
});

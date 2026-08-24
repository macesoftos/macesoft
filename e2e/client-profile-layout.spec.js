import { expect, test } from "playwright/test";

const session = {
  id: "client-profile-admin",
  name: "MACE Admin",
  email: "client-profile-admin@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  access: { active: true, organizationWide: true, modules: ["applications", "clients", "appointments", "pos"] },
};

const branch = { id: "branch-bajada", name: "Mace Bajada", status: "Active", branchStatus: "Active", rooms: [] };
const client = {
  id: "client-layout-test",
  fullName: "Layout Test Client",
  tag: "New",
  retention: "Returning",
  consentStatus: "Pending",
  branch: branch.name,
  branchesVisited: branch.name,
  mobile: "+63 917 000 0000",
  email: "layout@example.test",
  birthday: "1990-06-15",
  civilStatus: "Single",
  street: "123 Test Street",
  barangay: "Poblacion",
  city: "Davao City",
  province: "Davao del Sur",
  occupation: "Designer",
  emergencyName: "Emergency Contact",
  emergencyPhone: "+63 917 111 1111",
  source: "Referral",
  referral: "Existing client",
  allergies: "None",
  contraindications: "None",
  skinConcerns: "Fine lines, uneven texture",
  packageBalance: "3 sessions",
  treatmentGoals: "Maintain healthy skin",
  photo: "",
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
        clients: [client], appointments: [], inventory: [], transactions: [], treatments: [], packages: [],
        giftCertificates: [], expenses: [], discounts: [], smsTemplates: [], campaigns: [], auditLogs: [],
        inventoryMovements: [], staff: [], leadIntegrations: [], webhookEvents: [], branches: [branch], services: [], leads: [],
      };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 900, height: 800 },
]) {
  test(`keeps the client photo visible while profile details scroll at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/clients/${client.id}`);

    const imagePane = page.locator(".client-profile-image-pane");
    const detailPane = page.locator(".client-profile-detail-pane");
    await expect(imagePane).toBeVisible();
    await expect(detailPane).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => {
      const image = document.querySelector(".client-profile-image-pane").getBoundingClientRect();
      const detail = document.querySelector(".client-profile-detail-pane");
      const detailRect = detail.getBoundingClientRect();
      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        imageBottom: image.bottom,
        imageHeight: image.height,
        detailHeight: detailRect.height,
        detailClientHeight: detail.clientHeight,
        detailScrollHeight: detail.scrollHeight,
        detailOverflowY: getComputedStyle(detail).overflowY,
      };
    });

    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.imageBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(Math.abs(layout.imageHeight - layout.detailHeight)).toBeLessThan(1);
    expect(layout.detailScrollHeight).toBeGreaterThan(layout.detailClientHeight);
    expect(layout.detailOverflowY).toBe("auto");

    await detailPane.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => detailPane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

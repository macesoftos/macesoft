import { expect, test } from "playwright/test";

const session = {
  id: "lead-manager",
  name: "MACE Admin",
  email: "lead-manager@example.test",
  role: "Super Admin",
  branch: "All branches",
  status: "Active",
  mustChangePassword: false,
  access: { active: true, modules: ["overview", "leads", "appointments", "clients"] },
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

const inquiryMessage = "I would like to ask about acne scar treatment and available schedules.";

const lead = {
  id: "lead-inquiry-test",
  name: "Maria Santos",
  mobile: "+63 917 123 4567",
  email: "maria@example.test",
  message: inquiryMessage,
  concern: inquiryMessage,
  interest: "Acne scar treatment",
  preferredChannel: "Messenger",
  source: "Website",
  firstTouchSource: "Website",
  latestTouchSource: "Website",
  campaign: "Organic inquiry",
  branch: branch.name,
  owner: "Front Desk",
  status: "New Inquiry",
  permissionToContact: true,
  score: 55,
  createdAt: "2026-08-17T02:30:00.000Z",
  scoreReasons: [{ points: 25, reason: "Provided contact details" }],
  activities: [
    {
      id: "activity-captured",
      type: "Created",
      title: "Lead captured",
      actor: "Website",
      occurredAt: "2026-08-17T02:30:00.000Z",
      note: inquiryMessage,
    },
    {
      id: "activity-assigned",
      type: "Assignment",
      title: "Assigned to Front Desk",
      actor: "System",
      occurredAt: "2026-08-17T02:31:00.000Z",
      note: "Ready for follow-up",
    },
  ],
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
        clients: [], appointments: [], inventory: [], transactions: [], treatments: [], packages: [],
        giftCertificates: [], expenses: [], discounts: [], smsTemplates: [], campaigns: [], auditLogs: [],
        inventoryMovements: [], staff: [], leadIntegrations: [], webhookEvents: [], branches: [branch],
        services: [{ id: "service-acne", name: "Acne Scar Consultation", price: 1000, duration: 60 }],
        leads: [lead],
      };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
});

test("puts the customer inquiry and response actions first", async ({ page }) => {
  await page.goto(`/leads/${lead.id}`);

  await expect(page).toHaveURL(new RegExp(`/leads/${lead.id}$`));
  await expect(page.getByRole("heading", { name: "Customer inquiry" })).toBeVisible();
  await expect(page.locator("#lead-customer-name")).toHaveText(lead.name);
  await expect(page.getByRole("heading", { name: "What the customer said" })).toBeVisible();
  await expect(page.getByText(inquiryMessage, { exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: lead.mobile })).toBeVisible();
  await expect(page.getByRole("link", { name: lead.email })).toBeVisible();

  for (const action of ["Call", "Message", "Email", "Follow up", "Book appointment"]) {
    await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
  }

  await expect(page.getByText("Why this lead scored 55")).not.toBeVisible();
  await page.getByText("More lead details", { exact: true }).click();
  await expect(page.getByText("Why this lead scored 55")).toBeVisible();
  await expect(page.getByText("Attribution and related records")).toBeVisible();
});

test("reveals the navigation when the pointer reaches the left edge", async ({ page }) => {
  await page.goto("/leads");

  const trigger = page.getByRole("button", { name: "Show navigation menu" });
  const navigation = page.locator(".edge-sidebar-overlay");

  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await page.mouse.move(1, 320);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toHaveClass(/is-open/);
  await expect(page.locator("#edge-primary-sidebar")).toBeInViewport();

  await page.mouse.move(400, 320);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).not.toHaveClass(/is-open/);
});

test("reveals focused follow-up and booking forms from the main actions", async ({ page }) => {
  await page.goto(`/leads/${lead.id}`);

  await page.getByRole("button", { name: "Follow up", exact: true }).click();
  await expect(page.getByText("Schedule a follow-up", { exact: true })).toBeVisible();
  await expect(page.getByText("Purpose", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await expect(page.getByText("Choose the service, date, and provider", { exact: true })).toBeVisible();
  await expect(page.locator(".lead-booking-section select").first()).toHaveValue("service-acne");
});

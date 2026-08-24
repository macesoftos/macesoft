import { test, expect } from "playwright/test";
import { verifyMarketingBuilder } from "./marketing-builder-workflow.js";

const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL;
const ownerPassword = process.env.BOOTSTRAP_OWNER_PASSWORD;

if (!ownerEmail || !ownerPassword) {
  throw new Error("BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD are required for authenticated browser tests.");
}

async function gotoAuthenticatedWorkspace(page, path) {
  await page.goto(path);
  await expect.poll(async () => page.evaluate(async () => {
    const response = await fetch("/api/bootstrap", { credentials: "include" });
    return response.status;
  }), { timeout: 30_000 }).toBe(200);
}

test("anonymous users cannot read clinic data", async ({ request }) => {
  for (const path of ["/api/bootstrap", "/api/clients", "/api/settings"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("an authenticated owner can open a scoped workspace and sign out", async ({ page }) => {
  test.setTimeout(420_000);
  await page.goto("/");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill(ownerPassword);
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
    await page.getByLabel("Temporary password").fill(ownerPassword);
    await page.getByLabel("New password", { exact: true }).fill("ReleaseSafe2026!Owner");
    await page.getByLabel("Confirm new password").fill("ReleaseSafe2026!Owner");
    const passwordResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/change-password") && response.request().method() === "POST");
    await page.getByRole("button", { name: /save private password/i }).click();
    expect((await passwordResponse).status()).toBe(200);
  }
  await expect(accountMenu).toBeVisible();

  let authorization = { status: 0, hasClients: false };
  let bootstrapAttempts = 0;
  for (; bootstrapAttempts < 5; bootstrapAttempts += 1) {
    authorization = await page.evaluate(async () => {
      const response = await fetch("/api/bootstrap", { credentials: "include" });
      const payload = await response.json();
      return { status: response.status, hasClients: Array.isArray(payload.clients) };
    });
    if (authorization.status === 200) break;
    if (authorization.status !== 503) break;
    await page.waitForTimeout(750 * (bootstrapAttempts + 1));
  }
  expect(authorization).toEqual({ status: 200, hasClients: true });
  if (bootstrapAttempts > 0) {
    await page.reload();
    await expect(accountMenu).toBeVisible();
  }

  await gotoAuthenticatedWorkspace(page, "/appointments");
  await expect(page).toHaveURL(/\/appointments$/);
  await expect(page.locator(".app-shell")).toHaveClass(/standalone-module-shell/);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Back to applications" })).toBeVisible();
  await expect(page.getByText("Manage the clinic schedule", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Filter schedule", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Filter by appointment status")).toBeVisible();
  await expect(page.getByLabel("Filter by doctor or staff")).toBeVisible();
  await expect(page.getByRole("button", { name: "More filters" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Day" })).toBeVisible();

  await gotoAuthenticatedWorkspace(page, "/appointments/nonexistent-release-check");
  await expect(page).toHaveURL(/\/appointments\/nonexistent-release-check$/);
  await expect(page.getByText("Appointment not found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to appointments" }).click();
  await expect(page).toHaveURL(/\/appointments$/);

  const createTrigger = page.getByRole("button", { name: "Create new" });
  await createTrigger.focus();
  await page.keyboard.press("ArrowDown");
  const createMenu = page.getByRole("menu", { name: "Create new" });
  const newAppointmentAction = createMenu.getByRole("menuitem", { name: "New appointment" });
  const newClientAction = createMenu.getByRole("menuitem", { name: "New client" });
  await expect(createMenu).toBeVisible();
  await expect(newAppointmentAction).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(newClientAction).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(createMenu).toBeHidden();
  await expect(createTrigger).toBeFocused();

  await createTrigger.click();
  await newAppointmentAction.click();
  await expect(page.getByRole("dialog", { name: "New appointment" })).toBeVisible();
  await page.getByRole("button", { name: "Close form" }).click();

  await gotoAuthenticatedWorkspace(page, "/clients");
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await createTrigger.click();
  await expect(createMenu.getByRole("menuitem", { name: "New client" })).toBeVisible();
  await expect(createMenu.getByRole("menuitem", { name: "New appointment" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await gotoAuthenticatedWorkspace(page, "/card-view");
  await expect(page).toHaveURL(/\/card-view$/);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByLabel("Card filters")).toBeVisible();
  await expect(page.getByText("Completion rate", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Total Cards", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No service cards", { exact: true })).toBeVisible();
  for (const demoPatient of ["Mika Santos", "Celine Ann Hernandez", "Andrea Lee", "Trisha Uy"]) {
    await expect(page.getByText(demoPatient, { exact: true })).toHaveCount(0);
  }

  await gotoAuthenticatedWorkspace(page, "/room-view");
  await expect(page).toHaveURL(/\/room-view$/);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await createTrigger.click();
  const newRoomAction = createMenu.getByRole("menuitem", { name: "New room" });
  await expect(createMenu.getByRole("menuitem", { name: "New appointment" })).toBeVisible();
  await expect(newRoomAction).toBeVisible();
  await newRoomAction.click();
  const roomDialog = page.getByRole("dialog", { name: "New room" });
  const roomName = `Release Room ${Date.now()}`;
  await expect(roomDialog).toBeVisible();
  await roomDialog.getByLabel("Room name, required").fill(`  ${roomName}  `);
  await roomDialog.getByLabel("Room branch, required").selectOption({ label: "Mace Davao" });
  const roomCreation = page.waitForResponse((response) => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
  await roomDialog.getByRole("button", { name: "Add room" }).click();
  const roomCreationResponse = await roomCreation;
  expect(roomCreationResponse.status()).toBe(201);
  const createdRoomPayload = await roomCreationResponse.json();
  await expect(roomDialog).toBeHidden();
  await expect(page.getByRole("button", { name: `Actions for ${roomName}` })).toBeVisible();

  const duplicateRoomStatus = await page.evaluate(async ({ branchId, name }) => {
    const response = await fetch("/api/rooms", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mace-Request": "app" },
      body: JSON.stringify({ branchId, name: `  ${name.toLocaleLowerCase()}  ` }),
    });
    return response.status;
  }, { branchId: createdRoomPayload.room.branchId, name: roomName });
  expect(duplicateRoomStatus).toBe(409);

  const roomBootstrap = page.waitForResponse((response) => response.url().endsWith("/api/bootstrap") && response.request().method() === "GET");
  await page.reload();
  expect((await roomBootstrap).status()).toBe(200);
  await expect(page.getByRole("button", { name: `Actions for ${roomName}` })).toBeVisible();

  const guardAppointmentId = `ap-room-guard-${Date.now()}`;
  const guardCreationStatus = await page.evaluate(async ({ id, room }) => {
    const bootstrapResponse = await fetch("/api/bootstrap", { credentials: "include" });
    const bootstrap = await bootstrapResponse.json();
    const branch = bootstrap.branches.find((item) => item.rooms.includes(room));
    const client = bootstrap.clients[0];
    const response = await fetch("/api/resources/appointments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mace-Request": "app" },
      body: JSON.stringify({
        id,
        date: "2099-12-31",
        time: "10:00",
        clientId: client.id,
        client: client.fullName,
        serviceName: "Room archive guard",
        branch: branch.name,
        room,
        staff: "Any available",
        duration: 30,
        status: "Confirmed",
        deposit: 0,
      }),
    });
    return response.status;
  }, { id: guardAppointmentId, room: roomName });
  expect(guardCreationStatus).toBe(201);

  for (const viewport of [{ width: 820, height: 980 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await gotoAuthenticatedWorkspace(page, "/room-view");
    const roomAction = page.getByRole("button", { name: `Actions for ${roomName}` });
    await expect(roomAction).toBeVisible();
    await roomAction.click();
    const deleteMenu = page.getByRole("menu", { name: `${roomName} actions` });
    await expect(deleteMenu).toBeVisible();
    const roomActionBox = await roomAction.boundingBox();
    const deleteMenuBox = await deleteMenu.boundingBox();
    expect(roomActionBox).not.toBeNull();
    expect(deleteMenuBox).not.toBeNull();
    if (!roomActionBox || !deleteMenuBox) throw new Error("Room action menu did not produce a visible bounding box.");
    expect(deleteMenuBox.x).toBeGreaterThanOrEqual(0);
    expect(deleteMenuBox.x + deleteMenuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(deleteMenuBox.y + deleteMenuBox.height).toBeLessThanOrEqual(viewport.height);
    expect(deleteMenuBox.x).toBeLessThan(roomActionBox.x);
    expect(deleteMenuBox.x + deleteMenuBox.width).toBeLessThanOrEqual(roomActionBox.x + roomActionBox.width + 1);
    await page.keyboard.press("Escape");

    await createTrigger.click();
    await createMenu.getByRole("menuitem", { name: "New room" }).click();
    await expect(page.getByRole("dialog", { name: "New room" })).toBeVisible();
    await page.getByRole("button", { name: "Close room form" }).click();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAuthenticatedWorkspace(page, "/room-view");

  await page.getByRole("button", { name: `Actions for ${roomName}` }).click();
  await page.getByRole("menuitem", { name: "Delete room" }).click();
  const roomDeleteDialog = page.getByRole("alertdialog", { name: `Delete ${roomName}` });
  await expect(roomDeleteDialog).toContainText(roomName);
  await expect(roomDeleteDialog).toContainText(createdRoomPayload.room.branch);
  const blockedRoomDeletion = page.waitForResponse((response) => response.url().endsWith(`/api/rooms/${createdRoomPayload.room.id}`) && response.request().method() === "DELETE");
  await roomDeleteDialog.getByRole("button", { name: "Confirm delete" }).click();
  expect((await blockedRoomDeletion).status()).toBe(409);
  await expect(roomDeleteDialog.getByRole("alert")).toContainText("upcoming appointment");

  const guardDeletionStatus = await page.evaluate(async (id) => {
    const response = await fetch(`/api/resources/appointments/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "X-Mace-Request": "app" },
    });
    return response.status;
  }, guardAppointmentId);
  expect(guardDeletionStatus).toBe(204);

  const roomDeletion = page.waitForResponse((response) => response.url().endsWith(`/api/rooms/${createdRoomPayload.room.id}`) && response.request().method() === "DELETE");
  await roomDeleteDialog.getByRole("button", { name: "Confirm delete" }).click();
  expect((await roomDeletion).status()).toBe(200);
  await expect(roomDeleteDialog).toBeHidden();
  await expect(page.getByRole("button", { name: `Actions for ${roomName}` })).toHaveCount(0);

  for (const viewport of [{ width: 820, height: 980 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await gotoAuthenticatedWorkspace(page, "/appointments");
    await expect(page.getByText("Filter schedule", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: viewport.width <= 640 ? /Filters/ : "More filters" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Day" })).toBeVisible();
    await createTrigger.click();
    await expect(createMenu).toBeVisible();
    const menuBox = await createMenu.boundingBox();
    expect(menuBox).not.toBeNull();
    if (!menuBox) throw new Error("Create menu did not produce a visible bounding box.");
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press("Escape");
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  const payrollStaffId = `staff-payroll-e2e-${Date.now()}`;
  const payrollStaffName = `Payroll E2E Nurse ${Date.now()}`;
  const payrollFixture = await page.evaluate(async ({ id, name }) => {
    const headers = { "Content-Type": "application/json", "X-Mace-Request": "app" };
    const staffResponse = await fetch("/api/resources/staff", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ id, name, role: "Nurse", branch: "Mace Davao", branches: ["Mace Davao"], status: "Available" }),
    });
    if (staffResponse.status !== 201) return { staffStatus: staffResponse.status, profileStatus: 0 };
    const profileResponse = await fetch(`/api/payroll/profiles/${encodeURIComponent(id)}`, {
      method: "PUT",
      credentials: "include",
      headers,
      body: JSON.stringify({
        payType: "Monthly",
        monthlySalary: 26_000,
        dailyRate: 0,
        hourlyRate: 0,
        periodsPerMonth: 2,
        standardWorkDays: 26,
        standardMinutesPerDay: 480,
        overtimeMultiplier: 1.25,
        workDays: [1, 2, 3, 4, 5, 6],
        paidLeaveCredits: 3,
        active: true,
      }),
    });
    return { staffStatus: staffResponse.status, profileStatus: profileResponse.status };
  }, { id: payrollStaffId, name: payrollStaffName });
  expect(payrollFixture).toEqual({ staffStatus: 201, profileStatus: 200 });

  await gotoAuthenticatedWorkspace(page, "/payroll");
  await expect(page).toHaveURL(/\/payroll$/);
  await expect(page.locator(".payroll-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();
  await expect(page.getByText("Pending salary deductions", { exact: true })).toBeVisible();
  for (const section of ["Payroll Runs", "Employee Pay", "Schedule & Leave", "Commission Rules"]) {
    await expect(page.getByRole("button", { name: section })).toBeVisible();
  }

  await page.getByRole("button", { name: "Employee Pay" }).click();
  await expect(page.getByText(payrollStaffName, { exact: true }).first()).toBeVisible();
  await page.getByText(payrollStaffName, { exact: true }).first().click();
  await page.getByLabel("Monthly salary").fill("27000");
  const profileUpdate = page.waitForResponse((response) => response.url().includes(`/api/payroll/profiles/${payrollStaffId}`) && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save pay profile" }).click();
  expect((await profileUpdate).status()).toBe(200);

  await page.getByRole("button", { name: "Commission Rules" }).click();
  const commissionSetup = page.locator(".payroll-two-column.rules > aside");
  await expect(commissionSetup).toHaveCSS("position", "sticky");
  await expect(page.getByText("Nurse standard 10%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Schedule & Leave" }).click();
  await expect(page.getByRole("heading", { name: "Schedule or leave" })).toBeVisible();

  await gotoAuthenticatedWorkspace(page, "/staff-schedule");
  await expect(page.getByRole("heading", { name: "Schedule, leave, and day-off swaps" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Approved leave calendar" })).toBeVisible();
  await page.getByLabel("Schedule employee").selectOption(payrollStaffId);
  await page.getByLabel("Schedule date").fill("2001-02-03");
  await page.getByLabel("Schedule type").selectOption("Vacation Leave");
  await page.getByLabel("Schedule branch").selectOption({ label: "Mace Davao" });
  await page.getByText("Paid leave — use one credit", { exact: true }).click();
  const leaveCreation = page.waitForResponse((response) => response.url().endsWith("/api/payroll/schedules") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save approved entry" }).click();
  expect((await leaveCreation).status()).toBe(201);
  await page.getByLabel("Leave calendar month").fill("2001-02");
  await expect(page.getByRole("region", { name: "Approved leave calendar" }).getByText(payrollStaffName, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record day-off swap" })).toBeVisible();

  await gotoAuthenticatedWorkspace(page, "/payroll");
  await page.getByRole("button", { name: "Payroll Runs" }).click();
  if (!await page.getByLabel("Cutoff start").isVisible()) await page.getByText("Generate payroll", { exact: true }).click();
  await page.getByLabel("Cutoff start").fill("2001-01-01");
  await page.getByLabel("Cutoff end").fill("2001-01-01");
  await page.getByLabel("Pay date").fill("2001-01-05");
  await page.getByLabel("Branch scope").selectOption({ label: "Mace Davao" });
  await page.getByLabel("Notes").fill("Browser release acceptance payroll");
  const payrollCreation = page.waitForResponse((response) => response.url().endsWith("/api/payroll/runs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Generate draft" }).click();
  expect((await payrollCreation).status()).toBe(201);
  await expect(page.locator(".payroll-run-detail .payroll-table").getByText(payrollStaffName, { exact: true })).toBeVisible();
  await expect(page.getByText("Net payroll", { exact: true })).toBeVisible();

  for (const viewport of [{ width: 820, height: 980 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await gotoAuthenticatedWorkspace(page, "/payroll");
    await expect(page.locator(".payroll-workspace")).toBeVisible();
    await expect(page.getByRole("button", { name: "Payroll Runs" })).toBeVisible();
    await expect(page.getByText("Pending salary deductions", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Commission Rules" }).evaluate((button) => button.click());
    await expect(page.locator(".payroll-two-column.rules > aside")).toHaveCSS("position", "static");
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  await gotoAuthenticatedWorkspace(page, "/payroll");
  await page.getByRole("button", { name: "Back to applications" }).click();
  await expect(page).toHaveURL(/\/applications$/);

  await gotoAuthenticatedWorkspace(page, "/#/support");
  await expect(page.getByRole("button", { name: "Create new" })).toHaveCount(0);

  const serviceId = `svc-e2e-${Date.now()}`;
  const serviceName = `Automated E2E Consultation ${serviceId}`;
  const serviceCreation = await page.evaluate(async ({ id, name }) => {
    const response = await fetch("/api/resources/services", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Mace-Request": "app" },
      body: JSON.stringify({
        id,
        name,
        category: "Consultations",
        duration: 45,
        price: 1500,
        recommendedIntervalDays: 21,
        commission: "",
        consumables: [],
        branches: ["All branches"],
        staff: ["Doctor"],
        room: "Room 1",
        active: true,
        pos: true,
        description: "Created by the browser test.",
        contraindications: "",
        aftercare: "Keep the treated area clean and avoid direct sun exposure for 48 hours.",
      }),
    });
    return response.status;
  }, { id: serviceId, name: serviceName });
  expect(serviceCreation).toBe(201);

  const refreshedBootstrap = page.waitForResponse((response) => response.url().endsWith("/api/bootstrap") && response.request().method() === "GET");
  await page.reload();
  expect((await refreshedBootstrap).status()).toBe(200);
  await expect(accountMenu).toBeVisible();

  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("heading", { name: "Build checkout" })).toBeVisible();
  await expect(page.getByText("Open client carts", { exact: true })).toHaveCount(0);

  await page.keyboard.press("F4");
  await expect(page.getByRole("dialog", { name: "Select sale details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Select sale details" })).toBeHidden();

  await page.keyboard.press("F2");
  const catalogSearch = page.getByLabel("Search POS catalog");
  await expect(catalogSearch).toBeFocused();
  await page.keyboard.type(serviceName);
  await expect(page.getByRole("button", { name: new RegExp(serviceName, "i") }).first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("group", { name: new RegExp(`${serviceName}, quantity 1`, "i") })).toBeVisible();
  await page.keyboard.press("F6");
  await page.keyboard.press("=");
  await expect(page.getByRole("group", { name: new RegExp(`${serviceName}, quantity 2`, "i") })).toBeFocused();
  await page.keyboard.press("-");
  await expect(page.getByRole("group", { name: new RegExp(`${serviceName}, quantity 1`, "i") })).toBeFocused();

  await page.getByRole("button", { name: "Expand discount settings" }).click();
  await page.getByLabel("Discount source").selectOption("__manual__");
  await page.getByLabel("Manual discount scope").selectOption("Service");
  await expect(page.getByLabel("Discounted service")).toContainText(serviceName);
  await page.getByLabel("Manual discount type").selectOption("Percentage");
  await page.getByLabel("Manual discount value").fill("10");
  await expect(page.getByText(`10% of ${serviceName}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Collapse discount settings" }).click();
  await expect(page.getByLabel("Discount source")).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand discount settings" })).toContainText(`10% on ${serviceName}`);

  await page.evaluate(() => {
    Object.defineProperty(window, "print", { configurable: true, value: () => {} });
  });
  await page.getByRole("button", { name: "Print receipt", exact: true }).first().click();
  await expect(page.locator(".print-receipt-aftercare")).toContainText("Keep the treated area clean and avoid direct sun exposure for 48 hours.");
  await expect(page.locator(".print-receipt-aftercare")).toContainText("Recommended interval: 21 days");
  await expect(page.locator(".print-receipt-aftercare")).toContainText("Suggested next session:");

  await page.keyboard.press("F8");
  await page.keyboard.press("1");
  await expect(page.getByRole("dialog", { name: "Payment form" })).toBeVisible();
  const paymentReference = page.getByLabel("Payment 1 reference number");
  await expect(paymentReference).toHaveAttribute("readonly", "");
  await expect(paymentReference).toHaveValue(/^PAY-\d{8}-[A-F0-9]{8}$/);
  const checkoutResponse = page.waitForResponse((response) => response.url().endsWith("/api/pos/checkout") && response.request().method() === "POST");
  await page.keyboard.press("Control+Enter");
  expect((await checkoutResponse).status()).toBe(201);
  await expect(page.getByRole("dialog", { name: "Payment form" })).toBeHidden();
  await page.getByRole("button", { name: "Receipt", exact: true }).first().click();
  await expect(page.locator(".print-receipt-aftercare")).toContainText("Keep the treated area clean and avoid direct sun exposure for 48 hours.");
  await expect(page.locator(".print-receipt-aftercare")).toContainText("Recommended interval: 21 days");

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
  await verifyMarketingBuilder(page, expect);
  await accountMenu.click();
  const logoutResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/logout") && response.request().method() === "POST");
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByRole("button", { name: /sign in securely/i })).toBeVisible();
});

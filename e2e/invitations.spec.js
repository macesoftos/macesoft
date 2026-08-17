import { expect, test } from "playwright/test";

import { roleAccess } from "../src/data.js";

const branch = {
  id: "branch-davao",
  name: "Mace Davao",
  code: "DAVAO",
  status: "Active",
  enabledModules: roleAccess["Branch Manager"],
  modules: roleAccess["Branch Manager"].map((moduleId) => ({ moduleId, enabled: true })),
  rooms: [],
  roomRecords: [],
};

function ownerSession() {
  return {
    id: "owner-1",
    name: "MACE Owner",
    email: "owner@mace.test",
    role: "Owner",
    branch: "All branches",
    organizationId: "org-mace",
    organizationWideAccess: true,
    status: "Active",
    mustChangePassword: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    access: {
      active: true,
      scope: "all",
      organizationWide: true,
      activeBranchId: "all",
      branches: [{ id: branch.id, name: branch.name, role: "", permissions: [], modules: roleAccess.Owner, status: "Active", branchStatus: "Active" }],
      modules: roleAccess.Owner,
      permissions: [],
    },
  };
}

function managerSession() {
  return {
    id: "manager-1",
    name: "Davao Manager",
    email: "manager@mace.test",
    role: "Branch Manager",
    branch: branch.name,
    organizationId: "org-mace",
    organizationWideAccess: false,
    status: "Active",
    mustChangePassword: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    access: {
      active: true,
      scope: "branch",
      organizationWide: false,
      activeBranchId: branch.id,
      activeBranch: { id: branch.id, name: branch.name, role: "Branch Manager", permissions: ["staff.invite"], modules: roleAccess["Branch Manager"] },
      branches: [{ id: branch.id, name: branch.name, role: "Branch Manager", permissions: ["staff.invite"], modules: roleAccess["Branch Manager"], status: "Active", branchStatus: "Active" }],
      modules: roleAccess["Branch Manager"],
      permissions: ["staff.invite"],
    },
  };
}

async function mockWorkspace(page, session, capabilities) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    let payload = {};
    let status = 200;
    if (pathname === "/api/auth/session") payload = { account: session };
    else if (pathname === "/api/health") payload = { ok: true };
    else if (pathname === "/api/notifications") payload = { notifications: [], readAt: null, unreadCount: 0 };
    else if (pathname === "/api/accounts") payload = { accounts: [session] };
    else if (pathname === "/api/invitations") payload = { invitations: [], statuses: ["Pending", "Accepted", "Expired", "Revoked"], capabilities };
    else if (pathname === "/api/bootstrap") payload = {
      clients: [], appointments: [], services: [], inventory: [], transactions: [], treatments: [],
      packages: [], giftCertificates: [], leads: [], staff: [], expenses: [], discounts: [], smsTemplates: [],
      campaigns: [], auditLogs: [], inventoryMovements: [], branches: [branch], leadIntegrations: [], webhookEvents: [],
    };
    else status = 404;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

test("owner invitation form exposes authorized roles, concrete branches, and responsive controls", async ({ page }) => {
  const capabilities = {
    organizationManager: true,
    canInviteManagers: true,
    invitationExpiryDays: 7,
    roles: ["Owner", "Super Admin", "Branch Manager", "Employee"],
    roleModules: Object.fromEntries(["Owner", "Super Admin", "Branch Manager", "Employee"].map((role) => [role, roleAccess[role]])),
    permissions: [{ id: "staff.invite", label: "Invite employees" }, { id: "staff.invite_managers", label: "Invite branch managers" }],
    branches: [{ id: branch.id, name: branch.name, enabledModules: branch.enabledModules }],
  };
  await mockWorkspace(page, ownerSession(), capabilities);
  await page.goto("/staff");
  await page.getByRole("button", { name: "Invite user" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Invite member" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("First name")).toBeVisible();
  await expect(dialog.getByLabel("Last name")).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Branch assignment" }).getByText(branch.name)).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Modules" }).getByText("Appointments")).toBeVisible();
  await dialog.getByLabel("Role").selectOption("Super Admin");
  await expect(dialog.getByText(/No “All Branches” assignment will be stored/)).toBeVisible();
  await expect(dialog.getByText(/grants organization-wide access/)).toBeVisible();

  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.height).toBeLessThanOrEqual(viewport.height);
  }
});

test("branch manager sees only employee roles and a locked assigned branch", async ({ page }) => {
  const capabilities = {
    organizationManager: false,
    canInviteManagers: false,
    invitationExpiryDays: 7,
    roles: ["Doctor", "Nurse / Aesthetician", "Receptionist", "Employee"],
    roleModules: Object.fromEntries(["Doctor", "Nurse / Aesthetician", "Receptionist", "Employee"].map((role) => [role, roleAccess[role]])),
    permissions: [{ id: "staff.invite", label: "Invite employees" }],
    branches: [{ id: branch.id, name: branch.name, enabledModules: branch.enabledModules }],
  };
  await mockWorkspace(page, managerSession(), capabilities);
  await page.goto("/staff");
  await page.getByRole("button", { name: "Invite user" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Invite member" });
  await expect(dialog.getByLabel("Role").locator("option", { hasText: "Owner" })).toHaveCount(0);
  await expect(dialog.getByLabel("Role").locator("option", { hasText: "Branch Manager" })).toHaveCount(0);
  const branchCheckbox = dialog.getByRole("checkbox", { name: /Mace Davao/ });
  await expect(branchCheckbox).toBeChecked();
  await expect(branchCheckbox).toBeDisabled();
});

test("a new recipient can review and accept a pending invitation once", async ({ page }) => {
  let acceptedPayload = null;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/auth/session") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Authentication is required." }) });
    if (pathname === "/api/invitations/accept/token-123" && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ invitation: {
      id: "invite-1", firstName: "Ava", name: "Ava Santos", email: "ava@example.test", role: "Employee", status: "Pending",
      organization: { name: "MACE by Dr. Mace" }, branches: [{ id: branch.id, name: branch.name }], expiresAt: "2026-08-24T00:00:00.000Z", accountExists: false,
    } }) });
    if (pathname === "/api/invitations/accept/token-123" && request.method() === "POST") {
      acceptedPayload = request.postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ redirectPath: `/?branch=${branch.id}`, invitation: { status: "Accepted" } }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
  });
  await page.goto("/accept-invitation?token=token-123");
  await expect(page.getByText("MACE by Dr. Mace", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(branch.name, { exact: true })).toBeVisible();
  await page.getByLabel("Create password").fill("SecureInvite2026!");
  await page.getByLabel("Confirm password").fill("SecureInvite2026!");
  await page.getByLabel(/Terms of Service/).check();
  await page.getByLabel(/Privacy Policy/).check();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible();
  expect(acceptedPayload).toEqual({ password: "SecureInvite2026!", termsAccepted: true, privacyAccepted: true });
});

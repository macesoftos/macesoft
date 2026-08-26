import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "../server/prisma.js";
import { roleAccess } from "../src/data.js";

const email = String(process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
const name = String(process.env.PLATFORM_ADMIN_NAME || "").trim();
const password = String(process.env.PLATFORM_ADMIN_PASSWORD || "");

if (!/^\S+@\S+\.\S+$/.test(email) || !name) {
  throw new Error("PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_NAME are required.");
}
if (password.length < 14 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("PLATFORM_ADMIN_PASSWORD must be 14+ characters with uppercase, lowercase, a number, and a symbol.");
}

const allowedEmails = new Set(String(process.env.ZENSHOTECH_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean));
allowedEmails.add(String(process.env.SUBSCRIPTION_SALES_EMAIL || "sales@zenshotech.com").trim().toLowerCase());
if (!allowedEmails.has(email)) {
  throw new Error("PLATFORM_ADMIN_EMAIL must also be present in ZENSHOTECH_ADMIN_EMAILS or match SUBSCRIPTION_SALES_EMAIL.");
}

const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const modules = roleAccess["Super Admin"];
const now = new Date();

await prisma.$transaction(async (tx) => {
  const existingAccount = await tx.account.findUnique({ where: { email } });
  if (existingAccount) {
    const account = await tx.account.update({
      where: { id: existingAccount.id },
      data: {
        name,
        passwordHash,
        role: "Super Admin",
        organizationWideAccess: true,
        organizationModules: JSON.stringify(modules),
        status: "Active",
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: now,
      },
    });
    await tx.authSession.deleteMany({ where: { accountId: account.id } });
    await tx.auditLog.create({ data: {
      time: now.toLocaleString("en-PH"),
      actor: "System",
      role: "System",
      actorAccountId: account.id,
      branchId: account.lastBranchId || null,
      area: "Authentication",
      action: "Platform administrator provisioned",
      subjectType: "Account",
      subjectId: account.id,
      details: "An existing verified account was granted ZenshoTech system-provider administration. Existing sessions were revoked and a password change is required at first sign-in.",
    } });
    return;
  }

  const organization = await tx.organization.upsert({
    where: { slug: "zenshotech-provider" },
    create: { name: "ZenshoTech Provider", slug: "zenshotech-provider", status: "Internal" },
    update: { name: "ZenshoTech Provider", status: "Internal" },
  });
  const branch = await tx.branch.upsert({
    where: { name: "ZenshoTech Provider Operations" },
    create: {
      organizationId: organization.id,
      name: "ZenshoTech Provider Operations",
      code: "ZEN-PROVIDER",
      city: "Manila",
      status: "Active",
      modules: { create: modules.map((moduleId) => ({ moduleId, enabled: true })) },
    },
    update: { organizationId: organization.id, code: "ZEN-PROVIDER", status: "Active" },
  });
  const account = await tx.account.create({
    data: {
      name,
      email,
      passwordHash,
      role: "Super Admin",
      branch: branch.name,
      organizationId: organization.id,
      organizationWideAccess: true,
      organizationModules: JSON.stringify(modules),
      lastBranchId: branch.id,
      status: "Active",
      mustChangePassword: true,
      emailVerifiedAt: now,
    },
  });
  await tx.branchMembership.upsert({
    where: { branchId_accountId: { branchId: branch.id, accountId: account.id } },
    create: {
      branchId: branch.id,
      accountId: account.id,
      role: "Super Admin",
      permissions: "[]",
      modules: JSON.stringify(modules),
      status: "Active",
      isPrimary: true,
    },
    update: { role: "Super Admin", modules: JSON.stringify(modules), status: "Active", isPrimary: true },
  });
  await tx.subscription.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, planCode: "lifetime", billingCycle: "one_time", status: "lifetime", paidStartAt: now, includedWebsitePages: 20 },
    update: { planCode: "lifetime", billingCycle: "one_time", status: "lifetime", expiresAt: null },
  });
  await tx.authSession.deleteMany({ where: { accountId: account.id } });
  await tx.auditLog.create({ data: {
    time: now.toLocaleString("en-PH"),
    actor: "System",
    role: "System",
    actorAccountId: account.id,
    branchId: branch.id,
    area: "Authentication",
    action: "Platform administrator provisioned",
    subjectType: "Account",
    subjectId: account.id,
    details: "A verified ZenshoTech system-provider administrator was provisioned. Existing sessions were revoked and a password change is required at first sign-in.",
  } });
});

console.log(JSON.stringify({ event: "platform_admin_provisioned", email, mustChangePassword: true }));
await prisma.$disconnect();

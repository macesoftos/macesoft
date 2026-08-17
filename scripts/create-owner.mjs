import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "../server/prisma.js";

const email = String(process.env.BOOTSTRAP_OWNER_EMAIL || "").trim().toLowerCase();
const name = String(process.env.BOOTSTRAP_OWNER_NAME || "").trim();
const password = String(process.env.BOOTSTRAP_OWNER_PASSWORD || "");
if (!/^\S+@\S+\.\S+$/.test(email) || !name) throw new Error("BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_NAME are required.");
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("BOOTSTRAP_OWNER_PASSWORD must be 12+ characters with uppercase, lowercase, a number, and a symbol.");
}
if (await prisma.account.count()) throw new Error("Owner bootstrap is locked because an account already exists.");
const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
await prisma.$transaction(async (tx) => {
  const organization = await tx.organization.upsert({
    where: { slug: "mace-by-dr-mace" },
    create: { name: "MACE by Dr. Mace", slug: "mace-by-dr-mace" },
    update: {},
  });
  const defaultBranch = await tx.branch.findFirst({ where: { organizationId: organization.id, status: "Active" }, orderBy: { createdAt: "asc" } });
  if (!defaultBranch) throw new Error("Create an active branch before bootstrapping the owner account.");
  const staff = await tx.staffMember.create({ data: { name, role: "Owner", branch: defaultBranch.name, status: "Available" } });
  await tx.account.create({ data: { staffId: staff.id, name, email, passwordHash, role: "Owner", branch: "All branches", organizationId: organization.id, status: "Active", mustChangePassword: false } });
  await tx.auditLog.create({ data: { time: new Date().toLocaleString("en-PH"), actor: name, role: "Owner", area: "Authentication", action: "Initial owner created", details: "The one-time production owner bootstrap completed with a connected staff profile." } });
});
console.log(JSON.stringify({ event: "owner_bootstrap_completed", email }));
await prisma.$disconnect();

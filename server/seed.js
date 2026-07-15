import { prisma } from "./prisma.js";
import { randomBytes, scryptSync } from "node:crypto";
import {
  branches,
  initialAppointments,
  initialCampaigns,
  initialClients,
  initialDiscounts,
  initialExpenses,
  initialGiftCertificates,
  initialInventory,
  initialLeads,
  initialPackages,
  initialServices,
  initialSettings,
  initialSmsTemplates,
  initialStaff,
  initialTransactions,
  initialTreatments,
  users,
} from "../src/data.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Database seeding is disabled in production.");
}

function asJsonText(value) {
  return JSON.stringify(value ?? []);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

async function clearDatabase() {
  await prisma.faceTrackAuditEntry.deleteMany();
  await prisma.faceTrackCorrectionRequest.deleteMany();
  await prisma.faceTrackAttendanceRecord.deleteMany();
  await prisma.faceTrackChallenge.deleteMany();
  await prisma.faceTrackKioskChallenge.deleteMany();
  await prisma.faceTrackKioskDevice.deleteMany();
  await prisma.faceTrackProfile.deleteMany();
  await prisma.faceTrackPolicy.deleteMany();
  await prisma.attendanceEvent.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.userInvitation.deleteMany();
  await prisma.account.deleteMany();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.allow_audit_mutation = 'true'");
    await tx.auditLog.deleteMany();
  });
  await prisma.systemSetting.deleteMany();
  await prisma.uploadAsset.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.marketingCampaign.deleteMany();
  await prisma.smsTemplate.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.leadConversion.deleteMany();
  await prisma.leadAssignment.deleteMany();
  await prisma.externalLeadIdentity.deleteMany();
  await prisma.leadTouchpoint.deleteMany();
  await prisma.leadFollowUp.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.leadIntegration.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.giftCertificate.deleteMany();
  await prisma.clinicPackage.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.client.deleteMany();
}

async function seedAccounts() {
  const staff = await prisma.staffMember.findMany();
  const defaultPassword = process.env.SEED_STAFF_PASSWORD || "Mace2026!";

  await prisma.account.createMany({
    data: users.map((user) => ({
      id: user.id,
      staffId: staff.find((person) => person.name === user.name)?.id ?? null,
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: hashPassword(defaultPassword),
      role: user.role,
      branch: user.branch,
      status: "Active",
      mustChangePassword: true,
    })),
  });
}

async function seedBranches() {
  for (const branch of branches) {
    await prisma.branch.create({
      data: {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        address: branch.address,
        phone: branch.phone,
        hours: branch.hours,
        staff: Number(branch.staff || 0),
        devices: asJsonText(branch.devices),
        image: branch.image,
        rooms: {
          create: branch.rooms.map((room) => ({
            name: room,
          })),
        },
      },
    });
  }
}

async function seedClients() {
  await prisma.client.createMany({
    data: initialClients.map((client) => ({
      ...client,
      balance: Number(client.balance || 0),
      giftBalance: Number(client.giftBalance || 0),
      marketingOptIn: Boolean(client.marketingOptIn),
    })),
  });
}

async function seedServices() {
  await prisma.service.createMany({
    data: initialServices.map((service) => ({
      ...service,
      duration: Number(service.duration || 0),
      price: Number(service.price || 0),
      consumables: asJsonText(service.consumables),
      branches: asJsonText(service.branches),
      staff: asJsonText(service.staff),
      active: service.active !== false,
      pos: service.pos !== false,
    })),
  });
}

async function seedOperationalRecords() {
  await prisma.staffMember.createMany({
    data: initialStaff.map((staff) => ({
      ...staff,
      commissionRate: Number(staff.commissionRate || 0),
    })),
  });

  await prisma.appointment.createMany({
    data: initialAppointments.map((appointment) => ({
      ...appointment,
      deposit: Number(appointment.deposit || 0),
    })),
  });

  await prisma.treatment.createMany({
    data: initialTreatments.map((treatment) => ({
      ...treatment,
      photos: Number(treatment.photos || 0),
    })),
  });

  await prisma.inventoryItem.createMany({
    data: initialInventory.map((item) => ({
      ...item,
      packQty: Number(item.packQty || 0),
      beginning: Number(item.beginning || 0),
      stock: Number(item.stock || 0),
      reorder: Number(item.reorder || 0),
      cost: Number(item.cost || 0),
      price: Number(item.price || 0),
      image: item.image ?? "",
    })),
  });
}

async function seedRevenueRecords() {
  for (const transaction of initialTransactions) {
    await prisma.sale.create({
      data: {
        id: transaction.id,
        invoice: transaction.invoice,
        date: transaction.date,
        time: transaction.time,
        client: transaction.client,
        branch: transaction.branch,
        staff: transaction.staff,
        subtotal: Number(transaction.subtotal || 0),
        discount: Number(transaction.discount || 0),
        total: Number(transaction.total || 0),
        payments: asJsonText(transaction.payments),
        status: transaction.status,
        notes: transaction.notes,
        items: {
          create: transaction.items.map((item) => ({
            name: item.name,
            type: item.type,
            qty: Number(item.qty || 1),
            price: Number(item.price || 0),
          })),
        },
      },
    });
  }

  await prisma.clinicPackage.createMany({
    data: initialPackages.map((pkg) => ({
      ...pkg,
      sessions: Number(pkg.sessions || 0),
      used: Number(pkg.used || 0),
      transferable: Boolean(pkg.transferable),
      price: Number(pkg.price || 0),
    })),
  });

  await prisma.giftCertificate.createMany({
    data: initialGiftCertificates.map((certificate) => ({
      ...certificate,
      balance: Number(certificate.balance || 0),
    })),
  });
}

async function seedGrowthAndAdminRecords() {
  await prisma.lead.createMany({ data: initialLeads });
  await prisma.smsTemplate.createMany({ data: initialSmsTemplates });
  await prisma.marketingCampaign.createMany({
    data: initialCampaigns.map((campaign) => ({
      ...campaign,
      sent: Number(campaign.sent || 0),
      booked: Number(campaign.booked || 0),
      credits: Number(campaign.credits || 0),
    })),
  });
  await prisma.expense.createMany({
    data: initialExpenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount || 0),
    })),
  });
  await prisma.discount.createMany({
    data: initialDiscounts.map((discount) => ({
      ...discount,
      value: Number(discount.value || 0),
      usage: Number(discount.usage || 0),
      active: Boolean(discount.active),
    })),
  });
  await prisma.auditLog.create({
    data: {
      id: "audit-seed",
      time: new Date().toLocaleString("en-PH"),
      actor: "System",
      role: "System",
      area: "Setup",
      action: "Database seeded",
      details: "MACE ClinicOS SQLite database seeded from workspace data.",
    },
  });
  await prisma.systemSetting.create({
    data: {
      key: "app",
      value: JSON.stringify(initialSettings),
      updatedAt: new Date(),
    },
  });
}

async function seedInventoryMovements() {
  const productSales = initialTransactions.flatMap((transaction) =>
    transaction.items
      .filter((item) => item.type === "Product")
      .map((item) => {
        const inventoryItem = initialInventory.find((stockItem) => stockItem.item === item.name);
        return inventoryItem
          ? {
              id: `move-${transaction.id}-${inventoryItem.id}`,
              date: transaction.date,
              itemId: inventoryItem.id,
              item: inventoryItem.item,
              branch: transaction.branch,
              qty: -Number(item.qty || 1),
              reason: `Sold on ${transaction.invoice}`,
              user: transaction.staff || "System",
            }
          : null;
      })
      .filter(Boolean),
  );

  if (productSales.length) {
    await prisma.inventoryMovement.createMany({ data: productSales });
  }
}

async function main() {
  await clearDatabase();
  await seedBranches();
  await seedClients();
  await seedServices();
  await seedOperationalRecords();
  await seedAccounts();
  await seedInventoryMovements();
  await seedRevenueRecords();
  await seedGrowthAndAdminRecords();
}

main()
  .then(async () => {
    console.log("MACE ClinicOS database seeded.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

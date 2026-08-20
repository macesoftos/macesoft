import "dotenv/config";
import { prisma } from "../server/prisma.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const schema = new URL(databaseUrl).searchParams.get("schema") || "public";
const confirmation = String(process.env.DEMO_SEED_CONFIRM || "").trim();
if (!/^macesoft_demo_[a-z0-9_]+$/i.test(schema)) {
  throw new Error("Demo data may only be written to an isolated macesoft_demo_* schema.");
}
if (confirmation !== schema) {
  throw new Error("DEMO_SEED_CONFIRM must exactly match the isolated database schema.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Run the demo seeder as a one-time setup task, never from the production runtime.");
}

const branch = "Mace Davao";
const dateInManila = (offsetDays = 0) => {
  const value = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const services = [
  { id: "demo-service-signature-facial", name: "Mace Signature Facial", category: "Facial Treatments", duration: 75, price: 3200, room: "Treatment Room", description: "Personalized cleansing, exfoliation, extraction, and recovery care.", aftercare: "Use gentle skincare and daily sunscreen for the next 48 hours." },
  { id: "demo-service-skin-booster", name: "Skin Booster Treatment", category: "Injectables & Contour Enhancements", duration: 60, price: 9500, room: "Consult Room", description: "Hydration-focused injectable treatment with physician assessment.", contraindications: "Requires medical screening and signed consent.", aftercare: "Avoid strenuous exercise, alcohol, and facial massage for 24 hours." },
  { id: "demo-service-acne-recovery", name: "Acne Recovery Facial", category: "Facial Treatments", duration: 60, price: 3800, room: "Treatment Room", description: "Congestion care and calming treatment for acne-prone skin.", aftercare: "Avoid active exfoliants for three days and keep the skin hydrated." },
  { id: "demo-service-ultralift", name: "Mace Ultralift", category: "Laser Treatments & Energy-Based Devices", duration: 90, price: 18000, room: "Laser Room", description: "Non-invasive lifting and contour treatment with mapped device settings.", contraindications: "Not suitable for clients with active skin infection in the treatment area.", aftercare: "Hydrate well and apply sunscreen as instructed." },
  { id: "demo-service-consultation", name: "Aesthetic Consultation", category: "Consultations", duration: 30, price: 1000, room: "Consult Room", description: "One-on-one assessment and personalized treatment planning." },
  { id: "demo-service-diode", name: "Diode Hair Removal", category: "Laser Treatments & Energy-Based Devices", duration: 45, price: 2800, room: "Laser Room", description: "Targeted diode treatment using recorded parameters and consumables.", aftercare: "Avoid heat, friction, and direct sun exposure for 24 hours." },
];

const staff = [
  { id: "demo-staff-dr-mace", name: "Dr. Mace", role: "Doctor", schedule: "Mon-Sat, 9:00 AM-6:00 PM", services: "Skin Booster Treatment, Mace Ultralift, Aesthetic Consultation" },
  { id: "demo-staff-nurse-ana", name: "Nurse Ana", role: "Nurse / Aesthetician", schedule: "Mon-Fri, 9:00 AM-6:00 PM", services: "Mace Signature Facial, Acne Recovery Facial" },
  { id: "demo-staff-nurse-bea", name: "Nurse Bea", role: "Nurse / Aesthetician", schedule: "Tue-Sat, 10:00 AM-7:00 PM", services: "Acne Recovery Facial, Diode Hair Removal" },
  { id: "demo-staff-mia", name: "Mia Reyes", role: "Receptionist", schedule: "Mon-Sat, 9:00 AM-7:00 PM", services: "Client care and scheduling" },
];

const appointments = [
  { id: "demo-appt-today-0900", date: dateInManila(), time: "09:00", clientId: "cl-celine", client: "Celine Ann Hernandez", serviceId: "demo-service-skin-booster", service: "Skin Booster Treatment", room: "Consult Room", staff: "Dr. Mace", duration: 60, status: "Confirmed", deposit: 2500, tags: "VIP, Returning", notes: "Review hydration goals before treatment." },
  { id: "demo-appt-today-1030", date: dateInManila(), time: "10:30", clientId: "cl-mika", client: "Mika Santos", serviceId: "demo-service-signature-facial", service: "Mace Signature Facial", room: "Treatment Room", staff: "Nurse Ana", duration: 75, status: "Checked In", deposit: 1000, tags: "New client", notes: "Latex sensitivity is recorded on the client profile." },
  { id: "demo-appt-today-1300", date: dateInManila(), time: "13:00", clientId: "cl-trisha", client: "Trisha Uy", serviceId: "demo-service-acne-recovery", service: "Acne Recovery Facial", room: "Treatment Room", staff: "Nurse Bea", duration: 60, status: "Pending Confirmation", packageName: "Acne Recovery Plan", tags: "Package session" },
  { id: "demo-appt-today-1500", date: dateInManila(), time: "15:00", clientId: "cl-andrea", client: "Andrea Lee", serviceId: "demo-service-ultralift", service: "Mace Ultralift", room: "Laser Room", staff: "Dr. Mace", duration: 90, status: "Confirmed", deposit: 5000, packageName: "Lift & Define Plan", tags: "Returning" },
  { id: "demo-appt-tomorrow-1000", date: dateInManila(1), time: "10:00", clientId: "cl-mika", client: "Mika Santos", serviceId: "demo-service-consultation", service: "Aesthetic Consultation", room: "Consult Room", staff: "Dr. Mace", duration: 30, status: "Confirmed", tags: "Treatment plan" },
  { id: "demo-appt-tomorrow-1400", date: dateInManila(1), time: "14:00", clientId: "cl-celine", client: "Celine Ann Hernandez", serviceId: "demo-service-diode", service: "Diode Hair Removal", room: "Laser Room", staff: "Nurse Bea", duration: 45, status: "Pending Confirmation", tags: "VIP" },
  { id: "demo-appt-yesterday-1100", date: dateInManila(-1), time: "11:00", clientId: "cl-celine", client: "Celine Ann Hernandez", serviceId: "demo-service-signature-facial", service: "Mace Signature Facial", room: "Treatment Room", staff: "Nurse Ana", duration: 75, status: "Completed", tags: "Returning" },
  { id: "demo-appt-yesterday-1530", date: dateInManila(-1), time: "15:30", clientId: "cl-trisha", client: "Trisha Uy", serviceId: "demo-service-acne-recovery", service: "Acne Recovery Facial", room: "Treatment Room", staff: "Nurse Bea", duration: 60, status: "Completed", packageName: "Acne Recovery Plan" },
];

const treatments = [
  { id: "demo-treatment-celine", clientId: "cl-celine", client: "Celine Ann Hernandez", date: dateInManila(-1), service: "Mace Signature Facial", provider: "Nurse Ana", room: "Treatment Room", preNotes: "Skin mildly dehydrated with no active irritation.", postNotes: "Client tolerated treatment well; visible improvement in hydration.", consumables: "Gentle cleanser, enzyme exfoliant, recovery mask", consent: "Signed", followUp: dateInManila(21), outcome: "Completed as planned", satisfaction: "5/5" },
  { id: "demo-treatment-trisha", clientId: "cl-trisha", client: "Trisha Uy", date: dateInManila(-1), service: "Acne Recovery Facial", provider: "Nurse Bea", room: "Treatment Room", preNotes: "Congestion concentrated on the forehead and chin.", postNotes: "Calming protocol completed without adverse reaction.", consumables: "Salicylic cleanser, calming serum, barrier cream", consent: "Signed", followUp: dateInManila(14), outcome: "Reduced redness", satisfaction: "4/5" },
  { id: "demo-treatment-andrea", clientId: "cl-andrea", client: "Andrea Lee", date: dateInManila(-14), service: "Mace Ultralift", provider: "Dr. Mace", room: "Laser Room", preNotes: "Baseline photos and treatment map reviewed.", postNotes: "Even response across mapped zones; no unexpected discomfort.", consumables: "Ultralift cartridge, conductive gel", deviceSettings: "Demo record: lower-face contour protocol", batch: "ULT-2607", consent: "Signed", followUp: dateInManila(14), outcome: "Treatment completed", satisfaction: "5/5" },
];

const leads = [
  { id: "demo-lead-alex", name: "Alex Cruz", firstName: "Alex", lastName: "Cruz", mobile: "09170001001", email: "alex.cruz@example.com", source: "Instagram", sourcePlatform: "Instagram", campaign: "August Glow Consultation", preferredChannel: "Messenger", interest: "Skin rejuvenation", interestedTreatment: "Skin Booster Treatment", concern: "Dullness and early fine lines", message: "Would like a natural-looking treatment plan.", status: "New Inquiry", priority: "High", score: 82, owner: "Mia Reyes", branch, assignedBranch: branch, created: dateInManila(), nextStep: "Reply and offer consultation slots", nextAction: "Messenger reply", nextFollowUpAt: `${dateInManila()}T10:30`, permissionToContact: true, marketingConsent: true, privacyConsent: true, consentSource: "Demo landing page", consentTimestamp: new Date().toISOString() },
  { id: "demo-lead-jamie", name: "Jamie Lim", firstName: "Jamie", lastName: "Lim", mobile: "09170001002", email: "jamie.lim@example.com", source: "Website", sourcePlatform: "Website", campaign: "Consultation Request", preferredChannel: "Phone", interest: "Acne care", interestedTreatment: "Acne Recovery Facial", concern: "Recurring congestion and acne marks", status: "Qualified", priority: "Normal", score: 68, owner: "Nurse Ana", branch, assignedBranch: branch, created: dateInManila(-1), nextStep: "Confirm preferred appointment", nextAction: "Phone call", nextFollowUpAt: `${dateInManila()}T14:00`, lastContactedAt: `${dateInManila(-1)}T16:20`, followUpCount: 1, permissionToContact: true, privacyConsent: true, consentSource: "Demo website form", consentTimestamp: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "demo-lead-sam", name: "Sam Villanueva", firstName: "Sam", lastName: "Villanueva", mobile: "09170001003", email: "sam.villanueva@example.com", source: "Facebook", sourcePlatform: "Facebook", campaign: "Lift and Define", preferredChannel: "Messenger", interest: "Facial contour", interestedTreatment: "Mace Ultralift", concern: "Interested in a non-invasive lifting option", status: "Consultation Scheduled", priority: "High", score: 91, owner: "Mia Reyes", branch, assignedBranch: branch, created: dateInManila(-3), nextStep: "Send appointment reminder", nextAction: "SMS reminder", nextFollowUpAt: `${dateInManila(1)}T09:00`, lastContactedAt: `${dateInManila(-1)}T11:10`, firstRespondedAt: `${dateInManila(-3)}T13:10`, followUpCount: 2, permissionToContact: true, marketingConsent: true, privacyConsent: true, consentSource: "Demo Facebook lead form", consentTimestamp: new Date(Date.now() - 259_200_000).toISOString() },
  { id: "demo-lead-riley", name: "Riley Tan", firstName: "Riley", lastName: "Tan", mobile: "09170001004", email: "riley.tan@example.com", source: "Referral", sourcePlatform: "Referral", campaign: "Client Referral", preferredChannel: "Email", interest: "Laser hair removal", interestedTreatment: "Diode Hair Removal", concern: "Wants pricing and preparation details", status: "Follow-Up", priority: "Normal", score: 59, owner: "Mia Reyes", branch, assignedBranch: branch, created: dateInManila(-5), nextStep: "Share preparation guide", nextAction: "Email", nextFollowUpAt: `${dateInManila(2)}T11:00`, lastContactedAt: `${dateInManila(-2)}T15:45`, followUpCount: 2, permissionToContact: true, privacyConsent: true, consentSource: "Demo staff entry", consentTimestamp: new Date(Date.now() - 432_000_000).toISOString() },
];

async function upsertMany(model, values) {
  for (const value of values) {
    await model.upsert({ where: { id: value.id }, create: value, update: value });
  }
}

try {
  const organization = await prisma.organization.findUnique({ where: { slug: "mace-by-dr-mace" } });
  const branchRecord = await prisma.branch.findFirst({ where: { name: branch, status: "Active" } });
  if (!organization || !branchRecord) throw new Error("Run the base seed before adding demo records.");

  await upsertMany(prisma.service, services.map((service) => ({
    ...service,
    commission: "10%",
    consumables: "[]",
    branches: JSON.stringify([branch]),
    staff: JSON.stringify(staff.filter((person) => person.services.includes(service.name)).map((person) => person.name)),
    active: true,
    pos: true,
  })));
  await upsertMany(prisma.staffMember, staff.map((person) => ({ ...person, branch, status: "Available", attendance: "Clocked out", employmentDate: dateInManila(-365) })));

  await prisma.appointment.deleteMany({ where: { id: { startsWith: "demo-appt-" } } });
  await prisma.appointment.createMany({ data: appointments.map((appointment) => ({ ...appointment, branch, timezone: "Asia/Manila", appointmentType: "Treatment" })) });
  await prisma.treatment.deleteMany({ where: { id: { startsWith: "demo-treatment-" } } });
  await prisma.treatment.createMany({ data: treatments.map((treatment) => ({ ...treatment, branch })) });
  await prisma.lead.deleteMany({ where: { id: { startsWith: "demo-lead-" } } });
  await prisma.lead.createMany({ data: leads });

  await prisma.client.update({ where: { id: "cl-celine" }, data: { lastVisit: dateInManila(-1), nextVisit: dateInManila(), preferredStaff: "Dr. Mace" } });
  await prisma.client.update({ where: { id: "cl-mika" }, data: { lastVisit: dateInManila(-12), nextVisit: dateInManila(), preferredStaff: "Nurse Ana" } });
  await prisma.client.update({ where: { id: "cl-andrea" }, data: { lastVisit: dateInManila(-14), nextVisit: dateInManila(), preferredStaff: "Dr. Mace" } });
  await prisma.client.update({ where: { id: "cl-trisha" }, data: { lastVisit: dateInManila(-1), nextVisit: dateInManila(), preferredStaff: "Nurse Bea" } });

  await prisma.auditLog.upsert({
    where: { id: "audit-demo-seed" },
    create: { id: "audit-demo-seed", time: new Date().toLocaleString("en-PH"), actor: "Demo setup", role: "System", area: "Setup", action: "Sales demo refreshed", details: `Fictional sample records loaded into ${schema}.` },
    update: { time: new Date().toLocaleString("en-PH"), details: `Fictional sample records refreshed in ${schema}.` },
  });

  console.log(JSON.stringify({ event: "demo_seed_completed", schema, counts: { services: services.length, staff: staff.length, appointments: appointments.length, treatments: treatments.length, leads: leads.length } }));
} finally {
  await prisma.$disconnect();
}

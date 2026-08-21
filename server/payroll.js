import express from "express";
import { canManageOrganization } from "../src/organizationRoles.js";
import {
  assertPayrollDate,
  calculateCommission,
  calculatePayrollLine,
  payrollAdjustmentTypes,
  payrollDateRange,
  payrollRunTotals,
  payrollScheduleTypes,
  selectCommissionRule,
} from "./payrollEngine.js";

const payTypes = new Set(["Monthly", "Daily", "Hourly"]);
const commissionRuleTypes = new Set(["Percentage", "Fixed amount"]);
const payrollRunStatuses = new Set(["Draft", "Approved", "Finalized"]);

function clean(value) {
  return String(value ?? "").trim();
}

function numberValue(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} is invalid.`);
  }
  return number;
}

function parseList(value, fallback = []) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function json(value) {
  return JSON.stringify(value);
}

function payrollActor(request, apiError) {
  const actor = request.authActor;
  if (!actor?.id || !actor?.organizationId) throw apiError("Authentication is required.", 401);
  if (!canManageOrganization(actor.role)) {
    throw apiError("Payroll is restricted to organization-wide Owners and Super Admins.", 403);
  }
  return actor;
}

async function organizationBranches(database, organizationId) {
  return database.branch.findMany({
    where: { organizationId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

async function organizationStaff(database, organizationId, branch = "All branches") {
  const branchRecords = await organizationBranches(database, organizationId);
  const names = branchRecords.map((item) => item.name);
  const staff = await database.staffMember.findMany({
    where: {
      status: { not: "Inactive" },
      OR: [{ branch: { in: names } }, { branch: "All branches" }, { branch: "" }],
    },
    orderBy: [{ name: "asc" }],
  });
  if (!branch || branch === "All branches") return { branchRecords, staff };
  return {
    branchRecords,
    staff: staff.filter((person) => person.branch === branch || parseList(person.branches).includes(branch)),
  };
}

function serializeProfile(profile) {
  return profile ? { ...profile, workDays: parseList(profile.workDays, [1, 2, 3, 4, 5, 6]).map(Number) } : null;
}

function serializeRule(rule) {
  return rule ? { ...rule, serviceName: rule.service?.name || "" } : null;
}

function serializeLine(line) {
  return line ? {
    ...line,
    calculationDetails: parseObject(line.calculationDetails),
    adjustments: line.adjustments || [],
    commissionEarnings: (line.commissionEarnings || []).map((item) => ({ ...item, details: parseObject(item.details) })),
    salaryDeductionRows: (line.salaryDeductionRows || []).map((item) => ({ ...item, details: parseObject(item.details) })),
  } : null;
}

function serializeRun(run) {
  return run ? { ...run, lines: (run.lines || []).map(serializeLine) } : null;
}

const runInclude = {
  lines: {
    include: {
      adjustments: { orderBy: { createdAt: "asc" } },
      commissionEarnings: { orderBy: [{ sourceDate: "asc" }, { serviceName: "asc" }] },
      salaryDeductionRows: { orderBy: [{ sourceDate: "asc" }, { saleInvoice: "asc" }] },
    },
    orderBy: { staffName: "asc" },
  },
};

async function ensurePayrollProfiles(database, staff, actorName = "System") {
  for (const person of staff) {
    await database.payrollEmployeeProfile.upsert({
      where: { staffId: person.id },
      create: { staffId: person.id, active: false, updatedBy: actorName },
      update: {},
    });
  }
}

async function ensureDefaultCommissionRules(database, actor) {
  const existing = await database.commissionRule.findMany({ where: { organizationId: actor.organizationId } });
  const defaults = [
    { name: "Aesthetician standard 5%", role: "Aesthetician", value: 5, priority: 10 },
    { name: "Head Aesthetician standard 5%", role: "Head Aesthetician", value: 5, priority: 10 },
    { name: "Nurse standard 10%", role: "Nurse", value: 10, priority: 10 },
    { name: "Head Nurse standard 10%", role: "Head Nurse", value: 10, priority: 10 },
  ];
  for (const item of defaults) {
    if (existing.some((rule) => !rule.serviceId && rule.role === item.role && rule.branch === "All branches")) continue;
    await database.commissionRule.create({
      data: {
        organizationId: actor.organizationId,
        ...item,
        ruleType: "Percentage",
        branch: "All branches",
        createdById: actor.id,
        createdBy: actor.name,
      },
    });
  }

  const nadServices = await database.service.findMany({ where: { active: true, name: { contains: "NAD", mode: "insensitive" } } });
  const nurseRoles = ["Nurse", "Head Nurse"];
  const refreshed = await database.commissionRule.findMany({ where: { organizationId: actor.organizationId } });
  for (const service of nadServices) {
    for (const role of nurseRoles) {
      if (refreshed.some((rule) => rule.role === role && rule.serviceId === service.id && rule.branch === "All branches")) continue;
      await database.commissionRule.create({
        data: {
          organizationId: actor.organizationId,
          name: `${role} ${service.name}`,
          role,
          serviceId: service.id,
          branch: "All branches",
          ruleType: "Fixed amount",
          value: 1000,
          discountedRuleType: "Percentage",
          discountedValue: 10,
          priority: 100,
          createdById: actor.id,
          createdBy: actor.name,
        },
      });
    }
  }
}

function normalizeProfile(payload) {
  const payType = clean(payload.payType) || "Monthly";
  if (!payTypes.has(payType)) throw new Error("Pay type must be Monthly, Daily, or Hourly.");
  const workDays = [...new Set(parseList(payload.workDays, [1, 2, 3, 4, 5, 6]).map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((left, right) => left - right);
  if (!workDays.length) throw new Error("Choose at least one regular work day.");
  return {
    payType,
    monthlySalary: numberValue(payload.monthlySalary, "Monthly salary", { min: 0 }),
    dailyRate: numberValue(payload.dailyRate, "Daily rate", { min: 0 }),
    hourlyRate: numberValue(payload.hourlyRate, "Hourly rate", { min: 0 }),
    periodsPerMonth: numberValue(payload.periodsPerMonth || 2, "Payroll periods per month", { min: 1, max: 4, integer: true }),
    standardWorkDays: numberValue(payload.standardWorkDays || 26, "Standard work days", { min: 1, max: 31, integer: true }),
    standardMinutesPerDay: numberValue(payload.standardMinutesPerDay || 480, "Standard minutes per day", { min: 60, max: 1440, integer: true }),
    overtimeMultiplier: numberValue(payload.overtimeMultiplier || 1.25, "Overtime multiplier", { min: 1, max: 5 }),
    workDays: json(workDays),
    paidLeaveCredits: numberValue(payload.paidLeaveCredits, "Paid leave credits", { min: 0, max: 365 }),
    active: payload.active !== false,
  };
}

function normalizeSchedule(payload) {
  const type = clean(payload.type) || "Work Day";
  if (!payrollScheduleTypes.includes(type)) throw new Error("Schedule type is invalid.");
  const paid = ["Vacation Leave", "Emergency Leave", "Sick Leave"].includes(type) && payload.paid === true;
  return {
    staffId: clean(payload.staffId),
    workDate: assertPayrollDate(payload.workDate, "Schedule date"),
    branch: clean(payload.branch),
    type,
    paid,
    scheduledMinutes: type === "Day Off" ? 0 : numberValue(payload.scheduledMinutes || 480, "Scheduled minutes", { min: 60, max: 1440, integer: true }),
    status: "Approved",
    notes: clean(payload.notes).slice(0, 1000),
  };
}

function normalizeRule(payload) {
  const ruleType = clean(payload.ruleType) || "Percentage";
  const discountedRuleType = clean(payload.discountedRuleType);
  if (!commissionRuleTypes.has(ruleType)) throw new Error("Commission type is invalid.");
  if (discountedRuleType && !commissionRuleTypes.has(discountedRuleType)) throw new Error("Discounted commission type is invalid.");
  const effectiveFrom = clean(payload.effectiveFrom);
  const effectiveTo = clean(payload.effectiveTo);
  if (effectiveFrom) assertPayrollDate(effectiveFrom, "Effective from");
  if (effectiveTo) assertPayrollDate(effectiveTo, "Effective to");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective-to date cannot be before effective-from date.");
  return {
    name: clean(payload.name).slice(0, 160),
    role: clean(payload.role),
    serviceId: clean(payload.serviceId) || null,
    branch: clean(payload.branch) || "All branches",
    ruleType,
    value: numberValue(payload.value, "Commission value", { min: 0, max: ruleType === "Percentage" ? 100 : 1_000_000 }),
    discountedRuleType,
    discountedValue: discountedRuleType ? numberValue(payload.discountedValue, "Discounted commission value", { min: 0, max: discountedRuleType === "Percentage" ? 100 : 1_000_000 }) : 0,
    packageBasis: "Session Value",
    priority: numberValue(payload.priority || 0, "Priority", { min: 0, max: 1000, integer: true }),
    active: payload.active !== false,
    effectiveFrom,
    effectiveTo,
  };
}

function adjustmentsByType(line) {
  return (line?.adjustments || []).reduce((totals, adjustment) => {
    totals[adjustment.type] = (totals[adjustment.type] || 0) + Number(adjustment.amount || 0);
    return totals;
  }, {});
}

async function syncSalaryDeductions(database, sales, staffById) {
  for (const sale of sales) {
    const payments = parseList(sale.payments);
    for (let index = 0; index < payments.length; index += 1) {
      const payment = payments[index];
      if (payment.method !== "Salary Deduction" || !payment.employeeId || !staffById.has(payment.employeeId)) continue;
      const sourceKey = clean(payment.id) || `${sale.id}:salary-deduction:${index}`;
      const existing = await database.payrollSalaryDeduction.findUnique({ where: { sourceKey } });
      if (existing?.status === "Included") continue;
      await database.payrollSalaryDeduction.upsert({
        where: { sourceKey },
        create: {
          sourceKey,
          staffId: payment.employeeId,
          saleId: sale.id,
          saleInvoice: sale.invoice,
          sourceDate: sale.date,
          branch: sale.branch,
          amount: Math.max(0, Number(payment.amount || 0)),
          details: json({ paymentMethod: payment.method, referenceNumber: payment.referenceNumber || "" }),
        },
        update: {
          amount: Math.max(0, Number(payment.amount || 0)),
          status: sale.status === "Void" ? "Reversed" : "Pending",
          details: json({ paymentMethod: payment.method, referenceNumber: payment.referenceNumber || "" }),
        },
      });
    }
  }
}

function proportionalLineBase(sale, item) {
  const itemGross = Math.max(0, Number(item.price || 0) * Number(item.qty || 1));
  const itemDiscounts = (sale.items || []).reduce((sum, entry) => sum + Math.max(0, Number(entry.discount || 0)), 0);
  const remainingDiscount = Math.max(0, Number(sale.discount || 0) - itemDiscounts);
  const saleGross = Math.max(0, Number(sale.subtotal || 0));
  const allocated = saleGross > 0 ? remainingDiscount * (itemGross / saleGross) : 0;
  return Math.max(0, itemGross - Math.max(0, Number(item.discount || 0)) - allocated);
}

async function syncCommissionEarnings(database, { sales, staff, rules }) {
  const staffByName = new Map(staff.map((person) => [person.name.toLocaleLowerCase(), person]));
  const serviceIds = [...new Set(sales.flatMap((sale) => sale.items.map((item) => item.serviceId)).filter(Boolean))];
  const services = await database.service.findMany({ where: { id: { in: serviceIds } } });
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const packageIds = [...new Set(sales.flatMap((sale) => parseList(sale.payments).map((payment) => payment.packageId)).filter(Boolean))];
  const packages = packageIds.length ? await database.clinicPackage.findMany({ where: { id: { in: packageIds } } }) : [];
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));

  for (const sale of sales) {
    const packageTender = parseList(sale.payments).find((payment) => payment.method === "Package" && payment.packageId);
    for (const item of sale.items) {
      if (item.type !== "Service" || !item.serviceId || !clean(item.provider) || item.provider === "N/A") continue;
      const person = staffByName.get(clean(item.provider).toLocaleLowerCase());
      if (!person) continue;
      const service = serviceById.get(item.serviceId);
      if (!service) continue;
      if (service.serviceType === "Package" && !packageTender) continue;
      let baseAmount = proportionalLineBase(sale, item);
      if (packageTender) {
        const pkg = packageById.get(packageTender.packageId);
        baseAmount = Number(pkg?.serviceValue || service.serviceValue || (Number(pkg?.sessions) ? Number(pkg.price || 0) / Number(pkg.sessions) : 0) || baseAmount);
      }
      const discounted = Number(sale.discount || 0) > 0 || Number(item.discount || 0) > 0;
      const rule = selectCommissionRule(rules, { role: person.role, serviceId: service.id, branch: sale.branch, sourceDate: sale.date });
      if (!rule) continue;
      const amount = calculateCommission(rule, { baseAmount, quantity: item.qty, discounted });
      if (amount <= 0) continue;
      const sourceKey = `sale-item:${item.id}`;
      const existing = await database.payrollCommissionEarning.findUnique({ where: { sourceKey } });
      if (existing?.status === "Included") continue;
      await database.payrollCommissionEarning.upsert({
        where: { sourceKey },
        create: {
          sourceKey,
          staffId: person.id,
          saleId: sale.id,
          saleItemId: item.id,
          serviceId: service.id,
          sourceDate: sale.date,
          branch: sale.branch,
          serviceName: service.name,
          ruleName: rule.name,
          baseAmount,
          amount,
          details: json({ discounted, ruleType: discounted && rule.discountedRuleType ? rule.discountedRuleType : rule.ruleType, value: discounted && rule.discountedRuleType ? rule.discountedValue : rule.value, packageSession: Boolean(packageTender) }),
        },
        update: {
          staffId: person.id,
          baseAmount,
          amount,
          ruleName: rule.name,
          status: sale.status === "Void" ? "Reversed" : "Pending",
          details: json({ discounted, ruleType: discounted && rule.discountedRuleType ? rule.discountedRuleType : rule.ruleType, value: discounted && rule.discountedRuleType ? rule.discountedValue : rule.value, packageSession: Boolean(packageTender) }),
        },
      });
    }
  }
}

async function recalculateRun(database, runId, actor) {
  const run = await database.payrollRun.findUnique({ where: { id: runId }, include: runInclude });
  if (!run || run.organizationId !== actor.organizationId) throw new Error("Payroll run not found.");
  if (run.status !== "Draft") throw new Error("Only a Draft payroll run can be recalculated.");
  const dates = payrollDateRange(run.cutoffStart, run.cutoffEnd);
  const { staff } = await organizationStaff(database, actor.organizationId, run.branch);
  await ensurePayrollProfiles(database, staff, actor.name);
  const staffIds = staff.map((person) => person.id);
  const [profiles, attendance, schedules, rules, sales] = await Promise.all([
    database.payrollEmployeeProfile.findMany({ where: { staffId: { in: staffIds }, active: true } }),
    database.faceTrackAttendanceRecord.findMany({ where: { staffId: { in: staffIds }, workDate: { gte: run.cutoffStart, lte: run.cutoffEnd } } }),
    database.payrollScheduleEntry.findMany({ where: { staffId: { in: staffIds }, workDate: { gte: run.cutoffStart, lte: run.cutoffEnd }, status: "Approved" } }),
    database.commissionRule.findMany({ where: { organizationId: actor.organizationId, active: true } }),
    database.sale.findMany({
      where: {
        date: { gte: run.cutoffStart, lte: run.cutoffEnd },
        status: { not: "Void" },
        testMode: false,
        ...(run.branch === "All branches" ? {} : { branch: run.branch }),
      },
      include: { items: true },
    }),
  ]);
  const staffById = new Map(staff.map((person) => [person.id, person]));
  await syncSalaryDeductions(database, sales, staffById);
  await syncCommissionEarnings(database, { sales, staff, rules });

  const existingByStaff = new Map(run.lines.map((line) => [line.staffId, line]));
  const profileByStaff = new Map(profiles.map((profile) => [profile.staffId, profile]));
  const calculatedLines = [];
  for (const person of staff) {
    const profile = profileByStaff.get(person.id);
    if (!profile) continue;
    const existing = existingByStaff.get(person.id);
    const adjustments = adjustmentsByType(existing);
    const [earnings, deductions] = await Promise.all([
      database.payrollCommissionEarning.findMany({ where: { staffId: person.id, sourceDate: { gte: run.cutoffStart, lte: run.cutoffEnd }, status: "Pending", ...(run.branch === "All branches" ? {} : { branch: run.branch }) } }),
      database.payrollSalaryDeduction.findMany({ where: { staffId: person.id, sourceDate: { gte: run.cutoffStart, lte: run.cutoffEnd }, status: "Pending", ...(run.branch === "All branches" ? {} : { branch: run.branch }) } }),
    ]);
    const automaticCommissions = earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const automaticDeductions = deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const calculation = calculatePayrollLine({
      profile: serializeProfile(profile),
      dates,
      attendanceRecords: attendance.filter((item) => item.staffId === person.id),
      scheduleEntries: schedules.filter((item) => item.staffId === person.id),
      incentives: adjustments.Incentive || 0,
      commissions: automaticCommissions + (adjustments["Commission Adjustment"] || 0),
      salaryDeductions: Math.max(0, automaticDeductions + (adjustments["Salary Deduction Adjustment"] || 0)),
      otherDeductions: Math.max(0, adjustments["Other Deduction"] || 0),
    });
    const data = {
      staffName: person.name,
      role: person.role,
      branch: person.branch || "All branches",
      ...Object.fromEntries(Object.entries(calculation).filter(([key]) => key !== "details")),
      calculationDetails: json({ ...calculation.details, automaticCommissions, automaticSalaryDeductions: automaticDeductions }),
    };
    const line = await database.payrollLine.upsert({
      where: { payrollRunId_staffId: { payrollRunId: run.id, staffId: person.id } },
      create: { payrollRunId: run.id, staffId: person.id, ...data },
      update: data,
    });
    if (earnings.length) await database.payrollCommissionEarning.updateMany({ where: { id: { in: earnings.map((item) => item.id) }, status: "Pending" }, data: { payrollLineId: line.id } });
    if (deductions.length) await database.payrollSalaryDeduction.updateMany({ where: { id: { in: deductions.map((item) => item.id) }, status: "Pending" }, data: { payrollLineId: line.id } });
    calculatedLines.push({ ...line, ...data });
  }

  const validStaffIds = new Set(calculatedLines.map((line) => line.staffId));
  const staleLines = run.lines.filter((line) => !validStaffIds.has(line.staffId));
  if (staleLines.length) {
    const staleIds = staleLines.map((line) => line.id);
    await database.payrollCommissionEarning.updateMany({ where: { payrollLineId: { in: staleIds }, status: "Pending" }, data: { payrollLineId: null } });
    await database.payrollSalaryDeduction.updateMany({ where: { payrollLineId: { in: staleIds }, status: "Pending" }, data: { payrollLineId: null } });
    await database.payrollLine.deleteMany({ where: { id: { in: staleIds } } });
  }
  const totals = payrollRunTotals(calculatedLines);
  await database.payrollRun.update({ where: { id: run.id }, data: totals });
  return database.payrollRun.findUnique({ where: { id: run.id }, include: runInclude });
}

function payloadError(error, apiError) {
  if (error?.status) return error;
  return apiError(clean(error?.message) || "Payroll request failed.", 400);
}

export function createPayrollRouter(prisma, { apiError, asyncRoute, writeAudit }) {
  const router = express.Router();

  router.get("/overview", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    const { branchRecords, staff } = await organizationStaff(prisma, actor.organizationId);
    await ensurePayrollProfiles(prisma, staff, actor.name);
    await ensureDefaultCommissionRules(prisma, actor);
    const [profiles, runs, rules, schedules, pendingDeductions, pendingCommissions, services] = await Promise.all([
      prisma.payrollEmployeeProfile.findMany({ where: { staffId: { in: staff.map((item) => item.id) } }, orderBy: { staffId: "asc" } }),
      prisma.payrollRun.findMany({ where: { organizationId: actor.organizationId }, orderBy: [{ cutoffEnd: "desc" }, { createdAt: "desc" }], take: 50 }),
      prisma.commissionRule.findMany({ where: { organizationId: actor.organizationId }, include: { service: { select: { id: true, name: true } } }, orderBy: [{ role: "asc" }, { priority: "desc" }, { name: "asc" }] }),
      prisma.payrollScheduleEntry.findMany({ where: { staffId: { in: staff.map((item) => item.id) } }, orderBy: [{ workDate: "desc" }], take: 200 }),
      prisma.payrollSalaryDeduction.aggregate({ where: { staffId: { in: staff.map((item) => item.id) }, status: "Pending" }, _sum: { amount: true }, _count: true }),
      prisma.payrollCommissionEarning.aggregate({ where: { staffId: { in: staff.map((item) => item.id) }, status: "Pending" }, _sum: { amount: true }, _count: true }),
      prisma.service.findMany({ where: { active: true }, select: { id: true, name: true, serviceType: true }, orderBy: { name: "asc" } }),
    ]);
    response.json({
      staff: staff.map((person) => ({ ...person, branches: parseList(person.branches), scheduleBranches: parseList(person.scheduleBranches) })),
      profiles: profiles.map(serializeProfile),
      runs,
      rules: rules.map(serializeRule),
      schedules,
      services,
      branches: branchRecords,
      pending: {
        salaryDeductions: { count: pendingDeductions._count, amount: pendingDeductions._sum.amount || 0 },
        commissions: { count: pendingCommissions._count, amount: pendingCommissions._sum.amount || 0 },
      },
    });
  }));

  router.get("/runs/:id", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    const run = await prisma.payrollRun.findFirst({ where: { id: clean(request.params.id), organizationId: actor.organizationId }, include: runInclude });
    if (!run) throw apiError("Payroll run not found.", 404);
    response.json({ run: serializeRun(run) });
  }));

  router.put("/profiles/:staffId", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const { staff } = await organizationStaff(prisma, actor.organizationId);
      const person = staff.find((item) => item.id === clean(request.params.staffId));
      if (!person) throw apiError("Employee was not found in this organization.", 404);
      const data = { ...normalizeProfile(request.body || {}), updatedBy: actor.name };
      const before = await prisma.payrollEmployeeProfile.findUnique({ where: { staffId: person.id } });
      const result = await prisma.$transaction(async (tx) => {
        const profile = await tx.payrollEmployeeProfile.upsert({ where: { staffId: person.id }, create: { staffId: person.id, ...data }, update: data });
        const auditLog = await writeAudit(tx, request, { area: "Payroll", action: "Employee payroll profile updated", subjectType: "PayrollEmployeeProfile", subjectId: profile.id, details: `${person.name}'s payroll rates and schedule basis were updated.`, beforeValues: before || {}, afterValues: profile });
        return { profile, auditLog };
      });
      response.json({ ...result, profile: serializeProfile(result.profile) });
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.post("/schedules", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const data = normalizeSchedule(request.body || {});
      const { staff, branchRecords } = await organizationStaff(prisma, actor.organizationId);
      const person = staff.find((item) => item.id === data.staffId);
      if (!person) throw apiError("Employee was not found in this organization.", 404);
      if (data.branch && !branchRecords.some((branch) => branch.name === data.branch)) throw apiError("Choose an organization branch.", 400);
      const existing = await prisma.payrollScheduleEntry.findUnique({ where: { staffId_workDate: { staffId: data.staffId, workDate: data.workDate } } });
      if (data.paid) {
        const [profile, paidLeaveUsed] = await Promise.all([
          prisma.payrollEmployeeProfile.findUnique({ where: { staffId: data.staffId } }),
          prisma.payrollScheduleEntry.count({
            where: {
              staffId: data.staffId,
              paid: true,
              status: "Approved",
              ...(existing ? { id: { not: existing.id } } : {}),
            },
          }),
        ]);
        if (!profile || paidLeaveUsed + 1 > Number(profile.paidLeaveCredits || 0)) {
          throw apiError(`${person.name} does not have enough paid leave credits.`, 409);
        }
      }
      const recordData = { ...data, createdById: existing?.createdById || actor.id, createdBy: existing?.createdBy || actor.name, approvedById: actor.id, approvedBy: actor.name, approvedAt: new Date() };
      const result = await prisma.$transaction(async (tx) => {
        const schedule = await tx.payrollScheduleEntry.upsert({ where: { staffId_workDate: { staffId: data.staffId, workDate: data.workDate } }, create: recordData, update: recordData });
        const auditLog = await writeAudit(tx, request, { area: "Payroll", action: existing ? "Payroll schedule entry updated" : "Payroll schedule entry created", subjectType: "PayrollScheduleEntry", subjectId: schedule.id, details: `${person.name}: ${schedule.type} on ${schedule.workDate}.`, beforeValues: existing || {}, afterValues: schedule });
        return { schedule, auditLog };
      });
      response.status(existing ? 200 : 201).json(result);
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.delete("/schedules/:id", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    const existing = await prisma.payrollScheduleEntry.findUnique({ where: { id: clean(request.params.id) } });
    if (!existing) { response.status(204).end(); return; }
    const { staff } = await organizationStaff(prisma, actor.organizationId);
    if (!staff.some((person) => person.id === existing.staffId)) throw apiError("Payroll schedule entry not found.", 404);
    const finalized = await prisma.payrollRun.findFirst({ where: { organizationId: actor.organizationId, status: "Finalized", cutoffStart: { lte: existing.workDate }, cutoffEnd: { gte: existing.workDate } } });
    if (finalized) throw apiError("This schedule date is already included in finalized payroll.", 409);
    const auditLog = await prisma.$transaction(async (tx) => {
      await tx.payrollScheduleEntry.delete({ where: { id: existing.id } });
      return writeAudit(tx, request, { area: "Payroll", action: "Payroll schedule entry deleted", subjectType: "PayrollScheduleEntry", subjectId: existing.id, details: `${existing.type} on ${existing.workDate} was removed.`, beforeValues: existing });
    });
    response.json({ id: existing.id, auditLog });
  }));

  router.post("/rules", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const data = normalizeRule(request.body || {});
      if (!data.name || !data.role) throw apiError("Rule name and employee role are required.", 400);
      const { branchRecords } = await organizationStaff(prisma, actor.organizationId);
      if (data.branch !== "All branches" && !branchRecords.some((branch) => branch.name === data.branch)) throw apiError("Choose an organization branch.", 400);
      if (data.serviceId && !await prisma.service.findUnique({ where: { id: data.serviceId } })) throw apiError("Choose an available service.", 400);
      const duplicate = await prisma.commissionRule.findFirst({ where: { organizationId: actor.organizationId, role: data.role, serviceId: data.serviceId, branch: data.branch } });
      if (duplicate) throw apiError("A rule already exists for this role, service, and branch.", 409);
      const result = await prisma.$transaction(async (tx) => {
        const rule = await tx.commissionRule.create({ data: { organizationId: actor.organizationId, ...data, createdById: actor.id, createdBy: actor.name } });
        const auditLog = await writeAudit(tx, request, { area: "Payroll", action: "Commission rule created", subjectType: "CommissionRule", subjectId: rule.id, details: `${rule.name} was created for ${rule.role}.`, afterValues: rule });
        return { rule, auditLog };
      });
      response.status(201).json(result);
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.put("/rules/:id", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const existing = await prisma.commissionRule.findFirst({ where: { id: clean(request.params.id), organizationId: actor.organizationId } });
      if (!existing) throw apiError("Commission rule not found.", 404);
      const data = normalizeRule(request.body || {});
      if (!data.name || !data.role) throw apiError("Rule name and employee role are required.", 400);
      const { branchRecords } = await organizationStaff(prisma, actor.organizationId);
      if (data.branch !== "All branches" && !branchRecords.some((branch) => branch.name === data.branch)) throw apiError("Choose an organization branch.", 400);
      if (data.serviceId && !await prisma.service.findUnique({ where: { id: data.serviceId } })) throw apiError("Choose an available service.", 400);
      const duplicate = await prisma.commissionRule.findFirst({ where: { organizationId: actor.organizationId, role: data.role, serviceId: data.serviceId, branch: data.branch, id: { not: existing.id } } });
      if (duplicate) throw apiError("A rule already exists for this role, service, and branch.", 409);
      const result = await prisma.$transaction(async (tx) => {
        const rule = await tx.commissionRule.update({ where: { id: existing.id }, data });
        const auditLog = await writeAudit(tx, request, { area: "Payroll", action: "Commission rule updated", subjectType: "CommissionRule", subjectId: rule.id, details: `${rule.name} was updated.`, beforeValues: existing, afterValues: rule });
        return { rule, auditLog };
      });
      response.json(result);
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.post("/runs", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const cutoffStart = assertPayrollDate(request.body?.cutoffStart, "Cutoff start");
      const cutoffEnd = assertPayrollDate(request.body?.cutoffEnd, "Cutoff end");
      const payDate = assertPayrollDate(request.body?.payDate, "Pay date");
      payrollDateRange(cutoffStart, cutoffEnd);
      const branch = clean(request.body?.branch) || "All branches";
      const { branchRecords } = await organizationStaff(prisma, actor.organizationId);
      if (branch !== "All branches" && !branchRecords.some((item) => item.name === branch)) throw apiError("Choose an organization branch.", 400);
      const overlap = await prisma.payrollRun.findFirst({ where: { organizationId: actor.organizationId, branch, cutoffStart: { lte: cutoffEnd }, cutoffEnd: { gte: cutoffStart }, status: { in: ["Approved", "Finalized"] } } });
      if (overlap) throw apiError("This cutoff overlaps an approved or finalized payroll run for the same branch scope.", 409);
      const created = await prisma.payrollRun.create({ data: { organizationId: actor.organizationId, cutoffStart, cutoffEnd, payDate, branch, notes: clean(request.body?.notes).slice(0, 1000), createdById: actor.id, createdBy: actor.name } });
      const recalculated = await prisma.$transaction((tx) => recalculateRun(tx, created.id, actor), { timeout: 30_000 });
      const auditLog = await writeAudit(prisma, request, { area: "Payroll", action: "Payroll cutoff created", subjectType: "PayrollRun", subjectId: created.id, details: `${cutoffStart} to ${cutoffEnd} payroll was generated for ${branch}.`, afterValues: { cutoffStart, cutoffEnd, payDate, branch, status: "Draft" } });
      response.status(201).json({ run: serializeRun(recalculated), auditLog });
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.post("/runs/:id/recalculate", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const run = await prisma.$transaction((tx) => recalculateRun(tx, clean(request.params.id), actor), { timeout: 30_000 });
      const auditLog = await writeAudit(prisma, request, { area: "Payroll", action: "Payroll cutoff recalculated", subjectType: "PayrollRun", subjectId: run.id, details: `${run.cutoffStart} to ${run.cutoffEnd} payroll was recalculated from current attendance, schedules, commissions, and deductions.` });
      response.json({ run: serializeRun(run), auditLog });
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.post("/runs/:runId/lines/:lineId/adjustments", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    try {
      const run = await prisma.payrollRun.findFirst({ where: { id: clean(request.params.runId), organizationId: actor.organizationId }, include: { lines: true } });
      if (!run) throw apiError("Payroll run not found.", 404);
      if (run.status !== "Draft") throw apiError("Only Draft payroll can be adjusted.", 409);
      const line = run.lines.find((item) => item.id === clean(request.params.lineId));
      if (!line) throw apiError("Payroll employee line not found.", 404);
      const type = clean(request.body?.type);
      if (!payrollAdjustmentTypes.includes(type)) throw apiError("Adjustment type is invalid.", 400);
      const amount = numberValue(request.body?.amount, "Adjustment amount", { min: type.includes("Deduction") ? -1_000_000 : -1_000_000, max: 1_000_000 });
      const reason = clean(request.body?.reason).slice(0, 1000);
      if (!reason) throw apiError("Adjustment reason is required.", 400);
      const adjustment = await prisma.payrollAdjustment.create({ data: { payrollLineId: line.id, type, amount, reason, createdById: actor.id, createdBy: actor.name } });
      const recalculated = await prisma.$transaction((tx) => recalculateRun(tx, run.id, actor), { timeout: 30_000 });
      const auditLog = await writeAudit(prisma, request, { area: "Payroll", action: "Payroll adjustment added", subjectType: "PayrollAdjustment", subjectId: adjustment.id, details: `${type} of ${amount} was added to ${line.staffName}: ${reason}`, afterValues: adjustment });
      response.status(201).json({ adjustment, run: serializeRun(recalculated), auditLog });
    } catch (error) {
      throw payloadError(error, apiError);
    }
  }));

  router.delete("/runs/:runId/adjustments/:id", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    const run = await prisma.payrollRun.findFirst({ where: { id: clean(request.params.runId), organizationId: actor.organizationId } });
    if (!run) throw apiError("Payroll run not found.", 404);
    if (run.status !== "Draft") throw apiError("Only Draft payroll can be adjusted.", 409);
    const adjustment = await prisma.payrollAdjustment.findFirst({ where: { id: clean(request.params.id), payrollLine: { payrollRunId: run.id } } });
    if (!adjustment) { response.status(204).end(); return; }
    await prisma.payrollAdjustment.delete({ where: { id: adjustment.id } });
    const recalculated = await prisma.$transaction((tx) => recalculateRun(tx, run.id, actor), { timeout: 30_000 });
    const auditLog = await writeAudit(prisma, request, { area: "Payroll", action: "Payroll adjustment removed", subjectType: "PayrollAdjustment", subjectId: adjustment.id, details: `${adjustment.type} of ${adjustment.amount} was removed: ${adjustment.reason}`, beforeValues: adjustment });
    response.json({ id: adjustment.id, run: serializeRun(recalculated), auditLog });
  }));

  router.post("/runs/:id/status", asyncRoute(async (request, response) => {
    const actor = payrollActor(request, apiError);
    const targetStatus = clean(request.body?.status);
    if (!payrollRunStatuses.has(targetStatus)) throw apiError("Payroll status is invalid.", 400);
    let current = await prisma.payrollRun.findFirst({ where: { id: clean(request.params.id), organizationId: actor.organizationId }, include: runInclude });
    if (!current) throw apiError("Payroll run not found.", 404);
    const allowed = current.status === "Draft" ? ["Approved"] : current.status === "Approved" ? ["Draft", "Finalized"] : [];
    if (!allowed.includes(targetStatus)) throw apiError(`Payroll cannot move from ${current.status} to ${targetStatus}.`, 409);
    if (targetStatus === "Approved") {
      current = await prisma.$transaction((tx) => recalculateRun(tx, current.id, actor), { timeout: 30_000 });
      if (!current.lines.length) throw apiError("Generate at least one payroll employee line before approval.", 409);
      const unconfigured = current.lines.filter((line) => Number(line.basePay || 0) <= 0 && Number(line.grossPay || 0) <= 0);
      if (unconfigured.length) throw apiError(`Configure pay for: ${unconfigured.map((line) => line.staffName).join(", ")}.`, 409);
    }
    if (targetStatus === "Finalized") {
      const branchScope = current.branch === "All branches"
        ? {}
        : { OR: [{ branch: current.branch }, { branch: "All branches" }] };
      const overlap = await prisma.payrollRun.findFirst({ where: { id: { not: current.id }, organizationId: actor.organizationId, status: "Finalized", cutoffStart: { lte: current.cutoffEnd }, cutoffEnd: { gte: current.cutoffStart }, ...branchScope } });
      if (overlap) throw apiError("This cutoff overlaps an existing finalized payroll run.", 409);
    }
    const result = await prisma.$transaction(async (tx) => {
      const data = targetStatus === "Approved"
        ? { status: targetStatus, approvedById: actor.id, approvedBy: actor.name, approvedAt: new Date() }
        : targetStatus === "Finalized"
          ? { status: targetStatus, finalizedById: actor.id, finalizedBy: actor.name, finalizedAt: new Date() }
          : { status: "Draft", approvedById: "", approvedBy: "", approvedAt: null };
      const run = await tx.payrollRun.update({ where: { id: current.id }, data, include: runInclude });
      if (targetStatus === "Finalized") {
        const lineIds = run.lines.map((line) => line.id);
        await tx.payrollCommissionEarning.updateMany({ where: { payrollLineId: { in: lineIds }, status: "Pending" }, data: { status: "Included" } });
        await tx.payrollSalaryDeduction.updateMany({ where: { payrollLineId: { in: lineIds }, status: "Pending" }, data: { status: "Included" } });
      }
      const auditLog = await writeAudit(tx, request, { area: "Payroll", action: `Payroll ${targetStatus.toLowerCase()}`, subjectType: "PayrollRun", subjectId: run.id, details: `${run.cutoffStart} to ${run.cutoffEnd} payroll moved from ${current.status} to ${targetStatus}.`, beforeValues: { status: current.status }, afterValues: { status: targetStatus, totals: { gross: run.totalGross, deductions: run.totalDeductions, net: run.totalNet } } });
      return { run, auditLog };
    });
    response.json({ ...result, run: serializeRun(result.run) });
  }));

  return router;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const payrollScheduleTypes = Object.freeze([
  "Work Day",
  "Day Off",
  "Vacation Leave",
  "Emergency Leave",
  "Sick Leave",
  "Absent",
]);

export const payrollAdjustmentTypes = Object.freeze([
  "Incentive",
  "Commission Adjustment",
  "Salary Deduction Adjustment",
  "Other Deduction",
]);

function roundedMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function assertPayrollDate(value, label = "Date") {
  const date = String(value || "").trim();
  if (!isoDatePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}

export function payrollDateRange(startValue, endValue, maximumDays = 62) {
  const start = assertPayrollDate(startValue, "Cutoff start");
  const end = assertPayrollDate(endValue, "Cutoff end");
  const startAt = Date.parse(`${start}T00:00:00Z`);
  const endAt = Date.parse(`${end}T00:00:00Z`);
  if (endAt < startAt) throw new Error("Cutoff end cannot be before cutoff start.");
  const days = Math.floor((endAt - startAt) / 86_400_000) + 1;
  if (days > maximumDays) throw new Error(`A payroll cutoff cannot exceed ${maximumDays} days.`);
  return Array.from({ length: days }, (_, index) => new Date(startAt + index * 86_400_000).toISOString().slice(0, 10));
}

function approvedSchedule(entries) {
  return new Map((entries || [])
    .filter((entry) => entry?.status === "Approved")
    .map((entry) => [entry.workDate, entry]));
}

function attendanceByDate(records) {
  return new Map((records || []).map((record) => [record.workDate, record]));
}

function approvedOvertime(record) {
  if (!record || record.overtimeStatus !== "APPROVED") return 0;
  return Math.max(0, Number(record.approvedOvertimeMinutes || 0));
}

function scheduledMinutesFor(record, entry, standardMinutes) {
  if (Number(entry?.scheduledMinutes) > 0) return Number(entry.scheduledMinutes);
  if (record?.scheduledStart && record?.scheduledEnd) {
    const start = new Date(record.scheduledStart).getTime();
    const end = new Date(record.scheduledEnd).getTime();
    const duration = Math.round((end - start) / 60_000);
    if (Number.isFinite(duration) && duration > 0) return Math.min(duration, standardMinutes);
  }
  return standardMinutes;
}

function payrollRates(profile) {
  const monthlySalary = Math.max(0, Number(profile.monthlySalary || 0));
  const dailyRate = Math.max(0, Number(profile.dailyRate || (monthlySalary ? monthlySalary / Math.max(1, Number(profile.standardWorkDays || 26)) : 0)));
  const standardMinutes = Math.max(60, Number(profile.standardMinutesPerDay || 480));
  const hourlyRate = Math.max(0, Number(profile.hourlyRate || (dailyRate ? dailyRate / (standardMinutes / 60) : 0)));
  return {
    monthlySalary,
    dailyRate,
    hourlyRate,
    minuteRate: hourlyRate / 60,
    standardMinutes,
    periodsPerMonth: Math.max(1, Number(profile.periodsPerMonth || 2)),
    overtimeMultiplier: Math.max(1, Number(profile.overtimeMultiplier || 1.25)),
  };
}

export function calculatePayrollLine({
  profile,
  dates,
  attendanceRecords = [],
  scheduleEntries = [],
  incentives = 0,
  commissions = 0,
  salaryDeductions = 0,
  otherDeductions = 0,
}) {
  if (!profile) throw new Error("A payroll employee profile is required.");
  const workDays = new Set((profile.workDays || [1, 2, 3, 4, 5, 6]).map(Number));
  const attendance = attendanceByDate(attendanceRecords);
  const schedule = approvedSchedule(scheduleEntries);
  const rates = payrollRates(profile);
  const summary = {
    scheduledDays: 0,
    workedDays: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    undertimeMinutes: 0,
    absenceDays: 0,
    paidLeaveDays: 0,
    dayOffDays: 0,
  };
  const daily = [];

  for (const workDate of dates) {
    const entry = schedule.get(workDate);
    const record = attendance.get(workDate);
    const weekday = new Date(`${workDate}T00:00:00Z`).getUTCDay();
    const scheduledByDefault = workDays.has(weekday);
    const type = entry?.type || (scheduledByDefault ? "Work Day" : "Day Off");
    const scheduledMinutes = scheduledMinutesFor(record, entry, rates.standardMinutes);
    const row = { workDate, type, scheduledMinutes, regularMinutes: 0, overtimeMinutes: 0, undertimeMinutes: 0 };

    if (type === "Day Off") {
      summary.dayOffDays += 1;
    } else if (["Vacation Leave", "Emergency Leave", "Sick Leave"].includes(type)) {
      summary.scheduledDays += 1;
      if (entry?.paid) summary.paidLeaveDays += 1;
      else summary.absenceDays += 1;
    } else if (type === "Absent") {
      summary.scheduledDays += 1;
      summary.absenceDays += 1;
    } else {
      summary.scheduledDays += 1;
      if (!record?.timeIn) {
        summary.absenceDays += 1;
        row.type = "Absent";
      } else {
        const workedMinutes = Math.max(0, Number(record.workedMinutes || 0));
        row.regularMinutes = Math.min(workedMinutes, scheduledMinutes);
        row.overtimeMinutes = approvedOvertime(record);
        row.undertimeMinutes = Math.max(0, scheduledMinutes - row.regularMinutes);
        summary.regularMinutes += row.regularMinutes;
        summary.overtimeMinutes += row.overtimeMinutes;
        summary.undertimeMinutes += row.undertimeMinutes;
        summary.workedDays += Math.min(1, row.regularMinutes / scheduledMinutes);
      }
    }
    daily.push(row);
  }

  const payType = String(profile.payType || "Monthly");
  const absenceMinutes = summary.absenceDays * rates.standardMinutes;
  let basePay;
  if (payType === "Hourly") {
    basePay = (summary.regularMinutes + summary.paidLeaveDays * rates.standardMinutes) * rates.minuteRate;
  } else if (payType === "Daily") {
    basePay = (summary.workedDays + summary.paidLeaveDays) * rates.dailyRate;
  } else {
    const cutoffBase = rates.monthlySalary / rates.periodsPerMonth;
    basePay = Math.max(0, cutoffBase - (absenceMinutes + summary.undertimeMinutes) * rates.minuteRate);
  }
  const overtimePay = summary.overtimeMinutes * rates.minuteRate * rates.overtimeMultiplier;
  const normalizedIncentives = Math.max(0, Number(incentives || 0));
  const normalizedCommissions = Number(commissions || 0);
  const normalizedSalaryDeductions = Math.max(0, Number(salaryDeductions || 0));
  const normalizedOtherDeductions = Math.max(0, Number(otherDeductions || 0));
  const grossPay = basePay + overtimePay + normalizedIncentives + normalizedCommissions;
  const totalDeductions = normalizedSalaryDeductions + normalizedOtherDeductions;

  return {
    ...summary,
    basePay: roundedMoney(basePay),
    overtimePay: roundedMoney(overtimePay),
    incentives: roundedMoney(normalizedIncentives),
    commissions: roundedMoney(normalizedCommissions),
    salaryDeductions: roundedMoney(normalizedSalaryDeductions),
    otherDeductions: roundedMoney(normalizedOtherDeductions),
    grossPay: roundedMoney(grossPay),
    totalDeductions: roundedMoney(totalDeductions),
    netPay: roundedMoney(Math.max(0, grossPay - totalDeductions)),
    details: { payType, rates, daily },
  };
}

export function selectCommissionRule(rules, { role, serviceId, branch, sourceDate }) {
  return [...(rules || [])]
    .filter((rule) => rule.active !== false)
    .filter((rule) => rule.role === role)
    .filter((rule) => !rule.serviceId || rule.serviceId === serviceId)
    .filter((rule) => !rule.branch || rule.branch === "All branches" || rule.branch === branch)
    .filter((rule) => !rule.effectiveFrom || rule.effectiveFrom <= sourceDate)
    .filter((rule) => !rule.effectiveTo || rule.effectiveTo >= sourceDate)
    .sort((left, right) => (
      Number(Boolean(right.serviceId)) - Number(Boolean(left.serviceId))
      || Number(Boolean(right.branch && right.branch !== "All branches")) - Number(Boolean(left.branch && left.branch !== "All branches"))
      || Number(right.priority || 0) - Number(left.priority || 0)
    ))[0] || null;
}

export function calculateCommission(rule, { baseAmount, quantity = 1, discounted = false }) {
  if (!rule) return 0;
  const ruleType = discounted && rule.discountedRuleType ? rule.discountedRuleType : rule.ruleType;
  const value = discounted && rule.discountedRuleType ? rule.discountedValue : rule.value;
  if (ruleType === "Fixed amount") return roundedMoney(Math.max(0, Number(value || 0)) * Math.max(1, Number(quantity || 1)));
  return roundedMoney(Math.max(0, Number(baseAmount || 0)) * Math.max(0, Number(value || 0)) / 100);
}

export function payrollRunTotals(lines) {
  return (lines || []).reduce((totals, line) => ({
    totalGross: roundedMoney(totals.totalGross + Number(line.grossPay || 0)),
    totalDeductions: roundedMoney(totals.totalDeductions + Number(line.totalDeductions || 0)),
    totalNet: roundedMoney(totals.totalNet + Number(line.netPay || 0)),
  }), { totalGross: 0, totalDeductions: 0, totalNet: 0 });
}

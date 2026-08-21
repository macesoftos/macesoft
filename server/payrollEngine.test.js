import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCommission,
  calculatePayrollLine,
  payrollDateRange,
  payrollRunTotals,
  selectCommissionRule,
} from "./payrollEngine.js";

const monthlyProfile = {
  payType: "Monthly",
  monthlySalary: 26_000,
  standardWorkDays: 26,
  standardMinutesPerDay: 480,
  periodsPerMonth: 2,
  overtimeMultiplier: 1.25,
  workDays: [1, 2, 3, 4, 5, 6],
};

test("payroll cutoff ranges are inclusive and bounded", () => {
  assert.deepEqual(payrollDateRange("2026-08-01", "2026-08-03"), ["2026-08-01", "2026-08-02", "2026-08-03"]);
  assert.throws(() => payrollDateRange("2026-08-03", "2026-08-01"), /cannot be before/);
  assert.throws(() => payrollDateRange("2026-01-01", "2026-04-01"), /cannot exceed/);
});

test("monthly payroll deducts absence and undertime while paying approved overtime", () => {
  const result = calculatePayrollLine({
    profile: monthlyProfile,
    dates: ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"],
    attendanceRecords: [
      { workDate: "2026-08-03", branch: "Mace Bajada", timeIn: "2026-08-03T02:00:00Z", workedMinutes: 480, overtimeStatus: "APPROVED", approvedOvertimeMinutes: 60 },
      { workDate: "2026-08-04", timeIn: "2026-08-04T02:00:00Z", workedMinutes: 420, overtimeStatus: "NOT_APPLICABLE", approvedOvertimeMinutes: 0 },
    ],
    scheduleEntries: [
      { workDate: "2026-08-05", branch: "Mace Davao", type: "Sick Leave", paid: true, status: "Approved", scheduledMinutes: 480 },
      { workDate: "2026-08-06", type: "Day Off", paid: false, status: "Approved", scheduledMinutes: 480 },
    ],
    incentives: 500,
    commissions: 300,
    salaryDeductions: 1000,
    otherDeductions: 200,
  });

  assert.equal(result.scheduledDays, 3);
  assert.equal(result.workedDays, 1.875);
  assert.equal(result.paidLeaveDays, 1);
  assert.equal(result.dayOffDays, 1);
  assert.equal(result.undertimeMinutes, 60);
  assert.equal(result.overtimeMinutes, 60);
  assert.equal(result.details.daily.find((day) => day.workDate === "2026-08-03").branch, "Mace Bajada");
  assert.equal(result.details.daily.find((day) => day.workDate === "2026-08-05").branch, "Mace Davao");
  assert.equal(result.basePay, 12_875);
  assert.equal(result.overtimePay, 156.25);
  assert.equal(result.grossPay, 13_831.25);
  assert.equal(result.netPay, 12_631.25);
});

test("daily and hourly profiles pay only worked and paid-leave time", () => {
  const dates = ["2026-08-03", "2026-08-04"];
  const attendanceRecords = [{ workDate: "2026-08-03", timeIn: "2026-08-03T02:00:00Z", workedMinutes: 240 }];
  const scheduleEntries = [{ workDate: "2026-08-04", type: "Vacation Leave", paid: true, status: "Approved", scheduledMinutes: 480 }];
  const daily = calculatePayrollLine({ profile: { ...monthlyProfile, payType: "Daily", monthlySalary: 0, dailyRate: 800 }, dates, attendanceRecords, scheduleEntries });
  const hourly = calculatePayrollLine({ profile: { ...monthlyProfile, payType: "Hourly", monthlySalary: 0, hourlyRate: 100 }, dates, attendanceRecords, scheduleEntries });
  assert.equal(daily.basePay, 1_200);
  assert.equal(hourly.basePay, 1_200);
});

test("commission selection prioritizes a service and branch rule", () => {
  const rules = [
    { id: "default", active: true, role: "Nurse", branch: "All branches", serviceId: null, ruleType: "Percentage", value: 10, priority: 10 },
    { id: "nad", active: true, role: "Nurse", branch: "All branches", serviceId: "nad-100", ruleType: "Fixed amount", value: 1000, discountedRuleType: "Percentage", discountedValue: 10, priority: 100 },
    { id: "nad-bajada", active: true, role: "Nurse", branch: "Mace Bajada", serviceId: "nad-100", ruleType: "Fixed amount", value: 1200, priority: 100 },
  ];
  const rule = selectCommissionRule(rules, { role: "Nurse", serviceId: "nad-100", branch: "Mace Bajada", sourceDate: "2026-08-10" });
  assert.equal(rule.id, "nad-bajada");
});

test("commission calculation supports fixed, percentage, and discounted NAD rules", () => {
  const nad = { ruleType: "Fixed amount", value: 1000, discountedRuleType: "Percentage", discountedValue: 10 };
  assert.equal(calculateCommission(nad, { baseAmount: 15_000 }), 1000);
  assert.equal(calculateCommission(nad, { baseAmount: 8_000, discounted: true }), 800);
  assert.equal(calculateCommission({ ruleType: "Percentage", value: 5 }, { baseAmount: 2_000 }), 100);
});

test("payroll totals preserve centavo precision", () => {
  assert.deepEqual(payrollRunTotals([
    { grossPay: 1000.1, totalDeductions: 50.05, netPay: 950.05 },
    { grossPay: 2000.2, totalDeductions: 100.1, netPay: 1900.1 },
  ]), { totalGross: 3000.3, totalDeductions: 150.15, totalNet: 2850.15 });
});

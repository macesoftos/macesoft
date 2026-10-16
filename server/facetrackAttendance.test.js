import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { faceTrackInternals } from "./facetrackAttendance.js";

const policy = {
  timezone: "Asia/Manila",
  graceMinutes: 5,
  overtimeMinimumMinutes: 30,
  overtimeRequiresApproval: true,
};

test("averages three valid 128-value face descriptors", () => {
  const descriptors = [0.1, 0.2, 0.3].map((value) => Array(128).fill(value));
  const averaged = faceTrackInternals.averageDescriptors(descriptors);
  assert.equal(averaged.length, 128);
  assert.ok(Math.abs(averaged[0] - 0.2) < 1e-10);
});

test("rejects malformed face descriptors", () => {
  assert.throws(() => faceTrackInternals.averageDescriptors([Array(4).fill(0), Array(4).fill(0), Array(4).fill(0)]), /valid live face samples/);
});

test("calculates late minutes after grace period", () => {
  const record = {
    scheduledStart: new Date("2026-07-11T01:00:00.000Z"),
    scheduledEnd: new Date("2026-07-11T10:00:00.000Z"),
    timeIn: new Date("2026-07-11T01:17:00.000Z"),
    timeOut: new Date("2026-07-11T10:00:00.000Z"),
  };
  const result = faceTrackInternals.calculatedFields(record, policy);
  assert.equal(result.lateMinutes, 12);
  assert.equal(result.workedMinutes, 523);
  assert.equal(result.status, "COMPLETE");
});

test("marks qualifying overtime as pending approval", () => {
  const record = {
    scheduledStart: new Date("2026-07-11T01:00:00.000Z"),
    scheduledEnd: new Date("2026-07-11T10:00:00.000Z"),
    timeIn: new Date("2026-07-11T01:00:00.000Z"),
    timeOut: new Date("2026-07-11T10:45:00.000Z"),
  };
  const result = faceTrackInternals.calculatedFields(record, policy);
  assert.equal(result.calculatedOvertimeMinutes, 45);
  assert.equal(result.overtimeStatus, "PENDING_APPROVAL");
  assert.equal(result.approvedOvertimeMinutes, 0);
});

test("builds an overnight shift ending the next calendar day", () => {
  const schedule = faceTrackInternals.scheduleFor({ schedule: "10:00 PM - 6:00 AM" }, policy, new Date("2026-07-11T14:00:00.000Z"));
  assert.equal(schedule.workDate, "2026-07-11");
  assert.equal(schedule.scheduledStart.toISOString(), "2026-07-11T14:00:00.000Z");
  assert.equal(schedule.scheduledEnd.toISOString(), "2026-07-11T22:00:00.000Z");
});

test("face distance is zero for identical descriptors", () => {
  const descriptor = Array(128).fill(0.12);
  assert.equal(faceTrackInternals.euclideanDistance(descriptor, descriptor), 0);
});

test("selects one clear kiosk face match", () => {
  const match = faceTrackInternals.selectUniqueMatch([
    { id: "employee-a", descriptor: Array(128).fill(0.1) },
    { id: "employee-b", descriptor: Array(128).fill(0.3) },
  ], Array(128).fill(0.11), 0.5);
  assert.equal(match.id, "employee-a");
});

test("rejects an ambiguous kiosk face match", () => {
  assert.throws(() => faceTrackInternals.selectUniqueMatch([
    { id: "employee-a", descriptor: Array(128).fill(0.1) },
    { id: "employee-b", descriptor: Array(128).fill(0.102) },
  ], Array(128).fill(0.101), 0.5), /ambiguous/);
});

test("an employee account can only record a face match for its linked employee", () => {
  const account = {
    id: "account-1",
    staffId: "staff-1",
    name: "Employee One",
    role: "Employee",
    branch: "Mace Davao",
  };
  const employeeOne = { id: "staff-1", name: "Employee One", role: "Employee", branch: "Mace Davao" };
  const employeeTwo = { id: "staff-2", name: "Employee Two", role: "Employee", branch: "Mace Davao" };

  assert.equal(faceTrackInternals.scannerAccountCanRecordStaff(account, employeeOne), true);
  assert.equal(faceTrackInternals.scannerAccountCanRecordStaff(account, employeeTwo), false);
});

test("receptionist scanner accounts can record attendance for branch employees", () => {
  const receptionist = {
    id: "account-receptionist",
    staffId: "staff-receptionist",
    name: "Front Desk",
    role: "Receptionist",
    branch: "Mace Davao",
  };
  const employee = { id: "staff-2", name: "Employee Two", role: "Employee", branch: "Mace Davao" };

  assert.equal(faceTrackInternals.scannerAccountCanRecordStaff(receptionist, employee), true);
});

test("unlinked non-operator accounts cannot record attendance for an employee", () => {
  const account = { id: "account-1", name: "Employee One", role: "Employee", branch: "Mace Davao" };
  const employee = { id: "staff-2", name: "Employee Two", role: "Employee", branch: "Mace Davao" };

  assert.equal(faceTrackInternals.scannerAccountCanRecordStaff(account, employee), false);
});

test("the account scanner rejects another employee before writing attendance", () => {
  const source = readFileSync(new URL("./facetrackAttendance.js", import.meta.url), "utf8");
  const start = source.indexOf('router.post("/scanner/clock"');
  const end = source.indexOf('router.post("/kiosk/challenge"', start);
  const scannerClockRoute = source.slice(start, end);

  const identityGuard = scannerClockRoute.indexOf("scannerAccountCanRecordStaff(account, match.staff)");
  const attendanceWrite = scannerClockRoute.indexOf("recordVerifiedClock(prisma");
  assert.ok(identityGuard >= 0, "account scanner must enforce linked employee identity");
  assert.ok(attendanceWrite > identityGuard, "identity must be checked before attendance is written");
});

test("daily branch assignment accepts primary and additional staff branches", () => {
  assert.equal(faceTrackInternals.staffAssignedToBranch({ branch: "BGC", branches: "[]" }, "BGC"), true);
  assert.equal(faceTrackInternals.staffAssignedToBranch({ branch: "BGC", branches: '["Makati", "Alabang"]' }, "Makati"), true);
  assert.equal(faceTrackInternals.staffAssignedToBranch({ branch: "BGC", branches: "Makati, Alabang" }, "Alabang"), true);
  assert.equal(faceTrackInternals.staffAssignedToBranch({ branch: "BGC", branches: '["Makati"]' }, "Cebu"), false);
});

test("attendance scanner allows an authenticated account with FaceTrack branch access", () => {
  const source = readFileSync(new URL("./facetrackAttendance.js", import.meta.url), "utf8");
  const attendancePage = readFileSync(new URL("../src/facetrack/FaceTrackAttendance.jsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../prisma/migrations/20260821170000_one_facetrack_office_device/migration.sql", import.meta.url), "utf8");
  assert.match(source, /ORGANIZATION_MANAGER_ROLES, "Admin", "Branch Manager"/);
  assert.match(source, /router\.get\("\/scanner\/status"/);
  assert.match(source, /router\.post\("\/scanner\/challenge"/);
  assert.match(source, /router\.post\("\/scanner\/clock"/);
  assert.match(attendancePage, /facetrack-attendance/);
  assert.match(attendancePage, /canOpenScanner/);
  assert.match(source, /already has an active attendance iPad/);
  assert.match(migration, /CREATE UNIQUE INDEX "FaceTrackKioskDevice_one_active_per_branch_key"/);
  assert.match(migration, /WHERE "active" = true/);
  assert.match(source, /staffAssignedToBranch\(profile\.staff, device\.branch\)/);
  assert.match(source, /branch: device\.branch/);
});

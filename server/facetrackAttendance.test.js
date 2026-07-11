import assert from "node:assert/strict";
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

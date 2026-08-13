import test from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVED_ROOM_STATUS,
  activeRoomRecords,
  findRoomNameMatch,
  isUpcomingRoomAppointment,
  normalizeRoomName,
} from "./roomManagement.js";

test("room names are trimmed and repeated spaces are collapsed", () => {
  assert.equal(normalizeRoomName("  Laser   Treatment   Room  "), "Laser Treatment Room");
});

test("duplicate room matching is case insensitive within a branch list", () => {
  const rooms = [{ id: "room-1", name: "Consult Room", status: "Available" }];
  assert.equal(findRoomNameMatch(rooms, "  consult  ROOM ")?.id, "room-1");
});

test("archived rooms are removed from active scheduling lists", () => {
  assert.deepEqual(
    activeRoomRecords([
      { id: "active", name: "Consult Room", status: "Available" },
      { id: "archived", name: "Old Room", status: ARCHIVED_ROOM_STATUS },
    ]).map((room) => room.id),
    ["active"],
  );
});

test("future and still-running appointments block room archival", () => {
  const now = { date: "2026-08-14", minutes: 10 * 60 };
  assert.equal(isUpcomingRoomAppointment({ date: "2026-08-15", time: "08:00", duration: 15 }, now), true);
  assert.equal(isUpcomingRoomAppointment({ date: "2026-08-14", time: "09:45", duration: 30 }, now), true);
  assert.equal(isUpcomingRoomAppointment({ date: "2026-08-14", time: "08:00", duration: 30 }, now), false);
  assert.equal(isUpcomingRoomAppointment({ date: "2026-08-13", time: "18:00", duration: 60 }, now), false);
});

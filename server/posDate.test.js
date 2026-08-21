import assert from "node:assert/strict";
import test from "node:test";

import { POS_TIME_ZONE, posCalendarDate } from "./posDate.js";

test("POS uses the Manila calendar date after the UTC day boundary", () => {
  const justAfterPhilippineMidnight = new Date("2026-08-21T16:15:00.000Z");

  assert.equal(POS_TIME_ZONE, "Asia/Manila");
  assert.equal(justAfterPhilippineMidnight.toISOString().slice(0, 10), "2026-08-21");
  assert.equal(posCalendarDate(justAfterPhilippineMidnight), "2026-08-22");
});

test("POS calendar dates remain stable throughout the Philippine business day", () => {
  assert.equal(posCalendarDate(new Date("2026-08-22T01:00:00.000Z")), "2026-08-22");
  assert.equal(posCalendarDate(new Date("2026-08-22T15:59:59.999Z")), "2026-08-22");
  assert.equal(posCalendarDate(new Date("2026-08-22T16:00:00.000Z")), "2026-08-23");
});

test("POS calendar date rejects invalid Date values", () => {
  assert.throws(() => posCalendarDate(new Date("invalid")), /valid Date/);
});

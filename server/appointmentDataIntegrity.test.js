import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cardViewSource = appSource.match(/function CardViewModule[\s\S]*?\nfunction StaffAvailabilityModule/)?.[0] ?? "";

test("appointment details do not invent missing record values", () => {
  assert.doesNotMatch(appSource, /appointment\.appointmentType\s*\|\|\s*["']Treatment["']/);
  assert.doesNotMatch(appSource, /appointment\.timezone\s*\|\|\s*["']Asia\/Manila["']/);
  assert.doesNotMatch(appSource, /appointment\.packageName\s*\|\|\s*["']Pay per visit["']/);
});

test("appointment history contains only persisted payments and audit records", () => {
  assert.doesNotMatch(appSource, /title:\s*["']Booking created["']/);
  assert.doesNotMatch(appSource, /Latest appointment state/);
});

test("appointment details allow persisted doctor or staff reassignment", () => {
  assert.match(appSource, /aria-label="Reassign doctor or staff"/);
  assert.match(appSource, /onAssign=\{\(appointment, staffName\) => onUpdateAppointment/);
  assert.match(appSource, /staff: staffName \|\| "Any available"/);
  assert.match(appSource, /<option value="">Unassigned<\/option>/);
});

test("card view opens directly on API-backed filters and appointment records", () => {
  assert.doesNotMatch(cardViewSource, /card-view-kpi/);
  assert.doesNotMatch(cardViewSource, />Completion rate</);
  assert.doesNotMatch(cardViewSource, />Total Cards</);
  assert.match(cardViewSource, /useState\(todayDate\(\)\)/);
  assert.match(cardViewSource, /appointment\.date === date/);
  assert.doesNotMatch(cardViewSource, /!date \|\| appointment\.date === date/);
  assert.match(appSource, /<CardViewModule[\s\S]*?branchRecords=\{branchRecords\}/);
  assert.doesNotMatch(cardViewSource, /uniqueRoomsFromBranches/);
});

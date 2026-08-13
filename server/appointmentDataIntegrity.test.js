import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("appointment details do not invent missing record values", () => {
  assert.doesNotMatch(appSource, /appointment\.appointmentType\s*\|\|\s*["']Treatment["']/);
  assert.doesNotMatch(appSource, /appointment\.timezone\s*\|\|\s*["']Asia\/Manila["']/);
  assert.doesNotMatch(appSource, /appointment\.packageName\s*\|\|\s*["']Pay per visit["']/);
});

test("appointment history contains only persisted payments and audit records", () => {
  assert.doesNotMatch(appSource, /title:\s*["']Booking created["']/);
  assert.doesNotMatch(appSource, /Latest appointment state/);
});

test("card view opens directly on API-backed filters and appointment records", () => {
  assert.doesNotMatch(appSource, /card-view-kpi/);
  assert.doesNotMatch(appSource, />Completion rate</);
  assert.doesNotMatch(appSource, />Total Cards</);
});

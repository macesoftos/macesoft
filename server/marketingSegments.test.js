import assert from "node:assert/strict";
import test from "node:test";
import { marketingClientMatchesSegment } from "./marketingSegments.js";

const now = new Date("2026-08-22T12:00:00Z");

test("due-session audiences include upcoming and overdue recommended visits", () => {
  assert.equal(marketingClientMatchesSegment({ nextVisit: "2026-08-29" }, "Due for next session", now), true);
  assert.equal(marketingClientMatchesSegment({ nextVisit: "2026-08-01" }, "Due for next session", now), true);
  assert.equal(marketingClientMatchesSegment({ nextVisit: "2026-08-30" }, "Due for next session", now), false);
  assert.equal(marketingClientMatchesSegment({ nextVisit: "" }, "Due for next session", now), false);
});

test("active-client audiences require a recent visit and exclude inactive clients", () => {
  assert.equal(marketingClientMatchesSegment({ lastVisit: "2026-08-10", retention: "Returning" }, "Active clients", now), true);
  assert.equal(marketingClientMatchesSegment({ lastVisit: "2026-08-10", retention: "Inactive" }, "Active clients", now), false);
  assert.equal(marketingClientMatchesSegment({ lastVisit: "2026-04-01", retention: "Returning" }, "Active clients", now), false);
});

test("existing audience rules remain precise", () => {
  assert.equal(marketingClientMatchesSegment({ lastVisit: "2026-06-20" }, "Inactive 60 days", now), true);
  assert.equal(marketingClientMatchesSegment({ retention: "Returning" }, "Returning clients", now), true);
  assert.equal(marketingClientMatchesSegment({ retention: "New" }, "Returning clients", now), false);
});

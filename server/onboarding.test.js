import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ONBOARDING_TOUR_VERSION,
  buildOnboardingChecklist,
  onboardingRoleKind,
  safeOnboardingStep,
} from "./onboarding.js";

test("onboarding role groups distinguish owners, managers, and staff", () => {
  assert.equal(onboardingRoleKind("Owner"), "owner");
  assert.equal(onboardingRoleKind("Branch Manager"), "manager");
  assert.equal(onboardingRoleKind("Receptionist"), "staff");
  assert.equal(ONBOARDING_TOUR_VERSION, 1);
});

test("checklist exposes only permitted destinations and reports progress", () => {
  const checklist = buildOnboardingChecklist({
    modules: ["overview", "appointments", "clients"],
    signals: { client: true, appointmentInProgress: true },
  });
  assert.deepEqual(checklist.items.map((item) => item.id), ["client", "appointment"]);
  assert.equal(checklist.items[0].status, "Complete");
  assert.equal(checklist.items[1].status, "In progress");
  assert.equal(checklist.completed, 1);
  assert.equal(checklist.total, 2);
  assert.equal(checklist.percentage, 50);
});

test("tour step persistence clamps invalid values", () => {
  assert.equal(safeOnboardingStep(-2), 0);
  assert.equal(safeOnboardingStep("7"), 7);
  assert.equal(safeOnboardingStep(200), 20);
  assert.equal(safeOnboardingStep("not-a-step"), 0);
});

test("migration backfills existing accounts as returning users", () => {
  const migration = readFileSync("prisma/migrations/20260826120000_first_login_onboarding/migration.sql", "utf8");
  assert.match(migration, /INSERT INTO "OnboardingProgress"/);
  assert.match(migration, /"dismissedAt"/);
  assert.match(migration, /FROM "Account"/);
});

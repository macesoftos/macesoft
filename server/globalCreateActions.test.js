import test from "node:test";
import assert from "node:assert/strict";
import { getGlobalCreateActions, globalActionsByModule } from "../src/config/globalActions.js";

const everyModule = [
  "appointments", "clients", "leads", "services", "treatments", "packages", "staff", "branches",
  "inventory", "expenses", "sms",
];

test("appointments exposes the two existing creation flows", () => {
  const actions = getGlobalCreateActions({
    moduleId: "appointments",
    sessionModules: everyModule,
    context: { appointmentDate: "2026-08-14" },
  });

  assert.deepEqual(actions.map((action) => action.label), ["New appointment", "New client"]);
  assert.deepEqual(actions[0].payload, { status: "Draft", date: "2026-08-14" });
});
test("route actions are hidden when the account lacks the required module", () => {
  const actions = getGlobalCreateActions({ moduleId: "appointments", sessionModules: ["appointments"] });
  assert.deepEqual(actions.map((action) => action.id), ["appointment"]);
});

test("branch creation requires organization management permission", () => {
  assert.deepEqual(
    getGlobalCreateActions({ moduleId: "branches", sessionModules: ["branches"] }),
    [],
  );
  assert.equal(
    getGlobalCreateActions({
      moduleId: "branches",
      sessionModules: ["branches"],
      canManageOrganization: true,
    })[0].handler,
    "branch-create",
  );
});

test("unsupported routes do not invent creation actions", () => {
  for (const moduleId of ["applications", "booking", "facetrack-attendance", "reports", "settings", "support"]) {
    assert.equal(globalActionsByModule[moduleId], undefined);
    assert.deepEqual(getGlobalCreateActions({ moduleId, sessionModules: everyModule }), []);
  }
});

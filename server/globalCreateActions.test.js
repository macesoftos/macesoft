import test from "node:test";
import assert from "node:assert/strict";
import { getGlobalCreateActions, globalActionsByModule } from "../src/config/globalActions.js";

const everyModule = [
  "appointments", "clients", "leads", "services", "treatments", "packages", "staff", "branches",
  "inventory", "expenses", "sms", "room-view",
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

test("inventory exposes all item, stock, and CSV actions in order", () => {
  const actions = getGlobalCreateActions({
    moduleId: "inventory",
    sessionModules: ["inventory"],
  });

  assert.deepEqual(actions.map((action) => action.label), ["New inventory item", "Receive stock", "Import CSV", "Export CSV"]);
  assert.deepEqual(actions.map((action) => action.modal), ["inventory", "inventory-receive", undefined, undefined]);
  assert.deepEqual(actions.map((action) => action.handler), [undefined, undefined, "inventory-import", "inventory-export"]);
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

test("room view adds room creation only for room managers", () => {
  assert.deepEqual(
    getGlobalCreateActions({
      moduleId: "room-view",
      sessionModules: ["appointments", "room-view"],
    }).map((action) => action.id),
    ["appointment"],
  );
  const actions = getGlobalCreateActions({
    moduleId: "room-view",
    sessionModules: ["appointments", "room-view"],
    canManageOrganization: true,
    context: { roomBranch: "Mace Davao" },
  });
  assert.deepEqual(actions.map((action) => action.label), ["New appointment", "New room"]);
  assert.deepEqual(actions[1].payload, { branch: "Mace Davao" });
});

test("unsupported routes do not invent creation actions", () => {
  for (const moduleId of ["applications", "booking", "facetrack-attendance", "reports", "settings", "support"]) {
    assert.equal(globalActionsByModule[moduleId], undefined);
    assert.deepEqual(getGlobalCreateActions({ moduleId, sessionModules: everyModule }), []);
  }
});

test("invite user appears only with explicit invitation authority", () => {
  assert.deepEqual(
    getGlobalCreateActions({ moduleId: "staff", sessionModules: ["staff"] }).map((action) => action.id),
    ["staff"],
  );
  assert.deepEqual(
    getGlobalCreateActions({ moduleId: "staff", sessionModules: ["staff"], canInviteUsers: true }).map((action) => action.id),
    ["invite", "staff"],
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { assertDiscountUsable, assertPackageOwnedByClient, inventoryWhereForBranch } from "./posSecurity.js";

const items = [{ type: "Service" }, { type: "Product" }];
const today = new Date("2026-08-14T00:00:00.000Z");

test("inventory selection is constrained to the sale branch or shared inventory", () => {
  assert.deepEqual(inventoryWhereForBranch("inv-1", "Davao"), {
    id: "inv-1",
    OR: [{ branch: "Davao" }, { branch: "All branches" }],
  });
});

test("discount permissions and expiration fail closed", () => {
  const discount = { name: "VIP", active: true, permission: "Branch Manager", applicable: "Selected clients", expiry: "2026-12-31" };
  assert.throws(() => assertDiscountUsable(discount, { role: "Cashier", client: { id: "client-1" }, items, today }), /requires Branch Manager approval/);
  assert.doesNotThrow(() => assertDiscountUsable(discount, { role: "Branch Manager", client: { id: "client-1" }, items, today }));
  assert.throws(() => assertDiscountUsable({ ...discount, expiry: "2026-08-13" }, { role: "Branch Manager", client: { id: "client-1" }, items, today }), /expired/);
});

test("birthday discounts require a stable client in the current birthday month", () => {
  const discount = { name: "Birthday", active: true, permission: "Receptionist", applicable: "Birthday month", expiry: "None" };
  assert.doesNotThrow(() => assertDiscountUsable(discount, { role: "Receptionist", client: { id: "client-1", birthday: "1990-08-22" }, items, today }));
  assert.throws(() => assertDiscountUsable(discount, { role: "Receptionist", client: { id: "client-1", birthday: "1990-09-22" }, items, today }), /birthday month/);
});

test("package tender is bound to the selected client", () => {
  assert.doesNotThrow(() => assertPackageOwnedByClient({ name: "Glow", clientId: "client-1" }, "client-1"));
  assert.throws(() => assertPackageOwnedByClient({ name: "Glow", clientId: "client-2" }, "client-1"), /another client/);
  assert.throws(() => assertPackageOwnedByClient({ name: "Glow", clientId: "client-1" }, ""), /Select the client/);
});

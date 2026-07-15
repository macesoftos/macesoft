import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGiftCertificateUsable,
  assertPackageRedeemable,
  giftCertificateAfterPayment,
  isExpired,
  packageAfterRedemption,
  packageAfterVoid,
} from "./posTenders.js";

const today = new Date("2026-07-15T10:00:00");

function certificate(overrides = {}) {
  return {
    id: "gc1",
    code: "GC-1001",
    client: "Maria Santos",
    branch: "All branches",
    balance: 2000,
    expires: "",
    status: "Active",
    ...overrides,
  };
}

function clinicPackage(overrides = {}) {
  return {
    id: "pk1",
    name: "Laser 6-Session",
    client: "Maria Santos",
    sessions: 6,
    used: 2,
    expires: "",
    branch: "Makati",
    transferable: false,
    status: "Active",
    ...overrides,
  };
}

test("an active gift certificate covers a charge within its balance", () => {
  assert.doesNotThrow(() => assertGiftCertificateUsable(certificate(), { branch: "Makati", amount: 1500, today }));
});

test("a gift certificate charge above the balance is rejected", () => {
  assert.throws(
    () => assertGiftCertificateUsable(certificate({ balance: 500 }), { branch: "Makati", amount: 800, today }),
    /only has 500 remaining/,
  );
});

test("expired gift certificates are rejected but same-day expiry still works", () => {
  assert.throws(
    () => assertGiftCertificateUsable(certificate({ expires: "2026-07-14" }), { branch: "Makati", amount: 100, today }),
    /expired on 2026-07-14/,
  );
  assert.doesNotThrow(() => assertGiftCertificateUsable(certificate({ expires: "2026-07-15" }), { branch: "Makati", amount: 100, today }));
  assert.equal(isExpired("", today), false);
});

test("gift certificates bound to another branch are rejected", () => {
  assert.throws(
    () => assertGiftCertificateUsable(certificate({ branch: "BGC" }), { branch: "Makati", amount: 100, today }),
    /only valid at BGC/,
  );
});

test("used or missing gift certificates are rejected", () => {
  assert.throws(() => assertGiftCertificateUsable(certificate({ status: "Used" }), { branch: "Makati", amount: 100, today }), /is Used/);
  assert.throws(() => assertGiftCertificateUsable(null, { branch: "Makati", amount: 100, today }), /not found/);
});

test("a gift certificate is marked Used when its balance is depleted", () => {
  assert.deepEqual(giftCertificateAfterPayment(certificate({ balance: 500 }), 500), { balance: 0, status: "Used" });
  assert.deepEqual(giftCertificateAfterPayment(certificate({ balance: 500 }), 200), { balance: 300, status: "Active" });
});

test("an active package with remaining sessions is redeemable at its branch", () => {
  assert.doesNotThrow(() => assertPackageRedeemable(clinicPackage(), { branch: "Makati", today }));
});

test("exhausted, expired, or cancelled packages are rejected", () => {
  assert.throws(() => assertPackageRedeemable(clinicPackage({ used: 6 }), { branch: "Makati", today }), /no remaining sessions/);
  assert.throws(() => assertPackageRedeemable(clinicPackage({ expires: "2026-06-30" }), { branch: "Makati", today }), /expired on 2026-06-30/);
  assert.throws(() => assertPackageRedeemable(clinicPackage({ status: "Cancelled" }), { branch: "Makati", today }), /is Cancelled/);
});

test("branch-bound packages only redeem at their branch unless transferable", () => {
  assert.throws(() => assertPackageRedeemable(clinicPackage(), { branch: "BGC", today }), /only valid at Makati/);
  assert.doesNotThrow(() => assertPackageRedeemable(clinicPackage({ transferable: true }), { branch: "BGC", today }));
  assert.doesNotThrow(() => assertPackageRedeemable(clinicPackage({ branch: "All branches" }), { branch: "BGC", today }));
});

test("redeeming the final session completes the package and voiding restores it", () => {
  assert.deepEqual(packageAfterRedemption(clinicPackage({ used: 5 })), { used: 6, status: "Completed" });
  assert.deepEqual(packageAfterRedemption(clinicPackage({ used: 2 })), { used: 3, status: "Active" });
  assert.deepEqual(packageAfterVoid(clinicPackage({ used: 6, status: "Completed" })), { used: 5, status: "Active" });
  assert.deepEqual(packageAfterVoid(clinicPackage({ used: 0 })), { used: 0, status: "Active" });
});

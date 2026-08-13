import test from "node:test";
import assert from "node:assert/strict";
import { normalizePaymentReference } from "./paymentReference.js";

test("payment references are normalized for durable receipt storage", () => {
  assert.equal(normalizePaymentReference("  GCash\n  AB-123  "), "GCash AB-123");
});

test("payment references remain optional and length limited", () => {
  assert.equal(normalizePaymentReference(undefined), "");
  assert.equal(normalizePaymentReference("x".repeat(140)).length, 120);
});

import test from "node:test";
import assert from "node:assert/strict";
import { publicFlipbookState, validatePdfBuffer } from "./flipbooks.js";

test("PDF validation checks signature, completion marker, and upload size", () => {
  const valid = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
  assert.equal(validatePdfBuffer(valid, 1024), valid);
  assert.throws(() => validatePdfBuffer(Buffer.from("not a pdf"), 1024), /valid PDF/);
  assert.throws(() => validatePdfBuffer(Buffer.from("%PDF-1.7\nmissing trailer"), 1024), /incomplete or damaged/);
  assert.throws(() => validatePdfBuffer(valid, 4), /0 MB or smaller/);
});

test("public flipbook state enforces publication, disablement, and expiration", () => {
  const now = new Date("2026-08-14T08:00:00.000Z");
  const available = { status: "Published", publicToken: "token", publicEnabled: true, expiresAt: null };
  assert.equal(publicFlipbookState(available, now), "available");
  assert.equal(publicFlipbookState({ ...available, status: "Draft" }, now), "not-found");
  assert.equal(publicFlipbookState({ ...available, publicEnabled: false }, now), "disabled");
  assert.equal(publicFlipbookState({ ...available, expiresAt: new Date("2026-08-14T07:59:59.000Z") }, now), "expired");
});

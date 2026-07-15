import test from "node:test";
import assert from "node:assert/strict";
import { normalizePemCertificates } from "./databaseTls.js";

const certificateBody = "A".repeat(70);
const standardPem = [
  "-----BEGIN CERTIFICATE-----",
  certificateBody.slice(0, 64),
  certificateBody.slice(64),
  "-----END CERTIFICATE-----",
].join("\n");

test("normalizes a PEM certificate whose line breaks were stripped", () => {
  const compactPem = standardPem.replace(/\n/g, "");
  assert.equal(normalizePemCertificates(compactPem), standardPem);
});

test("normalizes escaped newlines and preserves certificate chains", () => {
  const escapedChain = `${standardPem}\\n${standardPem}`.replace(/\n/g, "\\n");
  assert.equal(normalizePemCertificates(escapedChain), `${standardPem}\n${standardPem}`);
});

test("returns an unrecognized CA value unchanged", () => {
  assert.equal(normalizePemCertificates("custom-ca-value"), "custom-ca-value");
});

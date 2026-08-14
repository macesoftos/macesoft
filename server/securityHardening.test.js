import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const faceTrackSource = readFileSync(new URL("./facetrackAttendance.js", import.meta.url), "utf8");
const flipbookSource = readFileSync(new URL("./flipbooks.js", import.meta.url), "utf8");

test("webhook duplicate matching and responses stay branch-scoped and opaque", () => {
  assert.match(serverSource, /detectLeadDuplicate\(tx, normalized, routing\.branch\)/);
  assert.match(serverSource, /where: \{\s*branch,\s*OR:/);
  const route = serverSource.match(/app\.post\("\/api\/leads\/webhooks\/:provider"[\s\S]*?\}\)\);/)?.[0] ?? "";
  assert.doesNotMatch(route, /json\(result\)/);
  assert.doesNotMatch(route, /lead:/);
});

test("invitation and FaceTrack challenge claims are conditional single-use updates", () => {
  assert.match(serverSource, /acceptedClaim = await tx\.userInvitation\.updateMany/);
  assert.match(serverSource, /status: "Pending",\s*revokedAt: null,\s*expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(faceTrackSource, /faceTrackChallenge\.updateMany/);
  assert.match(faceTrackSource, /usedAt: null, expiresAt: \{ gt: new Date\(\) \}/);
  assert.match(faceTrackSource, /const account = requireAdmin\(request\);\s*const staffId = clean\(request\.body\?\.staffId\)/);
});

test("flipbook analytics ignore caller-supplied viewer identifiers", () => {
  assert.doesNotMatch(flipbookSource, /x-flipbook-viewer/i);
  assert.match(flipbookSource, /request\.ip \|\| request\.socket\?\.remoteAddress/);
});

test("POS checkout uses conditional inventory and prepaid-tender mutations", () => {
  assert.match(serverSource, /inventoryItem\.updateMany\([\s\S]*?stock: \{ gte: deduction\.qty \}/);
  assert.match(serverSource, /giftCertificate\.updateMany/);
  assert.match(serverSource, /clinicPackage\.updateMany/);
  assert.match(serverSource, /assertPackageOwnedByClient\(pkg, draft\.clientId\)/);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  marketingAudienceMemberAsClient,
  marketingAudienceMemberMatchesSegment,
  normalizeMarketingAudienceEmail,
  normalizeMarketingAudienceMember,
} from "./marketingAudienceMembers.js";

test("marketing audience members normalize email, name, and branch data", () => {
  const member = normalizeMarketingAudienceMember({
    email: "  JANE.DOE@Example.COM ",
    audience: "VIP",
    branch: "Mace Davao",
  });

  assert.deepEqual(member, {
    email: "jane.doe@example.com",
    name: "Jane Doe",
    audience: "VIP",
    branch: "Mace Davao",
    source: "Manual",
  });
  assert.equal(normalizeMarketingAudienceEmail("not-an-email"), "");
});

test("marketing audience members require a saved audience and concrete branch", () => {
  assert.throws(
    () => normalizeMarketingAudienceMember({ email: "jane@example.com", audience: "Unknown", branch: "Mace Davao" }),
    /valid saved audience/i,
  );
  assert.throws(
    () => normalizeMarketingAudienceMember({ email: "jane@example.com", audience: "VIP", branch: "All branches" }),
    /clinic branch/i,
  );
});

test("all consented includes every manual member while saved audiences remain exact", () => {
  const member = { id: "member-1", name: "Jane", email: "jane@example.com", audience: "VIP", branch: "Mace Davao" };

  assert.equal(marketingAudienceMemberMatchesSegment(member, "All consented clients"), true);
  assert.equal(marketingAudienceMemberMatchesSegment(member, "VIP"), true);
  assert.equal(marketingAudienceMemberMatchesSegment(member, "New clients"), false);
  assert.deepEqual(marketingAudienceMemberAsClient(member), {
    id: "member-1",
    fullName: "Jane",
    email: "jane@example.com",
    mobile: "",
    branch: "Mace Davao",
    marketingOptIn: true,
    source: "Manual",
    audience: "VIP",
    audienceMember: true,
  });
});

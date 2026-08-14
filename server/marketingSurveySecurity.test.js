import assert from "node:assert/strict";
import test from "node:test";

import {
  createMarketingSurveyToken,
  marketingSurveyResponseId,
  verifyMarketingSurveyToken,
} from "./marketingSurveySecurity.js";

const secret = "a-secure-domain-separated-key";

test("survey tokens hide the email and bind the campaign and expiry", () => {
  const token = createMarketingSurveyToken({
    campaignId: "campaign-1",
    recipient: "person@example.ph",
    secret,
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  assert.equal(token.includes("person@example.ph"), false);
  const verified = verifyMarketingSurveyToken(token, { campaignId: "campaign-1", secret, now: new Date("2026-08-14T00:00:00.000Z") });
  assert.equal(verified.campaignId, "campaign-1");
  assert.ok(verified.recipientId.length > 20);
  assert.throws(() => verifyMarketingSurveyToken(token, { campaignId: "campaign-2", secret, now: new Date("2026-08-14T00:00:00.000Z") }), /invalid/);
  assert.throws(() => verifyMarketingSurveyToken(token, { campaignId: "campaign-1", secret, now: new Date("2026-09-01T00:00:00.000Z") }), /expired/);
});

test("survey response IDs are deterministic per campaign, block, and recipient", () => {
  const input = { campaignId: "campaign-1", blockId: "survey-1", recipientId: "recipient-1" };
  assert.equal(marketingSurveyResponseId(input), marketingSurveyResponseId(input));
  assert.notEqual(marketingSurveyResponseId(input), marketingSurveyResponseId({ ...input, blockId: "survey-2" }));
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  isLegacySmsHash,
  isMarketingHash,
  marketingHash,
  marketingRouteFromHash,
  marketingSectionFromHash,
} from "../src/marketing/routes.js";

test("Marketing routes expose the approved canonical workspace URLs", () => {
  assert.equal(marketingHash(), "#/marketing");
  assert.equal(marketingHash("campaigns"), "#/marketing/campaigns");
  assert.equal(marketingHash("campaigns", "deleted"), "#/marketing/campaigns/deleted");
  assert.equal(marketingHash("templates"), "#/marketing/templates");
  assert.equal(marketingHash("audiences"), "#/marketing/audiences");
  assert.equal(marketingHash("automations"), "#/marketing/automations");
  assert.equal(marketingHash("reports"), "#/marketing/reports");
  assert.equal(marketingHash("settings"), "#/marketing/settings");
});

test("Marketing route parsing supports the workspace, campaign builder, and Deleted page", () => {
  assert.deepEqual(marketingRouteFromHash("#/marketing"), { section: "overview", mode: "index" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns"), { section: "campaigns", mode: "index" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns/new"), { section: "campaigns", mode: "create" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns/deleted"), { section: "campaigns", mode: "deleted" });
  assert.equal(marketingSectionFromHash("#/marketing/reports"), "reports");
  assert.equal(isMarketingHash("#/marketing/settings"), true);
  assert.equal(isMarketingHash("#/sms"), false);
});

test("the legacy SMS URL is detected without treating it as canonical", () => {
  assert.equal(isLegacySmsHash("#/sms"), true);
  assert.equal(isLegacySmsHash("#sms"), true);
  assert.equal(isLegacySmsHash("#/marketing"), false);
  assert.equal(isLegacySmsHash("#/sms/templates"), false);
});

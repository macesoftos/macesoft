import assert from "node:assert/strict";
import test from "node:test";

import {
  isLegacySmsHash,
  isMarketingHash,
  marketingHash,
  marketingPath,
  marketingRouteFromHash,
  marketingRouteFromPath,
  marketingSectionFromHash,
} from "../src/marketing/routes.js";

test("Marketing routes expose the approved canonical workspace URLs", () => {
  assert.equal(marketingPath(), "/marketing");
  assert.equal(marketingPath("campaigns"), "/marketing/campaigns");
  assert.equal(marketingPath("campaigns", "new"), "/marketing/campaigns");
  assert.equal(marketingPath("campaigns", "create"), "/marketing/campaigns/new");
  assert.equal(marketingPath("campaigns", "deleted"), "/marketing/campaigns/deleted");
  assert.equal(marketingPath("templates"), "/marketing/templates");
  assert.equal(marketingPath("audiences"), "/marketing/audiences");
  assert.equal(marketingPath("automations"), "/marketing/automations");
  assert.equal(marketingPath("media"), "/marketing/media");
  assert.equal(marketingPath("reports"), "/marketing/reports");
  assert.equal(marketingPath("settings"), "/marketing/settings");
});

test("Marketing route parsing supports the workspace, campaign builder, and Deleted page", () => {
  assert.deepEqual(marketingRouteFromPath("/marketing"), { section: "overview", mode: "index" });
  assert.deepEqual(marketingRouteFromPath("/marketing/campaigns"), { section: "campaigns", mode: "index" });
  assert.deepEqual(marketingRouteFromPath("/marketing/campaigns/new"), { section: "campaigns", mode: "create" });
  assert.deepEqual(marketingRouteFromPath("/marketing/campaigns/deleted"), { section: "campaigns", mode: "deleted" });
  assert.deepEqual(marketingRouteFromPath("/marketing/media"), { section: "media", mode: "index" });
  assert.equal(marketingRouteFromPath("/appointments"), null);
});

test("legacy Marketing hashes remain readable for redirects", () => {
  assert.deepEqual(marketingRouteFromHash("#/marketing"), { section: "overview", mode: "index" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns"), { section: "campaigns", mode: "index" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns/new"), { section: "campaigns", mode: "create" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/campaigns/deleted"), { section: "campaigns", mode: "deleted" });
  assert.deepEqual(marketingRouteFromHash("#/marketing/media"), { section: "media", mode: "index" });
  assert.equal(marketingSectionFromHash("#/marketing/reports"), "reports");
  assert.equal(isMarketingHash("#/marketing/settings"), true);
  assert.equal(isMarketingHash("#/sms"), false);
  assert.equal(marketingHash("campaigns", "create"), "#/marketing/campaigns/new");
});

test("the legacy SMS URL is detected without treating it as canonical", () => {
  assert.equal(isLegacySmsHash("#/sms"), true);
  assert.equal(isLegacySmsHash("#sms"), true);
  assert.equal(isLegacySmsHash("#/marketing"), false);
  assert.equal(isLegacySmsHash("#/sms/templates"), false);
});

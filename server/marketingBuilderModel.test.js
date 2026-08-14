import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneEmailBlockWithIds,
  createEmailBlock,
  normalizeEmailBlock,
  validMarketingUrl,
} from "../src/marketing/builderModel.js";
import { buildVisualEmailHtml } from "../src/marketing/emailHtml.js";

let sequence = 0;
const createId = (type) => `${type}-${++sequence}`;
const layouts = [{ type: "layout-2", widths: [1, 1] }];

test("legacy Product content migrates into independent editable fields", () => {
  const product = normalizeEmailBlock({
    id: "legacy-product",
    type: "product",
    content: "Hydrodermabrasion\nDeep cleansing and hydration.",
    category: "MACE TREATMENT",
    link: "https://macebydrmace.com/treatments/hydrodermabrasion",
  }, createId, layouts);

  assert.equal(product.category, "MACE TREATMENT");
  assert.equal(product.title, "Hydrodermabrasion");
  assert.equal(product.description, "Deep cleansing and hydration.");
  assert.equal(product.ctaUrl, "https://macebydrmace.com/treatments/hydrodermabrasion");
});

test("duplicating a nested design creates independent IDs and collections", () => {
  const layout = createEmailBlock("layout-2", createId, layouts);
  layout.columns[0].push(createEmailBlock("survey", createId, layouts));
  layout.columns[1].push(createEmailBlock("social", createId, layouts));
  const duplicate = cloneEmailBlockWithIds(layout, createId);

  assert.notEqual(duplicate.id, layout.id);
  assert.notEqual(duplicate.columns[0][0].id, layout.columns[0][0].id);
  assert.notEqual(duplicate.columns[0][0].choices[0].id, layout.columns[0][0].choices[0].id);
  assert.notEqual(duplicate.columns[1][0].items[0].id, layout.columns[1][0].items[0].id);
  duplicate.columns[0][0].choices[0].label = "Changed";
  assert.notEqual(duplicate.columns[0][0].choices[0].label, layout.columns[0][0].choices[0].label);
});

test("Marketing destinations allow safe schemes and reject executable URLs", () => {
  assert.equal(validMarketingUrl("https://macebydrmace.com/book"), true);
  assert.equal(validMarketingUrl("/api/uploads/image-1"), true);
  assert.equal(validMarketingUrl("mailto:hello@macebydrmace.com"), true);
  assert.equal(validMarketingUrl("javascript:alert(1)"), false);
  assert.equal(validMarketingUrl("data:text/html,unsafe"), false);
});

test("Product fields, responsive visibility, tracking, and Survey links export", () => {
  const html = buildVisualEmailHtml({
    id: "campaign-1",
    name: "Builder regression",
    blocks: [
      {
        ...createEmailBlock("product", createId, layouts),
        category: "MACE TREATMENT",
        title: "Pico-Rejuvenation",
        description: "Support clarity and tone.",
        ctaLabel: "Explore treatment",
        ctaUrl: "https://macebydrmace.com/treatments/pico",
        tracking: { enabled: true, utmSource: "mace", utmMedium: "email", utmCampaign: "skin-reset" },
      },
      { ...createEmailBlock("heading", createId, layouts), visibility: { desktop: false, mobile: true } },
      createEmailBlock("survey", createId, layouts),
    ],
  }, {}, "https://app.macebydrmace.com");

  assert.match(html, /MACE TREATMENT/);
  assert.match(html, /Pico-Rejuvenation/);
  assert.match(html, /Support clarity and tone/);
  assert.match(html, /Explore treatment/);
  assert.match(html, /utm_source=mace/);
  assert.match(html, /mace-mobile-only/);
  assert.match(html, /\/api\/public\/marketing\/survey\/campaign-1\//);
  assert.match(html, /recipient={{email\|anonymous}}/);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  marketingHtmlToText,
  normalizeMarketingDesign,
  renderMarketingHtml,
  sanitizeMarketingHtml,
} from "./marketingHtml.js";

test("Marketing HTML preserves email layouts and removes executable content", () => {
  const result = sanitizeMarketingHtml(`
    <style>@import url(https://tracker.example/styles.css); .hero { color: #432b1d; behavior:url(test.htc) }</style>
    <table role="presentation" width="100%"><tr><td style="padding: 24px"><h1>Hello {{first_name}}</h1></td></tr></table>
    <script>alert(1)</script><xmp><img src=x onerror=alert(1)></xmp>
    <img src="https://images.example/hero.jpg" onerror="alert(1)" alt="Hero">
    <a href="javascript:alert(1)" target="_blank">Unsafe</a>
  `);

  assert.match(result, /<!doctype html>/i);
  assert.match(result, /<table role="presentation" width="100%">/i);
  assert.match(result, /Hello {{first_name}}/);
  assert.match(result, /https:\/\/images\.example\/hero\.jpg/);
  assert.doesNotMatch(result, /script|onerror|javascript:|@import|behavior\s*:/i);
});

test("Marketing HTML renders escaped personalization values", () => {
  const result = renderMarketingHtml("<h1>Hello {{first_name}}</h1><p>{{company}}</p>", {
    first_name: `<img src=x onerror="alert(1)">`,
    company: "MACE & Wellness",
  });

  assert.doesNotMatch(result, /<img/i);
  assert.match(result, /<h1>Hello <\/h1>/);
  assert.match(result, /MACE &amp; Wellness/);
});

test("Marketing HTML creates a useful text fallback", () => {
  assert.equal(marketingHtmlToText("<h1>Summer reset</h1><p>Book your consultation.</p>"), "Summer reset\nBook your consultation.");
});

test("Marketing design data is bounded and cloned", () => {
  const design = { version: 1, editorMode: "html", blocks: [{ type: "heading", content: "Hello" }] };
  const normalized = normalizeMarketingDesign(design);
  assert.deepEqual(normalized, design);
  assert.notEqual(normalized, design);
  assert.throws(() => normalizeMarketingDesign([]), /must be an object/i);
});

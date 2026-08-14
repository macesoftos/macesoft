import assert from "node:assert/strict";
import test from "node:test";

import { buildVisualEmailHtml, emailHtmlToPlainText } from "../src/marketing/emailHtml.js";

test("visual Marketing blocks export a complete responsive email document", () => {
  const html = buildVisualEmailHtml({
    name: "Summer Skin Reset",
    subject: "A thoughtful reset",
    previewText: "Your preview",
    blocks: [
      { id: "heading-1", type: "heading", content: "Hello {{first_name}}", align: "left", color: "#432b1d", fontSize: 32, padding: 16 },
      { id: "image-1", type: "image", src: "/brand/result-1.jpg", alt: "Client result", align: "center", padding: 0 },
      { id: "button-1", type: "button", content: "Book now", link: "https://macebydrmace.com/", background: "#432b1d", padding: 16 },
    ],
  }, { company: "MACE Signature Wellness" }, "https://app.macebydrmace.com");

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /@media\(max-width:680px\)/);
  assert.match(html, /Hello {{first_name}}/);
  assert.match(html, /https:\/\/app\.macebydrmace\.com\/brand\/result-1\.jpg/);
  assert.match(html, /Unsubscribe/i);
});

test("visual Marketing rich text removes executable markup before HTML export", () => {
  const html = buildVisualEmailHtml({
    blocks: [{ id: "text-1", type: "text", content: `<img src=x onerror="alert(1)">`, align: "left", padding: 12 }],
  });

  assert.doesNotMatch(html, /<img src=x onerror/i);
  assert.doesNotMatch(html, /onerror|alert\(1\)/i);
});

test("uploaded Marketing images export through the public email asset route", () => {
  const html = buildVisualEmailHtml({
    blocks: [{ id: "image-public", type: "image", src: "/api/uploads/asset-public-1", alt: "Campaign visual" }],
  }, {}, "https://app.macebydrmace.com");

  assert.match(html, /src="https:\/\/app\.macebydrmace\.com\/api\/public\/marketing-assets\/asset-public-1"/);
  assert.doesNotMatch(html, /src="https:\/\/app\.macebydrmace\.com\/api\/uploads\//);
});

test("HTML email source has a plain-text fallback", () => {
  assert.equal(emailHtmlToPlainText("<h1>Hello</h1><p>Book today.</p>"), "Hello Book today.");
});

test("mobile logo width remains pixel-bounded in exported email HTML", () => {
  const html = buildVisualEmailHtml({
    blocks: [{ id: "logo-mobile", type: "logo", src: "/brand/mace-logo.png", width: 140, mobileWidth: 120, responsive: { mobileWidth: 100 } }],
  }, {}, "https://app.macebydrmace.com");

  assert.match(html, /mace-logo-mw-120 img\{width:120px!important;max-width:100%!important\}/);
  assert.doesNotMatch(html, /mace-logo-mw-120 img\{width:120%!important/);
});

test("column layouts export as responsive email-safe tables", () => {
  const html = buildVisualEmailHtml({
    name: "Column campaign",
    blocks: [{
      id: "layout-1",
      type: "layout",
      background: "#f8f4ef",
      gap: 12,
      padding: 8,
      columns: [
        [{ id: "heading-1", type: "heading", content: "Left", align: "left", color: "#432b1d", fontSize: 22, padding: 8 }],
        [{ id: "text-1", type: "text", content: "Right", align: "left", color: "#432b1d", fontSize: 14, padding: 8 }],
      ],
    }],
  });

  assert.match(html, /class="mace-stack-column"/);
  assert.match(html, /width="50%"/);
  assert.match(html, /display:block!important;width:100%!important/);
  assert.match(html, />Left</);
  assert.match(html, />Right</);
});

test("unequal column ratios and global email styles survive export", () => {
  const html = buildVisualEmailHtml({
    theme: {
      canvasBackground: "#efe8e1",
      contentBackground: "#fffaf6",
      textColor: "#302019",
      linkColor: "#7a402d",
      buttonBackground: "#5c2e1f",
      buttonTextColor: "#fffdf9",
      contentWidth: 680,
      mobilePadding: 20,
    },
    blocks: [{
      id: "layout-ratio",
      type: "layout",
      columnWidths: [1, 2],
      columns: [
        [{ id: "text-left", type: "text", content: "One third", align: "left" }],
        [{ id: "text-right", type: "text", content: "Two thirds", align: "left" }],
      ],
    }],
  });

  assert.match(html, /width="33\.33%"/);
  assert.match(html, /width="66\.67%"/);
  assert.match(html, /width="680"/);
  assert.match(html, /background:#efe8e1/);
  assert.match(html, /padding-left:20px!important/);
});

test("custom code blocks remove executable markup while preserving email HTML", () => {
  const html = buildVisualEmailHtml({
    blocks: [{
      id: "code-1",
      type: "code",
      content: '<table><tr><td onclick="alert(1)">Safe offer</td></tr></table><script>alert(1)</script>',
      align: "left",
    }],
  });

  assert.match(html, /<table><tr><td>Safe offer<\/td><\/tr><\/table>/);
  assert.doesNotMatch(html, /onclick|<script/i);
});

test("treatment rows export their own uploaded icons", () => {
  const html = buildVisualEmailHtml({
    blocks: [{
      id: "treatment-1",
      type: "treatment",
      content: "Hydrodermabrasion\nDeeply cleanse and hydrate.\n\nPico-Rejuvenation\nImprove tone and clarity.",
      itemIcons: [
        { src: "/api/uploads/hydro-icon", alt: "Hydrodermabrasion icon" },
        { src: "/api/uploads/pico-icon", alt: "Pico-Rejuvenation icon" },
      ],
      align: "left",
    }],
  }, {}, "https://app.macebydrmace.com");

  assert.equal((html.match(/https:\/\/app\.macebydrmace\.com\/api\/public\/marketing-assets\/hydro-icon/g) || []).length, 1);
  assert.equal((html.match(/https:\/\/app\.macebydrmace\.com\/api\/public\/marketing-assets\/pico-icon/g) || []).length, 1);
  assert.match(html, /alt="Hydrodermabrasion icon"/);
  assert.match(html, /alt="Pico-Rejuvenation icon"/);
  assert.match(html, /Hydrodermabrasion/);
  assert.match(html, /Pico-Rejuvenation/);
});

test("treatment row icon rejects unsafe URLs during export", () => {
  const html = buildVisualEmailHtml({
    blocks: [{ id: "treatment-1", type: "treatment", content: "Treatment\nDescription", itemIcons: [{ src: "javascript:alert(1)" }] }],
  });

  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /&#10022;/);
});

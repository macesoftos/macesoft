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

test("visual Marketing block content is escaped before HTML export", () => {
  const html = buildVisualEmailHtml({
    blocks: [{ id: "text-1", type: "text", content: `<img src=x onerror="alert(1)">`, align: "left", padding: 12 }],
  });

  assert.doesNotMatch(html, /<img src=x onerror/i);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
});

test("HTML email source has a plain-text fallback", () => {
  assert.equal(emailHtmlToPlainText("<h1>Hello</h1><p>Book today.</p>"), "Hello Book today.");
});

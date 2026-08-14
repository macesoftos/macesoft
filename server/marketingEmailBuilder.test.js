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

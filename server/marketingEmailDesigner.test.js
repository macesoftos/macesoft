import assert from "node:assert/strict";
import test from "node:test";

import {
  emailColumnId,
  findEmailBlock,
  flattenEmailBlocks,
  insertEmailBlock,
  moveEmailBlock,
  removeEmailBlock,
  updateEmailBlock,
} from "../src/marketing/emailDesigner.js";

const design = [
  { id: "heading", type: "heading", content: "Hello" },
  {
    id: "layout", type: "layout", columns: [
      [{ id: "image", type: "image", src: "/image.jpg" }],
      [{ id: "text", type: "text", content: "Details" }],
    ],
  },
  { id: "button", type: "button", content: "Book" },
];

test("email designer finds, flattens, and updates nested blocks", () => {
  assert.equal(findEmailBlock(design, "text")?.content, "Details");
  assert.deepEqual(flattenEmailBlocks(design).map((block) => block.id), ["heading", "image", "text", "button"]);
  const updated = updateEmailBlock(design, "text", { content: "Updated" });
  assert.equal(findEmailBlock(updated, "text")?.content, "Updated");
  assert.equal(findEmailBlock(design, "text")?.content, "Details");
});

test("email designer inserts and moves blocks across layout columns", () => {
  const inserted = insertEmailBlock(design, emailColumnId("layout", 1), 1, { id: "offer", type: "offer" });
  const moved = moveEmailBlock(inserted, "heading", emailColumnId("layout", 0), 1);
  assert.deepEqual(moved.map((block) => block.id), ["layout", "button"]);
  assert.deepEqual(moved[0].columns[0].map((block) => block.id), ["image", "heading"]);
  assert.deepEqual(moved[0].columns[1].map((block) => block.id), ["text", "offer"]);
});

test("email designer refuses to move a layout inside one of its own columns", () => {
  const moved = moveEmailBlock(design, "layout", emailColumnId("layout", 0), 0);
  assert.equal(moved, design);
});

test("email designer removes nested content without mutating the original", () => {
  const removed = removeEmailBlock(design, "image");
  assert.equal(removed.block.id, "image");
  assert.deepEqual(removed.blocks[1].columns[0], []);
  assert.equal(design[1].columns[0][0].id, "image");
});

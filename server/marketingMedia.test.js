import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMarketingMediaName, serializeMarketingMediaAsset } from "./marketingMedia.js";

test("Marketing media names discard local paths and control characters", () => {
  assert.equal(normalizeMarketingMediaName("C:\\fakepath\\ summer\n glow.jpg "), "summer glow.jpg");
  assert.equal(normalizeMarketingMediaName("/Users/mace/hero.webp"), "hero.webp");
});

test("Marketing media serialization exposes reusable public URLs without storage paths", () => {
  const serialized = serializeMarketingMediaAsset({
    id: "asset-123456789",
    originalName: "",
    objectPath: "marketing-image/secret.webp",
    mimeType: "image/webp",
    byteSize: 2048,
    branch: "Mace Davao",
    createdAt: new Date("2026-08-14T00:00:00.000Z"),
  });
  assert.equal(serialized.name, "Marketing image asset-12.webp");
  assert.equal(serialized.url, "/api/uploads/asset-123456789");
  assert.equal(Object.hasOwn(serialized, "objectPath"), false);
});

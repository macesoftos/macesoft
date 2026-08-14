import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalTreatmentPhotoKind,
  serializeTreatmentWithPhotos,
  treatmentPhotoKinds,
} from "./treatmentPhotos.js";

test("treatment photo types are normalized to the supported clinical labels", () => {
  assert.deepEqual(treatmentPhotoKinds, ["Before", "After", "Clinical"]);
  assert.equal(canonicalTreatmentPhotoKind(" before "), "Before");
  assert.equal(canonicalTreatmentPhotoKind("AFTER"), "After");
  assert.equal(canonicalTreatmentPhotoKind("other"), "");
});

test("treatment photo count is derived from linked image records", () => {
  const serialized = serializeTreatmentWithPhotos({
    id: "treatment-1",
    photos: 99,
    photoLinks: [
      { id: "photo-1", assetId: "asset-1", kind: "Before", createdAt: new Date("2026-08-14T00:00:00Z"), asset: { mimeType: "image/jpeg", byteSize: 123 } },
      { id: "photo-2", assetId: "asset-2", kind: "After", createdAt: new Date("2026-08-14T01:00:00Z"), asset: { mimeType: "image/png", byteSize: 456 } },
    ],
  });

  assert.equal(serialized.photos, 2);
  assert.equal(serialized.photoItems.length, 2);
  assert.equal(serialized.photoItems[0].url, "/api/uploads/asset-1");
});

export const treatmentPhotoKinds = ["Before", "After", "Clinical"];

export function canonicalTreatmentPhotoKind(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return treatmentPhotoKinds.find((kind) => kind.toLowerCase() === normalized) || "";
}

export function serializeTreatmentPhoto(photo) {
  return {
    id: photo.id,
    kind: canonicalTreatmentPhotoKind(photo.kind) || "Clinical",
    url: `/api/uploads/${photo.assetId}`,
    mimeType: photo.asset?.mimeType || "",
    byteSize: Number(photo.asset?.byteSize || 0),
    createdAt: photo.createdAt,
  };
}

export function serializeTreatmentWithPhotos(record) {
  const { photoLinks = [], ...treatment } = record;
  const photoItems = Array.isArray(photoLinks) ? photoLinks.map(serializeTreatmentPhoto) : [];
  return {
    ...treatment,
    photos: photoItems.length,
    photoItems,
  };
}

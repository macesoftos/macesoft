const mediaExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function normalizeMarketingMediaName(value) {
  const finalSegment = String(value || "").split(/[\\/]/).pop() || "";
  return finalSegment
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function serializeMarketingMediaAsset(asset) {
  const extension = mediaExtensions[String(asset?.mimeType || "").toLowerCase()] || "img";
  const fallbackName = `Marketing image ${String(asset?.id || "").slice(0, 8)}.${extension}`;
  return {
    id: String(asset?.id || ""),
    name: normalizeMarketingMediaName(asset?.originalName) || fallbackName,
    url: `/api/uploads/${encodeURIComponent(String(asset?.id || ""))}`,
    mimeType: String(asset?.mimeType || ""),
    byteSize: Number(asset?.byteSize || 0),
    branch: String(asset?.branch || ""),
    createdAt: asset?.createdAt || null,
    deletedAt: asset?.deletedAt || null,
  };
}

export function normalizeMarketingMediaSelection(value = {}) {
  const ids = Array.isArray(value?.ids)
    ? [...new Set(value.ids.map((id) => String(id || "").trim()).filter((id) => id && id.length <= 200))]
    : [];
  return { all: value?.all === true, ids };
}

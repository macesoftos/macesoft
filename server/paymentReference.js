const maxReferenceLength = 120;

export function normalizePaymentReference(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxReferenceLength);
}

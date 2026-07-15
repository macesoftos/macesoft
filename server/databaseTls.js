export function normalizePemCertificates(value) {
  const source = String(value || "").replace(/\\n/g, "\n").trim();
  if (!source) return "";

  const certificates = [...source.matchAll(
    /-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/gs,
  )];
  if (!certificates.length) return source;

  return certificates.map(([, body]) => {
    const base64 = body.replace(/\s/g, "");
    const lines = base64.match(/.{1,64}/g) || [];
    return [
      "-----BEGIN CERTIFICATE-----",
      ...lines,
      "-----END CERTIFICATE-----",
    ].join("\n");
  }).join("\n");
}

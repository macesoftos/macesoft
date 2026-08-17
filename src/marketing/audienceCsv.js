export function validAudienceEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function parseAudienceCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return { contacts: [], invalid: 0 };

  const headings = rows[0].map((heading) => String(heading).toLowerCase().replace(/[^a-z0-9]+/g, ""));
  const emailIndex = headings.findIndex((heading) => ["email", "emailaddress", "contactemail"].includes(heading));
  if (emailIndex < 0) throw new Error("Include an Email or Email Address column in the CSV.");
  const nameIndex = headings.findIndex((heading) => ["name", "fullname", "contact", "recipient"].includes(heading));
  const branchIndex = headings.findIndex((heading) => ["branch", "clinic", "location"].includes(heading));
  const contacts = [];
  let invalid = 0;

  rows.slice(1).forEach((values) => {
    const email = String(values[emailIndex] || "").trim().toLowerCase();
    if (!validAudienceEmail(email)) {
      if (values.some(Boolean)) invalid += 1;
      return;
    }
    contacts.push({
      email,
      name: nameIndex >= 0 ? String(values[nameIndex] || "").trim() : "",
      branch: branchIndex >= 0 ? String(values[branchIndex] || "").trim() : "",
    });
  });
  return { contacts, invalid };
}

function csvCell(value) {
  let cell = String(value ?? "");
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}

export function audienceCsvText(recipients) {
  const header = ["Name", "Email", "Phone", "Branch", "Source", "Audience"].map(csvCell).join(",");
  const body = recipients.map((recipient) => [
    recipient.fullName || recipient.name || "",
    recipient.email || "",
    recipient.mobile || "",
    recipient.branch || "",
    recipient.audienceMember ? recipient.source || "Manual" : "Client record",
    recipient.audience || "",
  ].map(csvCell).join(",")).join("\n");
  return `\uFEFF${header}${body ? `\n${body}` : ""}`;
}

export function downloadAudienceCsv(filename, recipients) {
  const blob = new Blob([audienceCsvText(recipients)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

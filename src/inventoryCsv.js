const inventoryCsvFields = [
  { key: "id", label: "Inventory ID", aliases: ["inventoryid", "id"] },
  { key: "item", label: "Item", aliases: ["item", "product", "productconsumable", "productorconsumable"] },
  { key: "category", label: "Category", aliases: ["category"] },
  { key: "type", label: "Type", aliases: ["type"] },
  { key: "unit", label: "Unit", aliases: ["unit", "unitofmeasurement"] },
  { key: "packQty", label: "Packaging Qty", aliases: ["packagingqty", "packqty", "packagingquantity"] },
  { key: "beginning", label: "Beginning Stock", aliases: ["beginningstock", "beginning", "openingstock"] },
  { key: "stock", label: "Current Stock", aliases: ["currentstock", "stock", "quantity"] },
  { key: "branch", label: "Branch", aliases: ["branch"] },
  { key: "location", label: "Storage Location", aliases: ["storagelocation", "location", "stocklocation"] },
  { key: "reorder", label: "Reorder Level", aliases: ["reorderlevel", "reorder"] },
  { key: "supplier", label: "Supplier", aliases: ["supplier"] },
  { key: "cost", label: "Cost", aliases: ["cost", "unitcost"] },
  { key: "price", label: "Retail Price", aliases: ["retailprice", "price", "sellingprice"] },
];

export const inventoryCsvExportColumns = inventoryCsvFields.map(({ key, label }) => ({ key, label }));

function normalizedHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseCsvRows(text) {
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

  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function numberCell(value, label, rowNumber, { fallback = 0, min = 0, integer = false } = {}) {
  const source = String(value ?? "").trim();
  if (!source) return fallback;
  const parsed = Number(source.replace(/[,₱\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < min || (integer && !Number.isInteger(parsed))) {
    throw new Error(`Row ${rowNumber}: ${label} must be ${integer ? "a whole number" : "a number"} of at least ${min}.`);
  }
  return parsed;
}

export function inventoryRecordsFromCsv(text, { defaultBranch = "" } = {}) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("The CSV does not contain any inventory rows.");

  const headings = rows[0].map(normalizedHeader);
  const fieldIndexes = Object.fromEntries(inventoryCsvFields.map((field) => [
    field.key,
    headings.findIndex((heading) => field.aliases.includes(heading)),
  ]));
  if (fieldIndexes.item < 0) throw new Error("Include an Item column in the inventory CSV.");

  const records = [];
  const seen = new Set();
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const value = (key) => fieldIndexes[key] < 0 ? "" : String(row[fieldIndexes[key]] ?? "").trim();
    const item = value("item");
    if (!item) throw new Error(`Row ${rowNumber}: Item is required.`);
    const branch = value("branch") || defaultBranch;
    if (!branch || branch.toLowerCase() === "all branches") {
      throw new Error(`Row ${rowNumber}: choose a specific Branch.`);
    }
    const rawType = value("type") || "Consumable";
    const type = rawType.toLowerCase() === "retail" ? "Retail" : rawType.toLowerCase() === "consumable" ? "Consumable" : "";
    if (!type) throw new Error(`Row ${rowNumber}: Type must be Consumable or Retail.`);

    const id = value("id");
    const duplicateKey = id ? `id:${id.toLowerCase()}` : `item:${item.toLowerCase()}|${branch.toLowerCase()}`;
    if (seen.has(duplicateKey)) throw new Error(`Row ${rowNumber}: this inventory item is duplicated in the CSV.`);
    seen.add(duplicateKey);

    const stock = numberCell(value("stock"), "Current Stock", rowNumber);
    records.push({
      ...(id ? { id } : {}),
      item,
      category: value("category"),
      type,
      unit: value("unit") || "piece",
      packQty: numberCell(value("packQty"), "Packaging Qty", rowNumber, { fallback: 1, min: 1, integer: true }),
      beginning: numberCell(value("beginning"), "Beginning Stock", rowNumber, { fallback: stock }),
      stock,
      branch,
      location: value("location"),
      reorder: numberCell(value("reorder"), "Reorder Level", rowNumber),
      supplier: value("supplier"),
      cost: numberCell(value("cost"), "Cost", rowNumber),
      price: numberCell(value("price"), "Retail Price", rowNumber),
    });
  });

  if (!records.length) throw new Error("The CSV does not contain any inventory rows.");
  return records;
}

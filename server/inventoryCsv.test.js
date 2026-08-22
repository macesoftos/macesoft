import test from "node:test";
import assert from "node:assert/strict";
import { inventoryRecordsFromCsv } from "../src/inventoryCsv.js";

test("inventory CSV supports exported columns and quoted item names", () => {
  const records = inventoryRecordsFromCsv([
    "Inventory ID,Item,Category,Type,Unit,Packaging Qty,Beginning Stock,Current Stock,Branch,Storage Location,Reorder Level,Supplier,Cost,Retail Price",
    'inv-1,"Serum, Brightening",Skin Care,Retail,bottle,2,10,8,Mace Bajada,Shelf A,3,MACE Supplier,"1,200","1,850"',
  ].join("\n"));

  assert.deepEqual(records, [{
    id: "inv-1",
    item: "Serum, Brightening",
    category: "Skin Care",
    type: "Retail",
    unit: "bottle",
    packQty: 2,
    beginning: 10,
    stock: 8,
    branch: "Mace Bajada",
    location: "Shelf A",
    reorder: 3,
    supplier: "MACE Supplier",
    cost: 1200,
    price: 1850,
  }]);
});

test("inventory CSV can apply a concrete current branch when Branch is omitted", () => {
  const records = inventoryRecordsFromCsv("Item,Current Stock\nGloves,25", { defaultBranch: "Mace Bajada" });
  assert.equal(records[0].branch, "Mace Bajada");
  assert.equal(records[0].beginning, 25);
});

test("inventory CSV rejects invalid stock and organization-wide branches", () => {
  assert.throws(
    () => inventoryRecordsFromCsv("Item,Current Stock,Branch\nGloves,-1,Mace Bajada"),
    /Current Stock must be a number of at least 0/,
  );
  assert.throws(
    () => inventoryRecordsFromCsv("Item,Current Stock,Branch\nGloves,1,All branches"),
    /choose a specific Branch/,
  );
});

test("inventory CSV rejects duplicate rows before import", () => {
  assert.throws(
    () => inventoryRecordsFromCsv("Item,Branch\nGloves,Mace Bajada\nGloves,Mace Bajada"),
    /duplicated in the CSV/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cardViewSource = appSource.match(/function CardViewModule[\s\S]*?\nfunction StaffAvailabilityModule/)?.[0] ?? "";
const posSource = appSource.match(/function POSModule[\s\S]*?\nfunction POSCatalogPagination/)?.[0] ?? "";
const servicesSource = appSource.match(/function ServicesModule[\s\S]*?\nfunction InventoryModule/)?.[0] ?? "";
const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const groupedVisitMigration = readFileSync(new URL("../prisma/migrations/20260929090000_grouped_visit_checkout/migration.sql", import.meta.url), "utf8");

test("appointment details do not invent missing record values", () => {
  assert.doesNotMatch(appSource, /appointment\.appointmentType\s*\|\|\s*["']Treatment["']/);
  assert.doesNotMatch(appSource, /appointment\.timezone\s*\|\|\s*["']Asia\/Manila["']/);
  assert.doesNotMatch(appSource, /appointment\.packageName\s*\|\|\s*["']Pay per visit["']/);
});

test("appointment history contains only persisted payments and audit records", () => {
  assert.doesNotMatch(appSource, /title:\s*["']Booking created["']/);
  assert.doesNotMatch(appSource, /Latest appointment state/);
});

test("appointment details allow persisted doctor or staff reassignment", () => {
  assert.match(appSource, /aria-label="Reassign doctor or staff"/);
  assert.match(appSource, /onAssign=\{\(appointment, staffName\) => onUpdateAppointment/);
  assert.match(appSource, /staff: staffName \|\| "Any available"/);
  assert.match(appSource, /<option value="">Unassigned<\/option>/);
});

test("card view opens directly on API-backed filters and appointment records", () => {
  assert.doesNotMatch(cardViewSource, /card-view-kpi/);
  assert.doesNotMatch(cardViewSource, />Completion rate</);
  assert.doesNotMatch(cardViewSource, />Total Cards</);
  assert.match(cardViewSource, /useState\(todayDate\(\)\)/);
  assert.match(cardViewSource, /appointment\.date === date/);
  assert.doesNotMatch(cardViewSource, /!date \|\| appointment\.date === date/);
  assert.match(appSource, /<CardViewModule[\s\S]*?branchRecords=\{branchRecords\}/);
  assert.doesNotMatch(cardViewSource, /uniqueRoomsFromBranches/);
});

test("card view groups a client's daily services into one visit checkout", () => {
  assert.match(cardViewSource, /const visitCards = Object\.values\(cards\.reduce/);
  assert.match(cardViewSource, /Open the client to review every service and check out once/);
  assert.match(appSource, /function paymentDraftForVisit/);
  assert.match(appSource, /appointmentIds: visitAppointments\.map/);
  assert.match(appSource, /Checkout visit/);
  assert.match(serverSource, /checkout\.appointmentIds/);
  assert.match(serverSource, /appointmentIds: testMode \? "\[\]" : jsonText\(checkout\.appointmentIds/);
  assert.match(groupedVisitMigration, /ADD COLUMN "appointmentIds"/);
});

test("POS assigns providers per service without a sale-level staff selector", () => {
  assert.doesNotMatch(posSource, />Select Staff</);
  assert.match(posSource, /className="cart-provider-select"/);
  assert.match(posSource, /attendanceBranch === branch/);
  assert.match(posSource, /staff: saleStaffName/);
});

test("staff and service management expose the requested controls", () => {
  assert.doesNotMatch(appSource, /field\("branch", "Primary branch"/);
  assert.match(appSource, /field\("branches", "Assigned branches", "multi-select"/);
  assert.match(servicesSource, /deleteService\(service\)/);
  assert.match(servicesSource, /<Trash2[^>]*\/> Delete<\/button>/);
});

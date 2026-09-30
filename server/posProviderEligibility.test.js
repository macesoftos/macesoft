import assert from "node:assert/strict";
import test from "node:test";
import { eligiblePosProviders, isClockedInAtBranch } from "../src/lib/posProviders.js";

const staff = [
  { name: "Bajada Aesthetician", role: "Aesthetician", status: "Available", clockedIn: true, attendanceBranch: " MACE BAJADA " },
  { name: "Tulip Nurse", role: "Nurse", status: "Available", clockedIn: true, attendanceBranch: "Mace Tulip Drive Matina" },
  { name: "Clocked-out Doctor", role: "Doctor", status: "Available", clockedIn: false, attendanceBranch: "Mace Bajada" },
  { name: "Inactive Nurse", role: "Nurse", status: "Inactive", clockedIn: true, attendanceBranch: "Mace Bajada" },
];

test("POS recognizes only active staff clocked in at the selected daily branch", () => {
  assert.deepEqual(
    staff.filter((person) => isClockedInAtBranch(person, "Mace Bajada")).map((person) => person.name),
    ["Bajada Aesthetician"],
  );
});

test("POS provider eligibility respects service roles without casing mismatches", () => {
  const branchStaff = staff.filter((person) => isClockedInAtBranch(person, "Mace Bajada"));
  assert.deepEqual(eligiblePosProviders(branchStaff, { staff: "Nurse, AESTHETICIAN" }).map((person) => person.name), ["Bajada Aesthetician"]);
  assert.deepEqual(eligiblePosProviders(branchStaff, { staff: "Doctor" }), []);
  assert.deepEqual(eligiblePosProviders(branchStaff, { staff: "All staff" }).map((person) => person.name), ["Bajada Aesthetician"]);
});

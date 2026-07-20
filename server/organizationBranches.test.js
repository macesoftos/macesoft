import test from "node:test";
import assert from "node:assert/strict";
import { nextRoomNames, renameBranchReferences, renameServiceBranches } from "./organizationBranches.js";

test("branch service assignments are renamed without duplicates", () => {
  assert.equal(
    renameServiceBranches(JSON.stringify(["Mace BGC", "Mace Davao"]), "Mace BGC", "Mace Makati"),
    JSON.stringify(["Mace Makati", "Mace Davao"]),
  );
  assert.equal(
    renameServiceBranches(JSON.stringify(["Mace BGC", "Mace Makati"]), "Mace BGC", "Mace Makati"),
    JSON.stringify(["Mace Makati"]),
  );
  assert.equal(renameServiceBranches(JSON.stringify(["Mace Davao"]), "Mace BGC", "Mace Makati"), null);
});

test("new room names skip names already used by the branch", () => {
  assert.deepEqual(nextRoomNames([{ name: "Room 1" }, { name: "Laser Room" }, { name: "Room 3" }], 3), [
    "Room 2",
    "Room 4",
    "Room 5",
  ]);
});

test("renaming a branch migrates every direct assignment and service list", async () => {
  const calls = [];
  const model = (name) => ({
    updateMany: async (args) => calls.push({ name, method: "updateMany", args }),
  });
  const database = {
    client: model("client"),
    staffMember: model("staffMember"),
    account: model("account"),
    userInvitation: model("userInvitation"),
    attendanceEvent: model("attendanceEvent"),
    faceTrackAttendanceRecord: model("faceTrackAttendanceRecord"),
    faceTrackKioskDevice: model("faceTrackKioskDevice"),
    appointment: model("appointment"),
    inventoryItem: model("inventoryItem"),
    inventoryMovement: model("inventoryMovement"),
    sale: model("sale"),
    clinicPackage: model("clinicPackage"),
    giftCertificate: model("giftCertificate"),
    lead: model("lead"),
    expense: model("expense"),
    uploadAsset: model("uploadAsset"),
    service: {
      findMany: async () => [
        { id: "svc-1", branches: JSON.stringify(["Mace BGC", "Mace Davao"]) },
        { id: "svc-2", branches: JSON.stringify(["Mace Davao"]) },
      ],
      update: async (args) => calls.push({ name: "service", method: "update", args }),
    },
  };

  await renameBranchReferences(database, "Mace BGC", "Mace Makati");

  assert.equal(calls.filter((call) => call.method === "updateMany").length, 17);
  assert.deepEqual(calls.find((call) => call.name === "client").args, {
    where: { branch: "Mace BGC" },
    data: { branch: "Mace Makati" },
  });
  assert.equal(calls.filter((call) => call.name === "lead").length, 2);
  assert.deepEqual(calls.find((call) => call.name === "service").args, {
    where: { id: "svc-1" },
    data: { branches: JSON.stringify(["Mace Makati", "Mace Davao"]) },
  });
});

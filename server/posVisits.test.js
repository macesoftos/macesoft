import test from "node:test";
import assert from "node:assert/strict";
import { groupTodayPosVisits } from "../src/lib/posVisits.js";

const date = "2026-10-01";
const branch = "Mace Bajada";

test("walk-in POS sales appear in today's visits, including anonymous sales", () => {
  const transactions = [
    { id: "sale-1", date, branch, clientId: "client-1", client: "Gail Serafin", invoice: "MACE-001" },
    { id: "sale-2", date, branch, client: "Walk-in", invoice: "MACE-002" },
    { id: "sale-3", date, branch, client: "Walk-in", invoice: "MACE-003" },
  ];
  const visits = groupTodayPosVisits([], transactions, date, branch);

  assert.equal(visits.length, 3);
  assert.deepEqual(visits.map((visit) => visit.transactions.map((sale) => sale.invoice)), [["MACE-001"], ["MACE-002"], ["MACE-003"]]);
  assert.ok(visits.every((visit) => visit.appointments.length === 0));
});

test("booked clients keep their appointments and POS transactions in one visit", () => {
  const appointments = [
    { id: "ap-1", date, branch, clientId: "client-1", client: "Gail Serafin", service: "Facial" },
    { id: "ap-2", date, branch, clientId: "client-1", client: "Gail Serafin", service: "Consultation" },
  ];
  const transactions = [
    { id: "sale-1", date, branch, clientId: "client-1", client: "Gail Serafin", appointmentIds: ["ap-1", "ap-2"] },
    { id: "sale-2", date, branch, clientId: "client-1", client: "Gail Serafin" },
  ];
  const visits = groupTodayPosVisits(appointments, transactions, date, branch);

  assert.equal(visits.length, 1);
  assert.deepEqual(visits[0].appointments.map((item) => item.id), ["ap-1", "ap-2"]);
  assert.deepEqual(visits[0].transactions.map((item) => item.id), ["sale-1", "sale-2"]);
});

test("only the selected branch's transactions for today appear", () => {
  const transactions = [
    { id: "today", date, branch, client: "Walk-in" },
    { id: "yesterday", date: "2026-09-30", branch, client: "Walk-in" },
    { id: "other-branch", date, branch: "Mace Davao", client: "Walk-in" },
  ];
  const visits = groupTodayPosVisits([], transactions, date, branch);

  assert.deepEqual(visits.map((visit) => visit.transactions[0].id), ["today"]);
});

test("every recorded POS transaction remains visible, including test and void entries", () => {
  const appointments = [{ id: "ap-1", date, branch, client: "Gail Serafin" }];
  const transactions = [
    { id: "linked", date, branch, client: "Walk-in", appointmentId: "ap-1", status: "Paid" },
    { id: "test", date, branch, client: "Walk-in", testMode: true, status: "Test" },
    { id: "void", date, branch, client: "Walk-in", status: "Void" },
  ];
  const visits = groupTodayPosVisits(appointments, transactions, date, branch);

  assert.deepEqual(visits.flatMap((visit) => visit.transactions.map((sale) => sale.id)), ["linked", "test", "void"]);
  assert.equal(visits[0].appointment.id, "ap-1");
});

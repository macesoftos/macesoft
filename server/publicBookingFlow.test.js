import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../src/lib/api.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");

test("the public contact portal exposes separate inquiry and appointment actions", () => {
  assert.match(appSource, /<MessageSquareText size=\{16\} \/> Inquire/);
  assert.match(appSource, /<CalendarDays size=\{16\} \/> Book an appointment/);
  assert.match(appSource, /submitPublicLead\(/);
  assert.match(appSource, /submitPublicBooking\(form\)/);
});

test("the public booking client posts to the anonymous booking endpoint", () => {
  assert.match(apiSource, /requestJson\("\/api\/public-bookings"/);
  assert.match(apiSource, /method: "POST"/);
});

test("a public booking creates an appointment linked to a lead and notifies Appointments", () => {
  assert.match(serverSource, /app\.post\("\/api\/public-bookings"/);
  assert.match(serverSource, /tx\.appointment\.create\(\{ data: \{ \.\.\.appointmentData, leadId: lead\.id \} \}\)/);
  assert.match(serverSource, /linkedAppointmentId: appointment\.id/);
  assert.match(serverSource, /module: "appointments"/);
  assert.match(serverSource, /status: "Pending Confirmation"/);
  assert.match(serverSource, /clientId: null/);
  assert.match(serverSource, /publicBookingKey/);
  assert.doesNotMatch(serverSource.match(/app\.post\("\/api\/public-bookings"[\s\S]*?response\.status\(result\.replayed \? 200 : 201\)/)?.[0] ?? "", /tx\.client\.(?:findFirst|create)/);
});

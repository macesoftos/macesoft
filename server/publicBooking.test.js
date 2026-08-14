import test from "node:test";
import assert from "node:assert/strict";
import { manilaDate, normalizePublicBookingRequest } from "./publicBooking.js";

const validBooking = {
  submissionId: "booking_request_1234567890",
  fullName: "Maria Santos",
  mobile: "0917 123 4567",
  email: "Maria@Example.com",
  serviceId: "svc-signature",
  branch: "Mace Davao",
  date: "2026-08-20",
  time: "10:30",
  concern: "First consultation",
  privacyConsent: true,
  marketingConsent: true,
};

test("normalizes a valid public booking without changing the selected slot", () => {
  assert.deepEqual(normalizePublicBookingRequest(validBooking, { today: "2026-08-14" }), {
    spam: false,
    fullName: "Maria Santos",
    mobile: "0917 123 4567",
    email: "maria@example.com",
    serviceId: "svc-signature",
    branch: "Mace Davao",
    date: "2026-08-20",
    time: "10:30",
    submissionId: "booking_request_1234567890",
    concern: "First consultation",
    marketingConsent: true,
  });
});

test("rejects invalid contact details, dates, and missing consent", () => {
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, mobile: "123" }), /valid mobile/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, email: "not-an-email" }), /valid email/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, date: "2026-08-13" }, { today: "2026-08-14" }), /current or future/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, date: "2026-02-31" }, { today: "2026-01-01" }), /valid current or future/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, time: "25:90" }), /valid appointment time/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, submissionId: "short" }), /fresh booking request/i);
  assert.throws(() => normalizePublicBookingRequest({ ...validBooking, privacyConsent: false }), /consent/i);
});

test("quietly accepts honeypot submissions without creating booking data", () => {
  assert.deepEqual(normalizePublicBookingRequest({ clinicWebsite: "spam.example" }), { spam: true });
});

test("uses the Manila calendar date at the UTC day boundary", () => {
  assert.equal(manilaDate(new Date("2026-08-13T16:30:00.000Z")), "2026-08-14");
});

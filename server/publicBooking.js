function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function bookingError(message, status = 400) {
  const error = Object.assign(new Error(message), { status });
  throw error;
}

function bounded(value, label, maximum) {
  const text = clean(value);
  if (text.length > maximum) bookingError(`${label} must be ${maximum} characters or fewer.`);
  return text;
}

export function manilaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * @returns {{ spam: true } | { spam: false, fullName: string, mobile: string, email: string, serviceId: string, branch: string, date: string, time: string, submissionId: string, concern: string, preferredStaff?: string, marketingConsent: boolean }}
 */
export function normalizePublicBookingRequest(values = {}, { today = manilaDate() } = {}) {
  if (clean(values.clinicWebsite)) return { spam: true };

  const fullName = bounded(values.fullName, "Full name", 120);
  if (fullName.length < 2) bookingError("Full name is required.");

  const mobile = bounded(values.mobile, "Mobile number", 30);
  if (!/^[+()0-9\s.-]{7,30}$/.test(mobile)) bookingError("Enter a valid mobile number.");

  const email = bounded(values.email, "Email", 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bookingError("Enter a valid email address.");
  if (values.privacyConsent !== true) bookingError("Privacy consent is required before booking.");

  const serviceId = bounded(values.serviceId, "Service", 120);
  if (!serviceId) bookingError("Choose a service.");
  const branch = bounded(values.branch, "Branch", 120);
  if (!branch) bookingError("Choose a branch.");

  const date = bounded(values.date, "Appointment date", 10);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date < today) {
    bookingError("Choose a valid current or future appointment date.");
  }

  const time = bounded(values.time, "Appointment time", 5);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) bookingError("Choose a valid appointment time.");
  const submissionId = bounded(values.submissionId, "Booking submission identifier", 100);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(submissionId)) bookingError("Start a fresh booking request and try again.");

  return {
    spam: false,
    fullName,
    mobile,
    email,
    serviceId,
    branch,
    date,
    time,
    submissionId,
    concern: bounded(values.concern, "Concern or notes", 1000),
    ...(clean(values.preferredStaff) ? { preferredStaff: bounded(values.preferredStaff, "Preferred service provider", 120) } : {}),
    marketingConsent: values.marketingConsent === true || values.marketingOptIn === true,
  };
}

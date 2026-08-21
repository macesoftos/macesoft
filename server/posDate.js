export const POS_TIME_ZONE = "Asia/Manila";

export function posCalendarDate(now = new Date(), timeZone = POS_TIME_ZONE) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("POS calendar date requires a valid Date.");
  }

  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));

  return `${parts.year}-${parts.month}-${parts.day}`;
}

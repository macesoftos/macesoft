function normalizedText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function calendarDay(value) {
  const dateText = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const timestamp = Date.parse(`${dateText}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 86_400_000);
}

function currentCalendarDay(now) {
  const date = now instanceof Date ? now : new Date(now);
  return Number.isNaN(date.getTime()) ? null : calendarDay(date.toISOString().slice(0, 10));
}

function ageInDays(value, now) {
  const valueDay = calendarDay(value);
  const today = currentCalendarDay(now);
  return valueDay === null || today === null ? null : today - valueDay;
}

function daysUntil(value, now) {
  const valueDay = calendarDay(value);
  const today = currentCalendarDay(now);
  return valueDay === null || today === null ? null : valueDay - today;
}

export function marketingClientMatchesSegment(client, segmentValue, now = new Date()) {
  const segment = normalizedText(segmentValue);
  if (!segment || segment === "all consented clients") return true;

  const tag = normalizedText(client?.tag);
  const retention = normalizedText(client?.retention);
  const source = normalizedText(client?.source);
  const packageBalance = normalizedText(client?.packageBalance);
  const lastVisitAge = ageInDays(client?.lastVisit, now);

  if (segment.includes("due") || segment.includes("next session")) {
    const nextVisitDays = daysUntil(client?.nextVisit, now);
    return nextVisitDays !== null && nextVisitDays <= 7;
  }
  if (segment === "active clients") {
    return !retention.includes("inactive") && lastVisitAge !== null && lastVisitAge >= 0 && lastVisitAge < 90;
  }
  if (segment.includes("birthday")) {
    const birthday = String(client?.birthday ?? "").trim();
    const current = now instanceof Date ? now : new Date(now);
    return /^\d{4}-\d{2}-\d{2}$/.test(birthday)
      && !Number.isNaN(current.getTime())
      && Number(birthday.slice(5, 7)) === current.getUTCMonth() + 1;
  }
  if (segment.includes("vip")) return tag.includes("vip");
  if (segment.includes("inactive 60")) return lastVisitAge !== null && lastVisitAge >= 60;
  if (segment.includes("inactive 30")) return lastVisitAge !== null && lastVisitAge >= 30;
  if (segment.includes("inactive")) return retention.includes("inactive") || (lastVisitAge !== null && lastVisitAge >= 90);
  if (segment.includes("returning")) return retention.includes("return") || tag.includes("return");
  if (segment.includes("new")) return retention.includes("new") || source.includes("online");
  if (segment.includes("package")) return Boolean(packageBalance && packageBalance !== "none");
  if (segment.includes("last visit")) return Boolean(String(client?.lastVisit ?? "").trim());

  return true;
}

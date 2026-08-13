export const ARCHIVED_ROOM_STATUS = "Archived";

export function normalizeRoomName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function roomNameKey(value) {
  return normalizeRoomName(value).toLocaleLowerCase("en");
}

export function isActiveRoom(room) {
  return String(room?.status || "Available") !== ARCHIVED_ROOM_STATUS;
}

export function activeRoomRecords(rooms = []) {
  return rooms.filter(isActiveRoom);
}

export function findRoomNameMatch(rooms = [], name = "") {
  const key = roomNameKey(name);
  if (!key) return null;
  return rooms.find((room) => roomNameKey(room?.name) === key) ?? null;
}

export function isUpcomingRoomAppointment(appointment, { date, minutes }) {
  if (!appointment?.date || appointment.date < date) return false;
  if (appointment.date > date) return true;

  const match = String(appointment.time || "").trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return true;
  let hours = Number(match[1]);
  const appointmentMinutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const end = hours * 60 + appointmentMinutes + Math.max(15, Number(appointment.duration || 0));
  return end > minutes;
}

const branchReferenceFields = Object.freeze([
  ["client", "branch"],
  ["staffMember", "branch"],
  ["account", "branch"],
  ["userInvitation", "branch"],
  ["attendanceEvent", "branch"],
  ["faceTrackAttendanceRecord", "branch"],
  ["faceTrackKioskDevice", "branch"],
  ["appointment", "branch"],
  ["inventoryItem", "branch"],
  ["inventoryMovement", "branch"],
  ["sale", "branch"],
  ["clinicPackage", "branch"],
  ["giftCertificate", "branch"],
  ["lead", "branch"],
  ["lead", "assignedBranch"],
  ["expense", "branch"],
  ["uploadAsset", "branch"],
]);

function parseBranchList(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function renameServiceBranches(value, previousName, nextName) {
  const branches = parseBranchList(value);
  if (!branches.includes(previousName)) return null;
  return JSON.stringify([...new Set(branches.map((branch) => branch === previousName ? nextName : branch))]);
}

export function nextRoomNames(existingRooms, count) {
  const used = new Set(existingRooms.map((room) => room.name));
  const names = [];
  let index = 1;
  while (names.length < count) {
    const name = `Room ${index}`;
    if (!used.has(name)) names.push(name);
    index += 1;
  }
  return names;
}

export async function renameBranchReferences(database, previousName, nextName) {
  if (previousName === nextName) return;
  const directUpdates = branchReferenceFields.map(([model, field]) => database[model].updateMany({
    where: { [field]: previousName },
    data: { [field]: nextName },
  }));
  const services = await database.service.findMany({ select: { id: true, branches: true } });
  const serviceUpdates = services.flatMap((service) => {
    const branches = renameServiceBranches(service.branches, previousName, nextName);
    return branches === null
      ? []
      : [database.service.update({ where: { id: service.id }, data: { branches } })];
  });
  await Promise.all([...directUpdates, ...serviceUpdates]);
}

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import express from "express";

import { ORGANIZATION_MANAGER_ROLES } from "../src/organizationRoles.js";

const ADMIN_ROLES = new Set([...ORGANIZATION_MANAGER_ROLES, "Branch Manager"]);
const MODULE_ID = "facetrack-attendance";
const verificationAttempts = new Map();
const kioskVerificationAttempts = new Map();

function apiError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clean(value) {
  return String(value ?? "").trim();
}

function attachmentReference(value) {
  const reference = clean(value);
  if (!reference) return "";
  if (!reference.startsWith("/api/uploads/")) throw apiError("Correction attachments must use secure object storage.");
  return reference;
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function requireAccount(request) {
  if (!request.authAccount) throw apiError("Authentication is required.", 401);
  return request.authAccount;
}

function requireAdmin(request) {
  const account = requireAccount(request);
  if (!ADMIN_ROLES.has(account.role)) throw apiError("Administrator approval is required for this action.", 403);
  return account;
}

function enforceVerificationRateLimit(request) {
  const account = requireAccount(request);
  const key = `${account.id}:${request.ip}`;
  const now = Date.now();
  const recent = (verificationAttempts.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 12) throw apiError("Too many face-verification attempts. Please wait one minute.", 429);
  recent.push(now);
  verificationAttempts.set(key, recent);
}

function enforceKioskRateLimit(request, device) {
  const key = `${device.id}:${request.ip}`;
  const now = Date.now();
  const recent = (kioskVerificationAttempts.get(key) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 20) throw apiError("Too many kiosk verification attempts. Please wait one minute.", 429);
  recent.push(now);
  kioskVerificationAttempts.set(key, recent);
}

function hashSecret(value) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(String(value), salt, 64).toString("hex")}`;
}

function verifySecret(value, storedHash) {
  const [scheme, salt, expectedHex] = clean(storedHash).split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(String(value ?? ""), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function kioskTokenHash(token) {
  return createHash("sha256").update(clean(token)).digest("hex");
}

function encryptionKey() {
  const secret = process.env.FACETRACK_ENCRYPTION_KEY || (process.env.NODE_ENV !== "production" ? process.env.DATABASE_URL : "");
  if (!secret) throw apiError("FaceTrack encryption is not configured.", 503);
  return createHash("sha256").update(secret).digest();
}

function encryptDescriptor(descriptor) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(descriptor), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptDescriptor(payload) {
  const [version, iv, tag, encrypted] = clean(payload).split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw apiError("The enrolled face profile is invalid.", 500);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"));
}

function validDescriptor(value) {
  return Array.isArray(value) && value.length === 128 && value.every((item) => Number.isFinite(Number(item)) && Math.abs(Number(item)) <= 2);
}

function averageDescriptors(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length < 3 || descriptors.length > 5 || !descriptors.every(validDescriptor)) {
    throw apiError("Three to five valid live face samples are required.");
  }
  return Array.from({ length: 128 }, (_, index) => descriptors.reduce((sum, sample) => sum + Number(sample[index]), 0) / descriptors.length);
}

function euclideanDistance(left, right) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + (Number(value) - Number(right[index])) ** 2, 0));
}

function selectUniqueMatch(candidates, descriptor, threshold, ambiguityGap = 0.05) {
  const ranked = candidates
    .map((candidate) => ({ ...candidate, distance: euclideanDistance(candidate.descriptor, descriptor) }))
    .sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  if (!best || best.distance > threshold) throw apiError("Face not recognized. Ask an administrator to confirm enrollment.", 403);
  if (ranked[1] && ranked[1].distance - best.distance < ambiguityGap) {
    throw apiError("Face match was ambiguous. Please reposition and try again.", 409);
  }
  return best;
}

function parseSchedule(schedule) {
  const matches = clean(schedule).match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  return matches ? [matches[1], matches[2]] : ["9:00 AM", "6:00 PM"];
}

function clockMinutes(value) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) throw apiError("The employee schedule is invalid.", 409);
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function zonedWorkDate(date, timezone) {
  const parts = zonedParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timezoneOffsetMs(date, timezone) {
  const parts = zonedParts(date, timezone);
  const representedUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return representedUtc - date.getTime();
}

function dateAtWorkClock(workDate, minutes, timezone, addDay = false) {
  const [year, month, day] = workDate.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day + (addDay ? 1 : 0), Math.floor(minutes / 60), minutes % 60));
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, timezone));
  return new Date(guess.getTime() - timezoneOffsetMs(first, timezone));
}

function scheduleFor(staff, policy, now = new Date()) {
  const [startText, endText] = parseSchedule(staff.schedule);
  const startMinutes = clockMinutes(startText);
  const endMinutes = clockMinutes(endText);
  const workDate = zonedWorkDate(now, policy.timezone);
  return {
    workDate,
    scheduledStart: dateAtWorkClock(workDate, startMinutes, policy.timezone),
    scheduledEnd: dateAtWorkClock(workDate, endMinutes, policy.timezone, endMinutes <= startMinutes),
  };
}

function calculatedFields(record, policy) {
  const timeIn = record.timeIn ? new Date(record.timeIn) : null;
  const timeOut = record.timeOut ? new Date(record.timeOut) : null;
  const scheduledStart = new Date(record.scheduledStart);
  const scheduledEnd = new Date(record.scheduledEnd);
  const lateMinutes = timeIn ? Math.max(0, Math.floor((timeIn.getTime() - scheduledStart.getTime()) / 60_000) - policy.graceMinutes) : 0;
  const workedMinutes = timeIn && timeOut ? Math.max(0, Math.floor((timeOut.getTime() - timeIn.getTime()) / 60_000)) : 0;
  const rawOvertime = timeOut ? Math.max(0, Math.floor((timeOut.getTime() - scheduledEnd.getTime()) / 60_000)) : 0;
  const calculatedOvertimeMinutes = rawOvertime >= policy.overtimeMinimumMinutes ? rawOvertime : 0;
  const overtimeStatus = calculatedOvertimeMinutes
    ? policy.overtimeRequiresApproval ? "PENDING_APPROVAL" : "APPROVED"
    : "NOT_APPLICABLE";
  return {
    lateMinutes,
    workedMinutes,
    calculatedOvertimeMinutes,
    approvedOvertimeMinutes: policy.overtimeRequiresApproval ? Number(record.approvedOvertimeMinutes || 0) : calculatedOvertimeMinutes,
    overtimeStatus,
    status: timeIn && timeOut ? "COMPLETE" : "OPEN",
  };
}

function serializeRecord(record) {
  return {
    ...record,
    staffName: record.staff?.name,
    staffRole: record.staff?.role,
    correctionRequests: record.correctionRequests ?? [],
  };
}

async function policyFor(prisma) {
  return prisma.faceTrackPolicy.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}

async function consumeChallenge(tx, accountId, challengeId, purpose) {
  const challenge = await tx.faceTrackChallenge.findFirst({ where: { id: clean(challengeId), accountId, purpose } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) throw apiError("The camera verification session expired. Please try again.", 409);
  await tx.faceTrackChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
}

async function kioskFromRequest(prisma, request) {
  const cookieToken = clean(request.headers.cookie).split(";").map((item) => item.trim()).find((item) => item.startsWith("macesoft_kiosk="))?.slice("macesoft_kiosk=".length);
  const token = clean(request.get("X-FaceTrack-Kiosk-Token") || (cookieToken ? decodeURIComponent(cookieToken) : ""));
  if (token.length < 32) throw apiError("This iPad is not registered as a FaceTrack kiosk.", 401);
  const device = await prisma.faceTrackKioskDevice.findUnique({ where: { tokenHash: kioskTokenHash(token) } });
  if (!device?.active) throw apiError("This FaceTrack kiosk is inactive. Ask an administrator to set it up again.", 403);
  return device;
}

async function consumeKioskChallenge(tx, deviceId, challengeId) {
  const challenge = await tx.faceTrackKioskChallenge.findFirst({
    where: { id: clean(challengeId), deviceId, purpose: "KIOSK_CLOCK" },
  });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) {
    throw apiError("The kiosk camera session expired. Please try again.", 409);
  }
  await tx.faceTrackKioskChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
}

async function recordVerifiedClock(prisma, { staff, profile, policy, confidence, idempotencyKey, actor, consume }) {
  const now = new Date();
  const schedule = scheduleFor(staff, policy, now);
  const record = await prisma.$transaction(async (tx) => {
    await consume(tx);
    const auditAction = `CLOCK:${idempotencyKey}`;
    const replay = await tx.faceTrackAuditEntry.findFirst({ where: { action: auditAction } });
    if (replay) throw apiError("This attendance request was already processed.", 409);
    const openRecord = await tx.faceTrackAttendanceRecord.findFirst({
      where: { staffId: staff.id, timeOut: null },
      orderBy: { scheduledStart: "desc" },
    });
    const existing = openRecord || await tx.faceTrackAttendanceRecord.findUnique({
      where: { staffId_workDate: { staffId: staff.id, workDate: schedule.workDate } },
    });
    let updated;
    let action;
    if (!existing) {
      action = "TIME_IN";
      const base = {
        staffId: staff.id,
        branch: staff.branch,
        timezone: policy.timezone,
        ...schedule,
        originalTimeIn: now,
        timeIn: now,
        timeInConfidence: confidence,
      };
      updated = await tx.faceTrackAttendanceRecord.create({ data: { ...base, ...calculatedFields(base, policy) } });
    } else if (!existing.timeOut) {
      if (now.getTime() - new Date(existing.timeIn).getTime() < 60_000) {
        throw apiError("Please wait before recording Time Out.", 409);
      }
      action = "TIME_OUT";
      const base = { ...existing, originalTimeOut: now, timeOut: now, timeOutConfidence: confidence };
      updated = await tx.faceTrackAttendanceRecord.update({
        where: { id: existing.id },
        data: { originalTimeOut: now, timeOut: now, timeOutConfidence: confidence, ...calculatedFields(base, policy) },
      });
    } else {
      throw apiError("Today's Time In and Time Out are already complete.", 409);
    }
    await tx.faceTrackProfile.update({ where: { id: profile.id }, data: { lastVerifiedAt: now } });
    await tx.staffMember.update({ where: { id: staff.id }, data: { attendance: action === "TIME_IN" ? "Clocked in" : "Clocked out" } });
    await tx.faceTrackAuditEntry.create({
      data: {
        attendanceRecordId: updated.id,
        actorAccountId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: auditAction,
        finalValues: JSON.stringify({ action, occurredAt: now, confidence, ...actor.metadata }),
      },
    });
    return { ...updated, action, staff };
  });
  return { record, now };
}

export function createFaceTrackAttendanceRouter(prisma) {
  const router = express.Router();

  router.get("/overview", asyncRoute(async (request, response) => {
    const account = requireAccount(request);
    const policy = await policyFor(prisma);
    const admin = ADMIN_ROLES.has(account.role);
    if (!admin && !account.staffId) throw apiError("This account is not linked to an employee profile.", 409);
    const branchWhere = admin && account.branch !== "All branches" ? { branch: account.branch } : {};
    const recordWhere = admin ? branchWhere : { staffId: account.staffId };
    const requestWhere = admin ? { attendanceRecord: branchWhere } : { requestedById: account.id };
    const [records, requests, staff, profiles, auditEntries] = await Promise.all([
      prisma.faceTrackAttendanceRecord.findMany({ where: recordWhere, include: { staff: true, correctionRequests: { orderBy: { createdAt: "desc" } } }, orderBy: { workDate: "desc" }, take: 150 }),
      prisma.faceTrackCorrectionRequest.findMany({ where: requestWhere, include: { attendanceRecord: { include: { staff: true } }, requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      admin ? prisma.staffMember.findMany({ where: account.branch !== "All branches" ? { branch: account.branch } : {}, orderBy: { name: "asc" } }) : Promise.resolve([]),
      admin ? prisma.faceTrackProfile.findMany({ where: { active: true, staff: account.branch !== "All branches" ? { branch: account.branch } : {} }, select: { staffId: true, consentAt: true, lastVerifiedAt: true } }) : prisma.faceTrackProfile.findMany({ where: { staffId: account.staffId, active: true }, select: { staffId: true, consentAt: true, lastVerifiedAt: true } }),
      admin ? prisma.faceTrackAuditEntry.findMany({ where: { attendanceRecord: branchWhere }, include: { attendanceRecord: { include: { staff: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 250 }) : Promise.resolve([]),
    ]);
    const today = zonedWorkDate(new Date(), policy.timezone);
    const todayRecords = records.filter((record) => record.workDate === today);
    response.json({
      module: { id: MODULE_ID, name: "FaceTrack Attendance", enabled: policy.enabled },
      admin,
      policy,
      records: records.map(serializeRecord),
      requests,
      staff,
      profiles,
      auditEntries,
      stats: {
        clockedIn: todayRecords.filter((record) => record.status === "OPEN").length,
        completedToday: todayRecords.filter((record) => record.status === "COMPLETE").length,
        lateToday: todayRecords.filter((record) => record.lateMinutes > 0).length,
        pendingCorrections: requests.filter((item) => item.status === "PENDING").length,
        pendingOvertime: records.filter((record) => record.overtimeStatus === "PENDING_APPROVAL").length,
      },
    });
  }));

  router.post("/challenge", asyncRoute(async (request, response) => {
    const account = requireAccount(request);
    enforceVerificationRateLimit(request);
    const purpose = clean(request.body?.purpose).toUpperCase();
    if (!["ENROLL", "CLOCK"].includes(purpose)) throw apiError("Unsupported verification purpose.");
    const nonce = randomBytes(24).toString("base64url");
    const challenge = await prisma.faceTrackChallenge.create({
      data: { accountId: account.id, purpose, nonceHash: createHash("sha256").update(nonce).digest("hex"), expiresAt: new Date(Date.now() + 2 * 60_000) },
    });
    response.status(201).json({ challengeId: challenge.id, nonce, expiresAt: challenge.expiresAt });
  }));

  router.post("/enroll", asyncRoute(async (request, response) => {
    const account = requireAccount(request);
    const staffId = clean(request.body?.staffId || account.staffId);
    const isSelf = staffId && staffId === account.staffId;
    if (!isSelf && !ADMIN_ROLES.has(account.role)) throw apiError("Only an administrator can enroll another employee.", 403);
    if (request.body?.consent !== true) throw apiError("Employee biometric consent is required.");
    const descriptor = averageDescriptors(request.body?.descriptors);
    const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
    if (!staff) throw apiError("Employee profile was not found.", 404);
    if (account.branch !== "All branches" && staff.branch !== account.branch) throw apiError("You cannot enroll an employee from another branch.", 403);
    const profile = await prisma.$transaction(async (tx) => {
      await consumeChallenge(tx, account.id, request.body?.challengeId, "ENROLL");
      return tx.faceTrackProfile.upsert({
        where: { staffId },
        update: { encryptedDescriptor: encryptDescriptor(descriptor), descriptorVersion: "face-api-v1", consentAt: new Date(), enrolledById: account.id, active: true },
        create: { staffId, encryptedDescriptor: encryptDescriptor(descriptor), descriptorVersion: "face-api-v1", consentAt: new Date(), enrolledById: account.id },
        select: { staffId: true, consentAt: true, lastVerifiedAt: true, active: true },
      });
    });
    response.status(201).json({ profile });
  }));

  router.post("/clock", asyncRoute(async (request, response) => {
    const account = requireAccount(request);
    enforceVerificationRateLimit(request);
    if (!account.staffId) throw apiError("This account is not linked to an employee profile.", 409);
    const idempotencyKey = clean(request.body?.idempotencyKey);
    if (idempotencyKey.length < 12) throw apiError("A valid attendance request key is required.");
    const descriptor = averageDescriptors(request.body?.descriptors);
    const [profile, staff, policy] = await Promise.all([
      prisma.faceTrackProfile.findUnique({ where: { staffId: account.staffId } }),
      prisma.staffMember.findUnique({ where: { id: account.staffId } }),
      policyFor(prisma),
    ]);
    if (!policy.enabled) throw apiError("FaceTrack Attendance is currently disabled.", 503);
    if (!profile?.active) throw apiError("Enroll your face profile before recording attendance.", 409);
    if (!staff || staff.status === "Inactive") throw apiError("This employee profile is not active.", 403);
    const distance = euclideanDistance(decryptDescriptor(profile.encryptedDescriptor), descriptor);
    if (distance > policy.matchThreshold) throw apiError("Face not recognized. Ask an administrator to verify your enrollment.", 403);
    const confidence = Math.max(0, Math.min(1, 1 - distance));
    const now = new Date();
    const schedule = scheduleFor(staff, policy, now);
    const record = await prisma.$transaction(async (tx) => {
      await consumeChallenge(tx, account.id, request.body?.challengeId, "CLOCK");
      const replay = await tx.faceTrackAuditEntry.findFirst({ where: { action: `CLOCK:${idempotencyKey}` } });
      if (replay) throw apiError("This attendance request was already processed.", 409);
      const openRecord = await tx.faceTrackAttendanceRecord.findFirst({ where: { staffId: staff.id, timeOut: null }, orderBy: { scheduledStart: "desc" } });
      const existing = openRecord || await tx.faceTrackAttendanceRecord.findUnique({ where: { staffId_workDate: { staffId: staff.id, workDate: schedule.workDate } } });
      let updated;
      let action;
      if (!existing) {
        action = "TIME_IN";
        const base = { staffId: staff.id, branch: staff.branch, timezone: policy.timezone, ...schedule, originalTimeIn: now, timeIn: now, timeInConfidence: confidence };
        updated = await tx.faceTrackAttendanceRecord.create({ data: { ...base, ...calculatedFields(base, policy) } });
      } else if (!existing.timeOut) {
        if (now.getTime() - new Date(existing.timeIn).getTime() < 60_000) throw apiError("Please wait before recording Time Out.", 409);
        action = "TIME_OUT";
        const base = { ...existing, originalTimeOut: now, timeOut: now, timeOutConfidence: confidence };
        updated = await tx.faceTrackAttendanceRecord.update({ where: { id: existing.id }, data: { originalTimeOut: now, timeOut: now, timeOutConfidence: confidence, ...calculatedFields(base, policy) } });
      } else {
        throw apiError("Today’s Time In and Time Out are already complete.", 409);
      }
      await tx.faceTrackProfile.update({ where: { id: profile.id }, data: { lastVerifiedAt: now } });
      await tx.staffMember.update({ where: { id: staff.id }, data: { attendance: action === "TIME_IN" ? "Clocked in" : "Clocked out" } });
      await tx.faceTrackAuditEntry.create({ data: { attendanceRecordId: updated.id, actorAccountId: account.id, actorName: account.name, actorRole: account.role, action: `CLOCK:${idempotencyKey}`, finalValues: JSON.stringify({ action, occurredAt: now, confidence }) } });
      return { ...updated, action, staff };
    });
    response.status(201).json({ record: serializeRecord(record), action: record.action, confidence });
  }));

  router.get("/kiosks", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const devices = await prisma.faceTrackKioskDevice.findMany({
      where: admin.branch === "All branches" ? {} : { branch: admin.branch },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, branch: true, active: true, lastSeenAt: true, createdByName: true, createdAt: true, updatedAt: true },
    });
    response.json({ devices });
  }));

  router.post("/kiosks", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const name = clean(request.body?.name);
    const branch = clean(request.body?.branch);
    const pin = clean(request.body?.pin);
    if (name.length < 3 || name.length > 80) throw apiError("Enter a kiosk name between 3 and 80 characters.");
    if (!branch || branch === "All branches") throw apiError("Assign the kiosk to one clinic branch.");
    if (admin.branch !== "All branches" && branch !== admin.branch) throw apiError("You can only register a kiosk for your branch.", 403);
    if (!/^\d{6}$/.test(pin)) throw apiError("Create a 6-digit administrator PIN for this kiosk.");
    const branchStaff = await prisma.staffMember.count({ where: { branch } });
    if (!branchStaff) throw apiError("The selected branch does not have any employees.", 409);
    const token = randomBytes(32).toString("base64url");
    const device = await prisma.faceTrackKioskDevice.create({
      data: {
        name,
        branch,
        tokenHash: kioskTokenHash(token),
        pinHash: hashSecret(pin),
        createdById: admin.id,
        createdByName: admin.name,
      },
      select: { id: true, name: true, branch: true, active: true, createdAt: true },
    });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    if (request.authSession?.id) await prisma.authSession.delete({ where: { id: request.authSession.id } });
    response.setHeader("Set-Cookie", [
      `macesoft_kiosk=${encodeURIComponent(token)}; Path=/api/facetrack-attendance/kiosk; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
      `macesoft_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    ]);
    response.status(201).json({ device });
  }));

  router.delete("/kiosks/:id", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const device = await prisma.faceTrackKioskDevice.findUnique({ where: { id: request.params.id } });
    if (!device) throw apiError("Kiosk device was not found.", 404);
    if (admin.branch !== "All branches" && device.branch !== admin.branch) throw apiError("You cannot manage another branch's kiosk.", 403);
    await prisma.faceTrackKioskDevice.update({ where: { id: device.id }, data: { active: false } });
    response.status(204).end();
  }));

  router.get("/kiosk/status", asyncRoute(async (request, response) => {
    const device = await kioskFromRequest(prisma, request);
    await prisma.faceTrackKioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    const enrolledEmployees = await prisma.faceTrackProfile.count({ where: { active: true, staff: { branch: device.branch } } });
    response.json({
      device: { id: device.id, name: device.name, branch: device.branch, active: device.active },
      enrolledEmployees,
      rawImagesStored: false,
    });
  }));

  router.post("/kiosk/challenge", asyncRoute(async (request, response) => {
    const device = await kioskFromRequest(prisma, request);
    enforceKioskRateLimit(request, device);
    const nonce = randomBytes(24).toString("base64url");
    const challenge = await prisma.faceTrackKioskChallenge.create({
      data: {
        deviceId: device.id,
        purpose: "KIOSK_CLOCK",
        nonceHash: createHash("sha256").update(nonce).digest("hex"),
        expiresAt: new Date(Date.now() + 2 * 60_000),
      },
    });
    response.status(201).json({ challengeId: challenge.id, nonce, expiresAt: challenge.expiresAt });
  }));

  router.post("/kiosk/clock", asyncRoute(async (request, response) => {
    const device = await kioskFromRequest(prisma, request);
    enforceKioskRateLimit(request, device);
    const idempotencyKey = clean(request.body?.idempotencyKey);
    if (idempotencyKey.length < 12) throw apiError("A valid kiosk attendance request key is required.");
    const descriptor = averageDescriptors(request.body?.descriptors);
    const policy = await policyFor(prisma);
    if (!policy.enabled) throw apiError("FaceTrack Attendance is currently disabled.", 503);
    const profiles = await prisma.faceTrackProfile.findMany({
      where: { active: true, staff: { branch: device.branch, status: { not: "Inactive" } } },
      include: { staff: true },
    });
    const candidates = [];
    for (const profile of profiles) {
      try {
        candidates.push({ profile, staff: profile.staff, descriptor: decryptDescriptor(profile.encryptedDescriptor) });
      } catch {
        // Skip a damaged profile instead of blocking attendance for the whole branch.
      }
    }
    if (!candidates.length) throw apiError("No enrolled employees are available for this kiosk branch.", 409);
    const match = selectUniqueMatch(candidates, descriptor, policy.matchThreshold);
    const confidence = Math.max(0, Math.min(1, 1 - match.distance));
    const { record, now } = await recordVerifiedClock(prisma, {
      staff: match.staff,
      profile: match.profile,
      policy,
      confidence,
      idempotencyKey,
      actor: {
        id: `KIOSK:${device.id}`,
        name: device.name,
        role: "FaceTrack Kiosk",
        metadata: { deviceId: device.id, deviceName: device.name, branch: device.branch },
      },
      consume: (tx) => consumeKioskChallenge(tx, device.id, request.body?.challengeId),
    });
    await prisma.faceTrackKioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } });
    response.status(201).json({
      action: record.action,
      confidence,
      occurredAt: now,
      employee: {
        id: match.staff.id,
        name: match.staff.name,
        photo: match.staff.photo?.startsWith("/brand/") ? match.staff.photo : "",
        role: match.staff.role,
        branch: match.staff.branch,
      },
      record: serializeRecord(record),
    });
  }));

  router.post("/kiosk/unlock", asyncRoute(async (request, response) => {
    const device = await kioskFromRequest(prisma, request);
    enforceKioskRateLimit(request, device);
    if (!verifySecret(clean(request.body?.pin), device.pinHash)) throw apiError("The administrator PIN is incorrect.", 403);
    response.json({ verified: true });
  }));

  router.post("/correction-requests", asyncRoute(async (request, response) => {
    const account = requireAccount(request);
    if (!account.staffId) throw apiError("This account is not linked to an employee profile.", 409);
    const record = await prisma.faceTrackAttendanceRecord.findUnique({ where: { id: clean(request.body?.attendanceRecordId) } });
    if (!record || record.staffId !== account.staffId) throw apiError("Attendance record was not found.", 404);
    const pending = await prisma.faceTrackCorrectionRequest.findFirst({ where: { attendanceRecordId: record.id, status: "PENDING" } });
    if (pending) throw apiError("This attendance record already has a pending correction request.", 409);
    const requestedTimeIn = request.body?.requestedTimeIn ? new Date(request.body.requestedTimeIn) : null;
    const requestedTimeOut = request.body?.requestedTimeOut ? new Date(request.body.requestedTimeOut) : null;
    if ((!requestedTimeIn && !requestedTimeOut) || (requestedTimeIn && Number.isNaN(requestedTimeIn.getTime())) || (requestedTimeOut && Number.isNaN(requestedTimeOut.getTime()))) throw apiError("Provide a valid requested Time In or Time Out.");
    const reason = clean(request.body?.reason);
    if (reason.length < 10) throw apiError("Explain the correction in at least 10 characters.");
    const correction = await prisma.$transaction(async (tx) => {
      const created = await tx.faceTrackCorrectionRequest.create({ data: { attendanceRecordId: record.id, requestedById: account.id, requestedTimeIn, requestedTimeOut, originalTimeIn: record.timeIn, originalTimeOut: record.timeOut, reason, attachmentUrl: attachmentReference(request.body?.attachmentUrl) } });
      await tx.faceTrackAuditEntry.create({ data: { attendanceRecordId: record.id, correctionRequestId: created.id, actorAccountId: account.id, actorName: account.name, actorRole: account.role, action: "CORRECTION_REQUESTED", originalValues: JSON.stringify({ timeIn: record.timeIn, timeOut: record.timeOut }), requestedValues: JSON.stringify({ timeIn: requestedTimeIn, timeOut: requestedTimeOut }), reason } });
      return created;
    });
    response.status(201).json({ correction });
  }));

  router.post("/correction-requests/:id/review", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const decision = clean(request.body?.decision).toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) throw apiError("Choose Approve or Reject.");
    const comment = clean(request.body?.comment);
    if (decision === "REJECT" && !comment) throw apiError("An administrator comment is required when rejecting a request.");
    const policy = await policyFor(prisma);
    const correction = await prisma.$transaction(async (tx) => {
      const current = await tx.faceTrackCorrectionRequest.findUnique({ where: { id: request.params.id }, include: { attendanceRecord: true } });
      if (!current || current.status !== "PENDING") throw apiError("This correction request is no longer pending.", 409);
      if (admin.branch !== "All branches" && current.attendanceRecord.branch !== admin.branch) throw apiError("You cannot review another branch’s request.", 403);
      if (current.requestedById === admin.id) throw apiError("You cannot approve your own correction request.", 403);
      const now = new Date();
      let finalRecord = current.attendanceRecord;
      if (decision === "APPROVE") {
        const base = { ...current.attendanceRecord, timeIn: current.requestedTimeIn || current.attendanceRecord.timeIn, timeOut: current.requestedTimeOut || current.attendanceRecord.timeOut };
        if (base.timeIn && base.timeOut && new Date(base.timeOut) <= new Date(base.timeIn)) throw apiError("Time Out must be later than Time In.");
        finalRecord = await tx.faceTrackAttendanceRecord.update({ where: { id: current.attendanceRecordId }, data: { timeIn: base.timeIn, timeOut: base.timeOut, ...calculatedFields(base, policy) } });
      }
      const updated = await tx.faceTrackCorrectionRequest.update({ where: { id: current.id }, data: { status: decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedById: admin.id, adminComment: comment, reviewedAt: now, appliedAt: decision === "APPROVE" ? now : null } });
      await tx.faceTrackAuditEntry.create({ data: { attendanceRecordId: current.attendanceRecordId, correctionRequestId: current.id, actorAccountId: admin.id, actorName: admin.name, actorRole: admin.role, action: decision === "APPROVE" ? "CORRECTION_APPROVED" : "CORRECTION_REJECTED", originalValues: JSON.stringify({ timeIn: current.originalTimeIn, timeOut: current.originalTimeOut }), requestedValues: JSON.stringify({ timeIn: current.requestedTimeIn, timeOut: current.requestedTimeOut }), finalValues: JSON.stringify({ timeIn: finalRecord.timeIn, timeOut: finalRecord.timeOut }), reason: current.reason, comment } });
      return updated;
    });
    response.json({ correction });
  }));

  router.put("/policy", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const current = await policyFor(prisma);
    const data = {
      enabled: request.body?.enabled !== false,
      timezone: clean(request.body?.timezone) || current.timezone,
      graceMinutes: Math.max(0, Math.min(120, Number(request.body?.graceMinutes ?? current.graceMinutes))),
      matchThreshold: Math.max(0.35, Math.min(0.65, Number(request.body?.matchThreshold ?? current.matchThreshold))),
      overtimeMinimumMinutes: Math.max(0, Math.min(240, Number(request.body?.overtimeMinimumMinutes ?? current.overtimeMinimumMinutes))),
      overtimeRequiresApproval: request.body?.overtimeRequiresApproval !== false,
      retentionDays: Math.max(30, Math.min(3650, Number(request.body?.retentionDays ?? current.retentionDays))),
      updatedBy: admin.name,
    };
    try { new Intl.DateTimeFormat("en", { timeZone: data.timezone }).format(); } catch { throw apiError("Choose a valid IANA timezone."); }
    const policy = await prisma.faceTrackPolicy.update({ where: { id: "default" }, data });
    response.json({ policy });
  }));

  router.post("/records/:id/overtime", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    const status = clean(request.body?.status).toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(status)) throw apiError("Choose Approved or Rejected.");
    const current = await prisma.faceTrackAttendanceRecord.findUnique({ where: { id: request.params.id } });
    if (!current) throw apiError("Attendance record was not found.", 404);
    if (admin.branch !== "All branches" && current.branch !== admin.branch) throw apiError("You cannot review another branch’s overtime.", 403);
    const approvedMinutes = status === "APPROVED" ? Math.max(0, Math.min(current.calculatedOvertimeMinutes, Number(request.body?.approvedMinutes ?? current.calculatedOvertimeMinutes))) : 0;
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.faceTrackAttendanceRecord.update({ where: { id: current.id }, data: { overtimeStatus: status, approvedOvertimeMinutes: approvedMinutes } });
      await tx.faceTrackAuditEntry.create({ data: { attendanceRecordId: current.id, actorAccountId: admin.id, actorName: admin.name, actorRole: admin.role, action: `OVERTIME_${status}`, originalValues: JSON.stringify({ status: current.overtimeStatus, approvedMinutes: current.approvedOvertimeMinutes }), finalValues: JSON.stringify({ status, approvedMinutes }) } });
      return updated;
    });
    response.json({ record });
  }));

  router.delete("/profiles/:staffId", asyncRoute(async (request, response) => {
    const admin = requireAdmin(request);
    if (request.body?.confirm !== true) throw apiError("Confirm biometric profile deletion.");
    const profile = await prisma.faceTrackProfile.findUnique({ where: { staffId: request.params.staffId }, include: { staff: true } });
    if (!profile) throw apiError("Face profile was not found.", 404);
    if (admin.branch !== "All branches" && profile.staff.branch !== admin.branch) throw apiError("You cannot remove another branch’s face profile.", 403);
    await prisma.faceTrackProfile.delete({ where: { id: profile.id } });
    response.status(204).end();
  }));

  return router;
}

export const faceTrackInternals = {
  averageDescriptors,
  calculatedFields,
  dateAtWorkClock,
  euclideanDistance,
  parseSchedule,
  scheduleFor,
  selectUniqueMatch,
  zonedWorkDate,
};

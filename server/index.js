import "dotenv/config";
import cors from "cors";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import nodemailer from "nodemailer";
import { prisma } from "./prisma.js";
import { mvpModules, sidebarModules } from "./moduleRegistry.js";
import { initialSettings, roleAccess, users } from "../src/data.js";
import { canManageOrganization, isBusinessOwner } from "../src/organizationRoles.js";
import { createFaceTrackAttendanceRouter } from "./facetrackAttendance.js";
import { assertProductionEnvironment } from "./productionConfig.js";
import {
  branchWhere,
  canAccessBranch,
  canMutateBranch,
  filterServiceBranches,
  isAllBranches,
  isPublicApiRequest,
  moduleAllowed,
  requiredModuleForApiRequest,
} from "./accessControl.js";
import {
  assertGiftCertificateUsable,
  assertPackageRedeemable,
  giftCertificateAfterPayment,
  packageAfterRedemption,
  packageAfterVoid,
} from "./posTenders.js";

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const allowedOrigins = clean(process.env.APP_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
}));
app.use(express.json({
  limit: process.env.MAX_JSON_BODY || "2mb",
  verify: (request, _response, buffer) => {
    request.rawBody = buffer.toString("utf8");
  },
}));

app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "private, no-store");
  next();
});

app.use((request, response, next) => {
  const requestId = clean(request.get("x-request-id")) || randomBytes(12).toString("hex");
  const startedAt = process.hrtime.bigint();
  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  response.on("finish", () => {
    if (request.path.startsWith("/api/health/live") && response.statusCode < 400) return;
    const path = request.path.replace(/(\/api\/invitations\/accept\/)[^/]+/, "$1[redacted]");
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      timestamp: new Date().toISOString(),
      level: response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info",
      event: "http_request",
      requestId,
      method: request.method,
      path,
      status: response.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      actorId: request.authAccount?.id || "anonymous",
    };
    console.log(JSON.stringify(entry));
  });
  next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 1500),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many API requests. Please try again shortly." },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait 15 minutes." },
});
const publicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.PUBLIC_WRITE_RATE_LIMIT || 20),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait one minute." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", loginLimiter);
app.use("/api/auth/reset-password", loginLimiter);
app.use("/api/public-bookings", publicWriteLimiter);
app.use("/api/invitations/accept", publicWriteLimiter);
app.use("/api/leads/webhooks", publicWriteLimiter);

const clientStringFields = [
  "photo",
  "mobile",
  "email",
  "gender",
  "birthday",
  "address",
  "city",
  "emergency",
  "branch",
  "source",
  "referral",
  "medicalNotes",
  "allergies",
  "contraindications",
  "skinConcerns",
  "treatmentGoals",
  "consentStatus",
  "preferredStaff",
  "tag",
  "retention",
  "lastVisit",
  "nextVisit",
  "packageBalance",
];

const resourceModules = {
  clients: "clients",
  appointments: "appointments",
  services: "services",
  inventory: "inventory",
  treatments: "treatments",
  packages: "packages",
  giftCertificates: "packages",
  leads: "leads",
  staff: "staff",
  expenses: "expenses",
  discounts: "settings",
  smsTemplates: "sms",
  campaigns: "sms",
  transactions: "pos",
  auditLogs: "settings",
  inventoryMovements: "inventory",
};

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanOptional(value) {
  const next = clean(value);
  return next || null;
}

function envFlag(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function assetReference(value, label = "Image") {
  const reference = clean(value);
  if (!reference) return "";
  if (/^data:/i.test(reference)) {
    throw apiError(`${label} must be uploaded to secure object storage before saving.`, 400);
  }
  if (!reference.startsWith("/api/uploads/") && !reference.startsWith("/brand/")) {
    throw apiError(`${label} uses an unsupported storage location.`, 400);
  }
  return reference;
}

const uploadCategories = {
  "client-photo": { readModule: "clients", writeModule: "clients" },
  "staff-photo": { readModule: "staff", writeModule: "staff" },
  "inventory-photo": { readModule: "inventory", writeModule: "inventory" },
  "branch-photo": { readModule: null, writeModule: "branches" },
  "expense-receipt": { readModule: "expenses", writeModule: "expenses" },
  "treatment-photo": { readModule: "treatments", writeModule: "treatments" },
};

function storageConfig() {
  const baseUrl = clean(process.env.STORAGE_BASE_URL).replace(/\/$/, "");
  const bucket = clean(process.env.STORAGE_BUCKET);
  const serviceKey = clean(process.env.STORAGE_SERVICE_KEY);
  if (!baseUrl || !bucket || !serviceKey) throw apiError("Secure object storage is not configured.", 503);
  return { baseUrl, bucket, serviceKey };
}

function decodeImageDataUrl(value) {
  const match = clean(value).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw apiError("Upload a JPEG, PNG, or WebP image.", 415);
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  const maximum = Number(process.env.MAX_UPLOAD_BYTES || 3 * 1024 * 1024);
  if (!buffer.length || buffer.length > maximum) throw apiError("Image must be 3 MB or smaller.", 413);
  const validSignature = mimeType === "image/jpeg"
    ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : mimeType === "image/png"
      ? buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!validSignature) throw apiError("Image content does not match its declared file type.", 415);
  return { buffer, mimeType, extension: mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] };
}

async function storageRequest(objectPath, options = {}) {
  const { baseUrl, bucket, serviceKey } = storageConfig();
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {}),
    },
  });
}

function apiError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function requireText(value, label) {
  const text = clean(value);
  if (!text) {
    throw apiError(`${label} is required.`);
  }
  return text;
}

function numberValue(value, label, { min = null, integer = false } = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) {
    throw apiError(`${label} must be a valid number.`);
  }
  if (min !== null && number < min) {
    throw apiError(`${label} must be at least ${min}.`);
  }
  return integer ? Math.trunc(number) : number;
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  const text = clean(value);
  if (!text) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch {
      // Fall through to comma parsing.
    }
  }

  return text.split(",").map(clean).filter(Boolean);
}

const appointmentStatuses = [
  "Draft",
  "Pending Confirmation",
  "Confirmed",
  "Arrived",
  "Checked In",
  "In Treatment",
  "Completed",
  "Cancelled",
  "No Show",
  "Rescheduled",
];
const legacyAppointmentStatusMap = {
  Pending: "Pending Confirmation",
  "In Progress": "In Treatment",
  "No-show": "No Show",
};
const activeAppointmentStatuses = ["Pending Confirmation", "Confirmed", "Arrived", "Checked In", "In Treatment", "Rescheduled"];
const databaseActiveAppointmentStatuses = [...activeAppointmentStatuses, "Pending", "In Progress"];
// Status changes may be corrected manually from the Kanban board. Operational
// safeguards (clinic hours, room/staff conflicts, and valid status values) are
// still enforced below when a card is moved back into an active state.
const appointmentStatusTransitions = Object.fromEntries(
  appointmentStatuses.map((status) => [status, appointmentStatuses.filter((nextStatus) => nextStatus !== status)]),
);
const leadStages = [
  "New Inquiry",
  "Contact Attempted",
  "Connected",
  "Qualified",
  "Consultation Scheduled",
  "Appointment Booked",
  "Proposal or Treatment Plan Sent",
  "Follow-Up",
  "Converted",
  "Not Interested",
  "Unresponsive",
  "Lost",
  "Invalid or Spam",
];
const legacyLeadStatusMap = {
  New: "New Inquiry",
  Contacted: "Connected",
  Booked: "Appointment Booked",
  "Follow-up": "Follow-Up",
  Followup: "Follow-Up",
  Spam: "Invalid or Spam",
};
const closedLeadStages = ["Converted", "Not Interested", "Lost", "Invalid or Spam"];
// Pipeline stages can be corrected manually in either direction. Stage-specific
// data requirements (linked appointments/clients, loss reasons, and contact
// details) remain enforced by validateLeadRules.
const leadStageTransitions = Object.fromEntries(
  leadStages.map((stage) => [stage, leadStages.filter((nextStage) => nextStage !== stage)]),
);
const leadLossReasons = [
  "No response",
  "Not interested",
  "Price concern",
  "Chose competitor",
  "Service unavailable",
  "Location unsuitable",
  "Schedule conflict",
  "Duplicate",
  "Invalid contact",
  "Spam",
  "Not medically eligible",
  "Other",
];
const integrationDefaults = [
  { provider: "website", label: "Website and Landing Page Forms", requires: ["LEADS_WEBHOOK_SECRET or LEADS_API_KEY"] },
  { provider: "meta-facebook", label: "Meta Facebook Lead Ads", requires: ["META_APP_SECRET", "META_VERIFY_TOKEN", "META_PAGE_ACCESS_TOKEN"] },
  { provider: "instagram", label: "Instagram Inquiries", requires: ["Approved Meta Instagram/Messaging integration"] },
  { provider: "messenger", label: "Facebook Messenger", requires: ["Approved Meta Messaging integration"] },
  { provider: "google-ads", label: "Google Ads Lead Forms", requires: ["GOOGLE_ADS_WEBHOOK_SECRET or Google Ads API credentials"] },
  { provider: "google-business", label: "Google Business Profile", requires: ["Tracked links or Google Business messaging provider"] },
  { provider: "tiktok", label: "TikTok Lead Generation", requires: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] },
  { provider: "whatsapp", label: "WhatsApp Business", requires: ["WhatsApp Business Platform or approved provider credentials"] },
  { provider: "email", label: "Inquiry Mailbox", requires: ["IMAP/Graph/Gmail mailbox access"] },
  { provider: "offline", label: "Phone, Walk-in, Referral, Events", requires: [] },
  { provider: "third-party", label: "Zapier, Make, n8n, Custom Systems", requires: ["LEADS_WEBHOOK_SECRET or LEADS_API_KEY"] },
];
const webhookRateLimit = new Map();
const scheduleStartMinutes = 8 * 60;
const scheduleEndMinutes = 20 * 60;
const lunchStartMinutes = 12 * 60;
const lunchEndMinutes = 13 * 60;

function canonicalAppointmentStatus(status) {
  const next = clean(status);
  if (!next) return "Pending Confirmation";
  return legacyAppointmentStatusMap[next] ?? next;
}

function isActiveAppointmentStatus(status) {
  return activeAppointmentStatuses.includes(canonicalAppointmentStatus(status));
}

function canonicalLeadStatus(status) {
  const next = clean(status);
  if (!next) return "New Inquiry";
  const mapped = legacyLeadStatusMap[next] ?? next;
  return leadStages.includes(mapped) ? mapped : "New Inquiry";
}

function jsonText(value, fallback = {}) {
  return JSON.stringify(value ?? fallback);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "y", "on", "consented", "accepted"].includes(text);
}

function readPath(payload, path) {
  if (!path) return "";
  return String(path)
    .split(".")
    .reduce((current, segment) => (current && typeof current === "object" ? current[segment] : undefined), payload);
}

function firstValue(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      const nested = firstValue(...value);
      if (clean(nested)) return nested;
      continue;
    }
    if (clean(value)) return value;
  }
  return "";
}

function safeJsonSummary(value) {
  const source = value && typeof value === "object" ? value : {};
  const summary = {};
  for (const [key, raw] of Object.entries(source).slice(0, 80)) {
    if (/token|secret|password|authorization|cookie/i.test(key)) continue;
    if (raw && typeof raw === "object") {
      summary[key] = Array.isArray(raw) ? `[${raw.length} items]` : "{...}";
    } else {
      const text = clean(raw);
      summary[key] = text.length > 180 ? `${text.slice(0, 180)}...` : text;
    }
  }
  return summary;
}

function asIsoString(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? clean(value) : date.toISOString();
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function calculateSlaDueAt(source, createdAt = new Date()) {
  const normalizedSource = clean(source).toLowerCase();
  const minutes = normalizedSource.includes("website")
    ? 15
    : normalizedSource.includes("facebook") || normalizedSource.includes("instagram") || normalizedSource.includes("google") || normalizedSource.includes("tiktok")
      ? 5
      : 60;
  return addMinutes(createdAt, minutes).toISOString();
}

function calculateSlaState(lead) {
  if (closedLeadStages.includes(canonicalLeadStatus(lead.status))) return "Closed";
  if (lead.firstRespondedAt) return "Responded";
  const dueAt = clean(lead.slaDueAt);
  if (!dueAt) return "On time";
  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) return "On time";
  const remaining = dueTime - Date.now();
  if (remaining < 0) return "Overdue";
  if (remaining < 10 * 60_000) return "Approaching deadline";
  return "On time";
}

function leadScore(values) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => {
    score += points;
    reasons.push({ points, reason });
  };

  if (clean(values.interest) || clean(values.interestedTreatment) || clean(values.interestedPackage)) add(20, "Identified service or treatment interest");
  if (clean(values.mobile) && clean(values.email)) add(15, "Complete phone and email");
  else if (clean(values.mobile) || clean(values.email) || clean(values.socialProfileId) || clean(values.channelContactId)) add(10, "Reachable contact method");
  if (clean(values.preferredDate) || clean(values.preferredTime)) add(15, "Shared preferred appointment schedule");
  if (["High", "Urgent"].includes(clean(values.urgency))) add(12, "High urgency inquiry");
  if (clean(values.budgetRange)) add(8, "Budget readiness captured");
  if (clean(values.branch) || clean(values.assignedBranch)) add(8, "Routed to a branch");
  if (parseBoolean(values.permissionToContact, true)) add(7, "Permission to respond captured");
  if (clean(values.campaign) || clean(values.utmCampaign)) add(5, "Campaign attribution available");

  return { score: Math.min(100, score), reasons };
}

function validateLeadRules(data, previous = null) {
  const status = canonicalLeadStatus(data.status);
  const oldStatus = previous ? canonicalLeadStatus(previous.status) : "";
  const allowed = previous ? leadStageTransitions[oldStatus] ?? [] : [];
  const sameStatus = !previous || status === oldStatus;
  const enteringStage = !previous || !sameStatus;
  if (previous && !sameStatus && !allowed.includes(status)) {
    throw apiError(`Lead cannot move from ${oldStatus} to ${status}.`, 409);
  }

  const hasContact = clean(data.mobile) || clean(data.email) || clean(data.socialProfileId) || clean(data.channelContactId);
  if (enteringStage && status === "Qualified" && (!hasContact || !clean(data.interest || data.interestedTreatment || data.interestedPackage || data.concern))) {
    throw apiError("A lead cannot become Qualified without a contact method and identified interest.", 400);
  }
  if (enteringStage && status === "Appointment Booked" && !clean(data.linkedAppointmentId)) {
    throw apiError("A lead cannot become Appointment Booked without a linked appointment.", 400);
  }
  if (enteringStage && status === "Converted" && !clean(data.linkedClientId)) {
    throw apiError("A lead cannot become Converted without a linked client.", 400);
  }
  if (enteringStage && status === "Lost") {
    const reason = clean(data.lossReason);
    if (!reason) throw apiError("A lost lead requires a loss reason.", 400);
    if (!leadLossReasons.includes(reason)) throw apiError("Select a valid loss reason for this lead.", 400);
  }
  if (enteringStage && status === "Unresponsive" && Number(data.followUpCount || 0) < 1 && !clean(data.nextFollowUpAt)) {
    throw apiError("A lead marked Unresponsive must retain follow-up history.", 400);
  }
}

function parseTimeToMinutes(value) {
  const raw = clean(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) {
    throw apiError("Appointment time must use HH:MM format.", 400);
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) {
    throw apiError("Appointment time must use a valid clock time.", 400);
  }
  return hours * 60 + minutes;
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function jsonList(value) {
  return JSON.stringify(splitList(value));
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return splitList(value);
  }
}

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function stripMeta(data) {
  const {
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    items: _items,
    activities: _activities,
    followUps: _followUps,
    touchpoints: _touchpoints,
    externalIdentities: _externalIdentities,
    assignments: _assignments,
    conversions: _conversions,
    webhookEvents: _webhookEvents,
    ...rest
  } = data;
  return rest;
}

function actorFromRequest(request) {
  if (request.authActor) return request.authActor;
  if (process.env.NODE_ENV === "test" && envFlag(process.env.API_ALLOW_TRUSTED_HEADERS)) {
    return {
      id: clean(request.get("x-mace-user-id")),
      name: clean(request.get("x-mace-user-name")) || "System",
      role: clean(request.get("x-mace-role")),
      branch: clean(request.get("x-mace-branch")) || "All branches",
    };
  }
  return { id: "", name: "System", role: "", branch: "All branches" };
}

function assertMutationAllowed(request, moduleId, branch = "") {
  const actor = actorFromRequest(request);
  if (!actor.role) {
    throw apiError("Authentication is required for this action.", 401);
  }

  if (!moduleAllowed(actor, moduleId, roleAccess)) {
    throw apiError(`Your role does not allow changes in ${moduleId}.`, 403);
  }

  const targetBranch = clean(branch);
  if (targetBranch && !canMutateBranch(actor, targetBranch)) {
    throw apiError(`You do not have access to ${targetBranch}.`, 403);
  }

  return actor;
}

function assertReadAllowed(request, moduleId) {
  const actor = actorFromRequest(request);
  if (!actor.role) throw apiError("Authentication is required.", 401);
  if (!moduleAllowed(actor, moduleId, roleAccess)) {
    throw apiError(`Your role does not allow access to ${moduleId}.`, 403);
  }
  return actor;
}

function auditData(request, { action, area, details }) {
  const actor = actorFromRequest(request);
  return {
    time: new Date().toLocaleString("en-PH"),
    actor: actor.name,
    role: actor.role || "System",
    area,
    action,
    details,
  };
}

async function writeAudit(tx, request, details) {
  return tx.auditLog.create({
    data: auditData(request, details),
  });
}

function normalizeClientPayload(payload, existingId = "") {
  const fullName = requireText(payload.fullName, "Client full name");
  const data = {
    fullName,
    balance: numberValue(payload.balance, "Client balance"),
    giftBalance: numberValue(payload.giftBalance, "Gift balance"),
    marketingOptIn: Boolean(payload.marketingOptIn),
  };

  if (payload.id && !existingId) {
    data.id = String(payload.id);
  }

  clientStringFields.forEach((field) => {
    data[field] = String(payload[field] ?? "");
  });
  data.photo = assetReference(data.photo, "Client photo");

  if (!data.source) data.source = "Walk-in";
  if (!data.consentStatus) data.consentStatus = "Pending";
  if (!data.tag) data.tag = "New";
  if (!data.retention) data.retention = "New";
  if (!data.packageBalance) data.packageBalance = "None";

  return data;
}

async function normalizeAppointmentPayload(payload, existingId = "") {
  const clientId = cleanOptional(payload.clientId);
  const serviceId = cleanOptional(payload.serviceId);
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  const service = serviceId ? await prisma.service.findUnique({ where: { id: serviceId } }) : null;

  const status = canonicalAppointmentStatus(payload.status);
  if (!appointmentStatuses.includes(status)) {
    throw apiError(`Unsupported appointment status: ${payload.status}.`, 400);
  }

  const data = {
    date: requireText(payload.date, "Appointment date"),
    time: requireText(payload.time, "Appointment time"),
    clientId,
    client: clean(client?.fullName) || requireText(payload.client || payload.clientName, "Client"),
    serviceId,
    service: clean(service?.name) || requireText(payload.service || payload.serviceName, "Service"),
    branch: requireText(payload.branch, "Branch"),
    room: clean(payload.room) || "To assign",
    staff: clean(payload.staff) || "Any available",
    duration: Math.max(15, numberValue(payload.duration || service?.duration || 60, "Duration", { min: 1, integer: true })),
    appointmentType: clean(payload.appointmentType) || "Treatment",
    insurance: clean(payload.insurance),
    tags: clean(payload.tags),
    packageName: clean(payload.packageName),
    timezone: clean(payload.timezone) || "Asia/Manila",
    recurrence: clean(payload.recurrence) || "None",
    recurrenceUntil: clean(payload.recurrenceUntil),
    status,
    deposit: numberValue(payload.deposit, "Deposit", { min: 0 }),
    leadId: clean(payload.leadId),
    notes: clean(payload.notes),
    internalNotes: clean(payload.internalNotes),
  };
  if (service) {
    const offeredBranches = parseJsonList(service.branches);
    if (offeredBranches.length && !offeredBranches.includes(data.branch) && !offeredBranches.includes("All branches")) {
      throw apiError("Selected service is not offered at this branch.", 409);
    }
  }

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeServicePayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Service name"),
    category: requireText(payload.category, "Service category"),
    duration: numberValue(payload.duration, "Duration", { min: 1, integer: true }),
    price: numberValue(payload.price, "Price", { min: 0 }),
    commission: clean(payload.commission),
    consumables: jsonList(payload.consumables),
    branches: jsonList(payload.branches),
    staff: jsonList(payload.staff),
    room: clean(payload.room),
    active: payload.active !== false,
    pos: payload.pos !== false,
    description: clean(payload.description),
    contraindications: clean(payload.contraindications),
    aftercare: clean(payload.aftercare),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeInventoryPayload(payload, existingId = "") {
  const stock = numberValue(payload.stock, "Current stock", { min: 0 });
  const data = {
    item: requireText(payload.item, "Product or consumable"),
    sku: clean(payload.sku),
    brand: clean(payload.brand),
    category: clean(payload.category),
    type: clean(payload.type) || "Consumable",
    unit: clean(payload.unit),
    packQty: numberValue(payload.packQty || 1, "Packaging quantity", { min: 1, integer: true }),
    beginning: numberValue(payload.beginning ?? stock, "Beginning quantity", { min: 0 }),
    stock,
    branch: requireText(payload.branch, "Branch"),
    location: clean(payload.location),
    reorder: numberValue(payload.reorder, "Reorder level", { min: 0 }),
    expiry: clean(payload.expiry),
    batch: clean(payload.batch),
    supplier: clean(payload.supplier),
    cost: numberValue(payload.cost, "Cost", { min: 0 }),
    price: numberValue(payload.price, "Retail price", { min: 0 }),
    image: assetReference(payload.image, "Inventory image"),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

async function normalizeTreatmentPayload(payload, existingId = "") {
  const clientId = requireText(payload.clientId, "Client");
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (!client) throw apiError("Selected client was not found.", 404);
  const data = {
    clientId,
    client: clean(client?.fullName) || requireText(payload.client, "Client"),
    date: requireText(payload.date, "Treatment date"),
    service: requireText(payload.service, "Service"),
    provider: clean(payload.provider),
    room: clean(payload.room),
    preNotes: clean(payload.preNotes),
    postNotes: clean(payload.postNotes),
    consumables: clean(payload.consumables),
    deviceSettings: clean(payload.deviceSettings),
    batch: clean(payload.batch),
    consent: clean(payload.consent) || "Pending",
    followUp: clean(payload.followUp),
    outcome: clean(payload.outcome),
    satisfaction: clean(payload.satisfaction),
    photos: numberValue(payload.photos, "Photos linked", { min: 0, integer: true }),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeLeadPayload(payload, existingId = "") {
  const firstName = clean(payload.firstName);
  const middleName = clean(payload.middleName);
  const lastName = clean(payload.lastName);
  const derivedName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const name = requireText(payload.name || payload.fullName || derivedName, "Lead name");
  const status = canonicalLeadStatus(payload.status);
  const source = clean(payload.source) || clean(payload.leadSource) || "Manual";
  const branch = requireText(payload.branch || payload.assignedBranch, "Branch");
  const created = clean(payload.created) || new Date().toISOString().slice(0, 10);
  const scoreDraft = {
    ...payload,
    name,
    source,
    branch,
    status,
    interest: clean(payload.interest || payload.interestedService),
    permissionToContact: parseBoolean(payload.permissionToContact, true),
  };
  const computedScore = leadScore(scoreDraft);
  const data = {
    name,
    firstName,
    middleName,
    lastName,
    preferredName: clean(payload.preferredName),
    mobile: clean(payload.mobile),
    alternateMobile: clean(payload.alternateMobile),
    email: clean(payload.email).toLowerCase(),
    socialProfileId: clean(payload.socialProfileId),
    channelContactId: clean(payload.channelContactId),
    preferredChannel: clean(payload.preferredChannel) || "Phone",
    source,
    sourcePlatform: clean(payload.sourcePlatform || payload.platform),
    campaign: clean(payload.campaign),
    adSet: clean(payload.adSet),
    adCreative: clean(payload.adCreative || payload.ad),
    landingPage: clean(payload.landingPage),
    referrerUrl: clean(payload.referrerUrl || payload.referringUrl || payload.referrer),
    utmSource: clean(payload.utmSource),
    utmMedium: clean(payload.utmMedium),
    utmCampaign: clean(payload.utmCampaign),
    utmContent: clean(payload.utmContent),
    utmTerm: clean(payload.utmTerm),
    clickId: clean(payload.clickId || payload.gclid || payload.fbclid || payload.ttclid),
    formId: clean(payload.formId),
    externalLeadId: clean(payload.externalLeadId),
    firstTouchSource: clean(payload.firstTouchSource) || source,
    latestTouchSource: clean(payload.latestTouchSource) || source,
    interest: clean(payload.interest || payload.interestedService),
    interestedTreatment: clean(payload.interestedTreatment),
    interestedPackage: clean(payload.interestedPackage),
    concern: clean(payload.concern || payload.mainConcern),
    message: clean(payload.message || payload.inquiry),
    preferredDate: clean(payload.preferredDate),
    preferredTime: clean(payload.preferredTime),
    budgetRange: clean(payload.budgetRange),
    urgency: clean(payload.urgency) || "Normal",
    inquiryType: clean(payload.inquiryType) || "First-time",
    status,
    priority: clean(payload.priority) || (["High", "Urgent"].includes(clean(payload.urgency)) ? "High" : "Normal"),
    score: numberValue(payload.score ?? computedScore.score, "Lead score", { min: 0, integer: true }),
    scoreReasons: jsonText(payload.scoreReasons || computedScore.reasons, []),
    owner: clean(payload.owner || payload.assignedStaff) || "Front Desk",
    assignedStaffId: clean(payload.assignedStaffId),
    branch,
    assignedBranch: clean(payload.assignedBranch) || branch,
    created,
    nextStep: clean(payload.nextStep || payload.nextAction),
    nextAction: clean(payload.nextAction || payload.nextStep),
    nextFollowUpAt: clean(payload.nextFollowUpAt),
    lastContactedAt: clean(payload.lastContactedAt),
    firstRespondedAt: clean(payload.firstRespondedAt),
    followUpCount: numberValue(payload.followUpCount, "Follow-up count", { min: 0, integer: true }),
    slaDueAt: clean(payload.slaDueAt) || calculateSlaDueAt(source, new Date()),
    slaState: clean(payload.slaState) || calculateSlaState(payload),
    outcome: clean(payload.outcome),
    lossReason: clean(payload.lossReason),
    permissionToContact: parseBoolean(payload.permissionToContact, true),
    marketingConsent: parseBoolean(payload.marketingConsent, false),
    privacyConsent: parseBoolean(payload.privacyConsent, false),
    consentSource: clean(payload.consentSource),
    consentTimestamp: clean(payload.consentTimestamp),
    consentVersion: clean(payload.consentVersion),
    consentText: clean(payload.consentText),
    linkedClientId: clean(payload.linkedClientId),
    linkedAppointmentId: clean(payload.linkedAppointmentId),
    convertedAt: clean(payload.convertedAt),
    convertedBy: clean(payload.convertedBy),
    duplicateOfLeadId: clean(payload.duplicateOfLeadId),
    duplicateConfidence: numberValue(payload.duplicateConfidence, "Duplicate confidence", { min: 0, integer: true }),
    duplicateReasons: jsonText(payload.duplicateReasons || [], []),
    archivedAt: clean(payload.archivedAt),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeStaffPayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Employee name"),
    photo: assetReference(payload.photo, "Employee photo"),
    role: requireText(payload.role, "Employee role"),
    branch: requireText(payload.branch, "Branch"),
    schedule: clean(payload.schedule),
    commissionType: clean(payload.commissionType),
    commissionRate: numberValue(payload.commissionRate, "Commission rate", { min: 0 }),
    services: clean(payload.services),
    status: clean(payload.status) || "Available",
    attendance: clean(payload.attendance) || "Clocked out",
    employmentDate: clean(payload.employmentDate),
    phone: clean(payload.phone),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

async function normalizePackagePayload(payload, existingId = "") {
  const clientId = cleanOptional(payload.clientId);
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  const sessions = numberValue(payload.sessions, "Sessions", { min: 0, integer: true });
  const used = numberValue(payload.used, "Used sessions", { min: 0, integer: true });
  if (used > sessions) {
    throw apiError("Used sessions cannot exceed total sessions.");
  }

  const data = {
    name: requireText(payload.name, "Package name"),
    clientId,
    client: clean(client?.fullName) || requireText(payload.client, "Client"),
    sessions,
    used,
    expires: clean(payload.expires),
    branch: clean(payload.branch) || "All branches",
    transferable: Boolean(payload.transferable),
    status: clean(payload.status) || (used >= sessions && sessions > 0 ? "Completed" : "Active"),
    price: numberValue(payload.price, "Package price", { min: 0 }),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeGiftCertificatePayload(payload, existingId = "") {
  const data = {
    code: requireText(payload.code, "Gift certificate code"),
    client: requireText(payload.client, "Client"),
    branch: clean(payload.branch) || "All branches",
    balance: numberValue(payload.balance, "Gift certificate balance", { min: 0 }),
    expires: clean(payload.expires),
    status: clean(payload.status) || "Active",
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeExpensePayload(payload, existingId = "") {
  const data = {
    date: requireText(payload.date, "Expense date"),
    name: requireText(payload.name, "Expense name"),
    category: requireText(payload.category, "Expense category"),
    branch: requireText(payload.branch, "Branch"),
    amount: numberValue(payload.amount, "Expense amount", { min: 0 }),
    method: clean(payload.method),
    approver: clean(payload.approver),
    status: clean(payload.status) || "For approval",
    notes: clean(payload.notes),
    receipt: clean(payload.receipt),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeDiscountPayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Discount name"),
    type: requireText(payload.type, "Discount type"),
    value: numberValue(payload.value, "Discount value", { min: 0 }),
    active: payload.active !== false,
    permission: clean(payload.permission),
    applicable: clean(payload.applicable),
    expiry: clean(payload.expiry),
    usage: numberValue(payload.usage, "Discount usage", { min: 0, integer: true }),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeSmsTemplatePayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Template name"),
    category: clean(payload.category),
    text: requireText(payload.text, "Template text"),
    active: payload.active !== false,
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeCampaignPayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Campaign name"),
    segment: requireText(payload.segment, "Campaign segment"),
    channel: requireText(payload.channel, "Campaign channel"),
    templateId: clean(payload.templateId),
    subject: clean(payload.subject),
    message: clean(payload.message),
    sent: numberValue(payload.sent, "Sent count", { min: 0, integer: true }),
    booked: numberValue(payload.booked, "Booked count", { min: 0, integer: true }),
    credits: numberValue(payload.credits, "Credits", { min: 0, integer: true }),
    status: clean(payload.status) || "Draft",
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeAuditPayload(payload, existingId = "") {
  const data = {
    time: clean(payload.time) || new Date().toLocaleString("en-PH"),
    actor: clean(payload.actor) || "System",
    role: clean(payload.role) || "System",
    area: clean(payload.area) || "System",
    action: requireText(payload.action, "Audit action"),
    details: clean(payload.details),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function serializeService(service) {
  return {
    ...service,
    consumables: parseJsonList(service.consumables),
    branches: parseJsonList(service.branches),
    staff: parseJsonList(service.staff),
  };
}

function serializeSale(sale) {
  return {
    ...sale,
    payments: parseJsonList(sale.payments),
    items: sale.items ?? [],
  };
}

function serializeBranch(branch) {
  return {
    ...branch,
    devices: parseJsonList(branch.devices),
    rooms: (branch.rooms ?? []).map((room) => room.name),
  };
}

function serializeLead(lead) {
  return {
    ...lead,
    scoreReasons: parseJsonList(lead.scoreReasons),
    duplicateReasons: parseJsonList(lead.duplicateReasons),
    slaState: calculateSlaState(lead),
    activities: lead.activities ?? [],
    followUps: lead.followUps ?? [],
    touchpoints: lead.touchpoints ?? [],
    externalIdentities: lead.externalIdentities ?? [],
    assignments: lead.assignments ?? [],
    conversions: lead.conversions ?? [],
    webhookEvents: lead.webhookEvents ?? [],
  };
}

async function validateLeadWrite(data, id = "") {
  const previous = id ? await prisma.lead.findUnique({ where: { id } }) : null;
  validateLeadRules(data, previous);
}

async function createLeadActivity(tx, request, leadId, values) {
  const actor = request ? actorFromRequest(request) : { name: values.actor || "System", role: values.actorRole || "System" };
  return tx.leadActivity.create({
    data: {
      leadId,
      type: requireText(values.type, "Activity type"),
      title: requireText(values.title, "Activity title"),
      note: clean(values.note),
      channel: clean(values.channel),
      actor: clean(values.actor) || actor.name || "System",
      actorRole: clean(values.actorRole) || actor.role || "System",
      previousStatus: clean(values.previousStatus),
      newStatus: clean(values.newStatus),
      metadata: jsonText(values.metadata || {}, {}),
      occurredAt: values.occurredAt ? new Date(values.occurredAt) : new Date(),
    },
  });
}

async function createLeadTouchpoint(tx, leadId, lead) {
  const source = clean(lead.source || lead.latestTouchSource || lead.utmSource);
  if (!source && !clean(lead.campaign || lead.utmCampaign || lead.clickId)) return null;
  return tx.leadTouchpoint.create({
    data: {
      leadId,
      source: source || "Unknown",
      platform: clean(lead.sourcePlatform),
      campaign: clean(lead.campaign || lead.utmCampaign),
      adSet: clean(lead.adSet),
      adCreative: clean(lead.adCreative),
      landingPage: clean(lead.landingPage),
      referrerUrl: clean(lead.referrerUrl),
      utmSource: clean(lead.utmSource),
      utmMedium: clean(lead.utmMedium),
      utmCampaign: clean(lead.utmCampaign),
      utmContent: clean(lead.utmContent),
      utmTerm: clean(lead.utmTerm),
      clickId: clean(lead.clickId),
    },
  });
}

async function createLeadFollowUpFromLead(tx, lead) {
  if (!clean(lead.nextFollowUpAt)) return null;
  return tx.leadFollowUp.create({
    data: {
      leadId: lead.id,
      dueAt: lead.nextFollowUpAt,
      assignedTo: clean(lead.owner) || "Front Desk",
      channel: clean(lead.preferredChannel) || "Phone",
      purpose: clean(lead.nextAction || lead.nextStep) || "Initial follow-up",
      notes: clean(lead.nextStep),
      status: "Upcoming",
    },
  });
}

async function writeLeadSideRecords(tx, request, lead, data, previous = null) {
  const actor = request ? actorFromRequest(request) : { name: "Lead Ingestion", role: "System" };
  if (!previous) {
    await createLeadActivity(tx, request, lead.id, {
      type: "Captured",
      title: "Lead captured",
      note: clean(lead.message || lead.concern || lead.nextStep),
      channel: clean(lead.preferredChannel),
      newStatus: lead.status,
      metadata: { source: lead.source, campaign: lead.campaign, branch: lead.branch },
    });
    if (clean(lead.owner)) {
      await tx.leadAssignment.create({
        data: {
          leadId: lead.id,
          previousOwner: "",
          newOwner: lead.owner,
          changedBy: actor.name,
          reason: "Initial assignment",
        },
      });
    }
    await createLeadTouchpoint(tx, lead.id, lead);
    await createLeadFollowUpFromLead(tx, lead);
    return;
  }

  if (canonicalLeadStatus(previous.status) !== canonicalLeadStatus(lead.status)) {
    await createLeadActivity(tx, request, lead.id, {
      type: "Stage Change",
      title: `Stage changed to ${lead.status}`,
      note: clean(data.lossReason || data.outcome || data.nextStep),
      previousStatus: previous.status,
      newStatus: lead.status,
      metadata: { lossReason: data.lossReason, linkedClientId: data.linkedClientId, linkedAppointmentId: data.linkedAppointmentId },
    });
  }

  if (clean(previous.owner) !== clean(lead.owner)) {
    await tx.leadAssignment.create({
      data: {
        leadId: lead.id,
        previousOwner: clean(previous.owner),
        newOwner: clean(lead.owner) || "Unassigned",
        changedBy: actor.name,
        reason: clean(data.assignmentReason) || "Manual reassignment",
      },
    });
    await createLeadActivity(tx, request, lead.id, {
      type: "Assignment",
      title: `Assigned to ${clean(lead.owner) || "Unassigned"}`,
      note: clean(data.assignmentReason),
    });
  }

  if (clean(previous.nextFollowUpAt) !== clean(lead.nextFollowUpAt)) {
    await createLeadFollowUpFromLead(tx, lead);
    if (clean(lead.nextFollowUpAt)) {
      await createLeadActivity(tx, request, lead.id, {
        type: "Follow-Up",
        title: "Follow-up scheduled",
        note: clean(lead.nextAction || lead.nextStep),
        metadata: { dueAt: lead.nextFollowUpAt },
      });
    }
  }
}

const resourceConfigs = {
  clients: {
    delegate: "client",
    module: "clients",
    area: "Client Records",
    label: (record) => record.fullName,
    orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
    normalize: normalizeClientPayload,
    branchField: "branch",
  },
  appointments: {
    delegate: "appointment",
    module: "appointments",
    area: "Appointments",
    label: (record) => `${record.client} for ${record.service}`,
    orderBy: [{ date: "desc" }, { time: "asc" }],
    normalize: normalizeAppointmentPayload,
    beforeWrite: assertAppointmentSlotAvailable,
    afterWrite: expandAppointmentRecurrence,
    branchField: "branch",
    relatedClient: true,
  },
  services: {
    delegate: "service",
    module: "services",
    area: "Services",
    label: (record) => record.name,
    orderBy: [{ name: "asc" }],
    normalize: normalizeServicePayload,
    serialize: serializeService,
    serviceBranches: true,
  },
  inventory: {
    delegate: "inventoryItem",
    module: "inventory",
    area: "Inventory",
    label: (record) => record.item,
    orderBy: [{ item: "asc" }],
    normalize: normalizeInventoryPayload,
    branchField: "branch",
  },
  treatments: {
    delegate: "treatment",
    module: "treatments",
    area: "Treatment Records",
    label: (record) => `${record.client} - ${record.service}`,
    orderBy: [{ date: "desc" }],
    normalize: normalizeTreatmentPayload,
    clientBranch: true,
    relatedClient: true,
  },
  packages: {
    delegate: "clinicPackage",
    module: "packages",
    area: "Packages",
    label: (record) => `${record.name} for ${record.client}`,
    orderBy: [{ updatedAt: "desc" }],
    normalize: normalizePackagePayload,
    branchField: "branch",
    relatedClient: true,
  },
  giftCertificates: {
    delegate: "giftCertificate",
    module: "packages",
    area: "Packages",
    label: (record) => record.code,
    orderBy: [{ expires: "asc" }],
    normalize: normalizeGiftCertificatePayload,
    branchField: "branch",
  },
  leads: {
    delegate: "lead",
    module: "leads",
    area: "Leads",
    label: (record) => record.name,
    orderBy: [{ updatedAt: "desc" }],
    normalize: normalizeLeadPayload,
    include: {
      activities: { orderBy: [{ occurredAt: "desc" }], take: 25 },
      followUps: { orderBy: [{ createdAt: "desc" }], take: 10 },
      touchpoints: { orderBy: [{ occurredAt: "desc" }], take: 10 },
      externalIdentities: true,
      assignments: { orderBy: [{ createdAt: "desc" }], take: 10 },
      conversions: true,
      webhookEvents: { orderBy: [{ receivedAt: "desc" }], take: 5 },
    },
    beforeWrite: validateLeadWrite,
    afterWrite: writeLeadSideRecords,
    serialize: serializeLead,
    branchField: "branch",
  },
  staff: {
    delegate: "staffMember",
    module: "staff",
    area: "Employees",
    label: (record) => record.name,
    orderBy: [{ name: "asc" }],
    normalize: normalizeStaffPayload,
    branchField: "branch",
  },
  expenses: {
    delegate: "expense",
    module: "expenses",
    area: "Expenses",
    label: (record) => record.name,
    orderBy: [{ date: "desc" }],
    normalize: normalizeExpensePayload,
    branchField: "branch",
  },
  discounts: {
    delegate: "discount",
    module: "settings",
    area: "Settings",
    label: (record) => record.name,
    orderBy: [{ name: "asc" }],
    normalize: normalizeDiscountPayload,
  },
  smsTemplates: {
    delegate: "smsTemplate",
    module: "sms",
    area: "Marketing",
    label: (record) => record.name,
    orderBy: [{ name: "asc" }],
    normalize: normalizeSmsTemplatePayload,
  },
  campaigns: {
    delegate: "marketingCampaign",
    module: "sms",
    area: "Marketing",
    label: (record) => record.name,
    orderBy: [{ updatedAt: "desc" }],
    normalize: normalizeCampaignPayload,
  },
  transactions: {
    delegate: "sale",
    module: "pos",
    area: "POS",
    label: (record) => record.invoice,
    orderBy: [{ date: "desc" }, { time: "desc" }],
    include: { items: true },
    readOnly: true,
    serialize: serializeSale,
    branchField: "branch",
  },
  auditLogs: {
    delegate: "auditLog",
    module: "settings",
    area: "Audit Log",
    label: (record) => record.action,
    orderBy: [{ createdAt: "desc" }],
    normalize: normalizeAuditPayload,
    readOnly: true,
  },
  inventoryMovements: {
    delegate: "inventoryMovement",
    module: "inventory",
    area: "Inventory",
    label: (record) => record.item,
    orderBy: [{ createdAt: "desc" }],
    readOnly: true,
    branchField: "branch",
  },
};

function configForResource(resource) {
  const config = resourceConfigs[resource];
  if (!config) {
    throw apiError(`Unknown resource: ${resource}`, 404);
  }
  return config;
}

async function listResource(resource, actor = null) {
  const config = configForResource(resource);
  if (actor && !moduleAllowed(actor, config.module, roleAccess)) return [];
  let where = {};
  if (actor && !isAllBranches(actor.branch)) {
    if (config.branchField) where = branchWhere(actor, config.branchField);
    if (config.clientBranch) {
      where = { clientRecord: { is: branchWhere(actor) } };
    }
  }
  const rows = await prisma[config.delegate].findMany({
    where,
    orderBy: config.orderBy,
    include: config.include,
  });

  const scopedRows = actor && config.serviceBranches ? filterServiceBranches(rows, actor) : rows;
  return config.serialize ? scopedRows.map(config.serialize) : scopedRows;
}

async function resourceBranch(config, record) {
  if (!record) return "";
  if (config.branchField) return clean(record[config.branchField]);
  if (config.clientBranch && record.clientId) {
    const client = await prisma.client.findUnique({ where: { id: record.clientId }, select: { branch: true } });
    return clean(client?.branch);
  }
  return "";
}

function assertServiceBranchChangeAllowed(actor, config, data) {
  if (!config.serviceBranches || isAllBranches(actor.branch)) return;
  const branches = parseJsonList(data.branches);
  if (branches.some((branch) => branch !== actor.branch)) {
    throw apiError("You can only manage services assigned exclusively to your branch.", 403);
  }
}

async function assertResourceMutationAllowed(request, config, record) {
  const branch = await resourceBranch(config, record);
  const actor = assertMutationAllowed(request, config.module, branch);
  if (config.relatedClient && record.clientId) {
    const client = await prisma.client.findUnique({ where: { id: record.clientId }, select: { branch: true } });
    if (!client) throw apiError("Related client was not found.", 404);
    if (!canAccessBranch(actor, client.branch)) throw apiError("You do not have access to the related client.", 403);
  }
  assertServiceBranchChangeAllowed(actor, config, record);
  return actor;
}

async function getPersistedSettings() {
  const row = await prisma.systemSetting.findUnique({ where: { key: "app" } });
  return row ? { ...initialSettings, ...parseJsonObject(row.value, initialSettings) } : initialSettings;
}

async function savePersistedSettings(values) {
  const next = {
    ...initialSettings,
    ...parseJsonObject(values, {}),
    taxRate: numberValue(values.taxRate, "Tax rate", { min: 0 }),
    smsCredits: numberValue(values.smsCredits, "SMS credits", { min: 0, integer: true }),
    hiddenSaasPlans: Boolean(values.hiddenSaasPlans),
  };

  await prisma.systemSetting.upsert({
    where: { key: "app" },
    update: { value: JSON.stringify(next) },
    create: { key: "app", value: JSON.stringify(next), updatedAt: new Date() },
  });

  return next;
}

function defaultLeadFieldMapping(_provider) {
  return {
    full_name: "name",
    name: "name",
    phone_number: "mobile",
    mobile: "mobile",
    email_address: "email",
    email: "email",
    preferred_service: "interest",
    service: "interest",
    treatment: "interestedTreatment",
    package: "interestedPackage",
    concern: "concern",
    message: "message",
    branch: "branch",
    location: "branch",
    campaign: "campaign",
    form_id: "formId",
    lead_id: "externalLeadId",
    external_lead_id: "externalLeadId",
  };
}

function providerEnvStatus(provider) {
  if (provider === "offline") {
    return { status: "Connected", summary: "Manual phone, walk-in, referral, and event lead entry is available." };
  }
  if (["website", "third-party"].includes(provider)) {
    const configured = Boolean(clean(process.env.LEADS_WEBHOOK_SECRET) || clean(process.env.LEADS_API_KEY));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured
        ? "Generic signed/API-key lead webhook endpoint is ready."
        : "Set LEADS_WEBHOOK_SECRET or LEADS_API_KEY before accepting external form submissions.",
    };
  }
  if (provider === "meta-facebook") {
    const configured = Boolean(clean(process.env.META_APP_SECRET) && clean(process.env.META_VERIFY_TOKEN) && clean(process.env.META_PAGE_ACCESS_TOKEN));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured
        ? "Meta webhook verification and signatures can be validated; form field capture still requires mapped forms."
        : "Missing Meta app secret, verify token, or page access token.",
    };
  }
  if (provider === "google-ads") {
    const configured = Boolean(clean(process.env.GOOGLE_ADS_WEBHOOK_SECRET) || clean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured ? "Google Ads lead form webhook/API credentials are present." : "Missing Google Ads webhook secret or API credentials.",
    };
  }
  if (provider === "tiktok") {
    const configured = Boolean(clean(process.env.TIKTOK_CLIENT_KEY) && clean(process.env.TIKTOK_CLIENT_SECRET));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured ? "TikTok API credentials are present." : "Missing TikTok Lead Generation credentials.",
    };
  }
  if (provider === "whatsapp") {
    const configured = Boolean(clean(process.env.WHATSAPP_ACCESS_TOKEN) && clean(process.env.WHATSAPP_PHONE_NUMBER_ID));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured ? "WhatsApp Business Platform credentials are present." : "Missing WhatsApp Business provider configuration.",
    };
  }
  if (provider === "email") {
    const configured = Boolean(clean(process.env.INQUIRY_MAILBOX_HOST) || clean(process.env.GMAIL_CLIENT_ID) || clean(process.env.MICROSOFT_GRAPH_CLIENT_ID));
    return {
      status: configured ? "Connected" : "Needs Configuration",
      summary: configured ? "Inquiry mailbox configuration is present." : "Missing mailbox/Graph/Gmail access for email lead capture.",
    };
  }
  return {
    status: "Needs Configuration",
    summary: "Requires approved provider configuration and source mapping.",
  };
}

async function listLeadIntegrations() {
  const rows = [];
  for (const item of integrationDefaults) {
    const envStatus = providerEnvStatus(item.provider);
    const row = await prisma.leadIntegration.upsert({
      where: { provider: item.provider },
      update: {
        label: item.label,
        status: envStatus.status,
        configSummary: envStatus.summary,
      },
      create: {
        provider: item.provider,
        label: item.label,
        status: envStatus.status,
        fieldMapping: jsonText(defaultLeadFieldMapping(item.provider), {}),
        configSummary: envStatus.summary,
      },
    });
    rows.push({
      ...row,
      fieldMapping: parseJsonObject(row.fieldMapping, {}),
      requiredConfiguration: item.requires,
      blockedReason: envStatus.status === "Connected" ? "" : envStatus.summary,
    });
  }
  return rows;
}

function rateLimitWebhook(request, provider) {
  const key = `${provider}:${request.ip || request.socket?.remoteAddress || "unknown"}`;
  const now = Date.now();
  const bucket = webhookRateLimit.get(key) ?? { count: 0, resetAt: now + 60_000 };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  webhookRateLimit.set(key, bucket);
  if (bucket.count > 120) {
    throw apiError("Lead webhook rate limit exceeded.", 429);
  }
}

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(clean(left));
  const rightBuffer = Buffer.from(clean(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function providerSecret(provider) {
  if (provider === "meta-facebook") return clean(process.env.META_APP_SECRET) || clean(process.env.LEADS_WEBHOOK_SECRET);
  if (provider === "google-ads") return clean(process.env.GOOGLE_ADS_WEBHOOK_SECRET) || clean(process.env.LEADS_WEBHOOK_SECRET);
  return clean(process.env.LEADS_WEBHOOK_SECRET);
}

function metaLeadgenEvent(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    const change = changes.find((item) => clean(item?.field).toLowerCase() === "leadgen");
    const leadgenId = firstValue(change?.value?.leadgen_id, change?.value?.lead_id);
    if (leadgenId) return { leadgenId, value: change.value ?? {} };
  }
  return { leadgenId: "", value: {} };
}

async function fetchMetaLeadDetails(leadgenId) {
  const accessToken = clean(process.env.META_PAGE_ACCESS_TOKEN);
  if (!accessToken) throw apiError("Meta Page access token is not configured.", 503);
  const version = clean(process.env.META_GRAPH_API_VERSION) || "v24.0";
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}`);
  url.searchParams.set("access_token", accessToken);
  const graphResponse = await fetch(url, { headers: { accept: "application/json" } });
  const result = await graphResponse.json().catch(() => ({}));
  if (!graphResponse.ok) {
    throw apiError(`Meta lead retrieval failed: ${clean(result?.error?.message) || graphResponse.statusText}.`, 502);
  }
  return result;
}

function verifyLeadWebhookAuth(request, provider) {
  const apiKey = clean(process.env.LEADS_API_KEY);
  const token = clean(request.get("x-mace-leads-token") || request.get("x-api-key"));
  if (apiKey && token && secureEquals(token, apiKey)) return "api-key";

  const secret = providerSecret(provider);
  const signature = clean(request.get("x-mace-signature") || request.get("x-hub-signature-256") || request.get("x-signature"));
  if (secret && signature) {
    const expected = createHmac("sha256", secret).update(request.rawBody || JSON.stringify(request.body ?? {})).digest("hex");
    const normalized = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    if (secureEquals(normalized, expected)) return "hmac-sha256";
  }

  if (!apiKey && !secret) {
    throw apiError("Lead webhook authentication is not configured. Set LEADS_WEBHOOK_SECRET or LEADS_API_KEY.", 503);
  }
  throw apiError("Invalid lead webhook authentication.", 401);
}

function fieldDataValue(payload, key) {
  const entries = [
    ...(Array.isArray(payload?.field_data) ? payload.field_data : []),
    ...(Array.isArray(payload?.fieldData) ? payload.fieldData : []),
    ...(Array.isArray(payload?.answers) ? payload.answers : []),
  ];
  const match = entries.find((entry) => clean(entry.name || entry.key || entry.field_name).toLowerCase() === key.toLowerCase());
  return firstValue(match?.values, match?.value, match?.answer);
}

function normalizeExternalLeadPayload(provider, payload, integration) {
  const source = payload?.lead && typeof payload.lead === "object"
    ? payload.lead
    : payload?.data && typeof payload.data === "object"
      ? payload.data
      : payload;
  const mapping = {
    ...defaultLeadFieldMapping(provider),
    ...parseJsonObject(integration?.fieldMapping, {}),
  };
  const mapped = {};
  for (const [externalField, internalField] of Object.entries(mapping)) {
    const value = firstValue(readPath(source, externalField), readPath(payload, externalField), fieldDataValue(source, externalField));
    if (clean(value) && clean(internalField)) mapped[internalField] = value;
  }

  const now = new Date();
  const externalLeadId = firstValue(
    mapped.externalLeadId,
    source.externalLeadId,
    source.external_lead_id,
    source.lead_id,
    source.leadgen_id,
    source.id,
    payload.leadgen_id,
    payload.lead_id,
    payload.id,
  );

  return {
    ...mapped,
    name: firstValue(mapped.name, source.full_name, source.fullName, source.name, fieldDataValue(source, "full_name"), fieldDataValue(source, "name")),
    mobile: firstValue(mapped.mobile, source.mobile, source.phone, source.phone_number, fieldDataValue(source, "phone_number"), fieldDataValue(source, "mobile")),
    email: firstValue(mapped.email, source.email, source.email_address, fieldDataValue(source, "email_address"), fieldDataValue(source, "email")),
    source: firstValue(source.source, mapped.source, integration?.label, provider),
    sourcePlatform: provider,
    campaign: firstValue(mapped.campaign, source.campaign, source.campaign_name, source.utm_campaign, payload.campaign),
    adSet: firstValue(source.adSet, source.ad_set, source.adgroup, source.ad_group),
    adCreative: firstValue(source.ad, source.ad_name, source.creative),
    formId: firstValue(mapped.formId, source.form_id, source.formId, payload.form_id),
    externalLeadId,
    interest: firstValue(mapped.interest, source.interest, source.service, source.preferred_service, fieldDataValue(source, "preferred_service")),
    interestedTreatment: firstValue(mapped.interestedTreatment, source.treatment),
    interestedPackage: firstValue(mapped.interestedPackage, source.package),
    concern: firstValue(mapped.concern, source.concern, source.main_concern),
    message: firstValue(mapped.message, source.message, source.inquiry, source.initial_message),
    preferredDate: firstValue(source.preferred_date, source.preferredDate),
    preferredTime: firstValue(source.preferred_time, source.preferredTime),
    budgetRange: firstValue(source.budget, source.budget_range),
    urgency: firstValue(source.urgency, source.priority) || "Normal",
    branch: firstValue(mapped.branch, source.branch, source.location, integration?.defaultBranch),
    landingPage: firstValue(source.landing_page, source.landingPage, payload.landing_page),
    referrerUrl: firstValue(source.referrer, source.referring_url, source.referrerUrl),
    utmSource: firstValue(source.utm_source, source.utmSource),
    utmMedium: firstValue(source.utm_medium, source.utmMedium),
    utmCampaign: firstValue(source.utm_campaign, source.utmCampaign),
    utmContent: firstValue(source.utm_content, source.utmContent),
    utmTerm: firstValue(source.utm_term, source.utmTerm),
    clickId: firstValue(source.gclid, source.fbclid, source.ttclid, source.click_id),
    socialProfileId: firstValue(source.social_profile_id, source.socialProfileId, source.psid, source.ig_user_id),
    channelContactId: firstValue(source.channel_contact_id, source.channelContactId, source.conversation_id, source.thread_id),
    consentSource: firstValue(source.consent_source, source.consentSource, source.form_id),
    consentTimestamp: firstValue(source.consent_timestamp, source.consentTimestamp, source.submitted_at, payload.created_time) || now.toISOString(),
    consentVersion: firstValue(source.consent_version, source.consentVersion),
    consentText: firstValue(source.consent_text, source.consentText),
    permissionToContact: parseBoolean(firstValue(source.permission_to_contact, source.permissionToContact), true),
    marketingConsent: parseBoolean(firstValue(source.marketing_consent, source.marketingConsent), false),
    privacyConsent: parseBoolean(firstValue(source.privacy_consent, source.privacyConsent), false),
    preferredChannel: firstValue(source.preferred_channel, source.channel, provider === "whatsapp" ? "WhatsApp" : provider === "email" ? "Email" : "Phone"),
    owner: firstValue(source.owner, source.assigned_staff, integration?.defaultOwner) || "Front Desk",
    created: now.toISOString().slice(0, 10),
    nextAction: "Initial response",
    nextFollowUpAt: addMinutes(now, 15).toISOString(),
  };
}

function webhookIdentity(provider, request, normalized) {
  const payload = request.body ?? {};
  const rawHash = createHash("sha256").update(request.rawBody || JSON.stringify(payload)).digest("hex");
  const providerEventId = firstValue(
    request.get("idempotency-key"),
    request.get("x-request-id"),
    payload.event_id,
    payload.eventId,
    payload.id,
    payload.entry?.[0]?.id,
    normalized.externalLeadId,
    rawHash,
  );
  return {
    providerEventId,
    idempotencyKey: `${provider}:${providerEventId}`,
  };
}

async function detectLeadDuplicate(tx, normalized) {
  if (clean(normalized.externalLeadId)) {
    const identity = await tx.externalLeadIdentity.findUnique({
      where: { provider_externalLeadId: { provider: clean(normalized.sourcePlatform), externalLeadId: clean(normalized.externalLeadId) } },
      include: { lead: true },
    });
    if (identity?.lead) {
      return { type: "external", confidence: 100, lead: identity.lead, reasons: ["Same external platform lead ID"] };
    }
  }

  const candidates = await tx.lead.findMany({
    where: {
      OR: [
        clean(normalized.mobile) ? { mobile: clean(normalized.mobile) } : undefined,
        clean(normalized.email) ? { email: clean(normalized.email).toLowerCase() } : undefined,
        clean(normalized.name) ? { name: clean(normalized.name) } : undefined,
      ].filter(Boolean),
    },
    take: 20,
  });
  const normalizedPhone = normalizePhone(normalized.mobile);
  const email = clean(normalized.email).toLowerCase();
  const name = clean(normalized.name).toLowerCase();
  const match = candidates.find((lead) => normalizedPhone && normalizePhone(lead.mobile) === normalizedPhone)
    || candidates.find((lead) => email && clean(lead.email).toLowerCase() === email)
    || candidates.find((lead) => name && clean(lead.name).toLowerCase() === name);
  if (match) {
    const reasons = [];
    if (normalizedPhone && normalizePhone(match.mobile) === normalizedPhone) reasons.push("Same mobile number");
    if (email && clean(match.email).toLowerCase() === email) reasons.push("Same email address");
    if (name && clean(match.name).toLowerCase() === name) reasons.push("Same lead name");
    return { type: "lead", confidence: normalizedPhone || email ? 92 : 70, lead: match, reasons };
  }

  const clientCandidates = await tx.client.findMany({
    where: {
      OR: [
        clean(normalized.mobile) ? { mobile: clean(normalized.mobile) } : undefined,
        clean(normalized.email) ? { email: clean(normalized.email).toLowerCase() } : undefined,
      ].filter(Boolean),
    },
    take: 10,
  });
  const clientMatch = clientCandidates.find((client) => normalizedPhone && normalizePhone(client.mobile) === normalizedPhone)
    || clientCandidates.find((client) => email && clean(client.email).toLowerCase() === email);
  if (clientMatch) {
    return { type: "client", confidence: 88, client: clientMatch, reasons: ["Matches existing client contact details"] };
  }

  return { type: "none", confidence: 0, reasons: [] };
}

async function routeIncomingLead(tx, normalized) {
  let branch = clean(normalized.branch);
  if (!branch) {
    const firstBranch = await tx.branch.findFirst({ orderBy: { name: "asc" } });
    branch = firstBranch?.name || "All branches";
  }
  let owner = clean(normalized.owner);
  if (!owner || owner === "Front Desk") {
    const staff = await tx.staffMember.findFirst({
      where: {
        branch,
        role: { in: ["Receptionist", "Marketing Staff", "Branch Manager"] },
        status: { not: "Inactive" },
      },
      orderBy: [{ name: "asc" }],
    });
    owner = staff?.name || owner || "Front Desk";
  }
  return { branch, owner };
}

async function processLeadWebhook(provider, request) {
  rateLimitWebhook(request, provider);
  const authMethod = verifyLeadWebhookAuth(request, provider);
  const integration = await prisma.leadIntegration.findUnique({ where: { provider } })
    ?? await prisma.leadIntegration.create({
      data: {
        provider,
        label: integrationDefaults.find((item) => item.provider === provider)?.label || provider,
        status: providerEnvStatus(provider).status,
        fieldMapping: jsonText(defaultLeadFieldMapping(provider), {}),
        configSummary: providerEnvStatus(provider).summary,
      },
    });
  if (integration.paused || integration.status === "Paused" || integration.status === "Disabled") {
    throw apiError(`Lead integration ${provider} is paused or disabled.`, 409);
  }

  let incomingPayload = request.body ?? {};
  if (provider === "meta-facebook") {
    const metaEvent = metaLeadgenEvent(incomingPayload);
    if (metaEvent.leadgenId) {
      const leadDetails = await fetchMetaLeadDetails(metaEvent.leadgenId);
      incomingPayload = {
        ...incomingPayload,
        ...metaEvent.value,
        ...leadDetails,
        leadgen_id: metaEvent.leadgenId,
      };
    }
  }

  const normalized = normalizeExternalLeadPayload(provider, incomingPayload, integration);
  const { providerEventId, idempotencyKey } = webhookIdentity(provider, request, normalized);
  const existingEvent = await prisma.webhookEvent.findUnique({ where: { idempotencyKey }, include: { lead: true } });
  if (existingEvent) {
    return {
      status: existingEvent.status,
      duplicateEvent: true,
      lead: existingEvent.lead ? serializeLead(existingEvent.lead) : null,
      event: existingEvent,
      authMethod,
    };
  }

  if (!clean(normalized.name) && !clean(normalized.mobile) && !clean(normalized.email) && !clean(normalized.socialProfileId)) {
    throw apiError("Incoming lead payload must include a name or contact identifier.", 400);
  }

  const event = await prisma.webhookEvent.create({
    data: {
      provider,
      providerEventId,
      idempotencyKey,
      externalLeadId: clean(normalized.externalLeadId),
      status: "Processing",
      attempts: 1,
      mappingVersion: clean(integration.mappingVersion) || "v1",
      payloadSummary: jsonText(safeJsonSummary(request.body ?? {}), {}),
      mappedFields: jsonText(safeJsonSummary(normalized), {}),
    },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await detectLeadDuplicate(tx, normalized);
      const routing = await routeIncomingLead(tx, normalized);
      const leadData = normalizeLeadPayload({
        ...normalized,
        branch: routing.branch,
        assignedBranch: routing.branch,
        owner: routing.owner,
        sourcePlatform: provider,
        latestTouchSource: normalized.source,
        firstTouchSource: normalized.source,
        duplicateOfLeadId: duplicate.lead?.id || "",
        duplicateConfidence: duplicate.confidence,
        duplicateReasons: duplicate.reasons,
      });

      if (duplicate.lead) {
        const lead = await tx.lead.update({
          where: { id: duplicate.lead.id },
          data: {
            latestTouchSource: leadData.latestTouchSource,
            campaign: leadData.campaign || duplicate.lead.campaign,
            duplicateConfidence: duplicate.confidence,
            duplicateReasons: jsonText(duplicate.reasons, []),
            nextFollowUpAt: duplicate.lead.nextFollowUpAt || leadData.nextFollowUpAt,
            nextAction: duplicate.lead.nextAction || "Review duplicate inquiry",
          },
        });
        await createLeadActivity(tx, null, lead.id, {
          type: "Duplicate",
          title: "Duplicate inbound lead matched",
          note: duplicate.reasons.join(", "),
          actor: "Lead Ingestion",
          actorRole: "System",
          metadata: { provider, providerEventId },
        });
        await createLeadTouchpoint(tx, lead.id, leadData);
        if (clean(leadData.externalLeadId)) {
          await tx.externalLeadIdentity.upsert({
            where: { provider_externalLeadId: { provider, externalLeadId: leadData.externalLeadId } },
            update: { leadId: lead.id, formId: leadData.formId, payloadRef: event.id },
            create: { leadId: lead.id, provider, externalLeadId: leadData.externalLeadId, formId: leadData.formId, payloadRef: event.id },
          });
        }
        const updatedEvent = await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            leadId: lead.id,
            status: "Duplicate",
            duplicateResult: jsonText({ type: duplicate.type, confidence: duplicate.confidence, reasons: duplicate.reasons }, {}),
          },
        });
        return { lead, event: updatedEvent, duplicate };
      }

      const lead = await tx.lead.create({ data: stripMeta(leadData) });
      await writeLeadSideRecords(tx, null, lead, leadData, null);
      if (clean(leadData.externalLeadId)) {
        await tx.externalLeadIdentity.create({
          data: {
            leadId: lead.id,
            provider,
            externalLeadId: leadData.externalLeadId,
            formId: leadData.formId,
            contactRef: clean(leadData.channelContactId || leadData.socialProfileId),
            payloadRef: event.id,
          },
        });
      }
      const updatedEvent = await tx.webhookEvent.update({
        where: { id: event.id },
        data: {
          leadId: lead.id,
          status: "Completed",
          duplicateResult: jsonText({ type: duplicate.type, confidence: duplicate.confidence, reasons: duplicate.reasons }, {}),
        },
      });
      return { lead, event: updatedEvent, duplicate };
    });

    await prisma.leadIntegration.update({
      where: { provider },
      data: {
        status: providerEnvStatus(provider).status,
        lastEventAt: new Date().toISOString(),
        lastSuccessfulSyncAt: new Date().toISOString(),
        lastError: "",
      },
    });

    const lead = await prisma.lead.findUnique({
      where: { id: result.lead.id },
      include: resourceConfigs.leads.include,
    });
    return {
      status: result.event.status,
      duplicateEvent: false,
      duplicateMatch: result.duplicate,
      lead: serializeLead(lead),
      event: result.event,
      authMethod,
    };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "Failed", error: error.message },
    }).catch(() => {});
    await prisma.leadIntegration.update({
      where: { provider },
      data: {
        lastEventAt: new Date().toISOString(),
        lastError: error.message,
        status: "Webhook Failing",
      },
    }).catch(() => {});
    throw error;
  }
}

async function appointmentDurationFor(data) {
  if (Number(data.duration) >= 15) return Number(data.duration);
  let service = null;
  if (data.serviceId) {
    service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  }
  if (!service && data.service) {
    service = await prisma.service.findFirst({ where: { name: data.service } });
  }
  return Math.max(15, Number(service?.duration || 60));
}

const appointmentRecurrenceSteps = {
  Weekly: { days: 7 },
  "Every 2 weeks": { days: 14 },
  Monthly: { months: 1 },
};
const maxRecurrenceOccurrences = 26;

function shiftIsoDate(iso, { days = 0, months = 0 }) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day) return "";
  if (months) {
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function expandAppointmentRecurrence(tx, request, record, data, previous) {
  if (previous) return;
  const step = appointmentRecurrenceSteps[data.recurrence];
  const until = clean(data.recurrenceUntil);
  if (!step || !/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= data.date) return;

  let created = 0;
  const skipped = [];
  for (let index = 1; created < maxRecurrenceOccurrences; index += 1) {
    const date = shiftIsoDate(data.date, { days: (step.days || 0) * index, months: (step.months || 0) * index });
    if (!date || date > until) break;
    const occurrence = { ...stripMeta(data), date };
    delete occurrence.id;
    try {
      await assertAppointmentSlotAvailable(occurrence);
    } catch {
      skipped.push(date);
      continue;
    }
    await tx.appointment.create({ data: occurrence });
    created += 1;
  }
  if (created || skipped.length) {
    await writeAudit(tx, request, {
      area: "Appointments",
      action: "Recurring series created",
      details: `${record.client} for ${record.service}: ${created} recurring appointment${created === 1 ? "" : "s"} created${skipped.length ? `, skipped ${skipped.join(", ")} for conflicts` : ""}.`,
    });
  }
}

async function assertAppointmentStatusTransition(data, existingId = "") {
  if (!existingId) return;
  const existing = await prisma.appointment.findUnique({ where: { id: existingId } });
  if (!existing) return;

  const previousStatus = canonicalAppointmentStatus(existing.status);
  const nextStatus = canonicalAppointmentStatus(data.status);
  if (previousStatus === nextStatus) return;

  const allowed = appointmentStatusTransitions[previousStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw apiError(`Appointments cannot move from ${previousStatus} to ${nextStatus}.`, 409);
  }
}

async function assertAppointmentSlotAvailable(data, existingId = "") {
  await assertAppointmentStatusTransition(data, existingId);
  if (!isActiveAppointmentStatus(data.status)) return;

  const duration = await appointmentDurationFor(data);
  const start = parseTimeToMinutes(data.time);
  const end = start + duration;
  if (start < scheduleStartMinutes || end > scheduleEndMinutes) {
    throw apiError("Appointment must fit inside clinic hours, 8:00 AM to 8:00 PM.", 409);
  }
  if (rangesOverlap(start, end, lunchStartMinutes, lunchEndMinutes)) {
    throw apiError("Appointment overlaps the clinic lunch break from 12:00 PM to 1:00 PM.", 409);
  }

  if (data.staff && !["Any available", "To assign"].includes(data.staff)) {
    const staffMember = await prisma.staffMember.findFirst({ where: { name: data.staff } });
    const unavailable = ["inactive", "on leave", "off duty", "unavailable"].some((status) =>
      clean(staffMember?.status).toLowerCase().includes(status),
    );
    if (unavailable) {
      throw apiError(`${data.staff} is not available for booking.`, 409);
    }
  }

  const candidates = await prisma.appointment.findMany({
    where: {
      date: data.date,
      branch: data.branch,
      status: { in: databaseActiveAppointmentStatuses },
      ...(existingId ? { id: { not: existingId } } : {}),
    },
  });

  for (const appointment of candidates) {
    const appointmentStart = parseTimeToMinutes(appointment.time);
    const appointmentEnd = appointmentStart + await appointmentDurationFor(appointment);
    if (!rangesOverlap(start, end, appointmentStart, appointmentEnd)) continue;

    const sameRoom = data.room && data.room !== "To assign" && data.room === appointment.room;
    const sameStaff =
      data.staff &&
      !["Any available", "To assign"].includes(data.staff) &&
      data.staff === appointment.staff;

    if (sameRoom || sameStaff) {
      const conflictTarget = sameRoom ? `room ${data.room}` : data.staff;
      throw apiError(`${conflictTarget} is already booked from ${appointment.time} for ${appointment.service}.`, 409);
    }
  }
}

function marketingChannel(campaign) {
  const channel = clean(campaign?.channel).toLowerCase();
  return channel.includes("mail") ? "email" : "sms";
}

function normalizePhone(value) {
  const raw = clean(value);
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.replace(/\D/g, "")}`;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;

  const countryCode = clean(process.env.SMS_DEFAULT_COUNTRY_CODE || "63").replace(/\D/g, "");
  return countryCode ? `+${countryCode}${digits.replace(/^0+/, "")}` : digits;
}

function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  return email.includes("@") ? email : "";
}

function dateAgeDays(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function isBirthdayMonth(client) {
  const birthday = clean(client.birthday);
  if (!birthday) return false;
  const month = Number(birthday.slice(5, 7));
  return month === new Date().getMonth() + 1;
}

function matchesMarketingSegment(client, campaign) {
  const segment = clean(campaign.segment).toLowerCase();
  if (!segment) return true;

  const tag = clean(client.tag).toLowerCase();
  const retention = clean(client.retention).toLowerCase();
  const source = clean(client.source).toLowerCase();
  const packageBalance = clean(client.packageBalance).toLowerCase();
  const lastVisitAge = dateAgeDays(client.lastVisit);

  if (segment.includes("birthday")) return isBirthdayMonth(client);
  if (segment.includes("vip")) return tag.includes("vip");
  if (segment.includes("inactive")) return retention.includes("inactive") || (lastVisitAge !== null && lastVisitAge >= 90);
  if (segment.includes("new")) return retention.includes("new") || source.includes("online");
  if (segment.includes("package")) return Boolean(packageBalance && packageBalance !== "none");
  if (segment.includes("last visit")) return Boolean(clean(client.lastVisit));

  return true;
}

function selectMarketingRecipients({ clients, campaign, channel }) {
  const candidates = clients.filter((client) => client.marketingOptIn !== false && matchesMarketingSegment(client, campaign));
  const recipients = [];

  candidates.forEach((client) => {
    const contact = channel === "email" ? normalizeEmail(client.email) : normalizePhone(client.mobile);
    if (contact) {
      recipients.push({ client, contact });
    }
  });

  return { candidates, recipients };
}

function pickTemplate({ campaign, templates, channel }) {
  const templateId = clean(campaign.templateId);
  if (templateId) {
    const selected = templates.find((template) => template.id === templateId);
    if (selected) return selected;
  }

  const segment = clean(campaign.segment).toLowerCase();
  if (segment.includes("birthday")) {
    return templates.find((template) => clean(template.name).toLowerCase().includes("birthday"));
  }
  if (segment.includes("inactive")) {
    return templates.find((template) => clean(template.name).toLowerCase().includes("win-back"));
  }

  return templates.find((template) => clean(template.category).toLowerCase() === "marketing") ?? templates[0] ?? {
    text: channel === "email"
      ? "Hi {{client}},\n\nWe would love to see you at MACE. Reply to this email or message us to book your next visit."
      : "Hi {{client}}, it has been a while. Book your personalized care session with MACE this week.",
  };
}

function renderMarketingText(text, { client, campaign, settings }) {
  const values = {
    client: client.fullName,
    name: client.fullName,
    mobile: client.mobile,
    email: client.email,
    branch: client.branch,
    segment: campaign.segment,
    campaign: campaign.name,
    company: settings.company || "MACE",
    product: settings.productName || "MACE ClinicOS",
    date: new Date().toLocaleDateString("en-PH"),
    time: "",
    service: campaign.service || campaign.name,
  };

  return clean(text).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => clean(values[key] ?? ""));
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function smsReady() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));
}

function emailReady() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

async function sendTwilioSms({ to, body }) {
  const accountSid = clean(process.env.TWILIO_ACCOUNT_SID);
  const authToken = clean(process.env.TWILIO_AUTH_TOKEN);
  const from = clean(process.env.TWILIO_FROM_NUMBER);
  const messagingServiceSid = clean(process.env.TWILIO_MESSAGING_SERVICE_SID);

  if (!smsReady()) {
    throw apiError("SMS is not configured. Add Twilio credentials to .env and restart the API.", 503);
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else {
    form.set("From", from);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Twilio rejected the SMS with status ${response.status}.`);
  }

  return payload.sid;
}

function createEmailTransport() {
  if (!emailReady()) {
    throw apiError("Email is not configured. Add SMTP settings to .env and restart the API.", 503);
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST),
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? envFlag(process.env.SMTP_SECURE) : smtpPort === 465,
    auth: user || pass ? { user, pass } : undefined,
  });
}

async function sendSmtpEmail({ transporter, to, subject, text }) {
  const result = await transporter.sendMail({
    from: clean(process.env.SMTP_FROM),
    to,
    subject,
    text,
    html: textToHtml(text),
  });

  return result.messageId;
}

async function buildBootstrapPayload(actor) {
  const [
    clients,
    appointments,
    services,
    inventory,
    transactions,
    treatments,
    packages,
    giftCertificates,
    leads,
    staff,
    expenses,
    discounts,
    smsTemplates,
    campaigns,
    auditLogs,
    inventoryMovements,
    branches,
    settings,
    leadIntegrations,
    webhookEvents,
  ] = await Promise.all([
    listResource("clients", actor),
    listResource("appointments", actor),
    listResource("services", actor),
    listResource("inventory", actor),
    listResource("transactions", actor),
    listResource("treatments", actor),
    listResource("packages", actor),
    listResource("giftCertificates", actor),
    listResource("leads", actor),
    listResource("staff", actor),
    listResource("expenses", actor),
    listResource("discounts", actor),
    listResource("smsTemplates", actor),
    listResource("campaigns", actor),
    listResource("auditLogs", actor),
    listResource("inventoryMovements", actor),
    prisma.branch.findMany({
      where: isAllBranches(actor.branch) ? {} : { name: actor.branch },
      orderBy: [{ name: "asc" }],
      include: { rooms: true },
    }),
    getPersistedSettings(),
    moduleAllowed(actor, "leads", roleAccess) ? listLeadIntegrations() : [],
    moduleAllowed(actor, "leads", roleAccess)
      ? prisma.webhookEvent.findMany({
        where: isAllBranches(actor.branch) ? {} : { lead: { is: { branch: actor.branch } } },
        orderBy: [{ receivedAt: "desc" }],
        take: 50,
      })
      : [],
  ]);

  return {
    clients,
    appointments,
    services,
    inventory,
    transactions,
    treatments,
    packages,
    giftCertificates,
    leads,
    staff,
    expenses,
    discounts,
    smsTemplates,
    campaigns,
    auditLogs,
    inventoryMovements,
    branches: branches.map(serializeBranch),
    settings,
    leadIntegrations,
    webhookEvents,
  };
}

async function buildSaleDraftItems(cart) {
  if (!Array.isArray(cart) || !cart.length) {
    throw apiError("Cart must contain at least one item.");
  }

  const prepared = [];
  for (const item of cart) {
    const qty = numberValue(item.qty || 1, "Cart quantity", { min: 1 });
    if (item.type === "Service") {
      const service = await prisma.service.findUnique({ where: { id: requireText(item.serviceId, "Service") } });
      if (!service || !service.active || !service.pos) {
        throw apiError(`${item.name || "Selected service"} is unavailable for POS.`);
      }
      prepared.push({
        source: service,
        sourceId: service.id,
        name: service.name,
        type: "Service",
        qty,
        price: numberValue(service.price, "Service price", { min: 0 }),
        consumables: parseJsonList(service.consumables),
      });
    } else if (item.type === "Product") {
      const product = await prisma.inventoryItem.findUnique({ where: { id: requireText(item.inventoryId, "Inventory item") } });
      if (!product || product.type !== "Retail") {
        throw apiError(`${item.name || "Selected product"} is unavailable for POS.`);
      }
      if (numberValue(product.stock, "Product stock") < qty) {
        throw apiError(`Inventory is insufficient for ${product.item}.`, 409);
      }
      prepared.push({
        source: product,
        sourceId: product.id,
        name: product.item,
        type: "Product",
        qty,
        price: numberValue(product.price, "Product price", { min: 0 }),
        inventoryId: product.id,
      });
    } else {
      throw apiError("Unsupported POS item type.");
    }
  }

  return prepared;
}

async function calculateCheckout(draft) {
  const items = await buildSaleDraftItems(draft.cart);
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountId = clean(draft.discount?.id || draft.discountId);
  const discount = discountId ? await prisma.discount.findUnique({ where: { id: discountId } }) : null;
  const discountAmount = discount?.active
    ? discount.type === "Percentage"
      ? Math.round((subtotal * Number(discount.value || 0)) / 100)
      : Number(discount.value || 0)
    : 0;
  const depositCredit = numberValue(draft.depositCredit, "Deposit credit", { min: 0 });
  const totalDiscount = Math.min(discountAmount + depositCredit, subtotal);

  return {
    items,
    subtotal,
    discount,
    discountAmount: totalDiscount,
    total: Math.max(0, subtotal - totalDiscount),
  };
}

async function inventoryDeductionsForSale(items, branch) {
  const deductions = [];

  for (const item of items) {
    if (item.inventoryId) {
      deductions.push({
        inventoryId: item.inventoryId,
        item: item.name,
        branch,
        qty: item.qty,
      });
      continue;
    }

    for (const consumableName of item.consumables ?? []) {
      const stockItem = await prisma.inventoryItem.findFirst({
        where: {
          item: consumableName,
          OR: [{ branch }, { branch: "All branches" }],
        },
        orderBy: [{ branch: "desc" }],
      });

      if (stockItem) {
        deductions.push({
          inventoryId: stockItem.id,
          item: stockItem.item,
          branch: stockItem.branch || branch,
          qty: item.qty,
        });
      }
    }
  }

  return deductions;
}

async function loadLead(id) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: resourceConfigs.leads.include,
  });
  if (!lead) throw apiError("Lead not found.", 404);
  return serializeLead(lead);
}

function normalizeFollowUpPayload(payload, lead) {
  return {
    type: clean(payload.type) || "Phone call",
    dueAt: requireText(payload.dueAt || payload.nextFollowUpAt, "Follow-up due date"),
    assignedTo: clean(payload.assignedTo || payload.owner) || clean(lead.owner) || "Front Desk",
    channel: clean(payload.channel) || clean(lead.preferredChannel) || "Phone",
    purpose: clean(payload.purpose || payload.nextAction) || "Follow up lead",
    notes: clean(payload.notes),
    reminderAt: clean(payload.reminderAt),
    outcome: clean(payload.outcome),
    status: clean(payload.status) || "Upcoming",
    completedAt: clean(payload.completedAt),
  };
}

const authCookieName = "macesoft_session";
const sessionDurationMs = 12 * 60 * 60 * 1000;

function parseCookies(request) {
  return Object.fromEntries(
    clean(request.headers.cookie)
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        return separator < 0
          ? [decodeURIComponent(entry), ""]
          : [decodeURIComponent(entry.slice(0, separator)), decodeURIComponent(entry.slice(separator + 1))];
      }),
  );
}

function sessionTokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function verifyPassword(password, storedHash) {
  const [scheme, salt, expectedHex] = clean(storedHash).split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = scryptSync(String(password ?? ""), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

async function ensureDefaultAccounts() {
  if (clean(process.env.ENABLE_DEMO_ACCOUNTS).toLowerCase() !== "true") return;
  const staff = await prisma.staffMember.findMany();
  const defaultPassword = process.env.SEED_STAFF_PASSWORD || "Mace2026!";
  for (const user of users) {
    await prisma.account.upsert({
      where: { email: user.email.toLowerCase() },
      update: {},
      create: {
        id: user.id,
        staffId: staff.find((person) => person.name === user.name)?.id ?? null,
        name: user.name,
        email: user.email.toLowerCase(),
        passwordHash: hashPassword(defaultPassword),
        role: user.role,
        branch: user.branch,
        status: "Active",
        mustChangePassword: true,
      },
    });
  }
}

function publicAccount(account) {
  const modules = roleAccess[account.role] || [];
  return {
    id: account.id,
    staffId: account.staffId,
    name: account.name,
    email: account.email,
    role: account.role,
    branch: account.branch || "",
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    access: {
      active: account.status === "Active" && modules.length > 0,
      branchScoped: !isAllBranches(account.branch),
      modules,
    },
  };
}

function setSessionCookie(response, token, expiresAt) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${authCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

async function accountFromSession(request) {
  const token = parseCookies(request)[authCookieName];
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { account: true },
  });
  if (!session || session.expiresAt <= new Date() || session.account.status !== "Active" || !clean(session.account.branch)) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return { token, session, account: session.account };
}

function requireAuthenticatedAccount(request) {
  if (!request.authAccount) throw apiError("Authentication is required.", 401);
  return request.authAccount;
}

const invitationStatuses = ["Pending", "Accepted", "Expired", "Revoked", "Failed"];
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function requireInvitationManager(request) {
  const account = requireAuthenticatedAccount(request);
  if (!canManageOrganization(account.role)) {
    throw apiError("Only an Admin or Business Owner can manage invitations.", 403);
  }
  return account;
}

function invitationRole(value, actor) {
  const role = requireText(value, "Role");
  if (!Object.keys(roleAccess).includes(role)) {
    throw apiError("Choose a configured organization role.");
  }
  if (isBusinessOwner(role) && !isBusinessOwner(actor.role)) {
    throw apiError("Only a Business Owner can invite another Business Owner.", 403);
  }
  return role;
}

function publicInvitation(invitation) {
  const effectiveStatus = invitation.status === "Pending" && invitation.expiresAt <= new Date()
    ? "Expired"
    : invitation.status;
  return { ...invitation, status: effectiveStatus, tokenHash: undefined };
}

function invitationUrl(token) {
  const origin = clean(process.env.APP_ORIGIN).split(",")[0] || `http://localhost:${port}`;
  return `${origin.replace(/\/$/, "")}/?invitation=${encodeURIComponent(token)}`;
}

function invitationEmailText(invitation, token, inviter) {
  return [
    `Hello ${invitation.name},`,
    "",
    `${inviter.name} invited you to join MACE ClinicOS as ${invitation.role}.`,
    invitation.department ? `Department: ${invitation.department}` : "",
    invitation.specialty ? `Specialty: ${invitation.specialty}` : "",
    invitation.message ? `Message: ${invitation.message}` : "",
    "",
    `Accept invitation: ${invitationUrl(token)}`,
    `This secure, single-use link expires ${invitation.expiresAt.toLocaleString("en-PH")}.`,
  ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
}

async function expireInvitations() {
  await prisma.userInvitation.updateMany({
    where: { status: "Pending", expiresAt: { lte: new Date() } },
    data: { status: "Expired" },
  });
}

app.use("/api", asyncRoute(async (request, _response, next) => {
  const authenticated = await accountFromSession(request);
  if (authenticated) {
    request.authSession = authenticated.session;
    request.authAccount = authenticated.account;
    request.authActor = publicAccount(authenticated.account);
  }
  next();
}));

app.use("/api", (request, _response, next) => {
  if (isPublicApiRequest(request.method, request.originalUrl)) return next();
  if (process.env.NODE_ENV === "test" && envFlag(process.env.API_ALLOW_TRUSTED_HEADERS)) {
    const actor = actorFromRequest(request);
    if (actor.role) {
      request.authAccount = actor;
      request.authActor = actor;
    }
  }
  if (!request.authAccount) return next(apiError("Authentication is required.", 401));
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.get("x-mace-request") !== "app") {
    return next(apiError("This request did not pass the CSRF check.", 403));
  }
  const requiredModule = requiredModuleForApiRequest(request.originalUrl);
  if (requiredModule && !moduleAllowed(request.authActor, requiredModule, roleAccess)) {
    return next(apiError(`Your role does not allow access to ${requiredModule}.`, 403));
  }
  return next();
});

app.use("/api/facetrack-attendance", createFaceTrackAttendanceRouter(prisma));

app.post("/api/auth/login", asyncRoute(async (request, response) => {
  const email = requireText(request.body?.email, "Email").toLowerCase();
  const password = requireText(request.body?.password, "Password");
  const account = await prisma.account.findUnique({ where: { email } });
  const now = new Date();

  if (account?.status === "Active" && !clean(account.branch)) {
    throw apiError("This account does not have a branch assignment. Contact an administrator.", 403);
  }

  if (!account || account.status !== "Active" || (account.lockedUntil && account.lockedUntil > now) || !verifyPassword(password, account.passwordHash)) {
    if (account) {
      const attempts = account.failedLoginCount + 1;
      await prisma.account.update({
        where: { id: account.id },
        data: {
          failedLoginCount: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : account.lockedUntil,
        },
      });
    }
    throw apiError("Incorrect email or password.", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { accountId: account.id, expiresAt: { lt: now } } }),
    prisma.authSession.create({ data: { tokenHash: sessionTokenHash(token), accountId: account.id, expiresAt } }),
    prisma.account.update({ where: { id: account.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } }),
  ]);
  setSessionCookie(response, token, expiresAt);
  response.json({ account: publicAccount(account), expiresAt });
}));

app.post("/api/auth/forgot-password", asyncRoute(async (request, response) => {
  const email = requireText(request.body?.email, "Email").toLowerCase();
  const account = /^\S+@\S+\.\S+$/.test(email)
    ? await prisma.account.findUnique({ where: { email } })
    : null;
  if (account?.status === "Active") {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { accountId: account.id, usedAt: null } }),
      prisma.passwordResetToken.create({ data: { tokenHash: sessionTokenHash(token), accountId: account.id, expiresAt } }),
    ]);
    const origin = clean(process.env.APP_ORIGIN).split(",")[0] || `http://localhost:${port}`;
    const resetUrl = `${origin.replace(/\/$/, "")}/?reset=${encodeURIComponent(token)}`;
    try {
      await sendSmtpEmail({
        transporter: createEmailTransport(),
        to: account.email,
        subject: "Reset your MACE ClinicOS password",
        text: `Use this single-use link within 30 minutes to reset your password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "password_reset_delivery_failed", accountId: account.id, error: clean(error.message) }));
    }
  }
  response.status(202).json({ message: "If the account exists, a password-reset email has been sent." });
}));

app.post("/api/auth/reset-password", asyncRoute(async (request, response) => {
  const tokenHash = sessionTokenHash(requireText(request.body?.token, "Reset token"));
  const newPassword = requireText(request.body?.newPassword, "New password");
  if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    throw apiError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.", 400);
  }
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw apiError("This password-reset link is invalid or expired.", 410);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) throw apiError("This password-reset link has already been used.", 409);
    await tx.account.update({
      where: { id: reset.accountId },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.authSession.deleteMany({ where: { accountId: reset.accountId } });
  });
  response.json({ message: "Password updated. Sign in with your new password." });
}));

app.get("/api/auth/session", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  response.json({ account: publicAccount(account), expiresAt: request.authSession.expiresAt });
}));

app.post("/api/auth/logout", asyncRoute(async (request, response) => {
  if (request.authSession) await prisma.authSession.delete({ where: { id: request.authSession.id } });
  clearSessionCookie(response);
  response.status(204).end();
}));

app.post("/api/auth/change-password", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  const currentPassword = requireText(request.body?.currentPassword, "Current password");
  const newPassword = requireText(request.body?.newPassword, "New password");
  if (!verifyPassword(currentPassword, account.passwordHash)) throw apiError("Current password is incorrect.", 401);
  if (newPassword.length < 12 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    throw apiError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.", 400);
  }
  if (verifyPassword(newPassword, account.passwordHash)) throw apiError("Choose a different password.", 400);
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.account.update({
      where: { id: account.id },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    });
    await tx.authSession.deleteMany({ where: { accountId: account.id, id: { not: request.authSession.id } } });
    await writeAudit(tx, request, { area: "Authentication", action: "Password changed", details: "Account password changed and other sessions revoked." });
    return saved;
  });
  response.json({ account: publicAccount(updated) });
}));

app.get("/api/invitations", asyncRoute(async (request, response) => {
  requireInvitationManager(request);
  await expireInvitations();
  const invitations = await prisma.userInvitation.findMany({ orderBy: { createdAt: "desc" } });
  response.json({ invitations: invitations.map(publicInvitation), statuses: invitationStatuses });
}));

app.post("/api/invitations", asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  const email = requireText(request.body?.email, "Email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw apiError("Enter a valid email address.");
  const name = requireText(request.body?.name, "Name");
  const role = invitationRole(request.body?.role, actor);
  await expireInvitations();
  if (await prisma.account.findUnique({ where: { email } })) throw apiError("This user already belongs to the organization.", 409);
  if (await prisma.userInvitation.findFirst({ where: { email, status: "Pending", expiresAt: { gt: new Date() } } })) {
    throw apiError("A pending invitation already exists for this email address.", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.userInvitation.create({ data: {
    email,
    name,
    role,
    branch: clean(request.body?.branch) || actor.branch || "All branches",
    department: clean(request.body?.department),
    specialty: clean(request.body?.specialty),
    message: clean(request.body?.message),
    tokenHash: sessionTokenHash(token),
    expiresAt: new Date(Date.now() + invitationLifetimeMs),
    invitedById: actor.id,
  } });

  let saved = invitation;
  try {
    await sendSmtpEmail({ transporter: createEmailTransport(), to: email, subject: `You're invited to MACE ClinicOS`, text: invitationEmailText(invitation, token, actor) });
  } catch (error) {
    saved = await prisma.userInvitation.update({ where: { id: invitation.id }, data: { status: "Failed", failedReason: clean(error.message).slice(0, 500) } });
  }
  const auditLog = await prisma.auditLog.create({ data: auditData(request, { area: "Access", action: saved.status === "Failed" ? "Invitation delivery failed" : "Invitation created", details: `${email} invited as ${role}.` }) });
  response.status(201).json({ invitation: publicInvitation(saved), auditLog });
}));

app.post("/api/invitations/:id/resend", asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  const current = await prisma.userInvitation.findUnique({ where: { id: clean(request.params.id) } });
  if (!current || !["Pending", "Expired", "Failed"].includes(current.status)) throw apiError("This invitation cannot be resent.", 409);
  if (isBusinessOwner(current.role) && !isBusinessOwner(actor.role)) throw apiError("Only a Business Owner can resend a Business Owner invitation.", 403);
  const token = randomBytes(32).toString("base64url");
  let invitation = await prisma.userInvitation.update({ where: { id: current.id }, data: { tokenHash: sessionTokenHash(token), status: "Pending", expiresAt: new Date(Date.now() + invitationLifetimeMs), failedReason: "", revokedAt: null } });
  try {
    await sendSmtpEmail({ transporter: createEmailTransport(), to: invitation.email, subject: `Reminder: your MACE ClinicOS invitation`, text: invitationEmailText(invitation, token, actor) });
  } catch (error) {
    invitation = await prisma.userInvitation.update({ where: { id: current.id }, data: { status: "Failed", failedReason: clean(error.message).slice(0, 500) } });
  }
  const auditLog = await prisma.auditLog.create({ data: auditData(request, { area: "Access", action: invitation.status === "Failed" ? "Invitation delivery failed" : "Invitation resent", details: `${invitation.email} invitation resent.` }) });
  response.json({ invitation: publicInvitation(invitation), auditLog });
}));

app.post("/api/invitations/:id/revoke", asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  const current = await prisma.userInvitation.findUnique({ where: { id: clean(request.params.id) } });
  if (!current || current.status !== "Pending") throw apiError("Only a pending invitation can be revoked.", 409);
  if (isBusinessOwner(current.role) && !isBusinessOwner(actor.role)) throw apiError("Only a Business Owner can revoke a Business Owner invitation.", 403);
  const invitation = await prisma.userInvitation.update({ where: { id: current.id }, data: { status: "Revoked", revokedAt: new Date() } });
  const auditLog = await prisma.auditLog.create({ data: auditData(request, { area: "Access", action: "Invitation revoked", details: `${invitation.email} invitation revoked.` }) });
  response.json({ invitation: publicInvitation(invitation), auditLog });
}));

app.get("/api/invitations/accept/:token", asyncRoute(async (request, response) => {
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash: sessionTokenHash(request.params.token) } });
  if (!invitation) throw apiError("This invitation link is invalid.", 404);
  response.json({ invitation: publicInvitation(invitation) });
}));

app.post("/api/invitations/accept/:token", asyncRoute(async (request, response) => {
  const tokenHash = sessionTokenHash(request.params.token);
  const password = requireText(request.body?.password, "Password");
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw apiError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.");
  }
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.status !== "Pending") throw apiError("This invitation is no longer available.", 409);
  if (invitation.expiresAt <= new Date()) {
    await prisma.userInvitation.update({ where: { id: invitation.id }, data: { status: "Expired" } });
    throw apiError("This invitation has expired.", 410);
  }
  const result = await prisma.$transaction(async (tx) => {
    let account = await tx.account.findUnique({ where: { email: invitation.email } });
    if (account && !verifyPassword(password, account.passwordHash)) throw apiError("Use the password for the existing account.", 401);
    if (!account) {
      const staff = await tx.staffMember.create({ data: { name: invitation.name, role: invitation.role, branch: invitation.branch, status: "Available" } });
      account = await tx.account.create({ data: { staffId: staff.id, name: invitation.name, email: invitation.email, passwordHash: hashPassword(password), role: invitation.role, branch: invitation.branch, status: "Active", mustChangePassword: false } });
    } else {
      account = await tx.account.update({ where: { id: account.id }, data: { role: invitation.role, branch: invitation.branch, status: "Active" } });
    }
    const accepted = await tx.userInvitation.update({ where: { id: invitation.id }, data: { status: "Accepted", acceptedAt: new Date() } });
    await tx.auditLog.create({ data: { time: new Date().toLocaleString("en-PH"), actor: invitation.name, role: invitation.role, area: "Access", action: "Invitation accepted", details: `${invitation.email} joined the organization.` } });
    return { account, invitation: accepted };
  });
  response.json({ account: publicAccount(result.account), invitation: publicInvitation(result.invitation) });
}));

function attendanceState(events) {
  const lastType = events[0]?.type ?? "";
  if (!lastType || lastType === "CLOCK_OUT") return { status: "Clocked out", nextActions: ["CLOCK_IN"] };
  if (lastType === "CLOCK_IN" || lastType === "BREAK_END") return { status: "Clocked in", nextActions: ["BREAK_START", "CLOCK_OUT"] };
  return { status: "On break", nextActions: ["BREAK_END"] };
}

async function buildMyWorkspace(account) {
  const staff = account.staffId ? await prisma.staffMember.findUnique({ where: { id: account.staffId } }) : null;
  if (!staff) return { account: publicAccount(account), staff: null, events: [], appointments: [], attendance: { status: "Unavailable", nextActions: [] } };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [events, appointments] = await Promise.all([
    prisma.attendanceEvent.findMany({ where: { staffId: staff.id, occurredAt: { gte: start, lt: end } }, orderBy: { occurredAt: "desc" } }),
    prisma.appointment.findMany({ where: { staff: staff.name, date: start.toISOString().slice(0, 10) }, orderBy: { time: "asc" } }),
  ]);
  return { account: publicAccount(account), staff, events, appointments, attendance: attendanceState(events) };
}

app.get("/api/me/workspace", asyncRoute(async (request, response) => {
  response.json(await buildMyWorkspace(requireAuthenticatedAccount(request)));
}));

app.post("/api/me/attendance", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  if (!account.staffId) throw apiError("This account is not connected to a staff profile.", 409);
  const type = clean(request.body?.type).toUpperCase();
  const workspace = await buildMyWorkspace(account);
  if (!workspace.attendance.nextActions.includes(type)) throw apiError("That attendance action is not valid right now.", 409);
  const event = await prisma.attendanceEvent.create({
    data: { staffId: account.staffId, accountId: account.id, type, branch: account.branch, note: clean(request.body?.note) },
  });
  const attendance = type === "CLOCK_OUT" ? "Clocked out" : type === "BREAK_START" ? "On break" : "Clocked in";
  await prisma.staffMember.update({ where: { id: account.staffId }, data: { attendance } });
  response.status(201).json({ event, workspace: await buildMyWorkspace(account) });
}));

app.post("/api/branches", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  if (!canManageOrganization(account.role)) throw apiError("Only an Admin or Business Owner can create branches.", 403);
  const name = requireText(request.body?.name, "Branch name");
  const roomCount = Math.max(0, Math.min(50, Number(request.body?.roomCount) || 0));
  const branch = await prisma.branch.create({
    data: {
      name,
      city: clean(request.body?.city),
      address: clean(request.body?.address),
      phone: clean(request.body?.phone),
      hours: clean(request.body?.hours),
      devices: jsonText(request.body?.devices || [], []),
      image: assetReference(request.body?.image, "Branch image"),
      rooms: roomCount ? { create: Array.from({ length: roomCount }, (_value, index) => ({ name: `Room ${index + 1}` })) } : undefined,
    },
    include: { rooms: true },
  });
  response.status(201).json({ branch: serializeBranch(branch) });
}));

app.post("/api/uploads", asyncRoute(async (request, response) => {
  const category = requireText(request.body?.category, "Upload category");
  const categoryAccess = uploadCategories[category];
  if (!categoryAccess) throw apiError("Unsupported upload category.", 400);
  const branch = requireText(request.body?.branch, "Upload branch");
  const actor = assertMutationAllowed(request, categoryAccess.writeModule, branch);
  const { buffer, mimeType, extension } = decodeImageDataUrl(request.body?.dataUrl);
  const id = randomBytes(18).toString("base64url");
  const objectPath = `${category}/${id}.${extension}`;
  const uploaded = await storageRequest(objectPath, {
    method: "POST",
    headers: { "Content-Type": mimeType, "x-upsert": "false" },
    body: buffer,
  });
  if (!uploaded.ok) throw apiError("Object storage rejected the upload.", 502);
  try {
    const asset = await prisma.uploadAsset.create({
      data: { id, objectPath, category, branch, mimeType, byteSize: buffer.length, uploadedById: actor.id },
    });
    response.status(201).json({ asset: { ...asset, url: `/api/uploads/${asset.id}` } });
  } catch (error) {
    await storageRequest(objectPath, { method: "DELETE" }).catch(() => {});
    throw error;
  }
}));

app.get("/api/uploads/:id", asyncRoute(async (request, response) => {
  const asset = await prisma.uploadAsset.findUnique({ where: { id: clean(request.params.id) } });
  if (!asset) throw apiError("Uploaded asset was not found.", 404);
  const categoryAccess = uploadCategories[asset.category];
  if (!categoryAccess) throw apiError("Uploaded asset category is invalid.", 500);
  const actor = categoryAccess.readModule
    ? assertReadAllowed(request, categoryAccess.readModule)
    : requireAuthenticatedAccount(request);
  if (!canAccessBranch(actor, asset.branch)) throw apiError("You do not have access to this uploaded asset.", 403);
  const stored = await storageRequest(asset.objectPath);
  if (!stored.ok) throw apiError("Uploaded asset is unavailable.", stored.status === 404 ? 404 : 502);
  const buffer = Buffer.from(await stored.arrayBuffer());
  response.set({
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": "inline",
    "Content-Length": String(buffer.length),
    "Content-Type": asset.mimeType,
  });
  response.send(buffer);
}));

app.delete("/api/uploads/:id", asyncRoute(async (request, response) => {
  const asset = await prisma.uploadAsset.findUnique({ where: { id: clean(request.params.id) } });
  if (!asset) throw apiError("Uploaded asset was not found.", 404);
  const categoryAccess = uploadCategories[asset.category];
  if (!categoryAccess) throw apiError("Uploaded asset category is invalid.", 500);
  const actor = assertMutationAllowed(request, categoryAccess.writeModule, asset.branch);
  if (actor.id !== asset.uploadedById && !canManageOrganization(actor.role)) {
    throw apiError("Only the uploader or an organization administrator can remove this asset.", 403);
  }
  const deleted = await storageRequest(asset.objectPath, { method: "DELETE" });
  if (!deleted.ok && deleted.status !== 404) throw apiError("Object storage could not remove the asset.", 502);
  await prisma.uploadAsset.delete({ where: { id: asset.id } });
  response.status(204).end();
}));

app.get("/api/health/live", (_request, response) => {
  response.json({ ok: true, status: "live", checkedAt: new Date().toISOString() });
});

async function readinessResponse(response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("Supabase health check failed.", error);
    return response.status(503).json({
      ok: false,
      database: "supabase-postgres",
      databaseStatus: "unavailable",
      errorCode: error?.code || "DATABASE_CONNECTION_FAILED",
      checkedAt: new Date().toISOString(),
    });
  }
  response.json({
    ok: true,
    status: "ready",
    database: "supabase-postgres",
    modules: sidebarModules.length,
    mvpModules,
    checkedAt: new Date().toISOString(),
  });
}

app.get("/api/health", asyncRoute(async (_request, response) => readinessResponse(response)));
app.get("/api/health/ready", asyncRoute(async (_request, response) => readinessResponse(response)));

app.get("/api/bootstrap", asyncRoute(async (request, response) => {
  response.json(await buildBootstrapPayload(requireAuthenticatedAccount(request)));
}));

app.get("/api/modules", (request, response) => {
  const actor = requireAuthenticatedAccount(request);
  const allowedModules = new Set(roleAccess[actor.role] || []);
  response.json({
    modules: sidebarModules.filter((module) => allowedModules.has(module.id)),
    mvpModules: mvpModules.filter((moduleId) => allowedModules.has(moduleId)),
  });
});

app.get("/api/marketing/config", (request, response) => {
  assertReadAllowed(request, "sms");
  response.json({
    smsReady: smsReady(),
    emailReady: emailReady(),
    dryRun: envFlag(process.env.MARKETING_DRY_RUN),
  });
});

app.get("/api/settings", asyncRoute(async (request, response) => {
  assertReadAllowed(request, "settings");
  response.json(await getPersistedSettings());
}));

app.put("/api/settings", asyncRoute(async (request, response) => {
  assertMutationAllowed(request, "settings");
  const settings = await savePersistedSettings(request.body ?? {});
  const auditLog = await prisma.auditLog.create({
    data: auditData(request, {
      area: "Settings",
      action: "Settings updated",
      details: "Company, receipt, tax, or SMS settings changed.",
    }),
  });
  response.json({ settings, auditLog });
}));

app.get("/api/leads/integrations", asyncRoute(async (request, response) => {
  assertReadAllowed(request, "leads");
  response.json({ integrations: await listLeadIntegrations() });
}));

app.get("/api/leads/webhook-events", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "leads");
  const events = await prisma.webhookEvent.findMany({
    where: isAllBranches(actor.branch) ? {} : { lead: { is: { branch: actor.branch } } },
    orderBy: [{ receivedAt: "desc" }],
    take: 100,
  });
  response.json({ events });
}));

app.get("/api/leads/webhooks/meta-facebook", (request, response) => {
  const mode = clean(request.query["hub.mode"]);
  const token = clean(request.query["hub.verify_token"]);
  const challenge = clean(request.query["hub.challenge"]);
  if (mode === "subscribe" && token && token === clean(process.env.META_VERIFY_TOKEN)) {
    response.status(200).send(challenge);
    return;
  }
  response.status(403).json({ error: "Meta webhook verification failed." });
});

app.post("/api/leads/webhooks/:provider", asyncRoute(async (request, response) => {
  const provider = clean(request.params.provider).toLowerCase();
  const result = await processLeadWebhook(provider, request);
  response.status(result.duplicateEvent || result.status === "Duplicate" ? 200 : 201).json(result);
}));

app.post("/api/leads/:id/stage", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) throw apiError("Lead not found.", 404);
  assertMutationAllowed(request, "leads", existing.branch);

  const data = normalizeLeadPayload({
    ...existing,
    ...request.body,
    status: request.body?.status,
    lossReason: request.body?.lossReason ?? existing.lossReason,
  }, id);
  assertMutationAllowed(request, "leads", data.branch);
  validateLeadRules(data, existing);

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: stripMeta(data) });
    await writeLeadSideRecords(tx, request, lead, data, existing);
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead stage updated",
      details: `${lead.name} moved to ${lead.status}.`,
    });
    return { lead, auditLog };
  });

  response.json({ lead: await loadLead(id), auditLog: result.auditLog });
}));

app.post("/api/leads/:id/activities", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw apiError("Lead not found.", 404);
  assertMutationAllowed(request, "leads", lead.branch);

  const result = await prisma.$transaction(async (tx) => {
    const activity = await createLeadActivity(tx, request, id, {
      type: clean(request.body?.type) || "Note",
      title: clean(request.body?.title) || "Lead note added",
      note: clean(request.body?.note),
      channel: clean(request.body?.channel),
      metadata: request.body?.metadata || {},
    });
    const updatedLead = await tx.lead.update({
      where: { id },
      data: request.body?.lastContactedAt ? { lastContactedAt: clean(request.body.lastContactedAt), firstRespondedAt: lead.firstRespondedAt || new Date().toISOString() } : {},
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead activity added",
      details: `${updatedLead.name}: ${activity.title}.`,
    });
    return { activity, auditLog };
  });

  response.status(201).json({ lead: await loadLead(id), activity: result.activity, auditLog: result.auditLog });
}));

app.post("/api/leads/:id/follow-ups", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw apiError("Lead not found.", 404);
  assertMutationAllowed(request, "leads", lead.branch);
  const followUpData = normalizeFollowUpPayload(request.body ?? {}, lead);

  const result = await prisma.$transaction(async (tx) => {
    const followUp = await tx.leadFollowUp.create({ data: { leadId: id, ...followUpData } });
    const updatedLead = await tx.lead.update({
      where: { id },
      data: {
        nextFollowUpAt: followUpData.dueAt,
        nextAction: followUpData.purpose,
        nextStep: followUpData.notes || followUpData.purpose,
        followUpCount: Number(lead.followUpCount || 0) + 1,
      },
    });
    await createLeadActivity(tx, request, id, {
      type: "Follow-Up",
      title: "Follow-up scheduled",
      note: followUpData.notes || followUpData.purpose,
      metadata: { dueAt: followUpData.dueAt, channel: followUpData.channel },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead follow-up scheduled",
      details: `${updatedLead.name} follow-up due ${followUpData.dueAt}.`,
    });
    return { followUp, auditLog };
  });

  response.status(201).json({ lead: await loadLead(id), followUp: result.followUp, auditLog: result.auditLog });
}));

app.post("/api/leads/:id/appointments", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw apiError("Lead not found.", 404);
  assertMutationAllowed(request, "leads", lead.branch);
  assertMutationAllowed(request, "appointments", request.body?.branch || lead.branch);

  const serviceId = cleanOptional(request.body?.serviceId);
  const service = serviceId ? await prisma.service.findUnique({ where: { id: serviceId } }) : null;
  const appointmentClientId = cleanOptional(request.body?.clientId || lead.linkedClientId);
  if (appointmentClientId) {
    const appointmentClient = await prisma.client.findUnique({ where: { id: appointmentClientId }, select: { branch: true } });
    if (!appointmentClient) throw apiError("Selected client was not found.", 404);
    assertMutationAllowed(request, "clients", appointmentClient.branch);
  }
  const appointmentData = {
    date: requireText(request.body?.date || lead.preferredDate, "Appointment date"),
    time: requireText(request.body?.time || lead.preferredTime, "Appointment time"),
    clientId: appointmentClientId,
    client: clean(request.body?.client || lead.name),
    serviceId,
    service: clean(service?.name) || clean(request.body?.service || lead.interest) || "Consultation",
    branch: requireText(request.body?.branch || lead.branch, "Branch"),
    room: clean(request.body?.room) || "To assign",
    staff: clean(request.body?.staff) || clean(lead.owner) || "Any available",
    status: clean(request.body?.status) || "Pending Confirmation",
    deposit: numberValue(request.body?.deposit, "Deposit", { min: 0 }),
    leadId: lead.id,
    notes: clean(request.body?.notes || lead.concern || lead.message),
    internalNotes: "Booked from Leads module.",
  };
  if (service) {
    const offeredBranches = parseJsonList(service.branches);
    if (offeredBranches.length && !offeredBranches.includes(appointmentData.branch) && !offeredBranches.includes("All branches")) {
      throw apiError("Selected service is not offered at this branch.", 409);
    }
  }
  appointmentData.duration = await appointmentDurationFor(appointmentData);
  await assertAppointmentSlotAvailable(appointmentData);

  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({ data: appointmentData });
    const updatedLead = await tx.lead.update({
      where: { id },
      data: {
        status: "Appointment Booked",
        linkedAppointmentId: appointment.id,
        nextAction: "Confirm appointment",
        nextStep: "Confirm appointment details and deposit.",
      },
    });
    await createLeadActivity(tx, request, id, {
      type: "Appointment",
      title: "Appointment booked",
      note: `${appointment.date} ${appointment.time} for ${appointment.service}`,
      previousStatus: lead.status,
      newStatus: updatedLead.status,
      metadata: { appointmentId: appointment.id },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead appointment booked",
      details: `${lead.name} booked ${appointment.service} on ${appointment.date}.`,
    });
    return { appointment, auditLog };
  });

  response.status(201).json({ lead: await loadLead(id), appointment: result.appointment, auditLog: result.auditLog });
}));

app.post("/api/leads/:id/convert", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const lead = await prisma.lead.findUnique({ where: { id }, include: { conversions: true } });
  if (!lead) throw apiError("Lead not found.", 404);
  assertMutationAllowed(request, "leads", lead.branch);
  assertMutationAllowed(request, "clients", lead.branch);
  if (clean(lead.linkedClientId) || lead.conversions.length) {
    throw apiError("This lead has already been converted.", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    let client = null;
    const requestedClientId = clean(request.body?.clientId);
    if (requestedClientId) {
      client = await tx.client.findUnique({ where: { id: requestedClientId } });
      if (!client) throw apiError("Selected client was not found.", 404);
      assertMutationAllowed(request, "clients", client.branch);
    } else {
      const normalizedPhone = normalizePhone(lead.mobile);
      const email = clean(lead.email).toLowerCase();
      const matches = await tx.client.findMany({
        where: {
          AND: [
            { branch: lead.branch },
            { OR: [
              clean(lead.mobile) ? { mobile: lead.mobile } : undefined,
              email ? { email } : undefined,
            ].filter(Boolean) },
          ],
        },
        take: 10,
      });
      const existingClient = matches.find((item) => normalizedPhone && normalizePhone(item.mobile) === normalizedPhone)
        || matches.find((item) => email && clean(item.email).toLowerCase() === email);
      if (existingClient && !request.body?.allowExistingMatch) {
        throw apiError(`Existing client match found: ${existingClient.fullName}. Link this lead to the existing client instead.`, 409);
      }
      client = existingClient || await tx.client.create({
        data: normalizeClientPayload({
          fullName: lead.name,
          mobile: lead.mobile,
          email: lead.email,
          branch: lead.branch,
          source: lead.firstTouchSource || lead.source,
          referral: lead.campaign,
          skinConcerns: lead.concern,
          treatmentGoals: lead.interest || lead.interestedTreatment || lead.interestedPackage,
          consentStatus: lead.privacyConsent ? "Signed" : "Pending",
          marketingOptIn: lead.marketingConsent,
          preferredStaff: lead.owner,
          tag: "Converted lead",
          retention: "New",
          nextVisit: lead.preferredDate,
        }),
      });
    }

    const actor = actorFromRequest(request);
    const updatedLead = await tx.lead.update({
      where: { id },
      data: {
        status: "Converted",
        linkedClientId: client.id,
        convertedAt: new Date().toISOString(),
        convertedBy: actor.name,
        outcome: "Converted to client",
      },
    });
    const conversion = await tx.leadConversion.create({
      data: {
        leadId: id,
        clientId: client.id,
        appointmentId: clean(request.body?.appointmentId || lead.linkedAppointmentId),
        convertedBy: actor.name,
        source: lead.firstTouchSource || lead.source,
        campaign: lead.campaign || lead.utmCampaign,
        notes: clean(request.body?.notes),
      },
    });
    await createLeadActivity(tx, request, id, {
      type: "Conversion",
      title: "Lead converted to client",
      note: clean(request.body?.notes),
      previousStatus: lead.status,
      newStatus: updatedLead.status,
      metadata: { clientId: client.id, conversionId: conversion.id },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead converted",
      details: `${lead.name} converted to client ${client.fullName}.`,
    });
    return { client, conversion, auditLog };
  });

  response.status(201).json({ lead: await loadLead(id), client: result.client, conversion: result.conversion, auditLog: result.auditLog });
}));

app.post("/api/leads/:id/merge", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const duplicateId = requireText(request.body?.duplicateId, "Duplicate lead");
  if (id === duplicateId) throw apiError("Choose a different duplicate lead to merge.", 400);
  const [primary, duplicate] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.lead.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!primary || !duplicate) throw apiError("Lead to merge was not found.", 404);
  assertMutationAllowed(request, "leads", primary.branch);
  assertMutationAllowed(request, "leads", duplicate.branch);

  const result = await prisma.$transaction(async (tx) => {
    await tx.leadActivity.updateMany({ where: { leadId: duplicateId }, data: { leadId: id } });
    await tx.leadFollowUp.updateMany({ where: { leadId: duplicateId }, data: { leadId: id } });
    await tx.leadTouchpoint.updateMany({ where: { leadId: duplicateId }, data: { leadId: id } });
    await tx.externalLeadIdentity.updateMany({ where: { leadId: duplicateId }, data: { leadId: id } });
    await tx.webhookEvent.updateMany({ where: { leadId: duplicateId }, data: { leadId: id } });
    await tx.lead.update({
      where: { id: duplicateId },
      data: {
        status: "Lost",
        lossReason: "Duplicate",
        duplicateOfLeadId: id,
        archivedAt: new Date().toISOString(),
      },
    });
    await createLeadActivity(tx, request, id, {
      type: "Merge",
      title: "Duplicate lead merged",
      note: `${duplicate.name} merged into ${primary.name}.`,
      metadata: { duplicateId },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Leads",
      action: "Lead duplicate merged",
      details: `${duplicate.name} merged into ${primary.name}.`,
    });
    return { auditLog };
  });

  response.json({ lead: await loadLead(id), auditLog: result.auditLog });
}));

app.get("/api/clients", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "clients");
  response.json(await listResource("clients", actor));
}));

app.post("/api/clients", asyncRoute(async (request, response) => {
  const data = normalizeClientPayload(request.body);
  assertMutationAllowed(request, "clients", data.branch);
  const client = await prisma.client.create({ data });
  response.status(201).json(client);
}));

app.put("/api/clients/:id", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw apiError("Client not found.", 404);
  assertMutationAllowed(request, "clients", existing.branch);
  const data = normalizeClientPayload(request.body, id);
  assertMutationAllowed(request, "clients", data.branch);
  const client = await prisma.client.update({ where: { id }, data });
  response.json(client);
}));

app.delete("/api/clients/:id", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw apiError("Client not found.", 404);
  assertMutationAllowed(request, "clients", existing.branch);
  await prisma.client.delete({ where: { id } });
  response.status(204).end();
}));

app.get("/api/resources/:resource", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  const actor = assertReadAllowed(request, config.module);
  response.json(await listResource(request.params.resource, actor));
}));

app.post("/api/resources/:resource", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  if (config.readOnly) {
    throw apiError(`${request.params.resource} cannot be created through the generic API.`, 405);
  }

  const data = await config.normalize(request.body);
  await assertResourceMutationAllowed(request, config, data);
  if (config.beforeWrite) await config.beforeWrite(data);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx[config.delegate].create({ data: stripMeta(data) });
    if (config.afterWrite) await config.afterWrite(tx, request, record, data, null);
    const auditLog = await writeAudit(tx, request, {
      area: config.area,
      action: `${config.area} created`,
      details: `${config.label(record)} created.`,
    });
    return { record, auditLog };
  });

  response.status(201).json({
    ...result,
    record: config.serialize ? config.serialize(result.record) : result.record,
  });
}));

app.put("/api/resources/:resource/:id", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  if (config.readOnly) {
    throw apiError(`${request.params.resource} cannot be updated through the generic API.`, 405);
  }

  const id = String(request.params.id);
  const existing = await prisma[config.delegate].findUnique({ where: { id } });
  if (!existing) throw apiError(`${config.area} record not found.`, 404);
  await assertResourceMutationAllowed(request, config, existing);
  const data = await config.normalize(request.body, id);
  await assertResourceMutationAllowed(request, config, data);
  if (config.beforeWrite) await config.beforeWrite(data, id);

  const result = await prisma.$transaction(async (tx) => {
    const previous = config.afterWrite ? existing : null;
    const record = await tx[config.delegate].update({ where: { id }, data: stripMeta(data) });
    if (config.afterWrite) await config.afterWrite(tx, request, record, data, previous);
    const auditLog = await writeAudit(tx, request, {
      area: config.area,
      action: `${config.area} updated`,
      details: `${config.label(record)} updated.`,
    });
    return { record, auditLog };
  });

  response.json({
    ...result,
    record: config.serialize ? config.serialize(result.record) : result.record,
  });
}));

app.delete("/api/resources/:resource/:id", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  if (config.readOnly) {
    throw apiError(`${request.params.resource} cannot be deleted through the generic API.`, 405);
  }

  const id = String(request.params.id);
  const existing = await prisma[config.delegate].findUnique({ where: { id } });
  if (!existing) throw apiError(`${config.area} record not found.`, 404);
  await assertResourceMutationAllowed(request, config, existing);
  await prisma.$transaction(async (tx) => {
    const record = await tx[config.delegate].delete({ where: { id } });
    await writeAudit(tx, request, {
      area: config.area,
      action: `${config.area} deleted`,
      details: `${config.label(record)} deleted.`,
    });
  });
  response.status(204).end();
}));

app.post("/api/public-bookings", asyncRoute(async (request, response) => {
  const values = request.body ?? {};
  const serviceId = requireText(values.serviceId, "Service");
  const mobile = requireText(values.mobile, "Mobile number");
  const fullName = requireText(values.fullName, "Full name");
  const bookingBranch = requireText(values.branch, "Branch");
  if (values.privacyConsent !== true) throw apiError("Privacy consent is required before booking.", 400);
  const requestedDate = requireText(values.date, "Appointment date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate < new Date().toISOString().slice(0, 10)) {
    throw apiError("Choose a valid current or future appointment date.", 400);
  }
  if (!/^\d{2}:\d{2}$/.test(requireText(values.time, "Appointment time"))) {
    throw apiError("Choose a valid appointment time.", 400);
  }
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    throw apiError("Selected service is unavailable.", 404);
  }
  const branch = await prisma.branch.findUnique({ where: { name: bookingBranch } });
  if (!branch) throw apiError("Selected branch is unavailable.", 404);
  const serviceBranches = parseJsonList(service.branches);
  if (serviceBranches.length && !serviceBranches.includes(bookingBranch) && !serviceBranches.includes("All branches")) {
    throw apiError("Selected service is not offered at this branch.", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    let client = await tx.client.findFirst({ where: { mobile, branch: bookingBranch } });
    if (!client) {
      client = await tx.client.create({
        data: normalizeClientPayload({
          fullName,
          mobile,
          email: values.email,
          branch: bookingBranch,
          source: "Online Booking",
          referral: "Public portal",
          skinConcerns: values.concern,
          treatmentGoals: "Consultation request",
          marketingOptIn: Boolean(values.marketingOptIn),
          preferredStaff: values.staff,
          tag: "Online",
          retention: "New",
          nextVisit: values.date,
        }),
      });
    }

    const appointmentData = {
      date: requestedDate,
      time: requireText(values.time, "Appointment time"),
      clientId: client.id,
      client: client.fullName,
      serviceId,
      service: service.name,
      branch: bookingBranch,
      room: "To assign",
      staff: clean(values.staff) || "Any available",
      status: "Pending Confirmation",
      deposit: 0,
      notes: clean(values.concern),
      internalNotes: "Created from public online booking.",
    };
    appointmentData.duration = await appointmentDurationFor(appointmentData);
    await assertAppointmentSlotAvailable(appointmentData);

    const lead = await tx.lead.create({
      data: {
        name: fullName,
        mobile,
        source: "Online Booking",
        interest: service.name,
        status: "New Inquiry",
        owner: "Front Desk",
        branch: appointmentData.branch,
        assignedBranch: appointmentData.branch,
        created: new Date().toISOString().slice(0, 10),
        nextStep: "Confirm online request",
        nextAction: "Confirm online request",
        preferredDate: appointmentData.date,
        preferredTime: appointmentData.time,
        permissionToContact: true,
        marketingConsent: Boolean(values.marketingOptIn),
        privacyConsent: true,
        consentSource: "Online booking",
        consentTimestamp: new Date().toISOString(),
      },
    });
    const appointment = await tx.appointment.create({ data: { ...appointmentData, leadId: lead.id } });
    const linkedLead = await tx.lead.update({
      where: { id: lead.id },
      data: { status: "Appointment Booked", linkedAppointmentId: appointment.id },
    });
    await createLeadActivity(tx, null, lead.id, {
      type: "Appointment",
      title: "Online booking appointment linked",
      note: `${appointment.date} ${appointment.time} for ${appointment.service}`,
      actor: "Online Booking",
      actorRole: "Public",
      previousStatus: lead.status,
      newStatus: linkedLead.status,
      metadata: { appointmentId: appointment.id },
    });
    const auditLog = await tx.auditLog.create({
      data: {
        time: new Date().toLocaleString("en-PH"),
        actor: "Online Booking",
        role: "Public",
        area: "Online Booking",
        action: "Online booking submitted",
        details: `${appointment.client} requested ${appointment.service}.`,
      },
    });

    return { client, lead: linkedLead, appointment, auditLog };
  });

  response.status(201).json({
    bookingReference: result.appointment.id,
    appointment: {
      id: result.appointment.id,
      date: result.appointment.date,
      time: result.appointment.time,
      service: result.appointment.service,
      branch: result.appointment.branch,
      status: result.appointment.status,
    },
  });
}));

app.post("/api/inventory/:id/movements", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const qty = numberValue(request.body?.qty, "Movement quantity");
  if (qty === 0) {
    throw apiError("Movement quantity cannot be zero.");
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    throw apiError("Inventory item not found.", 404);
  }

  assertMutationAllowed(request, "inventory", item.branch);

  const result = await prisma.$transaction(async (tx) => {
    const nextStock = Number(item.stock || 0) + qty;
    if (nextStock < 0) {
      throw apiError(`Inventory is insufficient for ${item.item}.`, 409);
    }
    const inventoryItem = await tx.inventoryItem.update({ where: { id }, data: { stock: nextStock } });
    const movement = await tx.inventoryMovement.create({
      data: {
        date: clean(request.body?.date) || new Date().toISOString().slice(0, 10),
        itemId: id,
        item: item.item,
        branch: item.branch,
        qty,
        reason: clean(request.body?.reason) || "Stock movement",
        user: actorFromRequest(request).name,
      },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Inventory",
      action: "Stock movement posted",
      details: `${item.item}: ${qty}.`,
    });
    return { inventoryItem, movement, auditLog };
  });

  response.status(201).json(result);
}));

app.post("/api/packages/:id/redeem", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const pkg = await prisma.clinicPackage.findUnique({ where: { id } });
  if (!pkg) {
    throw apiError("Package not found.", 404);
  }

  assertMutationAllowed(request, "packages", pkg.branch);
  assertPackageRedeemable(pkg);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.clinicPackage.update({
      where: { id },
      data: packageAfterRedemption(pkg),
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Packages",
      action: "Package session redeemed",
      details: `${pkg.name} redeemed for ${pkg.client}.`,
    });
    return { record, auditLog };
  });

  response.json(result);
}));

app.post("/api/transactions/:id/void", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const sale = await prisma.sale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) {
    throw apiError("Transaction not found.", 404);
  }

  assertMutationAllowed(request, "pos", sale.branch);
  if (sale.status === "Void") {
    response.json({ record: serializeSale(sale), auditLog: null });
    return;
  }

  const actor = actorFromRequest(request);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.sale.update({ where: { id }, data: { status: "Void" }, include: { items: true } });

    const saleMovements = await tx.inventoryMovement.findMany({ where: { reason: `Sold on ${sale.invoice}` } });
    const reversalMovements = [];
    for (const movement of saleMovements) {
      if (!movement.itemId) continue;
      const item = await tx.inventoryItem.findUnique({ where: { id: movement.itemId } });
      if (!item) continue;
      await tx.inventoryItem.update({
        where: { id: movement.itemId },
        data: { stock: { increment: -movement.qty } },
      });
      reversalMovements.push(await tx.inventoryMovement.create({
        data: {
          date: new Date().toISOString().slice(0, 10),
          itemId: movement.itemId,
          item: movement.item,
          branch: movement.branch,
          qty: -movement.qty,
          reason: `Void of ${sale.invoice}`,
          user: actor.name,
        },
      }));
    }

    const salePayments = parseJsonList(sale.payments);
    const restoredCertificates = [];
    const certificateRefunds = new Map();
    const packageRestores = new Map();
    for (const payment of salePayments) {
      const certificateId = clean(payment?.giftCertificateId);
      const packageId = clean(payment?.packageId);
      const amount = Number(payment?.amount || 0);
      if (certificateId && amount > 0) {
        certificateRefunds.set(certificateId, (certificateRefunds.get(certificateId) || 0) + amount);
      }
      if (packageId) {
        packageRestores.set(packageId, (packageRestores.get(packageId) || 0) + 1);
      }
    }
    for (const [certificateId, amount] of certificateRefunds) {
      const certificate = await tx.giftCertificate.findUnique({ where: { id: certificateId } });
      if (!certificate) continue;
      restoredCertificates.push(await tx.giftCertificate.update({
        where: { id: certificateId },
        data: {
          balance: Number(certificate.balance || 0) + amount,
          status: certificate.status === "Used" ? "Active" : certificate.status,
        },
      }));
    }
    const restoredPackages = [];
    for (const [packageId, sessions] of packageRestores) {
      const pkg = await tx.clinicPackage.findUnique({ where: { id: packageId } });
      if (!pkg) continue;
      restoredPackages.push(await tx.clinicPackage.update({
        where: { id: packageId },
        data: packageAfterVoid(pkg, sessions),
      }));
    }

    const reversalNotes = [
      ...(reversalMovements.length ? [`${reversalMovements.length} stock movement(s) reversed`] : []),
      ...restoredCertificates.map((certificate) => `GC ${certificate.code} restored to ${certificate.balance}`),
      ...restoredPackages.map((pkg) => `${pkg.name} back to ${pkg.used}/${pkg.sessions} sessions`),
    ];
    const auditLog = await writeAudit(tx, request, {
      area: "POS",
      action: "Transaction voided",
      details: `${sale.invoice} marked void.${reversalNotes.length ? ` ${reversalNotes.join("; ")}.` : ""}`,
    });

    return {
      record: serializeSale(record),
      movements: reversalMovements,
      inventory: reversalMovements.length ? await tx.inventoryItem.findMany({ orderBy: [{ item: "asc" }] }) : null,
      giftCertificates: restoredCertificates,
      packages: restoredPackages,
      auditLog,
    };
  });

  response.json(result);
}));

app.post("/api/pos/checkout", asyncRoute(async (request, response) => {
  const draft = request.body?.draft ?? {};
  const paymentData = request.body?.payment ?? {};
  const branch = requireText(draft.branch, "Branch");
  assertMutationAllowed(request, "pos", branch);

  const payments = Array.isArray(paymentData.payments) ? paymentData.payments : [];
  const normalizedPayments = payments.map((payment) => ({
    method: requireText(payment.method, "Payment method"),
    amount: numberValue(payment.amount, "Payment amount", { min: 0 }),
    ...(clean(payment.giftCertificateId) ? { giftCertificateId: clean(payment.giftCertificateId) } : {}),
    ...(clean(payment.packageId) ? { packageId: clean(payment.packageId) } : {}),
  })).filter((payment) => payment.amount > 0);
  if (!normalizedPayments.length) {
    throw apiError("At least one payment amount is required.");
  }
  for (const payment of normalizedPayments) {
    if (payment.method === "Gift Certificate" && !payment.giftCertificateId) {
      throw apiError("Select the gift certificate used for this payment.");
    }
    if (payment.method === "Package" && !payment.packageId) {
      throw apiError("Select the client package used for this payment.");
    }
  }

  const checkout = await calculateCheckout(draft);
  const paidAmount = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const deductions = await inventoryDeductionsForSale(checkout.items, branch);
  const actor = actorFromRequest(request);

  const result = await prisma.$transaction(async (tx) => {
    for (const deduction of deductions) {
      const item = await tx.inventoryItem.findUnique({ where: { id: deduction.inventoryId } });
      if (!item) {
        throw apiError(`Inventory item ${deduction.item} no longer exists.`, 409);
      }
      if (Number(item.stock || 0) < deduction.qty) {
        throw apiError(`Inventory is insufficient for ${item.item}.`, 409);
      }
    }

    const settledCertificates = [];
    const certificateCharges = new Map();
    for (const payment of normalizedPayments) {
      if (!payment.giftCertificateId) continue;
      certificateCharges.set(payment.giftCertificateId, (certificateCharges.get(payment.giftCertificateId) || 0) + payment.amount);
    }
    for (const [certificateId, amount] of certificateCharges) {
      const certificate = await tx.giftCertificate.findUnique({ where: { id: certificateId } });
      assertGiftCertificateUsable(certificate, { branch, amount });
      settledCertificates.push(await tx.giftCertificate.update({
        where: { id: certificateId },
        data: giftCertificateAfterPayment(certificate, amount),
      }));
    }

    const settledPackages = [];
    const packageRedemptions = new Map();
    for (const payment of normalizedPayments) {
      if (!payment.packageId) continue;
      packageRedemptions.set(payment.packageId, (packageRedemptions.get(payment.packageId) || 0) + 1);
    }
    for (const [packageId, sessions] of packageRedemptions) {
      const pkg = await tx.clinicPackage.findUnique({ where: { id: packageId } });
      assertPackageRedeemable(pkg, { branch });
      if (Number(pkg.used || 0) + sessions > Number(pkg.sessions || 0)) {
        throw apiError(`Package ${pkg.name} only has ${Number(pkg.sessions || 0) - Number(pkg.used || 0)} session(s) left.`, 409);
      }
      settledPackages.push(await tx.clinicPackage.update({
        where: { id: packageId },
        data: packageAfterRedemption(pkg, sessions),
      }));
    }

    const saleCount = await tx.sale.count();
    const invoice = `${clean(draft.invoicePrefix) || "MACE"}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(saleCount + 1).padStart(3, "0")}`;
    const sale = await tx.sale.create({
      data: {
        invoice,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
        client: clean(draft.clientName) || "Walk-in",
        branch,
        staff: clean(draft.staff) || actor.name,
        subtotal: checkout.subtotal,
        discount: checkout.discountAmount,
        total: checkout.total,
        payments: JSON.stringify(normalizedPayments),
        status: paidAmount >= checkout.total ? "Paid" : "Partial",
        notes: clean(paymentData.notes || draft.notes),
        items: {
          create: checkout.items.map((item) => ({
            name: item.name,
            type: item.type,
            qty: item.qty,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });

    const movements = [];
    for (const deduction of deductions) {
      const updatedItem = await tx.inventoryItem.update({
        where: { id: deduction.inventoryId },
        data: { stock: { decrement: deduction.qty } },
      });
      const movement = await tx.inventoryMovement.create({
        data: {
          date: sale.date,
          itemId: deduction.inventoryId,
          item: updatedItem.item,
          branch: updatedItem.branch || branch,
          qty: -deduction.qty,
          reason: `Sold on ${sale.invoice}`,
          user: actor.name,
        },
      });
      movements.push(movement);
    }

    const tenderNotes = [
      ...settledCertificates.map((certificate) => `GC ${certificate.code} balance ${certificate.balance}`),
      ...settledPackages.map((pkg) => `${pkg.name} ${pkg.used}/${pkg.sessions} sessions`),
    ];
    const auditLog = await writeAudit(tx, request, {
      area: "POS",
      action: "POS transaction completed",
      details: `${sale.invoice} posted for ${checkout.total}.${tenderNotes.length ? ` ${tenderNotes.join("; ")}.` : ""}`,
    });

    return {
      sale: serializeSale(sale),
      inventory: await tx.inventoryItem.findMany({ orderBy: [{ item: "asc" }] }),
      movements,
      giftCertificates: settledCertificates,
      packages: settledPackages,
      auditLog,
    };
  });

  response.status(201).json(result);
}));

app.post("/api/marketing/send", asyncRoute(async (request, response) => {
  const actor = assertMutationAllowed(request, "sms");
  const campaign = request.body?.campaign ?? {};
  const settings = await getPersistedSettings();
  const channel = marketingChannel(campaign);
  const clients = await listResource("clients", actor);
  const templates = await prisma.smsTemplate.findMany({ where: { active: true } });
  const template = pickTemplate({ campaign, templates, channel });
  const baseMessage = clean(campaign.message) || clean(template.text);
  const subject = clean(campaign.subject) || clean(campaign.name) || "A note from MACE";
  const dryRun = envFlag(process.env.MARKETING_DRY_RUN);

  if (!clean(campaign.name)) {
    throw apiError("Campaign name is required.");
  }
  if (!baseMessage) {
    throw apiError("Campaign message is required.");
  }
  if (channel === "sms" && !dryRun && !smsReady()) {
    throw apiError("SMS is not configured. Add Twilio credentials to .env and restart the API.", 503);
  }
  if (channel === "email" && !dryRun && !emailReady()) {
    throw apiError("Email is not configured. Add SMTP settings to .env and restart the API.", 503);
  }

  const { candidates, recipients } = selectMarketingRecipients({ clients, campaign, channel });
  const maxSends = Number(process.env.MAX_MARKETING_SENDS || 500);

  if (!recipients.length) {
    throw apiError(`No opted-in clients with ${channel === "sms" ? "mobile numbers" : "email addresses"} matched this campaign.`);
  }
  if (recipients.length > maxSends) {
    throw apiError(`This campaign has ${recipients.length} recipients. Set MAX_MARKETING_SENDS higher to send it.`, 413);
  }

  const transporter = channel === "email" && !dryRun ? createEmailTransport() : null;
  const failures = [];
  let sent = 0;

  for (const recipient of recipients) {
    const text = renderMarketingText(baseMessage, { client: recipient.client, campaign, settings });
    try {
      if (dryRun) {
        console.log(`[marketing dry-run] ${channel.toUpperCase()} to ${recipient.contact}: ${text}`);
      } else if (channel === "sms") {
        await sendTwilioSms({ to: recipient.contact, body: text });
      } else {
        await sendSmtpEmail({ transporter, to: recipient.contact, subject, text });
      }
      sent += 1;
    } catch (error) {
      failures.push({
        client: recipient.client.fullName,
        contact: recipient.contact,
        error: error.message || "Delivery failed.",
      });
    }
  }

  if (!sent && failures.length) {
    throw apiError(failures[0].error || "No messages were delivered.", 502);
  }

  const failed = failures.length;
  const credits = channel === "sms" ? sent : 0;
  let updatedCampaign = null;
  let auditLog = null;

  await prisma.$transaction(async (tx) => {
    if (clean(campaign.id)) {
      updatedCampaign = await tx.marketingCampaign.update({
        where: { id: clean(campaign.id) },
        data: {
          status: failed ? "Partial" : "Sent",
          sent,
          credits: channel === "sms" ? credits : Number(campaign.credits || 0),
        },
      });
    }

    auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: channel === "email" ? "Email campaign sent" : "SMS campaign sent",
      details: `${campaign.name} delivered to ${sent} client${sent === 1 ? "" : "s"}${failed ? ` with ${failed} failed` : ""}.`,
    });
  });

  response.status(failures.length ? 207 : 200).json({
    ok: failures.length === 0,
    channel,
    provider: dryRun ? "dry-run" : channel === "sms" ? "twilio" : "smtp",
    sent,
    failed,
    skipped: Math.max(0, candidates.length - recipients.length),
    credits,
    failures: failures.slice(0, 5),
    campaign: updatedCampaign,
    auditLog,
  });
}));

if (process.env.NODE_ENV === "production") {
  const distPath = resolve("dist");
  app.use(express.static(distPath, { maxAge: "1d", index: false }));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
    return response.sendFile(resolve(distPath, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  const message = status === 500 ? "Clinic API failed to process the request." : error.message;
  if (status === 500) {
    console.error(error);
  }
  response.status(status).json({ error: message });
});

assertProductionEnvironment();

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`MACE ClinicOS listening on port ${port}`);
  ensureDefaultAccounts().catch((error) => {
    console.error("Failed to ensure default accounts after startup.", error);
  });
});

function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

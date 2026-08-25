import "dotenv/config";
import cors from "cors";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { prisma } from "./prisma.js";
import { demoPasswordMeetsMinimum } from "./demoPasswordPolicy.js";
import { mvpModules, sidebarModules } from "./moduleRegistry.js";
import {
  INCLUDED_WEBSITE_PAGES,
  PLAN_WEBSITE_PAGE_ALLOWANCES,
  assertUsageWithinPlan,
  billingDetails,
  getSubscriptionPlan,
  isMonthlyPlan,
  normalizeBillingCycle,
  planLimitMessage,
  publicSubscriptionPlans,
  serializeSubscription,
  trialWindow,
  userAdditionWithinPlan,
} from "./subscriptionPlans.js";
import { activationRequestEmail, subscriptionSalesRecipient } from "./subscriptionActivationEmail.js";
import {
  googleAuthenticationReady,
  googleClientId,
  googleIsAuthoritativeForEmail,
  verifyGoogleCredential,
} from "./googleAuthentication.js";
import { registrationConfirmationEmail } from "./registrationConfirmationEmail.js";
import {
  clientImageStorageProvider,
  deleteCloudinaryImage,
  fetchCloudinaryImage,
  uploadCloudinaryImage,
} from "./cloudinaryStorage.js";
import { initialSettings, roleAccess } from "../src/data.js";
import { isDemoSignupHostname } from "../src/config/demoAccess.js";
import { canManageOrganization, isAdmin, isBusinessOwner } from "../src/organizationRoles.js";
import { nextRoomNames, renameBranchReferences } from "./organizationBranches.js";
import {
  ARCHIVED_ROOM_STATUS,
  activeRoomRecords,
  findRoomNameMatch,
  isActiveRoom,
  isUpcomingRoomAppointment,
  normalizeRoomName,
} from "./roomManagement.js";
import { createFaceTrackAttendanceRouter } from "./facetrackAttendance.js";
import { createPayrollRouter } from "./payroll.js";
import { assertProductionEnvironment } from "./productionConfig.js";
import {
  accountMatchesStaffIdentity,
  branchWhere,
  canAccessBranch,
  canMutateBranch,
  filterServiceBranches,
  hasOrganizationPermission,
  hasOrganizationWideAccess,
  hasValidBranchAssignment,
  isAllBranches,
  isPublicApiRequest,
  moduleAllowed,
  requiredModuleForApiRequest,
} from "./accessControl.js";
import {
  ALL_BRANCHES_ID,
  accountAccessInclude,
  branchManagementInclude,
  branchStatuses,
  enabledModulesForBranch,
  normalizeBranchCode,
  parsePermissionList,
  resolveAccountBranchAccess,
} from "./branchAccess.js";
import {
  assertGiftCertificateUsable,
  assertPackageRedeemable,
} from "./posTenders.js";
import { assertDiscountUsable, assertPackageOwnedByClient, inventoryWhereForBranch } from "./posSecurity.js";
import { posCalendarDate } from "./posDate.js";
import { normalizePaymentReference } from "./paymentReference.js";
import {
  canonicalTreatmentPhotoKind,
  serializeTreatmentWithPhotos,
  treatmentPhotoKinds,
} from "./treatmentPhotos.js";
import {
  normalizeNotificationBranches,
  notificationIsUnread,
  notificationWhereForActor,
} from "./notifications.js";
import { normalizePublicBookingRequest } from "./publicBooking.js";
import { createFlipbookRouters } from "./flipbooks.js";
import {
  marketingHtmlToText,
  normalizeMarketingDesign,
  renderMarketingHtml,
  sanitizeMarketingHtml,
} from "./marketingHtml.js";
import {
  marketingAudienceMemberAsClient,
  marketingAudienceMemberMatchesSegment,
  normalizeMarketingAudienceMember,
} from "./marketingAudienceMembers.js";
import { marketingClientMatchesSegment } from "./marketingSegments.js";
import {
  normalizeMarketingMediaName,
  normalizeMarketingMediaSelection,
  serializeMarketingMediaAsset,
} from "./marketingMedia.js";
import {
  approveMarketingState,
  marketingApprovalRequired,
  marketingDeliveryStates,
  scheduleMarketingState,
} from "./marketingDelivery.js";
import {
  BRANCH_ADMIN_REQUIRED_PERMISSIONS,
  INVITATION_DELIVERY_STATUSES,
  INVITATION_PERMISSION_LABELS,
  INVITATION_PERMISSIONS,
  INVITATION_STATUSES,
  actorPermissions,
  assertAssignableInvitationRole,
  assertPrivilegedConfirmation,
  assertRequestedModules,
  assertRequestedPermissions,
  assignableInvitationRoles,
  canInviteAcrossBranches,
  canInviteUsers,
  canManageInvitation,
  invitationScopeWhere,
  isBranchManager,
  normalizeEmail,
  sanitizeInvitationMessage,
  uniqueStrings,
} from "./invitations.js";
import {
  createMarketingSurveyToken,
  marketingSurveyResponseId,
  verifyMarketingSurveyToken,
} from "./marketingSurveySecurity.js";

function createSystemPaymentReference(prefix, date) {
  return `${prefix}-${String(date || posCalendarDate()).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function systemPaymentReference(value, prefix, date) {
  const normalized = normalizePaymentReference(value);
  const expectedPrefix = `${prefix}-${String(date || posCalendarDate()).replace(/-/g, "")}-`;
  return normalized.startsWith(expectedPrefix) && /^[A-Z]+-\d{8}-[A-F0-9]{8}$/.test(normalized)
    ? normalized
    : createSystemPaymentReference(prefix, date);
}

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);
const allowedOrigins = clean(process.env.APP_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const inquiryEmbedFrameAncestors = [
  "'self'",
  "https://macebydrmace.com",
  "https://www.macebydrmace.com",
];

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
      fontSrc: ["'self'", "data:"],
      frameSrc: ["https://accounts.google.com/gsi/"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
}));
app.use((request, response, next) => {
  if (!["/inquire", "/book"].includes(request.path)) return next();

  response.removeHeader("X-Frame-Options");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  const contentSecurityPolicy = String(response.getHeader("Content-Security-Policy") || "");
  const directives = contentSecurityPolicy
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .filter((directive) => !directive.toLowerCase().startsWith("frame-ancestors "));
  directives.push(`frame-ancestors ${inquiryEmbedFrameAncestors.join(" ")}`);
  response.setHeader("Content-Security-Policy", `${directives.join("; ")};`);
  next();
});
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
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

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
const demoRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.DEMO_REGISTRATION_RATE_LIMIT || 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many demo accounts were requested. Please try again later." },
});
const publicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.PUBLIC_WRITE_RATE_LIMIT || 20),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait one minute." },
});
const invitationSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.INVITATION_RATE_LIMIT || 20),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many invitation attempts. Please wait 15 minutes." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/demo-register", demoRegistrationLimiter);
app.use("/api/auth/register", publicWriteLimiter);
app.use("/api/auth/google", loginLimiter);
app.use("/api/auth/forgot-password", loginLimiter);
app.use("/api/auth/reset-password", loginLimiter);
app.use("/api/public-leads", publicWriteLimiter);
app.use("/api/public-bookings", publicWriteLimiter);
app.use("/api/public-registration", publicWriteLimiter);
app.use("/api/public/flipbooks", publicWriteLimiter);
app.use("/api/public/marketing/survey", publicWriteLimiter);
app.use("/api/invitations/accept", publicWriteLimiter);
app.use("/api/leads/webhooks", publicWriteLimiter);

const clientStringFields = [
  "firstName",
  "middleName",
  "lastName",
  "photo",
  "mobile",
  "email",
  "gender",
  "birthday",
  "address",
  "street",
  "barangay",
  "city",
  "province",
  "civilStatus",
  "occupation",
  "emergency",
  "emergencyName",
  "emergencyPhone",
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
  promotions: "settings",
  consentTemplates: "settings",
  consentSubmissions: "clients",
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

function visibleApplicationBrand(value, fallback = "ZenshoTech") {
  const text = clean(value);
  return !text || /mace|clinicos/i.test(text) ? fallback : text;
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
  "marketing-image": { readModule: null, writeModule: "sms", public: true },
  "flipbook-logo": { readModule: null, writeModule: "flipbooks" },
  "flipbook-pdf": { readModule: "flipbooks", writeModule: "flipbooks" },
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

async function storeImageObject(dataUrl, category) {
  const { buffer, mimeType, extension } = decodeImageDataUrl(dataUrl);
  const id = randomBytes(18).toString("base64url");
  if (clientImageStorageProvider(category) === "cloudinary") {
    try {
      const cloudinaryAsset = await uploadCloudinaryImage({ buffer, mimeType, category, id });
      return { id, category, mimeType, ...cloudinaryAsset };
    } catch (error) {
      console.error(JSON.stringify({ event: "cloudinary_upload_failed", category, error: clean(error.message) }));
      throw apiError("Private client image storage could not accept the upload.", 502);
    }
  }
  const objectPath = `${category}/${id}.${extension}`;
  const uploaded = await storageRequest(objectPath, {
    method: "POST",
    headers: { "Content-Type": mimeType, "x-upsert": "false" },
    body: buffer,
  });
  if (!uploaded.ok) throw apiError("Object storage rejected the upload.", 502);
  return { id, objectPath, storageProvider: "supabase", category, mimeType, byteSize: buffer.length };
}

async function storedAssetRequest(asset) {
  if (clean(asset?.storageProvider).toLowerCase() === "cloudinary") {
    try {
      return await fetchCloudinaryImage(asset);
    } catch (error) {
      console.error(JSON.stringify({ event: "cloudinary_download_failed", assetId: asset?.id, error: clean(error.message) }));
      throw apiError("Private client image storage is unavailable.", 502);
    }
  }
  return storageRequest(asset.objectPath);
}

async function deleteStoredAsset(asset) {
  if (clean(asset?.storageProvider).toLowerCase() === "cloudinary") {
    try {
      const result = await deleteCloudinaryImage(asset.objectPath);
      return result === "ok" || result === "not found";
    } catch (error) {
      console.error(JSON.stringify({ event: "cloudinary_delete_failed", assetId: asset?.id, error: clean(error.message) }));
      return false;
    }
  }
  const deleted = await storageRequest(asset.objectPath, { method: "DELETE" });
  return deleted.ok || deleted.status === 404;
}

function apiError(message, status = 400, payload = undefined) {
  return Object.assign(new Error(message), { status, payload });
}

function requireText(value, label) {
  const text = clean(value);
  if (!text) {
    throw apiError(`${label} is required.`);
  }
  return text;
}

function boundedPublicText(value, label, maximum = 500) {
  const text = clean(value);
  if (text.length > maximum) {
    throw apiError(`${label} must be ${maximum} characters or fewer.`);
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
const supportedLeadProviders = new Set(integrationDefaults.map((integration) => integration.provider));
const webhookRateLimit = new Map();
const scheduleStartMinutes = 8 * 60;
const scheduleEndMinutes = 20 * 60;
const defaultOperatingHours = Object.freeze({
  monday: { open: "10:00", close: "19:00", closed: false },
  tuesday: { open: "10:00", close: "19:00", closed: false },
  wednesday: { open: "10:00", close: "19:00", closed: false },
  thursday: { open: "10:00", close: "19:00", closed: false },
  friday: { open: "10:00", close: "19:00", closed: false },
  saturday: { open: "10:00", close: "19:00", closed: false },
  sunday: { open: "13:00", close: "17:00", closed: false },
});
const operatingDayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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

function formatScheduleTime(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${period}`;
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
      organizationId: clean(request.get("x-mace-organization-id")) || "org-mace",
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

function auditData(request, {
  action,
  area,
  details,
  branchId = undefined,
  subjectType = "",
  subjectId = "",
  beforeValues = {},
  afterValues = {},
}) {
  const actor = actorFromRequest(request);
  return {
    time: new Date().toLocaleString("en-PH"),
    actor: actor.name,
    role: actor.role || "System",
    // Only session-backed actors are guaranteed to reference a persisted
    // Account. Test-only trusted headers and service actors remain snapshots.
    actorAccountId: request.authSession && actor.id ? actor.id : null,
    branchId: branchId === undefined ? (actor.access?.scope === "branch" ? actor.access.activeBranchId : null) : branchId,
    area,
    action,
    subjectType,
    subjectId,
    details,
    beforeValues: jsonText(beforeValues, {}),
    afterValues: jsonText(afterValues, {}),
  };
}

async function writeAudit(tx, request, details) {
  return tx.auditLog.create({
    data: auditData(request, details),
  });
}

const notificationTitles = {
  appointment: "New appointment",
  client: "New client",
  clinicPackage: "New package",
  discount: "New discount",
  expense: "New expense",
  giftCertificate: "New gift certificate",
  inventoryItem: "New inventory item",
  lead: "New lead",
  marketingCampaign: "New campaign",
  service: "New service",
  smsTemplate: "New SMS template",
  staffMember: "New staff member",
  treatment: "New treatment record",
};

async function createAppNotification(tx, {
  actor = "System",
  branches = ["All branches"],
  recipientAccountIds = [],
  message,
  module,
  recordId = "",
  title,
}) {
  return tx.appNotification.create({
    data: {
      actor: clean(actor) || "System",
      branches: normalizeNotificationBranches(branches),
      recipientAccountIds: uniqueStrings(recipientAccountIds),
      message: requireText(message, "Notification message"),
      module: requireText(module, "Notification module"),
      recordId: clean(recordId),
      title: requireText(title, "Notification title"),
    },
  });
}

async function notificationBranchesForResource(tx, config, record) {
  if (config.serviceBranches) return normalizeNotificationBranches(record.branches);
  if (config.branchField) return normalizeNotificationBranches([record[config.branchField]]);
  if (config.clientBranch && record.clientId) {
    const client = await tx.client.findUnique({ where: { id: record.clientId }, select: { branch: true } });
    return normalizeNotificationBranches([client?.branch]);
  }
  return ["All branches"];
}

async function writeResourceNotification(tx, request, config, record) {
  const actor = actorFromRequest(request);
  return createAppNotification(tx, {
    actor: actor.name,
    branches: await notificationBranchesForResource(tx, config, record),
    message: `${config.label(record)} was created by ${actor.name || "System"}.`,
    module: config.module,
    recordId: record.id,
    title: notificationTitles[config.delegate] || `New ${config.area.toLowerCase()} record`,
  });
}

async function loadNotificationFeed(account, limit = 30) {
  const actor = publicAccount(account);
  const where = notificationWhereForActor(actor, roleAccess[actor.role] || []);
  const readAt = account.notificationsReadAt || null;
  const take = Math.min(50, Math.max(1, Number(limit) || 30));
  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.appNotification.findMany({ where, orderBy: [{ createdAt: "desc" }], take }),
    prisma.appNotification.count({
      where: readAt ? { AND: [where, { createdAt: { gt: readAt } }] } : where,
    }),
  ]);
  return {
    notifications: notifications.map((notification) => ({
      ...notification,
      unread: notificationIsUnread(notification, readAt),
    })),
    readAt,
    unreadCount,
  };
}

function normalizeClientPayload(payload, existingId = "") {
  const firstName = clean(payload.firstName);
  const middleName = clean(payload.middleName);
  const lastName = clean(payload.lastName);
  const fullName = requireText(payload.fullName || [firstName, middleName, lastName].filter(Boolean).join(" "), "Client full name");
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
  data.branchesVisited = jsonList(payload.branchesVisited || payload.branch);
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
  const serviceType = clean(payload.serviceType) || "Regular Service";
  const priceModel = clean(payload.priceModel) || "Fixed price";
  const packageSessions = serviceType === "Package" ? numberValue(payload.packageSessions, "Package sessions", { min: 0, integer: true }) : 0;
  const price = numberValue(payload.price, "Price", { min: 0 });
  const packagePrice = numberValue(payload.packagePrice ?? (serviceType === "Package" ? price : 0), "Package price", { min: 0 });
  const requestedPriceUnit = clean(payload.priceUnit).toLowerCase() === "per ampule" ? "Per ampoule" : clean(payload.priceUnit);
  if (serviceType === "Package" && packageSessions < 1) {
    throw apiError("Packages must include at least one session.");
  }
  if (priceModel === "Per unit" && !requestedPriceUnit) {
    throw apiError("Choose whether the unit price is per syringe, ml, vial, or ampoule.");
  }
  const data = {
    name: requireText(payload.name, "Service name"),
    category: serviceType === "Package" ? "Packages" : requireText(payload.category, "Service category"),
    serviceType,
    duration: numberValue(payload.duration, "Duration", { min: 1, integer: true }),
    price,
    priceModel,
    priceUnit: priceModel === "Per unit" ? requestedPriceUnit : "",
    packageSessions,
    packagePrice: serviceType === "Package" ? packagePrice : 0,
    serviceValue: numberValue(serviceType === "Package" ? payload.serviceValue ?? (packageSessions ? packagePrice / packageSessions : price) : price, "Service value", { min: 0 }),
    recommendedIntervalDays: numberValue(payload.recommendedIntervalDays, "Recommended interval", { min: 0, integer: true }),
    commission: clean(payload.commission),
    consumables: jsonText(treatmentConsumableUsage(payload.consumables), []),
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

function treatmentConsumableUsage(value) {
  const parsed = Array.isArray(value) ? value : parseJsonList(value);
  const source = parsed.length ? parsed : clean(value).split(/[;,\n]+/).filter(Boolean);
  const usage = source.map((entry) => {
    if (typeof entry === "object" && entry) {
      return { item: clean(entry.item || entry.name), qty: numberValue(entry.qty || 1, "Consumable quantity", { min: 0 }) };
    }
    const match = clean(entry).match(/^(.+?)(?:\s*[:x]\s*(\d+(?:\.\d+)?))?$/i);
    return { item: clean(match?.[1]), qty: numberValue(match?.[2] || 1, "Consumable quantity", { min: 0 }) };
  }).filter((entry) => entry.item && entry.qty > 0);
  const merged = new Map();
  usage.forEach((entry) => {
    const key = entry.item.toLowerCase();
    const current = merged.get(key) || { item: entry.item, qty: 0 };
    current.qty += entry.qty;
    merged.set(key, current);
  });
  return [...merged.values()];
}

function treatmentConsumableText(value) {
  return treatmentConsumableUsage(value).map((entry) => `${entry.item}: ${entry.qty}`).join(", ");
}

function serializeTreatment(record) {
  return { ...serializeTreatmentWithPhotos(record), consumables: treatmentConsumableText(record.consumables) };
}

async function normalizeTreatmentPayload(payload, existingId = "") {
  const clientId = requireText(payload.clientId, "Client");
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (!client) throw apiError("Selected client was not found.", 404);
  const treatmentDate = requireText(payload.date, "Treatment date");
  const serviceName = requireText(payload.service, "Service");
  const service = clean(payload.serviceId)
    ? await prisma.service.findUnique({ where: { id: clean(payload.serviceId) } })
    : await prisma.service.findFirst({ where: { name: { equals: serviceName, mode: "insensitive" } } });
  const intervalDays = Number(service?.recommendedIntervalDays || 0);
  const intervalDate = new Date(`${treatmentDate}T00:00:00Z`);
  if (intervalDays > 0 && !Number.isNaN(intervalDate.getTime())) intervalDate.setUTCDate(intervalDate.getUTCDate() + intervalDays);
  const followUp = clean(payload.followUp) || (intervalDays > 0 && !Number.isNaN(intervalDate.getTime()) ? intervalDate.toISOString().slice(0, 10) : "");
  const data = {
    clientId,
    client: clean(client?.fullName) || requireText(payload.client, "Client"),
    date: treatmentDate,
    service: serviceName,
    branch: requireText(payload.branch || client.branch, "Branch"),
    provider: clean(payload.provider),
    room: clean(payload.room),
    preNotes: clean(payload.preNotes),
    postNotes: clean(payload.postNotes),
    aftercare: clean(payload.aftercare) || clean(service?.aftercare),
    arrivalTime: clean(payload.arrivalTime),
    treatmentStartTime: clean(payload.treatmentStartTime),
    completedTime: clean(payload.completedTime),
    checkoutTime: clean(payload.checkoutTime),
    consumables: jsonText(treatmentConsumableUsage(payload.consumables), []),
    deviceSettings: clean(payload.deviceSettings),
    batch: clean(payload.batch),
    consent: clean(payload.consent) || "Pending",
    followUp,
    outcome: clean(payload.outcome),
    satisfaction: clean(payload.satisfaction),
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
  const branches = parseJsonList(payload.branches || payload.branch);
  const primaryBranch = clean(payload.branch) || branches[0];
  const data = {
    name: requireText(payload.name, "Employee name"),
    photo: assetReference(payload.photo, "Employee photo"),
    role: requireText(payload.role, "Employee role"),
    branch: requireText(primaryBranch, "Primary branch"),
    branches: jsonList(branches.length ? branches : [primaryBranch]),
    schedule: clean(payload.schedule),
    scheduleBranches: jsonList(payload.scheduleBranches),
    commissionType: clean(payload.commissionType),
    commissionRate: numberValue(payload.commissionRate, "Commission rate", { min: 0 }),
    services: clean(payload.services),
    status: clean(payload.status) || "Available",
    attendance: clean(payload.attendance) || "Clocked out",
    employmentDate: clean(payload.employmentDate),
    employmentStatus: clean(payload.employmentStatus) || "Regular",
    birthDate: clean(payload.birthDate),
    address: clean(payload.address),
    emergencyContact: clean(payload.emergencyContact),
    emergencyPhone: clean(payload.emergencyPhone),
    phone: clean(payload.phone),
  };

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function assertStaffAccessMutation(request, data, existing = null) {
  const actor = actorFromRequest(request);
  if (canManageOrganization(actor.role)) return;
  if (!isBranchManager(actor.role) || !actorPermissions(actor).includes("staff.manage")) {
    throw apiError("You do not have permission to assign employee roles or branch access.", 403);
  }
  if (!canAccessBranch(actor, data.branch) || (existing?.branch && !canAccessBranch(actor, existing.branch))) {
    throw apiError("This employee belongs to another branch.", 403);
  }
  if (parseJsonList(data.branches).some((branch) => !canAccessBranch(actor, branch))) {
    throw apiError("You cannot assign this employee to a branch outside your access.", 403);
  }
  assertAssignableInvitationRole(actor, data.role, roleAccess);
}

async function validateLinkedStaffIdentity(data, existingId = "") {
  if (!existingId) return;
  const linkedAccount = await prisma.account.findFirst({ where: { staffId: existingId } });
  const sameIdentity = linkedAccount
    && clean(linkedAccount.name).toLocaleLowerCase("en") === clean(data.name).toLocaleLowerCase("en")
    && clean(linkedAccount.role).toLocaleLowerCase("en") === clean(data.role).toLocaleLowerCase("en");
  if (linkedAccount && !sameIdentity) {
    throw apiError("Disconnect this staff profile's login before changing its name or role.", 409);
  }
}

async function normalizePackagePayload(payload, existingId = "") {
  const clientId = cleanOptional(payload.clientId);
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  const sessions = numberValue(payload.sessions, "Sessions", { min: 0, integer: true });
  const used = numberValue(payload.used, "Used sessions", { min: 0, integer: true });
  if (used > sessions) {
    throw apiError("Used sessions cannot exceed total sessions.");
  }

  const requestedStatus = clean(payload.status);
  const packageStatus = requestedStatus === "Expired"
    ? (used >= sessions && sessions > 0 ? "Completed" : "Active")
    : requestedStatus || (used >= sessions && sessions > 0 ? "Completed" : "Active");
  const data = {
    name: requireText(payload.name, "Package name"),
    clientId,
    client: clean(client?.fullName) || requireText(payload.client, "Client"),
    sessions,
    used,
    expires: "",
    branch: clean(payload.branch) || "All branches",
    transferable: Boolean(payload.transferable),
    status: packageStatus,
    price: numberValue(payload.price, "Package price", { min: 0 }),
    amountPaid: numberValue(payload.amountPaid, "Amount paid", { min: 0 }),
    nextPayment: clean(payload.nextPayment),
    purchaseDate: clean(payload.purchaseDate) || new Date().toISOString().slice(0, 10),
    serviceValue: numberValue(payload.serviceValue ?? (sessions ? Number(payload.price || 0) / sessions : 0), "Service value per session", { min: 0 }),
    paymentHistory: jsonText(payload.paymentHistory || [], []),
    sessionHistory: jsonText(payload.sessionHistory || [], []),
  };
  if (data.amountPaid > data.price) throw apiError("Amount paid cannot exceed the package amount.");
  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeGiftCertificatePayload(payload, existingId = "") {
  const requestedType = clean(payload.type) || "Monetary Value";
  const type = ["Service", "Specific Service"].includes(requestedType) ? "Specific Service" : "Monetary Value";
  const data = {
    code: requireText(payload.code, "Gift certificate code"),
    client: requireText(payload.client, "Client"),
    type,
    serviceId: clean(payload.serviceId),
    service: clean(payload.service),
    issueDate: clean(payload.issueDate) || new Date().toISOString().slice(0, 10),
    branch: clean(payload.branch) || "All branches",
    balance: numberValue(payload.balance, "Gift certificate balance", { min: 0 }),
    expires: clean(payload.expires),
    status: clean(payload.status) || "Active",
    redeemedDate: clean(payload.redeemedDate),
    redeemedBranch: clean(payload.redeemedBranch),
    transactionId: clean(payload.transactionId),
  };

  if (data.type === "Specific Service" && !data.serviceId && !data.service) {
    throw apiError("Choose the service included in this gift certificate.");
  }

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
  const scheduledAtValue = clean(payload.scheduledAt);
  const scheduledAt = scheduledAtValue ? new Date(scheduledAtValue) : null;
  if (scheduledAtValue && Number.isNaN(scheduledAt.getTime())) throw apiError("Campaign schedule is invalid.");
  const data = {
    name: requireText(payload.name, "Campaign name"),
    branch: requireText(payload.branch, "Campaign branch"),
    segment: requireText(payload.segment, "Campaign segment"),
    channel: requireText(payload.channel, "Campaign channel"),
    templateId: clean(payload.templateId),
    subject: clean(payload.subject),
    message: clean(payload.message),
    sent: numberValue(payload.sent, "Sent count", { min: 0, integer: true }),
    booked: numberValue(payload.booked, "Booked count", { min: 0, integer: true }),
    credits: numberValue(payload.credits, "Credits", { min: 0, integer: true }),
    status: clean(payload.status) || "Draft",
    scheduledAt,
    managerApproval: parseBoolean(payload.managerApproval, true),
  };

  if (Object.hasOwn(payload, "html")) data.html = sanitizeMarketingHtml(payload.html);
  if (Object.hasOwn(payload, "design")) data.design = normalizeMarketingDesign(payload.design);

  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function normalizeMarketingTemplatePayload(payload, actor, existingId = "") {
  const name = requireText(payload.name, "Template name");
  const branch = clean(payload.branch) || clean(actor.branch) || "All branches";
  const editorMode = clean(payload.editorMode).toLowerCase() === "html" ? "html" : "visual";
  const design = normalizeMarketingDesign(payload.design);
  if (!design) throw apiError("Template design is required.");
  const data = {
    name,
    description: clean(payload.description).slice(0, 500),
    thumbnail: assetReference(payload.thumbnail, "Template thumbnail"),
    editorMode,
    html: sanitizeMarketingHtml(payload.html),
    design,
    branch,
    createdById: existingId ? undefined : actor.id,
  };
  if (existingId) delete data.createdById;
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

function normalizePromotionPayload(payload, existingId = "") {
  const startDate = requireText(payload.startDate, "Promotion start date");
  const endDate = requireText(payload.endDate, "Promotion end date");
  if (endDate < startDate) throw apiError("Promotion end date must be on or after its start date.");
  const data = {
    name: requireText(payload.name, "Promotion name"),
    serviceIds: jsonList(payload.serviceIds),
    packageNames: jsonList(payload.packageNames),
    discountType: clean(payload.discountType) || "Percentage",
    value: numberValue(payload.value, "Promotion value", { min: 0 }),
    startDate,
    endDate,
    branches: jsonList(payload.branches),
    active: payload.active !== false,
  };
  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

function serializePromotion(promotion) {
  return { ...promotion, serviceIds: parseJsonList(promotion.serviceIds), packageNames: parseJsonList(promotion.packageNames), branches: parseJsonList(promotion.branches) };
}

function normalizeConsentTemplatePayload(payload, existingId = "") {
  const data = {
    name: requireText(payload.name, "Consent form name"),
    version: requireText(payload.version, "Form version"),
    serviceIds: jsonList(payload.serviceIds),
    content: requireText(payload.content, "Consent form content"),
    requiredFields: jsonList(payload.requiredFields),
    active: payload.active !== false,
  };
  if (payload.id && !existingId) data.id = String(payload.id);
  return data;
}

async function normalizeConsentSubmissionPayload(payload, existingId = "") {
  if (existingId) throw apiError("Signed consent submissions are permanent and cannot be edited.", 409);
  if (payload.accepted !== true) throw apiError("The client must accept the consent form before signing.");
  const client = await prisma.client.findUnique({ where: { id: requireText(payload.clientId, "Client") } });
  const template = await prisma.consentFormTemplate.findUnique({ where: { id: requireText(payload.templateId, "Consent form") } });
  if (!client || !template?.active) throw apiError("The client or consent form is unavailable.", 409);
  const signedAt = new Date();
  return {
    clientId: client.id,
    templateId: template.id,
    formName: template.name,
    formVersion: template.version,
    service: clean(payload.service),
    treatmentId: clean(payload.treatmentId),
    branch: requireText(payload.branch, "Branch"),
    signature: requireText(payload.signature, "Electronic signature"),
    witness: clean(payload.witness),
    answers: jsonText({
      ...parseJsonObject(payload.answers, {}),
      formContent: template.content,
      acceptedAt: signedAt.toISOString(),
    }, {}),
    status: "Signed",
    signedAt,
  };
}

function serializeConsentTemplate(template) {
  return { ...template, serviceIds: parseJsonList(template.serviceIds), requiredFields: parseJsonList(template.requiredFields) };
}

function serializeConsentSubmission(submission) {
  return { ...submission, answers: parseJsonObject(submission.answers, {}) };
}

function operatingHoursForDate(branch, date) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(clean(date)) ? new Date(`${date}T00:00:00.000Z`) : null;
  const dayKey = parsed && !Number.isNaN(parsed.getTime()) ? operatingDayKeys[parsed.getUTCDay()] : "monday";
  const configured = parseJsonObject(branch?.operatingHours, {});
  const day = configured[dayKey] || defaultOperatingHours[dayKey];
  if (day?.closed) return { dayKey, closed: true, open: 0, close: 0 };
  return {
    dayKey,
    closed: false,
    open: parseTimeToMinutes(day?.open || defaultOperatingHours[dayKey].open),
    close: parseTimeToMinutes(day?.close || defaultOperatingHours[dayKey].close),
  };
}

function serializeClient(client) {
  return {
    ...client,
    branchesVisited: parseJsonList(client.branchesVisited),
  };
}

function serializeStaff(staffMember) {
  return {
    ...staffMember,
    branches: parseJsonList(staffMember.branches),
    scheduleBranches: parseJsonList(staffMember.scheduleBranches),
  };
}

function serializePackage(pkg) {
  return {
    ...pkg,
    paymentHistory: parseJsonList(pkg.paymentHistory),
    sessionHistory: parseJsonList(pkg.sessionHistory),
    remaining: Math.max(0, Number(pkg.sessions || 0) - Number(pkg.used || 0)),
    outstandingBalance: Math.max(0, Number(pkg.price || 0) - Number(pkg.amountPaid || 0)),
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
  const roomRecords = activeRoomRecords(branch.rooms ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    branchId: room.branchId,
    status: room.status,
  }));
  return {
    ...branch,
    devices: parseJsonList(branch.devices),
    operatingHours: parseJsonObject(branch.operatingHours, {}),
    rooms: roomRecords.map((room) => room.name),
    roomRecords,
    modules: Array.isArray(branch.modules)
      ? branch.modules.map((item) => ({ moduleId: item.moduleId, enabled: item.enabled }))
      : [],
    enabledModules: Array.isArray(branch.modules)
      ? branch.modules.filter((item) => item.enabled).map((item) => item.moduleId)
      : [],
    managers: Array.isArray(branch.memberships)
      ? branch.memberships
        .filter((membership) => ["Branch Manager", "Admin"].includes(membership.role) && membership.status === "Active")
        .map((membership) => ({
          membershipId: membership.id,
          role: membership.role,
          permissions: parsePermissionList(membership.permissions),
          ...(membership.account || {}),
        }))
      : [],
    employeeCount: Number(branch.employeeCount ?? branch._count?.memberships ?? branch.staff ?? 0),
    couches: Number(branch.couches || 0),
  };
}

function serializePosCart(cart) {
  return {
    ...cart,
    items: parseJsonList(cart.items),
  };
}

async function syncStaffBranchAssignment(tx, request, staff, _data, previous = null) {
  const assignedNames = [...new Set([staff.branch, ...parseJsonList(staff.branches)].filter(Boolean))];
  const assignedBranches = await tx.branch.findMany({
    where: { organizationId: actorFromRequest(request).organizationId, name: { in: assignedNames }, status: "Active" },
    select: { id: true, name: true },
  });
  if (assignedBranches.length !== assignedNames.length) throw apiError("Choose only active branches in this organization.", 400);
  const primaryBranch = assignedBranches.find((branch) => branch.name === staff.branch);
  if (!primaryBranch) throw apiError("Choose an active primary branch in this organization.", 400);
  const linkedAccount = await tx.account.findFirst({ where: { staffId: staff.id } });
  if (linkedAccount && !["Branch Manager", "Admin"].includes(staff.role)) {
    await tx.branchMembership.updateMany({
      where: { accountId: linkedAccount.id, branchId: { notIn: assignedBranches.map((branch) => branch.id) } },
      data: { isPrimary: false, status: "Inactive" },
    });
    for (const branch of assignedBranches) {
      await tx.branchMembership.upsert({
        where: { branchId_accountId: { branchId: branch.id, accountId: linkedAccount.id } },
        create: { branchId: branch.id, accountId: linkedAccount.id, role: staff.role, isPrimary: branch.id === primaryBranch.id },
        update: { role: staff.role, status: "Active", isPrimary: branch.id === primaryBranch.id },
      });
    }
    await tx.account.update({
      where: { id: linkedAccount.id },
      data: { branch: primaryBranch.name, lastBranchId: primaryBranch.id, role: staff.role },
    });
  }
  const previousBranches = previous ? [...new Set([previous.branch, ...parseJsonList(previous.branches)].filter(Boolean))] : [];
  const changed = !previous || previous.branch !== staff.branch || previous.role !== staff.role || previousBranches.join("\u0000") !== assignedNames.join("\u0000");
  if (!changed) return;
  await writeAudit(tx, request, {
    area: "Branches",
    action: previous ? "Employee branch assignments updated" : "Employee branch assignments created",
    branchId: primaryBranch.id,
    subjectType: "StaffMember",
    subjectId: staff.id,
    details: `${staff.name} assigned to ${assignedNames.join(", ")} with ${staff.branch} as primary branch.`,
    beforeValues: previous ? { branch: previous.branch, branches: previousBranches, role: previous.role } : {},
    afterValues: { branch: staff.branch, branches: assignedNames, role: staff.role },
  });
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

const treatmentPhotoInclude = {
  photoLinks: {
    include: { asset: true },
    orderBy: [{ createdAt: "asc" }],
  },
};

const resourceConfigs = {
  clients: {
    delegate: "client",
    module: "clients",
    area: "Client Records",
    label: (record) => record.fullName,
    orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
    normalize: normalizeClientPayload,
    serialize: serializeClient,
    branchField: "branch",
    unifiedClientAccess: true,
    posSelect: { id: true, fullName: true, mobile: true, branch: true, branchesVisited: true },
  },
  appointments: {
    delegate: "appointment",
    module: "appointments",
    area: "Appointments",
    label: (record) => `${record.client} for ${record.service}`,
    orderBy: [{ date: "desc" }, { time: "asc" }],
    normalize: normalizeAppointmentPayload,
    beforeWrite: assertAppointmentSlotAvailable,
    afterWrite: afterAppointmentWrite,
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
    posSelect: {
      id: true, name: true, category: true, serviceType: true, duration: true, price: true,
      priceModel: true, priceUnit: true, packageSessions: true, packagePrice: true,
      serviceValue: true, recommendedIntervalDays: true, aftercare: true, staff: true,
      branches: true, active: true, pos: true,
    },
  },
  inventory: {
    delegate: "inventoryItem",
    module: "inventory",
    area: "Inventory",
    label: (record) => record.item,
    orderBy: [{ item: "asc" }],
    normalize: normalizeInventoryPayload,
    branchField: "branch",
    posSelect: {
      id: true, item: true, sku: true, brand: true, category: true, type: true,
      stock: true, branch: true, price: true, image: true,
    },
  },
  treatments: {
    delegate: "treatment",
    module: "treatments",
    area: "Treatment Records",
    label: (record) => `${record.client} - ${record.service}`,
    orderBy: [{ date: "desc" }],
    normalize: normalizeTreatmentPayload,
    include: treatmentPhotoInclude,
    serialize: serializeTreatment,
    reloadAfterWrite: true,
    afterWrite: afterTreatmentWrite,
    branchField: "branch",
    relatedClient: true,
  },
  packages: {
    delegate: "clinicPackage",
    module: "packages",
    area: "Packages",
    label: (record) => `${record.name} for ${record.client}`,
    orderBy: [{ updatedAt: "desc" }],
    normalize: normalizePackagePayload,
    serialize: serializePackage,
    afterWrite: afterPackageWrite,
    reloadAfterWrite: true,
    branchField: "branch",
    relatedClient: true,
    allowLegacyOrganizationScope: true,
    posSelect: {
      id: true, name: true, clientId: true, client: true, sessions: true, used: true,
      expires: true, branch: true, transferable: true, status: true, price: true,
      amountPaid: true, nextPayment: true, purchaseDate: true, serviceValue: true,
      paymentHistory: true, sessionHistory: true,
    },
  },
  giftCertificates: {
    delegate: "giftCertificate",
    module: "packages",
    area: "Packages",
    label: (record) => record.code,
    orderBy: [{ expires: "asc" }],
    normalize: normalizeGiftCertificatePayload,
    branchField: "branch",
    allowLegacyOrganizationScope: true,
    posSelect: {
      id: true, code: true, client: true, branch: true, balance: true,
      expires: true, status: true, type: true, serviceId: true, service: true,
      issueDate: true, redeemedDate: true, redeemedBranch: true, transactionId: true,
    },
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
    serialize: serializeStaff,
    beforeWrite: validateLinkedStaffIdentity,
    afterWrite: syncStaffBranchAssignment,
    branchField: "branch",
    posSelect: { id: true, name: true, role: true, branch: true, branches: true, status: true },
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
    posSelect: {
      id: true, name: true, type: true, value: true, permission: true,
      applicable: true, expiry: true, active: true, usage: true,
    },
  },
  promotions: {
    delegate: "promotion",
    module: "settings",
    area: "Promotions",
    label: (record) => record.name,
    orderBy: [{ startDate: "desc" }],
    normalize: normalizePromotionPayload,
    serialize: serializePromotion,
    posSelect: { id: true, name: true, serviceIds: true, packageNames: true, discountType: true, value: true, startDate: true, endDate: true, branches: true, active: true },
  },
  consentTemplates: {
    delegate: "consentFormTemplate",
    module: "settings",
    area: "Consent Forms",
    label: (record) => `${record.name} ${record.version}`,
    orderBy: [{ name: "asc" }, { version: "desc" }],
    normalize: normalizeConsentTemplatePayload,
    serialize: serializeConsentTemplate,
    clientSelect: { id: true, name: true, version: true, serviceIds: true, content: true, requiredFields: true, active: true },
  },
  consentSubmissions: {
    delegate: "clientConsentSubmission",
    module: "clients",
    area: "Client Consent",
    label: (record) => `${record.formName} for ${record.clientId}`,
    orderBy: [{ signedAt: "desc" }],
    normalize: normalizeConsentSubmissionPayload,
    serialize: serializeConsentSubmission,
    branchField: "branch",
    relatedClient: true,
    immutable: true,
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
    branchField: "branch",
    allowLegacyOrganizationScope: true,
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
    stableBranchField: "branchId",
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
  const directModuleAllowed = !actor || moduleAllowed(actor, config.module, roleAccess);
  const posSupportAllowed = Boolean(actor && config.posSelect && moduleAllowed(actor, "pos", roleAccess));
  const clientSupportAllowed = Boolean(actor && config.clientSelect && moduleAllowed(actor, "clients", roleAccess));
  if (!directModuleAllowed && !posSupportAllowed && !clientSupportAllowed) return [];
  let where = {};
  if (actor) {
    if (config.unifiedClientAccess) {
      if (!hasOrganizationWideAccess(actor) && !hasValidBranchAssignment(actor)) {
        where = { id: "__none__" };
      } else {
        const organizationBranches = await prisma.branch.findMany({ where: { organizationId: actor.organizationId }, select: { name: true } });
        where = { branch: { in: organizationBranches.map((branch) => branch.name) } };
      }
    } else if (config.branchField) where = branchWhere(actor, config.branchField);
    if (config.branchField && config.allowLegacyOrganizationScope && actor.access?.scope === "branch") {
      where = { OR: [where, { [config.branchField]: "All branches" }] };
    }
    if (config.stableBranchField) {
      where = actor.access?.scope === "all"
        ? { OR: [
          { [config.stableBranchField]: { in: actor.access?.branches?.map((branch) => branch.id) || [] } },
          { [config.stableBranchField]: null, actorAccount: { is: { organizationId: actor.organizationId } } },
        ] }
        : { [config.stableBranchField]: actor.access?.activeBranchId || "__none__" };
    }
    if (config.clientBranch) {
      where = { clientRecord: { is: branchWhere(actor) } };
    }
  }
  const query = { where, orderBy: config.orderBy };
  if (!directModuleAllowed && posSupportAllowed) query.select = config.posSelect;
  else if (!directModuleAllowed && clientSupportAllowed) query.select = config.clientSelect;
  else if (config.include) query.include = config.include;
  const rows = await prisma[config.delegate].findMany(query);

  const scopedRows = actor && config.serviceBranches ? filterServiceBranches(rows, actor) : rows;
  return config.serialize ? scopedRows.map(config.serialize) : scopedRows;
}

async function resourceRecordForResponse(config, record) {
  if (!config.reloadAfterWrite) return record;
  const reloaded = await prisma[config.delegate].findUnique({
    where: { id: record.id },
    include: config.include,
  });
  return reloaded || record;
}

async function resourceBranch(config, record) {
  if (!record) return "";
  if (config.unifiedClientAccess) return "";
  if (config.branchField) return clean(record[config.branchField]);
  if (config.clientBranch && record.clientId) {
    const client = await prisma.client.findUnique({ where: { id: record.clientId }, select: { branch: true } });
    return clean(client?.branch);
  }
  return "";
}

function assertServiceBranchChangeAllowed(actor, config, data) {
  if (!config.serviceBranches || hasOrganizationWideAccess(actor)) return;
  const branches = parseJsonList(data.branches);
  if (branches.some((branch) => branch !== actor.branch)) {
    throw apiError("You can only manage services assigned exclusively to your branch.", 403);
  }
}

async function assertResourceMutationAllowed(request, config, record) {
  if (config.unifiedClientAccess) {
    const actor = assertMutationAllowed(request, config.module);
    const branchName = clean(record?.branch);
    const branch = branchName ? await prisma.branch.findFirst({ where: { name: branchName, organizationId: actor.organizationId } }) : null;
    if (!branch) throw apiError("The client's registration branch is not available in this organization.", 403);
    return actor;
  }
  const branch = await resourceBranch(config, record);
  const actor = assertMutationAllowed(request, config.module, branch);
  if (config.relatedClient && record.clientId) {
    const client = await prisma.client.findUnique({ where: { id: record.clientId }, select: { id: true } });
    if (!client) throw apiError("Related client was not found.", 404);
  }
  assertServiceBranchChangeAllowed(actor, config, record);
  return actor;
}

function branchScopedPayload(request, payload, config) {
  if (!config?.branchField) return payload ?? {};
  const actor = actorFromRequest(request);
  const access = actor.access;
  if (!access) return payload ?? {};
  if (config.unifiedClientAccess && request.params?.id) return payload ?? {};
  const suppliedBranch = clean(payload?.[config.branchField]);
  if (
    request.params?.id
    && config.allowLegacyOrganizationScope
    && isAllBranches(suppliedBranch)
    && hasOrganizationWideAccess(actor)
  ) {
    return payload ?? {};
  }
  if (access.scope === "branch") {
    const activeBranch = clean(access.activeBranch?.name);
    if (suppliedBranch && suppliedBranch !== activeBranch) {
      throw apiError(`Switch to ${suppliedBranch} before creating or editing records there.`, 409);
    }
    return { ...(payload ?? {}), [config.branchField]: activeBranch };
  }
  if (!suppliedBranch || isAllBranches(suppliedBranch)) {
    throw apiError("Choose a specific active branch while using All Branches.", 400);
  }
  const allowed = access.branches?.some((branch) => branch.name === suppliedBranch && branch.branchStatus === "Active");
  if (!allowed) throw apiError("Choose an active branch in your organization.", 403);
  return payload ?? {};
}

async function getPersistedSettings() {
  const row = await prisma.systemSetting.findUnique({ where: { key: "app" } });
  return row ? { ...initialSettings, ...parseJsonObject(row.value, initialSettings) } : initialSettings;
}

function normalizePaymentMethods(value) {
  const source = Array.isArray(value) && value.length ? value : initialSettings.paymentMethods;
  const methods = source.map((method, index) => ({
    id: clean(typeof method === "string" ? "" : method?.id) || `payment-${index + 1}`,
    name: clean(typeof method === "string" ? method : method?.name),
    active: typeof method === "string" ? true : method?.active !== false,
    order: index,
  })).filter((method) => method.name);
  const uniqueNames = new Set(methods.map((method) => method.name.toLowerCase()));
  if (!methods.length || !methods.some((method) => method.active)) {
    throw apiError("At least one payment method must be enabled.", 400);
  }
  if (uniqueNames.size !== methods.length) {
    throw apiError("Payment method names must be unique.", 400);
  }
  return methods;
}

async function savePersistedSettings(values) {
  const next = {
    ...initialSettings,
    ...parseJsonObject(values, {}),
    taxRate: numberValue(values.taxRate, "Tax rate", { min: 0 }),
    smsCredits: numberValue(values.smsCredits, "SMS credits", { min: 0, integer: true }),
    hiddenSaasPlans: Boolean(values.hiddenSaasPlans),
    paymentMethods: normalizePaymentMethods(values.paymentMethods),
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
  if (provider === "website") {
    const externalWebhookReady = Boolean(clean(process.env.LEADS_WEBHOOK_SECRET) || clean(process.env.LEADS_API_KEY));
    return {
      status: "Connected",
      summary: externalWebhookReady
        ? "The built-in inquiry form and authenticated website webhook are ready."
        : "The built-in inquiry form is ready. Add a webhook secret or API key for external website forms.",
    };
  }
  if (provider === "third-party") {
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
  if (!supportedLeadProviders.has(provider)) throw apiError("Unsupported lead webhook provider.", 404);
  const key = `${provider}:${request.ip || request.socket?.remoteAddress || "unknown"}`;
  const now = Date.now();
  if (webhookRateLimit.size > 1_000) {
    for (const [bucketKey, value] of webhookRateLimit) {
      if (value.resetAt < now) webhookRateLimit.delete(bucketKey);
    }
  }
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

async function detectLeadDuplicate(tx, normalized, branch) {
  if (clean(normalized.externalLeadId)) {
    const identity = await tx.externalLeadIdentity.findUnique({
      where: { provider_externalLeadId: { provider: clean(normalized.sourcePlatform), externalLeadId: clean(normalized.externalLeadId) } },
      include: { lead: true },
    });
    if (identity?.lead?.branch === branch) {
      return { type: "external", confidence: 100, lead: identity.lead, reasons: ["Same external platform lead ID"] };
    }
  }

  const candidates = await tx.lead.findMany({
    where: {
      branch,
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
      branch,
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

async function routeIncomingLead(tx, normalized, { defaultBranch = "", allowPayloadBranch = false } = {}) {
  let branch = clean(defaultBranch) || (allowPayloadBranch ? clean(normalized.branch) : "");
  if (!branch) {
    const firstBranch = await tx.branch.findFirst({ where: { status: "Active", modules: { some: { moduleId: "leads", enabled: true } } }, orderBy: { name: "asc" } });
    branch = firstBranch?.name || "All branches";
  } else {
    const configuredBranch = await tx.branch.findFirst({ where: { name: branch, status: "Active", modules: { some: { moduleId: "leads", enabled: true } } }, select: { id: true } });
    if (!configuredBranch) throw apiError("The lead integration is assigned to an unavailable branch.", 409);
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

async function processLeadWebhook(provider, request, options = {}) {
  rateLimitWebhook(request, provider);
  const authMethod = clean(options.authMethod) || verifyLeadWebhookAuth(request, provider);
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
      const routing = await routeIncomingLead(tx, normalized, {
        defaultBranch: integration.defaultBranch,
        allowPayloadBranch: options.allowPayloadBranch === true,
      });
      const duplicate = await detectLeadDuplicate(tx, normalized, routing.branch);
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
      await createAppNotification(tx, {
        actor: "Lead Ingestion",
        branches: [lead.branch],
        message: `${lead.name} submitted an inquiry via ${integration.label || provider}.`,
        module: "leads",
        recordId: lead.id,
        title: "New lead",
      });
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

async function appointmentDurationFor(data, database = prisma) {
  if (Number(data.duration) >= 15) return Number(data.duration);
  let service = null;
  if (data.serviceId) {
    service = await database.service.findUnique({ where: { id: data.serviceId } });
  }
  if (!service && data.service) {
    service = await database.service.findFirst({ where: { name: data.service } });
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

async function recordClientBranchVisit(tx, clientId, branch) {
  if (!clientId || !branch || isAllBranches(branch)) return;
  const client = await tx.client.findUnique({ where: { id: clientId }, select: { branchesVisited: true } });
  if (!client) return;
  const branchesVisited = [...new Set([...parseJsonList(client.branchesVisited), branch])];
  await tx.client.update({ where: { id: clientId }, data: { branchesVisited: JSON.stringify(branchesVisited) } });
}

async function afterAppointmentWrite(tx, request, record, data, previous) {
  await recordClientBranchVisit(tx, record.clientId, record.branch);
  await expandAppointmentRecurrence(tx, request, record, data, previous);
}

async function adjustTreatmentConsumables(tx, request, record, usages, direction, branch) {
  const movements = [];
  for (const usage of usages) {
    const item = await tx.inventoryItem.findFirst({ where: { item: { equals: usage.item, mode: "insensitive" }, branch } })
      || await tx.inventoryItem.findFirst({ where: { item: { equals: usage.item, mode: "insensitive" }, branch: "All branches" } });
    if (!item) throw apiError(`Consumable ${usage.item} was not found in ${branch} inventory.`, 409);
    const qty = Number(usage.qty || 0) * direction;
    if (qty > 0) {
      const reserved = await tx.inventoryItem.updateMany({ where: { id: item.id, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
      if (reserved.count !== 1) throw apiError(`Inventory is insufficient for ${item.item}.`, 409);
    } else if (qty < 0) {
      await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: -qty } } });
    }
    if (qty !== 0) {
      movements.push(await tx.inventoryMovement.create({
        data: {
          date: record.date,
          itemId: item.id,
          item: item.item,
          branch: item.branch || branch,
          qty: -qty,
          unit: item.unit,
          reason: qty > 0 ? `Used in treatment ${record.id}` : `Treatment usage correction ${record.id}`,
          user: actorFromRequest(request).name,
          notes: `${record.client} · ${record.service}`,
        },
      }));
    }
  }
  return movements;
}

async function afterTreatmentWrite(tx, request, record, _data, previous) {
  await recordClientBranchVisit(tx, record.clientId, record.branch);
  if (record.clientId) {
    const client = await tx.client.findUnique({ where: { id: record.clientId }, select: { lastVisit: true } });
    if (client) {
      const isLatestTreatment = !client.lastVisit || record.date >= client.lastVisit;
      await tx.client.update({
        where: { id: record.clientId },
        data: {
          lastVisit: !client.lastVisit || record.date > client.lastVisit ? record.date : client.lastVisit,
          ...(isLatestTreatment ? { nextVisit: clean(record.followUp) } : {}),
        },
      });
    }
  }
  const currentUsage = treatmentConsumableUsage(record.consumables);
  const previousUsage = treatmentConsumableUsage(previous?.consumables);
  if (previous && previous.branch !== record.branch) {
    await adjustTreatmentConsumables(tx, request, record, previousUsage, -1, previous.branch);
    await adjustTreatmentConsumables(tx, request, record, currentUsage, 1, record.branch);
    return;
  }
  const deltas = new Map();
  previousUsage.forEach((entry) => deltas.set(entry.item.toLowerCase(), { item: entry.item, qty: -entry.qty }));
  currentUsage.forEach((entry) => {
    const key = entry.item.toLowerCase();
    const current = deltas.get(key) || { item: entry.item, qty: 0 };
    current.qty += entry.qty;
    deltas.set(key, current);
  });
  const changed = [...deltas.values()].filter((entry) => entry.qty !== 0);
  await adjustTreatmentConsumables(tx, request, record, changed.filter((entry) => entry.qty > 0), 1, record.branch);
  await adjustTreatmentConsumables(tx, request, record, changed.filter((entry) => entry.qty < 0).map((entry) => ({ ...entry, qty: Math.abs(entry.qty) })), -1, record.branch);
}

async function afterPackageWrite(tx, request, record, _data, previous) {
  const previousPaid = Number(previous?.amountPaid || 0);
  const difference = Number(record.amountPaid || 0) - previousPaid;
  if (difference === 0) return;
  const history = parseJsonList(record.paymentHistory);
  history.push({
    date: record.purchaseDate || new Date().toISOString().slice(0, 10),
    amount: difference,
    method: "Recorded payment",
    receivedBy: actorFromRequest(request).name,
    note: difference > 0 ? "Package payment received" : "Package payment correction",
  });
  await tx.clinicPackage.update({ where: { id: record.id }, data: { paymentHistory: jsonText(history, []) } });
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

async function assertAppointmentSlotAvailable(data, existingId = "", { database = prisma, unassignedCapacity = 0 } = {}) {
  await assertAppointmentStatusTransition(data, existingId);
  if (!isActiveAppointmentStatus(data.status)) return;

  const duration = await appointmentDurationFor(data, database);
  const start = parseTimeToMinutes(data.time);
  const end = start + duration;
  const branch = await database.branch.findFirst({ where: { name: data.branch, status: "Active" }, select: { operatingHours: true } });
  if (!branch) throw apiError("The selected branch is not active.", 409);
  const operatingHours = operatingHoursForDate(branch, data.date);
  if (operatingHours.closed) {
    throw apiError(`The selected branch is closed on ${operatingHours.dayKey}.`, 409);
  }
  if (start < operatingHours.open || end > operatingHours.close) {
    throw apiError(`Appointment must fit inside branch hours, ${formatScheduleTime(operatingHours.open)} to ${formatScheduleTime(operatingHours.close)}.`, 409);
  }

  if (data.staff && !["Any available", "To assign"].includes(data.staff)) {
    const staffMember = await database.staffMember.findFirst({ where: { name: data.staff } });
    const staffBranches = parseJsonList(staffMember?.branches);
    if (staffMember && staffMember.branch !== data.branch && !staffBranches.includes(data.branch)) {
      throw apiError(`${data.staff} is not assigned to ${data.branch}.`, 409);
    }
    const unavailable = ["inactive", "on leave", "off duty", "unavailable"].some((status) =>
      clean(staffMember?.status).toLowerCase().includes(status),
    );
    if (unavailable) {
      throw apiError(`${data.staff} is not available for booking.`, 409);
    }
  }

  const candidates = await database.appointment.findMany({
    where: {
      date: data.date,
      branch: data.branch,
      status: { in: databaseActiveAppointmentStatuses },
      ...(existingId ? { id: { not: existingId } } : {}),
    },
  });

  let overlappingAppointments = 0;
  for (const appointment of candidates) {
    const appointmentStart = parseTimeToMinutes(appointment.time);
    const appointmentEnd = appointmentStart + await appointmentDurationFor(appointment, database);
    if (!rangesOverlap(start, end, appointmentStart, appointmentEnd)) continue;
    overlappingAppointments += 1;

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
  if (unassignedCapacity > 0 && overlappingAppointments >= unassignedCapacity) {
    throw apiError("That time has reached the branch's online-booking capacity. Choose another time.", 409);
  }
}

function marketingChannel(campaign) {
  const channel = clean(campaign?.channel).toLowerCase();
  return channel.includes("mail") ? "email" : "sms";
}

function findMarketingDesignBlock(blocks, blockId) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (clean(block?.id) === blockId) return block;
    if (clean(block?.type) === "layout") {
      for (const column of Array.isArray(block.columns) ? block.columns : []) {
        const nested = findMarketingDesignBlock(column, blockId);
        if (nested) return nested;
      }
    }
  }
  return null;
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

function matchesMarketingSegment(client, campaign) {
  return marketingClientMatchesSegment(client, campaign.segment);
}

function selectMarketingRecipients({ clients, members = [], campaign, channel }) {
  const matchesCampaignBranch = (record) => isAllBranches(campaign.branch) || clean(record.branch) === clean(campaign.branch);
  const clientCandidates = clients.filter((client) => (
    matchesCampaignBranch(client)
    && client.marketingOptIn !== false
    && matchesMarketingSegment(client, campaign)
  ));
  const memberCandidates = channel === "email"
    ? members
      .filter((member) => matchesCampaignBranch(member) && marketingAudienceMemberMatchesSegment(member, campaign.segment))
      .map(marketingAudienceMemberAsClient)
    : [];
  const candidates = [...clientCandidates, ...memberCandidates];
  const recipients = [];
  const seenContacts = new Set();

  candidates.forEach((client) => {
    const contact = channel === "email" ? normalizeEmail(client.email) : normalizePhone(client.mobile);
    if (contact && !seenContacts.has(contact)) {
      seenContacts.add(contact);
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
      ? "Hi {{client}},\n\nWe would love to see you at ZenshoTech. Reply to this email or message us to book your next visit."
      : "Hi {{client}}, it has been a while. Book your personalized care session with ZenshoTech this week.",
  };
}

function marketingMergeValues({ client, campaign, settings }) {
  const fullName = clean(client.fullName);
  const surveyRecipient = clean(client.email || client.mobile || client.id);
  const rootSecret = clean(process.env.FACETRACK_ENCRYPTION_KEY) || (process.env.NODE_ENV !== "production" ? clean(process.env.DATABASE_URL) : "");
  const surveySecret = rootSecret ? createHmac("sha256", rootSecret).update("macesoft-marketing-survey-v1").digest("hex") : "";
  return {
    client: client.fullName,
    name: client.fullName,
    first_name: fullName.split(/\s+/)[0] || fullName,
    mobile: client.mobile,
    email: client.email,
    branch: client.branch,
    segment: campaign.segment,
    campaign: campaign.name,
    company: visibleApplicationBrand(settings.company),
    product: visibleApplicationBrand(settings.productName),
    date: new Date().toLocaleDateString("en-PH"),
    time: "",
    service: campaign.service || campaign.name,
    current_year: String(new Date().getFullYear()),
    unsubscribe_url: "#unsubscribe",
    preferences_url: "#preferences",
    survey_token: clean(campaign.id) && surveyRecipient && surveySecret
      ? createMarketingSurveyToken({ campaignId: campaign.id, recipient: surveyRecipient, secret: surveySecret })
      : "",
  };
}

function marketingSurveySigningSecret() {
  const rootSecret = clean(process.env.FACETRACK_ENCRYPTION_KEY) || (process.env.NODE_ENV !== "production" ? clean(process.env.DATABASE_URL) : "");
  if (!rootSecret) throw apiError("Marketing survey signing is not configured.", 503);
  return createHmac("sha256", rootSecret).update("macesoft-marketing-survey-v1").digest("hex");
}

function renderMarketingText(text, context) {
  const values = marketingMergeValues(context);
  return clean(text).replace(/{{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*([^{}]*))?\s*}}/g, (_match, key, fallback = "") => clean(values[key] ?? fallback));
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
  const host = clean(process.env.SMTP_HOST);
  const from = clean(process.env.SMTP_FROM);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  return Boolean(host && from && (Boolean(user) === Boolean(pass)));
}

function assertMarketingChannelSupported(campaign) {
  if (clean(campaign?.channel).includes("+")) throw apiError("Combined Email + SMS scheduling requires the coordinated delivery provider.", 503);
}

function assertMarketingProviderReady(campaign) {
  assertMarketingChannelSupported(campaign);
  if (envFlag(process.env.MARKETING_DRY_RUN)) return;
  const channel = marketingChannel(campaign);
  if (channel === "sms" && !smsReady()) throw apiError("SMS delivery is not configured. Connect Twilio before scheduling this campaign.", 503);
  if (channel === "email" && !emailReady()) throw apiError("Email delivery is not configured. Add the SMTP settings before scheduling this campaign.", 503);
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
    throw apiError("Password-reset email is not configured. Contact the system administrator.", 503);
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  return nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST),
    port: smtpPort,
    secure: process.env.SMTP_SECURE ? envFlag(process.env.SMTP_SECURE) : smtpPort === 465,
    auth: user || pass ? { user, pass } : undefined,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20_000),
  });
}

async function createVerifiedEmailTransport() {
  const transporter = createEmailTransport();
  try {
    await transporter.verify();
    return transporter;
  } catch (error) {
    transporter.close();
    console.error(JSON.stringify({ event: "smtp_verification_failed", error: clean(error.message) }));
    throw apiError("Password-reset email is temporarily unavailable. Contact the system administrator.", 503);
  }
}

async function sendSmtpEmail({ transporter, to, replyTo = "", subject, text, html = "" }) {
  const result = await transporter.sendMail({
    from: clean(process.env.SMTP_FROM),
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text,
    html: html || textToHtml(text),
  });

  if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
    throw new Error("The SMTP server did not accept the email recipient.");
  }

  return result.messageId;
}

async function listBranchesForBootstrap(actor) {
  const organizationManager = canManageOrganization(actor.role) || hasOrganizationPermission(actor, "branches.manage");
  const where = organizationManager
    ? { organizationId: actor.organizationId }
    : { id: { in: actor.access?.branches?.map((branch) => branch.id) || [] }, status: "Active" };
  const rows = await prisma.branch.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: organizationManager ? branchManagementInclude() : { rooms: true, modules: true },
  });
  const staffAssignments = await prisma.staffMember.findMany({ select: { branch: true, branches: true } });
  return rows.map((branch) => {
    const employeeCount = staffAssignments.filter((member) => {
      const assigned = parseJsonList(member.branches);
      return member.branch === branch.name || assigned.includes(branch.name) || member.branch === "All branches";
    }).length;
    return serializeBranch({ ...branch, employeeCount });
  });
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
    promotions,
    consentTemplates,
    consentSubmissions,
    smsTemplates,
    campaigns,
    auditLogs,
    inventoryMovements,
    branches,
    settings,
    leadIntegrations,
    webhookEvents,
    posCarts,
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
    listResource("promotions", actor),
    listResource("consentTemplates", actor),
    listResource("consentSubmissions", actor),
    listResource("smsTemplates", actor),
    listResource("campaigns", actor),
    listResource("auditLogs", actor),
    listResource("inventoryMovements", actor),
    listBranchesForBootstrap(actor),
    getPersistedSettings(),
    moduleAllowed(actor, "leads", roleAccess) ? listLeadIntegrations() : [],
    moduleAllowed(actor, "leads", roleAccess)
      ? prisma.webhookEvent.findMany({
        where: { lead: { is: branchWhere(actor) } },
        orderBy: [{ receivedAt: "desc" }],
        take: 50,
      })
      : [],
    moduleAllowed(actor, "pos", roleAccess)
      ? prisma.posCart.findMany({ where: branchWhere(actor), orderBy: [{ updatedAt: "desc" }], take: 100 })
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
    promotions,
    consentTemplates,
    consentSubmissions,
    smsTemplates,
    campaigns,
    auditLogs,
    inventoryMovements,
    branches,
    settings,
    leadIntegrations,
    webhookEvents,
    posCarts: posCarts.map(serializePosCart),
  };
}

async function buildSaleDraftItems(cart, branch) {
  if (!Array.isArray(cart) || !cart.length) {
    throw apiError("Cart must contain at least one item.");
  }

  const prepared = [];
  for (const item of cart) {
    const qty = numberValue(item.qty || 1, "Cart quantity", { min: 0.01 });
    if (item.type === "Service") {
      const service = await prisma.service.findUnique({ where: { id: requireText(item.serviceId, "Service") } });
      if (!service || !service.active || !service.pos) {
        throw apiError(`${item.name || "Selected service"} is unavailable for POS.`);
      }
      const offeredBranches = parseJsonList(service.branches);
      if (offeredBranches.length && !offeredBranches.includes(branch) && !offeredBranches.includes("All branches")) {
        throw apiError(`${service.name} is not offered at ${branch}.`, 409);
      }
      if (service.priceModel !== "Per unit" && !Number.isInteger(qty)) {
        throw apiError(`${service.name} quantity must be a whole number.`);
      }
      if (service.priceModel === "Per unit" && clean(service.priceUnit).toLowerCase() !== "per ml" && !Number.isInteger(qty)) {
        throw apiError(`${service.name} quantity must be a whole ${clean(service.priceUnit).replace(/^Per\s+/i, "").toLowerCase() || "unit"}.`);
      }
      if (service.serviceType === "Package" && (!Number.isInteger(qty) || qty < 1)) {
        throw apiError(`${service.name} package quantity must be a whole number.`);
      }
      const catalogPrice = numberValue(
        service.serviceType === "Package" && Number(service.packagePrice) > 0 ? service.packagePrice : service.price,
        "Service price",
        { min: 0 },
      );
      const variablePrice = ["Starts at", "Price after consultation/assessment"].includes(service.priceModel);
      const resolvedPrice = variablePrice
        ? numberValue(item.resolvedPrice ?? item.price, "Final service price", { min: 0 })
        : catalogPrice;
      if (service.priceModel === "Starts at" && resolvedPrice < catalogPrice) {
        throw apiError(`${service.name} final price cannot be lower than its starting price of ${catalogPrice}.`);
      }
      const provider = clean(item.provider) || "N/A";
      if (provider !== "N/A") {
        const staffMember = await prisma.staffMember.findFirst({ where: { name: provider, status: { not: "Inactive" } } });
        const assignedBranches = parseJsonList(staffMember?.branches);
        if (!staffMember || (staffMember.branch !== branch && !assignedBranches.includes(branch))) {
          throw apiError(`${provider} is not available at ${branch}.`, 409);
        }
        const allowedRoles = parseJsonList(service.staff);
        if (allowedRoles.length && !allowedRoles.includes("All staff") && !allowedRoles.includes(staffMember.role)) {
          throw apiError(`${provider} is not an allowed provider for ${service.name}.`, 409);
        }
      }
      prepared.push({
        source: service,
        sourceId: service.id,
        lineKey: clean(item.key) || `service-${service.id}-${prepared.length}`,
        name: service.name,
        type: "Service",
        qty,
        price: resolvedPrice,
        originalPrice: catalogPrice,
        priceModel: service.priceModel,
        priceUnit: service.priceUnit,
        provider,
        aftercare: service.aftercare,
        recommendedIntervalDays: Number(service.recommendedIntervalDays || 0),
        consumables: parseJsonList(service.consumables),
      });
    } else if (item.type === "Product") {
      if (!Number.isInteger(qty) || qty < 1) throw apiError("Product quantity must be a whole number.");
      const product = await prisma.inventoryItem.findFirst({
        where: inventoryWhereForBranch(requireText(item.inventoryId, "Inventory item"), branch),
      });
      if (!product || product.type !== "Retail") {
        throw apiError(`${item.name || "Selected product"} is unavailable for POS.`);
      }
      if (numberValue(product.stock, "Product stock") < qty) {
        throw apiError(`Inventory is insufficient for ${product.item}.`, 409);
      }
      prepared.push({
        source: product,
        sourceId: product.id,
        lineKey: clean(item.key) || `product-${product.id}-${prepared.length}`,
        name: product.item,
        type: "Product",
        qty,
        price: numberValue(product.price, "Product price", { min: 0 }),
        originalPrice: numberValue(product.price, "Product price", { min: 0 }),
        priceModel: "Fixed price",
        priceUnit: clean(product.unit),
        provider: "N/A",
        inventoryId: product.id,
      });
    } else {
      throw apiError("Unsupported POS item type.");
    }
  }

  return prepared;
}

function normalizeManualDiscount(value) {
  const rawType = clean(value?.type);
  const rawValue = value?.value;
  if (!rawType && (rawValue === undefined || rawValue === null || rawValue === "" || Number(rawValue) === 0)) return null;
  const normalizedType = rawType.toLowerCase();
  const type = normalizedType === "percentage"
    ? "Percentage"
    : ["fixed amount", "fixed", "amount"].includes(normalizedType)
      ? "Fixed amount"
      : "";
  if (!type) throw apiError("Manual discount type must be Percentage or Fixed amount.");
  const discountValue = numberValue(rawValue, "Manual discount", { min: 0 });
  if (type === "Percentage" && discountValue > 100) {
    throw apiError("Manual percentage discount cannot exceed 100%.");
  }
  const rawScope = clean(value?.scope || "Transaction").toLowerCase();
  const scope = ["transaction", "entire transaction", "cart"].includes(rawScope)
    ? "Transaction"
    : ["service", "specific service", "service line"].includes(rawScope)
      ? "Service"
      : "";
  if (!scope) throw apiError("Manual discount scope must be Transaction or Service.");
  const targetKey = scope === "Service" ? requireText(value?.targetKey, "Discounted service") : "";
  return { type, value: discountValue, scope, targetKey };
}

async function calculateCheckout(draft, { actor, branch }) {
  const items = await buildSaleDraftItems(draft.cart, branch);
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const saleDate = clean(draft.saleDate) || posCalendarDate();
  const promotions = await prisma.promotion.findMany({ where: { active: true, startDate: { lte: saleDate }, endDate: { gte: saleDate } } });
  const appliedPromotionNames = new Set();
  let promotionDiscount = 0;
  items.forEach((item) => {
    if (item.type !== "Service") return;
    const eligible = promotions.filter((promotion) => {
      const branches = parseJsonList(promotion.branches);
      const serviceIds = parseJsonList(promotion.serviceIds);
      const packageNames = parseJsonList(promotion.packageNames);
      const targetMatches = (!serviceIds.length && !packageNames.length)
        || serviceIds.includes(item.sourceId)
        || (item.source.serviceType === "Package" && packageNames.includes(item.name));
      return (!branches.length || branches.includes("All branches") || branches.includes(branch))
        && targetMatches;
    });
    const best = eligible.map((promotion) => ({
      promotion,
      amount: promotion.discountType === "Percentage"
        ? (item.price * item.qty * Number(promotion.value || 0)) / 100
        : Math.min(item.price * item.qty, Number(promotion.value || 0) * item.qty),
    })).sort((left, right) => right.amount - left.amount)[0];
    item.promotionDiscount = Math.round(best?.amount || 0);
    if (best?.promotion) appliedPromotionNames.add(best.promotion.name);
    promotionDiscount += item.promotionDiscount;
  });
  const clientId = clean(draft.clientId);
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  if (clientId && !client) throw apiError("The selected client was not found.", 404);
  const discountId = clean(draft.discount?.id || draft.discountId);
  const discount = discountId ? await prisma.discount.findUnique({ where: { id: discountId } }) : null;
  const manualDiscount = normalizeManualDiscount(draft.manualDiscount);
  if (discountId && manualDiscount) throw apiError("Choose either a saved discount rule or a manual discount, not both.");
  if ((discountId || manualDiscount) && !canManageOrganization(actor.role)) {
    throw apiError("An Owner or Super Admin must approve and post POS discounts or price adjustments.", 403);
  }
  if (discountId) assertDiscountUsable(discount, { role: actor.role, client, items });
  const savedDiscountAmount = discount
    ? discount.type === "Percentage"
      ? Math.round((subtotal * Number(discount.value || 0)) / 100)
      : Number(discount.value || 0)
    : 0;
  const manualDiscountTarget = manualDiscount?.scope === "Service"
    ? items.filter((item) => item.type === "Service" && item.lineKey === manualDiscount.targetKey)
    : [];
  if (manualDiscount?.scope === "Service" && manualDiscountTarget.length !== 1) {
    throw apiError("Choose one valid service line for the manual discount.");
  }
  const manualDiscountBase = manualDiscount?.scope === "Service"
    ? manualDiscountTarget[0].price * manualDiscountTarget[0].qty
    : subtotal;
  const resolvedManualDiscount = manualDiscount
    ? {
      ...manualDiscount,
      targetName: manualDiscount?.scope === "Service" ? manualDiscountTarget[0].name : "",
    }
    : null;
  const manualDiscountAmount = resolvedManualDiscount
    ? resolvedManualDiscount.type === "Percentage"
      ? Math.round((manualDiscountBase * resolvedManualDiscount.value) / 100)
      : resolvedManualDiscount.value
    : 0;
  if (manualDiscountAmount > manualDiscountBase) {
    throw apiError(resolvedManualDiscount?.scope === "Service"
      ? "Manual discount cannot exceed the selected service total."
      : "Manual discount cannot exceed the cart subtotal.");
  }
  const transactionDiscountAmount = resolvedManualDiscount ? manualDiscountAmount : savedDiscountAmount;
  const requestedDepositCredit = numberValue(draft.depositCredit, "Deposit credit", { min: 0 });
  const appointmentId = clean(draft.appointmentId);
  let depositCredit = 0;
  let creditedAppointmentId = null;
  let creditedAppointmentUpdatedAt = null;
  if (appointmentId) {
    const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, branch } });
    if (!appointment || !clientId || appointment.clientId !== clientId) {
      throw apiError("The appointment deposit does not belong to the selected client and branch.", 403);
    }
    const matchesService = items.length === 1 && items[0].type === "Service" && items[0].sourceId === appointment.serviceId;
    if (!matchesService) throw apiError("An appointment deposit can only be applied to its booked service.", 409);
    depositCredit = Math.min(Number(appointment.deposit || 0), subtotal);
    creditedAppointmentId = depositCredit > 0 ? appointment.id : null;
    creditedAppointmentUpdatedAt = creditedAppointmentId ? appointment.updatedAt : null;
  } else if (requestedDepositCredit > 0) {
    throw apiError("Select the appointment that owns this deposit credit.", 409);
  }
  const totalDiscount = Math.min(transactionDiscountAmount + depositCredit + promotionDiscount, subtotal);

  return {
    items,
    subtotal,
    discount,
    manualDiscount: resolvedManualDiscount,
    transactionDiscountAmount,
    depositCredit,
    appointmentId: creditedAppointmentId,
    appointmentUpdatedAt: creditedAppointmentUpdatedAt,
    discountAmount: totalDiscount,
    promotionDiscount,
    appliedPromotions: [...appliedPromotionNames],
    total: Math.max(0, subtotal - totalDiscount),
    client,
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

    // Treatment consumables are deducted from the actual usage recorded in the
    // treatment record. Keeping checkout limited to retail inventory prevents
    // a service from consuming stock twice when clinical documentation is saved.
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

function publicAccount(account, requestedBranchId = "") {
  const safeAccount = account?.staffId && Object.hasOwn(account, "staff") && !accountMatchesStaffIdentity(account, account.staff)
    ? { ...account, staffId: null }
    : account;
  const access = safeAccount?.access || resolveAccountBranchAccess(safeAccount, requestedBranchId, roleAccess);
  return {
    id: safeAccount.id,
    staffId: safeAccount.staffId,
    name: safeAccount.name,
    email: safeAccount.email,
    role: access.scope === "branch" && access.activeBranch?.role ? access.activeBranch.role : safeAccount.role,
    branch: access.scope === "all" ? "All branches" : access.activeBranch?.name || safeAccount.branch || "",
    organizationId: safeAccount.organizationId || "",
    organizationWideAccess: access.organizationWide,
    organizationPermissions: parsePermissionList(safeAccount.organizationPermissions),
    organizationModules: parsePermissionList(safeAccount.organizationModules),
    status: safeAccount.status,
    mustChangePassword: safeAccount.mustChangePassword,
    createdAt: safeAccount.createdAt,
    updatedAt: safeAccount.updatedAt,
    access: { ...access, branchScoped: access.scope !== "all" },
  };
}

function platformAdminEmails() {
  return new Set(clean(process.env.ZENSHOTECH_ADMIN_EMAILS).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function isPlatformAdmin(account) {
  return Boolean(account?.email && platformAdminEmails().has(clean(account.email).toLowerCase()));
}

async function subscriptionUsage(database, organizationId) {
  const [accounts, invitations, branches] = await Promise.all([
    database.account.findMany({ where: { organizationId, status: "Active" }, select: { email: true } }),
    database.userInvitation.findMany({ where: { organizationId, status: "Pending", expiresAt: { gt: new Date() } }, select: { email: true } }),
    database.branch.count({ where: { organizationId, status: "Active" } }),
  ]);
  const userEmails = new Set([...accounts, ...invitations].map((record) => clean(record.email).toLowerCase()).filter(Boolean));
  return { users: userEmails.size, branches };
}

async function subscriptionContext(database, organizationId, now = new Date()) {
  let subscription = await database.subscription.findUnique({ where: { organizationId } });
  if (subscription?.status === "trialing" && subscription.trialEndAt && subscription.trialEndAt <= now) {
    subscription = await database.subscription.update({
      where: { organizationId },
      data: { status: "expired", expiresAt: subscription.trialEndAt },
    });
  }
  const usage = await subscriptionUsage(database, organizationId);
  return serializeSubscription(subscription, usage, now);
}

async function publicAccountWithSubscription(account, requestedBranchId = "") {
  const publicValue = publicAccount(account, requestedBranchId);
  const subscription = await subscriptionContext(prisma, account.organizationId);
  const planModules = new Set(subscription.plan?.moduleEntitlements || []);
  return {
    ...publicValue,
    platformAdmin: isPlatformAdmin(account),
    subscription,
    access: {
      ...publicValue.access,
      modules: subscription.accessAllowed
        ? (publicValue.access?.modules || []).filter((moduleId) => planModules.has(moduleId))
        : [],
      subscriptionActive: subscription.accessAllowed,
    },
  };
}

async function planForOrganization(database, organizationId) {
  const subscription = await database.subscription.findUnique({ where: { organizationId } });
  if (!subscription) return getSubscriptionPlan("unlimited");
  return getSubscriptionPlan(subscription.planCode);
}

async function assertUserPlanLimit(database, organizationId, email = "") {
  const plan = await planForOrganization(database, organizationId);
  if (!plan || plan.maxUsers === null) return;
  const usage = await subscriptionUsage(database, organizationId);
  const normalizedEmail = clean(email).toLowerCase();
  const alreadyCounted = normalizedEmail && Boolean(await database.account.findFirst({
    where: { organizationId, email: normalizedEmail, status: "Active" },
    select: { id: true },
  }) || await database.userInvitation.findFirst({
    where: { organizationId, email: normalizedEmail, status: "Pending", expiresAt: { gt: new Date() } },
    select: { id: true },
  }));
  const limitCheck = userAdditionWithinPlan(plan, usage.users, { alreadyCounted });
  if (!limitCheck.allowed) {
    throw apiError(planLimitMessage(plan, "users"), 409, {
      code: "PLAN_LIMIT_REACHED",
      resource: "users",
      planCode: plan.code,
      limit: plan.maxUsers,
      current: usage.users,
      upgradeUrl: "/pricing",
    });
  }
}

async function assertBranchPlanLimit(database, organizationId, { adding = true } = {}) {
  const plan = await planForOrganization(database, organizationId);
  if (!plan || plan.maxBranches === null) return;
  const usage = await subscriptionUsage(database, organizationId);
  const nextCount = usage.branches + (adding ? 1 : 0);
  if (nextCount > plan.maxBranches) {
    throw apiError(planLimitMessage(plan, "branches"), 409, {
      code: "PLAN_LIMIT_REACHED",
      resource: "branches",
      planCode: plan.code,
      limit: plan.maxBranches,
      current: usage.branches,
      upgradeUrl: "/pricing",
    });
  }
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

function demoRegistrationAllowed(request) {
  return envFlag(process.env.DEMO_SIGNUP_ENABLED)
    || isDemoSignupHostname(request.hostname);
}

function demoDate(offsetDays = 0) {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return posCalendarDate(value);
}

async function seedDemoWorkspace(tx, { branchName, demoKey, ownerName }) {
  const suffix = demoKey.slice(0, 6).toUpperCase();
  const variant = Number.parseInt(demoKey.slice(0, 2), 16) % 5;
  const services = await Promise.all([
    tx.service.create({ data: { name: `Signature Facial ${suffix}`, category: "Facials", duration: 60, price: 3200 + (variant * 250), branches: jsonText([branchName], []) } }),
    tx.service.create({ data: { name: `Laser Rejuvenation ${suffix}`, category: "Laser", duration: 45, price: 4800 + (variant * 300), branches: jsonText([branchName], []) } }),
    tx.service.create({ data: { name: `Skin Consultation ${suffix}`, category: "Consultation", duration: 30, price: 1200, branches: jsonText([branchName], []) } }),
  ]);
  const clientNames = [
    `${ownerName} Sample Client`,
    `Ari Santos ${suffix}`,
    `Mika Reyes ${suffix}`,
    `Sam Cruz ${suffix}`,
  ];
  const clients = await Promise.all(clientNames.map((fullName, index) => tx.client.create({
    data: {
      fullName,
      firstName: fullName.split(" ")[0],
      lastName: fullName.split(" ").slice(1).join(" "),
      email: `sample-${index + 1}-${demoKey}@example.test`,
      mobile: `0917${String((Number.parseInt(demoKey.slice(0, 6), 16) + index) % 10_000_000).padStart(7, "0")}`,
      branch: branchName,
      branchesVisited: jsonText([branchName], []),
      source: index % 2 ? "Instagram" : "Website",
      tag: index === 0 ? "VIP" : "New",
      retention: index === 0 ? "Returning" : "New",
      lastVisit: demoDate(-(index + 1)),
    },
  })));

  const appointmentRows = [
    { date: demoDate(), time: "09:00", clientRecord: clients[0], serviceRecord: services[0], staff: "Dr. Demo Reyes", status: "Completed" },
    { date: demoDate(), time: "11:30", clientRecord: clients[1], serviceRecord: services[1], staff: "Nurse Demo Ana", status: "In Progress" },
    { date: demoDate(), time: "14:00", clientRecord: clients[2], serviceRecord: services[2], staff: "Dr. Demo Tan", status: "Confirmed" },
    { date: demoDate(-1), time: "10:00", clientRecord: clients[2], serviceRecord: services[0], staff: "Dr. Demo Reyes", status: "Completed" },
    { date: demoDate(-1), time: "15:30", clientRecord: clients[3], serviceRecord: services[1], staff: "Dr. Demo Tan", status: "Completed" },
  ];
  await Promise.all(appointmentRows.map(({ clientRecord, serviceRecord, ...appointment }) => tx.appointment.create({
    data: {
      ...appointment,
      clientId: clientRecord.id,
      client: clientRecord.fullName,
      serviceId: serviceRecord.id,
      service: serviceRecord.name,
      branch: branchName,
      duration: serviceRecord.duration,
    },
  })));

  const saleAmounts = [7850 + (variant * 300), 12400 + (variant * 450), 5600 + (variant * 200), 4200];
  await Promise.all(saleAmounts.map((total, index) => tx.sale.create({
    data: {
      invoice: `DEMO-${suffix}-${index + 1}`,
      date: demoDate(index === 3 ? -9 : -(index * 2)),
      time: ["09:15", "13:40", "16:10", "11:20"][index],
      clientId: clients[index % clients.length].id,
      client: clients[index % clients.length].fullName,
      branch: branchName,
      staff: index % 2 ? "Nurse Demo Ana" : "Dr. Demo Reyes",
      subtotal: total,
      total,
      payments: jsonText([{ method: index % 2 ? "Card" : "Cash", amount: total }], []),
      status: "Paid",
      notes: "Generated sample transaction for this private demo workspace.",
    },
  })));

  await Promise.all([
    { item: `Hyaluronic Serum ${suffix}`, sku: `HS-${suffix}`, category: "Skin Care", unit: "units", stock: 3, reorder: 8, cost: 950, price: 1800 },
    { item: `Laser Gel ${suffix}`, sku: `LG-${suffix}`, category: "Consumables", unit: "bottles", stock: 6, reorder: 10, cost: 420, price: 750 },
    { item: `SPF 50 ${suffix}`, sku: `SPF-${suffix}`, category: "Retail", unit: "units", stock: 18, reorder: 8, cost: 600, price: 1200 },
  ].map((item) => tx.inventoryItem.create({ data: { ...item, beginning: item.stock, branch: branchName, location: "Demo stockroom" } })));

  await Promise.all([
    { name: `Jamie Inquiry ${suffix}`, status: "New Inquiry", interest: services[0].name, source: "Website", score: 82 },
    { name: `Taylor Prospect ${suffix}`, status: "Contacted", interest: services[1].name, source: "Instagram", score: 68 },
    { name: `Casey Lead ${suffix}`, status: "Qualified", interest: services[2].name, source: "Referral", score: 74 },
  ].map((lead, index) => tx.lead.create({ data: {
    ...lead,
    branch: branchName,
    assignedBranch: branchName,
    created: demoDate(-index),
    owner: ownerName,
    nextStep: "Schedule a demo consultation",
    permissionToContact: true,
  } })));
}

async function accountFromSession(request) {
  const token = parseCookies(request)[authCookieName];
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { account: { include: accountAccessInclude } },
  });
  if (!session || session.expiresAt <= new Date() || session.account.status !== "Active" || !hasValidBranchAssignment(session.account)) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const account = session.account.staffId && !accountMatchesStaffIdentity(session.account, session.account.staff)
    ? { ...session.account, staffId: null }
    : session.account;
  const actor = await publicAccountWithSubscription(account, request.get("x-mace-branch-id"));
  return {
    token,
    session,
    account: {
      ...account,
      baseRole: account.role,
      role: actor.role,
      branch: actor.branch,
      organizationWideAccess: actor.organizationWideAccess,
      subscription: actor.subscription,
      access: actor.access,
    },
    actor,
  };
}

function requireAuthenticatedAccount(request) {
  if (!request.authAccount) throw apiError("Authentication is required.", 401);
  return request.authAccount;
}

const invitationLifetimeDays = Math.min(30, Math.max(1, Number(process.env.INVITATION_EXPIRY_DAYS || 7)));
const invitationLifetimeMs = invitationLifetimeDays * 24 * 60 * 60 * 1000;
const organizationManagerRoles = ["Owner", "Business Owner", "Super Admin"];
const invitationInclude = {
  organization: { select: { id: true, name: true } },
  invitedBy: { select: { id: true, name: true, email: true } },
  acceptedBy: { select: { id: true, name: true, email: true } },
  revokedBy: { select: { id: true, name: true, email: true } },
  branches: {
    include: { branch: { include: { modules: true } } },
    orderBy: { createdAt: "asc" },
  },
};

function requireInvitationManager(request) {
  requireAuthenticatedAccount(request);
  const actor = actorFromRequest(request);
  if (!canInviteUsers(actor)) {
    throw apiError("You do not have permission to invite organization members.", 403);
  }
  return actor;
}

function invitationNames(payload) {
  const legacyName = clean(payload?.name);
  const nameParts = legacyName.split(/\s+/).filter(Boolean);
  const firstName = requireText(payload?.firstName || nameParts.shift(), "First name").slice(0, 100);
  const lastName = requireText(payload?.lastName || nameParts.join(" "), "Last name").slice(0, 100);
  return { firstName, lastName, name: `${firstName} ${lastName}`.trim() };
}

async function invitationBranches(actor, role, payload, fallbackBranches = []) {
  if (canManageOrganization(role)) {
    const supplied = uniqueStrings(payload?.branchIds).length || (clean(payload?.branch) && !isAllBranches(payload.branch));
    if (supplied) throw apiError("Organization-wide roles must not use a stored branch assignment.", 400);
    return [];
  }

  let branchIds = uniqueStrings(payload?.branchIds, 25);
  if (!branchIds.length && clean(payload?.branch) && !isAllBranches(payload.branch)) {
    const legacyBranch = await prisma.branch.findFirst({
      where: { organizationId: actor.organizationId, name: clean(payload.branch), status: "Active" },
      select: { id: true },
    });
    if (legacyBranch) branchIds = [legacyBranch.id];
  }
  if (!branchIds.length) branchIds = fallbackBranches.map((item) => item.branchId || item.id).filter(Boolean);
  if (!branchIds.length) throw apiError("Choose at least one active clinic branch.", 400);

  if (!canManageOrganization(actor.role) && !canInviteAcrossBranches(actor)) {
    const activeBranchId = actor.access?.activeBranchId;
    if (branchIds.length !== 1 || branchIds[0] !== activeBranchId) {
      throw apiError("You can only invite members to your currently active branch.", 403);
    }
  }

  const records = await prisma.branch.findMany({
    where: { id: { in: branchIds }, organizationId: actor.organizationId, status: "Active" },
    include: { modules: true },
  });
  if (records.length !== branchIds.length) throw apiError("One or more selected branches are unavailable.", 403);
  const byId = new Map(records.map((branch) => [branch.id, branch]));
  return branchIds.map((id) => byId.get(id));
}

async function normalizeInvitationInput(actor, payload, current = null) {
  const role = assertAssignableInvitationRole(actor, requireText(payload?.role || current?.role, "Role"), roleAccess);
  assertPrivilegedConfirmation(actor, role, payload?.confirmOrganizationAccess === true || (current && current.role === role));
  const names = invitationNames({
    firstName: payload?.firstName ?? current?.firstName,
    lastName: payload?.lastName ?? current?.lastName,
    name: payload?.name ?? current?.name,
  });
  const branches = await invitationBranches(actor, role, payload, current?.branches || []);
  const requestedPermissions = payload?.permissions ?? parseJsonList(current?.permissions);
  const permissions = assertRequestedPermissions(actor, role === "Admin"
    ? [...new Set([...requestedPermissions, ...BRANCH_ADMIN_REQUIRED_PERMISSIONS])]
    : requestedPermissions);
  const modules = assertRequestedModules(actor, role, payload?.modules ?? (current ? parseJsonList(current.modules) : undefined), branches, roleAccess);
  if (!canManageOrganization(role) && !modules.includes("pos")) {
    throw apiError("Branch users must retain POS access.", 400);
  }
  return {
    ...names,
    role,
    branches,
    branch: branches[0]?.name || "",
    modules,
    permissions,
    department: boundedPublicText(payload?.department ?? current?.department, "Department", 120),
    specialty: boundedPublicText(payload?.specialty ?? current?.specialty, "Specialty", 120),
    position: boundedPublicText(payload?.position ?? current?.position, "Position", 120),
    message: sanitizeInvitationMessage(payload?.message ?? current?.message),
  };
}

function publicInvitation(invitation) {
  const {
    tokenHash: _tokenHash,
    organization: organizationRecord,
    invitedBy: inviter,
    acceptedBy: acceptor,
    revokedBy: revoker,
    branches: assignments = [],
    ...safe
  } = invitation;
  const effectiveStatus = safe.status === "Pending" && safe.expiresAt <= new Date() ? "Expired" : safe.status;
  return {
    ...safe,
    status: effectiveStatus,
    modules: parseJsonList(safe.modules),
    permissions: parseJsonList(safe.permissions),
    organization: organizationRecord ? { id: organizationRecord.id, name: organizationRecord.name } : undefined,
    invitedBy: inviter ? { id: inviter.id, name: inviter.name } : undefined,
    acceptedBy: acceptor ? { id: acceptor.id, name: acceptor.name } : undefined,
    revokedBy: revoker ? { id: revoker.id, name: revoker.name } : undefined,
    branchIds: assignments.map((assignment) => assignment.branchId),
    branches: assignments.map((assignment) => ({
      id: assignment.branchId,
      name: assignment.branch?.name || "",
      status: assignment.branch?.status || "",
    })),
  };
}

function publicInvitationSummary(invitation, accountExists = false) {
  const safe = publicInvitation(invitation);
  return {
    id: safe.id,
    name: safe.name,
    firstName: safe.firstName,
    email: safe.email,
    role: safe.role,
    position: safe.position,
    organization: safe.organization,
    branches: safe.branches,
    status: safe.status,
    expiresAt: safe.expiresAt,
    accountExists,
  };
}

function invitationUrl(token) {
  const configuredOrigin = clean(process.env.APP_ORIGIN).split(",")[0];
  if (!configuredOrigin && process.env.NODE_ENV === "production") {
    throw apiError("Invitation email requires APP_ORIGIN to be configured.", 503);
  }
  const origin = configuredOrigin || `http://127.0.0.1:${port}`;
  return `${origin.replace(/\/$/, "")}/accept-invitation?token=${encodeURIComponent(token)}`;
}

function invitationEmailContent(invitation, token, inviter) {
  const acceptUrl = invitationUrl(token);
  const branchNames = invitation.branches?.map((assignment) => assignment.branch?.name).filter(Boolean) || [];
  const organizationName = invitation.organization?.name || "ZenshoTech";
  const expires = invitation.expiresAt.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });
  const assignment = branchNames.length ? branchNames.join(", ") : "Organization-wide";
  const text = [
    `Hello ${invitation.firstName || invitation.name},`,
    "",
    `${inviter.name} invited you to join ${organizationName}.`,
    `Role: ${invitation.role}`,
    `Branch: ${assignment}`,
    invitation.position ? `Position: ${invitation.position}` : "",
    invitation.message ? `Personal message: ${invitation.message}` : "",
    "",
    `Accept invitation: ${acceptUrl}`,
    `This personal, single-use link expires ${expires}. Do not share it.`,
    "If you do not recognize this invitation, do not open the link and contact the clinic directly.",
  ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
  const logoUrl = `${acceptUrl.split("/accept-invitation")[0]}/brand/zenshotech-wordmark.svg`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f1eb;font-family:Arial,sans-serif;color:#2d2824"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="padding:28px 32px;border-bottom:1px solid #eadfd4"><img src="${escapeHtml(logoUrl)}" width="138" alt="ZenshoTech"></td></tr><tr><td style="padding:32px"><p style="margin:0 0 12px;color:#8a624c;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">You’re invited</p><h1 style="margin:0 0 18px;font-size:28px">Join ${escapeHtml(organizationName)}</h1><p>Hello ${escapeHtml(invitation.firstName || invitation.name)},</p><p>${escapeHtml(inviter.name)} invited you to join as <strong>${escapeHtml(invitation.role)}</strong> for <strong>${escapeHtml(assignment)}</strong>.</p>${invitation.message ? `<p style="padding:14px 16px;background:#f8f4ef;border-radius:10px">${escapeHtml(invitation.message)}</p>` : ""}<p style="margin:28px 0"><a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:#7b4b36;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700">Accept invitation</a></p><p style="font-size:13px;color:#6f6761">This personal, single-use link expires ${escapeHtml(expires)}. Do not share it.</p><p style="font-size:13px;color:#6f6761">If you do not recognize this invitation, ignore this email and contact the clinic directly.</p></td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}

// Compatibility adapters for the established invitation endpoints while the
// normalized invitation records carry organization and branch assignments.
const invitationStatuses = INVITATION_STATUSES;

function invitationRole(value, actor) {
  return assertAssignableInvitationRole(actor, requireText(value, "Role"), roleAccess);
}

async function invitationBranch(value, role) {
  if (canManageOrganization(role)) return "All branches";
  const name = requireText(value, "Branch");
  const branch = await prisma.branch.findFirst({ where: { name, status: "Active" }, select: { name: true } });
  if (!branch) throw apiError("Choose an active branch.", 400);
  return branch.name;
}

function invitationEmailText(invitation, token, inviter) {
  return invitationEmailContent(invitation, token, inviter).text;
}

async function deliverInvitation(invitation, token, inviter, subject) {
  const content = invitationEmailContent(invitation, token, inviter);
  const transporter = createEmailTransport();
  try {
    await sendSmtpEmail({ transporter, to: invitation.email, subject, ...content });
  } finally {
    transporter.close();
  }
}

async function updateInvitationDelivery(request, invitation, token, inviter, subject, action) {
  try {
    await deliverInvitation(invitation, token, inviter, subject);
    const saved = await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { deliveryStatus: "Sent", failedReason: "" },
      include: invitationInclude,
    });
    const auditLog = await writeAudit(prisma, request, {
      area: "Access",
      action,
      branchId: saved.branches[0]?.branchId || null,
      subjectType: "UserInvitation",
      subjectId: saved.id,
      details: `Invitation email sent to ${saved.email}.`,
      afterValues: { deliveryStatus: "Sent", expiresAt: saved.expiresAt },
    });
    return { invitation: saved, auditLog };
  } catch (error) {
    const saved = await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { deliveryStatus: "Failed", failedReason: clean(error.message).slice(0, 500) },
      include: invitationInclude,
    });
    const auditLog = await writeAudit(prisma, request, {
      area: "Access",
      action: "Invitation delivery failed",
      branchId: saved.branches[0]?.branchId || null,
      subjectType: "UserInvitation",
      subjectId: saved.id,
      details: `Invitation for ${saved.email} was saved but email delivery failed.`,
      afterValues: { deliveryStatus: "Failed" },
    });
    return { invitation: saved, auditLog, deliveryError: "The invitation was saved, but the email could not be delivered. You can retry safely." };
  }
}

async function expireInvitations() {
  const expired = await prisma.userInvitation.findMany({
    where: { status: "Pending", expiresAt: { lte: new Date() } },
    include: invitationInclude,
  });
  for (const invitation of expired) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.userInvitation.updateMany({
        where: { id: invitation.id, status: "Pending", expiresAt: { lte: new Date() } },
        data: { status: "Expired" },
      });
      if (!changed.count) return;
      await tx.auditLog.create({ data: {
        time: new Date().toLocaleString("en-PH"),
        actor: "System",
        role: "System",
        branchId: invitation.branches[0]?.branchId || null,
        area: "Access",
        action: "Invitation expired",
        subjectType: "UserInvitation",
        subjectId: invitation.id,
        details: `Invitation for ${invitation.email} expired.`,
        beforeValues: jsonText({ status: "Pending" }, {}),
        afterValues: jsonText({ status: "Expired" }, {}),
      } });
      if (canManageOrganization(invitation.role)) {
        const owners = await tx.account.findMany({
          where: { organizationId: invitation.organizationId, status: "Active", role: { in: organizationManagerRoles } },
          select: { id: true },
        });
        if (owners.length) {
          await createAppNotification(tx, {
            module: "staff",
            title: "Privileged invitation expired",
            message: `The ${invitation.role} invitation for ${invitation.email} expired.`,
            recipientAccountIds: owners.map((owner) => owner.id),
            recordId: invitation.id,
          });
        }
      }
    });
  }
}

function registrationWorkspaceValues(businessName) {
  const registrationKey = randomBytes(8).toString("hex");
  const suffix = registrationKey.slice(0, 6).toUpperCase();
  const organizationSlugBase = businessName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "clinic";
  return {
    organizationSlug: `${organizationSlugBase}-${registrationKey}`,
    branchName: `${businessName} ${suffix}`,
    branchCode: `ZEN-${registrationKey.slice(0, 8).toUpperCase()}`,
  };
}

async function createOwnerWorkspace(tx, {
  name,
  businessName,
  email,
  passwordHash,
  token,
  expiresAt,
  googleIdentity = null,
}) {
  const values = registrationWorkspaceValues(businessName);
  const organizationModules = roleAccess.Owner;
  const organization = await tx.organization.create({
    data: { name: businessName, slug: values.organizationSlug, status: "Active" },
  });
  const branch = await tx.branch.create({
    data: {
      organizationId: organization.id,
      name: values.branchName,
      code: values.branchCode,
      status: "Active",
      modules: { create: organizationModules.map((moduleId) => ({ moduleId, enabled: true })) },
    },
  });
  const account = await tx.account.create({
    data: {
      name,
      email,
      passwordHash,
      role: "Owner",
      branch: branch.name,
      organizationId: organization.id,
      organizationWideAccess: true,
      organizationModules: jsonText(organizationModules, []),
      lastBranchId: branch.id,
      status: "Active",
      mustChangePassword: false,
      emailVerifiedAt: googleIdentity?.emailVerified ? new Date() : null,
    },
  });
  if (googleIdentity) {
    await tx.accountIdentity.create({
      data: {
        accountId: account.id,
        provider: "google",
        providerSubject: googleIdentity.subject,
        providerEmail: googleIdentity.email,
        emailVerified: googleIdentity.emailVerified,
      },
    });
  }
  await tx.branchMembership.create({
    data: {
      branchId: branch.id,
      accountId: account.id,
      role: "Owner",
      modules: jsonText(organizationModules, []),
      permissions: "[]",
      status: "Active",
      isPrimary: true,
    },
  });
  await tx.subscription.create({
    data: {
      organizationId: organization.id,
      status: "pending_plan",
      includedWebsitePages: INCLUDED_WEBSITE_PAGES,
    },
  });
  await tx.authSession.create({ data: { tokenHash: sessionTokenHash(token), accountId: account.id, expiresAt } });
  await tx.auditLog.create({ data: {
    time: new Date().toLocaleString("en-PH"),
    actor: name,
    role: "Owner",
    actorAccountId: account.id,
    branchId: branch.id,
    area: "Authentication",
    action: "Account registered",
    subjectType: "Account",
    subjectId: account.id,
    details: `Owner registration completed with ${googleIdentity ? "Google" : "email and password"}. Subscription remains pending until a plan is selected; no trial or charge was created.`,
  } });
  return { accountId: account.id, organizationId: organization.id };
}

async function deliverRegistrationConfirmation(account, authenticationMethod) {
  if (!emailReady()) {
    console.warn(JSON.stringify({ event: "registration_confirmation_skipped", accountId: account.id, reason: "smtp_not_configured" }));
    return false;
  }
  let transporter;
  try {
    transporter = await createVerifiedEmailTransport();
    const content = registrationConfirmationEmail({
      account,
      organization: account.organization,
      appOrigin: process.env.APP_ORIGIN,
      authenticationMethod,
    });
    await sendSmtpEmail({ transporter, ...content });
    await prisma.account.update({ where: { id: account.id }, data: { registrationEmailSentAt: new Date() } });
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: "registration_confirmation_failed", accountId: account.id, error: clean(error.message) }));
    return false;
  } finally {
    transporter?.close();
  }
}

function assertGoogleRequestOrigin(request) {
  const origin = clean(request.get("origin"));
  const localOrigin = process.env.NODE_ENV !== "production" && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(origin);
  if (!origin || (!allowedOrigins.includes(origin) && !localOrigin)) {
    throw apiError("Google authentication must be started from an approved ZenshoTech site.", 403);
  }
}

app.get("/api/public/auth-config", (_request, response) => {
  response.json({ googleClientId: googleClientId(process.env) });
});

app.get("/api/public/plans", (_request, response) => {
  response.json({
    plans: publicSubscriptionPlans(),
    websitePackage: {
      title: "Free Website Included",
      includedPages: PLAN_WEBSITE_PAGE_ALLOWANCES,
      features: [
        "Responsive website design",
        "Plan-specific page allowance",
        "Basic SEO setup",
        "Contact form integration",
        "Online booking integration",
        "Lead capture integration",
        "Mobile-responsive design",
      ],
      note: "Starter includes up to 8 pages, Growth includes up to 15 pages, and Unlimited includes up to 20 pages. Additional pages are available through a separate quotation based on the requirements.",
    },
  });
});

app.post("/api/auth/register", asyncRoute(async (request, response) => {
  const name = requireText(request.body?.name, "Full name").replace(/\s+/g, " ").slice(0, 100);
  const businessName = requireText(request.body?.businessName, "Business or clinic name").replace(/\s+/g, " ").slice(0, 140);
  const email = requireText(request.body?.email, "Email").toLowerCase().slice(0, 160);
  const password = requireText(request.body?.password, "Password");
  if (request.body?.termsAccepted !== true || request.body?.privacyAccepted !== true) {
    throw apiError("Accept the Terms of Service and Privacy Policy to continue.", 400);
  }
  if (name.length < 2) throw apiError("Enter your full name.", 400);
  if (businessName.length < 2) throw apiError("Enter your business or clinic name.", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw apiError("Enter a valid email address.", 400);
  if (!demoPasswordMeetsMinimum(password)) throw apiError("Use at least 8 characters for your password.", 400);
  if (await prisma.account.findUnique({ where: { email }, select: { id: true } })) {
    throw apiError("An account already exists for this email. Sign in instead.", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  let registration;

  try {
    registration = await prisma.$transaction((tx) => createOwnerWorkspace(tx, {
      name,
      businessName,
      email,
      passwordHash: hashPassword(password),
      token,
      expiresAt,
    }));
  } catch (error) {
    if (error?.code === "P2002") throw apiError("An account already exists for this email. Sign in instead.", 409);
    throw error;
  }

  const account = await prisma.account.findUnique({ where: { id: registration.accountId }, include: accountAccessInclude });
  const confirmationEmailSent = await deliverRegistrationConfirmation(account, "email and password");
  setSessionCookie(response, token, expiresAt);
  response.status(201).json({
    account: await publicAccountWithSubscription(account),
    expiresAt,
    confirmationEmailSent,
    message: confirmationEmailSent
      ? `Your workspace is ready. A registration confirmation was sent to ${account.email}.`
      : `Your workspace is ready, but the confirmation email could not be sent. Try again later or contact ${subscriptionSalesRecipient(process.env)}.`,
    redirectTo: "/pricing?onboarding=1",
  });
}));

app.post("/api/auth/google", asyncRoute(async (request, response) => {
  if (!googleAuthenticationReady(process.env)) throw apiError("Google authentication is not configured yet.", 503);
  assertGoogleRequestOrigin(request);
  let profile;
  try {
    profile = await verifyGoogleCredential(request.body?.credential, { clientId: googleClientId(process.env) });
  } catch (error) {
    console.warn(JSON.stringify({ event: "google_authentication_rejected", error: clean(error.message) }));
    throw apiError("Google could not verify this sign-in. Please try again.", 401);
  }

  const identity = await prisma.accountIdentity.findUnique({
    where: { provider_providerSubject: { provider: "google", providerSubject: profile.subject } },
    select: { accountId: true },
  });
  let account = identity
    ? await prisma.account.findUnique({ where: { id: identity.accountId }, include: accountAccessInclude })
    : await prisma.account.findUnique({ where: { email: profile.email }, include: accountAccessInclude });
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  let isNewAccount = false;

  if (account) {
    if (account.status !== "Active" || (account.lockedUntil && account.lockedUntil > now)) {
      throw apiError("This account is not available for sign-in. Contact an administrator.", 403);
    }
    if (!identity) {
      if (!googleIsAuthoritativeForEmail(profile)) {
        throw apiError("An account already uses this email. Sign in with your password before connecting Google.", 409, { code: "GOOGLE_ACCOUNT_LINK_REQUIRED" });
      }
      try {
        await prisma.accountIdentity.create({ data: {
          accountId: account.id,
          provider: "google",
          providerSubject: profile.subject,
          providerEmail: profile.email,
          emailVerified: true,
        } });
      } catch (error) {
        if (error?.code !== "P2002") throw error;
        const concurrentIdentity = await prisma.accountIdentity.findUnique({
          where: { provider_providerSubject: { provider: "google", providerSubject: profile.subject } },
          select: { accountId: true },
        });
        if (concurrentIdentity?.accountId !== account.id) throw apiError("This Google account is already linked elsewhere.", 409);
      }
      await prisma.account.update({ where: { id: account.id }, data: { emailVerifiedAt: account.emailVerifiedAt || now } });
    }
    if (!hasValidBranchAssignment(account)) throw apiError("This account must be assigned to one clinic branch. Contact an administrator.", 403);
    await prisma.$transaction([
      prisma.authSession.deleteMany({ where: { accountId: account.id, expiresAt: { lt: now } } }),
      prisma.authSession.create({ data: { tokenHash: sessionTokenHash(token), accountId: account.id, expiresAt } }),
      prisma.account.update({ where: { id: account.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } }),
    ]);
  } else {
    const businessName = clean(request.body?.businessName).replace(/\s+/g, " ").slice(0, 140);
    if (businessName.length < 2 || request.body?.termsAccepted !== true || request.body?.privacyAccepted !== true) {
      throw apiError("Complete your clinic name and accept the terms to register with Google.", 422, {
        code: "GOOGLE_REGISTRATION_REQUIRED",
        profile: { name: profile.name, email: profile.email },
      });
    }
    try {
      const registration = await prisma.$transaction((tx) => createOwnerWorkspace(tx, {
        name: profile.name,
        businessName,
        email: profile.email,
        passwordHash: hashPassword(randomBytes(48).toString("base64url")),
        token,
        expiresAt,
        googleIdentity: profile,
      }));
      account = await prisma.account.findUnique({ where: { id: registration.accountId }, include: accountAccessInclude });
      isNewAccount = true;
    } catch (error) {
      if (error?.code === "P2002") throw apiError("An account or Google identity already exists. Try signing in again.", 409);
      throw error;
    }
  }

  const confirmationEmailSent = isNewAccount ? await deliverRegistrationConfirmation(account, "Google") : null;
  setSessionCookie(response, token, expiresAt);
  response.status(isNewAccount ? 201 : 200).json({
    account: await publicAccountWithSubscription(account),
    expiresAt,
    isNewAccount,
    confirmationEmailSent,
    message: isNewAccount
      ? (confirmationEmailSent
        ? `Your workspace is ready. A registration confirmation was sent to ${account.email}.`
        : `Your workspace is ready, but the confirmation email could not be sent. Contact ${subscriptionSalesRecipient(process.env)} if the address is correct.`)
      : `Welcome back, ${account.name}.`,
    redirectTo: isNewAccount ? "/pricing?onboarding=1" : "/dashboard",
  });
}));

app.post("/api/auth/demo-register", asyncRoute(async (request, response) => {
  if (!demoRegistrationAllowed(request)) throw apiError("Demo account creation is available on the staging site only.", 404);

  const name = requireText(request.body?.name, "Name").replace(/\s+/g, " ").slice(0, 100);
  const email = requireText(request.body?.email, "Email").toLowerCase().slice(0, 160);
  const password = requireText(request.body?.password, "Password");
  if (name.length < 2) throw apiError("Enter your full name.", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw apiError("Enter a valid email address.", 400);
  if (!demoPasswordMeetsMinimum(password)) {
    throw apiError("Use at least 8 characters for your demo password.", 400);
  }

  const existingAccount = await prisma.account.findUnique({ where: { email }, select: { id: true } });
  if (existingAccount) throw apiError("An account already exists for this email. Sign in instead.", 409);
  const demoAccountCount = await prisma.account.count({ where: { role: { in: ["Demo User", "Demo Viewer"] } } });
  const demoAccountLimit = Number(process.env.DEMO_ACCOUNT_LIMIT || 5000);
  if (demoAccountCount >= demoAccountLimit) throw apiError("Demo account capacity has been reached. Contact the site administrator.", 503);

  const demoModules = roleAccess["Demo User"];
  const demoKey = randomBytes(8).toString("hex");
  const suffix = demoKey.slice(0, 6).toUpperCase();
  const ownerLabel = name.split(" ")[0].replace(/[^A-Za-z0-9'-]/g, "").slice(0, 30) || "Prospect";
  const organizationName = `${ownerLabel}'s ZenshoTech Demo ${suffix}`;
  const branchName = `${ownerLabel}'s Demo Clinic ${suffix}`;
  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName, slug: `zenshotech-demo-${demoKey}`, status: "Active" },
      });
      const branch = await tx.branch.create({ data: {
        organizationId: organization.id,
        name: branchName,
        code: `ZEN-${demoKey.slice(0, 8).toUpperCase()}`,
        city: "Demo City",
        status: "Active",
      } });
      for (const moduleId of demoModules) {
        await tx.branchModule.upsert({
          where: { branchId_moduleId: { branchId: branch.id, moduleId } },
          create: { branchId: branch.id, moduleId, enabled: true },
          update: { enabled: true },
        });
      }
      const account = await tx.account.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: "Demo User",
          branch: branch.name,
          organizationId: organization.id,
          organizationWideAccess: true,
          organizationModules: jsonText(demoModules, []),
          lastBranchId: branch.id,
          status: "Active",
          mustChangePassword: false,
        },
      });
      await tx.branchMembership.create({
        data: {
          branchId: branch.id,
          accountId: account.id,
          role: "Demo User",
          modules: jsonText(demoModules, []),
          permissions: "[]",
          status: "Active",
          isPrimary: true,
        },
      });
      await seedDemoWorkspace(tx, { branchName, demoKey, ownerName: ownerLabel });
      await tx.auditLog.create({ data: {
        time: new Date().toLocaleString("en-PH"),
        actor: name,
        role: "Demo User",
        actorAccountId: account.id,
        branchId: branch.id,
        area: "Authentication",
        action: "Demo account created",
        subjectType: "Account",
        subjectId: account.id,
        details: "A private staging sandbox and isolated sample dataset were created through self-service registration.",
      } });
    });
  } catch (error) {
    if (error?.code === "P2002") throw apiError("An account already exists for this email. Sign in instead.", 409);
    throw error;
  }

  response.status(201).json({ created: true, email, message: "Your private demo workspace is ready." });
}));

app.use("/api", asyncRoute(async (request, _response, next) => {
  const authenticated = await accountFromSession(request);
  if (authenticated) {
    request.authSession = authenticated.session;
    request.authAccount = authenticated.account;
    request.authActor = authenticated.actor;
    request.authSubscription = authenticated.actor.subscription;
  }
  next();
}));

app.use("/api", (request, response, next) => {
  if (isPublicApiRequest(request.method, request.originalUrl)) return next();
  if (process.env.NODE_ENV === "test" && envFlag(process.env.API_ALLOW_TRUSTED_HEADERS)) {
    const actor = actorFromRequest(request);
    if (actor.role) {
      request.authAccount = actor;
      request.authActor = actor;
    }
  }
  if (!request.authAccount) {
    clearSessionCookie(response);
    return next(apiError("Authentication is required.", 401));
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.get("x-mace-request") !== "app") {
    return next(apiError("This request did not pass the CSRF check.", 403));
  }
  const subscriptionSafePath = /^\/api\/(?:auth\/(?:session|logout|change-password)|subscription(?:\/|$)|admin\/subscriptions(?:\/|$))/.test(request.originalUrl.split("?")[0]);
  if (!subscriptionSafePath && request.authSubscription && !request.authSubscription.accessAllowed) {
    const expired = request.authSubscription.status === "expired";
    return next(apiError(
      expired
        ? "Your 7-day free trial has ended. Choose a plan to continue using ZenshoTech."
        : "Choose a plan and start your 7-day free trial to use ZenshoTech modules.",
      402,
      { code: expired ? "SUBSCRIPTION_EXPIRED" : "PLAN_REQUIRED", redirectTo: expired ? "/subscription/expired" : "/pricing?onboarding=1" },
    ));
  }
  const requiredModule = requiredModuleForApiRequest(request.originalUrl);
  const organizationModuleGrant = requiredModule === "branches" && hasOrganizationPermission(request.authActor, "branches.manage");
  if (requiredModule && !organizationModuleGrant && !moduleAllowed(request.authActor, requiredModule, roleAccess)) {
    return next(apiError(`Your role does not allow access to ${requiredModule}.`, 403));
  }
  return next();
});

function requireSubscriptionOwner(request) {
  const account = requireAuthenticatedAccount(request);
  if (!canManageOrganization(request.authActor?.role)) {
    throw apiError("Only a workspace owner can manage the subscription.", 403);
  }
  return account;
}

function requirePlatformAdministrator(request) {
  const account = requireAuthenticatedAccount(request);
  if (!isPlatformAdmin(account)) throw apiError("ZenshoTech administrator access is required.", 403);
  return account;
}

app.get("/api/subscription", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  response.json({ subscription: await subscriptionContext(prisma, account.organizationId), platformAdmin: isPlatformAdmin(account) });
}));

app.post("/api/subscription/trial", asyncRoute(async (request, response) => {
  const account = requireSubscriptionOwner(request);
  const plan = getSubscriptionPlan(request.body?.planCode);
  if (!isMonthlyPlan(plan)) throw apiError("Choose Starter, Growth, or Unlimited to begin a trial.", 400);
  const billingCycle = normalizeBillingCycle(request.body?.billingCycle, plan);
  const usage = await subscriptionUsage(prisma, account.organizationId);
  const usageCheck = assertUsageWithinPlan(plan, usage);
  if (!usageCheck.allowed) throw apiError(usageCheck.message, 409, { code: "PLAN_LIMIT_REACHED", ...usageCheck, upgradeUrl: "/pricing" });

  const current = await prisma.subscription.findUnique({ where: { organizationId: account.organizationId } });
  if (current && ["expired", "canceled"].includes(current.status)) {
    throw apiError("This workspace has already used its free trial. Request subscription activation to continue.", 409, { code: "TRIAL_ALREADY_USED" });
  }
  if (current && ["active", "lifetime", "past_due", "pending_activation"].includes(current.status)) {
    throw apiError("This workspace already has subscription history. Use the plan-change or activation request instead.", 409);
  }

  const now = new Date();
  const window = current?.trialStartAt && current?.trialEndAt
    ? { start: current.trialStartAt, end: current.trialEndAt }
    : trialWindow(now);
  const saved = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { organizationId: account.organizationId },
      create: {
        organizationId: account.organizationId,
        planCode: plan.code,
        billingCycle,
        status: "trialing",
        trialStartAt: window.start,
        trialEndAt: window.end,
        includedWebsitePages: plan.includedWebsitePages,
      },
      update: {
        planCode: plan.code,
        requestedPlanCode: null,
        billingCycle,
        requestedBillingCycle: null,
        status: "trialing",
        trialStartAt: window.start,
        trialEndAt: window.end,
        includedWebsitePages: plan.includedWebsitePages,
      },
    });
    await writeAudit(tx, request, {
      area: "Subscription",
      action: current?.trialStartAt ? "Trial plan changed" : "Trial started",
      subjectType: "Subscription",
      subjectId: subscription.id,
      details: current?.trialStartAt
        ? `Trial plan changed to ${plan.name} with ${billingCycle} billing selected; the original expiration was preserved.`
        : `${plan.name} trial started for exactly 168 hours with ${billingCycle} billing selected. No payment or setup charge was created.`,
      beforeValues: current ? { planCode: current.planCode, billingCycle: current.billingCycle, status: current.status, trialEndAt: current.trialEndAt } : null,
      afterValues: { planCode: plan.code, billingCycle, status: "trialing", trialStartAt: window.start, trialEndAt: window.end },
    });
    return subscription;
  });
  const reloaded = await prisma.account.findUnique({ where: { id: account.id }, include: accountAccessInclude });
  response.status(current ? 200 : 201).json({
    subscription: serializeSubscription(saved, usage),
    account: await publicAccountWithSubscription(reloaded),
    redirectTo: "/dashboard",
  });
}));

app.post("/api/subscription/request-activation", asyncRoute(async (request, response) => {
  const account = requireSubscriptionOwner(request);
  const current = await prisma.subscription.findUnique({ where: { organizationId: account.organizationId } });
  const plan = getSubscriptionPlan(request.body?.planCode || current?.planCode);
  if (!isMonthlyPlan(plan)) throw apiError("Subscription activation is available for Starter, Growth, or Unlimited.", 400);
  const billingCycle = normalizeBillingCycle(request.body?.billingCycle || current?.billingCycle, plan);
  const billing = billingDetails(plan, billingCycle);
  const usage = await subscriptionUsage(prisma, account.organizationId);
  const usageCheck = assertUsageWithinPlan(plan, usage);
  if (!usageCheck.allowed) throw apiError(usageCheck.message, 409, { code: "PLAN_LIMIT_REACHED", ...usageCheck });
  const requestedAt = new Date();
  const salesRecipient = subscriptionSalesRecipient(process.env);
  const saved = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { organizationId: account.organizationId },
      create: {
        organizationId: account.organizationId,
        planCode: "unlimited",
        requestedPlanCode: plan.code,
        billingCycle: "monthly",
        requestedBillingCycle: billingCycle,
        status: "grandfathered",
        activationRequestedAt: requestedAt,
        includedWebsitePages: plan.includedWebsitePages,
      },
      update: { requestedPlanCode: plan.code, requestedBillingCycle: billingCycle, activationRequestedAt: requestedAt },
    });
    await writeAudit(tx, request, {
      area: "Subscription",
      action: "Activation requested",
      subjectType: "Subscription",
      subjectId: subscription.id,
      details: `${plan.name} activation with ${billingCycle} billing was requested. No payment success or charge was created.`,
      afterValues: { requestedPlanCode: plan.code, requestedBillingCycle: billingCycle, amount: billing.amount, discountPercent: billing.discountPercent },
    });
    return subscription;
  });
  let transporter;
  try {
    transporter = await createVerifiedEmailTransport();
    const email = activationRequestEmail({
      recipient: salesRecipient,
      account,
      organization: account.organization,
      plan,
      billing,
      billingCycle,
      usage,
      subscription: saved,
      requestedAt,
      appOrigin: process.env.APP_ORIGIN,
    });
    await sendSmtpEmail({ transporter, ...email });
  } catch (error) {
    console.error(JSON.stringify({
      event: "subscription_activation_email_failed",
      organizationId: account.organizationId,
      subscriptionId: saved.id,
      recipient: salesRecipient,
      error: clean(error.message),
    }));
    throw apiError(`Your quotation request was recorded, but the notification email could not be delivered. Please try again or contact ${salesRecipient}.`, 502);
  } finally {
    transporter?.close();
  }
  response.json({
    subscription: serializeSubscription(saved, usage),
    notificationSent: true,
    message: billingCycle === "annual"
      ? "Your annual quotation request is recorded for a 12-month term with the 10% discount. ZenshoTech will contact you to confirm the quote and activation."
      : "Your monthly quotation request is recorded. ZenshoTech will contact you to confirm the quote and activation.",
  });
}));

app.get("/api/admin/subscriptions", asyncRoute(async (request, response) => {
  requirePlatformAdministrator(request);
  const organizations = await prisma.organization.findMany({ include: { subscription: true }, orderBy: { updatedAt: "desc" } });
  const subscriptions = await Promise.all(organizations.map(async (organization) => ({
    ...serializeSubscription(organization.subscription, await subscriptionUsage(prisma, organization.id), new Date(), { includePricing: true }),
    organization: { id: organization.id, name: organization.name },
  })));
  response.json({ subscriptions });
}));

app.patch("/api/admin/subscriptions/:organizationId", asyncRoute(async (request, response) => {
  requirePlatformAdministrator(request);
  const organizationId = requireText(request.params.organizationId, "Organization");
  const action = requireText(request.body?.action, "Action");
  if (!await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) {
    throw apiError("Organization not found.", 404);
  }
  const current = await prisma.subscription.findUnique({ where: { organizationId } });
  const usage = await subscriptionUsage(prisma, organizationId);
  const now = new Date();
  let data;
  if (action === "activate") {
    const plan = getSubscriptionPlan(request.body?.planCode || current?.requestedPlanCode || current?.planCode);
    if (!isMonthlyPlan(plan)) throw apiError("Choose Starter, Growth, or Unlimited to activate.", 400);
    const billingCycle = normalizeBillingCycle(request.body?.billingCycle || current?.requestedBillingCycle || current?.billingCycle, plan);
    const usageCheck = assertUsageWithinPlan(plan, usage);
    if (!usageCheck.allowed) throw apiError(usageCheck.message, 409, { code: "PLAN_LIMIT_REACHED", ...usageCheck });
    const renewalAt = new Date(now);
    renewalAt.setUTCMonth(renewalAt.getUTCMonth() + (billingCycle === "annual" ? 12 : 1));
    data = { planCode: plan.code, requestedPlanCode: null, billingCycle, requestedBillingCycle: null, status: "active", paidStartAt: current?.paidStartAt || now, renewalAt, expiresAt: null, activationRequestedAt: null, includedWebsitePages: plan.includedWebsitePages };
  } else if (action === "grant_lifetime") {
    data = { planCode: "lifetime", requestedPlanCode: null, billingCycle: "one_time", requestedBillingCycle: null, status: "lifetime", paidStartAt: current?.paidStartAt || now, renewalAt: null, expiresAt: null, activationRequestedAt: null, includedWebsitePages: getSubscriptionPlan("lifetime").includedWebsitePages };
  } else if (action === "suspend") {
    if (!current) throw apiError("Create or activate a subscription before suspending it.", 409);
    data = { status: "past_due" };
  } else if (action === "reactivate") {
    if (!current) throw apiError("Create or activate a subscription before reactivating it.", 409);
    const plan = getSubscriptionPlan(current.planCode);
    if (!plan) throw apiError("Choose a valid plan before reactivating this subscription.", 409);
    data = { status: plan.billingInterval === "one_time" ? "lifetime" : "active", expiresAt: null };
  } else if (action === "extend_trial") {
    if (!current) throw apiError("This organization has no trial to extend.", 409);
    const hours = Math.min(168, Math.max(1, Number(request.body?.hours) || 24));
    const base = current.trialEndAt && current.trialEndAt > now ? current.trialEndAt : now;
    data = { status: "trialing", trialStartAt: current.trialStartAt || now, trialEndAt: new Date(base.getTime() + (hours * 60 * 60 * 1000)), expiresAt: null };
  } else {
    throw apiError("Unsupported subscription administration action.", 400);
  }
  const saved = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    await writeAudit(tx, request, {
      area: "Subscription",
      action: `Subscription ${action.replace(/_/g, " ")}`,
      subjectType: "Subscription",
      subjectId: subscription.id,
      details: `ZenshoTech administrator applied ${action.replace(/_/g, " ")} to organization ${organizationId}.`,
      beforeValues: current,
      afterValues: subscription,
    });
    return subscription;
  });
  response.json({ subscription: serializeSubscription(saved, usage, new Date(), { includePricing: true }) });
}));

const flipbookRouters = createFlipbookRouters({
  prisma,
  storageRequest,
  assertReadAllowed,
  assertMutationAllowed,
  branchWhere,
  canAccessBranch,
  hashPassword,
  verifyPassword,
  writeAudit,
  canManageOrganization,
});
app.use("/api/flipbooks", flipbookRouters.internal);
app.use("/api/public/flipbooks", flipbookRouters.public);

app.use("/api/facetrack-attendance", createFaceTrackAttendanceRouter(prisma));
app.use("/api/payroll", createPayrollRouter(prisma, { apiError, asyncRoute, writeAudit }));

app.post("/api/auth/login", asyncRoute(async (request, response) => {
  const email = requireText(request.body?.email, "Email").toLowerCase();
  const password = requireText(request.body?.password, "Password");
  const account = await prisma.account.findUnique({ where: { email }, include: accountAccessInclude });
  const now = new Date();

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

  if (!hasValidBranchAssignment(account)) {
    throw apiError("This account must be assigned to one clinic branch. Contact an administrator.", 403);
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { accountId: account.id, expiresAt: { lt: now } } }),
    prisma.authSession.create({ data: { tokenHash: sessionTokenHash(token), accountId: account.id, expiresAt } }),
    prisma.account.update({ where: { id: account.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } }),
  ]);
  setSessionCookie(response, token, expiresAt);
  response.json({ account: await publicAccountWithSubscription(account), expiresAt });
}));

app.post("/api/auth/forgot-password", asyncRoute(async (request, response) => {
  const email = requireText(request.body?.email, "Email").toLowerCase();
  const transporter = await createVerifiedEmailTransport();
  try {
    const account = /^\S+@\S+\.\S+$/.test(email)
      ? await prisma.account.findUnique({ where: { email } })
      : null;
    if (account?.status === "Active") {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = sessionTokenHash(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { accountId: account.id, usedAt: null } }),
        prisma.passwordResetToken.create({ data: { tokenHash, accountId: account.id, expiresAt } }),
      ]);
      const configuredOrigin = clean(process.env.APP_ORIGIN).split(",")[0];
      const requestOrigin = clean(request.get("origin"));
      const localRequestOrigin = process.env.NODE_ENV !== "production" && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(requestOrigin)
        ? requestOrigin
        : "";
      const origin = configuredOrigin || localRequestOrigin || "http://127.0.0.1:5173";
      const resetUrl = `${origin.replace(/\/$/, "")}/?reset=${encodeURIComponent(token)}`;
      try {
        await sendSmtpEmail({
          transporter,
          to: account.email,
          subject: "Reset your ZenshoTech password",
          text: `Use this single-use link within 30 minutes to reset your password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        });
      } catch (error) {
        console.error(JSON.stringify({ event: "password_reset_delivery_failed", accountId: account.id, error: clean(error.message) }));
        await prisma.passwordResetToken.deleteMany({ where: { tokenHash } }).catch((cleanupError) => {
          console.error(JSON.stringify({ event: "password_reset_token_cleanup_failed", accountId: account.id, error: clean(cleanupError.message) }));
        });
        throw apiError("Password-reset email could not be delivered. Please try again later.", 502);
      }
    }
    response.status(202).json({ message: "If the account exists, a password-reset email has been sent." });
  } finally {
    transporter.close();
  }
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
  response.json({ account: request.authActor || null, expiresAt: request.authSession?.expiresAt || null });
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
  response.json({ account: { ...request.authActor, mustChangePassword: updated.mustChangePassword } });
}));

app.get("/api/invitations", asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  await expireInvitations();
  const [invitations, branches] = await Promise.all([
    prisma.userInvitation.findMany({
      where: invitationScopeWhere(actor),
      include: invitationInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: canManageOrganization(actor.role) || canInviteAcrossBranches(actor)
        ? { organizationId: actor.organizationId, status: "Active" }
        : { id: actor.access?.activeBranchId, organizationId: actor.organizationId, status: "Active" },
      include: { modules: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const roles = assignableInvitationRoles(actor, roleAccess);
  const managedPermissions = canManageOrganization(actor.role)
    ? [...INVITATION_PERMISSIONS]
    : INVITATION_PERMISSIONS.filter((permission) => actorPermissions(actor).includes(permission));
  response.json({
    invitations: invitations.map(publicInvitation),
    statuses: INVITATION_STATUSES,
    deliveryStatuses: INVITATION_DELIVERY_STATUSES,
    capabilities: {
      canInvite: true,
      canInviteManagers: canManageOrganization(actor.role) || actorPermissions(actor).includes("staff.invite_managers"),
      canSelectBranches: canManageOrganization(actor.role) || canInviteAcrossBranches(actor),
      organizationManager: canManageOrganization(actor.role),
      roles,
      roleModules: Object.fromEntries(roles.map((role) => [role, roleAccess[role] || []])),
      permissions: managedPermissions.map((id) => ({ id, label: INVITATION_PERMISSION_LABELS[id] || id })),
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        enabledModules: enabledModulesForBranch(branch, roleAccess.Owner),
      })),
      invitationExpiryDays: invitationLifetimeDays,
    },
  });
}));

app.post("/api/invitations", invitationSendLimiter, asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  const email = normalizeEmail(requireText(request.body?.email, "Email"));
  if (!/^\S+@\S+\.\S+$/.test(email)) throw apiError("Enter a valid email address.");
  const input = await normalizeInvitationInput(actor, request.body);
  await expireInvitations();
  await assertUserPlanLimit(prisma, actor.organizationId, email);
  const account = await prisma.account.findUnique({
    where: { email },
    select: {
      id: true,
      organizationId: true,
      role: true,
      organizationWideAccess: true,
      branchMemberships: { where: { status: "Active" }, select: { branchId: true } },
    },
  });
  if (account) {
    if (account.organizationId !== actor.organizationId) throw apiError("This email cannot be invited to this organization.", 409);
    if (canManageOrganization(account.role) || account.organizationWideAccess) {
      throw apiError("This user already has organization-wide access.", 409);
    }
    const activeBranchIds = new Set(account.branchMemberships.map((membership) => membership.branchId));
    if (input.branches.every((branch) => activeBranchIds.has(branch.id))) {
      throw apiError("This user already has access to the selected branch. Choose another branch.", 409);
    }
  }
  const duplicate = await prisma.userInvitation.findFirst({
    where: { organizationId: actor.organizationId, email, status: "Pending" },
    include: invitationInclude,
  });
  if (duplicate) {
    throw apiError("A pending invitation already exists for this email. Open it to edit or resend it.", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.$transaction(async (tx) => {
    const saved = await tx.userInvitation.create({
      data: {
        organizationId: actor.organizationId,
        email,
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        branch: input.branch,
        department: input.department,
        specialty: input.specialty,
        position: input.position,
        modules: jsonText(input.modules, []),
        permissions: jsonText(input.permissions, []),
        message: input.message,
        tokenHash: sessionTokenHash(token),
        expiresAt: new Date(Date.now() + invitationLifetimeMs),
        invitedById: actor.id,
        branches: { create: input.branches.map((branch) => ({ branchId: branch.id })) },
      },
      include: invitationInclude,
    });
    await writeAudit(tx, request, {
      area: "Access",
      action: "Invitation created",
      branchId: input.branches[0]?.id || null,
      subjectType: "UserInvitation",
      subjectId: saved.id,
      details: `${email} invited as ${input.role}.`,
      afterValues: {
        email,
        name: input.name,
        role: input.role,
        branchIds: input.branches.map((branch) => branch.id),
        modules: input.modules,
        permissions: input.permissions,
        expiresAt: saved.expiresAt,
      },
    });
    return saved;
  });
  const delivery = await updateInvitationDelivery(request, invitation, token, actor, `You're invited to ${invitation.organization.name}`, "Invitation sent");
  response.status(201).json({
    invitation: publicInvitation(delivery.invitation),
    auditLog: delivery.auditLog,
    deliveryError: delivery.deliveryError,
  });
}));

app.patch("/api/invitations/:id", invitationSendLimiter, asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  await expireInvitations();
  const current = await prisma.userInvitation.findUnique({ where: { id: clean(request.params.id) }, include: invitationInclude });
  if (!current || !canManageInvitation(actor, current)) throw apiError("Invitation not found.", 404);
  if (current.status !== "Pending") throw apiError("Only a pending invitation can be edited.", 409);
  const input = await normalizeInvitationInput(actor, request.body, current);
  const before = publicInvitation(current);
  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.userInvitationBranch.deleteMany({ where: { invitationId: current.id } });
    const saved = await tx.userInvitation.update({
      where: { id: current.id },
      data: {
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        branch: input.branch,
        department: input.department,
        specialty: input.specialty,
        position: input.position,
        modules: jsonText(input.modules, []),
        permissions: jsonText(input.permissions, []),
        message: input.message,
        tokenHash: sessionTokenHash(token),
        expiresAt: new Date(Date.now() + invitationLifetimeMs),
        resentAt: new Date(),
        deliveryStatus: "Not Sent",
        failedReason: "",
        branches: { create: input.branches.map((branch) => ({ branchId: branch.id })) },
      },
      include: invitationInclude,
    });
    await writeAudit(tx, request, {
      area: "Access",
      action: "Invitation edited",
      branchId: input.branches[0]?.id || null,
      subjectType: "UserInvitation",
      subjectId: saved.id,
      details: `Pending invitation for ${saved.email} was edited and its previous link invalidated.`,
      beforeValues: before,
      afterValues: publicInvitation(saved),
    });
    return saved;
  });
  const delivery = await updateInvitationDelivery(request, invitation, token, actor, `Updated invitation to ${invitation.organization.name}`, "Invitation resent after edit");
  response.json({ invitation: publicInvitation(delivery.invitation), auditLog: delivery.auditLog, deliveryError: delivery.deliveryError });
}));

app.post("/api/invitations/:id/resend", invitationSendLimiter, asyncRoute(async (request, response) => {
  const actor = requireInvitationManager(request);
  await expireInvitations();
  const current = await prisma.userInvitation.findUnique({ where: { id: clean(request.params.id) }, include: invitationInclude });
  if (!current || !canManageInvitation(actor, current)) throw apiError("Invitation not found.", 404);
  if (!["Pending", "Expired"].includes(current.status)) throw apiError("This invitation cannot be resent.", 409);
  assertAssignableInvitationRole(actor, current.role, roleAccess);
  assertRequestedPermissions(actor, parseJsonList(current.permissions));
  assertRequestedModules(actor, current.role, parseJsonList(current.modules), current.branches.map((assignment) => assignment.branch), roleAccess);
  const conflicting = await prisma.userInvitation.findFirst({
    where: { organizationId: current.organizationId, email: current.email, status: "Pending", id: { not: current.id } },
  });
  if (conflicting) throw apiError("Another pending invitation already exists for this email.", 409);
  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.userInvitation.update({
    where: { id: current.id },
    data: {
      tokenHash: sessionTokenHash(token),
      status: "Pending",
      deliveryStatus: "Not Sent",
      expiresAt: new Date(Date.now() + invitationLifetimeMs),
      resentAt: new Date(),
      failedReason: "",
      revokedAt: null,
      revokedById: null,
    },
    include: invitationInclude,
  });
  const delivery = await updateInvitationDelivery(request, invitation, token, actor, `Reminder: your invitation to ${invitation.organization.name}`, "Invitation resent");
  response.json({ invitation: publicInvitation(delivery.invitation), auditLog: delivery.auditLog, deliveryError: delivery.deliveryError });
}));

async function cancelInvitation(request, response) {
  const actor = requireInvitationManager(request);
  await expireInvitations();
  const current = await prisma.userInvitation.findUnique({ where: { id: clean(request.params.id) }, include: invitationInclude });
  if (!current || !canManageInvitation(actor, current)) throw apiError("Invitation not found.", 404);
  if (current.status !== "Pending") throw apiError("Only a pending invitation can be cancelled.", 409);
  const result = await prisma.$transaction(async (tx) => {
    const revoked = await tx.userInvitation.updateMany({
      where: { id: current.id, status: "Pending", revokedAt: null },
      data: { status: "Revoked", revokedAt: new Date(), revokedById: actor.id },
    });
    if (revoked.count !== 1) throw apiError("This invitation is no longer pending.", 409);
    const invitation = await tx.userInvitation.findUnique({ where: { id: current.id }, include: invitationInclude });
    const auditLog = await writeAudit(tx, request, {
      area: "Access",
      action: "Invitation cancelled",
      branchId: invitation.branches[0]?.branchId || null,
      subjectType: "UserInvitation",
      subjectId: invitation.id,
      details: `${invitation.email} invitation cancelled and its link invalidated.`,
      beforeValues: { status: current.status },
      afterValues: { status: "Revoked", revokedAt: invitation.revokedAt },
    });
    if (canManageOrganization(invitation.role)) {
      const owners = await tx.account.findMany({
        where: { organizationId: invitation.organizationId, status: "Active", role: { in: organizationManagerRoles } },
        select: { id: true },
      });
      if (owners.length) {
        await createAppNotification(tx, {
          actor: actor.name,
          module: "staff",
          title: "Privileged invitation cancelled",
          message: `The ${invitation.role} invitation for ${invitation.email} was cancelled.`,
          recipientAccountIds: owners.map((owner) => owner.id),
          recordId: invitation.id,
        });
      }
    }
    return { invitation, auditLog };
  });
  response.json({ invitation: publicInvitation(result.invitation), auditLog: result.auditLog });
}

app.post("/api/invitations/:id/cancel", asyncRoute(cancelInvitation));
app.post("/api/invitations/:id/revoke", asyncRoute(cancelInvitation));

app.get("/api/invitations/accept/:token", asyncRoute(async (request, response) => {
  const tokenHash = sessionTokenHash(requireText(request.params.token, "Invitation token"));
  let invitation = await prisma.userInvitation.findUnique({ where: { tokenHash }, include: invitationInclude });
  if (!invitation) throw apiError("This invitation link is invalid.", 404);
  if (invitation.status === "Pending" && invitation.expiresAt <= new Date()) {
    await expireInvitations();
    invitation = await prisma.userInvitation.findUnique({ where: { id: invitation.id }, include: invitationInclude });
  }
  const account = await prisma.account.findUnique({ where: { email: invitation.email }, select: { id: true, organizationId: true } });
  response.json({
    invitation: publicInvitationSummary(invitation, account?.organizationId === invitation.organizationId),
    authenticatedEmail: request.authAccount?.email || "",
  });
}));

app.post("/api/invitations/accept/:token", asyncRoute(async (request, response) => {
  const tokenHash = sessionTokenHash(requireText(request.params.token, "Invitation token"));
  if (request.body?.termsAccepted !== true || request.body?.privacyAccepted !== true) {
    throw apiError("Accept the Terms of Service and Privacy Policy to continue.", 400);
  }
  const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash }, include: invitationInclude });
  if (!invitation) throw apiError("This invitation link is invalid.", 404);
  if (invitation.status === "Accepted") throw apiError("This invitation has already been accepted.", 409);
  if (invitation.status === "Revoked") throw apiError("This invitation was cancelled. Contact an administrator for a new invitation.", 410);
  if (invitation.status !== "Pending") throw apiError("This invitation is no longer available.", 409);
  if (invitation.expiresAt <= new Date()) {
    await expireInvitations();
    throw apiError("This invitation has expired.", 410);
  }
  const workspaceSubscription = await subscriptionContext(prisma, invitation.organizationId);
  if (!workspaceSubscription.accessAllowed) {
    throw apiError("This workspace subscription must be activated before invitations can be accepted.", 402, { code: "SUBSCRIPTION_REQUIRED" });
  }
  const existingAccount = await prisma.account.findUnique({ where: { email: invitation.email } });
  if (existingAccount && existingAccount.organizationId !== invitation.organizationId) {
    throw apiError("This invitation cannot be accepted with the available account.", 409);
  }
  if (request.authAccount && normalizeEmail(request.authAccount.email) !== invitation.email) {
    throw apiError("This invitation belongs to another email. Sign out and continue with the invited email.", 403);
  }
  if (existingAccount && request.authAccount?.id !== existingAccount.id) {
    throw apiError("Sign in with the invited email before accepting this invitation.", 401);
  }
  const password = existingAccount ? "" : requireText(request.body?.password, "Password");
  if (!existingAccount && (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))) {
    throw apiError("Use at least 12 characters with uppercase, lowercase, a number, and a symbol.");
  }
  const selectedBranches = invitation.branches.map((assignment) => assignment.branch);
  if (!canManageOrganization(invitation.role) && (!selectedBranches.length || selectedBranches.some((branch) => branch.status !== "Active"))) {
    throw apiError("One or more assigned branches are no longer active. Ask an administrator to update the invitation.", 409);
  }
  const invitationModules = assertRequestedModules(
    { role: "Owner", access: { modules: roleAccess.Owner } },
    invitation.role,
    parseJsonList(invitation.modules),
    selectedBranches,
    roleAccess,
  );
  const invitationPermissions = assertRequestedPermissions({ role: "Owner" }, parseJsonList(invitation.permissions));
  const result = await prisma.$transaction(async (tx) => {
    await assertUserPlanLimit(tx, invitation.organizationId, invitation.email);
    if (existingAccount) {
      const existingAssignment = await tx.branchMembership.findFirst({
        where: {
          accountId: existingAccount.id,
          branchId: { in: invitation.branches.map((assignment) => assignment.branchId) },
          status: "Active",
        },
        select: { id: true },
      });
      if (existingAssignment) {
        throw apiError("This account already has access to one of the invited branches.", 409);
      }
    }
    const acceptedClaim = await tx.userInvitation.updateMany({
      where: {
        id: invitation.id,
        tokenHash,
        status: "Pending",
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { status: "Accepted", acceptedAt: new Date(), termsAcceptedAt: new Date() },
    });
    if (acceptedClaim.count !== 1) throw apiError("This invitation is no longer available.", 409);
    const branchRecords = invitation.branches.length
      ? await tx.branch.findMany({ where: { id: { in: invitation.branches.map((item) => item.branchId) }, organizationId: invitation.organizationId, status: "Active" }, include: { modules: true } })
      : [];
    if (!canManageOrganization(invitation.role) && branchRecords.length !== invitation.branches.length) {
      throw apiError("An assigned branch is no longer active.", 409);
    }
    assertRequestedModules({ role: "Owner", access: { modules: roleAccess.Owner } }, invitation.role, invitationModules, branchRecords, roleAccess);
    let account = existingAccount;
    const primaryBranch = branchRecords[0] || null;
    if (!account) {
      const staff = primaryBranch
        ? await tx.staffMember.create({ data: { name: invitation.name, role: invitation.role, branch: primaryBranch.name, branches: JSON.stringify(branchRecords.map((branch) => branch.name)), status: "Available" } })
        : null;
      account = await tx.account.create({
        data: {
          staffId: staff?.id || null,
          name: invitation.name,
          email: invitation.email,
          passwordHash: hashPassword(password),
          role: invitation.role,
          branch: primaryBranch?.name || "",
          organizationId: invitation.organizationId,
          organizationWideAccess: canManageOrganization(invitation.role),
          organizationModules: canManageOrganization(invitation.role) ? jsonText(invitationModules, []) : "[]",
          lastBranchId: primaryBranch?.id || null,
          status: "Active",
          mustChangePassword: false,
        },
      });
    } else {
      account = await tx.account.update({
        where: { id: account.id },
        data: {
          lastBranchId: primaryBranch?.id || account.lastBranchId,
        },
      });
    }
    for (const branchRecord of branchRecords) {
      await tx.branchMembership.upsert({
        where: { branchId_accountId: { branchId: branchRecord.id, accountId: account.id } },
        create: {
          branchId: branchRecord.id,
          accountId: account.id,
          role: invitation.role,
          permissions: jsonText(invitationPermissions, []),
          modules: jsonText(invitationModules, []),
          isPrimary: !existingAccount && branchRecord.id === primaryBranch?.id,
        },
        update: {
          role: invitation.role,
          permissions: jsonText(invitationPermissions, []),
          modules: jsonText(invitationModules, []),
          status: "Active",
          isPrimary: !existingAccount && branchRecord.id === primaryBranch?.id,
        },
      });
    }
    const accepted = await tx.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedById: account.id },
      include: invitationInclude,
    });
    await tx.auditLog.create({ data: {
      time: new Date().toLocaleString("en-PH"),
      actor: account.name,
      role: invitation.role,
      actorAccountId: account.id,
      branchId: primaryBranch?.id || null,
      area: "Access",
      action: "Invitation accepted",
      subjectType: "Account",
      subjectId: account.id,
      details: `${invitation.email} joined ${invitation.organization.name}.`,
      afterValues: jsonText({ role: invitation.role, branchIds: branchRecords.map((branch) => branch.id), modules: invitationModules, permissions: invitationPermissions }, {}),
    } });
    const ownerRecipients = await tx.account.findMany({
      where: { organizationId: invitation.organizationId, status: "Active", role: { in: organizationManagerRoles } },
      select: { id: true },
    });
    const managerRecipients = branchRecords.length
      ? await tx.branchMembership.findMany({
        where: { branchId: { in: branchRecords.map((branch) => branch.id) }, status: "Active", role: { in: ["Branch Manager", "Admin"] } },
        select: { accountId: true },
      })
      : [];
    const recipientAccountIds = uniqueStrings([
      ...ownerRecipients.map((item) => item.id),
      ...managerRecipients.map((item) => item.accountId),
    ]).filter((id) => id !== account.id);
    if (recipientAccountIds.length) {
      await createAppNotification(tx, {
        actor: account.name,
        branches: branchRecords.map((branch) => branch.name),
        recipientAccountIds,
        module: "staff",
        recordId: account.id,
        title: `${invitation.role} invitation accepted`,
        message: `${account.name} accepted access to ${branchRecords.map((branch) => branch.name).join(", ") || invitation.organization.name}.`,
      });
    }
    return { account, invitation: accepted, primaryBranch };
  });
  const loadedAccount = await prisma.account.findUnique({ where: { id: result.account.id }, include: accountAccessInclude });
  response.json({
    account: publicAccount(loadedAccount, result.primaryBranch?.id || ALL_BRANCHES_ID),
    invitation: publicInvitation(result.invitation),
    redirectPath: result.primaryBranch ? `/?branch=${encodeURIComponent(result.primaryBranch.id)}` : "/",
  });
}));

function requireStaffLinkManager(request) {
  requireAuthenticatedAccount(request);
  const actor = actorFromRequest(request);
  const branchStaffManager = ["Branch Manager", "Admin"].includes(actor.role)
    && moduleAllowed(actor, "staff", roleAccess);
  if (!canManageOrganization(actor.role) && !branchStaffManager && !actor.access?.permissions?.includes("staff.manage")) {
    throw apiError("You do not have permission to manage employee login access.", 403);
  }
  return actor;
}

app.get("/api/accounts", asyncRoute(async (request, response) => {
  const actor = requireStaffLinkManager(request);
  const accounts = await prisma.account.findMany({
    where: canManageOrganization(actor.role)
      ? { organizationId: actor.organizationId }
      : { organizationId: actor.organizationId, branchMemberships: { some: { branchId: actor.access?.activeBranchId, status: "Active" } } },
    include: accountAccessInclude,
    orderBy: { name: "asc" },
  });
  response.json({ accounts: accounts.map((account) => publicAccount(account)) });
}));

function requireUserAccessManager(request) {
  requireAuthenticatedAccount(request);
  const actor = actorFromRequest(request);
  if (canManageOrganization(actor.role)) return actor;
  if (!isBranchManager(actor.role) || !actorPermissions(actor).includes("staff.manage")) {
    throw apiError("You do not have permission to manage user access.", 403);
  }
  return actor;
}

app.patch("/api/accounts/:id/access", asyncRoute(async (request, response) => {
  const actor = requireUserAccessManager(request);
  const target = await prisma.account.findFirst({
    where: { id: clean(request.params.id), organizationId: actor.organizationId },
    include: accountAccessInclude,
  });
  if (!target) throw apiError("User not found.", 404);
  if (!canManageOrganization(actor.role)) {
    if (target.id === actor.id) throw apiError("You cannot change your own role or branch access.", 403);
    if (canManageOrganization(target.role) || !target.branchMemberships.some((membership) => membership.branchId === actor.access?.activeBranchId && membership.status === "Active")) {
      throw apiError("This user belongs to another branch or has higher authority.", 403);
    }
  }

  const nextStatus = clean(request.body?.status || target.status);
  if (!["Active", "Inactive"].includes(nextStatus)) throw apiError("Choose Active or Inactive for user status.", 400);
  const nextRole = requireText(request.body?.role || target.role, "Role");
  assertAssignableInvitationRole(actor, nextRole, roleAccess);
  if (canManageOrganization(nextRole) && nextRole !== target.role) {
    assertPrivilegedConfirmation(actor, nextRole, request.body?.confirmOrganizationAccess === true);
  }
  const removesOrganizationManager = target.status === "Active"
    && canManageOrganization(target.role)
    && (nextStatus !== "Active" || !canManageOrganization(nextRole));
  if (removesOrganizationManager) {
    const activeManagers = await prisma.account.count({
      where: { organizationId: actor.organizationId, status: "Active", role: { in: organizationManagerRoles } },
    });
    if (activeManagers <= 1) throw apiError("The last active Owner or Super Admin cannot be deactivated or demoted.", 409);
  }

  const currentBranchIds = target.branchMemberships.filter((membership) => membership.status === "Active").map((membership) => membership.branchId);
  const suppliedBranchIds = request.body?.branchIds === undefined ? currentBranchIds : uniqueStrings(request.body.branchIds, 25);
  const branchPayload = { branchIds: suppliedBranchIds };
  const branches = await invitationBranches(actor, nextRole, branchPayload, target.branchMemberships);
  const branchChanged = JSON.stringify([...currentBranchIds].sort()) !== JSON.stringify(branches.map((branch) => branch.id).sort());
  if (branchChanged && request.body?.confirmAccessChange !== true) {
    throw apiError("Confirm the branch access change before saving.", 400);
  }
  const requestedPermissions = request.body?.permissions ?? (
    target.branchMemberships.find((membership) => membership.status === "Active")?.permissions
      ? parseJsonList(target.branchMemberships.find((membership) => membership.status === "Active").permissions)
      : []
  );
  const permissions = assertRequestedPermissions(actor, nextRole === "Admin"
    ? [...new Set([...requestedPermissions, ...BRANCH_ADMIN_REQUIRED_PERMISSIONS])]
    : requestedPermissions);
  const requestedModules = request.body?.modules ?? (() => {
    const stored = target.branchMemberships.find((membership) => membership.status === "Active")?.modules;
    return stored && parseJsonList(stored).length ? parseJsonList(stored) : undefined;
  })();
  const modules = assertRequestedModules(actor, nextRole, requestedModules, branches, roleAccess);
  if (!canManageOrganization(nextRole) && !modules.includes("pos")) {
    throw apiError("Branch users must retain POS access.", 400);
  }
  const primaryBranch = branches[0] || null;

  const result = await prisma.$transaction(async (tx) => {
    if (target.status !== "Active" && nextStatus === "Active") {
      await assertUserPlanLimit(tx, actor.organizationId, target.email);
    }
    if (canManageOrganization(nextRole)) {
      await tx.branchMembership.updateMany({ where: { accountId: target.id }, data: { status: "Inactive", isPrimary: false } });
    } else {
      const selectedIds = branches.map((branch) => branch.id);
      await tx.branchMembership.updateMany({
        where: { accountId: target.id, branchId: { notIn: selectedIds } },
        data: { status: "Inactive", isPrimary: false },
      });
      for (const branch of branches) {
        await tx.branchMembership.upsert({
          where: { branchId_accountId: { branchId: branch.id, accountId: target.id } },
          create: {
            branchId: branch.id,
            accountId: target.id,
            role: nextRole,
            permissions: jsonText(permissions, []),
            modules: jsonText(modules, []),
            status: nextStatus,
            isPrimary: branch.id === primaryBranch?.id,
          },
          update: {
            role: nextRole,
            permissions: jsonText(permissions, []),
            modules: jsonText(modules, []),
            status: nextStatus,
            isPrimary: branch.id === primaryBranch?.id,
          },
        });
      }
    }
    const saved = await tx.account.update({
      where: { id: target.id },
      data: {
        role: nextRole,
        status: nextStatus,
        organizationWideAccess: canManageOrganization(nextRole),
        organizationModules: canManageOrganization(nextRole) ? jsonText(modules, []) : "[]",
        branch: primaryBranch?.name || (canManageOrganization(nextRole) ? "" : target.branch),
        lastBranchId: primaryBranch?.id || null,
      },
    });
    if (target.staffId && primaryBranch) {
      await tx.staffMember.update({
        where: { id: target.staffId },
        data: { role: nextRole, branch: primaryBranch.name, status: nextStatus === "Active" ? "Available" : "Inactive" },
      });
    }
    if (nextStatus !== "Active") await tx.authSession.deleteMany({ where: { accountId: target.id } });

    const auditEntries = [];
    const baseAudit = {
      area: "Access",
      branchId: primaryBranch?.id || null,
      subjectType: "Account",
      subjectId: target.id,
    };
    if (target.role !== nextRole) auditEntries.push(await writeAudit(tx, request, {
      ...baseAudit,
      action: "Role changed",
      details: `${target.email} role changed from ${target.role} to ${nextRole}.`,
      beforeValues: { role: target.role },
      afterValues: { role: nextRole },
    }));
    if (branchChanged) auditEntries.push(await writeAudit(tx, request, {
      ...baseAudit,
      action: "Existing user assigned to branches",
      details: `${target.email} branch access was updated.`,
      beforeValues: { branchIds: currentBranchIds },
      afterValues: { branchIds: branches.map((branch) => branch.id) },
    }));
    const beforePermissions = parseJsonList(target.branchMemberships.find((membership) => membership.status === "Active")?.permissions);
    if (JSON.stringify(beforePermissions.sort()) !== JSON.stringify([...permissions].sort())) auditEntries.push(await writeAudit(tx, request, {
      ...baseAudit,
      action: "Permissions changed",
      details: `${target.email} permissions were updated.`,
      beforeValues: { permissions: beforePermissions },
      afterValues: { permissions },
    }));
    if (target.status !== nextStatus) auditEntries.push(await writeAudit(tx, request, {
      ...baseAudit,
      action: nextStatus === "Active" ? "User reactivated" : "User deactivated",
      details: `${target.email} was ${nextStatus === "Active" ? "reactivated" : "deactivated"}.`,
      beforeValues: { status: target.status },
      afterValues: { status: nextStatus },
    }));
    if (canManageOrganization(nextRole) && !canManageOrganization(target.role)) {
      const owners = await tx.account.findMany({
        where: { organizationId: actor.organizationId, status: "Active", role: { in: organizationManagerRoles } },
        select: { id: true },
      });
      if (owners.length) {
        await createAppNotification(tx, {
          actor: actor.name,
          module: "staff",
          title: "Organization-wide role granted",
          message: `${saved.name} was granted ${nextRole} access.`,
          recipientAccountIds: owners.map((owner) => owner.id),
          recordId: saved.id,
        });
      }
    }
    return { saved, auditEntries };
  });
  const reloaded = await prisma.account.findUnique({ where: { id: result.saved.id }, include: accountAccessInclude });
  response.json({ account: publicAccount(reloaded), auditLogs: result.auditEntries, auditLog: result.auditEntries[0] || null });
}));

app.put("/api/staff/:id/account", asyncRoute(async (request, response) => {
  const actor = requireStaffLinkManager(request);
  const staffId = clean(request.params.id);
  const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!staff) throw apiError("Staff profile not found.", 404);
  if (!canMutateBranch(actor, staff.branch || "All branches")) {
    throw apiError("This staff profile belongs to another branch.", 403);
  }
  const accountId = clean(request.body?.accountId);

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.account.findFirst({ where: { staffId } });
    if (current && isBusinessOwner(current.role) && !isBusinessOwner(actor.role)) {
      throw apiError("Only a Business Owner can change a Business Owner's login.", 403);
    }

    if (!accountId) {
      if (!current) throw apiError("This staff profile is not connected to a login.", 409);
      const cleared = await tx.account.update({ where: { id: current.id }, data: { staffId: null } });
      const auditLog = await writeAudit(tx, request, {
        area: "Access",
        action: "Login disconnected",
        details: `${cleared.email} disconnected from ${staff.name}.`,
      });
      return { account: cleared, auditLog };
    }

    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account) throw apiError("That login was not found.", 404);
    if (account.organizationId !== actor.organizationId) throw apiError("That login belongs to another organization.", 403);
    if (isBusinessOwner(account.role) && !isBusinessOwner(actor.role)) {
      throw apiError("Only a Business Owner can connect a Business Owner login.", 403);
    }
    if (account.staffId === staffId) throw apiError("That login is already connected to this staff profile.", 409);
    if (account.staffId) throw apiError("That login is already connected to another staff profile.", 409);
    if (current) throw apiError("This staff profile is already connected to another login.", 409);
    if (!accountMatchesStaffIdentity(account, staff)) {
      throw apiError("The login name and role must match the staff profile before they can be connected.", 409);
    }

    const staffBranchNames = [...new Set([staff.branch, ...parseJsonList(staff.branches)].filter(Boolean))];
    const staffBranches = await tx.branch.findMany({ where: { organizationId: actor.organizationId, name: { in: staffBranchNames }, status: "Active" } });
    const staffBranch = staffBranches.find((branch) => branch.name === staff.branch);
    if (!staffBranch || staffBranches.length !== staffBranchNames.length) throw apiError("One or more employee branches are not active.", 409);
    const linked = await tx.account.update({ where: { id: account.id }, data: { staffId, branch: staff.branch, lastBranchId: staffBranch.id } });
    for (const branch of staffBranches) {
      await tx.branchMembership.upsert({
        where: { branchId_accountId: { branchId: branch.id, accountId: account.id } },
        create: { branchId: branch.id, accountId: account.id, role: staff.role, isPrimary: branch.id === staffBranch.id },
        update: { role: staff.role, status: "Active", isPrimary: branch.id === staffBranch.id },
      });
    }
    const auditLog = await writeAudit(tx, request, {
      area: "Access",
      action: "Login connected",
      details: `${linked.email} connected to ${staff.name}.`,
    });
    return { account: linked, auditLog };
  });

  response.json({ account: publicAccount(result.account), staff, auditLog: result.auditLog });
}));

function attendanceState(events) {
  const lastType = events[0]?.type ?? "";
  if (!lastType || lastType === "CLOCK_OUT") return { status: "Clocked out", nextActions: ["CLOCK_IN"] };
  if (lastType === "CLOCK_IN" || lastType === "BREAK_END") return { status: "Clocked in", nextActions: ["BREAK_START", "CLOCK_OUT"] };
  return { status: "On break", nextActions: ["BREAK_END"] };
}

async function buildMyWorkspace(account) {
  const staff = account.staffId ? await prisma.staffMember.findUnique({ where: { id: account.staffId } }) : null;
  if (!staff || !accountMatchesStaffIdentity(account, staff)) {
    return {
      account: publicAccount(account),
      staff: null,
      connectionIssue: staff ? "IDENTITY_MISMATCH" : "NOT_CONNECTED",
      events: [],
      appointments: [],
      attendance: { status: "Unavailable", nextActions: [] },
    };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [events, appointments] = await Promise.all([
    prisma.attendanceEvent.findMany({ where: { staffId: staff.id, occurredAt: { gte: start, lt: end } }, orderBy: { occurredAt: "desc" } }),
    prisma.appointment.findMany({
      where: { staff: staff.name, branch: staff.branch, date: start.toISOString().slice(0, 10) },
      orderBy: { time: "asc" },
    }),
  ]);
  return { account: publicAccount(account), staff, events, appointments, attendance: attendanceState(events) };
}

app.get("/api/me/workspace", asyncRoute(async (request, response) => {
  response.json(await buildMyWorkspace(requireAuthenticatedAccount(request)));
}));

app.post("/api/me/active-branch", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  const requestedBranchId = requireText(request.body?.branchId, "Branch");
  if (requestedBranchId === ALL_BRANCHES_ID) {
    if (!request.authActor.access?.organizationWide) {
      throw apiError("All Branches is restricted to organization-wide accounts.", 403);
    }
  } else if (!request.authActor.access?.branches?.some((branch) => branch.id === requestedBranchId && branch.branchStatus === "Active")) {
    throw apiError("You do not have access to that active branch.", 403);
  }
  await prisma.account.update({
    where: { id: account.id },
    data: { lastBranchId: requestedBranchId === ALL_BRANCHES_ID ? null : requestedBranchId },
  });
  const reloaded = await prisma.account.findUnique({ where: { id: account.id }, include: accountAccessInclude });
  response.json({ account: await publicAccountWithSubscription(reloaded, requestedBranchId) });
}));

app.post("/api/me/attendance", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  if (!account.staffId) throw apiError("This account is not connected to a staff profile.", 409);
  const type = clean(request.body?.type).toUpperCase();
  const workspace = await buildMyWorkspace(account);
  if (!workspace.staff) throw apiError("This account is not connected to its matching staff profile.", 409);
  if (!workspace.attendance.nextActions.includes(type)) throw apiError("That attendance action is not valid right now.", 409);
  const event = await prisma.attendanceEvent.create({
    data: { staffId: account.staffId, accountId: account.id, type, branch: account.branch, note: clean(request.body?.note) },
  });
  const attendance = type === "CLOCK_OUT" ? "Clocked out" : type === "BREAK_START" ? "On break" : "Clocked in";
  await prisma.staffMember.update({ where: { id: account.staffId }, data: { attendance } });
  response.status(201).json({ event, workspace: await buildMyWorkspace(account) });
}));

function clinicDateTime(timeZone = "Asia/Manila") {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

async function upcomingRoomAppointments(branchName, roomName) {
  const now = clinicDateTime();
  const appointmentCandidates = await prisma.appointment.findMany({
    where: {
      branch: branchName,
      room: roomName,
      date: { gte: now.date },
      status: { in: databaseActiveAppointmentStatuses },
    },
    orderBy: [{ date: "asc" }, { time: "asc" }],
    select: { id: true, date: true, time: true, duration: true },
  });
  return appointmentCandidates.filter((appointment) => isUpcomingRoomAppointment(appointment, now));
}

function assertRoomManagementAllowed(request, branchName) {
  const account = requireAuthenticatedAccount(request);
  if (!canManageOrganization(account.role)) {
    throw apiError("Only an Admin or Business Owner can manage rooms.", 403);
  }
  return assertMutationAllowed(request, "room-view", branchName);
}

app.post("/api/rooms", asyncRoute(async (request, response) => {
  const branchId = requireText(request.body?.branchId, "Branch");
  const name = normalizeRoomName(request.body?.name);
  if (!name) throw apiError("Room name is required.", 400);

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { rooms: { orderBy: { createdAt: "asc" } } },
  });
  if (!branch) throw apiError("Branch not found.", 404);
  assertRoomManagementAllowed(request, branch.name);

  const matchingRoom = findRoomNameMatch(branch.rooms, name);
  if (matchingRoom && isActiveRoom(matchingRoom)) {
    throw apiError(`${name} already exists in ${branch.name}.`, 409);
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const room = matchingRoom
        ? await tx.room.update({
          where: { id: matchingRoom.id },
          data: { name, status: "Available" },
        })
        : await tx.room.create({ data: { name, branchId: branch.id, status: "Available" } });
      const auditLog = await writeAudit(tx, request, {
        area: "Rooms",
        action: matchingRoom ? "Room restored" : "Room created",
        details: `${room.name} is available for scheduling at ${branch.name}.`,
      });
      const updatedBranch = await tx.branch.findUnique({
        where: { id: branch.id },
        include: { rooms: { orderBy: { createdAt: "asc" } } },
      });
      return { room, branch: updatedBranch, auditLog };
    });
  } catch (error) {
    if (error?.code === "P2002") throw apiError(`${name} already exists in ${branch.name}.`, 409);
    throw error;
  }

  response.status(201).json({
    room: { ...result.room, branch: branch.name },
    branch: serializeBranch(result.branch),
    auditLog: result.auditLog,
  });
}));

app.delete("/api/rooms/:id", asyncRoute(async (request, response) => {
  const room = await prisma.room.findUnique({
    where: { id: clean(request.params.id) },
    include: { branch: true },
  });
  if (!room || !room.branch || !isActiveRoom(room)) throw apiError("Active room not found.", 404);
  assertRoomManagementAllowed(request, room.branch.name);

  const upcoming = await upcomingRoomAppointments(room.branch.name, room.name);
  if (upcoming.length) {
    const next = upcoming[0];
    throw apiError(
      `${room.name} has ${upcoming.length} upcoming appointment${upcoming.length === 1 ? "" : "s"}. Reassign or cancel ${next.date} at ${next.time} before deleting this room.`,
      409,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const archivedRoom = await tx.room.update({
      where: { id: room.id },
      data: { status: ARCHIVED_ROOM_STATUS },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Rooms",
      action: "Room archived",
      details: `${archivedRoom.name} was removed from active scheduling at ${room.branch.name}; historical records were preserved.`,
    });
    const branch = await tx.branch.findUnique({
      where: { id: room.branch.id },
      include: { rooms: { orderBy: { createdAt: "asc" } } },
    });
    return { archivedRoom, branch, auditLog };
  });

  response.json({
    room: { ...result.archivedRoom, branch: room.branch.name },
    branch: serializeBranch(result.branch),
    auditLog: result.auditLog,
  });
}));

const branchConfigModuleIds = sidebarModules
  .map((module) => module.id)
  .filter((moduleId) => !["my-workspace", "applications", "branches", "settings"].includes(moduleId));

function requireBranchAdministration(request) {
  const actor = actorFromRequest(request);
  if (!canManageOrganization(actor.role) && !hasOrganizationPermission(actor, "branches.manage")) {
    throw apiError("Only an Owner, Super Admin, or explicitly authorized organization administrator can manage branches.", 403);
  }
  return actor;
}

function normalizedBranchModules(value) {
  const requested = Array.isArray(value) ? value.map(String) : branchConfigModuleIds;
  const invalid = requested.filter((moduleId) => !branchConfigModuleIds.includes(moduleId));
  if (invalid.length) throw apiError(`Unknown branch module: ${invalid[0]}.`, 400);
  return [...new Set(requested)];
}

function normalizeBranchForm(payload, existing = null) {
  const name = requireText(payload?.name, "Branch name");
  const code = normalizeBranchCode(payload?.code || existing?.code || name);
  if (!code) throw apiError("Branch code must contain letters or numbers.", 400);
  const email = clean(payload?.email).toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw apiError("Enter a valid branch email address.", 400);
  const status = clean(payload?.status || existing?.status || "Active");
  if (!branchStatuses.includes(status)) throw apiError("Choose Active, Inactive, or Archived for branch status.", 400);
  return {
    name,
    code,
    city: clean(payload?.city),
    address: clean(payload?.address),
    phone: clean(payload?.phone),
    email,
    timezone: clean(payload?.timezone) || "Asia/Manila",
    hours: clean(payload?.hours),
    operatingHours: jsonText(payload?.operatingHours || {}, {}),
    couches: numberValue(payload?.couches ?? existing?.couches ?? 0, "Number of couches", { min: 0, integer: true }),
    status,
    archivedAt: status === "Archived" ? existing?.archivedAt || new Date() : null,
    devices: jsonText(payload?.devices || [], []),
    image: assetReference(payload?.image, "Branch image"),
  };
}

async function branchWithManagementData(database, branchId) {
  const branch = await database.branch.findUnique({
    where: { id: branchId },
    include: branchManagementInclude(),
  });
  if (!branch) return null;
  const employeeCount = await database.staffMember.count({ where: { branch: branch.name } });
  return { ...branch, employeeCount };
}

async function syncBranchManagers(database, branch, managerIds) {
  if (!Array.isArray(managerIds)) return;
  const uniqueIds = [...new Set(managerIds.map(String).filter(Boolean))];
  const accounts = uniqueIds.length
    ? await database.account.findMany({ where: { id: { in: uniqueIds }, organizationId: branch.organizationId, status: "Active" } })
    : [];
  if (accounts.length !== uniqueIds.length) throw apiError("One or more selected managers are unavailable in this organization.", 400);
  if (accounts.some((account) => canManageOrganization(account.role))) throw apiError("Organization-wide owners do not need branch manager assignments.", 400);
  await database.branchMembership.updateMany({
    where: { branchId: branch.id, role: { in: ["Branch Manager", "Admin"] }, accountId: { notIn: uniqueIds } },
    data: { status: "Inactive", isPrimary: false },
  });
  for (const account of accounts) {
    await database.branchMembership.upsert({
      where: { branchId_accountId: { branchId: branch.id, accountId: account.id } },
      create: { branchId: branch.id, accountId: account.id, role: "Branch Manager", permissions: jsonText(["staff.invite"], []), isPrimary: !account.lastBranchId },
      update: { role: "Branch Manager", status: "Active", permissions: jsonText(["staff.invite"], []) },
    });
  }
}

app.get("/api/branches", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "branches");
  const where = canManageOrganization(actor.role) || hasOrganizationPermission(actor, "branches.manage")
    ? { organizationId: actor.organizationId }
    : { id: { in: actor.access?.branches?.map((branch) => branch.id) || [] }, status: "Active" };
  const rows = await prisma.branch.findMany({ where, orderBy: [{ name: "asc" }], include: branchManagementInclude() });
  const counts = await Promise.all(rows.map((branch) => prisma.staffMember.count({ where: { branch: branch.name } })));
  response.json({ branches: rows.map((branch, index) => serializeBranch({ ...branch, employeeCount: counts[index] })) });
}));

app.post("/api/branches", asyncRoute(async (request, response) => {
  const actor = requireBranchAdministration(request);
  const data = normalizeBranchForm(request.body);
  const roomCount = Math.max(0, Math.min(50, Number(request.body?.roomCount) || 0));
  const enabledModules = normalizedBranchModules(request.body?.enabledModules);
  const duplicate = await prisma.branch.findFirst({
    where: { organizationId: actor.organizationId, OR: [{ name: data.name }, { code: data.code }] },
  });
  if (duplicate) throw apiError(duplicate.code === data.code ? `Branch code ${data.code} is already in use.` : `A branch named ${data.name} already exists.`, 409);
  const result = await prisma.$transaction(async (tx) => {
    await assertBranchPlanLimit(tx, actor.organizationId);
    const branch = await tx.branch.create({
      data: {
        ...data,
        organizationId: actor.organizationId,
        rooms: roomCount ? { create: Array.from({ length: roomCount }, (_value, index) => ({ name: `Room ${index + 1}` })) } : undefined,
        modules: { create: branchConfigModuleIds.map((moduleId) => ({ moduleId, enabled: enabledModules.includes(moduleId) })) },
      },
    });
    await syncBranchManagers(tx, branch, request.body?.managerIds);
    const auditLog = await writeAudit(tx, request, {
      area: "Branches",
      action: "Branch created",
      branchId: branch.id,
      subjectType: "Branch",
      subjectId: branch.id,
      details: `${branch.name} (${branch.code}) was created with ${roomCount} rooms.`,
      afterValues: { ...data, enabledModules, managerIds: request.body?.managerIds || [] },
    });
    return { branch: await branchWithManagementData(tx, branch.id), auditLog };
  });
  response.status(201).json({ branch: serializeBranch(result.branch), auditLog: result.auditLog });
}));

app.put("/api/branches/:id", asyncRoute(async (request, response) => {
  const actor = requireBranchAdministration(request);
  const id = clean(request.params.id);
  const existing = await prisma.branch.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: branchManagementInclude(),
  });
  if (!existing) throw apiError("Branch not found.", 404);
  const data = normalizeBranchForm(request.body, existing);
  if (existing.status === "Active" && data.status !== "Active") {
    const activeCount = await prisma.branch.count({ where: { organizationId: actor.organizationId, status: "Active" } });
    if (activeCount <= 1) throw apiError("The organization must keep at least one active branch.", 409);
  }
  const duplicate = await prisma.branch.findFirst({
    where: { organizationId: actor.organizationId, id: { not: id }, OR: [{ name: data.name }, { code: data.code }] },
  });
  if (duplicate) throw apiError(duplicate.code === data.code ? `Branch code ${data.code} is already in use.` : `A branch named ${data.name} already exists.`, 409);
  const roomCount = Math.max(0, Math.min(50, Number(request.body?.roomCount ?? activeRoomRecords(existing.rooms).length) || 0));
  const activeRooms = activeRoomRecords(existing.rooms);
  const roomsToArchive = roomCount < activeRooms.length ? activeRooms.slice(roomCount) : [];
  for (const room of roomsToArchive) {
    if ((await upcomingRoomAppointments(existing.name, room.name)).length) {
      throw apiError(`${room.name} has upcoming appointments. Reassign or cancel them before reducing the room count.`, 409);
    }
  }
  const result = await prisma.$transaction(async (tx) => {
    if (existing.status !== "Active" && data.status === "Active") {
      await assertBranchPlanLimit(tx, actor.organizationId);
    }
    await renameBranchReferences(tx, existing.name, data.name);
    if (roomCount > activeRooms.length) {
      const names = nextRoomNames(existing.rooms, roomCount - activeRooms.length);
      await tx.room.createMany({ data: names.map((name) => ({ name, branchId: id })) });
    } else if (roomsToArchive.length) {
      await tx.room.updateMany({ where: { id: { in: roomsToArchive.map((room) => room.id) } }, data: { status: ARCHIVED_ROOM_STATUS } });
    }
    const branch = await tx.branch.update({ where: { id }, data });
    if (Array.isArray(request.body?.enabledModules)) {
      const enabledModules = normalizedBranchModules(request.body.enabledModules);
      for (const moduleId of branchConfigModuleIds) {
        await tx.branchModule.upsert({
          where: { branchId_moduleId: { branchId: id, moduleId } },
          create: { branchId: id, moduleId, enabled: enabledModules.includes(moduleId) },
          update: { enabled: enabledModules.includes(moduleId) },
        });
      }
    }
    await syncBranchManagers(tx, branch, request.body?.managerIds);
    const auditLog = await writeAudit(tx, request, {
      area: "Branches",
      action: "Branch updated",
      branchId: id,
      subjectType: "Branch",
      subjectId: id,
      details: existing.name === branch.name ? `${branch.name} settings were updated.` : `${existing.name} was renamed to ${branch.name}; linked records were migrated.`,
      beforeValues: serializeBranch(existing),
      afterValues: { ...data, enabledModules: request.body?.enabledModules, managerIds: request.body?.managerIds },
    });
    return { branch: await branchWithManagementData(tx, id), auditLog };
  });
  response.json({ branch: serializeBranch(result.branch), previousName: existing.name, auditLog: result.auditLog });
}));

async function setBranchLifecycle(request, status) {
  const actor = requireBranchAdministration(request);
  if (!branchStatuses.includes(status)) throw apiError("Unsupported branch status.", 400);
  const id = clean(request.params.id);
  const existing = await prisma.branch.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!existing) throw apiError("Branch not found.", 404);
  if (status !== "Active" && existing.status === "Active") {
    const activeCount = await prisma.branch.count({ where: { organizationId: actor.organizationId, status: "Active" } });
    if (activeCount <= 1) throw apiError("The organization must keep at least one active branch.", 409);
  }
  const result = await prisma.$transaction(async (tx) => {
    if (existing.status !== "Active" && status === "Active") {
      await assertBranchPlanLimit(tx, actor.organizationId);
    }
    const branch = await tx.branch.update({
      where: { id },
      data: { status, archivedAt: status === "Archived" ? new Date() : null },
    });
    const action = status === "Archived" ? "Branch archived" : status === "Active" ? "Branch reactivated" : "Branch deactivated";
    const auditLog = await writeAudit(tx, request, {
      area: "Branches",
      action,
      branchId: id,
      subjectType: "Branch",
      subjectId: id,
      details: `${branch.name} is now ${status.toLowerCase()}; historical records were preserved.`,
      beforeValues: { status: existing.status, archivedAt: existing.archivedAt },
      afterValues: { status, archivedAt: branch.archivedAt },
    });
    return { branch: await branchWithManagementData(tx, id), auditLog };
  });
  return { branch: serializeBranch(result.branch), auditLog: result.auditLog };
}

app.post("/api/branches/:id/archive", asyncRoute(async (request, response) => response.json(await setBranchLifecycle(request, "Archived"))));
app.post("/api/branches/:id/reactivate", asyncRoute(async (request, response) => response.json(await setBranchLifecycle(request, "Active"))));
app.patch("/api/branches/:id/status", asyncRoute(async (request, response) => response.json(await setBranchLifecycle(request, requireText(request.body?.status, "Status")))));

app.put("/api/branches/:id/modules", asyncRoute(async (request, response) => {
  const actor = requireBranchAdministration(request);
  const id = clean(request.params.id);
  const branch = await prisma.branch.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!branch) throw apiError("Branch not found.", 404);
  const enabledModules = normalizedBranchModules(request.body?.enabledModules);
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.branchModule.findMany({ where: { branchId: id, enabled: true }, select: { moduleId: true } });
    for (const moduleId of branchConfigModuleIds) {
      await tx.branchModule.upsert({
        where: { branchId_moduleId: { branchId: id, moduleId } },
        create: { branchId: id, moduleId, enabled: enabledModules.includes(moduleId) },
        update: { enabled: enabledModules.includes(moduleId) },
      });
    }
    const auditLog = await writeAudit(tx, request, {
      area: "Branches",
      action: "Branch modules changed",
      branchId: id,
      subjectType: "Branch",
      subjectId: id,
      details: `${branch.name} now has ${enabledModules.length} enabled modules.`,
      beforeValues: { enabledModules: before.map((item) => item.moduleId) },
      afterValues: { enabledModules },
    });
    return { branch: await branchWithManagementData(tx, id), auditLog };
  });
  response.json({ branch: serializeBranch(result.branch), auditLog: result.auditLog });
}));

app.put("/api/branches/:id/memberships", asyncRoute(async (request, response) => {
  const actor = requireBranchAdministration(request);
  const id = clean(request.params.id);
  const branch = await prisma.branch.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!branch) throw apiError("Branch not found.", 404);
  const assignments = Array.isArray(request.body?.assignments) ? request.body.assignments : [];
  const accountIds = [...new Set(assignments.map((item) => clean(item.accountId)).filter(Boolean))];
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds }, organizationId: actor.organizationId } });
  if (accounts.length !== accountIds.length) throw apiError("One or more accounts are outside this organization.", 403);
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.branchMembership.findMany({ where: { branchId: id } });
    if (request.body?.replace === true) {
      await tx.branchMembership.updateMany({ where: { branchId: id, accountId: { notIn: accountIds } }, data: { status: "Inactive", isPrimary: false } });
    }
    for (const assignment of assignments) {
      const accountId = requireText(assignment.accountId, "Account");
      const role = requireText(assignment.role, "Branch role");
      if (!Object.hasOwn(roleAccess, role)) throw apiError(`Unsupported role: ${role}.`, 400);
      const permissions = parsePermissionList(assignment.permissions);
      if (assignment.isPrimary) await tx.branchMembership.updateMany({ where: { accountId }, data: { isPrimary: false } });
      await tx.branchMembership.upsert({
        where: { branchId_accountId: { branchId: id, accountId } },
        create: { branchId: id, accountId, role, permissions: jsonText(permissions, []), status: clean(assignment.status) || "Active", isPrimary: Boolean(assignment.isPrimary) },
        update: { role, permissions: jsonText(permissions, []), status: clean(assignment.status) || "Active", isPrimary: Boolean(assignment.isPrimary) },
      });
      if (assignment.isPrimary) {
        await tx.account.update({ where: { id: accountId }, data: { lastBranchId: id, branch: branch.name } });
      }
    }
    const auditLog = await writeAudit(tx, request, {
      area: "Branches",
      action: "Branch assignments changed",
      branchId: id,
      subjectType: "Branch",
      subjectId: id,
      details: `${branch.name} account assignments were updated.`,
      beforeValues: { assignments: before },
      afterValues: { assignments },
    });
    return { branch: await branchWithManagementData(tx, id), auditLog };
  });
  response.json({ branch: serializeBranch(result.branch), auditLog: result.auditLog });
}));

// Backward-compatible delete calls now archive. No branch or business record is
// permanently deleted through the application API.
app.delete("/api/branches/:id", asyncRoute(async (request, response) => {
  const branch = await prisma.branch.findUnique({ where: { id: clean(request.params.id) } });
  if (!branch) throw apiError("Branch not found.", 404);
  if (clean(request.body?.confirmationName) && clean(request.body.confirmationName) !== branch.name) {
    throw apiError(`Type ${branch.name} exactly to confirm archival.`, 400);
  }
  response.json(await setBranchLifecycle(request, "Archived"));
}));

app.post("/api/uploads", asyncRoute(async (request, response) => {
  const category = requireText(request.body?.category, "Upload category");
  const categoryAccess = uploadCategories[category];
  if (!categoryAccess) throw apiError("Unsupported upload category.", 400);
  if (category === "treatment-photo") throw apiError("Upload treatment photos from their treatment record.", 400);
  if (category === "flipbook-pdf") throw apiError("Upload PDFs from the Flipbooks workspace.", 400);
  const branch = requireText(request.body?.branch, "Upload branch");
  const actor = assertMutationAllowed(request, categoryAccess.writeModule, branch);
  const stored = await storeImageObject(request.body?.dataUrl, category);
  try {
    const asset = await prisma.uploadAsset.create({
      data: {
        ...stored,
        branch,
        uploadedById: actor.id,
        originalName: normalizeMarketingMediaName(request.body?.originalName),
      },
    });
    response.status(201).json({ asset: { ...asset, url: `/api/uploads/${asset.id}` } });
  } catch (error) {
    await deleteStoredAsset(stored).catch(() => {});
    throw error;
  }
}));

app.post("/api/treatments/:id/photos", asyncRoute(async (request, response) => {
  const treatmentId = clean(request.params.id);
  const treatment = await prisma.treatment.findUnique({
    where: { id: treatmentId },
  });
  if (!treatment) throw apiError("Treatment record not found.", 404);
  const branch = clean(treatment.branch) || "All branches";
  const actor = assertMutationAllowed(request, "treatments", branch);
  if (clean(treatment.consent).toLowerCase() !== "signed") {
    throw apiError("Client consent must be signed before treatment photos can be uploaded.", 409);
  }
  const kind = canonicalTreatmentPhotoKind(request.body?.kind);
  if (!kind) throw apiError(`Photo type must be ${treatmentPhotoKinds.join(", ")}.`, 400);

  const stored = await storeImageObject(request.body?.dataUrl, "treatment-photo");
  let auditLog;
  try {
    auditLog = await prisma.$transaction(async (tx) => {
      const asset = await tx.uploadAsset.create({
        data: { ...stored, branch, uploadedById: actor.id },
      });
      await tx.treatmentPhoto.create({
        data: { treatmentId, assetId: asset.id, kind },
      });
      const count = await tx.treatmentPhoto.count({ where: { treatmentId } });
      await tx.treatment.update({ where: { id: treatmentId }, data: { photos: count } });
      return writeAudit(tx, request, {
        area: "Treatment Records",
        action: "Treatment photo uploaded",
        details: `${kind} photo linked to ${treatment.client} - ${treatment.service}.`,
      });
    });
  } catch (error) {
    await deleteStoredAsset(stored).catch(() => {});
    throw error;
  }

  const record = await prisma.treatment.findUnique({ where: { id: treatmentId }, include: treatmentPhotoInclude });
  response.status(201).json({ record: serializeTreatment(record), auditLog });
}));

app.delete("/api/treatments/:id/photos/:photoId", asyncRoute(async (request, response) => {
  const treatmentId = clean(request.params.id);
  const photo = await prisma.treatmentPhoto.findFirst({
    where: { id: clean(request.params.photoId), treatmentId },
    include: {
      asset: true,
      treatment: true,
    },
  });
  if (!photo) throw apiError("Treatment photo not found.", 404);
  const branch = clean(photo.treatment.branch) || "All branches";
  const actor = assertMutationAllowed(request, "treatments", branch);
  if (actor.id !== photo.asset.uploadedById && !canManageOrganization(actor.role)) {
    throw apiError("Only the uploader or an organization administrator can remove this photo.", 403);
  }

  const deleted = await deleteStoredAsset(photo.asset);
  if (!deleted) throw apiError("Object storage could not remove the photo.", 502);

  const auditLog = await prisma.$transaction(async (tx) => {
    await tx.treatmentPhoto.delete({ where: { id: photo.id } });
    await tx.uploadAsset.delete({ where: { id: photo.assetId } });
    const count = await tx.treatmentPhoto.count({ where: { treatmentId } });
    await tx.treatment.update({ where: { id: treatmentId }, data: { photos: count } });
    return writeAudit(tx, request, {
      area: "Treatment Records",
      action: "Treatment photo removed",
      details: `${photo.kind} photo removed from ${photo.treatment.client} - ${photo.treatment.service}.`,
    });
  });

  const record = await prisma.treatment.findUnique({ where: { id: treatmentId }, include: treatmentPhotoInclude });
  response.json({ record: serializeTreatment(record), auditLog });
}));

app.get("/api/uploads/:id", asyncRoute(async (request, response) => {
  const asset = await prisma.uploadAsset.findUnique({ where: { id: clean(request.params.id) } });
  if (!asset) throw apiError("Uploaded asset was not found.", 404);
  const categoryAccess = uploadCategories[asset.category];
  if (!categoryAccess) throw apiError("Uploaded asset category is invalid.", 500);
  if (!categoryAccess.public) {
    const actor = categoryAccess.readModule
      ? assertReadAllowed(request, categoryAccess.readModule)
      : requireAuthenticatedAccount(request);
    if (!canAccessBranch(actor, asset.branch)) throw apiError("You do not have access to this uploaded asset.", 403);
  }
  const stored = await storedAssetRequest(asset);
  if (!stored.ok) throw apiError("Uploaded asset is unavailable.", stored.status === 404 ? 404 : 502);
  const buffer = Buffer.from(await stored.arrayBuffer());
  const privateClientImage = ["client-photo", "treatment-photo"].includes(asset.category);
  response.set({
    "Cache-Control": categoryAccess.public
      ? "public, max-age=31536000, immutable"
      : privateClientImage ? "private, no-store" : "private, max-age=300",
    "Content-Disposition": "inline",
    "Content-Length": String(buffer.length),
    "Content-Type": asset.mimeType,
  });
  response.send(buffer);
}));

app.get("/api/public/marketing-assets/:id", asyncRoute(async (request, response) => {
  const asset = await prisma.uploadAsset.findFirst({
    where: { id: clean(request.params.id), category: "marketing-image" },
  });
  if (!asset) throw apiError("Marketing image was not found.", 404);
  const stored = await storageRequest(asset.objectPath);
  if (!stored.ok) throw apiError("Marketing image is unavailable.", stored.status === 404 ? 404 : 502);
  const buffer = Buffer.from(await stored.arrayBuffer());
  response.set({
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Disposition": "inline",
    "Content-Length": String(buffer.length),
    "Content-Type": asset.mimeType,
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  response.send(buffer);
}));

app.delete("/api/uploads/:id", asyncRoute(async (request, response) => {
  const asset = await prisma.uploadAsset.findUnique({ where: { id: clean(request.params.id) } });
  if (!asset) throw apiError("Uploaded asset was not found.", 404);
  const categoryAccess = uploadCategories[asset.category];
  if (!categoryAccess) throw apiError("Uploaded asset category is invalid.", 500);
  if (asset.category === "treatment-photo") throw apiError("Remove treatment photos from their treatment record.", 409);
  const actor = assertMutationAllowed(request, categoryAccess.writeModule, asset.branch);
  if (actor.id !== asset.uploadedById && !canManageOrganization(actor.role)) {
    throw apiError("Only the uploader or an organization administrator can remove this asset.", 403);
  }
  if (asset.category === "marketing-image") {
    if (asset.deletedAt) throw apiError("Delete this image forever from Marketing Media > Deleted.", 409);
    await prisma.$transaction(async (tx) => {
      await tx.uploadAsset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
      await writeAudit(tx, request, {
        area: "Marketing",
        action: "Marketing image moved to Deleted",
        details: `${normalizeMarketingMediaName(asset.originalName) || "Marketing image"} moved to Deleted and can be restored.`,
      });
    });
    response.status(204).end();
    return;
  }
  const deleted = await deleteStoredAsset(asset);
  if (!deleted) throw apiError("Object storage could not remove the asset.", 502);
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

app.get("/api/notifications", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  response.json(await loadNotificationFeed(account, request.query.limit));
}));

app.post("/api/notifications/read", asyncRoute(async (request, response) => {
  const account = requireAuthenticatedAccount(request);
  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { notificationsReadAt: new Date() },
  });
  response.json(await loadNotificationFeed(updated, request.body?.limit));
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
  const account = requireAuthenticatedAccount(request);
  if (!canManageOrganization(account.role)) {
    throw apiError("Only an Owner or Super Admin can edit organization settings.", 403);
  }
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
    where: { lead: { is: branchWhere(actor) } },
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
  response.status(result.duplicateEvent || result.status === "Duplicate" ? 200 : 201).json({
    status: result.status,
    duplicateEvent: result.duplicateEvent,
    reference: result.event?.providerEventId || request.requestId,
  });
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
  const data = normalizeClientPayload(branchScopedPayload(request, request.body, resourceConfigs.clients));
  assertMutationAllowed(request, "clients", data.branch);
  const client = await prisma.client.create({ data });
  response.status(201).json(client);
}));

app.put("/api/clients/:id", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw apiError("Client not found.", 404);
  assertMutationAllowed(request, "clients", existing.branch);
  const data = normalizeClientPayload(branchScopedPayload(request, request.body, resourceConfigs.clients), id);
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

  const data = await config.normalize(branchScopedPayload(request, request.body, config));
  await assertResourceMutationAllowed(request, config, data);
  if (request.params.resource === "staff") assertStaffAccessMutation(request, data);
  if (config.beforeWrite) await config.beforeWrite(data);

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx[config.delegate].create({ data: stripMeta(data) });
    if (config.afterWrite) await config.afterWrite(tx, request, record, data, null);
    const auditLog = await writeAudit(tx, request, {
      area: config.area,
      action: `${config.area} created`,
      details: `${config.label(record)} created.`,
    });
    const notification = await writeResourceNotification(tx, request, config, record);
    return { record, auditLog, notification };
  });
  const responseRecord = await resourceRecordForResponse(config, result.record);

  response.status(201).json({
    ...result,
    record: config.serialize ? config.serialize(responseRecord) : responseRecord,
  });
}));

app.put("/api/resources/:resource/:id", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  if (config.readOnly) {
    throw apiError(`${request.params.resource} cannot be updated through the generic API.`, 405);
  }
  if (config.immutable) throw apiError(`${config.area} records are permanent after submission.`, 405);

  const id = String(request.params.id);
  const existing = await prisma[config.delegate].findUnique({ where: { id } });
  if (!existing) throw apiError(`${config.area} record not found.`, 404);
  if (request.params.resource === "campaigns" && existing.deletedAt) {
    throw apiError("Restore this campaign before editing it.", 409);
  }
  await assertResourceMutationAllowed(request, config, existing);
  const data = await config.normalize(branchScopedPayload(request, request.body, config), id);
  await assertResourceMutationAllowed(request, config, data);
  if (request.params.resource === "staff") assertStaffAccessMutation(request, data, existing);
  if (request.params.resource === "campaigns") {
    const comparableValue = (value) => value instanceof Date ? value.toISOString() : JSON.stringify(value ?? null);
    const changed = ["name", "branch", "segment", "channel", "templateId", "subject", "message", "html", "design", "scheduledAt", "managerApproval"]
      .some((field) => comparableValue(existing[field]) !== comparableValue(data[field]));
    const reopened = ["Scheduled", "Pending approval", "Sending"].includes(existing.status) && data.status === "Draft";
    if (changed || reopened) {
      Object.assign(data, {
        approvedAt: null,
        approvedById: "",
        deliveryStatus: "",
        lastDeliveryError: "",
        scheduledById: "",
        status: "Draft",
      });
    }
  }
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
  const responseRecord = await resourceRecordForResponse(config, result.record);

  response.json({
    ...result,
    record: config.serialize ? config.serialize(responseRecord) : responseRecord,
  });
}));

app.delete("/api/resources/:resource/:id", asyncRoute(async (request, response) => {
  const config = configForResource(request.params.resource);
  if (config.readOnly) {
    throw apiError(`${request.params.resource} cannot be deleted through the generic API.`, 405);
  }
  if (config.immutable) throw apiError(`${config.area} records cannot be deleted.`, 405);
  if (request.params.resource === "campaigns") {
    throw apiError("Use the Marketing Deleted page to remove campaigns safely.", 405);
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

app.get("/api/public-leads/config", asyncRoute(async (_request, response) => {
  const [settings, branchRows, serviceRows] = await Promise.all([
    getPersistedSettings(),
    prisma.branch.findMany({
      where: { status: "Active", modules: { some: { moduleId: { in: ["leads", "booking"] }, enabled: true } } },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, hours: true, operatingHours: true },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, category: true, serviceType: true, branches: true, duration: true, price: true, priceModel: true, priceUnit: true },
    }),
  ]);
  const publicServices = [];
  for (const service of serviceRows) {
    const key = clean(service.name).toLowerCase();
    const existing = publicServices.find((item) => clean(item.name).toLowerCase() === key);
    if (existing) {
      existing.branches = [...new Set([...existing.branches, ...parseJsonList(service.branches)])];
    } else {
      publicServices.push({
        id: service.id,
        name: service.name,
        category: service.category,
        serviceType: service.serviceType,
        branches: parseJsonList(service.branches),
        duration: service.duration,
        price: service.price,
        priceModel: service.priceModel,
        priceUnit: service.priceUnit,
      });
    }
  }

  response.json({
    company: visibleApplicationBrand(settings.company),
    tagline: settings.receiptFooter,
    branches: branchRows.map((branch) => ({ ...branch, operatingHours: parseJsonObject(branch.operatingHours, defaultOperatingHours) })),
    services: publicServices,
  });
}));

app.post("/api/public-leads", asyncRoute(async (request, response) => {
  const values = request.body ?? {};
  if (clean(values.clinicWebsite)) {
    response.status(202).json({ submitted: true, reference: request.requestId });
    return;
  }

  const name = boundedPublicText(values.fullName || values.name, "Full name", 120);
  if (name.length < 2) throw apiError("Full name is required.");
  const mobile = boundedPublicText(values.mobile, "Mobile number", 30);
  const email = boundedPublicText(values.email, "Email", 160).toLowerCase();
  if (!mobile && !email) throw apiError("Enter a mobile number or email so the clinic can respond.");
  if (mobile && !/^[+()0-9\s.-]{7,30}$/.test(mobile)) throw apiError("Enter a valid mobile number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw apiError("Enter a valid email address.");
  if (values.privacyConsent !== true) throw apiError("Consent is required before sending an inquiry.");

  const requestedBranch = boundedPublicText(values.branch, "Branch", 120);
  const branch = requestedBranch
    ? await prisma.branch.findFirst({ where: { name: requestedBranch, status: "Active", modules: { some: { moduleId: "leads", enabled: true } } }, select: { name: true } })
    : await prisma.branch.findFirst({ where: { status: "Active", modules: { some: { moduleId: "leads", enabled: true } } }, orderBy: [{ name: "asc" }], select: { name: true } });
  if (!branch) throw apiError(requestedBranch ? "Selected branch is unavailable." : "No clinic branch is available for inquiries.", requestedBranch ? 400 : 503);

  const requestedServiceId = boundedPublicText(values.serviceId, "Service", 120);
  const requestedInterest = boundedPublicText(values.interest, "Service interest", 160);
  const service = requestedServiceId
    ? await prisma.service.findFirst({ where: { id: requestedServiceId, active: true }, select: { name: true, branches: true } })
    : requestedInterest
      ? await prisma.service.findFirst({ where: { name: requestedInterest, active: true }, select: { name: true, branches: true } })
      : null;
  if (requestedServiceId && !service) throw apiError("Selected service is unavailable.");
  const serviceBranches = parseJsonList(service?.branches);
  if (service && serviceBranches.length && !serviceBranches.includes("All branches") && !serviceBranches.includes(branch.name)) {
    throw apiError("Selected service is unavailable at this branch.", 409);
  }

  const submittedAt = new Date().toISOString();
  const publicPayload = {
    full_name: name,
    phone_number: mobile,
    email_address: email,
    preferred_service: service?.name || requestedInterest || "General consultation",
    branch: branch.name,
    source: "Website",
    preferred_channel: boundedPublicText(values.preferredChannel, "Preferred contact method", 40) || (mobile ? "Phone" : "Email"),
    main_concern: boundedPublicText(values.concern, "Main concern", 1000),
    message: boundedPublicText(values.message, "Inquiry message", 1500),
    preferred_date: boundedPublicText(values.preferredDate, "Preferred date", 20),
    preferred_time: boundedPublicText(values.preferredTime, "Preferred time", 20),
    landing_page: boundedPublicText(values.landingPage, "Landing page", 500),
    referrer: boundedPublicText(values.referrerUrl, "Referrer", 500),
    utm_source: boundedPublicText(values.utmSource, "UTM source", 160),
    utm_medium: boundedPublicText(values.utmMedium, "UTM medium", 160),
    utm_campaign: boundedPublicText(values.utmCampaign, "UTM campaign", 160),
    utm_content: boundedPublicText(values.utmContent, "UTM content", 160),
    utm_term: boundedPublicText(values.utmTerm, "UTM term", 160),
    click_id: boundedPublicText(values.clickId, "Click ID", 240),
    form_id: "mace-public-inquiry-v1",
    external_lead_id: boundedPublicText(values.submissionId, "Submission ID", 120) || request.requestId,
    permission_to_contact: true,
    privacy_consent: true,
    marketing_consent: values.marketingConsent === true,
    consent_source: "Public inquiry form",
    consent_timestamp: submittedAt,
    consent_version: "v1",
    consent_text: "I consent to the collection and use of my information so ZenshoTech can respond to this inquiry.",
    submitted_at: submittedAt,
  };

  const originalBody = request.body;
  const originalRawBody = request.rawBody;
  request.body = publicPayload;
  request.rawBody = JSON.stringify(publicPayload);
  try {
    const result = await processLeadWebhook("website", request, { authMethod: "public-form", allowPayloadBranch: true });
    response.status(result.duplicateEvent ? 200 : 201).json({
      submitted: true,
      reference: result.event?.providerEventId || request.requestId,
    });
  } finally {
    request.body = originalBody;
    request.rawBody = originalRawBody;
  }
}));

app.get("/api/public-registration/qr", asyncRoute(async (request, response) => {
  const branchName = requireText(request.query.branch, "Branch");
  const branch = await prisma.branch.findFirst({ where: { name: branchName, status: "Active" }, select: { name: true } });
  if (!branch) throw apiError("Registration branch is unavailable.", 404);
  const configuredOrigin = clean(process.env.APP_ORIGIN).split(",")[0];
  const origin = configuredOrigin || `${request.protocol}://${request.get("host")}`.replace(/:3001$/, ":5173");
  const url = `${origin.replace(/\/$/, "")}/client-register?branch=${encodeURIComponent(branch.name)}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 320, color: { dark: "#1f2937", light: "#ffffff" } });
  response.type("image/svg+xml").set("Cache-Control", "public, max-age=300").send(svg);
}));

app.post("/api/public-registration", asyncRoute(async (request, response) => {
  const values = request.body ?? {};
  if (clean(values.clinicWebsite)) {
    response.status(202).json({ submitted: true });
    return;
  }
  if (values.privacyConsent !== true) throw apiError("Consent is required before registration.");
  const branch = await prisma.branch.findFirst({ where: { name: requireText(values.branch, "Branch"), status: "Active" } });
  if (!branch) throw apiError("Registration branch is unavailable.", 409);
  const firstName = requireText(values.firstName, "First name");
  const lastName = requireText(values.lastName, "Last name");
  const mobile = clean(values.mobile);
  const email = clean(values.email).toLowerCase();
  if (!mobile && !email) throw apiError("Enter a mobile number or email address.");
  const duplicateConditions = [mobile ? { mobile } : null, email ? { email } : null].filter(Boolean);
  const organizationBranches = await prisma.branch.findMany({ where: { organizationId: branch.organizationId }, select: { name: true } });
  const existing = duplicateConditions.length ? await prisma.client.findFirst({ where: { branch: { in: organizationBranches.map((item) => item.name) }, OR: duplicateConditions } }) : null;
  const data = normalizeClientPayload({
    ...(existing || {}),
    ...values,
    firstName,
    lastName,
    fullName: [firstName, clean(values.middleName), lastName].filter(Boolean).join(" "),
    mobile,
    email,
    branch: existing?.branch || branch.name,
    branchesVisited: [...new Set([...parseJsonList(existing?.branchesVisited), branch.name])],
    source: existing?.source || "QR Registration",
    consentStatus: "Pending",
    marketingOptIn: values.marketingOptIn === true,
  }, existing?.id || "");
  const result = await prisma.$transaction(async (tx) => {
    const client = existing
      ? await tx.client.update({ where: { id: existing.id }, data })
      : await tx.client.create({ data });
    const auditLog = await tx.auditLog.create({ data: { time: new Date().toLocaleString("en-PH"), actor: "Client QR Registration", role: "Public", area: "Client Records", action: existing ? "Client QR profile updated" : "Client QR profile created", details: `${client.fullName} submitted registration for ${branch.name}.` } });
    await createAppNotification(tx, { actor: "Client QR Registration", branches: [branch.name], message: `${client.fullName} submitted a ${existing ? "profile update" : "new registration"}.`, module: "clients", recordId: client.id, title: existing ? "Client registration updated" : "New QR client registration" });
    return { client, auditLog };
  });
  response.status(existing ? 200 : 201).json({ submitted: true, clientId: result.client.id, updated: Boolean(existing) });
}));

app.post("/api/public-bookings", asyncRoute(async (request, response) => {
  const booking = normalizePublicBookingRequest(request.body ?? {});
  if (booking.spam) {
    response.status(202).json({ submitted: true, bookingReference: request.requestId });
    return;
  }
  const mobile = normalizePhone(booking.mobile);
  const service = await prisma.service.findUnique({ where: { id: booking.serviceId } });
  if (!service || !service.active) {
    throw apiError("Selected service is unavailable.", 404);
  }
  const branch = await prisma.branch.findFirst({ where: { name: booking.branch, status: "Active", modules: { some: { moduleId: "booking", enabled: true } } }, include: { rooms: true } });
  if (!branch) throw apiError("Selected branch is unavailable.", 404);
  const serviceBranches = parseJsonList(service.branches);
  if (serviceBranches.length && !serviceBranches.includes(booking.branch) && !serviceBranches.includes("All branches")) {
    throw apiError("Selected service is not offered at this branch.", 409);
  }
  const publicBookingKey = `public_${createHash("sha256").update(booking.submissionId).digest("hex")}`;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`public-booking:${booking.branch}:${booking.date}`}))`;
    const replay = await tx.appointment.findUnique({ where: { publicBookingKey } });
    if (replay) return { appointment: replay, replayed: true };

    const staffCandidates = await tx.staffMember.findMany({ where: { status: { not: "Inactive" } } });
    const staffCapacity = staffCandidates.filter((staffMember) =>
      staffMember.branch === booking.branch || parseJsonList(staffMember.branches).includes(booking.branch)).length;
    const roomCapacity = activeRoomRecords(branch.rooms).length;
    const physicalCapacity = roomCapacity + Number(branch.couches || 0);
    const capacitySignals = [staffCapacity, physicalCapacity].filter((value) => value > 0);
    const unassignedCapacity = capacitySignals.length ? Math.min(...capacitySignals) : 1;

    const appointmentData = {
      date: booking.date,
      time: booking.time,
      clientId: null,
      client: booking.fullName,
      serviceId: booking.serviceId,
      service: service.name,
      branch: booking.branch,
      room: "To assign",
      staff: "Any available",
      status: "Pending Confirmation",
      deposit: 0,
      notes: booking.concern,
      internalNotes: "Created from public online booking.",
      publicBookingKey,
    };
    appointmentData.duration = await appointmentDurationFor(appointmentData, tx);
    await assertAppointmentSlotAvailable(appointmentData, "", { database: tx, unassignedCapacity });

    const lead = await tx.lead.create({
      data: {
        name: booking.fullName,
        mobile,
        email: booking.email,
        source: "Online Booking",
        firstTouchSource: "Online Booking",
        latestTouchSource: "Online Booking",
        formId: "mace-public-booking-v1",
        interest: service.name,
        concern: booking.concern,
        status: "New Inquiry",
        owner: "Front Desk",
        branch: appointmentData.branch,
        assignedBranch: appointmentData.branch,
        created: new Date().toISOString().slice(0, 10),
        nextStep: "Confirm online request",
        nextAction: "Confirm online request",
        preferredDate: appointmentData.date,
        preferredTime: appointmentData.time,
        preferredChannel: "Phone",
        permissionToContact: true,
        marketingConsent: booking.marketingConsent,
        privacyConsent: true,
        consentSource: "Online booking",
        consentTimestamp: new Date().toISOString(),
        consentVersion: "v1",
        consentText: "I consent to the collection and use of my information to request this appointment.",
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

    await createAppNotification(tx, {
      actor: "Online Booking",
      branches: [appointment.branch],
      message: `${appointment.client} requested ${appointment.service} on ${appointment.date} at ${appointment.time}.`,
      module: "appointments",
      recordId: appointment.id,
      title: "New online booking",
    });

    return { lead: linkedLead, appointment, auditLog, replayed: false };
  });

  response.status(result.replayed ? 200 : 201).json({
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

app.post("/api/inventory/import", asyncRoute(async (request, response) => {
  const inputRecords = Array.isArray(request.body?.records) ? request.body.records : [];
  if (!inputRecords.length) throw apiError("The CSV does not contain any inventory rows.", 400);
  if (inputRecords.length > 500) throw apiError("Import up to 500 inventory rows at a time.", 400);

  const config = resourceConfigs.inventory;
  const scopedRecords = [];
  const seenIds = new Set();
  const seenItems = new Set();
  for (let index = 0; index < inputRecords.length; index += 1) {
    const rowNumber = index + 2;
    const scoped = branchScopedPayload(request, inputRecords[index], config);
    const idKey = clean(scoped.id).toLowerCase();
    const itemKey = `${clean(scoped.item).toLowerCase()}|${clean(scoped.branch).toLowerCase()}`;
    if (idKey && seenIds.has(idKey)) throw apiError(`Row ${rowNumber}: duplicate Inventory ID.`, 400);
    if (itemKey !== "|" && seenItems.has(itemKey)) throw apiError(`Row ${rowNumber}: duplicate Item and Branch.`, 400);
    if (idKey) seenIds.add(idKey);
    if (itemKey !== "|") seenItems.add(itemKey);
    scopedRecords.push({ rowNumber, scoped });
  }

  const result = await prisma.$transaction(async (tx) => {
    const records = [];
    let created = 0;
    let updated = 0;

    for (const { rowNumber, scoped } of scopedRecords) {
      try {
        const requestedId = clean(scoped.id);
        let existing = requestedId
          ? await tx.inventoryItem.findUnique({ where: { id: requestedId } })
          : null;
        if (!existing) {
          existing = await tx.inventoryItem.findFirst({
            where: {
              item: { equals: requireText(scoped.item, "Product or consumable"), mode: "insensitive" },
              branch: clean(scoped.branch),
            },
          });
        }

        if (existing) await assertResourceMutationAllowed(request, config, existing);
        const data = normalizeInventoryPayload(existing ? { ...existing, ...scoped } : scoped, existing?.id || "");
        await assertResourceMutationAllowed(request, config, data);
        const record = existing
          ? await tx.inventoryItem.update({ where: { id: existing.id }, data: stripMeta(data) })
          : await tx.inventoryItem.create({ data: stripMeta(data) });
        records.push(record);
        if (existing) updated += 1;
        else created += 1;
      } catch (error) {
        throw apiError(`Row ${rowNumber}: ${error.message || "Invalid inventory data."}`, error.status || 400);
      }
    }

    const auditLog = await writeAudit(tx, request, {
      area: "Inventory",
      action: "Inventory CSV imported",
      details: `${created} inventory item${created === 1 ? "" : "s"} created and ${updated} updated from CSV.`,
    });
    return { records, created, updated, auditLog };
  });

  response.status(201).json(result);
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
  const actor = actorFromRequest(request);

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
        user: actor.name,
        supplier: clean(request.body?.supplier),
        receivedBy: clean(request.body?.receivedBy) || actor.name,
        checkNumber: clean(request.body?.checkNumber),
        unit: clean(request.body?.unit) || item.unit,
        notes: clean(request.body?.notes),
      },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Inventory",
      action: "Stock movement posted",
      details: `${item.item}: ${qty} ${clean(request.body?.unit) || item.unit}${clean(request.body?.supplier) ? ` from ${clean(request.body.supplier)}` : ""}.`,
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

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.clinicPackage.findUnique({ where: { id } });
    assertPackageRedeemable(current);
    const redeemed = await tx.clinicPackage.updateMany({
      where: { id, used: current.used, status: current.status },
      data: {
        used: { increment: 1 },
        sessionHistory: jsonText([
          ...parseJsonList(current.sessionHistory),
          { date: clean(request.body?.date) || new Date().toISOString().slice(0, 10), branch: clean(request.body?.branch) || current.branch, sessions: 1, service: clean(request.body?.service), provider: clean(request.body?.provider) },
        ], []),
      },
    });
    if (redeemed.count !== 1) throw apiError(`Package ${current.name} changed while it was being redeemed. Try again.`, 409);
    let record = await tx.clinicPackage.findUnique({ where: { id } });
    if (Number(record.used || 0) >= Number(record.sessions || 0)) {
      record = await tx.clinicPackage.update({ where: { id }, data: { status: "Completed" } });
    }
    const auditLog = await writeAudit(tx, request, {
      area: "Packages",
      action: "Package session redeemed",
      details: `${current.name} redeemed for ${current.client}.`,
    });
    return { record, auditLog };
  });

  response.json(result);
}));

app.post("/api/packages/:id/payments", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const pkg = await prisma.clinicPackage.findUnique({ where: { id } });
  if (!pkg) throw apiError("Package not found.", 404);

  assertMutationAllowed(request, "packages", pkg.branch);
  const actor = actorFromRequest(request);
  const amount = numberValue(request.body?.amount, "Installment amount", { min: 0.01 });
  const date = clean(request.body?.date) || posCalendarDate();
  const method = requireText(request.body?.method, "Payment method");
  const referenceNumber = createSystemPaymentReference("PKG", date);
  const nextPayment = clean(request.body?.nextPayment);
  const notes = clean(request.body?.notes);
  const today = posCalendarDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date > today) {
    throw apiError("Choose a valid payment date that is not in the future.");
  }
  if (nextPayment && (!/^\d{4}-\d{2}-\d{2}$/.test(nextPayment) || Number.isNaN(Date.parse(`${nextPayment}T00:00:00Z`)))) {
    throw apiError("Choose a valid next payment date.");
  }
  const settings = await getPersistedSettings();
  const allowedMethods = new Set(normalizePaymentMethods(settings.paymentMethods).filter((entry) => entry.active).map((entry) => entry.name));
  if (!allowedMethods.has(method) || ["Package", "Gift Certificate", "Salary Deduction"].includes(method)) {
    throw apiError(`${method} cannot be used to record a package installment.`, 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.clinicPackage.findUnique({ where: { id } });
    const outstanding = Math.max(0, Number(current.price || 0) - Number(current.amountPaid || 0));
    if (outstanding <= 0) throw apiError(`${current.name} is already fully paid.`, 409);
    if (amount > outstanding) throw apiError(`Installment cannot exceed the outstanding balance of ${outstanding}.`);

    const paymentId = randomBytes(12).toString("hex");
    const historyEntry = {
      id: paymentId,
      date,
      amount,
      method,
      referenceNumber,
      ...(notes ? { notes } : {}),
      receivedBy: actor.name,
    };
    const fullyPaid = amount >= outstanding;
    const updated = await tx.clinicPackage.updateMany({
      where: { id, amountPaid: current.amountPaid },
      data: {
        amountPaid: { increment: amount },
        nextPayment: fullyPaid ? "" : nextPayment,
        paymentHistory: jsonText([...parseJsonList(current.paymentHistory), historyEntry], []),
      },
    });
    if (updated.count !== 1) throw apiError(`${current.name} changed while the installment was being recorded. Try again.`, 409);

    let sale = null;
    if (current.sourceSaleId) {
      const sourceSale = await tx.sale.findUnique({ where: { id: current.sourceSaleId } });
      if (sourceSale && sourceSale.status !== "Void") {
        const payments = parseJsonList(sourceSale.payments);
        payments.push({ id: paymentId, method, amount, referenceNumber, packageInstallmentId: current.id });
        const collected = payments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
        sale = await tx.sale.update({
          where: { id: sourceSale.id },
          data: {
            payments: jsonText(payments, []),
            status: collected >= Number(sourceSale.total || 0) ? "Paid" : collected > 0 ? "Partially Paid" : "Unpaid",
          },
          include: { items: true },
        });
      }
    }

    let client = null;
    if (current.clientId && sale) {
      const existingClient = await tx.client.findUnique({ where: { id: current.clientId } });
      if (existingClient) {
        client = await tx.client.update({
          where: { id: existingClient.id },
          data: { balance: Math.max(0, Number(existingClient.balance || 0) - amount) },
        });
      }
    }

    const record = await tx.clinicPackage.findUnique({ where: { id } });
    const auditLog = await writeAudit(tx, request, {
      area: "Packages",
      action: "Package installment recorded",
      details: `${amount} received for ${record.name} from ${record.client} via ${method}.${fullyPaid ? " Package is fully paid." : ` Remaining balance ${Math.max(0, Number(record.price || 0) - Number(record.amountPaid || 0))}.`}`,
    });
    return {
      record: serializePackage(record),
      sale: sale ? serializeSale(sale) : null,
      client: client ? serializeClient(client) : null,
      auditLog,
    };
  });

  response.status(201).json(result);
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
  const lockedPayrollSource = await prisma.$transaction(async (tx) => {
    const [commission, deduction] = await Promise.all([
      tx.payrollCommissionEarning.findFirst({ where: { saleId: sale.id, status: "Included" }, select: { id: true } }),
      tx.payrollSalaryDeduction.findFirst({ where: { saleId: sale.id, status: "Included" }, select: { id: true } }),
    ]);
    return Boolean(commission || deduction);
  });
  if (lockedPayrollSource) {
    throw apiError("This transaction is included in finalized payroll and can no longer be voided. Reverse it through a later payroll adjustment.", 409);
  }

  const actor = actorFromRequest(request);
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.sale.updateMany({ where: { id, status: { not: "Void" } }, data: { status: "Void" } });
    if (claimed.count !== 1) throw apiError("This transaction was already voided.", 409);
    const record = await tx.sale.findUnique({ where: { id }, include: { items: true } });
    const issuedPackages = await tx.clinicPackage.findMany({ where: { sourceSaleId: sale.id } });
    if (issuedPackages.some((pkg) => Number(pkg.used || 0) > 0)) {
      throw apiError("This package sale already has redeemed sessions and cannot be voided until those sessions are reversed.", 409);
    }

    const saleMovements = await tx.inventoryMovement.findMany({ where: { reason: `Sold on ${sale.invoice}` } });
    const reversalMovements = [];
    for (const movement of saleMovements) {
      if (!movement.itemId) continue;
      const item = await tx.inventoryItem.findFirst({ where: inventoryWhereForBranch(movement.itemId, sale.branch) });
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
    let updatedClient = null;
    if (sale.clientId && !sale.testMode) {
      const paid = salePayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
      const outstanding = Math.max(0, Number(sale.total || 0) - paid);
      const client = await tx.client.findUnique({ where: { id: sale.clientId } });
      if (client && outstanding > 0) {
        updatedClient = await tx.client.update({
          where: { id: client.id },
          data: { balance: Math.max(0, Number(client.balance || 0) - outstanding) },
        });
      }
    }
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
          balance: { increment: amount },
          status: "Active",
          redeemedDate: "",
          redeemedBranch: "",
          transactionId: "",
        },
      }));
    }
    const restoredPackages = [];
    for (const [packageId, sessions] of packageRestores) {
      const pkg = await tx.clinicPackage.findUnique({ where: { id: packageId } });
      if (!pkg) continue;
      const restored = await tx.clinicPackage.updateMany({
        where: { id: packageId, used: { gte: sessions } },
        data: {
          used: { decrement: sessions },
          status: "Active",
          sessionHistory: jsonText([...parseJsonList(pkg.sessionHistory), { date: new Date().toISOString().slice(0, 10), branch: sale.branch, sessions: -sessions, note: `Void of ${sale.invoice}` }], []),
        },
      });
      if (restored.count === 1) restoredPackages.push(await tx.clinicPackage.findUnique({ where: { id: packageId } }));
    }
    const cancelledIssuedPackages = [];
    for (const pkg of issuedPackages) {
      const cancelled = await tx.clinicPackage.updateMany({
        where: { id: pkg.id, used: 0, status: { not: "Cancelled" } },
        data: { status: "Cancelled" },
      });
      if (cancelled.count === 1) cancelledIssuedPackages.push(await tx.clinicPackage.findUnique({ where: { id: pkg.id } }));
    }

    const reversalNotes = [
      ...(reversalMovements.length ? [`${reversalMovements.length} stock movement(s) reversed`] : []),
      ...restoredCertificates.map((certificate) => `GC ${certificate.code} restored to ${certificate.balance}`),
      ...restoredPackages.map((pkg) => `${pkg.name} back to ${pkg.used}/${pkg.sessions} sessions`),
      ...cancelledIssuedPackages.map((pkg) => `${pkg.name} issued sessions cancelled`),
    ];
    const [reversedCommissionEarnings, reversedSalaryDeductions] = await Promise.all([
      tx.payrollCommissionEarning.updateMany({
        where: { saleId: sale.id, status: "Pending" },
        data: { status: "Reversed", payrollLineId: null },
      }),
      tx.payrollSalaryDeduction.updateMany({
        where: { saleId: sale.id, status: "Pending" },
        data: { status: "Reversed", payrollLineId: null },
      }),
    ]);
    if (reversedCommissionEarnings.count) reversalNotes.push(`${reversedCommissionEarnings.count} pending payroll commission(s) reversed`);
    if (reversedSalaryDeductions.count) reversalNotes.push(`${reversedSalaryDeductions.count} pending salary deduction(s) reversed`);
    const auditLog = await writeAudit(tx, request, {
      area: "POS",
      action: "Transaction voided",
      details: `${sale.invoice} marked void.${reversalNotes.length ? ` ${reversalNotes.join("; ")}.` : ""}`,
    });

    return {
      record: serializeSale(record),
      movements: reversalMovements,
      inventory: reversalMovements.length ? await tx.inventoryItem.findMany({
        where: { OR: [{ branch: sale.branch }, { branch: "All branches" }] },
        orderBy: [{ item: "asc" }],
      }) : null,
      giftCertificates: restoredCertificates,
      packages: [...restoredPackages, ...cancelledIssuedPackages].map(serializePackage),
      client: updatedClient ? serializeClient(updatedClient) : null,
      auditLog,
    };
  });

  response.json(result);
}));

app.delete("/api/transactions/:id/test", asyncRoute(async (request, response) => {
  const actor = actorFromRequest(request);
  if (!isAdmin(actor.role)) throw apiError("Only Super Admin can reset test transactions.", 403);
  const id = clean(request.params.id);
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale || !sale.testMode) throw apiError("Test transaction not found.", 404);
  const auditLog = await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id } });
    return writeAudit(tx, request, {
      area: "POS",
      action: "POS test transaction reset",
      details: `${sale.invoice} was permanently removed from the isolated test ledger.`,
      subjectType: "Sale",
      subjectId: sale.id,
      beforeValues: serializeSale(sale),
    });
  });
  response.json({ id, auditLog });
}));

function normalizePosCartPayload(payload, actor, existing = null) {
  const branch = requireText(payload?.branch || existing?.branch, "Branch");
  const items = Array.isArray(payload?.items) ? payload.items : parseJsonList(existing?.items);
  if (items.length > 100) throw apiError("A POS cart can contain at most 100 service or product lines.");
  const today = posCalendarDate();
  const saleDate = clean(payload?.saleDate || existing?.saleDate) || today;
  if (saleDate && !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) throw apiError("Choose a valid transaction date.");
  if (saleDate > today) throw apiError("Future-dated POS transactions are not allowed.");
  if (saleDate !== today && !canManageOrganization(actor.role)) throw apiError("Only an Owner or Super Admin can prepare a historical transaction.", 403);
  const testMode = payload?.testMode === undefined ? Boolean(existing?.testMode) : payload.testMode === true;
  if (testMode && !isAdmin(actor.role)) throw apiError("Only Super Admin can use POS Test Mode.", 403);
  const discountId = clean(payload?.discountId);
  const manualDiscount = normalizeManualDiscount({
    type: payload?.manualDiscountType ?? existing?.manualDiscountType,
    value: payload?.manualDiscountValue ?? existing?.manualDiscountValue,
    scope: payload?.manualDiscountScope ?? existing?.manualDiscountScope,
    targetKey: payload?.manualDiscountTargetKey ?? existing?.manualDiscountTargetKey,
  });
  if (discountId && manualDiscount) throw apiError("Choose either a saved discount rule or a manual discount, not both.");
  if (manualDiscount?.scope === "Service") {
    const discountedServiceLines = items.filter((item) => clean(item?.type) === "Service" && clean(item?.key) === manualDiscount.targetKey);
    if (discountedServiceLines.length !== 1) throw apiError("Choose one valid service line for the manual discount.");
  }
  return {
    clientId: clean(payload?.clientId),
    client: clean(payload?.client) || "Walk-in",
    branch,
    staff: clean(payload?.staff),
    items: JSON.stringify(items),
    discountId,
    manualDiscountType: manualDiscount?.type || "",
    manualDiscountValue: manualDiscount?.value || 0,
    manualDiscountScope: manualDiscount?.scope || "Transaction",
    manualDiscountTargetKey: manualDiscount?.targetKey || "",
    saleDate,
    testMode,
  };
}

app.post("/api/pos/carts", asyncRoute(async (request, response) => {
  const actor = actorFromRequest(request);
  const data = normalizePosCartPayload(request.body, actor);
  assertMutationAllowed(request, "pos", data.branch);
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true, fullName: true } });
    if (!client) throw apiError("The selected client was not found.", 404);
    data.client = client.fullName;
    const existing = await prisma.posCart.findFirst({ where: { clientId: data.clientId } });
    if (existing) {
      response.status(409).json({ error: `${client.fullName} already has an open POS cart.`, cart: serializePosCart(existing) });
      return;
    }
  }
  const cart = await prisma.posCart.create({ data: { ...data, createdById: actor.id, createdBy: actor.name } });
  response.status(201).json({ cart: serializePosCart(cart) });
}));

app.put("/api/pos/carts/:id", asyncRoute(async (request, response) => {
  const id = clean(request.params.id);
  const existing = await prisma.posCart.findUnique({ where: { id } });
  if (!existing) throw apiError("Open POS cart not found.", 404);
  assertMutationAllowed(request, "pos", existing.branch);
  const actor = actorFromRequest(request);
  const data = normalizePosCartPayload(request.body, actor, existing);
  assertMutationAllowed(request, "pos", data.branch);
  if (data.branch !== existing.branch) throw apiError("Close this cart before changing its branch.", 409);
  if (data.clientId && data.clientId !== existing.clientId) {
    const duplicate = await prisma.posCart.findFirst({ where: { clientId: data.clientId, id: { not: id } } });
    if (duplicate) throw apiError("This client already has another open POS cart.", 409);
  }
  const cart = await prisma.posCart.update({ where: { id }, data });
  response.json({ cart: serializePosCart(cart) });
}));

app.delete("/api/pos/carts/:id", asyncRoute(async (request, response) => {
  const id = clean(request.params.id);
  const existing = await prisma.posCart.findUnique({ where: { id } });
  if (!existing) {
    response.status(204).end();
    return;
  }
  assertMutationAllowed(request, "pos", existing.branch);
  await prisma.posCart.delete({ where: { id } });
  response.status(204).end();
}));

app.post("/api/pos/checkout", asyncRoute(async (request, response) => {
  const draft = request.body?.draft ?? {};
  const paymentData = request.body?.payment ?? {};
  const branch = requireText(draft.branch, "Branch");
  assertMutationAllowed(request, "pos", branch);
  const actor = actorFromRequest(request);
  const today = posCalendarDate();
  const saleDate = clean(draft.saleDate) || today;
  const testMode = draft.testMode === true;
  const postUnpaid = clean(paymentData.status) === "Unpaid";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(`${saleDate}T00:00:00Z`))) {
    throw apiError("Choose a valid transaction date.");
  }
  if (saleDate > today) throw apiError("Future-dated POS transactions are not allowed.");
  if (saleDate !== today && !canManageOrganization(actor.role)) {
    throw apiError("Only an Owner or Super Admin can post a historical transaction.", 403);
  }
  if (testMode && !isAdmin(actor.role)) throw apiError("Only Super Admin can use POS Test Mode.", 403);

  const payments = Array.isArray(paymentData.payments) ? paymentData.payments : [];
  const normalizedPayments = payments.map((payment) => {
    const referenceNumber = systemPaymentReference(payment.referenceNumber, "PAY", saleDate);
    return {
      id: clean(payment.id) || randomBytes(12).toString("hex"),
      method: requireText(payment.method, "Payment method"),
      amount: numberValue(payment.amount, "Payment amount", { min: 0 }),
      referenceNumber,
      ...(clean(payment.giftCertificateId) ? { giftCertificateId: clean(payment.giftCertificateId) } : {}),
      ...(clean(payment.packageId) ? { packageId: clean(payment.packageId) } : {}),
      ...(clean(payment.packageLineKey) ? { packageLineKey: clean(payment.packageLineKey) } : {}),
      ...(clean(payment.employeeId) ? { employeeId: clean(payment.employeeId) } : {}),
    };
  }).filter((payment) => payment.amount > 0);
  if (!normalizedPayments.length && !postUnpaid) {
    throw apiError("At least one payment amount is required.");
  }
  for (const payment of normalizedPayments) {
    if (payment.method === "Gift Certificate" && !payment.giftCertificateId) {
      throw apiError("Select the gift certificate used for this payment.");
    }
    if (payment.method === "Package" && !payment.packageId) {
      throw apiError("Select the client package used for this payment.");
    }
    if (payment.giftCertificateId && payment.method !== "Gift Certificate") {
      throw apiError("Gift certificate identifiers can only be used with Gift Certificate payments.");
    }
    if (payment.packageId && payment.method !== "Package") {
      throw apiError("Package identifiers can only be used with Package payments.");
    }
    if (payment.packageLineKey && payment.method !== "Package") {
      throw apiError("Package service links can only be used with Package payments.");
    }
    if (payment.method === "Salary Deduction" && !payment.employeeId) {
      throw apiError("Select the employee linked to the salary deduction.");
    }
    if (payment.employeeId && payment.method !== "Salary Deduction") {
      throw apiError("Employee identifiers can only be used with Salary Deduction payments.");
    }
    if (payment.employeeId) {
      const employee = await prisma.staffMember.findUnique({ where: { id: payment.employeeId } });
      const assigned = new Set([employee?.branch, ...parseJsonList(employee?.branches)]);
      if (!employee || employee.status === "Inactive" || (!assigned.has(branch) && !assigned.has("All branches"))) {
        throw apiError("The selected employee is not active at this branch.", 409);
      }
    }
  }
  const settings = await getPersistedSettings();
  const allowedPaymentMethods = new Set(normalizePaymentMethods(settings.paymentMethods).filter((method) => method.active).map((method) => method.name));
  allowedPaymentMethods.add("Package");
  const disabledPayment = normalizedPayments.find((payment) => !allowedPaymentMethods.has(payment.method));
  if (disabledPayment) throw apiError(`${disabledPayment.method} is not an enabled payment method. Refresh POS settings and try again.`, 409);

  const checkout = await calculateCheckout(draft, { actor, branch });
  const checkoutServiceLines = new Map(checkout.items.filter((item) => item.type === "Service").map((item) => [item.lineKey, item]));
  const packageLineUsage = new Map();
  for (const payment of normalizedPayments) {
    if (payment.method !== "Package") continue;
    const packageLineKey = clean(payment.packageLineKey) || (checkoutServiceLines.size === 1 ? checkoutServiceLines.keys().next().value : "");
    if (!packageLineKey) throw apiError("Select the service covered by this package payment.");
    const coveredLine = checkoutServiceLines.get(packageLineKey);
    if (!coveredLine) throw apiError("The selected package must cover a service in this transaction.", 409);
    const usedSessions = (packageLineUsage.get(packageLineKey) || 0) + 1;
    if (usedSessions > Math.max(1, Number(coveredLine.qty || 1))) {
      throw apiError(`${coveredLine.name} does not have another session line available for this package payment.`, 409);
    }
    packageLineUsage.set(packageLineKey, usedSessions);
    payment.packageLineKey = packageLineKey;
    payment.packageServiceId = clean(coveredLine.sourceId);
    payment.packageServiceName = clean(coveredLine.name);
    payment.packageProvider = clean(coveredLine.provider);
  }
  const packagePurchaseItems = checkout.items.filter((item) => item.type === "Service" && item.source.serviceType === "Package");
  if (packagePurchaseItems.length && !checkout.client && !testMode) {
    throw apiError("Select a registered client before selling a package so its sessions can be issued.");
  }
  const paidAmount = normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingAmount = Math.max(0, checkout.total - paidAmount);
  if (outstandingAmount > 0 && !checkout.client && !testMode) {
    throw apiError("Select a registered client before posting an unpaid or partially paid transaction.");
  }
  const packageLineAmounts = new Map(packagePurchaseItems.map((item) => {
    const grossLineTotal = Number(item.price || 0) * Number(item.qty || 1);
    const netPackagePrice = checkout.subtotal > 0
      ? Math.round((((grossLineTotal / checkout.subtotal) * checkout.total) + Number.EPSILON) * 100) / 100
      : 0;
    return [item.lineKey, netPackagePrice];
  }));
  const packageNetTotal = [...packageLineAmounts.values()].reduce((sum, amount) => sum + amount, 0);
  const nonPackageNetTotal = Math.max(0, checkout.total - packageNetTotal);
  const requiredPackageAllocation = Math.max(0, Math.min(packageNetTotal, Math.min(paidAmount, checkout.total) - nonPackageNetTotal));
  const requestedPackageInstallments = Array.isArray(paymentData.packageInstallments) ? paymentData.packageInstallments : null;
  const packageInstallmentsByLine = new Map();
  if (requestedPackageInstallments) {
    for (const installment of requestedPackageInstallments) {
      const lineKey = requireText(installment?.lineKey, "Package line");
      if (packageInstallmentsByLine.has(lineKey)) throw apiError("Each package can only have one installment allocation.");
      const packagePrice = packageLineAmounts.get(lineKey);
      if (packagePrice === undefined) throw apiError("A package installment was assigned to an invalid cart line.");
      const amountPaid = numberValue(installment?.amountPaid, "Package amount paid", { min: 0 });
      if (amountPaid > packagePrice) throw apiError("Package amount paid cannot exceed the package total.");
      const nextPayment = clean(installment?.nextPayment);
      if (nextPayment && (!/^\d{4}-\d{2}-\d{2}$/.test(nextPayment) || Number.isNaN(Date.parse(`${nextPayment}T00:00:00Z`)))) {
        throw apiError("Choose a valid next package payment date.");
      }
      packageInstallmentsByLine.set(lineKey, { amountPaid, nextPayment });
    }
    const allocated = [...packageInstallmentsByLine.values()].reduce((sum, installment) => sum + installment.amountPaid, 0);
    if (Math.abs(allocated - requiredPackageAllocation) > 0.009) {
      throw apiError(`Apply ${requiredPackageAllocation} of this payment to the package installment balance.`);
    }
  }
  const deductions = testMode ? [] : await inventoryDeductionsForSale(checkout.items, branch);
  const operationalPayments = testMode ? [] : normalizedPayments;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    if (checkout.appointmentId && !testMode) {
      const existingDepositSale = await tx.sale.findUnique({ where: { appointmentId: checkout.appointmentId } });
      if (existingDepositSale) throw apiError("This appointment deposit was already applied to another sale.", 409);
      const currentAppointment = await tx.appointment.findFirst({
        where: { id: checkout.appointmentId, branch, clientId: clean(draft.clientId), updatedAt: checkout.appointmentUpdatedAt },
        select: { id: true },
      });
      if (!currentAppointment) throw apiError("The appointment changed during checkout. Review its deposit and try again.", 409);
    }
    if (checkout.discount && !testMode) {
      const claimedDiscount = await tx.discount.updateMany({
        where: { id: checkout.discount.id, active: true, updatedAt: checkout.discount.updatedAt },
        data: { usage: { increment: 1 } },
      });
      if (claimedDiscount.count !== 1) throw apiError("The selected discount changed during checkout. Review it and try again.", 409);
    }
    const settledInventory = new Map();
    for (const deduction of deductions) {
      const item = await tx.inventoryItem.findFirst({ where: inventoryWhereForBranch(deduction.inventoryId, branch) });
      if (!item) {
        throw apiError(`Inventory item ${deduction.item} is not available at ${branch}.`, 409);
      }
      const reserved = await tx.inventoryItem.updateMany({
        where: { ...inventoryWhereForBranch(deduction.inventoryId, branch), stock: { gte: deduction.qty } },
        data: { stock: { decrement: deduction.qty } },
      });
      if (reserved.count !== 1) {
        throw apiError(`Inventory is insufficient for ${item.item}.`, 409);
      }
      settledInventory.set(deduction.inventoryId, await tx.inventoryItem.findUnique({ where: { id: deduction.inventoryId } }));
    }

    const settledCertificates = [];
    const certificateCharges = new Map();
    for (const payment of operationalPayments) {
      if (!payment.giftCertificateId) continue;
      certificateCharges.set(payment.giftCertificateId, (certificateCharges.get(payment.giftCertificateId) || 0) + payment.amount);
    }
    for (const [certificateId, amount] of certificateCharges) {
      const certificate = await tx.giftCertificate.findUnique({ where: { id: certificateId } });
      assertGiftCertificateUsable(certificate, { branch, amount });
      if (certificate.type === "Specific Service") {
        const matchesService = checkout.items.some((item) => item.type === "Service" && (item.sourceId === certificate.serviceId || item.name === certificate.service));
        if (!matchesService) throw apiError(`Gift certificate ${certificate.code} can only be used for ${certificate.service || "its assigned service"}.`, 409);
      }
      const charged = await tx.giftCertificate.updateMany({
        where: { id: certificateId, balance: certificate.balance, status: certificate.status },
        data: { balance: { decrement: amount } },
      });
      if (charged.count !== 1) throw apiError(`Gift certificate ${certificate.code} changed during checkout. Try again.`, 409);
      let settled = await tx.giftCertificate.findUnique({ where: { id: certificateId } });
      if (Number(settled.balance || 0) <= 0) {
        settled = await tx.giftCertificate.update({ where: { id: certificateId }, data: { status: "Redeemed" } });
      }
      settledCertificates.push(settled);
    }

    const settledPackages = [];
    const packageRedemptions = new Map();
    for (const payment of operationalPayments) {
      if (!payment.packageId) continue;
      packageRedemptions.set(payment.packageId, [...(packageRedemptions.get(payment.packageId) || []), payment]);
    }
    for (const [packageId, redemptionPayments] of packageRedemptions) {
      const sessions = redemptionPayments.length;
      const pkg = await tx.clinicPackage.findUnique({ where: { id: packageId } });
      assertPackageRedeemable(pkg, { branch });
      assertPackageOwnedByClient(pkg, draft.clientId);
      if (Number(pkg.used || 0) + sessions > Number(pkg.sessions || 0)) {
        throw apiError(`Package ${pkg.name} only has ${Number(pkg.sessions || 0) - Number(pkg.used || 0)} session(s) left.`, 409);
      }
      const redeemed = await tx.clinicPackage.updateMany({
        where: { id: packageId, used: pkg.used, status: pkg.status },
        data: {
          used: { increment: sessions },
          sessionHistory: jsonText([
            ...parseJsonList(pkg.sessionHistory),
            {
              date: saleDate,
              branch,
              sessions,
              service: redemptionPayments.map((payment) => payment.packageServiceName).filter(Boolean).join(", "),
              provider: redemptionPayments.map((payment) => payment.packageProvider).filter((value) => value && value !== "N/A").join(", "),
            },
          ], []),
        },
      });
      if (redeemed.count !== 1) throw apiError(`Package ${pkg.name} changed during checkout. Try again.`, 409);
      let settled = await tx.clinicPackage.findUnique({ where: { id: packageId } });
      if (Number(settled.used || 0) >= Number(settled.sessions || 0)) {
        settled = await tx.clinicPackage.update({ where: { id: packageId }, data: { status: "Completed" } });
      }
      settledPackages.push(settled);
    }

    const saleCount = await tx.sale.count();
    const invoicePrefix = testMode ? "TEST" : clean(draft.invoicePrefix) || "ZENSHO";
    const invoice = `${invoicePrefix}-${saleDate.slice(2).replace(/-/g, "")}-${String(saleCount + 1).padStart(3, "0")}`;
    const sale = await tx.sale.create({
      data: {
        invoice,
        date: saleDate,
        time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
        clientId: checkout.client?.id || null,
        client: clean(draft.clientName) || "Walk-in",
        branch,
        staff: clean(draft.staff) || actor.name,
        subtotal: checkout.subtotal,
        discount: checkout.discountAmount,
        total: checkout.total,
        payments: JSON.stringify(normalizedPayments),
        status: testMode ? "Test" : paidAmount >= checkout.total ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Unpaid",
        appointmentId: testMode ? null : checkout.appointmentId,
        notes: clean(paymentData.notes || draft.notes),
        testMode,
        items: {
          create: checkout.items.map((item) => ({
            name: item.name,
            type: item.type,
            qty: item.qty,
            price: item.price,
            originalPrice: item.originalPrice,
            priceModel: item.priceModel,
            priceUnit: item.priceUnit,
            discount: Number(item.promotionDiscount || 0),
            provider: item.provider || "N/A",
            serviceId: item.type === "Service" ? item.sourceId : "",
            aftercare: item.aftercare || "",
            recommendedIntervalDays: Number(item.recommendedIntervalDays || 0),
          })),
        },
      },
      include: { items: true },
    });

    const issuedPackages = [];
    if (!testMode && checkout.client) {
      const paymentMethod = [...new Set(normalizedPayments.map((payment) => payment.method))].join(" + ");
      for (const item of packagePurchaseItems) {
        const sessions = Number(item.source.packageSessions || 0) * Number(item.qty || 1);
        if (sessions < 1) throw apiError(`${item.name} must include at least one package session.`);
        const grossLineTotal = Number(item.price || 0) * Number(item.qty || 1);
        const netPackagePrice = checkout.subtotal > 0
          ? Math.round(((grossLineTotal / checkout.subtotal) * checkout.total) * 100) / 100
          : 0;
        const installment = packageInstallmentsByLine.get(item.lineKey);
        const packageAmountPaid = requestedPackageInstallments
          ? Number(installment?.amountPaid || 0)
          : Math.round((netPackagePrice * (checkout.total > 0 ? Math.min(1, paidAmount / checkout.total) : 1)) * 100) / 100;
        issuedPackages.push(await tx.clinicPackage.create({
          data: {
            name: item.name,
            clientId: checkout.client.id,
            client: checkout.client.fullName,
            sessions,
            used: 0,
            expires: "",
            branch,
            transferable: false,
            status: "Active",
            price: netPackagePrice,
            amountPaid: packageAmountPaid,
            nextPayment: packageAmountPaid < netPackagePrice ? clean(installment?.nextPayment) : "",
            purchaseDate: saleDate,
            serviceValue: Number(item.source.serviceValue || (sessions ? netPackagePrice / sessions : 0)),
            paymentHistory: jsonText(packageAmountPaid > 0 ? [{
              date: saleDate,
              amount: packageAmountPaid,
              method: paymentMethod || "Payment",
              saleId: sale.id,
              invoice: sale.invoice,
            }] : [], []),
            sessionHistory: jsonText([], []),
            sourceSaleId: sale.id,
          },
        }));
      }
    }

    for (const payment of operationalPayments) {
      if (payment.method !== "Salary Deduction" || !payment.employeeId) continue;
      await tx.payrollSalaryDeduction.upsert({
        where: { sourceKey: payment.id },
        create: {
          sourceKey: payment.id,
          staffId: payment.employeeId,
          saleId: sale.id,
          saleInvoice: sale.invoice,
          sourceDate: sale.date,
          branch: sale.branch,
          amount: payment.amount,
          details: JSON.stringify({
            paymentMethod: payment.method,
            referenceNumber: payment.referenceNumber || "",
          }),
        },
        update: {},
      });
    }

    for (let index = 0; index < settledCertificates.length; index += 1) {
      const certificate = settledCertificates[index];
      if (certificate.status !== "Redeemed") continue;
      settledCertificates[index] = await tx.giftCertificate.update({
        where: { id: certificate.id },
        data: { redeemedDate: saleDate, redeemedBranch: branch, transactionId: sale.id },
      });
    }

    const movements = [];
    for (const deduction of deductions) {
      const updatedItem = settledInventory.get(deduction.inventoryId);
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
      ...(checkout.manualDiscount ? [
        `Manual discount: ${checkout.manualDiscount.type === "Percentage" ? `${checkout.manualDiscount.value}%` : checkout.manualDiscount.value}${checkout.manualDiscount.scope === "Service" ? ` on ${checkout.manualDiscount.targetName}` : " on entire transaction"} (${checkout.transactionDiscountAmount} applied)`,
      ] : checkout.discount ? [`Discount rule: ${checkout.discount.name} (${checkout.transactionDiscountAmount} applied)`] : []),
      ...(checkout.appliedPromotions.length ? [`Promotions: ${checkout.appliedPromotions.join(", ")}`] : []),
      ...settledCertificates.map((certificate) => `GC ${certificate.code} balance ${certificate.balance}`),
      ...settledPackages.map((pkg) => `${pkg.name} ${pkg.used}/${pkg.sessions} sessions`),
      ...issuedPackages.map((pkg) => `${pkg.name} issued with ${pkg.sessions} sessions`),
    ];
    let updatedClient = null;
    if (checkout.client && !testMode) {
      const visited = new Set(parseJsonList(checkout.client.branchesVisited));
      visited.add(branch);
      updatedClient = await tx.client.update({
        where: { id: checkout.client.id },
        data: {
          branchesVisited: jsonText([...visited], []),
          lastVisit: saleDate,
          balance: { increment: outstandingAmount },
        },
      });
    }
    const posCartId = clean(draft.posCartId);
    if (posCartId) {
      const closedCart = await tx.posCart.deleteMany({ where: { id: posCartId, branch } });
      if (closedCart.count !== 1) throw apiError("The open POS cart changed before checkout. Refresh and try again.", 409);
    }
    const auditLog = await writeAudit(tx, request, {
      area: "POS",
      action: testMode ? "POS test transaction completed" : saleDate !== today ? "Historical POS transaction completed" : "POS transaction completed",
      details: `${sale.invoice} posted for ${checkout.total} on ${saleDate}.${outstandingAmount ? ` Outstanding balance ${outstandingAmount}.` : ""}${tenderNotes.length ? ` ${tenderNotes.join("; ")}.` : ""}`,
    });

    return {
      sale: serializeSale(sale),
      inventory: await tx.inventoryItem.findMany({
        where: { OR: [{ branch }, { branch: "All branches" }] },
        orderBy: [{ item: "asc" }],
      }),
      movements,
      giftCertificates: settledCertificates,
      packages: [...settledPackages, ...issuedPackages].map(serializePackage),
      client: updatedClient ? serializeClient(updatedClient) : null,
      posCartId,
      auditLog,
    };
    });
  } catch (error) {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(",") : clean(error?.meta?.target);
    if (error?.code === "P2002" && target.includes("appointmentId")) {
      throw apiError("This appointment deposit was already applied to another sale.", 409);
    }
    throw error;
  }

  response.status(201).json(result);
}));

app.delete("/api/marketing/campaigns/:id", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) throw apiError("Campaign not found.", 404);
  assertMutationAllowed(request, "sms", existing.branch);
  if (existing.deletedAt) throw apiError("Campaign is already in Deleted.", 409);

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Campaign moved to Deleted",
      details: `${campaign.name} moved to Deleted and can be restored.`,
    });
    return { campaign, auditLog };
  });

  response.json(result);
}));

app.get("/api/marketing/media", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "sms");
  const scope = { category: "marketing-image", ...branchWhere(actor) };
  const includeDeleted = clean(request.query.status).toLowerCase() === "all";
  const [activeAssets, deletedAssets, active, deleted] = await Promise.all([
    prisma.uploadAsset.findMany({
      where: { ...scope, deletedAt: null },
      orderBy: [{ createdAt: "desc" }],
      take: 250,
    }),
    includeDeleted ? prisma.uploadAsset.findMany({
      where: { ...scope, deletedAt: { not: null } },
      orderBy: [{ deletedAt: "desc" }, { createdAt: "desc" }],
      take: 250,
    }) : Promise.resolve([]),
    prisma.uploadAsset.count({ where: { ...scope, deletedAt: null } }),
    prisma.uploadAsset.count({ where: { ...scope, deletedAt: { not: null } } }),
  ]);
  const assets = includeDeleted ? [...activeAssets, ...deletedAssets] : activeAssets;
  response.json({ assets: assets.map(serializeMarketingMediaAsset), counts: { active, deleted } });
}));

function marketingMediaMutation(request, deleted) {
  const actor = assertMutationAllowed(request, "sms");
  const selection = normalizeMarketingMediaSelection(request.body ?? {});
  if (!selection.all && !selection.ids.length) throw apiError("Select at least one Marketing image.", 400);
  if (selection.ids.length > 250) throw apiError("Manage no more than 250 selected images at once.", 400);
  return {
    selection,
    where: {
      category: "marketing-image",
      ...branchWhere(actor),
      deletedAt: deleted ? { not: null } : null,
      ...(selection.all ? {} : { id: { in: selection.ids } }),
    },
  };
}

app.post("/api/marketing/media/delete", asyncRoute(async (request, response) => {
  const { where } = marketingMediaMutation(request, false);
  const deletedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.uploadAsset.updateMany({ where, data: { deletedAt } });
    const auditLog = changed.count ? await writeAudit(tx, request, {
      area: "Marketing",
      action: "Marketing images moved to Deleted",
      details: `${changed.count} Marketing image${changed.count === 1 ? "" : "s"} moved to Deleted and can be restored.`,
    }) : null;
    return { count: changed.count, auditLog };
  });
  response.json(result);
}));

app.post("/api/marketing/media/restore", asyncRoute(async (request, response) => {
  const { where } = marketingMediaMutation(request, true);
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.uploadAsset.updateMany({ where, data: { deletedAt: null } });
    const auditLog = changed.count ? await writeAudit(tx, request, {
      area: "Marketing",
      action: "Marketing images restored",
      details: `${changed.count} Marketing image${changed.count === 1 ? "" : "s"} restored to the Media library.`,
    }) : null;
    return { count: changed.count, auditLog };
  });
  response.json(result);
}));

app.delete("/api/marketing/media/permanent", asyncRoute(async (request, response) => {
  const { where } = marketingMediaMutation(request, true);
  const assets = await prisma.uploadAsset.findMany({ where });
  const removedIds = [];
  const failedIds = [];
  for (let index = 0; index < assets.length; index += 8) {
    const batch = assets.slice(index, index + 8);
    const outcomes = await Promise.all(batch.map(async (asset) => {
      try {
        const deleted = await storageRequest(asset.objectPath, { method: "DELETE" });
        return deleted.ok || deleted.status === 404;
      } catch {
        return false;
      }
    }));
    outcomes.forEach((removed, offset) => (removed ? removedIds : failedIds).push(batch[offset].id));
  }

  let auditLog = null;
  if (removedIds.length) {
    auditLog = await prisma.$transaction(async (tx) => {
      for (let index = 0; index < removedIds.length; index += 500) {
        await tx.uploadAsset.deleteMany({ where: { id: { in: removedIds.slice(index, index + 500) } } });
      }
      return writeAudit(tx, request, {
        area: "Marketing",
        action: "Marketing images permanently deleted",
        details: `${removedIds.length} Marketing image${removedIds.length === 1 ? "" : "s"} permanently deleted.${failedIds.length ? ` ${failedIds.length} could not be removed from storage.` : ""}`,
      });
    });
  }
  response.json({ count: removedIds.length, failedCount: failedIds.length, auditLog });
}));

app.get("/api/marketing/templates", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "sms");
  const templates = await prisma.marketingEmailTemplate.findMany({
    where: branchWhere(actor),
    orderBy: [{ updatedAt: "desc" }],
    take: 250,
  });
  response.json({ templates });
}));

app.post("/api/marketing/templates", asyncRoute(async (request, response) => {
  const actor = assertMutationAllowed(request, "sms", clean(request.body?.branch) || undefined);
  const data = normalizeMarketingTemplatePayload(request.body ?? {}, actor);
  assertMutationAllowed(request, "sms", data.branch);
  const duplicate = await prisma.marketingEmailTemplate.findFirst({
    where: { branch: data.branch, name: { equals: data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw apiError("A Marketing template with this name already exists.", 409);
  const result = await prisma.$transaction(async (tx) => {
    const template = await tx.marketingEmailTemplate.create({ data });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Email template created",
      details: `${template.name} saved as a reusable Marketing template.`,
    });
    return { template, auditLog };
  });
  response.status(201).json(result);
}));

app.put("/api/marketing/templates/:id", asyncRoute(async (request, response) => {
  const actor = assertMutationAllowed(request, "sms");
  const id = clean(request.params.id);
  const existing = await prisma.marketingEmailTemplate.findUnique({ where: { id } });
  if (!existing) throw apiError("Marketing template not found.", 404);
  assertMutationAllowed(request, "sms", existing.branch);
  const data = normalizeMarketingTemplatePayload(request.body ?? {}, actor, id);
  assertMutationAllowed(request, "sms", data.branch);
  const duplicate = await prisma.marketingEmailTemplate.findFirst({
    where: { id: { not: id }, branch: data.branch, name: { equals: data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw apiError("A Marketing template with this name already exists.", 409);
  const result = await prisma.$transaction(async (tx) => {
    const template = await tx.marketingEmailTemplate.update({ where: { id }, data });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Email template updated",
      details: `${template.name} updated.`,
    });
    return { template, auditLog };
  });
  response.json(result);
}));

app.delete("/api/marketing/templates/:id", asyncRoute(async (request, response) => {
  assertMutationAllowed(request, "sms");
  const id = clean(request.params.id);
  const existing = await prisma.marketingEmailTemplate.findUnique({ where: { id } });
  if (!existing) throw apiError("Marketing template not found.", 404);
  assertMutationAllowed(request, "sms", existing.branch);
  const result = await prisma.$transaction(async (tx) => {
    const template = await tx.marketingEmailTemplate.delete({ where: { id } });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Email template deleted",
      details: `${template.name} deleted.`,
    });
    return { id: template.id, auditLog };
  });
  response.json(result);
}));

app.get("/api/marketing/audience-members", asyncRoute(async (request, response) => {
  const actor = assertReadAllowed(request, "sms");
  const members = await prisma.marketingAudienceMember.findMany({
    where: branchWhere(actor),
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  response.json({ members });
}));

app.post("/api/marketing/audience-members", asyncRoute(async (request, response) => {
  if (request.body?.consentConfirmed !== true) {
    throw apiError("Confirm that this contact consented to receive marketing email.");
  }
  const data = normalizeMarketingAudienceMember(request.body);
  assertMutationAllowed(request, "sms", data.branch);
  const existing = await prisma.marketingAudienceMember.findUnique({
    where: { email_audience_branch: { email: data.email, audience: data.audience, branch: data.branch } },
  });
  if (existing) {
    response.json({ member: existing, created: false });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const member = await tx.marketingAudienceMember.create({ data });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Audience email added",
      details: `${member.email} added to ${member.audience} for ${member.branch}.`,
      subjectType: "MarketingAudienceMember",
      subjectId: member.id,
      afterValues: { audience: member.audience, branch: member.branch, email: member.email, source: member.source },
    });
    return { member, auditLog };
  });
  response.status(201).json({ ...result, created: true });
}));

app.post("/api/marketing/audience-members/import", asyncRoute(async (request, response) => {
  if (request.body?.consentConfirmed !== true) {
    throw apiError("Confirm that these contacts consented to receive marketing email.");
  }
  const inputMembers = Array.isArray(request.body?.members) ? request.body.members : [];
  if (!inputMembers.length) throw apiError("The CSV does not contain any email contacts.");
  if (inputMembers.length > 1_000) throw apiError("Import no more than 1,000 email contacts at a time.", 413);

  const uniqueMembers = new Map();
  inputMembers.forEach((values) => {
    const member = normalizeMarketingAudienceMember(values, {
      defaultAudience: request.body?.audience,
      defaultBranch: request.body?.branch,
      source: "CSV import",
    });
    assertMutationAllowed(request, "sms", member.branch);
    uniqueMembers.set(`${member.email}\u0000${member.audience}\u0000${member.branch}`, member);
  });
  const data = [...uniqueMembers.values()];

  const result = await prisma.$transaction(async (tx) => {
    const imported = await tx.marketingAudienceMember.createMany({ data, skipDuplicates: true });
    const members = await tx.marketingAudienceMember.findMany({
      where: {
        OR: data.map((member) => ({ email: member.email, audience: member.audience, branch: member.branch })),
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Audience emails imported",
      details: `${imported.count} email contact${imported.count === 1 ? "" : "s"} imported; ${data.length - imported.count} duplicate${data.length - imported.count === 1 ? "" : "s"} skipped.`,
      afterValues: { imported: imported.count, skipped: data.length - imported.count },
    });
    return { auditLog, imported: imported.count, members, skipped: data.length - imported.count };
  });
  response.status(201).json(result);
}));

async function validatedMarketingSurveyRequest(request, values) {
  const campaignId = boundedPublicText(request.params.campaignId, "Campaign", 100);
  const blockId = boundedPublicText(request.params.blockId, "Survey block", 140);
  const answer = boundedPublicText(values.answer, "Survey answer", 200);
  const token = boundedPublicText(values.token, "Survey token", 1_500);
  const campaign = await prisma.marketingCampaign.findFirst({ where: { id: campaignId, deletedAt: null } });
  if (!campaign) throw apiError("This survey campaign is no longer available.", 404);
  const block = findMarketingDesignBlock(campaign.design?.blocks, blockId);
  if (!block || clean(block.type) !== "survey") throw apiError("This survey is no longer available.", 404);
  const choices = Array.isArray(block.choices) ? block.choices : [];
  const selected = choices.find((choice) => clean(choice.value || choice.label) === answer);
  if (!selected) throw apiError("Choose one of the available survey answers.");
  const verified = verifyMarketingSurveyToken(token, { campaignId, secret: marketingSurveySigningSecret() });
  return { answer, block, blockId, campaign, campaignId, token, verified };
}

app.get("/api/public/marketing/survey/:campaignId/:blockId", asyncRoute(async (request, response) => {
  const survey = await validatedMarketingSurveyRequest(request, request.query);
  const action = `/api/public/marketing/survey/${encodeURIComponent(survey.campaignId)}/${encodeURIComponent(survey.blockId)}`;
  response.status(200).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm feedback — ZenshoTech</title><style>body{margin:0;background:#f4f1ed;color:#342319;font-family:Arial,sans-serif}.card{max-width:540px;margin:10vh auto;padding:42px;border:1px solid #ded2c7;border-radius:12px;background:#fff;text-align:center}h1{font-family:Georgia,serif;font-weight:500}button{border:0;border-radius:8px;background:#4a2d1c;color:#fff;padding:12px 20px;font:inherit;cursor:pointer}</style></head><body><main class="card"><h1>Confirm your response</h1><p>Submit “${escapeHtml(survey.answer)}” for ${escapeHtml(survey.campaign.name)}?</p><form method="post" action="${action}"><input type="hidden" name="answer" value="${escapeHtml(survey.answer)}"><input type="hidden" name="token" value="${escapeHtml(survey.token)}"><button type="submit">Submit feedback</button></form></main></body></html>`);
}));

app.post("/api/public/marketing/survey/:campaignId/:blockId", asyncRoute(async (request, response) => {
  const survey = await validatedMarketingSurveyRequest(request, request.body ?? {});
  const id = marketingSurveyResponseId({
    campaignId: survey.campaignId,
    blockId: survey.blockId,
    recipientId: survey.verified.recipientId,
  });
  try {
    await prisma.marketingSurveyResponse.create({
      data: {
      id,
      campaignId: survey.campaignId,
      blockId: survey.blockId,
      answer: survey.answer,
      recipient: survey.verified.recipientId,
      },
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }
  const confirmation = clean(survey.block.confirmationMessage) || "Thank you for sharing your feedback.";
  response.status(200).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you — ZenshoTech</title><style>body{margin:0;background:#f4f1ed;color:#342319;font-family:Arial,sans-serif}.card{max-width:540px;margin:10vh auto;padding:42px;border:1px solid #ded2c7;border-radius:12px;background:#fff;text-align:center}h1{font-family:Georgia,serif;font-weight:500}a{color:#4a2d1c}</style></head><body><main class="card"><h1>Thank you</h1><p>${escapeHtml(confirmation)}</p><p>Your response has been recorded for ${escapeHtml(survey.campaign.name)}.</p><a href="/">Return to ZenshoTech</a></main></body></html>`);
}));

app.post("/api/marketing/campaigns/:id/restore", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) throw apiError("Campaign not found.", 404);
  assertMutationAllowed(request, "sms", existing.branch);
  if (!existing.deletedAt) throw apiError("Campaign is not in Deleted.", 409);

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.update({
      where: { id },
      data: {
        approvedAt: null,
        approvedById: "",
        deletedAt: null,
        deliveryStatus: "",
        scheduledById: "",
        status: "Draft",
      },
    });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Campaign restored",
      details: `${campaign.name} restored to active campaigns.`,
    });
    return { campaign, auditLog };
  });

  response.json(result);
}));

app.delete("/api/marketing/campaigns/:id/permanent", asyncRoute(async (request, response) => {
  const id = String(request.params.id);
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) throw apiError("Campaign not found.", 404);
  assertMutationAllowed(request, "sms", existing.branch);
  if (!existing.deletedAt) {
    throw apiError("Move this campaign to Deleted before deleting it forever.", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.delete({ where: { id } });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Campaign permanently deleted",
      details: `${campaign.name} permanently deleted.`,
    });
    return { id: campaign.id, auditLog };
  });

  response.json(result);
}));

app.post("/api/marketing/send-test", asyncRoute(async (request, response) => {
  assertMutationAllowed(request, "sms");
  const campaign = request.body?.campaign ?? {};
  const addresses = [...new Set((Array.isArray(request.body?.emails) ? request.body.emails : []).map(normalizeEmail).filter(Boolean))];
  if (!addresses.length) throw apiError("Enter at least one valid test email address.");
  if (addresses.length > 5) throw apiError("Send a test to no more than five email addresses at once.", 413);
  const html = sanitizeMarketingHtml(campaign.html);
  if (!html) throw apiError("Save or finish the email content before sending a test.");
  const subject = `[TEST] ${clean(campaign.subject) || clean(campaign.name) || "ZenshoTech campaign"}`;
  const text = marketingHtmlToText(html);
  const dryRun = envFlag(process.env.MARKETING_DRY_RUN);
  if (!dryRun && !emailReady()) throw apiError("Email is not configured. Add SMTP settings before sending a test.", 503);
  const settings = await getPersistedSettings();
  const transporter = dryRun ? null : createEmailTransport();
  const failures = [];
  let sent = 0;
  for (const address of addresses) {
    const client = { fullName: "Alex Test Client", email: address, mobile: "", branch: "ZenshoTech" };
    const renderedHtml = renderMarketingHtml(html, marketingMergeValues({ client, campaign, settings }));
    try {
      if (dryRun) console.log(`[marketing dry-run] TEST EMAIL to ${address}: ${subject}`);
      else await sendSmtpEmail({ transporter, to: address, subject, text: renderMarketingText(text, { client, campaign, settings }), html: renderedHtml });
      sent += 1;
    } catch (error) {
      failures.push({ email: address, error: clean(error.message) || "Delivery failed." });
    }
  }
  transporter?.close();
  if (!sent) throw apiError(failures[0]?.error || "The test email could not be sent.", 502);
  const auditLog = await prisma.auditLog.create({
    data: auditData(request, {
      area: "Marketing",
      action: "Test email sent",
      details: `${campaign.name || "Campaign"} test sent to ${sent} address${sent === 1 ? "" : "es"}${failures.length ? `; ${failures.length} failed` : ""}.`,
    }),
  });
  response.json({ sent, failed: failures.length, failures, provider: dryRun ? "dry-run" : "smtp", auditLog });
}));

app.post("/api/marketing/campaigns/:id/schedule", asyncRoute(async (request, response) => {
  const id = clean(request.params.id);
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) throw apiError("Campaign not found.", 404);
  const actor = assertMutationAllowed(request, "sms", existing.branch);
  if (existing.deletedAt) throw apiError("Restore this campaign before scheduling it.", 409);
  const scheduledAt = new Date(clean(request.body?.scheduledAt) || existing.scheduledAt || "");
  if (Number.isNaN(scheduledAt.getTime())) throw apiError("Choose a valid delivery date and time.");
  if (scheduledAt.getTime() <= Date.now()) throw apiError("Choose a delivery time in the future.");
  assertMarketingChannelSupported(existing);

  const marketingSettings = await getPersistedSettings();
  const transition = scheduleMarketingState({
    actorId: actor.id,
    actorRole: actor.role,
    campaign: { ...existing, managerApproval: marketingSettings.managerApproval !== false },
    scheduledAt,
  });
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.update({ where: { id }, data: transition.data });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: transition.approvalRequired ? "Campaign submitted for approval" : "Campaign scheduled",
      details: transition.approvalRequired
        ? `${campaign.name} is waiting for an administrator before delivery.`
        : `${campaign.name} scheduled for ${scheduledAt.toLocaleString("en-PH")}.`,
    });
    return { campaign, auditLog };
  });

  response.json({ ...result, approvalRequired: transition.approvalRequired });
}));

app.post("/api/marketing/campaigns/:id/approve", asyncRoute(async (request, response) => {
  const id = clean(request.params.id);
  const existing = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!existing) throw apiError("Campaign not found.", 404);
  const actor = assertMutationAllowed(request, "sms", existing.branch);
  if (!canManageOrganization(actor.role)) throw apiError("Only an Admin or Business Owner can approve Marketing campaigns.", 403);
  if (existing.deletedAt) throw apiError("Restore this campaign before approving it.", 409);
  if (!existing.scheduledAt) throw apiError("Choose a delivery date and time before approving this campaign.");
  assertMarketingChannelSupported(existing);

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.marketingCampaign.update({ where: { id }, data: approveMarketingState({ actorId: actor.id }) });
    const auditLog = await writeAudit(tx, request, {
      area: "Marketing",
      action: "Campaign approved",
      details: `${campaign.name} approved and released to the delivery queue.`,
    });
    return { campaign, auditLog };
  });

  response.json(result);
}));

function deliveryAuditData(request, details) {
  if (request) return auditData(request, details);
  return {
    time: new Date().toLocaleString("en-PH"),
    actor: "Marketing scheduler",
    role: "System",
    area: details.area,
    action: details.action,
    details: details.details,
  };
}

async function deliverMarketingCampaign({ campaign, clients, members = [], request = null }) {
  const settings = await getPersistedSettings();
  const channel = marketingChannel(campaign);
  const templates = await prisma.smsTemplate.findMany({ where: { active: true } });
  const template = pickTemplate({ campaign, templates, channel });
  const emailHtml = channel === "email" ? sanitizeMarketingHtml(campaign.html) : "";
  const baseMessage = clean(campaign.message) || marketingHtmlToText(emailHtml) || clean(template.text);
  const subject = clean(campaign.subject) || clean(campaign.name) || "A note from ZenshoTech";
  const dryRun = envFlag(process.env.MARKETING_DRY_RUN);

  if (!clean(campaign.name)) throw apiError("Campaign name is required.");
  if (!baseMessage) throw apiError("Campaign message is required.");
  assertMarketingProviderReady(campaign);

  const { candidates, recipients } = selectMarketingRecipients({ clients, members, campaign, channel });
  const maxSends = Number(process.env.MAX_MARKETING_SENDS || 500);
  if (!recipients.length) throw apiError(`No opted-in contacts with ${channel === "sms" ? "mobile numbers" : "email addresses"} matched this campaign.`);
  if (recipients.length > maxSends) throw apiError(`This campaign has ${recipients.length} recipients. Set MAX_MARKETING_SENDS higher to send it.`, 413);

  const transporter = channel === "email" && !dryRun ? createEmailTransport() : null;
  const failures = [];
  let sent = 0;
  try {
    for (const recipient of recipients) {
      const context = { client: recipient.client, campaign, settings };
      const text = renderMarketingText(baseMessage, context);
      const html = channel === "email" && emailHtml ? renderMarketingHtml(emailHtml, marketingMergeValues(context)) : "";
      try {
        if (dryRun) console.log(`[marketing dry-run] ${channel.toUpperCase()} to ${recipient.contact}: ${text}`);
        else if (channel === "sms") await sendTwilioSms({ to: recipient.contact, body: text });
        else await sendSmtpEmail({ transporter, to: recipient.contact, subject, text, html });
        sent += 1;
      } catch (error) {
        failures.push({ client: recipient.client.fullName, contact: recipient.contact, error: error.message || "Delivery failed." });
      }
    }
  } finally {
    transporter?.close();
  }

  if (!sent && failures.length) throw apiError(failures[0].error || "No messages were delivered.", 502);
  const failed = failures.length;
  const credits = channel === "sms" ? sent : 0;
  let updatedCampaign = null;
  let auditLog = null;
  await prisma.$transaction(async (tx) => {
    if (clean(campaign.id)) {
      updatedCampaign = await tx.marketingCampaign.update({
        where: { id: clean(campaign.id) },
        data: {
          credits: channel === "sms" ? credits : Number(campaign.credits || 0),
          deliveryStatus: failed ? marketingDeliveryStates.partial : marketingDeliveryStates.sent,
          lastDeliveryError: failures[0]?.error || "",
          sent,
          sentAt: new Date(),
          status: failed ? "Partial" : "Sent",
        },
      });
    }
    auditLog = await tx.auditLog.create({
      data: deliveryAuditData(request, {
        area: "Marketing",
        action: channel === "email" ? "Email campaign sent" : "SMS campaign sent",
        details: `${campaign.name} delivered to ${sent} contact${sent === 1 ? "" : "s"}${failed ? ` with ${failed} failed` : ""}.`,
      }),
    });
  });

  return {
    auditLog,
    campaign: updatedCampaign,
    channel,
    credits,
    failed,
    failures: failures.slice(0, 5),
    ok: failures.length === 0,
    provider: dryRun ? "dry-run" : channel === "sms" ? "twilio" : "smtp",
    sent,
    skipped: Math.max(0, candidates.length - recipients.length),
  };
}

app.post("/api/marketing/send", asyncRoute(async (request, response) => {
  const actor = assertMutationAllowed(request, "sms");
  const marketingSettings = await getPersistedSettings();
  let campaign = request.body?.campaign ?? {};
  if (clean(campaign.id)) {
    const storedCampaign = await prisma.marketingCampaign.findUnique({ where: { id: clean(campaign.id) } });
    if (!storedCampaign) throw apiError("Campaign not found.", 404);
    assertMutationAllowed(request, "sms", storedCampaign.branch);
    if (storedCampaign.deletedAt) throw apiError("Restore this campaign before sending it.", 409);
    const approvalRequired = marketingSettings.managerApproval !== false
      && !storedCampaign.approvedAt
      && !canManageOrganization(actor.role);
    if (approvalRequired || marketingApprovalRequired(storedCampaign, actor.role)) throw apiError("An Admin or Business Owner must approve this campaign before delivery.", 403);
    campaign = storedCampaign;
  } else {
    assertMutationAllowed(request, "sms", requireText(campaign.branch, "Campaign branch"));
    if (marketingSettings.managerApproval !== false && !canManageOrganization(actor.role)) {
      throw apiError("Save this campaign and submit it for administrator approval before delivery.", 403);
    }
  }
  const clients = await listResource("clients", actor);
  const members = await prisma.marketingAudienceMember.findMany({ where: branchWhere(actor) });
  const result = await deliverMarketingCampaign({ campaign, clients, members, request });
  response.status(result.failed ? 207 : 200).json(result);
}));

let marketingSchedulerRunning = false;

async function processDueMarketingCampaigns() {
  if (marketingSchedulerRunning) return;
  marketingSchedulerRunning = true;
  try {
    const now = new Date();
    await prisma.marketingCampaign.updateMany({
      where: {
        deletedAt: null,
        deliveryStatus: marketingDeliveryStates.processing,
        updatedAt: { lte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
      data: { deliveryStatus: marketingDeliveryStates.queued, status: "Scheduled" },
    });
    const dueCampaigns = await prisma.marketingCampaign.findMany({
      where: {
        deletedAt: null,
        deliveryStatus: marketingDeliveryStates.queued,
        scheduledAt: { lte: now },
        status: "Scheduled",
      },
      orderBy: [{ scheduledAt: "asc" }],
      take: 10,
    });
    if (!dueCampaigns.length) return;
    const [allClients, allMembers] = await Promise.all([
      listResource("clients"),
      prisma.marketingAudienceMember.findMany(),
    ]);
    for (const campaign of dueCampaigns) {
      try {
        assertMarketingProviderReady(campaign);
      } catch (error) {
        const message = `Waiting for delivery provider: ${clean(error.message) || "Provider unavailable."}`.slice(0, 1000);
        await prisma.marketingCampaign.updateMany({
          where: { id: campaign.id, deliveryStatus: marketingDeliveryStates.queued, lastDeliveryError: { not: message } },
          data: { lastDeliveryError: message },
        });
        continue;
      }
      const claimed = await prisma.marketingCampaign.updateMany({
        where: { id: campaign.id, deliveryStatus: marketingDeliveryStates.queued, status: "Scheduled" },
        data: { deliveryStatus: marketingDeliveryStates.processing, lastDeliveryError: "", status: "Sending" },
      });
      if (!claimed.count) continue;
      const clients = isAllBranches(campaign.branch)
        ? allClients
        : allClients.filter((client) => clean(client.branch) === clean(campaign.branch));
      const members = isAllBranches(campaign.branch)
        ? allMembers
        : allMembers.filter((member) => clean(member.branch) === clean(campaign.branch));
      try {
        await deliverMarketingCampaign({ campaign, clients, members });
      } catch (error) {
        const message = clean(error.message) || "Scheduled delivery failed.";
        await prisma.$transaction([
          prisma.marketingCampaign.update({
            where: { id: campaign.id },
            data: { deliveryStatus: marketingDeliveryStates.failed, lastDeliveryError: message.slice(0, 1000), status: "Failed" },
          }),
          prisma.auditLog.create({
            data: deliveryAuditData(null, {
              area: "Marketing",
              action: "Scheduled campaign failed",
              details: `${campaign.name}: ${message}`.slice(0, 2000),
            }),
          }),
        ]);
        console.error(JSON.stringify({ event: "marketing_scheduled_delivery_failed", campaignId: campaign.id, error: message }));
      }
    }
  } finally {
    marketingSchedulerRunning = false;
  }
}

if (process.env.NODE_ENV === "production") {
  const serverDirectory = dirname(fileURLToPath(import.meta.url));
  const distCandidates = [resolve("dist"), resolve(serverDirectory, "..", "dist")];
  const distPath = distCandidates.find((candidate) => existsSync(join(candidate, "index.html"))) || distCandidates[0];
  const shellPath = join(distPath, "index.html");
  let appShell = null;
  try {
    appShell = readFileSync(shellPath);
  } catch (error) {
    console.error(`Web build is missing at ${shellPath}. Run "pnpm build" before starting the server.`, error);
  }

  app.use(express.static(distPath, { maxAge: "1d", index: false }));
  app.use((request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    if (request.path.startsWith("/api/")) return next();
    if (!appShell) return next();
    response.setHeader("Cache-Control", "no-cache");
    return response.type("html").send(appShell);
  });
}

app.use((error, _request, response, _next) => {
  const databaseUnavailable = !error.status && (
    ["P1000", "P1001", "P1002", "P1003", "P1011", "P1017"].includes(error.code)
    || error?.cause?.code === "XX000"
    || /tenant\/user .* not found|database .* does not exist|connection (?:refused|terminated)|ENOTFOUND/i.test(`${clean(error.message)} ${clean(error?.cause?.message)}`)
  );
  const status = error.status || (databaseUnavailable ? 503 : 500);
  const message = databaseUnavailable
    ? "Clinic database is temporarily unavailable. Contact the system administrator."
    : status === 500 ? "Clinic API failed to process the request." : error.message;
  if (status === 500 || databaseUnavailable) {
    console.error(error);
  }
  response.status(status).json({ error: message, ...(error.payload || {}) });
});

assertProductionEnvironment();

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`ZenshoTech listening on port ${port}`);
});

const marketingSchedulerEnabled = process.env.NODE_ENV !== "test" && process.env.MARKETING_SCHEDULER_ENABLED !== "false";
const marketingSchedulerInterval = marketingSchedulerEnabled
  ? setInterval(() => { void processDueMarketingCampaigns().catch((error) => console.error(JSON.stringify({ event: "marketing_scheduler_failed", error: clean(error.message) }))); }, Math.max(5_000, Number(process.env.MARKETING_SCHEDULER_INTERVAL_MS) || 30_000))
  : null;
marketingSchedulerInterval?.unref();
if (marketingSchedulerEnabled) setTimeout(() => { void processDueMarketingCampaigns().catch((error) => console.error(JSON.stringify({ event: "marketing_scheduler_failed", error: clean(error.message) }))); }, 2_000).unref();

function shutdown() {
  if (marketingSchedulerInterval) clearInterval(marketingSchedulerInterval);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

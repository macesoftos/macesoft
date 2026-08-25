import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CreditCard,
  Database,
  Download,
  Edit3,
  EllipsisVertical,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Gift,
  Globe2,
  HandCoins,
  HeartPulse,
  Home,
  Image,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Link,
  List,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageSquareText,
  Minus,
  PackagePlus,
  PhoneCall,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Trash2,
  Upload,
  UserCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  assets,
  branches,
  initialSettings,
  roleAccess,
  serviceCategories,
} from "./data";
import { canManageOrganization, isAdmin, isBusinessOwner } from "./organizationRoles.js";
import { navItems, navSections } from "./config/sidebar.jsx";
import { getGlobalCreateActions } from "./config/globalActions.js";
import GlobalCreateMenu from "./components/GlobalCreateMenu.jsx";
import GlobalModuleSearch from "./components/GlobalModuleSearch.jsx";
import { inventoryCsvExportColumns, inventoryRecordsFromCsv } from "./inventoryCsv.js";
import FaceTrackAttendance from "./facetrack/FaceTrackAttendance.jsx";
import FaceTrackKiosk from "./facetrack/FaceTrackKiosk.jsx";
import PayrollWorkspace from "./payroll/PayrollWorkspace.jsx";
import MarketingWorkspace from "./marketing/MarketingWorkspace.jsx";
import FlipbooksWorkspace, { PublicFlipbookViewer } from "./flipbooks/FlipbooksWorkspace.jsx";
import {
  hashRouteSegments,
  isLegacySmsHash,
  isMarketingHash,
  marketingPath,
  marketingRouteFromHash,
} from "./marketing/routes.js";
import {
  checkApiHealth,
  changeAccountPassword,
  acceptInvitation,
  createInvitation,
  editInvitation,
  createBranchRecord,
  archiveBranchRecord,
  reactivateBranchRecord,
  createRoomRecord,
  deleteRoomRecord,
  updateBranchRecord,
  addLeadActivity,
  bookLeadAppointment,
  completePosCheckout,
  createPosCart,
  convertLeadToClient,
  deleteMarketingCampaignForever,
  deleteResourceRecord,
  deleteTestTransactionRecord,
  listResourceRecords,
  loadBootstrap,
  loadLeadIntegrations,
  loadLeadWebhookEvents,
  loadMyWorkspace,
  loadNotifications,
  loadPayrollOverview,
  loadMarketingMedia,
  loadPublicLeadConfig,
  loadInvitations,
  loadOrganizationAccounts,
  linkStaffAccount,
  loginAccount,
  loadPublicPlans,
  loadAdminSubscriptions,
  loadSubscription,
  logoutAccount,
  mergeLeadDuplicate,
  markNotificationsRead,
  postInventoryMovement,
  redeemPackageRecord,
  recordPackageInstallment,
  recordAttendance,
  requestPasswordReset,
  requestSubscriptionActivation,
  registerAccount,
  resetAccountPassword,
  resendInvitation,
  restoreAccountSession,
  startSubscriptionTrial,
  restoreMarketingCampaign,
  revokeInvitation,
  inspectInvitation,
  importInventoryCsvRecords,
  scheduleLeadFollowUp,
  saveResourceRecord,
  savePayrollDayOffSwap,
  savePayrollSchedule,
  saveSettingsRecord,
  sendMarketingCampaign,
  scheduleMarketingCampaign,
  approveMarketingCampaign,
  selectActiveBranch,
  setApiSessionContext,
  submitPublicBooking,
  submitPublicRegistration,
  submitPublicLead,
  updateLeadStage,
  updatePosCart,
  updateAccountAccess,
  updateAdminSubscription,
  uploadTreatmentPhoto,
  moveMarketingCampaignToDeleted,
  deleteTreatmentPhoto,
  uploadImageAsset,
  voidTransactionRecord,
  apiAuthenticationRequiredEvent,
  apiNotificationCreatedEvent,
  authenticateWithGoogle,
} from "./lib/api.js";
import GoogleIdentityButton from "./components/GoogleIdentityButton.jsx";

const storageKey = (key) => `mace-clinicos-${key}`;
const retiredSensitiveStorageKeys = [
  "clients", "appointments", "services", "inventory", "transactions", "treatments", "packages",
  "gift-certificates", "leads", "staff", "expenses", "discounts", "sms-templates", "campaigns",
  "branch-records", "settings", "lead-integrations", "lead-webhook-events", "audit-logs",
  "inventory-movements", "selected-client", "pos-cart",
];

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const moneyWithCentavos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function planPrice(value) {
  return Number.isInteger(Number(value)) ? money.format(value) : moneyWithCentavos.format(value);
}

function BrandWordmark({ className = "" }) {
  return <img className={`zenshotech-wordmark ${className}`.trim()} src="/brand/zenshotech-logo.svg" alt="ZenshoTech" />;
}

function stagingBrandSettings(value = {}) {
  const next = { ...value };
  if (/mace|clinicos/i.test(String(next.company || ""))) next.company = "ZenshoTech";
  if (/mace|clinicos/i.test(String(next.productName || ""))) next.productName = "ZenshoTech";
  if (/mace/i.test(String(next.marketingSenderName || ""))) next.marketingSenderName = "ZenshoTech";
  if (/\bMACE\b/i.test(String(next.marketingUnsubscribeText || ""))) {
    next.marketingUnsubscribeText = "You are receiving this because you opted in to ZenshoTech marketing. Unsubscribe at any time.";
  }
  if (/^MACE$/i.test(String(next.invoicePrefix || ""))) next.invoicePrefix = "ZENSHO";
  return next;
}

function serviceCatalogPrice(service) {
  return Number(service?.serviceType === "Package" && Number(service?.packagePrice) > 0 ? service.packagePrice : service?.price || 0);
}

function serviceUsesFinalPrice(service) {
  return ["Starts at", "Price after consultation/assessment"].includes(String(service?.priceModel || ""));
}

function servicePriceUnitLabel(service) {
  return String(service?.priceUnit || "unit").replace(/^Per\s+/i, "").toLowerCase();
}

function servicePriceLabel(service) {
  const price = serviceCatalogPrice(service);
  const formatted = money.format(price);
  const model = String(service?.priceModel || "Fixed price");
  if (model === "Price after consultation/assessment") return "Price after consultation";
  if (model === "Starts at") return `Starts at ${formatted}`;
  if (model === "Per unit") {
    return `${formatted} per ${servicePriceUnitLabel(service)}`;
  }
  return formatted;
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
const appointmentStatusTransitions = {
  Draft: ["Pending Confirmation", "Cancelled"],
  "Pending Confirmation": ["Confirmed", "Rescheduled", "Cancelled", "No Show"],
  Confirmed: ["Arrived", "Checked In", "Completed", "Rescheduled", "Cancelled", "No Show"],
  Arrived: ["Checked In", "In Treatment", "Completed", "Cancelled", "No Show"],
  "Checked In": ["In Treatment", "Completed", "Cancelled", "No Show"],
  "In Treatment": ["Completed", "Cancelled"],
  Rescheduled: ["Pending Confirmation", "Confirmed", "Cancelled"],
  Completed: [],
  Cancelled: ["Rescheduled"],
  "No Show": ["Rescheduled", "Cancelled"],
};
const leadStatuses = [
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
const leadDirectoryTabs = [
  { id: "all", label: "All Leads", statuses: null },
  { id: "new", label: "New", statuses: ["New Inquiry"] },
  { id: "contacted", label: "Contacted", statuses: ["Contact Attempted", "Connected"] },
  { id: "qualified", label: "Qualified", statuses: ["Qualified"] },
  { id: "converted", label: "Converted", statuses: ["Converted"] },
  { id: "lost", label: "Lost", statuses: ["Lost"] },
];
const legacyLeadStatusMap = {
  New: "New Inquiry",
  Contacted: "Connected",
  Booked: "Appointment Booked",
  "Follow-up": "Follow-Up",
  Spam: "Invalid or Spam",
};
const closedLeadStatuses = ["Converted", "Not Interested", "Lost", "Invalid or Spam"];
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
const posCatalogPageSize = 14;

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayDate() {
  return isoDate(new Date());
}

function createSystemPaymentReference(prefix = "PAY", date = todayDate()) {
  const token = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 8).toUpperCase();
  return `${prefix}-${String(date || todayDate()).replace(/-/g, "")}-${token}`;
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function configuredPaymentMethods(settings) {
  const source = Array.isArray(settings?.paymentMethods) && settings.paymentMethods.length
    ? settings.paymentMethods
    : initialSettings.paymentMethods;
  return source
    .map((method, index) => {
      if (typeof method === "string") {
        return { id: `payment-${index}-${normalize(method).replace(/[^a-z0-9]+/g, "-")}`, name: method.trim(), active: true, order: index };
      }
      return {
        id: String(method?.id || `payment-${index}`),
        name: String(method?.name || "").trim(),
        active: method?.active !== false,
        order: Number.isFinite(Number(method?.order)) ? Number(method.order) : index,
      };
    })
    .filter((method) => method.name)
    .sort((left, right) => left.order - right.order);
}

function activePaymentMethodNames(settings, { includePackage = false } = {}) {
  const names = configuredPaymentMethods(settings).filter((method) => method.active).map((method) => method.name);
  return includePackage && !names.includes("Package") ? [...names, "Package"] : names;
}

function posQuickPaymentOptions(settings) {
  const methods = activePaymentMethodNames(settings);
  const first = methods[0] || "Cash";
  const cash = methods.find((method) => method === "Cash");
  const card = methods.find((method) => /card/i.test(method));
  const quick = [];
  if (cash) quick.push({ label: cash, method: cash, icon: CircleDollarSign });
  if (card && card !== cash) quick.push({ label: "Card", method: card, icon: CreditCard });
  quick.push({ label: "Split", method: first, icon: HandCoins, split: true });
  quick.push({ label: "Package", method: "Package", icon: Gift });
  return quick.slice(0, 4);
}

function canonicalAppointmentStatus(status) {
  const cleaned = String(status ?? "").trim();
  if (!cleaned) return "Pending Confirmation";
  return legacyAppointmentStatusMap[cleaned] ?? cleaned;
}

function isActiveAppointmentStatus(status) {
  return activeAppointmentStatuses.includes(canonicalAppointmentStatus(status));
}

function statusClass(status) {
  return normalize(canonicalAppointmentStatus(status)).replace(/[^a-z0-9]+/g, "-");
}

function canonicalLeadStatus(status) {
  const value = String(status ?? "").trim();
  if (!value) return "New Inquiry";
  return legacyLeadStatusMap[value] ?? value;
}

const scheduleStartMinutes = 8 * 60;
const scheduleEndMinutes = 20 * 60;
const scheduleHours = Array.from(
  { length: (scheduleEndMinutes - scheduleStartMinutes) / 60 + 1 },
  (_, index) => scheduleStartMinutes + index * 60,
);
const defaultBranchOperatingHours = Object.freeze({
  monday: { open: "10:00", close: "19:00", closed: false },
  tuesday: { open: "10:00", close: "19:00", closed: false },
  wednesday: { open: "10:00", close: "19:00", closed: false },
  thursday: { open: "10:00", close: "19:00", closed: false },
  friday: { open: "10:00", close: "19:00", closed: false },
  saturday: { open: "10:00", close: "19:00", closed: false },
  sunday: { open: "13:00", close: "17:00", closed: false },
});
const operatingDayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseTimeToMinutes(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return scheduleStartMinutes;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatScheduleTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${period}`;
}

function formatTimeInput(minutes) {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(minutes) || 0)));
  return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`;
}

function treatmentVisitDuration(record) {
  const start = parseTimeToMinutes(record?.arrivalTime);
  const end = parseTimeToMinutes(record?.checkoutTime || record?.completedTime);
  if (!record?.arrivalTime || (!record?.checkoutTime && !record?.completedTime) || end < start) return "In progress / not recorded";
  const minutes = end - start;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function serviceForAppointment(appointment, services) {
  return services.find((item) => item.id === appointment.serviceId || item.name === appointment.service);
}

function appointmentDurationMinutes(appointment, services) {
  if (Number(appointment.duration) >= 15) return Number(appointment.duration);
  const service = serviceForAppointment(appointment, services);
  return Math.max(15, Number(service?.duration || 60));
}

function appointmentServicePrice(appointment, services) {
  return Number(serviceForAppointment(appointment, services)?.price || 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - day);
  return next;
}

function startOfMondayWeek(date) {
  const next = new Date(date);
  const dayOffset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - dayOffset);
  return next;
}

function moveAppointmentFocus(dateValue, view, direction) {
  const next = new Date(`${dateValue}T12:00:00`);
  if (view === "Month") {
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
  } else {
    next.setDate(next.getDate() + direction * (view === "Week" ? 7 : 1));
  }
  return isoDate(next);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function dateRangeForPreset(preset, today = null) {
  const start = today ? new Date(today) : new Date(`${todayDate()}T12:00:00`);
  const todayIso = isoDate(start);
  if (preset === "Today") return { from: todayIso, to: todayIso };
  if (preset === "Tomorrow") {
    const tomorrow = addDays(start, 1);
    return { from: isoDate(tomorrow), to: isoDate(tomorrow) };
  }
  if (preset === "This Week") {
    const weekStart = startOfWeek(start);
    return { from: isoDate(weekStart), to: isoDate(addDays(weekStart, 6)) };
  }
  if (preset === "Next Week") {
    const weekStart = addDays(startOfWeek(start), 7);
    return { from: isoDate(weekStart), to: isoDate(addDays(weekStart, 6)) };
  }
  if (preset === "Month") {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { from: isoDate(monthStart), to: isoDate(endOfMonth(start)) };
  }
  return { from: "", to: "" };
}

function appointmentDateInRange(appointment, { from, to }) {
  if (!from && !to) return true;
  const date = String(appointment.date ?? "");
  return (!from || date >= from) && (!to || date <= to);
}

function transactionMatchesAppointment(transaction, appointment) {
  if (transaction.status === "Void") return false;
  const sameClient = normalize(transaction.client) === normalize(appointment.client);
  const sameBranch = !appointment.branch || normalize(transaction.branch) === normalize(appointment.branch);
  const hasService = (transaction.items ?? []).some((item) => normalize(item.name) === normalize(appointment.service));
  return sameClient && sameBranch && hasService;
}

function appointmentPayments(appointment, transactions) {
  return transactions.filter((transaction) => transactionMatchesAppointment(transaction, appointment));
}

function appointmentPaymentSummary(appointment, services, transactions) {
  const price = appointmentServicePrice(appointment, services);
  const deposit = Number(appointment.deposit || 0);
  const posted = appointmentPayments(appointment, transactions).reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const applied = posted + deposit;
  const due = Math.max(0, price - applied);
  const status = price <= 0 ? "No charge" : due <= 0 ? "Paid" : deposit > 0 || posted > 0 ? "Partial" : "Unpaid";
  return { price, deposit, posted, applied, due, status };
}

function appointmentTimelineStyle(appointment, services) {
  const start = parseTimeToMinutes(appointment.time);
  const duration = appointmentDurationMinutes(appointment, services);
  const end = start + duration;
  const range = scheduleEndMinutes - scheduleStartMinutes;
  const clampedStart = Math.max(scheduleStartMinutes, Math.min(scheduleEndMinutes, start));
  const clampedEnd = Math.max(clampedStart + 15, Math.min(scheduleEndMinutes, end));
  const left = ((clampedStart - scheduleStartMinutes) / range) * 100;
  const width = Math.max(7, ((clampedEnd - clampedStart) / range) * 100);
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
}

function uniqueRoomsFromBranches() {
  return [...new Set(branches.flatMap((branch) => branch.rooms))];
}

function stockStatus(item) {
  if (Number(item.stock) <= 0) return "Out";
  if (Number(item.stock) <= Number(item.reorder)) return "Reorder";
  return "Healthy";
}

function maskMobile(mobile) {
  if (!mobile) return "No mobile";
  return `${mobile.slice(0, 4)} *** ${mobile.slice(-4)}`;
}

function initialsFor(name) {
  return String(name ?? "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function ClientAvatar({ client, size = "medium" }) {
  const name = client?.fullName ?? "Client";
  const photo = client?.photo;

  return (
    <span className={`client-avatar ${size} ${photo ? "has-photo" : ""}`} aria-label={`${name} profile photo`}>
      {photo ? <img src={photo} alt="" /> : initialsFor(name)}
    </span>
  );
}

const legacyProductImages = new Set(["/brand/clinic.jpg", "/brand/result-1.jpg", "/brand/result-2.jpg", "/brand/clinic-davao.jpg"]);

function defaultProductImageFor(item) {
  const name = normalize(item?.item);
  if (name.includes("post-care") || name.includes("cream")) return "/brand/products/post-care-cream.png";
  if (name.includes("cleanser") || name.includes("kit")) return "/brand/products/cleanser-travel-kit.png";
  return "/brand/zenshotech-logo.svg";
}

function productImageFor(item) {
  if (item?.image && !legacyProductImages.has(item.image)) return item.image;
  return defaultProductImageFor(item);
}

function ProductThumbnail({ item }) {
  return (
    <span className="product-table-thumbnail" aria-label={`${item?.item ?? "Product"} photo`}>
      <img src={productImageFor(item)} alt="" />
    </span>
  );
}

function formatDate(date) {
  if (!date) return "Not set";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function formatDateTime(value) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatNotificationTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function leadFollowUpDisplay(value) {
  if (!value) return { date: "Not scheduled", time: "", relative: "No follow-up", tone: "none" };
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return { date: String(value), time: "", relative: "Scheduled", tone: "upcoming" };

  const now = new Date();
  const dayDifference = Math.round(
    (Date.parse(`${isoDate(dueAt)}T00:00:00Z`) - Date.parse(`${todayDate()}T00:00:00Z`)) / 86_400_000,
  );
  let relative = "";
  let tone = "upcoming";

  if (dayDifference < 0) {
    const days = Math.abs(dayDifference);
    relative = `${days} day${days === 1 ? "" : "s"} overdue`;
    tone = "overdue";
  } else if (dayDifference === 0) {
    relative = "Today";
    tone = dueAt.getTime() < now.getTime() ? "overdue" : "today";
  } else if (dayDifference === 1) {
    relative = "Tomorrow";
    tone = "tomorrow";
  } else {
    relative = `${dayDifference} days remaining`;
  }

  return {
    date: dueAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" }),
    time: dueAt.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" }),
    relative,
    tone,
  };
}

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey(key));
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(key), JSON.stringify(value));
    } catch {
      // Local workspace mode keeps working even when storage is unavailable.
    }
  }, [key, value]);

  return [value, setValue];
}

const defaultModuleId = "overview";
const moduleIdSet = new Set(navItems.map((item) => item.id));
const modulePathById = new Map(navItems.filter((item) => item.path).map((item) => [item.id, item.path]));
const moduleIdByPath = new Map(navItems.filter((item) => item.path).map((item) => [item.path, item.id]));
const recordDetailModules = new Set(["appointments", "clients", "leads", "treatments", "staff"]);
const mainSystemModules = new Set(["overview"]);

function recordDetailRouteFromPath(pathname) {
  const path = normalizedPathname(pathname);
  const match = path.match(/^\/(appointments|clients|leads|treatments|staff)\/([^/]+)$/);
  if (!match) return null;
  try {
    return { moduleId: match[1], recordId: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

function recordDetailPath(moduleId, recordId) {
  if (!recordDetailModules.has(moduleId) || !recordId) return modulePathById.get(moduleId) ?? `/#/${moduleId}`;
  return `/${moduleId}/${encodeURIComponent(recordId)}`;
}

function modulesForSession(session) {
  const serverModules = session?.access?.modules;
  if (Array.isArray(serverModules)) {
    return serverModules.filter((moduleId) => moduleIdSet.has(moduleId));
  }
  return roleAccess[session?.role] ?? [];
}

function landingModuleForSession(session) {
  const modules = modulesForSession(session);
  if (modules.includes("overview")) return "overview";
  if (modules.includes("pos")) return "pos";
  return modules[0] || defaultModuleId;
}

const mobilePrimaryNavConfig = [
  { id: "overview", label: "Home", icon: Home },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "pos", label: "POS", icon: WalletCards },
  { id: "clients", label: "Clients", icon: Users },
];
const mobileMoreSectionLabels = {
  main: "People",
  "clinic-operations": "Operations",
  "staff-branches": "People",
  "inventory-finance": "Business",
  marketing: "Marketing",
  system: "System",
  support: "Support",
};

function moduleFromHash(hash) {
  const segments = hashRouteSegments(hash);
  if (isMarketingHash(hash) || isLegacySmsHash(hash)) return "sms";
  if (segments.length !== 1) return "";
  return moduleIdSet.has(segments[0]) ? segments[0] : "";
}

function normalizedPathname(pathname) {
  const path = String(pathname ?? "/").replace(/\/+$/, "");
  return path || "/";
}

function moduleFromPath(pathname) {
  const path = normalizedPathname(pathname);
  const detailRoute = recordDetailRouteFromPath(path);
  if (detailRoute) return detailRoute.moduleId;
  if (path === "/attendance/kiosk") return "facetrack-attendance";
  if (path === "/marketing" || path.startsWith("/marketing/")) return "sms";
  if (path === "/flipbooks" || path.startsWith("/flipbooks/")) return "flipbooks";
  return moduleIdByPath.get(path) ?? "";
}

function publicFlipbookTokenFromPath(pathname) {
  const match = normalizedPathname(pathname).match(/^\/flipbook\/view\/([^/]+)$/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function downloadCsv(filename, rows, columns) {
  const header = columns.map((column) => column.label).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.exportValue ? column.exportValue(row) : row[column.key];
          const text = String(raw ?? "");
          const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
          return `"${safeText.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text ?? "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function App() {
  const [session, setSession] = useState(null);
  const [sessionNotice, setSessionNotice] = useState("");
  const sessionModules = useMemo(() => modulesForSession(session), [session]);
  const [authChecking, setAuthChecking] = useState(true);
  const initialPathModule = typeof window === "undefined" ? "" : moduleFromPath(window.location.pathname);
  const initialHashModule = typeof window === "undefined" ? "" : moduleFromHash(window.location.hash);
  const [activeModule, setActiveModuleState] = useStoredState("active-module", initialPathModule || initialHashModule || defaultModuleId);
  const [currentPath, setCurrentPath] = useState(() => typeof window === "undefined" ? "/" : normalizedPathname(window.location.pathname));
  const [branchScope, setBranchScope] = useState("All branches");
  const [branchSwitching, setBranchSwitching] = useState(false);
  const uploadMarketingImage = useCallback(
    (dataUrl, originalName = "") => uploadImageAsset(dataUrl, "marketing-image", branchScope === "All branches" ? session?.branch || "All branches" : branchScope, originalName),
    [branchScope, session?.branch],
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useStoredState("sidebar-collapsed", false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isEdgeSidebarOpen, setIsEdgeSidebarOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [appointmentCreateDate, setAppointmentCreateDate] = useState(() => todayDate());
  const [branchCreateRequest, setBranchCreateRequest] = useState(0);
  const [inviteCreateRequest, setInviteCreateRequest] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [receiptToPrint, setReceiptToPrint] = useState(null);
  const [printReceiptNonce, setPrintReceiptNonce] = useState(0);
  const inventoryImportInputRef = useRef(null);
  const clientImportInputRef = useRef(null);
  const staffUsersExportRef = useRef(null);
  const staffProfilesExportRef = useRef(null);
  const [isBooting, setIsBooting] = useState(true);
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [giftCertificates, setGiftCertificates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [staff, setStaff] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [consentSubmissions, setConsentSubmissions] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [branchRecords, setBranchRecords] = useState([]);
  const [settings, setSettings] = useState(() => stagingBrandSettings(initialSettings));
  const [leadIntegrations, setLeadIntegrations] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notificationFeed, setNotificationFeed] = useState({ notifications: [], readAt: null, unreadCount: 0 });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [organizationAccounts, setOrganizationAccounts] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [cart, setCart] = useState([]);
  const [posCarts, setPosCarts] = useState([]);
  const [sendingCampaignId, setSendingCampaignId] = useState("");
  const [isPosChromeRevealed, setIsPosChromeRevealed] = useState(false);
  const isPosView = activeModule === "pos";
  const isApplicationsView = activeModule === "applications";
  const isFaceTrackView = activeModule === "facetrack-attendance";
  const isMarketingView = activeModule === "sms";
  const isFlipbooksView = activeModule === "flipbooks";
  const isFaceTrackKioskView = typeof window !== "undefined" && normalizedPathname(window.location.pathname) === "/attendance/kiosk";
  const publicFlipbookToken = typeof window === "undefined" ? "" : publicFlipbookTokenFromPath(window.location.pathname);
  const publicFormMode = typeof window !== "undefined" && (
    normalizedPathname(window.location.pathname) === "/book"
    || window.location.hash.toLowerCase() === "#/book"
    || new URLSearchParams(window.location.search).get("form") === "appointment"
  ) ? "appointment" : "inquiry";
  const currentPublicPath = typeof window === "undefined" ? "/" : normalizedPathname(window.location.pathname);
  const currentPublicParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const isClientRegistrationView = typeof window !== "undefined" && (
    currentPublicPath === "/client-register"
    || (currentPublicPath === "/register" && currentPublicParams.has("branch"))
  );
  const isAccountRegistrationView = currentPublicPath === "/register" && !currentPublicParams.has("branch");
  const isPricingView = currentPublicPath === "/pricing";
  const isSubscriptionView = currentPublicPath === "/subscription";
  const isSubscriptionExpiredView = currentPublicPath === "/subscription/expired";
  const isSubscriptionRouteView = isAccountRegistrationView || isPricingView || isSubscriptionView || isSubscriptionExpiredView;
  const isPublicFormView = typeof window !== "undefined" && (
    ["/inquire", "/book", "/client-register"].includes(currentPublicPath)
    || isClientRegistrationView
    || ["#/inquire", "#/book"].includes(window.location.hash.toLowerCase())
  );
  const posTouchStartRef = useRef(null);
  const posChromeHideTimerRef = useRef(0);
  const globalCreateActions = useMemo(
    () => getGlobalCreateActions({
      moduleId: activeModule,
      sessionModules,
      canManageOrganization: canManageOrganization(session?.role),
      canInviteUsers: canManageOrganization(session?.role)
        || (["Branch Manager", "Admin"].includes(session?.role) && session?.access?.permissions?.includes("staff.invite")),
      context: { appointmentDate: appointmentCreateDate, roomBranch: branchScope },
    }),
    [activeModule, appointmentCreateDate, branchScope, session?.access?.permissions, session?.role, sessionModules],
  );

  const clearWorkspaceData = useCallback(() => {
    setClients([]);
    setAppointments([]);
    setServices([]);
    setInventory([]);
    setTransactions([]);
    setPosCarts([]);
    setTreatments([]);
    setPackages([]);
    setGiftCertificates([]);
    setLeads([]);
    setStaff([]);
    setExpenses([]);
    setDiscounts([]);
    setPromotions([]);
    setConsentTemplates([]);
    setConsentSubmissions([]);
    setSmsTemplates([]);
    setCampaigns([]);
    setBranchRecords([]);
    setLeadIntegrations([]);
    setWebhookEvents([]);
    setAuditLogs([]);
    setNotificationFeed({ notifications: [], readAt: null, unreadCount: 0 });
    setNotificationsLoading(false);
    setInventoryMovements([]);
    setOrganizationAccounts([]);
    setSelectedClientId("");
    setCart([]);
    setReceiptToPrint(null);
    setModal(null);
    setConfirm(null);
  }, []);

  const refreshNotifications = useCallback(async ({ silent = true } = {}) => {
    if (!session) return null;
    if (!silent) setNotificationsLoading(true);
    try {
      const nextFeed = await loadNotifications();
      setNotificationFeed({
        notifications: Array.isArray(nextFeed.notifications) ? nextFeed.notifications : [],
        readAt: nextFeed.readAt || null,
        unreadCount: Number(nextFeed.unreadCount || 0),
      });
      return nextFeed;
    } catch {
      return null;
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    try {
      retiredSensitiveStorageKeys.forEach((key) => window.localStorage.removeItem(storageKey(key)));
    } catch {
      // Storage may be unavailable in private browsing; no workspace data is persisted either way.
    }
  }, []);

  const clearPosChromeHideTimer = useCallback(() => {
    if (typeof window === "undefined" || !posChromeHideTimerRef.current) return;
    window.clearTimeout(posChromeHideTimerRef.current);
    posChromeHideTimerRef.current = 0;
  }, []);

  const revealPosChrome = useCallback(
    ({ temporary = false } = {}) => {
      if (!isPosView) return;
      clearPosChromeHideTimer();
      setIsPosChromeRevealed(true);

      if (temporary && typeof window !== "undefined") {
        posChromeHideTimerRef.current = window.setTimeout(() => {
          setIsPosChromeRevealed(false);
          posChromeHideTimerRef.current = 0;
        }, 5200);
      }
    },
    [clearPosChromeHideTimer, isPosView],
  );

  const hidePosChrome = useCallback(() => {
    clearPosChromeHideTimer();
    setIsPosChromeRevealed(false);
  }, [clearPosChromeHideTimer]);

  useEffect(() => {
    setApiSessionContext(session);
  }, [session]);

  useEffect(() => {
    if (!session || typeof window === "undefined") return undefined;

    void refreshNotifications({ silent: false });
    const pollTimer = window.setInterval(() => {
      void refreshNotifications();
    }, 30_000);
    const handleNewNotification = () => {
      void refreshNotifications();
    };
    const handleFocus = () => {
      void refreshNotifications();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };

    window.addEventListener(apiNotificationCreatedEvent, handleNewNotification);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener(apiNotificationCreatedEvent, handleNewNotification);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshNotifications, session]);

  useEffect(() => {
    function handleAuthenticationRequired() {
      clearWorkspaceData();
      setSession(null);
      setSessionNotice("Your session expired. Sign in again to continue.");
    }

    window.addEventListener(apiAuthenticationRequiredEvent, handleAuthenticationRequired);
    return () => window.removeEventListener(apiAuthenticationRequiredEvent, handleAuthenticationRequired);
  }, [clearWorkspaceData]);

  useEffect(() => {
    if (!session?.access) return;
    setBranchScope(session.access.scope === "all" ? "All branches" : session.access.activeBranch?.name || session.branch);
  }, [session]);

  const switchBranch = useCallback(async (branchId) => {
    if (!session || branchId === session.access?.activeBranchId) return;
    setBranchSwitching(true);
    clearWorkspaceData();
    try {
      const result = await selectActiveBranch(branchId);
      setSession(result.account);
      setGlobalSearch("");
      notify(result.account.access?.scope === "all"
        ? "Showing organization-wide data."
        : `Switched to ${result.account.access?.activeBranch?.name}.`);
    } catch (error) {
      setSession((current) => current ? { ...current } : current);
      notify(error.message || "Unable to switch branches.", "error");
    } finally {
      setBranchSwitching(false);
    }
  }, [clearWorkspaceData, session]);

  useEffect(() => {
    let cancelled = false;
    restoreAccountSession()
      .then((result) => {
        if (!cancelled) setSession(result.account);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isPosView) return;
    posTouchStartRef.current = null;
    hidePosChrome();
  }, [hidePosChrome, isPosView]);

  useEffect(() => {
    if (!isPosView || typeof window === "undefined") return undefined;

    const topSwipeStartLimit = 42;
    const revealDistance = 46;

    function handleTouchStart(event) {
      const touch = event.touches?.[0];
      if (!touch || event.target?.closest?.(".pos-top-chrome")) {
        posTouchStartRef.current = null;
        return;
      }

      posTouchStartRef.current =
        touch.clientY <= topSwipeStartLimit
          ? {
              x: touch.clientX,
              y: touch.clientY,
            }
          : null;
    }

    function handleTouchMove(event) {
      const touch = event.touches?.[0];
      const start = posTouchStartRef.current;
      if (!touch || !start) return;

      const deltaY = touch.clientY - start.y;
      const deltaX = Math.abs(touch.clientX - start.x);
      if (deltaY >= revealDistance && deltaY > deltaX * 1.15) {
        revealPosChrome({ temporary: true });
        posTouchStartRef.current = null;
      }
    }

    function clearTouchStart() {
      posTouchStartRef.current = null;
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", clearTouchStart);
    window.addEventListener("touchcancel", clearTouchStart);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", clearTouchStart);
      window.removeEventListener("touchcancel", clearTouchStart);
    };
  }, [isPosView, revealPosChrome]);

  const setActiveModule = useCallback(
    (moduleId, options = {}) => {
      const requestedModule = moduleIdSet.has(moduleId) ? moduleId : defaultModuleId;
      const fallbackModule = sessionModules.includes(defaultModuleId)
        ? defaultModuleId
        : sessionModules[0] || "";
      const nextModule = !session || sessionModules.includes(requestedModule)
        ? requestedModule
        : fallbackModule;
      if (!nextModule) return;
      setActiveModuleState(nextModule);
      setGlobalSearch("");

      if (typeof window !== "undefined") {
        const nextUrl = nextModule === "flipbooks"
          ? (normalizedPathname(window.location.pathname).startsWith("/flipbooks")
            ? `${window.location.pathname}${window.location.search}`
            : "/flipbooks")
          : nextModule === "sms"
            ? (normalizedPathname(window.location.pathname).startsWith("/marketing")
              ? `${window.location.pathname}${window.location.search}`
              : marketingPath())
            : modulePathById.get(nextModule) ?? `/#/${nextModule}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentUrl !== nextUrl) {
          if (options.replace) {
            window.history.replaceState(null, "", nextUrl);
          } else {
            window.history.pushState(null, "", nextUrl);
          }
        }
        setCurrentPath(normalizedPathname(new URL(nextUrl, window.location.origin).pathname));

        if (!options.preserveScroll) {
          window.requestAnimationFrame(() => window.scrollTo(0, 0));
        }
      }

      if (!options.keepDrawerOpen) {
        setIsSidebarDrawerOpen(false);
      }
      setIsEdgeSidebarOpen(false);
      setIsMobileMoreOpen(false);
    },
    [session, sessionModules, setActiveModuleState],
  );

  const openRecordPage = useCallback((moduleId, recordId) => {
    if (!recordDetailModules.has(moduleId) || !recordId) return;
    const nextUrl = recordDetailPath(moduleId, recordId);
    setActiveModuleState(moduleId);
    setGlobalSearch("");
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", nextUrl);
      setCurrentPath(normalizedPathname(window.location.pathname));
      window.requestAnimationFrame(() => window.scrollTo(0, 0));
    }
    setIsSidebarDrawerOpen(false);
    setIsEdgeSidebarOpen(false);
    setIsMobileMoreOpen(false);
  }, [setActiveModuleState]);

  useEffect(() => {
    if (!session || typeof window === "undefined") return undefined;
    const canOpenPosShortcut = sessionModules.includes("pos");
    if (!canOpenPosShortcut) return undefined;

    function openPosFromKeyboard(event) {
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setActiveModule(activeModule === "pos" ? (isAdmin(session.role) ? "overview" : "my-workspace") : "pos");
      }
    }

    window.addEventListener("keydown", openPosFromKeyboard);
    return () => window.removeEventListener("keydown", openPosFromKeyboard);
  }, [activeModule, session, sessionModules, setActiveModule]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function syncModuleFromLocation() {
      setCurrentPath(normalizedPathname(window.location.pathname));
      const detailRoute = recordDetailRouteFromPath(window.location.pathname);
      if (detailRoute) {
        setActiveModuleState(detailRoute.moduleId);
        return;
      }
      const routeModule = moduleFromPath(window.location.pathname) || moduleFromHash(window.location.hash);
      if (routeModule) {
        if (routeModule === "sms" && isMarketingHash(window.location.hash)) {
          const legacyMarketingRoute = marketingRouteFromHash(window.location.hash);
          const nextPath = marketingPath(legacyMarketingRoute?.section, legacyMarketingRoute?.mode);
          window.history.replaceState(null, "", nextPath);
          setCurrentPath(nextPath);
          setActiveModuleState("sms");
          return;
        }
        setActiveModule(routeModule, { replace: true });
      }
    }

    syncModuleFromLocation();
    window.addEventListener("hashchange", syncModuleFromLocation);
    window.addEventListener("popstate", syncModuleFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncModuleFromLocation);
      window.removeEventListener("popstate", syncModuleFromLocation);
    };
  }, [setActiveModule, setActiveModuleState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPublicFormView) return;
    if (isSubscriptionRouteView) return;
    if (publicFlipbookToken) return;
    const publicQuery = new URLSearchParams(window.location.search);
    if (normalizedPathname(window.location.pathname) === "/accept-invitation" || publicQuery.has("invitation") || publicQuery.has("token")) return;
    if (moduleFromPath(window.location.pathname)) return;
    if (!moduleFromHash(window.location.hash)) {
      setActiveModule(activeModule, { replace: true, keepDrawerOpen: true });
    }
  }, [activeModule, isPublicFormView, isSubscriptionRouteView, publicFlipbookToken, setActiveModule]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBooting(false), 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.toggle("mobile-more-locked", isMobileMoreOpen);
    return () => document.body.classList.remove("mobile-more-locked");
  }, [isMobileMoreOpen]);

  useEffect(() => {
    if (!isMobileMoreOpen || typeof window === "undefined") return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsMobileMoreOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMoreOpen]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;

    async function hydrateFromApi() {
      try {
        const [, bootstrap, accountResult] = await Promise.all([
          checkApiHealth(),
          loadBootstrap(),
          (canManageOrganization(session.role) || session.organizationPermissions?.includes("branches.manage"))
            ? loadOrganizationAccounts().catch(() => ({ accounts: [] }))
            : Promise.resolve({ accounts: [] }),
        ]);
        if (cancelled) return;

        const apiClients = Array.isArray(bootstrap.clients) ? bootstrap.clients : [];
        setClients(apiClients);
        setAppointments(Array.isArray(bootstrap.appointments) ? bootstrap.appointments : []);
        setServices(Array.isArray(bootstrap.services) ? bootstrap.services : []);
        setInventory(Array.isArray(bootstrap.inventory) ? bootstrap.inventory : []);
        setTransactions(Array.isArray(bootstrap.transactions) ? bootstrap.transactions : []);
        setPosCarts(Array.isArray(bootstrap.posCarts) ? bootstrap.posCarts : []);
        setTreatments(Array.isArray(bootstrap.treatments) ? bootstrap.treatments : []);
        setPackages(Array.isArray(bootstrap.packages) ? bootstrap.packages : []);
        setGiftCertificates(Array.isArray(bootstrap.giftCertificates) ? bootstrap.giftCertificates : []);
        setLeads(Array.isArray(bootstrap.leads) ? bootstrap.leads : []);
        setStaff(Array.isArray(bootstrap.staff) ? bootstrap.staff : []);
        setExpenses(Array.isArray(bootstrap.expenses) ? bootstrap.expenses : []);
        setDiscounts(Array.isArray(bootstrap.discounts) ? bootstrap.discounts : []);
        setPromotions(Array.isArray(bootstrap.promotions) ? bootstrap.promotions : []);
        setConsentTemplates(Array.isArray(bootstrap.consentTemplates) ? bootstrap.consentTemplates : []);
        setConsentSubmissions(Array.isArray(bootstrap.consentSubmissions) ? bootstrap.consentSubmissions : []);
        setSmsTemplates(Array.isArray(bootstrap.smsTemplates) ? bootstrap.smsTemplates : []);
        setCampaigns(Array.isArray(bootstrap.campaigns) ? bootstrap.campaigns : []);
        setAuditLogs(Array.isArray(bootstrap.auditLogs) ? bootstrap.auditLogs : []);
        setInventoryMovements(Array.isArray(bootstrap.inventoryMovements) ? bootstrap.inventoryMovements : []);
        setOrganizationAccounts(Array.isArray(accountResult.accounts) ? accountResult.accounts : []);
        setLeadIntegrations(Array.isArray(bootstrap.leadIntegrations) ? bootstrap.leadIntegrations : []);
        setWebhookEvents(Array.isArray(bootstrap.webhookEvents) ? bootstrap.webhookEvents : []);
        setBranchRecords(Array.isArray(bootstrap.branches) ? bootstrap.branches : []);
        if (bootstrap.settings) {
          setSettings(stagingBrandSettings(bootstrap.settings));
        }

        if (apiClients.length) {
          setSelectedClientId((current) =>
            apiClients.some((client) => client.id === current) ? current : apiClients[0].id,
          );
        }

      } catch {
        try {
          const apiClients = await listResourceRecords("clients");
          if (cancelled) return;

          if (Array.isArray(apiClients)) {
            setClients(apiClients);
            if (apiClients.length) {
              setSelectedClientId((current) =>
                apiClients.some((client) => client.id === current) ? current : apiClients[0].id,
              );
            }
            return;
          }
        } catch {
          // The dedicated client fallback is best-effort; retain the full offline state below.
        }
      }
    }

    hydrateFromApi();

    return () => {
      cancelled = true;
    };
  }, [session, setClients, setSelectedClientId]);

  useEffect(() => {
    if (!session) return;
    if (!sessionModules.includes(activeModule)) {
      setIsMobileMoreOpen(false);
      setActiveModule(landingModuleForSession(session), { replace: true });
    }
  }, [activeModule, session, sessionModules, setActiveModule]);

  useEffect(() => {
    if (session && isAdmin(session.role) && activeModule === "my-workspace") {
      setActiveModule("overview", { replace: true });
    }
  }, [activeModule, session, setActiveModule]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!printReceiptNonce || !receiptToPrint || typeof window === "undefined") return undefined;

    let cancelled = false;
    let secondFrame = 0;
    const cleanupPrintState = () => {
      document.body.classList.remove("printing-receipt");
      window.removeEventListener("afterprint", cleanupPrintState);
    };

    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        document.body.classList.add("printing-receipt");
        window.addEventListener("afterprint", cleanupPrintState, { once: true });
        window.print();
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      cleanupPrintState();
    };
  }, [printReceiptNonce, receiptToPrint]);

  const visibleNav = useMemo(() => {
    if (!session) return [];
    return navItems.filter((item) => (
      sessionModules.includes(item.id)
      && !(isAdmin(session.role) && item.id === "my-workspace")
    ));
  }, [session, sessionModules]);

  const visibleNavSections = useMemo(() => {
    const visibleIds = new Set(visibleNav.map((item) => item.id));
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => visibleIds.has(item.id)),
      }))
      .filter((section) => section.items.length > 0);
  }, [visibleNav]);

  const mobilePrimaryNav = useMemo(() => {
    const visibleIds = new Set(visibleNav.map((item) => item.id));
    return mobilePrimaryNavConfig
      .filter((item) => visibleIds.has(item.id))
      .map((item) => ({
        ...visibleNav.find((navItem) => navItem.id === item.id),
        ...item,
      }));
  }, [visibleNav]);

  const mobileMoreSections = useMemo(() => {
    const primaryIds = new Set(mobilePrimaryNav.map((item) => item.id));
    return visibleNavSections
      .map((section) => ({
        ...section,
        label: mobileMoreSectionLabels[section.id] ?? section.label,
        items: section.items.filter((item) => !primaryIds.has(item.id)),
      }))
      .filter((section) => section.items.length > 0);
  }, [mobilePrimaryNav, visibleNavSections]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? clients[0],
    [clients, selectedClientId],
  );
  const activeRecordRoute = useMemo(() => recordDetailRouteFromPath(currentPath), [currentPath]);
  const activeRecord = useMemo(() => {
    if (!activeRecordRoute) return null;
    const recordsByModule = {
      appointments,
      clients,
      leads,
      treatments,
      staff,
    };
    return recordsByModule[activeRecordRoute.moduleId]?.find((record) => record.id === activeRecordRoute.recordId) ?? null;
  }, [activeRecordRoute, appointments, clients, leads, staff, treatments]);
  const activeRecordTitle = activeRecordRoute?.moduleId === "appointments"
    ? activeRecord?.client
    : activeRecordRoute?.moduleId === "clients"
      ? activeRecord?.fullName
      : activeRecordRoute?.moduleId === "leads"
        ? activeRecord?.name
        : activeRecordRoute?.moduleId === "treatments"
          ? activeRecord?.service || activeRecord?.client
          : activeRecordRoute?.moduleId === "staff"
            ? activeRecord?.name
            : "";

  useEffect(() => {
    if (typeof document === "undefined" || isPublicFormView || isSubscriptionRouteView || publicFlipbookToken || isFaceTrackKioskView) return;
    const pageLabel = activeRecordTitle || navItems.find((item) => item.id === activeModule)?.label || "Dashboard";
    document.title = `${pageLabel} — ZenshoTech`;
  }, [activeModule, activeRecordTitle, isFaceTrackKioskView, isPublicFormView, isSubscriptionRouteView, publicFlipbookToken]);

  const scopedAppointments = useMemo(
    () => appointments.filter((item) => branchScope === "All branches" || item.branch === branchScope),
    [appointments, branchScope],
  );

  const scopedTransactions = useMemo(
    () => transactions.filter((item) => branchScope === "All branches" || item.branch === branchScope),
    [transactions, branchScope],
  );

  const scopedInventory = useMemo(
    () => inventory.filter((item) => branchScope === "All branches" || item.branch === branchScope),
    [inventory, branchScope],
  );

  const scopeRecords = useCallback(
    (records) => records.filter((item) => branchScope === "All branches" || item.branch === branchScope),
    [branchScope],
  );

  const scopedClients = useMemo(() => scopeRecords(clients), [clients, scopeRecords]);
  const scopedExpenses = useMemo(() => scopeRecords(expenses), [expenses, scopeRecords]);
  const scopedLeads = useMemo(() => scopeRecords(leads), [leads, scopeRecords]);
  const scopedStaff = useMemo(() => scopeRecords(staff), [staff, scopeRecords]);
  const scopedTreatments = useMemo(() => {
    if (branchScope === "All branches") return treatments;
    const scopedClientIds = new Set(scopedClients.map((client) => client.id));
    const scopedClientNames = new Set(scopedClients.map((client) => normalize(client.fullName)));
    return treatments.filter((treatment) => (
      (treatment.clientId && scopedClientIds.has(treatment.clientId))
      || scopedClientNames.has(normalize(treatment.client))
    ));
  }, [branchScope, scopedClients, treatments]);
  const scopedPackages = useMemo(() => scopeRecords(packages), [packages, scopeRecords]);

  const searchableServices = useMemo(
    () => services.filter((service) => branchScope === "All branches" || !splitList(service.branches).length || splitList(service.branches).includes(branchScope)),
    [branchScope, services],
  );

  const headerSearchMeta = useMemo(() => {
    const labels = {
      appointments: ["Search appointments", "Client, phone, service, staff, or booking ID"],
      "card-view": ["Search appointments", "Client, service, staff, or booking ID"],
      clients: ["Search clients", "Name, mobile, email, client ID, or package"],
      leads: ["Search leads", "Name, phone, service, campaign, or owner"],
      treatments: ["Search treatments", "Client, procedure, provider, room, or batch"],
      services: ["Search services", "Service name, category, room, or description"],
      inventory: ["Search inventory", "Item, category, supplier, branch, or stock status"],
      packages: ["Search packages", "Package, client, certificate, or status"],
      staff: ["Search staff", "Name, role, branch, phone, or email"],
      branches: ["Search branches", "Branch name, code, city, address, or email"],
      expenses: ["Search expenses", "Expense, category, vendor, reference, or branch"],
      reports: ["Search report records", "Invoice, client, service, branch, or status"],
      pos: ["Search POS", "Client, service, product, package, or invoice"],
      settings: ["Search settings records", "Promotion, discount, consent, or payment method"],
    };
    const [label = "Search unavailable", placeholder = "No searchable records in this section"] = labels[activeModule] || [];
    return { label, placeholder, disabled: !labels[activeModule] || Boolean(activeRecordRoute) };
  }, [activeModule, activeRecordRoute]);

  const getHeaderSearchResults = useCallback((rawQuery) => {
    const query = normalize(rawQuery);
    if (!query) return [];
    const includesQuery = (...values) => normalize(values.filter(Boolean).join(" ")).includes(query);
    const take = (records, mapResult) => records.filter((record) => mapResult(record).matches).slice(0, 8).map((record) => {
      const result = mapResult(record);
      delete result.matches;
      return result;
    });

    if (["appointments", "card-view"].includes(activeModule)) return take(scopedAppointments, (item) => {
      const client = clients.find((person) => person.id === item.clientId || person.fullName === item.client);
      return {
        matches: includesQuery(item.id, item.client, client?.mobile, item.service, item.staff, item.room, item.branch, item.status),
        id: item.id, kind: "Appointment", title: item.client || "Unlinked client",
        subtitle: `${item.service || "Service pending"} · ${formatDate(item.date)} ${item.time || ""}`,
        meta: canonicalAppointmentStatus(item.status), routeModule: "appointments",
      };
    });
    if (activeModule === "clients") return take(scopedClients, (item) => ({
      matches: includesQuery(item.id, item.fullName, item.firstName, item.middleName, item.lastName, item.mobile, item.email, item.branch, item.tag, item.packageBalance),
      id: item.id, kind: "Client", title: item.fullName, subtitle: [item.mobile, item.email].filter(Boolean).join(" · "), meta: item.branch, routeModule: "clients",
    }));
    if (activeModule === "leads") return take(scopedLeads, (item) => ({
      matches: includesQuery(item.id, item.externalLeadId, item.name, item.mobile, item.email, item.interest, item.interestedTreatment, item.interestedPackage, item.campaign, item.utmCampaign, item.owner, item.source, item.branch),
      id: item.id, kind: "Lead", title: item.name, subtitle: [item.interest || item.interestedTreatment || item.interestedPackage, item.source].filter(Boolean).join(" · "), meta: canonicalLeadStatus(item.status), routeModule: "leads",
    }));
    if (activeModule === "treatments") return take(scopedTreatments, (item) => ({
      matches: includesQuery(item.id, item.client, item.service, item.provider, item.room, item.batch, item.preNotes, item.postNotes),
      id: item.id, kind: "Treatment", title: item.client || "Unlinked client", subtitle: `${item.service || "Treatment"} · ${item.provider || "Provider pending"}`, meta: formatDate(item.date), routeModule: "treatments",
    }));
    if (activeModule === "services") return take(searchableServices, (item) => ({
      matches: includesQuery(item.id, item.name, item.category, item.room, item.description, item.status),
      id: item.id, kind: "Service", title: item.name, subtitle: `${item.category || "Uncategorized"} · ${item.duration || 0} min`, meta: servicePriceLabel(item), modalType: "service", record: item,
    }));
    if (activeModule === "inventory") return take(scopedInventory, (item) => ({
      matches: includesQuery(item.id, item.item, item.category, item.supplier, item.branch, item.unit, stockStatus(item)),
      id: item.id, kind: "Inventory", title: item.item, subtitle: `${item.stock || 0} ${item.unit || "units"} · ${item.branch || "All branches"}`, meta: stockStatus(item), modalType: "inventory", record: item,
    }));
    if (activeModule === "packages") {
      const packageResults = take(scopedPackages, (item) => ({
        matches: includesQuery(item.id, item.name, item.client, item.status, item.service),
        id: item.id, kind: "Package", title: item.name, subtitle: `${item.client || "Unassigned"} · ${item.used || 0}/${item.sessions || 0} sessions`, meta: item.status || "Active",
      }));
      const certificateResults = take(giftCertificates, (item) => ({
        matches: includesQuery(item.id, item.code, item.client, item.service, item.status),
        id: item.id, kind: "Gift certificate", title: item.code, subtitle: [item.client, item.service].filter(Boolean).join(" · "), meta: item.status || "Active",
      }));
      return [...packageResults, ...certificateResults].slice(0, 8);
    }
    if (activeModule === "staff") return take(scopedStaff, (item) => ({
      matches: includesQuery(item.id, item.name, item.role, item.department, item.branch, item.branches, item.phone, item.email, item.status),
      id: item.id, kind: "Staff", title: item.name, subtitle: `${item.role || "Team member"} · ${item.branch || "Unassigned"}`, meta: item.status, routeModule: "staff",
    }));
    if (activeModule === "branches") return take(branchRecords, (item) => ({
      matches: includesQuery(item.id, item.name, item.code, item.city, item.address, item.phone, item.email, item.status),
      id: item.id, kind: "Branch", title: item.name, subtitle: item.address || item.city, meta: item.status,
    }));
    if (activeModule === "expenses") return take(scopedExpenses, (item) => ({
      matches: includesQuery(item.id, item.name, item.category, item.vendor, item.reference, item.branch, item.status),
      id: item.id, kind: "Expense", title: item.name || item.category, subtitle: [item.vendor, item.branch].filter(Boolean).join(" · "), meta: money.format(Number(item.amount || 0)), modalType: "expense", record: item,
    }));
    if (["reports", "pos"].includes(activeModule)) return take(scopedTransactions, (item) => ({
      matches: includesQuery(item.id, item.invoice, item.client, item.branch, item.status, item.paymentMethod, ...(item.items || []).map((entry) => entry.name)),
      id: item.id, kind: "Transaction", title: item.invoice || item.id, subtitle: `${item.client || "Walk-in"} · ${formatDate(item.date)}`, meta: money.format(Number(item.total || 0)), receipt: item,
    }));
    if (activeModule === "settings") {
      const rows = [...discounts.map((item) => ({ ...item, kind: "Discount" })), ...promotions.map((item) => ({ ...item, kind: "Promotion" })), ...consentTemplates.map((item) => ({ ...item, kind: "Consent" }))];
      return take(rows, (item) => ({
        matches: includesQuery(item.id, item.name, item.code, item.description, item.type, item.status, item.kind),
        id: item.id, kind: item.kind, title: item.name || item.code || item.id, subtitle: item.description || item.type, meta: item.status,
      }));
    }
    return [];
  }, [activeModule, branchRecords, clients, consentTemplates, discounts, giftCertificates, promotions, scopedAppointments, scopedClients, scopedExpenses, scopedInventory, scopedLeads, scopedPackages, scopedStaff, scopedTransactions, scopedTreatments, searchableServices]);

  function handleHeaderSearchSelect(result) {
    if (result.routeModule) {
      setGlobalSearch("");
      openRecordPage(result.routeModule, result.id);
      return;
    }
    if (result.modalType) {
      openModal(result.modalType, result.record);
      return;
    }
    if (result.receipt) printReceipt(result.receipt);
  }

  const stats = useMemo(() => {
    const today = todayDate();
    const todaysTransactions = scopedTransactions.filter((transaction) => transaction.date === today && transaction.status !== "Void" && !transaction.testMode);
    const monthPrefix = today.slice(0, 7);
    const monthTransactions = scopedTransactions.filter((transaction) => transaction.date?.startsWith(monthPrefix) && transaction.status !== "Void" && !transaction.testMode);
    const revenueToday = todaysTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const revenueMonth = monthTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const expensesMonth = scopedExpenses
      .filter((expense) => expense.date?.startsWith(monthPrefix))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const todaysAppointments = scopedAppointments.filter((appointment) => appointment.date === today);
    const pendingAppointments = scopedAppointments.filter((appointment) => canonicalAppointmentStatus(appointment.status) === "Pending Confirmation");
    const noShows = scopedAppointments.filter((appointment) => canonicalAppointmentStatus(appointment.status) === "No Show");
    const lowStock = scopedInventory.filter((item) => stockStatus(item) !== "Healthy");
    const openLeads = scopedLeads.filter((lead) => !closedLeadStatuses.includes(canonicalLeadStatus(lead.status)));
    const servicesToday = todaysTransactions.reduce(
      (sum, transaction) => sum + transaction.items.filter((item) => item.type === "Service").length,
      0,
    );

    return {
      revenueToday,
      revenueMonth,
      expensesMonth,
      netProfit: revenueMonth - expensesMonth,
      todaysAppointments,
      pendingAppointments,
      noShows,
      lowStock,
      openLeads,
      servicesToday,
      newClients: scopedClients.filter((client) => client.retention === "New").length,
      returningClients: scopedClients.filter((client) => client.retention === "Returning").length,
    };
  }, [scopedAppointments, scopedClients, scopedExpenses, scopedInventory, scopedLeads, scopedTransactions]);

  function notify(message, tone = "success") {
    setToast({ id: createId("toast"), message, tone });
  }

  async function markAllNotificationsAsRead() {
    if (!notificationFeed.unreadCount) return;
    setNotificationsLoading(true);
    try {
      const nextFeed = await markNotificationsRead();
      setNotificationFeed({
        notifications: Array.isArray(nextFeed.notifications) ? nextFeed.notifications : [],
        readAt: nextFeed.readAt || null,
        unreadCount: Number(nextFeed.unreadCount || 0),
      });
    } catch (error) {
      notify(error.message || "Unable to update notifications.", "error");
    } finally {
      setNotificationsLoading(false);
    }
  }

  function printReceipt(receipt) {
    if (!receipt) {
      notify("Add items or select a transaction before printing a receipt.", "warning");
      return;
    }
    setReceiptToPrint(receipt);
    setPrintReceiptNonce((current) => current + 1);
  }

  function upsertById(setter, record, options = {}) {
    if (!record?.id) return;
    setter((current) => {
      const exists = current.some((item) => item.id === record.id);
      if (exists) {
        return current.map((item) => (item.id === record.id ? record : item));
      }
      return options.append ? [...current, record] : [record, ...current];
    });
  }

  function removeById(setter, id) {
    setter((current) => current.filter((item) => item.id !== id));
  }

  function applyAuditLog(auditLog) {
    if (!auditLog?.id) return;
    setAuditLogs((current) => [auditLog, ...current.filter((item) => item.id !== auditLog.id)].slice(0, 150));
  }

  function addAudit(action, details, area = "System", actor = session) {
    setAuditLogs((current) => [
      {
        id: createId("audit"),
        time: new Date().toLocaleString("en-PH"),
        actor: actor?.name ?? "System",
        role: actor?.role ?? "System",
        area,
        action,
        details,
      },
      ...current,
    ].slice(0, 150));
  }

  async function handleLogin(email, password) {
    const result = await loginAccount(email, password);
    const user = result.account;
    setSessionNotice("");
    setSession(user);
    setActiveModule(landingModuleForSession(user), { replace: true });
    addAudit("Signed in", `${user.name} opened ${settings.productName} as ${user.role}.`, "Authentication", user);
    notify(`Welcome, ${user.name}.`);
  }

  function navigateToPath(path, { replace = false } = {}) {
    if (typeof window === "undefined") return;
    if (replace) window.history.replaceState(null, "", path);
    else window.history.pushState(null, "", path);
    setCurrentPath(normalizedPathname(new URL(path, window.location.origin).pathname));
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo(0, 0);
  }

  function handleRegistrationComplete(result) {
    setSessionNotice("");
    setSession(result.account);
    if (result.message) notify(result.message, result.confirmationEmailSent === false ? "warning" : "success");
    navigateToPath(result.redirectTo || "/pricing?onboarding=1", { replace: true });
  }

  function handleGoogleAuthentication(result) {
    const user = result.account;
    setSessionNotice("");
    setSession(user);
    if (result.redirectTo?.startsWith("/pricing")) {
      navigateToPath(result.redirectTo, { replace: true });
    } else {
      setActiveModule(landingModuleForSession(user), { replace: true });
      if (result.redirectTo && result.redirectTo !== "/dashboard") navigateToPath(result.redirectTo, { replace: true });
    }
    notify(result.message || `Welcome, ${user.name}.`, result.confirmationEmailSent === false ? "warning" : "success");
  }

  function handleSubscriptionSession(result) {
    if (result.account) setSession(result.account);
    if (result.redirectTo) {
      setActiveModuleState("overview");
      navigateToPath(result.redirectTo, { replace: true });
    }
  }

  async function handleLogout() {
    addAudit("Signed out", `${session?.name ?? "User"} ended the workspace session.`, "Authentication");
    await logoutAccount().catch(() => {});
    clearWorkspaceData();
    setSessionNotice("");
    setSession(null);
    setActiveModule("overview");
  }

  async function handlePasswordChange(currentPassword, newPassword) {
    const result = await changeAccountPassword(currentPassword, newPassword);
    setSession(result.account);
    notify("Password updated securely.");
  }

  async function createBranch(values) {
    const result = await createBranchRecord(values);
    setBranchRecords((current) => [...current.filter((item) => item.id !== result.branch.id), result.branch].sort((a, b) => a.name.localeCompare(b.name)));
    applyAuditLog(result.auditLog);
    notify(`${result.branch.name} created.`);
    return result.branch;
  }

  function reassignLocalBranchRecords(previousName, nextName) {
    if (!previousName || !nextName || previousName === nextName) return;
    const rename = (item) => item.branch === previousName ? { ...item, branch: nextName } : item;
    setClients((current) => current.map(rename));
    setAppointments((current) => current.map(rename));
    setInventory((current) => current.map(rename));
    setTransactions((current) => current.map(rename));
    setPackages((current) => current.map(rename));
    setGiftCertificates((current) => current.map(rename));
    setStaff((current) => current.map(rename));
    setExpenses((current) => current.map(rename));
    setInventoryMovements((current) => current.map(rename));
    setLeads((current) => current.map((item) => ({
      ...rename(item),
      assignedBranch: item.assignedBranch === previousName ? nextName : item.assignedBranch,
    })));
    setServices((current) => current.map((service) => ({
      ...service,
      branches: Array.isArray(service.branches)
        ? [...new Set(service.branches.map((name) => name === previousName ? nextName : name))]
        : service.branches,
    })));
  }

  async function updateBranch(branch, values) {
    const result = await updateBranchRecord(branch.id, values);
    setBranchRecords((current) => [...current.filter((item) => item.id !== result.branch.id), result.branch].sort((a, b) => a.name.localeCompare(b.name)));
    if (result.previousName && result.previousName !== result.branch.name) {
      reassignLocalBranchRecords(result.previousName, result.branch.name);
      if (branchScope === result.previousName) setBranchScope(result.branch.name);
    }
    applyAuditLog(result.auditLog);
    notify(`${result.branch.name} updated.`);
    return result.branch;
  }

  async function archiveBranch(branch) {
    const result = await archiveBranchRecord(branch.id);
    replaceBranchRecord(result.branch);
    if (branchScope === branch.name) void switchBranch("all");
    applyAuditLog(result.auditLog);
    notify(`${branch.name} archived. Historical records were preserved.`);
    return result.branch;
  }

  async function reactivateBranch(branch) {
    const result = await reactivateBranchRecord(branch.id);
    replaceBranchRecord(result.branch);
    applyAuditLog(result.auditLog);
    notify(`${branch.name} reactivated.`);
    return result.branch;
  }

  function replaceBranchRecord(branch) {
    if (!branch?.id) return;
    setBranchRecords((current) => [
      ...current.filter((item) => item.id !== branch.id),
      branch,
    ].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function saveRoom(values) {
    const result = await createRoomRecord(values);
    replaceBranchRecord(result.branch);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(`${result.room.name} added to ${result.room.branch}.`);
    return result.room;
  }

  async function deleteRoom(room) {
    const result = await deleteRoomRecord(room.id);
    replaceBranchRecord(result.branch);
    applyAuditLog(result.auditLog);
    notify(`${result.room.name} removed from active scheduling.`);
    return result.room;
  }

  function openModal(type, payload = {}) {
    setModal({ type, payload });
  }

  function handleGlobalCreateAction(action) {
    if (action.handler === "branch-create") {
      setBranchCreateRequest((current) => current + 1);
      return;
    }
    if (action.handler === "invite-user") {
      setActiveModule("staff");
      setInviteCreateRequest((current) => current + 1);
      return;
    }
    if (action.handler === "inventory-import") {
      inventoryImportInputRef.current?.click();
      return;
    }
    if (action.handler === "inventory-export") {
      downloadCsv("zenshotech-inventory.csv", scopedInventory, inventoryCsvExportColumns);
      return;
    }
    if (action.handler === "client-import") {
      clientImportInputRef.current?.click();
      return;
    }
    if (action.handler === "client-export") {
      downloadCsv("zenshotech-clients.csv", scopedClients, [
        { key: "id", label: "Client ID" },
        { key: "fullName", label: "Name" },
        { key: "mobile", label: "Mobile", exportValue: (client) => sensitiveAllowed ? client.mobile : maskMobile(client.mobile) },
        { key: "email", label: "Email", exportValue: (client) => sensitiveAllowed ? client.email : "Restricted" },
        { key: "branch", label: "Branch" },
        { key: "tag", label: "Type", exportValue: (client) => client.tag || client.retention },
        { key: "lastVisit", label: "Last Visit" },
        { key: "nextVisit", label: "Next Visit" },
        { key: "balance", label: "Balance" },
        { key: "packageBalance", label: "Package" },
      ]);
      return;
    }
    if (action.handler === "staff-users-export") {
      staffUsersExportRef.current?.();
      return;
    }
    if (action.handler === "staff-profiles-export") {
      staffProfilesExportRef.current?.();
      return;
    }
    if (action.modal) openModal(action.modal, action.payload ?? {});
  }

  function closeModal() {
    setModal(null);
  }

  function askConfirm(payload) {
    setConfirm(payload);
  }

  function addCartItem(item) {
    setCart((current) => {
      const found = current.find((entry) => entry.key === item.key);
      if (found) {
        return current.map((entry) => (entry.key === item.key ? { ...entry, qty: Number(entry.qty || 0) + 1 } : entry));
      }
      return [...current, { ...item, qty: 1 }];
    });
  }

  function updateCartQty(key, qty) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.key !== key) return item;
          const fractionalUnit = item.priceModel === "Per unit" && servicePriceUnitLabel(item) === "ml";
          const minimum = fractionalUnit ? 0.01 : 1;
          return { ...item, qty: Math.max(minimum, Number(qty) || minimum) };
        })
        .filter((item) => item.qty > 0),
    );
  }

  function removeCartItem(key) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  async function saveOpenPosCart(values) {
    const result = values.id
      ? await updatePosCart(values.id, values)
      : await createPosCart(values);
    upsertById(setPosCarts, result.cart);
    return result.cart;
  }

  async function completeTransaction(draft, paymentData) {
    const result = await completePosCheckout(
      {
        ...draft,
        invoicePrefix: settings.invoicePrefix,
      },
      paymentData,
    );

    upsertById(setTransactions, result.sale);
    if (Array.isArray(result.inventory)) {
      setInventory(result.inventory);
    }
    if (Array.isArray(result.movements) && result.movements.length) {
      setInventoryMovements((current) => [...result.movements, ...current].slice(0, 100));
    }
    for (const certificate of result.giftCertificates ?? []) {
      upsertById(setGiftCertificates, certificate);
    }
    for (const pkg of result.packages ?? []) {
      upsertById(setPackages, pkg);
    }
    if (result.client) upsertById(setClients, result.client);
    if (result.posCartId) removeById(setPosCarts, result.posCartId);
    applyAuditLog(result.auditLog);
    setCart([]);
    closeModal();
    notify(`Transaction ${result.sale.invoice} completed.`);
  }

  async function saveAppointment(values, { silent = false } = {}) {
    const client = clients.find((item) => item.id === values.clientId);
    const service = services.find((item) => item.id === values.serviceId);
    const record = {
      id: values.id || createId("ap"),
      date: values.date,
      time: values.time,
      clientId: values.clientId,
      client: client?.fullName ?? values.clientName ?? "Walk-in",
      serviceId: values.serviceId,
      service: service?.name ?? values.serviceName ?? "Consultation",
      branch: values.branch,
      room: values.room,
      staff: values.staff,
      duration: Number(values.duration || service?.duration || 60),
      appointmentType: values.appointmentType || "Treatment",
      insurance: values.insurance || "",
      tags: values.tags || "",
      packageName: values.packageName || "",
      timezone: values.timezone || "Asia/Manila",
      recurrence: values.recurrence || "None",
      recurrenceUntil: values.recurrenceUntil || "",
      status: canonicalAppointmentStatus(values.status),
      deposit: Number(values.deposit || 0),
      notes: values.notes || "",
      internalNotes: values.internalNotes || "",
    };

    const result = await saveResourceRecord("appointments", record, { existing: Boolean(values.id) });
    upsertById(setAppointments, result.record);
    applyAuditLog(result.auditLog);
    if (!silent) {
      closeModal();
      const recurring = !values.id && record.recurrence !== "None" && record.recurrenceUntil;
      notify(values.id ? "Appointment updated." : recurring ? "Recurring appointment series booked." : "Appointment booked.");
    }
    if (!values.id && record.recurrence !== "None" && record.recurrenceUntil) {
      const refreshed = await listResourceRecords("appointments");
      if (Array.isArray(refreshed)) setAppointments(refreshed);
    }
  }

  async function updateAppointmentStatus(id, status) {
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) return;
    const nextStatus = canonicalAppointmentStatus(status);

    try {
      const result = await saveResourceRecord("appointments", { ...appointment, status: nextStatus }, { existing: true });
      upsertById(setAppointments, result.record);
      applyAuditLog(result.auditLog);
      notify(`Appointment marked ${nextStatus}.`);
    } catch (error) {
      notify(error.message || "Unable to update appointment status.", "error");
    }
  }

  async function saveClient(values) {
    const isExisting = Boolean(values.id);
    const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(" ").trim() || values.fullName;
    const address = [values.street, values.barangay, values.city, values.province].filter(Boolean).join(", ") || values.address;
    const emergency = [values.emergencyName, values.emergencyPhone].filter(Boolean).join(" - ") || values.emergency;
    const record = {
      ...values,
      fullName,
      address,
      emergency,
      id: values.id || createId("cl"),
      balance: Number(values.balance || 0),
      giftBalance: Number(values.giftBalance || 0),
      marketingOptIn: Boolean(values.marketingOptIn),
    };

    const result = await saveResourceRecord("clients", record, { existing: isExisting });
    upsertById(setClients, result.record);
    setSelectedClientId(result.record.id);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(isExisting ? "Client updated." : "Client added.");
  }

  async function importClients(records) {
    let saved = 0;
    let failed = 0;

    for (const values of records) {
      const isExisting = Boolean(values.id && clients.some((client) => client.id === values.id));
      const record = {
        ...values,
        id: values.id || createId("cl"),
        balance: Number(values.balance || 0),
        giftBalance: Number(values.giftBalance || 0),
        marketingOptIn: Boolean(values.marketingOptIn),
      };

      try {
        const result = await saveResourceRecord("clients", record, { existing: isExisting });
        upsertById(setClients, result.record);
        applyAuditLog(result.auditLog);
        saved += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      notify(`${saved} client${saved === 1 ? "" : "s"} imported, ${failed} failed.`, "warning");
    } else {
      notify(`${saved} client${saved === 1 ? "" : "s"} imported.`);
    }
  }

  function deleteClient(client) {
    askConfirm({
      title: "Delete client profile?",
      copy: `${client.fullName} will be removed from the client database. Treatment, booking, and payment history remain visible in their own modules.`,
      actionLabel: "Delete client",
      onConfirm: () => {
        void (async () => {
          try {
            await deleteResourceRecord("clients", client.id);
            removeById(setClients, client.id);
            setSelectedClientId((current) => (current === client.id ? clients.find((item) => item.id !== client.id)?.id : current));
            addAudit("Client profile deleted", `${client.fullName} removed from client records.`, "Client Records");
            notify("Client deleted.");
          } catch (error) {
            notify(error.message || "Delete could not reach the API.", "error");
          }
        })();
      },
    });
  }

  async function saveService(values) {
    const packageSessions = Number(values.packageSessions || 0);
    const packagePrice = Number(values.packagePrice || 0);
    const record = {
      ...values,
      id: values.id || createId("svc"),
      duration: Number(values.duration || 0),
      price: Number(values.price || 0),
      packageSessions,
      packagePrice,
      serviceValue: Number(values.serviceValue || (packageSessions ? packagePrice / packageSessions : values.price) || 0),
      recommendedIntervalDays: Number(values.recommendedIntervalDays || 0),
      active: values.active !== false,
      pos: values.pos !== false,
      branches: splitList(values.branches),
      staff: splitList(values.staff),
      consumables: Array.isArray(values.consumables) ? values.consumables : [],
    };
    const result = await saveResourceRecord("services", record, { existing: Boolean(values.id) });
    upsertById(setServices, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Service updated." : "Service created.");
  }

  async function toggleService(id) {
    const service = services.find((item) => item.id === id);
    if (!service) return;
    try {
      const result = await saveResourceRecord("services", { ...service, active: !service.active }, { existing: true });
      upsertById(setServices, result.record);
      applyAuditLog(result.auditLog);
    } catch (error) {
      notify(error.message || "Unable to update service.", "error");
    }
  }

  async function saveInventory(values) {
    const record = {
      ...values,
      id: values.id || createId("inv"),
      packQty: Number(values.packQty || 1),
      beginning: Number(values.beginning || values.stock || 0),
      stock: Number(values.stock || 0),
      reorder: Number(values.reorder || 0),
      cost: Number(values.cost || 0),
      price: Number(values.price || 0),
    };
    const result = await saveResourceRecord("inventory", record, { existing: Boolean(values.id) });
    upsertById(setInventory, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Inventory updated." : "Inventory item added.");
  }

  async function importInventory(records) {
    const result = await importInventoryCsvRecords(records);
    for (const record of result.records ?? []) upsertById(setInventory, record);
    if (result.auditLog) applyAuditLog(result.auditLog);
    notify(`Inventory CSV imported: ${result.created || 0} created, ${result.updated || 0} updated.`);
    return result;
  }

  async function handleInventoryCsvFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const records = inventoryRecordsFromCsv(await file.text(), {
        defaultBranch: branchScope === "All branches" ? "" : branchScope,
      });
      await importInventory(records);
    } catch (error) {
      notify(error.message || "Unable to import that inventory CSV.", "error");
    }
  }

  async function receiveStock(id, values = {}) {
    try {
      const result = await postInventoryMovement(id, {
        qty: Number(values.qty || 0),
        reason: values.reason || "Stock received",
        date: values.date || todayDate(),
        supplier: values.supplier || "",
        receivedBy: values.receivedBy || "",
        checkNumber: values.checkNumber || "",
        unit: values.unit || "",
        notes: values.notes || "",
      });
      upsertById(setInventory, result.inventoryItem);
      upsertById(setInventoryMovements, result.movement);
      applyAuditLog(result.auditLog);
      closeModal();
      notify("Stock movement saved.");
    } catch (error) {
      notify(error.message || "Unable to save stock movement.", "error");
    }
  }

  async function saveLead(values) {
    const record = {
      ...values,
      id: values.id || createId("lead"),
      status: canonicalLeadStatus(values.status),
      created: values.created || todayDate(),
      firstTouchSource: values.firstTouchSource || values.source,
      latestTouchSource: values.latestTouchSource || values.source,
      nextAction: values.nextAction || values.nextStep,
    };
    const result = await saveResourceRecord("leads", record, { existing: Boolean(values.id) });
    upsertById(setLeads, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Lead updated." : "Lead added.");
  }

  async function importLeads(records) {
    let saved = 0;
    let failed = 0;

    for (const values of records) {
      const isExisting = Boolean(values.id && leads.some((lead) => lead.id === values.id));
      const record = {
        ...values,
        id: values.id || createId("lead"),
        status: canonicalLeadStatus(values.status),
        created: values.created || todayDate(),
        firstTouchSource: values.firstTouchSource || values.source,
        latestTouchSource: values.latestTouchSource || values.source,
        nextAction: values.nextAction || values.nextStep,
      };

      try {
        const result = await saveResourceRecord("leads", record, { existing: isExisting });
        upsertById(setLeads, result.record);
        applyAuditLog(result.auditLog);
        saved += 1;
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      notify(`${saved} lead${saved === 1 ? "" : "s"} imported, ${failed} failed.`, "warning");
    } else {
      notify(`${saved} lead${saved === 1 ? "" : "s"} imported.`);
    }
  }

  function deleteLead(lead) {
    askConfirm({
      title: "Delete lead?",
      copy: `${lead.name} and the lead's activity history will be permanently removed.`,
      actionLabel: "Delete lead",
      onConfirm: () => {
        void (async () => {
          try {
            await deleteResourceRecord("leads", lead.id);
            removeById(setLeads, lead.id);
            addAudit("Lead deleted", `${lead.name} removed from lead records.`, "Leads");
            notify("Lead deleted.");
          } catch (error) {
            notify(error.message || "Delete could not reach the API.", "error");
          }
        })();
      },
    });
  }

  async function updateLeadStatus(id, status, extra = {}) {
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    try {
      const result = await updateLeadStage(id, { ...extra, status: canonicalLeadStatus(status) });
      upsertById(setLeads, result.lead);
      applyAuditLog(result.auditLog);
      notify(`Lead marked ${status}.`);
    } catch (error) {
      notify(error.message || "Unable to update lead.", "error");
    }
  }

  async function saveLeadActivity(id, payload) {
    try {
      const result = await addLeadActivity(id, payload);
      upsertById(setLeads, result.lead);
      applyAuditLog(result.auditLog);
      notify("Lead activity recorded.");
      return result;
    } catch (error) {
      notify(error.message || "Unable to record lead activity.", "error");
      throw error;
    }
  }

  async function saveLeadFollowUp(id, payload) {
    try {
      const result = await scheduleLeadFollowUp(id, payload);
      upsertById(setLeads, result.lead);
      applyAuditLog(result.auditLog);
      notify("Follow-up scheduled.");
      return result;
    } catch (error) {
      notify(error.message || "Unable to schedule follow-up.", "error");
      throw error;
    }
  }

  async function createLeadAppointment(id, payload) {
    try {
      const result = await bookLeadAppointment(id, payload);
      upsertById(setLeads, result.lead);
      upsertById(setAppointments, result.appointment);
      applyAuditLog(result.auditLog);
      notify("Appointment booked from lead.");
      return result;
    } catch (error) {
      notify(error.message || "Unable to book appointment.", "error");
      throw error;
    }
  }

  async function convertLead(id, payload = {}) {
    try {
      const result = await convertLeadToClient(id, payload);
      upsertById(setLeads, result.lead);
      upsertById(setClients, result.client);
      applyAuditLog(result.auditLog);
      notify("Lead converted to client.");
      return result;
    } catch (error) {
      notify(error.message || "Unable to convert lead.", "error");
      throw error;
    }
  }

  async function mergeLead(id, payload) {
    try {
      const result = await mergeLeadDuplicate(id, payload);
      upsertById(setLeads, result.lead);
      applyAuditLog(result.auditLog);
      notify("Duplicate lead merged.");
      return result;
    } catch (error) {
      notify(error.message || "Unable to merge duplicate lead.", "error");
      throw error;
    }
  }

  async function refreshLeadOperations() {
    try {
      const [integrationsResult, webhookResult] = await Promise.all([loadLeadIntegrations(), loadLeadWebhookEvents()]);
      setLeadIntegrations(Array.isArray(integrationsResult.integrations) ? integrationsResult.integrations : []);
      setWebhookEvents(Array.isArray(webhookResult.events) ? webhookResult.events : []);
      notify("Lead integrations refreshed.");
    } catch (error) {
      notify(error.message || "Unable to refresh lead integrations.", "error");
    }
  }

  async function saveTreatment(values) {
    const client = clients.find((item) => item.id === values.clientId);
    const service = services.find((item) => item.name === values.service || item.id === values.serviceId);
    const followUp = values.followUp || (Number(service?.recommendedIntervalDays) > 0
      ? isoDate(addDays(new Date(`${values.date || todayDate()}T12:00:00`), Number(service.recommendedIntervalDays)))
      : "");
    const record = {
      ...values,
      id: values.id || createId("tr"),
      client: client?.fullName ?? values.client,
      aftercare: values.aftercare || service?.aftercare || "",
      followUp,
    };
    const result = await saveResourceRecord("treatments", record, { existing: Boolean(values.id) });
    upsertById(setTreatments, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Treatment record saved.");
  }

  async function addTreatmentPhoto(treatmentId, dataUrl, kind) {
    const result = await uploadTreatmentPhoto(treatmentId, dataUrl, kind);
    upsertById(setTreatments, result.record);
    applyAuditLog(result.auditLog);
    notify(`${kind} photo uploaded. ${result.record.photos} photo${result.record.photos === 1 ? "" : "s"} linked.`);
    return result.record;
  }

  async function removeTreatmentPhoto(treatmentId, photoId) {
    const result = await deleteTreatmentPhoto(treatmentId, photoId);
    upsertById(setTreatments, result.record);
    applyAuditLog(result.auditLog);
    notify(`Treatment photo removed. ${result.record.photos} photo${result.record.photos === 1 ? "" : "s"} linked.`);
    return result.record;
  }

  async function saveExpense(values) {
    const record = {
      ...values,
      id: values.id || createId("ex"),
      amount: Number(values.amount || 0),
    };
    const result = await saveResourceRecord("expenses", record, { existing: Boolean(values.id) });
    upsertById(setExpenses, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Expense saved.");
  }

  async function saveStaff(values) {
    const existingStaff = values.id ? staff.find((item) => item.id === values.id) : null;
    if (existingStaff && existingStaff.branch !== values.branch) {
      const approved = await new Promise((resolve) => {
        askConfirm({
          title: `Change ${existingStaff.name}'s primary branch?`,
          copy: `${values.branch} will become the employee's primary branch. Other assigned branches remain available, and historical records keep their original branch.`,
          actionLabel: "Change primary branch",
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!approved) return;
    }
    const record = {
      ...values,
      id: values.id || createId("st"),
      commissionRate: Number(values.commissionRate || 0),
      branches: splitList(values.branches).length ? splitList(values.branches) : [values.branch],
    };
    const result = await saveResourceRecord("staff", record, { existing: Boolean(values.id) });
    upsertById(setStaff, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Employee saved.");
  }

  async function toggleAttendance(id) {
    const person = staff.find((item) => item.id === id);
    if (!person) return;
    const attendance = person.attendance === "Clocked in" ? "Clocked out" : "Clocked in";
    try {
      const result = await saveResourceRecord("staff", { ...person, attendance }, { existing: true });
      upsertById(setStaff, result.record);
      applyAuditLog(result.auditLog);
    } catch (error) {
      notify(error.message || "Unable to update attendance.", "error");
    }
  }

  async function savePackage(values) {
    const client = clients.find((item) => item.id === values.clientId);
    const record = {
      ...values,
      id: values.id || createId("pkg"),
      client: client?.fullName ?? values.client,
      sessions: Number(values.sessions || 0),
      used: Number(values.used || 0),
      price: Number(values.price || 0),
      amountPaid: Number(values.amountPaid || 0),
      serviceValue: Number(values.serviceValue || (Number(values.sessions) ? Number(values.price) / Number(values.sessions) : 0)),
      expires: "",
      purchaseDate: values.purchaseDate || todayDate(),
      paymentHistory: Array.isArray(values.paymentHistory) ? values.paymentHistory : [],
      sessionHistory: Array.isArray(values.sessionHistory) ? values.sessionHistory : [],
      transferable: Boolean(values.transferable),
    };
    const result = await saveResourceRecord("packages", record, { existing: Boolean(values.id) });
    upsertById(setPackages, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Package saved.");
  }

  async function saveGiftCertificate(values) {
    const service = services.find((item) => item.id === values.serviceId);
    const record = {
      ...values,
      id: values.id || createId("gc"),
      service: service?.name || values.service || "",
      balance: Number(values.balance || (values.type === "Specific Service" ? service?.price : 0) || 0),
      issueDate: values.issueDate || todayDate(),
    };
    const result = await saveResourceRecord("giftCertificates", record, { existing: Boolean(values.id) });
    upsertById(setGiftCertificates, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Gift certificate updated." : "Gift certificate issued.");
  }

  async function savePackageInstallment(values) {
    const result = await recordPackageInstallment(values.id, {
      amount: Number(values.amount || 0),
      date: values.date || todayDate(),
      method: values.method || "Cash",
      nextPayment: values.nextPayment || "",
      notes: values.notes || "",
    });
    upsertById(setPackages, result.record);
    if (result.sale) upsertById(setTransactions, result.sale);
    if (result.client) upsertById(setClients, result.client);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Package installment recorded.");
  }

  async function redeemPackage(id) {
    try {
      const result = await redeemPackageRecord(id);
      upsertById(setPackages, result.record);
      applyAuditLog(result.auditLog);
      notify("Package session redeemed.");
    } catch (error) {
      notify(error.message || "Unable to redeem package session.", "error");
    }
  }

  async function saveCampaign(values, { existing, silent = false } = {}) {
    const campaignBranch = values.branch
      || (branchScope !== "All branches" ? branchScope : "")
      || branchRecords.find((branch) => branch.status === "Active")?.name
      || "";
    if (!campaignBranch) throw new Error("Choose an active branch for this campaign.");
    const record = {
      ...values,
      id: values.id || createId("cmp"),
      branch: campaignBranch,
      sent: Number(values.sent || 0),
      booked: Number(values.booked || 0),
      credits: Number(values.credits || 0),
    };
    const result = await saveResourceRecord("campaigns", record, { existing: existing ?? campaigns.some((campaign) => campaign.id === record.id) });
    upsertById(setCampaigns, result.record);
    applyAuditLog(result.auditLog);
    if (!silent) {
      closeModal();
      notify("Campaign saved.");
    }
    return result.record;
  }

  async function moveCampaignToDeleted(campaign) {
    const result = await moveMarketingCampaignToDeleted(campaign.id);
    upsertById(setCampaigns, result.campaign);
    applyAuditLog(result.auditLog);
    notify("Campaign moved to Deleted.");
    return result.campaign;
  }

  async function restoreCampaign(campaign) {
    const result = await restoreMarketingCampaign(campaign.id);
    upsertById(setCampaigns, result.campaign);
    applyAuditLog(result.auditLog);
    notify("Campaign restored.");
    return result.campaign;
  }

  async function deleteCampaignForever(campaign) {
    const result = await deleteMarketingCampaignForever(campaign.id);
    removeById(setCampaigns, result.id);
    applyAuditLog(result.auditLog);
    notify("Campaign permanently deleted.");
  }

  async function sendCampaign(id) {
    const campaign = campaigns.find((item) => item.id === id);
    if (!campaign) {
      notify("Campaign not found.", "error");
      return;
    }

    setSendingCampaignId(id);
    try {
      const result = await sendMarketingCampaign({
        campaign,
        templates: smsTemplates,
        settings: {
          company: settings.company,
          productName: settings.productName,
        },
        clients: clients.map(({ id, fullName, mobile, email, birthday, branch, marketingOptIn, tag, retention, lastVisit, packageBalance, source }) => ({
          id,
          fullName,
          mobile,
          email,
          birthday,
          branch,
          marketingOptIn,
          tag,
          retention,
          lastVisit,
          packageBalance,
          source,
        })),
      });

      const sent = Number(result.sent || 0);
      const failed = Number(result.failed || 0);
      const credits = Number(result.credits || 0);
      const channelLabel = result.channel === "email" ? "email" : "SMS";

      if (result.campaign) {
        upsertById(setCampaigns, result.campaign);
      }
      applyAuditLog(result.auditLog);

      if (result.channel === "sms") {
        const nextSettings = { ...settings, smsCredits: Math.max(0, Number(settings.smsCredits) - credits) };
        const savedSettings = await saveSettingsRecord(nextSettings);
        setSettings(stagingBrandSettings(savedSettings.settings));
        applyAuditLog(savedSettings.auditLog);
      }

      notify(failed ? `${sent} ${channelLabel} sent, ${failed} failed.` : `${sent} ${channelLabel} sent.`);
    } catch (error) {
      addAudit("Marketing campaign failed", `${campaign.name}: ${error.message || "Delivery failed."}`, "Marketing");
      notify(error.message || "Campaign delivery failed.", "error");
    } finally {
      setSendingCampaignId("");
    }
  }

  async function scheduleCampaign(id, scheduledAt) {
    const result = await scheduleMarketingCampaign(id, { scheduledAt });
    upsertById(setCampaigns, result.campaign);
    applyAuditLog(result.auditLog);
    return result;
  }

  async function approveCampaign(id) {
    const result = await approveMarketingCampaign(id);
    upsertById(setCampaigns, result.campaign);
    applyAuditLog(result.auditLog);
    notify("Campaign approved and released to the delivery queue.");
    return result.campaign;
  }

  async function saveSettings(values) {
    const result = await saveSettingsRecord({ ...settings, ...values });
    setSettings(stagingBrandSettings(result.settings));
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Settings updated.");
    return result.settings;
  }

  async function savePromotion(values) {
    const record = { ...values, id: values.id || createId("promo"), value: Number(values.value || 0) };
    const result = await saveResourceRecord("promotions", record, { existing: Boolean(values.id) });
    upsertById(setPromotions, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Promotion updated." : "Promotion created.");
  }

  async function saveDiscount(values) {
    const record = { ...values, id: values.id || createId("discount"), value: Number(values.value || 0), usage: Number(values.usage || 0) };
    const result = await saveResourceRecord("discounts", record, { existing: Boolean(values.id) });
    upsertById(setDiscounts, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify(values.id ? "Discount updated." : "Discount created.");
  }

  async function saveConsentTemplate(values) {
    const record = { ...values, id: values.id || createId("consent-form") };
    const result = await saveResourceRecord("consentTemplates", record, { existing: Boolean(values.id) });
    upsertById(setConsentTemplates, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Consent form template saved.");
  }

  async function saveConsentSubmission(values) {
    const result = await saveResourceRecord("consentSubmissions", values);
    upsertById(setConsentSubmissions, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    notify("Signed consent attached permanently to the client profile.");
  }

  async function publicBooking(values) {
    const result = await submitPublicBooking(values);
    if (result.client) upsertById(setClients, result.client);
    if (result.lead) upsertById(setLeads, result.lead);
    if (result.appointment?.client) upsertById(setAppointments, result.appointment);
    if (result.auditLog) applyAuditLog(result.auditLog);
    notify("Online booking submitted.");
  }

  function voidTransaction(transaction) {
    askConfirm({
      title: "Void transaction?",
      copy: `${transaction.invoice} will be marked void. This is logged for audit review.`,
      actionLabel: "Void transaction",
      onConfirm: () => {
        void (async () => {
          try {
            const result = await voidTransactionRecord(transaction.id);
            upsertById(setTransactions, result.record);
            if (Array.isArray(result.inventory)) {
              setInventory(result.inventory);
            }
            if (Array.isArray(result.movements) && result.movements.length) {
              setInventoryMovements((current) => [...result.movements, ...current].slice(0, 100));
            }
            for (const certificate of result.giftCertificates ?? []) {
              upsertById(setGiftCertificates, certificate);
            }
            for (const pkg of result.packages ?? []) {
              upsertById(setPackages, pkg);
            }
            if (result.client) upsertById(setClients, result.client);
            applyAuditLog(result.auditLog);
            notify("Transaction voided. Stock and prepaid tenders restored.", "warning");
          } catch (error) {
            notify(error.message || "Unable to void transaction.", "error");
          }
        })();
      },
    });
  }

  function resetTestTransaction(transaction) {
    askConfirm({
      title: "Reset test transaction?",
      copy: `${transaction.invoice} is isolated test data and will be permanently removed. Live sales, stock, balances, commissions, and payroll are not affected.`,
      actionLabel: "Reset test transaction",
      onConfirm: () => {
        void (async () => {
          try {
            const result = await deleteTestTransactionRecord(transaction.id);
            removeById(setTransactions, result.id);
            applyAuditLog(result.auditLog);
            notify("Test transaction reset.", "warning");
          } catch (error) {
            notify(error.message || "Unable to reset the test transaction.", "error");
          }
        })();
      },
    });
  }

  if (isPublicFormView) {
    return isClientRegistrationView ? <PublicClientRegistrationPage /> : <PublicLeadCapturePage initialMode={publicFormMode} />;
  }

  if (isAccountRegistrationView) {
    return <RegistrationPage session={session} onRegistered={handleRegistrationComplete} onNavigate={navigateToPath} />;
  }

  if (isPricingView) {
    return <PricingPage session={session} onNavigate={navigateToPath} onSessionUpdate={handleSubscriptionSession} />;
  }

  if (publicFlipbookToken) {
    return <PublicFlipbookViewer token={publicFlipbookToken} />;
  }

  if (authChecking) {
    return (
      <main className="login-page">
        <div className="login-card auth-loading-card">
          <Database size={24} aria-hidden="true" />
          <strong>Opening secure workspace...</strong>
        </div>
      </main>
    );
  }

  if (isFaceTrackKioskView) {
    return <FaceTrackKiosk session={session} />;
  }

  const publicParams = new URLSearchParams(window.location.search);
  const invitationToken = publicParams.get("token") || publicParams.get("invitation");
  if (invitationToken && ["/accept-invitation", "/"].includes(normalizedPathname(window.location.pathname))) {
    return <AcceptInvitationScreen token={invitationToken} session={session} onLogin={handleLogin} onLogout={handleLogout} />;
  }

  if (!session) {
    const resetToken = publicParams.get("reset");
    if (resetToken) return <ResetPasswordScreen token={resetToken} />;
    return <LoginScreen notice={sessionNotice} onLogin={handleLogin} onGoogleAuthenticated={handleGoogleAuthentication} onNavigate={navigateToPath} settings={settings} />;
  }

  if (isSubscriptionView) {
    return <SubscriptionPage session={session} onLogout={handleLogout} onNavigate={navigateToPath} onSessionUpdate={handleSubscriptionSession} />;
  }

  if (isSubscriptionExpiredView) {
    return <SubscriptionExpiredPage session={session} onLogout={handleLogout} onNavigate={navigateToPath} />;
  }

  if (session.mustChangePassword) {
    return <ChangePasswordScreen account={session} onChangePassword={handlePasswordChange} onLogout={handleLogout} />;
  }

  if (!session.subscription?.accessAllowed) {
    return session.subscription?.status === "expired"
      ? <SubscriptionExpiredPage session={session} onLogout={handleLogout} onNavigate={navigateToPath} />
      : <PricingPage session={session} onNavigate={navigateToPath} onSessionUpdate={handleSubscriptionSession} onboarding />;
  }

  if (!session.access?.active || !sessionModules.length) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div className="login-card auth-loading-card">
            <ShieldCheck size={28} aria-hidden="true" />
            <strong>Access role unavailable</strong>
            <p className="login-helper">Your account is signed in, but its role is not configured for this workspace. Ask an Owner or Super Admin to assign an approved role.</p>
            <button className="ghost-button full" type="button" onClick={handleLogout}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  if (!sessionModules.includes(activeModule)) {
    const blockedLabel = navItems.find((item) => item.id === activeModule)?.label || "This module";
    return (
      <>
        <EdgeRevealNavigation
          activeModule={activeModule}
          open={isEdgeSidebarOpen}
          onClose={() => setIsEdgeSidebarOpen(false)}
          onNavigate={setActiveModule}
          onOpen={() => setIsEdgeSidebarOpen(true)}
          sections={visibleNavSections}
          session={session}
        />
        <main className="login-page module-unavailable-page">
          <section className="login-panel">
            <div className="login-card auth-loading-card">
              <LockKeyhole size={30} aria-hidden="true" />
              <p className="eyebrow">{branchScope}</p>
              <strong>Module not available for this branch</strong>
              <p className="login-helper">{blockedLabel} is disabled for the active branch or is not included in your role permissions.</p>
              <button className="primary-button full" type="button" onClick={() => setActiveModule(sessionModules.includes(defaultModuleId) ? defaultModuleId : sessionModules[0], { replace: true })}>Open an available workspace</button>
              <button className="ghost-button full" type="button" onClick={handleLogout}>Sign out</button>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (isFlipbooksView) {
    return (
      <>
        <EdgeRevealNavigation
          activeModule={activeModule}
          open={isEdgeSidebarOpen}
          onClose={() => setIsEdgeSidebarOpen(false)}
          onNavigate={setActiveModule}
          onOpen={() => setIsEdgeSidebarOpen(true)}
          sections={visibleNavSections}
          session={session}
        />
        <FlipbooksWorkspace
          notify={notify}
          onExit={() => setActiveModule("overview")}
          session={session}
        />
        {toast && <Toast toast={toast} />}
      </>
    );
  }

  const activeLabel = activeRecordTitle || (
    activeModule === "overview"
      ? "Dashboard"
      : navItems.find((item) => item.id === activeModule)?.label ?? "Dashboard"
  );
  const sensitiveAllowed = canManageOrganization(session.role) || ["Branch Manager", "Doctor"].includes(session.role);
  const isStandaloneWorkspaceView = !mainSystemModules.has(activeModule);
  const showSidebar = visibleNavSections.length > 0 && !isStandaloneWorkspaceView;
  const showEdgeSidebar = visibleNavSections.length > 0 && isStandaloneWorkspaceView;
  const showBackButton = activeModule !== "overview" && !showSidebar;
  const canOpenPos = sessionModules.includes("pos");
  const canManageAppointments = sessionModules.includes("appointments");
  const canAccessAllBranches = Boolean(session.access?.organizationWide);
  const selectableBranches = (session.access?.branches || []).filter((branch) => branch.branchStatus === "Active");
  const showBranchSelector = canAccessAllBranches || selectableBranches.length > 1;
  const shellClassName = [
    "app-shell",
    showSidebar ? "app-shell-with-sidebar" : "app-shell-full",
    showSidebar && isSidebarCollapsed ? "sidebar-collapsed" : "",
    showSidebar && isSidebarDrawerOpen ? "sidebar-drawer-open" : "",
    isPosView ? "pos-page-shell" : "",
    isApplicationsView ? "applications-page-shell" : "",
    isFaceTrackView ? "facetrack-page-shell" : "",
    isMarketingView ? "marketing-page-shell" : "",
    isStandaloneWorkspaceView ? "standalone-module-shell" : "",
    isPosView && isPosChromeRevealed ? "pos-chrome-revealed" : "",
    !isStandaloneWorkspaceView ? "has-mobile-navigation" : "",
    isMarketingView ? "marketing-standalone-shell" : "",
  ].filter(Boolean).join(" ");
  const posChromeHandlers = isPosView
    ? {
        onMouseEnter: () => revealPosChrome(),
        onMouseLeave: hidePosChrome,
        onFocus: () => revealPosChrome(),
        onBlur: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            hidePosChrome();
          }
        },
      }
    : {};

  return (
    <>
      <div className={shellClassName}>
        {showEdgeSidebar && (
          <EdgeRevealNavigation
            activeModule={activeModule}
            open={isEdgeSidebarOpen}
            onClose={() => setIsEdgeSidebarOpen(false)}
            onNavigate={setActiveModule}
            onOpen={() => setIsEdgeSidebarOpen(true)}
            sections={visibleNavSections}
            session={session}
          />
        )}

        {showSidebar && (
          <SidebarNavigation
            activeModule={activeModule}
            collapsed={isSidebarCollapsed}
            drawerOpen={isSidebarDrawerOpen}
            onCloseDrawer={() => setIsSidebarDrawerOpen(false)}
            onNavigate={setActiveModule}
            onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
            sections={visibleNavSections}
            session={session}
          />
        )}

        <main className={`workspace ${showSidebar ? "" : "workspace-full"} ${isStandaloneWorkspaceView ? "standalone-module-workspace" : ""} ${activeModule === "clients" && activeRecordRoute?.moduleId === "clients" ? "client-profile-workspace" : ""} ${isPosView ? "pos-workspace" : ""} ${isApplicationsView ? "applications-workspace" : ""} ${isFaceTrackView ? "facetrack-workspace" : ""} ${isMarketingView ? "marketing-workspace-host" : ""}`}>
          {isPosView && (
            <div
              aria-label="Show POS header"
              className="pos-top-reveal-zone"
              onFocus={() => revealPosChrome()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  revealPosChrome();
                }
                if (event.key === "Escape") {
                  hidePosChrome();
                }
              }}
              onMouseEnter={() => revealPosChrome()}
              role="button"
              tabIndex={0}
            />
          )}

          <div
            className={isApplicationsView || isFaceTrackView || isMarketingView ? "app-top-chrome applications-hidden-chrome" : isPosView ? `pos-top-chrome ${isPosChromeRevealed ? "is-revealed" : ""}` : "app-top-chrome"}
            {...posChromeHandlers}
          >
            <header className="topbar" id={isPosView ? "pos-system-chrome" : undefined}>
            <div className="topbar-heading">
              {showSidebar && (
                <button
                  className="sidebar-mobile-button"
                  type="button"
                  aria-label="Open menu"
                  aria-controls="mobile-more-menu"
                  aria-expanded={isMobileMoreOpen}
                  onClick={() => setIsMobileMoreOpen(true)}
                >
                  <Menu size={20} aria-hidden="true" />
                </button>
              )}
              <PageHeader
                title={activeLabel}
                subtitle={
                  activeModule === "leads"
                    ? "Manage and track your clinic leads."
                    : activeModule === "card-view"
                      ? "Manage today's scheduled services"
                      : undefined
                }
                leading={showBackButton ? (
                  <button
                    className="topbar-back-button"
                    type="button"
                    onClick={() => setActiveModule("applications")}
                    title="Back to applications"
                    aria-label="Back to applications"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                ) : null}
              />
            </div>
            <div className="topbar-actions">
              {activeModule === "inventory" && (
                <input
                  ref={inventoryImportInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleInventoryCsvFile}
                  hidden
                />
              )}
              <GlobalCreateMenu actions={globalCreateActions} onSelect={handleGlobalCreateAction} />
              <GlobalModuleSearch
                value={globalSearch}
                onChange={setGlobalSearch}
                label={headerSearchMeta.label}
                placeholder={headerSearchMeta.placeholder}
                disabled={headerSearchMeta.disabled}
                getResults={getHeaderSearchResults}
                onSelect={handleHeaderSearchSelect}
              />
              {canOpenPos && !isPosView && (
                <button
                  className="topbar-pos-button"
                  type="button"
                  onClick={() => setActiveModule("pos")}
                >
                  <WalletCards size={18} aria-hidden="true" />
                  POS
                </button>
              )}
              <NotificationCenter
                loading={notificationsLoading}
                notifications={notificationFeed.notifications}
                onMarkAllRead={markAllNotificationsAsRead}
                onNavigate={setActiveModule}
                onRefresh={refreshNotifications}
                unreadCount={notificationFeed.unreadCount}
              />
              {showBranchSelector ? (
                <label className={`branch-select ${branchSwitching ? "is-loading" : ""}`}>
                  <Store size={17} aria-hidden="true" />
                  <select
                    value={session.access?.activeBranchId || ""}
                    onChange={(event) => void switchBranch(event.target.value)}
                    aria-label="Select active branch"
                    disabled={branchSwitching}
                    title="Change the server-authorized workspace branch"
                  >
                    {canAccessAllBranches && <option value="all">All Branches</option>}
                    {selectableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                  {branchSwitching ? <RefreshCw className="spin" size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                </label>
              ) : (
                <div className="active-branch-label" title="Your assigned branch"><Store size={17} aria-hidden="true" /><span>{branchScope}</span></div>
              )}
              <AccountMenu
                session={session}
                sessionModules={sessionModules}
                onLogout={handleLogout}
                onNavigate={setActiveModule}
                onOpenAccount={() => openModal("account")}
              />
            </div>
            </header>
          </div>

          <TrialBanner subscription={session.subscription} onNavigate={navigateToPath} />

        <section className={`content-area ${isMarketingView ? "marketing-content-area" : ""} ${isFlipbooksView ? "flipbooks-content-area" : ""}`}>
          {activeModule === "my-workspace" && <MyWorkspaceModule session={session} notify={notify} />}
          {activeModule === "facetrack-attendance" && <FaceTrackAttendance session={session} notify={notify} onExit={() => setActiveModule("overview")} />}
          {activeModule === "payroll" && <PayrollWorkspace notify={notify} onAudit={applyAuditLog} onExit={() => setActiveModule("overview")} />}
          {activeModule === "overview" && (
            <Dashboard
              session={session}
              stats={stats}
              branchScope={branchScope}
              clients={scopedClients}
              appointments={scopedAppointments}
              transactions={scopedTransactions}
              inventory={scopedInventory}
              inventoryMovements={inventoryMovements}
              leads={scopedLeads}
              services={services}
              staff={scopedStaff}
              expenses={scopedExpenses}
              treatments={scopedTreatments}
              packages={scopedPackages}
              branchRecords={branchRecords}
              settings={settings}
              users={organizationAccounts}
              visibleNav={visibleNav}
              setActiveModule={setActiveModule}
              openModal={openModal}
            />
          )}
          {activeModule === "applications" && (
            <ApplicationsModule
              session={session}
              visibleNav={visibleNav}
              setActiveModule={setActiveModule}
            />
          )}
          {activeModule === "pos" && (
            <POSModule
              clients={clients}
              services={services}
              inventory={inventory}
              staff={staff}
              branchScope={branchScope}
              cart={cart}
              discounts={discounts}
              promotions={promotions}
              addCartItem={addCartItem}
              updateCartQty={updateCartQty}
              removeCartItem={removeCartItem}
              setCart={setCart}
              saveService={saveService}
              openModal={openModal}
              openPayment={(draft) => openModal("payment", draft)}
              transactions={transactions}
              voidTransaction={voidTransaction}
              resetTestTransaction={resetTestTransaction}
              onPrintReceipt={printReceipt}
              globalSearch={globalSearch}
              sessionRole={session.role}
              branchRecords={branchRecords}
              posCarts={posCarts}
              saveOpenCart={saveOpenPosCart}
              notify={notify}
              settings={settings}
            />
          )}
          {activeModule === "card-view" && (
            <CardViewModule
              appointments={scopedAppointments}
              services={services}
              transactions={scopedTransactions}
              staff={scopedStaff}
              branchRecords={branchRecords}
              branchScope={branchScope}
              updateStatus={updateAppointmentStatus}
              openModal={openModal}
              globalSearch={globalSearch}
              canManageAppointments={canManageAppointments}
              onOpenRoomView={() => setActiveModule("room-view")}
              onOpenAppointment={(appointment) => openRecordPage("appointments", appointment.id)}
            />
          )}
          {activeModule === "staff-view" && (
            <StaffAvailabilityModule
              appointments={scopedAppointments}
              services={services}
              staff={scopedStaff}
              globalSearch={globalSearch}
              branchScope={branchScope}
              notify={notify}
              onAudit={applyAuditLog}
            />
          )}
          {activeModule === "room-view" && (
            <RoomAvailabilityModule
              appointments={scopedAppointments}
              services={services}
              globalSearch={globalSearch}
              branchRecords={branchRecords}
              branchScope={branchScope}
              canManageRooms={canManageOrganization(session.role)}
              onCreateRoom={() => openModal("room", branchScope !== "All branches" ? { branch: branchScope } : {})}
              onDeleteRoom={deleteRoom}
            />
          )}
          {activeModule === "appointments" && (
            <AppointmentsModule
              detailAppointmentId={activeRecordRoute?.moduleId === "appointments" ? activeRecordRoute.recordId : ""}
              appointments={scopedAppointments}
              clients={scopedClients}
              services={services}
              staff={scopedStaff}
              transactions={scopedTransactions}
              auditLogs={auditLogs}
              treatments={treatments}
              packages={scopedPackages}
              consentTemplates={consentTemplates}
              consentSubmissions={consentSubmissions}
              openModal={openModal}
              updateStatus={updateAppointmentStatus}
              onUpdateAppointment={saveAppointment}
              openPayment={(draft) => openModal("payment", draft)}
              onPrintReceipt={printReceipt}
              globalSearch={globalSearch}
              onCreateDateChange={setAppointmentCreateDate}
              onOpenAppointment={(appointment) => openRecordPage("appointments", appointment.id)}
              onCloseDetail={() => setActiveModule("appointments")}
            />
          )}
          {activeModule === "clients" && (
            <ClientsModule
              detailClientId={activeRecordRoute?.moduleId === "clients" ? activeRecordRoute.recordId : ""}
              clients={scopedClients}
              selectedClient={selectedClient}
              selectedClientId={selectedClientId}
              setSelectedClientId={(id) => {
                setSelectedClientId(id);
                const client = clients.find((item) => item.id === id);
                addAudit("Client profile viewed", `${client?.fullName ?? "Client"} profile opened.`, "Client Records");
              }}
              treatments={scopedTreatments}
              appointments={scopedAppointments}
              transactions={scopedTransactions}
              packages={scopedPackages}
              openModal={openModal}
              importClients={importClients}
              importInputRef={clientImportInputRef}
              deleteClient={deleteClient}
              sensitiveAllowed={sensitiveAllowed}
              globalSearch={globalSearch}
              notify={notify}
              onOpenClient={(client) => openRecordPage("clients", client.id)}
              onCloseDetail={() => setActiveModule("clients")}
            />
          )}
          {activeModule === "treatments" && (
            <TreatmentsModule
              detailTreatmentId={activeRecordRoute?.moduleId === "treatments" ? activeRecordRoute.recordId : ""}
              treatments={scopedTreatments}
              clients={scopedClients}
              openModal={openModal}
              globalSearch={globalSearch}
              onUploadPhoto={addTreatmentPhoto}
              onDeletePhoto={removeTreatmentPhoto}
              onOpenTreatment={(treatment) => openRecordPage("treatments", treatment.id)}
              onCloseDetail={() => setActiveModule("treatments")}
            />
          )}
          {activeModule === "services" && (
            <ServicesModule
              services={services}
              openModal={openModal}
              toggleService={toggleService}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "inventory" && (
            <InventoryModule
              inventory={scopedInventory}
              movements={inventoryMovements}
              openModal={openModal}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "packages" && (
            <PackagesModule
              packages={scopedPackages}
              giftCertificates={giftCertificates}
              clients={clients}
              openModal={openModal}
              redeemPackage={redeemPackage}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "leads" && (
            <LeadsModule
              detailLeadId={activeRecordRoute?.moduleId === "leads" ? activeRecordRoute.recordId : ""}
              leads={scopedLeads}
              clients={scopedClients}
              appointments={scopedAppointments}
              services={services}
              staff={scopedStaff}
              branches={branchRecords}
              integrations={leadIntegrations}
              webhookEvents={webhookEvents}
              openModal={openModal}
              importLeads={importLeads}
              deleteLead={deleteLead}
              updateStatus={updateLeadStatus}
              addActivity={saveLeadActivity}
              scheduleFollowUp={saveLeadFollowUp}
              bookAppointment={createLeadAppointment}
              convertLead={convertLead}
              mergeLead={mergeLead}
              refreshOperations={refreshLeadOperations}
              globalSearch={globalSearch}
              isBooting={isBooting}
              notify={notify}
              onOpenLead={(lead) => openRecordPage("leads", lead.id)}
              onCloseDetail={() => setActiveModule("leads")}
            />
          )}
          {activeModule === "sms" && (
            <MarketingWorkspace
              approveCampaign={approveCampaign}
              branches={branchRecords.filter((branch) => branch.status === "Active")}
              branchScope={branchScope}
              canApproveMarketing={canManageOrganization(session.role)}
              clients={scopedClients}
              templates={smsTemplates}
              campaigns={campaigns}
              settings={settings}
              openModal={openModal}
              askConfirm={askConfirm}
              onOpenDashboard={() => setActiveModule("overview")}
              moveCampaignToDeleted={moveCampaignToDeleted}
              restoreCampaign={restoreCampaign}
              deleteCampaignForever={deleteCampaignForever}
              saveCampaign={saveCampaign}
              saveMarketingSettings={saveSettings}
              scheduleCampaign={scheduleCampaign}
              sendCampaign={sendCampaign}
              sendingCampaignId={sendingCampaignId}
              globalSearch={globalSearch}
              onGlobalSearchChange={setGlobalSearch}
              isLoading={isBooting}
              loadMarketingMedia={loadMarketingMedia}
              notify={notify}
              uploadMarketingImage={uploadMarketingImage}
            />
          )}
          {activeModule === "staff" && (
            <StaffModule
              detailStaffId={activeRecordRoute?.moduleId === "staff" ? activeRecordRoute.recordId : ""}
              staff={scopedStaff}
              branchRecords={branchRecords}
              session={session}
              setSession={setSession}
              openModal={openModal}
              toggleAttendance={toggleAttendance}
              globalSearch={globalSearch}
              applyAuditLog={applyAuditLog}
              notify={notify}
              onOpenStaff={(person) => openRecordPage("staff", person.id)}
              onCloseDetail={() => setActiveModule("staff")}
              createRequest={inviteCreateRequest}
              onCreateRequestHandled={setInviteCreateRequest}
              usersExportRef={staffUsersExportRef}
              profilesExportRef={staffProfilesExportRef}
            />
          )}
          {activeModule === "branches" && (
            <BranchesModule
              branchScope={branchScope}
              branchRecords={branchRecords}
              staff={staff}
              transactions={transactions}
              appointments={appointments}
              accounts={organizationAccounts}
              canManage={canManageOrganization(session.role) || session.organizationPermissions?.includes("branches.manage")}
              onCreateBranch={createBranch}
              onUpdateBranch={updateBranch}
              onArchiveBranch={archiveBranch}
              onReactivateBranch={reactivateBranch}
              onManageCompany={() => openModal("settings", settings)}
              onManageEmployees={(branch) => { void switchBranch(branch.id).then(() => setActiveModule("staff")); }}
              createRequest={branchCreateRequest}
              onCreateRequestHandled={setBranchCreateRequest}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "expenses" && (
            <ExpensesModule expenses={expenses} openModal={openModal} globalSearch={globalSearch} />
          )}
          {activeModule === "reports" && (
            <ReportsModule
              stats={stats}
              transactions={scopedTransactions}
              expenses={expenses}
              appointments={scopedAppointments}
              inventory={scopedInventory}
              staff={staff}
              clients={clients}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "booking" && (
            <BookingPortal services={services} staff={staff} onSubmit={publicBooking} />
          )}
          {activeModule === "settings" && (
            <SettingsModule
              settings={settings}
              users={organizationAccounts}
              auditLogs={auditLogs}
              discounts={discounts}
              promotions={promotions}
              openModal={openModal}
              globalSearch={globalSearch}
              saveSettings={saveSettings}
              canConfigurePayments={isAdmin(session.role)}
              consentTemplates={consentTemplates}
            />
          )}
          {activeModule === "support" && <SupportModule />}
        </section>
      </main>

      {!isStandaloneWorkspaceView && (
        <>
          <MobileBottomNavigation
            activeModule={activeModule}
            moreOpen={isMobileMoreOpen}
            moreSections={mobileMoreSections}
            onNavigate={setActiveModule}
            onOpenMore={() => setIsMobileMoreOpen(true)}
            primaryItems={mobilePrimaryNav}
          />

          <MobileMoreMenu
            activeModule={activeModule}
            onClose={() => setIsMobileMoreOpen(false)}
            onLogout={handleLogout}
            onNavigate={setActiveModule}
            open={isMobileMoreOpen}
            primaryItems={mobilePrimaryNav}
            sections={mobileMoreSections}
            session={session}
          />
        </>
      )}

      <ModalHost
        session={session}
        branchScope={branchScope}
        modal={modal}
        closeModal={closeModal}
        completeTransaction={completeTransaction}
        saveAppointment={saveAppointment}
        saveClient={saveClient}
        saveService={saveService}
        saveInventory={saveInventory}
        receiveStock={receiveStock}
        saveLead={saveLead}
        saveTreatment={saveTreatment}
        saveExpense={saveExpense}
        saveStaff={saveStaff}
        savePackage={savePackage}
        savePackageInstallment={savePackageInstallment}
        saveGiftCertificate={saveGiftCertificate}
        saveCampaign={saveCampaign}
        saveSettings={saveSettings}
        saveDiscount={saveDiscount}
        savePromotion={savePromotion}
        saveConsentTemplate={saveConsentTemplate}
        saveConsentSubmission={saveConsentSubmission}
        saveRoom={saveRoom}
        changePassword={handlePasswordChange}
        clients={clients}
        services={services}
        branches={branchRecords}
        staff={staff}
        inventory={inventory}
        settings={settings}
        templates={smsTemplates}
        packages={packages}
        giftCertificates={giftCertificates}
        appointments={appointments}
        consentTemplates={consentTemplates}
      />

      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => { confirm.onCancel?.(); setConfirm(null); }} onConfirmComplete={() => setConfirm(null)} />}
      {toast && <Toast toast={toast} />}
      </div>
      <PrintableReceipt receipt={receiptToPrint} settings={settings} services={services} />
    </>
  );
}

function PrintableReceipt({ receipt, settings, services = [] }) {
  const items = (receipt?.items ?? []).map((item) => {
    if (item.type !== "Service") return item;
    const service = services.find((entry) => item.serviceId && entry.id === item.serviceId)
      || services.find((entry) => normalize(entry.name) === normalize(item.name));
    return {
      ...item,
      serviceId: item.serviceId || service?.id || "",
      aftercare: String(item.aftercare || "").trim() || String(service?.aftercare || "").trim(),
      recommendedIntervalDays: Number(item.recommendedIntervalDays || service?.recommendedIntervalDays || 0),
    };
  });
  const serviceProtocolItems = items.filter((item) => item.type === "Service" && (item.aftercare || Number(item.recommendedIntervalDays) > 0));
  const payments = receipt?.payments ?? [];
  const subtotal = Number(receipt?.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0));
  const discount = Number(receipt?.discount || 0);
  const total = Number(receipt?.total ?? Math.max(0, subtotal - discount));
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const balance = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);

  return (
    <section className="print-receipt-root" aria-hidden={!receipt}>
      {receipt && (
        <article className="print-receipt" aria-label={`Receipt ${receipt.invoice}`}>
          <header className="print-receipt-header">
            <BrandWordmark />
            <strong>{settings.company}</strong>
            <span>{settings.productName}</span>
          </header>

          <div className="print-receipt-meta">
            <div><span>Receipt</span><strong>{receipt.invoice}</strong></div>
            <div><span>Date</span><strong>{receipt.date} {receipt.time}</strong></div>
            <div><span>Client</span><strong>{receipt.client}</strong></div>
            <div><span>Branch</span><strong>{receipt.branch}</strong></div>
            <div><span>Staff</span><strong>{receipt.staff}</strong></div>
          </div>

          <table className="print-receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const qty = Number(item.qty || 1);
                const price = Number(item.price || 0);
                return (
                  <tr key={`${item.name}-${index}`}>
                    <td>
                      <strong>{item.name}</strong>
                      <span>{item.type} / {money.format(price)}{item.priceUnit ? ` ${String(item.priceUnit).toLowerCase()}` : ""}{item.provider && item.provider !== "N/A" ? ` / Provider: ${item.provider}` : ""}</span>
                    </td>
                    <td>{qty}</td>
                    <td>{money.format(price * qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {serviceProtocolItems.length > 0 && (
            <section className="print-receipt-aftercare">
              <strong>Aftercare instructions & service interval</strong>
              {serviceProtocolItems.map((item, index) => {
                const intervalDays = Number(item.recommendedIntervalDays || 0);
                const nextDate = Number(item.recommendedIntervalDays) > 0 && receipt.date
                  ? isoDate(addDays(new Date(`${receipt.date}T12:00:00`), intervalDays))
                  : "";
                return (
                  <div key={`${item.serviceId || item.name}-aftercare-${index}`}>
                    <b>{item.name}</b>
                    {item.aftercare && <span className="print-receipt-aftercare-copy">{item.aftercare}</span>}
                    {intervalDays > 0 && <span>Recommended interval: {intervalDays} days</span>}
                    {nextDate && <span>Suggested next session: {formatDate(nextDate)}</span>}
                  </div>
                );
              })}
            </section>
          )}

          <div className="print-receipt-totals">
            <div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
            <div><span>Discount</span><strong>-{money.format(discount)}</strong></div>
            <div className="print-receipt-grand"><span>Total</span><strong>{money.format(total)}</strong></div>
          </div>

          <div className="print-receipt-payments">
            {payments.length ? payments.map((payment, index) => (
              <div key={`${payment.method}-${index}`}>
                <span>{payment.method}{payment.referenceNumber && <small>Ref: {payment.referenceNumber}</small>}</span>
                <strong>{money.format(payment.amount)}</strong>
              </div>
            )) : <div><span>Payment</span><strong>Not posted</strong></div>}
            {paid > 0 && <div><span>Paid</span><strong>{money.format(paid)}</strong></div>}
            {balance > 0 && <div><span>Balance</span><strong>{money.format(balance)}</strong></div>}
            {change > 0 && <div><span>Change</span><strong>{money.format(change)}</strong></div>}
            <div><span>Status</span><strong>{receipt.status}</strong></div>
          </div>

          {receipt.notes && <p className="print-receipt-note">{receipt.notes}</p>}
          <footer>{settings.receiptFooter}</footer>
        </article>
      )}
    </section>
  );
}

function PageHeader({ title, subtitle, leading = null }) {
  return (
    <div className="page-header topbar-title-block">
      <div className="topbar-title-row">
        {leading}
        <h1>{title}</h1>
      </div>
      {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
    </div>
  );
}

function RecordDetailPageHeader({ label, title, onBack, children, className = "" }) {
  return (
    <section className={`record-detail-page ${className}`.trim()}>
      <header className="record-detail-page-header">
        <button type="button" onClick={onBack} aria-label={`Back to ${label}`}><ArrowLeft size={18} /></button>
        <div><span>{label}</span><strong>{title}</strong></div>
      </header>
      {children}
    </section>
  );
}

function RecordDetailNotFound({ label, onBack }) {
  return (
    <RecordDetailPageHeader label={label} title="Record not found" onBack={onBack}>
      <div className="surface-panel record-detail-not-found">
        <FileText size={30} aria-hidden="true" />
        <h2>{label} not found</h2>
        <p>This record may have been removed or is outside your current branch access.</p>
        <button className="primary-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to {label.toLowerCase()}s</button>
      </div>
    </RecordDetailPageHeader>
  );
}

function SectionTitle({ children }) {
  return <h2 className="section-title">{children}</h2>;
}

function ModalHeader({ icon, title, action }) {
  return <SectionHeader icon={icon} title={title} action={action} />;
}

function FormLabel({ children }) {
  return <span className="form-label">{children}</span>;
}

function HelperText({ children }) {
  return <span className="helper-text">{children}</span>;
}

function DataTable(props) {
  return <SmartTable {...props} />;
}

function EdgeRevealNavigation({ activeModule, open, onClose, onNavigate, onOpen, sections, session }) {
  useEffect(() => {
    if (!open) return undefined;

    const closeOutsideSidebar = (event) => {
      const sidebar = document.getElementById("edge-primary-sidebar");
      if (sidebar && event.clientX > sidebar.getBoundingClientRect().right) onClose();
    };

    window.addEventListener("pointermove", closeOutsideSidebar, { passive: true });
    return () => window.removeEventListener("pointermove", closeOutsideSidebar);
  }, [onClose, open]);

  if (!sections.length) return null;

  return (
    <>
      <button
        className="edge-sidebar-trigger"
        type="button"
        aria-label="Show navigation menu"
        aria-controls="edge-primary-sidebar"
        aria-expanded={open}
        onFocus={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
          if (event.key === "Escape") onClose();
        }}
        onMouseEnter={onOpen}
      />
      <div
        className={`edge-sidebar-overlay ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        inert={open ? undefined : ""}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onClose();
        }}
        onFocusCapture={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
      >
        <SidebarNavigation
          activeModule={activeModule}
          collapsed={false}
          drawerOpen={false}
          id="edge-primary-sidebar"
          onCloseDrawer={onClose}
          onNavigate={onNavigate}
          onToggleCollapsed={onClose}
          sections={sections}
          session={session}
        />
      </div>
    </>
  );
}

function SidebarNavigation({
  activeModule,
  collapsed,
  drawerOpen,
  id = "primary-sidebar",
  onCloseDrawer,
  onNavigate,
  onToggleCollapsed,
  sections,
  session,
}) {
  const [menuQuery, setMenuQuery] = useState("");
  const filteredSections = useMemo(() => {
    const query = menuQuery.trim().toLowerCase();
    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((section) => section.items.length > 0);
  }, [menuQuery, sections]);

  return (
    <>
      <aside
        className={`sidebar ${collapsed ? "is-collapsed" : ""} ${drawerOpen ? "is-open" : ""}`}
        id={id}
        aria-label="ZenshoTech modules"
      >
        <div className="sidebar-header">
          <div className="brand-mark"><BrandWordmark /></div>
          <button
            className="sidebar-collapse-button"
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </button>
        </div>

        <label className="sidebar-menu-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Find a module</span>
          <input
            type="search"
            value={menuQuery}
            onChange={(event) => setMenuQuery(event.target.value)}
            placeholder="Find..."
            autoComplete="off"
          />
        </label>

        <nav className="sidebar-scroll" aria-label="Primary modules">
          {filteredSections.map((section) => (
            <SidebarSection
              activeModule={activeModule}
              collapsed={collapsed}
              key={section.id}
              onNavigate={onNavigate}
              section={section}
            />
          ))}
          {filteredSections.length === 0 && (
            <p className="sidebar-menu-empty">No modules found.</p>
          )}
        </nav>

        <div className="sidebar-account" title={collapsed ? `${session.name} / ${session.role}` : undefined}>
          <span className="account-avatar" aria-hidden="true">{initialsFor(session.name)}</span>
          <span className="sidebar-account-copy">
            <strong>{session.name}</strong>
            <small>{session.role}</small>
          </span>
        </div>
      </aside>
      <button
        className={`sidebar-backdrop ${drawerOpen ? "is-visible" : ""}`}
        type="button"
        aria-label="Close navigation"
        onClick={onCloseDrawer}
      />
    </>
  );
}

function SidebarSection({ activeModule, collapsed, onNavigate, section }) {
  const labelId = `sidebar-section-${section.id}`;

  return (
    <section className="sidebar-section" aria-labelledby={labelId}>
      <h2 className="sidebar-section-label" id={labelId}>{section.label}</h2>
      <div className="nav-list">
        {section.items.map((item) => (
          <SidebarItem
            active={activeModule === item.id}
            collapsed={collapsed}
            item={item}
            key={item.id}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function SidebarItem({ active, collapsed, item, onNavigate }) {
  const Icon = item.icon;

  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      type="button"
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item.id)}
    >
      <Icon size={18} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}

function MobileBottomNavigation({
  activeModule,
  moreOpen,
  moreSections,
  onNavigate,
  onOpenMore,
  primaryItems,
}) {
  const primaryIds = new Set(primaryItems.map((item) => item.id));
  const isMoreActive = moreOpen || (activeModule && !primaryIds.has(activeModule));
  const hasMoreItems = moreSections.some((section) => section.items.length > 0);

  return (
    <nav className="mobile-bottom-navigation" aria-label="Mobile primary navigation">
      {primaryItems.slice(0, 4).map((item) => {
        const Icon = item.icon;
        const active = activeModule === item.id;
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        className={isMoreActive ? "active" : ""}
        type="button"
        onClick={onOpenMore}
        aria-controls="mobile-more-menu"
        aria-expanded={moreOpen}
        disabled={!hasMoreItems}
      >
        <Menu size={20} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}

function MobileMoreMenu({
  activeModule,
  onClose,
  onLogout,
  onNavigate,
  open,
  primaryItems,
  sections,
  session,
}) {
  const hasSecondaryItems = sections.some((section) => section.items.length > 0);

  return (
    <div
      className={`mobile-more-overlay ${open ? "is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-labelledby="mobile-more-title"
      id="mobile-more-menu"
    >
      <button className="mobile-more-backdrop" type="button" aria-label="Close menu" onClick={onClose} />
      <aside className="mobile-more-sheet">
        <header className="mobile-more-header">
          <div>
            <p className="eyebrow">Menu</p>
            <h2 id="mobile-more-title">ZenshoTech</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close menu" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <section className="mobile-more-profile" aria-label="Signed in profile">
          <span className="account-avatar large" aria-hidden="true">{initialsFor(session.name)}</span>
          <span>
            <strong>{session.name}</strong>
            <small>{session.role} / {session.branch}</small>
          </span>
        </section>

        <nav className="mobile-more-primary" aria-label="Primary shortcuts">
          {primaryItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                className={active ? "active" : ""}
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mobile-more-section-list">
          {hasSecondaryItems ? (
            sections.map((section) => (
              <section className="mobile-more-section" key={section.id} aria-labelledby={`mobile-more-section-${section.id}`}>
                <h3 id={`mobile-more-section-${section.id}`}>{section.label}</h3>
                <div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        className={active ? "active" : ""}
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{moduleDescriptions[item.id] ?? "Open module"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <EmptyState title="No secondary modules" copy="Your primary tabs contain all available modules." />
          )}
        </div>

        <footer className="mobile-more-footer">
          <button className="secondary-button" type="button" onClick={() => onNavigate("support")}>
            <ShieldCheck size={17} aria-hidden="true" />
            Support
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" />
            Logout
          </button>
        </footer>
      </aside>
    </div>
  );
}

function NotificationCenter({ loading, notifications, onMarkAllRead, onNavigate, onRefresh, unreadCount }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;

    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) void onRefresh({ silent: false });
  }

  function openNotification(notification) {
    setOpen(false);
    onNavigate(notification.module);
  }

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className={`icon-button notification-trigger ${unreadCount ? "has-unread" : ""}`}
        type="button"
        title={unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleNotifications}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{badgeLabel}</span>}
      </button>

      {open && (
        <section className="notification-panel" role="dialog" aria-label="Notifications">
          <header className="notification-panel-header">
            <div>
              <strong>Notifications</strong>
              <small>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</small>
            </div>
            <div className="notification-panel-actions">
              <button
                type="button"
                title="Refresh notifications"
                aria-label="Refresh notifications"
                disabled={loading}
                onClick={() => void onRefresh({ silent: false })}
              >
                <RefreshCw className={loading ? "is-spinning" : ""} size={16} aria-hidden="true" />
              </button>
              <button type="button" disabled={!unreadCount || loading} onClick={() => void onMarkAllRead()}>
                <Check size={16} aria-hidden="true" />
                Mark all read
              </button>
            </div>
          </header>

          <div className="notification-list">
            {notifications.length ? notifications.map((notification) => (
              <button
                className={`notification-item ${notification.unread ? "is-unread" : ""}`}
                type="button"
                key={notification.id}
                onClick={() => openNotification(notification)}
              >
                <span className="notification-item-icon" aria-hidden="true">
                  <Bell size={15} />
                </span>
                <span className="notification-item-copy">
                  <span className="notification-item-heading">
                    <strong>{notification.title}</strong>
                    {notification.unread && <i aria-label="Unread" />}
                  </span>
                  <span>{notification.message}</span>
                  <small>{formatNotificationTime(notification.createdAt)}</small>
                </span>
              </button>
            )) : (
              <div className="notification-empty">
                <Bell size={24} aria-hidden="true" />
                <strong>No notifications yet</strong>
                <span>New leads, bookings, services, and other records will appear here.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountMenu({ session, sessionModules = [], onLogout, onNavigate, onOpenAccount }) {
  const initials = initialsFor(session.name);
  const detailsRef = useRef(null);
  const canManageUsers = sessionModules.includes("staff");
  const canManageBranches = sessionModules.includes("branches");

  function runAction(action) {
    if (detailsRef.current) detailsRef.current.open = false;
    action();
  }

  return (
    <details className="account-menu" ref={detailsRef}>
      <summary aria-label={`Open account menu for ${session.name}`}>
        <span className="account-avatar" aria-hidden="true">{initials}</span>
        <span className="account-summary">
          <strong>{session.name}</strong>
          <small>{session.role}</small>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="account-dropdown" role="menu">
        <div className="account-profile">
          <span className="account-avatar large" aria-hidden="true">{initials}</span>
          <div>
            <strong>{session.name}</strong>
            <small>{session.email}</small>
          </div>
        </div>
        <div className="account-action-list">
          <button type="button" role="menuitem" onClick={() => runAction(canManageUsers ? () => onNavigate("staff") : onOpenAccount)}>
            <ShieldCheck size={16} aria-hidden="true" />
            <span><strong>{session.role}</strong><small>{canManageUsers ? "Manage users and access" : "View your access"}</small></span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button type="button" role="menuitem" onClick={() => runAction(canManageBranches ? () => onNavigate("branches") : onOpenAccount)}>
            <Store size={16} aria-hidden="true" />
            <span><strong>{session.branch}</strong><small>{canManageBranches ? "Manage clinic branches" : "View branch access"}</small></span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
          <button type="button" role="menuitem" onClick={() => runAction(onOpenAccount)}>
            <LockKeyhole size={16} aria-hidden="true" />
            <span><strong>Account security</strong><small>Change your password</small></span>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
        <button className="account-sign-out" type="button" onClick={onLogout} role="menuitem">
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  );
}

function publicLeadAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || "",
    clickId: params.get("gclid") || params.get("fbclid") || params.get("ttclid") || "",
    landingPage: window.location.href,
    referrerUrl: document.referrer || "",
  };
}

function PublicClientRegistrationPage() {
  const branch = new URLSearchParams(window.location.search).get("branch") || "";
  const [form, setForm] = useState({ firstName: "", middleName: "", lastName: "", birthday: "", gender: "", civilStatus: "", mobile: "", email: "", street: "", barangay: "", city: "", province: "", occupation: "", emergencyName: "", emergencyPhone: "", marketingOptIn: false, privacyConsent: false, clinicWebsite: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await submitPublicRegistration({ ...form, branch });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || "Registration could not be submitted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="public-registration-page">
      <section className="public-registration-card">
        <BrandWordmark className="public-registration-wordmark" />
        {submitted ? (
          <div className="confirmation-panel"><Check size={30} /><h2>Registration received</h2><p>Thank you. The {branch || "ZenshoTech"} team can now review your unified client profile.</p></div>
        ) : (
          <form onSubmit={submit}>
            <p className="eyebrow">Secure client registration · {branch || "Select clinic"}</p>
            <h1>Tell us about you</h1>
            <p>Your information creates one ZenshoTech profile that can be used across clinic branches.</p>
            {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
            <div className="form-grid">
              <label><span>First name *</span><input required value={form.firstName} onChange={(event) => update("firstName", event.target.value)} /></label>
              <label><span>Middle name</span><input value={form.middleName} onChange={(event) => update("middleName", event.target.value)} /></label>
              <label><span>Last name *</span><input required value={form.lastName} onChange={(event) => update("lastName", event.target.value)} /></label>
              <label><span>Date of birth</span><input type="date" max={todayDate()} value={form.birthday} onChange={(event) => update("birthday", event.target.value)} /></label>
              <label><span>Gender</span><select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option></select></label>
              <label><span>Civil status</span><select value={form.civilStatus} onChange={(event) => update("civilStatus", event.target.value)}><option value="">Select</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option></select></label>
              <label><span>Mobile number</span><input value={form.mobile} onChange={(event) => update("mobile", event.target.value)} /></label>
              <label><span>Email</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label><span>Street</span><input value={form.street} onChange={(event) => update("street", event.target.value)} /></label>
              <label><span>Barangay</span><input value={form.barangay} onChange={(event) => update("barangay", event.target.value)} /></label>
              <label><span>City</span><input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
              <label><span>Province</span><input value={form.province} onChange={(event) => update("province", event.target.value)} /></label>
              <label><span>Occupation</span><input value={form.occupation} onChange={(event) => update("occupation", event.target.value)} /></label>
              <label><span>Emergency contact name</span><input value={form.emergencyName} onChange={(event) => update("emergencyName", event.target.value)} /></label>
              <label><span>Emergency contact number</span><input value={form.emergencyPhone} onChange={(event) => update("emergencyPhone", event.target.value)} /></label>
              <label className="checkbox-field span-2"><input type="checkbox" checked={form.marketingOptIn} onChange={(event) => update("marketingOptIn", event.target.checked)} /><span>I would like to receive ZenshoTech care reminders and offers.</span></label>
              <label className="checkbox-field span-2"><input required type="checkbox" checked={form.privacyConsent} onChange={(event) => update("privacyConsent", event.target.checked)} /><span>I consent to ZenshoTech securely collecting this information for my clinic profile. *</span></label>
              <label className="public-lead-honeypot" aria-hidden="true"><span>Clinic website</span><input tabIndex={-1} value={form.clinicWebsite} onChange={(event) => update("clinicWebsite", event.target.value)} /></label>
            </div>
            <button className="primary-button full" disabled={saving || !branch || !form.firstName || !form.lastName || (!form.mobile && !form.email) || !form.privacyConsent} type="submit"><Check size={17} /> {saving ? "Submitting..." : "Submit registration"}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function PublicLeadCapturePage({ initialMode = "inquiry" }) {
  const inquiryParams = new URLSearchParams(window.location.search);
  const isContactEmbed = inquiryParams.get("embed") === "contact";
  const isSalesQuote = inquiryParams.get("interest") === "zenshotech-pricing";
  const quotePlanCode = ["starter", "growth", "unlimited", "lifetime"].includes(inquiryParams.get("plan")) ? inquiryParams.get("plan") : "starter";
  const quotePlanName = ({ starter: "Starter", growth: "Growth", unlimited: "Unlimited", lifetime: "One-Time Purchase" })[quotePlanCode];
  const quoteBilling = inquiryParams.get("billing") === "annual" ? "12-month term with 10% savings" : inquiryParams.get("billing") === "one_time" ? "one-time purchase" : "monthly billing";
  const [formMode, setFormMode] = useState(initialMode);
  const [config, setConfig] = useState({ company: "ZenshoTech", tagline: "The brand behind beautiful faces.", branches: [], services: [] });
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    mobile: "",
    email: "",
    serviceId: "",
    branch: "",
    preferredChannel: "Phone",
    concern: isSalesQuote ? `I would like a quotation for the ${quotePlanName} plan with ${quoteBilling}.` : "",
    marketingConsent: false,
    privacyConsent: false,
    clinicWebsite: "",
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    if (!isContactEmbed || window.parent === window) return undefined;

    const embeddedPage = document.querySelector(".public-lead-page-embedded");
    let animationFrame = 0;
    const publishHeight = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const height = Math.ceil(embeddedPage?.getBoundingClientRect().height || document.body?.scrollHeight || 0);
        window.parent.postMessage({ type: "mace-inquiry-height", height }, "*");
      });
    };
    const resizeObserver = new ResizeObserver(publishHeight);
    resizeObserver.observe(embeddedPage || document.documentElement);
    window.addEventListener("load", publishHeight);
    publishHeight();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("load", publishHeight);
    };
  }, [isContactEmbed]);

  useEffect(() => {
    if (isSalesQuote) {
      setLoadingConfig(false);
      return undefined;
    }
    let cancelled = false;
    loadPublicLeadConfig()
      .then((result) => {
        if (cancelled) return;
        const branches = Array.isArray(result.branches) ? result.branches : [];
        const services = Array.isArray(result.services) ? result.services : [];
        setConfig({
          company: /mace|clinicos/i.test(String(result.company || "")) ? "ZenshoTech" : result.company || "ZenshoTech",
          tagline: result.tagline || "The brand behind beautiful faces.",
          branches,
          services,
        });
        const defaultBranch = branches[0]?.name || "";
        const defaultService = services.find((service) => {
          const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
          return !defaultBranch || !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(defaultBranch);
        });
        setForm((current) => ({
          ...current,
          branch: current.branch || defaultBranch,
          serviceId: current.serviceId || defaultService?.id || "",
        }));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Some form choices could not be loaded. You can still send a general inquiry.");
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSalesQuote]);

  const availableServices = useMemo(() => config.services.filter((service) => {
    const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
    return !form.branch || !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(form.branch);
  }), [config.services, form.branch]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseBranch(branch) {
    const validServices = config.services.filter((service) => {
      const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
      return !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(branch);
    });
    setForm((current) => ({
      ...current,
      branch,
      serviceId: validServices.some((service) => service.id === current.serviceId) ? current.serviceId : validServices[0]?.id || "",
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.fullName.trim() || (isSalesQuote && !form.businessName.trim()) || (!form.mobile.trim() && !form.email.trim()) || !form.privacyConsent) return;
    setSaving(true);
    setError("");
    try {
      const submissionId = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await submitPublicLead({
        ...form,
        concern: isSalesQuote ? `[ZenshoTech sales quote] Business: ${form.businessName || "Not provided"}. ${form.concern}` : form.concern,
        ...publicLeadAttribution(),
        submissionId,
      });
      setSubmitted(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError.message || "We could not send your inquiry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function sendAnother() {
    setSubmitted(null);
    setError("");
    setForm((current) => ({
      ...current,
      fullName: "",
      businessName: "",
      mobile: "",
      email: "",
      concern: "",
      marketingConsent: false,
      privacyConsent: false,
      clinicWebsite: "",
    }));
  }

  return (
    <main className={`public-lead-page${isContactEmbed ? " public-lead-page-embedded" : ""}`}>
      <section className="public-lead-shell">
        {!isContactEmbed && (
          <div className="public-lead-brand">
            <BrandWordmark className="public-lead-logo" />
            <div>
              <p className="eyebrow">{isSalesQuote ? "ZenshoTech plan quotation" : formMode === "appointment" ? "Online appointment request" : "Private consultation request"}</p>
              <h1>{isSalesQuote ? `Let’s prepare your ${quotePlanName} quote.` : formMode === "appointment" ? "Choose a visit time that works for you." : "Let’s talk about the care that feels right for you."}</h1>
              <p>{isSalesQuote ? `Tell us about your clinic and our team will contact you about ${quoteBilling}. Your 7-day trial remains free and does not require payment details.` : formMode === "appointment" ? "Request your preferred branch, service, date, and time. The clinic team will confirm the final schedule with you." : `${config.tagline} Share what you’re interested in and the clinic team will personally follow up.`}</p>
            </div>
            <div className="public-lead-promises" aria-label="What happens next">
              <span><ShieldCheck size={18} /> {isSalesQuote ? "No payment required to request a quote" : "Your details stay with the clinic"}</span>
              <span>{formMode === "appointment" && !isSalesQuote ? <CalendarDays size={18} /> : <PhoneCall size={18} />} {formMode === "appointment" && !isSalesQuote ? "Your request goes into Appointments" : "Choose how you prefer to be contacted"}</span>
              <span><Sparkles size={18} /> {isSalesQuote ? "Personalized for your clinic" : formMode === "appointment" ? "The clinic confirms availability" : "No treatment commitment required"}</span>
            </div>
          </div>
        )}

        <div className="public-lead-card">
          {!isSalesQuote && <div className="public-form-mode-switch" aria-label="Choose contact form">
            <button className={formMode === "inquiry" ? "active" : ""} type="button" aria-pressed={formMode === "inquiry"} onClick={() => setFormMode("inquiry")}>
              <MessageSquareText size={16} /> Inquire
            </button>
            <button className={formMode === "appointment" ? "active" : ""} type="button" aria-pressed={formMode === "appointment"} onClick={() => setFormMode("appointment")}>
              <CalendarDays size={16} /> Book an appointment
            </button>
          </div>}

          {formMode === "appointment" ? (
            <PublicAppointmentBookingForm config={config} loadingConfig={loadingConfig} />
          ) : submitted ? (
            <div className="public-lead-success" role="status">
              <span className="public-lead-success-icon"><Check size={28} /></span>
              <p className="eyebrow">Inquiry received</p>
              <h2>{isSalesQuote ? "Thank you — our sales team will prepare your quote." : "Thank you — the ZenshoTech team will be in touch."}</h2>
              <p>{isSalesQuote ? "Your request is recorded for personal follow-up. You can still start the free trial at any time." : "Your request is now in the clinic's Leads inbox for a personal follow-up."}</p>
              <button className="secondary-button" type="button" onClick={sendAnother}>Send another inquiry</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="public-lead-card-heading">
                <p className="eyebrow">{isSalesQuote ? "Request a personalized quote" : "Start your inquiry"}</p>
                <h2>{isSalesQuote ? `${quotePlanName} · ${quoteBilling}` : "How can we help?"}</h2>
                <p>Fields marked with * are required.</p>
              </div>

              {error && <div className="inline-state danger" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

              <div className="public-lead-form-grid">
                <label className="span-2"><span>Full name *</span><input autoComplete="name" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required /></label>
                {isSalesQuote && <label className="span-2"><span>Business or clinic name *</span><input autoComplete="organization" value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} required /></label>}
                <label><span>Mobile number</span><input autoComplete="tel" inputMode="tel" value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} placeholder="09XX XXX XXXX" /></label>
                <label><span>Email</span><input autoComplete="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
                <small className="span-2 public-lead-contact-help">Please provide at least a mobile number or email.</small>

                {!isSalesQuote && <><label><span>Preferred branch</span><select disabled={loadingConfig || !config.branches.length} value={form.branch} onChange={(event) => chooseBranch(event.target.value)}>{config.branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}</select></label>
                <label><span>Interested service</span><select disabled={loadingConfig} value={form.serviceId} onChange={(event) => updateField("serviceId", event.target.value)}><option value="">General consultation</option>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label></>}
                <label className="span-2"><span>{isSalesQuote ? "Tell us about your clinic or requirements" : "What would you like help with?"}</span><textarea rows={5} value={form.concern} onChange={(event) => updateField("concern", event.target.value)} placeholder={isSalesQuote ? "Number of staff, branches, desired launch date, or special requirements." : "Tell us about your concern, goal, or question."} /></label>
                <label><span>Preferred contact</span><select value={form.preferredChannel} onChange={(event) => updateField("preferredChannel", event.target.value)}><option>Phone</option><option>SMS</option><option>Messenger</option><option>WhatsApp</option><option>Email</option></select></label>

                <label className="checkbox-field span-2"><input type="checkbox" checked={form.marketingConsent} onChange={(event) => updateField("marketingConsent", event.target.checked)} /><span>{isSalesQuote ? "I’d also like to receive occasional ZenshoTech product updates." : "I'd also like to receive occasional clinic care updates and offers."}</span></label>
                <label className="checkbox-field span-2"><input type="checkbox" required checked={form.privacyConsent} onChange={(event) => updateField("privacyConsent", event.target.checked)} /><span>I consent to the collection and use of my information so ZenshoTech can respond to this inquiry. *</span></label>
                <label className="public-lead-honeypot" aria-hidden="true"><span>Clinic website</span><input tabIndex={-1} autoComplete="off" value={form.clinicWebsite} onChange={(event) => updateField("clinicWebsite", event.target.value)} /></label>
              </div>

              <button className="primary-button full public-lead-submit" type="submit" disabled={saving || !form.fullName.trim() || (isSalesQuote && !form.businessName.trim()) || (!form.mobile.trim() && !form.email.trim()) || !form.privacyConsent}>
                <Send size={17} /> {saving ? "Sending request..." : isSalesQuote ? "Request My Quote" : "Send inquiry"}
              </button>
              <p className="public-lead-footnote"><ShieldCheck size={14} /> Your information is used only for this inquiry unless you opt in to updates.</p>
            </form>
          )}
        </div>
      </section>
      {!isContactEmbed && <a className="public-lead-staff-link" href="/">Clinic staff sign in</a>}
    </main>
  );
}

function PublicAppointmentBookingForm({ config, loadingConfig }) {
  const [form, setForm] = useState({
    fullName: "",
    mobile: "",
    email: "",
    branch: "",
    serviceId: "",
    date: todayDate(),
    time: "",
    concern: "",
    marketingConsent: false,
    privacyConsent: false,
    clinicWebsite: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);

  const availableServices = useMemo(() => config.services.filter((service) => {
    const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
    return !form.branch || !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(form.branch);
  }), [config.services, form.branch]);

  const selectedService = availableServices.find((service) => service.id === form.serviceId);
  const selectedBranch = config.branches.find((branch) => branch.name === form.branch);
  const timeOptions = useMemo(() => {
    const duration = Math.max(15, Number(selectedService?.duration || 60));
    const window = branchOperatingWindow(selectedBranch, form.date);
    if (window.closed) return [];
    const options = [];
    for (let minutes = window.open; minutes + duration <= window.close; minutes += 30) {
      options.push({ value: formatTimeInput(minutes), label: formatScheduleTime(minutes) });
    }
    return options;
  }, [form.date, selectedBranch, selectedService?.duration]);

  useEffect(() => {
    const defaultBranch = form.branch || config.branches[0]?.name || "";
    const validServices = config.services.filter((service) => {
      const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
      return !defaultBranch || !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(defaultBranch);
    });
    setForm((current) => ({
      ...current,
      branch: current.branch || defaultBranch,
      serviceId: validServices.some((service) => service.id === current.serviceId) ? current.serviceId : validServices[0]?.id || "",
    }));
  }, [config.branches, config.services, form.branch]);

  useEffect(() => {
    if (!timeOptions.some((option) => option.value === form.time)) {
      setForm((current) => ({ ...current, time: timeOptions[0]?.value || "" }));
    }
  }, [form.time, timeOptions]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseBranch(branch) {
    const validServices = config.services.filter((service) => {
      const serviceBranches = Array.isArray(service.branches) ? service.branches : [];
      return !serviceBranches.length || serviceBranches.includes("All branches") || serviceBranches.includes(branch);
    });
    setForm((current) => ({
      ...current,
      branch,
      serviceId: validServices.some((service) => service.id === current.serviceId) ? current.serviceId : validServices[0]?.id || "",
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.fullName.trim() || !form.mobile.trim() || !form.branch || !form.serviceId || !form.date || !form.time || !form.privacyConsent) return;
    setSaving(true);
    setError("");
    try {
      const result = await submitPublicBooking(form);
      setSubmitted(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError.message || "We could not request this appointment. Please try another time.");
    } finally {
      setSaving(false);
    }
  }

  function bookAnother() {
    setSubmitted(null);
    setError("");
    setForm((current) => ({
      ...current,
      fullName: "",
      mobile: "",
      email: "",
      concern: "",
      marketingConsent: false,
      privacyConsent: false,
      clinicWebsite: "",
    }));
  }

  if (submitted) {
    return (
      <div className="public-lead-success public-booking-success" role="status">
        <span className="public-lead-success-icon"><Check size={28} /></span>
        <p className="eyebrow">Appointment requested</p>
        <h2>Thank you — your request is in the clinic schedule.</h2>
        <p>The appointment is listed as Pending Confirmation. The ZenshoTech team will contact you to confirm the final schedule.</p>
        <div className="public-booking-summary">
          <span><CalendarDays size={16} /><strong>{submitted.appointment?.date}</strong></span>
          <span><Clock size={16} /><strong>{formatScheduleTime(parseTimeToMinutes(submitted.appointment?.time))}</strong></span>
          <span><Sparkles size={16} /><strong>{submitted.appointment?.service}</strong></span>
          <span><MapPin size={16} /><strong>{submitted.appointment?.branch}</strong></span>
        </div>
        <small>Booking reference: {submitted.bookingReference}</small>
        <button className="secondary-button" type="button" onClick={bookAnother}>Book another appointment</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="public-lead-card-heading public-booking-card-heading">
        <p className="eyebrow">Request an appointment</p>
        <h2>Choose your preferred schedule.</h2>
        <p>The clinic will confirm availability after your request is received. Fields marked with * are required.</p>
      </div>

      {error && <div className="inline-state danger" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="public-lead-form-grid">
        <label className="span-2"><span>Full name *</span><input autoComplete="name" maxLength={120} value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required /></label>
        <label><span>Mobile number *</span><input autoComplete="tel" inputMode="tel" maxLength={30} pattern="[+()0-9 .-]{7,30}" value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} placeholder="09XX XXX XXXX" required /></label>
        <label><span>Email</span><input autoComplete="email" maxLength={160} type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>

        <label><span>Clinic branch *</span><select disabled={loadingConfig || !config.branches.length} value={form.branch} onChange={(event) => chooseBranch(event.target.value)} required>{config.branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}</select></label>
        <label><span>Service *</span><select disabled={loadingConfig || !availableServices.length} value={form.serviceId} onChange={(event) => updateField("serviceId", event.target.value)} required>{availableServices.map((service) => <option key={service.id} value={service.id}>{service.name} - {servicePriceLabel(service)}</option>)}</select></label>
        <label><span>Preferred date *</span><input type="date" min={todayDate()} value={form.date} onChange={(event) => updateField("date", event.target.value)} required /></label>
        <label><span>Preferred time *</span><select disabled={!timeOptions.length} value={form.time} onChange={(event) => updateField("time", event.target.value)} required>{timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <small className="span-2 public-lead-contact-help">Available request times follow the selected branch&apos;s operating hours. 12:00 noon remains bookable.</small>

        <label className="span-2"><span>Concern or notes</span><textarea rows={4} maxLength={1000} value={form.concern} onChange={(event) => updateField("concern", event.target.value)} placeholder="Tell us what you would like to address during your visit." /></label>
        <label className="checkbox-field span-2"><input type="checkbox" checked={form.marketingConsent} onChange={(event) => updateField("marketingConsent", event.target.checked)} /><span>I&apos;d also like to receive occasional clinic care updates and offers.</span></label>
        <label className="checkbox-field span-2"><input type="checkbox" required checked={form.privacyConsent} onChange={(event) => updateField("privacyConsent", event.target.checked)} /><span>I consent to the collection and use of my information to request this appointment. *</span></label>
        <label className="public-lead-honeypot" aria-hidden="true"><span>Clinic website</span><input tabIndex={-1} autoComplete="off" value={form.clinicWebsite} onChange={(event) => updateField("clinicWebsite", event.target.value)} /></label>
      </div>

      <button className="primary-button full public-lead-submit" type="submit" disabled={saving || loadingConfig || !form.fullName.trim() || !form.mobile.trim() || !form.branch || !form.serviceId || !form.date || !form.time || !form.privacyConsent}>
        <CalendarDays size={17} /> {saving ? "Requesting appointment..." : "Request appointment"}
      </button>
      <p className="public-lead-footnote"><ShieldCheck size={14} /> Your request will appear in ZenshoTech Appointments as Pending Confirmation.</p>
    </form>
  );
}

function PublicSubscriptionHeader({ session, onNavigate }) {
  return (
    <header className="subscription-public-header">
      <button className="subscription-brand-button" type="button" onClick={() => onNavigate(session ? "/dashboard" : "/")} aria-label="Open ZenshoTech home">
        <BrandWordmark />
      </button>
      <nav aria-label="Account navigation">
        <button className="text-button" type="button" onClick={() => onNavigate("/pricing")}>Pricing</button>
        {session
          ? <button className="ghost-button" type="button" onClick={() => onNavigate("/subscription")}>Subscription</button>
          : <button className="ghost-button" type="button" onClick={() => onNavigate("/")}>Sign In</button>}
        {!session && <button className="primary-button" type="button" onClick={() => onNavigate("/register")}>Register</button>}
      </nav>
    </header>
  );
}

function RegistrationPage({ session, onRegistered, onNavigate }) {
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "", confirmPassword: "", agreements: false });
  const [googleCredential, setGoogleCredential] = useState("");
  const [googleProfile, setGoogleProfile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Register — ZenshoTech";
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  }

  async function startGoogleRegistration(credential) {
    if (!credential || submitting) return;
    setErrors({});
    setSubmitting(true);
    try {
      const result = await authenticateWithGoogle({ credential });
      onRegistered(result);
    } catch (error) {
      if (error.payload?.code === "GOOGLE_REGISTRATION_REQUIRED") {
        const profile = error.payload.profile;
        setGoogleCredential(credential);
        setGoogleProfile(profile);
        setForm((current) => ({ ...current, name: profile.name || "", email: profile.email || "" }));
      } else {
        setErrors({ form: error.message || "Google registration could not be started." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = {};
    if (form.businessName.trim().length < 2) nextErrors.businessName = "Enter your business or clinic name.";
    if (!googleCredential) {
      if (form.name.trim().length < 2) nextErrors.name = "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
      if (form.password.length < 8) nextErrors.password = "Use at least 8 characters.";
      if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (!form.agreements) nextErrors.agreements = "Accept the Terms of Service and Privacy Policy to continue.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    try {
      const result = googleCredential
        ? await authenticateWithGoogle({
          credential: googleCredential,
          businessName: form.businessName.trim(),
          termsAccepted: true,
          privacyAccepted: true,
        })
        : await registerAccount({
          name: form.name.trim(),
          businessName: form.businessName.trim(),
          email: form.email.trim(),
          password: form.password,
          termsAccepted: true,
          privacyAccepted: true,
        });
      const registrationParams = new URLSearchParams(window.location.search);
      const selectedPlan = registrationParams.get("plan");
      const selectedBilling = registrationParams.get("billing") === "annual" ? "annual" : "monthly";
      const pricingParams = new URLSearchParams({ onboarding: "1", billing: selectedBilling });
      if (selectedPlan) pricingParams.set("plan", selectedPlan);
      onRegistered({ ...result, redirectTo: `/pricing?${pricingParams.toString()}` });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [error.status === 409 ? "email" : "form"]: error.message || "Registration could not be completed. Please try again.",
      }));
      if (googleCredential && error.status === 401) {
        setGoogleCredential("");
        setGoogleProfile(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="subscription-public-page registration-public-page">
      <PublicSubscriptionHeader session={session} onNavigate={onNavigate} />
      <section className="registration-layout">
        <div className="registration-intro">
          <p className="eyebrow">Start with confidence</p>
          <h1>Start your 7-day free trial</h1>
          <p>Create your secure workspace, compare plans, then choose when to begin the trial. Registration alone does not start the trial.</p>
          <ul>
            <li><Check size={17} /> All core ZenshoTech modules included</li>
            <li><Check size={17} /> No payment details required to register</li>
            <li><Check size={17} /> Free responsive website with up to 8 pages</li>
          </ul>
        </div>
        <form className="subscription-form-card" onSubmit={submit} noValidate>
          <BrandWordmark className="registration-logo" />
          <div><p className="eyebrow">Create your account</p><h2>Business owner registration</h2></div>
          {session ? (
            <div className="inline-state warning"><ShieldCheck size={18} /><span>You are already signed in as {session.email}.</span></div>
          ) : <>
            {errors.form && <div className="inline-state danger" role="alert"><AlertCircle size={17} /><span>{errors.form}</span></div>}
            <GoogleIdentityButton mode="signup" onCredential={startGoogleRegistration} disabled={submitting} />
            <div className="login-demo-separator"><span>{googleProfile ? "Google account selected" : "or register with email"}</span></div>
            {googleProfile && <div className="inline-state success"><Check size={17} /><span>Continue as {googleProfile.name} ({googleProfile.email}). Add your clinic name below.</span></div>}
            <label><span>Full name</span><input autoComplete="name" maxLength={100} value={form.name} readOnly={Boolean(googleProfile)} onChange={(event) => update("name", event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <small className="field-error">{errors.name}</small>}</label>
            <label><span>Business or clinic name</span><input autoComplete="organization" maxLength={140} value={form.businessName} onChange={(event) => update("businessName", event.target.value)} aria-invalid={Boolean(errors.businessName)} />{errors.businessName && <small className="field-error">{errors.businessName}</small>}</label>
            <label><span>Email address</span><input autoComplete="email" type="email" maxLength={160} value={form.email} readOnly={Boolean(googleProfile)} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email}</small>}</label>
            {!googleProfile && <>
              <label><span>Password</span><div className="login-password-field"><input autoComplete="new-password" minLength={8} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} aria-invalid={Boolean(errors.password)} /><button className="login-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <small className="field-error">{errors.password}</small>}</label>
              <label><span>Confirm password</span><div className="login-password-field"><input autoComplete="new-password" minLength={8} type={showConfirmation ? "text" : "password"} value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} /><button className="login-password-toggle" type="button" aria-label={showConfirmation ? "Hide confirmed password" : "Show confirmed password"} onClick={() => setShowConfirmation((value) => !value)}>{showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.confirmPassword && <small className="field-error">{errors.confirmPassword}</small>}</label>
            </>}
            <label className="checkbox-field registration-agreement"><input type="checkbox" checked={form.agreements} onChange={(event) => update("agreements", event.target.checked)} /><span>I agree to the Terms of Service and Privacy Policy.</span></label>
            {errors.agreements && <small className="field-error">{errors.agreements}</small>}
            <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "Creating secure workspace..." : googleProfile ? "Create workspace with Google" : "Continue to pricing"}</button>
          </>}
          {session && <button className="primary-button full" type="button" onClick={() => {
            const billing = new URLSearchParams(window.location.search).get("billing") === "annual" ? "annual" : "monthly";
            onNavigate(`/pricing?onboarding=1&billing=${billing}`);
          }}>Continue to pricing</button>}
          <button className="text-button full" type="button" onClick={() => onNavigate("/")}>Already have an account? Sign in</button>
        </form>
      </section>
    </main>
  );
}

const proposalModuleLabels = [
  "POS", "Appointments", "Online Booking", "Client Database", "Leads Management", "Email Marketing", "SMS Marketing", "Staff Management", "Staff Scheduling", "Face Tracking Attendance", "Inventory Management", "Expenses", "Reports and Analytics", "Multiple Branch Management", "PDF Flipbook Viewer", "Website and Social Media Integration",
];

function PricingPage({ session, onNavigate, onSessionUpdate, onboarding = false }) {
  const [catalog, setCatalog] = useState({ plans: [], websitePackage: null });
  const [loading, setLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [billingCycle, setBillingCycle] = useState(() => new URLSearchParams(window.location.search).get("billing") === "annual" ? "annual" : "monthly");

  useEffect(() => {
    document.title = "Pricing — ZenshoTech";
    let cancelled = false;
    loadPublicPlans().then((result) => { if (!cancelled) setCatalog(result); }).catch((loadError) => { if (!cancelled) setError(loadError.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function choosePlan(plan) {
    setError("");
    setMessage("");
    if (plan.billingInterval === "one_time") {
      requestQuote(plan);
      return;
    }
    if (!session) {
      onNavigate(`/register?plan=${encodeURIComponent(plan.code)}&billing=${encodeURIComponent(billingCycle)}`);
      return;
    }
    setSubmittingPlan(plan.code);
    try {
      if (["pending_plan", "trialing"].includes(session.subscription?.status)) {
        const result = await startSubscriptionTrial(plan.code, billingCycle);
        onSessionUpdate(result);
      } else {
        const result = await requestSubscriptionActivation(plan.code, billingCycle);
        setMessage(result.message);
      }
    } catch (planError) {
      setError(planError.message || "The plan request could not be completed.");
    } finally {
      setSubmittingPlan("");
    }
  }

  function requestQuote(plan) {
    const quoteBilling = plan.billingInterval === "one_time" ? "one_time" : billingCycle;
    onNavigate(`/inquire?interest=zenshotech-pricing&plan=${encodeURIComponent(plan.code)}&billing=${encodeURIComponent(quoteBilling)}`);
  }

  const monthlyPlans = catalog.plans.filter((plan) => plan.billingInterval === "month");
  const lifetimePlan = catalog.plans.find((plan) => plan.billingInterval === "one_time");
  return (
    <main className="subscription-public-page pricing-public-page">
      <PublicSubscriptionHeader session={session} onNavigate={onNavigate} />
      <section className="pricing-hero">
        <p className="eyebrow">Simple ZenshoTech pricing</p>
        <h1>Choose the plan that fits your clinic</h1>
        <p>Start with a 7-day free trial—no payment details required. Every subscription also includes a professionally designed responsive website with up to 8 pages.</p>
        <p>Pay one month at a time or prepay 12 months and save 10%. You can also request a tailored quote before you activate.</p>
        {(onboarding || new URLSearchParams(window.location.search).get("onboarding") === "1") && <div className="inline-state success"><Check size={18} /><span>Your workspace is ready. Select a plan and billing period to begin the trial.</span></div>}
        {message && <div className="inline-state success"><Check size={18} /><span>{message}</span></div>}
        {error && <div className="inline-state danger" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      </section>

      {loading ? <div className="pricing-loading"><RefreshCw className="spin" size={24} /> Loading plans...</div> : <>
        <div className="billing-cycle-selector" role="group" aria-label="Billing period">
          <button className={billingCycle === "monthly" ? "active" : ""} type="button" aria-pressed={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")}>Pay Monthly</button>
          <button className={billingCycle === "annual" ? "active" : ""} type="button" aria-pressed={billingCycle === "annual"} onClick={() => setBillingCycle("annual")}>Pay 12 Months <span>Save 10%</span></button>
        </div>
        <section className="pricing-card-grid" aria-label="Subscription plans">
          {monthlyPlans.map((plan) => (
            <article className={`pricing-plan-card${plan.recommended ? " recommended" : ""}`} key={plan.code}>
              {plan.recommended && <span className="pricing-recommended">Most Popular</span>}
              <div>
                <p className="eyebrow">{plan.name}</p>
                <div className="pricing-amount"><strong>{planPrice(billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice)}</strong><span>{billingCycle === "annual" ? "/12 months" : "/month"}</span></div>
                <p className="pricing-billing-note">{billingCycle === "annual" ? `${planPrice(plan.annualPrice / 12)} per month equivalent · billed once yearly` : "Billed one month at a time"}</p>
              </div>
              <ul>
                <li><Check size={16} /> 7-day free trial</li>
                <li><Check size={16} /> No setup fee</li>
                <li><Check size={16} /> {billingCycle === "annual" ? "12 months prepaid with 10% discount" : "Flexible monthly payment"}</li>
                <li><Check size={16} /> {plan.maxUsers === null ? "Unlimited users" : `Up to ${plan.maxUsers} users`}</li>
                <li><Check size={16} /> {plan.maxBranches === null ? "Unlimited branches" : plan.maxBranches === 1 ? "1 branch" : `Up to ${plan.maxBranches} branches`}</li>
                <li><Check size={16} /> Free website with up to 8 pages</li>
                <li><Check size={16} /> Additional website pages quoted separately</li>
              </ul>
              <div className="pricing-card-actions">
                <button className={plan.recommended ? "primary-button full" : "ghost-button full"} type="button" disabled={Boolean(submittingPlan)} onClick={() => choosePlan(plan)}>{submittingPlan === plan.code ? "Starting trial..." : session?.subscription?.status === "trialing" ? `Switch to ${plan.name} · ${billingCycle === "annual" ? "Annual" : "Monthly"}` : "Start 7-Day Free Trial"}</button>
                <button className="text-button full" type="button" onClick={() => requestQuote(plan)}>Request a Quote</button>
              </div>
            </article>
          ))}
        </section>

        {lifetimePlan && <section className="lifetime-plan-card">
          <div><p className="eyebrow">One-Time Purchase</p><h2>{planPrice(lifetimePlan.monthlyPrice)}</h2><p>Complete agreed system package, initial configuration, and onboarding. Final scope and activation are confirmed by ZenshoTech.</p></div>
          <ul><li><Check size={16} /> No monthly software subscription</li><li><Check size={16} /> Free website with up to 8 pages</li><li><Check size={16} /> Additional pages and future custom development quoted separately</li></ul>
          <button className="primary-button" type="button" onClick={() => requestQuote(lifetimePlan)}>Request One-Time Quote</button>
        </section>}

        <section className="website-inclusion-card">
          <div><p className="eyebrow">Included with every plan</p><h2>{catalog.websitePackage?.title || "Free Website Included"}</h2></div>
          <ul>{(catalog.websitePackage?.features || []).map((feature) => <li key={feature}><Check size={17} /> {feature}</li>)}</ul>
          <p>{catalog.websitePackage?.note}</p>
          <div className="website-page-definition"><strong>What counts as one website page?</strong><p>One unique public-facing route—such as Home, About, Services, an individual service page, Treatments, Booking, Gallery, or Contact. Repeated sections on the same route do not count as separate pages.</p><p>The 8-page allowance applies only to the website-development service. It never limits ZenshoTech modules, users within the selected plan, customer records, appointments, products, treatments, campaigns, or operational data.</p></div>
        </section>

        <section className="feature-comparison-card">
          <div><p className="eyebrow">Complete system access</p><h2>All listed modules are included in every monthly plan</h2></div>
          <div className="feature-comparison-grid">{proposalModuleLabels.map((label) => <div key={label}><Check size={16} /><span>{label}</span></div>)}</div>
        </section>
      </>}
    </main>
  );
}

function SubscriptionPage({ session, onLogout, onNavigate }) {
  const [subscription, setSubscription] = useState(session.subscription);
  const [adminSubscriptions, setAdminSubscriptions] = useState([]);
  const [adminActionId, setAdminActionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = "Subscription — ZenshoTech";
    let cancelled = false;
    Promise.all([
      loadSubscription(),
      session.platformAdmin ? loadAdminSubscriptions() : Promise.resolve({ subscriptions: [] }),
    ]).then(([result, adminResult]) => {
      if (!cancelled) {
        setSubscription(result.subscription);
        setAdminSubscriptions(adminResult.subscriptions || []);
      }
    }).catch((loadError) => { if (!cancelled) setError(loadError.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session.platformAdmin]);
  async function requestActivation() {
    setError(""); setMessage("");
    try {
      const result = await requestSubscriptionActivation(subscription.planCode, subscription.billingCycle || "monthly");
      setSubscription(result.subscription); setMessage(result.message);
    } catch (activationError) { setError(activationError.message); }
  }
  async function applyAdminAction(row, action) {
    setAdminActionId(`${row.organization.id}:${action}`);
    setError("");
    try {
      const payload = { action };
      if (action === "activate") {
        payload.planCode = row.requestedPlanCode || row.planCode || "starter";
        payload.billingCycle = row.requestedBillingCycle || row.billingCycle || "monthly";
      }
      if (action === "extend_trial") payload.hours = 24;
      const result = await updateAdminSubscription(row.organization.id, payload);
      setAdminSubscriptions((current) => current.map((item) => item.organization.id === row.organization.id ? { ...item, ...result.subscription } : item));
      setMessage(`${row.organization.name} subscription updated.`);
    } catch (adminError) {
      setError(adminError.message || "Subscription administration failed.");
    } finally {
      setAdminActionId("");
    }
  }
  const plan = subscription?.plan;
  return (
    <main className="subscription-public-page subscription-account-page">
      <PublicSubscriptionHeader session={session} onNavigate={onNavigate} />
      <section className="subscription-account-card">
        <div className="subscription-account-heading"><div><p className="eyebrow">Workspace subscription</p><h1>{plan?.name || "Choose a plan"}</h1></div><span className={`subscription-status status-${subscription?.status}`}>{String(subscription?.status || "pending_plan").replace(/_/g, " ")}</span></div>
        {loading && <div className="pricing-loading"><RefreshCw className="spin" size={20} /> Loading subscription...</div>}
        {message && <div className="inline-state success"><Check size={18} /> {message}</div>}
        {error && <div className="inline-state danger"><AlertCircle size={18} /> {error}</div>}
        {subscription?.requestedPlan && <div className="inline-state warning"><Clock size={18} /><span>Pending quotation and activation: {subscription.requestedPlan.name} · {subscription.requestedBillingCycle === "annual" ? "12-month term with 10% savings" : "monthly billing"}.</span></div>}
        <div className="subscription-metrics">
          <article><span>Current plan</span><strong>{plan?.name || "Not selected"}</strong><small>{plan?.billingInterval === "month" ? subscription?.billingCycle === "annual" ? "12-month billing · 10% savings" : "Monthly billing" : plan?.billingInterval === "one_time" ? "One-time access" : "Existing-account access"}</small></article>
          <article><span>Users</span><strong>{subscription?.usage?.users ?? 0}{plan?.maxUsers === null ? " / Unlimited" : ` / ${plan?.maxUsers ?? "—"}`}</strong><small>Active users and valid pending invitations count.</small></article>
          <article><span>Branches</span><strong>{subscription?.usage?.branches ?? 0}{plan?.maxBranches === null ? " / Unlimited" : ` / ${plan?.maxBranches ?? "—"}`}</strong><small>Archived branches do not count.</small></article>
          <article><span>Website package</span><strong>Up to {subscription?.includedWebsitePages || 8} pages</strong><small>Additional pages are quoted separately.</small></article>
        </div>
        {subscription?.trialEndAt && <div className="subscription-date-panel"><Clock size={20} /><div><strong>Trial expiration</strong><span>{formatDateTime(subscription.trialEndAt)}</span></div></div>}
        {subscription?.renewalAt && <div className="subscription-date-panel"><CalendarDays size={20} /><div><strong>{subscription.billingCycle === "annual" ? "Annual term renewal" : "Next monthly renewal"}</strong><span>{formatDateTime(subscription.renewalAt)}</span></div></div>}
        <div className="subscription-actions"><button className="primary-button" type="button" onClick={() => onNavigate("/pricing")}>View Plans</button>{subscription?.planCode && ["trialing", "expired"].includes(subscription.status) && <button className="ghost-button" type="button" onClick={requestActivation}>Request Quote &amp; Activation</button>}<button className="text-button" type="button" onClick={() => onNavigate("/dashboard")}>Return to dashboard</button><button className="text-button" type="button" onClick={onLogout}>Sign out</button></div>
      </section>
      {session.platformAdmin && <section className="subscription-admin-card">
        <div><p className="eyebrow">ZenshoTech administration</p><h2>Subscription controls</h2><p>Paid and lifetime access require an explicit administrator action. Every action is audited.</p></div>
        <div className="subscription-admin-list">
          {adminSubscriptions.length ? adminSubscriptions.map((row) => <article key={row.organization.id}>
            <div><strong>{row.organization.name}</strong><span>{row.plan?.name || "No plan"} · {String(row.status).replace(/_/g, " ")}</span><small>{row.usage.users} users · {row.usage.branches} branches{row.requestedPlanCode ? ` · Requested ${row.requestedPlanCode} (${row.requestedBillingCycle === "annual" ? "12 months, 10% off" : "monthly"})${row.requestedBilling?.amount ? ` · Internal baseline ${planPrice(row.requestedBilling.amount)}` : ""}` : row.billingCycle ? ` · ${row.billingCycle === "annual" ? "Annual" : row.billingCycle}` : ""}</small></div>
            <div><button className="ghost-button small" type="button" disabled={Boolean(adminActionId)} onClick={() => applyAdminAction(row, "activate")}>{adminActionId === `${row.organization.id}:activate` ? "Activating..." : `Activate ${row.requestedBillingCycle === "annual" ? "annual" : "monthly"}`}</button><button className="ghost-button small" type="button" disabled={Boolean(adminActionId)} onClick={() => applyAdminAction(row, "grant_lifetime")}>Grant lifetime</button><button className="ghost-button small" type="button" disabled={Boolean(adminActionId)} onClick={() => applyAdminAction(row, "extend_trial")}>Extend 24h</button><button className="text-button small" type="button" disabled={Boolean(adminActionId)} onClick={() => applyAdminAction(row, row.status === "past_due" ? "reactivate" : "suspend")}>{row.status === "past_due" ? "Reactivate" : "Suspend"}</button></div>
          </article>) : <p>No managed subscription records yet.</p>}
        </div>
      </section>}
    </main>
  );
}

function SubscriptionExpiredPage({ session, onLogout, onNavigate }) {
  useEffect(() => { document.title = "Trial ended — ZenshoTech"; }, []);
  return (
    <main className="subscription-public-page subscription-expired-page">
      <PublicSubscriptionHeader session={session} onNavigate={onNavigate} />
      <section className="subscription-expired-card"><AlertCircle size={36} /><p className="eyebrow">Trial ended</p><h1>Your 7-day free trial has ended.</h1><p>Choose a plan to continue using ZenshoTech. Your workspace and business data are preserved.</p><div><button className="primary-button" type="button" onClick={() => onNavigate("/pricing")}>Choose a plan</button><button className="ghost-button" type="button" onClick={() => onNavigate("/subscription")}>View subscription</button><button className="text-button" type="button" onClick={onLogout}>Sign out</button></div></section>
    </main>
  );
}

function TrialBanner({ subscription, onNavigate }) {
  if (subscription?.status !== "trialing" || !subscription.trialEndAt) return null;
  const remainingMs = new Date(subscription.trialEndAt).getTime() - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / 86_400_000));
  return (
    <aside className={`trial-banner${remainingMs <= 86_400_000 ? " urgent" : ""}`} role="status">
      <div><Clock size={19} /><span>Your <strong>{subscription.plan?.name}</strong> trial ends in {remainingDays} day{remainingDays === 1 ? "" : "s"}.</span><small>{formatDateTime(subscription.trialEndAt)}</small></div>
      <div><button className="text-button" type="button" onClick={() => onNavigate("/pricing")}>View Plans</button><button className="ghost-button small" type="button" onClick={() => onNavigate("/subscription")}>Activate Subscription</button></div>
    </aside>
  );
}

function LoginScreen({ notice, onLogin, onGoogleAuthenticated, onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError.message || "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithGoogle(credential) {
    if (!credential || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const result = await authenticateWithGoogle({ credential });
      onGoogleAuthenticated(result);
    } catch (googleError) {
      if (googleError.payload?.code === "GOOGLE_REGISTRATION_REQUIRED") {
        setError("No ZenshoTech workspace is linked to this Google account yet. Choose Register, then continue with Google.");
      } else {
        setError(googleError.message || "Unable to sign in with Google.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReset() {
    setError("");
    setForgotMessage("");
    setResetSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setForgotMessage(result.message);
    } catch (resetError) {
      setError(resetError.message || "Unable to request a password reset.");
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <BrandWordmark className="login-logo" />
          <div>
            <p className="eyebrow">Secure role login</p>
            <h2>Sign in to your workspace</h2>
            <p className="login-helper">New to ZenshoTech? Start your 7-day free trial. No commitment.</p>
          </div>
          <GoogleIdentityButton mode="signin" onCredential={signInWithGoogle} disabled={submitting} />
          <div className="login-demo-separator"><span>or sign in with email</span></div>
          <label>
            <span>Email</span>
            <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <div className="login-password-field">
              <input
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="login-password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </label>
          {notice && <div className="inline-state warning" role="alert"><AlertCircle size={17} /><span>{notice}</span></div>}
          {error && <div className="inline-state danger"><AlertCircle size={17} /><span>{error}</span></div>}
          <button className="primary-button full" type="submit" disabled={submitting || !email || !password}>
            <LockKeyhole size={17} aria-hidden="true" />
            {submitting ? "Signing in..." : "Sign in securely"}
          </button>
          <button className="ghost-button full" type="button" onClick={() => setForgotOpen((value) => !value)}>
            Forgot password
          </button>
          {forgotOpen && (
            <div className="inline-state warning" aria-live="polite"><Mail size={17} aria-hidden="true" /><span>{forgotMessage || `Send a secure reset link to ${email || "your account"}.`}</span><button type="button" className="ghost-button small" disabled={!email || resetSubmitting} onClick={sendReset}>{resetSubmitting ? "Sending..." : "Send reset link"}</button></div>
          )}
          <div className="login-demo-separator"><span>New to ZenshoTech?</span></div>
          <button className="ghost-button full demo-account-button" type="button" onClick={() => onNavigate("/register")}>Register</button>
        </form>
      </section>
    </main>
  );
}

function ResetPasswordScreen({ token }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true);
    setError("");
    try {
      await resetAccountPassword(token, password);
      window.history.replaceState({}, "", window.location.pathname);
      setDone(true);
    } catch (resetError) {
      setError(resetError.message || "Unable to reset the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-panel"><form className="login-card" onSubmit={submit}><BrandWordmark className="login-logo" />{done ? <><p className="eyebrow">Password updated</p><h2>Your account is secure</h2><a className="primary-button full" href="/">Continue to sign in</a></> : <><p className="eyebrow">Secure password reset</p><h2>Create a new password</h2><p className="login-helper">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p><label><span>New password</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>Confirm password</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{error && <div className="inline-state danger"><AlertCircle size={17} /><span>{error}</span></div>}<button className="primary-button full" disabled={submitting || !password || !confirmPassword}>{submitting ? "Updating password..." : "Reset password"}</button></>}</form></section></main>;
}

function ChangePasswordScreen({ account, onChangePassword, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await onChangePassword(currentPassword, newPassword);
    } catch (passwordError) {
      setError(passwordError.message || "Unable to update the password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <BrandWordmark className="login-logo" />
          <div>
            <p className="eyebrow">First-time security setup</p>
            <h2>Create your private password</h2>
            <p className="login-helper">Signed in as {account.email}</p>
          </div>
          <label>
            <span>Temporary password</span>
            <input autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label>
            <span>New password</span>
            <input autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label>
            <span>Confirm new password</span>
            <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <p className="login-helper">Use 12+ characters with uppercase, lowercase, a number, and a symbol.</p>
          {error && <div className="inline-state danger"><AlertCircle size={17} /><span>{error}</span></div>}
          <button className="primary-button full" type="submit" disabled={submitting || !currentPassword || !newPassword || !confirmPassword}>
            <LockKeyhole size={17} aria-hidden="true" />
            {submitting ? "Updating password..." : "Save private password"}
          </button>
          <button className="ghost-button full" type="button" onClick={onLogout}>Sign out</button>
        </form>
      </section>
    </main>
  );
}

const moduleDescriptions = {
  pos: "Checkout, cart, payments",
  "card-view": "Live service cards",
  "staff-view": "Staff schedule and load",
  "room-view": "Room timeline",
  appointments: "Calendar and room flow",
  clients: "Profiles and balances",
  treatments: "Clinical notes and photos",
  services: "Catalog and pricing",
  inventory: "Stocks and movements",
  packages: "Sessions and redemptions",
  leads: "Inquiries and follow-ups",
  sms: "Campaigns and templates",
  staff: "Staff records and attendance",
  branches: "Locations and capacity",
  expenses: "Approvals and receipts",
  payroll: "Cutoffs, pay, and commissions",
  reports: "Sales and performance",
  booking: "Public request form",
  settings: "Company and security",
  support: "Help and audit guidance",
};

function ApplicationsModule({ session, visibleNav, setActiveModule }) {
  const [query, setQuery] = useState("");
  const searchable = normalize(query).trim();
  const excludedIds = new Set(["overview", "applications"]);
  const availableApps = visibleNav
    .filter((item) => !excludedIds.has(item.id))
    .filter((item) => !searchable || normalize(item.label).includes(searchable));
  const applicationCount = visibleNav.filter((item) => !excludedIds.has(item.id)).length;

  return (
    <section className="applications-page" aria-labelledby="applications-title">
      <div className="applications-glass">
        <header className="applications-header">
          <div className="applications-title-wrap">
            <button className="applications-brand" type="button" onClick={() => setActiveModule("overview")} aria-label="Return to overview">
              <img src={assets.logo} alt="" />
            </button>
            <div className="applications-heading">
              <span className="applications-kicker">ZenshoTech</span>
              <h2 id="applications-title">All applications</h2>
              <p>{applicationCount} applications available for {session.role}</p>
            </div>
          </div>
          <label className="applications-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search applications</span>
            <input
              type="search"
              placeholder="Search applications"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </header>

        {availableApps.length ? (
          <div className="applications-desktop-grid" aria-label="Available applications">
            {availableApps.map((item) => {
              const Icon = item.icon;
              return (
                <button className="desktop-application" key={item.id} type="button" onClick={() => setActiveModule(item.id)}>
                  <span className="desktop-application-icon"><Icon size={54} strokeWidth={1.7} aria-hidden="true" /></span>
                  <strong>{item.label}</strong>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="applications-empty">
            <Search size={26} aria-hidden="true" />
            <strong>No applications found</strong>
            <span>Try a different search.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Dashboard({
  session,
  stats,
  branchScope,
  clients,
  appointments,
  transactions,
  inventory,
  inventoryMovements = [],
  leads,
  services,
  staff,
  expenses,
  treatments,
  packages,
  consentTemplates = [],
  consentSubmissions = [],
  branchRecords,
  settings,
  users,
  visibleNav,
  setActiveModule,
  openModal,
}) {
  const dashboardBrandLabel = (value) => String(value ?? "").replace(/^MACE(?=[\s-])/i, "ZenshoTech");
  const allowedModules = modulesForSession(session);
  const [period, setPeriod] = useState("7d");
  const periodDays = period === "30d" ? 30 : period === "12m" ? 365 : 7;
  const endDate = todayDate();
  const startDate = isoDate(addDays(new Date(`${endDate}T12:00:00`), -(periodDays - 1)));
  const previousEndDate = isoDate(addDays(new Date(`${startDate}T12:00:00`), -1));
  const previousStartDate = isoDate(addDays(new Date(`${previousEndDate}T12:00:00`), -(periodDays - 1)));
  const inRange = (record, from = startDate, to = endDate) => {
    const date = dashboardRecordDate(record);
    return Boolean(date && date >= from && date <= to);
  };
  const validTransactions = transactions.filter((transaction) => transaction.status !== "Void" && !transaction.testMode && collectedTransactionAmount(transaction) > 0);
  const periodTransactions = validTransactions.filter((transaction) => inRange(transaction));
  const previousTransactions = validTransactions.filter((transaction) => inRange(transaction, previousStartDate, previousEndDate));
  const revenue = periodTransactions.reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
  const previousRevenue = previousTransactions.reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
  const todayAppointments = appointments
    .filter((appointment) => appointment.date === endDate)
    .sort((left, right) => parseTimeToMinutes(left.time) - parseTimeToMinutes(right.time));
  const newClients = clients.filter((client) => inRange(client));
  const previousClients = clients.filter((client) => inRange(client, previousStartDate, previousEndDate));
  const openLeads = leads.filter((lead) => !closedLeadStatuses.includes(canonicalLeadStatus(lead.status)));
  const periodOpenLeads = openLeads.filter((lead) => {
    const date = String(lead.updatedAt || lead.createdAt || lead.created || "").slice(0, 10);
    return date >= startDate && date <= endDate;
  });
  const lowStock = inventory.filter((item) => stockStatus(item) !== "Healthy").sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0));
  const rangeLabel = `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(`${startDate}T12:00:00`))} – ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${endDate}T12:00:00`))}`;
  const comparison = (current, previous) => {
    if (!previous) return current ? { value: 100, tone: "positive", label: "new in this period" } : { value: 0, tone: "neutral", label: "no change" };
    const value = Math.round(((current - previous) / previous) * 1000) / 10;
    return { value: Math.abs(value), tone: value > 0 ? "positive" : value < 0 ? "negative" : "neutral", label: "vs previous period" };
  };
  const yesterdayDate = isoDate(addDays(new Date(`${endDate}T12:00:00`), -1));
  const appointmentComparison = { ...comparison(todayAppointments.length, appointments.filter((appointment) => appointment.date === yesterdayDate).length), label: "vs yesterday" };
  const revenueComparison = comparison(revenue, previousRevenue);
  const clientComparison = comparison(newClients.length, previousClients.length);
  const leadComparison = { value: periodOpenLeads.length, tone: "neutral", label: "updated in selected period", percent: false };
  const chartPoints = (() => {
    const pointCount = period === "12m" ? 12 : 7;
    return Array.from({ length: pointCount }, (_, index) => {
      const bucketStart = addDays(new Date(`${startDate}T12:00:00`), Math.floor((index * periodDays) / pointCount));
      const bucketEnd = addDays(new Date(`${startDate}T12:00:00`), Math.floor(((index + 1) * periodDays) / pointCount) - 1);
      const from = isoDate(bucketStart);
      const to = isoDate(bucketEnd);
      const amount = validTransactions
        .filter((transaction) => inRange(transaction, from, to))
        .reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
      return {
        id: `${from}-${to}`,
        amount,
        label: new Intl.DateTimeFormat("en-PH", period === "12m" ? { month: "short" } : { month: "short", day: "numeric" }).format(bucketEnd),
      };
    });
  })();
  const chartMax = Math.max(1, ...chartPoints.map((point) => point.amount));
  const chartCoordinates = chartPoints.map((point, index) => {
    const x = chartPoints.length === 1 ? 350 : (index / (chartPoints.length - 1)) * 700;
    const y = 155 - (point.amount / chartMax) * 125;
    return { ...point, x, y };
  });
  const chartLinePoints = chartCoordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const chartAreaPoints = `0,160 ${chartLinePoints} 700,160`;
  const activityDate = (record, preferUpdated = false) => String((preferUpdated ? record?.updatedAt : null) || record?.createdAt || record?.created || record?.date || "").slice(0, 10);
  const activity = [
    ...(allowedModules.includes("pos") ? periodTransactions.map((transaction) => ({ id: `transaction-${transaction.id}`, icon: ReceiptText, title: "Sale completed", meta: `${dashboardBrandLabel(transaction.invoice || "Sale")}${transaction.client ? ` · ${transaction.client}` : ""} · ${money.format(collectedTransactionAmount(transaction))}`, date: dashboardRecordDate(transaction), time: transaction.time || "" })) : []),
    ...(allowedModules.includes("appointments") ? appointments.filter((appointment) => { const date = activityDate(appointment); return date >= startDate && date <= endDate; }).map((appointment) => ({ id: `appointment-${appointment.id}`, icon: CalendarDays, title: "Appointment booked", meta: `${appointment.client} · ${dashboardBrandLabel(appointment.service)}`, date: activityDate(appointment), time: "" })) : []),
    ...(allowedModules.includes("clients") ? newClients.map((client) => ({ id: `client-${client.id}`, icon: Users, title: "New client added", meta: client.fullName || client.name || "Client profile", date: activityDate(client), time: "" })) : []),
    ...(allowedModules.includes("inventory") ? inventoryMovements.filter((movement) => inRange(movement)).map((movement) => ({ id: `inventory-${movement.id}`, icon: Boxes, title: "Inventory received", meta: `${movement.item} · ${Number(movement.qty || 0).toLocaleString("en-PH")} ${movement.unit || "units"}`, date: dashboardRecordDate(movement), time: "" })) : []),
    ...(allowedModules.includes("leads") ? leads.filter((lead) => { const date = activityDate(lead, true); return date >= startDate && date <= endDate; }).map((lead) => ({ id: `lead-${lead.id}`, icon: Inbox, title: "Lead updated", meta: `${lead.name || "Lead"} · ${canonicalLeadStatus(lead.status)}`, date: activityDate(lead, true), time: "" })) : []),
  ].sort((left, right) => `${right.date} ${right.time}`.localeCompare(`${left.date} ${left.time}`)).slice(0, 5);
  const branchPerformance = branchRecords
    .filter((branch) => branchScope === "All branches" || branch.name === branchScope)
    .filter((branch) => branch.status === "Active" || branch.branchStatus === "Active")
    .map((branch) => {
      const branchRevenue = periodTransactions.filter((transaction) => transaction.branch === branch.name).reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
      const previous = previousTransactions.filter((transaction) => transaction.branch === branch.name).reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
      const percentage = previous ? Math.round((branchRevenue / previous) * 100) : branchRevenue ? 100 : 0;
      return { ...branch, revenue: branchRevenue, previous, percentage };
    });
  const activityModule = allowedModules.includes("appointments") ? "appointments" : allowedModules.includes("clients") ? "clients" : allowedModules.includes("leads") ? "leads" : "overview";
  const quickActions = [
    allowedModules.includes("appointments") && { label: "Add appointment", icon: CalendarDays, onClick: () => openModal("appointment", { status: "Draft", date: endDate }) },
    allowedModules.includes("clients") && { label: "New client", icon: Users, onClick: () => openModal("client") },
    allowedModules.includes("pos") && { label: "Create sale", icon: ShoppingBag, onClick: () => setActiveModule("pos") },
    allowedModules.includes("sms") && { label: "Send campaign", icon: Send, onClick: () => openModal("campaign") },
  ].filter(Boolean);

  return (
    <div className="clinic-dashboard">
      <header className="clinic-dashboard-welcome">
        <div>
          <p className="eyebrow">ZENSHOTECH</p>
          <h2>Good morning, {dashboardBrandLabel(session.name)}</h2>
          <p>Here&apos;s what&apos;s happening across your clinics today.</p>
        </div>
        <div className="clinic-dashboard-controls">
          <label className="clinic-dashboard-range">
            <CalendarDays size={17} aria-hidden="true" />
            <span className="sr-only">Dashboard date range</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Dashboard date range">
              <option value="7d">{period === "7d" ? `${rangeLabel} · 7 days` : "Last 7 days"}</option>
              <option value="30d">{period === "30d" ? `${rangeLabel} · 30 days` : "Last 30 days"}</option>
              <option value="12m">{period === "12m" ? `${rangeLabel} · 12 months` : "Last 12 months"}</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          {allowedModules.includes("appointments") && <button className="clinic-dashboard-primary" type="button" onClick={() => openModal("appointment", { status: "Draft", date: endDate })}><Plus size={17} aria-hidden="true" /> New appointment</button>}
        </div>
      </header>

      <section className="clinic-kpi-grid" aria-label="Clinic performance summary">
        {allowedModules.includes("appointments") && <DashboardKpi icon={CalendarDays} label="Today’s appointments" value={todayAppointments.length.toLocaleString("en-PH")} comparison={appointmentComparison} />}
        {allowedModules.includes("pos") && <DashboardKpi icon={CircleDollarSign} label="Revenue" value={money.format(revenue)} comparison={revenueComparison} tone="sage" />}
        {allowedModules.includes("clients") && <DashboardKpi icon={UserCheck} label="New clients" value={newClients.length.toLocaleString("en-PH")} comparison={clientComparison} />}
        {allowedModules.includes("leads") && <DashboardKpi icon={Users} label="Open leads" value={openLeads.length.toLocaleString("en-PH")} comparison={leadComparison} tone="sage" />}
      </section>

      <section className="clinic-dashboard-main-grid">
        {allowedModules.includes("appointments") && <article className="clinic-dashboard-card appointments-card">
          <DashboardCardHeading title="Appointments today" action="View all" onAction={() => setActiveModule("appointments")} />
          {todayAppointments.length ? (
            <div className="dashboard-appointment-table" role="table" aria-label="Today's appointments">
              <div className="dashboard-appointment-head" role="row"><span>Time</span><span>Patient</span><span>Service</span><span>Practitioner</span><span>Status</span></div>
              {todayAppointments.slice(0, 5).map((appointment) => (
                <div className="dashboard-appointment-row" role="row" key={appointment.id}>
                  <time dateTime={`${appointment.date}T${appointment.time}`}>{formatScheduleTime(parseTimeToMinutes(appointment.time))}</time>
                  <span className="dashboard-patient"><i>{initialsFor(appointment.client)}</i><span><strong>{appointment.client}</strong><small>{appointment.id}</small></span></span>
                  <span><strong>{dashboardBrandLabel(appointment.service)}</strong><small>{appointmentDurationMinutes(appointment, services)} min</small></span>
                  <span><strong>{appointment.staff || "Unassigned"}</strong><small>{appointment.room || "Room pending"}</small></span>
                  <StatusBadge status={canonicalAppointmentStatus(appointment.status)} />
                </div>
              ))}
            </div>
          ) : <EmptyState title="No appointments today" copy="New bookings for today will appear here." />}
          <button className="clinic-card-footer-action" type="button" onClick={() => setActiveModule("appointments")}>View full schedule <ChevronRight size={15} aria-hidden="true" /></button>
        </article>}

        {allowedModules.includes("pos") && <article className="clinic-dashboard-card revenue-card">
          <div className="dashboard-card-heading revenue-heading">
            <div><h3>Revenue overview</h3><strong>{money.format(revenue)}</strong><small>Total revenue</small></div>
            <div className="revenue-period-tabs" role="group" aria-label="Revenue period">
              {[{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "12m", label: "12 months" }].map((option) => <button aria-pressed={period === option.id} className={period === option.id ? "active" : ""} key={option.id} onClick={() => setPeriod(option.id)} type="button">{option.label}</button>)}
            </div>
          </div>
          <div className="dashboard-revenue-comparison"><span className={revenueComparison.tone}>{revenueComparison.tone === "negative" ? "▼" : revenueComparison.tone === "positive" ? "▲" : "•"} {revenueComparison.value}%</span> vs previous period</div>
          <div className="dashboard-revenue-chart" role="img" aria-label={`Revenue trend totaling ${money.format(revenue)}`}>
            <svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="dashboard-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c59751" stopOpacity="0.34" /><stop offset="100%" stopColor="#c59751" stopOpacity="0.03" /></linearGradient></defs>
              <polygon points={chartAreaPoints} fill="url(#dashboard-revenue-fill)" />
              <polyline points={chartLinePoints} fill="none" stroke="#b78338" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              {chartCoordinates.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#b78338" strokeWidth="2.5"><title>{point.label}: {money.format(point.amount)}</title></circle>)}
            </svg>
            <div className={`dashboard-revenue-labels ${period === "12m" ? "twelve" : ""}`}>{chartCoordinates.map((point) => <small key={point.id}>{point.label}</small>)}</div>
          </div>
        </article>}
      </section>

      <section className="clinic-dashboard-secondary-grid">
        <article className="clinic-dashboard-card">
          <DashboardCardHeading title="Recent activity" action="View all" onAction={() => setActiveModule(activityModule)} />
          {activity.length ? <div className="dashboard-activity-list">{activity.map(({ icon: Icon, ...item }) => <div className="dashboard-activity-item" key={item.id}><span><Icon size={16} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.meta}</small></div><time>{item.time ? formatScheduleTime(parseTimeToMinutes(item.time)) : formatDate(item.date)}</time></div>)}</div> : <EmptyState title="No recent activity" copy="Activity in this date range will appear here." />}
        </article>

        {allowedModules.includes("inventory") && <article className="clinic-dashboard-card">
          <DashboardCardHeading title="Inventory alerts" action="View all" onAction={() => setActiveModule("inventory")} />
          {lowStock.length ? <div className="dashboard-inventory-list">{lowStock.slice(0, 4).map((item) => <button type="button" onClick={() => setActiveModule("inventory")} key={item.id}><span className="inventory-alert-icon"><AlertCircle size={16} aria-hidden="true" /></span><span><strong>{item.item}</strong><small>{item.category || item.unit || "Inventory item"}</small></span><span><strong>{Number(item.stock || 0).toLocaleString("en-PH")} {item.unit || "left"}</strong><small>{stockStatus(item) === "Out" ? "Out of stock" : "Reorder soon"}</small></span></button>)}</div> : <EmptyState title="Inventory levels are healthy" copy="Low-stock and reorder items will appear here." />}
          <button className="clinic-card-footer-action" type="button" onClick={() => setActiveModule("inventory")}>View all inventory <ChevronRight size={15} aria-hidden="true" /></button>
        </article>}

        {allowedModules.includes("reports") && <article className="clinic-dashboard-card">
          <DashboardCardHeading title="Branch performance" action={period === "12m" ? "12 months" : period === "30d" ? "30 days" : "7 days"} />
          {branchPerformance.length ? <div className="dashboard-branch-list">{branchPerformance.map((branch) => <div className="dashboard-branch-item" key={branch.id}><div><strong>{dashboardBrandLabel(branch.name)}</strong><span>{branch.percentage}%</span></div><small>{money.format(branch.revenue)} / {branch.previous ? `${money.format(branch.previous)} previous` : "No previous-period target"}</small><i><span style={{ width: `${Math.min(100, branch.percentage)}%` }} /></i></div>)}</div> : <EmptyState title="No branch performance yet" copy="Revenue appears after completed sales in this date range." />}
          <button className="clinic-card-footer-action" type="button" onClick={() => setActiveModule(allowedModules.includes("branches") ? "branches" : "reports")}>{allowedModules.includes("branches") ? "View all branches" : "View reports"} <ChevronRight size={15} aria-hidden="true" /></button>
        </article>}
      </section>

      {quickActions.length > 0 && <section className="clinic-dashboard-quick-actions" aria-label="Quick actions">{quickActions.map(({ icon: Icon, ...action }) => <button type="button" onClick={action.onClick} key={action.label}><Icon size={19} aria-hidden="true" /> {action.label}</button>)}</section>}
    </div>
  );
}

function DashboardKpi({ icon: Icon, label, value, comparison, tone = "champagne" }) {
  return (
    <article className={`clinic-kpi-card ${tone}`}>
      <span className="clinic-kpi-icon"><Icon size={22} aria-hidden="true" /></span>
      <div><small>{label}</small><strong>{value}</strong><span className={comparison.tone}>{comparison.tone === "negative" ? "▼" : comparison.tone === "positive" ? "▲" : "•"} {comparison.value}{comparison.percent === false ? "" : "%"} <em>{comparison.label}</em></span></div>
    </article>
  );
}

function DashboardCardHeading({ title, action, onAction }) {
  return <div className="dashboard-card-heading"><h3>{title}</h3>{action && (onAction ? <button type="button" onClick={onAction}>{action}</button> : <span>{action}</span>)}</div>;
}

const dashboardPeriods = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

function dashboardPeriodRange(period) {
  const today = todayDate();
  if (period === "today") return { from: today, to: today };
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: "", to: "" };
}

function dashboardPeriodCopy(period) {
  const today = new Date(`${todayDate()}T12:00:00`);
  if (period === "today") {
    return new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(today);
  }
  if (period === "month") {
    return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(today);
  }
  if (period === "year") return `${today.getFullYear()} year to date`;
  return "All recorded activity";
}

function dashboardRecordDate(record) {
  return String(record?.date || record?.created || record?.createdAt || "").slice(0, 10);
}

function dashboardRecordInRange(record, range) {
  if (!range.from && !range.to) return true;
  const date = dashboardRecordDate(record);
  if (!date) return false;
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

function collectedTransactionAmount(transaction) {
  if (transaction.status === "Void" || transaction.testMode) return 0;
  const payments = Array.isArray(transaction.payments) ? transaction.payments : [];
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  if (collected > 0) return collected;
  return ["Paid", "Completed"].includes(transaction.status) ? Number(transaction.total || 0) : 0;
}

function monthKeysEndingAt(monthKey, count = 6) {
  const [year, month] = monthKey.split("-").map(Number);
  const anchor = new Date(year, month - 1, 1, 12);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(anchor.getFullYear(), anchor.getMonth() - (count - index - 1), 1, 12);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  });
}

function OverallBusinessDashboard({
  allowedModules,
  appointments,
  branchScope,
  clients,
  expenses,
  inventory,
  leads,
  packages,
  setActiveModule,
  transactions,
  treatments,
}) {
  const [period, setPeriod] = useState("all");
  const range = useMemo(() => dashboardPeriodRange(period), [period]);
  const activeTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.status !== "Void" && !transaction.testMode),
    [transactions],
  );
  const periodTransactions = useMemo(
    () => activeTransactions.filter((transaction) => dashboardRecordInRange(transaction, range)),
    [activeTransactions, range],
  );
  const periodExpenses = useMemo(
    () => expenses.filter((expense) => dashboardRecordInRange(expense, range)),
    [expenses, range],
  );
  const earnings = periodTransactions.reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0);
  const grossSales = periodTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const approvedExpenses = periodExpenses
    .filter((expense) => expense.status === "Approved")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const pendingExpenses = periodExpenses.filter((expense) => expense.status === "For approval");
  const pendingExpenseTotal = pendingExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const netEarnings = earnings - approvedExpenses;
  const netMargin = earnings ? Math.round((netEarnings / earnings) * 100) : 0;
  const outstandingSales = Math.max(0, grossSales - earnings);
  const averageTransaction = periodTransactions.length ? earnings / periodTransactions.length : 0;
  const countInPeriod = (records) => records.filter((record) => dashboardRecordInRange(record, range)).length;
  const allowed = new Set(allowedModules);

  const recordBreakdown = [
    { module: "clients", label: "Clients", count: countInPeriod(clients), icon: Users },
    { module: "appointments", label: "Appointments", count: countInPeriod(appointments), icon: CalendarDays },
    { module: "pos", label: "Transactions", count: countInPeriod(transactions), icon: WalletCards },
    { module: "treatments", label: "Treatments", count: countInPeriod(treatments), icon: HeartPulse },
    { module: "expenses", label: "Expenses", count: countInPeriod(expenses), icon: ReceiptText },
    { module: "leads", label: "Leads", count: countInPeriod(leads), icon: Inbox },
    { module: "inventory", label: "Inventory", count: countInPeriod(inventory), icon: Boxes },
    { module: "packages", label: "Packages", count: countInPeriod(packages), icon: Gift },
  ].filter((item) => allowed.has(item.module));
  const totalRecords = recordBreakdown.reduce((sum, item) => sum + item.count, 0);

  const activityMonths = [...activeTransactions, ...expenses]
    .map((record) => dashboardRecordDate(record).slice(0, 7))
    .filter((value) => /^\d{4}-\d{2}$/.test(value))
    .sort();
  const trendMonths = monthKeysEndingAt(activityMonths.at(-1) || todayDate().slice(0, 7));
  const trendRows = trendMonths.map((month) => {
    const monthTransactions = activeTransactions.filter((transaction) => transaction.date?.startsWith(month));
    const monthExpenses = expenses.filter((expense) => expense.status === "Approved" && expense.date?.startsWith(month));
    return {
      month,
      earnings: monthTransactions.reduce((sum, transaction) => sum + collectedTransactionAmount(transaction), 0),
      expenses: monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    };
  });
  const trendMax = Math.max(1, ...trendRows.flatMap((row) => [row.earnings, row.expenses]));
  const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "short" });
  const recentActivity = [
    ...activeTransactions.map((transaction) => ({
      id: `sale-${transaction.id}`,
      date: transaction.date,
      time: transaction.time || "",
      title: transaction.invoice || "Sale",
      meta: transaction.client || transaction.branch,
      amount: collectedTransactionAmount(transaction),
      kind: "earning",
      status: transaction.status,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.date,
      time: "",
      title: expense.name,
      meta: expense.category || expense.branch,
      amount: Number(expense.amount || 0),
      kind: "expense",
      status: expense.status,
    })),
  ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 6);
  const openLeadCount = leads.filter((lead) => !closedLeadStatuses.includes(canonicalLeadStatus(lead.status))).length;
  const activeAppointmentCount = appointments.filter((appointment) => isActiveAppointmentStatus(appointment.status)).length;
  const lowStockCount = inventory.filter((item) => stockStatus(item) !== "Healthy").length;

  return (
    <section className="business-dashboard" aria-labelledby="business-dashboard-title">
      <header className="business-dashboard-header">
        <div>
          <p className="eyebrow">Business overview</p>
          <h2 id="business-dashboard-title">Your clinic, by the numbers.</h2>
          <p>{branchScope} · {dashboardPeriodCopy(period)}</p>
        </div>
        <div className="dashboard-period-tabs" role="group" aria-label="Dashboard reporting period">
          {dashboardPeriods.map((option) => (
            <button
              aria-pressed={period === option.id}
              className={period === option.id ? "active" : ""}
              key={option.id}
              onClick={() => setPeriod(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="business-kpi-grid">
        <article className="business-kpi-card records">
          <div className="business-kpi-icon"><Database size={21} aria-hidden="true" /></div>
          <div><span>Total records</span><strong>{totalRecords.toLocaleString("en-PH")}</strong></div>
          <small>Across {recordBreakdown.length} accessible modules</small>
        </article>
        <article className="business-kpi-card earnings">
          <div className="business-kpi-icon"><CircleDollarSign size={21} aria-hidden="true" /></div>
          <div><span>Earnings</span><strong>{money.format(earnings)}</strong></div>
          <small>{periodTransactions.length} transaction{periodTransactions.length === 1 ? "" : "s"} collected</small>
        </article>
        <article className="business-kpi-card expenses">
          <div className="business-kpi-icon"><ReceiptText size={21} aria-hidden="true" /></div>
          <div><span>Expenses</span><strong>{money.format(approvedExpenses)}</strong></div>
          <small>{pendingExpenses.length ? `${money.format(pendingExpenseTotal)} awaiting approval` : "No costs awaiting approval"}</small>
        </article>
        <article className={`business-kpi-card net ${netEarnings < 0 ? "negative" : ""}`}>
          <div className="business-kpi-icon"><BarChart3 size={21} aria-hidden="true" /></div>
          <div><span>Net earnings</span><strong>{money.format(netEarnings)}</strong></div>
          <small>{netMargin}% net margin after approved costs</small>
        </article>
      </div>

      <div className="business-insights-grid">
        <article className="surface-panel finance-trend-panel">
          <div className="finance-panel-heading">
            <div>
              <p className="eyebrow">Cash flow</p>
              <h3>Six-month financial trend</h3>
            </div>
            <div className="finance-chart-legend" aria-label="Chart legend">
              <span><i className="earning" /> Earnings</span>
              <span><i className="expense" /> Expenses</span>
            </div>
          </div>
          <div className="finance-chart" role="img" aria-label="Monthly earnings and approved expenses for the last six recorded months">
            {trendRows.map((row) => (
              <div className="finance-chart-month" key={row.month} title={`${row.month}: ${money.format(row.earnings)} earnings, ${money.format(row.expenses)} expenses`}>
                <div className="finance-chart-bars">
                  <span className="earning" style={{ height: row.earnings ? `${Math.max(8, (row.earnings / trendMax) * 100)}%` : "2px" }} />
                  <span className="expense" style={{ height: row.expenses ? `${Math.max(8, (row.expenses / trendMax) * 100)}%` : "2px" }} />
                </div>
                <small>{monthLabel.format(new Date(`${row.month}-01T12:00:00`))}</small>
              </div>
            ))}
          </div>
          <div className="finance-summary-strip">
            <span><small>Average transaction</small><strong>{money.format(averageTransaction)}</strong></span>
            <span><small>Gross sales</small><strong>{money.format(grossSales)}</strong></span>
            <span><small>Outstanding</small><strong>{money.format(outstandingSales)}</strong></span>
          </div>
        </article>

        <article className="surface-panel records-snapshot-panel">
          <div className="finance-panel-heading">
            <div>
              <p className="eyebrow">Records</p>
              <h3>Records snapshot</h3>
            </div>
            <span>{totalRecords.toLocaleString("en-PH")} total</span>
          </div>
          <div className="record-breakdown-grid">
            {recordBreakdown.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.module} onClick={() => setActiveModule(item.module)} type="button">
                  <span><Icon size={17} aria-hidden="true" />{item.label}</span>
                  <strong>{item.count.toLocaleString("en-PH")}</strong>
                </button>
              );
            })}
          </div>
          <div className="operations-strip">
            <span><strong>{activeAppointmentCount}</strong><small>Active bookings</small></span>
            <span><strong>{openLeadCount}</strong><small>Open leads</small></span>
            <span><strong>{lowStockCount}</strong><small>Stock alerts</small></span>
          </div>
        </article>
      </div>

      <article className="surface-panel financial-activity-panel">
        <div className="finance-panel-heading">
          <div>
            <p className="eyebrow">Latest movement</p>
            <h3>Recent earnings and expenses</h3>
          </div>
          <button type="button" onClick={() => setActiveModule("reports")}>View reports <ChevronRight size={15} aria-hidden="true" /></button>
        </div>
        {recentActivity.length ? (
          <div className="financial-activity-list">
            {recentActivity.map((item) => (
              <div className="financial-activity-row" key={item.id}>
                <span className={`financial-activity-icon ${item.kind}`}>
                  {item.kind === "earning" ? <WalletCards size={17} aria-hidden="true" /> : <ReceiptText size={17} aria-hidden="true" />}
                </span>
                <span className="financial-activity-copy"><strong>{item.title}</strong><small>{item.meta} · {formatDate(item.date)}</small></span>
                <StatusBadge status={item.status} />
                <strong className={item.kind === "earning" ? "amount-positive" : "amount-negative"}>
                  {item.kind === "earning" ? "+" : "−"}{money.format(item.amount)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No financial activity yet" copy="Sales and approved expense records will appear here." />
        )}
      </article>
    </section>
  );
}

function buildRoleWorkspace({
  session,
  stats,
  clients,
  appointments,
  transactions,
  inventory,
  leads,
  services,
  staff,
  expenses,
  treatments,
  packages,
  settings,
  users,
  topServices,
  topProducts,
  branchCards,
  activeBranchCount,
  allowedModules,
  setActiveModule,
  openModal,
}) {
  const allowed = new Set(allowedModules);
  const go = (module) => () => setActiveModule(module);
  const moduleAction = (module, icon, title, copy) =>
    allowed.has(module) ? { icon, title, copy, onClick: go(module) } : null;
  const modalAction = (type, icon, title, copy) => ({ icon, title, copy, onClick: () => openModal(type) });
  const pendingAppointments = appointments.filter((item) => isActiveAppointmentStatus(item.status));
  const openLeads = leads.filter((item) => !closedLeadStatuses.includes(canonicalLeadStatus(item.status)));
  const lowStock = inventory.filter((item) => stockStatus(item) !== "Healthy");
  const pendingExpenses = expenses.filter((item) => item.status === "For approval");
  const partialTransactions = transactions.filter((item) => ["Partial", "Partially Paid", "Unpaid"].includes(item.status));
  const activePackages = packages.filter((item) => item.status === "Active");
  const treatmentRows = treatments.slice(0, 5).map((item) => ({
    title: item.client,
    meta: `${item.service} / ${formatDate(item.date)}`,
    value: `${item.photos} photo${item.photos === 1 ? "" : "s"}`,
  }));
  const appointmentRows = appointments.slice(0, 5).map((item) => ({
    title: item.client,
    meta: `${item.time} / ${item.service}`,
    status: item.status,
  }));
  const transactionRows = transactions.slice(0, 5).map((item) => ({
    title: item.invoice,
    meta: `${item.client} / ${item.branch}`,
    value: money.format(item.total),
    status: item.status,
  }));
  const leadRows = openLeads.slice(0, 5).map((item) => ({
    title: item.name,
    meta: `${item.source} / ${item.interest}`,
    status: item.status,
  }));
  const inventoryRows = lowStock.slice(0, 5).map((item) => ({
    title: item.item,
    meta: `${item.branch} / reorder ${item.reorder}`,
    value: `${item.stock} left`,
  }));
  const branchRows = branchCards.map((branch) => ({
    title: branch.name,
    meta: `${branch.city} / ${branch.rooms.length} rooms`,
    value: money.format(branch.revenue),
  }));

  const commonMetrics = {
    revenueToday: { icon: CircleDollarSign, label: "Revenue today", value: money.format(stats.revenueToday), tone: "wine" },
    revenueMonth: { icon: WalletCards, label: "Revenue month", value: money.format(stats.revenueMonth), tone: "green" },
    appointments: { icon: CalendarDays, label: "Appointments", value: stats.todaysAppointments.length, tone: "amber" },
    pending: { icon: Inbox, label: "Pending", value: stats.pendingAppointments.length, tone: "rose" },
    clients: { icon: Users, label: "Clients", value: clients.length, tone: "blue" },
    lowStock: { icon: AlertCircle, label: "Stock alerts", value: lowStock.length, tone: "muted" },
  };

  const defaults = {
    tone: "owner",
    eyebrow: `${session.role} workspace`,
    title: `Welcome back, ${session.name}.`,
    copy: "Your available apps and daily work are gathered here for fast access.",
    chips: ["Daily work", "Client care", "Clinic flow"],
    metrics: [commonMetrics.appointments, commonMetrics.pending, commonMetrics.clients, commonMetrics.lowStock],
    actions: [
      moduleAction("appointments", CalendarDays, "Appointments", "Open calendar and room flow"),
      moduleAction("clients", Users, "Clients", "Find profiles and balances"),
      moduleAction("support", ShieldCheck, "Support", "Open guidance and help"),
    ].filter(Boolean),
    focusIcon: Activity,
    focusTitle: "Next actions",
    focusAction: "Role queue",
    focusItems: [
      moduleAction("appointments", CalendarDays, `${pendingAppointments.length} active bookings`, "Review arrivals and room assignments"),
      moduleAction("clients", Users, `${clients.length} client profiles`, "Search or update client records"),
      moduleAction("support", ShieldCheck, "Support center", "Open workflow help"),
    ].filter(Boolean),
    panels: [
      { icon: Clock, title: "Today's Flow", action: `${appointments.length} bookings`, rows: appointmentRows, empty: "No appointments today" },
      { icon: Inbox, title: "Open Follow-ups", action: `${openLeads.length} leads`, rows: leadRows, empty: "No open leads" },
    ],
  };

  const configs = {
    Owner: {
      tone: "owner",
      eyebrow: "Owner command center",
      title: "Branch performance, approvals, and revenue in one view.",
      copy: "Track sales, expenses, staff, packages, and clinic momentum without leaving the admin workspace.",
      chips: ["Revenue", "Approvals", "Branches", "Staff"],
      metrics: [
        commonMetrics.revenueToday,
        commonMetrics.revenueMonth,
        { icon: BarChart3, label: "Net profit", value: money.format(stats.netProfit), tone: "green" },
        { icon: ReceiptText, label: "Expenses", value: money.format(stats.expensesMonth), tone: "amber" },
        commonMetrics.appointments,
        commonMetrics.lowStock,
      ],
      actions: [
        moduleAction("reports", BarChart3, "Reports", "Review sales and profit"),
        moduleAction("expenses", ReceiptText, "Expenses", "Approve operating costs"),
        moduleAction("staff", BriefcaseBusiness, "Staff", "Manage roles and attendance"),
        moduleAction("settings", Settings, "Settings", "Company and receipt controls"),
      ].filter(Boolean),
      focusIcon: Activity,
      focusTitle: "Owner review",
      focusAction: `${pendingExpenses.length} approvals`,
      focusItems: [
        moduleAction("reports", BarChart3, `${money.format(stats.netProfit)} net profit`, "Review branch performance"),
        moduleAction("expenses", ReceiptText, `${pendingExpenses.length} expenses for approval`, "Audit receipts and approvers"),
        moduleAction("inventory", Boxes, `${lowStock.length} inventory alerts`, "Review reorder exposure"),
      ].filter(Boolean),
      panels: [
        { icon: Store, title: "Branch Pulse", action: `${branchCards.length} branches`, rows: branchRows, empty: "No branch data" },
        { icon: WalletCards, title: "Payment Watch", action: `${partialTransactions.length} partial`, rows: partialTransactions.map((item) => ({ title: item.invoice, meta: item.client, value: money.format(item.total), status: item.status })), empty: "No partial payments" },
        { icon: Star, title: "Top Services", action: "This month", rows: topServices.map((item) => ({ title: item.name, meta: "Service sales", value: `${item.count} sold` })), empty: "No service sales yet" },
        { icon: ShoppingBag, title: "Retail Movers", action: "Inventory", rows: topProducts.map((item) => ({ title: item.name, meta: "Retail movement", value: `${item.count} units` })), empty: "No retail movement yet" },
      ],
    },
    "Super Admin": {
      tone: "admin",
      eyebrow: "Super admin workspace",
      title: "Access, settings, and system readiness for every branch.",
      copy: "Manage configuration, branches, audit readiness, and the full ZenshoTech module set.",
      chips: ["Access", "Settings", "Audit", "Branches"],
      metrics: [
        { icon: ShieldCheck, label: "Users", value: users.length, tone: "blue" },
        { icon: LayoutDashboard, label: "Modules", value: navItems.length - 1, tone: "wine" },
        { icon: Store, label: "Branches", value: activeBranchCount, tone: "green" },
        commonMetrics.lowStock,
        commonMetrics.revenueMonth,
        { icon: MessageSquareText, label: "SMS credits", value: settings.smsCredits, tone: "amber" },
      ],
      actions: [
        moduleAction("settings", Settings, "Settings", "Company, tax, and security"),
        moduleAction("branches", Store, "Branches", "Review locations"),
        moduleAction("reports", BarChart3, "Reports", "Export operations"),
        moduleAction("support", ShieldCheck, "Support", "Open support resources"),
      ].filter(Boolean),
      focusIcon: Database,
      focusTitle: "System checks",
      focusAction: settings.backup,
      focusItems: [
        moduleAction("settings", Settings, settings.taxMode, "Tax and receipt configuration"),
        moduleAction("staff", BriefcaseBusiness, `${staff.length} staff records`, "Review roles and attendance"),
        moduleAction("branches", Store, `${activeBranchCount} ${activeBranchCount === 1 ? "branch" : "branches"} active`, "Confirm branch setup"),
      ].filter(Boolean),
      panels: [
        { icon: ShieldCheck, title: "Access Map", action: `${users.length} users`, rows: users.slice(0, 6).map((item) => ({ title: item.name, meta: item.branch, value: item.role })), empty: "No users configured" },
        { icon: AlertCircle, title: "Inventory Alerts", action: `${lowStock.length} items`, rows: inventoryRows, empty: "All stock levels healthy" },
        { icon: ReceiptText, title: "Recent Transactions", action: `${transactions.length} records`, rows: transactionRows, empty: "No transactions" },
        { icon: MessageSquareText, title: "Communication", action: `${settings.smsCredits} credits`, rows: openLeads.slice(0, 4).map((item) => ({ title: item.name, meta: item.nextStep, status: item.status })), empty: "No active follow-ups" },
      ],
    },
    "Branch Manager": {
      tone: "manager",
      eyebrow: "Branch manager workspace",
      title: "Daily branch flow, staffing, sales, and stock control.",
      copy: "Keep appointments moving, monitor low stock, and stay close to branch performance.",
      chips: ["Rooms", "Staff", "Inventory", "Sales"],
      metrics: [commonMetrics.revenueToday, commonMetrics.appointments, commonMetrics.pending, commonMetrics.lowStock, { icon: BriefcaseBusiness, label: "Staff", value: staff.length, tone: "blue" }, commonMetrics.clients],
      actions: [
        moduleAction("appointments", CalendarDays, "Appointments", "Confirm room assignments"),
        moduleAction("pos", WalletCards, "POS", "Open checkout"),
        moduleAction("inventory", Boxes, "Inventory", "Receive or transfer stock"),
        moduleAction("staff", BriefcaseBusiness, "Staff", "Review attendance"),
      ].filter(Boolean),
      focusIcon: Clock,
      focusTitle: "Branch queue",
      focusAction: `${pendingAppointments.length} active`,
      focusItems: [
        moduleAction("appointments", CalendarDays, `${pendingAppointments.length} live bookings`, "Confirm arrivals and rooms"),
        moduleAction("inventory", Boxes, `${lowStock.length} reorder alerts`, "Handle stock exposure"),
        moduleAction("reports", BarChart3, `${money.format(stats.revenueToday)} today`, "Review branch sales"),
      ].filter(Boolean),
      panels: [
        { icon: Clock, title: "Today's Flow", action: `${appointments.length} bookings`, rows: appointmentRows, empty: "No appointments today" },
        { icon: Boxes, title: "Reorder Watch", action: `${lowStock.length} alerts`, rows: inventoryRows, empty: "All stock levels healthy" },
        { icon: WalletCards, title: "Recent Sales", action: `${transactions.length} records`, rows: transactionRows, empty: "No transactions" },
        { icon: BriefcaseBusiness, title: "Team Status", action: `${staff.length} staff`, rows: staff.slice(0, 5).map((item) => ({ title: item.name, meta: item.schedule, value: item.attendance, status: item.status })), empty: "No staff records" },
      ],
    },
    Receptionist: {
      tone: "frontdesk",
      eyebrow: "Reception workspace",
      title: "Bookings, arrivals, client lookup, and follow-ups.",
      copy: "Handle the front desk queue quickly with appointment, client, lead, and booking tools at hand.",
      chips: ["Arrivals", "Bookings", "Clients", "Leads"],
      metrics: [commonMetrics.appointments, commonMetrics.pending, { icon: Inbox, label: "Open leads", value: openLeads.length, tone: "rose" }, commonMetrics.clients],
      actions: [
        modalAction("appointment", Plus, "Add appointment", "Create a new booking"),
        moduleAction("appointments", CalendarDays, "Appointments", "Manage today's schedule"),
        moduleAction("clients", Users, "Clients", "Find or update profiles"),
        moduleAction("leads", Inbox, "Leads", "Follow up inquiries"),
      ].filter(Boolean),
      focusIcon: PhoneCall,
      focusTitle: "Front desk queue",
      focusAction: `${pendingAppointments.length} active`,
      focusItems: [
        moduleAction("appointments", CalendarDays, `${pendingAppointments.length} bookings to watch`, "Confirm arrivals and room handoffs"),
        moduleAction("leads", Inbox, `${openLeads.length} inquiries open`, "Call or message follow-ups"),
        moduleAction("booking", Globe2, "Booking portal", "Preview online requests"),
      ].filter(Boolean),
      panels: [
        { icon: Clock, title: "Arrivals", action: `${appointments.length} today`, rows: appointmentRows, empty: "No arrivals today" },
        { icon: Inbox, title: "Lead Follow-ups", action: `${openLeads.length} open`, rows: leadRows, empty: "No open leads" },
        { icon: Users, title: "Client Care", action: `${clients.length} profiles`, rows: clients.slice(0, 5).map((item) => ({ title: item.fullName, meta: item.mobile, value: item.tag })), empty: "No clients" },
        { icon: Gift, title: "Package Holders", action: `${activePackages.length} active`, rows: activePackages.slice(0, 5).map((item) => ({ title: item.client, meta: item.name, value: `${item.sessions - item.used} left`, status: item.status })), empty: "No active packages" },
      ],
    },
    Cashier: {
      tone: "cashier",
      eyebrow: "Cashier workspace",
      title: "Checkout, payments, packages, and daily sales.",
      copy: "Move quickly from POS to payment review, partial balances, package sales, and expense records.",
      chips: ["POS", "Payments", "Packages", "Reports"],
      metrics: [
        commonMetrics.revenueToday,
        { icon: ReceiptText, label: "Transactions", value: transactions.length, tone: "blue" },
        { icon: WalletCards, label: "Partial", value: partialTransactions.length, tone: "amber" },
        { icon: Gift, label: "Packages", value: activePackages.length, tone: "green" },
      ],
      actions: [
        moduleAction("pos", WalletCards, "Open POS", "Start checkout"),
        moduleAction("packages", Gift, "Packages", "Sell or redeem sessions"),
        moduleAction("expenses", ReceiptText, "Expenses", "Record operating costs"),
        moduleAction("reports", BarChart3, "Reports", "Daily totals"),
      ].filter(Boolean),
      focusIcon: CircleDollarSign,
      focusTitle: "Payment queue",
      focusAction: `${partialTransactions.length} partial`,
      focusItems: [
        moduleAction("pos", WalletCards, "Start a checkout", "Build cart and complete payment"),
        moduleAction("packages", Gift, `${activePackages.length} active packages`, "Redeem or review balances"),
        moduleAction("reports", BarChart3, `${money.format(stats.revenueToday)} today`, "Review sales summary"),
      ].filter(Boolean),
      panels: [
        { icon: ReceiptText, title: "Recent Transactions", action: `${transactions.length} records`, rows: transactionRows, empty: "No transactions" },
        { icon: WalletCards, title: "Partial Payments", action: `${partialTransactions.length} open`, rows: partialTransactions.map((item) => ({ title: item.invoice, meta: item.client, value: money.format(item.total), status: item.status })), empty: "No partial payments" },
        { icon: Gift, title: "Package Balances", action: `${activePackages.length} active`, rows: activePackages.slice(0, 5).map((item) => ({ title: item.client, meta: item.name, value: `${item.sessions - item.used} left`, status: item.status })), empty: "No active packages" },
        { icon: BarChart3, title: "Daily Summary", action: money.format(stats.revenueToday), rows: [{ title: "Revenue this month", meta: "Gross sales", value: money.format(stats.revenueMonth) }, { title: "Services today", meta: "Completed service items", value: stats.servicesToday }, { title: "Transactions", meta: "Filtered scope", value: transactions.length }], empty: "No summary" },
      ],
    },
    Doctor: {
      tone: "doctor",
      eyebrow: "Doctor workspace",
      title: "Clinical schedule, treatment records, and patient context.",
      copy: "Move from appointments to client profiles, treatment documentation, and service protocols.",
      chips: ["Appointments", "Treatment records", "Clients", "Protocols"],
      metrics: [
        commonMetrics.appointments,
        { icon: UserCheck, label: "Arrived", value: appointments.filter((item) => canonicalAppointmentStatus(item.status) === "Arrived").length, tone: "green" },
        commonMetrics.clients,
        { icon: HeartPulse, label: "Treatments", value: treatments.length, tone: "rose" },
      ],
      actions: [
        moduleAction("appointments", CalendarDays, "Appointments", "Review clinical queue"),
        moduleAction("clients", Users, "Clients", "Open patient profiles"),
        moduleAction("treatments", HeartPulse, "Treatments", "Document procedures"),
        moduleAction("services", Sparkles, "Services", "Review protocols"),
      ].filter(Boolean),
      focusIcon: HeartPulse,
      focusTitle: "Clinical queue",
      focusAction: `${appointments.length} bookings`,
      focusItems: [
        moduleAction("appointments", CalendarDays, `${appointments.length} appointments today`, "Review rooms and timing"),
        moduleAction("treatments", HeartPulse, `${treatments.length} treatment records`, "Open clinical documentation"),
        moduleAction("clients", Users, `${clients.length} client profiles`, "Review notes and contraindications"),
      ].filter(Boolean),
      panels: [
        { icon: Clock, title: "Today's Patients", action: `${appointments.length} bookings`, rows: appointmentRows, empty: "No appointments today" },
        { icon: HeartPulse, title: "Recent Treatments", action: `${treatments.length} records`, rows: treatmentRows, empty: "No treatment records" },
        { icon: Users, title: "Clinical Notes", action: `${clients.length} clients`, rows: clients.slice(0, 5).map((item) => ({ title: item.fullName, meta: item.skinConcerns, value: item.consentStatus })), empty: "No clients" },
        { icon: Sparkles, title: "Service Protocols", action: `${services.length} services`, rows: services.slice(0, 5).map((item) => ({ title: item.name, meta: item.category, value: `${item.duration} min`, status: item.active ? "Active" : "Inactive" })), empty: "No services" },
      ],
    },
  };

  const dashboardRole = isBusinessOwner(session.role)
    ? "Owner"
    : canManageOrganization(session.role)
      ? "Super Admin"
      : session.role;
  return { ...defaults, ...(configs[dashboardRole] ?? {}) };
}

function RolePanel({ panel }) {
  const Icon = panel.icon;

  return (
    <div className="surface-panel role-panel">
      <SectionHeader icon={Icon} title={panel.title} action={panel.action} />
      {panel.rows.length ? (
        <div className="role-detail-list">
          {panel.rows.map((row, index) => (
            <article className="role-detail-row" key={`${panel.title}-${row.title}-${index}`}>
              <div>
                <strong>{row.title}</strong>
                <span>{row.meta}</span>
              </div>
              {row.status ? <StatusBadge status={row.status} /> : <b>{row.value}</b>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={panel.empty} copy="This queue is clear for the selected scope." />
      )}
    </div>
  );
}

function POSModule({
  clients,
  services,
  inventory,
  staff,
  branchScope,
  cart,
  discounts,
  promotions = [],
  addCartItem,
  updateCartQty,
  removeCartItem,
  setCart,
  saveService,
  openModal,
  openPayment,
  transactions,
  voidTransaction,
  resetTestTransaction,
  onPrintReceipt,
  globalSearch,
  sessionRole,
  branchRecords = [],
  posCarts = [],
  saveOpenCart,
  notify,
  settings,
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [branch, setBranch] = useState(branchScope === "All branches" ? branchRecords.find((item) => item.status === "Active")?.name || "" : branchScope);
  const [staffName, setStaffName] = useState(staff[0]?.name ?? "");
  const [discountId, setDiscountId] = useState("");
  const [manualDiscountType, setManualDiscountType] = useState("");
  const [manualDiscountValue, setManualDiscountValue] = useState("");
  const [manualDiscountScope, setManualDiscountScope] = useState("Transaction");
  const [manualDiscountTargetKey, setManualDiscountTargetKey] = useState("");
  const [isDiscountPanelExpanded, setIsDiscountPanelExpanded] = useState(false);
  const [saleDate, setSaleDate] = useState(todayDate());
  const [testMode, setTestMode] = useState(false);
  const [activeCartId, setActiveCartId] = useState("");
  const [catalogTab, setCatalogTab] = useState("Services");
  const [posScreen, setPosScreen] = useState("Checkout");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [catalogPage, setCatalogPage] = useState(1);
  const [checkoutStep, setCheckoutStep] = useState("review");
  const [isSaleContextOpen, setIsSaleContextOpen] = useState(false);
  const [catalogFocusIndex, setCatalogFocusIndex] = useState(0);
  const [cartFocusIndex, setCartFocusIndex] = useState(0);
  const catalogSearchRef = useRef(null);
  const catalogItemRefs = useRef([]);
  const cartRowRefs = useRef([]);
  const saleClientRef = useRef(null);
  const canManagePosCatalog = canManageOrganization(sessionRole);
  const canPostHistoricalSale = canManageOrganization(sessionRole);
  const canUseTestMode = isAdmin(sessionRole);
  const canApprovePosAdjustments = canManageOrganization(sessionRole);
  const posPaymentOptions = useMemo(() => posQuickPaymentOptions(settings), [settings]);
  const posScreens = canManagePosCatalog ? ["Checkout", "Service Prices"] : ["Checkout"];
  const openCartsForBranch = useMemo(
    () => posCarts.filter((openCart) => openCart.branch === branch),
    [branch, posCarts],
  );
  const activeOpenCart = posCarts.find((openCart) => openCart.id === activeCartId);

  useEffect(() => {
    if (branchScope !== "All branches") setBranch(branchScope);
  }, [branchScope]);

  useEffect(() => {
    if (activeOpenCart?.branch === branch) return;
    const next = openCartsForBranch[0];
    if (next) {
      setActiveCartId(next.id);
      setClientId(next.clientId || "");
      setStaffName(next.staff || "");
      setDiscountId(next.discountId || "");
      setManualDiscountType(next.manualDiscountType || "");
      setManualDiscountValue(next.manualDiscountType ? String(next.manualDiscountValue || "") : "");
      setManualDiscountScope(next.manualDiscountScope || "Transaction");
      setManualDiscountTargetKey(next.manualDiscountTargetKey || "");
      setSaleDate(next.saleDate || todayDate());
      setTestMode(Boolean(next.testMode));
      setCart(Array.isArray(next.items) ? next.items : []);
    } else {
      setActiveCartId("");
      setCart([]);
      setDiscountId("");
      setManualDiscountType("");
      setManualDiscountValue("");
      setManualDiscountScope("Transaction");
      setManualDiscountTargetKey("");
      setSaleDate(todayDate());
      setTestMode(false);
    }
  }, [activeOpenCart?.branch, branch, openCartsForBranch, setCart]);

  useEffect(() => {
    if (!activeOpenCart || activeOpenCart.branch !== branch) return undefined;
    const nextDraft = {
      ...activeOpenCart,
      clientId,
      client: clients.find((item) => item.id === clientId)?.fullName || "Walk-in",
      branch,
      staff: staffName,
      items: cart,
      discountId,
      manualDiscountType,
      manualDiscountValue: Number(manualDiscountValue || 0),
      manualDiscountScope,
      manualDiscountTargetKey,
      saleDate,
      testMode,
    };
    const stored = JSON.stringify({ clientId: activeOpenCart.clientId, staff: activeOpenCart.staff, items: activeOpenCart.items, discountId: activeOpenCart.discountId, manualDiscountType: activeOpenCart.manualDiscountType || "", manualDiscountValue: Number(activeOpenCart.manualDiscountValue || 0), manualDiscountScope: activeOpenCart.manualDiscountScope || "Transaction", manualDiscountTargetKey: activeOpenCart.manualDiscountTargetKey || "", saleDate: activeOpenCart.saleDate || todayDate(), testMode: Boolean(activeOpenCart.testMode) });
    const pending = JSON.stringify({ clientId, staff: staffName, items: cart, discountId, manualDiscountType, manualDiscountValue: Number(manualDiscountValue || 0), manualDiscountScope, manualDiscountTargetKey, saleDate, testMode });
    if (stored === pending) return undefined;
    const timer = window.setTimeout(() => {
      void saveOpenCart(nextDraft).catch((error) => notify(error.message || "Unable to save the open POS cart.", "error"));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeOpenCart, branch, cart, clientId, clients, discountId, manualDiscountScope, manualDiscountTargetKey, manualDiscountType, manualDiscountValue, notify, saleDate, saveOpenCart, staffName, testMode]);

  useEffect(() => {
    if (!canManagePosCatalog && posScreen !== "Checkout") {
      setPosScreen("Checkout");
    }
  }, [canManagePosCatalog, posScreen]);

  const retailItems = useMemo(() => inventory.filter((item) => item.type === "Retail"), [inventory]);
  const activeServices = useMemo(() => services.filter((service) => service.active && service.pos), [services]);
  const catalogCategories = useMemo(() => {
    const source =
      catalogTab === "Services"
        ? activeServices.map((service) => service.category)
        : retailItems.map((item) => item.category);
    return ["All", ...new Set(source.filter(Boolean))];
  }, [activeServices, catalogTab, retailItems]);
  const normalizedCatalogQuery = normalize(catalogQuery.trim());
  const visibleServices = activeServices.filter((service) => {
    const matchesCategory = categoryFilter === "All" || service.category === categoryFilter;
    const matchesSearch = normalize(`${service.name} ${service.category}`).includes(normalizedCatalogQuery);
    return matchesCategory && matchesSearch;
  });
  const visibleProducts = retailItems.filter((item) => {
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    const matchesSearch = normalize(`${item.item} ${item.category} ${item.brand}`).includes(normalizedCatalogQuery);
    return matchesCategory && matchesSearch;
  });
  const catalogCount = catalogTab === "Services" ? visibleServices.length : visibleProducts.length;
  const visibleCatalogItems = catalogTab === "Services" ? visibleServices : visibleProducts;
  const catalogPageCount = Math.max(1, Math.ceil(visibleCatalogItems.length / posCatalogPageSize));
  const safeCatalogPage = Math.min(catalogPage, catalogPageCount);
  const catalogPageStart = (safeCatalogPage - 1) * posCatalogPageSize;
  const catalogPageEnd = Math.min(catalogPageStart + posCatalogPageSize, visibleCatalogItems.length);
  const pagedServices = catalogTab === "Services" ? visibleServices.slice(catalogPageStart, catalogPageEnd) : [];
  const pagedProducts = catalogTab === "Products" ? visibleProducts.slice(catalogPageStart, catalogPageEnd) : [];
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty || 1), 0);
  const serviceDiscountOptions = useMemo(() => cart.filter((item) => item.type === "Service"), [cart]);
  const manualDiscountTargetItem = serviceDiscountOptions.find((item) => item.key === manualDiscountTargetKey);

  useEffect(() => {
    if (!manualDiscountType || manualDiscountScope !== "Service" || manualDiscountTargetItem) return;
    if (serviceDiscountOptions[0]) setManualDiscountTargetKey(serviceDiscountOptions[0].key);
    else {
      setManualDiscountScope("Transaction");
      setManualDiscountTargetKey("");
    }
  }, [manualDiscountScope, manualDiscountTargetItem, manualDiscountType, serviceDiscountOptions]);

  const discount = discounts.find((item) => item.id === discountId);
  const normalizedManualDiscountValue = Math.max(0, Number(manualDiscountValue || 0));
  const manualDiscountBase = manualDiscountScope === "Service" && manualDiscountTargetItem
    ? Number(manualDiscountTargetItem.price || 0) * Number(manualDiscountTargetItem.qty || 1)
    : subtotal;
  const manualDiscount = useMemo(
    () => manualDiscountType ? {
      type: manualDiscountType,
      value: normalizedManualDiscountValue,
      scope: manualDiscountScope,
      targetKey: manualDiscountScope === "Service" ? manualDiscountTargetKey : "",
    } : null,
    [manualDiscountScope, manualDiscountTargetKey, manualDiscountType, normalizedManualDiscountValue],
  );
  const manualDiscountValidationMessage = manualDiscount?.scope === "Service" && !manualDiscountTargetItem
    ? "Choose a service to discount."
    : manualDiscount?.type === "Percentage" && manualDiscount.value > 100
      ? "Manual percentage cannot exceed 100%."
      : manualDiscount?.type === "Fixed amount" && manualDiscount.value > manualDiscountBase
        ? manualDiscount?.scope === "Service"
          ? "Manual discount cannot exceed the selected service total."
          : "Manual discount cannot exceed the subtotal."
        : "";
  const manualDiscountInvalid = Boolean(manualDiscountValidationMessage);
  const transactionDiscountAmount = manualDiscount
    ? manualDiscount.type === "Percentage"
      ? Math.round((manualDiscountBase * Math.min(100, manualDiscount.value)) / 100)
      : Math.min(manualDiscountBase, manualDiscount.value)
    : discount
      ? discount.type === "Percentage"
        ? Math.round((subtotal * Number(discount.value)) / 100)
        : Number(discount.value)
      : 0;
  const eligiblePromotions = promotions.filter((promotion) => {
    const applicableBranches = splitList(promotion.branches);
    return promotion.active && saleDate >= promotion.startDate && saleDate <= promotion.endDate
      && (!applicableBranches.length || applicableBranches.includes("All branches") || applicableBranches.includes(branch));
  });
  const promotionDiscountAmount = cart.reduce((sum, item) => {
    if (item.type !== "Service") return sum;
    const lineTotal = Number(item.price || 0) * Number(item.qty || 1);
    const best = eligiblePromotions.reduce((amount, promotion) => {
      const serviceIds = splitList(promotion.serviceIds);
      const packageNames = splitList(promotion.packageNames);
      const targetMatches = (!serviceIds.length && !packageNames.length)
        || serviceIds.includes(item.serviceId)
        || (item.serviceType === "Package" && packageNames.includes(item.name));
      if (!targetMatches) return amount;
      const candidate = promotion.discountType === "Percentage" ? (lineTotal * Number(promotion.value || 0)) / 100 : Math.min(lineTotal, Number(promotion.value || 0) * Number(item.qty || 1));
      return Math.max(amount, candidate);
    }, 0);
    return sum + Math.round(best);
  }, 0);
  const discountAmount = Math.min(subtotal, transactionDiscountAmount + promotionDiscountAmount);
  const total = Math.max(0, subtotal - discountAmount);
  const discountPanelSummary = manualDiscount
    ? `${manualDiscount.type === "Percentage" ? `${manualDiscount.value || 0}%` : money.format(manualDiscount.value || 0)}${manualDiscount.scope === "Service" ? ` on ${manualDiscountTargetItem?.name || "selected service"}` : " on entire transaction"}`
    : discount
      ? discount.name
      : promotionDiscountAmount > 0
        ? `Automatic promotion · ${money.format(promotionDiscountAmount)}`
        : "No discount";
  const client = clients.find((item) => item.id === clientId);
  const todaysTransactions = transactions.filter((transaction) => transaction.date === todayDate());
  const transactionSummaryRows = todaysTransactions.length ? todaysTransactions : transactions;
  const todaysTransactionTotal = todaysTransactions.reduce((sum, transaction) => transaction.status === "Void" || transaction.testMode ? sum : sum + Number(transaction.total || 0), 0);
  const staffAtBranch = staff.filter((person) => {
    const assignedBranches = splitList(person.branches);
    return person.branch === branch || assignedBranches.includes(branch) || person.branch === "All branches";
  });

  function providersForCartItem(item) {
    if (item.type !== "Service") return ["N/A"];
    const service = services.find((entry) => entry.id === item.serviceId);
    const allowedRoles = splitList(service?.staff);
    const providers = staffAtBranch.filter((person) => !allowedRoles.length || allowedRoles.includes(person.role) || allowedRoles.includes("All staff"));
    return ["N/A", ...providers.map((person) => person.name)];
  }

  async function persistActiveCart() {
    if (!activeOpenCart) return null;
    return saveOpenCart({
      ...activeOpenCart,
      clientId,
      client: client?.fullName || "Walk-in",
      branch,
      staff: staffName,
      items: cart,
      discountId,
      manualDiscountType,
      manualDiscountValue: normalizedManualDiscountValue,
      manualDiscountScope,
      manualDiscountTargetKey,
      saleDate,
      testMode,
    });
  }

  async function activateOpenCart(openCart) {
    if (!openCart || openCart.id === activeCartId) return;
    try {
      await persistActiveCart();
      setActiveCartId(openCart.id);
      setClientId(openCart.clientId || "");
      setStaffName(openCart.staff || "");
      setDiscountId(openCart.discountId || "");
      setManualDiscountType(openCart.manualDiscountType || "");
      setManualDiscountValue(openCart.manualDiscountType ? String(openCart.manualDiscountValue || "") : "");
      setManualDiscountScope(openCart.manualDiscountScope || "Transaction");
      setManualDiscountTargetKey(openCart.manualDiscountTargetKey || "");
      setSaleDate(openCart.saleDate || todayDate());
      setTestMode(Boolean(openCart.testMode));
      setCart(Array.isArray(openCart.items) ? openCart.items : []);
      setCheckoutStep("review");
    } catch (error) {
      notify(error.message || "Unable to switch POS carts.", "error");
    }
  }

  async function openCartForClient(nextClientId) {
    const existing = posCarts.find((openCart) => openCart.clientId === nextClientId && openCart.branch === branch);
    if (existing) {
      await activateOpenCart(existing);
      return existing;
    }
    const selectedClient = clients.find((item) => item.id === nextClientId);
    try {
      await persistActiveCart();
      const created = await saveOpenCart({
        clientId: nextClientId,
        client: selectedClient?.fullName || "Walk-in",
        branch,
        staff: staffName,
        items: [],
        discountId: "",
        manualDiscountType: "",
        manualDiscountValue: 0,
        manualDiscountScope: "Transaction",
        manualDiscountTargetKey: "",
        saleDate: todayDate(),
        testMode: false,
      });
      setActiveCartId(created.id);
      setClientId(created.clientId || "");
      setDiscountId("");
      setManualDiscountType("");
      setManualDiscountValue("");
      setManualDiscountScope("Transaction");
      setManualDiscountTargetKey("");
      setSaleDate(created.saleDate || todayDate());
      setTestMode(Boolean(created.testMode));
      setCart([]);
      setCheckoutStep("review");
      return created;
    } catch (error) {
      const conflictCart = error?.payload?.cart;
      if (conflictCart) await activateOpenCart(await saveOpenCart(conflictCart));
      else notify(error.message || "Unable to start a POS cart.", "error");
      return null;
    }
  }

  async function addPosCartItem(item) {
    let openCart = activeOpenCart;
    if (!openCart) openCart = await openCartForClient(clientId);
    if (!openCart) return;
    addCartItem(item);
  }

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogQuery, catalogTab, categoryFilter]);

  useEffect(() => {
    if (catalogPage > catalogPageCount) {
      setCatalogPage(catalogPageCount);
    }
  }, [catalogPage, catalogPageCount]);

  useEffect(() => {
    if (!cart.length) {
      setCheckoutStep("review");
    }
  }, [cart.length]);

  useEffect(() => {
    setCatalogFocusIndex(0);
  }, [catalogPage, catalogQuery, catalogTab, categoryFilter]);

  useEffect(() => {
    setCartFocusIndex((current) => Math.max(0, Math.min(current, cart.length - 1)));
    cartRowRefs.current = cartRowRefs.current.slice(0, cart.length);
  }, [cart.length]);

  useEffect(() => {
    if (!isSaleContextOpen) return;
    window.requestAnimationFrame(() => saleClientRef.current?.focus());
  }, [isSaleContextOpen]);

  useEffect(() => {
    if (posScreen !== "Checkout") return undefined;

    function handlePosShortcut(event) {
      if (document.querySelector(".modal-backdrop")) return;
      const target = event.target;
      const isEditing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);

      if (event.key === "F2" || (event.key === "/" && !isEditing)) {
        event.preventDefault();
        catalogSearchRef.current?.focus();
        catalogSearchRef.current?.select();
        return;
      }
      if (isEditing) return;

      if (event.key === "F3") {
        event.preventDefault();
        setCatalogTab((current) => current === "Services" ? "Products" : "Services");
        setCategoryFilter("All");
        setCatalogPage(1);
        return;
      }
      if (event.key === "F4") {
        event.preventDefault();
        setIsSaleContextOpen(true);
        return;
      }
      if (event.key === "F6" && cart.length) {
        event.preventDefault();
        const nextIndex = Math.min(cartFocusIndex, cart.length - 1);
        setCartFocusIndex(nextIndex);
        cartRowRefs.current[nextIndex]?.focus();
        return;
      }
      if (event.key === "F8" || (event.ctrlKey && event.key === "Enter")) {
        event.preventDefault();
        if (manualDiscountInvalid) notify(manualDiscountValidationMessage, "error");
        else if (cart.length) setCheckoutStep("payment");
        return;
      }
      if (checkoutStep === "payment" && /^[1-4]$/.test(event.key)) {
        const option = posPaymentOptions[Number(event.key) - 1];
        event.preventDefault();
        openPayment({
          clientId,
          clientName: client?.fullName ?? "Walk-in",
          branch,
          staff: staffName,
          cart,
          subtotal,
          discount,
          manualDiscount,
          discountAmount,
          total,
          notes: "",
          paymentMethod: option.method,
          paymentLabel: option.label,
          splitPayment: option.split,
          posCartId: activeCartId,
          saleDate,
          testMode,
        });
        return;
      }
      if (event.key === "Escape" && checkoutStep === "payment") {
        event.preventDefault();
        setCheckoutStep("review");
        return;
      }
      if (event.key === "[" && catalogPage > 1) {
        event.preventDefault();
        setCatalogPage((current) => Math.max(1, current - 1));
        return;
      }
      if (event.key === "]" && catalogPage < catalogPageCount) {
        event.preventDefault();
        setCatalogPage((current) => Math.min(catalogPageCount, current + 1));
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key === "Backspace" && cart.length) {
        event.preventDefault();
        setCart([]);
        setCheckoutStep("review");
      }
    }

    window.addEventListener("keydown", handlePosShortcut);
    return () => window.removeEventListener("keydown", handlePosShortcut);
  }, [activeCartId, branch, cart, cartFocusIndex, catalogPage, catalogPageCount, checkoutStep, client?.fullName, clientId, discount, discountAmount, manualDiscount, manualDiscountInvalid, manualDiscountValidationMessage, notify, openPayment, posPaymentOptions, posScreen, saleDate, setCart, staffName, subtotal, testMode, total]);

  function createPaymentDraft(patch = {}) {
    return {
      clientId,
      clientName: client?.fullName ?? "Walk-in",
      branch,
      staff: staffName,
      cart,
      subtotal,
      discount,
      manualDiscount,
      discountAmount,
      total,
      notes: "",
      posCartId: activeCartId,
      saleDate,
      testMode,
      ...patch,
    };
  }

  function showPaymentStep() {
    if (!cart.length) return;
    if (manualDiscountInvalid) {
      notify(manualDiscountValidationMessage, "error");
      return;
    }
    setCheckoutStep("payment");
  }

  function choosePayment(option) {
    if (!cart.length) return;
    if (manualDiscountInvalid) {
      notify(manualDiscountValidationMessage, "error");
      return;
    }
    openPayment(createPaymentDraft({
      paymentMethod: option.method,
      paymentLabel: option.label,
      splitPayment: option.split,
    }));
  }

  function buildCartReceipt() {
    return {
      id: "current-checkout",
      invoice: "Current checkout",
      date: saleDate,
      time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
      client: client?.fullName ?? "Walk-in",
      branch,
      staff: staffName || "Unassigned",
      items: cart.map((item) => ({
        serviceId: item.serviceId || "",
        name: item.name,
        type: item.type,
        qty: Number(item.qty || 1),
        price: Number(item.price || 0),
        priceModel: item.priceModel || "Fixed price",
        priceUnit: item.priceUnit || "",
        provider: item.provider || "N/A",
        aftercare: item.aftercare || "",
        recommendedIntervalDays: Number(item.recommendedIntervalDays || 0),
      })),
      subtotal,
      discount: discountAmount,
      total,
      payments: [],
      status: "Unpaid",
      notes: manualDiscount
        ? `Manual ${manualDiscount.type === "Percentage" ? `${manualDiscount.value}%` : money.format(manualDiscount.value)} discount applied${manualDiscount.scope === "Service" ? ` to ${manualDiscountTargetItem?.name || "selected service"}` : " to the entire transaction"}`
        : discount ? `${discount.name} applied` : "",
    };
  }

  function printCurrentReceipt() {
    if (cart.length) {
      onPrintReceipt(buildCartReceipt());
      return;
    }
    onPrintReceipt(transactionSummaryRows[0]);
  }

  function changeCatalogTab(tab) {
    setCatalogTab(tab);
    setCategoryFilter("All");
    setCatalogPage(1);
  }

  function addRetailProductFromPos() {
    openModal("inventory", {
      item: "",
      sku: `RTL-${Date.now().toString().slice(-6)}`,
      brand: "MACE Skin",
      category: "Retail",
      type: "Retail",
      unit: "piece",
      packQty: 1,
      stock: 1,
      branch,
      location: "POS shelf",
      reorder: 5,
      expiry: "2027-12-31",
      batch: "POS",
      supplier: "Internal",
      cost: 0,
      price: "",
    });
  }

  function focusCatalogItem(index) {
    const itemCount = catalogTab === "Services" ? pagedServices.length : pagedProducts.length;
    if (!itemCount) return;
    const nextIndex = (index + itemCount) % itemCount;
    setCatalogFocusIndex(nextIndex);
    catalogItemRefs.current[nextIndex]?.focus();
  }

  function handleCatalogItemKeyDown(event, index) {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      focusCatalogItem(index + 1);
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      focusCatalogItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusCatalogItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      const itemCount = catalogTab === "Services" ? pagedServices.length : pagedProducts.length;
      focusCatalogItem(itemCount - 1);
    }
  }

  function focusCartRow(index) {
    if (!cart.length) return;
    const nextIndex = (index + cart.length) % cart.length;
    setCartFocusIndex(nextIndex);
    cartRowRefs.current[nextIndex]?.focus();
  }

  function handleCartRowKeyDown(event, item, index) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCartRow(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCartRow(index - 1);
    } else if (["+", "="].includes(event.key)) {
      event.preventDefault();
      updateCartQty(item.key, Number(item.qty || 1) + 1);
    } else if (event.key === "-") {
      event.preventDefault();
      updateCartQty(item.key, Math.max(1, Number(item.qty || 1) - 1));
    } else if (["Delete", "Backspace"].includes(event.key)) {
      event.preventDefault();
      removeCartItem(item.key);
    }
  }

  return (
    <section className="module-grid pos-layout">
      <div className="surface-panel wide pos-catalog-panel">
        <div className="pos-header">
          <div>
            <h2>{posScreen === "Checkout" ? "Build checkout" : "Service prices"}</h2>
            <span>{posScreen === "Checkout" ? `${catalogCount} ${catalogTab.toLowerCase()} available` : "Add services directly to the POS catalog"}</span>
          </div>
          <div className="pos-header-actions">
            <div className="segmented-control pos-screen-tabs" role="tablist" aria-label="POS screen">
              {posScreens.map((screen) => (
                <button
                  type="button"
                  className={posScreen === screen ? "active" : ""}
                  key={screen}
                  onClick={() => setPosScreen(screen)}
                >
                  {screen}
                </button>
              ))}
            </div>
            {canUseTestMode && (
              <button
                className={`secondary-button pos-test-checkout-button${testMode ? " active" : ""}`}
                type="button"
                onClick={() => {
                  if (!testMode) setTestMode(true);
                  setIsSaleContextOpen(true);
                }}
              >
                <ShieldCheck size={17} aria-hidden="true" />
                {testMode ? "Test mode on" : "Test checkout"}
              </button>
            )}
            <button
              className="secondary-button"
              type="button"
              onClick={printCurrentReceipt}
              disabled={!cart.length && !transactionSummaryRows.length}
            >
              <Printer size={17} aria-hidden="true" />
              Print receipt
            </button>
          </div>
        </div>

        {posScreen === "Checkout" && (testMode || saleDate !== todayDate()) && (
          <div className={`pos-ledger-mode-banner ${testMode ? "test" : "historical"}`} role="status">
            <AlertCircle size={17} />
            <span>{testMode ? "TEST MODE — this transaction is isolated from all live financial and stock figures." : `Historical transaction date: ${formatDate(saleDate)}. The actual entry time is preserved in the audit log.`}</span>
            <button type="button" onClick={() => setIsSaleContextOpen(true)}>Review</button>
          </div>
        )}

        {posScreen === "Checkout" ? (
          <>
            <div className="pos-shortcut-bar" aria-label="POS keyboard shortcuts">
              <span><kbd>F2</kbd> Search</span>
              <span><kbd>F3</kbd> Catalog</span>
              <span><kbd>F4</kbd> Customer</span>
              <span><kbd>F6</kbd> Cart</span>
              <span><kbd>F8</kbd> Pay</span>
              <span><kbd>Alt</kbd>+<kbd>P</kbd> POS / workspace</span>
            </div>
            <div className="pos-catalog-toolbar">
              <div className="segmented-control" role="tablist" aria-label="POS catalog">
                {["Services", "Products"].map((tab) => (
                  <button type="button" className={catalogTab === tab ? "active" : ""} key={tab} onClick={() => changeCatalogTab(tab)}>
                    {tab}
                  </button>
                ))}
              </div>
              <label className="catalog-search">
                <Search size={17} aria-hidden="true" />
                <input
                  ref={catalogSearchRef}
                  aria-label="Search POS catalog"
                  aria-keyshortcuts="F2 /"
                  placeholder={`Search ${catalogTab.toLowerCase()}`}
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusCatalogItem(0);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setCatalogQuery("");
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>
              {catalogTab === "Products" && canManagePosCatalog && (
                <button className="secondary-button pos-add-product-button" type="button" onClick={addRetailProductFromPos}>
                  <Plus size={17} aria-hidden="true" />
                  Add product
                </button>
              )}
            </div>

            <div className="pos-category-list" role="tablist" aria-label={`${catalogTab} category`}>
              {catalogCategories.map((category) => (
                <button
                  className={categoryFilter === category ? "active" : ""}
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>

            {catalogTab === "Services" ? (
              <div className="service-grid pos-service-grid">
                {pagedServices.map((service, index) => (
                  <button
                    className={`service-card pos-service-card ${cart.some((item) => item.serviceId === service.id) ? "in-cart" : ""}`}
                    key={service.id}
                    ref={(node) => { catalogItemRefs.current[index] = node; }}
                    tabIndex={catalogFocusIndex === index ? 0 : -1}
                    onFocus={() => setCatalogFocusIndex(index)}
                    onKeyDown={(event) => handleCatalogItemKeyDown(event, index)}
                    onClick={() => {
                      const catalogPrice = serviceCatalogPrice(service);
                      void addPosCartItem({
                        key: `service-${service.id}-${createId("line")}`,
                        serviceId: service.id,
                        serviceType: service.serviceType,
                        type: "Service",
                        name: service.name,
                        category: service.category,
                        price: catalogPrice,
                        resolvedPrice: serviceUsesFinalPrice(service) ? catalogPrice : undefined,
                        basePrice: catalogPrice,
                        priceModel: service.priceModel || "Fixed price",
                        priceUnit: service.priceUnit || "",
                        packageSessions: Number(service.packageSessions || 0),
                        provider: "N/A",
                        aftercare: service.aftercare || "",
                        recommendedIntervalDays: Number(service.recommendedIntervalDays || 0),
                      });
                    }}
                    type="button"
                  >
                    <strong>{service.name}</strong>
                    <span className="service-card-meta">
                      <small>{service.duration} min</small>
                      <b>{servicePriceLabel(service)}</b>
                    </span>
                    {cart.some((item) => item.serviceId === service.id) && (
                      <span className="cart-count">{cart.filter((item) => item.serviceId === service.id).reduce((sum, item) => sum + Number(item.qty || 1), 0)}</span>
                    )}
                  </button>
                ))}
                {!visibleServices.length && <EmptyState title="No matching services" copy="Adjust the search or category filter." />}
              </div>
            ) : (
              <div className="service-grid pos-service-grid">
                {pagedProducts.map((item, index) => (
                  <button
                    className={`service-card pos-service-card pos-product-card ${cart.some((entry) => entry.key === `product-${item.id}`) ? "in-cart" : ""}`}
                    key={item.id}
                    ref={(node) => { catalogItemRefs.current[index] = node; }}
                    tabIndex={catalogFocusIndex === index ? 0 : -1}
                    onFocus={() => setCatalogFocusIndex(index)}
                    onKeyDown={(event) => handleCatalogItemKeyDown(event, index)}
                    onClick={() => void addPosCartItem({ key: `product-${item.id}`, inventoryId: item.id, type: "Product", name: item.item, category: item.category, price: item.price })}
                    type="button"
                    disabled={item.stock <= 0}
                  >
                    <span className="product-card-photo">
                      <img src={productImageFor(item)} alt="" />
                    </span>
                    <strong>{item.item}</strong>
                    <span className="service-card-meta">
                      <small>{item.stock} in stock</small>
                      <b>{money.format(item.price)}</b>
                    </span>
                    {cart.find((entry) => entry.key === `product-${item.id}`)?.qty && (
                      <span className="cart-count">{cart.find((entry) => entry.key === `product-${item.id}`)?.qty}</span>
                    )}
                  </button>
                ))}
                {!visibleProducts.length && (
                  <div className="pos-empty-catalog">
                    <EmptyState title="No products in POS" copy="Add a retail inventory item so it appears in the POS Products tab." />
                    {canManagePosCatalog && (
                      <button className="primary-button pos-primary-action" type="button" onClick={addRetailProductFromPos}>
                        <Plus size={18} aria-hidden="true" />
                        Add product
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {visibleCatalogItems.length > posCatalogPageSize && (
              <POSCatalogPagination
                page={safeCatalogPage}
                pageCount={catalogPageCount}
                start={catalogPageStart + 1}
                end={catalogPageEnd}
                total={visibleCatalogItems.length}
                onPageChange={setCatalogPage}
              />
            )}
          </>
        ) : (
          <POSServicePriceScreen
            branch={branch}
            saveService={saveService}
            services={services}
            staff={staff}
          />
        )}
      </div>

      <div className="surface-panel checkout-panel pos-checkout-panel">
        <div className="invoice-header">
          <button
            className="invoice-context-button"
            type="button"
            onClick={() => setIsSaleContextOpen(true)}
            title="Select client, branch, and staff"
          >
            <div className="invoice-context-copy">
              <h2>{client?.fullName ?? "Walk-in"}</h2>
              <span>{branch} / {staffName || "Unassigned"}</span>
            </div>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={printCurrentReceipt}
            title="Print receipt"
            disabled={!cart.length && !transactionSummaryRows.length}
          >
            <Printer size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="cart-list">
          {cart.map((item, index) => {
            const unitPriced = item.type === "Service" && item.priceModel === "Per unit";
            const unitLabel = servicePriceUnitLabel(item);
            const fractionalUnit = unitPriced && unitLabel === "ml";
            return (
            <article
              className={`cart-row ${cartFocusIndex === index ? "keyboard-selected" : ""}`}
              key={item.key}
              ref={(node) => { cartRowRefs.current[index] = node; }}
              role="group"
              aria-label={`${item.name}, quantity ${Number(item.qty || 1)}`}
              aria-keyshortcuts="ArrowUp ArrowDown + - Delete"
              tabIndex={cartFocusIndex === index ? 0 : -1}
              onFocus={() => setCartFocusIndex(index)}
              onKeyDown={(event) => handleCartRowKeyDown(event, item, index)}
            >
              <div>
                <strong>{item.name}</strong>
                <span>{item.type} / {item.category}</span>
                {item.type === "Service" && (
                  <label className="cart-provider-select">
                    <span>Provider</span>
                    <select value={item.provider || "N/A"} onChange={(event) => setCart((current) => current.map((entry) => entry.key === item.key ? { ...entry, provider: event.target.value } : entry))}>
                      {providersForCartItem(item).map((provider) => <option key={provider}>{provider}</option>)}
                    </select>
                  </label>
                )}
                {item.type === "Service" && serviceUsesFinalPrice(item) && (
                  <label className="cart-final-price-input">
                    <span>{item.priceModel === "Starts at" ? "Final price" : "Price after consultation"}</span>
                    <input
                      aria-label={`Final price for ${item.name}`}
                      type="number"
                      min={item.priceModel === "Starts at" ? Number(item.basePrice || 0) : 0}
                      step="0.01"
                      value={item.resolvedPrice ?? item.price}
                      onChange={(event) => setCart((current) => current.map((entry) => entry.key === item.key ? {
                        ...entry,
                        price: event.target.value,
                        resolvedPrice: event.target.value,
                      } : entry))}
                    />
                    {item.priceModel === "Starts at" && <small>Minimum {money.format(Number(item.basePrice || 0))}</small>}
                  </label>
                )}
              </div>
              {unitPriced ? (
                <label className="cart-unit-quantity">
                  <span>{unitLabel}</span>
                  <input
                    aria-label={`Quantity in ${unitLabel} for ${item.name}`}
                    type="number"
                    min={fractionalUnit ? "0.01" : "1"}
                    step={fractionalUnit ? "0.01" : "1"}
                    value={item.qty}
                    onChange={(event) => updateCartQty(item.key, event.target.value)}
                  />
                </label>
              ) : <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
                <button
                  type="button"
                  onClick={() => updateCartQty(item.key, Number(item.qty || 1) - 1)}
                  disabled={Number(item.qty || 1) <= 1}
                  title={`Decrease ${item.name} quantity`}
                  aria-label={`Decrease ${item.name} quantity`}
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
                <span>{Number(item.qty || 1)}</span>
                <button
                  type="button"
                  onClick={() => updateCartQty(item.key, Number(item.qty || 1) + 1)}
                  title={`Increase ${item.name} quantity`}
                  aria-label={`Increase ${item.name} quantity`}
                >
                  <Plus size={14} aria-hidden="true" />
                </button>
              </div>}
              <b>{money.format(Number(item.price) * Number(item.qty || 1))}</b>
              <button type="button" onClick={() => removeCartItem(item.key)} title={`Remove ${item.name}`} aria-label={`Remove ${item.name}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </article>
            );
          })}
          {!cart.length && <EmptyState title="Cart is empty" copy="Add a service or product to begin checkout." />}
        </div>
        <div className="invoice-fields">
          <section className={`discount-panel${manualDiscountInvalid ? " has-error" : ""}`}>
            <button
              className="discount-panel-toggle"
              type="button"
              aria-expanded={isDiscountPanelExpanded}
              aria-controls="pos-discount-settings"
              aria-label={`${isDiscountPanelExpanded ? "Collapse" : "Expand"} discount settings`}
              onClick={() => setIsDiscountPanelExpanded((current) => !current)}
            >
              <span className="discount-panel-heading">
                <strong>Discount</strong>
                <small>{discountPanelSummary}</small>
              </span>
              <span className="discount-panel-action">
                {isDiscountPanelExpanded ? "Minimize" : "Edit"}
                <ChevronDown size={17} className={isDiscountPanelExpanded ? "is-expanded" : ""} aria-hidden="true" />
              </span>
            </button>
            {isDiscountPanelExpanded && (
              <div className="discount-panel-content" id="pos-discount-settings">
              <label className="stacked-field">
                <span>Discount source</span>
                <select
                  aria-label="Discount source"
                  value={manualDiscountType ? "__manual__" : discountId}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__manual__") {
                      setDiscountId("");
                      setManualDiscountType((current) => current || "Fixed amount");
                      return;
                    }
                    setDiscountId(value);
                    setManualDiscountType("");
                    setManualDiscountValue("");
                    setManualDiscountScope("Transaction");
                    setManualDiscountTargetKey("");
                  }}
                >
                  <option value="">No discount</option>
                  {canApprovePosAdjustments && <option value="__manual__">Manual adjustment · Owner/Admin approved</option>}
                  {canApprovePosAdjustments && (
                    <optgroup label="Saved discount rules">
                      {discounts.filter((item) => item.active).map((item) => (
                        <option key={item.id} value={item.id}>{item.name} - {item.type}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {manualDiscountType && (
                <div className="manual-discount-fields">
                  <label className="stacked-field">
                    <span>Apply discount to</span>
                    <select
                      aria-label="Manual discount scope"
                      value={manualDiscountScope}
                      onChange={(event) => {
                        const scope = event.target.value;
                        setManualDiscountScope(scope);
                        setManualDiscountTargetKey(scope === "Service" ? serviceDiscountOptions[0]?.key || "" : "");
                      }}
                    >
                      <option value="Transaction">Entire transaction</option>
                      <option value="Service" disabled={!serviceDiscountOptions.length}>Specific service</option>
                    </select>
                  </label>
                  {manualDiscountScope === "Service" && (
                    <label className="stacked-field">
                      <span>Discounted service</span>
                      <select
                        aria-label="Discounted service"
                        value={manualDiscountTargetKey}
                        onChange={(event) => setManualDiscountTargetKey(event.target.value)}
                      >
                        <option value="">Choose service</option>
                        {serviceDiscountOptions.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.name} — {money.format(Number(item.price || 0) * Number(item.qty || 1))}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="stacked-field">
                    <span>Manual discount type</span>
                    <select aria-label="Manual discount type" value={manualDiscountType} onChange={(event) => setManualDiscountType(event.target.value)}>
                      <option value="Fixed amount">Peso amount</option>
                      <option value="Percentage">Percentage</option>
                    </select>
                  </label>
                  <label className="stacked-field">
                    <span>{manualDiscountType === "Percentage" ? "Percent" : "Amount"}</span>
                    <input
                      aria-label="Manual discount value"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={manualDiscountType === "Percentage" ? "100" : manualDiscountBase}
                      step="0.01"
                      value={manualDiscountValue}
                      onChange={(event) => setManualDiscountValue(event.target.value)}
                      placeholder={manualDiscountType === "Percentage" ? "e.g. 10" : "e.g. 500"}
                    />
                  </label>
                  <small className={manualDiscountInvalid ? "field-error" : ""}>
                    {manualDiscountValidationMessage || (manualDiscountType === "Percentage"
                      ? `${normalizedManualDiscountValue || 0}% of ${manualDiscountScope === "Service" ? manualDiscountTargetItem?.name || "the selected service" : "the subtotal"}`
                      : `${money.format(normalizedManualDiscountValue || 0)} off ${manualDiscountScope === "Service" ? manualDiscountTargetItem?.name || "the selected service" : "the subtotal"}`)}
                  </small>
                </div>
              )}
              {promotionDiscountAmount > 0 && <small className="automatic-promotion-note">Eligible promotion applied automatically: {money.format(promotionDiscountAmount)}.</small>}
              {!canApprovePosAdjustments && <small className="automatic-promotion-note">Discounts and manual price adjustments require an Owner or Super Admin to review and post the checkout. Pre-approved promotions still apply automatically.</small>}
              </div>
            )}
          </section>
        </div>
        <div className="checkout-sticky-footer">
          <div className="checkout-summary-card">
            <div>
              <span>Subtotal</span>
              <strong>{money.format(subtotal)}</strong>
            </div>
            <div>
              <span>Discount</span>
              <strong>-{money.format(discountAmount)}</strong>
            </div>
            {promotionDiscountAmount > 0 && <div><span>Automatic promotion</span><strong>-{money.format(promotionDiscountAmount)}</strong></div>}
            <div className="due-row">
              <span>Total</span>
              <strong>{money.format(total)}</strong>
            </div>
          </div>
          {checkoutStep === "payment" ? (
            <>
              <div className="payment-options" aria-label="Select payment method">
                {posPaymentOptions.map((option, index) => {
                  const Icon = option.icon;
                  return (
                    <button type="button" key={option.label} onClick={() => choosePayment(option)} aria-keyshortcuts={`${index + 1}`}>
                      <Icon size={16} />
                      {option.label}
                      <kbd>{index + 1}</kbd>
                    </button>
                  );
                })}
              </div>
              <button className="ghost-button full" type="button" onClick={() => setCheckoutStep("review")}>
                Back to cart
              </button>
            </>
          ) : (
            <>
              <button className="primary-button full" type="button" onClick={showPaymentStep} disabled={!cart.length || manualDiscountInvalid}>
                <Check size={17} aria-hidden="true" />
                Complete transaction
                <kbd>F8</kbd>
              </button>
              <button className="ghost-button full" type="button" onClick={() => {
                setCart([]);
                setCheckoutStep("review");
              }} title="Keyboard: Ctrl+Shift+Backspace">
                Clear cart
              </button>
            </>
          )}
        </div>
      </div>

      <div className="surface-panel full-span pos-history-panel">
        <SectionHeader icon={ReceiptText} title="POS Summarized Transactions for the Day" action={money.format(todaysTransactionTotal)} />
        <SmartTable
          rows={transactionSummaryRows}
          globalSearch={globalSearch}
          pageSize={5}
          emptyTitle="No transactions yet"
          columns={[
            { key: "invoice", label: "Invoice" },
            { key: "date", label: "Date" },
            { key: "client", label: "Client" },
            { key: "branch", label: "Branch" },
            { key: "total", label: "Total", render: (row) => money.format(row.total), exportValue: (row) => row.total },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => onPrintReceipt(row)}><Printer size={15} /> Receipt</button>
                  {row.testMode
                    ? <button type="button" onClick={() => resetTestTransaction(row)}><RefreshCw size={15} /> Reset test</button>
                    : row.status !== "Void" && <button type="button" onClick={() => voidTransaction(row)}><Trash2 size={15} /> Void</button>}
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>

      {isSaleContextOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Select sale details"
          onKeyDown={(event) => {
            if (event.key === "Escape" || (event.ctrlKey && event.key === "Enter")) {
              event.preventDefault();
              setIsSaleContextOpen(false);
            }
          }}
        >
          <div className="modal-card pos-context-modal">
            <button className="modal-close" type="button" onClick={() => setIsSaleContextOpen(false)} aria-label="Close sale details">
              <X size={18} aria-hidden="true" />
            </button>
            <SectionHeader icon={Users} title="Select client" action="POS sale" />
            <div className="pos-context-fields">
              <label className="stacked-field">
                <span>Select client</span>
                <select ref={saleClientRef} value={clientId} onChange={(event) => void openCartForClient(event.target.value)}>
                  <option value="">Walk-in / Anonymous</option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName}</option>
                  ))}
                </select>
              </label>
              <label className="stacked-field">
                <span>Select Branch</span>
                <input value={branch} readOnly aria-readonly="true" />
                {branchRecords.length > 1 && <small>Use the branch selector at the top of POS to change branches.</small>}
              </label>
              <label className="stacked-field">
                <span>Select Staff</span>
                <select value={staffName} onChange={(event) => setStaffName(event.target.value)}>
                  {staffAtBranch.map((person) => <option key={person.id}>{person.name}</option>)}
                </select>
              </label>
              <label className="stacked-field">
                <span>Transaction date</span>
                <input type="date" max={todayDate()} value={saleDate} disabled={!canPostHistoricalSale} onChange={(event) => setSaleDate(event.target.value || todayDate())} />
                <small>{canPostHistoricalSale ? "Backdated entries are audit-logged; future dates are blocked." : "Only an Owner or Super Admin can backdate a transaction."}</small>
              </label>
              {canUseTestMode && (
                <label className="checkbox-field pos-test-mode-field">
                  <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} />
                  <span><strong>POS Test Mode</strong><small>Excluded from revenue, inventory, balances, commission, and payroll. Test entries can be reset.</small></span>
                </label>
              )}
            </div>
            <div className="modal-actions">
              <span className="modal-keyboard-hint"><kbd>Esc</kbd> close · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> done</span>
              <button className="primary-button" type="button" onClick={() => setIsSaleContextOpen(false)}>
                <Check size={17} aria-hidden="true" />
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function POSCatalogPagination({ page, pageCount, start, end, total, onPageChange }) {
  const pageItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : page <= 3
      ? [1, 2, 3, 4, "ellipsis-end", pageCount]
      : page >= pageCount - 2
        ? [1, "ellipsis-start", pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
        : [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", pageCount];

  return (
    <nav className="pos-catalog-pagination" aria-label="POS catalog pagination">
      <button
        className="page-arrow"
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        <ChevronLeft size={19} aria-hidden="true" />
        Previous
      </button>
      <div className="pos-page-chips" aria-label="Catalog pages">
        {pageItems.map((item) => typeof item === "number" ? (
          <button
            className={item === page ? "active" : ""}
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Page ${item}`}
          >
            {item}
          </button>
        ) : (
          <span className="pos-page-ellipsis" key={item} aria-hidden="true">…</span>
        ))}
      </div>
      <button
        className="page-arrow"
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
      >
        Next
        <ChevronRight size={19} aria-hidden="true" />
      </button>
      <span className="pos-page-count">{start}-{end} of {total}</span>
    </nav>
  );
}

function POSServicePriceScreen({ branch, saveService, services, staff }) {
  const staffRoleList = useMemo(
    () => [...new Set(staff.map((person) => person.role).filter(Boolean))].join(", "),
    [staff],
  );
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return {
      name: "",
      category: serviceCategories[0],
      serviceType: "Regular Service",
      duration: 60,
      price: "",
      priceModel: "Fixed price",
      priceUnit: "",
      packageSessions: 0,
      packagePrice: 0,
      serviceValue: 0,
      recommendedIntervalDays: 0,
      branches: branch,
      staff: staffRoleList || "Doctor, Nurse, Aesthetician",
      room: "Treatment Room",
      active: true,
      pos: true,
      description: "",
      contraindications: "",
      aftercare: "",
    };
  }

  const [form, setForm] = useState(() => emptyForm());

  const visibleServices = services
    .filter((service) => service.pos !== false)
    .filter((service) => normalize(`${service.name} ${service.category} ${service.price}`).includes(normalize(query)));

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeServiceType(serviceType) {
    setForm((current) => ({
      ...current,
      serviceType,
      ...(serviceType === "Package" ? {
        category: "Packages",
        packagePrice: Number(current.packagePrice || current.price || 0),
      } : {}),
    }));
  }

  function resetForm() {
    setEditingId("");
    setError("");
    setForm(emptyForm());
  }

  function startEdit(service) {
    setEditingId(service.id);
    setError("");
    setForm({
      name: service.name ?? "",
      category: service.category ?? serviceCategories[0],
      serviceType: service.serviceType ?? "Regular Service",
      duration: service.duration ?? 60,
      price: service.price ?? "",
      priceModel: service.priceModel ?? "Fixed price",
      priceUnit: service.priceUnit ?? "",
      packageSessions: service.packageSessions ?? 0,
      packagePrice: service.packagePrice ?? 0,
      serviceValue: service.serviceValue ?? 0,
      recommendedIntervalDays: service.recommendedIntervalDays ?? 0,
      branches: Array.isArray(service.branches) ? service.branches.join(", ") : service.branches ?? branch,
      staff: Array.isArray(service.staff) ? service.staff.join(", ") : service.staff ?? staffRoleList,
      room: service.room ?? "Treatment Room",
      active: service.active !== false,
      pos: service.pos !== false,
      description: service.description ?? "",
      contraindications: service.contraindications ?? "",
      aftercare: service.aftercare ?? "",
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) {
      setError("Service name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid service price.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveService({
        ...form,
        id: editingId || undefined,
        name,
        duration: Number(form.duration || 0),
        price: form.serviceType === "Package" && Number(form.packagePrice) > 0 ? Number(form.packagePrice) : price,
        packageSessions: Number(form.packageSessions || 0),
        packagePrice: Number(form.packagePrice || 0),
        serviceValue: Number(form.serviceValue || 0),
        recommendedIntervalDays: Number(form.recommendedIntervalDays || 0),
        branches: form.branches || branch,
        staff: form.staff || staffRoleList,
        room: form.room || "Treatment Room",
        active: Boolean(form.active),
        pos: Boolean(form.pos),
        description: form.description || `${name} added from POS service prices.`,
        contraindications: form.contraindications || "",
        aftercare: form.aftercare || "",
      });
      setQuery(name);
      resetForm();
    } catch (saveError) {
      setError(saveError?.message || "Unable to save this service.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pos-service-setup">
      <form className="pos-service-form" onSubmit={submit}>
        <div className="service-setup-title">
          <div>
            <Sparkles size={18} aria-hidden="true" />
            <div>
              <h3>{editingId ? "Edit POS Service" : "Add Service to POS"}</h3>
              <span>Saved services appear in checkout under Services.</span>
            </div>
          </div>
          {editingId && (
            <button className="secondary-button small" type="button" onClick={resetForm} disabled={saving}>
              <X size={15} aria-hidden="true" />
              Cancel edit
            </button>
          )}
        </div>

        {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}

        <div className="quick-service-grid">
          <label className="span-2">
            <span>Service name</span>
            <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Example: Acne Program Consultation" />
          </label>
          <label>
            <span>Category</span>
            <select value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
              {serviceCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span>Service type</span>
            <select value={form.serviceType} onChange={(event) => changeServiceType(event.target.value)}>
              {["Regular Service", "Package", "Add-on"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Pricing model</span>
            <select value={form.priceModel} onChange={(event) => updateForm("priceModel", event.target.value)}>
              {["Fixed price", "Starts at", "Price after consultation/assessment", "Per unit"].map((model) => <option key={model}>{model}</option>)}
            </select>
          </label>
          <label>
            <span>Base price</span>
            <input type="number" min="0" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="0" />
          </label>
          {form.priceModel === "Per unit" && <label>
            <span>Pricing unit</span>
            <select value={form.priceUnit} onChange={(event) => updateForm("priceUnit", event.target.value)}>
              {["", "Per syringe", "Per ml", "Per vial", "Per ampoule"].map((unit) => <option key={unit} value={unit}>{unit || "Select a unit"}</option>)}
            </select>
          </label>}
          {form.serviceType === "Package" && <label>
            <span>Package sessions</span>
            <input type="number" min="1" step="1" value={form.packageSessions} onChange={(event) => updateForm("packageSessions", event.target.value)} />
          </label>}
          {form.serviceType === "Package" && <label>
            <span>Package price</span>
            <input type="number" min="0" value={form.packagePrice} onChange={(event) => updateForm("packagePrice", event.target.value)} />
          </label>}
          {form.serviceType === "Package" && <label>
            <span>Service value / session</span>
            <input type="number" min="0" value={form.serviceValue} onChange={(event) => updateForm("serviceValue", event.target.value)} />
          </label>}
          <label>
            <span>Recommended interval (days)</span>
            <input type="number" min="0" value={form.recommendedIntervalDays} onChange={(event) => updateForm("recommendedIntervalDays", event.target.value)} />
          </label>
          <label>
            <span>Duration minutes</span>
            <input type="number" min="0" value={form.duration} onChange={(event) => updateForm("duration", event.target.value)} />
          </label>
          <label>
            <span>Branch availability</span>
            <input value={form.branches} onChange={(event) => updateForm("branches", event.target.value)} />
          </label>
          <label>
            <span>Staff allowed</span>
            <input value={form.staff} onChange={(event) => updateForm("staff", event.target.value)} />
          </label>
          <label>
            <span>Room / device</span>
            <input value={form.room} onChange={(event) => updateForm("room", event.target.value)} />
          </label>
          <label className="span-2">
            <span>Description</span>
            <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Optional service notes for the catalog" />
          </label>
          <label className="checkbox-field compact">
            <input type="checkbox" checked={form.active} onChange={(event) => updateForm("active", event.target.checked)} />
            <span>Active service</span>
          </label>
          <label className="checkbox-field compact">
            <input type="checkbox" checked={form.pos} onChange={(event) => updateForm("pos", event.target.checked)} />
            <span>Show in POS checkout</span>
          </label>
        </div>

        <div className="service-setup-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            <Check size={17} aria-hidden="true" />
            {saving ? "Saving..." : editingId ? "Update service price" : "Add to POS"}
          </button>
          <button className="ghost-button" type="button" onClick={resetForm} disabled={saving}>
            Clear form
          </button>
        </div>
      </form>

      <div className="pos-service-price-list">
        <div className="price-list-header">
          <div>
            <strong>POS Services and Prices</strong>
            <span>{visibleServices.length} service{visibleServices.length === 1 ? "" : "s"} shown</span>
          </div>
          <label className="catalog-search compact">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" />
          </label>
        </div>

        <div className="price-service-rows">
          {visibleServices.map((service) => (
            <article className="price-service-row" key={service.id}>
              <div>
                <strong>{service.name}</strong>
                <span>{service.category} / {service.duration} min</span>
              </div>
              <b>{servicePriceLabel(service)}</b>
              <StatusBadge status={service.active ? "Active" : "Inactive"} />
              <button className="secondary-button small" type="button" onClick={() => startEdit(service)}>
                <Edit3 size={15} aria-hidden="true" />
                Edit
              </button>
            </article>
          ))}
          {!visibleServices.length && <EmptyState title="No POS services found" copy="Add a service above or adjust the search." />}
        </div>
      </div>
    </div>
  );
}

function CardViewModule({ appointments, services, transactions, staff, branchRecords = [], branchScope = "All branches", updateStatus, openModal, globalSearch, canManageAppointments, onOpenRoomView, onOpenAppointment }) {
  const [date, setDate] = useState(todayDate());
  const [staffFilter, setStaffFilter] = useState("All staff");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [viewMode, setViewMode] = useStoredState("card-view-mode", "list");
  const visibleBranches = branchScope === "All branches"
    ? branchRecords
    : branchRecords.filter((branch) => branch.name === branchScope);
  const rooms = [...new Set(
    visibleBranches
      .flatMap((branch) => branch.rooms ?? [])
      .concat(appointments.map((appointment) => appointment.room))
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
  const staffOptions = [...new Set(staff.map((person) => person.name))].sort((a, b) => a.localeCompare(b));

  const cards = appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => staffFilter === "All staff" || appointment.staff === staffFilter)
    .filter((appointment) => roomFilter === "All rooms" || appointment.room === roomFilter)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.staff} ${appointment.room}`).includes(normalize(globalSearch)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));

  function transactionFor(appointment) {
    return transactions.find((transaction) => transaction.date === appointment.date && transaction.client === appointment.client);
  }

  return (
    <section className="module-grid card-view-page">
      <section className="surface-panel full-span card-view-filter-panel" aria-label="Card filters">
        <div className="card-view-filters">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>Staff</span>
            <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}>
              <option>All staff</option>
              {staffOptions.map((person) => <option key={person}>{person}</option>)}
            </select>
          </label>
          <label>
            <span>Room</span>
            <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
              <option>All rooms</option>
              {rooms.map((room) => <option key={room}>{room}</option>)}
            </select>
          </label>
          <div className="card-view-view-toggle" role="tablist" aria-label="Card View layout">
            <button type="button" role="tab" aria-selected={viewMode !== "grid"} className={viewMode !== "grid" ? "active" : ""} onClick={() => setViewMode("list")}>
              <List size={16} aria-hidden="true" /> List
            </button>
            <button type="button" role="tab" aria-selected={viewMode === "grid"} className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
              <LayoutGrid size={16} aria-hidden="true" /> Grid
            </button>
          </div>
          {!canManageAppointments && (
            <span className="card-view-read-only" title="Your role can view cards but cannot change appointments.">
              <LockKeyhole size={16} aria-hidden="true" /> View only
            </span>
          )}
        </div>
      </section>

      {viewMode === "grid" ? (
        <section className="full-span card-view-grid" aria-label={`${cards.length} service cards in grid view`}>
          {cards.map((appointment) => {
            const transaction = transactionFor(appointment);
            const start = parseTimeToMinutes(appointment.time);
            const duration = appointmentDurationMinutes(appointment, services);
            const end = start + duration;
            const status = canonicalAppointmentStatus(appointment.status);
            return (
              <article className={`service-flow-card ${statusClass(status)}`} key={appointment.id}>
                <header className="service-card-heading">
                  <span className="service-card-avatar" aria-hidden="true">{initialsFor(appointment.client)}</span>
                  <span className="service-card-client"><strong>{appointment.client}</strong><small>{appointment.service}</small></span>
                  <time dateTime={`${appointment.date}T${appointment.time}`}>{formatScheduleTime(start)} – {formatScheduleTime(end)}</time>
                </header>
                <dl className="service-card-facts">
                  <div><dt>Staff</dt><dd>{appointment.staff || "Unassigned"}</dd></div>
                  <div><dt>Room</dt><dd>{appointment.room || "Unassigned"}</dd></div>
                  <div><dt>Paid</dt><dd>{transaction ? money.format(transaction.total) : money.format(appointment.deposit)}</dd></div>
                </dl>
                <footer className="service-card-footer">
                  <StatusBadge status={status} />
                  {canManageAppointments ? (
                    <div className="card-actions">
                      <button type="button" onClick={() => onOpenAppointment(appointment)} title={`View ${appointment.client}'s card`}><Eye size={15} aria-hidden="true" /> View</button>
                      <button type="button" onClick={() => updateStatus(appointment.id, "Arrived")} title={`Mark ${appointment.client} as arrived`}><UserCheck size={15} aria-hidden="true" /> Arrive</button>
                      <button type="button" onClick={() => updateStatus(appointment.id, "Completed")} title={`Mark ${appointment.client}'s service as completed`}><Check size={15} aria-hidden="true" /> Done</button>
                    </div>
                  ) : (
                    <span className="card-view-read-only compact"><LockKeyhole size={14} aria-hidden="true" /> View only</span>
                  )}
                </footer>
              </article>
            );
          })}
          {!cards.length && <div className="surface-panel card-view-empty"><EmptyState title="No service cards" copy="Change the date, staff, room, or search filter." /></div>}
        </section>
      ) : (
      <section className="surface-panel full-span card-view-list-shell" aria-label={`${cards.length} service cards in list view`}>
        <table className="card-view-list-table">
          <thead>
            <tr>
              <th>Client / Service</th>
              <th>Time</th>
              <th>Staff</th>
              <th>Room</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((appointment, index) => {
              const start = parseTimeToMinutes(appointment.time);
              const duration = appointmentDurationMinutes(appointment, services);
              const end = start + duration;
              const status = canonicalAppointmentStatus(appointment.status);
              return (
                <tr key={appointment.id}>
                  <td>
                    <div className="card-view-client-cell">
                      <span className={`card-view-list-avatar tone-${index % 5}`} aria-hidden="true">{initialsFor(appointment.client)}</span>
                      <span>
                        <strong>{appointment.client}</strong>
                        <small>{appointment.service}</small>
                      </span>
                    </div>
                  </td>
                  <td><time dateTime={`${appointment.date}T${appointment.time}`}>{formatScheduleTime(start)} – {formatScheduleTime(end)}</time></td>
                  <td>{appointment.staff || "Unassigned"}</td>
                  <td>{appointment.room || "Unassigned"}</td>
                  <td><StatusBadge status={status} /></td>
                  <td>
                    {canManageAppointments ? (
                      <div className="card-view-list-actions">
                        <button type="button" onClick={() => onOpenAppointment(appointment)} title={`View ${appointment.client}'s card`} aria-label={`View ${appointment.client}'s card`}>
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => updateStatus(appointment.id, "Arrived")} title={`Mark ${appointment.client} as arrived`} aria-label={`Mark ${appointment.client} as arrived`}>
                          <UserCheck size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => updateStatus(appointment.id, "Completed")} title={`Mark ${appointment.client}'s service as completed`} aria-label={`Mark ${appointment.client}'s service as completed`}>
                          <Check size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="card-view-read-only compact"><LockKeyhole size={14} aria-hidden="true" /> View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!cards.length && (
              <tr>
                <td className="card-view-list-empty" colSpan="6">
                  <EmptyState title="No service cards" copy="Change the date, staff, room, or search filter." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      )}

      <footer className="surface-panel full-span card-view-note">
        <span><AlertCircle size={19} aria-hidden="true" /> Cards represent {date === todayDate() ? "today's" : "the selected date's"} saved appointments. Switch between list and grid, or filter by staff, room, or date.</span>
        <button className="ghost-button" type="button" onClick={onOpenRoomView}><LayoutGrid size={16} aria-hidden="true" /> View Room View</button>
      </footer>
    </section>
  );
}

const staffScheduleTypes = ["Work Day", "Day Off", "Vacation Leave", "Emergency Leave", "Sick Leave", "Absent"];
const staffLeaveTypes = new Set(["Vacation Leave", "Emergency Leave", "Sick Leave"]);
const staffCalendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function staffScheduleBranch(person, requestedBranch = "") {
  if (requestedBranch && requestedBranch !== "All branches") return requestedBranch;
  if (person?.branch && person.branch !== "All branches") return person.branch;
  return splitList(person?.branches)[0] || "";
}

function staffCanScheduleAtBranch(person, branch) {
  return Boolean(person && branch && (person.branch === branch || person.branch === "All branches" || splitList(person.branches).includes(branch)));
}

function calendarCells(month) {
  const [year, monthNumber] = String(month || todayDate().slice(0, 7)).split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, date: "", day: "" })),
    ...Array.from({ length: days }, (_, index) => ({
      key: `${month}-${String(index + 1).padStart(2, "0")}`,
      date: `${month}-${String(index + 1).padStart(2, "0")}`,
      day: index + 1,
    })),
  ];
}

function StaffAvailabilityModule({ appointments, services, staff, globalSearch, branchScope = "All branches", notify, onAudit }) {
  const [date, setDate] = useState(todayDate());
  const [calendarMonth, setCalendarMonth] = useState(todayDate().slice(0, 7));
  const [scheduleOverview, setScheduleOverview] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleBusy, setScheduleBusy] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const defaultStaff = staff[0];
  const [scheduleForm, setScheduleForm] = useState(() => ({ staffId: "", workDate: todayDate(), branch: "", type: "Work Day", paid: false, scheduledMinutes: 480, notes: "" }));
  const [swapForm, setSwapForm] = useState(() => ({ staffId: "", originalDayOff: todayDate(), swapWithStaffId: "", coworkerDayOff: todayDate(), branch: "", notes: "" }));
  const rows = staff.map((person) => person.name);
  const filtered = appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.staff}`).includes(normalize(globalSearch)));
  const staffById = useMemo(() => new Map((scheduleOverview?.staff || staff).map((person) => [person.id, person])), [scheduleOverview?.staff, staff]);
  const profilesByStaff = useMemo(() => new Map((scheduleOverview?.profiles || []).map((profile) => [profile.staffId, profile])), [scheduleOverview?.profiles]);
  const visibleStaffIds = useMemo(() => new Set(staff.map((person) => person.id)), [staff]);
  const visibleSchedules = useMemo(() => (scheduleOverview?.schedules || []).filter((entry) => {
    if (!visibleStaffIds.has(entry.staffId)) return false;
    const employee = staffById.get(entry.staffId);
    const entryBranch = staffScheduleBranch(employee, entry.branch);
    return branchScope === "All branches" || entryBranch === branchScope;
  }), [branchScope, scheduleOverview?.schedules, staffById, visibleStaffIds]);
  const leaveEntries = useMemo(() => visibleSchedules.filter((entry) => entry.status === "Approved" && staffLeaveTypes.has(entry.type)), [visibleSchedules]);
  const selectedEmployee = staffById.get(scheduleForm.staffId);
  const selectedBranch = staffScheduleBranch(selectedEmployee, scheduleForm.branch || branchScope);
  const selectedProfile = profilesByStaff.get(scheduleForm.staffId);
  const scheduleBranchOptions = (scheduleOverview?.branches || []).filter((branch) => branch.status === "Active" && staffCanScheduleAtBranch(selectedEmployee, branch.name));
  const swapEmployee = staffById.get(swapForm.staffId);
  const swapBranch = staffScheduleBranch(swapEmployee, swapForm.branch || branchScope);
  const swapCoworkers = staff.filter((person) => person.id !== swapForm.staffId && staffCanScheduleAtBranch(person, swapBranch));
  const usedLeaveCredits = (scheduleOverview?.schedules || []).filter((entry) => entry.staffId === scheduleForm.staffId && entry.status === "Approved" && entry.paid).length;
  const remainingLeaveCredits = Math.max(0, Number(selectedProfile?.paidLeaveCredits || 0) - usedLeaveCredits);
  const leaveConflict = staffLeaveTypes.has(scheduleForm.type)
    ? leaveEntries.find((entry) => entry.workDate === scheduleForm.workDate && staffScheduleBranch(staffById.get(entry.staffId), entry.branch) === selectedBranch && entry.staffId !== scheduleForm.staffId)
    : null;
  const monthLeaves = leaveEntries.filter((entry) => entry.workDate.startsWith(calendarMonth));

  const refreshSchedules = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const data = await loadPayrollOverview();
      setScheduleOverview(data);
      setScheduleError("");
      return data;
    } catch (error) {
      setScheduleError(error.message || "Unable to load staff leave records.");
      return null;
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSchedules();
  }, [refreshSchedules]);

  useEffect(() => {
    if (!defaultStaff || scheduleForm.staffId) return;
    const branch = staffScheduleBranch(defaultStaff, branchScope);
    setScheduleForm((current) => ({ ...current, staffId: defaultStaff.id, branch }));
    const coworker = staff.find((person) => person.id !== defaultStaff.id && staffCanScheduleAtBranch(person, branch));
    setSwapForm((current) => ({ ...current, staffId: defaultStaff.id, swapWithStaffId: coworker?.id || "", branch }));
  }, [branchScope, defaultStaff, scheduleForm.staffId, staff]);

  async function submitScheduleEntry(event) {
    event.preventDefault();
    if (leaveConflict) return;
    setScheduleBusy("entry");
    setScheduleError("");
    try {
      const result = await savePayrollSchedule({ ...scheduleForm, branch: selectedBranch });
      onAudit?.(result.auditLog);
      notify?.("Staff schedule entry saved.", "success");
      await refreshSchedules();
      setScheduleForm((current) => ({ ...current, type: "Work Day", paid: false, scheduledMinutes: 480, notes: "" }));
    } catch (error) {
      const message = error.message || "Unable to save the schedule entry.";
      setScheduleError(message);
      notify?.(message, "error");
    } finally {
      setScheduleBusy("");
    }
  }

  async function submitDayOffSwap(event) {
    event.preventDefault();
    setScheduleBusy("swap");
    setScheduleError("");
    try {
      const result = await savePayrollDayOffSwap({ ...swapForm, branch: swapBranch });
      onAudit?.(result.auditLog);
      notify?.("Day-off swap recorded for both employees.", "success");
      await refreshSchedules();
      setSwapForm((current) => ({ ...current, notes: "" }));
    } catch (error) {
      const message = error.message || "Unable to save the day-off swap.";
      setScheduleError(message);
      notify?.(message, "error");
    } finally {
      setScheduleBusy("");
    }
  }

  return (
    <section className="module-grid two staff-schedule-workspace">
      <div className="surface-panel wide">
        <SectionHeader icon={UserCheck} title="Staff Schedule" action={date} />
        <div className="report-filters single-line">
          <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <AvailabilityTimeline
          resourceLabel="Staff"
          resources={rows}
          appointments={filtered}
          services={services}
          getResource={(appointment) => appointment.staff}
        />
      </div>
      <div className="surface-panel">
        <SectionHeader icon={Clock} title="Staff Load" action={`${filtered.length} bookings`} />
        <div className="message-list">
          {staff.map((person) => {
            const override = visibleSchedules.find((entry) => entry.staffId === person.id && entry.workDate === date);
            return <MessageItem key={person.id} title={person.name} copy={`${override ? `${override.type} · ` : ""}${filtered.filter((appointment) => appointment.staff === person.name).length} booking(s) / ${person.schedule}`} />;
          })}
        </div>
      </div>
      <div className="surface-panel full-span staff-leave-panel">
        <div className="staff-leave-heading">
          <div><p className="eyebrow">Approved staffing input</p><h2>Schedule, leave, and day-off swaps</h2><span>Paid leave uses the employee&apos;s configured credits. Leave capacity is limited to one employee per branch per day.</span></div>
          <button className="secondary-button small" type="button" disabled={scheduleLoading} onClick={() => void refreshSchedules()}><RefreshCw className={scheduleLoading ? "spin" : ""} size={16} /> Refresh</button>
        </div>
        {scheduleError && <div className="inline-state danger" role="alert"><AlertCircle size={17} /> {scheduleError}</div>}
        <div className="staff-leave-layout">
          <div className="staff-schedule-forms">
            <form className="staff-schedule-entry-form" onSubmit={submitScheduleEntry}>
              <h3>Add schedule or leave</h3>
              <div className="form-grid">
                <label><span>Employee</span><select aria-label="Schedule employee" required value={scheduleForm.staffId} onChange={(event) => { const staffId = event.target.value; setScheduleForm((current) => ({ ...current, staffId, branch: staffScheduleBranch(staffById.get(staffId), branchScope) })); }}>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                <label><span>Date</span><input aria-label="Schedule date" required type="date" value={scheduleForm.workDate} onChange={(event) => setScheduleForm((current) => ({ ...current, workDate: event.target.value }))} /></label>
                <label><span>Type</span><select aria-label="Schedule type" value={scheduleForm.type} onChange={(event) => { const type = event.target.value; setScheduleForm((current) => ({ ...current, type, paid: staffLeaveTypes.has(type) ? current.paid : false, scheduledMinutes: type === "Day Off" ? 0 : current.scheduledMinutes || 480 })); }}>{staffScheduleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label><span>Branch</span><select aria-label="Schedule branch" required value={selectedBranch} onChange={(event) => setScheduleForm((current) => ({ ...current, branch: event.target.value }))}>{scheduleBranchOptions.map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
                {scheduleForm.type !== "Day Off" && <label><span>Scheduled minutes</span><input aria-label="Scheduled minutes" min="60" max="1440" required type="number" value={scheduleForm.scheduledMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledMinutes: event.target.value }))} /></label>}
                {staffLeaveTypes.has(scheduleForm.type) && <label className="checkbox-field"><input type="checkbox" checked={scheduleForm.paid} disabled={remainingLeaveCredits <= 0} onChange={(event) => setScheduleForm((current) => ({ ...current, paid: event.target.checked }))} /><span>Paid leave — use one credit</span></label>}
                <label className="span-2"><span>Notes</span><textarea rows="2" value={scheduleForm.notes} onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              <div className="staff-leave-balance"><Clock size={16} /><span><strong>{remainingLeaveCredits} paid leave credit(s) remaining</strong><small>{usedLeaveCredits} used of {Number(selectedProfile?.paidLeaveCredits || 0)}</small></span></div>
              {leaveConflict && <div className="inline-state warning"><AlertCircle size={16} /> {staffById.get(leaveConflict.staffId)?.name || "Another employee"} already has leave on this date at {selectedBranch}.</div>}
              <button className="primary-button full" disabled={scheduleBusy === "entry" || scheduleLoading || Boolean(leaveConflict)}><Check size={16} /> {scheduleBusy === "entry" ? "Saving…" : "Save approved entry"}</button>
            </form>

            <form className="staff-day-off-swap-form" onSubmit={submitDayOffSwap}>
              <h3>Switch day off with a coworker</h3>
              <div className="form-grid">
                <label><span>Employee</span><select aria-label="Swap employee" required value={swapForm.staffId} onChange={(event) => { const staffId = event.target.value; const branch = staffScheduleBranch(staffById.get(staffId), branchScope); setSwapForm((current) => ({ ...current, staffId, branch, swapWithStaffId: staffCanScheduleAtBranch(staffById.get(current.swapWithStaffId), branch) && current.swapWithStaffId !== staffId ? current.swapWithStaffId : "" })); }}>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                <label><span>Employee&apos;s original day off</span><input aria-label="Employee original day off" required type="date" value={swapForm.originalDayOff} onChange={(event) => setSwapForm((current) => ({ ...current, originalDayOff: event.target.value }))} /></label>
                <label><span>Swap with</span><select aria-label="Swap coworker" required value={swapForm.swapWithStaffId} onChange={(event) => setSwapForm((current) => ({ ...current, swapWithStaffId: event.target.value }))}><option value="">Select coworker</option>{swapCoworkers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                <label><span>Coworker&apos;s original day off</span><input aria-label="Coworker original day off" required type="date" value={swapForm.coworkerDayOff} onChange={(event) => setSwapForm((current) => ({ ...current, coworkerDayOff: event.target.value }))} /></label>
                <label className="span-2"><span>Reason / approval notes</span><textarea rows="2" value={swapForm.notes} onChange={(event) => setSwapForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              <p>The system records both employees as working on their original day off and off on their coworker&apos;s date.</p>
              <button className="secondary-button full" disabled={scheduleBusy === "swap" || scheduleLoading || !swapForm.swapWithStaffId || swapForm.originalDayOff === swapForm.coworkerDayOff}><RefreshCw size={16} /> {scheduleBusy === "swap" ? "Saving swap…" : "Record day-off swap"}</button>
            </form>
          </div>

          <section className="staff-leave-calendar" aria-label="Approved leave calendar">
            <div className="staff-leave-calendar-heading"><div><p className="eyebrow">Leave coverage</p><h3>Approved leave calendar</h3></div><label><span>Month</span><input aria-label="Leave calendar month" type="month" value={calendarMonth} onChange={(event) => setCalendarMonth(event.target.value || todayDate().slice(0, 7))} /></label></div>
            <div className="staff-leave-calendar-grid">
              {staffCalendarWeekdays.map((weekday) => <strong className="staff-leave-weekday" key={weekday}>{weekday}</strong>)}
              {calendarCells(calendarMonth).map((cell) => {
                const entries = cell.date ? monthLeaves.filter((entry) => entry.workDate === cell.date) : [];
                return <article className={`staff-leave-day ${cell.date ? "" : "is-empty"}`} key={cell.key}><span>{cell.day}</span>{entries.map((entry) => <small key={entry.id}><b>{staffById.get(entry.staffId)?.name || "Employee"}</b>{entry.type}<i>{staffScheduleBranch(staffById.get(entry.staffId), entry.branch)}</i></small>)}</article>;
              })}
            </div>
            {!monthLeaves.length && !scheduleLoading && <div className="empty-state compact"><CalendarDays size={24} /><strong>No approved leave this month</strong><span>Vacation, emergency, and sick leave will appear here.</span></div>}
          </section>
        </div>
      </div>
    </section>
  );
}

function RoomAvailabilityModule({
  appointments,
  services,
  globalSearch,
  branchRecords = [],
  branchScope = "All branches",
  canManageRooms = false,
  onCreateRoom,
  onDeleteRoom,
}) {
  const [date, setDate] = useState(todayDate());
  const [roomToDelete, setRoomToDelete] = useState(null);
  const visibleBranches = branchScope === "All branches"
    ? branchRecords
    : branchRecords.filter((branch) => branch.name === branchScope);
  const rooms = visibleBranches.flatMap((branch) => {
    const records = Array.isArray(branch.roomRecords) && branch.roomRecords.length
      ? branch.roomRecords
      : (branch.rooms ?? []).map((name, index) => ({
        id: "",
        name,
        branchId: branch.id,
        status: "Available",
        fallbackKey: `${branch.id || branch.name}-${index}`,
      }));
    return records.map((room) => ({ ...room, branch: branch.name }));
  });
  const filtered = appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.room}`).includes(normalize(globalSearch)));

  return (
    <section className="module-grid">
      <div className="surface-panel">
        <div className="room-availability-toolbar">
          <SectionHeader icon={Home} title="Room Availability View" />
          <label className="room-availability-date">
            <span>Date</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
        {rooms.length ? (
          <AvailabilityTimeline
            resourceLabel="Room"
            resources={rooms}
            appointments={filtered}
            services={services}
            getResource={(appointment) => `${appointment.branch}\u0000${appointment.room}`}
            getResourceKey={(room) => `${room.branch}\u0000${room.name}`}
            renderResource={(room) => (
              <RoomResourceLabel
                room={room}
                showBranch={branchScope === "All branches" && branchRecords.length > 1}
                canManage={canManageRooms && Boolean(room.id)}
                onDelete={() => setRoomToDelete(room)}
              />
            )}
          />
        ) : (
          <div className="room-empty-state">
            <EmptyState
              title="No active rooms"
              copy={branchScope === "All branches" ? "Add a room to an accessible branch to begin scheduling." : `Add the first room for ${branchScope}.`}
            />
            {canManageRooms && <button className="primary-button" type="button" onClick={onCreateRoom}><Plus size={17} /> Add room</button>}
          </div>
        )}
      </div>
      {roomToDelete && (
        <RoomDeleteDialog
          room={roomToDelete}
          onCancel={() => setRoomToDelete(null)}
          onConfirm={async () => {
            await onDeleteRoom(roomToDelete);
            setRoomToDelete(null);
          }}
        />
      )}
    </section>
  );
}

function RoomResourceLabel({ room, showBranch, canManage, onDelete }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const deleteRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.requestAnimationFrame(() => deleteRef.current?.focus());
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="room-resource-label">
      <span><strong>{room.name}</strong>{showBranch && <small>{room.branch}</small>}</span>
      {canManage && (
        <div className="room-row-menu" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Actions for ${room.name}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              setOpen(true);
            }}
          >
            <EllipsisVertical size={17} aria-hidden="true" />
          </button>
          {open && (
            <div className="room-row-dropdown" role="menu" aria-label={`${room.name} actions`}>
              <button
                ref={deleteRef}
                className="destructive"
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={16} aria-hidden="true" /> Delete room
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoomDeleteDialog({ room, onCancel, onConfirm }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setSaving(true);
    setError("");
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(deleteError?.message || "Unable to delete this room.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-label={`Delete ${room.name}`}>
      <div className="modal-card confirm-card room-delete-dialog">
        <div className="confirm-icon danger"><Trash2 size={21} aria-hidden="true" /></div>
        <div>
          <p className="eyebrow">Room management</p>
          <h3>Delete {room.name}?</h3>
          <p><strong>{room.name}</strong> at <strong>{room.branch}</strong> will be removed from active scheduling.</p>
          <p>Historical appointments and treatment records will remain unchanged. Deletion is blocked if the room has upcoming appointments.</p>
        </div>
        {error && <div className="inline-state error" role="alert"><AlertCircle size={17} /> {error}</div>}
        <div className="confirm-actions">
          <button className="ghost-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="danger-button" type="button" onClick={confirmDelete} disabled={saving}>
            <Trash2 size={16} /> {saving ? "Deleting..." : "Confirm delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AvailabilityTimeline({ resourceLabel, resources, appointments, services, getResource, getResourceKey = (resource) => resource, renderResource = (resource) => resource }) {
  return (
    <div className="availability-board">
      <div className="availability-scroll">
        <div className="availability-table">
          <div className="availability-corner">{resourceLabel}</div>
          <div className="timeline-axis">
            {scheduleHours.slice(0, -1).map((minutes) => <span key={minutes}>{formatScheduleTime(minutes)}</span>)}
          </div>
          {resources.map((resource) => {
            const resourceKey = getResourceKey(resource);
            const rowAppointments = appointments.filter((appointment) => getResource(appointment) === resourceKey);
            return (
              <React.Fragment key={resourceKey || resource.fallbackKey}>
                <div className="availability-resource">{renderResource(resource)}</div>
                <div className="availability-track">
                  <div className="timeline-grid-lines" />
                  {rowAppointments.map((appointment, index) => {
                    const start = parseTimeToMinutes(appointment.time);
                    const end = formatScheduleTime(start + appointmentDurationMinutes(appointment, services));
                    return (
                      <div
                        className={`schedule-block ${statusClass(appointment.status)}`}
                        key={appointment.id}
                        style={{ ...appointmentTimelineStyle(appointment, services), top: `${8 + (index % 2) * 54}px` }}
                        title={`${appointment.client} / ${appointment.service}`}
                      >
                        <strong>{appointment.client}</strong>
                        <span>{appointment.service}</span>
                        <small>{appointment.time} - {end}</small>
                      </div>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {!appointments.length && <EmptyState title="No scheduled services" copy="Pick another date or adjust the global search." />}
    </div>
  );
}

function LegacyAppointmentsModule({
  appointments,
  clients,
  services,
  staff = [],
  transactions = [],
  auditLogs = [],
  openModal,
  updateStatus,
  openPayment,
  onPrintReceipt,
  globalSearch,
}) {
  const [view, setView] = useState("Schedule");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [draggedAppointmentId, setDraggedAppointmentId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState("");
  const calendarPopoverRef = useRef(null);
  const [filters, setFilters] = useState({
    status: "All",
    doctor: "All",
    room: "All",
    service: "All",
    branch: "All",
    datePreset: "Today",
    from: "",
    to: "",
    payment: "All",
    deposit: "All",
    clientType: "All",
    query: "",
  });
  const [selectedId, setSelectedId] = useState("");
  const calendarViews = ["Schedule", "Kanban", "Timeline", "Rooms"];
  const scopedBranches = [...new Set(appointments.map((item) => item.branch).filter(Boolean))];
  const branchOptions = scopedBranches.length ? scopedBranches : branches.map((branch) => branch.name);
  const branchLabel = branchOptions.length === 1 ? branchOptions[0] : "Selected branches";
  const rooms =
    branchOptions.length === 1
      ? branches.find((branch) => branch.name === branchOptions[0])?.rooms ?? uniqueRoomsFromBranches()
      : uniqueRoomsFromBranches();
  const roomOptions = [...new Set(rooms.concat(appointments.map((item) => item.room)).filter(Boolean))];
  const staffNames = [
    ...new Set(
      staff
        .filter((person) => !scopedBranches.length || scopedBranches.includes(person.branch) || person.branch === "All branches")
        .map((person) => person.name)
        .concat(appointments.map((item) => item.staff))
        .filter(Boolean),
    ),
  ];
  const serviceOptions = [...new Set(services.map((service) => service.name).concat(appointments.map((item) => item.service)).filter(Boolean))];
  const clientAppointmentCounts = appointments.reduce((counts, appointment) => {
    const key = appointment.clientId || normalize(appointment.client);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const range = filters.datePreset === "Custom" ? { from: filters.from, to: filters.to } : dateRangeForPreset(filters.datePreset);
  const combinedQuery = normalize(`${globalSearch} ${filters.query}`.trim());
  const selectedCalendarDate = range.from && range.from === range.to ? range.from : todayDate();
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(calendarMonth);
  const calendarFirstWeekday = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarYear, calendarMonthIndex, 1 - calendarFirstWeekday + index);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, value, inMonth: date.getMonth() === calendarMonthIndex };
  });

  useEffect(() => {
    if (!calendarOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!calendarPopoverRef.current?.contains(event.target)) setCalendarOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCalendarOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [calendarOpen]);

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function resetFilters() {
    setFilters({
      status: "All",
      doctor: "All",
      room: "All",
      service: "All",
      branch: "All",
      datePreset: "Today",
      from: "",
      to: "",
      payment: "All",
      deposit: "All",
      clientType: "All",
      query: "",
    });
  }

  function moveDay(offset) {
    const base = filters.from || dateRangeForPreset(filters.datePreset).from || todayDate();
    const next = new Date(`${base}T12:00:00`);
    next.setDate(next.getDate() + offset);
    const date = next.toISOString().slice(0, 10);
    setFilters((current) => ({ ...current, datePreset: "Custom", from: date, to: date }));
  }

  function openCalendar() {
    const selected = new Date(`${selectedCalendarDate}T12:00:00`);
    if (!Number.isNaN(selected.getTime())) setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setCalendarOpen((current) => !current);
  }

  function selectCalendarDate(date) {
    setFilters((current) => ({ ...current, datePreset: "Custom", from: date, to: date }));
    setCalendarOpen(false);
  }

  function selectOperationalFilter(kind) {
    setFilters((current) => ({
      ...current,
      datePreset: "Today",
      from: "",
      to: "",
      status: kind === "waiting" ? "Arrived" : kind === "treatment" ? "In Treatment" : "All",
      payment: kind === "payment" ? "Unpaid" : "All",
    }));
  }

  const rows = appointments
    .filter((item) => filters.status === "All" || canonicalAppointmentStatus(item.status) === filters.status)
    .filter((item) => filters.doctor === "All" || item.staff === filters.doctor)
    .filter((item) => filters.room === "All" || item.room === filters.room)
    .filter((item) => filters.service === "All" || item.service === filters.service)
    .filter((item) => filters.branch === "All" || item.branch === filters.branch)
    .filter((item) => appointmentDateInRange(item, range))
    .filter((item) => {
      const payment = appointmentPaymentSummary(item, services, transactions);
      const hasDeposit = Number(item.deposit || 0) > 0;
      const clientKey = item.clientId || normalize(item.client);
      const returning = (clientAppointmentCounts[clientKey] || 0) > 1;
      const client = clients.find((person) => person.id === item.clientId || person.fullName === item.client);
      const searchable = `${item.id} ${item.client} ${client?.mobile ?? ""} ${item.service} ${item.staff} ${item.room} ${item.branch} ${item.status}`;
      const paymentMatch = filters.payment === "All" || payment.status === filters.payment;
      const depositMatch =
        filters.deposit === "All" ||
        (filters.deposit === "With Deposit" && hasDeposit) ||
        (filters.deposit === "No Deposit" && !hasDeposit);
      const clientTypeMatch =
        filters.clientType === "All" ||
        (filters.clientType === "New Client" && !returning) ||
        (filters.clientType === "Returning Client" && returning);
      return paymentMatch && depositMatch && clientTypeMatch && (!combinedQuery || normalize(searchable).includes(combinedQuery));
    })
    .sort((a, b) => {
      const dateCompare = String(a.date).localeCompare(String(b.date));
      return dateCompare || parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
    });
  const activeRows = rows.filter((item) => isActiveAppointmentStatus(item.status));
  const today = todayDate();
  const todaysAppointments = appointments.filter((appointment) => appointment.date === today);
  const waitingRows = todaysAppointments.filter((item) => ["Arrived", "Checked In"].includes(canonicalAppointmentStatus(item.status)));
  const inTreatmentRows = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "In Treatment");
  const completedToday = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "Completed");
  const cancelledToday = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "Cancelled");
  const noShowsToday = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "No Show");
  const revenueToday = transactions
    .filter((transaction) => transaction.date === today && transaction.status !== "Void" && !transaction.testMode)
    .reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const roomsOccupied = roomOptions.filter((room) => activeRows.some((item) => item.room === room)).length;
  const pendingDeposits = activeRows.filter((item) => appointmentPaymentSummary(item, services, transactions).status === "Unpaid");
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const waitMinutes = waitingRows.map((item) => Math.max(0, nowMinutes - parseTimeToMinutes(item.time)));
  const averageWait = waitMinutes.length ? Math.round(waitMinutes.reduce((sum, value) => sum + value, 0) / waitMinutes.length) : 0;
  const nextAppointment = activeRows[0] ?? rows[0];
  const selectedAppointment = rows.find((item) => item.id === selectedId) ?? null;
  const dateLabel = range.from && range.to
    ? range.from === range.to
      ? formatDate(range.from)
      : `${formatDate(range.from)} - ${formatDate(range.to)}`
    : "All scheduled dates";
  const pageTitle = filters.datePreset === "Today" ? `Today, ${formatDate(today)}` : dateLabel;
  const viewLabel = {
    Schedule: "Schedule",
    Timeline: "Clinic timeline",
    Rooms: "Room view",
  }[view];
  const groupedRows = rows.reduce((groups, appointment) => {
    const key = appointment.date || "Unscheduled";
    groups[key] = groups[key] || [];
    groups[key].push(appointment);
    return groups;
  }, {});

  function paymentDraftForAppointment(appointment) {
    const service = serviceForAppointment(appointment, services);
    const price = appointmentServicePrice(appointment, services);
    const depositCredit = Math.min(Number(appointment.deposit || 0), price);
    return {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      cart: [
        {
          key: `appointment-${appointment.id}`,
          type: "Service",
          serviceId: service?.id || appointment.serviceId,
          name: service?.name || appointment.service,
          qty: 1,
          price,
        },
      ],
      subtotal: price,
      discount: null,
      discountAmount: depositCredit,
      depositCredit,
      total: Math.max(0, price - depositCredit),
      notes: `Payment for appointment ${appointment.id}. Recorded deposit credit: ${money.format(depositCredit)}.`,
    };
  }

  function receiptForAppointment(appointment) {
    const payment = appointmentPaymentSummary(appointment, services, transactions);
    const service = serviceForAppointment(appointment, services);
    return {
      id: appointment.id,
      invoice: `Appointment ${appointment.id}`,
      date: appointment.date,
      time: appointment.time,
      client: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      items: [{
        serviceId: service?.id || appointment.serviceId || "",
        name: service?.name || appointment.service,
        type: "Service",
        qty: 1,
        price: payment.price,
        aftercare: service?.aftercare || "",
        recommendedIntervalDays: Number(service?.recommendedIntervalDays || 0),
      }],
      subtotal: payment.price,
      discount: payment.deposit,
      total: payment.due,
      payments: appointmentPayments(appointment, transactions).flatMap((transaction) => transaction.payments ?? []),
      status: payment.status,
      notes: appointment.notes,
    };
  }

  function prepareReminder(appointment) {
    openModal("campaign", {
      name: `Reminder - ${appointment.client}`,
      segment: "Service category",
      channel: "SMS",
      subject: "Appointment reminder",
      message: `Hi ${appointment.client}, this is your reminder for ${appointment.service} at ZenshoTech on ${formatDate(appointment.date)} at ${appointment.time}. Reply YES to confirm.`,
      status: "Draft",
    });
  }

  function renderAppointmentCard(appointment) {
    const duration = appointmentDurationMinutes(appointment, services);
    const payment = appointmentPaymentSummary(appointment, services, transactions);
    const client = clients.find((item) => item.id === appointment.clientId || item.fullName === appointment.client);
    const status = canonicalAppointmentStatus(appointment.status);
    const transitions = appointmentStatusTransitions[status] ?? [];
    const primaryTransition =
      transitions.find((value) => ["Confirmed", "Arrived", "Checked In", "In Treatment", "Completed"].includes(value)) ?? transitions[0];
    const transitionLabels = {
      Confirmed: "Confirm appointment",
      Arrived: "Mark arrived",
      "Checked In": "Check in",
      "In Treatment": "Start treatment",
      Completed: "Complete",
    };
    const statusIcons = {
      Confirmed: Check,
      Arrived: UserCheck,
      "Checked In": UserCheck,
      "In Treatment": Activity,
      Completed: ClipboardCheck,
      Cancelled: X,
      "No Show": X,
      Rescheduled: RefreshCw,
      "Pending Confirmation": Send,
    };

    return (
      <article
        className={`appointment-card appointment-flow-card ${selectedAppointment?.id === appointment.id ? "selected" : ""} ${statusClass(appointment.status)}`}
        key={appointment.id}
      >
        <div className="appointment-time-rail">
          <time>{formatScheduleTime(parseTimeToMinutes(appointment.time))}</time>
          <small>to {formatScheduleTime(parseTimeToMinutes(appointment.time) + duration)}</small>
          <span>{duration} min</span>
        </div>
        <button className="appointment-card-select" type="button" onClick={() => setSelectedId(appointment.id)} aria-label={`Review ${appointment.client} appointment`}>
          <span className="appointment-card-main">
            <span className="appointment-card-title">
              <span className="appointment-card-client">
                <span className="appointment-client-initials" aria-hidden="true">{initialsFor(appointment.client)}</span>
                <span>
                  <strong>{appointment.client}</strong>
                  <small>{appointment.service}</small>
                </span>
              </span>
              <StatusBadge status={canonicalAppointmentStatus(appointment.status)} />
            </span>
            <span className="appointment-detail-grid">
              <span><CalendarDays size={15} /> {formatDate(appointment.date)}</span>
              <span><Home size={15} /> {appointment.room || "Room pending"}</span>
              <span><UserCheck size={15} /> {appointment.staff || "Staff pending"}</span>
              <span><WalletCards size={15} /> {payment.status} / {money.format(payment.due)} due</span>
            </span>
          </span>
        </button>
        <div className="appointment-card-actions">
          {primaryTransition && (
            <button type="button" className="primary-inline-action" onClick={() => updateStatus(appointment.id, primaryTransition)}>
              {React.createElement(statusIcons[primaryTransition] ?? Check, { size: 14 })} {transitionLabels[primaryTransition] || primaryTransition}
            </button>
          )}
          <button type="button" onClick={() => setSelectedId(appointment.id)}><Eye size={14} /> Details</button>
          <button type="button" onClick={() => openPayment(paymentDraftForAppointment(appointment))} disabled={payment.price <= 0 || payment.due <= 0}>
            <CreditCard size={14} /> {payment.due <= 0 ? "Paid" : `Collect ${money.format(payment.due)}`}
          </button>
        </div>
      </article>
    );
  }

  function renderKanbanCard(appointment) {
    const payment = appointmentPaymentSummary(appointment, services, transactions);
    const status = canonicalAppointmentStatus(appointment.status);
    const transitions = appointmentStatusTransitions[status] ?? [];
    const primaryTransition =
      transitions.find((value) => ["Confirmed", "Arrived", "Checked In", "In Treatment", "Completed"].includes(value)) ?? transitions[0];

    return (
      <article
        className={`appointment-kanban-card ${statusClass(status)} ${draggedAppointmentId === appointment.id ? "is-dragging" : ""}`}
        key={appointment.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", appointment.id);
          setDraggedAppointmentId(appointment.id);
        }}
        onDragEnd={() => {
          setDraggedAppointmentId("");
          setDragOverStatus("");
        }}
        aria-grabbed={draggedAppointmentId === appointment.id}
        title="Drag this appointment to another status"
      >
        <button type="button" className="appointment-kanban-select" onClick={() => setSelectedId(appointment.id)} aria-label={`Review ${appointment.client} appointment`}>
          <span className="appointment-kanban-card-heading">
            <span className="appointment-client-initials" aria-hidden="true">{initialsFor(appointment.client)}</span>
            <span><strong>{appointment.client}</strong><small>{appointment.service}</small></span>
          </span>
          <span className="appointment-kanban-meta"><CalendarDays size={14} /> {formatDate(appointment.date)} at {formatScheduleTime(parseTimeToMinutes(appointment.time))}</span>
          <span className="appointment-kanban-meta"><UserCheck size={14} /> {appointment.staff || "Staff pending"}</span>
          <span className="appointment-kanban-meta"><Home size={14} /> {appointment.room || "Room pending"}</span>
          <span className="appointment-kanban-payment"><WalletCards size={14} /> {payment.status} / {money.format(payment.due)} due</span>
        </button>
        <div className="appointment-kanban-actions">
          <button type="button" onClick={() => setSelectedId(appointment.id)}><Eye size={14} /> Details</button>
          {primaryTransition && (
            <button type="button" className="primary-inline-action" onClick={() => updateStatus(appointment.id, primaryTransition)}>
              <Check size={14} /> {primaryTransition}
            </button>
          )}
        </div>
      </article>
    );
  }

  const coreKanbanStatuses = ["Pending Confirmation", "Confirmed", "Arrived", "In Treatment", "Completed"];
  const kanbanStatuses = [
    ...coreKanbanStatuses,
    ...appointmentStatuses.filter((status) => !coreKanbanStatuses.includes(status) && rows.some((item) => canonicalAppointmentStatus(item.status) === status)),
  ];

  function dropAppointment(event, nextStatus) {
    event.preventDefault();
    const appointmentId = draggedAppointmentId || event.dataTransfer.getData("text/plain");
    const appointment = rows.find((item) => item.id === appointmentId);
    setDraggedAppointmentId("");
    setDragOverStatus("");
    if (!appointment || canonicalAppointmentStatus(appointment.status) === nextStatus) return;
    updateStatus(appointment.id, nextStatus);
  }

  const timelineResources =
    view === "Rooms"
        ? roomOptions
        : ["Clinic"];

  return (
    <section className="appointments-workspace">
      <div className="surface-panel appointment-command-panel">
        <div className="appointment-command-header">
          <div>
            <p className="eyebrow">Appointments</p>
            <h2>Manage the clinic schedule</h2>
            <span>Find patients, move visits forward, and resolve issues quickly.</span>
          </div>
          <div className="appointment-command-actions">
            <button className="secondary-button" type="button" onClick={() => openModal("client")}>
              <Users size={17} /> New client
            </button>
            <button className="primary-button" type="button" onClick={() => openModal("appointment", { status: "Draft", date: today })}>
              <Plus size={17} /> New appointment
            </button>
          </div>
        </div>
        <div className="appointment-date-navigator" aria-label="Schedule date navigation">
          <button type="button" onClick={() => moveDay(-1)} aria-label="Previous day"><ChevronLeft size={18} /></button>
          <button type="button" className="date-title" onClick={() => setFilters((current) => ({ ...current, datePreset: "Today", from: "", to: "" }))}>
            <CalendarDays size={18} /><span>{pageTitle}</span><small>{rows.length} shown · {branchLabel}</small>
          </button>
          <button type="button" onClick={() => moveDay(1)} aria-label="Next day"><ChevronRight size={18} /></button>
          <div className="appointment-calendar-control" ref={calendarPopoverRef}>
            <button className="date-picker-button" type="button" onClick={openCalendar} aria-haspopup="dialog" aria-expanded={calendarOpen}>
              <CalendarDays size={16} /> Choose date
            </button>
            {calendarOpen && (
              <div className="appointment-calendar-popover" role="dialog" aria-label="Choose appointment date">
                <div className="appointment-calendar-header">
                  <button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))} aria-label="Previous month"><ChevronLeft size={17} /></button>
                  <strong>{calendarMonthLabel}</strong>
                  <button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))} aria-label="Next month"><ChevronRight size={17} /></button>
                </div>
                <div className="appointment-calendar-weekdays" aria-hidden="true">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="appointment-calendar-days">
                  {calendarDays.map((day) => (
                    <button
                      className={`${day.inMonth ? "" : "outside-month"} ${day.value === todayDate() ? "today" : ""} ${day.value === selectedCalendarDate ? "selected" : ""}`.trim()}
                      type="button"
                      key={day.value}
                      onClick={() => selectCalendarDate(day.value)}
                      aria-label={formatDate(day.value)}
                      aria-pressed={day.value === selectedCalendarDate}
                    >
                      {day.date.getDate()}
                    </button>
                  ))}
                </div>
                <div className="appointment-calendar-footer">
                  <button type="button" onClick={() => selectCalendarDate(todayDate())}>Today</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="appointment-summary-grid operational-summary">
          <button type="button" onClick={() => selectOperationalFilter("today")}><span>Today</span><strong>{todaysAppointments.length}</strong><small>appointments</small></button>
          <button type="button" onClick={() => selectOperationalFilter("waiting")}><span>Waiting</span><strong>{waitingRows.length}</strong><small>{averageWait ? `${averageWait} min average` : "patients"}</small></button>
          <button type="button" onClick={() => selectOperationalFilter("treatment")}><span>In treatment</span><strong>{inTreatmentRows.length}</strong><small>active now</small></button>
          <button type="button" onClick={() => selectOperationalFilter("payment")}><span>Needs payment</span><strong>{pendingDeposits.length}</strong><small>{money.format(pendingDeposits.reduce((sum, item) => sum + appointmentPaymentSummary(item, services, transactions).due, 0))} due</small></button>
          <button type="button" onClick={() => { setFilter("datePreset", "Today"); setFilter("status", "Pending Confirmation"); }}><span>Pending</span><strong>{todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "Pending Confirmation").length}</strong><small>confirmations</small></button>
        </div>
        {(pendingDeposits.length > 0 || waitingRows.length > 0) && <div className="appointment-attention"><AlertCircle size={18} /><div><strong>Needs attention</strong><span>{pendingDeposits.length} payment{pendingDeposits.length === 1 ? "" : "s"} outstanding{waitingRows.length ? ` · ${waitingRows.length} patient${waitingRows.length === 1 ? "" : "s"} waiting` : ""}</span></div></div>}
      </div>

      <div className="surface-panel appointment-calendar-panel">
        <div className="appointment-panel-heading">
          <SectionHeader icon={CalendarDays} title="Schedule" action={`${rows.length} shown`} />
          <div className="segmented-control appointment-view-tabs" role="tablist" aria-label="Appointment view">
            {calendarViews.map((item) => (
              <button type="button" role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item}</button>
            ))}
          </div>
        </div>
        <div className="appointment-filter-shell">
          <div className="appointment-filters primary-filters">
            <label className="appointment-filter-field">
              <span>Status</span>
              <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
                <option>All</option>
                {appointmentStatuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field appointment-search-filter">
              <span>Search</span>
              <input value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Patient, phone, doctor, booking ID" />
            </label>
            <button className="secondary-button appointment-more-filters" type="button" onClick={() => setShowAdvancedFilters((value) => !value)}>
              <Filter size={16} /> {showAdvancedFilters ? "Hide filters" : "More filters"}
            </button>
            <button className="ghost-button appointment-reset-filters" type="button" onClick={resetFilters}>
              <RefreshCw size={16} /> Reset
            </button>
          </div>
          {showAdvancedFilters && (
          <div className="appointment-filters advanced-filters">
            <label className="appointment-filter-field">
              <span>Doctor / Staff</span>
              <select value={filters.doctor} onChange={(event) => setFilter("doctor", event.target.value)}>
                <option>All</option>
                {staffNames.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Room</span>
              <select value={filters.room} onChange={(event) => setFilter("room", event.target.value)}>
                <option>All</option>
                {roomOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Service</span>
              <select value={filters.service} onChange={(event) => setFilter("service", event.target.value)}>
                <option>All</option>
                {serviceOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Branch</span>
              <select value={filters.branch} onChange={(event) => setFilter("branch", event.target.value)}>
                <option>All</option>
                {branchOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Payment</span>
              <select value={filters.payment} onChange={(event) => setFilter("payment", event.target.value)}>
                {["All", "Paid", "Partial", "Unpaid", "No charge"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Deposit</span>
              <select value={filters.deposit} onChange={(event) => setFilter("deposit", event.target.value)}>
                {["All", "With Deposit", "No Deposit"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="appointment-filter-field">
              <span>Client Type</span>
              <select value={filters.clientType} onChange={(event) => setFilter("clientType", event.target.value)}>
                {["All", "New Client", "Returning Client"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {filters.datePreset === "Custom" && (
              <>
                <label className="appointment-filter-field">
                  <span>From</span>
                  <input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
                </label>
                <label className="appointment-filter-field">
                  <span>To</span>
                  <input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
                </label>
              </>
            )}
          </div>
          )}
        </div>

        {["Timeline", "Rooms"].includes(view) ? (
          <AvailabilityTimeline
            resourceLabel={view === "Rooms" ? "Room" : "Timeline"}
            resources={timelineResources}
            appointments={rows}
            services={services}
            getResource={(appointment) =>
              view === "Rooms"
                  ? appointment.room
                  : "Clinic"
            }
          />
        ) : view === "Kanban" ? (
          <div className="appointment-kanban-board" aria-label="Appointments by status">
            {kanbanStatuses.map((status) => {
              const statusRows = rows.filter((appointment) => canonicalAppointmentStatus(appointment.status) === status);
              return (
                <section
                  className={`appointment-kanban-column ${statusClass(status)} ${dragOverStatus === status ? "is-drag-over" : ""}`}
                  key={status}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (draggedAppointmentId) setDragOverStatus(status);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setDragOverStatus("");
                  }}
                  onDrop={(event) => dropAppointment(event, status)}
                >
                  <header><span>{status}</span><strong>{statusRows.length}</strong></header>
                  <div>
                    {statusRows.map(renderKanbanCard)}
                    {!statusRows.length && <span className="appointment-kanban-empty">No appointments</span>}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="appointment-board schedule-view">
            {rows.map(renderAppointmentCard)}
            {!rows.length && <EmptyState title="No appointments found" copy="Change filters or add a new booking for this branch." />}
          </div>
        )}
      </div>

      <AppointmentDetailsDrawer
        appointment={selectedAppointment}
        client={selectedAppointment ? clients.find((item) => item.id === selectedAppointment.clientId || item.fullName === selectedAppointment.client) : null}
        services={services}
        transactions={transactions}
        auditLogs={auditLogs}
        onClose={() => setSelectedId("")}
        onEdit={(appointment) => openModal("appointment", appointment)}
        onStatus={updateStatus}
        onPayment={(appointment) => openPayment(paymentDraftForAppointment(appointment))}
        onPrint={(appointment) => onPrintReceipt(receiptForAppointment(appointment))}
        onReminder={prepareReminder}
      />

      <div className="appointment-data-toggle">
        <button className="secondary-button" type="button" onClick={() => setShowDataTable((value) => !value)}>
          <FileText size={16} /> {showDataTable ? "Hide data table" : "Show data table"}
        </button>
      </div>

      {showDataTable && (
        <div className="surface-panel appointment-data-panel">
          <SectionHeader icon={FileText} title="Appointment Data" action={`${clients.length} clients / ${services.length} services`} />
          <SmartTable
            rows={rows}
            globalSearch={globalSearch}
            columns={[
              { key: "id", label: "Booking ID" },
              { key: "date", label: "Date" },
              { key: "time", label: "Time" },
              { key: "client", label: "Client" },
              { key: "service", label: "Service" },
              { key: "branch", label: "Branch" },
              { key: "staff", label: "Doctor / Staff" },
              { key: "room", label: "Room" },
              { key: "deposit", label: "Deposit", render: (row) => money.format(row.deposit) },
              { key: "payment", label: "Payment", render: (row) => appointmentPaymentSummary(row, services, transactions).status },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={canonicalAppointmentStatus(row.status)} /> },
            ]}
          />
        </div>
      )}
    </section>
  );
}

void LegacyAppointmentsModule;

const appointmentGridHourHeight = 72;

function AppointmentScheduleGrid({
  resources,
  appointments,
  services,
  getResource,
  selectedDate,
  selectedId,
  onSelect,
  onContext,
  onChangeAppointment,
}) {
  const resizeSession = useRef(null);
  const [resizePreview, setResizePreview] = useState(null);
  const gridMinutes = scheduleEndMinutes - scheduleStartMinutes;
  const boardHeight = (gridMinutes / 60) * appointmentGridHourHeight;
  const pixelPerMinute = appointmentGridHourHeight / 60;
  const isToday = selectedDate === todayDate();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMinutes >= scheduleStartMinutes && nowMinutes <= scheduleEndMinutes;

  useEffect(() => {
    function resizeAt(event) {
      const session = resizeSession.current;
      if (!session) return;
      const deltaMinutes = Math.round(((event.clientY - session.startY) / pixelPerMinute) / 15) * 15;
      const duration = Math.max(15, Math.min(240, session.duration + deltaMinutes));
      setResizePreview({ id: session.appointment.id, duration });
    }

    function finishResize() {
      const session = resizeSession.current;
      const preview = resizePreview;
      resizeSession.current = null;
      setResizePreview(null);
      if (!session || !preview || preview.duration === session.duration) return;
      void onChangeAppointment(session.appointment, { duration: preview.duration });
    }

    document.addEventListener("pointermove", resizeAt);
    document.addEventListener("pointerup", finishResize);
    return () => {
      document.removeEventListener("pointermove", resizeAt);
      document.removeEventListener("pointerup", finishResize);
    };
  }, [onChangeAppointment, pixelPerMinute, resizePreview]);

  if (!resources.length) {
    return (
      <div className="appointment-resource-grid-shell appointment-resource-grid-shell-empty">
        <EmptyState
          title="No scheduling resources"
          copy="Add a practitioner or room to this branch to show appointment availability."
        />
      </div>
    );
  }

  function dropAppointment(event, resource) {
    event.preventDefault();
    const appointmentId = event.dataTransfer.getData("text/appointment-id");
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawMinutes = scheduleStartMinutes + ((event.clientY - rect.top) / pixelPerMinute);
    const start = Math.max(scheduleStartMinutes, Math.min(scheduleEndMinutes - 15, Math.round(rawMinutes / 15) * 15));
    void onChangeAppointment(appointment, {
      time: formatTimeInput(start),
      ...resource.assignment,
    });
  }

  return (
    <div className="appointment-resource-grid-shell">
      <div className="appointment-resource-grid" style={{ "--appointment-resource-count": Math.max(1, resources.length) }}>
        <div className="appointment-grid-corner"><span>GMT+8</span><small>Manila</small></div>
        {resources.map((resource) => (
          <div className="appointment-resource-heading" key={resource.key}>
            <span><strong>{resource.label}</strong><small>{resource.subtitle || "Available"}</small></span>
          </div>
        ))}
        <div className="appointment-time-axis" style={{ height: `${boardHeight}px` }}>
          {scheduleHours.slice(0, -1).map((minutes) => (
            <span key={minutes} style={{ top: `${(minutes - scheduleStartMinutes) * pixelPerMinute}px` }}>{formatScheduleTime(minutes).replace(":00", "")}</span>
          ))}
          <span style={{ top: `${boardHeight - 16}px` }}>{formatScheduleTime(scheduleEndMinutes).replace(":00", "")}</span>
        </div>
        {resources.map((resource) => (
          <div
            className="appointment-resource-column"
            key={resource.key}
            style={{ height: `${boardHeight}px` }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => dropAppointment(event, resource)}
          >
            <span className="appointment-lunch-band" style={{ top: `${(12 * 60 - scheduleStartMinutes) * pixelPerMinute}px`, height: `${appointmentGridHourHeight}px` }}>Lunch / protected time</span>
            {showNow && <span className="appointment-current-time-line" style={{ top: `${(nowMinutes - scheduleStartMinutes) * pixelPerMinute}px` }}><i /></span>}
            {appointments.filter((appointment) => getResource(appointment) === resource.key).map((appointment) => {
              const start = parseTimeToMinutes(appointment.time);
              const duration = resizePreview?.id === appointment.id ? resizePreview.duration : appointmentDurationMinutes(appointment, services);
              return (
                <article
                  className={`appointment-grid-card ${statusClass(appointment.status)} ${selectedId === appointment.id ? "selected" : ""}`}
                  key={appointment.id}
                  draggable={!resizePreview}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/appointment-id", appointment.id);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onContext(event, appointment);
                  }}
                  style={{
                    top: `${Math.max(0, start - scheduleStartMinutes) * pixelPerMinute + 4}px`,
                    height: `${Math.max(42, duration * pixelPerMinute - 8)}px`,
                  }}
                >
                  <button type="button" onClick={() => onSelect(appointment.id)} aria-label={`Open ${appointment.client} appointment`}>
                    <span className="appointment-grid-card-heading"><strong>{appointment.service}</strong></span>
                    <span className="appointment-grid-card-time">{formatScheduleTime(start)} – {formatScheduleTime(start + duration)}</span>
                    <small className="appointment-grid-card-client">{appointment.client}</small>
                  </button>
                  <button
                    className="appointment-resize-handle"
                    type="button"
                    aria-label={`Resize ${appointment.client} appointment`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      resizeSession.current = { appointment, startY: event.clientY, duration };
                      setResizePreview({ id: appointment.id, duration });
                    }}
                  />
                </article>
              );
            })}
          </div>
        ))}
      </div>
      {!appointments.length && <div className="appointment-grid-empty"><CalendarDays size={20} /><span>No appointments match these filters. Drag-free time is available for booking.</span></div>}
    </div>
  );
}

function AppointmentWeekView({ appointments, selectedDate, selectedId, onSelect, onOpenDay }) {
  const focusDate = new Date(`${selectedDate}T12:00:00`);
  const weekStart = startOfMondayWeek(focusDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const value = isoDate(date);
    return {
      date,
      value,
      appointments: appointments.filter((appointment) => appointment.date === value),
    };
  });
  const weekdayFormat = new Intl.DateTimeFormat("en-PH", { weekday: "short" });

  return (
    <div className="appointment-period-scroll">
      <div className="appointment-week-view" role="grid" aria-label="Weekly appointments">
        {days.map((day) => (
          <section className={`appointment-week-day ${day.value === todayDate() ? "today" : ""} ${day.value === selectedDate ? "selected" : ""}`.trim()} role="gridcell" key={day.value}>
            <button className="appointment-period-day-heading" type="button" onClick={() => onOpenDay(day.value)} aria-label={`Open ${formatDate(day.value)}`}>
              <span>{weekdayFormat.format(day.date)}</span>
              <strong>{day.date.getDate()}</strong>
              <small>{day.appointments.length} booking{day.appointments.length === 1 ? "" : "s"}</small>
            </button>
            <div className="appointment-period-entries">
              {day.appointments.map((appointment) => {
                const start = parseTimeToMinutes(appointment.time);
                return (
                  <button className={`appointment-period-entry ${statusClass(appointment.status)} ${selectedId === appointment.id ? "selected" : ""}`.trim()} type="button" key={appointment.id} onClick={() => onSelect(appointment.id)}>
                    <time>{formatScheduleTime(start)}</time>
                    <strong>{appointment.client}</strong>
                    <span>{appointment.service}</span>
                    <small>{appointment.staff || "Unassigned"}{appointment.room ? ` · ${appointment.room}` : ""}</small>
                    <em>{canonicalAppointmentStatus(appointment.status)}</em>
                  </button>
                );
              })}
              {!day.appointments.length && <span className="appointment-period-empty">No appointments</span>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AppointmentMonthView({ appointments, selectedDate, selectedId, onSelect, onOpenDay }) {
  const focusDate = new Date(`${selectedDate}T12:00:00`);
  const year = focusDate.getFullYear();
  const monthIndex = focusDate.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, monthIndex, 1 - firstWeekday + index);
    const value = isoDate(date);
    return {
      date,
      value,
      inMonth: date.getMonth() === monthIndex,
      appointments: appointments.filter((appointment) => appointment.date === value),
    };
  });

  return (
    <div className="appointment-period-scroll">
      <div className="appointment-month-overview" role="grid" aria-label="Monthly appointments">
        <div className="appointment-month-weekdays" role="row">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span role="columnheader" key={day}>{day}</span>)}
        </div>
        <div className="appointment-month-days">
          {days.map((day) => (
            <section className={`${day.inMonth ? "" : "outside-month"} ${day.value === todayDate() ? "today" : ""} ${day.value === selectedDate ? "selected" : ""}`.trim()} role="gridcell" key={day.value}>
              <button className="appointment-month-day-heading" type="button" onClick={() => onOpenDay(day.value)} aria-label={`Open ${formatDate(day.value)}`}>
                <strong>{day.date.getDate()}</strong>
                {day.appointments.length > 0 && <span>{day.appointments.length}</span>}
              </button>
              <div className="appointment-month-entries">
                {day.appointments.slice(0, 3).map((appointment) => (
                  <button className={`appointment-month-entry ${statusClass(appointment.status)} ${selectedId === appointment.id ? "selected" : ""}`.trim()} type="button" key={appointment.id} onClick={() => onSelect(appointment.id)} title={`${appointment.time} · ${appointment.client} · ${appointment.service}`}>
                    <time>{formatScheduleTime(parseTimeToMinutes(appointment.time))}</time>
                    <span className="appointment-month-entry-copy">
                      <strong>{appointment.client}</strong>
                      <small>{appointment.service}</small>
                    </span>
                  </button>
                ))}
                {day.appointments.length > 3 && <button className="appointment-month-more" type="button" onClick={() => onOpenDay(day.value)}>+{day.appointments.length - 3} more</button>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppointmentsModule({
  detailAppointmentId = "",
  appointments,
  clients,
  services,
  staff = [],
  transactions = [],
  auditLogs = [],
  treatments = [],
  packages = [],
  openModal,
  updateStatus,
  onUpdateAppointment,
  openPayment,
  onPrintReceipt,
  globalSearch,
  onCreateDateChange,
  onOpenAppointment,
  onCloseDetail,
}) {
  const defaultFilters = {
    status: "All",
    doctor: "All",
    room: "All",
    service: "All",
    branch: "All",
    datePreset: "Today",
    from: "",
    to: "",
    payment: "All",
    deposit: "All",
    clientType: "All",
    appointmentType: "All",
    insurance: "All",
    tags: "",
  };
  const [view, setView] = useStoredState("appointment-scheduler-view", "Schedule");
  const activeView = view === "Schedule" ? "Day" : view;
  const [kanbanScope, setKanbanScope] = useStoredState("appointment-kanban-scope", "Day");
  const [kanbanCustomRange, setKanbanCustomRange] = useState(() => {
    const today = todayDate();
    return { from: today, to: today };
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState("");
  const [draggedAppointmentId, setDraggedAppointmentId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [scheduleFeedback, setScheduleFeedback] = useState(null);

  const normalizedFilters = { ...defaultFilters, ...filters };
  const range = normalizedFilters.datePreset === "Custom"
    ? { from: normalizedFilters.from, to: normalizedFilters.to || normalizedFilters.from }
    : dateRangeForPreset(normalizedFilters.datePreset);
  const selectedDate = range.from && range.from === range.to ? range.from : todayDate();
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstWeekday = (new Date(calendarYear, calendarMonthIndex, 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarYear, calendarMonthIndex, 1 - firstWeekday + index);
    return {
      date,
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      inMonth: date.getMonth() === calendarMonthIndex,
    };
  });
  const calendarMonthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(calendarMonth);
  const roomOptions = [...new Set(uniqueRoomsFromBranches().concat(appointments.map((item) => item.room)).filter(Boolean))];
  const appointmentPractitioners = staff.filter((person) => /doctor|nurse|aesthetician/i.test(person.role || ""));
  const knownStaffNames = new Set(staff.map((person) => person.name));
  const appointmentStaffLabel = (appointment) => knownStaffNames.has(appointment.staff) ? appointment.staff : "Unassigned";
  const hasUnassignedAppointments = appointments.some((appointment) => appointmentStaffLabel(appointment) === "Unassigned");
  const doctorOptions = [...knownStaffNames];
  if (hasUnassignedAppointments) doctorOptions.push("Unassigned");
  const serviceOptions = [...new Set(services.map((service) => service.name).concat(appointments.map((item) => item.service)).filter(Boolean))];
  const branchOptions = [...new Set(
    services
      .flatMap((service) => service.branches || [])
      .concat(staff.map((person) => person.branch), appointments.map((item) => item.branch))
      .filter((name) => name && name !== "All branches"),
  )];
  const appointmentTypeOptions = [...new Set(appointments.map((item) => item.appointmentType).filter(Boolean))];
  const insuranceOptions = [...new Set(appointments.map((item) => item.insurance).filter(Boolean))];
  const activeFilterCount = ["status", "doctor", "room", "service", "branch", "payment", "deposit", "clientType", "appointmentType", "insurance", "tags"]
    .filter((key) => normalizedFilters[key] !== defaultFilters[key]).length;
  const clientAppointmentCounts = appointments.reduce((counts, appointment) => {
    const key = appointment.clientId || normalize(appointment.client);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const combinedQuery = normalize(globalSearch.trim());

  const matchingRows = appointments
    .filter((item) => normalizedFilters.status === "All" || canonicalAppointmentStatus(item.status) === normalizedFilters.status)
    .filter((item) => normalizedFilters.doctor === "All" || appointmentStaffLabel(item) === normalizedFilters.doctor)
    .filter((item) => normalizedFilters.room === "All" || item.room === normalizedFilters.room)
    .filter((item) => normalizedFilters.service === "All" || item.service === normalizedFilters.service)
    .filter((item) => normalizedFilters.branch === "All" || item.branch === normalizedFilters.branch)
    .filter((item) => normalizedFilters.appointmentType === "All" || item.appointmentType === normalizedFilters.appointmentType)
    .filter((item) => normalizedFilters.insurance === "All" || item.insurance === normalizedFilters.insurance)
    .filter((item) => {
      const payment = appointmentPaymentSummary(item, services, transactions);
      const hasDeposit = Number(item.deposit || 0) > 0;
      const clientKey = item.clientId || normalize(item.client);
      const returning = (clientAppointmentCounts[clientKey] || 0) > 1;
      const client = clients.find((person) => person.id === item.clientId || person.fullName === item.client);
      const searchable = `${item.id} ${item.client} ${client?.mobile ?? ""} ${item.service} ${item.staff} ${item.room} ${item.branch} ${item.status} ${item.appointmentType} ${item.insurance} ${item.tags}`;
      const paymentMatch = normalizedFilters.payment === "All" || payment.status === normalizedFilters.payment;
      const depositMatch = normalizedFilters.deposit === "All" || (normalizedFilters.deposit === "With Deposit" ? hasDeposit : !hasDeposit);
      const clientTypeMatch = normalizedFilters.clientType === "All" || (normalizedFilters.clientType === "New Client" ? !returning : returning);
      const tagMatch = !normalizedFilters.tags || normalize(item.tags).includes(normalize(normalizedFilters.tags));
      return paymentMatch && depositMatch && clientTypeMatch && tagMatch && (!combinedQuery || normalize(searchable).includes(combinedQuery));
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  const filteredRows = matchingRows.filter((item) => appointmentDateInRange(item, range));
  const dayRows = filteredRows.filter((item) => item.date === selectedDate);
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
  const selectedWeekStart = startOfMondayWeek(selectedDateObject);
  const selectedWeekRange = { from: isoDate(selectedWeekStart), to: isoDate(addDays(selectedWeekStart, 6)) };
  const weekRows = matchingRows.filter((item) => appointmentDateInRange(item, selectedWeekRange));
  const selectedMonthPrefix = `${selectedDateObject.getFullYear()}-${String(selectedDateObject.getMonth() + 1).padStart(2, "0")}`;
  const monthRows = matchingRows.filter((item) => String(item.date).startsWith(selectedMonthPrefix));
  const resolvedKanbanScope = ["Day", "Week", "Month", "Custom"].includes(kanbanScope) ? kanbanScope : "Day";
  const customKanbanRows = matchingRows.filter((item) => appointmentDateInRange(item, kanbanCustomRange));
  const kanbanRows = resolvedKanbanScope === "Week"
    ? weekRows
    : resolvedKanbanScope === "Month"
      ? monthRows
      : resolvedKanbanScope === "Custom"
        ? customKanbanRows
        : dayRows;
  const periodMode = activeView === "Kanban" ? resolvedKanbanScope : activeView;
  const periodRows = periodMode === "Week"
    ? weekRows
    : periodMode === "Month"
      ? monthRows
      : periodMode === "Custom"
        ? customKanbanRows
        : dayRows;
  const displayedRows = activeView === "Kanban" ? kanbanRows : activeView === "Week" ? weekRows : activeView === "Month" ? monthRows : filteredRows;
  const weekEnd = addDays(selectedWeekStart, 6);
  const customRangeTitle = kanbanCustomRange.from === kanbanCustomRange.to
    ? formatDate(kanbanCustomRange.from)
    : `${formatDate(kanbanCustomRange.from)} – ${formatDate(kanbanCustomRange.to)}`;
  const periodTitle = periodMode === "Week"
    ? `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(selectedWeekStart)} – ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(weekEnd)}`
    : periodMode === "Month"
      ? new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(selectedDateObject)
      : periodMode === "Custom"
        ? customRangeTitle
        : formatDate(selectedDate);
  const periodSubtitle = periodMode === "Week"
    ? `${weekRows.length} appointments · GMT+8`
    : periodMode === "Month"
      ? `${monthRows.length} appointments · GMT+8`
      : periodMode === "Custom"
        ? `${customKanbanRows.length} appointments · GMT+8`
      : `${new Intl.DateTimeFormat("en-PH", { weekday: "long" }).format(selectedDateObject)} · GMT+8`;
  const periodUnitLabel = periodMode === "Custom" ? "custom range" : periodMode.toLowerCase();
  const selectedAppointment = appointments.find((item) => item.id === (detailAppointmentId || selectedId)) ?? null;
  const selectedBranch = normalizedFilters.branch === "All" ? null : normalizedFilters.branch;
  const scopedStaff = appointmentPractitioners
    .filter((person) => !selectedBranch || person.branch === selectedBranch || person.branch === "All branches");
  const scopedStaffNames = new Set(scopedStaff.map((person) => person.name));
  const appointmentPractitionerKey = (appointment) => scopedStaffNames.has(appointment.staff) ? appointment.staff : "Unassigned";
  const practitionerNames = [...new Set(scopedStaff.map((person) => person.name))];
  if (periodRows.some((appointment) => appointmentPractitionerKey(appointment) === "Unassigned")) practitionerNames.push("Unassigned");
  const practitionerResources = practitionerNames
    .filter((name) => normalizedFilters.doctor === "All" || name === normalizedFilters.doctor)
    .map((name) => {
      const person = staff.find((item) => item.name === name);
      const room = dayRows.find((item) => appointmentPractitionerKey(item) === name)?.room;
      return { key: name, label: name, subtitle: room || person?.role || "No staff assigned", photo: person?.photo, assignment: { staff: name === "Unassigned" ? "" : name } };
    });
  const roomResources = roomOptions
    .filter((room) => normalizedFilters.room === "All" || room === normalizedFilters.room)
    .map((room) => ({ key: room, label: room, subtitle: dayRows.some((item) => item.room === room) ? "Scheduled" : "Available", assignment: { room } }));
  const today = todayDate();

  useEffect(() => {
    onCreateDateChange?.(selectedDate);
  }, [onCreateDateChange, selectedDate]);

  useEffect(() => {
    const parsed = new Date(`${selectedDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  function setFilter(name, value) {
    setFilters((current) => ({ ...defaultFilters, ...current, [name]: value }));
  }

  function resetScheduleFilters() {
    setFilters((current) => ({
      ...defaultFilters,
      datePreset: current.datePreset,
      from: current.from,
      to: current.to,
    }));
  }

  function selectDate(date) {
    setFilters((current) => ({ ...defaultFilters, ...current, datePreset: "Custom", from: date, to: date }));
  }

  function moveDay(offset) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    selectDate(next.toISOString().slice(0, 10));
  }

  function updateKanbanCustomRange(field, value) {
    if (!value) return;
    setKanbanCustomRange((current) => {
      const next = { ...current, [field]: value };
      if (field === "from" && next.to < value) next.to = value;
      if (field === "to" && next.from > value) next.from = value;
      return next;
    });
  }

  function moveKanbanCustomRange(direction) {
    const from = new Date(`${kanbanCustomRange.from}T12:00:00`);
    const to = new Date(`${kanbanCustomRange.to}T12:00:00`);
    const span = Math.max(1, Math.round((to - from) / 86400000) + 1);
    setKanbanCustomRange({ from: isoDate(addDays(from, direction * span)), to: isoDate(addDays(to, direction * span)) });
  }

  async function changeAppointment(appointment, changes) {
    setScheduleFeedback({ type: "loading", message: "Checking availability…" });
    try {
      await Promise.resolve(onUpdateAppointment({ ...appointment, ...changes }, { silent: true }));
      setScheduleFeedback({ type: "success", message: `${appointment.client} moved to ${changes.time ? formatScheduleTime(parseTimeToMinutes(changes.time)) : `${changes.duration} minutes`}.` });
    } catch (error) {
      setScheduleFeedback({ type: "error", message: error?.message || "That time is not available." });
    }
  }

  function paymentDraftForAppointment(appointment) {
    const service = serviceForAppointment(appointment, services);
    const price = appointmentServicePrice(appointment, services);
    const depositCredit = Math.min(Number(appointment.deposit || 0), price);
    return {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      cart: [{ key: `appointment-${appointment.id}`, type: "Service", serviceId: service?.id || appointment.serviceId, name: service?.name || appointment.service, qty: 1, price }],
      subtotal: price,
      discount: null,
      discountAmount: depositCredit,
      depositCredit,
      total: Math.max(0, price - depositCredit),
      notes: `Payment for appointment ${appointment.id}. Recorded deposit credit: ${money.format(depositCredit)}.`,
    };
  }

  function receiptForAppointment(appointment) {
    const payment = appointmentPaymentSummary(appointment, services, transactions);
    const service = serviceForAppointment(appointment, services);
    return {
      id: appointment.id,
      invoice: `Appointment ${appointment.id}`,
      date: appointment.date,
      time: appointment.time,
      client: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      items: [{
        serviceId: service?.id || appointment.serviceId || "",
        name: service?.name || appointment.service,
        type: "Service",
        qty: 1,
        price: payment.price,
        aftercare: service?.aftercare || "",
        recommendedIntervalDays: Number(service?.recommendedIntervalDays || 0),
      }],
      subtotal: payment.price,
      discount: payment.deposit,
      total: payment.due,
      payments: appointmentPayments(appointment, transactions).flatMap((transaction) => transaction.payments ?? []),
      status: payment.status,
      notes: appointment.notes,
    };
  }

  function prepareReminder(appointment, channel = "SMS") {
    openModal("campaign", {
      name: `${channel} reminder - ${appointment.client}`,
      segment: "Service category",
      channel,
      subject: "Your ZenshoTech appointment reminder",
      message: `Hi ${appointment.client}, this is your reminder for ${appointment.service} at ZenshoTech on ${formatDate(appointment.date)} at ${formatScheduleTime(parseTimeToMinutes(appointment.time))}. Reply YES to confirm.`,
      status: "Draft",
    });
  }

  const kanbanDefinitions = [
    { label: "Waiting", target: "Arrived", matches: (item) => ["Draft", "Pending Confirmation", "Arrived"].includes(canonicalAppointmentStatus(item.status)) },
    { label: "Confirmed", target: "Confirmed", matches: (item) => canonicalAppointmentStatus(item.status) === "Confirmed" },
    { label: "Checked In", target: "Checked In", matches: (item) => canonicalAppointmentStatus(item.status) === "Checked In" },
    { label: "In Treatment", target: "In Treatment", matches: (item) => canonicalAppointmentStatus(item.status) === "In Treatment" },
    { label: "Needs Payment", target: "Completed", matches: (item) => canonicalAppointmentStatus(item.status) === "Completed" && appointmentPaymentSummary(item, services, transactions).due > 0 },
    { label: "Completed", target: "Completed", matches: (item) => canonicalAppointmentStatus(item.status) === "Completed" && appointmentPaymentSummary(item, services, transactions).due <= 0 },
    { label: "Cancelled", target: "Cancelled", matches: (item) => ["Cancelled", "No Show"].includes(canonicalAppointmentStatus(item.status)) },
  ];

  function dropKanban(event, definition) {
    event.preventDefault();
    const id = draggedAppointmentId || event.dataTransfer.getData("text/plain");
    const appointment = kanbanRows.find((item) => item.id === id);
    setDraggedAppointmentId("");
    setDragOverStatus("");
    if (!appointment || definition.matches(appointment)) return;
    updateStatus(appointment.id, definition.target);
  }

  function openAppointmentDetails(appointment) {
    if (onOpenAppointment) onOpenAppointment(appointment);
    else setSelectedId(appointment.id);
  }

  if (detailAppointmentId) {
    if (!selectedAppointment) {
      return <RecordDetailNotFound label="Appointment" onBack={onCloseDetail} />;
    }
    const detailClient = clients.find((item) => item.id === selectedAppointment.clientId || item.fullName === selectedAppointment.client);
    return (
      <RecordDetailPageHeader label="Appointments" title={selectedAppointment.client} onBack={onCloseDetail}>
        <AppointmentDetailsDrawer
          standalone
          appointment={selectedAppointment}
          staffLabel={appointmentStaffLabel(selectedAppointment)}
          staff={staff}
          client={detailClient}
          services={services}
          transactions={transactions}
          auditLogs={auditLogs}
          treatments={treatments}
          packages={packages}
          onClose={onCloseDetail}
          onEdit={(appointment) => openModal("appointment", appointment)}
          onStatus={updateStatus}
          onAssign={(appointment, staffName) => onUpdateAppointment({ ...appointment, staff: staffName || "Any available" }, { silent: true })}
          onPayment={(appointment) => openPayment(paymentDraftForAppointment(appointment))}
          onPrint={(appointment) => onPrintReceipt(receiptForAppointment(appointment))}
          onReminder={(appointment) => prepareReminder(appointment, "SMS")}
          onEmail={(appointment) => prepareReminder(appointment, "Email")}
        />
      </RecordDetailPageHeader>
    );
  }

  return (
    <section className="appointments-workspace appointment-scheduler-redesign">
      <div className="appointment-scheduler-layout">
        <aside className="surface-panel appointment-scheduler-sidebar">
          <div className="appointment-sidebar-title"><strong>Appointment Calendar</strong><CalendarDays size={17} /></div>
          <div className="appointment-month-calendar">
            <header><button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button><strong>{calendarMonthLabel}</strong><button type="button" onClick={() => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button><button type="button" onClick={() => selectDate(today)}>Today</button></header>
            <div className="appointment-calendar-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="appointment-calendar-days">
              {calendarDays.map((day) => {
                const count = matchingRows.filter((item) => item.date === day.value).length;
                return <button className={`${day.inMonth ? "" : "outside-month"} ${day.value === today ? "today" : ""} ${day.value === selectedDate ? "selected" : ""}`.trim()} type="button" key={day.value} onClick={() => selectDate(day.value)} aria-label={`${formatDate(day.value)}${count ? `, ${count} appointments` : ""}`}><span>{day.date.getDate()}</span>{count > 0 && <i />}</button>;
              })}
            </div>
          </div>
          <div className="appointment-doctor-list-heading"><div><strong>Doctor Appointment List</strong><span>{periodRows.length} visits in this {periodUnitLabel}</span></div><button type="button" onClick={() => setFilter("doctor", "All")} aria-label="Show every doctor">•••</button></div>
          <div className="appointment-doctor-list">
            {practitionerNames.map((name) => {
              const person = staff.find((item) => item.name === name);
              const doctorRows = periodRows.filter((item) => appointmentPractitionerKey(item) === name);
              const next = doctorRows[0];
              return (
                <button className={normalizedFilters.doctor === name ? "selected" : ""} type="button" key={name} onClick={() => setFilter("doctor", normalizedFilters.doctor === name ? "All" : name)}>
                  {person?.photo ? <img src={person.photo} alt="" /> : <span className="doctor-initials">{initialsFor(name)}</span>}
                  <span><strong>{name}</strong><small>{person?.role || doctorRows[0]?.service || "Practitioner"}</small><em>{person?.status || "Available"}</em></span>
                  <span><strong>{next ? formatScheduleTime(parseTimeToMinutes(next.time)) : "Open"}</strong><small>{doctorRows.length} booking{doctorRows.length === 1 ? "" : "s"}</small></span>
                </button>
              );
            })}
            {!practitionerNames.length && <EmptyState title="No practitioners" copy="Add staff to show appointment availability." />}
          </div>
          <button className="appointment-see-doctors" type="button" onClick={() => setFilter("doctor", "All")}>See all doctors</button>
        </aside>

        <div className="surface-panel appointment-calendar-panel">
          <div className="appointment-scheduler-toolbar">
            <div className="appointment-date-navigator">
              <button type="button" onClick={() => periodMode === "Custom" ? moveKanbanCustomRange(-1) : periodMode === "Day" ? moveDay(-1) : selectDate(moveAppointmentFocus(selectedDate, periodMode, -1))} aria-label={`Previous ${periodMode === "Custom" ? "date range" : periodMode.toLowerCase()}`}><ChevronLeft size={18} /></button>
              <div><strong>{periodTitle}</strong><span>{periodSubtitle}</span></div>
              <button type="button" onClick={() => periodMode === "Custom" ? moveKanbanCustomRange(1) : periodMode === "Day" ? moveDay(1) : selectDate(moveAppointmentFocus(selectedDate, periodMode, 1))} aria-label={`Next ${periodMode === "Custom" ? "date range" : periodMode.toLowerCase()}`}><ChevronRight size={18} /></button>
            </div>
            <div className="segmented-control appointment-view-tabs" role="tablist" aria-label="Appointment view">
              {["Day", "Week", "Month", "Kanban", "Timeline", "Rooms"].map((item) => <button type="button" role="tab" aria-selected={activeView === item} className={activeView === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item}</button>)}
            </div>
            <div className={`appointment-compact-filter-bar appointment-toolbar-filter-bar ${showAdvancedFilters ? "is-expanded" : ""}`} aria-label="Appointment filters">
              <label className="appointment-filter-field">
                <span className="sr-only">Status</span>
                <select aria-label="Filter by appointment status" value={normalizedFilters.status} onChange={(event) => setFilter("status", event.target.value)}>
                  <option>All</option>
                  {appointmentStatuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="appointment-filter-field">
                <span className="sr-only">Doctor or staff</span>
                <select aria-label="Filter by doctor or staff" value={normalizedFilters.doctor} onChange={(event) => setFilter("doctor", event.target.value)}>
                  <option>All</option>
                  {doctorOptions.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <button className={`secondary-button appointment-filter-toggle ${showAdvancedFilters ? "active" : ""}`} type="button" aria-expanded={showAdvancedFilters} onClick={() => setShowAdvancedFilters((value) => !value)}>
                <SlidersHorizontal size={15} /> <span className="appointment-filter-desktop-label">{showAdvancedFilters ? "Fewer filters" : "More filters"}</span><span className="appointment-filter-mobile-label">Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
              </button>
              <button className="ghost-button appointment-filter-reset" type="button" disabled={!activeFilterCount} onClick={resetScheduleFilters}><RefreshCw size={15} /> Clear</button>
            </div>
            {showAdvancedFilters && (
              <div className="appointment-compact-filter-region is-expanded appointment-advanced-filter-region">
                <div className="appointment-filters advanced-filters">
                  <label className="appointment-filter-field">
                    <span>Room</span>
                    <select value={normalizedFilters.room} onChange={(event) => setFilter("room", event.target.value)}>
                      <option>All</option>
                      {roomOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="appointment-filter-field">
                    <span>Service</span>
                    <select value={normalizedFilters.service} onChange={(event) => setFilter("service", event.target.value)}>
                      <option>All</option>
                      {serviceOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="appointment-filter-field">
                    <span>Branch</span>
                    <select value={normalizedFilters.branch} onChange={(event) => setFilter("branch", event.target.value)}>
                      <option>All</option>
                      {branchOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="appointment-filter-field">
                    <span>Payment</span>
                    <select value={normalizedFilters.payment} onChange={(event) => setFilter("payment", event.target.value)}>
                      {["All", "Paid", "Partial", "Unpaid", "No charge"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="appointment-filter-field">
                    <span>Deposit</span>
                    <select value={normalizedFilters.deposit} onChange={(event) => setFilter("deposit", event.target.value)}>
                      {["All", "With Deposit", "No Deposit"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="appointment-filter-field">
                    <span>Client type</span>
                    <select value={normalizedFilters.clientType} onChange={(event) => setFilter("clientType", event.target.value)}>
                      {["All", "New Client", "Returning Client"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  {appointmentTypeOptions.length > 0 && (
                    <label className="appointment-filter-field">
                      <span>Appointment type</span>
                      <select value={normalizedFilters.appointmentType} onChange={(event) => setFilter("appointmentType", event.target.value)}>
                        <option>All</option>
                        {appointmentTypeOptions.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                  )}
                  {insuranceOptions.length > 0 && (
                    <label className="appointment-filter-field">
                      <span>Insurance</span>
                      <select value={normalizedFilters.insurance} onChange={(event) => setFilter("insurance", event.target.value)}>
                        <option>All</option>
                        {insuranceOptions.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="appointment-filter-field">
                    <span>Tags</span>
                    <input value={normalizedFilters.tags} onChange={(event) => setFilter("tags", event.target.value)} placeholder="Search appointment tags" />
                  </label>
                </div>
              </div>
            )}
          </div>
          {scheduleFeedback && <div className={`appointment-schedule-feedback ${scheduleFeedback.type}`}><span>{scheduleFeedback.message}</span><button type="button" onClick={() => setScheduleFeedback(null)} aria-label="Dismiss message"><X size={14} /></button></div>}
          {activeView === "Day" && <AppointmentScheduleGrid resources={practitionerResources} appointments={dayRows} services={services} getResource={appointmentPractitionerKey} selectedDate={selectedDate} selectedId={selectedId} onSelect={(id) => { const appointment = appointments.find((item) => item.id === id); if (appointment) openAppointmentDetails(appointment); }} onContext={(event, appointment) => setContextMenu({ x: event.clientX, y: event.clientY, appointment })} onChangeAppointment={changeAppointment} />}
          {activeView === "Week" && <AppointmentWeekView appointments={weekRows} selectedDate={selectedDate} selectedId={selectedId} onSelect={(id) => { const appointment = appointments.find((item) => item.id === id); if (appointment) openAppointmentDetails(appointment); }} onOpenDay={(date) => { selectDate(date); setView("Day"); }} />}
          {activeView === "Month" && <AppointmentMonthView appointments={monthRows} selectedDate={selectedDate} selectedId={selectedId} onSelect={(id) => { const appointment = appointments.find((item) => item.id === id); if (appointment) openAppointmentDetails(appointment); }} onOpenDay={(date) => { selectDate(date); setView("Day"); }} />}
          {activeView === "Rooms" && <AppointmentScheduleGrid resources={roomResources} appointments={dayRows} services={services} getResource={(item) => item.room} selectedDate={selectedDate} selectedId={selectedId} onSelect={(id) => { const appointment = appointments.find((item) => item.id === id); if (appointment) openAppointmentDetails(appointment); }} onContext={(event, appointment) => setContextMenu({ x: event.clientX, y: event.clientY, appointment })} onChangeAppointment={changeAppointment} />}
          {activeView === "Timeline" && <AvailabilityTimeline resourceLabel="Doctor / Staff" resources={practitionerNames} appointments={dayRows} services={services} getResource={appointmentPractitionerKey} />}
          {activeView === "Kanban" && (
            <div className="appointment-kanban-workspace">
              <div className="appointment-kanban-scope-toolbar">
                <div><strong>Kanban period</strong><span>Choose how much of the schedule to show.</span></div>
                <div className="appointment-kanban-scope-options" role="radiogroup" aria-label="Kanban period">
                  {[{ value: "Day", label: "Daily" }, { value: "Week", label: "Whole week" }, { value: "Month", label: "Whole month" }, { value: "Custom", label: "Custom range" }].map((option) => (
                    <button type="button" role="radio" aria-checked={resolvedKanbanScope === option.value} className={resolvedKanbanScope === option.value ? "active" : ""} onClick={() => setKanbanScope(option.value)} key={option.value}>{option.label}</button>
                  ))}
                </div>
                {resolvedKanbanScope === "Custom" && (
                  <div className="appointment-kanban-custom-range" aria-label="Custom Kanban date range">
                    <label><span>From</span><input type="date" value={kanbanCustomRange.from} onChange={(event) => updateKanbanCustomRange("from", event.target.value)} /></label>
                    <label><span>To</span><input type="date" value={kanbanCustomRange.to} onChange={(event) => updateKanbanCustomRange("to", event.target.value)} /></label>
                  </div>
                )}
              </div>
              <div className="appointment-kanban-board appointment-workflow-board" aria-label={`Appointment workflow for ${periodTitle}`}>
                {kanbanDefinitions.map((definition) => {
                  const items = kanbanRows.filter(definition.matches);
                  return (
                    <section className={`appointment-kanban-column ${dragOverStatus === definition.label ? "is-drag-over" : ""}`} key={definition.label} onDragOver={(event) => event.preventDefault()} onDragEnter={() => setDragOverStatus(definition.label)} onDrop={(event) => dropKanban(event, definition)}>
                      <header><span>{definition.label}</span><strong>{items.length}</strong></header>
                      <div>{items.map((appointment) => {
                        const payment = appointmentPaymentSummary(appointment, services, transactions);
                        const scheduleLabel = resolvedKanbanScope === "Day"
                          ? formatScheduleTime(parseTimeToMinutes(appointment.time))
                          : `${formatDate(appointment.date)} · ${formatScheduleTime(parseTimeToMinutes(appointment.time))}`;
                        return <article className={`appointment-kanban-card ${statusClass(appointment.status)}`} draggable key={appointment.id} onDragStart={(event) => { event.dataTransfer.setData("text/plain", appointment.id); setDraggedAppointmentId(appointment.id); }} onDragEnd={() => { setDraggedAppointmentId(""); setDragOverStatus(""); }}><button type="button" onClick={() => openAppointmentDetails(appointment)}><span className="appointment-kanban-card-heading"><span className="appointment-client-initials">{initialsFor(appointment.client)}</span><span><strong>{appointment.client}</strong><small>{appointment.service}</small></span></span><span className="appointment-kanban-meta"><Clock size={14} /> {scheduleLabel} · {appointmentStaffLabel(appointment)}</span><span className="appointment-kanban-payment"><WalletCards size={14} /> {money.format(payment.due)} due</span></button></article>;
                      })}{!items.length && <span className="appointment-kanban-empty">No appointments</span>}</div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && <div className="appointment-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()} role="menu"><button type="button" onClick={() => { openAppointmentDetails(contextMenu.appointment); setContextMenu(null); }}><Eye size={15} /> View details</button><button type="button" onClick={() => openModal("appointment", contextMenu.appointment)}><Edit3 size={15} /> Edit appointment</button><button type="button" onClick={() => updateStatus(contextMenu.appointment.id, "Checked In")}><UserCheck size={15} /> Check in</button><button type="button" onClick={() => openPayment(paymentDraftForAppointment(contextMenu.appointment))}><CreditCard size={15} /> Collect payment</button><button className="danger" type="button" onClick={() => updateStatus(contextMenu.appointment.id, "Cancelled")}><X size={15} /> Cancel appointment</button></div>}

      <AppointmentDetailsDrawer appointment={selectedAppointment} staffLabel={selectedAppointment ? appointmentStaffLabel(selectedAppointment) : ""} staff={staff} client={selectedAppointment ? clients.find((item) => item.id === selectedAppointment.clientId || item.fullName === selectedAppointment.client) : null} services={services} transactions={transactions} auditLogs={auditLogs} treatments={treatments} packages={packages} onClose={() => setSelectedId("")} onEdit={(appointment) => openModal("appointment", appointment)} onStatus={updateStatus} onAssign={(appointment, staffName) => onUpdateAppointment({ ...appointment, staff: staffName || "Any available" }, { silent: true })} onPayment={(appointment) => openPayment(paymentDraftForAppointment(appointment))} onPrint={(appointment) => onPrintReceipt(receiptForAppointment(appointment))} onReminder={(appointment) => prepareReminder(appointment, "SMS")} onEmail={(appointment) => prepareReminder(appointment, "Email")} />

      <div className="appointment-data-toggle"><button className="secondary-button" type="button" onClick={() => setShowDataTable((value) => !value)}><FileText size={16} /> {showDataTable ? "Hide data table" : "Show data table"}</button></div>
      {showDataTable && <div className="surface-panel appointment-data-panel"><SectionHeader icon={FileText} title="Appointment Data" action={`${displayedRows.length} records`} /><SmartTable rows={displayedRows} globalSearch={globalSearch} columns={[{ key: "id", label: "Booking ID" }, { key: "date", label: "Date" }, { key: "time", label: "Time" }, { key: "client", label: "Client" }, { key: "service", label: "Service" }, { key: "staff", label: "Doctor / Staff", render: appointmentStaffLabel }, { key: "room", label: "Room" }, { key: "duration", label: "Duration", render: (row) => `${appointmentDurationMinutes(row, services)} min` }, { key: "payment", label: "Payment", render: (row) => appointmentPaymentSummary(row, services, transactions).status }, { key: "status", label: "Status", render: (row) => <StatusBadge status={canonicalAppointmentStatus(row.status)} /> }]} /></div>}
    </section>
  );
}

function AppointmentDetailsDrawer({
  standalone = false,
  appointment,
  staffLabel,
  staff = [],
  client,
  services,
  transactions,
  auditLogs,
  treatments = [],
  packages = [],
  onClose,
  onEdit,
  onStatus,
  onAssign,
  onPayment,
  onPrint,
  onReminder,
  onEmail,
}) {
  const [assignmentValue, setAssignmentValue] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState(null);

  useEffect(() => {
    const assignedStaff = String(appointment?.staff || "").trim();
    const isKnownStaff = staff.some((person) => person.name === assignedStaff);
    setAssignmentValue(isKnownStaff && !["", "Any available", "To assign", "Unassigned"].includes(assignedStaff) ? assignedStaff : "");
  }, [appointment?.id, appointment?.staff, staff]);

  useEffect(() => {
    setAssignmentSaving(false);
    setAssignmentFeedback(null);
  }, [appointment?.id]);

  if (!appointment) return null;
  const service = serviceForAppointment(appointment, services);
  const payment = appointmentPaymentSummary(appointment, services, transactions);
  const status = canonicalAppointmentStatus(appointment.status);
  const transitions = appointmentStatusTransitions[status] ?? [];
  const standardTransitions = transitions.filter((value) => value !== "Cancelled");
  const canCancel = transitions.includes("Cancelled");
  const recordedDuration = Number(appointment.duration) >= 15
    ? Number(appointment.duration)
    : Number(service?.duration) >= 15
      ? Number(service.duration)
      : null;
  const appointmentTime = appointment.time
    ? formatScheduleTime(parseTimeToMinutes(appointment.time))
    : "Time not recorded";
  const durationLabel = recordedDuration ? `${recordedDuration} min` : "Duration not recorded";
  const paymentLabel = payment.due > 0
    ? `${money.format(payment.due)} due`
    : payment.price > 0
      ? "Paid"
      : "No charge";
  const matchingPayments = appointmentPayments(appointment, transactions);
  const matchingAudits = auditLogs
    .filter((log) => ["Appointments", "Online Booking"].includes(log.area))
    .filter((log) => normalize(`${log.details} ${log.action}`).includes(normalize(appointment.client)) || normalize(`${log.details} ${log.action}`).includes(normalize(appointment.service)))
    .slice(0, 8);
  const matchingTreatments = treatments
    .filter((item) => item.clientId === appointment.clientId || item.client === appointment.client)
    .filter((item) => !item.date || item.date === appointment.date)
    .slice(0, 4);
  const matchingPackages = packages
    .filter((item) => item.clientId === appointment.clientId || item.client === appointment.client)
    .filter((item) => !appointment.packageName || item.name === appointment.packageName)
    .slice(0, 4);
  const timeline = [
    ...matchingPayments.map((transaction) => ({
      title: "Payment collected",
      time: transaction.time ? `${transaction.date}T${transaction.time}` : transaction.date,
      actor: transaction.staff,
      detail: `${transaction.invoice} / ${money.format(transaction.total)}`,
    })),
    ...matchingAudits.map((log) => ({
      title: log.action,
      time: log.createdAt || log.time,
      actor: log.actor,
      detail: log.details,
    })),
  ].filter((item) => item.title);
  const assignmentOptions = staff
    .filter((person) => person?.name)
    .filter((person) => person.name === appointment.staff || !appointment.branch || !person.branch || person.branch === "All branches" || person.branch === appointment.branch)
    .sort((left, right) => left.name.localeCompare(right.name));

  async function reassignAppointment(event) {
    const nextStaff = event.target.value;
    const previousStaff = assignmentValue;
    setAssignmentValue(nextStaff);
    setAssignmentSaving(true);
    setAssignmentFeedback(null);

    try {
      await Promise.resolve(onAssign(appointment, nextStaff));
      setAssignmentFeedback({
        type: "success",
        message: nextStaff ? `Assigned to ${nextStaff}.` : "Appointment is now unassigned.",
      });
    } catch (error) {
      setAssignmentValue(previousStaff);
      setAssignmentFeedback({ type: "error", message: error.message || "Unable to update the assigned staff." });
    } finally {
      setAssignmentSaving(false);
    }
  }

  return (
    <>
    {!standalone && <button className="appointment-drawer-backdrop" type="button" onClick={onClose} aria-label="Close appointment details" />}
    <aside className={`surface-panel appointment-details-drawer ${standalone ? "is-standalone" : ""}`} aria-label="Appointment details">
      <header className="appointment-details-hero">
        <div className="appointment-patient-heading">
          <ClientAvatar client={client || { fullName: appointment.client }} size="large" />
          <div>
            <p className="eyebrow">Appointment details</p>
            <h3>{appointment.client}</h3>
            <strong className="appointment-hero-service">{appointment.service}</strong>
            <div className="appointment-hero-meta">
              <span><CalendarDays size={14} /> {formatDate(appointment.date)}</span>
              <span><Clock size={14} /> {appointmentTime} · {durationLabel}</span>
            </div>
          </div>
        </div>
        {!standalone && <button className="icon-button" type="button" onClick={onClose} aria-label="Close appointment details"><X size={18} /></button>}
      </header>

      <div className="appointment-details-body">
        <section className="appointment-compact-summary" aria-label="Appointment summary">
          <AppointmentDetailRow label="Service" value={appointment.service} />
          <div className="appointment-summary-status-row">
            <span>Current status</span>
            <div>
              <StatusBadge status={status} />
              {transitions.length > 0 && (
                <details className="appointment-status-menu">
                  <summary>Update status <ChevronDown size={15} /></summary>
                  <div role="menu" aria-label="Update appointment status">
                    {standardTransitions.map((value) => (
                      <button type="button" role="menuitem" key={value} onClick={() => onStatus(appointment.id, value)}><Check size={14} /> {value}</button>
                    ))}
                    {canCancel && <button className="danger" type="button" role="menuitem" onClick={() => onStatus(appointment.id, "Cancelled")}><X size={14} /> Cancelled</button>}
                  </div>
                </details>
              )}
            </div>
          </div>
          <AppointmentDetailRow label="Branch and room" value={`${appointment.branch || "Branch not assigned"} · ${appointment.room || "Room not assigned"}`} />
          {onAssign ? (
            <div className="appointment-summary-assignment-row">
              <span>Doctor / Staff</span>
              <div>
                <select aria-label="Reassign doctor or staff" value={assignmentValue} onChange={reassignAppointment} disabled={assignmentSaving}>
                  <option value="">Unassigned</option>
                  {assignmentOptions.map((person) => {
                    const unavailable = /inactive|on leave|off duty|unavailable/i.test(person.status || "");
                    return (
                      <option key={person.id || person.name} value={person.name} disabled={unavailable && person.name !== assignmentValue}>
                        {person.name}{person.role ? ` · ${person.role}` : ""}{unavailable ? ` · ${person.status}` : ""}
                      </option>
                    );
                  })}
                </select>
                {assignmentSaving && <small className="appointment-assignment-feedback">Saving assignment…</small>}
                {!assignmentSaving && assignmentFeedback && <small className={`appointment-assignment-feedback ${assignmentFeedback.type}`}>{assignmentFeedback.message}</small>}
              </div>
            </div>
          ) : (
            <AppointmentDetailRow label="Doctor / Staff" value={staffLabel || "Not assigned"} />
          )}
          <div className="appointment-summary-payment-row">
            <span>Payment</span>
            <div><strong className={payment.due <= 0 ? `appointment-payment-badge ${payment.price > 0 ? "paid" : "neutral"}` : ""}>{paymentLabel}</strong><small>{money.format(payment.applied)} applied</small></div>
          </div>
        </section>

        <div className="appointment-disclosure-list">
          <details className="appointment-disclosure" open>
            <summary><span><PhoneCall size={17} /><span><strong>Patient information</strong><small>Contact details</small></span></span><ChevronDown size={17} /></summary>
            <div className="appointment-disclosure-content">
              <div className="appointment-detail-rows">
                <AppointmentDetailRow label="Mobile number" value={client?.mobile || "Not recorded"} />
                <AppointmentDetailRow label="Email address" value={client?.email || "Not recorded"} />
              </div>
              <details className="appointment-more-details">
                <summary>More details <ChevronDown size={15} /></summary>
                <div className="appointment-detail-rows">
                  <AppointmentDetailRow label="Birthday" value={client?.birthday || client?.dob || "Not recorded"} />
                  <AppointmentDetailRow label="Patient type" value={appointment.appointmentType} />
                  <AppointmentDetailRow label="Timezone" value={appointment.timezone} />
                  <AppointmentDetailRow label="Insurance" value={appointment.insurance} />
                  <AppointmentDetailRow label="Tags" value={appointment.tags || client?.tag} />
                  <AppointmentDetailRow label="Package" value={appointment.packageName} />
                  <AppointmentDetailRow label="Booking ID" value={appointment.id} />
                </div>
              </details>
            </div>
          </details>

          <details className="appointment-disclosure">
            <summary><span><CalendarDays size={17} /><span><strong>Visit details</strong><small>Schedule and assigned resources</small></span></span><ChevronDown size={17} /></summary>
            <div className="appointment-disclosure-content appointment-detail-rows">
              <AppointmentDetailRow label="Service" value={appointment.service} />
              <AppointmentDetailRow label="Date and time" value={`${formatDate(appointment.date)} · ${appointmentTime}`} />
              <AppointmentDetailRow label="Appointment duration" value={recordedDuration ? `${recordedDuration} minutes` : ""} />
              <AppointmentDetailRow label="Doctor / Staff" value={staffLabel || "Not assigned"} />
              <AppointmentDetailRow label="Branch" value={appointment.branch || "Not assigned"} />
              <AppointmentDetailRow label="Room" value={appointment.room || "Not assigned"} />
              <AppointmentContentGroup title="Service protocol" rows={[service?.description, service?.contraindications, service?.aftercare].filter(Boolean)} empty="No service protocol notes." />
            </div>
          </details>

          <details className="appointment-disclosure">
            <summary><span><WalletCards size={17} /><span><strong>Payment</strong><small>{paymentLabel}</small></span></span><ChevronDown size={17} /></summary>
            <div className="appointment-disclosure-content">
              <div className="appointment-detail-rows">
                <AppointmentDetailRow label="Payment status" value={payment.status} />
                <AppointmentDetailRow label="Service price" value={money.format(payment.price)} />
                <AppointmentDetailRow label="Deposit" value={money.format(payment.deposit)} />
                <AppointmentDetailRow label="Applied payments" value={money.format(payment.applied)} />
                <AppointmentDetailRow label="Balance" value={money.format(payment.due)} />
              </div>
              <AppointmentContentGroup title="Payment history" rows={matchingPayments.map((transaction) => `${transaction.invoice} · ${money.format(transaction.total)} · ${transaction.status}`)} empty="No posted payment for this appointment." />
            </div>
          </details>

          <details className="appointment-disclosure">
            <summary><span><MessageSquareText size={17} /><span><strong>Notes</strong><small>Clinical and internal context</small></span></span><ChevronDown size={17} /></summary>
            <div className="appointment-disclosure-content appointment-content-groups">
              <AppointmentContentGroup title="Medical notes" rows={[client?.medicalNotes, client?.allergies, client?.contraindications].filter(Boolean)} empty="No medical notes recorded." />
              <AppointmentContentGroup title="Internal notes" rows={[appointment.notes, appointment.internalNotes].filter(Boolean)} empty="No notes on this booking." />
              <AppointmentContentGroup title="SOAP / Treatment notes" rows={matchingTreatments.flatMap((item) => [item.preNotes, item.postNotes, item.deviceSettings]).filter(Boolean)} empty="No treatment notes linked to this visit." />
              <AppointmentContentGroup title="Prescription and aftercare" rows={matchingTreatments.flatMap((item) => [item.prescription, item.aftercare, item.consumables]).filter(Boolean)} empty="No prescription or aftercare record." />
              <AppointmentContentGroup title="Attachments" rows={matchingTreatments.flatMap((item) => (item.photoItems || []).map((photo) => `${photo.kind} treatment photo`)).filter(Boolean)} empty="No treatment attachments." />
              <AppointmentContentGroup title="Packages" rows={matchingPackages.map((item) => `${item.name} · ${item.remaining ?? item.balance ?? 0} remaining · ${item.status}`)} empty="No package linked to this patient." />
            </div>
          </details>

          <details className="appointment-disclosure appointment-history-section">
            <summary><span><Clock size={17} /><span><strong>Appointment history</strong><small>{timeline.length} recorded events</small></span></span><ChevronDown size={17} /></summary>
            <div className="appointment-disclosure-content appointment-timeline">
              {timeline.map((event, index) => (
                <article key={`${event.title}-${index}`}>
                  <span>{formatDateTime(event.time)}</span>
                  <strong>{event.title}</strong>
                  {(event.actor || event.detail) && <small>{[event.actor, event.detail].filter(Boolean).join(" / ")}</small>}
                </article>
              ))}
              {!timeline.length && <small>No recorded appointment history.</small>}
            </div>
          </details>
        </div>
      </div>

      <footer className="appointment-details-footer">
        <div className="appointment-footer-main-actions">
          {payment.due > 0 ? (
            <button className="primary-button" type="button" onClick={() => onPayment(appointment)}><CreditCard size={16} /> Collect {money.format(payment.due)}</button>
          ) : (
            <button className="primary-button" type="button" onClick={() => onEdit(appointment)}><Edit3 size={16} /> Edit appointment</button>
          )}
          {payment.due > 0 ? (
            <button className="secondary-button" type="button" onClick={() => onEdit(appointment)}><Edit3 size={16} /> Edit appointment</button>
          ) : (
            <button className="secondary-button" type="button" onClick={() => onReminder(appointment)}><Send size={16} /> Send reminder</button>
          )}
        </div>
        <details className="appointment-overflow-menu">
          <summary aria-label="More appointment actions"><EllipsisVertical size={19} /></summary>
          <div role="menu" aria-label="More appointment actions">
            {payment.due > 0 && <button type="button" role="menuitem" onClick={() => onReminder(appointment)}><Send size={15} /> Send reminder</button>}
            <button type="button" role="menuitem" onClick={() => onEmail(appointment)}><Mail size={15} /> Email</button>
            <button type="button" role="menuitem" onClick={() => onPrint(appointment)}><Printer size={15} /> Print</button>
            {canCancel && <button className="danger" type="button" role="menuitem" onClick={() => onStatus(appointment.id, "Cancelled")}><X size={15} /> Cancel appointment</button>}
          </div>
        </details>
      </footer>
    </aside>
    </>
  );
}

function AppointmentDetailRow({ label, value }) {
  return <div className="appointment-detail-row"><span>{label}</span><strong>{value || "Not set"}</strong></div>;
}

function AppointmentContentGroup({ title, rows, empty }) {
  return (
    <section className="appointment-content-group">
      <strong>{title}</strong>
      {rows.length ? rows.map((row, index) => <p key={`${title}-${index}`}>{row}</p>) : <small>{empty}</small>}
    </section>
  );
}

function ClientsModule({
  detailClientId = "",
  clients,
  selectedClientId,
  setSelectedClientId,
  treatments,
  appointments,
  transactions,
  packages,
  consentTemplates = [],
  consentSubmissions = [],
  openModal,
  importClients,
  importInputRef,
  deleteClient,
  sensitiveAllowed,
  globalSearch,
  notify,
  onOpenClient,
  onCloseDetail,
}) {
  const [directoryBranch, setDirectoryBranch] = useState("All branches");
  const [directoryView, setDirectoryView] = useStoredState("client-directory-view", "list");
  const [directorySort, setDirectorySort] = useState("recent");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [selectedClientIds, setSelectedClientIds] = useState(() => new Set());
  const [profileClientId, setProfileClientId] = useState(null);
  const profileClient = clients.find((client) => client.id === (detailClientId || profileClientId));
  const profileTreatments = treatments.filter((item) => item.clientId === profileClient?.id);
  const profileAppointments = appointments.filter((item) => item.clientId === profileClient?.id);
  const profileTransactions = transactions.filter((item) => item.client === profileClient?.fullName);
  const profilePackages = packages.filter((item) => item.clientId === profileClient?.id);
  const profileConsents = consentSubmissions.filter((item) => item.clientId === profileClient?.id);
  const safeDirectoryView = directoryView === "cards" ? "cards" : "list";
  const activeDirectoryQuery = globalSearch.trim();
  const directoryBranches = useMemo(
    () => ["All branches", ...new Set(clients.flatMap((client) => [client.branch, ...splitList(client.branchesVisited)]).filter(Boolean))],
    [clients],
  );
  const filteredClients = useMemo(() => {
    const relatedText = new Map();

    function addRelatedText(key, value) {
      if (!key || !value) return;
      const current = relatedText.get(key) ?? "";
      relatedText.set(key, `${current} ${value}`.trim());
    }

    appointments.forEach((appointment) => {
      const text = `${appointment.id} ${appointment.service} ${appointment.status} ${appointment.date} ${appointment.time}`;
      addRelatedText(appointment.clientId, text);
      addRelatedText(normalize(appointment.client), text);
    });

    packages.forEach((pkg) => {
      const text = `${pkg.id} ${pkg.name} ${pkg.status} ${pkg.expires}`;
      addRelatedText(pkg.clientId, text);
      addRelatedText(normalize(pkg.client), text);
    });

    const query = normalize(activeDirectoryQuery);
    const matches = clients.filter((client) => {
      const branchMatches = directoryBranch === "All branches" || client.branch === directoryBranch || splitList(client.branchesVisited).includes(directoryBranch);
      if (!branchMatches) return false;
      if (!query) return true;

      const searchable = [
        client.id,
        client.fullName,
        client.mobile,
        client.email,
        client.branch,
        splitList(client.branchesVisited).join(" "),
        client.tag,
        client.retention,
        client.source,
        client.referral,
        client.lastVisit,
        client.nextVisit,
        client.packageBalance,
        relatedText.get(client.id),
        relatedText.get(normalize(client.fullName)),
      ].join(" ");

      return normalize(searchable).includes(query);
    });

    return [...matches].sort((left, right) => {
      if (directorySort === "name") return String(left.fullName).localeCompare(String(right.fullName));
      if (directorySort === "branch") {
        return String(left.branch).localeCompare(String(right.branch)) || String(left.fullName).localeCompare(String(right.fullName));
      }
      return String(right.lastVisit || "").localeCompare(String(left.lastVisit || ""));
    });
  }, [activeDirectoryQuery, appointments, clients, directoryBranch, directorySort, packages]);
  const clientKpis = useMemo(() => {
    const today = todayDate();
    const activeClients = clients.filter((client) => normalize(client.retention) !== "at risk");
    const followUpsDue = clients.filter((client) => {
      const nextVisit = String(client.nextVisit || "");
      return /^\d{4}-\d{2}-\d{2}$/.test(nextVisit) && nextVisit <= today;
    });
    const atRiskClients = clients.filter((client) => normalize(client.retention) === "at risk");

    return [
      {
        label: "Total clients",
        value: clients.length.toLocaleString("en-PH"),
        note: "In the current branch scope",
        icon: Users,
        tone: "products",
      },
      {
        label: "Active clients",
        value: activeClients.length.toLocaleString("en-PH"),
        note: "Currently active relationships",
        icon: UserCheck,
        tone: "value",
      },
      {
        label: "Follow-ups due",
        value: followUpsDue.length.toLocaleString("en-PH"),
        note: "Scheduled on or before today",
        icon: CalendarDays,
        tone: "reorder",
      },
      {
        label: "At risk",
        value: atRiskClients.length.toLocaleString("en-PH"),
        note: "Clients needing attention",
        icon: AlertCircle,
        tone: "empty",
      },
    ];
  }, [clients]);
  const pageSize = safeDirectoryView === "cards" ? 8 : 10;
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const visibleClients = filteredClients.slice((directoryPage - 1) * pageSize, directoryPage * pageSize);
  const visibleStart = filteredClients.length ? (directoryPage - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(directoryPage * pageSize, filteredClients.length);
  const visibleIds = visibleClients.map((client) => client.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedClientIds.has(id));
  const paginationItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, directoryPage - 1, directoryPage, directoryPage + 1, pageCount])]
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((left, right) => left - right);

  useEffect(() => {
    setDirectoryPage(1);
  }, [activeDirectoryQuery, directoryBranch, directorySort, safeDirectoryView]);

  useEffect(() => {
    if (directoryPage > pageCount) setDirectoryPage(pageCount);
  }, [directoryPage, pageCount]);

  useEffect(() => {
    setSelectedClientIds((current) => new Set([...current].filter((id) => clients.some((client) => client.id === id))));
  }, [clients]);

  function openClientProfile(client) {
    setSelectedClientId(client.id);
    if (onOpenClient) onOpenClient(client);
    else setProfileClientId(client.id);
  }

  function toggleVisibleSelection() {
    setSelectedClientIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  function toggleClientSelection(clientId) {
    setSelectedClientIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  async function handleClientImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) {
        notify("The CSV does not contain any client rows.", "warning");
        return;
      }

      const headerKeys = rows[0].map((heading) => normalize(heading).replace(/[^a-z0-9]+/g, ""));
      const records = rows.slice(1).map((row) => {
        const values = Object.fromEntries(headerKeys.map((key, index) => [key, row[index] ?? ""]));
        const fullName = values.name || values.fullname || values.client;
        if (!fullName) return null;
        return {
          id: values.clientid || values.id || "",
          fullName,
          mobile: values.mobile || values.phone || "",
          email: values.email || "",
          branch: values.branch || directoryBranches[1] || "All branches",
          tag: values.type || values.tag || "New",
          retention: values.retention || (normalize(values.type) === "new" ? "New" : "Returning"),
          lastVisit: values.lastvisit || "",
          nextVisit: values.nextvisit || "",
          balance: Number(String(values.balance || "0").replace(/[^0-9.-]+/g, "")) || 0,
          packageBalance: values.package || values.packagebalance || "None",
          consentStatus: values.consentstatus || "Pending",
          source: values.source || "Import",
          marketingOptIn: false,
          giftBalance: 0,
        };
      }).filter(Boolean);

      if (!records.length) {
        notify("No valid clients were found. Include a Name or Full Name column.", "warning");
        return;
      }
      await importClients(records);
    } catch (error) {
      notify(error.message || "Unable to import that CSV file.", "error");
    }
  }

  if (detailClientId) {
    if (!profileClient) return <RecordDetailNotFound label="Client" onBack={onCloseDetail} />;
    return (
      <RecordDetailPageHeader className="client-record-detail-page" label="Clients" title={profileClient.fullName} onBack={onCloseDetail}>
        <ClientProfileDialog
          standalone
          client={profileClient}
          treatments={profileTreatments}
          appointments={profileAppointments}
          transactions={profileTransactions}
          packages={profilePackages}
          consents={profileConsents}
          sensitiveAllowed={sensitiveAllowed}
          onClose={onCloseDetail}
          onEdit={() => openModal("client", profileClient)}
          onAddTreatment={() => openModal("treatment", { clientId: profileClient.id })}
          onAddConsent={() => openModal("consent", { clientId: profileClient.id, branch: profileClient.branch, templateId: consentTemplates.find((item) => item.active)?.id || "" })}
          onDelete={() => deleteClient(profileClient)}
        />
      </RecordDetailPageHeader>
    );
  }

  return (
    <section className="clients-directory-page">
      <div className="surface-panel clients-workspace-panel">
        <div className="clients-workspace-heading">
          <div>
            <h2>Client directory</h2>
            <span>Search, review, and manage every clinic relationship.</span>
          </div>
          <div className="clients-workspace-actions">
            <input
              ref={importInputRef}
              className="client-import-input"
              type="file"
              accept=".csv,text/csv"
              onChange={handleClientImport}
              tabIndex={-1}
            />
            <div className="segmented-control clients-view-toggle" aria-label="Client directory view">
              <button className={safeDirectoryView === "list" ? "active" : ""} type="button" onClick={() => setDirectoryView("list")}>
                <List size={16} aria-hidden="true" /> List
              </button>
              <button className={safeDirectoryView === "cards" ? "active" : ""} type="button" onClick={() => setDirectoryView("cards")}>
                <LayoutGrid size={16} aria-hidden="true" /> Grid
              </button>
            </div>
          </div>
        </div>

        <div className="inventory-kpi-grid clients-kpi-grid" aria-label="Client key performance indicators">
          {clientKpis.map(({ label, value, note, icon: Icon, tone }) => (
            <article className={`inventory-kpi inventory-kpi-${tone}`} key={label}>
              <span className="inventory-kpi-icon" aria-hidden="true"><Icon size={18} /></span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
            </article>
          ))}
        </div>

        {safeDirectoryView === "list" ? (
          <div className="clients-table-wrap">
            <table className="clients-directory-table">
              <thead>
                <tr>
                  <th className="clients-check-column">
                    <input type="checkbox" aria-label="Select visible clients" checked={allVisibleSelected} onChange={toggleVisibleSelection} />
                  </th>
                  <th>Client</th>
                  <th>Client ID</th>
                  <th>Contact</th>
                  <th>Client type</th>
                  <th>Last visit</th>
                  <th>Status</th>
                  <th className="clients-actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((client) => {
                  const isActive = normalize(client.retention) !== "at risk";
                  return (
                    <tr className={selectedClientId === client.id ? "is-current" : ""} key={client.id}>
                      <td className="clients-check-column" data-label="Select">
                        <input type="checkbox" aria-label={`Select ${client.fullName}`} checked={selectedClientIds.has(client.id)} onChange={() => toggleClientSelection(client.id)} />
                      </td>
                      <td data-label="Client">
                        <button className="clients-table-person" type="button" onClick={() => openClientProfile(client)}>
                          <ClientAvatar client={client} size="tiny" />
                          <span><strong>{client.fullName}</strong><small>{client.gender || "Client"} · {client.branch}</small></span>
                        </button>
                      </td>
                      <td data-label="Client ID"><span className="client-id-label">{client.id}</span></td>
                      <td data-label="Contact"><span className="client-contact-cell"><strong>{sensitiveAllowed ? client.mobile : maskMobile(client.mobile)}</strong><small>{sensitiveAllowed ? client.email : "Restricted"}</small></span></td>
                      <td data-label="Client type"><StatusBadge status={client.tag || client.retention || "Client"} /></td>
                      <td data-label="Last visit"><span className="client-visit-cell"><strong>{formatDate(client.lastVisit)}</strong><small>Next: {formatDate(client.nextVisit)}</small></span></td>
                      <td data-label="Status"><StatusBadge status={isActive ? "Active" : "Inactive"} /></td>
                      <td className="clients-actions-column" data-label="Actions">
                        <div className="clients-row-actions">
                          <button className="icon-button" type="button" title="View client" aria-label={`View ${client.fullName}`} onClick={() => openClientProfile(client)}><Eye size={16} /></button>
                          <button className="icon-button" type="button" title="Edit client" aria-label={`Edit ${client.fullName}`} onClick={() => openModal("client", client)}><Edit3 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="clients-card-grid">
            {visibleClients.map((client) => (
              <article className={`clients-directory-card ${selectedClientId === client.id ? "is-current" : ""}`} key={client.id}>
                <button className="clients-card-edit" type="button" aria-label={`Edit ${client.fullName}`} title="Edit client" onClick={() => openModal("client", client)}>
                  <Edit3 size={16} aria-hidden="true" />
                </button>
                <button className="clients-card-open" type="button" onClick={() => openClientProfile(client)}>
                  <span className="clients-card-portrait"><ClientAvatar client={client} size="large" /></span>
                  <span className="clients-card-details">
                    <span className="clients-card-name-line"><strong>{client.fullName}</strong><StatusBadge status={client.tag || client.retention || "Client"} /></span>
                    <span className="clients-card-contact">{sensitiveAllowed ? client.mobile : maskMobile(client.mobile)}</span>
                    <span className="clients-card-meta"><b>{client.branch}</b><i />{client.gender || "Client"}</span>
                    <span className="clients-card-footer"><small>Last visit</small><strong>{formatDate(client.lastVisit)}</strong><ChevronRight size={16} aria-hidden="true" /></span>
                  </span>
                </button>
              </article>
            ))}
          </div>
        )}

        {!visibleClients.length && (
          <div className="clients-empty-state">
            <EmptyState
              title="No clients found"
              copy="Adjust the search, or use Create new in the header."
            />
          </div>
        )}

        <div className="clients-directory-footer">
          <span>Showing {visibleStart} to {visibleEnd} of {filteredClients.length.toLocaleString()} clients</span>
          <nav className="clients-pagination" aria-label="Client directory pages">
            <button type="button" aria-label="Previous page" disabled={directoryPage === 1} onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
            {paginationItems.map((page, index) => (
              <React.Fragment key={page}>
                {index > 0 && page - paginationItems[index - 1] > 1 && <span aria-hidden="true">…</span>}
                <button className={page === directoryPage ? "active" : ""} type="button" aria-current={page === directoryPage ? "page" : undefined} onClick={() => setDirectoryPage(page)}>{page}</button>
              </React.Fragment>
            ))}
            <button type="button" aria-label="Next page" disabled={directoryPage === pageCount} onClick={() => setDirectoryPage((page) => Math.min(pageCount, page + 1))}><ChevronRight size={16} /></button>
          </nav>
        </div>
      </div>

      {profileClient && (
        <ClientProfileDialog
          client={profileClient}
          treatments={profileTreatments}
          appointments={profileAppointments}
          transactions={profileTransactions}
          packages={profilePackages}
          consents={profileConsents}
          sensitiveAllowed={sensitiveAllowed}
          onClose={() => setProfileClientId(null)}
          onEdit={() => {
            setProfileClientId(null);
            openModal("client", profileClient);
          }}
          onAddTreatment={() => {
            setProfileClientId(null);
            openModal("treatment", { clientId: profileClient.id });
          }}
          onAddConsent={() => openModal("consent", { clientId: profileClient.id, branch: profileClient.branch, templateId: consentTemplates.find((item) => item.active)?.id || "" })}
          onDelete={() => {
            setProfileClientId(null);
            deleteClient(profileClient);
          }}
        />
      )}

    </section>
  );
}

function ClientProfileDialog({
  standalone = false,
  client,
  treatments,
  appointments,
  transactions,
  packages,
  consents = [],
  sensitiveAllowed,
  onClose,
  onEdit,
  onAddTreatment,
  onAddConsent,
  onDelete,
}) {
  const profileLabels = [client.tag, client.retention]
    .filter(Boolean)
    .filter((label, index, labels) => labels.findIndex((item) => normalize(item) === normalize(label)) === index)
    .join(" / ");
  const validTransactions = transactions.filter((transaction) => transaction.status !== "Void" && !transaction.testMode);
  const totalSpent = validTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
  const branchesVisited = [...new Set([
    ...splitList(client.branchesVisited),
    client.branch,
    ...appointments.map((item) => item.branch),
    ...treatments.map((item) => item.branch),
    ...validTransactions.map((item) => item.branch),
  ].filter(Boolean))];
  const age = ageFromBirthday(client.birthday);

  const profileContent = (
      <div className={`modal-card client-profile-panel client-profile-modal ${standalone ? "is-standalone" : ""}`}>
        {!standalone && <button className="modal-close" type="button" onClick={onClose} aria-label="Close client details"><X size={18} /></button>}
        <div className="client-profile-modal-layout">
          <div className={`client-profile-image-pane ${client.photo ? "has-photo" : "missing-photo"}`}>
            <ClientAvatar client={client} size="large" />
          </div>
          <div className="client-profile-detail-pane">
            <SectionHeader icon={FileText} title="Client Profile" action={client.consentStatus} />
            <div className="profile-header">
              <div className="profile-identity">
                <div>
                  {profileLabels && <p className="eyebrow">{profileLabels}</p>}
                  <h2>{client.fullName}</h2>
                  <span>{client.treatmentGoals}</span>
                </div>
              </div>
              <div className="button-row client-profile-actions">
                <button className="secondary-button small" type="button" onClick={onEdit}>
                  <Edit3 size={16} /> Edit
                </button>
                <button className="secondary-button small" type="button" onClick={onAddTreatment}>
                  <HeartPulse size={16} /> Add treatment
                </button>
                <button className="secondary-button small" type="button" onClick={onAddConsent}>
                  <FileText size={16} /> Sign consent
                </button>
                <button className="ghost-button small" type="button" onClick={onDelete}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
            <div className="record-grid client-profile-list">
              <RecordItem label="Mobile" value={sensitiveAllowed ? client.mobile : maskMobile(client.mobile)} />
              <RecordItem label="Email" value={sensitiveAllowed ? client.email : "Restricted"} />
              <RecordItem label="Branches visited" value={branchesVisited.join(", ")} />
              <RecordItem label="Total spent since first visit" value={money.format(totalSpent)} />
              <RecordItem label="Date of birth / age" value={client.birthday ? `${formatDate(client.birthday)}${age === null ? "" : ` · ${age} years old`}` : "Not recorded"} />
              <RecordItem label="Civil status" value={client.civilStatus} />
              <RecordItem label="Address" value={[client.street, client.barangay, client.city, client.province].filter(Boolean).join(", ") || client.address} />
              <RecordItem label="Occupation" value={client.occupation} />
              <RecordItem label="Emergency contact" value={[client.emergencyName, client.emergencyPhone].filter(Boolean).join(" · ") || client.emergency} />
              <RecordItem label="Source / referral" value={`${client.source} / ${client.referral}`} />
              <RecordItem label="Allergies" value={sensitiveAllowed ? client.allergies : "Restricted"} />
              <RecordItem label="Contraindications" value={sensitiveAllowed ? client.contraindications : "Restricted"} />
              <RecordItem label="Skin concerns" value={client.skinConcerns} />
              <RecordItem label="Package balance" value={client.packageBalance} />
            </div>
            <div className="dashboard-grid compact client-profile-panels">
              <MiniPanel icon={HeartPulse} title="Treatment history" rows={treatments.map((item) => `${item.date} · ${item.branch || "Branch not recorded"} · ${item.service} · ${item.provider || "Provider N/A"}`)} empty="No treatments yet." />
              <MiniPanel icon={CalendarDays} title="Appointments" rows={appointments.map((item) => `${item.date} ${item.time} · ${item.branch} · ${item.service} · ${item.staff || "Provider N/A"} · ${item.status}`)} empty="No appointments yet." />
              <MiniPanel icon={WalletCards} title="Payments" rows={validTransactions.map((item) => `${item.date} · ${item.branch} · ${item.invoice} · ${money.format(item.total)} · ${item.status}`)} empty="No payments yet." />
              <MiniPanel icon={Gift} title="Packages" rows={packages.map((item) => `${item.name}: ${item.used}/${item.sessions}`)} empty="No active packages." />
              <MiniPanel icon={ShieldCheck} title="Signed consent forms" rows={consents.map((item) => `${formatDateTime(item.signedAt)} · ${item.formName} ${item.formVersion} · ${item.branch} · ${item.witness || "No witness"}`)} empty="No signed consent forms." />
            </div>
          </div>
        </div>
      </div>
  );

  if (standalone) return profileContent;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${client.fullName} details`}>{profileContent}</div>;
}

function prepareTreatmentPhotoDataUrl(file) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file?.type)) {
    return Promise.reject(new Error("Choose a JPEG, PNG, or WebP image."));
  }
  if (file.size > 15 * 1024 * 1024) {
    return Promise.reject(new Error("Choose an image smaller than 15 MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("The selected file is not a valid image."));
      image.onload = () => {
        const maximumDimension = 1500;
        const scale = Math.min(1, maximumDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("This browser could not prepare the image."));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.86;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 1_600_000 && quality > 0.56) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > 1_850_000) return reject(new Error("The image is still too large after optimization."));
        resolve(dataUrl);
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function TreatmentPhotoPanel({ record, onUploadPhoto, onDeletePhoto }) {
  const [kind, setKind] = useState("Clinical");
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [error, setError] = useState("");
  const photoItems = Array.isArray(record.photoItems) ? record.photoItems : [];
  const consentSigned = normalize(record.consent) === "signed";

  async function uploadFiles(event) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length) return;
    if (files.length > 10) {
      setError("Upload up to 10 photos at a time.");
      return;
    }

    setUploading(true);
    setError("");
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const dataUrl = await prepareTreatmentPhotoDataUrl(file);
        await onUploadPhoto(record.id, dataUrl, kind);
        uploadedCount += 1;
      }
    } catch (uploadError) {
      const prefix = uploadedCount ? `${uploadedCount} photo${uploadedCount === 1 ? " was" : "s were"} uploaded. ` : "";
      setError(`${prefix}${uploadError.message || "The remaining photo could not be uploaded."}`);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo) {
    if (!window.confirm(`Remove this ${photo.kind.toLowerCase()} photo from the treatment record?`)) return;
    setRemovingId(photo.id);
    setError("");
    try {
      await onDeletePhoto(record.id, photo.id);
    } catch (removeError) {
      setError(removeError.message || "The photo could not be removed.");
    } finally {
      setRemovingId("");
    }
  }

  return (
    <section className="treatment-photo-manager">
      <div className="treatment-section-heading"><Camera size={17} /><div><strong>Protected documentation</strong><span>Consent and clinical photography</span></div></div>
      <div className="treatment-photo-summary">
        <span><Camera size={20} aria-hidden="true" /></span>
        <div><strong>{photoItems.length} photo{photoItems.length === 1 ? "" : "s"} linked</strong><small>The count updates automatically from uploaded images.</small></div>
      </div>

      {photoItems.length > 0 && (
        <div className="treatment-photo-thumbnails">
          {photoItems.map((photo) => (
            <figure key={photo.id}>
              <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`View ${photo.kind.toLowerCase()} treatment photo`}>
                <img src={photo.url} alt={`${photo.kind} treatment documentation`} />
              </a>
              <figcaption><span>{photo.kind}</span><button type="button" disabled={removingId === photo.id} onClick={() => removePhoto(photo)} aria-label={`Remove ${photo.kind.toLowerCase()} photo`}><Trash2 size={13} />{removingId === photo.id ? "Removing" : "Remove"}</button></figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="treatment-photo-controls">
        <select aria-label="Treatment photo type" value={kind} onChange={(event) => setKind(event.target.value)} disabled={uploading || !consentSigned}>
          {["Before", "After", "Clinical"].map((option) => <option key={option}>{option}</option>)}
        </select>
        <label className={`secondary-button small treatment-photo-upload ${uploading || !consentSigned ? "disabled" : ""}`}>
          <Upload size={15} aria-hidden="true" /> {uploading ? "Uploading..." : "Add photos"}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || !consentSigned} onChange={uploadFiles} />
        </label>
      </div>
      {!consentSigned && <p className="treatment-photo-hint">Client consent must be signed before clinical photos can be uploaded.</p>}
      {error && <p className="treatment-photo-error" role="alert">{error}</p>}
      <div className="treatment-consent-row"><span>Client consent</span><StatusBadge status={record.consent || "Pending"} /></div>
    </section>
  );
}

function TreatmentsModule({ detailTreatmentId = "", treatments, clients, openModal, globalSearch, onUploadPhoto, onDeletePhoto, onOpenTreatment, onCloseDetail }) {
  const [filter, setFilter] = useState("All records");
  const [provider, setProvider] = useState("All providers");
  const [selectedId, setSelectedId] = useState(treatments[0]?.id ?? "");
  const today = todayDate();
  const providers = useMemo(
    () => [...new Set(treatments.map((record) => record.provider).filter(Boolean))].sort(),
    [treatments],
  );
  const followUpDue = useCallback(
    (record) => Boolean(record.followUp && record.followUp <= today),
    [today],
  );
  const filteredTreatments = useMemo(() => {
    const terms = [globalSearch]
      .map((value) => normalize(value).trim())
      .filter(Boolean);

    return [...treatments]
      .filter((record) => {
        const searchable = normalize([
          record.client,
          record.service,
          record.provider,
          record.room,
          record.batch,
          record.preNotes,
          record.postNotes,
          record.outcome,
        ].join(" "));
        const matchesQuery = terms.every((term) => searchable.includes(term));
        const matchesProvider = provider === "All providers" || record.provider === provider;
        const matchesFilter =
          filter === "All records"
          || (filter === "Follow-up due" && followUpDue(record))
          || (filter === "Consent pending" && normalize(record.consent) !== "signed")
          || (filter === "Photos linked" && Number(record.photos || 0) > 0);
        return matchesQuery && matchesProvider && matchesFilter;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [filter, followUpDue, globalSearch, provider, treatments]);

  useEffect(() => {
    if (filteredTreatments.some((record) => record.id === selectedId)) return;
    setSelectedId(filteredTreatments[0]?.id ?? "");
  }, [filteredTreatments, selectedId]);

  const selectedRecord = treatments.find((record) => record.id === detailTreatmentId)
    ?? filteredTreatments.find((record) => record.id === selectedId)
    ?? filteredTreatments[0];
  const resetFilters = () => {
    setFilter("All records");
    setProvider("All providers");
  };

  if (detailTreatmentId) {
    if (!selectedRecord) return <RecordDetailNotFound label="Treatment record" onBack={onCloseDetail} />;
    return (
      <RecordDetailPageHeader label="Treatments" title={selectedRecord.service || selectedRecord.client} onBack={onCloseDetail}>
        <TreatmentRecordPage
          record={selectedRecord}
          client={clients.find((item) => item.id === selectedRecord.clientId)}
          followUpDue={followUpDue(selectedRecord)}
          onEdit={() => openModal("treatment", selectedRecord)}
          onUploadPhoto={onUploadPhoto}
          onDeletePhoto={onDeletePhoto}
        />
      </RecordDetailPageHeader>
    );
  }

  return (
    <section className="treatments-workspace">
      <div className="surface-panel treatments-workbench">
        {!treatments.length ? (
          <div className="treatments-collection-empty">
            <span><HeartPulse size={24} aria-hidden="true" /></span>
            <strong>No treatment records yet</strong>
            <p>Records created by your clinic will appear here.</p>
            <button className="primary-button" type="button" onClick={() => openModal("treatment")}>
              <Plus size={17} aria-hidden="true" /> Add treatment
            </button>
          </div>
        ) : (
          <>
          <div className="treatments-toolbar">
          <label className="treatments-select">
            <span>Provider</span>
            <select aria-label="Filter by provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option>All providers</option>
              {providers.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <div className="treatments-filter-tabs" aria-label="Treatment record filters">
            {["All records", "Follow-up due", "Consent pending", "Photos linked"].map((option) => (
              <button className={filter === option ? "active" : ""} key={option} type="button" onClick={() => setFilter(option)}>{option}</button>
            ))}
          </div>
          </div>

          <div className="treatments-workbench-grid">
          <aside className="treatments-index" aria-label="Treatment record list">
            <div className="treatments-index-heading">
              <div><strong>Clinical records</strong><span>{filteredTreatments.length} of {treatments.length}</span></div>
              {(filter !== "All records" || provider !== "All providers") && <button type="button" onClick={resetFilters}>Clear filters</button>}
            </div>
            <div className="treatments-index-list">
              {filteredTreatments.map((record) => {
                const client = clients.find((item) => item.id === record.clientId);
                const isSelected = record.id === selectedRecord?.id;
                return (
                  <button className={`treatment-index-item ${isSelected ? "selected" : ""}`} key={record.id} type="button" onClick={() => onOpenTreatment ? onOpenTreatment(record) : setSelectedId(record.id)} aria-pressed={isSelected}>
                    <ClientAvatar client={client || { fullName: record.client }} size="small" />
                    <span className="treatment-index-copy">
                      <strong>{record.client || "Unlinked client"}</strong>
                      <b>{record.service || "Treatment record"}</b>
                      <small>{record.provider || "Provider not set"} · {record.room || "Room not set"}</small>
                    </span>
                    <span className="treatment-index-date">
                      <strong>{formatDate(record.date)}</strong>
                      <small className={followUpDue(record) ? "due" : ""}>{followUpDue(record) ? "Follow-up due" : normalize(record.consent) === "signed" ? "Consent signed" : "Consent pending"}</small>
                    </span>
                  </button>
                );
              })}
              {!filteredTreatments.length && (
                <div className="treatments-empty">
                  <Filter size={22} aria-hidden="true" />
                  <strong>No matching records</strong>
                  <span>Try another client, provider, or clinical status.</span>
                  <button className="secondary-button small" type="button" onClick={resetFilters}>Clear filters</button>
                </div>
              )}
            </div>
          </aside>

          <main className="treatment-detail" aria-live="polite">
            {selectedRecord ? (
              <>
                <div className="treatment-detail-header">
                  <div>
                    <span className="treatment-record-id">Record · {selectedRecord.id}</span>
                    <h3>{selectedRecord.service || "Treatment record"}</h3>
                    <p>{selectedRecord.client} · {formatDate(selectedRecord.date)}</p>
                  </div>
                  <div className="treatment-detail-actions">
                    <StatusBadge status={selectedRecord.consent || "Pending"} />
                    <button className="secondary-button small" type="button" onClick={() => onOpenTreatment ? onOpenTreatment(selectedRecord) : openModal("treatment", selectedRecord)}><Eye size={15} /> Open record</button>
                  </div>
                </div>

                <div className="treatment-clinical-summary">
                  <article><span>Provider</span><strong>{selectedRecord.provider || "Not assigned"}</strong></article>
                  <article><span>Treatment room</span><strong>{selectedRecord.room || "Not recorded"}</strong></article>
                  <article><span>Follow-up</span><strong className={followUpDue(selectedRecord) ? "due" : ""}>{selectedRecord.followUp ? formatDate(selectedRecord.followUp) : "Not scheduled"}</strong></article>
                  <article><span>Client feedback</span><strong>{selectedRecord.satisfaction || "Not recorded"}</strong></article>
                  <article><span>Total visit duration</span><strong>{treatmentVisitDuration(selectedRecord)}</strong></article>
                </div>

                <div className="treatment-note-grid">
                  <section>
                    <div><ClipboardCheck size={17} /><strong>Pre-treatment assessment</strong></div>
                    <p>{selectedRecord.preNotes || "No pre-treatment assessment was recorded."}</p>
                  </section>
                  <section>
                    <div><Activity size={17} /><strong>Outcome & clinical notes</strong></div>
                    <p>{selectedRecord.outcome || selectedRecord.postNotes || "No outcome notes were recorded."}</p>
                  </section>
                </div>

                <div className="treatment-documentation-grid">
                  <section>
                    <div className="treatment-section-heading"><FileText size={17} /><div><strong>Procedure traceability</strong><span>Products, devices, and lot details</span></div></div>
                    <dl>
                      <div><dt>Consumables</dt><dd>{selectedRecord.consumables || "None recorded"}</dd></div>
                      <div><dt>Device settings</dt><dd>{selectedRecord.deviceSettings || "Not applicable"}</dd></div>
                      <div><dt>Lot / batch</dt><dd>{selectedRecord.batch || "Not recorded"}</dd></div>
                    </dl>
                  </section>
                  <TreatmentPhotoPanel key={selectedRecord.id} record={selectedRecord} onUploadPhoto={onUploadPhoto} onDeletePhoto={onDeletePhoto} />
                </div>

                <div className={`treatment-followup-banner ${followUpDue(selectedRecord) ? "due" : ""}`}>
                  <CalendarDays size={19} aria-hidden="true" />
                  <div>
                    <strong>{selectedRecord.followUp ? (followUpDue(selectedRecord) ? "Follow-up requires attention" : "Follow-up scheduled") : "No follow-up scheduled"}</strong>
                    <span>{selectedRecord.followUp ? `${formatDate(selectedRecord.followUp)} · ${selectedRecord.postNotes || "Review the client's response and aftercare."}` : "Add a follow-up date when continued care is required."}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="treatments-detail-empty"><HeartPulse size={30} /><strong>Select a treatment record</strong><span>Clinical details will appear here.</span></div>
            )}
          </main>
          </div>
          </>
        )}
      </div>
    </section>
  );
}

function TreatmentRecordPage({ record, client, followUpDue, onEdit, onUploadPhoto, onDeletePhoto }) {
  return (
    <section className="surface-panel treatment-detail treatment-record-page">
      <div className="treatment-detail-header">
        <div className="record-detail-identity">
          <ClientAvatar client={client || { fullName: record.client }} size="large" />
          <div>
            <span className="treatment-record-id">Record · {record.id}</span>
            <h3>{record.service || "Treatment record"}</h3>
            <p>{record.client} · {formatDate(record.date)}</p>
          </div>
        </div>
        <div className="treatment-detail-actions">
          <StatusBadge status={record.consent || "Pending"} />
          <button className="secondary-button small" type="button" onClick={onEdit}><Edit3 size={15} /> Edit record</button>
        </div>
      </div>

      <div className="treatment-clinical-summary">
        <article><span>Provider</span><strong>{record.provider || "Not assigned"}</strong></article>
        <article><span>Treatment room</span><strong>{record.room || "Not recorded"}</strong></article>
        <article><span>Follow-up</span><strong className={followUpDue ? "due" : ""}>{record.followUp ? formatDate(record.followUp) : "Not scheduled"}</strong></article>
        <article><span>Client feedback</span><strong>{record.satisfaction || "Not recorded"}</strong></article>
        <article><span>Total visit duration</span><strong>{treatmentVisitDuration(record)}</strong></article>
      </div>

      <div className="treatment-note-grid">
        <section><div><ClipboardCheck size={17} /><strong>Pre-treatment assessment</strong></div><p>{record.preNotes || "No pre-treatment assessment was recorded."}</p></section>
        <section><div><Activity size={17} /><strong>Outcome & clinical notes</strong></div><p>{record.outcome || record.postNotes || "No outcome notes were recorded."}</p></section>
        <section><div><HeartPulse size={17} /><strong>Aftercare instructions</strong></div><p>{record.aftercare || "No service aftercare instructions were recorded."}</p></section>
      </div>

      <div className="treatment-documentation-grid">
        <section>
          <div className="treatment-section-heading"><FileText size={17} /><div><strong>Procedure traceability</strong><span>Products, devices, and lot details</span></div></div>
          <dl>
            <div><dt>Consumables</dt><dd>{record.consumables || "None recorded"}</dd></div>
            <div><dt>Device settings</dt><dd>{record.deviceSettings || "Not applicable"}</dd></div>
            <div><dt>Lot / batch</dt><dd>{record.batch || "Not recorded"}</dd></div>
          </dl>
        </section>
        <TreatmentPhotoPanel key={record.id} record={record} onUploadPhoto={onUploadPhoto} onDeletePhoto={onDeletePhoto} />
      </div>

      <div className={`treatment-followup-banner ${followUpDue ? "due" : ""}`}>
        <CalendarDays size={19} aria-hidden="true" />
        <div>
          <strong>{record.followUp ? (followUpDue ? "Follow-up requires attention" : "Follow-up scheduled") : "No follow-up scheduled"}</strong>
          <span>{record.followUp ? `${formatDate(record.followUp)} · ${record.postNotes || "Review the client's response and aftercare."}` : "Add a follow-up date when continued care is required."}</span>
        </div>
      </div>
    </section>
  );
}

function ServicesModule({ services, openModal, toggleService, globalSearch }) {
  const [category, setCategory] = useState("All");
  const [catalogView, setCatalogView] = useState("list");
  const normalizedServiceQuery = globalSearch.trim().toLowerCase();
  const filtered = services.filter((service) => {
    const matchesCategory = category === "All" || service.category === category;
    const matchesSearch =
      !normalizedServiceQuery ||
      [service.name, service.category, service.room, service.description]
        .some((value) => String(value ?? "").toLowerCase().includes(normalizedServiceQuery));

    return matchesCategory && matchesSearch;
  });

  return (
    <section className="module-grid">
      <div className="surface-panel">
        <SectionHeader icon={Sparkles} title="Service Catalog" action={`${filtered.length} services`} />
        <div className="toolbar-row service-catalog-toolbar">
          <label className="service-category-filter">
            <Filter className="service-category-filter-icon" size={15} aria-hidden="true" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter services by category">
              <option>All</option>
              {serviceCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <ChevronDown className="service-category-filter-chevron" size={15} aria-hidden="true" />
          </label>
          <div className="segmented-control service-view-toggle" aria-label="Service catalog view">
            <button
              className={catalogView === "list" ? "active" : ""}
              type="button"
              onClick={() => setCatalogView("list")}
            >
              <List size={15} aria-hidden="true" /> List
            </button>
            <button
              className={catalogView === "grid" ? "active" : ""}
              type="button"
              onClick={() => setCatalogView("grid")}
            >
              <LayoutGrid size={15} aria-hidden="true" /> Grid
            </button>
          </div>
        </div>
        <div className={`service-grid management ${catalogView === "list" ? "list-view" : "grid-view"}`}>
          {filtered.map((service) => (
            <article className="service-card management-card" key={service.id}>
              <span>{service.category}</span>
              <strong>{service.name}</strong>
              <small>{service.duration} min / {service.room}</small>
              <b>{servicePriceLabel(service)}</b>
              <p>{service.description}</p>
              <div className="inline-actions">
                <button type="button" onClick={() => openModal("service", service)}><Edit3 size={15} /> Edit</button>
                <button type="button" onClick={() => toggleService(service.id)}>{service.active ? "Deactivate" : "Activate"}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function InventoryModule({ inventory, movements, openModal, globalSearch }) {
  const lowStock = inventory.filter((item) => stockStatus(item) !== "Healthy");
  const outOfStock = inventory.filter((item) => Number(item.stock || 0) <= 0);
  const inventoryValue = inventory.reduce(
    (total, item) => total + (Number(item.stock || 0) * Number(item.cost || 0)),
    0,
  );
  const inventoryKpis = [
    {
      label: "Products",
      value: inventory.length.toLocaleString("en-PH"),
      note: "In the current branch scope",
      icon: Boxes,
      tone: "products",
    },
    {
      label: "Inventory value",
      value: money.format(inventoryValue),
      note: "Based on recorded unit cost",
      icon: CircleDollarSign,
      tone: "value",
    },
    {
      label: "Reorder alerts",
      value: lowStock.length.toLocaleString("en-PH"),
      note: "At or below reorder level",
      icon: AlertCircle,
      tone: "reorder",
    },
    {
      label: "Out of stock",
      value: outOfStock.length.toLocaleString("en-PH"),
      note: "Needs replenishment",
      icon: Minus,
      tone: "empty",
    },
  ];

  return (
    <section className="module-grid two">
      <div className="surface-panel full-span inventory-management-panel">
        <SectionHeader icon={Boxes} title="Inventory Management" action={`${lowStock.length} alerts`} />
        <div className="inventory-kpi-grid" aria-label="Inventory key performance indicators">
          {inventoryKpis.map(({ label, value, note, icon: Icon, tone }) => (
            <article className={`inventory-kpi inventory-kpi-${tone}`} key={label}>
              <span className="inventory-kpi-icon" aria-hidden="true"><Icon size={18} /></span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
            </article>
          ))}
        </div>
        <SmartTable
          rows={inventory}
          globalSearch={globalSearch}
          showToolbar={false}
          showStatus={false}
          selectable={false}
          columns={[
            { key: "photo", label: "Photo", className: "inventory-col-photo inventory-col-center", sortable: false, render: (row) => <ProductThumbnail item={row} />, exportValue: () => "" },
            { key: "item", label: "Item", className: "inventory-col-item", render: (row) => <strong className="inventory-product-name">{row.item}</strong> },
            { key: "category", label: "Category", className: "inventory-col-category" },
            { key: "branch", label: "Branch", className: "inventory-col-branch" },
            { key: "stock", label: "Stock", className: "inventory-col-stock inventory-col-center", render: (row) => `${row.stock} ${row.unit}` },
            { key: "status", label: "Status", className: "inventory-col-status inventory-col-center", render: (row) => <StatusBadge status={stockStatus(row)} /> },
            {
              key: "actions",
              label: "Actions",
              className: "inventory-col-actions inventory-col-center",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => openModal("inventory-receive", { inventoryId: row.id, unit: row.unit, supplier: row.supplier })}><PackagePlus size={15} /> Receive</button>
                  <button type="button" onClick={() => openModal("inventory", row)}><Edit3 size={15} /> Edit</button>
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={RefreshCw} title="Stock & Delivery History" action="Audit ready" />
        <SmartTable
          rows={movements}
          pageSize={5}
          emptyTitle="No inventory movement yet"
          columns={[
            { key: "date", label: "Date" },
            { key: "item", label: "Item" },
            { key: "branch", label: "Branch" },
            { key: "qty", label: "Qty" },
            { key: "unit", label: "Unit" },
            { key: "supplier", label: "Supplier" },
            { key: "receivedBy", label: "Received by" },
            { key: "checkNumber", label: "Check no." },
            { key: "reason", label: "Reason" },
            { key: "user", label: "User" },
          ]}
        />
      </div>
    </section>
  );
}

function PackagesModule({ packages, giftCertificates = [], clients, openModal, redeemPackage, globalSearch }) {
  const [giftCertificateQuery, setGiftCertificateQuery] = useState("");
  const normalizedGiftCertificateQuery = giftCertificateQuery.trim().toLowerCase();
  const normalizedPackageQuery = globalSearch.trim().toLowerCase();
  const visiblePackages = normalizedPackageQuery
    ? packages.filter((pkg) => [pkg.id, pkg.name, pkg.client, pkg.service, pkg.status]
      .some((value) => String(value || "").toLowerCase().includes(normalizedPackageQuery)))
    : packages;
  const combinedGiftCertificateQuery = [normalizedGiftCertificateQuery, normalizedPackageQuery].filter(Boolean);
  const visibleGiftCertificates = combinedGiftCertificateQuery.length
    ? giftCertificates.filter((certificate) => combinedGiftCertificateQuery.every((term) => [certificate.code, certificate.client, certificate.service, certificate.status]
      .some((value) => String(value || "").toLowerCase().includes(term))))
    : giftCertificates;
  const exactGiftCertificate = normalizedGiftCertificateQuery
    ? giftCertificates.find((certificate) => String(certificate.code || "").trim().toLowerCase() === normalizedGiftCertificateQuery)
    : null;
  const giftCertificateStatus = (certificate) => {
    if (certificate.status !== "Active") return certificate.status;
    if (certificate.expires && certificate.expires < todayDate()) return "Expired";
    if (Number(certificate.balance || 0) <= 0) return "Redeemed";
    return "Active";
  };

  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={Gift} title="Packages and Sessions" action={`${visiblePackages.length} packages`} />
        <div className="package-list">
          {visiblePackages.map((pkg) => (
            <article className="package-card" key={pkg.id}>
              <strong>{pkg.name}</strong>
              <span>{pkg.client}</span>
              <div className="session-meter">
                <span style={{ width: `${Math.max(8, (Number(pkg.used) / Number(pkg.sessions)) * 100)}%` }} />
              </div>
              <small>{pkg.used} used / {pkg.sessions} sessions / {pkg.expires ? `expires ${formatDate(pkg.expires)}` : "no expiration"}</small>
              <small>{money.format(pkg.amountPaid || 0)} paid · {money.format(pkg.outstandingBalance ?? Math.max(0, Number(pkg.price || 0) - Number(pkg.amountPaid || 0)))} outstanding · {money.format(pkg.serviceValue || 0)} / session</small>
              <details className="package-history-details">
                <summary>Payment & session history</summary>
                <div>
                  {(pkg.paymentHistory || []).slice(-3).map((entry, index) => <span key={`payment-${index}`}>{formatDate(entry.date)} · {money.format(entry.amount)} · {entry.method || "Payment"}</span>)}
                  {(pkg.sessionHistory || []).slice(-3).map((entry, index) => <span key={`session-${index}`}>{formatDate(entry.date)} · {entry.sessions > 0 ? "+" : ""}{entry.sessions} session · {entry.branch || pkg.branch}</span>)}
                  {!pkg.paymentHistory?.length && !pkg.sessionHistory?.length && <span>No package activity recorded yet.</span>}
                </div>
              </details>
              <div className="inline-actions">
                <button type="button" onClick={() => redeemPackage(pkg.id)}>Redeem session</button>
                {Number(pkg.outstandingBalance ?? Math.max(0, Number(pkg.price || 0) - Number(pkg.amountPaid || 0))) > 0 && (
                  <button type="button" onClick={() => openModal("package-payment", pkg)}><HandCoins size={15} /> Record installment</button>
                )}
                <button type="button" onClick={() => openModal("package", pkg)}><Edit3 size={15} /> Edit</button>
              </div>
            </article>
          ))}
          {!visiblePackages.length && <EmptyState title="No matching packages" copy="Try another search in the page header." />}
        </div>
      </div>
      <div className="surface-panel">
        <SectionHeader icon={CreditCard} title="Gift Certificates" action="Cross-branch" />
        <button className="primary-button small" type="button" onClick={() => openModal("gift-certificate")}><Plus size={16} /> Issue certificate</button>
        <label className="gift-certificate-checker">
          <span>Check certificate number</span>
          <div><Search size={16} aria-hidden="true" /><input type="search" value={giftCertificateQuery} onChange={(event) => setGiftCertificateQuery(event.target.value)} placeholder="Enter or scan gift certificate number" /></div>
        </label>
        {normalizedGiftCertificateQuery && exactGiftCertificate && (
          <div className={`gift-certificate-check-result ${giftCertificateStatus(exactGiftCertificate).toLowerCase().replace(/\s+/g, "-")}`} role="status">
            <div><strong>{exactGiftCertificate.code}</strong><span>{exactGiftCertificate.client}</span></div>
            <StatusBadge status={giftCertificateStatus(exactGiftCertificate)} />
            <small>{exactGiftCertificate.type === "Specific Service" ? exactGiftCertificate.service : `${money.format(exactGiftCertificate.balance)} remaining`} · {exactGiftCertificate.expires ? `valid until ${formatDate(exactGiftCertificate.expires)}` : "no expiration"}</small>
          </div>
        )}
        {normalizedGiftCertificateQuery && !visibleGiftCertificates.length && <div className="inline-state warning"><AlertCircle size={16} />No gift certificate matches that number.</div>}
        <div className="stock-list">
          {visibleGiftCertificates.map((gc) => (
            <article className="stock-row" key={gc.id}>
              <div>
                <strong>{gc.code}</strong>
                <span>{gc.client} · issued {formatDate(gc.issueDate)} · {gc.expires ? `expires ${formatDate(gc.expires)}` : "no expiration"}</span>
                {gc.redeemedDate && <small>Redeemed {formatDate(gc.redeemedDate)} at {gc.redeemedBranch} · transaction {gc.transactionId}</small>}
              </div>
              <div className="gift-certificate-row-actions"><StatusBadge status={giftCertificateStatus(gc)} /><b>{gc.type === "Specific Service" ? gc.service : money.format(gc.balance)}</b><button type="button" onClick={() => openModal("gift-certificate", gc)}><Edit3 size={14} /> Edit</button></div>
            </article>
          ))}
        </div>
        <div className="note-strip">
          <Star size={18} />
          <span>Packages and gift certificates are structured for cross-branch redemption.</span>
        </div>
      </div>
      <div className="surface-panel full-span">
        <SmartTable
          rows={packages}
          globalSearch={globalSearch}
          columns={[
            { key: "name", label: "Package" },
            { key: "client", label: "Client" },
            { key: "sessions", label: "Sessions", render: (row) => `${row.used}/${row.sessions}` },
            { key: "expires", label: "Expiration", render: (row) => row.expires ? formatDate(row.expires) : "No expiration" },
            { key: "branch", label: "Branch" },
            { key: "price", label: "Price", render: (row) => money.format(row.price) },
            { key: "amountPaid", label: "Paid", render: (row) => money.format(row.amountPaid || 0) },
            { key: "outstandingBalance", label: "Balance", render: (row) => money.format(row.outstandingBalance ?? Math.max(0, Number(row.price || 0) - Number(row.amountPaid || 0))) },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </div>
    </section>
  );
}

function LeadsModule({
  detailLeadId = "",
  leads,
  clients,
  appointments,
  services,
  staff,
  branches,
  integrations,
  webhookEvents,
  openModal,
  importLeads,
  deleteLead,
  updateStatus,
  addActivity,
  scheduleFollowUp,
  bookAppointment,
  convertLead,
  mergeLead,
  refreshOperations,
  globalSearch,
  isBooting,
  notify,
  onOpenLead,
  onCloseDetail,
}) {
  const [storedTab, setStoredTab] = useStoredState("leads-directory-tab", "all");
  const [filters, setFilters] = useState({ source: "All", branch: "All", owner: "All", priority: "All", followUp: "All" });
  const [showFilters, setShowFilters] = useState(false);
  const [showCaptureSources, setShowCaptureSources] = useState(false);
  const [sort, setSort] = useState({ key: "created", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useStoredState("selected-lead", leads[0]?.id ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailFocus, setDetailFocus] = useState("");
  const [actionMenu, setActionMenu] = useState(null);
  const [quickAction, setQuickAction] = useState(null);
  const [quickActionValue, setQuickActionValue] = useState("");
  const [quickActionOwner, setQuickActionOwner] = useState("Unassigned");
  const [isImporting, setIsImporting] = useState(false);
  const [lossReason, setLossReason] = useState("No response");
  const [quickNote, setQuickNote] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState({ dueAt: "", channel: "Phone", purpose: "Follow up lead", notes: "" });
  const [bookingDraft, setBookingDraft] = useState({ serviceId: services[0]?.id ?? "", date: todayDate(), time: "10:00", branch: branches[0]?.name ?? "", staff: staff[0]?.name ?? "", room: "To assign", deposit: 0 });
  const [conversionNotes, setConversionNotes] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const importInputRef = useRef(null);
  const activeTab = leadDirectoryTabs.some((tab) => tab.id === storedTab) ? storedTab : "all";
  const activeTabConfig = leadDirectoryTabs.find((tab) => tab.id === activeTab) ?? leadDirectoryTabs[0];
  const pageSize = 20;

  const normalizedLeads = useMemo(
    () => leads.map((lead) => ({ ...lead, status: canonicalLeadStatus(lead.status), slaState: lead.slaState || leadSlaState(lead) })),
    [leads],
  );
  const sourceOptions = useMemo(() => ["All", ...new Set(normalizedLeads.map((lead) => lead.source).filter(Boolean))], [normalizedLeads]);
  const branchOptions = useMemo(() => ["All", ...new Set([...branches.map((branch) => branch.name), ...normalizedLeads.map((lead) => lead.branch)].filter(Boolean))], [branches, normalizedLeads]);
  const ownerOptions = useMemo(() => ["All", "Unassigned", ...new Set([...staff.map((person) => person.name), ...normalizedLeads.map((lead) => lead.owner)].filter(Boolean))], [normalizedLeads, staff]);

  const filteredLeads = useMemo(() => {
    const query = normalize(globalSearch.trim());
    const matches = normalizedLeads.filter((lead) => {
      if (activeTabConfig.statuses && !activeTabConfig.statuses.includes(lead.status)) return false;
      if (filters.source !== "All" && lead.source !== filters.source) return false;
      if (filters.branch !== "All" && lead.branch !== filters.branch) return false;
      if (filters.owner === "Unassigned" && lead.owner) return false;
      if (filters.owner !== "All" && filters.owner !== "Unassigned" && lead.owner !== filters.owner) return false;
      if (filters.priority !== "All" && lead.priority !== filters.priority) return false;
      if (filters.followUp !== "All" && leadFollowUpState(lead) !== filters.followUp) return false;
      if (!query) return true;
      return [lead.name, lead.mobile, lead.email, lead.externalLeadId, lead.campaign, lead.utmCampaign, lead.interest, lead.interestedTreatment, lead.interestedPackage, lead.owner, lead.source, lead.branch]
        .some((value) => normalize(value).includes(query));
    });

    function sortValue(lead) {
      if (sort.key === "service") return lead.interest || lead.interestedTreatment || lead.interestedPackage || "";
      if (sort.key === "followUp") return lead.nextFollowUpAt || "9999";
      if (sort.key === "owner") return lead.owner || "Unassigned";
      if (sort.key === "source") return `${lead.source || ""} ${lead.campaign || lead.utmCampaign || ""}`;
      if (sort.key === "contact") return `${lead.mobile || ""} ${lead.email || ""}`;
      return lead[sort.key] || "";
    }

    return [...matches].sort((left, right) => {
      const leftValue = normalize(sortValue(left));
      const rightValue = normalize(sortValue(right));
      const comparison = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [activeTabConfig.statuses, filters, globalSearch, normalizedLeads, sort]);

  const selectedLead = detailLeadId
    ? normalizedLeads.find((lead) => lead.id === detailLeadId) ?? null
    : normalizedLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? normalizedLeads[0];
  const menuLead = actionMenu ? normalizedLeads.find((lead) => lead.id === actionMenu.leadId) : null;
  const quickActionLead = quickAction ? normalizedLeads.find((lead) => lead.id === quickAction.leadId) : null;
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const visibleLeads = filteredLeads.slice((page - 1) * pageSize, page * pageSize);
  const visibleStart = filteredLeads.length ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(page * pageSize, filteredLeads.length);
  const paginationItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, page - 1, page, page + 1, pageCount])]
      .filter((item) => item >= 1 && item <= pageCount)
      .sort((left, right) => left - right);
  const activeFilterCount = Object.values(filters).filter((value) => value !== "All").length;
  const exportColumns = [
    { key: "name", label: "Lead" },
    { key: "mobile", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "interest", label: "Interested Service", exportValue: (lead) => lead.interest || lead.interestedTreatment || lead.interestedPackage || "" },
    { key: "source", label: "Source" },
    { key: "campaign", label: "Campaign", exportValue: (lead) => lead.campaign || lead.utmCampaign || "" },
    { key: "status", label: "Status" },
    { key: "nextFollowUpAt", label: "Next Follow-up" },
    { key: "owner", label: "Owner" },
    { key: "branch", label: "Branch" },
  ];

  useEffect(() => {
    setPage(1);
  }, [activeTab, filters, globalSearch]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (selectedLead?.id) {
      setLossReason(selectedLead.lossReason || "No response");
      setFollowUpDraft({
        dueAt: toDateTimeLocalValue(selectedLead.nextFollowUpAt),
        channel: selectedLead.preferredChannel || "Phone",
        purpose: selectedLead.nextAction || selectedLead.nextStep || "Follow up lead",
        notes: selectedLead.nextStep || "",
      });
      setBookingDraft((current) => ({
        ...current,
        serviceId: services.find((service) => service.name === selectedLead.interest)?.id || services[0]?.id || "",
        date: selectedLead.preferredDate || todayDate(),
        time: selectedLead.preferredTime || "10:00",
        branch: selectedLead.branch || branches[0]?.name || "",
        staff: selectedLead.owner || staff[0]?.name || "",
      }));
      setQuickNote("");
      setConversionNotes("");
    }
  }, [branches, selectedLead?.id, selectedLead?.branch, selectedLead?.interest, selectedLead?.lossReason, selectedLead?.nextAction, selectedLead?.nextFollowUpAt, selectedLead?.nextStep, selectedLead?.owner, selectedLead?.preferredChannel, selectedLead?.preferredDate, selectedLead?.preferredTime, services, staff]);

  useEffect(() => {
    if (!actionMenu) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest?.(".lead-action-menu")) setActionMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActionMenu(null);
    };
    const closeOnViewportChange = () => setActionMenu(null);
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [actionMenu]);

  async function runLeadAction(label, action) {
    setBusyAction(label);
    try {
      await action();
    } finally {
      setBusyAction("");
    }
  }

  async function changeStage(lead, status, extra = {}) {
    const nextStatus = canonicalLeadStatus(status);
    if (nextStatus === "Appointment Booked" && !lead.linkedAppointmentId) {
      setSelectedLeadId(lead.id);
      setDetailFocus("booking");
      setDetailsOpen(true);
      setActionMenu(null);
      notify("Add the appointment details, then select Book Appointment.", "warning");
      return;
    }
    const payload = nextStatus === "Lost" ? { lossReason: lossReason || "No response", ...extra } : extra;
    await updateStatus(lead.id, nextStatus, payload);
    setSelectedLeadId(lead.id);
  }

  function resetLeadFilters() {
    setFilters({ source: "All", branch: "All", owner: "All", priority: "All", followUp: "All" });
  }

  function toggleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function openLeadDetails(lead) {
    setSelectedLeadId(lead.id);
    setDetailFocus("");
    if (onOpenLead) onOpenLead(lead);
    else setDetailsOpen(true);
    setActionMenu(null);
  }

  function openLeadActionMenu(event, lead) {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const width = 204;
    setActionMenu((current) => current?.leadId === lead.id ? null : {
      leadId: lead.id,
      top: Math.min(bounds.bottom + 7, window.innerHeight - 302),
      left: Math.max(10, Math.min(bounds.right - width, window.innerWidth - width - 10)),
    });
  }

  function openQuickAction(type, lead) {
    setSelectedLeadId(lead.id);
    setQuickAction({ type, leadId: lead.id });
    setQuickActionValue("");
    setQuickActionOwner(lead.owner || "Unassigned");
    setActionMenu(null);
  }

  async function submitQuickAction(event) {
    event.preventDefault();
    if (!quickActionLead || !quickAction) return;

    try {
      if (quickAction.type === "assign") {
        const owner = quickActionOwner === "Unassigned" ? "" : quickActionOwner;
        const assignedStaffId = staff.find((person) => person.name === owner)?.id || "";
        await runLeadAction("assign", () => updateStatus(quickActionLead.id, quickActionLead.status, { owner, assignedStaffId }));
      } else if (quickAction.type === "note") {
        if (!quickActionValue.trim()) return;
        await runLeadAction("note", () => addActivity(quickActionLead.id, { type: "Note", title: "Internal note", note: quickActionValue.trim() }));
      } else if (quickAction.type === "convert") {
        await runLeadAction("convert", () => convertLead(quickActionLead.id, { notes: quickActionValue.trim() }));
      }
      setQuickAction(null);
    } catch {
      // The API action already reports a user-facing error.
    }
  }

  async function handleLeadImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      let rows;
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        rows = await readXlsxFile(file);
      } else {
        rows = parseCsvRows(await file.text());
      }

      if (!Array.isArray(rows) || rows.length < 2) {
        notify("The file does not contain any lead rows.", "warning");
        return;
      }

      const headerKeys = rows[0].map((heading) => normalize(heading).replace(/[^a-z0-9]+/g, ""));
      const records = rows.slice(1).map((row) => {
        const values = Object.fromEntries(headerKeys.map((key, index) => {
          const cell = row[index];
          return [key, cell instanceof Date ? cell.toISOString() : String(cell ?? "").trim()];
        }));
        const name = values.name || values.lead || values.fullname;
        if (!name) return null;
        const permissionValue = normalize(values.permissiontocontact || values.contactpermission || "yes");
        return {
          id: values.leadid || values.id || "",
          name,
          mobile: values.mobile || values.phone || values.contactnumber || "",
          email: values.email || "",
          interest: values.interestedservice || values.service || values.interest || "",
          source: values.source || "Import",
          campaign: values.campaign || values.utmcampaign || "",
          status: canonicalLeadStatus(values.status || values.stage || "New Inquiry"),
          nextFollowUpAt: values.nextfollowup || values.followupdate || values.nextfollowupat || "",
          owner: values.owner || values.assignedto || "",
          branch: values.branch || branchOptions[1] || "",
          priority: values.priority || "Normal",
          created: values.created || values.createddate || todayDate(),
          nextStep: values.notes || values.nextstep || "",
          permissionToContact: !["no", "false", "0"].includes(permissionValue),
        };
      }).filter(Boolean);

      if (!records.length) {
        notify("No valid leads were found. Include a Name, Lead, or Full Name column.", "warning");
        return;
      }
      await importLeads(records);
    } catch (error) {
      notify(error.message || "Unable to import that lead file.", "error");
    } finally {
      setIsImporting(false);
    }
  }

  function sortButton(key, label) {
    const isActive = sort.key === key;
    return (
      <button type="button" onClick={() => toggleSort(key)}>
        {label}
        <ChevronDown className={`lead-sort-icon ${isActive ? sort.direction : ""}`} size={13} aria-hidden="true" />
      </button>
    );
  }

  async function copyCaptureLink() {
    const captureUrl = `${window.location.origin}/inquire`;
    try {
      await navigator.clipboard.writeText(captureUrl);
      notify("Public inquiry link copied.");
    } catch {
      notify(`Copy this inquiry link: ${captureUrl}`, "warning");
    }
  }

  if (detailLeadId) {
    if (!selectedLead) return <RecordDetailNotFound label="Lead" onBack={onCloseDetail} />;
    return (
      <RecordDetailPageHeader label="Leads" title={selectedLead.name} onBack={onCloseDetail}>
        <LeadDetailPanel
          lead={selectedLead}
          clients={clients}
          appointments={appointments}
          services={services}
          staff={staff}
          branches={branches}
          lossReason={lossReason}
          setLossReason={setLossReason}
          quickNote={quickNote}
          setQuickNote={setQuickNote}
          followUpDraft={followUpDraft}
          setFollowUpDraft={setFollowUpDraft}
          bookingDraft={bookingDraft}
          setBookingDraft={setBookingDraft}
          conversionNotes={conversionNotes}
          setConversionNotes={setConversionNotes}
          busyAction={busyAction}
          runLeadAction={runLeadAction}
          changeStage={changeStage}
          addActivity={addActivity}
          scheduleFollowUp={scheduleFollowUp}
          bookAppointment={bookAppointment}
          convertLead={convertLead}
          mergeLead={mergeLead}
          openModal={openModal}
          focusBooking={detailFocus === "booking"}
        />
      </RecordDetailPageHeader>
    );
  }

  return (
    <section className="leads-directory-page">
      <div className="leads-directory-navigation">
        <div className="lead-status-tabs" role="tablist" aria-label="Lead status">
          {leadDirectoryTabs.map((tab) => (
            <button
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setStoredTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="leads-header-actions">
          <a className="secondary-button" href="/inquire" target="_blank" rel="noreferrer">
            <Globe2 size={16} aria-hidden="true" /> Preview form
          </a>
          <button className="secondary-button" type="button" onClick={copyCaptureLink}>
            <Link size={16} aria-hidden="true" /> Copy form link
          </button>
          <button className={`secondary-button ${showCaptureSources ? "active" : ""}`} type="button" aria-expanded={showCaptureSources} onClick={() => setShowCaptureSources((current) => !current)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Capture sources
          </button>
          <input
            ref={importInputRef}
            className="client-import-input"
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleLeadImport}
            tabIndex={-1}
          />
          <button className="secondary-button" type="button" disabled={isImporting} onClick={() => importInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" /> {isImporting ? "Importing..." : "Import"}
          </button>
          <button className="secondary-button" type="button" disabled={!filteredLeads.length} onClick={() => downloadCsv("zenshotech-leads.csv", filteredLeads, exportColumns)}>
            <Download size={16} aria-hidden="true" /> Export
          </button>
        </div>
      </div>

      {showCaptureSources && (
        <div className="surface-panel leads-capture-sources-panel">
          <LeadIntegrationsPanel integrations={integrations} webhookEvents={webhookEvents} refreshOperations={refreshOperations} />
        </div>
      )}

      <div className="surface-panel leads-directory-panel">
        <div className="leads-directory-toolbar">
          <strong aria-live="polite">{filteredLeads.length.toLocaleString()} {filteredLeads.length === 1 ? "Lead" : "Leads"}</strong>
          <div className="leads-toolbar-controls">
            <button
              className={`secondary-button lead-filter-button ${showFilters ? "active" : ""}`}
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((current) => !current)}
            >
              <Filter size={16} aria-hidden="true" /> Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="leads-directory-filters">
            <LeadFilter label="Source" value={filters.source} options={sourceOptions} onChange={(source) => setFilters((current) => ({ ...current, source }))} />
            <LeadFilter label="Branch" value={filters.branch} options={branchOptions} onChange={(branch) => setFilters((current) => ({ ...current, branch }))} />
            <LeadFilter label="Owner" value={filters.owner} options={ownerOptions} onChange={(owner) => setFilters((current) => ({ ...current, owner }))} />
            <LeadFilter label="Priority" value={filters.priority} options={["All", "Low", "Normal", "High", "Urgent"]} onChange={(priority) => setFilters((current) => ({ ...current, priority }))} />
            <LeadFilter label="Follow-up" value={filters.followUp} options={["All", "Overdue", "Due Today", "Upcoming", "None"]} onChange={(followUp) => setFilters((current) => ({ ...current, followUp }))} />
            <button className="ghost-button leads-reset-filters" type="button" onClick={resetLeadFilters} disabled={!activeFilterCount}>
              <X size={15} aria-hidden="true" /> Clear
            </button>
          </div>
        )}

        <div className="leads-table-wrap">
          <table className="leads-directory-table">
            <thead>
              <tr>
                <th aria-sort={sort.key === "name" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("name", "Lead")}</th>
                <th aria-sort={sort.key === "contact" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("contact", "Contact")}</th>
                <th aria-sort={sort.key === "service" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("service", "Interested Service")}</th>
                <th aria-sort={sort.key === "source" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("source", "Source")}</th>
                <th aria-sort={sort.key === "status" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("status", "Status")}</th>
                <th aria-sort={sort.key === "followUp" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("followUp", "Next Follow-up")}</th>
                <th className="leads-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(isBooting || isImporting) && Array.from({ length: 5 }, (_, rowIndex) => (
                <tr className="lead-skeleton-row" key={`lead-skeleton-${rowIndex}`} aria-hidden="true">
                  {Array.from({ length: 7 }, (_, cellIndex) => <td key={cellIndex}><span className="lead-skeleton-line" /></td>)}
                </tr>
              ))}
              {!isBooting && !isImporting && visibleLeads.map((lead) => {
                const followUp = leadFollowUpDisplay(lead.nextFollowUpAt);
                const service = lead.interest || lead.interestedTreatment || lead.interestedPackage || "General inquiry";
                const campaign = lead.campaign || lead.utmCampaign || "No campaign";
                return (
                  <tr
                    className={selectedLeadId === lead.id ? "is-current" : ""}
                    key={lead.id}
                    tabIndex={0}
                    aria-label={`View ${lead.name}`}
                    onClick={() => openLeadDetails(lead)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openLeadDetails(lead);
                      }
                    }}
                  >
                    <td data-label="Lead">
                      <div className="lead-person-cell">
                        <span className="lead-directory-avatar" aria-hidden="true">{initialsFor(lead.name)}</span>
                        <span><strong>{lead.name}</strong><small>{lead.branch || "Branch not assigned"}</small></span>
                      </div>
                    </td>
                    <td data-label="Contact">
                      <span className="lead-contact-cell">
                        <span><PhoneCall size={13} aria-hidden="true" /> {lead.mobile || "No phone"}</span>
                        <span><Mail size={13} aria-hidden="true" /> {lead.email || "No email"}</span>
                      </span>
                    </td>
                    <td data-label="Interested Service"><span className="lead-service-cell">{service}</span></td>
                    <td data-label="Source">
                      <span className="lead-source-cell"><strong>{lead.source || "Unknown"}</strong><small>{campaign}</small></span>
                    </td>
                    <td data-label="Status" onClick={(event) => event.stopPropagation()}>
                      <label className={`lead-status-select ${statusClass(lead.status)}`}>
                        <span className="sr-only">Update {lead.name} status</span>
                        <select
                          value={lead.status}
                          disabled={busyAction === `stage-${lead.id}`}
                          onChange={(event) => runLeadAction(`stage-${lead.id}`, () => changeStage(lead, event.target.value))}
                        >
                          {leadStatuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <ChevronDown size={12} aria-hidden="true" />
                      </label>
                    </td>
                    <td data-label="Next Follow-up">
                      <span className="lead-follow-up-cell">
                        <span><CalendarDays size={14} aria-hidden="true" /><strong>{followUp.date}</strong>{followUp.time && <b>{followUp.time}</b>}</span>
                        <small className={followUp.tone}>{followUp.relative}</small>
                      </span>
                    </td>
                    <td className="leads-actions-column" data-label="Actions" onClick={(event) => event.stopPropagation()}>
                      <button className="lead-menu-trigger" type="button" aria-label={`Actions for ${lead.name}`} aria-expanded={actionMenu?.leadId === lead.id} onClick={(event) => openLeadActionMenu(event, lead)}>
                        <EllipsisVertical size={18} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isBooting && !isImporting && !visibleLeads.length && (
          <div className="leads-empty-state">
            <EmptyState
              title="No leads found."
              copy="Adjust the search or filters, or use Create new in the header."
            />
          </div>
        )}

        <div className="leads-directory-footer">
          <span>Showing {visibleStart}–{visibleEnd} of {filteredLeads.length.toLocaleString()} leads</span>
          <nav className="clients-pagination" aria-label="Lead directory pages">
            <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></button>
            {paginationItems.map((item, index) => (
              <React.Fragment key={item}>
                {index > 0 && item - paginationItems[index - 1] > 1 && <span aria-hidden="true">…</span>}
                <button className={item === page ? "active" : ""} type="button" aria-current={item === page ? "page" : undefined} onClick={() => setPage(item)}>{item}</button>
              </React.Fragment>
            ))}
            <button type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ChevronRight size={16} /></button>
          </nav>
        </div>
      </div>

      {menuLead && actionMenu && (
        <div className="lead-action-menu" role="menu" style={{ top: actionMenu.top, left: actionMenu.left }}>
          <button type="button" role="menuitem" onClick={() => openLeadDetails(menuLead)}><Eye size={15} /> View</button>
          <button type="button" role="menuitem" onClick={() => { setActionMenu(null); openModal("lead", menuLead); }}><Edit3 size={15} /> Edit</button>
          <button type="button" role="menuitem" onClick={() => openQuickAction("assign", menuLead)}><UserCheck size={15} /> Assign Owner</button>
          <button type="button" role="menuitem" onClick={() => openQuickAction("note", menuLead)}><FileText size={15} /> Add Note</button>
          <button type="button" role="menuitem" disabled={menuLead.status === "Converted"} onClick={() => openQuickAction("convert", menuLead)}><Check size={15} /> Convert</button>
          <span className="lead-menu-divider" />
          <button className="danger" type="button" role="menuitem" onClick={() => { setActionMenu(null); deleteLead(menuLead); }}><Trash2 size={15} /> Delete</button>
        </div>
      )}

      {quickActionLead && quickAction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${quickAction.type} ${quickActionLead.name}`}>
          <form className="lead-quick-action-dialog" onSubmit={submitQuickAction}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setQuickAction(null)}><X size={18} /></button>
            <span className="lead-quick-action-icon"><UserCheck size={20} aria-hidden="true" /></span>
            <h2>{quickAction.type === "assign" ? "Assign owner" : quickAction.type === "note" ? "Add note" : "Convert lead"}</h2>
            <p>{quickAction.type === "convert" ? `Create a client profile for ${quickActionLead.name}.` : quickActionLead.name}</p>
            {quickAction.type === "assign" ? (
              <label>
                <span>Owner</span>
                <select value={quickActionOwner} onChange={(event) => setQuickActionOwner(event.target.value)}>
                  {ownerOptions.filter((owner) => owner !== "All").map((owner) => <option key={owner}>{owner}</option>)}
                </select>
              </label>
            ) : (
              <label>
                <span>{quickAction.type === "note" ? "Note" : "Conversion note (optional)"}</span>
                <textarea rows={4} autoFocus value={quickActionValue} onChange={(event) => setQuickActionValue(event.target.value)} placeholder={quickAction.type === "note" ? "Add context for the team..." : "Add conversion details..."} />
              </label>
            )}
            <div className="lead-dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setQuickAction(null)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={busyAction || (quickAction.type === "note" && !quickActionValue.trim())}>
                {busyAction ? "Saving..." : quickAction.type === "assign" ? "Assign" : quickAction.type === "note" ? "Save Note" : "Convert Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {detailsOpen && selectedLead && (
        <div className="modal-backdrop lead-detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedLead.name} lead details`} onMouseDown={() => setDetailsOpen(false)}>
          <div className="lead-detail-dialog-shell" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Close lead details" onClick={() => setDetailsOpen(false)}><X size={18} /></button>
            <LeadDetailPanel
              lead={selectedLead}
              clients={clients}
              appointments={appointments}
              services={services}
              staff={staff}
              branches={branches}
              lossReason={lossReason}
              setLossReason={setLossReason}
              quickNote={quickNote}
              setQuickNote={setQuickNote}
              followUpDraft={followUpDraft}
              setFollowUpDraft={setFollowUpDraft}
              bookingDraft={bookingDraft}
              setBookingDraft={setBookingDraft}
              conversionNotes={conversionNotes}
              setConversionNotes={setConversionNotes}
              busyAction={busyAction}
              runLeadAction={runLeadAction}
              changeStage={changeStage}
              addActivity={addActivity}
              scheduleFollowUp={scheduleFollowUp}
              bookAppointment={bookAppointment}
              convertLead={convertLead}
              mergeLead={mergeLead}
              openModal={openModal}
              focusBooking={detailFocus === "booking"}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function LeadFilter({ label, value, options, onChange }) {
  return (
    <label className="lead-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function LeadDetailPanel({
  lead,
  clients,
  appointments,
  services,
  staff,
  branches,
  lossReason,
  setLossReason,
  quickNote,
  setQuickNote,
  followUpDraft,
  setFollowUpDraft,
  bookingDraft,
  setBookingDraft,
  conversionNotes,
  setConversionNotes,
  busyAction,
  runLeadAction,
  changeStage,
  addActivity,
  scheduleFollowUp,
  bookAppointment,
  convertLead,
  mergeLead,
  openModal,
  focusBooking,
}) {
  const bookingSectionRef = useRef(null);
  const followUpSectionRef = useRef(null);

  useEffect(() => {
    if (!focusBooking) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (bookingSectionRef.current) bookingSectionRef.current.open = true;
      bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      bookingSectionRef.current?.querySelector("select")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusBooking, lead?.id]);

  if (!lead) {
    return (
      <aside className="surface-panel lead-detail-panel">
        <SectionHeader icon={Inbox} title="Lead Detail" action="No selection" />
        <p className="empty-copy">No leads match the current filters.</p>
      </aside>
    );
  }

  const isClosed = closedLeadStatuses.includes(lead.status);
  const relatedAppointment = appointments.find((appointment) => appointment.id === lead.linkedAppointmentId || appointment.leadId === lead.id);
  const relatedClient = clients.find((client) => client.id === lead.linkedClientId);
  const likelyDuplicate = lead.duplicateOfLeadId ? clients.find((client) => client.id === lead.duplicateOfLeadId) || null : null;
  const scoreReasons = Array.isArray(lead.scoreReasons) ? lead.scoreReasons : [];
  const inquiryMessage = String(lead.message || lead.concern || "").trim();
  const recentActivities = (lead.activities ?? [])
    .filter((activity) => !(activity.title === "Lead captured" && String(activity.note || "").trim() === inquiryMessage))
    .slice(0, 6);

  function revealSection(ref) {
    if (!ref.current) return;
    ref.current.open = true;
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => ref.current?.querySelector("input, select, textarea")?.focus({ preventScroll: true }));
  }

  return (
    <aside className="surface-panel lead-detail-panel">
      <SectionHeader icon={Inbox} title="Customer inquiry" action={lead.status} />
      <section className="lead-client-summary" aria-labelledby="lead-customer-name">
        <div className="lead-detail-header">
          <div>
            <p className="eyebrow">Inquiry from {lead.source || lead.firstTouchSource || "website"}</p>
            <h3 id="lead-customer-name">{lead.name}</h3>
            <span>Interested in {lead.interest || "a general consultation"}</span>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <div className="lead-inquiry-card">
          <div>
            <MessageSquareText size={20} aria-hidden="true" />
            <h4>What the customer said</h4>
          </div>
          <blockquote>{inquiryMessage || "The customer did not include a message."}</blockquote>
          {lead.concern && String(lead.concern).trim() !== inquiryMessage && <p><strong>Main concern:</strong> {lead.concern}</p>}
        </div>

        <dl className="lead-contact-grid">
          <div><dt>Mobile</dt><dd>{lead.mobile ? <a href={`tel:${lead.mobile}`}>{lead.mobile}</a> : "Not provided"}</dd></div>
          <div><dt>Email</dt><dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Not provided"}</dd></div>
          <div><dt>Preferred contact</dt><dd>{lead.preferredChannel || "Phone"}</dd></div>
          <div><dt>Submitted</dt><dd>{lead.createdAt ? compactDate(lead.createdAt) : lead.created || "-"}</dd></div>
          <div><dt>Source</dt><dd>{lead.source || lead.firstTouchSource || "Website"}</dd></div>
          <div><dt>Branch</dt><dd>{lead.branch || "Unassigned"}</dd></div>
        </dl>
      </section>

      <div className="lead-primary-actions" aria-label="Customer contact actions">
        <button className="secondary-button small" type="button" disabled={!lead.mobile || busyAction === "call"} onClick={() => runLeadAction("call", () => addActivity(lead.id, { type: "Call", title: "Call logged", channel: "Phone", note: `Called ${lead.mobile}`, lastContactedAt: new Date().toISOString() }))}>
          <PhoneCall size={16} /> Call
        </button>
        <button className="secondary-button small" type="button" disabled={!lead.mobile || busyAction === "message"} onClick={() => runLeadAction("message", () => addActivity(lead.id, { type: "Message", title: "Message logged", channel: lead.preferredChannel || "SMS", note: "Message sent or recorded", lastContactedAt: new Date().toISOString() }))}>
          <MessageSquareText size={16} /> Message
        </button>
        <button className="secondary-button small" type="button" disabled={!lead.email || busyAction === "email"} onClick={() => runLeadAction("email", () => addActivity(lead.id, { type: "Email", title: "Email logged", channel: "Email", note: `Email recorded for ${lead.email}`, lastContactedAt: new Date().toISOString() }))}>
          <Mail size={16} /> Email
        </button>
        <button className="secondary-button small" type="button" onClick={() => revealSection(followUpSectionRef)}><Clock size={16} /> Follow up</button>
        <button className="primary-button small" type="button" onClick={() => revealSection(bookingSectionRef)}><CalendarDays size={16} /> Book appointment</button>
      </div>

      <div className="lead-simple-workflow">
        <label>
          <span>Lead status</span>
          <select aria-label="Lead status" value={lead.status} onChange={(event) => runLeadAction("stage", () => changeStage(lead, event.target.value))}>
            {leadStatuses.map((stage) => <option key={stage}>{stage}</option>)}
          </select>
        </label>
        <div><span>Assigned to</span><strong>{lead.owner || "Unassigned"}</strong></div>
        <div><span>Permission</span><strong>{lead.permissionToContact ? "Okay to respond" : "Do not contact"}</strong></div>
      </div>

      <details className="lead-action-disclosure" ref={followUpSectionRef}>
        <summary><span><Clock size={17} /> Schedule a follow-up</span><small>Set the next contact date and purpose</small></summary>
        <div className="lead-action-disclosure-body">
        <div className="lead-action-form">
          <label>
            <span>Due</span>
            <input type="datetime-local" value={followUpDraft.dueAt} onChange={(event) => setFollowUpDraft((current) => ({ ...current, dueAt: event.target.value }))} />
          </label>
          <label>
            <span>Channel</span>
            <select value={followUpDraft.channel} onChange={(event) => setFollowUpDraft((current) => ({ ...current, channel: event.target.value }))}>
              {["Phone", "SMS", "Messenger", "WhatsApp", "Email", "Consultation", "Appointment", "Internal review"].map((channel) => <option key={channel}>{channel}</option>)}
            </select>
          </label>
          <label className="span-2">
            <span>Purpose</span>
            <input value={followUpDraft.purpose} onChange={(event) => setFollowUpDraft((current) => ({ ...current, purpose: event.target.value }))} />
          </label>
          <label className="span-2">
            <span>Notes</span>
            <textarea rows={2} value={followUpDraft.notes} onChange={(event) => setFollowUpDraft((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <button className="primary-button small span-2" type="button" disabled={busyAction === "followup"} onClick={() => runLeadAction("followup", () => scheduleFollowUp(lead.id, followUpDraft))}>
            <Clock size={16} /> Schedule Follow-Up
          </button>
        </div>
        </div>
      </details>

      <details className="lead-action-disclosure lead-booking-section" ref={bookingSectionRef}>
        <summary><span><CalendarDays size={17} /> Book an appointment</span><small>Choose the service, date, and provider</small></summary>
        <div className="lead-action-disclosure-body">
        <div className="lead-action-form">
          <label>
            <span>Service</span>
            <select value={bookingDraft.serviceId} onChange={(event) => setBookingDraft((current) => ({ ...current, serviceId: event.target.value }))}>
              {services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
            </select>
          </label>
          <label>
            <span>Branch</span>
            <select value={bookingDraft.branch} onChange={(event) => setBookingDraft((current) => ({ ...current, branch: event.target.value }))}>
              {branches.map((branch) => <option key={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={bookingDraft.date} onChange={(event) => setBookingDraft((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            <span>Time</span>
            <input type="time" value={bookingDraft.time} onChange={(event) => setBookingDraft((current) => ({ ...current, time: event.target.value }))} />
          </label>
          <label>
            <span>Staff</span>
            <select value={bookingDraft.staff} onChange={(event) => setBookingDraft((current) => ({ ...current, staff: event.target.value }))}>
              {staff.map((person) => <option key={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label>
            <span>Deposit</span>
            <input type="number" min="0" value={bookingDraft.deposit} onChange={(event) => setBookingDraft((current) => ({ ...current, deposit: event.target.value }))} />
          </label>
          <button className="primary-button small span-2" type="button" disabled={busyAction === "book"} onClick={() => runLeadAction("book", () => bookAppointment(lead.id, bookingDraft))}>
            <CalendarDays size={16} /> Book Appointment
          </button>
        </div>
        </div>
      </details>

      <div className="lead-detail-section">
        <h4>Internal note</h4>
        <div className="lead-note-box">
          <textarea rows={3} value={quickNote} onChange={(event) => setQuickNote(event.target.value)} placeholder="Add internal note" />
          <button className="secondary-button small" type="button" disabled={!quickNote.trim() || busyAction === "note"} onClick={() => runLeadAction("note", () => addActivity(lead.id, { type: "Note", title: "Internal note", note: quickNote }))}>
            <FileText size={16} /> Add Note
          </button>
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Recent activity</h4>
        <div className="lead-timeline">
          {recentActivities.map((activity) => (
            <article key={activity.id}>
              <strong>{activity.title}</strong>
              <span>{activity.actor} / {compactDate(activity.occurredAt)}</span>
              {activity.note && <p>{activity.note}</p>}
            </article>
          ))}
          {!recentActivities.length && <p className="empty-copy">No follow-up activity yet.</p>}
        </div>
      </div>

      <details className="lead-more-details">
        <summary>More lead details</summary>
        <div className="lead-more-details-body">
          <div className="lead-detail-meta">
            <RecordPill label="Score" value={Number(lead.score || 0)} />
            <RecordPill label="SLA" value={leadSlaState(lead)} />
            <RecordPill label="First touch" value={lead.firstTouchSource || lead.source || "-"} />
            <RecordPill label="Campaign" value={lead.campaign || lead.utmCampaign || "-"} />
          </div>
          <div className="lead-detail-section">
            <h4>Close or convert</h4>
            <div className="lead-stage-form">
              <label><span>Loss reason</span><select value={lossReason} onChange={(event) => setLossReason(event.target.value)}>{leadLossReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
              <button className="secondary-button small" type="button" disabled={busyAction === "lost"} onClick={() => runLeadAction("lost", () => changeStage(lead, "Lost", { lossReason }))}>Mark Lost</button>
              {!isClosed && <label className="span-2 lead-conversion-note"><span>Conversion note (optional)</span><textarea rows={2} value={conversionNotes} onChange={(event) => setConversionNotes(event.target.value)} /></label>}
              {!isClosed && <button className="primary-button small span-2" type="button" disabled={busyAction === "convert"} onClick={() => runLeadAction("convert", () => convertLead(lead.id, { notes: conversionNotes }))}><UserCheck size={16} /> Convert to client</button>}
            </div>
          </div>
          <div className="lead-detail-section">
            <h4>Attribution and related records</h4>
            <dl className="lead-detail-list">
              <div><dt>Latest touch</dt><dd>{lead.latestTouchSource || lead.source || "-"}</dd></div>
              <div><dt>External ID</dt><dd>{lead.externalLeadId || "-"}</dd></div>
              <div><dt>Client</dt><dd>{relatedClient?.fullName || lead.linkedClientId || "-"}</dd></div>
              <div><dt>Appointment</dt><dd>{relatedAppointment ? `${relatedAppointment.date} ${relatedAppointment.time}` : lead.linkedAppointmentId || "-"}</dd></div>
              <div><dt>Duplicate</dt><dd>{likelyDuplicate?.fullName || lead.duplicateOfLeadId || "-"}</dd></div>
            </dl>
            <div className="lead-secondary-actions">
              <button className="secondary-button small" type="button" onClick={() => openModal("lead", lead)}><Edit3 size={16} /> Edit lead</button>
              {lead.duplicateOfLeadId && <button className="secondary-button small" type="button" disabled={busyAction === "merge"} onClick={() => runLeadAction("merge", () => mergeLead(lead.duplicateOfLeadId, { duplicateId: lead.id }))}>Merge Duplicate</button>}
            </div>
          </div>
          <div className="lead-detail-section">
            <h4>Why this lead scored {Number(lead.score || 0)}</h4>
            <div className="lead-reason-list">{scoreReasons.length ? scoreReasons.map((item, index) => <span key={`${item.reason}-${index}`}>+{item.points} {item.reason}</span>) : <span>No scoring reasons stored.</span>}</div>
          </div>
        </div>
      </details>
    </aside>
  );
}

function LeadIntegrationsPanel({ integrations, webhookEvents, refreshOperations }) {
  const connectedCount = integrations.filter((item) => item.status === "Connected").length;
  const failingCount = integrations.filter((item) => item.status === "Webhook Failing").length;
  const iconForProvider = (provider) => {
    if (["meta-facebook", "instagram", "messenger"].includes(provider)) return MessageSquareText;
    if (["google-ads", "google-business", "tiktok"].includes(provider)) return Megaphone;
    if (provider === "whatsapp") return PhoneCall;
    if (provider === "email") return Mail;
    if (provider === "offline") return Users;
    return Globe2;
  };

  return (
    <div className="lead-integrations-layout">
      <div className="lead-integrations-hero">
        <div>
          <span className="eyebrow">Lead capture channels</span>
          <h3>Integration Center</h3>
          <p>Connect inquiry sources to create, route, score, and deduplicate leads automatically.</p>
        </div>
        <button className="secondary-button small" type="button" onClick={refreshOperations}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="lead-integration-summary">
        <RecordPill label="Providers" value={integrations.length} />
        <RecordPill label="Connected" value={connectedCount} />
        <RecordPill label="Needs setup" value={Math.max(0, integrations.length - connectedCount - failingCount)} />
        <RecordPill label="Errors" value={failingCount} />
      </div>

      <div className="lead-integration-grid">
        {integrations.map((integration) => {
          const ProviderIcon = iconForProvider(integration.provider);
          const requirements = Array.isArray(integration.requiredConfiguration) ? integration.requiredConfiguration : [];
          const mappingCount = Object.keys(integration.fieldMapping || {}).length;
          return (
            <article className={`lead-integration-card ${statusClass(integration.status)}`} key={integration.provider}>
              <div className="lead-integration-card-heading">
                <span className="lead-integration-icon"><ProviderIcon size={20} aria-hidden="true" /></span>
                <div><strong>{integration.label}</strong><small>{integration.provider}</small></div>
                <StatusBadge status={integration.status} />
              </div>
              <p>{integration.configSummary || integration.blockedReason || "Provider configuration is ready for review."}</p>
              <div className="lead-integration-facts">
                <span><b>{mappingCount}</b> mapped fields</span>
                <span><b>{compactDate(integration.lastSuccessfulSyncAt) || "Never"}</b> last sync</span>
              </div>
              {integration.provider !== "offline" && (
                <div className="lead-webhook-endpoint">
                  <span>Webhook endpoint</span>
                  <code>/api/leads/webhooks/{integration.provider}</code>
                </div>
              )}
              <div className="lead-integration-requirements">
                {requirements.length
                  ? requirements.map((requirement) => <span key={requirement}>{requirement}</span>)
                  : <span>No credentials required</span>}
              </div>
              {(integration.lastError || integration.blockedReason) && integration.status !== "Connected" && (
                <div className="lead-integration-warning"><AlertCircle size={15} /><span>{integration.lastError || integration.blockedReason}</span></div>
              )}
            </article>
          );
        })}
        {!integrations.length && <EmptyState title="No lead integrations configured" copy="Refresh to load the available lead providers." />}
      </div>

      <div className="lead-integrations-header">
        <h3>Webhook Logs</h3>
        <span>{webhookEvents.length} events</span>
      </div>
      <SmartTable
        rows={webhookEvents}
        globalSearch=""
        showSearch={false}
        pageSize={8}
        emptyTitle="No webhook events received"
        columns={[
          { key: "provider", label: "Platform" },
          { key: "providerEventId", label: "Event ID" },
          { key: "receivedAt", label: "Received", render: (row) => compactDate(row.receivedAt) || "-" },
          { key: "status", label: "Processing Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "leadId", label: "Lead" },
          { key: "attempts", label: "Retries" },
          { key: "error", label: "Error", render: (row) => row.error || "-" },
        ]}
      />
    </div>
  );
}

function leadSlaState(lead) {
  const status = canonicalLeadStatus(lead.status);
  if (closedLeadStatuses.includes(status)) return "Closed";
  if (lead.firstRespondedAt) return "Responded";
  const dueAt = new Date(lead.slaDueAt || lead.createdAt || lead.created || "");
  if (Number.isNaN(dueAt.getTime())) return lead.slaState || "On time";
  const remaining = dueAt.getTime() - Date.now();
  if (remaining < 0) return "Overdue";
  if (remaining < 10 * 60 * 1000) return "Approaching deadline";
  return "On time";
}

function leadFollowUpState(lead) {
  const dueAt = new Date(lead.nextFollowUpAt || "");
  if (Number.isNaN(dueAt.getTime())) return "None";
  if (dueAt.getTime() < Date.now()) return "Overdue";
  if (isoDate(dueAt) === todayDate()) return "Due Today";
  return "Upcoming";
}

function compactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const attendanceActionLabels = {
  CLOCK_IN: "Time in",
  BREAK_START: "Start break",
  BREAK_END: "End break",
  CLOCK_OUT: "Time out",
};

function MyWorkspaceModule({ session, notify }) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setWorkspace(await loadMyWorkspace());
    } catch (error) {
      notify(error.message || "Unable to load your workspace.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitAttendance(type) {
    setSavingAction(type);
    try {
      const result = await recordAttendance(type);
      setWorkspace(result.workspace);
      notify(`${attendanceActionLabels[type]} recorded.`);
    } catch (error) {
      notify(error.message || "Unable to record attendance.", "error");
    } finally {
      setSavingAction("");
    }
  }

  if (loading && !workspace) {
    return <div className="surface-panel my-workspace-loading"><Database size={22} /><span>Loading your staff workspace...</span></div>;
  }

  if (!workspace?.staff) {
    const identityMismatch = workspace?.connectionIssue === "IDENTITY_MISMATCH";
    return (
      <section className="surface-panel my-workspace-empty">
        <UserCheck size={28} />
        <h2>{identityMismatch ? "Staff connection needs review" : "Account connection required"}</h2>
        <p>{identityMismatch
          ? `${session.name}'s login is connected to a staff profile with a different name or role. An administrator must connect the matching profile from Staff Management.`
          : `${session.name}'s login is active, but it is not connected to a staff profile yet. An administrator can link it from Staff Management.`}</p>
      </section>
    );
  }

  const { staff, attendance, events = [], appointments = [] } = workspace;

  return (
    <div className="my-workspace-page">
      <section className="my-workspace-hero">
        <div>
          <p className="eyebrow">Personal staff workspace</p>
          <h2>Good day, {staff.name}.</h2>
          <p>{staff.role} · {staff.branch} · {staff.schedule}</p>
        </div>
        <div className={`attendance-status-card ${attendance.status.toLowerCase().replaceAll(" ", "-")}`}>
          <span>Current status</span>
          <strong>{attendance.status}</strong>
          <small>{events[0] ? `Last action ${new Date(events[0].occurredAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}` : "No attendance recorded today"}</small>
        </div>
      </section>

      <section className="attendance-action-panel surface-panel">
        <div>
          <p className="eyebrow">Today’s attendance</p>
          <h2>Timekeeping</h2>
          <p>Official time is recorded by the clinic server.</p>
        </div>
        <div className="attendance-actions">
          {attendance.nextActions.map((type) => (
            <button className={type === "CLOCK_IN" || type === "CLOCK_OUT" ? "primary-button" : "secondary-button"} disabled={Boolean(savingAction)} key={type} onClick={() => submitAttendance(type)} type="button">
              <Clock size={18} /> {savingAction === type ? "Recording..." : attendanceActionLabels[type]}
            </button>
          ))}
        </div>
      </section>

      <section className="my-workspace-grid">
        <div className="surface-panel">
          <SectionHeader icon={CalendarDays} title="My appointments" action={`${appointments.length} today`} />
          {appointments.length ? (
            <div className="role-detail-list">
              {appointments.map((appointment) => (
                <article className="role-detail-row" key={appointment.id}>
                  <div><strong>{appointment.time} · {appointment.client}</strong><span>{appointment.service} · {appointment.room}</span></div>
                  <StatusBadge status={appointment.status} />
                </article>
              ))}
            </div>
          ) : <EmptyState title="No appointments today" copy="Your personal clinical queue is clear." />}
        </div>

        <div className="surface-panel">
          <SectionHeader icon={Clock} title="Attendance history" action={`${events.length} events`} />
          {events.length ? (
            <div className="attendance-timeline">
              {events.map((event) => (
                <article key={event.id}>
                  <span className="attendance-dot" />
                  <div><strong>{attendanceActionLabels[event.type] || event.type}</strong><small>{new Date(event.occurredAt).toLocaleString("en-PH", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}</small></div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No time entries" copy="Use Time in when your shift begins." />}
        </div>
      </section>
    </div>
  );
}

function StaffModule({ detailStaffId = "", staff, branchRecords = [], session, setSession, openModal, toggleAttendance, globalSearch, applyAuditLog, notify, onOpenStaff, onCloseDetail, createRequest = 0, onCreateRequestHandled, usersExportRef, profilesExportRef }) {
  const canInvite = canManageOrganization(session.role)
    || (["Branch Manager", "Admin"].includes(session.role) && session.access?.permissions?.includes("staff.invite"));
  const canManageAccounts = canManageOrganization(session.role)
    || (["Branch Manager", "Admin"].includes(session.role) && session.access?.permissions?.includes("staff.manage"));
  const [invitations, setInvitations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [capabilities, setCapabilities] = useState({ roles: [], roleModules: {}, permissions: [], branches: [], organizationManager: false, canSelectBranches: false, invitationExpiryDays: 7 });
  const [workspaceTab, setWorkspaceTab] = useState("Active Users");
  const [branchFilter, setBranchFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [linkTarget, setLinkTarget] = useState(null);
  const [linkChoice, setLinkChoice] = useState("");
  const [linking, setLinking] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editingInvitation, setEditingInvitation] = useState(null);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessForm, setAccessForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedStaff = staff.find((person) => person.id === detailStaffId) ?? null;
  const roles = capabilities.roles.length ? capabilities.roles : Object.keys(roleAccess).filter((role) => (
    canManageOrganization(session.role)
      || (!canManageOrganization(role) && (!["Branch Manager", "Admin"].includes(role) || session.access?.permissions?.includes("staff.invite_managers")))
  ));
  const allowedBranches = capabilities.branches.length
    ? capabilities.branches
    : branchRecords.filter((branch) => branch.status === "Active").map((branch) => ({ id: branch.id, name: branch.name, enabledModules: branch.enabledModules || [] }));
  const defaultBranchId = session.access?.activeBranchId !== "all"
    ? session.access?.activeBranchId
    : allowedBranches[0]?.id || "";
  const moduleLabel = (moduleId) => navItems.find((item) => item.id === moduleId)?.label || moduleId;
  const moduleOptionsFor = useCallback((role, branchIds) => {
    const defaults = capabilities.roleModules?.[role] || roleAccess[role] || [];
    const selected = allowedBranches.filter((branch) => branchIds.includes(branch.id));
    return defaults.filter((moduleId) => !selected.length || selected.every((branch) => branch.enabledModules.includes(moduleId)));
  }, [allowedBranches, capabilities.roleModules]);
  const emptyInvitation = useCallback(() => {
    const role = roles.includes("Employee") ? "Employee" : roles.find((item) => !canManageOrganization(item)) || roles[0] || "Employee";
    const branchIds = canManageOrganization(role) ? [] : [defaultBranchId].filter(Boolean);
    return {
      firstName: "",
      lastName: "",
      email: "",
      role,
      branchIds,
      department: "",
      specialty: "",
      position: "",
      modules: moduleOptionsFor(role, branchIds),
      permissions: [],
      message: "",
      confirmOrganizationAccess: false,
    };
  }, [defaultBranchId, moduleOptionsFor, roles]);
  const [form, setForm] = useState(emptyInvitation);

  const refresh = useCallback(async () => {
    if (!canInvite) return;
    try {
      const [invitationResult, accountResult] = await Promise.all([loadInvitations(), loadOrganizationAccounts()]);
      setInvitations(invitationResult.invitations || []);
      setAccounts(accountResult.accounts || []);
      setCapabilities(invitationResult.capabilities || {});
    } catch (loadError) { notify(loadError.message, "error"); }
  }, [canInvite, notify]);

  const accountByStaffId = useMemo(
    () => new Map(accounts.filter((account) => account.staffId).map((account) => [account.staffId, account])),
    [accounts],
  );
  const unlinkedAccounts = useMemo(() => accounts.filter((account) => !account.staffId), [accounts]);

  async function applyLink(staffRow, accountId) {
    setLinking(true);
    try {
      const result = await linkStaffAccount(staffRow.id, accountId);
      setAccounts((current) => current.map((account) => (account.id === result.account.id ? result.account : account)));
      applyAuditLog(result.auditLog);
      if (result.account.id === session.id) setSession(result.account);
      notify(accountId ? `${result.account.email} is now connected to ${staffRow.name}.` : `${result.account.email} was disconnected.`);
      setLinkTarget(null);
      setLinkChoice("");
    } catch (linkError) {
      notify(linkError.message, "error");
    } finally {
      setLinking(false);
    }
  }

  useEffect(() => { void refresh(); }, [refresh]);

  function openInvitation(invitation = null) {
    setError("");
    setEditingInvitation(invitation);
    if (invitation) {
      setForm({
        firstName: invitation.firstName || invitation.name?.split(" ")[0] || "",
        lastName: invitation.lastName || invitation.name?.split(" ").slice(1).join(" ") || "",
        email: invitation.email,
        role: invitation.role,
        branchIds: invitation.branchIds || [],
        department: invitation.department || "",
        specialty: invitation.specialty || "",
        position: invitation.position || "",
        modules: invitation.modules || [],
        permissions: invitation.permissions || [],
        message: invitation.message || "",
        confirmOrganizationAccess: canManageOrganization(invitation.role),
      });
    } else {
      setForm(emptyInvitation());
    }
    setShowInvite(true);
  }

  useEffect(() => {
    if (!createRequest) return;
    openInvitation();
    onCreateRequestHandled?.(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createRequest]);

  async function submitInvitation(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = editingInvitation
        ? await editInvitation(editingInvitation.id, form)
        : await createInvitation(form);
      setInvitations((current) => [result.invitation, ...current.filter((item) => item.id !== result.invitation.id)]);
      applyAuditLog(result.auditLog);
      setShowInvite(false);
      setEditingInvitation(null);
      setForm(emptyInvitation());
      notify(result.deliveryError || (editingInvitation ? "Invitation updated and resent." : "Invitation sent."), result.deliveryError ? "warning" : "success");
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  async function runInvitationAction(action, invitation) {
    try {
      const result = action === "revoke" ? await revokeInvitation(invitation.id) : await resendInvitation(invitation.id);
      setInvitations((current) => current.map((item) => item.id === result.invitation.id ? result.invitation : item));
      applyAuditLog(result.auditLog); notify(result.deliveryError || (action === "revoke" ? "Invitation cancelled." : "Invitation resent."), result.deliveryError ? "warning" : "success");
    } catch (actionError) { notify(actionError.message, "error"); }
  }

  function openAccess(account) {
    const branchIds = canManageOrganization(account.role) ? [] : (account.access?.branches || []).map((branch) => branch.id);
    setAccessTarget(account);
    setAccessForm({
      role: account.role,
      status: account.status,
      branchIds,
      modules: account.access?.modules || moduleOptionsFor(account.role, branchIds),
      permissions: account.access?.activeBranch?.permissions || [],
      confirmAccessChange: true,
      confirmOrganizationAccess: false,
    });
    setError("");
  }

  async function saveAccess(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await updateAccountAccess(accessTarget.id, accessForm);
      setAccounts((current) => current.map((account) => account.id === result.account.id ? result.account : account));
      (result.auditLogs || []).forEach(applyAuditLog);
      if (result.account.id === session.id) setSession(result.account);
      notify("User access updated.");
      setAccessTarget(null);
      setAccessForm(null);
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  const normalizedSearch = globalSearch.trim().toLowerCase();
  const accountRows = accounts.filter((account) => {
    const branchNames = account.organizationWideAccess ? [] : (account.access?.branches || []).map((branch) => branch.name);
    const modules = account.access?.modules || [];
    return (workspaceTab === "Inactive Users" ? account.status !== "Active" : account.status === "Active")
      && (!normalizedSearch || `${account.name} ${account.email} ${account.role} ${branchNames.join(" ")}`.toLowerCase().includes(normalizedSearch))
      && (branchFilter === "All" || branchNames.includes(branchFilter))
      && (roleFilter === "All" || account.role === roleFilter)
      && (moduleFilter === "All" || modules.includes(moduleFilter));
  });
  const invitationRows = invitations.filter((invitation) => (
    (!normalizedSearch || `${invitation.name} ${invitation.email} ${invitation.role}`.toLowerCase().includes(normalizedSearch))
    && (branchFilter === "All" || invitation.branches?.some((branch) => branch.name === branchFilter))
    && (roleFilter === "All" || invitation.role === roleFilter)
    && (statusFilter === "All" || invitation.status === statusFilter)
    && (moduleFilter === "All" || invitation.modules?.includes(moduleFilter))
  ));
  const filterModules = [...new Set(Object.values(capabilities.roleModules || roleAccess).flat())];

  if (usersExportRef) {
    usersExportRef.current = () => downloadCsv("zenshotech-users-and-invitations.csv", [
      ...accounts.map((account) => ({
        recordType: "User",
        name: account.name,
        email: account.email,
        branch: account.organizationWideAccess ? "Organization-wide" : account.access?.branches?.map((branch) => branch.name).join(", ") || "Unassigned",
        role: account.role,
        status: account.status,
        date: account.createdAt || "",
      })),
      ...invitations.map((invitation) => ({
        recordType: "Invitation",
        name: invitation.name,
        email: invitation.email,
        branch: invitation.branches?.map((branch) => branch.name).join(", ") || "Organization-wide",
        role: invitation.role,
        status: invitation.status,
        date: invitation.createdAt || "",
      })),
    ], [
      { key: "recordType", label: "Record Type" },
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "branch", label: "Branch" },
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
      { key: "date", label: "Created / Invited" },
    ]);
  }

  if (profilesExportRef) {
    profilesExportRef.current = () => downloadCsv("zenshotech-employee-profiles.csv", staff, [
      { key: "id", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "role", label: "Role" },
      { key: "branch", label: "Primary Branch" },
      { key: "branches", label: "Assigned Branches", exportValue: (person) => splitList(person.branches).join(", ") },
      { key: "schedule", label: "Schedule" },
      { key: "status", label: "Status" },
      { key: "attendance", label: "Attendance" },
      { key: "employmentStatus", label: "Employment Status" },
      { key: "employmentDate", label: "Employment Date" },
      { key: "phone", label: "Phone" },
      { key: "commissionRate", label: "Commission Rate" },
      { key: "services", label: "Assigned Services", exportValue: (person) => splitList(person.services).join(", ") },
      { key: "login", label: "Login", exportValue: (person) => accountByStaffId.get(person.id)?.email || "" },
    ]);
  }

  if (detailStaffId) {
    if (!selectedStaff) return <RecordDetailNotFound label="Staff member" onBack={onCloseDetail} />;
    return (
      <RecordDetailPageHeader label="Staff Management" title={selectedStaff.name} onBack={onCloseDetail}>
        <StaffRecordPage
          person={selectedStaff}
          account={accountByStaffId.get(selectedStaff.id)}
          onClock={() => toggleAttendance(selectedStaff.id)}
          onEdit={() => openModal("staff", selectedStaff)}
        />
      </RecordDetailPageHeader>
    );
  }
  return (
    <section className="module-grid staff-management-grid">
      <div className="surface-panel">
        <SectionHeader icon={Users} title="Users & Invitations" action={`${accounts.length} users · ${invitations.filter((item) => item.status === "Pending").length} pending`} />
        <div className="workspace-tabs" role="tablist" aria-label="User access status">
          {["Active Users", "Pending Invitations", "Inactive Users"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={workspaceTab === tab} className={workspaceTab === tab ? "active" : ""} onClick={() => setWorkspaceTab(tab)}>{tab}</button>)}
        </div>
        <div className="user-access-filters">
          <label><span>Branch</span><select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option>All</option>{allowedBranches.map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
          <label><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All</option>{Object.keys(roleAccess).map((role) => <option key={role}>{role}</option>)}</select></label>
          {workspaceTab === "Pending Invitations" && <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{["Pending", "Accepted", "Expired", "Revoked"].map((status) => <option key={status}>{status}</option>)}</select></label>}
          <label><span>Module access</span><select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option>All</option>{filterModules.map((moduleId) => <option key={moduleId} value={moduleId}>{moduleLabel(moduleId)}</option>)}</select></label>
          {canInvite && <button className="primary-button small" type="button" onClick={() => openInvitation()}><Mail size={16} /> Invite user</button>}
        </div>
        {workspaceTab === "Pending Invitations" ? <SmartTable rows={invitationRows} columns={[
          { key: "name", label: "User", render: (row) => <div><strong>{row.name}</strong><small>{row.email}</small></div> },
          { key: "branch", label: "Branch", render: (row) => row.branches?.map((branch) => branch.name).join(", ") || "Organization-wide" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status", render: (row) => <div><StatusBadge status={row.status} /><small>{row.deliveryStatus === "Failed" ? "Email failed" : row.deliveryStatus}</small></div> },
          { key: "invitedBy", label: "Invited by", render: (row) => row.invitedBy?.name || "—" },
          { key: "createdAt", label: "Invited", render: (row) => new Date(row.createdAt).toLocaleDateString("en-PH") },
          { key: "expiresAt", label: "Expires", render: (row) => new Date(row.expiresAt).toLocaleDateString("en-PH") },
          { key: "actions", label: "Actions", render: (row) => {
            const canAct = capabilities.organizationManager || row.invitedBy?.id === session.id;
            return <div className="inline-actions">{canAct && row.status === "Pending" && <button type="button" onClick={() => openInvitation(row)}><Edit3 size={14} /> Edit</button>}{canAct && ["Pending", "Expired"].includes(row.status) && <button type="button" onClick={() => runInvitationAction("resend", row)}><RefreshCw size={14} /> Resend</button>}{canAct && row.status === "Pending" && <button type="button" onClick={() => runInvitationAction("revoke", row)}><X size={14} /> Cancel</button>}</div>;
          }, exportValue: () => "" },
        ]} showToolbar={false} showStatus={false} /> : <SmartTable rows={accountRows} columns={[
          { key: "name", label: "User", render: (row) => <div><strong>{row.name}</strong><small>{row.email}</small></div> },
          { key: "branch", label: "Branch", render: (row) => row.organizationWideAccess ? "Organization-wide" : row.access?.branches?.map((branch) => branch.name).join(", ") || "Unassigned" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "createdAt", label: "Joined", render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-PH") : "—" },
          { key: "actions", label: "Actions", render: (row) => <div className="inline-actions">{row.staffId && staff.some((person) => person.id === row.staffId) && <button type="button" onClick={() => onOpenStaff?.(staff.find((person) => person.id === row.staffId))}><Eye size={14} /> View</button>}{canManageAccounts && (canManageOrganization(session.role) || (!canManageOrganization(row.role) && (!["Branch Manager", "Admin"].includes(row.role) || capabilities.canInviteManagers))) && <button type="button" onClick={() => openAccess(row)}><ShieldCheck size={14} /> Manage access</button>}</div>, exportValue: () => "" },
        ]} showToolbar={false} showStatus={false} />}
      </div>
      {workspaceTab === "Active Users" && <div className="surface-panel">
        <SectionHeader icon={BriefcaseBusiness} title="Employee Profiles" action={`${staff.length} employees`} />
        <SmartTable
          rows={staff}
          showToolbar={false}
          showStatus={false}
          columns={[
            { key: "name", label: "Name", className: "staff-name-column", render: (row) => <button className="staff-record-link" type="button" onClick={() => onOpenStaff?.(row)}><ClientAvatar client={{ fullName: row.name, photo: row.photo }} size="small" /><strong>{row.name}</strong></button> },
            { key: "role", label: "Role" },
            { key: "branch", label: "Branch" },
            { key: "schedule", label: "Schedule" },
            { key: "commissionRate", label: "Commission", render: (row) => `${row.commissionRate}%` },
            { key: "attendance", label: "Attendance", render: (row) => <StatusBadge status={row.attendance} /> },
            {
              key: "login",
              label: "Login",
              className: "staff-login-column",
              render: (row) => {
                const linked = accountByStaffId.get(row.id);
                if (linked) {
                  return (
                    <div className="staff-login-cell">
                      <div><strong>{linked.email}</strong><small>{linked.role}</small></div>
                      {canManageAccounts && <button type="button" disabled={linking} onClick={() => void applyLink(row, "")}><X size={14} /> Unlink</button>}
                    </div>
                  );
                }
                if (!canManageAccounts) return <span className="staff-login-empty">Not connected</span>;
                return (
                  <button type="button" disabled={linking} onClick={() => { setLinkTarget(row); setLinkChoice(""); }}>
                    <UserCheck size={14} /> Connect login
                  </button>
                );
              },
              exportValue: (row) => accountByStaffId.get(row.id)?.email || "",
            },
            {
              key: "actions",
              label: "Actions",
              className: "staff-actions-column",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => onOpenStaff?.(row)}><Eye size={15} /> View</button>
                  {canManageAccounts && <button type="button" onClick={() => toggleAttendance(row.id)}><Clock size={15} /> Clock</button>}
                  {canManageAccounts && <button type="button" onClick={() => openModal("staff", row)}><Edit3 size={15} /> Edit</button>}
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>}
      {showInvite && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Invite member"><form className="modal-card invitation-modal" onSubmit={submitInvitation}>
        <button className="modal-close" type="button" onClick={() => { setShowInvite(false); setEditingInvitation(null); }}><X size={18} /></button>
        <SectionHeader icon={Mail} title={editingInvitation ? "Edit pending invitation" : "Invite organization member"} action={`Secure link · ${capabilities.invitationExpiryDays || 7} days`} />
        <div className="form-grid">
          <label><span>First name</span><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
          <label><span>Last name</span><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
          <label><span>Email</span><input required type="email" disabled={Boolean(editingInvitation)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>Job title / position</span><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
          <label><span>Role</span><select value={form.role} onChange={(e) => {
            const role = e.target.value;
            const branchIds = canManageOrganization(role) ? [] : (form.branchIds.length ? form.branchIds : [defaultBranchId].filter(Boolean));
            const permissions = role === "Admin"
              ? ["staff.invite", "staff.invite_cross_branch", "staff.manage"].filter((id) => capabilities.permissions.some((permission) => permission.id === id))
              : [];
            setForm((current) => ({ ...current, role, branchIds, modules: moduleOptionsFor(role, branchIds), permissions, confirmOrganizationAccess: false }));
          }}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label><span>Department</span><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label><span>Specialty</span><input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></label>
          <fieldset className="full-span invitation-options"><legend>Branch assignment</legend>{canManageOrganization(form.role) ? <p>Organization-wide access is granted by this role. No “All Branches” assignment will be stored.</p> : <div>{allowedBranches.map((branch) => <label key={branch.id}><input type="checkbox" disabled={!capabilities.canSelectBranches} checked={form.branchIds.includes(branch.id)} onChange={(event) => {
            const branchIds = event.target.checked ? [...form.branchIds, branch.id] : form.branchIds.filter((id) => id !== branch.id);
            setForm((current) => ({ ...current, branchIds, modules: current.modules.filter((moduleId) => moduleOptionsFor(current.role, branchIds).includes(moduleId)) }));
          }} /><span>{branch.name}{!capabilities.canSelectBranches ? " · Assigned branch" : ""}</span></label>)}</div>}</fieldset>
          <fieldset className="full-span invitation-options"><legend>Modules</legend><p>Branch users always receive POS. Admin roles may additionally receive staff and attendance administration.</p><div>{moduleOptionsFor(form.role, form.branchIds).map((moduleId) => <label key={moduleId}><input type="checkbox" disabled={moduleId === "pos" && !canManageOrganization(form.role)} checked={form.modules.includes(moduleId)} onChange={(event) => setForm((current) => ({ ...current, modules: event.target.checked ? [...current.modules, moduleId] : current.modules.filter((id) => id !== moduleId) }))} /><span>{moduleLabel(moduleId)}</span></label>)}</div></fieldset>
          {capabilities.permissions?.length > 0 && <fieldset className="full-span invitation-options"><legend>Additional permissions</legend><div>{capabilities.permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={form.permissions.includes(permission.id)} onChange={(event) => setForm((current) => ({ ...current, permissions: event.target.checked ? [...current.permissions, permission.id] : current.permissions.filter((id) => id !== permission.id) }))} /><span>{permission.label}</span></label>)}</div></fieldset>}
          {canManageOrganization(form.role) && <label className="full-span confirmation-check"><input required type="checkbox" checked={form.confirmOrganizationAccess} onChange={(event) => setForm({ ...form, confirmOrganizationAccess: event.target.checked })} /><span>I understand this grants organization-wide access to all active branches.</span></label>}
          <label className="full-span"><span>Optional message</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
        </div>
        {error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}
        <div className="modal-actions"><button className="ghost-button" type="button" onClick={() => { setShowInvite(false); setEditingInvitation(null); }}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Sending..." : editingInvitation ? "Save and resend" : "Send invitation"}</button></div>
      </form></div>}
      {accessTarget && accessForm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manage user access"><form className="modal-card invitation-modal" onSubmit={saveAccess}>
        <button className="modal-close" type="button" onClick={() => setAccessTarget(null)}><X size={18} /></button>
        <SectionHeader icon={ShieldCheck} title={`Manage ${accessTarget.name}`} action={accessTarget.email} />
        <div className="form-grid">
          <label><span>Status</span><select value={accessForm.status} onChange={(event) => setAccessForm({ ...accessForm, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
          <label><span>Role</span><select value={accessForm.role} onChange={(event) => {
            const role = event.target.value;
            const branchIds = canManageOrganization(role) ? [] : (accessForm.branchIds.length ? accessForm.branchIds : [defaultBranchId].filter(Boolean));
            const permissions = role === "Admin"
              ? ["staff.invite", "staff.invite_cross_branch", "staff.manage"].filter((id) => capabilities.permissions.some((permission) => permission.id === id))
              : [];
            setAccessForm({ ...accessForm, role, branchIds, modules: moduleOptionsFor(role, branchIds), permissions, confirmOrganizationAccess: false });
          }}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
          <fieldset className="full-span invitation-options"><legend>Branch access</legend>{canManageOrganization(accessForm.role) ? <p>This role has organization-wide access without a branch assignment.</p> : <div>{allowedBranches.map((branch) => <label key={branch.id}><input type="checkbox" disabled={!capabilities.organizationManager} checked={accessForm.branchIds.includes(branch.id)} onChange={(event) => {
            const branchIds = event.target.checked ? [...accessForm.branchIds, branch.id] : accessForm.branchIds.filter((id) => id !== branch.id);
            setAccessForm({ ...accessForm, branchIds, modules: accessForm.modules.filter((moduleId) => moduleOptionsFor(accessForm.role, branchIds).includes(moduleId)) });
          }} /><span>{branch.name}</span></label>)}</div>}</fieldset>
          <fieldset className="full-span invitation-options"><legend>Modules</legend><div>{moduleOptionsFor(accessForm.role, accessForm.branchIds).map((moduleId) => <label key={moduleId}><input type="checkbox" disabled={moduleId === "pos" && !canManageOrganization(accessForm.role)} checked={accessForm.modules.includes(moduleId)} onChange={(event) => setAccessForm({ ...accessForm, modules: event.target.checked ? [...accessForm.modules, moduleId] : accessForm.modules.filter((id) => id !== moduleId) })} /><span>{moduleLabel(moduleId)}</span></label>)}</div></fieldset>
          {capabilities.permissions?.length > 0 && <fieldset className="full-span invitation-options"><legend>Permissions</legend><div>{capabilities.permissions.map((permission) => <label key={permission.id}><input type="checkbox" checked={accessForm.permissions.includes(permission.id)} onChange={(event) => setAccessForm({ ...accessForm, permissions: event.target.checked ? [...accessForm.permissions, permission.id] : accessForm.permissions.filter((id) => id !== permission.id) })} /><span>{permission.label}</span></label>)}</div></fieldset>}
          {canManageOrganization(accessForm.role) && accessForm.role !== accessTarget.role && <label className="full-span confirmation-check"><input required type="checkbox" checked={accessForm.confirmOrganizationAccess} onChange={(event) => setAccessForm({ ...accessForm, confirmOrganizationAccess: event.target.checked })} /><span>Confirm organization-wide administrator access.</span></label>}
        </div>
        {error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}
        <div className="modal-actions"><button className="ghost-button" type="button" onClick={() => setAccessTarget(null)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save access"}</button></div>
      </form></div>}
      {linkTarget && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Connect login"><form className="modal-card" onSubmit={(event) => { event.preventDefault(); void applyLink(linkTarget, linkChoice); }}>
        <button className="modal-close" type="button" onClick={() => setLinkTarget(null)}><X size={18} /></button>
        <SectionHeader icon={UserCheck} title={`Connect a login to ${linkTarget.name}`} action={`${unlinkedAccounts.length} available`} />
        {unlinkedAccounts.length ? (
          <>
            <div className="form-grid">
              <label className="full-span">
                <span>Login</span>
                <select required value={linkChoice} onChange={(event) => setLinkChoice(event.target.value)}>
                  <option value="">Select a login…</option>
                  {unlinkedAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} · {account.email} · {account.role}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="modal-hint">The connected login gets My Workspace, attendance, and FaceTrack for this staff profile.</p>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setLinkTarget(null)}>Cancel</button>
              <button className="primary-button" disabled={linking || !linkChoice}>{linking ? "Connecting..." : "Connect login"}</button>
            </div>
          </>
        ) : (
          <>
            <EmptyState title="No unconnected logins" copy="Every login already has a staff profile. Invite a member to create a new one." />
            <div className="modal-actions"><button className="ghost-button" type="button" onClick={() => setLinkTarget(null)}>Close</button></div>
          </>
        )}
      </form></div>}
    </section>
  );
}

function StaffRecordPage({ person, account, onClock, onEdit }) {
  const services = splitList(person.services);
  return (
    <section className="surface-panel staff-record-page">
      <header className="staff-record-hero">
        <ClientAvatar client={{ fullName: person.name, photo: person.photo }} size="large" />
        <div>
          <p className="eyebrow">{person.role || "Clinic team"}</p>
          <h2>{person.name}</h2>
          <span>{splitList(person.branches).join(", ") || person.branch || "Branch not assigned"}</span>
        </div>
        <div className="staff-record-actions">
          <button className="secondary-button" type="button" onClick={onClock}><Clock size={16} /> Update attendance</button>
          <button className="primary-button" type="button" onClick={onEdit}><Edit3 size={16} /> Edit profile</button>
        </div>
      </header>

      <div className="record-grid staff-record-summary">
        <RecordItem label="Status" value={person.status} />
        <RecordItem label="Attendance" value={person.attendance} />
        <RecordItem label="Schedule" value={person.schedule} />
        <RecordItem label="Assigned branches" value={splitList(person.branches).join(", ") || person.branch} />
        <RecordItem label="Employment status" value={person.employmentStatus} />
        <RecordItem label="Employment date" value={formatDate(person.employmentDate)} />
        <RecordItem label="Date of birth" value={formatDate(person.birthDate)} />
        <RecordItem label="Address" value={person.address} />
        <RecordItem label="Emergency contact" value={[person.emergencyContact, person.emergencyPhone].filter(Boolean).join(" · ")} />
        <RecordItem label="Phone" value={person.phone} />
        <RecordItem label="Commission" value={`${Number(person.commissionRate || 0)}%${person.commissionType ? ` · ${person.commissionType}` : ""}`} />
        <RecordItem label="Login" value={account?.email || "Not connected"} />
        <RecordItem label="Login role" value={account?.role || "Not connected"} />
      </div>

      <section className="staff-record-services">
        <div><Sparkles size={18} /><strong>Assigned services</strong></div>
        <div>{services.length ? services.map((service) => <span key={service}>{service}</span>) : <small>No services assigned.</small>}</div>
      </section>
    </section>
  );
}

function AcceptInvitationScreen({ token, session, onLogin, onLogout }) {
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/");
  const [loading, setLoading] = useState(true);
  useEffect(() => { inspectInvitation(token).then((result) => setInvitation(result.invitation)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [session?.email, token]);
  const emailMismatch = Boolean(session?.email && invitation?.email && session.email.toLowerCase() !== invitation.email.toLowerCase());
  async function signIn(event) {
    event.preventDefault(); setError(""); setLoading(true);
    try { await onLogin(invitation.email, password); setPassword(""); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  async function submit(event) {
    event.preventDefault(); setError("");
    if (!invitation.accountExists && password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const result = await acceptInvitation(token, { password, termsAccepted, privacyAccepted });
      setRedirectPath(result.redirectPath || "/");
      setDone(true);
      window.history.replaceState({}, "", "/accept-invitation");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  if (invitation?.accountExists && !session) {
    return <main className="login-page"><section className="login-panel"><form className="login-card" onSubmit={signIn}><BrandWordmark className="login-logo" /><p className="eyebrow">Sign in to continue</p><h2>This invitation is for an existing ZenshoTech user</h2><p className="login-helper">Sign in as <strong>{invitation.email}</strong>, then review and accept the invitation.</p><label><span>Email</span><input value={invitation.email} readOnly /></label><label><span>Password</span><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}<button className="primary-button full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button></form></section></main>;
  }
  return <main className="login-page"><section className="login-panel"><form className="login-card invitation-accept-card" onSubmit={submit}><BrandWordmark className="login-logo" />
    {done ? <><p className="eyebrow">Invitation accepted</p><h2>Your workspace is ready</h2><p className="login-helper">Your approved role, branch access, modules, and permissions are active.</p><a className="primary-button full" href={redirectPath}>Continue to your dashboard</a></> : <><p className="eyebrow">Secure organization invitation</p><h2>{loading && !invitation ? "Checking invitation..." : invitation ? `Welcome, ${invitation.firstName || invitation.name}` : "Invitation unavailable"}</h2>{invitation && <div className="invitation-summary"><div><span>Organization</span><strong>{invitation.organization?.name}</strong></div><div><span>Branch</span><strong>{invitation.branches?.map((branch) => branch.name).join(", ") || "Organization-wide"}</strong></div><div><span>Role</span><strong>{invitation.role}</strong></div><div><span>Expires</span><strong>{new Date(invitation.expiresAt).toLocaleDateString("en-PH")}</strong></div></div>}{invitation && invitation.status !== "Pending" && <div className="inline-state danger"><AlertCircle size={16} />{invitation.status === "Expired" ? "This invitation has expired. Ask an administrator to resend it." : invitation.status === "Revoked" ? "This invitation was cancelled. Contact your administrator." : "This invitation has already been accepted."}</div>}{emailMismatch && <div className="inline-state danger"><AlertCircle size={16} />This invitation belongs to {invitation.email}, but you are signed in as {session.email}.</div>}{emailMismatch && <button className="ghost-button full" type="button" onClick={onLogout}>Sign out and use the invited email</button>}{invitation && !invitation.accountExists && !session && <><label><span>Create password</span><input required type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label><span>Confirm password</span><input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label><p className="login-helper">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p></>} {invitation?.status === "Pending" && !emailMismatch && <><label className="confirmation-check"><input required type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I accept the applicable Terms of Service.</span></label><label className="confirmation-check"><input required type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>I acknowledge the Privacy Policy.</span></label></>}{error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}<button className="primary-button full" disabled={loading || !invitation || invitation.status !== "Pending" || emailMismatch}>{loading ? "Joining..." : "Accept invitation"}</button></>}
  </form></section></main>;
}

function BranchesModule({ branchScope, branchRecords, staff, transactions, appointments, accounts, canManage, onCreateBranch, onUpdateBranch, onArchiveBranch, onReactivateBranch, onManageCompany, onManageEmployees, createRequest = 0, onCreateRequestHandled, globalSearch }) {
  const [showCreate, setShowCreate] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [branchToArchive, setBranchToArchive] = useState(null);
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Active");
  const branchModuleOptions = useMemo(() => navItems.filter((item) => !["my-workspace", "applications", "branches", "settings"].includes(item.id)), []);
  const emptyForm = useCallback(() => ({
    name: "", code: "", city: "", address: "", phone: "", email: "", timezone: "Asia/Manila",
    hours: operatingHoursSummary(defaultBranchOperatingHours), operatingHours: freshOperatingHours(), roomCount: 0, couches: 0, devices: "", image: "", status: "Active", managerIds: [],
    enabledModules: branchModuleOptions.map((module) => module.id),
  }), [branchModuleOptions]);
  const [form, setForm] = useState(() => ({
    name: "", code: "", city: "", address: "", phone: "", email: "", timezone: "Asia/Manila",
    hours: operatingHoursSummary(defaultBranchOperatingHours), operatingHours: freshOperatingHours(), roomCount: 0, couches: 0, devices: "", image: "", status: "Active", managerIds: [], enabledModules: [],
  }));
  const [photoError, setPhotoError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const totalSales = transactions.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const activeBranches = branchRecords.filter((branch) => branch.status === "Active");
  const filteredBranches = branchRecords.filter((branch) => {
    if (statusFilter !== "All" && branch.status !== statusFilter) return false;
    const haystack = `${branch.name} ${branch.code} ${branch.city} ${branch.address} ${branch.email}`.toLowerCase();
    return haystack.includes(globalSearch.trim().toLowerCase());
  });

  function resetEditor() {
    setForm(emptyForm());
    setPhotoError("");
    setSaveError("");
    setBranchToEdit(null);
    setShowCreate(false);
  }

  const openCreate = useCallback(() => {
    setForm(emptyForm());
    setPhotoError("");
    setSaveError("");
    setBranchToEdit(null);
    setShowCreate(true);
  }, [emptyForm]);

  useEffect(() => {
    if (!createRequest || !canManage) return;
    openCreate();
    onCreateRequestHandled?.(0);
  }, [canManage, createRequest, onCreateRequestHandled, openCreate]);

  function openEdit(branch) {
    setForm({
      name: branch.name || "",
      code: branch.code || "",
      city: branch.city || "",
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      timezone: branch.timezone || "Asia/Manila",
      hours: branch.hours || operatingHoursSummary(branch.operatingHours),
      operatingHours: freshOperatingHours(branch.operatingHours),
      roomCount: branch.rooms?.length ?? 0,
      couches: Number(branch.couches || 0),
      devices: Array.isArray(branch.devices) ? branch.devices.join(", ") : "",
      image: branch.image || "",
      status: branch.status || "Active",
      managerIds: (branch.managers || []).map((manager) => manager.id),
      enabledModules: branch.enabledModules?.length ? branch.enabledModules : branchModuleOptions.map((module) => module.id),
    });
    setPhotoError("");
    setSaveError("");
    setBranchToEdit(branch);
    setShowCreate(false);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      let image = form.image;
      if (image.startsWith("data:")) {
        const uploaded = await uploadImageAsset(image, "branch-photo", form.name);
        image = uploaded.asset.url;
      }
      const values = {
        ...form,
        image,
        hours: operatingHoursSummary(form.operatingHours),
        roomCount: Number(form.roomCount) || 0,
        couches: Number(form.couches) || 0,
        devices: form.devices.split(",").map((item) => item.trim()).filter(Boolean),
      };
      if (branchToEdit) await onUpdateBranch(branchToEdit, values);
      else await onCreateBranch(values);
      resetEditor();
    } catch (error) {
      setSaveError(error?.message || `Unable to ${branchToEdit ? "update" : "create"} this branch.`);
    } finally {
      setSaving(false);
    }
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setPhotoError("The clinic photo must be 3 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image: String(reader.result || "") }));
      setPhotoError("");
    };
    reader.readAsDataURL(file);
  }

  async function confirmArchive() {
    if (!branchToArchive) return;
    setArchiving(true);
    setArchiveError("");
    try {
      await onArchiveBranch(branchToArchive);
      setBranchToArchive(null);
    } catch (error) {
      setArchiveError(error?.message || "Unable to archive this branch.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="branches-workspace">
      <div className="branches-hero surface-panel">
        <div>
          <p className="eyebrow">Organization setup</p>
          <h2>Branches</h2>
          <p>Manage locations, operating details, rooms, and employee assignments from one place.</p>
        </div>
        {canManage && (
          <div className="branch-organization-actions">
            <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} /> Add branch</button>
            <button className="ghost-button" type="button" onClick={onManageCompany}><Settings size={17} /> Add / edit company</button>
          </div>
        )}
      </div>

      <div className="branch-summary-grid">
        <article><Store size={19} /><div><strong>{activeBranches.length}</strong><span>Active branches</span></div></article>
        <article><Users size={19} /><div><strong>{staff.length}</strong><span>Assigned employees</span></div></article>
        <article><CalendarDays size={19} /><div><strong>{appointments.filter((item) => item.date === today).length}</strong><span>Bookings today</span></div></article>
        <article><CircleDollarSign size={19} /><div><strong>{money.format(totalSales)}</strong><span>Recorded sales</span></div></article>
      </div>

      <div className="branch-list-toolbar compact-filter-toolbar">
        <label><span className="sr-only">Filter branch status</span><select aria-label="Filter branch status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option><option>Archived</option></select></label>
      </div>

      {!branchRecords.length ? (
        <div className="branch-empty surface-panel">
          <div className="branch-empty-icon"><Store size={28} /></div>
          <h3>Create the first clinic branch</h3>
          <p>Add each physical location first. Employees, rooms, appointments, inventory, and reports can then be assigned to the correct branch.</p>
          <div className="branch-onboarding-steps">
            <span><b>1</b> Add location details</span>
            <span><b>2</b> Assign rooms and staff</span>
            <span><b>3</b> Start branch operations</span>
          </div>
          {canManage && <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} /> Add first branch</button>}
        </div>
      ) : (
        <div className="surface-panel branch-management-table-wrap">
          {!filteredBranches.length ? <EmptyState title="No matching branches" copy="Try another search or status filter." /> : <table className="branch-management-table">
            <thead><tr><th>Branch</th><th>Contact</th><th>Manager</th><th>Employees</th><th>Modules</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{filteredBranches.map((item) => {
            const assignedStaff = staff.filter((person) => person.branch === item.name || splitList(person.branches).includes(item.name)).length;
            return (
              <tr key={item.id}>
                <td><div className="branch-table-name"><strong>{item.name}</strong><span>{item.code || "No code"} · {item.address || item.city || "Address pending"}</span></div></td>
                <td><div className="branch-table-name"><span>{item.phone || "No phone"}</span><span>{item.email || "No email"}</span></div></td>
                <td>{item.managers?.length ? item.managers.map((manager) => manager.name).join(", ") : "Unassigned"}</td>
                <td>{item.employeeCount ?? assignedStaff}</td>
                <td>{item.enabledModules?.length || 0} enabled</td>
                <td><StatusBadge status={item.status || "Active"} /></td>
                <td><div className="branch-row-actions">
                  <button type="button" onClick={() => openEdit(item)}><Eye size={14} /> View</button>
                  {canManage && <button type="button" onClick={() => openEdit(item)}><Edit3 size={14} /> Edit</button>}
                  {canManage && <button type="button" onClick={() => openEdit(item)}><LayoutGrid size={14} /> Modules</button>}
                  {canManage && <button type="button" onClick={() => onManageEmployees(item)}><Users size={14} /> Employees</button>}
                  {canManage && item.status === "Archived" && <button type="button" onClick={() => void onReactivateBranch(item)}><RefreshCw size={14} /> Reactivate</button>}
                  {canManage && item.status !== "Archived" && <button className="danger-text" type="button" onClick={() => { setArchiveError(""); setBranchToArchive(item); }}><Trash2 size={14} /> Archive</button>}
                </div></td>
              </tr>
            );
          })}</tbody></table>}
        </div>
      )}

      {(showCreate || branchToEdit) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={branchToEdit ? `Edit ${branchToEdit.name}` : "Add a clinic branch"}>
          <form className="modal-card branch-create-modal" onSubmit={submit}>
            <button className="modal-close" type="button" aria-label="Close" onClick={resetEditor} disabled={saving}><X size={18} /></button>
            <div className="section-title"><div className="section-icon"><Store size={18} /></div><div><p className="eyebrow">{branchToEdit ? "Branch management" : "New location"}</p><h2>{branchToEdit ? `Edit ${branchToEdit.name}` : "Add a clinic branch"}</h2></div></div>
            <div className="branch-photo-field">
              <div className={`branch-photo-preview ${form.image ? "has-photo" : ""}`}>
                {form.image ? <img src={form.image} alt="Clinic preview" /> : <><Camera size={25} /><strong>Add clinic cover photo</strong><span>JPG, PNG, or WebP · Maximum 3 MB</span></>}
              </div>
              <div className="branch-photo-actions">
                <label className="ghost-button branch-photo-button"><Upload size={16} /> {form.image ? "Replace photo" : "Choose photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} /></label>
                {form.image && <button className="ghost-button" type="button" onClick={() => setForm({ ...form, image: "" })}><Trash2 size={16} /> Remove</button>}
              </div>
              {photoError && <div className="inline-state danger"><AlertCircle size={16} /><span>{photoError}</span></div>}
            </div>
            {branchToEdit && (
              <div className="branch-registration-qr">
                <img src={`/api/public-registration/qr?branch=${encodeURIComponent(branchToEdit.name)}`} alt={`Client registration QR for ${branchToEdit.name}`} />
                <div><strong>Client self-registration QR</strong><span>Display this at reception so clients can create or update their unified ZenshoTech profile.</span><a href={`/client-register?branch=${encodeURIComponent(branchToEdit.name)}`} target="_blank" rel="noreferrer">Open registration form</a></div>
              </div>
            )}
            <div className="form-grid">
              <label><span>Branch name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. ZenshoTech Makati" /></label>
              <label><span>Unique branch code</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="e.g. ZEN-MKT" /></label>
              <label><span>City</span><input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" /></label>
              <label className="full-span"><span>Complete address</span><input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Building, street, city" /></label>
              <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Branch contact number" /></label>
              <label><span>Email address</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="branch@example.com" /></label>
              <label><span>Time zone</span><select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option>Asia/Manila</option><option>Asia/Singapore</option><option>Asia/Tokyo</option><option>UTC</option></select></label>
              <label><span>Number of rooms</span><input min="0" max="50" type="number" value={form.roomCount} onChange={(event) => setForm({ ...form, roomCount: event.target.value })} /></label>
              <label><span>Number of couches</span><input min="0" max="50" type="number" value={form.couches} onChange={(event) => setForm({ ...form, couches: event.target.value })} /></label>
              <fieldset className="full-span branch-hours-fieldset"><legend>Operating hours by day</legend><div className="branch-hours-grid">{operatingDayKeys.slice(1).concat("sunday").map((dayKey) => {
                const day = form.operatingHours?.[dayKey] || defaultBranchOperatingHours[dayKey];
                return <div className={`branch-hours-row ${day.closed ? "is-closed" : ""}`} key={dayKey}><strong>{dayKey[0].toUpperCase() + dayKey.slice(1)}</strong><label><span className="sr-only">{dayKey} opens</span><input type="time" value={day.open} disabled={day.closed} onChange={(event) => setForm((current) => ({ ...current, operatingHours: { ...current.operatingHours, [dayKey]: { ...current.operatingHours[dayKey], open: event.target.value } } }))} /></label><span>to</span><label><span className="sr-only">{dayKey} closes</span><input type="time" value={day.close} disabled={day.closed} onChange={(event) => setForm((current) => ({ ...current, operatingHours: { ...current.operatingHours, [dayKey]: { ...current.operatingHours[dayKey], close: event.target.value } } }))} /></label><label className="branch-hours-closed"><input type="checkbox" checked={Boolean(day.closed)} onChange={(event) => setForm((current) => ({ ...current, operatingHours: { ...current.operatingHours, [dayKey]: { ...current.operatingHours[dayKey], closed: event.target.checked } } }))} /><span>Closed</span></label></div>;
              })}</div><small>Default: Monday-Saturday 10:00 AM-7:00 PM; Sunday 1:00 PM-5:00 PM. Noon remains available.</small></fieldset>
              <label><span>Devices</span><input value={form.devices} onChange={(event) => setForm({ ...form, devices: event.target.value })} placeholder="Comma-separated" /></label>
              <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option><option>Archived</option></select></label>
              <label className="full-span"><span>Assigned manager(s)</span><select multiple value={form.managerIds} onChange={(event) => setForm({ ...form, managerIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{(accounts || []).filter((account) => account.status === "Active" && !canManageOrganization(account.role)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}</select><small>Use Ctrl/Cmd to select more than one manager.</small></label>
              <fieldset className="full-span branch-module-fieldset"><legend>Enabled modules</legend><div>{branchModuleOptions.map((module) => <label key={module.id}><input type="checkbox" checked={form.enabledModules.includes(module.id)} onChange={(event) => setForm((current) => ({ ...current, enabledModules: event.target.checked ? [...current.enabledModules, module.id] : current.enabledModules.filter((id) => id !== module.id) }))} /><span>{module.label}</span></label>)}</div></fieldset>
            </div>
            {saveError && <div className="inline-state danger"><AlertCircle size={16} /><span>{saveError}</span></div>}
            <div className="modal-actions"><button className="ghost-button" type="button" onClick={resetEditor} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : branchToEdit ? "Save branch changes" : "Create branch"}</button></div>
          </form>
        </div>
      )}

      {branchToArchive && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-label={`Archive ${branchToArchive.name}`}>
          <div className="modal-card branch-delete-modal">
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setBranchToArchive(null)} disabled={archiving}><X size={18} /></button>
            <div className="branch-delete-heading"><div className="branch-delete-icon"><Trash2 size={20} /></div><div><p className="eyebrow">Preserve history</p><h2>Archive {branchToArchive.name}?</h2></div></div>
            <p>The branch will disappear from active switching and new operational work. Clients, appointments, rooms, reports, audit history, and other records remain intact.</p>
            {archiveError && <div className="inline-state danger"><AlertCircle size={16} /><span>{archiveError}</span></div>}
            <div className="modal-actions"><button className="ghost-button" type="button" onClick={() => setBranchToArchive(null)} disabled={archiving}>Cancel</button><button className="branch-delete-button" type="button" onClick={() => void confirmArchive()} disabled={archiving}>{archiving ? "Archiving..." : "Archive branch"}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

function ExpensesModule({ expenses, openModal, globalSearch }) {
  const totals = expenses.reduce((map, expense) => {
    map[expense.category] = (map[expense.category] || 0) + Number(expense.amount || 0);
    return map;
  }, {});

  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={ReceiptText} title="Expense Tracking" action={`${expenses.length} records`} />
        <SmartTable
          rows={expenses}
          globalSearch={globalSearch}
          columns={[
            { key: "date", label: "Date" },
            { key: "name", label: "Expense" },
            { key: "category", label: "Category" },
            { key: "branch", label: "Branch" },
            { key: "amount", label: "Amount", render: (row) => money.format(row.amount) },
            { key: "method", label: "Method" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </div>
      <div className="surface-panel">
        <SectionHeader icon={BarChart3} title="Expenses by Category" action="This month" />
        <RankList rows={Object.entries(totals).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)} formatter={(value) => money.format(value)} />
      </div>
    </section>
  );
}

function ReportsModule({ stats, transactions, expenses, appointments, inventory, staff, clients, globalSearch }) {
  const reportTabs = ["Daily Sales", "Annual Sales", "Expenses", "Monthly Net Profit", "Staff Commission", "Product Inventory"];
  const [reportView, setReportView] = useState("Daily Sales");
  const currentYear = todayDate().slice(0, 4);
  const activeTransactions = transactions.filter((transaction) => transaction.status !== "Void" && !transaction.testMode);
  const months = Array.from({ length: 12 }, (_, index) => `${currentYear}-${String(index + 1).padStart(2, "0")}`);

  const dailySalesRows = Object.values(
    activeTransactions.reduce((map, transaction) => {
      const key = transaction.date;
      const current = map[key] ?? { id: key, date: key, transactions: 0, services: 0, products: 0, total: 0 };
      current.transactions += 1;
      current.services += transaction.items.filter((item) => item.type === "Service").reduce((sum, item) => sum + Number(item.qty || 1), 0);
      current.products += transaction.items.filter((item) => item.type === "Product").reduce((sum, item) => sum + Number(item.qty || 1), 0);
      current.total += Number(transaction.total || 0);
      map[key] = current;
      return map;
    }, {}),
  ).sort((a, b) => b.date.localeCompare(a.date));

  const annualSalesRows = months.map((month) => {
    const monthTransactions = activeTransactions.filter((transaction) => transaction.date?.startsWith(month));
    return {
      id: month,
      month,
      transactions: monthTransactions.length,
      sales: monthTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0),
    };
  });

  const expenseRows = Object.values(
    expenses.reduce((map, expense) => {
      const current = map[expense.category] ?? { id: expense.category, category: expense.category, count: 0, amount: 0, approved: 0 };
      current.count += 1;
      current.amount += Number(expense.amount || 0);
      if (expense.status === "Approved") current.approved += 1;
      map[expense.category] = current;
      return map;
    }, {}),
  ).sort((a, b) => b.amount - a.amount);

  const netProfitRows = months.map((month) => {
    const sales = activeTransactions.filter((transaction) => transaction.date?.startsWith(month)).reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const operatingExpenses = expenses.filter((expense) => expense.date?.startsWith(month)).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return { id: month, month, sales, expenses: operatingExpenses, netProfit: sales - operatingExpenses };
  });

  const commissionRows = staff.map((person) => {
    const staffSales = activeTransactions.filter((transaction) => transaction.staff === person.name);
    const sales = staffSales.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const rate = Number(person.commissionRate || 0);
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      branch: person.branch,
      sales,
      rate,
      commission: Math.round((sales * rate) / 100),
    };
  });

  const inventoryRows = inventory.map((item) => ({
    ...item,
    balance: Number(item.stock || 0) - Number(item.beginning || 0),
    status: stockStatus(item),
  }));

  const reportRows = [
    { name: "Reports - Daily Sales", value: money.format(stats.revenueToday), owner: "Cashier", export: "PDF / CSV" },
    { name: "Reports - Annual Sales", value: money.format(annualSalesRows.reduce((sum, row) => sum + row.sales, 0)), owner: "Owner", export: "Excel / CSV" },
    { name: "Reports - Expenses", value: money.format(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)), owner: "Owner", export: "PDF" },
    { name: "Reports - Monthly Net Profit", value: money.format(stats.netProfit), owner: "Owner", export: "PDF" },
    { name: "Reports - Staff Commission", value: `${staff.length} staff`, owner: "Branch Manager", export: "Excel" },
    { name: "Reports - Product Inventory", value: `${inventory.length} items`, owner: "Inventory Staff", export: "CSV" },
  ];

  const maxAnnualSales = Math.max(1, ...annualSalesRows.map((row) => row.sales));

  function renderReportDetail() {
    if (reportView === "Annual Sales") {
      return (
        <>
          <ChartBars values={annualSalesRows.map((row) => Math.max(6, (row.sales / maxAnnualSales) * 100))} />
          <SmartTable
            rows={annualSalesRows}
            globalSearch={globalSearch}
            columns={[
              { key: "month", label: "Month" },
              { key: "transactions", label: "Transactions" },
              { key: "sales", label: "Sales", render: (row) => money.format(row.sales) },
            ]}
          />
        </>
      );
    }

    if (reportView === "Expenses") {
      return (
        <SmartTable
          rows={expenseRows}
          globalSearch={globalSearch}
          columns={[
            { key: "category", label: "Expense" },
            { key: "count", label: "Records" },
            { key: "amount", label: "Amount", render: (row) => money.format(row.amount) },
            { key: "approved", label: "Approved" },
          ]}
        />
      );
    }

    if (reportView === "Monthly Net Profit") {
      return (
        <SmartTable
          rows={netProfitRows}
          globalSearch={globalSearch}
          columns={[
            { key: "month", label: "Month" },
            { key: "sales", label: "Sales", render: (row) => money.format(row.sales) },
            { key: "expenses", label: "Expenses", render: (row) => money.format(row.expenses) },
            { key: "netProfit", label: "Net profit", render: (row) => money.format(row.netProfit) },
          ]}
        />
      );
    }

    if (reportView === "Staff Commission") {
      return (
        <SmartTable
          rows={commissionRows}
          globalSearch={globalSearch}
          columns={[
            { key: "name", label: "Staff" },
            { key: "role", label: "Role" },
            { key: "branch", label: "Branch" },
            { key: "sales", label: "Sales", render: (row) => money.format(row.sales) },
            { key: "rate", label: "Rate", render: (row) => `${row.rate}%` },
            { key: "commission", label: "Commission", render: (row) => money.format(row.commission) },
          ]}
        />
      );
    }

    if (reportView === "Product Inventory") {
      return (
        <SmartTable
          rows={inventoryRows}
          globalSearch={globalSearch}
          columns={[
            { key: "item", label: "Product" },
            { key: "branch", label: "Branch" },
            { key: "beginning", label: "Stock in" },
            { key: "stock", label: "Balance" },
            { key: "balance", label: "Variance" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      );
    }

    return (
      <SmartTable
        rows={dailySalesRows}
        globalSearch={globalSearch}
        columns={[
          { key: "date", label: "Date" },
          { key: "transactions", label: "Transactions" },
          { key: "services", label: "Services" },
          { key: "products", label: "Products" },
          { key: "total", label: "Total", render: (row) => money.format(row.total) },
        ]}
      />
    );
  }

  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={BarChart3} title="Reports and Analytics" action={reportView} />
        <div className="report-filters">
          <label><span>Date range</span><input type="month" defaultValue={todayDate().slice(0, 7)} /></label>
          <label><span>Branch</span><select><option>All branches</option>{branches.map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
          <label><span>Staff</span><select><option>All staff</option>{staff.map((person) => <option key={person.id}>{person.name}</option>)}</select></label>
          <button className="secondary-button small" type="button" onClick={() => window.print()}><Printer size={16} /> Print</button>
        </div>
        <div className="segmented-control report-tabs" role="tablist" aria-label="Report type">
          {reportTabs.map((tab) => (
            <button className={reportView === tab ? "active" : ""} key={tab} type="button" onClick={() => setReportView(tab)}>
              {tab}
            </button>
          ))}
        </div>
        {renderReportDetail()}
      </div>
      <div className="surface-panel">
        <SectionHeader icon={Activity} title="Report Index" action={`${reportRows.length} pages`} />
        <div className="role-detail-list report-index-list">
          {reportRows.map((row) => (
            <article className="role-detail-row" key={row.name}>
              <div>
                <strong>{row.name}</strong>
                <span>{row.owner} / {row.export}</span>
              </div>
              <b>{row.value}</b>
            </article>
          ))}
        </div>
        <div className="mini-metrics vertical">
          <RecordPill label="Transactions" value={transactions.length} />
          <RecordPill label="Appointments" value={appointments.length} />
          <RecordPill label="Expenses" value={expenses.length} />
          <RecordPill label="Inventory alerts" value={stats.lowStock.length} />
          <RecordPill label="Returning clients" value={clients.filter((client) => client.retention === "Returning").length} />
        </div>
      </div>
    </section>
  );
}

function BookingPortal({ services, staff, onSubmit }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    submissionId: globalThis.crypto?.randomUUID?.() || createId("booking"),
    serviceId: services[0]?.id ?? "",
    branch: branches[0].name,
    date: todayDate(),
    time: "10:00",
    staff: "Any available",
    fullName: "",
    mobile: "",
    email: "",
    concern: "",
    marketingOptIn: true,
    privacyConsent: false,
  });
  const service = services.find((item) => item.id === form.serviceId);

  async function submit(event) {
    event.preventDefault();
    if (!form.fullName || !form.mobile) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit(form);
      setStep(4);
    } catch (submitError) {
      setError(submitError?.message || "Unable to submit booking request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="booking-page">
      <div className="booking-hero">
        <img src={assets.clinic} alt="Clinic interior" />
        <div>
          <p className="eyebrow">Book a Consultation</p>
          <h2>The brand behind beautiful faces</h2>
          <p>Choose your treatment, preferred branch, and time. The clinic team will confirm your appointment request.</p>
        </div>
      </div>
      <form className="booking-card" onSubmit={submit}>
        {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
        <div className="stepper">
          {["Treatment", "Schedule", "Details", "Confirm"].map((label, index) => (
            <button type="button" key={label} className={step === index + 1 ? "active" : ""} onClick={() => setStep(index + 1)}>
              {index + 1}. {label}
            </button>
          ))}
        </div>
        {step === 1 && (
          <div className="form-grid">
            <label className="span-2"><span>Choose treatment</span><select value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })}>{services.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} - {servicePriceLabel(item)}</option>)}</select></label>
            <RecordItem label="Category" value={service?.category ?? "Treatment"} />
            <RecordItem label="Duration" value={`${service?.duration ?? 0} minutes`} />
            <button className="primary-button" type="button" onClick={() => setStep(2)}>Continue</button>
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            <label><span>Branch</span><select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>{branches.map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
            <label><span>Date</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label><span>Time</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
            <label><span>Preferred staff</span><select value={form.staff} onChange={(event) => setForm({ ...form, staff: event.target.value })}><option>Any available</option>{staff.filter((person) => person.branch === form.branch && person.status !== "Inactive").map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label>
            <button className="primary-button" type="button" onClick={() => setStep(3)}>Continue</button>
          </div>
        )}
        {step === 3 && (
          <div className="form-grid">
            <label><span>Full name</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
            <label><span>Mobile number</span><input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} required /></label>
            <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="span-2"><span>Concern or goal</span><textarea value={form.concern} onChange={(event) => setForm({ ...form, concern: event.target.value })} placeholder="Tell us what you want to improve or ask about" /></label>
            <label className="checkbox-field"><input type="checkbox" checked={form.marketingOptIn} onChange={(event) => setForm({ ...form, marketingOptIn: event.target.checked })} /> <span>I agree to receive appointment reminders and care updates.</span></label>
            <label className="checkbox-field"><input type="checkbox" required checked={form.privacyConsent} onChange={(event) => setForm({ ...form, privacyConsent: event.target.checked })} /> <span>I consent to the collection and use of my information for this booking.</span></label>
            <button className="primary-button" type="button" onClick={() => setStep(4)}>Review</button>
          </div>
        )}
        {step === 4 && (
          <div className="confirmation-panel">
            <Sparkles size={24} />
            <h3>{form.fullName ? "Ready to submit" : "Complete your details"}</h3>
            <p>{service?.name} at {form.branch} on {form.date} at {form.time}</p>
            <button className="primary-button" type="submit" disabled={saving || !form.fullName || !form.mobile || !form.privacyConsent}>
              {saving ? "Submitting..." : "Submit booking request"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function PaymentMethodsSettings({ settings, onSave, canConfigure }) {
  const [methods, setMethods] = useState(() => configuredPaymentMethods(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMethods(configuredPaymentMethods(settings));
  }, [settings]);

  function updateMethod(index, patch) {
    setMethods((current) => current.map((method, itemIndex) => itemIndex === index ? { ...method, ...patch } : method));
  }

  function moveMethod(index, direction) {
    setMethods((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit() {
    const cleaned = methods.map((method, index) => ({
      id: method.id || createId("payment"),
      name: String(method.name || "").trim(),
      active: method.active !== false,
      order: index,
    })).filter((method) => method.name);
    if (!cleaned.length || !cleaned.some((method) => method.active)) {
      setError("Add and enable at least one payment method.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ paymentMethods: cleaned });
    } catch (saveError) {
      setError(saveError.message || "Payment methods could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-panel full-span payment-method-settings">
      <SectionHeader icon={WalletCards} title="Payment Methods" action={canConfigure ? "Super Admin configuration" : "View only"} />
      <p className="section-copy">The enabled methods below appear in POS, split payment, expense recording, and transaction reports in this exact order.</p>
      <div className="payment-method-config-list">
        {methods.map((method, index) => (
          <div className="payment-method-config-row" key={method.id || index}>
            <span className="payment-method-order">{index + 1}</span>
            <input
              aria-label={`Payment method ${index + 1}`}
              disabled={!canConfigure}
              value={method.name}
              onChange={(event) => updateMethod(index, { name: event.target.value })}
            />
            <label className="checkbox-field compact">
              <input disabled={!canConfigure} type="checkbox" checked={method.active !== false} onChange={(event) => updateMethod(index, { active: event.target.checked })} />
              <span>Enabled</span>
            </label>
            {canConfigure && (
              <div className="payment-method-row-actions">
                <button type="button" disabled={index === 0} onClick={() => moveMethod(index, -1)} aria-label={`Move ${method.name} up`}>↑</button>
                <button type="button" disabled={index === methods.length - 1} onClick={() => moveMethod(index, 1)} aria-label={`Move ${method.name} down`}>↓</button>
                <button type="button" className="danger-text" onClick={() => setMethods((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${method.name}`}><Trash2 size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
      {canConfigure && (
        <div className="panel-actions">
          <button className="secondary-button small" type="button" onClick={() => setMethods((current) => [...current, { id: createId("payment"), name: "", active: true, order: current.length }])}><Plus size={16} /> Add method</button>
          <button className="primary-button small" type="button" onClick={submit} disabled={saving}><Check size={16} /> {saving ? "Saving..." : "Save payment methods"}</button>
        </div>
      )}
    </div>
  );
}

function SettingsModule({ settings, users, auditLogs, discounts, promotions = [], consentTemplates = [], openModal, globalSearch, saveSettings, canConfigurePayments }) {
  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={Settings} title="Settings" action="Admin & owner controls" />
        <div className="record-grid">
          <RecordItem label="Company" value={settings.company} />
          <RecordItem label="Receipt footer" value={settings.receiptFooter} />
          <RecordItem label="Tax mode" value={`${settings.taxMode} / ${settings.taxRate}%`} />
          <RecordItem label="SMS credits" value={settings.smsCredits} />
          <RecordItem label="Backup" value={settings.backup} />
          <RecordItem label="Plan management" value={settings.hiddenSaasPlans ? "Hidden for internal clinic use" : "Visible"} />
        </div>
        <button className="primary-button small" type="button" onClick={() => openModal("settings", settings)}>
          <Edit3 size={16} /> Edit settings
        </button>
      </div>
      <div className="surface-panel">
        <SectionHeader icon={ShieldCheck} title="Roles and Permissions" action={`${users.length} users`} />
        <div className="message-list">
          {users.slice(0, 6).map((user) => (
            <MessageItem key={user.id} title={`${user.name} - ${user.role}`} copy={`${roleAccess[user.role]?.length ?? 0} modules / ${user.branch}`} />
          ))}
        </div>
      </div>
      <PaymentMethodsSettings settings={settings} onSave={saveSettings} canConfigure={canConfigurePayments} />
      <div className="surface-panel full-span">
        <SectionHeader icon={Activity} title="Audit Log" action="Sensitive actions" />
        <SmartTable
          rows={auditLogs}
          globalSearch={globalSearch}
          pageSize={8}
          columns={[
            { key: "time", label: "Time" },
            { key: "actor", label: "Actor" },
            { key: "role", label: "Role" },
            { key: "area", label: "Area" },
            { key: "action", label: "Action" },
            { key: "details", label: "Details" },
          ]}
        />
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={Gift} title="Discounts and Add-ons" action="Configurable" />
        <button className="primary-button small" type="button" onClick={() => openModal("discount")}><Plus size={16} /> New discount</button>
        <SmartTable
          rows={discounts}
          columns={[
            { key: "name", label: "Discount" },
            { key: "type", label: "Type" },
            { key: "value", label: "Value" },
            { key: "permission", label: "Permission" },
            { key: "applicable", label: "Applicable" },
            { key: "active", label: "Status", render: (row) => <StatusBadge status={row.active ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (row) => <button type="button" onClick={() => openModal("discount", row)}><Edit3 size={15} /> Edit</button>, exportValue: () => "" },
          ]}
        />
        <div className="workflow-chips add-ons">
          {["Automated SMS Marketing", "SMS credit top-up", "Retraining / face-to-face meetings", "Extra branch", "Extra user", "Advanced analytics", "Custom reports"].map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={Sparkles} title="Promotional Pricing" action={`${promotions.filter((item) => item.active).length} active`} />
        <button className="primary-button small" type="button" onClick={() => openModal("promotion")}><Plus size={16} /> New promotion</button>
        <SmartTable rows={promotions} globalSearch={globalSearch} columns={[
          { key: "name", label: "Promotion" },
          { key: "discountType", label: "Type" },
          { key: "value", label: "Value", render: (row) => row.discountType === "Percentage" ? `${row.value}%` : money.format(row.value) },
          { key: "startDate", label: "Starts", render: (row) => formatDate(row.startDate) },
          { key: "endDate", label: "Ends", render: (row) => formatDate(row.endDate) },
          { key: "active", label: "Status", render: (row) => <StatusBadge status={row.active ? "Active" : "Inactive"} /> },
          { key: "actions", label: "", render: (row) => <button type="button" onClick={() => openModal("promotion", row)}><Edit3 size={15} /> Edit</button>, exportValue: () => "" },
        ]} />
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={FileText} title="Digital Consent Form Templates" action={`${consentTemplates.length} versions`} />
        <button className="primary-button small" type="button" onClick={() => openModal("consent-template")}><Plus size={16} /> New form version</button>
        <SmartTable rows={consentTemplates} columns={[
          { key: "name", label: "Form" }, { key: "version", label: "Version" },
          { key: "active", label: "Status", render: (row) => <StatusBadge status={row.active ? "Active" : "Inactive"} /> },
          { key: "actions", label: "", render: (row) => <button type="button" onClick={() => openModal("consent-template", row)}><Edit3 size={15} /> Edit</button>, exportValue: () => "" },
        ]} />
      </div>
    </section>
  );
}

function SupportModule() {
  const supportChannels = [
    { icon: PhoneCall, title: "Priority support line", copy: "0917 109 8462 / 9:00 AM-8:00 PM daily" },
    { icon: Mail, title: "Operations inbox", copy: "Contact your administrator for account, billing, and access requests" },
    { icon: MessageSquareText, title: "Launch group chat", copy: "Front desk, cashier, clinical, inventory, and marketing coordinators" },
  ];
  const onboardingSteps = [
    "Branch profile and receipt settings confirmed",
    "Services, packages, and product catalog reviewed",
    "Role access, audit log, and sensitive records checked",
    "Front desk, POS, and treatment workflows rehearsed",
  ];
  const resources = [
    { icon: FileText, title: "User manual", copy: "Step-by-step workflows for bookings, POS, client records, treatment notes, inventory, and reports." },
    { icon: Camera, title: "Video library", copy: "Role-based training for front desk, cashier, doctor, nurse, inventory, and marketing workflows." },
    { icon: ClipboardCheck, title: "Launch checklist", copy: "A practical go-live sequence for branches, services, receipts, users, permissions, and SMS templates." },
    { icon: Download, title: "Export guides", copy: "Reference sheets for daily sales, patient queues, inventory movements, and owner reporting packs." },
  ];

  return (
    <section className="support-board">
      <div className="surface-panel support-hero-panel">
        <div>
          <p className="eyebrow">Support desk</p>
          <h2>Training, rollout, and operational help in one place.</h2>
          <p>Give each team a clear path to the right guide, contact channel, or launch task without leaving the clinic workspace.</p>
        </div>
        <div className="support-status-grid">
          <RecordPill label="SLA target" value="Under 4 hours" />
          <RecordPill label="Coverage" value="Daily clinic hours" />
          <RecordPill label="Launch state" value="Ready" />
        </div>
      </div>

      <div className="surface-panel">
        <SectionHeader icon={ShieldCheck} title="Contact Channels" action="Assigned" />
        <div className="support-channel-list">
          {supportChannels.map((item) => <SupportItem key={item.title} {...item} />)}
        </div>
      </div>

      <div className="surface-panel support-resource-panel">
        <SectionHeader icon={BookOpen} title="Training Resources" action={`${resources.length} resources`} />
        <div className="support-grid">
          {resources.map((item) => <SupportItem key={item.title} {...item} />)}
        </div>
      </div>

      <div className="surface-panel">
        <SectionHeader icon={ClipboardCheck} title="Onboarding Progress" action="Go-live" />
        <Checklist items={onboardingSteps} />
      </div>

      <div className="surface-panel full-span">
        <SectionHeader icon={MessageSquareText} title="Workflow FAQ" action="Common requests" />
        <div className="support-faq-grid">
          {[
            ["Create a booking", "Open Appointments, choose New Appointment, then select client, service, branch, room, staff, and status."],
            ["Complete split payment", "Build the cart in POS, choose Split, add payment methods, then confirm paid amount and change."],
            ["Upload treatment photos", "Open the client or treatment record, then add images under an authorized clinical account."],
            ["Receive inventory", "Use Inventory, select the item, then record receipt date, supplier, received by, check number, quantity, and unit."],
            ["Export reports", "Open Reports, choose date range and report type, then use CSV or Print for the owner pack."],
            ["Review audit logs", "Open Settings, review actor, role, action, area, and timestamp for sensitive changes."],
          ].map(([title, copy]) => (
            <article className="support-faq-card" key={title}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModalHost({
  session,
  branchScope,
  modal,
  closeModal,
  completeTransaction,
  saveAppointment,
  saveClient,
  saveService,
  saveInventory,
  receiveStock,
  saveLead,
  saveTreatment,
  saveExpense,
  saveStaff,
  savePackage,
  savePackageInstallment,
  saveGiftCertificate,
  saveCampaign,
  saveSettings,
  saveDiscount,
  savePromotion,
  saveConsentTemplate,
  saveConsentSubmission,
  saveRoom,
  changePassword,
  clients,
  services,
  branches,
  staff,
  inventory,
  settings,
  templates,
  packages,
  giftCertificates,
  appointments,
  consentTemplates,
}) {
  if (!modal) return null;

  const activeBranches = branches.filter((branch) => branch.status === "Active");
  const branchOptions = activeBranches.map((branch) => branch.name);
  const defaultClinicBranch = branchScope !== "All branches" && branchOptions.includes(branchScope) ? branchScope : "";
  const defaultRecordBranch = defaultClinicBranch;
  const recordBranchOptions = branchOptions;
  const clientOptions = clients.map((client) => ({ value: client.id, label: client.fullName }));
  const serviceOptions = services.map((service) => ({ value: service.id, label: service.name }));
  const employeeServiceSuggestions = [
    "All services",
    ...services.map((service) => service.name),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const staffOptions = staff.map((person) => person.name);
  const templateOptions = [{ value: "", label: "Custom message" }, ...(templates ?? []).map((template) => ({ value: template.id, label: template.name }))];
  const defaultMarketingTemplate = (templates ?? []).find((template) => template.category === "Marketing") ?? templates?.[0];
  const canManageProductPhotos = canManageOrganization(session?.role);
  const paymentMethodNames = activePaymentMethodNames(settings);
  const installmentPaymentMethods = paymentMethodNames.filter((method) => !["Package", "Gift Certificate", "Salary Deduction"].includes(method));
  const consumableInventoryOptions = Array.from(
    inventory
      .filter((item) => item.type === "Consumable")
      .reduce((options, item) => {
        const key = item.item.trim().toLowerCase();
        if (!options.has(key)) options.set(key, { value: item.item, label: item.item, unit: item.unit || "unit" });
        return options;
      }, new Map())
      .values(),
  );
  const serviceConsumablesByName = Object.fromEntries(
    services.map((service) => [service.name, Array.isArray(service.consumables) ? service.consumables : []]),
  );
  const initialTreatmentService = modal.payload?.service || services[0]?.name || "";
  const initialTreatmentConsumables = serviceConsumablesByName[initialTreatmentService] || [];

  if (modal.type === "account") {
    return <AccountSecurityModal account={session} onClose={closeModal} onChangePassword={changePassword} />;
  }

  if (modal.type === "payment") {
    return (
      <PaymentModal
        draft={modal.payload}
        packages={packages}
        giftCertificates={giftCertificates}
        staff={staff}
        paymentMethods={activePaymentMethodNames(settings, { includePackage: true })}
        onClose={closeModal}
        onSubmit={(payment) => completeTransaction(modal.payload, payment)}
      />
    );
  }

  if (modal.type === "appointment") {
    return (
      <AppointmentModal
        payload={modal.payload}
        clients={clients}
        services={services}
        branches={activeBranches}
        branchScope={branchScope}
        staff={staff}
        appointments={appointments}
        packages={packages}
        onClose={closeModal}
        onSubmit={saveAppointment}
      />
    );
  }

  if (modal.type === "room") {
    return (
      <RoomModal
        payload={modal.payload}
        branches={activeBranches}
        onClose={closeModal}
        onSubmit={saveRoom}
      />
    );
  }

  if (modal.type === "consent") {
    return (
      <ConsentModal
        payload={modal.payload}
        clients={clients}
        services={services}
        branches={activeBranches}
        templates={consentTemplates}
        witness={session?.name || ""}
        onClose={closeModal}
        onSubmit={saveConsentSubmission}
      />
    );
  }

  const configs = {
    discount: {
      title: modal.payload?.id ? "Edit Discount" : "New Discount",
      initial: { name: "", type: "Percentage", value: 0, permission: "Super Admin", applicable: "Services and products", expiry: "", usage: 0, active: true, ...modal.payload },
      submitLabel: "Save discount",
      onSubmit: saveDiscount,
      fields: [
        field("name", "Discount name"),
        field("type", "Discount type", "select", ["Percentage", "Fixed amount"]),
        field("value", "Discount value", "number"),
        field("permission", "Approval required from", "select", ["Super Admin", "Owner", "Branch Manager", "Receptionist", "Cashier"]),
        field("applicable", "Applies to", "select", ["Services and products", "Services", "Products", "Selected clients", "Birthday month", "Owner approval only"]),
        field("expiry", "Expiration (optional)", "date", null, "", false),
        field("active", "Active", "checkbox"),
      ],
    },
    "consent-template": {
      title: modal.payload?.id ? "Edit Consent Form Version" : "New Consent Form Version",
      initial: { name: "Patient Consent", version: "v1", content: "", active: true, ...modal.payload, serviceIds: splitList(modal.payload?.serviceIds).join(", "), requiredFields: splitList(modal.payload?.requiredFields).join(", ") },
      submitLabel: "Save form template",
      onSubmit: saveConsentTemplate,
      fields: [field("name", "Form name"), field("version", "Version"), field("serviceIds", "Related services", "multi-select", services.map((service) => ({ value: service.id, label: service.name })), "span-2", false), field("content", "Consent text", "textarea", null, "span-2"), field("requiredFields", "Additional required fields", "text", null, "span-2", false), field("active", "Active", "checkbox")],
    },
    promotion: {
      title: modal.payload?.id ? "Edit Promotion" : "New Promotion",
      initial: {
        name: "",
        discountType: "Percentage",
        value: 0,
        startDate: todayDate(),
        endDate: todayDate(),
        active: true,
        ...modal.payload,
        serviceIds: splitList(modal.payload?.serviceIds).join(", "),
        packageNames: splitList(modal.payload?.packageNames).join(", "),
        branches: splitList(modal.payload?.branches).join(", ") || "All branches",
      },
      submitLabel: "Save promotion",
      onSubmit: savePromotion,
      fields: [
        field("name", "Promotion name", "text", null, "span-2"),
        field("serviceIds", "Included services", "multi-select", services.map((service) => ({ value: service.id, label: service.name }))),
        field("packageNames", "Included packages", "multi-select", packages.map((pkg) => pkg.name), "", false),
        field("discountType", "Discount type", "select", ["Percentage", "Fixed Amount"]),
        field("value", "Discount value", "number"),
        field("startDate", "Start date", "date"),
        field("endDate", "End date", "date"),
        field("branches", "Applicable branches", "multi-select", ["All branches", ...branchOptions]),
        field("active", "Active", "checkbox"),
      ],
    },
    appointment: {
      title: modal.payload?.id ? "Edit Appointment" : "New Appointment",
      initial: {
        date: todayDate(),
        time: "10:00",
        clientId: clients[0]?.id,
        serviceId: services[0]?.id,
        branch: defaultClinicBranch,
        room: "Room 1",
        staff: staff[0]?.name,
        status: "Pending Confirmation",
        deposit: 0,
        notes: "",
        internalNotes: "",
        ...modal.payload,
      },
      submitLabel: "Save appointment",
      onSubmit: saveAppointment,
      fields: [
        field("date", "Date", "date"),
        field("time", "Time", "time"),
        field("clientId", "Client", "select", clientOptions),
        field("serviceId", "Service", "select", serviceOptions),
        field("branch", "Branch", "select", branchOptions),
        field("room", "Room"),
        field("staff", "Staff", "select", staffOptions),
        field("status", "Status", "select", appointmentStatuses),
        field("deposit", "Deposit", "number"),
        field("notes", "Client notes", "textarea", null, "span-2"),
        field("internalNotes", "Internal notes", "textarea", null, "span-2"),
      ],
    },
    client: {
      title: modal.payload?.id ? "Edit Client" : "Add Client",
      initial: {
        fullName: "",
        firstName: "",
        middleName: "",
        lastName: "",
        photo: "",
        mobile: "",
        email: "",
        gender: "",
        birthday: "",
        address: "",
        street: "",
        barangay: "",
        city: "",
        province: "",
        civilStatus: "",
        occupation: "",
        emergency: "",
        emergencyName: "",
        emergencyPhone: "",
        branch: defaultClinicBranch,
        branchesVisited: defaultClinicBranch ? [defaultClinicBranch] : [],
        source: "Walk-in",
        referral: "",
        medicalNotes: "",
        allergies: "",
        contraindications: "",
        skinConcerns: "",
        treatmentGoals: "",
        consentStatus: "Pending",
        marketingOptIn: true,
        preferredStaff: staff[0]?.name,
        tag: "New",
        retention: "New",
        lastVisit: "",
        nextVisit: "",
        balance: 0,
        packageBalance: "None",
        giftBalance: 0,
        ...modal.payload,
        ...clientNameParts(modal.payload),
      },
      submitLabel: "Save client",
      onSubmit: saveClient,
      fields: [
        field("photo", "Profile photo", "photo", null, "span-2"),
        field("firstName", "First name"),
        field("middleName", "Middle name", "text", null, "", false),
        field("lastName", "Last name"),
        field("mobile", "Mobile number"),
        field("email", "Email", "email"),
        field("gender", "Gender", "select", ["", "Female", "Male", "Prefer not to say"]),
        field("birthday", "Date of birth", "date"),
        field("civilStatus", "Civil status", "select", ["", "Single", "Married", "Widowed", "Separated", "Prefer not to say"], "", false),
        field("occupation", "Occupation", "text", null, "", false),
        field("street", "Street", "text", null, "", false),
        field("barangay", "Barangay", "text", null, "", false),
        field("city", "City", "text", null, "", false),
        field("province", "Province", "text", null, "", false),
        field("emergencyName", "Emergency contact name", "text", null, "", false),
        field("emergencyPhone", "Emergency contact number", "text", null, "", false),
        field("branch", "First registered branch", "select", branchOptions),
        field("source", "Source", "select", ["Walk-in", "Website", "Instagram", "Facebook", "Referral", "Online Booking"]),
        field("tag", "Tag", "select", ["New", "VIP", "Returning", "Follow-up", "Online"]),
        field("allergies", "Allergies"),
        field("contraindications", "Contraindications"),
        field("skinConcerns", "Skin concerns"),
        field("treatmentGoals", "Treatment goals"),
        field("medicalNotes", "Medical notes", "textarea", null, "span-2"),
        field("marketingOptIn", "Marketing opt-in", "checkbox"),
      ],
    },
    service: {
      title: modal.payload?.id ? "Edit Service" : "Add Service",
      initial: {
        name: "",
        category: serviceCategories[0],
        serviceType: "Regular Service",
        duration: 60,
        price: 0,
        priceModel: "Fixed price",
        priceUnit: "",
        packageSessions: 0,
        packagePrice: 0,
        serviceValue: 0,
        recommendedIntervalDays: 0,
        commission: "",
        room: "Treatment Room",
        active: true,
        pos: true,
        description: "",
        contraindications: "",
        aftercare: "",
        ...modal.payload,
        consumables: Array.isArray(modal.payload?.consumables) ? modal.payload.consumables : [],
        branches: Array.isArray(modal.payload?.branches) ? modal.payload.branches.join(", ") : modal.payload?.branches ?? branchOptions.join(", "),
        staff: Array.isArray(modal.payload?.staff) ? modal.payload.staff.join(", ") : modal.payload?.staff ?? "Doctor, Nurse, Aesthetician",
      },
      submitLabel: "Save service",
      onSubmit: saveService,
      fields: [
        field("name", "Service name"),
        field("serviceType", "Service type", "select", ["Regular Service", "Package", "Add-on"]),
        field("category", "Category", "select", serviceCategories),
        field("duration", "Duration minutes", "number"),
        field("priceModel", "Pricing model", "select", ["Fixed price", "Starts at", "Price after consultation/assessment", "Per unit"]),
        field("price", "Base price", "number"),
        field("priceUnit", "Pricing unit", "select", ["", "Per syringe", "Per ml", "Per vial", "Per ampoule"], "", false),
        field("packageSessions", "Package sessions", "number", null, "", false),
        field("packagePrice", "Package price", "number", null, "", false),
        field("serviceValue", "Service value per session", "number", null, "", false),
        field("recommendedIntervalDays", "Recommended interval (days)", "number", null, "", false),
        field("branches", "Branch availability"),
        field("staff", "Staff allowed", "multi-select", ["Doctor", "Nurse", "Head Nurse", "Aesthetician", "Head Aesthetician", "N/A"]),
        field("room", "Room / device required"),
        field("active", "Active", "checkbox"),
        field("pos", "Editable on POS", "checkbox"),
        field("description", "Description", "textarea", null, "span-2"),
        field("contraindications", "Contraindication notes", "textarea", null, "span-2"),
        field("aftercare", "Aftercare notes", "textarea", null, "span-2"),
        { ...field("consumables", "Standard consumables per service", "consumables", consumableInventoryOptions, "span-2", false), usageMode: "default" },
      ],
    },
    "inventory-receive": {
      title: "Receive Stock",
      initial: {
        inventoryId: inventory[0]?.id || "",
        date: todayDate(),
        qty: 1,
        unit: inventory[0]?.unit || "piece",
        supplier: "",
        receivedBy: session?.name || "",
        checkNumber: "",
        notes: "",
        ...modal.payload,
      },
      submitLabel: "Post stock receipt",
      onSubmit: (values) => receiveStock(values.inventoryId, values),
      fields: [
        field("inventoryId", "Inventory item", "select", inventory.map((item) => ({ value: item.id, label: `${item.item} · ${item.stock} ${item.unit}` })), "span-2"),
        field("date", "Date received", "date"),
        field("qty", "Quantity received", "number"),
        field("unit", "Unit of measurement"),
        field("supplier", "Supplier"),
        field("receivedBy", "Received by"),
        field("checkNumber", "Check number", "text", null, "", false),
        field("notes", "Receiving notes", "textarea", null, "span-2", false),
      ],
    },
    inventory: {
      title: modal.payload?.id ? "Edit Inventory Item" : "Add Inventory Item",
      initial: {
        item: "",
        sku: "",
        brand: "",
        category: settings.productCategories[0],
        type: "Consumable",
        unit: "piece",
        packQty: 1,
        beginning: 0,
        stock: 0,
        branch: defaultClinicBranch,
        location: "",
        reorder: 0,
        expiry: "",
        batch: "",
        supplier: "",
        cost: 0,
        price: 0,
        image: "",
        ...modal.payload,
      },
      submitLabel: "Save inventory",
      onSubmit: saveInventory,
      fields: [
        ...(canManageProductPhotos ? [field("image", "Product photo", "photo", null, "span-2 product-photo-field")] : []),
        field("item", "Product / consumable"),
        field("category", "Category", "select", settings.productCategories),
        field("type", "Type", "select", ["Consumable", "Retail"]),
        field("unit", "Unit"),
        field("packQty", "Packaging qty", "number"),
        field("stock", "Current stock", "number"),
        field("branch", "Branch", "select", branchOptions),
        field("location", "Storage location (stock room / shelf)"),
        field("reorder", "Reorder level", "number"),
        field("cost", "Cost", "number"),
        field("price", "Retail price", "number"),
      ],
    },
    lead: {
      title: modal.payload?.id ? "Edit Lead" : "Add Lead",
      initial: {
        name: "",
        firstName: "",
        middleName: "",
        lastName: "",
        preferredName: "",
        mobile: "",
        alternateMobile: "",
        email: "",
        socialProfileId: "",
        channelContactId: "",
        preferredChannel: "Phone",
        source: "Website",
        sourcePlatform: "Website",
        campaign: "",
        adSet: "",
        adCreative: "",
        landingPage: "",
        referrerUrl: "",
        utmSource: "",
        utmMedium: "",
        utmCampaign: "",
        clickId: "",
        formId: "",
        externalLeadId: "",
        interest: services[0]?.name ?? "",
        interestedTreatment: "",
        interestedPackage: "",
        concern: "",
        message: "",
        preferredDate: "",
        preferredTime: "",
        budgetRange: "",
        urgency: "Normal",
        inquiryType: "First-time",
        priority: "Normal",
        owner: staff[0]?.name ?? "Front Desk",
        branch: defaultClinicBranch,
        created: todayDate(),
        nextAction: "Initial response",
        nextFollowUpAt: "",
        nextStep: "",
        lossReason: "",
        permissionToContact: true,
        marketingConsent: false,
        privacyConsent: false,
        consentSource: "Manual entry",
        consentTimestamp: new Date().toISOString(),
        consentVersion: "v1",
        ...modal.payload,
        status: canonicalLeadStatus(modal.payload?.status ?? "New Inquiry"),
      },
      submitLabel: "Save lead",
      onSubmit: saveLead,
      fields: [
        field("name", "Lead name"),
        field("preferredName", "Preferred name", "text", null, "", false),
        field("firstName", "First name", "text", null, "", false),
        field("middleName", "Middle name", "text", null, "", false),
        field("lastName", "Last name", "text", null, "", false),
        field("mobile", "Mobile", "text", null, "", false),
        field("alternateMobile", "Alternate mobile", "text", null, "", false),
        field("email", "Email", "email", null, "", false),
        field("preferredChannel", "Preferred channel", "select", ["Phone", "SMS", "Messenger", "WhatsApp", "Email"]),
        field("source", "Lead source", "select", ["Website", "Online Booking", "Instagram", "Facebook", "Messenger", "Google Ads", "Google Business", "TikTok", "WhatsApp", "Email", "Phone call", "Walk-in", "Referral", "Event", "Third-party"]),
        field("sourcePlatform", "Source platform", "select", ["Website", "Meta Facebook", "Instagram", "Messenger", "Google Ads", "Google Business", "TikTok", "WhatsApp", "Email", "Offline", "Third-party"]),
        field("campaign", "Campaign", "text", null, "", false),
        field("adSet", "Ad set", "text", null, "", false),
        field("adCreative", "Ad / creative", "text", null, "", false),
        field("landingPage", "Landing page", "text", null, "", false),
        field("referrerUrl", "Referrer URL", "text", null, "", false),
        field("utmSource", "UTM source", "text", null, "", false),
        field("utmMedium", "UTM medium", "text", null, "", false),
        field("utmCampaign", "UTM campaign", "text", null, "", false),
        field("clickId", "Click ID", "text", null, "", false),
        field("formId", "Form ID", "text", null, "", false),
        field("externalLeadId", "External lead ID", "text", null, "", false),
        field("interest", "Interested service", "select", ["", ...services.map((service) => service.name)], "", false),
        field("interestedTreatment", "Interested treatment", "text", null, "", false),
        field("interestedPackage", "Interested package", "text", null, "", false),
        field("concern", "Main concern", "text", null, "", false),
        field("message", "Inquiry message", "textarea", null, "span-2", false),
        field("preferredDate", "Preferred date", "date", null, "", false),
        field("preferredTime", "Preferred time", "time", null, "", false),
        field("budgetRange", "Budget range", "text", null, "", false),
        field("urgency", "Urgency", "select", ["Low", "Normal", "High", "Urgent"]),
        field("inquiryType", "Inquiry type", "select", ["First-time", "Returning inquiry", "Existing client"]),
        field("status", "Status", "select", leadStatuses),
        field("priority", "Priority", "select", ["Low", "Normal", "High", "Urgent"]),
        field("owner", "Owner", "select", Array.from(new Set(["", "Front Desk", ...staffOptions, "Mika Santos"]))),
        field("branch", "Branch", "select", branchOptions),
        field("created", "Created", "date"),
        field("nextAction", "Next action", "text", null, "", false),
        field("nextFollowUpAt", "Next follow-up", "datetime-local", null, "", false),
        field("lossReason", "Loss reason", "select", ["", ...leadLossReasons], "", false),
        field("permissionToContact", "Permission to contact", "checkbox"),
        field("marketingConsent", "Marketing consent", "checkbox"),
        field("privacyConsent", "Privacy consent", "checkbox"),
        field("consentSource", "Consent source", "text", null, "", false),
        field("consentVersion", "Consent version", "text", null, "", false),
        field("nextStep", "Notes / next step", "textarea", null, "span-2"),
      ],
    },
    treatment: {
      title: modal.payload?.id ? "Edit Treatment Record" : "New Treatment Record",
      initial: { branch: defaultClinicBranch, clientId: clients[0]?.id, date: todayDate(), service: initialTreatmentService, provider: staff[0]?.name || "N/A", room: "Room 1", preNotes: "", postNotes: "", aftercare: "", arrivalTime: "", treatmentStartTime: "", completedTime: "", checkoutTime: "", consumables: initialTreatmentConsumables, deviceSettings: "", batch: "", consent: "Pending", followUp: "", outcome: "", satisfaction: "", ...modal.payload },
      submitLabel: "Save treatment",
      onSubmit: saveTreatment,
      serviceConsumablesByName,
      fields: [
        field("branch", "Branch", "select", branchOptions),
        field("clientId", "Client", "select", clientOptions),
        field("date", "Treatment date", "date"),
        field("service", "Service / procedure", "select", services.map((service) => service.name)),
        field("provider", "Doctor / staff", "select", ["N/A", ...staffOptions]),
        field("room", "Room"),
        field("arrivalTime", "Arrival / check-in", "time", null, "", false),
        field("treatmentStartTime", "Treatment start", "time", null, "", false),
        field("completedTime", "Treatment completed", "time", null, "", false),
        field("checkoutTime", "Checkout time", "time", null, "", false),
        { ...field("consumables", "Consumables actually used", "consumables", consumableInventoryOptions, "span-2", false), usageMode: "actual" },
        field("deviceSettings", "Device settings"),
        field("batch", "Lot / batch"),
        field("consent", "Consent", "select", ["Pending", "Signed"]),
        field("followUp", "Follow-up date", "date"),
        field("satisfaction", "Client satisfaction"),
        field("preNotes", "Pre-treatment notes", "textarea", null, "span-2"),
        field("postNotes", "Post-treatment notes", "textarea", null, "span-2"),
        field("aftercare", "Aftercare instructions", "textarea", null, "span-2", false),
        field("outcome", "Outcome notes", "textarea", null, "span-2"),
      ],
    },
    expense: {
      title: modal.payload?.id ? "Edit Expense" : "Record Expense",
      initial: { date: todayDate(), name: "", category: settings.expenseCategories[0], branch: defaultRecordBranch, amount: 0, method: "Cash", approver: "Owner", status: "For approval", notes: "", receipt: "Pending", ...modal.payload },
      submitLabel: "Save expense",
      onSubmit: saveExpense,
      fields: [
        field("date", "Date", "date"),
        field("name", "Expense name"),
        field("category", "Category", "select", settings.expenseCategories),
        field("branch", "Branch", "select", recordBranchOptions),
        field("amount", "Amount", "number"),
        field("method", "Payment method", "select", paymentMethodNames),
        field("approver", "Approver"),
        field("status", "Status", "select", ["For approval", "Approved", "Rejected"]),
        field("receipt", "Receipt"),
        field("notes", "Notes", "textarea", null, "span-2"),
      ],
    },
    staff: {
      title: modal.payload?.id ? "Edit Employee" : "Add Employee",
      initial: {
        name: "", photo: "", role: "Aesthetician", branch: defaultClinicBranch,
        schedule: "10:00 AM - 7:00 PM", scheduleBranches: "", commissionType: "", commissionRate: 0,
        services: "", status: "Available", attendance: "Clocked out", employmentDate: todayDate(),
        employmentStatus: "Regular", birthDate: "", address: "", emergencyContact: "", emergencyPhone: "", phone: "",
        ...modal.payload,
        branches: Array.isArray(modal.payload?.branches) ? modal.payload.branches.join(", ") : modal.payload?.branches ?? defaultClinicBranch,
      },
      submitLabel: "Save employee",
      onSubmit: saveStaff,
      fields: [
        field("photo", "Employee photo", "photo", null, "span-2"),
        field("name", "Name"),
        field("role", "Role", "select", Object.keys(roleAccess)),
        field("branch", "Primary branch", "select", branchOptions),
        field("branches", "Assigned branches", "multi-select", branchOptions),
        field("schedule", "Schedule"),
        field("commissionType", "Commission type", "suggest", ["Percentage per service", "Fixed amount per service", "Tiered commission", "Doctor rate", "Skin care", "Device care", "No commission / N/A"]),
        field("commissionRate", "Commission rate", "number-suggest", [0, 5, 8, 10, 12, 15, 20]),
        field("services", "Services allowed", "multi-select", employeeServiceSuggestions),
        field("status", "Status", "select", ["Available", "In treatment", "On leave", "Inactive"]),
        field("attendance", "Attendance", "select", ["Clocked in", "Clocked out"]),
        field("employmentStatus", "Employment status", "select", ["Regular", "Probationary", "Part-time", "Contract", "Inactive"]),
        field("employmentDate", "Employment date", "date"),
        field("birthDate", "Date of birth", "date", null, "", false),
        field("address", "Address", "textarea", null, "span-2", false),
        field("emergencyContact", "Emergency contact name", "text", null, "", false),
        field("emergencyPhone", "Emergency contact number", "text", null, "", false),
        field("phone", "Contact number"),
      ],
    },
    "gift-certificate": {
      title: modal.payload?.id ? "Edit Gift Certificate" : "Issue Gift Certificate",
      initial: {
        code: `ZENSHO-GC-${Date.now().toString(36).toUpperCase()}`,
        client: clients[0]?.fullName || "",
        type: "Monetary Value",
        serviceId: "",
        service: "",
        balance: 0,
        issueDate: todayDate(),
        expires: "",
        branch: "All branches",
        status: "Active",
        ...modal.payload,
      },
      submitLabel: modal.payload?.id ? "Save certificate" : "Issue certificate",
      onSubmit: saveGiftCertificate,
      fields: [
        field("code", "Certificate code"),
        field("client", "Issued to", "select", clients.map((client) => client.fullName)),
        field("type", "Certificate type", "select", ["Monetary Value", "Specific Service"]),
        field("serviceId", "Specific service (when applicable)", "select", [{ value: "", label: "Not service-specific" }, ...serviceOptions], "", false),
        field("balance", "Value / remaining balance", "number"),
        field("issueDate", "Issue date", "date"),
        field("expires", "Expiration (optional)", "date", null, "", false),
        field("branch", "Redeemable branch", "select", ["All branches", ...recordBranchOptions]),
        field("status", "Status", "select", ["Active", "Redeemed", "Expired"]),
      ],
    },
    package: {
      title: modal.payload?.id ? "Edit Package" : "Sell Package",
      initial: { name: "Glow Maintenance Plan", clientId: clients[0]?.id, sessions: 6, used: 0, branch: defaultRecordBranch, transferable: false, status: "Active", price: 0, amountPaid: 0, purchaseDate: todayDate(), nextPayment: "", serviceValue: 0, ...modal.payload, expires: "" },
      submitLabel: "Save package",
      onSubmit: savePackage,
      fields: [
        field("name", "Package name"),
        field("clientId", "Client", "select", clientOptions),
        field("sessions", "Sessions", "number"),
        field("used", "Used", "number"),
        field("purchaseDate", "Purchase date", "date"),
        field("branch", "Branch", "select", recordBranchOptions),
        field("transferable", "Transferable", "checkbox"),
        field("status", "Status", "select", ["Active", "Pending", "Completed"]),
        field("price", "Price", "number"),
        field("amountPaid", "Amount paid", "number"),
        field("nextPayment", "Next expected payment", "date", null, "", false),
        field("serviceValue", "Service value per session", "number", null, "", false),
      ],
    },
    "package-payment": {
      title: `Record installment · ${modal.payload?.name || "Package"}`,
      initial: {
        id: modal.payload?.id || "",
        amount: modal.payload?.outstandingBalance ?? Math.max(0, Number(modal.payload?.price || 0) - Number(modal.payload?.amountPaid || 0)),
        date: todayDate(),
        method: installmentPaymentMethods[0] || "Cash",
        nextPayment: modal.payload?.nextPayment || "",
        notes: "",
      },
      submitLabel: "Record installment",
      onSubmit: savePackageInstallment,
      fields: [
        field("amount", "Amount received", "number"),
        field("date", "Payment date", "date"),
        field("method", "Payment method", "select", installmentPaymentMethods.length ? installmentPaymentMethods : ["Cash"]),
        field("nextPayment", "Next expected payment (optional)", "date", null, "", false),
        field("notes", "Notes (optional)", "textarea", null, "span-2", false),
      ],
    },
    campaign: {
      title: modal.payload?.id ? "Edit Campaign" : "New Campaign",
      initial: {
        name: "",
        branch: defaultRecordBranch,
        segment: "Inactive clients",
        channel: "SMS",
        templateId: defaultMarketingTemplate?.id ?? "",
        subject: "A note from ZenshoTech",
        message: defaultMarketingTemplate?.text ?? "Hi {{client}}, it has been a while. Book your personalized care session with ZenshoTech this week.",
        sent: 0,
        booked: 0,
        credits: 0,
        status: "Draft",
        ...modal.payload,
      },
      submitLabel: "Save campaign",
      onSubmit: saveCampaign,
      templateMessages: Object.fromEntries((templates ?? []).map((template) => [template.id, template.text])),
      fields: [
        field("name", "Campaign name"),
        field("branch", "Branch", "select", recordBranchOptions),
        field("segment", "Segment", "select", ["Birthday month", "Last visit date", "Service category", "VIP", "Inactive clients", "New clients", "Package holders"]),
        field("channel", "Channel", "select", ["Email", "SMS", "Email + SMS"]),
        field("templateId", "Template", "select", templateOptions),
        field("subject", "Email subject"),
        field("message", "Message", "textarea", null, "span-2"),
        field("sent", "Sent", "number"),
        field("booked", "Booked", "number"),
        field("credits", "Credits", "number"),
        field("status", "Status", "select", ["Draft", "Scheduled", "Sent", "Partial"]),
      ],
    },
    settings: {
      title: "Edit Settings",
      initial: { ...settings },
      submitLabel: "Save settings",
      onSubmit: saveSettings,
      fields: [
        field("company", "Company"),
        field("productName", "Product name"),
        field("currency", "Currency"),
        field("taxMode", "Tax mode", "select", ["VAT exclusive", "VAT inclusive", "Non-VAT"]),
        field("taxRate", "Tax rate", "number"),
        field("receiptFooter", "Receipt footer"),
        field("invoicePrefix", "Invoice prefix"),
        field("smsCredits", "SMS credits", "number"),
        field("backup", "Backup status"),
        field("hiddenSaasPlans", "Hide SaaS plans", "checkbox"),
      ],
    },
  };

  const config = configs[modal.type];
  if (!config) return null;
  return <EntityModal config={{ ...config, formKind: modal.type }} onClose={closeModal} />;
}

function clientNameParts(client = {}) {
  if (client.firstName || client.middleName || client.lastName) {
    return { firstName: client.firstName || "", middleName: client.middleName || "", lastName: client.lastName || "" };
  }
  const parts = String(client.fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || "", middleName: "", lastName: "" };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts.at(-1) };
}

function ageFromBirthday(birthday, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthday || ""))) return null;
  const [year, month, day] = birthday.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 ? age : null;
}

function branchOperatingWindow(branch, date) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? new Date(`${date}T00:00:00.000Z`) : null;
  const dayKey = parsed && !Number.isNaN(parsed.getTime()) ? operatingDayKeys[parsed.getUTCDay()] : "monday";
  const configured = branch?.operatingHours?.[dayKey] || defaultBranchOperatingHours[dayKey];
  return {
    dayKey,
    closed: Boolean(configured?.closed),
    open: parseTimeToMinutes(configured?.open || defaultBranchOperatingHours[dayKey].open),
    close: parseTimeToMinutes(configured?.close || defaultBranchOperatingHours[dayKey].close),
  };
}

function freshOperatingHours(value = {}) {
  return Object.fromEntries(operatingDayKeys.map((dayKey) => [dayKey, {
    ...defaultBranchOperatingHours[dayKey],
    ...(value?.[dayKey] || {}),
  }]));
}

function operatingHoursSummary(value) {
  const hours = freshOperatingHours(value);
  const monday = hours.monday;
  const sunday = hours.sunday;
  return `Mon-Sat ${formatScheduleTime(parseTimeToMinutes(monday.open))} - ${formatScheduleTime(parseTimeToMinutes(monday.close))}; Sun ${formatScheduleTime(parseTimeToMinutes(sunday.open))} - ${formatScheduleTime(parseTimeToMinutes(sunday.close))}`;
}

function ConsentModal({ payload = {}, clients = [], services = [], branches = [], templates = [], witness = "", onClose, onSubmit }) {
  const activeTemplates = templates.filter((template) => template.active);
  const branchNames = branches.map((branch) => branch.name);
  const [form, setForm] = useState(() => ({
    clientId: payload.clientId || clients[0]?.id || "",
    templateId: activeTemplates.some((template) => template.id === payload.templateId) ? payload.templateId : activeTemplates[0]?.id || "",
    service: payload.service || "",
    treatmentId: payload.treatmentId || "",
    branch: branchNames.includes(payload.branch) ? payload.branch : branchNames[0] || "",
    witness: payload.witness || witness,
    signature: "",
    accepted: false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedTemplate = activeTemplates.find((template) => template.id === form.templateId);
  const selectedClient = clients.find((client) => client.id === form.clientId);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        answers: {
          clientName: selectedClient?.fullName || "",
          confirmation: "Client reviewed the displayed form and accepted its terms.",
        },
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to attach the signed consent form.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Complete digital consent">
      <form className="modal-card consent-modal" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close consent form"><X size={18} /></button>
        <ModalHeader icon={ShieldCheck} title="Complete Digital Consent" action="Permanent client record" />

        {!activeTemplates.length ? (
          <div className="inline-state warning" role="alert"><AlertCircle size={17} /> Create and activate a consent form template in Settings before collecting a signature.</div>
        ) : (
          <>
            <div className="form-grid">
              <label><span>Client</span><select required value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>{clients.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}</select></label>
              <label><span>Consent form</span><select required value={form.templateId} onChange={(event) => setForm({ ...form, templateId: event.target.value })}>{activeTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.version}</option>)}</select></label>
              <label><span>Related service</span><select value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value })}><option value="">General consent</option>{services.map((service) => <option key={service.id} value={service.name}>{service.name}</option>)}</select></label>
              <label><span>Branch</span><select required value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}>{branchNames.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label>
            </div>

            <section className="consent-document" aria-live="polite">
              <div><strong>{selectedTemplate?.name}</strong><span>Version {selectedTemplate?.version}</span></div>
              <p>{selectedTemplate?.content}</p>
            </section>

            <div className="form-grid">
              <label><span>Staff / witness</span><input value={form.witness} onChange={(event) => setForm({ ...form, witness: event.target.value })} /></label>
              <label><span>Electronic signature (full legal name)</span><input required autoComplete="name" value={form.signature} onChange={(event) => setForm({ ...form, signature: event.target.value })} /></label>
              <label className="checkbox-field span-2 consent-acceptance"><input required type="checkbox" checked={form.accepted} onChange={(event) => setForm({ ...form, accepted: event.target.checked })} /><span>I confirm that I am the client or authorized representative, I have read the form above, and I voluntarily accept its terms.</span></label>
            </div>
          </>
        )}

        {error && <div className="inline-state danger" role="alert"><AlertCircle size={17} /> {error}</div>}
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving || !activeTemplates.length || !form.clientId || !form.templateId || !form.branch || !form.signature.trim() || !form.accepted}><ShieldCheck size={17} /> {saving ? "Attaching..." : "Sign and attach permanently"}</button>
        </div>
      </form>
    </div>
  );
}

function AccountSecurityModal({ account, onClose, onChangePassword }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await onChangePassword(form.currentPassword, form.newPassword);
      onClose();
    } catch (passwordError) {
      setError(passwordError.message || "Unable to update the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Account security">
      <form className="modal-card account-security-modal" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close account security"><X size={18} /></button>
        <ModalHeader icon={LockKeyhole} title="Account security" action="Profile and password" />
        <div className="account-security-summary">
          <span className="account-avatar large" aria-hidden="true">{initialsFor(account.name)}</span>
          <div><strong>{account.name}</strong><span>{account.email}</span></div>
          <dl>
            <div><dt>Role</dt><dd>{account.role}</dd></div>
            <div><dt>Active branch</dt><dd>{account.branch}</dd></div>
          </dl>
        </div>
        <div className="form-grid account-password-fields">
          <label className="full-span"><span>Current password</span><input required autoComplete="current-password" type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
          <label><span>New password</span><input required autoComplete="new-password" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
          <label><span>Confirm new password</span><input required autoComplete="new-password" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        </div>
        <p className="account-password-helper">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
        {error && <div className="inline-state danger" role="alert"><AlertCircle size={17} /> {error}</div>}
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}><LockKeyhole size={17} /> {saving ? "Updating..." : "Update password"}</button>
        </div>
      </form>
    </div>
  );
}

function PaymentModal({ draft, packages = [], giftCertificates = [], staff = [], paymentMethods = ["Cash", "Package"], onClose, onSubmit }) {
  const firstMethod = paymentMethods[0] || "Cash";
  const splitSecondMethod = paymentMethods.find((method) => method !== firstMethod && method !== "Package") || firstMethod;
  const packagePurchaseLines = (draft.cart || []).filter((item) => item.type === "Service" && item.serviceType === "Package");
  const packageServiceLines = (draft.cart || []).filter((item) => item.type === "Service");
  const packageLineAmount = (item) => {
    const gross = Number(item?.price || 0) * Number(item?.qty || 1);
    return Number(draft.subtotal || 0) > 0
      ? Math.round((((gross / Number(draft.subtotal)) * Number(draft.total || 0)) + Number.EPSILON) * 100) / 100
      : 0;
  };
  const [payments, setPayments] = useState(() => {
    if (draft.splitPayment) {
      const firstAmount = Math.floor(Number(draft.total || 0) / 2);
      return [
        { method: draft.paymentMethod || firstMethod, amount: firstAmount, referenceNumber: createSystemPaymentReference("PAY", draft.saleDate) },
        { method: splitSecondMethod, amount: Number(draft.total || 0) - firstAmount, referenceNumber: createSystemPaymentReference("PAY", draft.saleDate) },
      ];
    }
    return [{ method: draft.paymentMethod || firstMethod, amount: draft.total, referenceNumber: createSystemPaymentReference("PAY", draft.saleDate) }];
  });
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [packageInstallments, setPackageInstallments] = useState(() => packagePurchaseLines.map((item) => ({
    lineKey: item.key,
    name: item.name,
    amountPaid: packageLineAmount(item),
    nextPayment: "",
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = Math.max(0, paid - draft.total);
  const packageNetTotal = packagePurchaseLines.reduce((sum, item) => sum + packageLineAmount(item), 0);
  const nonPackageNetTotal = Math.max(0, Number(draft.total || 0) - packageNetTotal);
  const requiredPackageAllocation = Math.max(0, Math.min(packageNetTotal, Math.min(paid, Number(draft.total || 0)) - nonPackageNetTotal));
  const packageAllocationTotal = packageInstallments.reduce((sum, installment) => sum + Number(installment.amountPaid || 0), 0);
  const packageAllocationInvalid = packageInstallments.some((installment) => {
    const line = packagePurchaseLines.find((item) => item.key === installment.lineKey);
    return Number(installment.amountPaid || 0) < 0 || Number(installment.amountPaid || 0) > packageLineAmount(line);
  }) || Math.abs(packageAllocationTotal - requiredPackageAllocation) > 0.009;

  const today = todayDate();
  const branchAccepts = (recordBranch) => !recordBranch || recordBranch === "All branches" || recordBranch === draft.branch;
  const usableCertificates = giftCertificates.filter((certificate) =>
    certificate.status === "Active"
    && Number(certificate.balance || 0) > 0
    && (!certificate.expires || certificate.expires >= today)
    && branchAccepts(certificate.branch));
  const usablePackages = packages.filter((pkg) =>
    pkg.status === "Active"
    && Number(pkg.used || 0) < Number(pkg.sessions || 0)
    && (!pkg.expires || pkg.expires >= today)
    && (pkg.transferable || branchAccepts(pkg.branch))
    && (draft.clientId ? pkg.clientId === draft.clientId : pkg.client === draft.clientName));
  const salaryDeductionEmployees = staff.filter((person) => {
    const assigned = splitList(person.branches);
    return person.status !== "Inactive" && (person.branch === draft.branch || assigned.includes(draft.branch) || person.branch === "All branches");
  });
  const tenderIncomplete = payments.some((payment) =>
    (payment.method === "Gift Certificate" && !payment.giftCertificateId)
    || (payment.method === "Package" && (!payment.packageId || !payment.packageLineKey))
    || (payment.method === "Salary Deduction" && !payment.employeeId));
  const canPost = payments.some((payment) => Number(payment.amount) > 0) && !tenderIncomplete && !packageAllocationInvalid;

  function updatePayment(index, patch) {
    setPayments((current) => current.map((payment, itemIndex) => (itemIndex === index ? { ...payment, ...patch } : payment)));
  }

  function remainingBesides(index) {
    const others = payments.reduce((sum, payment, itemIndex) => (itemIndex === index ? sum : sum + Number(payment.amount || 0)), 0);
    return Math.max(0, Number(draft.total || 0) - others);
  }

  function changeMethod(index, method) {
    updatePayment(index, { method, giftCertificateId: undefined, packageId: undefined, packageLineKey: undefined, employeeId: undefined });
  }

  function chooseCertificate(index, certificateId) {
    const certificate = usableCertificates.find((item) => item.id === certificateId);
    updatePayment(index, {
      giftCertificateId: certificateId || undefined,
      ...(certificate ? { amount: Math.min(Number(certificate.balance || 0), remainingBesides(index)) } : {}),
    });
  }

  function choosePackage(index, packageId) {
    const assignedLineKeys = new Set(payments.map((payment, itemIndex) => itemIndex === index ? "" : payment.packageLineKey).filter(Boolean));
    const nextLine = packageServiceLines.find((item) => !assignedLineKeys.has(item.key)) || packageServiceLines[0];
    updatePayment(index, {
      packageId: packageId || undefined,
      packageLineKey: packageId ? (payments[index]?.packageLineKey || nextLine?.key) : undefined,
      ...(packageId ? { amount: remainingBesides(index) } : {}),
    });
  }

  function updatePackageInstallment(lineKey, patch) {
    setPackageInstallments((current) => current.map((installment) => installment.lineKey === lineKey ? { ...installment, ...patch } : installment));
  }

  const submitPayment = useCallback(async () => {
    if (saving || !canPost) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ payments, notes, packageInstallments });
    } catch (submitError) {
      setError(submitError?.message || "Payment could not be completed.");
    } finally {
      setSaving(false);
    }
  }, [canPost, notes, onSubmit, packageInstallments, payments, saving]);

  const submitUnpaid = useCallback(async () => {
    if (saving || !draft.clientId) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ payments: [], notes, status: "Unpaid" });
    } catch (submitError) {
      setError(submitError?.message || "The unpaid transaction could not be posted.");
    } finally {
      setSaving(false);
    }
  }, [draft.clientId, notes, onSubmit, saving]);

  useEffect(() => {
    function handlePaymentShortcut(event) {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        onClose();
      } else if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        submitPayment();
      }
    }

    window.addEventListener("keydown", handlePaymentShortcut);
    return () => window.removeEventListener("keydown", handlePaymentShortcut);
  }, [onClose, saving, submitPayment]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Payment form">
      <div className="modal-card payment-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close payment form"><X size={18} /></button>
        <ModalHeader icon={CreditCard} title="Payment Form" action={draft.clientName} />
        {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
        <div className="receipt-preview">
          <div><span>Subtotal</span><strong>{money.format(draft.subtotal)}</strong></div>
          <div><span>Discount</span><strong>-{money.format(draft.discountAmount)}</strong></div>
          <div><span>Total due</span><strong>{money.format(draft.total)}</strong></div>
        </div>
        <div className="payment-list">
          {payments.map((payment, index) => (
            <div className="payment-row-group" key={index}>
              <div className="payment-row">
                <select
                  aria-label={`Payment ${index + 1} method`}
                  value={payment.method}
                  onChange={(event) => changeMethod(index, event.target.value)}
                >
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select>
                <input
                  aria-label={`Payment ${index + 1} amount`}
                  type="number"
                  autoFocus={index === 0}
                  value={payment.amount}
                  onChange={(event) => updatePayment(index, { amount: Number(event.target.value) })}
                  onFocus={(event) => event.currentTarget.select()}
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={`Remove payment ${index + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <label className="payment-reference-field">
                <span>Reference number <small>System generated</small></span>
                <input
                  aria-label={`Payment ${index + 1} reference number`}
                  autoComplete="off"
                  maxLength={120}
                  readOnly
                  value={payment.referenceNumber || ""}
                />
              </label>
              {payment.method === "Gift Certificate" && (
                <select
                  className="payment-tender-select"
                  aria-label={`Payment ${index + 1} gift certificate`}
                  value={payment.giftCertificateId || ""}
                  onChange={(event) => chooseCertificate(index, event.target.value)}
                >
                  <option value="">Select gift certificate...</option>
                  {usableCertificates.map((certificate) => (
                    <option key={certificate.id} value={certificate.id}>
                      {certificate.code} - {money.format(certificate.balance)} available
                    </option>
                  ))}
                </select>
              )}
              {payment.method === "Package" && (
                <div className="payment-package-allocation">
                  <select
                    className="payment-tender-select"
                    aria-label={`Payment ${index + 1} package`}
                    value={payment.packageId || ""}
                    onChange={(event) => choosePackage(index, event.target.value)}
                  >
                    <option value="">Select client package (1 session)...</option>
                    {usablePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {Number(pkg.sessions || 0) - Number(pkg.used || 0)} session(s) left
                      </option>
                    ))}
                  </select>
                  <select
                    className="payment-tender-select"
                    aria-label={`Payment ${index + 1} package service`}
                    value={payment.packageLineKey || ""}
                    onChange={(event) => updatePayment(index, { packageLineKey: event.target.value || undefined })}
                  >
                    <option value="">Select service session covered...</option>
                    {packageServiceLines.map((line) => {
                      const assignedElsewhere = payments.some((entry, itemIndex) => itemIndex !== index && entry.method === "Package" && entry.packageLineKey === line.key);
                      return <option key={line.key} value={line.key} disabled={assignedElsewhere}>{line.name}{line.provider && line.provider !== "N/A" ? ` · ${line.provider}` : ""}</option>;
                    })}
                  </select>
                </div>
              )}
              {payment.method === "Salary Deduction" && (
                <select className="payment-tender-select" aria-label={`Payment ${index + 1} employee`} value={payment.employeeId || ""} onChange={(event) => updatePayment(index, { employeeId: event.target.value || undefined })}>
                  <option value="">Select employee for salary deduction...</option>
                  {salaryDeductionEmployees.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}
                </select>
              )}
              {payment.method === "Gift Certificate" && !usableCertificates.length && (
                <span className="payment-tender-hint">No active gift certificates for this branch.</span>
              )}
              {payment.method === "Package" && !usablePackages.length && (
                <span className="payment-tender-hint">No active packages for this client at this branch.</span>
              )}
              {payment.method === "Package" && !packageServiceLines.length && (
                <span className="payment-tender-hint">Add the service covered by this package before checkout.</span>
              )}
            </div>
          ))}
        </div>
        <button className="secondary-button small" type="button" onClick={() => setPayments((current) => [...current, { method: paymentMethods.find((method) => method !== "Package") || firstMethod, amount: 0, referenceNumber: createSystemPaymentReference("PAY", draft.saleDate) }])}>
          <Plus size={16} /> Add split payment
        </button>
        {packageInstallments.length > 0 && (
          <section className="package-installment-allocation" aria-label="Package installment allocation">
            <div>
              <strong>Package installment allocation</strong>
              <small>Non-package services are settled first. Choose how much of today&apos;s payment is applied to each package.</small>
            </div>
            {packageInstallments.map((installment) => {
              const line = packagePurchaseLines.find((item) => item.key === installment.lineKey);
              const packagePrice = packageLineAmount(line);
              const balance = Math.max(0, packagePrice - Number(installment.amountPaid || 0));
              return (
                <div className="package-installment-row" key={installment.lineKey}>
                  <span><strong>{installment.name}</strong><small>{money.format(packagePrice)} package total</small></span>
                  <label><span>Paid today</span><input aria-label={`${installment.name} package amount paid today`} type="number" min="0" max={packagePrice} step="0.01" value={installment.amountPaid} onChange={(event) => updatePackageInstallment(installment.lineKey, { amountPaid: Number(event.target.value) })} /></label>
                  <label><span>Next payment</span><input aria-label={`${installment.name} next payment date`} type="date" disabled={balance <= 0} value={installment.nextPayment} onChange={(event) => updatePackageInstallment(installment.lineKey, { nextPayment: event.target.value })} /></label>
                  <b>{money.format(balance)} balance</b>
                </div>
              );
            })}
            <small className={packageAllocationInvalid ? "field-error" : ""}>Apply {money.format(requiredPackageAllocation)} of the current payment to package installment(s). Currently allocated: {money.format(packageAllocationTotal)}.</small>
          </section>
        )}
        <label className="stacked-field">
          <span>Payment notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="receipt-preview">
          <div><span>Paid</span><strong>{money.format(paid)}</strong></div>
          <div><span>Change</span><strong>{money.format(change)}</strong></div>
          <div><span>Status</span><strong>{paid >= draft.total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid"}</strong></div>
        </div>
        <div className="modal-actions">
          <span className="modal-keyboard-hint"><kbd>Esc</kbd> cancel · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> post</span>
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="secondary-button" type="button" onClick={submitUnpaid} disabled={saving || !draft.clientId} title={draft.clientId ? "Post the full amount to this client's outstanding balance" : "Select a registered client to post an unpaid sale"}>
            <WalletCards size={17} /> Post unpaid
          </button>
          <button className="primary-button" type="button" onClick={submitPayment} disabled={saving || !canPost} aria-keyshortcuts="Control+Enter">
            <Check size={17} /> {saving ? "Posting..." : "Post payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function field(name, label, type = "text", options = null, className = "", required = null) {
  return { name, label, type, options, className, required };
}

const entityFormSectionDefinitions = {
  client: [
    { title: "Profile", fields: ["photo", "firstName", "middleName", "lastName", "mobile", "email", "gender", "birthday", "civilStatus", "occupation"] },
    { title: "Address and emergency contact", fields: ["street", "barangay", "city", "province", "emergencyName", "emergencyPhone"] },
    { title: "Clinic relationship", fields: ["branch", "source", "tag", "allergies", "contraindications", "skinConcerns", "treatmentGoals"] },
    { title: "Clinical notes and consent", fields: ["medicalNotes", "marketingOptIn"] },
  ],
  lead: [
    { title: "Identity and contact", fields: ["name", "preferredName", "firstName", "middleName", "lastName", "mobile", "alternateMobile", "email", "preferredChannel"] },
    { title: "Acquisition", fields: ["source", "sourcePlatform", "campaign", "adSet", "adCreative", "landingPage", "referrerUrl", "utmSource", "utmMedium", "utmCampaign", "clickId", "formId", "externalLeadId"] },
    { title: "Interest and preferences", fields: ["interest", "interestedTreatment", "interestedPackage", "concern", "message", "preferredDate", "preferredTime", "budgetRange", "urgency", "inquiryType"] },
    { title: "Assignment and status", fields: ["status", "priority", "owner", "branch", "created", "nextAction", "nextFollowUpAt", "lossReason"] },
    { title: "Consent", fields: ["permissionToContact", "marketingConsent", "privacyConsent", "consentSource", "consentVersion"] },
    { title: "Follow-up notes", fields: ["nextStep"] },
  ],
  treatment: [
    { title: "Record Details", fields: ["branch", "clientId", "date", "service", "provider", "room"] },
    { title: "Treatment Timing", fields: ["arrivalTime", "treatmentStartTime", "completedTime", "checkoutTime"] },
    { title: "Consumables", fields: ["consumables"] },
    { title: "Device Information", fields: ["deviceSettings", "batch"] },
    { title: "Consent and Follow-up", fields: ["consent", "followUp", "satisfaction"] },
    { title: "Clinical Notes", fields: ["preNotes", "postNotes", "aftercare", "outcome"] },
  ],
  staff: [
    { title: "Profile and employment", fields: ["photo", "name", "role", "employmentStatus", "employmentDate", "birthDate"] },
    { title: "Access and scheduling", fields: ["branch", "branches", "schedule", "status", "attendance"] },
    { title: "Commission and services", fields: ["commissionType", "commissionRate", "services"] },
    { title: "Contact and emergency details", fields: ["phone", "address", "emergencyContact", "emergencyPhone"] },
  ],
  service: [
    { title: "Service Details", fields: ["name", "serviceType", "category", "duration", "description"] },
    { title: "Pricing and Packaging", fields: ["priceModel", "price", "priceUnit", "packageSessions", "packagePrice", "serviceValue", "recommendedIntervalDays"] },
    { title: "Availability and Resources", fields: ["branches", "staff", "room", "active", "pos"] },
    { title: "Clinical Guidance", fields: ["consumables", "contraindications", "aftercare"] },
  ],
  inventory: [
    { title: "Product Details", fields: ["image", "item", "category", "type", "unit", "packQty", "branch", "location"] },
    { title: "Stock and Pricing", fields: ["stock", "reorder", "cost", "price"] },
  ],
};

function entityFormSections(config) {
  const definitions = entityFormSectionDefinitions[config.formKind];
  if (!definitions) return [{ title: "Record Details", fields: config.fields }];

  const fieldsByName = new Map(config.fields.map((item) => [item.name, item]));
  const claimed = new Set();
  const sections = definitions.map((section) => ({
    ...section,
    fields: section.fields.map((name) => fieldsByName.get(name)).filter((item) => {
      if (!item) return false;
      claimed.add(item.name);
      return true;
    }),
  })).filter((section) => section.fields.length);
  const remaining = config.fields.filter((item) => !claimed.has(item.name));
  if (remaining.length) sections.push({ title: "Additional Details", fields: remaining });
  return sections;
}

function AppointmentModal({ payload, clients, services, branches, branchScope, staff, appointments = [], packages = [], onClose, onSubmit }) {
  const [form, setForm] = useState({
    date: todayDate(),
    time: "",
    clientId: "",
    serviceId: "",
    branch: branchScope !== "All branches" ? branchScope : "",
    room: "",
    staff: "",
    duration: 60,
    appointmentType: "Treatment",
    insurance: "",
    tags: "",
    packageName: "",
    timezone: "Asia/Manila",
    recurrence: "None",
    recurrenceUntil: "",
    status: "Pending Confirmation",
    deposit: 0,
    notes: "",
    internalNotes: "",
    ...payload,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showTimezoneSelect, setShowTimezoneSelect] = useState(false);
  const selectedService = services.find((item) => item.id === form.serviceId);
  const selectedBranch = branches.find((item) => item.name === form.branch);
  const availableClients = clients;
  const availableServices = services.filter((service) => {
    const offered = Array.isArray(service.branches) ? service.branches : [];
    return !form.branch || !offered.length || offered.includes("All branches") || offered.includes(form.branch);
  });
  const availableRooms = [
    ...(selectedBranch?.rooms || uniqueRoomsFromBranches()),
    ...Array.from({ length: Number(selectedBranch?.couches || 0) }, (_, index) => `Couch ${index + 1}`),
  ];
  const availableStaff = staff.filter((person) => {
    const assignedBranches = Array.isArray(person.branches) ? person.branches : splitList(person.branches);
    return person.branch === form.branch || assignedBranches.includes(form.branch) || person.branch === "All branches" || !person.branch;
  });
  const patient = clients.find((client) => client.id === form.clientId);
  const patientPackages = packages.filter((item) => item.clientId === form.clientId || item.client === patient?.fullName);
  const duration = Math.max(15, Number(form.duration || selectedService?.duration || 60));
  const availableSlots = useMemo(() => {
    if (!form.date) return [];
    const operatingWindow = branchOperatingWindow(selectedBranch, form.date);
    if (operatingWindow.closed) return [];
    const slots = [];
    for (let start = operatingWindow.open; start + duration <= operatingWindow.close; start += 15) {
      const end = start + duration;
      const conflicts = appointments.some((appointment) => {
        if (appointment.id === form.id || appointment.date !== form.date || !isActiveAppointmentStatus(appointment.status)) return false;
        if (form.branch && appointment.branch !== form.branch) return false;
        const resourceConflict = (form.staff && appointment.staff === form.staff) || (form.room && appointment.room === form.room);
        if (!resourceConflict) return false;
        const appointmentStart = parseTimeToMinutes(appointment.time);
        const appointmentEnd = appointmentStart + appointmentDurationMinutes(appointment, services);
        return start < appointmentEnd && end > appointmentStart;
      });
      if (!conflicts) slots.push(formatTimeInput(start));
    }
    return slots;
  }, [appointments, duration, form.branch, form.date, form.id, form.room, form.staff, selectedBranch, services]);

  function update(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "branch" ? { room: "", staff: "", packageName: "" } : {}),
      ...(name === "serviceId" ? { duration: Number(services.find((item) => item.id === value)?.duration || current.duration || 60) } : {}),
    }));
  }

  async function submit(event, status = form.status) {
    event.preventDefault();
    const required = [["clientId", "Client"], ["serviceId", "Service"], ["date", "Date"], ["time", "Time"], ["branch", "Branch"], ["staff", "Staff"], ["room", "Room"]];
    const missing = required.find(([name]) => !form[name]);
    if (missing) return setError(`${missing[1]} is required.`);
    setSaving(true);
    setError("");
    try { await Promise.resolve(onSubmit({ ...form, status })); }
    catch (submitError) { setError(submitError?.message || "Unable to save this appointment."); setSaving(false); }
  }

  return (
    <div className="modal-backdrop appointment-modal-backdrop" role="dialog" aria-modal="true" aria-label={payload?.id ? "Edit appointment" : "New appointment"}>
      <form className="appointment-booking-drawer" onSubmit={(event) => submit(event, "Pending Confirmation")}>
        <header className="appointment-booking-header">
          <div><p className="eyebrow">Appointments</p><h2>{payload?.id ? "Edit appointment" : "New appointment"}</h2><span>Choose the patient, treatment and schedule.</span></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form"><X size={19} /></button>
        </header>
        <div className="appointment-booking-body">
          {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
          <section className="booking-form-section"><div className="booking-step">1</div><div className="booking-section-content"><h3>Client and service</h3>
            <label className="stacked-field"><span>Client <RequiredMark /></span><select aria-label="Client, required" value={form.clientId} onChange={(event) => update("clientId", event.target.value)}><option value="">{form.branch ? "Search or select a client" : "Select a branch first"}</option>{availableClients.map((client) => <option value={client.id} key={client.id}>{client.fullName}{client.mobile ? ` · ${client.mobile}` : ""}</option>)}</select></label>
            <div className="booking-two-column booking-service-grid"><label className="stacked-field"><span>Service <RequiredMark /></span><select aria-label="Service, required" value={form.serviceId} onChange={(event) => update("serviceId", event.target.value)}><option value="">{form.branch ? "Select a service" : "Select a branch first"}</option>{availableServices.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
            <label className="stacked-field"><span>Appointment type</span><select value={form.appointmentType} onChange={(event) => update("appointmentType", event.target.value)}>{["Consultation", "Treatment", "Follow-up", "Check-up"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
            {selectedService && <div className="service-selection-summary"><Clock size={16} /><span>{selectedService.duration || 60} minutes</span><strong>{servicePriceLabel(selectedService)}</strong></div>}
            {patientPackages.length > 0 && <label className="stacked-field"><span>Package / membership</span><select value={form.packageName} onChange={(event) => update("packageName", event.target.value)}><option value="">Pay per visit</option>{patientPackages.map((item) => <option value={item.name} key={item.id}>{item.name} · {item.remaining ?? item.balance ?? 0} remaining</option>)}</select></label>}
          </div></section>
          <section className="booking-form-section"><div className="booking-step">2</div><div className="booking-section-content"><h3>Date and location</h3><div className="booking-two-column">
            <label className="stacked-field"><span>Date <RequiredMark /></span><input aria-label="Date, required" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
            <label className="stacked-field"><span>Time <RequiredMark /></span><input aria-label="Time, required" type="time" step="900" value={form.time} onChange={(event) => update("time", event.target.value)} /></label>
            <label className="stacked-field"><span>Duration</span><select value={form.duration} onChange={(event) => update("duration", Number(event.target.value))}>{[15, 30, 45, 60, 75, 90, 120, 180].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select></label>
            <label className="stacked-field"><span>Branch <RequiredMark /></span><select aria-label="Branch, required" value={form.branch} onChange={(event) => update("branch", event.target.value)}><option value="" disabled>Select a branch</option>{branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
          </div><div className="booking-timezone-row"><span><strong>Timezone:</strong> {form.timezone === "Asia/Singapore" ? "Asia/Singapore (GMT+8)" : "Asia/Manila (GMT+8)"}</span><button type="button" onClick={() => setShowTimezoneSelect((current) => !current)}>{showTimezoneSelect ? "Done" : "Change"}</button>{showTimezoneSelect && <select aria-label="Timezone" value={form.timezone} onChange={(event) => update("timezone", event.target.value)}><option value="Asia/Manila">Asia/Manila (GMT+8)</option><option value="Asia/Singapore">Asia/Singapore (GMT+8)</option></select>}</div></div></section>
          <section className="booking-form-section"><div className="booking-step">3</div><div className="booking-section-content"><h3>Staff and room</h3><div className="booking-two-column">
            <label className="stacked-field"><span>Staff <RequiredMark /></span><select aria-label="Staff, required" value={form.staff} onChange={(event) => update("staff", event.target.value)}><option value="">Select available staff</option>{availableStaff.map((person) => <option key={person.id || person.name}>{person.name}</option>)}</select></label>
            <label className="stacked-field"><span>Room <RequiredMark /></span><select aria-label="Room, required" value={form.room} onChange={(event) => update("room", event.target.value)}><option value="">Select a room</option>{availableRooms.map((room) => <option key={room}>{room}</option>)}</select></label>
          </div>{form.staff && form.room && <><div className="availability-note"><Check size={16} /> Available times account for branch hours, staff, rooms/couches, and existing appointments.</div><div className="appointment-slot-picker" aria-label="Available appointment times">{availableSlots.slice(0, 20).map((slot) => <button className={form.time === slot ? "selected" : ""} type="button" key={slot} onClick={() => update("time", slot)}>{formatScheduleTime(parseTimeToMinutes(slot))}</button>)}{!availableSlots.length && <span>No conflict-free slots for these resources.</span>}</div></>}</div></section>
          <section className="booking-form-section"><div className="booking-step">4</div><div className="booking-section-content"><h3>Payment and notes</h3>
            <div className="booking-two-column"><label className="stacked-field"><span>Deposit (optional)</span><input type="number" min="0" value={form.deposit} onChange={(event) => update("deposit", event.target.value)} /></label><label className="stacked-field"><span>Insurance</span><input value={form.insurance} onChange={(event) => update("insurance", event.target.value)} placeholder="Provider or coverage note" /></label>
            <label className="stacked-field"><span>Recurrence</span><select value={form.recurrence} onChange={(event) => update("recurrence", event.target.value)}>{["None", "Weekly", "Every 2 weeks", "Monthly"].map((item) => <option key={item}>{item}</option>)}</select></label>{form.recurrence !== "None" && <label className="stacked-field"><span>Repeat until</span><input type="date" min={form.date} value={form.recurrenceUntil} onChange={(event) => update("recurrenceUntil", event.target.value)} /></label>}</div>
            <label className="stacked-field"><span>Tags</span><input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="VIP, first visit, follow-up" /></label>
            <label className="stacked-field"><span>Client notes</span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Preferences or information visible to the client" /></label>
            <label className="stacked-field"><span>Internal notes</span><textarea value={form.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} placeholder="Private notes for the clinic team" /></label>
          </div></section>
        </div>
        <footer className="appointment-booking-actions"><button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button><div><button className="secondary-button" type="button" onClick={(event) => submit(event, "Draft")} disabled={saving}>Save draft</button><button className="primary-button" type="submit" disabled={saving}><Check size={17} /> {saving ? "Saving..." : "Confirm booking"}</button></div></footer>
      </form>
    </div>
  );
}

function RoomModal({ payload = {}, branches = [], onClose, onSubmit }) {
  const initialBranch = branches.find((branch) => branch.name === payload.branch) ?? branches[0];
  const [form, setForm] = useState({ name: "", branchId: initialBranch?.id ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // The modal can render before bootstrap finishes. Keep the controlled select
  // and submit target aligned when active branches arrive asynchronously.
  const selectedBranch = branches.find((branch) => branch.id === form.branchId) ?? initialBranch;

  async function submit(event) {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, " ");
    if (!name) return setError("Room name is required.");
    if (!selectedBranch) return setError("Select a branch.");
    if ((selectedBranch.rooms ?? []).some((room) => room.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return setError(`${name} already exists in ${selectedBranch.name}.`);
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({ name, branchId: selectedBranch.id });
    } catch (submitError) {
      setError(submitError?.message || "Unable to add this room.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New room">
      <form className="modal-card room-modal" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close room form" disabled={saving}><X size={18} /></button>
        <ModalHeader icon={Home} title="New room" action="Room availability" />
        <p className="room-modal-copy">Add a room to the selected clinic branch. It will immediately become available for new appointment assignments.</p>
        {error && <div className="inline-state error" role="alert"><AlertCircle size={17} /> {error}</div>}
        <div className="form-grid room-modal-fields">
          <label className="stacked-field">
            <span>Room name <RequiredMark /></span>
            <input
              autoFocus
              aria-label="Room name, required"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Consultation Room"
              disabled={saving}
            />
          </label>
          <label className="stacked-field">
            <span>Branch <RequiredMark /></span>
            <select
              aria-label="Room branch, required"
              value={selectedBranch?.id ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
              disabled={saving || branches.length <= 1}
            >
              {!branches.length && <option value="">No accessible branches</option>}
              {branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving || !branches.length}>
            <Plus size={17} /> {saving ? "Adding room..." : "Add room"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EntityModal({ config, onClose }) {
  const [form, setForm] = useState(config.initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const sections = entityFormSections(config);

  async function submit(event) {
    event.preventDefault();
    const optionalFieldTypes = ["checkbox", "textarea", "photo", "consumables"];
    const missing = config.fields.find((item) => (item.required ?? (!optionalFieldTypes.includes(item.type) && item.name !== "id")) && form[item.name] === "");
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await Promise.resolve(config.onSubmit(form));
    } catch (submitError) {
      setError(submitError?.message || "Unable to save this record.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(item) {
    const optionalFieldTypes = ["checkbox", "textarea", "photo", "consumables"];
    const required = item.required ?? (!optionalFieldTypes.includes(item.type) && item.name !== "id");
    return (
      <FormField
        key={item.name}
        field={item}
        form={form}
        required={required}
        value={form[item.name]}
        onChange={(value) =>
          setForm((current) => {
            const next = { ...current, [item.name]: value };
            if (item.name === "templateId" && value && config.templateMessages) {
              next.message = config.templateMessages[value] ?? current.message;
            }
            if (item.name === "service" && config.serviceConsumablesByName) {
              next.consumables = config.serviceConsumablesByName[value] ?? [];
            }
            return next;
          })
        }
      />
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={config.title}>
      <form className={`modal-card entity-modal entity-modal-${config.formKind || "record"}`} onSubmit={submit}>
        <header className="form-modal-header">
          <ModalHeader icon={Edit3} title={config.title} action={config.formKind === "treatment" ? "Clinical record" : "Record details"} />
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close form"><X size={17} /></button>
        </header>
        <div className="form-modal-body">
          {error && <div className="inline-state error" role="alert"><AlertCircle size={17} /> {error}</div>}
          <div className="entity-form-sections">
            {sections.map((section) => (
              <section className="entity-form-section" key={section.title}>
                <div className="entity-form-section-heading"><h3>{section.title}</h3></div>
                <div className="form-grid">{section.fields.map(renderField)}</div>
              </section>
            ))}
          </div>
        </div>
        <footer className="modal-actions form-modal-footer">
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>
            <Check size={17} /> {saving ? "Saving..." : config.submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

function RequiredMark() {
  return <em className="required-mark" aria-label="required">*</em>;
}

function FieldLabel({ children, required }) {
  return (
    <FormLabel>
      {children}
      {required && <RequiredMark />}
    </FormLabel>
  );
}

function FormField({ field: item, form, required = false, value, onChange }) {
  const wrapperClass = item.type === "checkbox" ? "checkbox-field" : item.className ?? "";
  const fieldId = `field-${item.name}`;
  const suggestionListId = `${fieldId}-suggestions`;
  const hasSuggestions = item.type === "suggest" || item.type === "number-suggest";
  const isNumberField = item.type === "number" || item.type === "number-suggest";
  const textIdentity = `${item.name} ${item.label}`.toLowerCase();
  const isPhoneField = /\b(mobile|phone|contact)\b/.test(textIdentity);
  const inputType = isPhoneField && item.type === "text" ? "tel" : item.type === "suggest" ? "text" : item.type === "number-suggest" ? "number" : item.type;
  const inputMode = isNumberField ? "decimal" : isPhoneField ? "tel" : undefined;
  const autoComplete =
    item.type === "email"
      ? "email"
      : isPhoneField
        ? "tel"
        : item.name === "fullName"
          ? "name"
          : undefined;

  function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const isProductPhoto = item.name === "image";

    const storeImage = async (dataUrl) => {
      try {
        const category = item.name === "image"
          ? "inventory-photo"
          : form.role
            ? "staff-photo"
            : "client-photo";
        const uploaded = await uploadImageAsset(dataUrl, category, form.branch || "All branches");
        onChange(uploaded.asset.url);
      } catch (error) {
        window.alert(error.message || "The image could not be uploaded securely.");
      }
    };

    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const targetWidth = isProductPhoto ? 960 : 480;
        const targetHeight = isProductPhoto ? 720 : 640;
        const targetRatio = targetWidth / targetHeight;
        const imageRatio = image.width / image.height;
        const sourceWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
        const sourceHeight = imageRatio > targetRatio ? image.height : image.width / targetRatio;
        const sourceX = (image.width - sourceWidth) / 2;
        const sourceY = (image.height - sourceHeight) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          void storeImage(String(reader.result ?? ""));
          return;
        }
        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
        void storeImage(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.onerror = () => { void storeImage(String(reader.result ?? "")); };
      image.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  }

  if (item.type === "checkbox") {
    return (
      <label className={wrapperClass} htmlFor={fieldId}>
        <input id={fieldId} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <FormLabel>{item.label}</FormLabel>
      </label>
    );
  }

  if (item.type === "photo") {
    const isProductPhoto = item.name === "image";
    return (
      <div className={`photo-field ${item.className ?? ""}`}>
        {isProductPhoto ? (
          <span className={`product-photo-preview ${value ? "has-image" : ""}`} aria-label="Product photo preview">
            {value ? <img src={value} alt="" /> : <Image size={28} aria-hidden="true" />}
          </span>
        ) : (
          <ClientAvatar client={{ fullName: [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ") || form.fullName || form.name || "Profile", photo: value }} size="large" />
        )}
        <div>
          <FieldLabel required={required}>{item.label}</FieldLabel>
          <div className="photo-field-actions">
            <label className="secondary-button small">
              <Upload size={15} aria-hidden="true" />
              Upload photo
              <input className="photo-file-input" id={fieldId} type="file" accept="image/*" onChange={handlePhotoUpload} />
            </label>
            {value ? (
              <button className="ghost-button small" type="button" onClick={() => onChange("")} aria-label={`Remove ${item.label.toLowerCase()}`}>
                <Trash2 size={15} aria-hidden="true" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === "consumables") {
    const parsedRows = Array.isArray(value)
      ? value
      : String(value || "")
        .split(/[;,\n]+/)
        .map((entry) => {
          const match = entry.trim().match(/^(.+?)(?:\s*[:x]\s*(\d+(?:\.\d+)?))?$/i);
          return { item: match?.[1]?.trim() || "", qty: Number(match?.[2] || 1) };
        })
        .filter((entry) => entry.item);
    const rows = parsedRows.map((entry) => ({ item: entry.item || entry.name || "", qty: Number(entry.qty || 0) }));
    const options = item.options ?? [];
    const selectedNames = new Set(rows.map((entry) => entry.item));

    function updateRow(index, patch) {
      onChange(rows.map((entry, rowIndex) => rowIndex === index ? { ...entry, ...patch } : entry));
    }

    function addRow() {
      const nextOption = options.find((option) => !selectedNames.has(option.value));
      if (nextOption) onChange([...rows, { item: nextOption.value, qty: 1 }]);
    }

    return (
      <div className={`consumable-usage-field ${item.className ?? ""}`}>
        <FieldLabel required={required}>{item.label}</FieldLabel>
        <small className="field-suggestion-hint">
          {item.usageMode === "actual"
            ? "Defaults come from the service. Adjust them to the exact quantity used; saving deducts this quantity from inventory."
            : "Set the usual quantity for one session. Staff can adjust the actual quantity on each treatment record."}
        </small>
        {rows.length ? (
          <div className="consumable-usage-rows">
            {rows.map((row, index) => {
              const selectedOption = options.find((option) => option.value === row.item);
              return (
                <div className="consumable-usage-row" key={`${row.item}-${index}`}>
                  <select aria-label={`Consumable item ${index + 1}`} value={row.item} onChange={(event) => updateRow(index, { item: event.target.value })}>
                    <option value="">Select inventory item</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value} disabled={selectedNames.has(option.value) && option.value !== row.item}>{option.label}</option>
                    ))}
                  </select>
                  <label>
                    <span>Quantity</span>
                    <input aria-label={`Consumable quantity ${index + 1}`} type="number" min="0.01" step="0.01" inputMode="decimal" value={row.qty || ""} onChange={(event) => updateRow(index, { qty: Number(event.target.value) })} />
                  </label>
                  <span className="consumable-unit">{selectedOption?.unit || "unit"}</span>
                  <button className="ghost-button small" type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Remove ${row.item || "consumable"}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : <span className="multi-select-empty">No consumables configured.</span>}
        <button className="secondary-button small consumable-add-button" type="button" onClick={addRow} disabled={!options.some((option) => !selectedNames.has(option.value))}>
          <Plus size={15} aria-hidden="true" /> Add consumable
        </button>
      </div>
    );
  }

  if (item.type === "multi-select") {
    const isServiceSelection = item.name === "services";
    const selectedValues = splitList(value).filter((entry, index, entries) => entries.indexOf(entry) === index);
    const options = (item.options ?? []).map((option) => ({
      value: typeof option === "string" ? option : option.value,
      label: typeof option === "string" ? option : option.label,
    }));
    const availableOptions = options.filter((option) => !selectedValues.includes(option.value));

    function updateSelected(nextValues) {
      onChange(nextValues.join(", "));
    }

    function addSelected(nextValue) {
      if (!nextValue) return;
      if (isServiceSelection && nextValue === "All services") {
        updateSelected([nextValue]);
        return;
      }
      updateSelected([...selectedValues.filter((entry) => entry !== "All services"), nextValue]);
    }

    return (
      <div className={`multi-select-field ${item.className ?? ""}`}>
        <FieldLabel required={required}>{item.label}</FieldLabel>
        {selectedValues.length ? (
          <div className="multi-select-values" aria-live="polite">
            {selectedValues.map((entry) => (
              <span className="multi-select-chip" key={entry}>
                {entry}
                <button
                  type="button"
                  onClick={() => updateSelected(selectedValues.filter((selected) => selected !== entry))}
                  aria-label={`Remove ${entry}`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="multi-select-empty">No {item.label.toLowerCase()} selected yet.</span>
        )}
        <select
          id={fieldId}
          value=""
          onChange={(event) => addSelected(event.target.value)}
          aria-label={`Add ${item.label.toLowerCase()}`}
          disabled={!availableOptions.length}
        >
          <option value="">{availableOptions.length ? `Add ${item.label.toLowerCase()}…` : `All available ${item.label.toLowerCase()} selected`}</option>
          {availableOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <small className="field-suggestion-hint">Choose as many {item.label.toLowerCase()} as needed.</small>
      </div>
    );
  }

  return (
    <label className={wrapperClass} htmlFor={fieldId}>
      <FieldLabel required={required}>{item.label}</FieldLabel>
      {item.type === "textarea" ? (
        <textarea id={fieldId} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} />
      ) : item.type === "select" ? (
        <select id={fieldId} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required}>
          {required && value === "" && <option value="" disabled>Select {item.label.toLowerCase()}</option>}
          {(item.options ?? []).map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const label = typeof option === "string" ? option : option.label;
            return <option key={value} value={value}>{label}</option>;
          })}
        </select>
      ) : (
        <>
          <input
            id={fieldId}
            type={inputType}
            inputMode={inputMode}
            autoComplete={autoComplete}
            list={hasSuggestions ? suggestionListId : undefined}
            placeholder={hasSuggestions ? "Choose a suggestion or type your own" : undefined}
            value={value ?? ""}
            onChange={(event) => onChange(isNumberField ? Number(event.target.value) : event.target.value)}
            required={required}
          />
          {hasSuggestions && (
            <>
              <datalist id={suggestionListId}>
                {(item.options ?? []).map((option) => <option key={option} value={option} />)}
              </datalist>
              <small className="field-suggestion-hint">Select a suggested answer or enter a custom value.</small>
            </>
          )}
        </>
      )}
    </label>
  );
}

function ConfirmDialog({ confirm, onCancel, onConfirmComplete }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card confirm-card">
        <ModalHeader icon={AlertCircle} title={confirm.title} action="Confirmation" />
        <p>{confirm.copy}</p>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancel</button>
          <button
            className="primary-button danger"
            type="button"
            onClick={() => {
              confirm.onConfirm();
              onConfirmComplete();
            }}
          >
            {confirm.actionLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartTable({
  rows,
  columns,
  globalSearch = "",
  pageSize = 6,
  emptyTitle = "No records found",
  toolbarActions = null,
  showSearch = false,
  exportFilename = "zenshotech-export.csv",
  exportLabel = "CSV",
  exportColumns = null,
  allowEmptyExport = false,
  showToolbar = true,
  showStatus = true,
  selectable = true,
  compactPagination = false,
}) {
  const [query, setQuery] = useState("");
  const sortableColumns = columns.filter((column) => column.sortable !== false && column.key !== "actions");
  const defaultSortKey = sortableColumns[0]?.key ?? columns[0]?.key;
  const [sort, setSort] = useState({ key: defaultSortKey, dir: "asc" });
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const activeQuery = `${query} ${globalSearch}`.trim();

  function rowKey(row, index) {
    return String(row.id ?? `${row[columns[0]?.key]}-${index}`);
  }

  function cellValue(row, column) {
    if (column.exportValue) return column.exportValue(row);
    return row[column.key];
  }

  function isSortable(column) {
    return column.sortable !== false && column.key !== "actions";
  }

  const filtered = useMemo(() => {
    const matches = rows.filter((row) => {
      if (!activeQuery) return true;
      return columns.some((column) => normalize(cellValue(row, column)).includes(normalize(activeQuery)));
    });
    if (!sort.key) return matches;
    const sortColumn = columns.find((column) => column.key === sort.key);
    return [...matches].sort((a, b) => {
      const left = normalize(sortColumn ? cellValue(a, sortColumn) : a[sort.key]);
      const right = normalize(sortColumn ? cellValue(b, sortColumn) : b[sort.key]);
      if (left < right) return sort.dir === "asc" ? -1 : 1;
      if (left > right) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [activeQuery, columns, rows, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const visibleStart = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(page * pageSize, filtered.length);
  const selectedRows = filtered.filter((row, index) => selectedKeys.has(rowKey(row, index)));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row, index) => selectedKeys.has(rowKey(row, (page - 1) * pageSize + index)));

  useEffect(() => {
    setPage(1);
  }, [activeQuery, rows.length]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [activeQuery, rows.length]);

  function changeSort(key) {
    const column = columns.find((item) => item.key === key);
    if (!column || !isSortable(column)) return;
    setSort((current) => ({ key, dir: current.key === key && current.dir === "asc" ? "desc" : "asc" }));
  }

  function toggleRow(row, index) {
    const key = rowKey(row, index);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleVisibleRows() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleRows.forEach((row, index) => {
        const key = rowKey(row, (page - 1) * pageSize + index);
        if (allVisibleSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  return (
    <div className="smart-table">
      {showToolbar && <div className="table-toolbar">
        <div className="table-toolbar-main">
          {toolbarActions && <div className="table-toolbar-actions">{toolbarActions}</div>}
          {showSearch && (
            <label className="search-box compact">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search this table"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search table..."
              />
            </label>
          )}
        </div>
        <button className="secondary-button small" type="button" onClick={() => downloadCsv(exportFilename, filtered, exportColumns || columns)} disabled={!allowEmptyExport && !filtered.length}>
          <Download size={16} aria-hidden="true" /> {exportLabel}
        </button>
      </div>}
      {showStatus && <div className="table-status-row" aria-live="polite">
        <span>{compactPagination ? `Showing ${visibleStart} to ${visibleEnd} of ${filtered.length} result${filtered.length === 1 ? "" : "s"}` : `${visibleStart}-${visibleEnd} of ${filtered.length} result${filtered.length === 1 ? "" : "s"}`}</span>
        {selectedKeys.size > 0 && (
          <div className="bulk-actions">
            <strong>{selectedKeys.size} selected</strong>
            <button className="secondary-button small" type="button" onClick={() => downloadCsv(`selected-${exportFilename}`, selectedRows, exportColumns || columns)}>
              <Download size={15} aria-hidden="true" /> Export selected
            </button>
            <button className="ghost-button small" type="button" onClick={() => setSelectedKeys(new Set())}>Clear</button>
          </div>
        )}
      </div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {selectable && <th className="select-column" scope="col">
                <input
                  type="checkbox"
                  aria-label={allVisibleSelected ? "Clear visible row selection" : "Select visible rows"}
                  checked={allVisibleSelected}
                  onChange={toggleVisibleRows}
                />
              </th>}
              {columns.map((column) => (
                <th className={column.className ?? ""} key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {!isSortable(column) ? (
                    column.label
                  ) : (
                    <button type="button" onClick={() => changeSort(column.key)} aria-label={`Sort by ${column.label}`}>
                      {column.label}
                      {sort.key === column.key && <ChevronDown className={`sort-indicator ${sort.dir}`} size={14} aria-hidden="true" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={rowKey(row, (page - 1) * pageSize + index)} className={selectedKeys.has(rowKey(row, (page - 1) * pageSize + index)) ? "is-selected" : ""}>
                {selectable && <td className="select-column" data-label="Select">
                  <input
                    type="checkbox"
                    aria-label={`Select row ${visibleStart + index}`}
                    checked={selectedKeys.has(rowKey(row, (page - 1) * pageSize + index))}
                    onChange={() => toggleRow(row, (page - 1) * pageSize + index)}
                  />
                </td>}
                {columns.map((column) => (
                  <td className={column.className ?? ""} key={column.key} data-label={column.label}>{column.render ? column.render(row) : String(row[column.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleRows.length && <EmptyState title={emptyTitle} copy="Try adjusting search, filters, or add a new record." secondary="Search and filters apply across the current branch scope." />}
      </div>
      <div className="pagination">
        {!compactPagination && <span>Page {page} of {pageCount}</span>}
        <div>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
            <ChevronLeft size={15} aria-hidden="true" /> Previous
          </button>
          <strong>{compactPagination ? page : `${page} / ${pageCount}`}</strong>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>
            Next <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={20} aria-hidden="true" />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="section-header">
      <div>
        <Icon size={18} aria-hidden="true" />
        <SectionTitle>{title}</SectionTitle>
      </div>
      {action && <span>{action}</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${statusClass(status)}`}>{status}</span>;
}

function ActionItem({ icon: Icon, title, copy, onClick }) {
  return (
    <button className="action-item" type="button" onClick={onClick}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
    </button>
  );
}

function AvailabilityRow({ label, value }) {
  return (
    <div className="availability-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordItem({ label, value }) {
  return (
    <article className="record-item">
      <span>{label}</span>
      <strong>{value || "Not set"}</strong>
    </article>
  );
}

function MiniPanel({ icon: Icon, title, rows, empty }) {
  return (
    <article className="mini-panel">
      <div>
        <Icon size={17} />
        <strong>{title}</strong>
      </div>
      {rows.length ? rows.slice(0, 4).map((row) => <span key={row}>{row}</span>) : <small>{empty}</small>}
    </article>
  );
}

function RecordPill({ label, value }) {
  return (
    <div className="record-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChartBars({ values }) {
  return (
    <div className="chart-panel" aria-label="Sales chart">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}

function RankList({ rows, formatter = (value) => value }) {
  return (
    <div className="rank-list">
      {rows.map((row, index) => (
        <article key={`${row.name}-${index}`}>
          <div>
            <span>{index + 1}</span>
            <strong>{row.name}</strong>
          </div>
          <b>{formatter(row.count)}</b>
        </article>
      ))}
    </div>
  );
}

function MessageItem({ title, copy }) {
  return (
    <article className="message-item">
      <PhoneCall size={18} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
    </article>
  );
}

function SupportItem({ icon: Icon, title, copy }) {
  return (
    <article className="support-item">
      <Icon size={19} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{copy}</span>
      </div>
    </article>
  );
}

function Checklist({ items }) {
  return (
    <ul className="checklist">
      {items.map((item) => (
        <li key={item}>
          <Check size={16} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, copy, actionLabel, onAction, secondary }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">
        <Inbox size={20} />
      </span>
      <strong>{title}</strong>
      <HelperText>{copy}</HelperText>
      {secondary && <small>{secondary}</small>}
      {actionLabel && onAction && (
        <button className="secondary-button small" type="button" onClick={onAction}>
          <Plus size={15} aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`toast ${toast.tone}`}>
      <Check size={17} />
      <span>{toast.message}</span>
    </div>
  );
}

function tallyItems(transactions, type) {
  const tally = {};
  transactions.filter((transaction) => transaction.status !== "Void" && !transaction.testMode).forEach((transaction) => {
    transaction.items
      .filter((item) => item.type === type)
      .forEach((item) => {
        tally[item.name] = (tally[item.name] || 0) + Number(item.qty || 1);
      });
  });
  return Object.entries(tally)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default App;

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
  users,
} from "./data";
import { canManageOrganization, isAdmin, isBusinessOwner } from "./organizationRoles.js";
import { navItems, navSections } from "./config/sidebar.jsx";
import FaceTrackAttendance from "./facetrack/FaceTrackAttendance.jsx";
import FaceTrackKiosk from "./facetrack/FaceTrackKiosk.jsx";
import {
  checkApiHealth,
  changeAccountPassword,
  acceptInvitation,
  createInvitation,
  createBranchRecord,
  deleteBranchRecord,
  updateBranchRecord,
  addLeadActivity,
  bookLeadAppointment,
  completePosCheckout,
  convertLeadToClient,
  deleteResourceRecord,
  listResourceRecords,
  loadBootstrap,
  loadLeadIntegrations,
  loadLeadWebhookEvents,
  loadMyWorkspace,
  loadInvitations,
  loginAccount,
  logoutAccount,
  mergeLeadDuplicate,
  postInventoryMovement,
  redeemPackageRecord,
  recordAttendance,
  requestPasswordReset,
  resetAccountPassword,
  resendInvitation,
  restoreAccountSession,
  revokeInvitation,
  inspectInvitation,
  scheduleLeadFollowUp,
  saveResourceRecord,
  saveSettingsRecord,
  sendMarketingCampaign,
  setApiSessionContext,
  submitPublicBooking,
  updateLeadStage,
  uploadImageAsset,
  voidTransactionRecord,
} from "./lib/api.js";

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
const paymentMethods = ["Cash", "Credit Card", "Debit Card", "GCash", "Maya", "Bank Transfer", "Check", "Gift Certificate", "Account Balance"];
const posPaymentMethods = ["Cash", "Credit Card", "Debit Card", "GCash", "Maya", "Bank Transfer", "Check", "Gift Certificate", "Package"];
const posPaymentOptions = [
  { label: "Cash", method: "Cash", icon: CircleDollarSign },
  { label: "Card", method: "Credit Card", icon: CreditCard },
  { label: "Split", method: "Cash", icon: HandCoins, split: true },
  { label: "Package", method: "Package", icon: Gift },
];
const posCatalogPageSize = 14;

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayDate() {
  return isoDate(new Date());
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
  return "/brand/mace-logo.png";
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

function modulesForSession(session) {
  const serverModules = session?.access?.modules;
  if (Array.isArray(serverModules)) {
    return serverModules.filter((moduleId) => moduleIdSet.has(moduleId));
  }
  return roleAccess[session?.role] ?? [];
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
  const moduleId = String(hash ?? "")
    .replace(/^#\/?/, "")
    .trim();
  return moduleIdSet.has(moduleId) ? moduleId : "";
}

function normalizedPathname(pathname) {
  const path = String(pathname ?? "/").replace(/\/+$/, "");
  return path || "/";
}

function moduleFromPath(pathname) {
  const path = normalizedPathname(pathname);
  if (path === "/pos") return "pos";
  if (path === "/attendance" || path === "/attendance/kiosk") return "facetrack-attendance";
  return "";
}

function downloadCsv(filename, rows, columns) {
  const header = columns.map((column) => column.label).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.exportValue ? column.exportValue(row) : row[column.key];
          return `"${String(raw ?? "").replace(/"/g, '""')}"`;
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
  const sessionModules = useMemo(() => modulesForSession(session), [session]);
  const [authChecking, setAuthChecking] = useState(true);
  const initialPathModule = typeof window === "undefined" ? "" : moduleFromPath(window.location.pathname);
  const initialHashModule = typeof window === "undefined" ? "" : moduleFromHash(window.location.hash);
  const [activeModule, setActiveModuleState] = useStoredState("active-module", initialPathModule || initialHashModule || defaultModuleId);
  const [branchScope, setBranchScope] = useStoredState("branch-scope", "All branches");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useStoredState("sidebar-collapsed", false);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [receiptToPrint, setReceiptToPrint] = useState(null);
  const [printReceiptNonce, setPrintReceiptNonce] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [apiState, setApiState] = useState({
    status: "checking",
    message: "Checking database connection...",
  });

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
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [branchRecords, setBranchRecords] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [leadIntegrations, setLeadIntegrations] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [cart, setCart] = useState([]);
  const [sendingCampaignId, setSendingCampaignId] = useState("");
  const [isPosChromeRevealed, setIsPosChromeRevealed] = useState(false);
  const isPosView = activeModule === "pos";
  const isApplicationsView = activeModule === "applications";
  const isFaceTrackView = activeModule === "facetrack-attendance";
  const isFaceTrackKioskView = typeof window !== "undefined" && normalizedPathname(window.location.pathname) === "/attendance/kiosk";
  const posTouchStartRef = useRef(null);
  const posChromeHideTimerRef = useRef(0);

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
    if (session?.branch && session.branch !== "All branches" && branchScope !== session.branch) {
      setBranchScope(session.branch);
    }
  }, [branchScope, session, setBranchScope]);

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

      if (typeof window !== "undefined") {
        const nextUrl = nextModule === "pos"
          ? "/pos"
          : nextModule === "facetrack-attendance"
            ? "/attendance"
            : `/#/${nextModule}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (currentUrl !== nextUrl) {
          if (options.replace) {
            window.history.replaceState(null, "", nextUrl);
          } else {
            window.history.pushState(null, "", nextUrl);
          }
        }

        if (!options.preserveScroll) {
          window.requestAnimationFrame(() => window.scrollTo(0, 0));
        }
      }

      if (!options.keepDrawerOpen) {
        setIsSidebarDrawerOpen(false);
      }
      setIsMobileMoreOpen(false);
    },
    [session, sessionModules, setActiveModuleState],
  );

  useEffect(() => {
    if (!session || typeof window === "undefined") return undefined;
    const canOpenPosShortcut = sessionModules.includes("pos");
    if (!canOpenPosShortcut) return undefined;

    function openPosFromKeyboard(event) {
      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setActiveModule(activeModule === "pos" ? "my-workspace" : "pos");
      }
    }

    window.addEventListener("keydown", openPosFromKeyboard);
    return () => window.removeEventListener("keydown", openPosFromKeyboard);
  }, [activeModule, session, sessionModules, setActiveModule]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    function syncModuleFromLocation() {
      const routeModule = moduleFromPath(window.location.pathname) || moduleFromHash(window.location.hash);
      if (routeModule) {
        if (routeModule === "pos" && moduleFromHash(window.location.hash) === "pos" && moduleFromPath(window.location.pathname) !== "pos") {
          window.history.replaceState(null, "", "/pos");
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
  }, [setActiveModule]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (moduleFromPath(window.location.pathname)) return;
    if (!moduleFromHash(window.location.hash)) {
      setActiveModule(activeModule, { replace: true, keepDrawerOpen: true });
    }
  }, [activeModule, setActiveModule]);

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
        const [health, bootstrap] = await Promise.all([checkApiHealth(), loadBootstrap()]);
        if (cancelled) return;

        const apiClients = Array.isArray(bootstrap.clients) ? bootstrap.clients : [];
        setClients(apiClients);
        setAppointments(Array.isArray(bootstrap.appointments) ? bootstrap.appointments : []);
        setServices(Array.isArray(bootstrap.services) ? bootstrap.services : []);
        setInventory(Array.isArray(bootstrap.inventory) ? bootstrap.inventory : []);
        setTransactions(Array.isArray(bootstrap.transactions) ? bootstrap.transactions : []);
        setTreatments(Array.isArray(bootstrap.treatments) ? bootstrap.treatments : []);
        setPackages(Array.isArray(bootstrap.packages) ? bootstrap.packages : []);
        setGiftCertificates(Array.isArray(bootstrap.giftCertificates) ? bootstrap.giftCertificates : []);
        setLeads(Array.isArray(bootstrap.leads) ? bootstrap.leads : []);
        setStaff(Array.isArray(bootstrap.staff) ? bootstrap.staff : []);
        setExpenses(Array.isArray(bootstrap.expenses) ? bootstrap.expenses : []);
        setDiscounts(Array.isArray(bootstrap.discounts) ? bootstrap.discounts : []);
        setSmsTemplates(Array.isArray(bootstrap.smsTemplates) ? bootstrap.smsTemplates : []);
        setCampaigns(Array.isArray(bootstrap.campaigns) ? bootstrap.campaigns : []);
        setAuditLogs(Array.isArray(bootstrap.auditLogs) ? bootstrap.auditLogs : []);
        setInventoryMovements(Array.isArray(bootstrap.inventoryMovements) ? bootstrap.inventoryMovements : []);
        setLeadIntegrations(Array.isArray(bootstrap.leadIntegrations) ? bootstrap.leadIntegrations : []);
        setWebhookEvents(Array.isArray(bootstrap.webhookEvents) ? bootstrap.webhookEvents : []);
        setBranchRecords(Array.isArray(bootstrap.branches) ? bootstrap.branches : []);
        if (bootstrap.settings) {
          setSettings(bootstrap.settings);
        }

        if (apiClients.length) {
          setSelectedClientId((current) =>
            apiClients.some((client) => client.id === current) ? current : apiClients[0].id,
          );
        }

        const connectedClientCount = Number.isFinite(Number(health.clientCount))
          ? Number(health.clientCount)
          : Array.isArray(apiClients)
            ? apiClients.length
            : 0;

        setApiState({
          status: "connected",
          message: `Supabase connected / ${connectedClientCount} clients / ${bootstrap.appointments?.length ?? 0} bookings`,
        });
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
            setApiState({
              status: "offline",
              message: `Partial sync / ${apiClients.length} clients restored / other modules unavailable`,
            });
            return;
          }
        } catch {
          // The dedicated client fallback is best-effort; retain the full offline state below.
        }

        if (!cancelled) {
          setApiState({
            status: "offline",
            message: "API offline / writes require reconnection",
          });
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
      setActiveModule(sessionModules.includes(defaultModuleId) ? defaultModuleId : sessionModules[0], { replace: true });
    }
  }, [activeModule, session, sessionModules, setActiveModule]);

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
    return navItems.filter((item) => sessionModules.includes(item.id));
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

  const stats = useMemo(() => {
    const today = todayDate();
    const todaysTransactions = scopedTransactions.filter((transaction) => transaction.date === today);
    const monthPrefix = today.slice(0, 7);
    const monthTransactions = scopedTransactions.filter((transaction) => transaction.date?.startsWith(monthPrefix));
    const revenueToday = todaysTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const revenueMonth = monthTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const expensesMonth = expenses
      .filter((expense) => expense.date?.startsWith(monthPrefix))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const todaysAppointments = scopedAppointments.filter((appointment) => appointment.date === today);
    const pendingAppointments = scopedAppointments.filter((appointment) => canonicalAppointmentStatus(appointment.status) === "Pending Confirmation");
    const noShows = scopedAppointments.filter((appointment) => canonicalAppointmentStatus(appointment.status) === "No Show");
    const lowStock = scopedInventory.filter((item) => stockStatus(item) !== "Healthy");
    const openLeads = leads.filter((lead) => !closedLeadStatuses.includes(canonicalLeadStatus(lead.status)));
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
      newClients: clients.filter((client) => client.retention === "New").length,
      returningClients: clients.filter((client) => client.retention === "Returning").length,
    };
  }, [clients, expenses, leads, scopedAppointments, scopedInventory, scopedTransactions]);

  function notify(message, tone = "success") {
    setToast({ id: createId("toast"), message, tone });
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

  function markApiConnected(message) {
    setApiState({
      status: "connected",
      message,
    });
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
    setSession(user);
    setActiveModule("my-workspace");
    addAudit("Signed in", `${user.name} opened ${settings.productName} as ${user.role}.`, "Authentication", user);
    notify(`Welcome, ${user.name}.`);
  }

  async function handleLogout() {
    addAudit("Signed out", `${session?.name ?? "User"} ended the workspace session.`, "Authentication");
    await logoutAccount().catch(() => {});
    setClients([]);
    setAppointments([]);
    setServices([]);
    setInventory([]);
    setTransactions([]);
    setTreatments([]);
    setPackages([]);
    setGiftCertificates([]);
    setLeads([]);
    setStaff([]);
    setExpenses([]);
    setDiscounts([]);
    setSmsTemplates([]);
    setCampaigns([]);
    setBranchRecords([]);
    setLeadIntegrations([]);
    setWebhookEvents([]);
    setAuditLogs([]);
    setInventoryMovements([]);
    setSelectedClientId("");
    setCart([]);
    setReceiptToPrint(null);
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

  async function updateBranch(branch, values) {
    const result = await updateBranchRecord(branch.id, values);
    setBranchRecords((current) => [...current.filter((item) => item.id !== result.branch.id), result.branch].sort((a, b) => a.name.localeCompare(b.name)));
    if (result.previousName && result.previousName !== result.branch.name) {
      const rename = (item) => item.branch === result.previousName ? { ...item, branch: result.branch.name } : item;
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
        assignedBranch: item.assignedBranch === result.previousName ? result.branch.name : item.assignedBranch,
      })));
      setServices((current) => current.map((service) => ({
        ...service,
        branches: Array.isArray(service.branches)
          ? [...new Set(service.branches.map((name) => name === result.previousName ? result.branch.name : name))]
          : service.branches,
      })));
      if (branchScope === result.previousName) setBranchScope(result.branch.name);
    }
    applyAuditLog(result.auditLog);
    notify(`${result.branch.name} updated.`);
    return result.branch;
  }

  async function deleteBranch(branch, confirmationName) {
    const result = await deleteBranchRecord(branch.id, confirmationName);
    removeById(setBranchRecords, result.id);
    if (branchScope === branch.name) setBranchScope("All branches");
    applyAuditLog(result.auditLog);
    notify(`${branch.name} deleted.`);
  }

  function openModal(type, payload = {}) {
    setModal({ type, payload });
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
        return current.map((entry) => (entry.key === item.key ? { ...entry, qty: entry.qty + 1 } : entry));
      }
      return [...current, { ...item, qty: 1 }];
    });
  }

  function updateCartQty(key, qty) {
    setCart((current) =>
      current
        .map((item) => (item.key === key ? { ...item, qty: Math.max(1, Number(qty) || 1) } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function removeCartItem(key) {
    setCart((current) => current.filter((item) => item.key !== key));
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
    applyAuditLog(result.auditLog);
    setCart([]);
    closeModal();
    markApiConnected("SQLite connected / POS transaction saved");
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
    markApiConnected("SQLite connected / appointment saved");
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
      markApiConnected("SQLite connected / appointment status saved");
      notify(`Appointment marked ${nextStatus}.`);
    } catch (error) {
      notify(error.message || "Unable to update appointment status.", "error");
    }
  }

  async function saveClient(values) {
    const isExisting = Boolean(values.id);
    const record = {
      ...values,
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
    markApiConnected("SQLite connected / client saved");
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

    if (saved > 0) markApiConnected("SQLite connected / clients imported");
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
            markApiConnected("SQLite connected / client deleted");
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
    const record = {
      ...values,
      id: values.id || createId("svc"),
      duration: Number(values.duration || 0),
      price: Number(values.price || 0),
      active: values.active !== false,
      pos: values.pos !== false,
      branches: splitList(values.branches),
      staff: splitList(values.staff),
      consumables: splitList(values.consumables),
    };
    const result = await saveResourceRecord("services", record, { existing: Boolean(values.id) });
    upsertById(setServices, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / service saved");
    notify(values.id ? "Service updated." : "Service created.");
  }

  async function toggleService(id) {
    const service = services.find((item) => item.id === id);
    if (!service) return;
    try {
      const result = await saveResourceRecord("services", { ...service, active: !service.active }, { existing: true });
      upsertById(setServices, result.record);
      applyAuditLog(result.auditLog);
      markApiConnected("SQLite connected / service status saved");
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
    markApiConnected("SQLite connected / inventory saved");
    notify(values.id ? "Inventory updated." : "Inventory item added.");
  }

  async function receiveStock(id, qty = 5, reason = "Stock received") {
    try {
      const result = await postInventoryMovement(id, { qty, reason, date: todayDate() });
      upsertById(setInventory, result.inventoryItem);
      upsertById(setInventoryMovements, result.movement);
      applyAuditLog(result.auditLog);
      markApiConnected("SQLite connected / stock movement saved");
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
    markApiConnected("SQLite connected / lead saved");
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

    if (saved > 0) markApiConnected("SQLite connected / leads imported");
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
            markApiConnected("SQLite connected / lead deleted");
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
      markApiConnected("SQLite connected / lead status saved");
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
      markApiConnected("SQLite connected / lead integrations refreshed");
      notify("Lead integrations refreshed.");
    } catch (error) {
      notify(error.message || "Unable to refresh lead integrations.", "error");
    }
  }

  async function saveTreatment(values) {
    const client = clients.find((item) => item.id === values.clientId);
    const record = {
      ...values,
      id: values.id || createId("tr"),
      client: client?.fullName ?? values.client,
      photos: Number(values.photos || 0),
    };
    const result = await saveResourceRecord("treatments", record, { existing: Boolean(values.id) });
    upsertById(setTreatments, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / treatment saved");
    notify("Treatment record saved.");
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
    markApiConnected("SQLite connected / expense saved");
    notify("Expense saved.");
  }

  async function saveStaff(values) {
    const record = {
      ...values,
      id: values.id || createId("st"),
      commissionRate: Number(values.commissionRate || 0),
    };
    const result = await saveResourceRecord("staff", record, { existing: Boolean(values.id) });
    upsertById(setStaff, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / employee saved");
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
      markApiConnected("SQLite connected / attendance saved");
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
      transferable: Boolean(values.transferable),
    };
    const result = await saveResourceRecord("packages", record, { existing: Boolean(values.id) });
    upsertById(setPackages, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / package saved");
    notify("Package saved.");
  }

  async function redeemPackage(id) {
    try {
      const result = await redeemPackageRecord(id);
      upsertById(setPackages, result.record);
      applyAuditLog(result.auditLog);
      markApiConnected("SQLite connected / package session redeemed");
      notify("Package session redeemed.");
    } catch (error) {
      notify(error.message || "Unable to redeem package session.", "error");
    }
  }

  async function saveCampaign(values) {
    const record = {
      ...values,
      id: values.id || createId("cmp"),
      sent: Number(values.sent || 0),
      booked: Number(values.booked || 0),
      credits: Number(values.credits || 0),
    };
    const result = await saveResourceRecord("campaigns", record, { existing: Boolean(values.id) });
    upsertById(setCampaigns, result.record);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / campaign saved");
    notify("Campaign saved.");
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
        setSettings(savedSettings.settings);
        applyAuditLog(savedSettings.auditLog);
      }

      markApiConnected("SQLite connected / campaign delivery saved");
      notify(failed ? `${sent} ${channelLabel} sent, ${failed} failed.` : `${sent} ${channelLabel} sent.`);
    } catch (error) {
      addAudit("Marketing campaign failed", `${campaign.name}: ${error.message || "Delivery failed."}`, "Marketing");
      notify(error.message || "Campaign delivery failed.", "error");
    } finally {
      setSendingCampaignId("");
    }
  }

  async function saveSettings(values) {
    const result = await saveSettingsRecord({ ...settings, ...values });
    setSettings(result.settings);
    applyAuditLog(result.auditLog);
    closeModal();
    markApiConnected("SQLite connected / settings saved");
    notify("Settings updated.");
  }

  async function publicBooking(values) {
    const result = await submitPublicBooking(values);
    if (result.client) upsertById(setClients, result.client);
    if (result.lead) upsertById(setLeads, result.lead);
    if (result.appointment?.client) upsertById(setAppointments, result.appointment);
    if (result.auditLog) applyAuditLog(result.auditLog);
    markApiConnected("SQLite connected / online booking saved");
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
            applyAuditLog(result.auditLog);
            markApiConnected("SQLite connected / transaction voided");
            notify("Transaction voided. Stock and prepaid tenders restored.", "warning");
          } catch (error) {
            notify(error.message || "Unable to void transaction.", "error");
          }
        })();
      },
    });
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

  if (!session) {
    const publicParams = new URLSearchParams(window.location.search);
    const invitationToken = publicParams.get("invitation");
    if (invitationToken) return <AcceptInvitationScreen token={invitationToken} settings={settings} />;
    const resetToken = publicParams.get("reset");
    if (resetToken) return <ResetPasswordScreen token={resetToken} />;
    return <LoginScreen onLogin={handleLogin} settings={settings} />;
  }

  if (session.mustChangePassword) {
    return <ChangePasswordScreen account={session} onChangePassword={handlePasswordChange} onLogout={handleLogout} />;
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

  const activeLabel =
    activeModule === "overview"
      ? `${session.role} Workspace`
      : navItems.find((item) => item.id === activeModule)?.label ?? "Overview";
  const sensitiveAllowed = canManageOrganization(session.role) || ["Branch Manager", "Doctor"].includes(session.role);
  const showSidebar = visibleNavSections.length > 0 && !isPosView && !isApplicationsView && !isFaceTrackView;
  const showBackButton = activeModule !== "overview" && !showSidebar;
  const canOpenPos = sessionModules.includes("pos");
  const canManageAppointments = sessionModules.includes("appointments");
  const canAccessAllBranches = session.branch === "All branches";
  const shellClassName = [
    "app-shell",
    showSidebar ? "app-shell-with-sidebar" : "app-shell-full",
    showSidebar && isSidebarCollapsed ? "sidebar-collapsed" : "",
    showSidebar && isSidebarDrawerOpen ? "sidebar-drawer-open" : "",
    isPosView ? "pos-page-shell" : "",
    isApplicationsView ? "applications-page-shell" : "",
    isFaceTrackView ? "facetrack-page-shell" : "",
    isPosView && isPosChromeRevealed ? "pos-chrome-revealed" : "",
    "has-mobile-navigation",
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

        <main className={`workspace ${showSidebar ? "" : "workspace-full"} ${isPosView ? "pos-workspace" : ""} ${isApplicationsView ? "applications-workspace" : ""} ${isFaceTrackView ? "facetrack-workspace" : ""}`}>
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
            className={isApplicationsView || isFaceTrackView ? "app-top-chrome applications-hidden-chrome" : isPosView ? `pos-top-chrome ${isPosChromeRevealed ? "is-revealed" : ""}` : "app-top-chrome"}
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
                eyebrow="MACE ClinicOS"
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
                    onClick={() => setActiveModule("overview")}
                    title="Back to apps"
                    aria-label="Back to apps"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </button>
                ) : null}
              />
            </div>
            <div className="topbar-actions">
              <label className="search-box">
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label="Search records"
                  placeholder={activeModule === "leads" ? "Search by name, phone, service, campaign..." : "Search clients, bookings, reports..."}
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                />
              </label>
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
              <button className="icon-button" type="button" title="Notifications" onClick={() => notify("No unread critical alerts.")}>
                <Bell size={19} aria-hidden="true" />
                <span className="dot" />
              </button>
              <label className="branch-select">
                <Store size={17} aria-hidden="true" />
                <select
                  value={canAccessAllBranches ? branchScope : session.branch}
                  onChange={(event) => setBranchScope(event.target.value)}
                  aria-label="Select branch"
                  disabled={!canAccessAllBranches}
                  title={canAccessAllBranches ? "Filter workspace by branch" : `Access is limited to ${session.branch}`}
                >
                  {canAccessAllBranches ? (
                    <>
                      <option>All branches</option>
                      {branchRecords.map((branch) => <option key={branch.id}>{branch.name}</option>)}
                    </>
                  ) : (
                    <option>{session.branch}</option>
                  )}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
              <AccountMenu session={session} onLogout={handleLogout} />
            </div>
            </header>
            {isPosView && <SystemStrip apiState={apiState} isBooting={isBooting} session={session} settings={settings} stats={stats} />}
          </div>

        <section className="content-area">
          {!isPosView && !isApplicationsView && !isFaceTrackView && activeModule !== "appointments" && <SystemStrip apiState={apiState} isBooting={isBooting} session={session} settings={settings} stats={stats} />}
          {activeModule === "my-workspace" && <MyWorkspaceModule session={session} notify={notify} />}
          {activeModule === "facetrack-attendance" && <FaceTrackAttendance session={session} notify={notify} onExit={() => setActiveModule("overview")} />}
          {activeModule === "overview" && (
            <Dashboard
              session={session}
              stats={stats}
              clients={clients}
              appointments={scopedAppointments}
              transactions={scopedTransactions}
              inventory={scopedInventory}
              leads={leads}
              services={services}
              staff={staff}
              expenses={expenses}
              treatments={treatments}
              packages={packages}
              settings={settings}
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
              addCartItem={addCartItem}
              updateCartQty={updateCartQty}
              removeCartItem={removeCartItem}
              setCart={setCart}
              saveService={saveService}
              openModal={openModal}
              openPayment={(draft) => openModal("payment", draft)}
              transactions={transactions}
              voidTransaction={voidTransaction}
              onPrintReceipt={printReceipt}
              globalSearch={globalSearch}
              sessionRole={session.role}
            />
          )}
          {activeModule === "card-view" && (
            <CardViewModule
              appointments={scopedAppointments}
              services={services}
              transactions={scopedTransactions}
              staff={staff}
              updateStatus={updateAppointmentStatus}
              openModal={openModal}
              globalSearch={globalSearch}
              canManageAppointments={canManageAppointments}
              onOpenRoomView={() => setActiveModule("room-view")}
            />
          )}
          {activeModule === "staff-view" && (
            <StaffAvailabilityModule
              appointments={scopedAppointments}
              services={services}
              staff={staff}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "room-view" && (
            <RoomAvailabilityModule
              appointments={scopedAppointments}
              services={services}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "appointments" && (
            <AppointmentsModule
              appointments={scopedAppointments}
              clients={clients}
              services={services}
              staff={staff}
              transactions={scopedTransactions}
              auditLogs={auditLogs}
              treatments={treatments}
              packages={packages}
              openModal={openModal}
              updateStatus={updateAppointmentStatus}
              onUpdateAppointment={saveAppointment}
              openPayment={(draft) => openModal("payment", draft)}
              onPrintReceipt={printReceipt}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "clients" && (
            <ClientsModule
              clients={clients}
              selectedClient={selectedClient}
              selectedClientId={selectedClientId}
              setSelectedClientId={(id) => {
                setSelectedClientId(id);
                const client = clients.find((item) => item.id === id);
                addAudit("Client profile viewed", `${client?.fullName ?? "Client"} profile opened.`, "Client Records");
              }}
              treatments={treatments}
              appointments={appointments}
              transactions={transactions}
              packages={packages}
              openModal={openModal}
              importClients={importClients}
              deleteClient={deleteClient}
              sensitiveAllowed={sensitiveAllowed}
              globalSearch={globalSearch}
              notify={notify}
            />
          )}
          {activeModule === "treatments" && (
            <TreatmentsModule
              treatments={treatments}
              clients={clients}
              openModal={openModal}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "services" && (
            <ServicesModule
              services={services}
              openModal={openModal}
              toggleService={toggleService}
            />
          )}
          {activeModule === "inventory" && (
            <InventoryModule
              inventory={scopedInventory}
              movements={inventoryMovements}
              receiveStock={receiveStock}
              openModal={openModal}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "packages" && (
            <PackagesModule
              packages={packages}
              giftCertificates={giftCertificates}
              clients={clients}
              openModal={openModal}
              redeemPackage={redeemPackage}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "leads" && (
            <LeadsModule
              leads={leads}
              clients={clients}
              appointments={appointments}
              services={services}
              staff={staff}
              branches={branches}
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
            />
          )}
          {activeModule === "sms" && (
            <MarketingModule
              templates={smsTemplates}
              campaigns={campaigns}
              settings={settings}
              openModal={openModal}
              sendCampaign={sendCampaign}
              sendingCampaignId={sendingCampaignId}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "staff" && (
            <StaffModule
              staff={staff}
              session={session}
              openModal={openModal}
              toggleAttendance={toggleAttendance}
              globalSearch={globalSearch}
              applyAuditLog={applyAuditLog}
              notify={notify}
            />
          )}
          {activeModule === "branches" && (
            <BranchesModule
              branchScope={branchScope}
              branchRecords={branchRecords}
              staff={staff}
              transactions={transactions}
              appointments={appointments}
              canManage={canManageOrganization(session.role)}
              canDelete={isAdmin(session.role)}
              onCreateBranch={createBranch}
              onUpdateBranch={updateBranch}
              onDeleteBranch={deleteBranch}
              onManageCompany={() => openModal("settings", settings)}
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
            <BookingPortal services={services} onSubmit={publicBooking} />
          )}
          {activeModule === "settings" && (
            <SettingsModule
              settings={settings}
              users={users}
              auditLogs={auditLogs}
              discounts={discounts}
              openModal={openModal}
              globalSearch={globalSearch}
            />
          )}
          {activeModule === "support" && <SupportModule />}
        </section>
      </main>

      {!isPosView && !isApplicationsView && !isFaceTrackView && (
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
        modal={modal}
        closeModal={closeModal}
        completeTransaction={completeTransaction}
        saveAppointment={saveAppointment}
        saveClient={saveClient}
        saveService={saveService}
        saveInventory={saveInventory}
        saveLead={saveLead}
        saveTreatment={saveTreatment}
        saveExpense={saveExpense}
        saveStaff={saveStaff}
        savePackage={savePackage}
        saveCampaign={saveCampaign}
        saveSettings={saveSettings}
        clients={clients}
        services={services}
        branches={branches}
        staff={staff}
        inventory={inventory}
        settings={settings}
        templates={smsTemplates}
        packages={packages}
        giftCertificates={giftCertificates}
        appointments={appointments}
      />

      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} />}
      {toast && <Toast toast={toast} />}
      </div>
      <PrintableReceipt receipt={receiptToPrint} settings={settings} />
    </>
  );
}

function PrintableReceipt({ receipt, settings }) {
  const items = receipt?.items ?? [];
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
            <img src={assets.logo} alt="" />
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
                      <span>{item.type} / {money.format(price)}</span>
                    </td>
                    <td>{qty}</td>
                    <td>{money.format(price * qty)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="print-receipt-totals">
            <div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
            <div><span>Discount</span><strong>-{money.format(discount)}</strong></div>
            <div className="print-receipt-grand"><span>Total</span><strong>{money.format(total)}</strong></div>
          </div>

          <div className="print-receipt-payments">
            {payments.length ? payments.map((payment, index) => (
              <div key={`${payment.method}-${index}`}>
                <span>{payment.method}</span>
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

function PageHeader({ eyebrow, title, subtitle, leading = null }) {
  return (
    <div className="page-header topbar-title-block">
      <p className="eyebrow">{eyebrow}</p>
      <div className="topbar-title-row">
        {leading}
        <h1>{title}</h1>
      </div>
      {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
    </div>
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

function SidebarNavigation({
  activeModule,
  collapsed,
  drawerOpen,
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
        id="primary-sidebar"
        aria-label="ClinicOS modules"
      >
        <div className="sidebar-header">
          <div className="brand-mark">
            <img src={assets.logo} alt="MACE by Dr. Mace" />
          </div>
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
            <h2 id="mobile-more-title">MaceSoft</h2>
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

function AccountMenu({ session, onLogout }) {
  const initials = initialsFor(session.name);

  return (
    <details className="account-menu">
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
        <div className="account-detail-list">
          <span><ShieldCheck size={15} aria-hidden="true" /> {session.role}</span>
          <span><Store size={15} aria-hidden="true" /> {session.branch}</span>
          <span><Mail size={15} aria-hidden="true" /> Signed in</span>
        </div>
        <button type="button" onClick={onLogout} role="menuitem">
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  );
}

function LoginScreen({ onLogin, settings }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  async function sendReset() {
    setError("");
    setForgotMessage("");
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setForgotMessage(result.message);
    } catch (resetError) {
      setError(resetError.message || "Unable to request a password reset.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <img className="login-logo" src={assets.logo} alt="MACE by Dr. Mace" />
          <div>
            <p className="eyebrow">Secure role login</p>
            <h2>Sign in to your workspace</h2>
          </div>
          <label>
            <span>Email</span>
            <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input autoComplete="current-password" type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <div className="inline-state danger"><AlertCircle size={17} /><span>{error}</span></div>}
          <button className="primary-button full" type="submit" disabled={submitting || !email || !password}>
            <LockKeyhole size={17} aria-hidden="true" />
            {submitting ? "Signing in..." : "Sign in securely"}
          </button>
          <button className="ghost-button full" type="button" onClick={() => setForgotOpen((value) => !value)}>
            Forgot password
          </button>
          {forgotOpen && (
            <div className="inline-state warning"><Mail size={17} aria-hidden="true" /><span>{forgotMessage || `Send a secure reset link to ${email || "your account"}.`}</span><button type="button" className="ghost-button small" disabled={!email || submitting} onClick={sendReset}>Send reset link</button></div>
          )}
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

  return <main className="login-page"><section className="login-panel"><form className="login-card" onSubmit={submit}><img className="login-logo" src={assets.logo} alt="MACE by Dr. Mace" />{done ? <><p className="eyebrow">Password updated</p><h2>Your account is secure</h2><a className="primary-button full" href="/">Continue to sign in</a></> : <><p className="eyebrow">Secure password reset</p><h2>Create a new password</h2><p className="login-helper">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p><label><span>New password</span><input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>Confirm password</span><input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{error && <div className="inline-state danger"><AlertCircle size={17} /><span>{error}</span></div>}<button className="primary-button full" disabled={submitting || !password || !confirmPassword}>{submitting ? "Updating password..." : "Reset password"}</button></>}</form></section></main>;
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
          <img className="login-logo" src={assets.logo} alt="MACE by Dr. Mace" />
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

function SystemStrip({ apiState, isBooting, session, settings, stats }) {
  const databaseTone =
    apiState.status === "connected" ? "ready" : apiState.status === "offline" ? "alert" : "loading";
  const allowedModules = modulesForSession(session);
  const accessActive = session?.access?.active === true && allowedModules.length > 0;

  return (
    <div className="system-strip" aria-label="System status" aria-live="polite">
      <div className={`system-pill system-pill-workspace ${isBooting ? "loading" : "ready"}`}>
        <Database size={16} aria-hidden="true" />
        <span>{isBooting ? "Preparing workspace records..." : "Workspace ready"}</span>
      </div>
      <div className={`system-pill system-pill-database ${databaseTone}`}>
        <Database size={16} aria-hidden="true" />
        <span>{apiState.message}</span>
      </div>
      <div
        className={`system-pill system-pill-role ${accessActive ? "ready" : "alert"}`}
        title={accessActive
          ? `${session.role} can access ${allowedModules.length} approved modules in ${session.branch}. Server enforcement is enabled.`
          : "This account does not have an active server-enforced access policy."}
      >
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{accessActive ? `${session.role} access active` : "Role access unavailable"}</span>
      </div>
      <div className="system-pill system-pill-secondary">
        <CircleDollarSign size={16} aria-hidden="true" />
        <span>{settings.taxMode} / {settings.currency}</span>
      </div>
      {stats.lowStock.length > 0 && (
        <div className="system-pill system-pill-inventory alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{stats.lowStock.length} inventory alert{stats.lowStock.length > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
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
              <span className="applications-kicker">MACE ClinicOS</span>
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
                  <span className="desktop-application-icon"><Icon size={31} strokeWidth={1.7} aria-hidden="true" /></span>
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
  visibleNav,
  setActiveModule,
  openModal,
}) {
  const topServices = useMemo(() => tallyItems(transactions, "Service").slice(0, 5), [transactions]);
  const topProducts = useMemo(() => tallyItems(transactions, "Product").slice(0, 5), [transactions]);
  const allowedModules = modulesForSession(session);
  const appNav = visibleNav.filter((item) => item.id !== "overview");
  const branchCards = branches.map((branch) => {
    const branchTransactions = transactions.filter((transaction) => transaction.branch === branch.name);
    const revenue = branchTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    return { ...branch, revenue };
  });
  const config = buildRoleWorkspace({
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
    topServices,
    topProducts,
    branchCards,
    allowedModules,
    setActiveModule,
    openModal,
  });
  const showHero = session.role !== "Cashier";
  const showActionStrip = session.role === "Cashier";

  return (
    <div className={`overview-dashboard overview-${config.tone}`}>
      {showHero && (
        <section className={`surface-panel role-hero ${config.tone}`}>
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h2>{config.title}</h2>
            <p>{config.copy}</p>
            <div className="workflow-chips" aria-label={`${session.role} workspace focus`}>
              {config.chips.map((chip) => <span key={chip}>{chip}</span>)}
            </div>
          </div>
          <div className="role-hero-actions">
            {config.actions.slice(0, 4).map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  className={index === 0 ? "primary-button" : "secondary-button"}
                  key={action.title}
                  type="button"
                  onClick={action.onClick}
                >
                  <Icon size={17} aria-hidden="true" />
                  {action.title}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {showActionStrip && (
        <section className="cashier-action-strip" aria-label="Cashier quick actions">
          {config.actions.slice(0, 4).map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                className={index === 0 ? "primary-button" : "secondary-button"}
                key={action.title}
                type="button"
                onClick={action.onClick}
              >
                <Icon size={17} aria-hidden="true" />
                {action.title}
              </button>
            );
          })}
        </section>
      )}

      <section className="summary-grid role-summary-grid">
        {config.metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </section>

      <section className="role-work-grid">
        <div className="surface-panel">
          <SectionHeader icon={LayoutDashboard} title="Apps" action={`${appNav.length} available`} />
          <div className="role-app-grid">
            {appNav.map((item) => {
              const Icon = item.icon;
              return (
                <button className="role-app-tile" key={item.id} type="button" onClick={() => setActiveModule(item.id)}>
                  <Icon size={19} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{moduleDescriptions[item.id] ?? "Open module"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="surface-panel">
          <SectionHeader icon={config.focusIcon} title={config.focusTitle} action={config.focusAction} />
          <div className="action-list">
            {config.focusItems.map((item) => (
              <ActionItem key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        {config.panels.map((panel) => (
          <RolePanel key={panel.title} panel={panel} />
        ))}
      </section>
    </div>
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
  topServices,
  topProducts,
  branchCards,
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
  const partialTransactions = transactions.filter((item) => item.status === "Partial");
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
      copy: "Manage configuration, branches, audit readiness, and the full ClinicOS module set.",
      chips: ["Access", "Settings", "Audit", "Branches"],
      metrics: [
        { icon: ShieldCheck, label: "Users", value: users.length, tone: "blue" },
        { icon: LayoutDashboard, label: "Modules", value: navItems.length - 1, tone: "wine" },
        { icon: Store, label: "Branches", value: branches.length, tone: "green" },
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
        moduleAction("branches", Store, `${branches.length} branches active`, "Confirm branch setup"),
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
  addCartItem,
  updateCartQty,
  removeCartItem,
  setCart,
  saveService,
  openModal,
  openPayment,
  transactions,
  voidTransaction,
  onPrintReceipt,
  globalSearch,
  sessionRole,
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [branch, setBranch] = useState(branchScope === "All branches" ? branches[0].name : branchScope);
  const [staffName, setStaffName] = useState(staff[0]?.name ?? "");
  const [discountId, setDiscountId] = useState("");
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
  const canManagePosCatalog = canManageOrganization(sessionRole) || sessionRole === "Branch Manager";
  const posScreens = canManagePosCatalog ? ["Checkout", "Service Prices"] : ["Checkout"];

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
  const discount = discounts.find((item) => item.id === discountId);
  const discountAmount = discount
    ? discount.type === "Percentage"
      ? Math.round((subtotal * Number(discount.value)) / 100)
      : Number(discount.value)
    : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const client = clients.find((item) => item.id === clientId);
  const todaysTransactions = transactions.filter((transaction) => transaction.date === todayDate());
  const transactionSummaryRows = todaysTransactions.length ? todaysTransactions : transactions;
  const todaysTransactionTotal = todaysTransactions.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);

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
        if (cart.length) setCheckoutStep("payment");
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
          discountAmount,
          total,
          notes: "",
          paymentMethod: option.method,
          paymentLabel: option.label,
          splitPayment: option.split,
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
  }, [branch, cart, cartFocusIndex, catalogPage, catalogPageCount, checkoutStep, client?.fullName, clientId, discount, discountAmount, openPayment, posScreen, setCart, staffName, subtotal, total]);

  function createPaymentDraft(patch = {}) {
    return {
      clientId,
      clientName: client?.fullName ?? "Walk-in",
      branch,
      staff: staffName,
      cart,
      subtotal,
      discount,
      discountAmount,
      total,
      notes: "",
      ...patch,
    };
  }

  function showPaymentStep() {
    if (!cart.length) return;
    setCheckoutStep("payment");
  }

  function choosePayment(option) {
    if (!cart.length) return;
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
      date: todayDate(),
      time: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }),
      client: client?.fullName ?? "Walk-in",
      branch,
      staff: staffName || "Unassigned",
      items: cart.map((item) => ({
        name: item.name,
        type: item.type,
        qty: Number(item.qty || 1),
        price: Number(item.price || 0),
      })),
      subtotal,
      discount: discountAmount,
      total,
      payments: [],
      status: "Unpaid",
      notes: discount ? `${discount.name} applied` : "",
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
                    className={`service-card pos-service-card ${cart.some((item) => item.key === `service-${service.id}`) ? "in-cart" : ""}`}
                    key={service.id}
                    ref={(node) => { catalogItemRefs.current[index] = node; }}
                    tabIndex={catalogFocusIndex === index ? 0 : -1}
                    onFocus={() => setCatalogFocusIndex(index)}
                    onKeyDown={(event) => handleCatalogItemKeyDown(event, index)}
                    onClick={() => addCartItem({ key: `service-${service.id}`, serviceId: service.id, type: "Service", name: service.name, category: service.category, price: service.price })}
                    type="button"
                  >
                    <strong>{service.name}</strong>
                    <span className="service-card-meta">
                      <small>{service.duration} min</small>
                      <b>{money.format(service.price)}</b>
                    </span>
                    {cart.find((item) => item.key === `service-${service.id}`)?.qty && (
                      <span className="cart-count">{cart.find((item) => item.key === `service-${service.id}`)?.qty}</span>
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
                    onClick={() => addCartItem({ key: `product-${item.id}`, inventoryId: item.id, type: "Product", name: item.item, category: item.category, price: item.price })}
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
            inventory={inventory}
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
          {cart.map((item, index) => (
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
              </div>
              <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
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
              </div>
              <b>{money.format(Number(item.price) * Number(item.qty || 1))}</b>
              <button type="button" onClick={() => removeCartItem(item.key)} title={`Remove ${item.name}`} aria-label={`Remove ${item.name}`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </article>
          ))}
          {!cart.length && <EmptyState title="Cart is empty" copy="Add a service or product to begin checkout." />}
        </div>
        <div className="invoice-fields">
          <label className="stacked-field">
            <span>Discount</span>
            <select value={discountId} onChange={(event) => setDiscountId(event.target.value)}>
              <option value="">No discount</option>
              {discounts.filter((item) => item.active).map((item) => (
                <option key={item.id} value={item.id}>{item.name} - {item.type}</option>
              ))}
            </select>
          </label>
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
              <button className="primary-button full" type="button" onClick={showPaymentStep} disabled={!cart.length}>
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
                  {row.status !== "Void" && <button type="button" onClick={() => voidTransaction(row)}><Trash2 size={15} /> Void</button>}
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
                <select ref={saleClientRef} value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="">Walk-in / Anonymous</option>
                  {clients.map((item) => (
                    <option key={item.id} value={item.id}>{item.fullName}</option>
                  ))}
                </select>
              </label>
              <label className="stacked-field">
                <span>Select Branch</span>
                <select value={branch} onChange={(event) => setBranch(event.target.value)}>
                  {branches.map((item) => <option key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="stacked-field">
                <span>Select Staff</span>
                <select value={staffName} onChange={(event) => setStaffName(event.target.value)}>
                  {staff.map((person) => <option key={person.id}>{person.name}</option>)}
                </select>
              </label>
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
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

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
        {pageNumbers.map((pageNumber) => (
          <button
            className={pageNumber === page ? "active" : ""}
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>
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

function POSServicePriceScreen({ branch, inventory, saveService, services, staff }) {
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
      duration: 60,
      price: "",
      commission: "",
      consumables: "",
      branches: branch,
      staff: staffRoleList || "Doctor, Nurse / Aesthetician",
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
      duration: service.duration ?? 60,
      price: service.price ?? "",
      commission: service.commission ?? "",
      consumables: Array.isArray(service.consumables) ? service.consumables.join(", ") : service.consumables ?? "",
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
        price,
        commission: form.commission || "Standard POS service",
        consumables: form.consumables || "",
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
            <span>Price</span>
            <input type="number" min="0" value={form.price} onChange={(event) => updateForm("price", event.target.value)} placeholder="0" />
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
          <label>
            <span>Consumable</span>
            <select value={form.consumables} onChange={(event) => updateForm("consumables", event.target.value)}>
              <option value="">None</option>
              {inventory.filter((item) => item.type === "Consumable").map((item) => <option key={item.id}>{item.item}</option>)}
            </select>
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
              <b>{money.format(service.price)}</b>
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

function CardViewModule({ appointments, services, transactions, staff, updateStatus, openModal, globalSearch, canManageAppointments, onOpenRoomView }) {
  const [date, setDate] = useState("");
  const [staffFilter, setStaffFilter] = useState("All staff");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [viewMode, setViewMode] = useStoredState("card-view-mode", "list");
  const rooms = uniqueRoomsFromBranches();
  const staffOptions = [...new Set(staff.map((person) => person.name))].sort((a, b) => a.localeCompare(b));

  const cards = appointments
    .filter((appointment) => !date || appointment.date === date)
    .filter((appointment) => staffFilter === "All staff" || appointment.staff === staffFilter)
    .filter((appointment) => roomFilter === "All rooms" || appointment.room === roomFilter)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.staff} ${appointment.room}`).includes(normalize(globalSearch)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  const arrivedCards = cards.filter((item) => canonicalAppointmentStatus(item.status) === "Arrived").length;
  const inTreatmentCards = cards.filter((item) => canonicalAppointmentStatus(item.status) === "In Treatment").length;
  const completedCards = cards.filter((item) => canonicalAppointmentStatus(item.status) === "Completed").length;
  const completionRate = cards.length ? Math.round((completedCards / cards.length) * 100) : 0;

  function transactionFor(appointment) {
    return transactions.find((transaction) => transaction.date === appointment.date && transaction.client === appointment.client);
  }

  return (
    <section className="module-grid card-view-page">
      <section className="surface-panel full-span card-view-kpi-card" aria-label={date ? `Daily KPI for ${date}` : "KPI for all dates"}>
        <article className="card-view-kpi-heading">
          <div className="card-view-kpi-icon primary"><Activity size={27} aria-hidden="true" /></div>
          <div className="card-view-kpi-copy">
            <span>Completion rate</span>
            <strong>{completionRate}%</strong>
            <small>{date ? "Selected date KPI" : "All dates KPI"}</small>
          </div>
        </article>
        <div className="card-view-kpi-metrics">
          <article>
            <div className="card-view-kpi-icon"><CreditCard size={23} aria-hidden="true" /></div>
            <div><span>Total Cards</span><strong>{cards.length}</strong></div>
          </article>
          <article>
            <div className="card-view-kpi-icon"><UserCheck size={25} aria-hidden="true" /></div>
            <div><span>Arrived</span><strong>{arrivedCards}</strong></div>
          </article>
          <article>
            <div className="card-view-kpi-icon"><Clock size={25} aria-hidden="true" /></div>
            <div><span>In Treatment</span><strong>{inTreatmentCards}</strong></div>
          </article>
          <article>
            <div className="card-view-kpi-icon"><Check size={25} aria-hidden="true" /></div>
            <div><span>Completed</span><strong>{completedCards}</strong></div>
          </article>
        </div>
      </section>

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
          {canManageAppointments ? (
            <button className="primary-button card-view-add-button" type="button" onClick={() => openModal("appointment")}>
              <Plus size={18} aria-hidden="true" /> New Card
            </button>
          ) : (
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
                      <button type="button" onClick={() => openModal("appointment", appointment)} title={`View ${appointment.client}'s card`}><Eye size={15} aria-hidden="true" /> View</button>
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
                        <button type="button" onClick={() => openModal("appointment", appointment)} title={`View ${appointment.client}'s card`} aria-label={`View ${appointment.client}'s card`}>
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
        <span><AlertCircle size={19} aria-hidden="true" /> Cards represent {date ? "the selected date's" : "today's"} scheduled services. Switch between list and grid, or filter by staff, room, or date.</span>
        <button className="ghost-button" type="button" onClick={onOpenRoomView}><LayoutGrid size={16} aria-hidden="true" /> View Room View</button>
      </footer>
    </section>
  );
}

function StaffAvailabilityModule({ appointments, services, staff, globalSearch }) {
  const [date, setDate] = useState(todayDate());
  const rows = staff.map((person) => person.name);
  const filtered = appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.staff}`).includes(normalize(globalSearch)));

  return (
    <section className="module-grid two">
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
          {staff.map((person) => (
            <MessageItem
              key={person.id}
              title={person.name}
              copy={`${filtered.filter((appointment) => appointment.staff === person.name).length} booking(s) / ${person.schedule}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoomAvailabilityModule({ appointments, services, globalSearch }) {
  const [date, setDate] = useState(todayDate());
  const rooms = uniqueRoomsFromBranches();
  const filtered = appointments
    .filter((appointment) => appointment.date === date)
    .filter((appointment) => normalize(`${appointment.client} ${appointment.service} ${appointment.room}`).includes(normalize(globalSearch)));

  return (
    <section className="module-grid">
      <div className="surface-panel">
        <SectionHeader icon={Home} title="Room Availability View" action={date} />
        <div className="report-filters single-line">
          <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <AvailabilityTimeline
          resourceLabel="Room"
          resources={rooms}
          appointments={filtered}
          services={services}
          getResource={(appointment) => appointment.room}
        />
      </div>
    </section>
  );
}

function AvailabilityTimeline({ resourceLabel, resources, appointments, services, getResource }) {
  return (
    <div className="availability-board">
      <div className="availability-scroll">
        <div className="availability-table">
          <div className="availability-corner">{resourceLabel}</div>
          <div className="timeline-axis">
            {scheduleHours.map((minutes) => <span key={minutes}>{formatScheduleTime(minutes)}</span>)}
          </div>
          {resources.map((resource) => {
            const rowAppointments = appointments.filter((appointment) => getResource(appointment) === resource);
            return (
              <React.Fragment key={resource}>
                <div className="availability-resource">{resource}</div>
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
    .filter((transaction) => transaction.date === today && transaction.status !== "Void")
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
    return {
      id: appointment.id,
      invoice: `Appointment ${appointment.id}`,
      date: appointment.date,
      time: appointment.time,
      client: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      items: [{ name: appointment.service, type: "Service", qty: 1, price: payment.price }],
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
      message: `Hi ${appointment.client}, this is your reminder for ${appointment.service} at MACE on ${formatDate(appointment.date)} at ${appointment.time}. Reply YES to confirm.`,
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
                    <strong>{appointment.client}</strong>
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
    query: "",
  };
  const [view, setView] = useStoredState("appointment-scheduler-view", "Schedule");
  const activeView = view === "Schedule" ? "Day" : view;
  const [filters, setFilters] = useState(defaultFilters);
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
  const clientAppointmentCounts = appointments.reduce((counts, appointment) => {
    const key = appointment.clientId || normalize(appointment.client);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const combinedQuery = normalize(`${globalSearch} ${normalizedFilters.query}`.trim());

  const matchingRows = appointments
    .filter((item) => normalizedFilters.status === "All" || canonicalAppointmentStatus(item.status) === normalizedFilters.status)
    .filter((item) => normalizedFilters.doctor === "All" || item.staff === normalizedFilters.doctor)
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
  const periodRows = activeView === "Week" ? weekRows : activeView === "Month" ? monthRows : dayRows;
  const displayedRows = activeView === "Week" ? weekRows : activeView === "Month" ? monthRows : filteredRows;
  const weekEnd = addDays(selectedWeekStart, 6);
  const periodTitle = activeView === "Week"
    ? `${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(selectedWeekStart)} – ${new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(weekEnd)}`
    : activeView === "Month"
      ? new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(selectedDateObject)
      : formatDate(selectedDate);
  const periodSubtitle = activeView === "Week"
    ? `${weekRows.length} appointments · GMT+8`
    : activeView === "Month"
      ? `${monthRows.length} appointments · GMT+8`
      : `${new Intl.DateTimeFormat("en-PH", { weekday: "long" }).format(selectedDateObject)} · GMT+8`;
  const selectedAppointment = appointments.find((item) => item.id === selectedId) ?? null;
  const selectedBranch = normalizedFilters.branch === "All" ? null : normalizedFilters.branch;
  const scopedStaff = staff
    .filter((person) => /doctor|nurse|aesthetician/i.test(person.role || ""))
    .filter((person) => !selectedBranch || person.branch === selectedBranch || person.branch === "All branches");
  const practitionerNames = [...new Set(scopedStaff.map((person) => person.name).concat(periodRows.map((item) => item.staff)).filter(Boolean))];
  const practitionerResources = practitionerNames
    .filter((name) => normalizedFilters.doctor === "All" || name === normalizedFilters.doctor)
    .map((name) => {
      const person = staff.find((item) => item.name === name);
      const room = dayRows.find((item) => item.staff === name)?.room;
      return { key: name, label: name, subtitle: room || person?.role || "Practitioner", photo: person?.photo, assignment: { staff: name } };
    });
  const roomResources = roomOptions
    .filter((room) => normalizedFilters.room === "All" || room === normalizedFilters.room)
    .map((room) => ({ key: room, label: room, subtitle: dayRows.some((item) => item.room === room) ? "Scheduled" : "Available", assignment: { room } }));
  const today = todayDate();
  const todaysAppointments = appointments.filter((item) => item.date === today);
  const todayWaiting = todaysAppointments.filter((item) => ["Arrived", "Checked In"].includes(canonicalAppointmentStatus(item.status)));
  const todayInTreatment = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "In Treatment");
  const todayCompleted = todaysAppointments.filter((item) => canonicalAppointmentStatus(item.status) === "Completed");
  const todayRevenue = transactions.filter((item) => item.date === today && item.status !== "Void").reduce((sum, item) => sum + Number(item.total || 0), 0);
  const todayNeedsPayment = todaysAppointments.filter((item) => appointmentPaymentSummary(item, services, transactions).due > 0);
  const roomsOccupied = roomOptions.filter((room) => todaysAppointments.some((item) => item.room === room && isActiveAppointmentStatus(item.status))).length;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const waitValues = todayWaiting.map((item) => Math.max(0, nowMinutes - parseTimeToMinutes(item.time)));
  const averageWait = waitValues.length ? Math.round(waitValues.reduce((sum, value) => sum + value, 0) / waitValues.length) : 0;

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

  function selectDate(date) {
    setFilters((current) => ({ ...defaultFilters, ...current, datePreset: "Custom", from: date, to: date }));
  }

  function moveDay(offset) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    selectDate(next.toISOString().slice(0, 10));
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
    return {
      id: appointment.id,
      invoice: `Appointment ${appointment.id}`,
      date: appointment.date,
      time: appointment.time,
      client: appointment.client,
      branch: appointment.branch,
      staff: appointment.staff,
      items: [{ name: appointment.service, type: "Service", qty: 1, price: payment.price }],
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
      subject: "Your MACE appointment reminder",
      message: `Hi ${appointment.client}, this is your reminder for ${appointment.service} at MACE on ${formatDate(appointment.date)} at ${formatScheduleTime(parseTimeToMinutes(appointment.time))}. Reply YES to confirm.`,
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
    const appointment = dayRows.find((item) => item.id === id);
    setDraggedAppointmentId("");
    setDragOverStatus("");
    if (!appointment || definition.matches(appointment)) return;
    updateStatus(appointment.id, definition.target);
  }

  return (
    <section className="appointments-workspace appointment-scheduler-redesign">
      <div className="surface-panel appointment-command-panel">
        <div className="appointment-command-header">
          <div><h2>Manage the clinic schedule</h2><span>Find patients, move visits forward, and resolve issues quickly.</span></div>
          <div className="appointment-command-actions">
            <button className="secondary-button" type="button" onClick={() => openModal("client")}><Users size={17} /> New client</button>
            <button className="primary-button" type="button" onClick={() => openModal("appointment", { status: "Draft", date: selectedDate })}><Plus size={17} /> New appointment</button>
          </div>
        </div>
        <div className="appointment-metrics-strip" aria-label="Live appointment metrics">
          <button type="button" onClick={() => selectDate(today)}><span>Today</span><strong>{todaysAppointments.length}</strong><small>{todayCompleted.length} completed</small></button>
          <button type="button" onClick={() => { selectDate(today); setView("Kanban"); }}><span>Waiting</span><strong>{todayWaiting.length}</strong><small>{averageWait ? `${averageWait} min average` : "No wait"}</small></button>
          <button type="button" onClick={() => { selectDate(today); setView("Kanban"); }}><span>In treatment</span><strong>{todayInTreatment.length}</strong><small>active now</small></button>
          <button type="button" onClick={() => { selectDate(today); setView("Kanban"); }}><span>Needs payment</span><strong>{todayNeedsPayment.length}</strong><small>{money.format(todayNeedsPayment.reduce((sum, item) => sum + appointmentPaymentSummary(item, services, transactions).due, 0))} due</small></button>
          <div><span>Revenue today</span><strong>{money.format(todayRevenue)}</strong><small>posted payments</small></div>
          <div><span>Capacity</span><strong>{Math.max(0, practitionerResources.length - todayInTreatment.length)} doctors</strong><small>{roomsOccupied}/{roomOptions.length} rooms occupied</small></div>
        </div>
      </div>

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
          <div className="appointment-doctor-list-heading"><div><strong>Doctor Appointment List</strong><span>{periodRows.length} visits in this {activeView.toLowerCase()}</span></div><button type="button" onClick={() => setFilter("doctor", "All")} aria-label="Show every doctor">•••</button></div>
          <div className="appointment-doctor-list">
            {practitionerNames.map((name) => {
              const person = staff.find((item) => item.name === name);
              const doctorRows = periodRows.filter((item) => item.staff === name);
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
              <button type="button" onClick={() => activeView === "Day" ? moveDay(-1) : selectDate(moveAppointmentFocus(selectedDate, activeView, -1))} aria-label={`Previous ${activeView.toLowerCase()}`}><ChevronLeft size={18} /></button>
              <div><strong>{periodTitle}</strong><span>{periodSubtitle}</span></div>
              <button type="button" onClick={() => activeView === "Day" ? moveDay(1) : selectDate(moveAppointmentFocus(selectedDate, activeView, 1))} aria-label={`Next ${activeView.toLowerCase()}`}><ChevronRight size={18} /></button>
            </div>
            <div className="segmented-control appointment-view-tabs" role="tablist" aria-label="Appointment view">
              {["Day", "Week", "Month", "Kanban", "Timeline", "Rooms"].map((item) => <button type="button" role="tab" aria-selected={activeView === item} className={activeView === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item}</button>)}
            </div>
          </div>
          {scheduleFeedback && <div className={`appointment-schedule-feedback ${scheduleFeedback.type}`}><span>{scheduleFeedback.message}</span><button type="button" onClick={() => setScheduleFeedback(null)} aria-label="Dismiss message"><X size={14} /></button></div>}
          {activeView === "Day" && <AppointmentScheduleGrid resources={practitionerResources} appointments={dayRows} services={services} getResource={(item) => item.staff} selectedDate={selectedDate} selectedId={selectedId} onSelect={setSelectedId} onContext={(event, appointment) => setContextMenu({ x: event.clientX, y: event.clientY, appointment })} onChangeAppointment={changeAppointment} />}
          {activeView === "Week" && <AppointmentWeekView appointments={weekRows} selectedDate={selectedDate} selectedId={selectedId} onSelect={setSelectedId} onOpenDay={(date) => { selectDate(date); setView("Day"); }} />}
          {activeView === "Month" && <AppointmentMonthView appointments={monthRows} selectedDate={selectedDate} selectedId={selectedId} onSelect={setSelectedId} onOpenDay={(date) => { selectDate(date); setView("Day"); }} />}
          {activeView === "Rooms" && <AppointmentScheduleGrid resources={roomResources} appointments={dayRows} services={services} getResource={(item) => item.room} selectedDate={selectedDate} selectedId={selectedId} onSelect={setSelectedId} onContext={(event, appointment) => setContextMenu({ x: event.clientX, y: event.clientY, appointment })} onChangeAppointment={changeAppointment} />}
          {activeView === "Timeline" && <AvailabilityTimeline resourceLabel="Doctor / Staff" resources={practitionerNames} appointments={dayRows} services={services} getResource={(item) => item.staff} />}
          {activeView === "Kanban" && (
            <div className="appointment-kanban-board appointment-workflow-board" aria-label="Appointment workflow">
              {kanbanDefinitions.map((definition) => {
                const items = dayRows.filter(definition.matches);
                return (
                  <section className={`appointment-kanban-column ${dragOverStatus === definition.label ? "is-drag-over" : ""}`} key={definition.label} onDragOver={(event) => event.preventDefault()} onDragEnter={() => setDragOverStatus(definition.label)} onDrop={(event) => dropKanban(event, definition)}>
                    <header><span>{definition.label}</span><strong>{items.length}</strong></header>
                    <div>{items.map((appointment) => {
                      const payment = appointmentPaymentSummary(appointment, services, transactions);
                      return <article className={`appointment-kanban-card ${statusClass(appointment.status)}`} draggable key={appointment.id} onDragStart={(event) => { event.dataTransfer.setData("text/plain", appointment.id); setDraggedAppointmentId(appointment.id); }} onDragEnd={() => { setDraggedAppointmentId(""); setDragOverStatus(""); }}><button type="button" onClick={() => setSelectedId(appointment.id)}><span className="appointment-kanban-card-heading"><span className="appointment-client-initials">{initialsFor(appointment.client)}</span><span><strong>{appointment.client}</strong><small>{appointment.service}</small></span></span><span className="appointment-kanban-meta"><Clock size={14} /> {formatScheduleTime(parseTimeToMinutes(appointment.time))} · {appointment.staff}</span><span className="appointment-kanban-payment"><WalletCards size={14} /> {money.format(payment.due)} due</span></button></article>;
                    })}{!items.length && <span className="appointment-kanban-empty">No appointments</span>}</div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {contextMenu && <div className="appointment-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()} role="menu"><button type="button" onClick={() => { setSelectedId(contextMenu.appointment.id); setContextMenu(null); }}><Eye size={15} /> View details</button><button type="button" onClick={() => openModal("appointment", contextMenu.appointment)}><Edit3 size={15} /> Edit appointment</button><button type="button" onClick={() => updateStatus(contextMenu.appointment.id, "Checked In")}><UserCheck size={15} /> Check in</button><button type="button" onClick={() => openPayment(paymentDraftForAppointment(contextMenu.appointment))}><CreditCard size={15} /> Collect payment</button><button className="danger" type="button" onClick={() => updateStatus(contextMenu.appointment.id, "Cancelled")}><X size={15} /> Cancel appointment</button></div>}

      <AppointmentDetailsDrawer appointment={selectedAppointment} client={selectedAppointment ? clients.find((item) => item.id === selectedAppointment.clientId || item.fullName === selectedAppointment.client) : null} services={services} transactions={transactions} auditLogs={auditLogs} treatments={treatments} packages={packages} onClose={() => setSelectedId("")} onEdit={(appointment) => openModal("appointment", appointment)} onStatus={updateStatus} onPayment={(appointment) => openPayment(paymentDraftForAppointment(appointment))} onPrint={(appointment) => onPrintReceipt(receiptForAppointment(appointment))} onReminder={(appointment) => prepareReminder(appointment, "SMS")} onEmail={(appointment) => prepareReminder(appointment, "Email")} />

      <div className="appointment-data-toggle"><button className="secondary-button" type="button" onClick={() => setShowDataTable((value) => !value)}><FileText size={16} /> {showDataTable ? "Hide data table" : "Show data table"}</button></div>
      {showDataTable && <div className="surface-panel appointment-data-panel"><SectionHeader icon={FileText} title="Appointment Data" action={`${displayedRows.length} records`} /><SmartTable rows={displayedRows} globalSearch={globalSearch} columns={[{ key: "id", label: "Booking ID" }, { key: "date", label: "Date" }, { key: "time", label: "Time" }, { key: "client", label: "Client" }, { key: "service", label: "Service" }, { key: "staff", label: "Doctor / Staff" }, { key: "room", label: "Room" }, { key: "duration", label: "Duration", render: (row) => `${appointmentDurationMinutes(row, services)} min` }, { key: "payment", label: "Payment", render: (row) => appointmentPaymentSummary(row, services, transactions).status }, { key: "status", label: "Status", render: (row) => <StatusBadge status={canonicalAppointmentStatus(row.status)} /> }]} /></div>}
    </section>
  );
}

function AppointmentDetailsDrawer({
  appointment,
  client,
  services,
  transactions,
  auditLogs,
  treatments = [],
  packages = [],
  onClose,
  onEdit,
  onStatus,
  onPayment,
  onPrint,
  onReminder,
  onEmail,
}) {
  if (!appointment) return null;
  const service = serviceForAppointment(appointment, services);
  const payment = appointmentPaymentSummary(appointment, services, transactions);
  const status = canonicalAppointmentStatus(appointment.status);
  const transitions = appointmentStatusTransitions[status] ?? [];
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
    { title: "Booking created", time: appointment.createdAt, actor: "System", detail: `${appointment.service} at ${appointment.branch}` },
    { title: `Status: ${status}`, time: appointment.updatedAt, actor: "Clinic team", detail: appointment.internalNotes || "Latest appointment state." },
    ...matchingPayments.map((transaction) => ({
      title: "Payment collected",
      time: `${transaction.date}T${transaction.time || "00:00"}`,
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

  return (
    <>
    <button className="appointment-drawer-backdrop" type="button" onClick={onClose} aria-label="Close appointment details" />
    <aside className="surface-panel appointment-details-drawer" aria-label="Appointment details">
      <div className="appointment-details-hero">
        <div className="appointment-patient-heading">
          <ClientAvatar client={client || { fullName: appointment.client }} size="large" />
          <div>
            <p className="eyebrow">Appointment details</p>
            <h3>{appointment.client}</h3>
            <div className="appointment-hero-meta">
              <span><CalendarDays size={14} /> {formatDate(appointment.date)}</span>
              <span><Clock size={14} /> {appointment.time}</span>
              <span><FileText size={14} /> {appointment.id}</span>
            </div>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Clear selected appointment"><X size={17} /></button>
      </div>

      <div className="appointment-detail-summary">
        <article className="appointment-summary-primary">
          <span>Visit</span>
          <strong>{appointment.service}</strong>
          <small>{appointmentDurationMinutes(appointment, services)} min · {appointment.room || "Room not assigned"}</small>
        </article>
        <article>
          <span>Appointment status</span>
          <StatusBadge status={status} />
          <small>{appointment.branch}</small>
        </article>
        <article className={payment.due > 0 ? "payment-due" : "payment-clear"}>
          <span>Balance due</span>
          <strong>{money.format(payment.due)}</strong>
          <small>{payment.status} · {money.format(payment.applied)} applied</small>
        </article>
      </div>

      <div className="appointment-primary-actions">
        <button className="primary-button" type="button" onClick={() => onPayment(appointment)} disabled={payment.price <= 0 || payment.due <= 0}>
          <CreditCard size={16} /> Collect {money.format(payment.due)}
        </button>
        <button className="secondary-button" type="button" onClick={() => onEdit(appointment)}><Edit3 size={16} /> Edit appointment</button>
        <button className="secondary-button" type="button" onClick={() => onReminder(appointment)}><Send size={16} /> Send reminder</button>
        <button className="secondary-button" type="button" onClick={() => onEmail(appointment)}><Mail size={16} /> Email</button>
        <button className="secondary-button icon-only-action" type="button" onClick={() => onPrint(appointment)} aria-label="Print appointment"><Printer size={16} /></button>
      </div>

      {transitions.length > 0 && (
        <section className="appointment-status-actions" aria-label="Update appointment status">
          <span>Move appointment to</span>
          <div>
            {transitions.slice(0, 4).map((value) => (
              <button className="status-transition-button" type="button" key={value} onClick={() => onStatus(appointment.id, value)}>
                <Check size={14} /> {value}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="appointment-detail-section">
        <div className="appointment-detail-section-heading">
          <div>
            <span className="appointment-section-icon"><ClipboardCheck size={17} /></span>
            <div><strong>Visit information</strong><small>Contact, location, staff, and charges</small></div>
          </div>
        </div>
        <div className="drawer-section-grid appointment-facts-grid">
          <RecordItem label="Mobile" value={client?.mobile || "Not recorded"} />
          <RecordItem label="Email" value={client?.email || "Not recorded"} />
          <RecordItem label="Birthday" value={client?.birthday || client?.dob || "Not recorded"} />
          <RecordItem label="Patient type" value={appointment.appointmentType || "Treatment"} />
          <RecordItem label="Branch" value={appointment.branch} />
          <RecordItem label="Room" value={appointment.room} />
          <RecordItem label="Doctor / Staff" value={appointment.staff} />
          <RecordItem label="Duration" value={`${appointmentDurationMinutes(appointment, services)} minutes`} />
          <RecordItem label="Timezone" value={appointment.timezone || "Asia/Manila"} />
          <RecordItem label="Insurance" value={appointment.insurance || "None recorded"} />
          <RecordItem label="Tags" value={appointment.tags || client?.tag || "None"} />
          <RecordItem label="Package" value={appointment.packageName || "Pay per visit"} />
          <RecordItem label="Service price" value={money.format(payment.price)} />
          <RecordItem label="Deposit" value={money.format(payment.deposit)} />
        </div>
      </section>

      <section className="appointment-detail-section">
        <div className="appointment-detail-section-heading">
          <div>
            <span className="appointment-section-icon clinical"><HeartPulse size={17} /></span>
            <div><strong>Clinical context</strong><small>Important notes for safe service delivery</small></div>
          </div>
        </div>
        <div className="drawer-copy-grid appointment-clinical-grid">
          <MiniPanel icon={HeartPulse} title="Medical Notes" rows={[client?.medicalNotes, client?.allergies, client?.contraindications].filter(Boolean)} empty="No medical notes recorded." />
          <MiniPanel icon={FileText} title="Service Protocol" rows={[service?.description, service?.contraindications, service?.aftercare].filter(Boolean)} empty="No service protocol notes." />
          <MiniPanel icon={MessageSquareText} title="Internal Notes" rows={[appointment.notes, appointment.internalNotes].filter(Boolean)} empty="No notes on this booking." />
          <MiniPanel icon={WalletCards} title="Payment History" rows={matchingPayments.map((transaction) => `${transaction.invoice} - ${money.format(transaction.total)} - ${transaction.status}`)} empty="No posted payment for this appointment." />
          <MiniPanel icon={ClipboardCheck} title="SOAP / Treatment Notes" rows={matchingTreatments.flatMap((item) => [item.preNotes, item.postNotes, item.deviceSettings]).filter(Boolean)} empty="No treatment notes linked to this visit." />
          <MiniPanel icon={ReceiptText} title="Prescription & Aftercare" rows={matchingTreatments.flatMap((item) => [item.prescription, item.aftercare, item.consumables]).filter(Boolean)} empty="No prescription or aftercare record." />
          <MiniPanel icon={Image} title="Attachments" rows={matchingTreatments.flatMap((item) => splitList(item.photos)).filter(Boolean)} empty="No treatment attachments." />
          <MiniPanel icon={Gift} title="Packages" rows={matchingPackages.map((item) => `${item.name} · ${item.remaining ?? item.balance ?? 0} remaining · ${item.status}`)} empty="No package linked to this patient." />
        </div>
      </section>

      <section className="appointment-detail-section appointment-history-section">
        <div className="appointment-detail-section-heading">
          <div>
            <span className="appointment-section-icon"><Clock size={17} /></span>
            <div><strong>Activity timeline</strong><small>{timeline.length} recorded events</small></div>
          </div>
        </div>
        <div className="appointment-timeline">
          {timeline.map((event, index) => (
            <article key={`${event.title}-${index}`}>
              <span>{formatDateTime(event.time)}</span>
              <strong>{event.title}</strong>
              <small>{event.actor || "System"} / {event.detail}</small>
            </article>
          ))}
        </div>
      </section>
    </aside>
    </>
  );
}

function ClientsModule({
  clients,
  selectedClientId,
  setSelectedClientId,
  treatments,
  appointments,
  transactions,
  packages,
  openModal,
  importClients,
  deleteClient,
  sensitiveAllowed,
  globalSearch,
  notify,
}) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryBranch, setDirectoryBranch] = useState("All branches");
  const [directoryView, setDirectoryView] = useStoredState("client-directory-view", "list");
  const [directorySort, setDirectorySort] = useState("recent");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [selectedClientIds, setSelectedClientIds] = useState(() => new Set());
  const [profileClientId, setProfileClientId] = useState(null);
  const importInputRef = useRef(null);
  const profileClient = clients.find((client) => client.id === profileClientId);
  const profileTreatments = treatments.filter((item) => item.clientId === profileClient?.id);
  const profileAppointments = appointments.filter((item) => item.clientId === profileClient?.id);
  const profileTransactions = transactions.filter((item) => item.client === profileClient?.fullName);
  const profilePackages = packages.filter((item) => item.clientId === profileClient?.id);
  const safeDirectoryView = directoryView === "cards" ? "cards" : "list";
  const activeDirectoryQuery = `${directoryQuery} ${globalSearch}`.trim();
  const directoryBranches = useMemo(
    () => ["All branches", ...new Set(clients.map((client) => client.branch).filter(Boolean))],
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
      const branchMatches = directoryBranch === "All branches" || client.branch === directoryBranch;
      if (!branchMatches) return false;
      if (!query) return true;

      const searchable = [
        client.id,
        client.fullName,
        client.mobile,
        client.email,
        client.branch,
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
  const activeDirectoryFilters = Number(Boolean(directoryQuery.trim())) + Number(directoryBranch !== "All branches");
  const pageSize = safeDirectoryView === "cards" ? 8 : 10;
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const visibleClients = filteredClients.slice((directoryPage - 1) * pageSize, directoryPage * pageSize);
  const visibleStart = filteredClients.length ? (directoryPage - 1) * pageSize + 1 : 0;
  const visibleEnd = Math.min(directoryPage * pageSize, filteredClients.length);
  const visibleIds = visibleClients.map((client) => client.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedClientIds.has(id));
  const selectedClients = filteredClients.filter((client) => selectedClientIds.has(client.id));
  const paginationItems = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, directoryPage - 1, directoryPage, directoryPage + 1, pageCount])]
      .filter((page) => page >= 1 && page <= pageCount)
      .sort((left, right) => left - right);
  const activeClients = clients.filter((client) => normalize(client.retention) !== "at risk").length;
  const newClients = clients.filter((client) => normalize(client.retention) === "new").length;
  const returningClients = clients.filter((client) => normalize(client.retention) === "returning").length;
  const vipClients = clients.filter((client) => normalize(client.tag) === "vip").length;
  const exportColumns = [
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
  ];

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
    setProfileClientId(client.id);
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

  return (
    <section className="clients-directory-page">
      <div className="client-insights" aria-label="Client directory summary">
        {[
          { icon: Users, label: "Total clients", value: clients.length, copy: "All clinic records", tone: "total" },
          { icon: UserCheck, label: "Active clients", value: activeClients, copy: "Currently engaged", tone: "active" },
          { icon: Sparkles, label: "New clients", value: newClients, copy: "First-time profiles", tone: "new" },
          { icon: RefreshCw, label: "Returning", value: returningClients, copy: "Ongoing relationships", tone: "returning" },
          { icon: Star, label: "VIP clients", value: vipClients, copy: "Priority experience", tone: "vip" },
        ].map(({ icon: Icon, label, value, copy, tone }) => (
          <article className={`client-insight-card ${tone}`} key={label}>
            <span className="client-insight-icon"><Icon size={18} aria-hidden="true" /></span>
            <span><small>{label}</small><strong>{value.toLocaleString()}</strong><em>{copy}</em></span>
          </article>
        ))}
      </div>

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
            <button className="secondary-button" type="button" onClick={() => importInputRef.current?.click()}>
              <Upload size={16} aria-hidden="true" /> Import clients
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!filteredClients.length}
              onClick={() => downloadCsv("mace-clients.csv", selectedClients.length ? selectedClients : filteredClients, exportColumns)}
            >
              <Download size={16} aria-hidden="true" /> {selectedClients.length ? "Export selected" : "Export"}
            </button>
            <button className="primary-button" type="button" onClick={() => openModal("client")}>
              <Plus size={16} aria-hidden="true" /> New client
            </button>
          </div>
        </div>

        <div className="clients-filter-bar">
          <label className="search-box clients-directory-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search clients"
              value={directoryQuery}
              onChange={(event) => setDirectoryQuery(event.target.value)}
              placeholder="Name, mobile, email, ID, package..."
            />
          </label>
          <label className="clients-select-control">
            <Filter size={15} aria-hidden="true" />
            <select aria-label="Filter clients by branch" value={directoryBranch} onChange={(event) => setDirectoryBranch(event.target.value)}>
              {directoryBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
            </select>
          </label>
          <label className="clients-select-control sort-control">
            <span>Sort</span>
            <select aria-label="Sort clients" value={directorySort} onChange={(event) => setDirectorySort(event.target.value)}>
              <option value="recent">Recent visit</option>
              <option value="name">Name A–Z</option>
              <option value="branch">Branch</option>
            </select>
          </label>
          <div className="segmented-control clients-view-toggle" aria-label="Client directory view">
            <button className={safeDirectoryView === "list" ? "active" : ""} type="button" onClick={() => setDirectoryView("list")}>
              <List size={16} aria-hidden="true" /> List
            </button>
            <button className={safeDirectoryView === "cards" ? "active" : ""} type="button" onClick={() => setDirectoryView("cards")}>
              <LayoutGrid size={16} aria-hidden="true" /> Grid
            </button>
          </div>
          {activeDirectoryFilters > 0 && (
            <button className="ghost-button clients-clear-filter" type="button" onClick={() => { setDirectoryQuery(""); setDirectoryBranch("All branches"); }}>
              <X size={15} aria-hidden="true" /> Clear
            </button>
          )}
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
              copy="Adjust the search or branch filter, or add a new client record."
              actionLabel="Add client"
              onAction={() => openModal("client")}
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
  client,
  treatments,
  appointments,
  transactions,
  packages,
  sensitiveAllowed,
  onClose,
  onEdit,
  onAddTreatment,
  onDelete,
}) {
  const profileLabels = [client.tag, client.retention]
    .filter(Boolean)
    .filter((label, index, labels) => labels.findIndex((item) => normalize(item) === normalize(label)) === index)
    .join(" / ");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${client.fullName} details`}>
      <div className="modal-card client-profile-panel client-profile-modal">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close client details"><X size={18} /></button>
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
                <button className="ghost-button small" type="button" onClick={onDelete}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
            <div className="record-grid client-profile-list">
              <RecordItem label="Mobile" value={sensitiveAllowed ? client.mobile : maskMobile(client.mobile)} />
              <RecordItem label="Email" value={sensitiveAllowed ? client.email : "Restricted"} />
              <RecordItem label="Branch visited" value={client.branch} />
              <RecordItem label="Source / referral" value={`${client.source} / ${client.referral}`} />
              <RecordItem label="Allergies" value={sensitiveAllowed ? client.allergies : "Restricted"} />
              <RecordItem label="Contraindications" value={sensitiveAllowed ? client.contraindications : "Restricted"} />
              <RecordItem label="Skin concerns" value={client.skinConcerns} />
              <RecordItem label="Package balance" value={client.packageBalance} />
            </div>
            <div className="dashboard-grid compact client-profile-panels">
              <MiniPanel icon={HeartPulse} title="Treatment history" rows={treatments.map((item) => `${item.date} - ${item.service}`)} empty="No treatments yet." />
              <MiniPanel icon={CalendarDays} title="Appointments" rows={appointments.map((item) => `${item.date} ${item.time} - ${item.status}`)} empty="No appointments yet." />
              <MiniPanel icon={WalletCards} title="Payments" rows={transactions.map((item) => `${item.invoice} - ${money.format(item.total)}`)} empty="No payments yet." />
              <MiniPanel icon={Gift} title="Packages" rows={packages.map((item) => `${item.name}: ${item.used}/${item.sessions}`)} empty="No active packages." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreatmentsModule({ treatments, clients, openModal, globalSearch }) {
  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={HeartPulse} title="Treatment Records" action={`${treatments.length} records`} />
        <button className="primary-button small" type="button" onClick={() => openModal("treatment")}>
          <Plus size={16} /> New treatment record
        </button>
        <div className="treatment-list">
          {treatments.map((record) => (
            <article className="treatment-card" key={record.id}>
              <div>
                <strong>{record.service}</strong>
                <span>{record.client}</span>
                <small>{record.date} / {record.provider} / {record.room}</small>
              </div>
              <StatusBadge status={record.followUp ? "Follow-up" : "Active"} />
              <p>{record.postNotes}</p>
              <div className="record-grid compact">
                <RecordItem label="Consumables" value={record.consumables} />
                <RecordItem label="Device settings" value={record.deviceSettings} />
                <RecordItem label="Batch / lot" value={record.batch} />
                <RecordItem label="Photos" value={`${record.photos} linked`} />
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="surface-panel image-panel">
        <SectionHeader icon={Camera} title="Before / After Photos" action="Protected gallery" />
        <div className="result-images">
          <img src={assets.resultOne} alt="Treatment result one" />
          <img src={assets.resultTwo} alt="Treatment result two" />
        </div>
        <button className="secondary-button full" type="button">
          <Upload size={17} aria-hidden="true" />
          Upload photos
        </button>
        <div className="note-strip">
          <ShieldCheck size={18} />
          <span>Photo access is restricted to authorized clinical roles and recorded in the audit trail.</span>
        </div>
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={FileText} title="Treatment Table" action={`${clients.length} client profiles`} />
        <SmartTable
          rows={treatments}
          globalSearch={globalSearch}
          columns={[
            { key: "date", label: "Date" },
            { key: "client", label: "Client" },
            { key: "service", label: "Procedure" },
            { key: "provider", label: "Provider" },
            { key: "batch", label: "Lot / Batch" },
            { key: "followUp", label: "Follow-up" },
            { key: "consent", label: "Consent", render: (row) => <StatusBadge status={row.consent} /> },
          ]}
        />
      </div>
    </section>
  );
}

function ServicesModule({ services, openModal, toggleService }) {
  const [category, setCategory] = useState("All");
  const [serviceQuery, setServiceQuery] = useState("");
  const [catalogView, setCatalogView] = useState("list");
  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
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
          <label className="search-box compact service-catalog-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search services"
              value={serviceQuery}
              onChange={(event) => setServiceQuery(event.target.value)}
              placeholder="Search services..."
            />
          </label>
          <label className="service-category-filter">
            <Filter size={15} aria-hidden="true" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter services by category">
              <option>All</option>
              {serviceCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
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
          <button className="primary-button small" type="button" onClick={() => openModal("service")}>
            <Plus size={16} /> Add service
          </button>
        </div>
        <div className={`service-grid management ${catalogView === "list" ? "list-view" : "grid-view"}`}>
          {filtered.map((service) => (
            <article className="service-card management-card" key={service.id}>
              <span>{service.category}</span>
              <strong>{service.name}</strong>
              <small>{service.duration} min / {service.room}</small>
              <b>{money.format(service.price)}</b>
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

function InventoryModule({ inventory, movements, receiveStock, openModal, globalSearch }) {
  const lowStock = inventory.filter((item) => stockStatus(item) !== "Healthy");

  return (
    <section className="module-grid two">
      <div className="surface-panel full-span">
        <SectionHeader icon={Boxes} title="Inventory Management" action={`${lowStock.length} alerts`} />
        <SmartTable
          rows={inventory}
          globalSearch={globalSearch}
          toolbarActions={(
            <>
              <button className="primary-button small" type="button" onClick={() => openModal("inventory")}>
                <Plus size={16} /> Add product
              </button>
              <button className="secondary-button small" type="button" onClick={() => openModal("inventory")}>
                <PackagePlus size={16} /> Receive stock
              </button>
            </>
          )}
          columns={[
            { key: "photo", label: "Photo", sortable: false, render: (row) => <ProductThumbnail item={row} />, exportValue: () => "" },
            { key: "item", label: "Item", render: (row) => <strong className="inventory-product-name">{row.item}</strong> },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "branch", label: "Branch" },
            { key: "stock", label: "Stock", render: (row) => `${row.stock} ${row.unit}` },
            { key: "expiry", label: "Expiry" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={stockStatus(row)} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => receiveStock(row.id, 5, "Quick receive")}><Plus size={15} /> +5</button>
                  <button type="button" onClick={() => openModal("inventory", row)}><Edit3 size={15} /> Edit</button>
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>
      <div className="surface-panel full-span">
        <SectionHeader icon={RefreshCw} title="Inventory Movement" action="Audit ready" />
        <SmartTable
          rows={movements}
          pageSize={5}
          emptyTitle="No inventory movement yet"
          columns={[
            { key: "date", label: "Date" },
            { key: "item", label: "Item" },
            { key: "branch", label: "Branch" },
            { key: "qty", label: "Qty" },
            { key: "reason", label: "Reason" },
            { key: "user", label: "User" },
          ]}
        />
      </div>
    </section>
  );
}

function PackagesModule({ packages, giftCertificates, clients, openModal, redeemPackage, globalSearch }) {
  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={Gift} title="Packages and Sessions" action={`${packages.length} packages`} />
        <button className="primary-button small" type="button" onClick={() => openModal("package")}>
          <Plus size={16} /> Sell package
        </button>
        <div className="package-list">
          {packages.map((pkg) => (
            <article className="package-card" key={pkg.id}>
              <strong>{pkg.name}</strong>
              <span>{pkg.client}</span>
              <div className="session-meter">
                <span style={{ width: `${Math.max(8, (Number(pkg.used) / Number(pkg.sessions)) * 100)}%` }} />
              </div>
              <small>{pkg.used} used / {pkg.sessions} sessions / expires {pkg.expires}</small>
              <div className="inline-actions">
                <button type="button" onClick={() => redeemPackage(pkg.id)}>Redeem session</button>
                <button type="button" onClick={() => openModal("package", pkg)}><Edit3 size={15} /> Edit</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="surface-panel">
        <SectionHeader icon={CreditCard} title="Gift Certificates" action="Cross-branch" />
        <div className="stock-list">
          {giftCertificates.map((gc) => (
            <article className="stock-row" key={gc.id}>
              <div>
                <strong>{gc.code}</strong>
                <span>{gc.client} / expires {gc.expires}</span>
              </div>
              <b>{money.format(gc.balance)}</b>
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
            { key: "expires", label: "Expiration" },
            { key: "branch", label: "Branch" },
            { key: "price", label: "Price", render: (row) => money.format(row.price) },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
        />
      </div>
    </section>
  );
}

function LeadsModule({
  leads,
  clients,
  appointments,
  services,
  staff,
  branches,
  openModal,
  importLeads,
  deleteLead,
  updateStatus,
  addActivity,
  scheduleFollowUp,
  bookAppointment,
  convertLead,
  mergeLead,
  globalSearch,
  isBooting,
  notify,
}) {
  const [storedTab, setStoredTab] = useStoredState("leads-directory-tab", "all");
  const [leadQuery, setLeadQuery] = useState("");
  const [filters, setFilters] = useState({ source: "All", branch: "All", owner: "All", priority: "All", followUp: "All" });
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ key: "created", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useStoredState("selected-lead", leads[0]?.id ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    const query = normalize(`${leadQuery} ${globalSearch}`.trim());
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
  }, [activeTabConfig.statuses, filters, globalSearch, leadQuery, normalizedLeads, sort]);

  const selectedLead = normalizedLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? normalizedLeads[0];
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
  }, [activeTab, filters, globalSearch, leadQuery]);

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
    setDetailsOpen(true);
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
          <button className="secondary-button" type="button" disabled={!filteredLeads.length} onClick={() => downloadCsv("mace-leads.csv", filteredLeads, exportColumns)}>
            <Download size={16} aria-hidden="true" /> Export
          </button>
          <button className="primary-button" type="button" onClick={() => openModal("lead")}>
            <Plus size={16} aria-hidden="true" /> Add Lead
          </button>
        </div>
      </div>

      <div className="surface-panel leads-directory-panel">
        <div className="leads-directory-toolbar">
          <strong aria-live="polite">{filteredLeads.length.toLocaleString()} {filteredLeads.length === 1 ? "Lead" : "Leads"}</strong>
          <div className="leads-toolbar-controls">
            <label className="search-box leads-directory-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search leads"
                placeholder="Search name, mobile, service, campaign..."
                value={leadQuery}
                onChange={(event) => setLeadQuery(event.target.value)}
              />
            </label>
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
                <th aria-sort={sort.key === "owner" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("owner", "Owner")}</th>
                <th className="leads-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(isBooting || isImporting) && Array.from({ length: 5 }, (_, rowIndex) => (
                <tr className="lead-skeleton-row" key={`lead-skeleton-${rowIndex}`} aria-hidden="true">
                  {Array.from({ length: 8 }, (_, cellIndex) => <td key={cellIndex}><span className="lead-skeleton-line" /></td>)}
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
                    <td data-label="Owner">
                      <span className="lead-owner-cell">
                        <span className="lead-owner-avatar" aria-hidden="true">{initialsFor(lead.owner || "Unassigned")}</span>
                        <strong>{lead.owner || "Unassigned"}</strong>
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
              copy="Adjust the search or filters, or add a new lead to get started."
              actionLabel="Add Lead"
              onAction={() => openModal("lead")}
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
}) {
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

  return (
    <aside className="surface-panel lead-detail-panel">
      <SectionHeader icon={UserCheck} title="Lead Detail" action={lead.status} />
      <div className="lead-detail-header">
        <div>
          <h3>{lead.name}</h3>
          <span>{lead.interest || lead.concern || "General inquiry"}</span>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="lead-detail-meta">
        <RecordPill label="Score" value={Number(lead.score || 0)} />
        <RecordPill label="Owner" value={lead.owner || "Unassigned"} />
        <RecordPill label="Branch" value={lead.branch || "-"} />
        <RecordPill label="SLA" value={leadSlaState(lead)} />
      </div>

      <div className="lead-primary-actions">
        {!isClosed && (
          <button className="primary-button small" type="button" disabled={busyAction === "convert"} onClick={() => runLeadAction("convert", () => convertLead(lead.id, { notes: conversionNotes }))}>
            <UserCheck size={16} /> Convert
          </button>
        )}
        <button className="secondary-button small" type="button" disabled={!lead.mobile || busyAction === "call"} onClick={() => runLeadAction("call", () => addActivity(lead.id, { type: "Call", title: "Call logged", channel: "Phone", note: `Called ${lead.mobile}`, lastContactedAt: new Date().toISOString() }))}>
          <PhoneCall size={16} /> Call
        </button>
        <button className="secondary-button small" type="button" disabled={!lead.mobile || busyAction === "message"} onClick={() => runLeadAction("message", () => addActivity(lead.id, { type: "Message", title: "Message logged", channel: lead.preferredChannel || "SMS", note: "Message sent or recorded", lastContactedAt: new Date().toISOString() }))}>
          <MessageSquareText size={16} /> Message
        </button>
        <button className="secondary-button small" type="button" disabled={!lead.email || busyAction === "email"} onClick={() => runLeadAction("email", () => addActivity(lead.id, { type: "Email", title: "Email logged", channel: "Email", note: `Email recorded for ${lead.email}`, lastContactedAt: new Date().toISOString() }))}>
          <Mail size={16} /> Email
        </button>
      </div>

      <div className="lead-detail-section">
        <h4>Workflow</h4>
        <div className="lead-stage-form">
          <label>
            <span>Stage</span>
            <select value={lead.status} onChange={(event) => runLeadAction("stage", () => changeStage(lead, event.target.value))}>
              {leadStatuses.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
          <label>
            <span>Loss reason</span>
            <select value={lossReason} onChange={(event) => setLossReason(event.target.value)}>
              {leadLossReasons.map((reason) => <option key={reason}>{reason}</option>)}
            </select>
          </label>
          <button className="secondary-button small" type="button" disabled={busyAction === "lost"} onClick={() => runLeadAction("lost", () => changeStage(lead, "Lost", { lossReason }))}>
            Mark Lost
          </button>
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Contact</h4>
        <dl className="lead-detail-list">
          <div><dt>Mobile</dt><dd>{lead.mobile || "-"}</dd></div>
          <div><dt>Email</dt><dd>{lead.email || "-"}</dd></div>
          <div><dt>Preferred</dt><dd>{lead.preferredChannel || "Phone"}</dd></div>
          <div><dt>Consent</dt><dd>{lead.permissionToContact ? "Respond allowed" : "Do not contact"}</dd></div>
        </dl>
      </div>

      <div className="lead-detail-section">
        <h4>Next Action</h4>
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

      <div className="lead-detail-section">
        <h4>Book</h4>
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

      <div className="lead-detail-section">
        <h4>Note</h4>
        <div className="lead-note-box">
          <textarea rows={3} value={quickNote} onChange={(event) => setQuickNote(event.target.value)} placeholder="Add internal note" />
          <button className="secondary-button small" type="button" disabled={!quickNote.trim() || busyAction === "note"} onClick={() => runLeadAction("note", () => addActivity(lead.id, { type: "Note", title: "Internal note", note: quickNote }))}>
            <FileText size={16} /> Add Note
          </button>
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Attribution</h4>
        <dl className="lead-detail-list">
          <div><dt>First touch</dt><dd>{lead.firstTouchSource || lead.source || "-"}</dd></div>
          <div><dt>Latest touch</dt><dd>{lead.latestTouchSource || lead.source || "-"}</dd></div>
          <div><dt>Campaign</dt><dd>{lead.campaign || lead.utmCampaign || "-"}</dd></div>
          <div><dt>External ID</dt><dd>{lead.externalLeadId || "-"}</dd></div>
        </dl>
      </div>

      <div className="lead-detail-section">
        <h4>Related</h4>
        <dl className="lead-detail-list">
          <div><dt>Client</dt><dd>{relatedClient?.fullName || lead.linkedClientId || "-"}</dd></div>
          <div><dt>Appointment</dt><dd>{relatedAppointment ? `${relatedAppointment.date} ${relatedAppointment.time}` : lead.linkedAppointmentId || "-"}</dd></div>
          <div><dt>Duplicate</dt><dd>{likelyDuplicate?.fullName || lead.duplicateOfLeadId || "-"}</dd></div>
        </dl>
        <div className="lead-secondary-actions">
          <button className="secondary-button small" type="button" onClick={() => openModal("lead", lead)}><Edit3 size={16} /> Edit</button>
          {lead.duplicateOfLeadId && <button className="secondary-button small" type="button" disabled={busyAction === "merge"} onClick={() => runLeadAction("merge", () => mergeLead(lead.duplicateOfLeadId, { duplicateId: lead.id }))}>Merge Duplicate</button>}
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Score Reasons</h4>
        <div className="lead-reason-list">
          {scoreReasons.length ? scoreReasons.map((item, index) => (
            <span key={`${item.reason}-${index}`}>+{item.points} {item.reason}</span>
          )) : <span>No scoring reasons stored.</span>}
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Timeline</h4>
        <div className="lead-timeline">
          {(lead.activities ?? []).slice(0, 8).map((activity) => (
            <article key={activity.id}>
              <strong>{activity.title}</strong>
              <span>{activity.actor} / {compactDate(activity.occurredAt)}</span>
              {activity.note && <p>{activity.note}</p>}
            </article>
          ))}
          {!(lead.activities ?? []).length && <p className="empty-copy">No timeline records yet.</p>}
        </div>
      </div>

      <label className="lead-conversion-note">
        <span>Conversion note</span>
        <textarea rows={2} value={conversionNotes} onChange={(event) => setConversionNotes(event.target.value)} />
      </label>
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

function MarketingModule({ templates, campaigns, settings, openModal, sendCampaign, sendingCampaignId, globalSearch }) {
  return (
    <section className="module-grid two">
      <div className="surface-panel wide">
        <SectionHeader icon={MessageSquareText} title="SMS Marketing and Reminders" action={`${settings.smsCredits} credits`} />
        <div className="toolbar-row">
          <button className="primary-button small" type="button" onClick={() => openModal("campaign")}>
            <Plus size={16} /> New campaign
          </button>
          <button className="secondary-button small" type="button" onClick={() => openModal("campaign", { channel: "Email" })}>
            <Mail size={16} /> New email
          </button>
        </div>
        <SmartTable
          rows={campaigns}
          globalSearch={globalSearch}
          columns={[
            { key: "name", label: "Campaign" },
            { key: "segment", label: "Segment" },
            { key: "channel", label: "Channel" },
            { key: "sent", label: "Sent" },
            { key: "booked", label: "Booked" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => sendCampaign(row.id)} disabled={sendingCampaignId === row.id}>
                    <Send size={15} /> {sendingCampaignId === row.id ? "Sending..." : "Send"}
                  </button>
                  <button type="button" onClick={() => openModal("campaign", row)}><Edit3 size={15} /> Edit</button>
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>
      <div className="surface-panel">
        <SectionHeader icon={BookOpen} title="Template Library" action={`${templates.length} active`} />
        <div className="message-list">
          {templates.map((template) => (
            <MessageItem key={template.id} title={template.name} copy={template.text} />
          ))}
        </div>
      </div>
    </section>
  );
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
    return (
      <section className="surface-panel my-workspace-empty">
        <UserCheck size={28} />
        <h2>Account connection required</h2>
        <p>{session.name}'s login is active, but it is not connected to a staff profile yet. An administrator can link it from Staff Management.</p>
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

function StaffModule({ staff, session, openModal, toggleAttendance, globalSearch, applyAuditLog, notify }) {
  const canInvite = canManageOrganization(session.role);
  const [invitations, setInvitations] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const roles = Object.keys(roleAccess).filter((role) => isBusinessOwner(session.role) || !isBusinessOwner(role));
  const [form, setForm] = useState({ name: "", email: "", role: "Doctor", branch: session.branch || "All branches", department: "", specialty: "", message: "" });

  const refresh = useCallback(async () => {
    if (!canInvite) return;
    try { setInvitations((await loadInvitations()).invitations || []); } catch (loadError) { notify(loadError.message, "error"); }
  }, [canInvite, notify]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submitInvitation(event) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await createInvitation(form);
      setInvitations((current) => [result.invitation, ...current]);
      applyAuditLog(result.auditLog);
      setShowInvite(false);
      setForm({ name: "", email: "", role: "Doctor", branch: session.branch || "All branches", department: "", specialty: "", message: "" });
      notify(result.invitation.status === "Failed" ? "Invitation saved, but email delivery failed. Configure SMTP and resend." : "Invitation sent.", result.invitation.status === "Failed" ? "warning" : "success");
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }

  async function runInvitationAction(action, invitation) {
    try {
      const result = action === "revoke" ? await revokeInvitation(invitation.id) : await resendInvitation(invitation.id);
      setInvitations((current) => current.map((item) => item.id === result.invitation.id ? result.invitation : item));
      applyAuditLog(result.auditLog); notify(action === "revoke" ? "Invitation revoked." : "Invitation resent.");
    } catch (actionError) { notify(actionError.message, "error"); }
  }
  return (
    <section className="module-grid staff-management-grid">
      <div className="surface-panel">
        <SectionHeader icon={BriefcaseBusiness} title="Staff Management" action={`${staff.length} employees`} />
        <SmartTable
          rows={staff}
          globalSearch={globalSearch}
          toolbarActions={(
            <div className="inline-actions">
              {canInvite && <button className="primary-button small" type="button" onClick={() => setShowInvite(true)}><Mail size={16} /> Invite member</button>}
              <button className="secondary-button small" type="button" onClick={() => openModal("staff")}><Plus size={16} /> Add staff</button>
            </div>
          )}
          columns={[
            { key: "name", label: "Name", className: "staff-name-column", render: (row) => <div className="staff-name-with-photo"><ClientAvatar client={{ fullName: row.name, photo: row.photo }} size="small" /><strong>{row.name}</strong></div> },
            { key: "role", label: "Role" },
            { key: "branch", label: "Branch" },
            { key: "schedule", label: "Schedule" },
            { key: "commissionRate", label: "Commission", render: (row) => `${row.commissionRate}%` },
            { key: "attendance", label: "Attendance", render: (row) => <StatusBadge status={row.attendance} /> },
            {
              key: "actions",
              label: "Actions",
              className: "staff-actions-column",
              render: (row) => (
                <div className="inline-actions">
                  <button type="button" onClick={() => toggleAttendance(row.id)}><Clock size={15} /> Clock</button>
                  <button type="button" onClick={() => openModal("staff", row)}><Edit3 size={15} /> Edit</button>
                </div>
              ),
              exportValue: () => "",
            },
          ]}
        />
      </div>
      {canInvite && <div className="surface-panel">
        <SectionHeader icon={Mail} title="Member Invitations" action={`${invitations.length} records`} />
        <SmartTable rows={invitations} columns={[
          { key: "name", label: "Member", render: (row) => <div><strong>{row.name}</strong><small>{row.email}</small></div> },
          { key: "role", label: "Role" },
          { key: "department", label: "Department / specialty", render: (row) => row.department || row.specialty || "—" },
          { key: "expiresAt", label: "Expires", render: (row) => new Date(row.expiresAt).toLocaleDateString("en-PH") },
          { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "actions", label: "Actions", render: (row) => <div className="inline-actions">{["Pending", "Expired", "Failed"].includes(row.status) && <button type="button" onClick={() => runInvitationAction("resend", row)}><RefreshCw size={14} /> Resend</button>}{row.status === "Pending" && <button type="button" onClick={() => runInvitationAction("revoke", row)}><X size={14} /> Revoke</button>}</div>, exportValue: () => "" },
        ]} />
      </div>}
      {showInvite && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Invite member"><form className="modal-card invitation-modal" onSubmit={submitInvitation}>
        <button className="modal-close" type="button" onClick={() => setShowInvite(false)}><X size={18} /></button>
        <SectionHeader icon={Mail} title="Invite organization member" action="Secure link · 7 days" />
        <div className="form-grid">
          <label><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label><span>Branch</span><input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></label>
          <label><span>Department</span><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label><span>Specialty</span><input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></label>
          <label className="full-span"><span>Optional message</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
        </div>
        {error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}
        <div className="modal-actions"><button className="ghost-button" type="button" onClick={() => setShowInvite(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Sending..." : "Send invitation"}</button></div>
      </form></div>}
    </section>
  );
}

function AcceptInvitationScreen({ token }) {
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => { inspectInvitation(token).then((result) => setInvitation(result.invitation)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [token]);
  async function submit(event) {
    event.preventDefault(); setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    try { await acceptInvitation(token, password); setDone(true); window.history.replaceState({}, "", window.location.pathname); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-panel"><form className="login-card" onSubmit={submit}><img className="login-logo" src={assets.logo} alt="MACE by Dr. Mace" />
    {done ? <><p className="eyebrow">Invitation accepted</p><h2>Your workspace is ready</h2><a className="primary-button full" href="/">Continue to sign in</a></> : <><p className="eyebrow">Organization invitation</p><h2>{loading && !invitation ? "Checking invitation..." : `Welcome, ${invitation?.name || "member"}`}</h2>{invitation && <p className="login-helper">Join as {invitation.role} · link expires {new Date(invitation.expiresAt).toLocaleDateString("en-PH")}</p>}<label><span>Create password</span><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label><span>Confirm password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>{error && <div className="inline-state danger"><AlertCircle size={16} />{error}</div>}<button className="primary-button full" disabled={loading || !invitation || invitation.status !== "Pending"}>{loading ? "Joining..." : "Accept invitation"}</button></>}
  </form></section></main>;
}

function BranchesModule({ branchScope, branchRecords, staff, transactions, appointments, canManage, canDelete, onCreateBranch, onUpdateBranch, onDeleteBranch, onManageCompany }) {
  const [showCreate, setShowCreate] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "", hours: "", roomCount: 0, devices: "", image: "" });
  const [photoError, setPhotoError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const totalSales = transactions.reduce((sum, item) => sum + Number(item.total || 0), 0);

  function resetEditor() {
    setForm({ name: "", city: "", address: "", phone: "", hours: "", roomCount: 0, devices: "", image: "" });
    setPhotoError("");
    setSaveError("");
    setBranchToEdit(null);
    setShowCreate(false);
  }

  function openCreate() {
    resetEditor();
    setShowCreate(true);
  }

  function openEdit(branch) {
    setForm({
      name: branch.name || "",
      city: branch.city || "",
      address: branch.address || "",
      phone: branch.phone || "",
      hours: branch.hours || "",
      roomCount: branch.rooms?.length ?? 0,
      devices: Array.isArray(branch.devices) ? branch.devices.join(", ") : "",
      image: branch.image || "",
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
        roomCount: Number(form.roomCount) || 0,
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

  function openDelete(branch) {
    setBranchToDelete(branch);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  function closeDelete() {
    if (deleting) return;
    setBranchToDelete(null);
    setDeleteConfirmation("");
    setDeleteError("");
  }

  async function submitDelete(event) {
    event.preventDefault();
    if (!branchToDelete || deleteConfirmation !== branchToDelete.name) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteBranch(branchToDelete, deleteConfirmation);
      setBranchToDelete(null);
      setDeleteConfirmation("");
      setDeleteError("");
    } catch (error) {
      setDeleteError(error?.message || "Unable to delete this branch.");
    } finally {
      setDeleting(false);
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
            <button className="ghost-button" type="button" onClick={onManageCompany}><Settings size={17} /> Add / edit company</button>
            <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} /> Add branch</button>
          </div>
        )}
      </div>

      <div className="branch-summary-grid">
        <article><Store size={19} /><div><strong>{branchRecords.length}</strong><span>Active branches</span></div></article>
        <article><Users size={19} /><div><strong>{staff.length}</strong><span>Assigned employees</span></div></article>
        <article><CalendarDays size={19} /><div><strong>{appointments.filter((item) => item.date === today).length}</strong><span>Bookings today</span></div></article>
        <article><CircleDollarSign size={19} /><div><strong>{money.format(totalSales)}</strong><span>Recorded sales</span></div></article>
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
        <div className="branch-grid">
          {branchRecords.map((item) => {
            const assignedStaff = staff.filter((person) => person.branch === item.name).length;
            const branchSales = transactions.filter((sale) => sale.branch === item.name).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
            return (
              <article className="branch-card" key={item.id}>
                {item.image && <img className="branch-cover-photo" src={item.image} alt={`${item.name} clinic`} />}
                <div className="branch-card-header">
                  <div className="branch-avatar"><Store size={22} /></div>
                  <div><span>{item.city || "Location pending"}</span><h2>{item.name}</h2></div>
                  <StatusBadge status="Active" />
                </div>
                <p className="branch-address"><MapPin size={15} /> {item.address || "Add the complete clinic address"}</p>
                <dl>
                  <div><dt>Rooms</dt><dd>{item.rooms?.length ?? 0}</dd></div>
                  <div><dt>Employees</dt><dd>{assignedStaff}</dd></div>
                  <div><dt>Sales</dt><dd>{money.format(branchSales)}</dd></div>
                </dl>
                <div className="branch-meta-row"><Clock size={15} /><span>{item.hours || "Operating hours not set"}</span></div>
                <div className="workflow-chips">{(item.devices || []).map((device) => <span key={device}>{device}</span>)}</div>
                {(canManage || canDelete) && <div className="branch-card-actions">
                  {canManage && <button className="branch-edit-trigger" type="button" onClick={() => openEdit(item)}><Edit3 size={15} /> Edit branch</button>}
                  {canDelete && <button className="branch-delete-trigger" type="button" onClick={() => openDelete(item)}><Trash2 size={15} /> Delete branch</button>}
                </div>}
              </article>
            );
          })}
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
            <div className="form-grid">
              <label><span>Branch name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. MACE BGC" /></label>
              <label><span>City</span><input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" /></label>
              <label className="full-span"><span>Complete address</span><input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Building, street, city" /></label>
              <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Branch contact number" /></label>
              <label><span>Operating hours</span><input value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} placeholder="9:00 AM - 7:00 PM" /></label>
              <label><span>Number of rooms</span><input min="0" max="50" type="number" value={form.roomCount} onChange={(event) => setForm({ ...form, roomCount: event.target.value })} /></label>
              <label><span>Devices</span><input value={form.devices} onChange={(event) => setForm({ ...form, devices: event.target.value })} placeholder="Comma-separated" /></label>
            </div>
            {saveError && <div className="inline-state danger"><AlertCircle size={16} /><span>{saveError}</span></div>}
            <div className="modal-actions"><button className="ghost-button" type="button" onClick={resetEditor} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : branchToEdit ? "Save branch changes" : "Create branch"}</button></div>
          </form>
        </div>
      )}

      {branchToDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Delete ${branchToDelete.name}`}>
          <form className="modal-card branch-delete-modal" onSubmit={submitDelete}>
            <button className="modal-close" type="button" aria-label="Close" onClick={closeDelete} disabled={deleting}><X size={18} /></button>
            <div className="branch-delete-heading"><div className="branch-delete-icon"><Trash2 size={20} /></div><div><p className="eyebrow">Danger zone</p><h2>Delete {branchToDelete.name}</h2></div></div>
            <p>This permanently removes the branch and its rooms. Any employees, appointments, inventory, services, sales, or other branch data must be reassigned first.</p>
            <div className="branch-delete-confirmation">
              <span>Type <strong>{branchToDelete.name}</strong> to confirm.</span>
              <input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} aria-label="Branch name confirmation" autoComplete="off" />
            </div>
            {deleteError && <div className="inline-state danger"><AlertCircle size={16} /><span>{deleteError}</span></div>}
            <div className="modal-actions"><button className="ghost-button" type="button" onClick={closeDelete} disabled={deleting}>Cancel</button><button className="branch-delete-button" type="submit" disabled={deleting || deleteConfirmation !== branchToDelete.name}>{deleting ? "Deleting..." : "Delete branch permanently"}</button></div>
          </form>
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
        <button className="primary-button small" type="button" onClick={() => openModal("expense")}>
          <Plus size={16} /> Record expense
        </button>
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
  const activeTransactions = transactions.filter((transaction) => transaction.status !== "Void");
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

function BookingPortal({ services, onSubmit }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
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
        <img src={assets.clinic} alt="MACE clinic interior" />
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
            <label className="span-2"><span>Choose treatment</span><select value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })}>{services.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} - {money.format(item.price)}</option>)}</select></label>
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
            <label><span>Preferred staff</span><select value={form.staff} onChange={(event) => setForm({ ...form, staff: event.target.value })}><option>Any available</option><option>Dr. Mace</option><option>Dr. Aria Tan</option><option>Nurse Ana</option><option>Nurse Bea</option></select></label>
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

function SettingsModule({ settings, users, auditLogs, discounts, openModal, globalSearch }) {
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
        <SmartTable
          rows={discounts}
          columns={[
            { key: "name", label: "Discount" },
            { key: "type", label: "Type" },
            { key: "value", label: "Value" },
            { key: "permission", label: "Permission" },
            { key: "applicable", label: "Applicable" },
            { key: "active", label: "Status", render: (row) => <StatusBadge status={row.active ? "Active" : "Inactive"} /> },
          ]}
        />
        <div className="workflow-chips add-ons">
          {["Automated SMS Marketing", "SMS credit top-up", "Retraining / face-to-face meetings", "Extra branch", "Extra user", "Advanced analytics", "Custom reports"].map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
    </section>
  );
}

function SupportModule() {
  const supportChannels = [
    { icon: PhoneCall, title: "Priority support line", copy: "0917 109 8462 / 9:00 AM-8:00 PM daily" },
    { icon: Mail, title: "Operations inbox", copy: "support@maceclinic.test for account, billing, and access requests" },
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
            ["Receive inventory", "Use Inventory, select the item, record quantity received, branch, batch, expiry, and supplier notes."],
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
  modal,
  closeModal,
  completeTransaction,
  saveAppointment,
  saveClient,
  saveService,
  saveInventory,
  saveLead,
  saveTreatment,
  saveExpense,
  saveStaff,
  savePackage,
  saveCampaign,
  saveSettings,
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
}) {
  if (!modal) return null;

  const branchOptions = branches.map((branch) => branch.name);
  const clientOptions = clients.map((client) => ({ value: client.id, label: client.fullName }));
  const serviceOptions = services.map((service) => ({ value: service.id, label: service.name }));
  const employeeServiceSuggestions = [
    "All services",
    "Consultations",
    "Injectables, consultations",
    "Facials, IV drips",
    "Lasers, facials",
    ...services.map((service) => service.name),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const staffOptions = staff.map((person) => person.name);
  const inventoryOptions = inventory.map((item) => item.item);
  const consumableSuggestions = [
    ...inventoryOptions,
    ...services.flatMap((service) => (Array.isArray(service.consumables) ? service.consumables : splitList(service.consumables))),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const templateOptions = [{ value: "", label: "Custom message" }, ...(templates ?? []).map((template) => ({ value: template.id, label: template.name }))];
  const defaultMarketingTemplate = (templates ?? []).find((template) => template.category === "Marketing") ?? templates?.[0];
  const canManageProductPhotos = canManageOrganization(session?.role);

  if (modal.type === "payment") {
    return (
      <PaymentModal
        draft={modal.payload}
        packages={packages}
        giftCertificates={giftCertificates}
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
        branches={branches}
        staff={staff}
        appointments={appointments}
        packages={packages}
        onClose={closeModal}
        onSubmit={saveAppointment}
      />
    );
  }

  const configs = {
    appointment: {
      title: modal.payload?.id ? "Edit Appointment" : "New Appointment",
      initial: {
        date: todayDate(),
        time: "10:00",
        clientId: clients[0]?.id,
        serviceId: services[0]?.id,
        branch: branches[0]?.name,
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
        photo: "",
        mobile: "",
        email: "",
        gender: "",
        birthday: "",
        address: "",
        city: "",
        emergency: "",
        branch: branches[0]?.name,
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
      },
      submitLabel: "Save client",
      onSubmit: saveClient,
      fields: [
        field("photo", "Profile photo", "photo", null, "span-2"),
        field("fullName", "Full name"),
        field("mobile", "Mobile number"),
        field("email", "Email", "email"),
        field("gender", "Gender", "select", ["", "Female", "Male", "Prefer not to say"]),
        field("birthday", "Birthday", "date"),
        field("branch", "Branch", "select", branchOptions),
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
        duration: 60,
        price: 0,
        commission: "",
        room: "Treatment Room",
        active: true,
        pos: true,
        description: "",
        contraindications: "",
        aftercare: "",
        ...modal.payload,
        consumables: Array.isArray(modal.payload?.consumables) ? modal.payload.consumables.join(", ") : modal.payload?.consumables ?? "",
        branches: Array.isArray(modal.payload?.branches) ? modal.payload.branches.join(", ") : modal.payload?.branches ?? branchOptions.join(", "),
        staff: Array.isArray(modal.payload?.staff) ? modal.payload.staff.join(", ") : modal.payload?.staff ?? "Doctor, Nurse / Aesthetician",
      },
      submitLabel: "Save service",
      onSubmit: saveService,
      fields: [
        field("name", "Service name"),
        field("category", "Category", "select", serviceCategories),
        field("duration", "Duration minutes", "number"),
        field("price", "Price", "number"),
        field("commission", "Commission rule"),
        field("consumables", "Consumables", "suggest", consumableSuggestions),
        field("branches", "Branch availability"),
        field("staff", "Staff allowed"),
        field("room", "Room / device required"),
        field("active", "Active", "checkbox"),
        field("pos", "Editable on POS", "checkbox"),
        field("description", "Description", "textarea", null, "span-2"),
        field("contraindications", "Contraindication notes", "textarea", null, "span-2"),
        field("aftercare", "Aftercare notes", "textarea", null, "span-2"),
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
        branch: branches[0]?.name,
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
        field("sku", "SKU"),
        field("brand", "Brand"),
        field("category", "Category", "select", settings.productCategories),
        field("type", "Type", "select", ["Consumable", "Retail"]),
        field("unit", "Unit"),
        field("packQty", "Packaging qty", "number"),
        field("stock", "Current stock", "number"),
        field("branch", "Branch", "select", branchOptions),
        field("location", "Stock location"),
        field("reorder", "Reorder level", "number"),
        field("expiry", "Expiry date", "date"),
        field("batch", "Batch / lot"),
        field("supplier", "Supplier"),
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
        branch: branches[0]?.name,
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
      initial: { clientId: clients[0]?.id, date: todayDate(), service: services[0]?.name, provider: staff[0]?.name, room: "Room 1", preNotes: "", postNotes: "", consumables: "", deviceSettings: "", batch: "", consent: "Pending", followUp: "", outcome: "", satisfaction: "", photos: 0, ...modal.payload },
      submitLabel: "Save treatment",
      onSubmit: saveTreatment,
      fields: [
        field("clientId", "Client", "select", clientOptions),
        field("date", "Treatment date", "date"),
        field("service", "Service / procedure", "select", services.map((service) => service.name)),
        field("provider", "Doctor / staff", "select", staffOptions),
        field("room", "Room"),
        field("consumables", "Consumables used"),
        field("deviceSettings", "Device settings"),
        field("batch", "Lot / batch"),
        field("consent", "Consent", "select", ["Pending", "Signed"]),
        field("followUp", "Follow-up date", "date"),
        field("photos", "Photos linked", "number"),
        field("satisfaction", "Client satisfaction"),
        field("preNotes", "Pre-treatment notes", "textarea", null, "span-2"),
        field("postNotes", "Post-treatment notes", "textarea", null, "span-2"),
        field("outcome", "Outcome notes", "textarea", null, "span-2"),
      ],
    },
    expense: {
      title: modal.payload?.id ? "Edit Expense" : "Record Expense",
      initial: { date: todayDate(), name: "", category: settings.expenseCategories[0], branch: branches[0]?.name, amount: 0, method: "Cash", approver: "Owner", status: "For approval", notes: "", receipt: "Pending", ...modal.payload },
      submitLabel: "Save expense",
      onSubmit: saveExpense,
      fields: [
        field("date", "Date", "date"),
        field("name", "Expense name"),
        field("category", "Category", "select", settings.expenseCategories),
        field("branch", "Branch", "select", ["All branches", ...branchOptions]),
        field("amount", "Amount", "number"),
        field("method", "Payment method", "select", paymentMethods),
        field("approver", "Approver"),
        field("status", "Status", "select", ["For approval", "Approved", "Rejected"]),
        field("receipt", "Receipt"),
        field("notes", "Notes", "textarea", null, "span-2"),
      ],
    },
    staff: {
      title: modal.payload?.id ? "Edit Employee" : "Add Employee",
      initial: { name: "", photo: "", role: "Nurse / Aesthetician", branch: branches[0]?.name, schedule: "9:00 AM - 6:00 PM", commissionType: "", commissionRate: 0, services: "", status: "Available", attendance: "Clocked out", employmentDate: todayDate(), phone: "", ...modal.payload },
      submitLabel: "Save employee",
      onSubmit: saveStaff,
      fields: [
        field("photo", "Employee photo", "photo", null, "span-2"),
        field("name", "Name"),
        field("role", "Role", "select", Object.keys(roleAccess)),
        field("branch", "Branch", "select", branchOptions),
        field("schedule", "Schedule"),
        field("commissionType", "Commission type", "suggest", ["Percentage per service", "Fixed amount per service", "Tiered commission", "Doctor rate", "Skin care", "Device care", "No commission / N/A"]),
        field("commissionRate", "Commission rate", "number-suggest", [0, 5, 8, 10, 12, 15, 20]),
        field("services", "Services allowed", "suggest", employeeServiceSuggestions),
        field("status", "Status", "select", ["Available", "In treatment", "On leave", "Inactive"]),
        field("attendance", "Attendance", "select", ["Clocked in", "Clocked out"]),
        field("employmentDate", "Employment date", "date"),
        field("phone", "Contact number"),
      ],
    },
    package: {
      title: modal.payload?.id ? "Edit Package" : "Sell Package",
      initial: { name: "Glow Maintenance Plan", clientId: clients[0]?.id, sessions: 6, used: 0, expires: todayDate(), branch: "All branches", transferable: false, status: "Active", price: 0, ...modal.payload },
      submitLabel: "Save package",
      onSubmit: savePackage,
      fields: [
        field("name", "Package name"),
        field("clientId", "Client", "select", clientOptions),
        field("sessions", "Sessions", "number"),
        field("used", "Used", "number"),
        field("expires", "Expiration", "date"),
        field("branch", "Branch", "select", ["All branches", ...branchOptions]),
        field("transferable", "Transferable", "checkbox"),
        field("status", "Status", "select", ["Active", "Pending", "Completed", "Expired"]),
        field("price", "Price", "number"),
      ],
    },
    campaign: {
      title: modal.payload?.id ? "Edit Campaign" : "New Campaign",
      initial: {
        name: "",
        segment: "Inactive clients",
        channel: "SMS",
        templateId: defaultMarketingTemplate?.id ?? "",
        subject: "A note from MACE",
        message: defaultMarketingTemplate?.text ?? "Hi {{client}}, it has been a while. Book your personalized care session with MACE this week.",
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
        field("segment", "Segment", "select", ["Birthday month", "Last visit date", "Service category", "VIP", "Inactive clients", "New clients", "Package holders"]),
        field("channel", "Channel", "select", ["SMS", "Email", "Email-ready"]),
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
  return <EntityModal config={config} onClose={closeModal} />;
}

function PaymentModal({ draft, packages = [], giftCertificates = [], onClose, onSubmit }) {
  const [payments, setPayments] = useState(() => {
    if (draft.splitPayment) {
      const firstAmount = Math.floor(Number(draft.total || 0) / 2);
      return [
        { method: "Cash", amount: firstAmount },
        { method: "Credit Card", amount: Number(draft.total || 0) - firstAmount },
      ];
    }
    return [{ method: draft.paymentMethod || "Cash", amount: draft.total }];
  });
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const change = Math.max(0, paid - draft.total);

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
  const tenderIncomplete = payments.some((payment) =>
    (payment.method === "Gift Certificate" && !payment.giftCertificateId)
    || (payment.method === "Package" && !payment.packageId));
  const canPost = payments.some((payment) => Number(payment.amount) > 0) && !tenderIncomplete;

  function updatePayment(index, patch) {
    setPayments((current) => current.map((payment, itemIndex) => (itemIndex === index ? { ...payment, ...patch } : payment)));
  }

  function remainingBesides(index) {
    const others = payments.reduce((sum, payment, itemIndex) => (itemIndex === index ? sum : sum + Number(payment.amount || 0)), 0);
    return Math.max(0, Number(draft.total || 0) - others);
  }

  function changeMethod(index, method) {
    updatePayment(index, { method, giftCertificateId: undefined, packageId: undefined });
  }

  function chooseCertificate(index, certificateId) {
    const certificate = usableCertificates.find((item) => item.id === certificateId);
    updatePayment(index, {
      giftCertificateId: certificateId || undefined,
      ...(certificate ? { amount: Math.min(Number(certificate.balance || 0), remainingBesides(index)) } : {}),
    });
  }

  function choosePackage(index, packageId) {
    updatePayment(index, {
      packageId: packageId || undefined,
      ...(packageId ? { amount: remainingBesides(index) } : {}),
    });
  }

  const submitPayment = useCallback(async () => {
    if (saving || !canPost) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ payments, notes });
    } catch (submitError) {
      setError(submitError?.message || "Payment could not be completed.");
    } finally {
      setSaving(false);
    }
  }, [canPost, notes, onSubmit, payments, saving]);

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
                  {posPaymentMethods.map((method) => <option key={method}>{method}</option>)}
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
              )}
              {payment.method === "Gift Certificate" && !usableCertificates.length && (
                <span className="payment-tender-hint">No active gift certificates for this branch.</span>
              )}
              {payment.method === "Package" && !usablePackages.length && (
                <span className="payment-tender-hint">No active packages for this client at this branch.</span>
              )}
            </div>
          ))}
        </div>
        <button className="secondary-button small" type="button" onClick={() => setPayments((current) => [...current, { method: "GCash", amount: 0 }])}>
          <Plus size={16} /> Add split payment
        </button>
        <label className="stacked-field">
          <span>Payment notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="receipt-preview">
          <div><span>Paid</span><strong>{money.format(paid)}</strong></div>
          <div><span>Change</span><strong>{money.format(change)}</strong></div>
          <div><span>Status</span><strong>{paid >= draft.total ? "Paid" : "Partial"}</strong></div>
        </div>
        <div className="modal-actions">
          <span className="modal-keyboard-hint"><kbd>Esc</kbd> cancel · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> post</span>
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
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

function AppointmentModal({ payload, clients, services, branches, staff, appointments = [], packages = [], onClose, onSubmit }) {
  const [form, setForm] = useState({
    date: todayDate(),
    time: "",
    clientId: "",
    serviceId: "",
    branch: branches[0]?.name || "",
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
  const selectedService = services.find((item) => item.id === form.serviceId);
  const selectedBranch = branches.find((item) => item.name === form.branch);
  const availableRooms = selectedBranch?.rooms || uniqueRoomsFromBranches();
  const availableStaff = staff.filter((person) => person.branch === form.branch || person.branch === "All branches" || !person.branch);
  const patient = clients.find((client) => client.id === form.clientId);
  const patientPackages = packages.filter((item) => item.clientId === form.clientId || item.client === patient?.fullName);
  const duration = Math.max(15, Number(form.duration || selectedService?.duration || 60));
  const availableSlots = useMemo(() => {
    if (!form.date) return [];
    const slots = [];
    for (let start = scheduleStartMinutes; start + duration <= scheduleEndMinutes; start += 15) {
      const end = start + duration;
      if (start < 13 * 60 && end > 12 * 60) continue;
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
  }, [appointments, duration, form.branch, form.date, form.id, form.room, form.staff, services]);

  function update(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "branch" ? { room: "", staff: "" } : {}),
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
          <div><p className="eyebrow">Appointments</p><h2>{payload?.id ? "Edit appointment" : "New appointment"}</h2><span>Choose the patient, treatment, and an available clinic resource.</span></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form"><X size={19} /></button>
        </header>
        <div className="appointment-booking-body">
          {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
          <section className="booking-form-section"><div className="booking-step">1</div><div className="booking-section-content"><h3>Client and service</h3>
            <label className="stacked-field"><span>Client <RequiredMark /></span><select aria-label="Client, required" value={form.clientId} onChange={(event) => update("clientId", event.target.value)}><option value="">Search or select a client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.fullName}{client.mobile ? ` · ${client.mobile}` : ""}</option>)}</select></label>
            <div className="booking-two-column"><label className="stacked-field"><span>Service <RequiredMark /></span><select aria-label="Service, required" value={form.serviceId} onChange={(event) => update("serviceId", event.target.value)}><option value="">Select a service</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
            <label className="stacked-field"><span>Appointment type</span><select value={form.appointmentType} onChange={(event) => update("appointmentType", event.target.value)}>{["Consultation", "Treatment", "Follow-up", "Check-up"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
            {selectedService && <div className="service-selection-summary"><Clock size={16} /><span>{selectedService.duration || 60} minutes</span><strong>{money.format(selectedService.price || 0)}</strong></div>}
            {patientPackages.length > 0 && <label className="stacked-field"><span>Package / membership</span><select value={form.packageName} onChange={(event) => update("packageName", event.target.value)}><option value="">Pay per visit</option>{patientPackages.map((item) => <option value={item.name} key={item.id}>{item.name} · {item.remaining ?? item.balance ?? 0} remaining</option>)}</select></label>}
          </div></section>
          <section className="booking-form-section"><div className="booking-step">2</div><div className="booking-section-content"><h3>Date and location</h3><div className="booking-two-column">
            <label className="stacked-field"><span>Date <RequiredMark /></span><input aria-label="Date, required" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} /></label>
            <label className="stacked-field"><span>Time <RequiredMark /></span><input aria-label="Time, required" type="time" step="900" value={form.time} onChange={(event) => update("time", event.target.value)} /></label>
            <label className="stacked-field"><span>Duration</span><select value={form.duration} onChange={(event) => update("duration", Number(event.target.value))}>{[15, 30, 45, 60, 75, 90, 120, 180].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select></label>
            <label className="stacked-field"><span>Timezone</span><select value={form.timezone} onChange={(event) => update("timezone", event.target.value)}><option value="Asia/Manila">Asia/Manila (GMT+8)</option><option value="Asia/Singapore">Asia/Singapore (GMT+8)</option></select></label>
            <label className="stacked-field"><span>Branch <RequiredMark /></span><select aria-label="Branch, required" value={form.branch} onChange={(event) => update("branch", event.target.value)}>{branches.map((branch) => <option key={branch.name}>{branch.name}</option>)}</select></label>
          </div></div></section>
          <section className="booking-form-section"><div className="booking-step">3</div><div className="booking-section-content"><h3>Staff and room</h3><div className="booking-two-column">
            <label className="stacked-field"><span>Staff <RequiredMark /></span><select aria-label="Staff, required" value={form.staff} onChange={(event) => update("staff", event.target.value)}><option value="">Select available staff</option>{availableStaff.map((person) => <option key={person.id || person.name}>{person.name}</option>)}</select></label>
            <label className="stacked-field"><span>Room <RequiredMark /></span><select aria-label="Room, required" value={form.room} onChange={(event) => update("room", event.target.value)}><option value="">Select a room</option>{availableRooms.map((room) => <option key={room}>{room}</option>)}</select></label>
          </div>{form.staff && form.room && <><div className="availability-note"><Check size={16} /> Available times account for doctor, room, lunch, and existing appointments.</div><div className="appointment-slot-picker" aria-label="Available appointment times">{availableSlots.slice(0, 20).map((slot) => <button className={form.time === slot ? "selected" : ""} type="button" key={slot} onClick={() => update("time", slot)}>{formatScheduleTime(parseTimeToMinutes(slot))}</button>)}{!availableSlots.length && <span>No conflict-free slots for these resources.</span>}</div></>}</div></section>
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

function EntityModal({ config, onClose }) {
  const [form, setForm] = useState(config.initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const optionalFieldTypes = ["checkbox", "textarea", "photo"];
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

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal-card" onSubmit={submit}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close form"><X size={18} /></button>
        <ModalHeader icon={Edit3} title={config.title} action="Record details" />
        {error && <div className="inline-state error"><AlertCircle size={17} /> {error}</div>}
        <div className="form-grid">
          {config.fields.map((item) => {
            const optionalFieldTypes = ["checkbox", "textarea", "photo"];
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
                    return next;
                  })
                }
              />
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>
            <Check size={17} /> {saving ? "Saving..." : config.submitLabel}
          </button>
        </div>
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
          <ClientAvatar client={{ fullName: form.fullName || form.name || "Profile", photo: value }} size="large" />
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

  return (
    <label className={wrapperClass} htmlFor={fieldId}>
      <FieldLabel required={required}>{item.label}</FieldLabel>
      {item.type === "textarea" ? (
        <textarea id={fieldId} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} />
      ) : item.type === "select" ? (
        <select id={fieldId} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required}>
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

function ConfirmDialog({ confirm, onCancel }) {
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
              onCancel();
            }}
          >
            {confirm.actionLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartTable({ rows, columns, globalSearch = "", pageSize = 6, emptyTitle = "No records found", toolbarActions = null, showSearch = true }) {
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
      <div className="table-toolbar">
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
        <button className="secondary-button small" type="button" onClick={() => downloadCsv("mace-export.csv", filtered, columns)} disabled={!filtered.length}>
          <Download size={16} aria-hidden="true" /> CSV
        </button>
      </div>
      <div className="table-status-row" aria-live="polite">
        <span>{visibleStart}-{visibleEnd} of {filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        {selectedKeys.size > 0 && (
          <div className="bulk-actions">
            <strong>{selectedKeys.size} selected</strong>
            <button className="secondary-button small" type="button" onClick={() => downloadCsv("mace-selected-export.csv", selectedRows, columns)}>
              <Download size={15} aria-hidden="true" /> Export selected
            </button>
            <button className="ghost-button small" type="button" onClick={() => setSelectedKeys(new Set())}>Clear</button>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="select-column" scope="col">
                <input
                  type="checkbox"
                  aria-label={allVisibleSelected ? "Clear visible row selection" : "Select visible rows"}
                  checked={allVisibleSelected}
                  onChange={toggleVisibleRows}
                />
              </th>
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
                <td className="select-column" data-label="Select">
                  <input
                    type="checkbox"
                    aria-label={`Select row ${visibleStart + index}`}
                    checked={selectedKeys.has(rowKey(row, (page - 1) * pageSize + index))}
                    onChange={() => toggleRow(row, (page - 1) * pageSize + index)}
                  />
                </td>
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
        <span>Page {page} of {pageCount}</span>
        <div>
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
            <ChevronLeft size={15} aria-hidden="true" /> Previous
          </button>
          <strong>{page} / {pageCount}</strong>
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
  transactions.forEach((transaction) => {
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

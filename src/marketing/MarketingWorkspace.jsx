import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Columns2,
  Code2,
  Copy,
  Download,
  Eye,
  FileCode2,
  GripVertical,
  Image as ImageIcon,
  LayoutDashboard,
  Link,
  Mail,
  Menu,
  MessageSquareText,
  Minus,
  Monitor,
  MousePointerClick,
  MoveDown,
  MoveUp,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  UserCheck,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { marketingPath, marketingRouteFromHash, marketingRouteFromPath } from "./routes.js";
import {
  buildVisualEmailHtml,
  emailHtmlToPlainText,
  importedEmailHtmlToBlocks,
  MAX_EMAIL_HTML_LENGTH,
  previewPersonalizedHtml,
  sanitizeEmailFragment,
  sanitizeImportedEmailHtml,
  sanitizeRichEmailText,
} from "./emailHtml.js";
import {
  emailColumnId,
  findEmailBlock,
  findEmailBlockLocation,
  flattenEmailBlocks,
  insertEmailBlock,
  moveEmailBlock,
  removeEmailBlock,
  ROOT_EMAIL_CONTAINER,
  updateEmailBlock,
} from "./emailDesigner.js";
import {
  MarketingMediaPage,
  MarketingMediaPicker,
  readMarketingImageFile,
} from "./MarketingMediaLibrary.jsx";
import {
  cloneEmailBlockWithIds,
  createEmailBlock,
  defaultEmailTheme,
  normalizeEmailBlock,
  validMarketingUrl,
  visibleOn,
} from "./builderModel.js";
import { socialIconDefinition } from "./socialIcons.js";
import {
  addMarketingAudienceMember,
  deleteMarketingEmailTemplate,
  importMarketingAudienceMembers,
  loadMarketingAudienceMembers,
  loadMarketingEmailTemplates,
  saveMarketingEmailTemplate,
  sendMarketingTestEmail,
} from "../lib/api.js";
import { downloadAudienceCsv, parseAudienceCsv, validAudienceEmail } from "./audienceCsv.js";
import GlobalModuleSearch from "../components/GlobalModuleSearch.jsx";

const draftStorageKey = "mace-marketing-campaign-draft-v1";
const templateStorageKey = "mace-marketing-design-templates-v1";
const sidebarStorageKey = "mace-marketing-sidebar-collapsed-v1";

const workspaceNavigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "templates", label: "Templates", icon: BookOpen },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const campaignSteps = ["Audience", "Design", "Review", "Schedule"];

const blockDefinitions = [
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "heading", label: "Heading", icon: Columns2 },
  { type: "text", label: "Paragraph", icon: AlignLeft },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveDown },
  { type: "video", label: "Video", icon: Monitor },
  { type: "social", label: "Social", icon: Users },
  { type: "logo", label: "Logo", icon: PanelLeft },
  { type: "survey", label: "Survey", icon: Check },
  { type: "code", label: "Code", icon: Code2 },
  { type: "apps", label: "Apps", icon: LayoutDashboard },
  { type: "product", label: "Product", icon: BookOpen },
  { type: "productRecommendation", label: "Product Rec", icon: Sparkles },
  { type: "footer", label: "Footer", icon: Mail },
];

const layoutDefinitions = [
  { type: "layout-1", label: "1", widths: [1] },
  { type: "layout-2", label: "2", widths: [1, 1] },
  { type: "layout-3", label: "3", widths: [1, 1, 1] },
  { type: "layout-4", label: "4", widths: [1, 1, 1, 1] },
  { type: "layout-1-2", label: "1:2", widths: [1, 2] },
  { type: "layout-2-1", label: "2:1", widths: [2, 1] },
  { type: "layout-1-3", label: "1:3", widths: [1, 3] },
  { type: "layout-3-1", label: "3:1", widths: [3, 1] },
];

const sectionDefinitions = [
  { type: "header", label: "Header", preset: "Header banner", description: "Logo and an optional opening link", icon: PanelLeft },
  { type: "hero", label: "Hero", preset: "Hero center", description: "Image, headline, copy and a primary action", icon: ImageIcon },
  { type: "promotion", label: "Promo", preset: "Promo banner", description: "A focused offer with one clear action", icon: BellRing },
  { type: "features", label: "Features", preset: "Feature cards", description: "Three compact treatment or benefit cards", icon: Sparkles },
  { type: "article", label: "Editorial", preset: "Editorial text", description: "Educational content with a read-more action", icon: BookOpen },
  { type: "products", label: "Products", preset: "Product 2-grid", description: "A responsive two-product showcase", icon: LayoutDashboard },
  { type: "reviews", label: "Reviews", preset: "Review cards", description: "Two client experience highlights", icon: MessageSquareText },
  { type: "gallery", label: "Image gallery", preset: "Gallery grid", description: "A responsive treatment image gallery", icon: ImageIcon },
  { type: "footer", label: "Footer", preset: "Footer 2-col", description: "Clinic details, social links and unsubscribe copy", icon: Mail },
];

const aiSectionDefinitions = [
  { type: "article", label: "Article summary", icon: BookOpen },
  { type: "event", label: "Upcoming event", icon: CalendarClock },
  { type: "promotion", label: "Product or service promotion", icon: BellRing },
  { type: "people", label: "People update", icon: Users },
];

const starterTemplateDefinitions = [
  { id: "monthly-newsletter", name: "Monthly newsletter", category: "Newsletter", description: "Clinic news, featured treatments and helpful care guidance." },
  { id: "treatment-promotion", name: "Treatment promotion", category: "Promotion", description: "A focused treatment story with a single booking action." },
  { id: "new-treatment", name: "New treatment announcement", category: "Announcement", description: "Introduce a new service with benefits and availability." },
  { id: "birthday-offer", name: "Birthday offer", category: "Lifecycle", description: "A warm birthday-month message with an optional offer." },
  { id: "rebooking-reminder", name: "Client rebooking reminder", category: "Retention", description: "Encourage an appropriate next visit without clinical details." },
  { id: "inactive-client", name: "Inactive client campaign", category: "Retention", description: "Reconnect with clients who have not visited recently." },
  { id: "seasonal-skincare", name: "Seasonal skincare campaign", category: "Seasonal", description: "Timely skincare education and a clear consultation action." },
  { id: "clinic-event", name: "Event or clinic announcement", category: "Announcement", description: "Share event details, clinic news or location updates." },
  { id: "aftercare", name: "Aftercare information", category: "Care", description: "General care guidance kept separate from private treatment records." },
  { id: "consultation", name: "Consultation invitation", category: "Lead nurture", description: "Invite interested clients to book a consultation." },
];

const audienceDefinitions = [
  {
    id: "All consented clients",
    name: "All consented clients",
    description: "Clients with a valid contact and consent for the selected channel.",
    matches: () => true,
  },
  {
    id: "Due for next session",
    name: "Due for next session",
    description: "Clients whose recommended next visit is overdue or due within seven days.",
    matches: (client) => {
      const dueInDays = daysUntil(client.nextVisit);
      return dueInDays !== null && dueInDays <= 7;
    },
  },
  {
    id: "Active clients",
    name: "Active clients",
    description: "Clients who visited within the last 90 days and are not marked inactive.",
    matches: (client) => {
      const lastVisitAge = daysSince(client.lastVisit);
      return !client.retention?.toLowerCase().includes("inactive") && lastVisitAge >= 0 && lastVisitAge < 90;
    },
  },
  {
    id: "Inactive clients",
    name: "Inactive 90+ days",
    description: "Clients whose last appointment was at least 90 days ago.",
    matches: (client) => client.retention?.toLowerCase().includes("inactive") || daysSince(client.lastVisit) >= 90,
  },
  {
    id: "Inactive 60 days",
    name: "Inactive 60+ days",
    description: "Clients whose last appointment was at least 60 days ago.",
    matches: (client) => daysSince(client.lastVisit) >= 60,
  },
  {
    id: "Inactive 30 days",
    name: "Inactive 30+ days",
    description: "Clients whose last appointment was at least 30 days ago.",
    matches: (client) => daysSince(client.lastVisit) >= 30,
  },
  {
    id: "Birthday month",
    name: "Birthday month",
    description: "Clients celebrating a birthday in the current month.",
    matches: (client) => monthOf(client.birthday) === new Date().getMonth(),
  },
  {
    id: "New clients",
    name: "New clients",
    description: "New and first-time clients ready for a welcome campaign.",
    matches: (client) => client.retention?.toLowerCase().includes("new") || client.tag?.toLowerCase().includes("new"),
  },
  {
    id: "Returning clients",
    name: "Returning clients",
    description: "Established clients who have returned to the clinic.",
    matches: (client) => client.retention?.toLowerCase().includes("return") || client.tag?.toLowerCase().includes("return"),
  },
  {
    id: "VIP",
    name: "VIP clients",
    description: "Clients currently tagged as VIP.",
    matches: (client) => client.tag?.toLowerCase().includes("vip"),
  },
];

const automationDefinitions = [
  { name: "Birthday care message", segment: "Birthday month", timing: "On the first day of the birthday month", channel: "Email + SMS" },
  { name: "Next-session reminder", segment: "Due for next session", timing: "When the recommended service interval is due", channel: "Email + SMS" },
  { name: "Rebooking reminder", segment: "Inactive 30 days", timing: "30 days after the last appointment", channel: "Email" },
  { name: "Inactive-client campaign", segment: "Inactive clients", timing: "90 days after the last appointment", channel: "Email + SMS" },
  { name: "Post-appointment follow-up", segment: "Returning clients", timing: "Two days after a completed appointment", channel: "Email" },
];

function safeJsonRead(key, fallback) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeJsonWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function createBlockId(type) {
  return `${type}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

function newBlock(type) {
  return createEmailBlock(type, createBlockId, layoutDefinitions);
}

function newSection(type) {
  const section = newBlock(type === "products" || type === "reviews" || type === "gallery" ? "layout-2" : type === "features" ? "layout-3" : type === "footer" ? "layout-2-1" : "layout-1");
  const withPatch = (blockType, patch) => ({ ...newBlock(blockType), ...patch });
  const presets = {
    header: [[withPatch("logo", { padding: 12 }), withPatch("text", { content: "Signature wellness, thoughtfully delivered.", fontSize: 12, padding: 6 })]],
    hero: [[newBlock("logo"), newBlock("image"), newBlock("heading"), newBlock("text"), newBlock("button")]],
    promotion: [[withPatch("offer", { content: "A considered seasonal offer\nReserve your preferred consultation time this month." }), withPatch("button", { content: "View the offer" })]],
    features: [
      [withPatch("heading", { content: "Refresh", fontSize: 20 }), withPatch("text", { content: "Thoughtful care for brighter-looking skin.", fontSize: 13 })],
      [withPatch("heading", { content: "Restore", fontSize: 20 }), withPatch("text", { content: "Personalised options selected around your goals.", fontSize: 13 })],
      [withPatch("heading", { content: "Reveal", fontSize: 20 }), withPatch("text", { content: "A calm, clinician-led experience from start to finish.", fontSize: 13 })],
    ],
    article: [[withPatch("heading", { content: "A guide to your seasonal skin reset", fontSize: 28 }), withPatch("text", { content: "Discover practical, clinician-led ways to refresh your routine while keeping your individual needs in focus." }), withPatch("button", { content: "Read the guide" })]],
    products: [
      [withPatch("product", { title: "Hydrodermabrasion", description: "Deep cleansing and hydration for smoother-looking skin.", alt: "Hydrodermabrasion treatment" })],
      [withPatch("product", { title: "Pico-Rejuvenation", description: "Support clarity, tone and texture with minimal downtime.", src: "/brand/result-2.jpg", alt: "Pico-Rejuvenation treatment" })],
    ],
    reviews: [
      [withPatch("text", { content: "“The whole experience felt calm, considered and completely personal.”\n— MACE client", fontFamily: "Georgia", fontSize: 17 })],
      [withPatch("text", { content: "“I understood every option and never felt rushed.”\n— MACE client", fontFamily: "Georgia", fontSize: 17 })],
    ],
    gallery: [
      [withPatch("image", { src: "/brand/result-1.jpg", alt: "MACE treatment result" })],
      [withPatch("image", { src: "/brand/result-2.jpg", alt: "MACE skincare consultation" })],
    ],
    footer: [
      [withPatch("footer", { align: "left", padding: 10, columnLayout: "single" })],
      [withPatch("social", { align: "left", padding: 10 })],
    ],
    event: [[withPatch("heading", { content: "You’re invited to MACE", fontSize: 28 }), withPatch("text", { content: "Join us for an evening of personalised skin education and one-to-one consultation guidance." }), withPatch("button", { content: "Reserve a place" })]],
    people: [[withPatch("image", { alt: "MACE clinic team member" }), withPatch("heading", { content: "Meet your MACE care team", fontSize: 28 }), withPatch("text", { content: "Get to know the clinicians behind your considered, personalised treatment plan." }), withPatch("button", { content: "Meet the team" })]],
  };
  section.columns = presets[type] || presets.hero;
  return section;
}

function cloneEmailBlock(block) {
  return cloneEmailBlockWithIds(block, createBlockId);
}

function normalizedDesignBlock(block) {
  return normalizeEmailBlock(block, createBlockId, layoutDefinitions);
}

function createDefaultBlocks() {
  return ["logo", "image", "heading", "text", "treatment", "button", "divider", "contact"].map(newBlock);
}

function templateBlock(type, patch = {}) {
  return { ...newBlock(type), ...patch };
}

function templateLayout(type, columns, patch = {}) {
  return { ...newBlock(type), ...patch, columns };
}

function templateFooter(patch = {}) {
  return templateBlock("footer", { padding: 20, ...patch });
}

function templateTheme(patch = {}) {
  return { ...defaultEmailTheme, ...patch };
}

function createStarterTemplateDesign(id) {
  const logo = (patch = {}) => templateBlock("logo", { padding: 14, width: 120, mobileWidth: 108, ...patch });
  const button = (content, patch = {}) => templateBlock("button", { content, ...patch });
  const heading = (content, patch = {}) => templateBlock("heading", { content, ...patch });
  const text = (content, patch = {}) => templateBlock("text", { content, ...patch });
  const image = (src, alt, patch = {}) => templateBlock("image", { src, alt, ...patch });
  const finish = ({ blocks, preview, previewText, subject, theme }) => ({
    preview,
    previewText,
    subject,
    design: { editorMode: "visual", blocks, theme },
  });

  const designs = {
    "monthly-newsletter": () => finish({
      subject: "The MACE Edit: this month at the clinic",
      previewText: "Clinic notes, featured care and considered advice for the month ahead.",
      preview: { layout: "newsletter", kicker: "THE MACE EDIT", title: "Monthly notes", image: "/brand/clinic-davao.jpg", accent: "#795743", surface: "#eee5db" },
      theme: templateTheme({ canvasBackground: "#eee8e1", headingColor: "#35261e", buttonBackground: "#6d4935", contentWidth: 680 }),
      blocks: [
        logo({ align: "left", padding: 18 }),
        heading("The MACE Edit", { align: "left", fontSize: 38, padding: 20 }),
        text("A considered monthly note with clinic news, thoughtful skincare guidance and services worth discovering.", { align: "left", fontSize: 16, padding: 20 }),
        templateBlock("divider", { padding: 4, spacingTop: 8, spacingBottom: 8 }),
        templateLayout("layout-2", [
          [image("/brand/clinic-davao.jpg", "MACE Davao clinic", { borderRadius: 8, padding: 8 })],
          [heading("Inside this issue", { level: "h2", align: "left", fontSize: 25, padding: 10 }), text("A clinic update, one featured treatment and simple ways to care for your skin between visits.", { align: "left", padding: 10 }), button("Read this month’s edit", { align: "left", padding: 10 })],
        ], { gap: 18, padding: 18, background: "#f6f1eb", borderRadius: 10 }),
        heading("Featured this month", { level: "h2", align: "left", fontSize: 26, padding: 20 }),
        templateLayout("layout-2", [
          [templateBlock("product", { title: "Hydrodermabrasion", description: "Deep cleansing and hydration for smoother-looking skin.", src: "/brand/result-1.jpg" })],
          [templateBlock("product", { title: "Pico-Rejuvenation", description: "Support clarity, tone and texture with minimal downtime.", src: "/brand/result-2.jpg" })],
        ], { gap: 14, padding: 12 }),
        templateFooter(),
      ],
    }),
    "treatment-promotion": () => finish({
      subject: "A focused treatment offer from MACE",
      previewText: "Discover a considered treatment option and reserve your preferred consultation time.",
      preview: { layout: "promotion", kicker: "LIMITED APPOINTMENTS", title: "Treatment focus", image: "/brand/result-1.jpg", accent: "#5b3826", surface: "#ead8ce" },
      theme: templateTheme({ canvasBackground: "#eadfd7", headingColor: "#382319", buttonBackground: "#4d2b1c", sectionPadding: 12 }),
      blocks: [
        logo({ padding: 16 }),
        image("/brand/result-1.jpg", "MACE signature facial treatment", { padding: 0, borderRadius: 0 }),
        text("THIS MONTH AT MACE", { fontSize: 11, fontWeight: 700, letterSpacing: 2, padding: 14, color: "#9a684f" }),
        heading("Refresh your skin with a considered treatment plan", { fontSize: 36, padding: 14 }),
        text("Begin with a consultation and explore an option selected around your goals, comfort and schedule.", { fontSize: 16, padding: 14 }),
        templateBlock("offer", { content: "Treatment focus\nLimited consultation appointments are available this month.", background: "#f1e2d9", color: "#4a2f22", padding: 20 }),
        button("Reserve a consultation", { padding: 18, horizontalPadding: 34 }),
        templateFooter(),
      ],
    }),
    "new-treatment": () => finish({
      subject: "Introducing a new treatment at MACE",
      previewText: "Meet the newest addition to our considered treatment menu.",
      preview: { layout: "announcement", kicker: "NOW AVAILABLE", title: "Meet something new", image: "/brand/result-2.jpg", accent: "#416557", surface: "#e2ebe6" },
      theme: templateTheme({ canvasBackground: "#e7eee9", headingColor: "#263d34", textColor: "#3f554c", buttonBackground: "#365b4d", linkColor: "#365b4d", contentWidth: 680 }),
      blocks: [
        logo({ align: "left", padding: 18 }),
        templateLayout("layout-1-2", [
          [text("NEW AT MACE", { align: "left", fontSize: 11, letterSpacing: 2, color: "#557c6d", padding: 10 }), heading("A new way to support brighter-looking skin", { align: "left", fontSize: 34, padding: 10 }), text("Discover our newest clinician-led treatment and whether it may suit your individual goals.", { align: "left", padding: 10 }), button("Explore the treatment", { align: "left", padding: 10 })],
          [image("/brand/result-2.jpg", "Client receiving personalised MACE care", { borderRadius: 10, padding: 6 })],
        ], { columnWidths: [2, 3], gap: 20, padding: 20, background: "#edf3ef", borderRadius: 12 }),
        heading("Designed around you", { level: "h2", fontSize: 27, padding: 18 }),
        templateLayout("layout-3", [
          [heading("Considered", { level: "h3", fontSize: 18, padding: 8 }), text("A consultation-led plan.", { fontSize: 13, padding: 8 })],
          [heading("Personal", { level: "h3", fontSize: 18, padding: 8 }), text("Options shaped around your goals.", { fontSize: 13, padding: 8 })],
          [heading("Supported", { level: "h3", fontSize: 18, padding: 8 }), text("Clear guidance before and after.", { fontSize: 13, padding: 8 })],
        ], { gap: 10, padding: 12, background: "#f7faf8" }),
        templateFooter(),
      ],
    }),
    "birthday-offer": () => finish({
      subject: "A birthday-month treat, just for you",
      previewText: "Celebrate your month with a thoughtful MACE invitation.",
      preview: { layout: "birthday", kicker: "JUST FOR YOU", title: "Birthday glow", badge: "BIRTHDAY", accent: "#a75d70", surface: "#f3dfe3" },
      theme: templateTheme({ canvasBackground: "#f5e8e7", headingColor: "#663744", textColor: "#684b53", buttonBackground: "#8f4d60", linkColor: "#8f4d60" }),
      blocks: [
        logo({ padding: 18 }),
        text("A LITTLE NOTE FOR YOUR BIRTHDAY MONTH", { fontSize: 11, letterSpacing: 2, color: "#a15d70", padding: 12 }),
        heading("Happy birthday, {{first_name}}", { fontSize: 39, color: "#6d3948", padding: 14 }),
        text("We hope the year ahead brings confidence, calm and plenty of reasons to celebrate.", { fontSize: 16, padding: 14 }),
        templateLayout("layout-1-2", [
          [image("/brand/products/post-care-cream.png", "MACE post-care cream", { background: "#f8edef", borderRadius: 999, padding: 14, aspectRatio: "original" })],
          [heading("A little something for you", { level: "h2", align: "left", fontSize: 25, padding: 10 }), text("Enjoy a birthday-month consultation invitation and ask our team about the offer available to you.", { align: "left", padding: 10 }), button("View your birthday invitation", { align: "left", padding: 10, background: "#8f4d60", borderColor: "#8f4d60" })],
        ], { columnWidths: [1, 2], gap: 18, padding: 20, background: "#f3dfe3", borderRadius: 14 }),
        templateBlock("social", { iconColor: "#8f4d60", padding: 18 }),
        templateFooter({ background: "#fff9f8" }),
      ],
    }),
    "rebooking-reminder": () => finish({
      subject: "A gentle reminder when you’re ready to return",
      previewText: "Choose a convenient time for your next MACE visit.",
      preview: { layout: "reminder", kicker: "A GENTLE REMINDER", title: "Time for your next visit?", badge: "30", accent: "#755747", surface: "#eee9e4" },
      theme: templateTheme({ canvasBackground: "#efebe7", headingColor: "#3e3028", textColor: "#5a5049", buttonBackground: "#654637", contentWidth: 620 }),
      blocks: [
        logo({ align: "left", padding: 20 }),
        templateBlock("divider", { padding: 0, spacingTop: 6, spacingBottom: 6 }),
        text("A GENTLE REMINDER", { align: "left", fontSize: 11, letterSpacing: 2, color: "#8b6b59", padding: 18 }),
        heading("Ready for your next visit?", { align: "left", fontSize: 36, padding: 18 }),
        text("Hello {{first_name}}, when the time feels right, our team can help you plan your next appointment.", { align: "left", fontSize: 16, padding: 18 }),
        templateBlock("offer", { content: "Your next step\nChoose a convenient appointment time or speak with the clinic first.", background: "#f4f0ec", padding: 20, align: "left" }),
        templateLayout("layout-2", [
          [heading("Choose a time", { level: "h3", align: "left", fontSize: 19, padding: 8 }), text("View available consultation times online.", { align: "left", fontSize: 13, padding: 8 })],
          [heading("Questions first?", { level: "h3", align: "left", fontSize: 19, padding: 8 }), text("Reply or contact the clinic before booking.", { align: "left", fontSize: 13, padding: 8 })],
        ], { gap: 12, padding: 14, background: "#faf8f5" }),
        button("Book your next visit", { align: "left", padding: 20 }),
        templateFooter({ align: "left" }),
      ],
    }),
    "inactive-client": () => finish({
      subject: "We’d love to welcome you back to MACE",
      previewText: "Reconnect with considered care whenever you feel ready.",
      preview: { layout: "inactive", kicker: "WELCOME BACK", title: "It’s been a while", image: "/brand/clinic.jpg", accent: "#6c5142", surface: "#ded7d1" },
      theme: templateTheme({ canvasBackground: "#e7e1dc", headingColor: "#352820", buttonBackground: "#5b4031", contentWidth: 680 }),
      blocks: [
        image("/brand/clinic.jpg", "The welcoming MACE clinic interior", { padding: 0, maxWidth: 680 }),
        logo({ padding: 18 }),
        text("WELCOME BACK", { fontSize: 11, letterSpacing: 2, color: "#8d6d5c", padding: 10 }),
        heading("It’s been a while, {{first_name}}", { fontSize: 37, padding: 14 }),
        text("There is no pressure and no rush—just a warm invitation to reconnect with our team whenever you are ready.", { fontSize: 16, padding: 14 }),
        templateLayout("layout-2", [
          [templateBlock("productRecommendation", { recommendationLabel: "A FRESH START", title: "Skin consultation", description: "Revisit your goals with a calm, personalised consultation.", src: "/brand/result-1.jpg" })],
          [templateBlock("productRecommendation", { recommendationLabel: "DISCOVER AGAIN", title: "Signature care", description: "Explore current services and what may suit you now.", src: "/brand/result-2.jpg" })],
        ], { gap: 14, padding: 14 }),
        button("Reconnect with MACE", { padding: 20 }),
        templateFooter(),
      ],
    }),
    "seasonal-skincare": () => finish({
      subject: "Your seasonal skin guide from MACE",
      previewText: "Three considered ways to adjust your routine for the season ahead.",
      preview: { layout: "seasonal", kicker: "SEASONAL EDIT", title: "Skin in season", image: "/brand/clinic-davao.jpg", accent: "#587266", surface: "#dfe9e3" },
      theme: templateTheme({ canvasBackground: "#e5ece7", headingColor: "#30473d", textColor: "#495f55", buttonBackground: "#49685a", linkColor: "#49685a", contentWidth: 680 }),
      blocks: [
        logo({ align: "left", padding: 18 }),
        text("THE SEASONAL EDIT", { align: "left", fontSize: 11, letterSpacing: 2, color: "#668276", padding: 14 }),
        heading("A calmer approach to seasonal skin", { align: "left", fontSize: 38, padding: 14 }),
        image("/brand/clinic-davao.jpg", "Quiet consultation space at MACE Davao", { borderRadius: 10, padding: 14 }),
        text("As weather, routines and environments change, a few thoughtful adjustments can help keep your skincare feeling consistent.", { align: "left", fontSize: 16, padding: 18 }),
        templateLayout("layout-3", [
          [heading("01", { level: "h3", fontSize: 22, color: "#6b8a7c", padding: 8 }), heading("Simplify", { level: "h3", fontSize: 18, padding: 6 }), text("Keep the essentials steady.", { fontSize: 13, padding: 6 })],
          [heading("02", { level: "h3", fontSize: 22, color: "#6b8a7c", padding: 8 }), heading("Support", { level: "h3", fontSize: 18, padding: 6 }), text("Adjust hydration with care.", { fontSize: 13, padding: 6 })],
          [heading("03", { level: "h3", fontSize: 22, color: "#6b8a7c", padding: 8 }), heading("Review", { level: "h3", fontSize: 18, padding: 6 }), text("Ask when something changes.", { fontSize: 13, padding: 6 })],
        ], { gap: 10, padding: 14, background: "#f2f7f3", borderRadius: 10 }),
        button("Plan a seasonal consultation", { padding: 20 }),
        templateFooter(),
      ],
    }),
    "clinic-event": () => finish({
      subject: "You’re invited: an evening at MACE",
      previewText: "Save the date for clinic news, thoughtful conversation and personalised guidance.",
      preview: { layout: "event", kicker: "SAVE THE DATE", title: "An evening at MACE", badge: "24 AUG", accent: "#d9b89d", surface: "#392820" },
      theme: templateTheme({ canvasBackground: "#ded5cf", headingColor: "#32241d", buttonBackground: "#3d291f", contentWidth: 680 }),
      blocks: [
        templateLayout("layout-1-2", [
          [templateBlock("offer", { content: "24 AUG\n6:00 PM\nMACE Davao", background: "#d6b79d", color: "#322219", fontSize: 16, padding: 22 })],
          [text("SAVE THE DATE", { align: "left", fontSize: 11, letterSpacing: 2, color: "#d8b89f", padding: 8 }), heading("An evening at MACE", { align: "left", fontSize: 37, color: "#ffffff", padding: 8 }), text("Join us for clinic news, thoughtful conversation and personalised skincare guidance.", { align: "left", color: "#eadfd7", padding: 8 }), button("Reserve your place", { align: "left", padding: 8, background: "#d6b79d", borderColor: "#d6b79d", textColor: "#342219" })],
        ], { columnWidths: [1, 2], gap: 22, padding: 26, background: "#392820", borderRadius: 12 }),
        image("/brand/clinic.jpg", "MACE clinic event setting", { padding: 14, borderRadius: 10 }),
        heading("What to expect", { level: "h2", fontSize: 26, padding: 16 }),
        templateLayout("layout-3", [
          [text("Clinic updates", { fontSize: 14, padding: 10 })],
          [text("Skin education", { fontSize: 14, padding: 10 })],
          [text("One-to-one guidance", { fontSize: 14, padding: 10 })],
        ], { gap: 8, padding: 12, background: "#f6f1ed" }),
        templateBlock("social", { padding: 18 }),
        templateFooter(),
      ],
    }),
    aftercare: () => finish({
      subject: "Your general MACE aftercare guide",
      previewText: "Simple general reminders to support comfort after your visit.",
      preview: { layout: "aftercare", kicker: "CARE GUIDE", title: "After your visit", badge: "✓", accent: "#607970", surface: "#e6ece9" },
      theme: templateTheme({ canvasBackground: "#e9eeeb", headingColor: "#30443d", textColor: "#4d5f58", buttonBackground: "#506c62", linkColor: "#506c62", contentWidth: 640 }),
      blocks: [
        logo({ align: "left", padding: 20 }),
        text("YOUR GENERAL CARE GUIDE", { align: "left", fontSize: 11, letterSpacing: 2, color: "#6c857c", padding: 16 }),
        heading("A few reminders after your visit", { align: "left", fontSize: 36, padding: 16 }),
        text("These are general comfort reminders only. Always follow the personalised guidance provided by your clinician.", { align: "left", fontSize: 15, padding: 16, background: "#eff4f1" }),
        templateLayout("layout-2", [
          [heading("First 24 hours", { level: "h2", align: "left", fontSize: 22, padding: 10 }), text("Keep your routine gentle, avoid unnecessary heat and use only products discussed with your clinician.", { align: "left", fontSize: 14, padding: 10 })],
          [heading("Keep in mind", { level: "h2", align: "left", fontSize: 22, padding: 10 }), text("Comfort and recovery vary. Contact the clinic if you are unsure about anything you notice.", { align: "left", fontSize: 14, padding: 10 })],
        ], { gap: 14, padding: 16, background: "#f5f8f6", borderWidth: 1, borderColor: "#d1dfd8", borderRadius: 10 }),
        templateBlock("divider", { padding: 6 }),
        heading("When to contact us", { level: "h2", align: "left", fontSize: 24, padding: 14 }),
        text("If you have a concern, contact the clinic directly rather than relying on this general email.", { align: "left", padding: 14 }),
        button("Contact the clinic", { align: "left", padding: 16 }),
        templateFooter({ align: "left" }),
      ],
    }),
    consultation: () => finish({
      subject: "Begin with a personalised MACE consultation",
      previewText: "Meet the team, discuss your goals and understand the options available to you.",
      preview: { layout: "consultation", kicker: "YOUR FIRST STEP", title: "Let’s begin with you", image: "/brand/dr-mace.jpg", accent: "#7c523d", surface: "#eee2d9" },
      theme: templateTheme({ canvasBackground: "#eee6df", headingColor: "#39271e", textColor: "#59483e", buttonBackground: "#684531", contentWidth: 700 }),
      blocks: [
        templateLayout("layout-1-2", [
          [image("/brand/dr-mace.jpg", "Dr. Mace at the clinic", { padding: 0, borderRadius: 10, aspectRatio: "4:3" })],
          [logo({ align: "left", padding: 10 }), text("YOUR FIRST STEP", { align: "left", fontSize: 11, letterSpacing: 2, color: "#8d634d", padding: 10 }), heading("Let’s begin with you", { align: "left", fontSize: 38, padding: 10 }), text("A consultation is time to discuss your goals, ask questions and understand the options available to you.", { align: "left", padding: 10 }), button("Book a consultation", { align: "left", padding: 10 })],
        ], { columnWidths: [1, 2], gap: 20, padding: 20, background: "#f5eee8", borderRadius: 12, verticalAlign: "middle" }),
        heading("What happens next", { level: "h2", fontSize: 27, padding: 18 }),
        templateLayout("layout-3", [
          [heading("1", { level: "h3", fontSize: 23, color: "#9b7059", padding: 8 }), heading("Share", { level: "h3", fontSize: 18, padding: 6 }), text("Tell us what matters to you.", { fontSize: 13, padding: 6 })],
          [heading("2", { level: "h3", fontSize: 23, color: "#9b7059", padding: 8 }), heading("Explore", { level: "h3", fontSize: 18, padding: 6 }), text("Review considered options.", { fontSize: 13, padding: 6 })],
          [heading("3", { level: "h3", fontSize: 23, color: "#9b7059", padding: 8 }), heading("Decide", { level: "h3", fontSize: 18, padding: 6 }), text("Move forward at your pace.", { fontSize: 13, padding: 6 })],
        ], { gap: 10, padding: 14 }),
        templateBlock("social", { padding: 18 }),
        templateFooter(),
      ],
    }),
  };

  return (designs[id] || designs["monthly-newsletter"])();
}

const starterTemplates = starterTemplateDefinitions.map((template) => ({
  ...template,
  ...createStarterTemplateDesign(template.id),
}));

function createDefaultDraft() {
  return {
    id: "",
    branch: "",
    name: "Summer Skin Reset",
    channel: "Email",
    segment: "Inactive clients",
    subject: "A thoughtful reset for your summer skin",
    previewText: "Simple, personalised care from MACE Signature Wellness.",
    message: "",
    status: "Draft",
    scheduledAt: "",
    managerApproval: true,
    editorMode: "visual",
    html: "",
    htmlIsCustom: false,
    blocks: createDefaultBlocks(),
    theme: { ...defaultEmailTheme },
    step: 2,
    updatedAt: new Date().toISOString(),
  };
}

function normalizedDraft(value) {
  const fallback = createDefaultDraft();
  if (!value || typeof value !== "object") return fallback;
  const savedBlocks = Array.isArray(value.blocks) ? value.blocks.map(normalizedDesignBlock).filter(Boolean) : [];
  return {
    ...fallback,
    ...value,
    editorMode: value.editorMode === "html" ? "html" : "visual",
    html: typeof value.html === "string" ? value.html : "",
    htmlIsCustom: value.htmlIsCustom === true,
    blocks: savedBlocks.length ? savedBlocks : fallback.blocks,
    theme: { ...defaultEmailTheme, ...(value.theme && typeof value.theme === "object" ? value.theme : {}) },
    scheduledAt: localDateTimeInput(value.scheduledAt || ""),
    step: Math.min(4, Math.max(1, Number(value.step) || 1)),
  };
}

function localDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60_000)).toISOString().slice(0, 16);
}

function daysSince(value) {
  if (!value) return -1;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return -1;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function daysUntil(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
}

function monthOf(value) {
  if (!value) return -1;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? -1 : date.getMonth();
}

function channelEligible(client, channel) {
  const generalConsent = client.marketingOptIn === true;
  const emailConsent = client.emailMarketingConsent ?? generalConsent;
  const smsConsent = client.smsMarketingConsent ?? generalConsent;
  if (channel === "Email") return Boolean(client.email && emailConsent);
  if (channel === "SMS") return Boolean(client.mobile && smsConsent);
  return Boolean((client.email && emailConsent) || (client.mobile && smsConsent));
}

function audienceRecipients(clients, members, segment, channel, branch = "") {
  const definition = audienceDefinitions.find((item) => item.id === segment) ?? audienceDefinitions[0];
  const matchesBranch = (contact) => !branch || branch === "All branches" || contact.branch === branch;
  const clientRecipients = clients.filter((client) => matchesBranch(client) && definition.matches(client) && channelEligible(client, channel));
  const memberRecipients = channel === "SMS" ? [] : members
    .filter((member) => matchesBranch(member) && (segment === audienceDefinitions[0].id || member.audience === segment))
    .map((member) => ({ ...member, fullName: member.name || "Email contact", marketingOptIn: true, audienceMember: true }));
  const seen = new Set();
  return [...clientRecipients, ...memberRecipients]
    .filter((contact) => {
      const emailKey = String(contact.email || "").trim().toLowerCase();
      const mobileKey = String(contact.mobile || "").replace(/\D/g, "");
      const key = channel === "SMS" ? mobileKey : channel === "Email" ? emailKey : emailKey || (mobileKey ? `mobile:${mobileKey}` : "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => String(left.fullName || left.name || left.email || left.mobile || "").localeCompare(String(right.fullName || right.name || right.email || right.mobile || "")));
}

function campaignDate(campaign) {
  const value = campaign.scheduledAt || campaign.sentAt || campaign.updatedAt || campaign.createdAt;
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

function navigateToMarketing(section, mode = "index", replace = false) {
  const nextUrl = marketingPath(section, mode);
  if (replace) window.history.replaceState(null, "", nextUrl);
  else window.history.pushState(null, "", nextUrl);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function routeFromLocation() {
  return marketingRouteFromPath(window.location.pathname)
    ?? marketingRouteFromHash(window.location.hash)
    ?? { section: "overview", mode: "index" };
}

function campaignWarnings(draft) {
  const warnings = [];
  if (!draft.name.trim()) warnings.push("Add a campaign name.");
  if (!draft.segment) warnings.push("Choose an audience.");
  if (draft.channel !== "SMS") {
    if (!draft.subject.trim()) warnings.push("Add an email subject.");
    if (!draft.previewText.trim()) warnings.push("Add email preview text.");
    if (draft.editorMode === "html") {
      const htmlResult = sanitizeImportedEmailHtml(draft.html);
      if (htmlResult.error) warnings.push(htmlResult.error);
      if (htmlResult.removed) warnings.push("Clean the HTML to remove unsupported or unsafe code before review.");
      if (htmlResult.html && !/unsubscribe/i.test(htmlResult.html)) warnings.push("Add a visible unsubscribe link or instruction to the HTML.");
    } else {
      const contentBlocks = flattenEmailBlocks(draft.blocks);
      if (contentBlocks.some((block) => ["heading", "text", "button", "offer", "treatment"].includes(block.type) && !String(block.content || "").replace(/<[^>]*>/g, "").trim())) warnings.push("Complete or remove empty text blocks.");
      if (contentBlocks.some((block) => block.type === "button" && (!String(block.content || "").trim() || !validMarketingUrl(block.link)))) warnings.push("Every button needs a label and valid destination.");
      if (contentBlocks.some((block) => ["image", "logo", "video", "product", "productRecommendation"].includes(block.type) && !block.hideImage && !String(block.src || "").trim())) warnings.push("Choose an image or hide each empty image area.");
      if (contentBlocks.some((block) => ["image", "logo", "video", "product", "productRecommendation"].includes(block.type) && block.src && !validMarketingUrl(block.src))) warnings.push("Replace invalid or unsafe image URLs.");
      if (contentBlocks.some((block) => ["image", "logo", "video", "product", "productRecommendation"].includes(block.type) && !block.hideImage && !block.decorative && !String(block.alt || "").trim())) warnings.push("Add alternative text or explicitly mark every image decorative.");
      if (contentBlocks.some((block) => ["product", "productRecommendation"].includes(block.type) && (!String(block.title || "").trim() || (!block.hideDescription && !String(block.description || "").trim()) || (!block.hideCta && (!String(block.ctaLabel || "").trim() || !validMarketingUrl(block.ctaUrl)))))) warnings.push("Complete every visible Product title, description, CTA label, and CTA destination.");
      if (contentBlocks.some((block) => ["product", "productRecommendation"].includes(block.type) && ((block.secondaryCtaLabel && !validMarketingUrl(block.secondaryCtaUrl)) || (!block.secondaryCtaLabel && block.secondaryCtaUrl)))) warnings.push("Complete or remove every secondary Product CTA.");
      if (contentBlocks.some((block) => block.link && !validMarketingUrl(block.link))) warnings.push("Fix invalid or unsafe link destinations.");
      if (contentBlocks.some((block) => block.type === "video" && !validMarketingUrl(block.videoUrl || block.link))) warnings.push("Every Video block needs a supported destination URL.");
      if (contentBlocks.some((block) => block.type === "social" && !(block.items || []).some((item) => validMarketingUrl(item.url)))) warnings.push("Add at least one valid profile URL to each Social block.");
      if (contentBlocks.some((block) => block.type === "survey" && (!String(block.content || "").trim() || (block.choices || []).filter((choice) => String(choice.label || "").trim()).length < 2))) warnings.push("Every Survey needs a question and at least two answer choices.");
      if (contentBlocks.some((block) => block.type === "code" && sanitizeEmailFragment(block.content) !== String(block.content || ""))) warnings.push("Clean unsafe or unsupported markup from Custom Code blocks.");
      if (contentBlocks.some((block) => block.type === "footer" && (!validMarketingUrl(block.unsubscribeUrl || "#unsubscribe") || (block.preferencesText && !validMarketingUrl(block.preferencesUrl || "#preferences"))))) warnings.push("Fix the Footer unsubscribe or preferences destination.");
      if (contentBlocks.some((block) => block.visibility?.desktop === false && block.visibility?.mobile === false)) warnings.push("Remove blocks hidden on every device or make them visible.");
      const tokenKeys = [...JSON.stringify(contentBlocks).matchAll(/{{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*[^{}]+)?\s*}}/g)].map((match) => match[1]);
      if (tokenKeys.some((key) => !["first_name", "client", "name", "email", "branch", "company", "campaign", "date", "current_year", "unsubscribe_url", "preferences_url"].includes(key))) warnings.push("Replace unsupported personalization tokens.");
      const headingLevels = contentBlocks.filter((block) => block.type === "heading").map((block) => block.level || "h2");
      if (headingLevels.length && !headingLevels.includes("h1")) warnings.push("Use one H1 for the main email heading.");
    }
  }
  if (draft.channel !== "Email" && !draft.message.trim()) warnings.push("Add text message content.");
  if (/medical|diagnosis|acne|botox|patient|procedure/i.test(`${draft.subject} ${draft.previewText}`)) warnings.push("Review the subject and preview text for sensitive treatment or medical details.");
  return warnings;
}

function campaignAdvisories(draft) {
  if (draft.channel === "SMS" || draft.editorMode === "html") return [];
  const blocks = flattenEmailBlocks(draft.blocks, true);
  const advisories = [];
  if (draft.subject.trim().length > 60) advisories.push("Subject lines over 60 characters may be truncated on mobile.");
  if (draft.previewText.trim().length > 100) advisories.push("Preview text over 100 characters may be truncated.");
  if (blocks.some((block) => ["image", "logo", "video", "product", "productRecommendation"].includes(block.type) && Number(block.maxWidth || 0) > 800)) advisories.push("One or more images are wider than most email clients need.");
  if (JSON.stringify(draft.blocks).length > 180_000) advisories.push("This design is approaching the maximum supported email size.");
  if (blocks.some((block) => block.type === "layout" && block.columns?.length > 2 && block.mobileStack === false)) advisories.push("Three- and four-column rows should normally stack on mobile.");
  return advisories;
}

export default function MarketingWorkspace({
  approveCampaign,
  askConfirm,
  branches = [],
  branchScope = "All branches",
  canApproveMarketing = false,
  campaigns = [],
  clients = [],
  deleteCampaignForever,
  globalSearch = "",
  isLoading = false,
  loadMarketingMedia,
  moveCampaignToDeleted,
  notify,
  onOpenDashboard,
  onGlobalSearchChange = () => {},
  openModal,
  restoreCampaign,
  saveCampaign,
  saveMarketingSettings,
  scheduleCampaign,
  sendCampaign,
  sendingCampaignId,
  settings = {},
  templates = [],
  uploadMarketingImage,
}) {
  const [route, setRoute] = useState(routeFromLocation);
  const [draft, setDraft] = useState(() => normalizedDraft(safeJsonRead(draftStorageKey, null)));
  const [savedTemplates, setSavedTemplates] = useState(() => safeJsonRead(templateStorageKey, []));
  const [audienceMembers, setAudienceMembers] = useState([]);
  const [audienceMembersLoading, setAudienceMembersLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => safeJsonRead(sidebarStorageKey, false) === true);
  const activeCampaigns = useMemo(() => campaigns.filter((campaign) => !campaign.deletedAt), [campaigns]);
  const deletedCampaigns = useMemo(() => campaigns.filter((campaign) => Boolean(campaign.deletedAt)), [campaigns]);

  useEffect(() => {
    function syncRoute() {
      const next = routeFromLocation();
      setRoute(next);
    }
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    const label = workspaceNavigation.find((item) => item.id === route.section)?.label ?? "Marketing";
    const pageLabel = route.mode === "deleted" ? "Deleted campaigns" : label;
    document.title = route.mode === "create" ? `${draft.name || "Create campaign"} — Marketing — MACE` : `${pageLabel} — Marketing — MACE`;
    return () => {
      document.title = "Mace Clinic System";
    };
  }, [draft.name, route.mode, route.section]);

  useEffect(() => {
    safeJsonWrite(draftStorageKey, { ...draft, updatedAt: new Date().toISOString() });
  }, [draft]);

  useEffect(() => {
    safeJsonWrite(sidebarStorageKey, sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    let active = true;
    loadMarketingEmailTemplates().then((result) => {
      if (!active) return;
      const next = Array.isArray(result?.templates) ? result.templates : [];
      setSavedTemplates(next);
      safeJsonWrite(templateStorageKey, next);
    }).catch((error) => {
      if (active) notify?.(error.message || "Saved email templates could not be loaded; the local recovery copy remains available.", "warning");
    });
    return () => { active = false; };
  }, [notify]);

  const refreshAudienceMembers = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setAudienceMembersLoading(true);
    try {
      const result = await loadMarketingAudienceMembers();
      const members = Array.isArray(result?.members) ? result.members : [];
      setAudienceMembers(members);
      return members;
    } catch (error) {
      notify?.(error.message || "Audience emails could not be loaded.", "error");
      return [];
    } finally {
      setAudienceMembersLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refreshAudienceMembers();
  }, [branchScope, refreshAudienceMembers]);

  async function addAudienceMember(values) {
    const result = await addMarketingAudienceMember({ ...values, consentConfirmed: true });
    await refreshAudienceMembers({ quiet: true });
    notify?.(result.created ? "Email added to the audience." : "That email is already in this audience.", result.created ? "success" : "warning");
    return result;
  }

  async function importAudienceMembers(values) {
    const result = await importMarketingAudienceMembers({ ...values, consentConfirmed: true });
    await refreshAudienceMembers({ quiet: true });
    notify?.(`${result.imported} email${result.imported === 1 ? "" : "s"} imported${result.skipped ? `; ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped` : ""}.`);
    return result;
  }

  const eligibleContacts = useMemo(
    () => audienceRecipients(clients, audienceMembers, audienceDefinitions[0].id, "Email + SMS").length,
    [audienceMembers, clients],
  );

  function navigate(section, mode = "index") {
    navigateToMarketing(section, mode);
    setRoute({ section, mode });
    onGlobalSearchChange("");
  }

  function beginCampaign(preset = {}) {
    setDraft(normalizedDraft({
      ...createDefaultDraft(),
      branch: branchScope !== "All branches" ? branchScope : branches.length === 1 ? branches[0].name : "",
      step: 1,
      ...preset,
      managerApproval: canApproveMarketing ? false : settings.managerApproval !== false,
    }));
    navigate("campaigns", "create");
  }

  function applyTemplate(template) {
    const design = template.design && typeof template.design === "object" ? template.design : template;
    beginCampaign({
      name: template.name,
      subject: template.subject || template.name,
      previewText: template.previewText || template.description || "",
      step: 2,
      editorMode: design.editorMode === "html" ? "html" : "visual",
      html: template.html || "",
      htmlIsCustom: design.htmlIsCustom === true || design.editorMode === "html",
      blocks: Array.isArray(design.blocks) && design.blocks.length ? design.blocks : createDefaultBlocks(),
      theme: { ...defaultEmailTheme, ...(design.theme || {}) },
    });
  }

  function editCampaign(campaign) {
    const design = campaign.design && typeof campaign.design === "object" ? campaign.design : {};
    setDraft(normalizedDraft({
      ...campaign,
      ...design,
      id: campaign.id,
      editorMode: design.editorMode || (campaign.html ? "html" : "visual"),
      html: campaign.html || "",
      previewText: design.previewText || campaign.previewText || "",
      blocks: design.blocks || createDefaultBlocks(),
      theme: { ...defaultEmailTheme, ...(design.theme || {}) },
      step: 2,
    }));
    navigate("campaigns", "create");
  }

  const marketingSearchMeta = useMemo(() => {
    if (route.mode === "deleted") return { label: "Search deleted campaigns", placeholder: "Campaign name, channel, audience, or status" };
    const labels = {
      campaigns: ["Search campaigns", "Campaign name, channel, audience, or status"],
      templates: ["Search templates", "Template name, category, or message"],
      audiences: ["Search audiences", "Audience name or description"],
      automations: ["Search automations", "Workflow, timing, channel, or audience"],
      reports: ["Search campaign reports", "Campaign name, channel, audience, or status"],
    };
    const [label = "Search unavailable", placeholder = "No searchable records in this section"] = labels[route.section] || [];
    return { label, placeholder, disabled: !labels[route.section] };
  }, [route.mode, route.section]);

  const getMarketingSearchResults = useCallback((rawQuery) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];
    const match = (...values) => values.filter(Boolean).join(" ").toLowerCase().includes(query);
    if (route.section === "campaigns" || route.section === "reports") {
      const source = route.mode === "deleted" ? deletedCampaigns : activeCampaigns;
      return source.filter((item) => match(item.name, item.subject, item.segment, item.channel, item.status)).slice(0, 8).map((item) => ({
        id: item.id, kind: route.mode === "deleted" ? "Deleted campaign" : "Campaign", title: item.name, subtitle: `${item.channel} · ${item.segment}`, meta: item.status, record: item, action: "campaign",
      }));
    }
    if (route.section === "templates") return [...starterTemplates, ...savedTemplates, ...templates]
      .filter((item) => match(item.name, item.category, item.description, item.text)).slice(0, 8).map((item) => ({
        id: item.id, kind: "Template", title: item.name, subtitle: item.category || "Saved design", record: item, action: "template",
      }));
    if (route.section === "audiences") return audienceDefinitions.filter((item) => match(item.name, item.description)).slice(0, 8).map((item) => ({
      id: item.id, kind: "Audience", title: item.name, subtitle: item.description, record: item, action: "audience",
    }));
    if (route.section === "automations") return automationDefinitions.filter((item) => match(item.name, item.timing, item.channel, item.segment)).slice(0, 8).map((item) => ({
      id: item.name, kind: "Automation", title: item.name, subtitle: `${item.timing} · ${item.channel}`, record: item, action: "automation",
    }));
    return [];
  }, [activeCampaigns, deletedCampaigns, route.mode, route.section, savedTemplates, templates]);

  function selectMarketingSearchResult(result) {
    if (result.action === "campaign") editCampaign(result.record);
    if (result.action === "template") applyTemplate(result.record);
    if (result.action === "audience") beginCampaign({ segment: result.record.id, step: 1 });
    if (result.action === "automation") beginCampaign({ name: result.record.name, channel: result.record.channel, segment: result.record.segment, managerApproval: true, step: 1 });
  }

  async function persistTemplate(template) {
    const result = await saveMarketingEmailTemplate(template, { existing: Boolean(template.id && savedTemplates.some((item) => item.id === template.id)) });
    const saved = result.template;
    setSavedTemplates((current) => {
      const next = current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
      safeJsonWrite(templateStorageKey, next);
      return next;
    });
    return saved;
  }

  return (
    <div
      className={`marketing-workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      data-sidebar-state={sidebarCollapsed ? "collapsed" : "expanded"}
      data-testid="marketing-workspace"
    >
      <aside className="marketing-sidebar" aria-label="Marketing workspace navigation">
        <button
          className="marketing-sidebar-brand"
          onClick={onOpenDashboard}
          type="button"
          aria-label="Return to MACE dashboard"
        >
          <img src="/brand/mace-logo.png" alt="MACE" />
          <span>Dashboard</span>
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Hide Marketing menu"
          className="marketing-sidebar-collapse"
          onClick={() => setSidebarCollapsed(true)}
          title="Hide Marketing menu"
          type="button"
        >
          <PanelLeftClose size={17} aria-hidden="true" />
        </button>
        <div className="marketing-sidebar-heading">
          <span className="marketing-sidebar-kicker">Workspace</span>
          <strong>Marketing</strong>
        </div>
        <nav>
          {workspaceNavigation.map(({ id, label, icon: Icon }) => (
            <button
              className={route.section === id && route.mode !== "create" ? "active" : ""}
              key={id}
              onClick={() => navigate(id)}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="marketing-contact-summary">
          <strong>{eligibleContacts.toLocaleString("en-PH")} contacts</strong>
          <span><i aria-hidden="true" /> Email &amp; SMS eligible</span>
        </div>
      </aside>

      <section className="marketing-main">
        {sidebarCollapsed ? (
          <button
            aria-label="Show Marketing menu"
            className="marketing-sidebar-expand"
            onClick={() => setSidebarCollapsed(false)}
            title="Show Marketing menu"
            type="button"
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
            <span>Menu</span>
          </button>
        ) : null}
        {route.mode === "create" ? (
          <CampaignBuilder
            audienceMembers={audienceMembers}
            branches={branches}
            canApproveMarketing={canApproveMarketing}
            clients={clients}
            draft={draft}
            notify={notify}
            askConfirm={askConfirm}
            loadMedia={loadMarketingMedia}
            onBack={() => navigate("campaigns")}
            onOpenDashboard={onOpenDashboard}
            onSaveCampaign={saveCampaign}
            onScheduleCampaign={scheduleCampaign}
            onSaveTemplate={persistTemplate}
            setDraft={setDraft}
            settings={settings}
            templates={templates}
            uploadImage={uploadMarketingImage}
          />
        ) : (
          <>
            <MarketingHeader
              globalSearch={globalSearch}
              getSearchResults={getMarketingSearchResults}
              mode={route.mode}
              onCreate={() => beginCampaign()}
              onSearchChange={onGlobalSearchChange}
              onSearchSelect={selectMarketingSearchResult}
              onOpenDashboard={onOpenDashboard}
              searchMeta={marketingSearchMeta}
              section={route.section}
            />
            <div className="marketing-page-scroll">
              {isLoading ? (
                <MarketingLoading />
              ) : (
                <MarketingPage
                  audienceMembers={audienceMembers}
                  audienceMembersLoading={audienceMembersLoading}
                  approveCampaign={approveCampaign}
                  askConfirm={askConfirm}
                  branches={branches}
                  branchScope={branchScope}
                  campaigns={activeCampaigns}
                  canApproveMarketing={canApproveMarketing}
                  clients={clients}
                  deletedCampaigns={deletedCampaigns}
                  deleteCampaignForever={deleteCampaignForever}
                  globalSearch={globalSearch}
                  loadMedia={loadMarketingMedia}
                  mode={route.mode}
                  moveCampaignToDeleted={moveCampaignToDeleted}
                  navigate={navigate}
                  notify={notify}
                  onAddAudienceMember={addAudienceMember}
                  onEditCampaign={editCampaign}
                  onCreate={beginCampaign}
                  onImportAudienceMembers={importAudienceMembers}
                  onDeleteTemplate={async (template) => {
                    try {
                      await deleteMarketingEmailTemplate(template.id);
                      setSavedTemplates((current) => {
                        const next = current.filter((item) => item.id !== template.id);
                        safeJsonWrite(templateStorageKey, next);
                        return next;
                      });
                      notify?.("Saved template deleted.");
                    } catch (error) {
                      notify?.(error.message || "The template could not be deleted.", "error");
                    }
                  }}
                  onDuplicateTemplate={async (template) => {
                    try {
                      const copy = { ...template };
                      delete copy.id;
                      delete copy.createdAt;
                      delete copy.updatedAt;
                      await persistTemplate({ ...copy, name: `${template.name} copy` });
                      notify?.("Template duplicated.");
                    } catch (error) {
                      notify?.(error.message || "The template could not be duplicated.", "error");
                    }
                  }}
                  openModal={openModal}
                  restoreCampaign={restoreCampaign}
                  savedTemplates={savedTemplates}
                  saveMarketingSettings={saveMarketingSettings}
                  section={route.section}
                  sendCampaign={sendCampaign}
                  sendingCampaignId={sendingCampaignId}
                  settings={settings}
                  templates={templates}
                  onUseTemplate={applyTemplate}
                  uploadImage={uploadMarketingImage}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MarketingHeader({ globalSearch, getSearchResults, mode, onCreate, onOpenDashboard, onSearchChange, onSearchSelect, searchMeta, section }) {
  const sectionLabel = workspaceNavigation.find((item) => item.id === section)?.label ?? "Overview";
  const isDeleted = section === "campaigns" && mode === "deleted";
  const label = isDeleted ? "Deleted campaigns" : sectionLabel;
  return (
    <header className="marketing-header">
      <div className="marketing-heading-row">
        <button className="marketing-global-menu" onClick={onOpenDashboard} type="button" aria-label="Return to MACE dashboard">
          <Menu size={20} aria-hidden="true" />
        </button>
        <div>
          <p className="marketing-breadcrumb"><span>Marketing</span><ChevronRight size={14} aria-hidden="true" />{isDeleted ? <><span>Campaigns</span><ChevronRight size={14} aria-hidden="true" />Deleted</> : label}</p>
          <h1>{label}</h1>
        </div>
      </div>
      <div className="marketing-header-actions">
        <GlobalModuleSearch
          value={globalSearch}
          onChange={onSearchChange}
          label={searchMeta.label}
          placeholder={searchMeta.placeholder}
          disabled={searchMeta.disabled}
          getResults={getSearchResults}
          onSelect={onSearchSelect}
        />
        {section !== "settings" && section !== "media" && !isDeleted && (
          <button className="marketing-primary-button" onClick={onCreate} type="button">
            <Plus size={17} aria-hidden="true" /> Create campaign
          </button>
        )}
      </div>
    </header>
  );
}

function MarketingPage(props) {
  switch (props.section) {
    case "campaigns": return props.mode === "deleted" ? <DeletedCampaignsPage {...props} /> : <CampaignsPage {...props} />;
    case "templates": return <TemplatesPage {...props} />;
    case "audiences": return <AudiencesPage {...props} />;
    case "automations": return <AutomationsPage {...props} />;
    case "media": return <MarketingMediaPage {...props} />;
    case "reports": return <ReportsPage {...props} />;
    case "settings": return <MarketingSettingsPage {...props} />;
    default: return <MarketingOverview {...props} />;
  }
}

function MarketingOverview({ campaigns, navigate, onCreate }) {
  const scheduled = campaigns.filter((campaign) => campaign.status === "Scheduled");
  const sent = campaigns.filter((campaign) => campaign.status === "Sent");
  const delivered = sent.reduce((total, campaign) => total + Number(campaign.sent || 0), 0);
  return (
    <div className="marketing-overview-page">
      <section className="marketing-overview-intro">
        <div>
          <span className="marketing-eyebrow">Connected clinic marketing</span>
          <h2>Thoughtful campaigns, in one calm workspace.</h2>
          <p>Create consent-aware email and text message campaigns without mixing them with appointment reminders or transactional notifications.</p>
        </div>
        <button className="marketing-primary-button" onClick={onCreate} type="button">Create your next campaign <ChevronRight size={17} /></button>
      </section>
      <div className="marketing-summary-strip">
        <article><span>Scheduled</span><strong>{scheduled.length}</strong><small>campaigns awaiting delivery</small></article>
        <article><span>Delivered</span><strong>{delivered.toLocaleString("en-PH")}</strong><small>messages across sent campaigns</small></article>
        <article><span>Recent activity</span><strong>{campaigns.length}</strong><small>campaigns in this workspace</small></article>
      </div>
      <section className="marketing-section-block">
        <div className="marketing-section-heading"><div><h2>Recent campaigns</h2><p>Latest work across email and text message channels.</p></div><button onClick={() => navigate("campaigns")} type="button">View all <ChevronRight size={15} /></button></div>
        {campaigns.length ? (
          <div className="marketing-recent-list">
            {campaigns.slice(0, 4).map((campaign) => (
              <article key={campaign.id}>
                <span className={`marketing-channel-icon ${campaign.channel?.toLowerCase().includes("mail") ? "email" : "sms"}`}>{campaign.channel?.toLowerCase().includes("mail") ? <Mail size={17} /> : <MessageSquareText size={17} />}</span>
                <div><strong>{campaign.name}</strong><small>{campaign.channel} · {campaign.segment}</small></div>
                <StatusPill value={campaign.status} />
                <span>{campaignDate(campaign)}</span>
              </article>
            ))}
          </div>
        ) : <MarketingEmpty title="No campaigns yet" copy="Create a campaign to start building your marketing history." action="Create campaign" onAction={onCreate} />}
      </section>
    </div>
  );
}

function CampaignsPage({ approveCampaign, askConfirm, campaigns, canApproveMarketing, deletedCampaigns, globalSearch, moveCampaignToDeleted, navigate, notify, onCreate, onEditCampaign, sendCampaign, sendingCampaignId }) {
  const [channel, setChannel] = useState("All channels");
  const [status, setStatus] = useState("All statuses");
  const [busyId, setBusyId] = useState("");
  const filtered = campaigns.filter((campaign) => {
    const search = globalSearch.trim().toLowerCase();
    return (!search || `${campaign.name} ${campaign.segment} ${campaign.channel} ${campaign.status}`.toLowerCase().includes(search))
      && (channel === "All channels" || campaign.channel === channel)
      && (status === "All statuses" || campaign.status === status);
  });

  function confirmMoveToDeleted(campaign) {
    const run = async () => {
      setBusyId(campaign.id);
      try {
        await moveCampaignToDeleted(campaign);
      } catch (error) {
        notify?.(error.message || "Unable to move the campaign to Deleted.", "error");
      } finally {
        setBusyId("");
      }
    };
    const confirmation = {
      title: "Move campaign to Deleted?",
      copy: `“${campaign.name}” will leave active campaigns and reports. You can restore it from the Deleted page.`,
      actionLabel: "Move to Deleted",
      onConfirm: () => { void run(); },
    };
    if (askConfirm) askConfirm(confirmation);
    else confirmation.onConfirm();
  }

  async function approve(campaign) {
    setBusyId(campaign.id);
    try {
      await approveCampaign(campaign.id);
    } catch (error) {
      notify?.(error.message || "Unable to approve this campaign.", "error");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="marketing-list-page">
      <div className="marketing-list-actions">
        <div><strong>{campaigns.length.toLocaleString("en-PH")} active campaign{campaigns.length === 1 ? "" : "s"}</strong><span>Deleted campaigns stay recoverable until you remove them forever.</span></div>
        <button onClick={() => navigate("campaigns", "deleted")} type="button"><Trash2 size={15} aria-hidden="true" /> Deleted <b>{deletedCampaigns.length}</b></button>
      </div>
      <div className="marketing-toolbar">
        <label><span>Channel</span><select aria-label="Filter by channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option>All channels</option><option>Email</option><option>SMS</option><option>Email + SMS</option></select></label>
        <label><span>Status</span><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Draft</option><option>Pending approval</option><option>Scheduled</option><option>Sending</option><option>Sent</option><option>Partial</option><option>Failed</option></select></label>
      </div>
      {filtered.length ? (
        <div className="marketing-table-wrap">
          <table className="marketing-table">
            <thead><tr><th>Campaign</th><th>Channel</th><th>Audience</th><th>Status</th><th>Scheduled or sent</th><th>Delivery summary</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filtered.map((campaign) => {
                const awaitingApproval = campaign.status === "Pending approval" || campaign.deliveryStatus === "Awaiting approval";
                const queued = campaign.deliveryStatus === "Queued" || campaign.deliveryStatus === "Processing";
                const sendDisabled = sendingCampaignId === campaign.id || campaign.channel === "Email + SMS" || awaitingApproval || queued;
                const sendLabel = sendingCampaignId === campaign.id ? "Sending…" : campaign.channel === "Email + SMS" ? "Setup required" : awaitingApproval ? "Awaiting approval" : queued ? "Queued" : "Send";
                return <tr key={campaign.id}>
                  <td><strong>{campaign.name}</strong><small>{campaign.subject || "No email subject"}</small></td>
                  <td><ChannelPill value={campaign.channel} /></td>
                  <td>{campaign.segment}</td>
                  <td><StatusPill value={campaign.status} /></td>
                  <td>{campaignDate(campaign)}</td>
                  <td><strong>{Number(campaign.sent || 0).toLocaleString("en-PH")}</strong> delivered<small>{Number(campaign.booked || 0)} bookings</small></td>
                  <td><div className="marketing-row-actions"><button onClick={() => onEditCampaign(campaign)} type="button">Edit</button>{canApproveMarketing && awaitingApproval ? <button disabled={busyId === campaign.id} onClick={() => { void approve(campaign); }} type="button">{busyId === campaign.id ? "Approving…" : "Approve"}</button> : <button disabled={sendDisabled} onClick={() => sendCampaign(campaign.id)} title={campaign.channel === "Email + SMS" ? "Combined delivery requires the coordinated delivery endpoint" : awaitingApproval ? "An Admin or Business Owner must approve this campaign" : queued ? "This campaign is already in the delivery queue" : undefined} type="button">{sendLabel}</button>}<button aria-label={`Delete ${campaign.name}`} className="danger" disabled={busyId === campaign.id} onClick={() => confirmMoveToDeleted(campaign)} type="button"><Trash2 size={14} aria-hidden="true" />{busyId === campaign.id ? "Working…" : "Delete"}</button></div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      ) : <MarketingEmpty title="No campaigns match these filters" copy="Clear the filters or create a new campaign." action="Create campaign" onAction={onCreate} />}
    </div>
  );
}

function DeletedCampaignsPage({ askConfirm, deletedCampaigns, deleteCampaignForever, globalSearch, navigate, notify, restoreCampaign }) {
  const [busyId, setBusyId] = useState("");
  const search = globalSearch.trim().toLowerCase();
  const filtered = [...deletedCampaigns]
    .sort((left, right) => new Date(right.deletedAt || 0) - new Date(left.deletedAt || 0))
    .filter((campaign) => !search || `${campaign.name} ${campaign.segment} ${campaign.channel} ${campaign.status}`.toLowerCase().includes(search));

  async function restore(campaign) {
    setBusyId(campaign.id);
    try {
      await restoreCampaign(campaign);
    } catch (error) {
      notify?.(error.message || "Unable to restore the campaign.", "error");
    } finally {
      setBusyId("");
    }
  }

  function confirmDeleteForever(campaign) {
    const run = async () => {
      setBusyId(campaign.id);
      try {
        await deleteCampaignForever(campaign);
      } catch (error) {
        notify?.(error.message || "Unable to permanently delete the campaign.", "error");
      } finally {
        setBusyId("");
      }
    };
    const confirmation = {
      title: "Delete campaign forever?",
      copy: `“${campaign.name}” and its delivery history will be permanently removed. This cannot be undone.`,
      actionLabel: "Delete forever",
      onConfirm: () => { void run(); },
    };
    if (askConfirm) askConfirm(confirmation);
    else confirmation.onConfirm();
  }

  return (
    <div className="marketing-list-page marketing-deleted-page">
      <div className="marketing-list-actions">
        <div><strong>{deletedCampaigns.length.toLocaleString("en-PH")} deleted campaign{deletedCampaigns.length === 1 ? "" : "s"}</strong><span>Restore campaigns or delete them forever when they are no longer needed.</span></div>
        <button onClick={() => navigate("campaigns")} type="button"><ArrowLeft size={15} aria-hidden="true" /> Back to campaigns</button>
      </div>
      {filtered.length ? (
        <div className="marketing-table-wrap">
          <table className="marketing-table marketing-deleted-table">
            <thead><tr><th>Campaign</th><th>Channel</th><th>Audience</th><th>Previous status</th><th>Deleted</th><th>Delivery summary</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filtered.map((campaign) => (
                <tr key={campaign.id}>
                  <td><strong>{campaign.name}</strong><small>{campaign.subject || "No email subject"}</small></td>
                  <td><ChannelPill value={campaign.channel} /></td>
                  <td>{campaign.segment}</td>
                  <td><StatusPill value={campaign.status} /></td>
                  <td>{campaign.deletedAt ? new Date(campaign.deletedAt).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                  <td><strong>{Number(campaign.sent || 0).toLocaleString("en-PH")}</strong> delivered<small>{Number(campaign.booked || 0)} bookings</small></td>
                  <td><div className="marketing-row-actions deleted"><button disabled={busyId === campaign.id} onClick={() => { void restore(campaign); }} type="button"><RotateCcw size={14} aria-hidden="true" /> Restore</button><button aria-label={`Delete ${campaign.name} forever`} className="danger" disabled={busyId === campaign.id} onClick={() => confirmDeleteForever(campaign)} type="button"><Trash2 size={14} aria-hidden="true" /> Delete forever</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="marketing-deleted-empty"><span><Trash2 size={22} aria-hidden="true" /></span><h3>{deletedCampaigns.length ? "No deleted campaigns match your search" : "No deleted campaigns"}</h3><p>{deletedCampaigns.length ? "Try another campaign name, channel, or audience." : "Campaigns you delete will stay here until you restore them or delete them forever."}</p><button onClick={() => navigate("campaigns")} type="button">Back to campaigns</button></div>
      )}
    </div>
  );
}

function TemplateCardPreview({ index, template }) {
  if (template.thumbnail) return <div className="marketing-template-preview has-thumbnail"><img src={template.thumbnail} alt="" /></div>;
  if (!template.preview) return <div className={`marketing-template-preview generic preview-${index % 4}`}><span>MACE</span><i /><i /><b /></div>;
  const preview = template.preview;
  return (
    <div
      className={`marketing-template-preview is-starter template-preview-${preview.layout}`}
      data-template-layout={preview.layout}
      style={{ "--template-accent": preview.accent, "--template-surface": preview.surface }}
    >
      <div className="template-mini-brand">MACE</div>
      {preview.image ? <div className="template-mini-media"><img src={preview.image} alt="" /></div> : null}
      <div className="template-mini-copy"><span>{preview.kicker}</span><strong>{preview.title}</strong><i /><i /><b /></div>
      {preview.badge ? <div className="template-mini-badge">{preview.badge}</div> : null}
      <div className="template-mini-marks"><i /><i /><i /></div>
    </div>
  );
}

function TemplatesPage({ globalSearch, onDeleteTemplate, onDuplicateTemplate, onUseTemplate, savedTemplates, templates }) {
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const query = globalSearch.trim().toLowerCase();
  const allTemplates = [...starterTemplates, ...savedTemplates].filter((template) => !query || `${template.name} ${template.category || ""} ${template.description || ""}`.toLowerCase().includes(query));
  const visibleMessageTemplates = templates.filter((template) => !query || `${template.name} ${template.category || ""} ${template.text || ""}`.toLowerCase().includes(query));
  return (
    <div className="marketing-template-page">
      <section className="marketing-section-block no-surface">
        <div className="marketing-section-heading"><div><h2>Email starting templates</h2><p>Controlled layouts that clinic staff can customise safely.</p></div></div>
        <div className="marketing-template-grid">
          {allTemplates.map((template, index) => (
            <article className="marketing-template-card" key={`${template.id}-${index}`}>
              <TemplateCardPreview index={index} template={template} />
              <div><span>{template.category || "Saved design"}</span><h3>{template.name}</h3><p>{template.description || "A reusable design saved from the campaign builder."}</p></div>
              <div className="marketing-template-actions">
                <button onClick={() => onUseTemplate(template)} type="button">{savedTemplates.some((item) => item.id === template.id) ? "Edit design" : "Use template"}</button>
                <button onClick={() => setPreviewTemplate(template)} type="button">Preview</button>
                {savedTemplates.some((item) => item.id === template.id) && <><button onClick={() => onDuplicateTemplate(template)} type="button">Duplicate</button><button onClick={() => onDeleteTemplate(template)} type="button">Delete</button></>}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-section-block">
        <div className="marketing-section-heading"><div><h2>Text message templates</h2><p>Your existing templates and delivery integration remain available.</p></div><span>{templates.length} active</span></div>
        {visibleMessageTemplates.length ? <div className="marketing-message-templates">{visibleMessageTemplates.map((template) => <article key={template.id}><div><MessageSquareText size={18} /><strong>{template.name}</strong><StatusPill value={template.active ? "Active" : "Inactive"} /></div><p>{template.text}</p><small>{template.category}</small></article>)}</div> : <MarketingEmpty title={query ? "No matching text message templates" : "No text message templates"} copy={query ? "Try another search in the Marketing header." : "Templates saved through the current service will appear here."} />}
      </section>
      {previewTemplate && <div className="marketing-template-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${previewTemplate.name}`}><button className="marketing-dialog-backdrop" onClick={() => setPreviewTemplate(null)} type="button" aria-label="Close template preview" /><article><header><div><span>Template preview</span><h2>{previewTemplate.name}</h2></div><button onClick={() => setPreviewTemplate(null)} type="button" aria-label="Close template preview"><X size={18} /></button></header><div className="marketing-template-live-preview"><iframe sandbox="" srcDoc={previewPersonalizedHtml(previewTemplate.html || buildVisualEmailHtml({ name: previewTemplate.name, subject: previewTemplate.name, previewText: previewTemplate.description, blocks: previewTemplate.design?.blocks || previewTemplate.blocks || createDefaultBlocks(), theme: previewTemplate.design?.theme || previewTemplate.theme || defaultEmailTheme }))} title={`${previewTemplate.name} template preview`} /></div><footer><button onClick={() => setPreviewTemplate(null)} type="button">Close</button><button className="marketing-primary-button" onClick={() => onUseTemplate(previewTemplate)} type="button">Use this template</button></footer></article></div>}
    </div>
  );
}

function AudiencesPage({ audienceMembers = [], audienceMembersLoading, branches = [], branchScope, clients, globalSearch, notify, onAddAudienceMember, onCreate, onImportAudienceMembers }) {
  const [selectedAudience, setSelectedAudience] = useState(null);
  const query = globalSearch.trim().toLowerCase();
  const visibleAudiences = audienceDefinitions.filter((audience) => !query || `${audience.name} ${audience.description}`.toLowerCase().includes(query));
  return (
    <div className="marketing-audience-page">
      <div className="marketing-consent-notice"><UserCheck size={20} /><div><strong>Consent is applied per channel</strong><p>Estimates use channel-specific consent when available and the existing opt-in for legacy contacts. Suppressions and delivery failures must be rechecked by the provider before sending.</p></div></div>
      <div className="marketing-audience-grid">
        {visibleAudiences.map((audience) => {
          const emailCount = audienceRecipients(clients, audienceMembers, audience.id, "Email").length;
          const smsCount = audienceRecipients(clients, audienceMembers, audience.id, "SMS").length;
          return (
            <article key={audience.id}>
              <div><span className="marketing-audience-icon"><Users size={19} /></span><StatusPill value="Saved" /></div>
              <h3>{audience.name}</h3>
              <p>{audience.description}</p>
              <dl>
                <div><dt><button aria-label={`View ${audience.name} contacts`} onClick={() => setSelectedAudience(audience)} type="button">Email</button></dt><dd>{audienceMembersLoading ? "…" : emailCount}</dd></div>
                <div><dt>SMS</dt><dd>{smsCount}</dd></div>
              </dl>
              <footer>
                <button onClick={() => setSelectedAudience(audience)} type="button"><Eye size={14} /> View contacts</button>
                <button onClick={() => onCreate({ segment: audience.id, step: 1 })} type="button">Use audience <ChevronRight size={15} /></button>
              </footer>
            </article>
          );
        })}
      </div>
      {selectedAudience ? (
        <AudienceEmailManager
          audience={selectedAudience}
          branches={branches}
          branchScope={branchScope}
          clients={clients}
          members={audienceMembers}
          notify={notify}
          onAdd={onAddAudienceMember}
          onClose={() => setSelectedAudience(null)}
          onImport={onImportAudienceMembers}
        />
      ) : null}
    </div>
  );
}

function AudienceEmailManager({ audience, branches, branchScope, clients, members, notify, onAdd, onClose, onImport }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [importDraft, setImportDraft] = useState(null);
  const fileInput = useRef(null);
  const pageSize = 50;
  const recipients = useMemo(
    () => audienceRecipients(clients, members, audience.id, "Email + SMS").map((recipient) => ({ ...recipient, audience: audience.id })),
    [audience.id, clients, members],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecipients = useMemo(() => {
    if (!normalizedQuery) return recipients;
    return recipients.filter((recipient) => [recipient.fullName, recipient.name, recipient.email, recipient.mobile, recipient.branch, recipient.source]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));
  }, [normalizedQuery, recipients]);
  const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstRecipient = filteredRecipients.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const lastRecipient = Math.min(currentPage * pageSize, filteredRecipients.length);
  const visibleRecipients = filteredRecipients.slice(firstRecipient ? firstRecipient - 1 : 0, lastRecipient);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    function closeWithEscape(event) {
      if (event.key !== "Escape") return;
      if (addOpen) setAddOpen(false);
      else if (importDraft) setImportDraft(null);
      else onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [addOpen, importDraft, onClose]);

  async function readImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      notify?.("CSV files must be 2 MB or smaller.", "error");
      return;
    }
    try {
      const parsed = parseAudienceCsv(await file.text());
      if (!parsed.contacts.length) {
        notify?.("No valid email addresses were found in that CSV.", "warning");
        return;
      }
      if (parsed.contacts.length > 1_000) {
        notify?.("Import no more than 1,000 email contacts at a time.", "error");
        return;
      }
      setImportDraft({ ...parsed, filename: file.name });
    } catch (error) {
      notify?.(error.message || "That CSV could not be read.", "error");
    }
  }

  function exportContacts() {
    const slug = audience.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadAudienceCsv(`mace-${slug || "audience"}-contacts.csv`, filteredRecipients);
    notify?.(`${filteredRecipients.length} contact${filteredRecipients.length === 1 ? "" : "s"} exported.`);
  }

  return (
    <div aria-label={`${audience.name} audience contacts`} aria-modal="true" className="marketing-audience-dialog marketing-audience-manager-dialog" role="dialog">
      <button aria-label="Close audience contacts" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <section>
        <header>
          <div><span>Saved audience contacts</span><h2>{audience.name}</h2><p>{recipients.length.toLocaleString("en-PH")} consented contact{recipients.length === 1 ? "" : "s"}</p></div>
          <button aria-label="Close audience contacts" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button>
        </header>
        <div className="marketing-audience-manager-toolbar">
          <label><Search aria-hidden="true" size={16} /><span className="sr-only">Search audience contacts</span><input aria-label="Search audience contacts" autoFocus onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, phone, branch or source" type="search" value={query} /></label>
          <div>
            <input accept=".csv,text/csv" className="marketing-audience-file-input" onChange={readImportFile} ref={fileInput} tabIndex={-1} type="file" />
            <button onClick={() => setAddOpen(true)} type="button"><Plus size={15} /> Add email</button>
            <button onClick={() => fileInput.current?.click()} type="button"><Upload size={15} /> Import CSV</button>
            <button disabled={!filteredRecipients.length} onClick={exportContacts} type="button"><Download size={15} /> Export CSV</button>
          </div>
        </div>
        <div className="marketing-audience-table-wrap">
          {filteredRecipients.length ? (
            <table className="marketing-audience-recipient-table marketing-audience-email-table">
              <caption className="sr-only">Contacts in {audience.name}</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Email address</th><th scope="col">Phone number</th><th scope="col">Branch</th><th scope="col">Source</th></tr></thead>
              <tbody>{visibleRecipients.map((recipient, index) => {
                const name = recipient.fullName || recipient.name || "Email contact";
                return <tr key={recipient.id || `${recipient.email || recipient.mobile}-${firstRecipient + index}`}><td><span className="marketing-recipient-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span><strong>{name}</strong></td><td><Mail aria-hidden="true" size={14} /><span>{recipient.email || "—"}</span></td><td><MessageSquareText aria-hidden="true" size={14} /><span>{recipient.mobile || "—"}</span></td><td>{recipient.branch || "—"}</td><td><span className={`marketing-audience-source${recipient.audienceMember ? " imported" : ""}`}>{recipient.audienceMember ? recipient.source || "Manual" : "Client record"}</span></td></tr>;
              })}</tbody>
            </table>
          ) : <MarketingEmpty title={query ? "No matching contacts" : "No contacts yet"} copy={query ? "Try a different name, email address, phone number, branch or source." : "Add an email manually or import a CSV to build this audience."} action={!query ? "Add email" : undefined} onAction={() => setAddOpen(true)} />}
        </div>
        <footer>
          <span>Showing {firstRecipient.toLocaleString("en-PH")}–{lastRecipient.toLocaleString("en-PH")} of {filteredRecipients.length.toLocaleString("en-PH")}</span>
          <div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button><span>Page {currentPage} of {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button></div>
        </footer>
      </section>
      {addOpen ? <AddAudienceEmailDialog audience={audience} branches={branches} branchScope={branchScope} onAdd={onAdd} onClose={() => setAddOpen(false)} /> : null}
      {importDraft ? <ImportAudienceEmailsDialog audience={audience} branches={branches} branchScope={branchScope} draft={importDraft} onClose={() => setImportDraft(null)} onImport={onImport} /> : null}
    </div>
  );
}

function audienceDefaultBranch(branches, branchScope) {
  if (branchScope && branchScope !== "All branches") return branchScope;
  return branches.length === 1 ? branches[0].name : "";
}

function AddAudienceEmailDialog({ audience, branches, branchScope, onAdd, onClose }) {
  const [form, setForm] = useState(() => ({ name: "", email: "", branch: audienceDefaultBranch(branches, branchScope), consentConfirmed: false }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!validAudienceEmail(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd({ ...form, audience: audience.id, source: "Manual" });
      onClose();
    } catch (submitError) {
      setError(submitError.message || "The email could not be added.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-label={`Add email to ${audience.name}`} aria-modal="true" className="marketing-action-dialog marketing-audience-action-dialog" role="dialog">
      <button aria-label="Close add email dialog" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <form onSubmit={submit}>
        <header><div><span>Audience contact</span><h2>Add email</h2></div><button aria-label="Close add email dialog" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="marketing-action-dialog-body">
          <p>Add a consented email-only contact to <strong>{audience.name}</strong>. This does not create a clinic client record.</p>
          <label><span>Name <small>Optional</small></span><input autoFocus maxLength={160} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Jane Doe" value={form.name} /></label>
          <label><span>Email address</span><input autoComplete="email" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="jane@example.com" required type="email" value={form.email} /></label>
          <label><span>Clinic branch</span><select disabled={branchScope !== "All branches"} onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))} required value={form.branch}><option value="" disabled>Select a branch</option>{branches.map((branch) => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></label>
          <label className="marketing-audience-consent-check"><input checked={form.consentConfirmed} onChange={(event) => setForm((current) => ({ ...current, consentConfirmed: event.target.checked }))} required type="checkbox" /><span><strong>Consent confirmed</strong><small>This person agreed to receive marketing email from this clinic.</small></span></label>
          {error ? <div className="marketing-inline-error"><CircleAlert size={15} />{error}</div> : null}
        </div>
        <footer><button disabled={saving} onClick={onClose} type="button">Cancel</button><button className="marketing-primary-button" disabled={saving || !form.branch || !form.consentConfirmed || !validAudienceEmail(form.email)} type="submit"><Plus size={15} />{saving ? "Adding…" : "Add email"}</button></footer>
      </form>
    </div>
  );
}

function ImportAudienceEmailsDialog({ audience, branches, branchScope, draft, onClose, onImport }) {
  const [branch, setBranch] = useState(() => audienceDefaultBranch(branches, branchScope));
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scopedContacts = useMemo(() => draft.contacts.map((contact) => ({
    ...contact,
    branch: branchScope === "All branches" ? contact.branch : "",
  })), [branchScope, draft.contacts]);
  const needsDefaultBranch = scopedContacts.some((contact) => !contact.branch);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onImport({ audience: audience.id, branch, consentConfirmed, members: scopedContacts });
      onClose();
    } catch (submitError) {
      setError(submitError.message || "The emails could not be imported.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-label={`Import emails to ${audience.name}`} aria-modal="true" className="marketing-action-dialog marketing-audience-action-dialog" role="dialog">
      <button aria-label="Close import emails dialog" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <form onSubmit={submit}>
        <header><div><span>CSV import</span><h2>Import emails</h2></div><button aria-label="Close import emails dialog" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="marketing-action-dialog-body">
          <div className="marketing-audience-import-summary"><Upload size={20} /><span><strong>{draft.contacts.length.toLocaleString("en-PH")} valid email{draft.contacts.length === 1 ? "" : "s"}</strong><small>{draft.filename}{draft.invalid ? ` · ${draft.invalid} invalid row${draft.invalid === 1 ? "" : "s"} will be skipped` : ""}</small></span></div>
          <p>The CSV may contain <strong>Name</strong>, <strong>Email</strong>, and <strong>Branch</strong> columns. A row&apos;s Branch value takes priority over the default below.</p>
          <label><span>{needsDefaultBranch ? "Default clinic branch" : "Fallback clinic branch"}</span><select disabled={branchScope !== "All branches"} onChange={(event) => setBranch(event.target.value)} required={needsDefaultBranch} value={branch}><option value="" disabled>Select a branch</option>{branches.map((item) => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select><small>Used for imported rows whose Branch cell is blank.</small></label>
          <label className="marketing-audience-consent-check"><input checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} required type="checkbox" /><span><strong>Consent confirmed for every imported contact</strong><small>Each person agreed to receive marketing email from this clinic.</small></span></label>
          {error ? <div className="marketing-inline-error"><CircleAlert size={15} />{error}</div> : null}
        </div>
        <footer><button disabled={saving} onClick={onClose} type="button">Cancel</button><button className="marketing-primary-button" disabled={saving || !consentConfirmed || (needsDefaultBranch && !branch)} type="submit"><Upload size={15} />{saving ? "Importing…" : `Import ${draft.contacts.length} email${draft.contacts.length === 1 ? "" : "s"}`}</button></footer>
      </form>
    </div>
  );
}

function AutomationsPage({ globalSearch, onCreate }) {
  const query = globalSearch.trim().toLowerCase();
  const visibleAutomations = automationDefinitions.filter((automation) => !query || `${automation.name} ${automation.timing} ${automation.channel} ${automation.segment}`.toLowerCase().includes(query));
  return (
    <div className="marketing-automation-page">
      <div className="marketing-consent-notice neutral"><Workflow size={20} /><div><strong>Start with simple clinic workflows</strong><p>Each automation opens as a reviewable draft. Delivery remains off until timing, channel consent and manager approval are confirmed.</p></div></div>
      <div className="marketing-automation-list">
        {visibleAutomations.map((automation) => <article key={automation.name}><span className="marketing-automation-icon"><CalendarClock size={20} /></span><div><h3>{automation.name}</h3><p>{automation.timing}</p><span>{automation.channel} · {automation.segment}</span></div><StatusPill value="Setup required" /><button onClick={() => onCreate({ name: automation.name, channel: automation.channel, segment: automation.segment, managerApproval: true, step: 1 })} type="button">Set up</button></article>)}
      </div>
    </div>
  );
}

function ReportsPage({ campaigns, globalSearch }) {
  const query = globalSearch.trim().toLowerCase();
  const visibleCampaigns = campaigns.filter((campaign) => !query || `${campaign.name} ${campaign.segment} ${campaign.channel} ${campaign.status}`.toLowerCase().includes(query));
  const totalSent = visibleCampaigns.reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const emailSent = visibleCampaigns.filter((campaign) => campaign.channel?.toLowerCase().includes("email")).reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const smsSent = visibleCampaigns.filter((campaign) => campaign.channel === "SMS").reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const totalBooked = visibleCampaigns.reduce((sum, campaign) => sum + Number(campaign.booked || 0), 0);
  const maxSent = Math.max(1, ...visibleCampaigns.map((campaign) => Number(campaign.sent || 0)));
  return (
    <div className="marketing-reports-page">
      <div className="marketing-summary-strip reports">
        <article><span>Delivered</span><strong>{totalSent.toLocaleString("en-PH")}</strong><small>provider-confirmed messages</small></article>
        <article><span>Bookings recorded</span><strong>{totalBooked.toLocaleString("en-PH")}</strong><small>attributed to campaigns</small></article>
        <article><span>Booking response</span><strong>{totalSent ? `${Math.round((totalBooked / totalSent) * 100)}%` : "—"}</strong><small>bookings divided by delivered</small></article>
      </div>
      <section className="marketing-section-block">
        <div className="marketing-section-heading"><div><h2>Delivery by campaign</h2><p>Open, click, bounce and unsubscribe metrics will appear when the email provider boundary is connected.</p></div></div>
        {visibleCampaigns.length ? <div className="marketing-report-bars">{visibleCampaigns.slice(0, 8).map((campaign) => <article key={campaign.id}><div><strong>{campaign.name}</strong><span>{campaign.channel}</span></div><div className="marketing-report-track"><i style={{ width: `${Math.max(4, (Number(campaign.sent || 0) / maxSent) * 100)}%` }} /></div><b>{Number(campaign.sent || 0).toLocaleString("en-PH")}</b></article>)}</div> : <MarketingEmpty title={query ? "No campaign reports match your search" : "No delivery results yet"} copy={query ? "Try another campaign name, channel, audience, or status." : "Sent campaign results will appear here."} />}
      </section>
      <div className="marketing-metric-table"><div><span>Metric</span><span>Email</span><span>SMS</span></div>{["Delivered", "Opened", "Clicked", "Bounced", "Unsubscribed"].map((metric) => <div key={metric}><strong>{metric}</strong><span>{metric === "Delivered" ? emailSent : "—"}</span><span>{metric === "Delivered" ? smsSent : "—"}</span></div>)}</div>
    </div>
  );
}

function MarketingSettingsPage({ canApproveMarketing, notify, openModal, saveMarketingSettings, settings }) {
  const [localSettings, setLocalSettings] = useState(() => ({
    ...safeJsonRead("mace-marketing-settings-v1", {}),
    senderName: settings.marketingSenderName || settings.company || "MACE Signature Wellness",
    replyTo: settings.marketingReplyTo || "hello@macebydrmace.com",
    unsubscribeText: settings.marketingUnsubscribeText || "You are receiving this because you opted in to MACE marketing. Unsubscribe at any time.",
    managerApproval: settings.managerApproval !== false,
  }));
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!saveMarketingSettings) {
      notify?.("Marketing settings are unavailable right now.", "error");
      return;
    }
    setSaving(true);
    try {
      await saveMarketingSettings({
        marketingSenderName: localSettings.senderName,
        marketingReplyTo: localSettings.replyTo,
        marketingUnsubscribeText: localSettings.unsubscribeText,
        managerApproval: canApproveMarketing ? localSettings.managerApproval : settings.managerApproval !== false,
      });
      safeJsonWrite("mace-marketing-settings-v1", localSettings);
    } catch (error) {
      notify?.(error.message || "Marketing preferences could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="marketing-settings-page">
      <section className="marketing-settings-form">
        <div className="marketing-section-heading"><div><h2>Sender identity</h2><p>Shown clearly on all marketing messages.</p></div></div>
        <label><span>Sender name</span><input value={localSettings.senderName} onChange={(event) => setLocalSettings({ ...localSettings, senderName: event.target.value })} /></label>
        <label><span>Reply-to address</span><input type="email" value={localSettings.replyTo} onChange={(event) => setLocalSettings({ ...localSettings, replyTo: event.target.value })} /></label>
        <label className="span-2"><span>Default unsubscribe content</span><textarea rows="4" value={localSettings.unsubscribeText} onChange={(event) => setLocalSettings({ ...localSettings, unsubscribeText: event.target.value })} /></label>
        <label className="marketing-check span-2"><input type="checkbox" checked={localSettings.managerApproval} disabled={!canApproveMarketing} onChange={(event) => setLocalSettings({ ...localSettings, managerApproval: event.target.checked })} /><span><strong>Require manager approval</strong><small>{canApproveMarketing ? "Staff campaigns wait for an Admin or Business Owner. Admin and Owner accounts approve their own campaigns automatically." : "Only an Admin or Business Owner can change this organization policy."}</small></span></label>
        <div className="marketing-settings-actions span-2"><button onClick={() => openModal("settings", settings)} type="button">Edit clinic details</button><button className="marketing-primary-button" disabled={saving} onClick={() => { void save(); }} type="button"><Save size={16} /> {saving ? "Saving…" : "Save settings"}</button></div>
      </section>
      <aside className="marketing-provider-panel">
        <div className="marketing-section-heading"><div><h2>Delivery providers</h2><p>Credentials stay on the secure server.</p></div></div>
        <article><span className="email"><Mail size={18} /></span><div><strong>Email provider</strong><p>Readiness is checked by the server before delivery.</p></div><StatusPill value="Server managed" /></article>
        <article><span className="sms"><MessageSquareText size={18} /></span><div><strong>Text message provider</strong><p>{Number(settings.smsCredits || 0).toLocaleString("en-PH")} credits currently available.</p></div><StatusPill value="Server managed" /></article>
        <div className="marketing-security-note"><CircleAlert size={17} /><p>Provider keys and credentials are never stored in this browser.</p></div>
      </aside>
    </div>
  );
}

function CampaignBuilder({ askConfirm, audienceMembers = [], branches = [], canApproveMarketing, clients, draft, loadMedia, notify, onBack, onOpenDashboard, onSaveCampaign, onSaveTemplate, onScheduleCampaign, setDraft, settings, templates, uploadImage }) {
  const [selectedId, setSelectedId] = useState(draft.blocks[2]?.id || draft.blocks[0]?.id || "");
  const [preview, setPreview] = useState("desktop");
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [audiencePreviewOpen, setAudiencePreviewOpen] = useState(false);
  const [sendTestOpen, setSendTestOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [deletedNotice, setDeletedNotice] = useState("");
  const [activeUploads, setActiveUploads] = useState(0);
  const [settingsTab, setSettingsTab] = useState("content");
  const [libraryTab, setLibraryTab] = useState("blocks");
  const [sectionTab, setSectionTab] = useState("prebuilt");
  const [dragState, setDragState] = useState(null);
  const [insertTarget, setInsertTarget] = useState(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [saveState, setSaveState] = useState(draft.id ? "Saved to campaign" : "Local recovery draft");
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const campaignIdRef = useRef(draft.id || "");
  const campaignPersistedRef = useRef(Boolean(draft.id));
  const draftRef = useRef(draft);
  const saveChainRef = useRef(Promise.resolve());
  const saveRequestRef = useRef(0);
  const autosaveTimerRef = useRef(null);
  const finalizingScheduleRef = useRef(false);
  const lastSavedSignatureRef = useRef(draft.id ? JSON.stringify({ ...draft, updatedAt: undefined }) : "");
  const htmlFileInput = useRef(null);
  const selectedBlock = findEmailBlock(draft.blocks, selectedId) ?? draft.blocks[0];
  const recipients = useMemo(
    () => audienceRecipients(clients, audienceMembers, draft.segment, draft.channel, draft.branch),
    [audienceMembers, clients, draft.branch, draft.channel, draft.segment],
  );
  const estimate = recipients.length;
  const warnings = campaignWarnings(draft);
  const advisories = campaignAdvisories(draft);
  const approvalRequired = !canApproveMarketing && settings.managerApproval !== false;
  const saveContextRef = useRef({ approvalRequired, notify, onSaveCampaign, settings });
  const contentBlocks = flattenEmailBlocks(draft.blocks);
  const linkCount = contentBlocks.filter((block) => String(block.link || "").trim()).length;
  const mergeTagCount = (JSON.stringify(contentBlocks).match(/{{\s*[a-zA-Z0-9_]+(?:\s*\|\s*[^{}]+)?\s*}}/g) || []).length;
  const visualEmailHtml = useMemo(
    () => buildVisualEmailHtml(draft, settings, typeof window === "undefined" ? "https://app.macebydrmace.com" : window.location.origin),
    [draft, settings],
  );
  const importedHtmlResult = useMemo(() => sanitizeImportedEmailHtml(draft.html), [draft.html]);
  const emailPreviewHtml = useMemo(
    () => previewPersonalizedHtml(draft.editorMode === "html" ? importedHtmlResult.html : visualEmailHtml),
    [draft.editorMode, importedHtmlResult.html, visualEmailHtml],
  );
  const draftSignature = useMemo(() => JSON.stringify({ ...draft, updatedAt: undefined }), [draft]);

  useEffect(() => { draftRef.current = draft; campaignIdRef.current = draft.id || campaignIdRef.current; }, [draft]);
  useEffect(() => {
    saveContextRef.current = { approvalRequired, notify, onSaveCampaign, settings };
  }, [approvalRequired, notify, onSaveCampaign, settings]);

  function updateDraft(patch) {
    setDraft((current) => {
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      draftRef.current = next;
      return next;
    });
  }

  function updateTheme(patch) {
    function applyThemeToBlocks(blocks) {
      return blocks.map((block) => {
        if (block.type === "layout") return { ...block, columns: block.columns.map(applyThemeToBlocks) };
        const next = { ...block };
        if (patch.textColor) next.color = patch.textColor;
        if (patch.fontFamily && ["heading", "text", "footer", "contact"].includes(block.type)) next.fontFamily = patch.fontFamily;
        if (patch.headingFontFamily && block.type === "heading") next.fontFamily = patch.headingFontFamily;
        if (patch.headingColor && block.type === "heading") next.color = patch.headingColor;
        if (patch.baseFontSize && ["text", "contact"].includes(block.type)) next.fontSize = patch.baseFontSize;
        if (patch.buttonBackground && ["button", "survey"].includes(block.type)) next.background = patch.buttonBackground;
        if (patch.buttonTextColor && ["button", "survey"].includes(block.type)) next.textColor = patch.buttonTextColor;
        if (patch.dividerColor && block.type === "divider") next.color = patch.dividerColor;
        if (patch.sectionPadding && block.type !== "spacer") next.padding = patch.sectionPadding;
        return next;
      });
    }
    commitDesign({
      theme: { ...defaultEmailTheme, ...draft.theme, ...patch },
      blocks: Object.keys(patch).some((key) => ["textColor", "fontFamily", "headingFontFamily", "headingColor", "baseFontSize", "buttonBackground", "buttonTextColor", "dividerColor", "sectionPadding"].includes(key)) ? applyThemeToBlocks(draft.blocks) : draft.blocks,
    });
  }

  function selectEditorMode(editorMode) {
    if (editorMode === "html") {
      updateDraft({ editorMode, html: draft.htmlIsCustom && draft.html ? draft.html : visualEmailHtml });
      return;
    }
    if (draft.editorMode !== "html") return;
    updateDraft({ editorMode: "visual" });
    notify?.("Visual design restored. Your HTML source is still saved in the HTML tab.");
  }

  function convertHtmlToVisualBlocks() {
    const converted = importedEmailHtmlToBlocks(draft.html, createBlockId);
    if (converted.error) {
      notify?.(converted.error, "error");
      return;
    }
    const applyConversion = () => {
      commitBlocks((converted.blocks.length ? converted.blocks : [newBlock("code")]).map(normalizedDesignBlock).filter(Boolean));
      updateDraft({ editorMode: "visual", html: converted.html, htmlIsCustom: true });
      setSelectedId(converted.blocks[0]?.id || "");
      notify?.(converted.removed ? `HTML converted to editable blocks after removing ${converted.removed} unsupported item${converted.removed === 1 ? "" : "s"}.` : "HTML converted to editable blocks.");
    };
    if (askConfirm) {
      askConfirm({
        title: "Replace the visual design with HTML?",
        copy: "This converts the current HTML into editable blocks and replaces the visual block layout. You can undo the conversion until the page is reloaded.",
        actionLabel: "Replace visual design",
        onConfirm: applyConversion,
      });
      return;
    }
    applyConversion();
  }

  async function importHtmlFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== "text/html") {
      notify?.("Choose an HTML or HTM file.", "error");
      return;
    }
    if (file.size > MAX_EMAIL_HTML_LENGTH) {
      notify?.(`HTML files must be ${MAX_EMAIL_HTML_LENGTH.toLocaleString("en-US")} bytes or smaller.`, "error");
      return;
    }
    const result = sanitizeImportedEmailHtml(await file.text());
    if (result.error) {
      notify?.(result.error, "error");
      return;
    }
    const applyImport = () => {
      updateDraft({ editorMode: "html", html: result.html, htmlIsCustom: true });
      notify?.(result.removed ? `HTML imported and cleaned. ${result.removed} unsupported item${result.removed === 1 ? "" : "s"} removed.` : "HTML imported.");
    };
    if (askConfirm && (draft.html.trim() || draft.blocks.length)) {
      askConfirm({
        title: "Replace the current email?",
        copy: "The imported HTML will become the active design. Your current saved campaign remains recoverable from its latest autosave.",
        actionLabel: "Import HTML",
        onConfirm: applyImport,
      });
      return;
    }
    applyImport();
  }

  function cleanImportedHtml() {
    if (importedHtmlResult.error) {
      notify?.(importedHtmlResult.error, "error");
      return;
    }
    updateDraft({ html: importedHtmlResult.html });
    notify?.(importedHtmlResult.removed ? `HTML cleaned. ${importedHtmlResult.removed} unsupported item${importedHtmlResult.removed === 1 ? "" : "s"} removed.` : "HTML is already clean.");
  }

  function exportEmailHtml() {
    const result = sanitizeImportedEmailHtml(draft.editorMode === "html" ? draft.html : visualEmailHtml);
    if (result.error) {
      notify?.(result.error, "error");
      return;
    }
    const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `${draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mace-campaign"}.html`;
    link.click();
    URL.revokeObjectURL(objectUrl);
    notify?.("Email HTML exported.");
  }

  function commitBlocks(nextBlocks) {
    const current = draftRef.current;
    undoStack.current.push({ blocks: current.blocks, theme: current.theme });
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
    updateDraft({ blocks: nextBlocks });
  }

  function commitDesign(patch) {
    undoStack.current.push({ blocks: draft.blocks, theme: draft.theme });
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
    updateDraft(patch);
  }

  function updateSelected(patch) {
    commitBlocks(updateEmailBlock(draft.blocks, selectedId, patch));
  }

  function replaceBlockImage(blockId, src) {
    const current = draftRef.current;
    commitBlocks(updateEmailBlock(current.blocks, blockId, { src }));
    setSelectedId(blockId);
  }

  const changeActiveUploads = useCallback((uploading) => {
    setActiveUploads((count) => Math.max(0, count + (uploading ? 1 : -1)));
  }, []);

  function addBlock(type, target = insertTarget) {
    const block = newBlock(type);
    const containerId = target?.containerId || ROOT_EMAIL_CONTAINER;
    const targetIndex = target?.index ?? draft.blocks.length;
    if (block.type === "layout" && containerId !== ROOT_EMAIL_CONTAINER) {
      setDragAnnouncement("Layouts can only be added to the main email canvas.");
      return;
    }
    const next = insertEmailBlock(draft.blocks, containerId, targetIndex, block);
    commitBlocks(next);
    setSelectedId(block.id);
    setInsertTarget(null);
    setDragAnnouncement(`${block.type === "layout" ? `${block.columns.length}-column layout` : blockDefinitions.find((item) => item.type === type)?.label || "Block"} added.`);
  }

  function addSection(type, target = insertTarget) {
    const section = newSection(type);
    const containerId = target?.containerId || ROOT_EMAIL_CONTAINER;
    if (containerId !== ROOT_EMAIL_CONTAINER) {
      setDragAnnouncement("Sections can only be added to the main email canvas.");
      return;
    }
    const targetIndex = target?.index ?? draft.blocks.length;
    commitBlocks(insertEmailBlock(draft.blocks, ROOT_EMAIL_CONTAINER, targetIndex, section));
    setSelectedId(section.id);
    setInsertTarget(null);
    setDragAnnouncement(`${sectionDefinitions.find((item) => item.type === type)?.label || "Section"} added.`);
  }

  function duplicateBlock(id) {
    const location = findEmailBlockLocation(draft.blocks, id);
    if (!location) return;
    const copy = cloneEmailBlock(location.block);
    const next = insertEmailBlock(draft.blocks, location.containerId, location.index + 1, copy);
    commitBlocks(next);
    setSelectedId(copy.id);
    setDragAnnouncement("Block duplicated.");
  }

  function deleteBlock(id) {
    const location = findEmailBlockLocation(draft.blocks, id);
    if (!location || (location.containerId === ROOT_EMAIL_CONTAINER && draft.blocks.length === 1)) return;
    const remove = () => {
      const removed = removeEmailBlock(draft.blocks, id);
      commitBlocks(removed.blocks);
      const nextSelection = findEmailBlock(removed.blocks, removed.blocks[Math.max(0, location.index - 1)]?.id)
        || (location.containerId !== ROOT_EMAIL_CONTAINER ? findEmailBlock(removed.blocks, String(location.containerId).split("::column::")[0]) : null)
        || flattenEmailBlocks(removed.blocks, true)[0];
      setSelectedId(nextSelection?.id || "");
      setDeletedNotice(`${location.block.type === "layout" ? "Section" : "Block"} deleted.`);
      setDragAnnouncement("Block deleted. Undo is available.");
    };
    const nestedCount = location.block.type === "layout" ? flattenEmailBlocks(location.block.columns?.flat() || []).length : 0;
    if (location.block.type === "layout" && nestedCount > 1 && askConfirm) {
      askConfirm({
        title: "Delete this section?",
        copy: `This section contains ${nestedCount} content blocks. Only this section and its nested content will be removed.`,
        actionLabel: "Delete section",
        onConfirm: remove,
      });
      return;
    }
    remove();
  }

  function moveBlock(id, direction) {
    const location = findEmailBlockLocation(draft.blocks, id);
    if (!location) return;
    const target = location.index + direction;
    const containerLength = location.containerId === ROOT_EMAIL_CONTAINER
      ? draft.blocks.length
      : (findEmailBlock(draft.blocks, String(location.containerId).split("::column::")[0])?.columns?.[Number(String(location.containerId).split("::column::")[1])]?.length || 0);
    if (target < 0 || target >= containerLength) return;
    const next = moveEmailBlock(draft.blocks, id, location.containerId, target + (direction > 0 ? 1 : 0));
    commitBlocks(next);
    setDragAnnouncement(`Block moved ${direction < 0 ? "up" : "down"}.`);
  }

  function undo() {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push({ blocks: draft.blocks, theme: draft.theme });
    updateDraft(Array.isArray(previous) ? { blocks: previous } : previous);
    setDeletedNotice("");
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ blocks: draft.blocks, theme: draft.theme });
    updateDraft(Array.isArray(next) ? { blocks: next } : next);
  }

  function dropOnCanvas(event, target = { containerId: ROOT_EMAIL_CONTAINER, index: draft.blocks.length }) {
    event.preventDefault();
    event.stopPropagation();
    const definitionType = event.dataTransfer.getData("application/x-marketing-block-type");
    const sectionType = event.dataTransfer.getData("application/x-marketing-section-type");
    const blockId = event.dataTransfer.getData("application/x-marketing-block-id");
    if (sectionType) {
      addSection(sectionType, target);
      setDragState(null);
      return;
    }
    if (definitionType) {
      addBlock(definitionType, target);
      setDragState(null);
      return;
    }
    if (!blockId) return;
    const movingBlock = findEmailBlock(draft.blocks, blockId);
    if (movingBlock?.type === "layout" && target.containerId !== ROOT_EMAIL_CONTAINER) {
      setDragAnnouncement("Layouts stay on the main canvas and cannot be nested inside columns.");
      setDragState(null);
      return;
    }
    const next = moveEmailBlock(draft.blocks, blockId, target.containerId, target.index);
    if (next === draft.blocks) {
      setDragState(null);
      return;
    }
    commitBlocks(next);
    setSelectedId(blockId);
    setDragAnnouncement("Block moved to its new position.");
    setDragState(null);
  }

  function startLibraryDrag(event, type) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-marketing-block-type", type);
    setDragState({ kind: "library", type, over: null });
    setDragAnnouncement(`Dragging ${type.startsWith("layout-") ? "layout" : blockDefinitions.find((item) => item.type === type)?.label || "block"}.`);
  }

  function startSectionDrag(event, type) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-marketing-section-type", type);
    setDragState({ kind: "library", type, over: null });
    setDragAnnouncement(`Dragging ${sectionDefinitions.find((item) => item.type === type)?.label || "section"}.`);
  }

  function startCanvasDrag(event, blockId) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-marketing-block-id", blockId);
    setSelectedId(blockId);
    setDragState({ kind: "canvas", blockId, over: null });
    setDragAnnouncement("Dragging selected block. Move to an insertion line and drop.");
  }

  function endDrag() {
    setDragState(null);
  }

  function dropOnManagedSection(event, index) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const placeAfter = event.clientY > bounds.top + (bounds.height / 2);
    dropOnCanvas(event, { containerId: ROOT_EMAIL_CONTAINER, index: index + (placeAfter ? 1 : 0) });
  }

  const saveDraft = useCallback(({ silent = false, statusOverride = "" } = {}) => {
    const snapshot = draftRef.current;
    const pendingCampaignId = campaignIdRef.current || snapshot.id || createBlockId("cmp");
    campaignIdRef.current = pendingCampaignId;
    const requestId = ++saveRequestRef.current;
    const signature = JSON.stringify({ ...snapshot, id: pendingCampaignId, updatedAt: undefined });
    setSaveState("Saving…");
    const run = async () => {
      const saveContext = saveContextRef.current;
      const campaignSnapshot = { ...snapshot, id: pendingCampaignId };
      const generatedHtml = snapshot.channel === "SMS" ? "" : buildVisualEmailHtml(campaignSnapshot, saveContext.settings, typeof window === "undefined" ? "https://app.macebydrmace.com" : window.location.origin);
      const emailResult = snapshot.channel === "SMS"
        ? { html: "", error: "", removed: 0 }
        : sanitizeImportedEmailHtml(snapshot.editorMode === "html" ? snapshot.html : generatedHtml);
      if (emailResult.error) throw new Error(emailResult.error);
      if (emailResult.removed) throw new Error("Clean unsupported or unsafe HTML before saving this campaign.");
      const emailSummary = emailHtmlToPlainText(emailResult.html);
      const message = snapshot.channel === "Email" ? emailSummary : snapshot.message;
      const savedCampaign = await saveContext.onSaveCampaign?.({
        id: pendingCampaignId,
        branch: snapshot.branch,
        name: snapshot.name,
        segment: snapshot.segment,
        channel: snapshot.channel,
        templateId: "",
        subject: snapshot.subject,
        message,
        html: emailResult.html,
          design: {
            version: 2,
            editorMode: snapshot.editorMode,
            htmlIsCustom: snapshot.htmlIsCustom === true,
            previewText: snapshot.previewText,
          blocks: snapshot.blocks,
          theme: snapshot.theme,
        },
        scheduledAt: snapshot.scheduledAt || null,
        managerApproval: saveContext.approvalRequired,
        sent: Number(snapshot.sent || 0),
        booked: Number(snapshot.booked || 0),
        credits: Number(snapshot.credits || 0),
        status: statusOverride || snapshot.status || "Draft",
      }, { existing: campaignPersistedRef.current, silent: true });
      if (savedCampaign?.id) {
        campaignPersistedRef.current = true;
        campaignIdRef.current = savedCampaign.id;
        setDraft((current) => ({ ...current, id: savedCampaign.id, status: savedCampaign.status || current.status, updatedAt: savedCampaign.updatedAt || new Date().toISOString() }));
      }
      if (requestId === saveRequestRef.current) {
        lastSavedSignatureRef.current = signature;
        setSaveState(`Saved to campaign · ${new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`);
      }
      if (!silent) saveContext.notify?.("Campaign saved.");
      return savedCampaign;
    };
    const queued = saveChainRef.current.catch(() => undefined).then(run).catch((error) => {
      if (requestId === saveRequestRef.current) setSaveState("Save failed · local recovery kept");
      if (!silent) saveContextRef.current.notify?.(error.message || "Unable to save the campaign.", "error");
      throw error;
    });
    saveChainRef.current = queued;
    return queued;
  }, [setDraft]);

  useEffect(() => {
    if (finalizingScheduleRef.current || !draft.name.trim() || !draft.segment || draftSignature === lastSavedSignatureRef.current) return undefined;
    setSaveState("Unsaved changes");
    const timer = window.setTimeout(() => { void saveDraft({ silent: true }).catch(() => undefined); }, 1100);
    autosaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [draft.name, draft.segment, draftSignature, saveDraft]);

  useEffect(() => {
    function warnBeforeLeave(event) {
      if (draftSignature === lastSavedSignatureRef.current || saveState.startsWith("Saved to campaign")) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [draftSignature, saveState]);

  async function continueStep() {
    if (activeUploads > 0) {
      notify?.("Wait for the current image upload to finish before continuing.", "error");
      return;
    }
    if (draft.step === 4) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (!draft.scheduledAt || Number.isNaN(new Date(draft.scheduledAt).getTime())) {
        notify?.("Choose a valid delivery date and time.", "error");
        return;
      }
      if (new Date(draft.scheduledAt).getTime() <= Date.now()) {
        notify?.("Choose a delivery time in the future.", "error");
        return;
      }
      finalizingScheduleRef.current = true;
      try {
        const savedCampaign = await saveDraft({ statusOverride: "Draft" });
        if (!onScheduleCampaign) throw new Error("Campaign scheduling is not available right now.");
        const result = await onScheduleCampaign(savedCampaign.id, new Date(draft.scheduledAt).toISOString());
        setDraft((current) => {
          const next = {
            ...current,
            managerApproval: result.campaign.managerApproval,
            scheduledAt: localDateTimeInput(result.campaign.scheduledAt || current.scheduledAt),
            status: result.campaign.status,
            updatedAt: result.campaign.updatedAt || new Date().toISOString(),
          };
          draftRef.current = next;
          lastSavedSignatureRef.current = JSON.stringify({ ...next, updatedAt: undefined });
          return next;
        });
        finalizingScheduleRef.current = false;
        notify?.(result.approvalRequired ? "Campaign submitted to an administrator for approval." : "Campaign scheduled and added to the delivery queue.");
      } catch (error) {
        finalizingScheduleRef.current = false;
        notify?.(error.message || "Unable to schedule this campaign.", "error");
        return;
      }
      return;
    }
    if (draft.step === 1 && (!draft.name.trim() || !draft.segment)) {
      notify?.("Add a campaign name and choose an audience before continuing.", "error");
      return;
    }
    if (draft.step === 2 && warnings.length) {
      notify?.("Resolve the campaign checks before review.", "error");
      return;
    }
    const advance = async () => {
      try {
        await saveDraft({ silent: true });
        updateDraft({ step: Math.min(4, draft.step + 1) });
      } catch {
        notify?.("Save the campaign successfully before continuing.", "error");
      }
    };
    if (draft.step === 2 && advisories.length && askConfirm) {
      askConfirm({
        title: "Continue with recommendations?",
        copy: advisories.join(" "),
        actionLabel: "Save and continue",
        onConfirm: () => { void advance(); },
      });
      return;
    }
    await advance();
  }

  async function saveSelectedSection() {
    if (!selectedBlock) return;
    try {
      const sectionBlocks = [cloneEmailBlock(selectedBlock)];
      const sectionDraft = { ...draft, blocks: sectionBlocks };
      const html = buildVisualEmailHtml(sectionDraft, settings, typeof window === "undefined" ? "https://app.macebydrmace.com" : window.location.origin);
      await onSaveTemplate?.({
        name: `Saved ${selectedBlock.type === "layout" ? "section" : selectedBlock.type}`,
        description: "Reusable section saved from the MACE visual email builder.",
        thumbnail: flattenEmailBlocks(sectionBlocks).find((block) => block.src)?.src || "",
        editorMode: "visual",
        html,
        design: { version: 2, editorMode: "visual", blocks: sectionBlocks, theme: draft.theme },
      });
      notify?.("Section saved to the shared Templates library.");
    } catch (error) {
      notify?.(error.message || "Unable to save this section.", "error");
    }
  }

  return (
    <div className={`marketing-builder builder-step-${draft.step}`}>
      <header className="marketing-builder-header">
        <div className="marketing-builder-title">
          <button className="marketing-global-menu" onClick={onOpenDashboard} type="button" aria-label="Return to MACE dashboard"><Menu size={20} /></button>
          <button className="marketing-back-button" onClick={onBack} type="button" aria-label="Back to campaigns"><ArrowLeft size={18} /></button>
          <div><p>Campaigns <ChevronRight size={13} /> Create campaign</p><h1>{draft.name || "Untitled campaign"} <StatusPill value={draft.status || "Draft"} /></h1></div>
          <label className="marketing-builder-branch"><span>Branch</span><select aria-label="Campaign branch" value={draft.branch || ""} onChange={(event) => updateDraft({ branch: event.target.value })}><option value="" disabled>Select a branch</option>{draft.id && draft.branch === "All branches" ? <option value="All branches">Organization-wide legacy</option> : null}{branches.map((branch) => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></label>
        </div>
        <div className="marketing-builder-actions"><span>{saveState}</span>{draft.step >= 2 && draft.channel !== "SMS" ? <button className="marketing-preview-email-button" onClick={() => setEmailPreviewOpen(true)} type="button"><Eye size={16} aria-hidden="true" /> Preview email</button> : null}<button onClick={() => { void saveDraft().catch(() => undefined); }} type="button">Save draft</button>{draft.step >= 2 && draft.channel !== "SMS" ? <button className="marketing-send-test-button" onClick={() => setSendTestOpen(true)} type="button">Send test</button> : null}<button className="marketing-primary-button" onClick={() => { void continueStep(); }} type="button">{draft.step === 4 ? "Confirm schedule" : "Continue"}</button></div>
      </header>
      <nav className="marketing-stepper" aria-label="Campaign progress">
        {campaignSteps.map((step, index) => {
          const number = index + 1;
          const completed = number < draft.step;
          return <button className={number === draft.step ? "active" : completed ? "completed" : ""} key={step} onClick={() => number <= draft.step && updateDraft({ step: number })} type="button"><span>{completed ? <Check size={15} /> : number}</span><b>{step}</b><i /></button>;
        })}
      </nav>
      {draft.step === 1 && <AudienceStep clients={clients} draft={draft} estimate={estimate} updateDraft={updateDraft} />}
      {draft.step === 2 && draft.channel === "SMS" && <SmsDesignStep draft={draft} templates={templates} updateDraft={updateDraft} warnings={warnings} />}
      {draft.step === 2 && draft.channel !== "SMS" && (
        <div className="marketing-email-editor-toolbar">
          <div className="marketing-editor-mode" role="tablist" aria-label="Email editor mode">
            <button aria-selected={draft.editorMode !== "html"} className={draft.editorMode !== "html" ? "active" : ""} onClick={() => selectEditorMode("visual")} role="tab" type="button"><PanelLeft size={16} /> Design</button>
            <button aria-selected={draft.editorMode === "html"} className={draft.editorMode === "html" ? "active" : ""} onClick={() => selectEditorMode("html")} role="tab" type="button"><Code2 size={16} /> HTML</button>
          </div>
          <div className="marketing-html-actions">
            <input accept=".html,.htm,text/html" hidden onChange={importHtmlFile} ref={htmlFileInput} type="file" />
            <button onClick={() => htmlFileInput.current?.click()} type="button"><Upload size={16} /> Import HTML</button>
            <button onClick={exportEmailHtml} type="button"><Download size={16} /> Export HTML</button>
          </div>
        </div>
      )}
      {draft.step === 2 && draft.channel !== "SMS" && draft.editorMode !== "html" && (
        <div className="marketing-builder-grid">
          <aside className={`marketing-block-library ${insertTarget ? "choosing-insert" : ""}`}>
            <nav className="marketing-builder-rail" aria-label="Email builder tools">
              {[
                { id: "blocks", label: "Blocks", icon: LayoutDashboard },
                { id: "sections", label: "Sections", icon: PanelLeft },
                { id: "styles", label: "Styles", icon: Settings },
                { id: "optimize", label: "Optimize", icon: Sparkles },
              ].map(({ id, label, icon: Icon }) => <button aria-pressed={libraryTab === id} className={libraryTab === id ? "active" : ""} key={id} onClick={() => setLibraryTab(id)} type="button"><Icon size={21} /><span>{label}</span>{id === "optimize" && warnings.length > 0 && <i>{warnings.length}</i>}</button>)}
            </nav>
            <div className="marketing-library-panel">
              {insertTarget && <div className="marketing-insert-notice"><span><strong>Choose content</strong><small>It will be inserted at the selected line.</small></span><button onClick={() => setInsertTarget(null)} type="button" aria-label="Cancel insertion"><X size={15} /></button></div>}
              {libraryTab === "blocks" && <>
                <span className="marketing-builder-help"><CircleAlert size={13} /> How to use this builder</span>
                <div className="marketing-library-heading"><h2>Content blocks</h2><p>Drag to add content to your email</p></div>
                <div className="marketing-block-grid">
                  {blockDefinitions.filter(({ type }) => type !== "apps").map(({ type, label, icon: Icon }) => <button draggable key={type} onClick={() => addBlock(type)} onDragEnd={endDrag} onDragStart={(event) => startLibraryDrag(event, type)} type="button" aria-label={`Drag or click to add ${label}`}><Icon size={20} /><span>{label}</span></button>)}
                </div>
                <div className="marketing-coming-soon-tool"><LayoutDashboard size={17} /><span><strong>Apps integrations</strong><small>Coming soon after an approved content provider is connected.</small></span></div>
                <section className="marketing-library-section">
                  <div className="marketing-library-heading with-badge"><div><h2>AI-Generated columns</h2><p>Drag to add layouts to your email</p></div><span>New</span></div>
                  <div className="marketing-ai-layouts">
                    {aiSectionDefinitions.map(({ type, label, icon: Icon }) => <button draggable key={type} onClick={() => addSection(type)} onDragEnd={endDrag} onDragStart={(event) => startSectionDrag(event, type)} type="button"><Icon size={15} /><span>{label}</span></button>)}
                  </div>
                </section>
                <section className="marketing-library-section">
                  <div className="marketing-library-heading"><h2>Columns</h2><p>Drag to add a column container to your email</p></div>
                  <div className="marketing-layout-grid">
                    {layoutDefinitions.map((layout) => <button draggable key={layout.type} onClick={() => addBlock(layout.type)} onDragEnd={endDrag} onDragStart={(event) => startLibraryDrag(event, layout.type)} type="button" aria-label={`Drag or click to add ${layout.label}`}><span style={{ gridTemplateColumns: layout.widths.map((width) => `${width}fr`).join(" ") }}>{layout.widths.map((_width, index) => <i key={index} />)}</span><strong>{layout.label}</strong></button>)}
                  </div>
                </section>
              </>}
              {libraryTab === "sections" && <>
                <div className="marketing-library-heading"><h2>Email Sections</h2><p>Create and edit your email structure, or insert pre-built sections.</p></div>
                <div className="marketing-section-tabs" role="tablist" aria-label="Section library">
                  {["manage", "prebuilt", "saved"].map((tab) => <button aria-selected={sectionTab === tab} className={sectionTab === tab ? "active" : ""} key={tab} onClick={() => setSectionTab(tab)} role="tab" type="button">{tab === "prebuilt" ? "Pre-built" : `${tab[0].toUpperCase()}${tab.slice(1)}`}</button>)}
                </div>
                {sectionTab === "manage" && <div className="marketing-manage-sections">
                  {draft.blocks.map((block, index) => {
                    const label = block.type === "layout" ? `Section ${index + 1}` : blockDefinitions.find((item) => item.type === block.type)?.label || "Section";
                    const dropKey = `manage:${index}`;
                    return <div className={`marketing-manage-section-row${selectedId === block.id ? " active" : ""}${dragState?.blockId === block.id ? " dragging" : ""}${dragState?.over === dropKey ? " drop-target" : ""}`} data-block-id={block.id} draggable key={block.id} onDragEnd={endDrag} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragState((current) => current ? { ...current, over: dropKey } : current); }} onDragStart={(event) => startCanvasDrag(event, block.id)} onDrop={(event) => dropOnManagedSection(event, index)}>
                      <button className="marketing-manage-section-select" onClick={() => setSelectedId(block.id)} type="button"><GripVertical className="marketing-manage-section-grip" size={15} /><span><strong>{label}</strong><small>{block.type === "layout" ? `${block.columns.length} column${block.columns.length === 1 ? "" : "s"}` : "Content block"}</small></span><ChevronRight size={15} /></button>
                      <span className="marketing-manage-section-actions"><button aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => moveBlock(block.id, -1)} type="button"><MoveUp size={14} /></button><button aria-label={`Move ${label} down`} disabled={index === draft.blocks.length - 1} onClick={() => moveBlock(block.id, 1)} type="button"><MoveDown size={14} /></button></span>
                    </div>;
                  })}
                  <button className="add" onClick={() => addBlock("layout-1")} type="button"><Plus size={16} /><span><strong>Add blank section</strong><small>Start with one empty column</small></span></button>
                </div>}
                {sectionTab === "prebuilt" && <div className="marketing-prebuilt-sections">
                  {sectionDefinitions.map(({ type, label, preset, description, icon: Icon }) => <article key={type}><div><span><Icon size={16} /></span><p><strong>{label}</strong><small>{description}</small></p></div><button draggable onClick={() => addSection(type)} onDragEnd={endDrag} onDragStart={(event) => startSectionDrag(event, type)} type="button"><span>{preset}</span><Plus size={15} /></button></article>)}
                </div>}
                {sectionTab === "saved" && <div className="marketing-saved-library"><Sparkles size={23} /><h3>Reusable MACE sections</h3><p>Select a section on the canvas, then save it for another campaign.</p><button disabled={!selectedBlock} onClick={() => { void saveSelectedSection(); }} type="button">Save selected section</button></div>}
              </>}
              {libraryTab === "styles" && <>
                <div className="marketing-library-heading"><h2>Email styles</h2><p>Edit the look of your entire email</p></div>
                <div className="marketing-global-styles">
                  <details open><summary><span>Background</span><ChevronDown size={15} /></summary><div className="marketing-style-fields"><ColorField label="Content color" value={draft.theme?.contentBackground || defaultEmailTheme.contentBackground} onChange={(contentBackground) => updateTheme({ contentBackground })} /><ColorField label="Background color" value={draft.theme?.canvasBackground || defaultEmailTheme.canvasBackground} onChange={(canvasBackground) => updateTheme({ canvasBackground })} /><label><span>Content width</span><div className="marketing-input-suffix"><input max="760" min="480" onChange={(event) => updateTheme({ contentWidth: Number(event.target.value) })} type="number" value={draft.theme?.contentWidth || defaultEmailTheme.contentWidth} /><span>px</span></div></label><label><span>Mobile padding</span><div className="marketing-input-suffix"><input max="40" min="0" onChange={(event) => updateTheme({ mobilePadding: Number(event.target.value) })} type="number" value={draft.theme?.mobilePadding ?? defaultEmailTheme.mobilePadding} /><span>px</span></div></label></div></details>
                  <details><summary><span>Typography</span><ChevronDown size={15} /></summary><div className="marketing-style-fields"><label><span>Primary font</span><select onChange={(event) => updateTheme({ fontFamily: event.target.value })} value={draft.theme?.fontFamily || defaultEmailTheme.fontFamily}><option>Arial</option><option>Georgia</option><option>Inter</option><option>Verdana</option></select></label><label><span>Heading font</span><select onChange={(event) => updateTheme({ headingFontFamily: event.target.value })} value={draft.theme?.headingFontFamily || defaultEmailTheme.headingFontFamily}><option>Georgia</option><option>Arial</option><option>Inter</option><option>Verdana</option></select></label><NumberField label="Base font size" min={11} max={24} value={draft.theme?.baseFontSize || defaultEmailTheme.baseFontSize} onChange={(baseFontSize) => updateTheme({ baseFontSize })} /><ColorField label="Text color" value={draft.theme?.textColor || defaultEmailTheme.textColor} onChange={(textColor) => updateTheme({ textColor })} /><ColorField label="Heading color" value={draft.theme?.headingColor || defaultEmailTheme.headingColor} onChange={(headingColor) => updateTheme({ headingColor })} /></div></details>
                  <details><summary><span>Link</span><ChevronDown size={15} /></summary><div className="marketing-style-fields"><ColorField label="Link color" value={draft.theme?.linkColor || defaultEmailTheme.linkColor} onChange={(linkColor) => updateTheme({ linkColor })} /></div></details>
                  <details><summary><span>Button</span><ChevronDown size={15} /></summary><div className="marketing-style-fields"><ColorField label="Button color" value={draft.theme?.buttonBackground || defaultEmailTheme.buttonBackground} onChange={(buttonBackground) => updateTheme({ buttonBackground })} /><ColorField label="Button text" value={draft.theme?.buttonTextColor || defaultEmailTheme.buttonTextColor} onChange={(buttonTextColor) => updateTheme({ buttonTextColor })} /></div></details>
                  <details><summary><span>Spacing and dividers</span><ChevronDown size={15} /></summary><div className="marketing-style-fields"><ColorField label="Divider color" value={draft.theme?.dividerColor || defaultEmailTheme.dividerColor} onChange={(dividerColor) => updateTheme({ dividerColor })} /><NumberField label="Default block padding" min={0} max={60} value={draft.theme?.sectionPadding ?? defaultEmailTheme.sectionPadding} onChange={(sectionPadding) => updateTheme({ sectionPadding })} /></div></details>
                  {[["Image", "Set links and alternative text on each image block."], ["Logo", "Edit your logo destination and spacing on the canvas."]].map(([label, copy]) => <details key={label}><summary><span>{label}</span><ChevronDown size={15} /></summary><p>{copy}</p></details>)}
                </div>
              </>}
              {libraryTab === "optimize" && <>
                <div className="marketing-library-heading with-badge"><div><h2>Optimize</h2><p>Help improve click rates with these email best practices.</p></div><span>New</span></div>
                <div className="marketing-optimization-summary"><button className="active" type="button"><strong>{warnings.length}</strong><span>Errors</span></button><button type="button"><strong>{advisories.length}</strong><span>Advice</span></button><button type="button"><strong>{linkCount}</strong><span>Links</span></button></div>
                <div className="marketing-optimization-list">
                  {warnings.length ? warnings.map((warning) => <article key={warning}><span><CircleAlert size={16} /></span><div><strong>{warning}</strong><p>Review this item before continuing to campaign review.</p></div></article>) : <article className="success"><span><Check size={16} /></span><div><strong>No blocking errors</strong><p>Your subject, content, links and required footer are ready.</p></div></article>}
                  {advisories.map((advisory) => <article key={advisory}><span><Sparkles size={16} /></span><div><strong>{advisory}</strong><p>This recommendation is based on the current campaign content.</p></div></article>)}
                  <article><span><Link size={16} /></span><div><strong>{linkCount} tracked destination{linkCount === 1 ? "" : "s"}</strong><p>{linkCount ? "Review resolved URLs in each block’s Link tracking panel." : "Add a valid destination to every clickable call to action."}</p></div></article>
                  <article><span><Sparkles size={16} /></span><div><strong>{mergeTagCount} personalization token{mergeTagCount === 1 ? "" : "s"}</strong><p>{mergeTagCount ? "Preview uses safe sample values and supports fallbacks." : "Personalization is optional; add tokens only where they improve clarity."}</p></div></article>
                  <article><span><Smartphone size={16} /></span><div><strong>Check the mobile preview</strong><p>Columns automatically stack, but copy length and buttons should still be reviewed.</p><button onClick={() => setPreview("mobile")} type="button">Open mobile preview</button></div></article>
                </div>
              </>}
              {draft.channel === "Email + SMS" && <label className="marketing-companion-message"><span>Companion text message</span><textarea maxLength="480" onChange={(event) => updateDraft({ message: event.target.value })} placeholder="Write the coordinated text message…" rows="6" value={draft.message} /><small>{draft.message.length}/480 characters</small></label>}
            </div>
          </aside>
          <section className={`marketing-canvas-panel ${dragState ? "is-dragging" : ""}`} style={{ background: draft.theme?.canvasBackground || defaultEmailTheme.canvasBackground }}>
            <div className="marketing-canvas-toolbar"><div className="marketing-preview-toggle"><button className={preview === "desktop" ? "active" : ""} onClick={() => setPreview("desktop")} type="button"><Monitor size={16} /> Desktop</button><button className={preview === "tablet" ? "active" : ""} onClick={() => setPreview("tablet")} type="button"><Monitor size={15} /> Tablet</button><button className={preview === "mobile" ? "active" : ""} onClick={() => setPreview("mobile")} type="button"><Smartphone size={16} /> Mobile</button></div><div><button disabled={!undoStack.current.length} onClick={undo} type="button"><Undo2 size={17} /> Undo</button><button disabled={!redoStack.current.length} onClick={redo} type="button"><Redo2 size={17} /> Redo</button></div></div>
            <div className={`marketing-email-frame ${preview}`} style={{ "--marketing-email-button-text": draft.theme?.buttonTextColor || defaultEmailTheme.buttonTextColor, "--marketing-email-link": draft.theme?.linkColor || defaultEmailTheme.linkColor, "--marketing-email-mobile-pad": `${draft.theme?.mobilePadding ?? defaultEmailTheme.mobilePadding}px`, background: draft.theme?.contentBackground || defaultEmailTheme.contentBackground, color: draft.theme?.textColor || defaultEmailTheme.textColor, fontFamily: draft.theme?.fontFamily || defaultEmailTheme.fontFamily, maxWidth: "100%", width: preview === "mobile" ? 390 : preview === "tablet" ? 600 : draft.theme?.contentWidth || defaultEmailTheme.contentWidth }}>
              <div className="marketing-email-preheader">{draft.previewText}</div>
              <EmailCanvasList
                blocks={draft.blocks}
                containerId={ROOT_EMAIL_CONTAINER}
                dragState={dragState}
                notify={notify}
                onDelete={deleteBlock}
                onDragEnd={endDrag}
                onDragStart={startCanvasDrag}
                onDrop={dropOnCanvas}
                onDuplicate={duplicateBlock}
                onImageUploadStateChange={changeActiveUploads}
                onInsert={(target) => { setInsertTarget(target); setLibraryTab("blocks"); }}
                onMove={moveBlock}
                onOver={(over) => setDragState((current) => current ? { ...current, over } : current)}
                onReplaceImage={replaceBlockImage}
                onSelect={setSelectedId}
                preview={preview}
                selectedId={selectedId}
                uploadImage={uploadImage}
              />
              <footer><strong>{settings.company || "MACE Signature Wellness"}</strong><span>Davao City, Philippines · hello@macebydrmace.com</span><a href="#unsubscribe" onClick={(event) => event.preventDefault()}>Unsubscribe</a></footer>
            </div>
            <span className="marketing-drag-announcement" aria-live="polite">{dragAnnouncement}</span>
            {warnings.length > 0 && <div className="marketing-builder-warning"><CircleAlert size={17} /><span>{warnings.length} campaign check{warnings.length === 1 ? "" : "s"} remaining</span></div>}
          </section>
          <BlockSettings block={selectedBlock} loadMedia={loadMedia} notify={notify} onUploadStateChange={changeActiveUploads} settingsTab={settingsTab} setSettingsTab={setSettingsTab} updateBlock={updateSelected} uploadImage={uploadImage} />
        </div>
      )}
      {draft.step === 2 && draft.channel !== "SMS" && draft.editorMode === "html" && (
        <HtmlEmailEditor
          draft={draft}
          htmlResult={importedHtmlResult}
          notify={notify}
          onClean={cleanImportedHtml}
          onConvert={convertHtmlToVisualBlocks}
          preview={preview}
          setPreview={setPreview}
          updateDraft={updateDraft}
        />
      )}
      {draft.step === 3 && <ReviewStep approvalRequired={approvalRequired} canApproveMarketing={canApproveMarketing} draft={draft} estimate={estimate} onViewRecipients={() => setAudiencePreviewOpen(true)} warnings={warnings} updateDraft={updateDraft} />}
      {draft.step === 4 && <ScheduleStep approvalRequired={approvalRequired} canApproveMarketing={canApproveMarketing} draft={draft} estimate={estimate} onViewRecipients={() => setAudiencePreviewOpen(true)} updateDraft={updateDraft} />}
      {draft.step > 1 && <div className="marketing-builder-mobile-footer"><button onClick={() => updateDraft({ step: Math.max(1, draft.step - 1) })} type="button">Back</button><button className="marketing-primary-button" onClick={() => { void continueStep(); }} type="button">{draft.step === 4 ? "Confirm schedule" : "Continue"}</button></div>}
      {draft.step === 2 && draft.channel !== "SMS" && <button className="marketing-save-template" onClick={() => setTemplateDialogOpen(true)} type="button"><Save size={15} /> Save as template</button>}
      {deletedNotice ? <div className="marketing-undo-notice" role="status"><span>{deletedNotice}</span><button onClick={undo} type="button"><Undo2 size={15} /> Undo</button><button aria-label="Dismiss deleted block notice" onClick={() => setDeletedNotice("")} type="button"><X size={15} /></button></div> : null}
      {emailPreviewOpen ? <EmailPreviewDialog error={draft.editorMode === "html" ? importedHtmlResult.error : ""} html={emailPreviewHtml} name={draft.name} onClose={() => setEmailPreviewOpen(false)} previewText={draft.previewText} subject={draft.subject} /> : null}
      {audiencePreviewOpen ? <AudienceRecipientsDialog channel={draft.channel} onClose={() => setAudiencePreviewOpen(false)} recipients={recipients} segment={draft.segment} /> : null}
      {sendTestOpen ? <SendTestDialog draft={draft} html={draft.editorMode === "html" ? importedHtmlResult.html : visualEmailHtml} onClose={() => setSendTestOpen(false)} notify={notify} /> : null}
      {templateDialogOpen ? <SaveTemplateDialog draft={draft} html={draft.editorMode === "html" ? importedHtmlResult.html : visualEmailHtml} onClose={() => setTemplateDialogOpen(false)} onSaveTemplate={onSaveTemplate} notify={notify} /> : null}
    </div>
  );
}

function EmailPreviewDialog({ error, html, name, onClose, previewText, subject }) {
  const [device, setDevice] = useState("desktop");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    function closeWithEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [onClose]);

  return (
    <div aria-label={`Preview ${name || "email campaign"}`} aria-modal="true" className="marketing-email-preview-dialog" role="dialog">
      <button aria-label="Close email preview" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <section>
        <header>
          <div><span>Email preview</span><h2>{name || "Untitled campaign"}</h2></div>
          <button aria-label="Close email preview" onClick={onClose} type="button"><X size={19} aria-hidden="true" /></button>
        </header>
        <div className="marketing-email-preview-toolbar">
          <dl><div><dt>From</dt><dd>MACE Signature Wellness</dd></div><div><dt>Subject</dt><dd>{subject || "No subject"}</dd></div><div><dt>Preview text</dt><dd>{previewText || "No preview text"}</dd></div></dl>
          <div aria-label="Email preview device" className="marketing-preview-toggle" role="group"><button aria-pressed={device === "desktop"} className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} type="button"><Monitor size={16} aria-hidden="true" /> Desktop</button><button aria-pressed={device === "tablet"} className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")} type="button"><Monitor size={15} aria-hidden="true" /> Tablet</button><button aria-pressed={device === "mobile"} className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")} type="button"><Smartphone size={16} aria-hidden="true" /> Mobile</button></div>
        </div>
        <div className="marketing-email-preview-stage">
          {error ? <MarketingEmpty title="Email preview unavailable" copy={error} /> : <div className={`marketing-email-preview-device ${device}`}><iframe sandbox="" srcDoc={html} title={`${name || "Campaign"} email preview`} /></div>}
        </div>
        <footer><span>Personalization uses sample client details in preview.</span><button onClick={onClose} type="button">Close preview</button></footer>
      </section>
    </div>
  );
}

function HtmlEmailEditor({ draft, htmlResult, notify, onClean, onConvert, preview, setPreview, updateDraft }) {
  const sourceRef = useRef(null);
  const previewHtml = previewPersonalizedHtml(htmlResult.html);
  const tokens = ["{{first_name}}", "{{client}}", "{{email}}", "{{branch}}", "{{company}}", "{{date}}"];

  function insertToken(token) {
    const input = sourceRef.current;
    if (!input) {
      updateDraft({ html: `${draft.html}${token}` });
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${draft.html.slice(0, start)}${token}${draft.html.slice(end)}`;
    updateDraft({ html: next });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="marketing-html-editor">
      <aside className="marketing-html-tools">
        <div><FileCode2 size={20} /><strong>Custom HTML</strong><p>Paste a complete email document or import an HTML file. Email-safe tables, inline styles and responsive CSS are preserved.</p></div>
        <section><span>Personalization</span>{tokens.map((token) => <button key={token} onClick={() => insertToken(token)} type="button">{token}</button>)}</section>
        <section className="marketing-html-safety"><span>Safety check</span><strong className={htmlResult.error || htmlResult.removed ? "warning" : "ready"}>{htmlResult.error ? "Needs attention" : htmlResult.removed ? `${htmlResult.removed} item${htmlResult.removed === 1 ? "" : "s"} to remove` : "Email-safe HTML"}</strong><p>{htmlResult.error || (htmlResult.removed ? "Scripts, forms, embedded frames, event handlers and unsafe URLs are not permitted." : "The source is ready for a sandboxed preview and server validation.")}</p><button disabled={Boolean(htmlResult.error)} onClick={onClean} type="button">Clean HTML</button></section>
        <section className="marketing-html-convert"><span>Visual design</span><strong>Design and HTML are kept separately</strong><p>Switch tabs without losing either version. Only replace the visual layout when you explicitly convert this HTML.</p><button disabled={Boolean(htmlResult.error)} onClick={onConvert} type="button">Convert HTML to Design</button></section>
      </aside>
      <section className="marketing-html-source">
        <header><div><strong>HTML source</strong><span>{draft.html.length.toLocaleString("en-US")} / {MAX_EMAIL_HTML_LENGTH.toLocaleString("en-US")}</span></div><small>Supports full documents, tables, media queries and inline CSS.</small></header>
        <textarea aria-label="Email HTML source" onChange={(event) => updateDraft({ html: event.target.value, htmlIsCustom: true })} ref={sourceRef} spellCheck="false" value={draft.html} />
      </section>
      <section className="marketing-html-preview">
        <header><strong>Live preview</strong><div className="marketing-preview-toggle"><button className={preview === "desktop" ? "active" : ""} onClick={() => setPreview("desktop")} type="button"><Monitor size={16} /> Desktop</button><button className={preview === "mobile" ? "active" : ""} onClick={() => setPreview("mobile")} type="button"><Smartphone size={16} /> Mobile</button></div></header>
        {htmlResult.error ? <MarketingEmpty title="HTML preview unavailable" copy={htmlResult.error} /> : <div className={`marketing-html-preview-frame ${preview}`}><iframe sandbox="" srcDoc={previewHtml} title="Email HTML preview" /></div>}
      </section>
    </div>
  );
}

function SmsDesignStep({ draft, templates, updateDraft, warnings }) {
  return (
    <section className="marketing-sms-designer">
      <div className="marketing-sms-form">
        <span className="marketing-eyebrow">Text message design</span>
        <h2>Keep it clear, useful and easy to opt out.</h2>
        <p>Marketing messages stay separate from appointment reminders and other transactional notifications.</p>
        <label>
          <span>Starting template</span>
          <select value="" onChange={(event) => { const template = templates.find((item) => item.id === event.target.value); if (template) updateDraft({ message: template.text }); }}>
            <option value="">Custom message</option>
            {templates.filter((template) => template.category === "Marketing").map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </label>
        <label>
          <span>Message <button onClick={() => updateDraft({ message: `${draft.message} {{first_name}}` })} type="button">Add personalization</button></span>
          <textarea maxLength="480" onChange={(event) => updateDraft({ message: event.target.value })} placeholder="Write your marketing message…" rows="8" value={draft.message} />
          <small>{draft.message.length}/480 characters · STOP instructions are added by the delivery provider.</small>
        </label>
        {warnings.length > 0 && <div className="marketing-builder-warning"><CircleAlert size={17} /><span>{warnings.join(" ")}</span></div>}
      </div>
      <aside className="marketing-phone-preview">
        <div className="marketing-phone-speaker" />
        <span className="marketing-phone-label">MACE</span>
        <div className="marketing-message-bubble">{draft.message || "Your message preview will appear here."}</div>
        <small>Reply STOP to opt out.</small>
      </aside>
    </section>
  );
}

function AudienceStep({ clients, draft, estimate, updateDraft }) {
  return (
    <section className="marketing-wizard-page">
      <div className="marketing-wizard-card">
        <span className="marketing-eyebrow">Step 1 of 4</span><h2>Who should receive this campaign?</h2><p>Choose a channel and a consent-aware audience. You can return to this step without losing your design.</p>
        <label><span>Campaign name</span><input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} /></label>
        <fieldset><legend>Campaign type</legend><div className="marketing-channel-choice">{[{ value: "Email", icon: Mail }, { value: "SMS", icon: MessageSquareText }, { value: "Email + SMS", icon: Columns2 }].map(({ value, icon: Icon }) => <button className={draft.channel === value ? "active" : ""} key={value} onClick={() => updateDraft({ channel: value })} type="button"><Icon size={20} /><strong>{value}</strong><span>{value === "Email" ? "Rich branded email" : value === "SMS" ? "Concise text message" : "Coordinated channels"}</span></button>)}</div></fieldset>
        <label><span>Saved audience</span><select value={draft.segment} onChange={(event) => updateDraft({ segment: event.target.value })}>{audienceDefinitions.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}</option>)}</select></label>
        <div className="marketing-recipient-estimate"><Users size={20} /><div><strong>{estimate.toLocaleString("en-PH")} estimated recipients</strong><span>From {clients.length.toLocaleString("en-PH")} client records after valid-contact and available consent checks.</span></div></div>
      </div>
    </section>
  );
}

function EmailDropZone({ containerId, dragState, index, onDrop, onInsert, onOver }) {
  const key = `${containerId}:${index}`;
  const isActive = dragState?.over === key;
  return (
    <div
      className={`marketing-drop-zone ${isActive ? "active" : ""} ${dragState ? "drag-visible" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); onOver(key); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = dragState?.kind === "library" ? "copy" : "move"; onOver(key); }}
      onDrop={(event) => onDrop(event, { containerId, index })}
    >
      <i />
      <button onClick={() => onInsert({ containerId, index })} type="button" aria-label={`Insert content at position ${index + 1}`}><Plus size={14} /></button>
      {isActive && <span>Drop content here</span>}
    </div>
  );
}

function EmailCanvasList({ blocks, containerId, dragState, notify, onDelete, onDragEnd, onDragStart, onDrop, onDuplicate, onImageUploadStateChange, onInsert, onMove, onOver, onReplaceImage, onSelect, preview, selectedId, uploadImage }) {
  const isColumn = containerId !== ROOT_EMAIL_CONTAINER;
  return (
    <div className={`marketing-email-stack ${isColumn ? "column-stack" : "root-stack"}`}>
      <EmailDropZone containerId={containerId} dragState={dragState} index={0} onDrop={onDrop} onInsert={onInsert} onOver={onOver} />
      {!blocks.length && <div className="marketing-empty-column"><Plus size={16} /><span>Drag content here</span></div>}
      {blocks.map((block, index) => (
        <React.Fragment key={block.id}>
          {block.type === "layout" ? (
            <EmailLayoutBlock
              block={block}
              isFirst={index === 0}
              isLast={index === blocks.length - 1}
              dragState={dragState}
              isSelected={block.id === selectedId}
              notify={notify}
              onDelete={onDelete}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDuplicate={onDuplicate}
              onImageUploadStateChange={onImageUploadStateChange}
              onInsert={onInsert}
              onMove={onMove}
              onOver={onOver}
              onReplaceImage={onReplaceImage}
              onSelect={onSelect}
              preview={preview}
              selectedId={selectedId}
              uploadImage={uploadImage}
            />
          ) : (
            <EmailBlock block={block} dragState={dragState} isFirst={index === 0} isLast={index === blocks.length - 1} isSelected={block.id === selectedId} notify={notify} onDelete={onDelete} onDragEnd={onDragEnd} onDragStart={onDragStart} onDuplicate={onDuplicate} onImageUploadStateChange={onImageUploadStateChange} onMove={onMove} onReplaceImage={onReplaceImage} onSelect={onSelect} preview={preview} uploadImage={uploadImage} />
          )}
          <EmailDropZone containerId={containerId} dragState={dragState} index={index + 1} onDrop={onDrop} onInsert={onInsert} onOver={onOver} />
        </React.Fragment>
      ))}
    </div>
  );
}

function BlockActions({ blockId, isFirst, isLast, onDelete, onDuplicate, onMove }) {
  return <div className="marketing-block-actions"><button disabled={isFirst} onClick={(event) => { event.stopPropagation(); onMove(blockId, -1); }} title={isFirst ? "Already first" : "Move up"} type="button" aria-label="Move block up"><MoveUp size={15} /></button><button disabled={isLast} onClick={(event) => { event.stopPropagation(); onMove(blockId, 1); }} title={isLast ? "Already last" : "Move down"} type="button" aria-label="Move block down"><MoveDown size={15} /></button><button onClick={(event) => { event.stopPropagation(); onDuplicate(blockId); }} title="Duplicate" type="button" aria-label="Duplicate block"><Copy size={15} /></button><button onClick={(event) => { event.stopPropagation(); onDelete(blockId); }} title="Delete" type="button" aria-label="Delete block"><Trash2 size={15} /></button></div>;
}

function EmailLayoutBlock({ block, dragState, isFirst, isLast, isSelected, notify, onDelete, onDragEnd, onDragStart, onDrop, onDuplicate, onImageUploadStateChange, onInsert, onMove, onOver, onReplaceImage, onSelect, preview, selectedId, uploadImage }) {
  const hiddenOnPreview = !visibleOn(block, preview === "mobile" ? "mobile" : "desktop");
  const columnEntries = block.columns.map((column, columnIndex) => ({ column, columnIndex }));
  if (preview === "mobile" && block.mobileReverse) columnEntries.reverse();
  return (
    <section
      aria-label={`${block.columns.length}-column layout`}
      className={`marketing-email-block marketing-layout-block ${isSelected ? "selected" : ""} ${dragState?.blockId === block.id ? "dragging" : ""} ${hiddenOnPreview ? "hidden-on-preview" : ""}`}
      draggable
      onClick={() => onSelect(block.id)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, block.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(block.id);
        if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); onMove(block.id, -1); }
        if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); onMove(block.id, 1); }
      }}
      style={{ background: `${block.background || "#ffffff"}${block.backgroundImage ? ` url(${block.backgroundImage}) center / cover no-repeat` : ""}`, border: `${block.borderWidth || 0}px solid ${block.borderColor || "transparent"}`, borderRadius: block.borderRadius || 0, marginInline: "auto", padding: block.padding ?? 8, width: `${block.contained === false ? 100 : block.sectionWidth ?? 100}%` }}
      tabIndex={0}
    >
      <span className="marketing-block-grip"><GripVertical size={16} /></span>
      {hiddenOnPreview && <span className="marketing-hidden-label">Hidden on {preview === "mobile" ? "mobile" : "desktop"}</span>}
      {isSelected && <BlockActions blockId={block.id} isFirst={isFirst} isLast={isLast} onDelete={onDelete} onDuplicate={onDuplicate} onMove={onMove} />}
      <div className={`marketing-layout-columns${block.mobileStack === false ? " keep-mobile" : ""}`} style={{ alignItems: block.verticalAlign === "middle" ? "center" : block.verticalAlign === "bottom" ? "end" : "start", gap: block.gap ?? 12, gridTemplateColumns: (block.columnWidths || block.columns.map(() => 1)).map((width) => `minmax(0, ${Math.max(1, Number(width) || 1)}fr)`).join(" ") }}>
        {columnEntries.map(({ column, columnIndex }) => (
          <div className="marketing-layout-column" key={emailColumnId(block.id, columnIndex)} onClick={(event) => event.stopPropagation()}>
            <EmailCanvasList
              blocks={column}
              containerId={emailColumnId(block.id, columnIndex)}
              dragState={dragState}
              notify={notify}
              onDelete={onDelete}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDuplicate={onDuplicate}
              onImageUploadStateChange={onImageUploadStateChange}
              onInsert={onInsert}
              onMove={onMove}
              onOver={onOver}
              onReplaceImage={onReplaceImage}
              onSelect={onSelect}
              preview={preview}
              selectedId={selectedId}
              uploadImage={uploadImage}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

const canvasImageBlockTypes = new Set(["image", "logo", "product", "productRecommendation", "video"]);

function hasExternalFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files") || Boolean(event.dataTransfer?.files?.length);
}

function EmailBlock({ block, dragState, isFirst, isLast, isSelected, notify, onDelete, onDragEnd, onDragStart, onDuplicate, onImageUploadStateChange, onMove, onReplaceImage, onSelect, preview, uploadImage }) {
  const imageDropDepth = useRef(0);
  const [imageDropState, setImageDropState] = useState({ dragging: false, error: "", uploading: false });
  const hiddenOnPreview = !visibleOn(block, preview === "mobile" ? "mobile" : "desktop");
  const acceptsImageDrop = canvasImageBlockTypes.has(block.type);
  const responsiveFontSize = preview === "mobile" ? block.mobileFontSize || block.responsive?.mobileFontSize || block.fontSize : block.fontSize;
  const responsivePadding = preview === "mobile" && block.responsive?.mobilePadding !== null ? block.responsive.mobilePadding : block.padding;
  const style = { color: block.color, textAlign: block.align, paddingTop: responsivePadding, paddingBottom: responsivePadding, fontSize: responsiveFontSize, fontFamily: block.fontFamily };

  function enterImageDrop(event) {
    if (!acceptsImageDrop || !hasExternalFiles(event) || imageDropState.uploading) return;
    event.preventDefault();
    event.stopPropagation();
    imageDropDepth.current += 1;
    setImageDropState((current) => ({ ...current, dragging: true, error: "" }));
  }

  function leaveImageDrop(event) {
    if (!acceptsImageDrop || !hasExternalFiles(event) || imageDropState.uploading) return;
    event.preventDefault();
    event.stopPropagation();
    imageDropDepth.current = Math.max(0, imageDropDepth.current - 1);
    if (imageDropDepth.current === 0) setImageDropState((current) => ({ ...current, dragging: false }));
  }

  function overImageDrop(event) {
    if (!acceptsImageDrop || !hasExternalFiles(event) || imageDropState.uploading) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  async function dropImage(event) {
    if (!acceptsImageDrop || !hasExternalFiles(event) || imageDropState.uploading) return;
    event.preventDefault();
    event.stopPropagation();
    imageDropDepth.current = 0;
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      setImageDropState({ dragging: false, error: "No image file was received.", uploading: false });
      return;
    }
    setImageDropState({ dragging: false, error: "", uploading: true });
    onImageUploadStateChange?.(true);
    onSelect(block.id);
    try {
      if (!uploadImage) throw new Error("Image uploads are not available right now.");
      const result = await uploadImage(await readMarketingImageFile(file), file.name);
      const src = String(result?.asset?.url || "");
      if (!src) throw new Error("The upload did not return an image URL.");
      onReplaceImage(block.id, src);
      setImageDropState({ dragging: false, error: "", uploading: false });
      notify?.(`${file.name} uploaded to Media and added to this block.`);
    } catch (error) {
      const message = error?.message || "The image could not be uploaded.";
      setImageDropState({ dragging: false, error: message, uploading: false });
      notify?.(message, "error");
    } finally {
      onImageUploadStateChange?.(false);
    }
  }

  return (
    <div className={`marketing-email-block ${isSelected ? "selected" : ""} ${dragState?.blockId === block.id ? "dragging" : ""} ${hiddenOnPreview ? "hidden-on-preview" : ""} ${imageDropState.dragging ? "image-drop-active" : ""} ${imageDropState.uploading ? "image-uploading" : ""} type-${block.type}`} draggable={!imageDropState.uploading} onClick={() => onSelect(block.id)} onDragEnd={onDragEnd} onDragEnter={enterImageDrop} onDragLeave={leaveImageDrop} onDragOver={overImageDrop} onDragStart={(event) => onDragStart(event, block.id)} onDrop={(event) => { void dropImage(event); }} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === "Enter") onSelect(block.id);
      if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); onMove(block.id, -1); }
      if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); onMove(block.id, 1); }
    }}>
      <span className="marketing-block-grip"><GripVertical size={16} /></span>
      <RenderedBlock block={block} preview={preview} style={style} />
      {(imageDropState.dragging || imageDropState.uploading) && <span className="marketing-canvas-image-drop" aria-live="polite"><Upload size={22} aria-hidden="true" /><strong>{imageDropState.uploading ? "Uploading image…" : "Drop image to replace"}</strong><small>{imageDropState.uploading ? "Saving to Marketing Media" : block.type === "image" ? "Up to 600 px wide · natural height" : "JPG, PNG or WebP · maximum 3 MB"}</small></span>}
      {imageDropState.error && <span className="marketing-canvas-image-error" role="alert"><CircleAlert size={14} />{imageDropState.error}</span>}
      {hiddenOnPreview && <span className="marketing-hidden-label">Hidden on {preview === "mobile" ? "mobile" : "desktop"}</span>}
      {isSelected && <BlockActions blockId={block.id} isFirst={isFirst} isLast={isLast} onDelete={onDelete} onDuplicate={onDuplicate} onMove={onMove} />}
    </div>
  );
}

function SendTestDialog({ draft, html, notify, onClose }) {
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const emailList = emails.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
  const invalidEmails = emailList.filter((value) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

  async function submit(event) {
    event.preventDefault();
    if (!emailList.length || invalidEmails.length || emailList.length > 5) return;
    setSending(true);
    setResult(null);
    try {
      const response = await sendMarketingTestEmail({
        emails: emailList,
        campaign: { id: draft.id, name: draft.name, subject: draft.subject, segment: draft.segment, html },
      });
      setResult(response);
      notify?.(`Test email ${response.provider === "dry-run" ? "validated" : "sent"} for ${response.sent} recipient${response.sent === 1 ? "" : "s"}.`);
    } catch (error) {
      setResult({ error: error.message || "Unable to send the test email." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div aria-label="Send test email" aria-modal="true" className="marketing-action-dialog" role="dialog">
      <button aria-label="Close send test dialog" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <form onSubmit={submit}>
        <header><div><span>Delivery check</span><h2>Send a test email</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="marketing-action-dialog-body">
          <p>Send the current saved-safe email to up to five addresses. Personalization uses sample client details and the subject begins with <strong>[TEST]</strong>.</p>
          <label><span>Email addresses</span><textarea autoFocus onChange={(event) => setEmails(event.target.value)} placeholder="you@example.com, reviewer@example.com" rows="4" value={emails} /><small>Separate addresses with commas, spaces, or new lines.</small></label>
          {invalidEmails.length ? <div className="marketing-inline-error"><CircleAlert size={15} />Check: {invalidEmails.join(", ")}</div> : null}
          {emailList.length > 5 ? <div className="marketing-inline-error"><CircleAlert size={15} />Use no more than five addresses.</div> : null}
          {result?.error ? <div className="marketing-inline-error"><CircleAlert size={15} />{result.error}</div> : null}
          {result && !result.error ? <div className="marketing-inline-success"><Check size={15} />{result.provider === "dry-run" ? "The email passed the server delivery simulation." : `${result.sent} test email${result.sent === 1 ? "" : "s"} sent.`}</div> : null}
        </div>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="marketing-primary-button" disabled={sending || !emailList.length || invalidEmails.length > 0 || emailList.length > 5} type="submit"><Send size={15} />{sending ? "Sending…" : "Send test"}</button></footer>
      </form>
    </div>
  );
}

function SaveTemplateDialog({ draft, html, notify, onClose, onSaveTemplate }) {
  const firstImage = flattenEmailBlocks(draft.blocks).find((block) => ["image", "logo", "product", "productRecommendation"].includes(block.type) && block.src)?.src || "";
  const [form, setForm] = useState({ name: draft.name || "Untitled email template", description: "", thumbnail: firstImage });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const checked = sanitizeImportedEmailHtml(html);
    if (checked.error || checked.removed) {
      setError(checked.error || "Clean unsupported HTML before saving this template.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSaveTemplate?.({
        name: form.name.trim(),
        description: form.description.trim(),
        thumbnail: form.thumbnail.trim(),
        editorMode: draft.editorMode,
        html: checked.html,
        design: { version: 2, editorMode: draft.editorMode, htmlIsCustom: draft.htmlIsCustom === true, previewText: draft.previewText, blocks: draft.blocks, theme: draft.theme },
      });
      notify?.("Design saved to the shared Templates library.");
      onClose();
    } catch (submitError) {
      setError(submitError.message || "Unable to save this template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-label="Save email template" aria-modal="true" className="marketing-action-dialog" role="dialog">
      <button aria-label="Close save template dialog" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <form onSubmit={submit}>
        <header><div><span>Reusable design</span><h2>Save as a template</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="marketing-action-dialog-body">
          <p>The complete design, responsive settings, links, content and HTML are stored in the server-backed Templates library.</p>
          <label><span>Template name</span><input autoFocus maxLength="160" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></label>
          <label><span>Description</span><textarea maxLength="500" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="When should your team use this design?" rows="3" value={form.description} /></label>
          <label><span>Thumbnail image URL</span><input onChange={(event) => setForm((current) => ({ ...current, thumbnail: event.target.value }))} placeholder="Uses the first design image automatically" value={form.thumbnail} /></label>
          {error ? <div className="marketing-inline-error"><CircleAlert size={15} />{error}</div> : null}
        </div>
        <footer><button onClick={onClose} type="button">Cancel</button><button className="marketing-primary-button" disabled={saving || !form.name.trim()} type="submit"><Save size={15} />{saving ? "Saving…" : "Save template"}</button></footer>
      </form>
    </div>
  );
}

function SocialPlatformIcon({ platform, size }) {
  const icon = socialIconDefinition(platform);
  return <svg aria-hidden="true" focusable="false" height={size} viewBox="0 0 24 24" width={size}><path d={icon.path} fill="currentColor" /></svg>;
}

function RenderedBlock({ block, preview, style }) {
  const mobile = preview === "mobile";
  if (block.type === "logo") return <div className="marketing-email-logo" style={{ ...style, background: block.background, justifyItems: block.align === "left" ? "start" : block.align === "right" ? "end" : "center" }}><a href={block.link || "#logo"} onClick={(event) => event.preventDefault()}><img src={block.src || "/brand/mace-logo.png"} alt={block.decorative ? "" : block.alt || "MACE"} style={{ maxWidth: "100%", width: mobile ? block.mobileWidth || block.width || 140 : block.width || 140 }} /></a></div>;
  if (block.type === "image") {
    return <div className="marketing-email-image" style={{ ...style, background: block.background, textAlign: block.align }}><img src={block.src || "/brand/result-1.jpg"} alt={block.decorative ? "" : block.alt || ""} style={{ border: `${block.borderWidth || 0}px solid ${block.borderColor || "transparent"}`, borderRadius: block.borderRadius || 0, height: "auto", marginLeft: block.align === "right" ? "auto" : block.align === "center" ? "auto" : 0, marginRight: block.align === "left" ? "auto" : block.align === "center" ? "auto" : 0, maxWidth: 600, width: "100%" }} />{block.caption && <small>{block.caption}</small>}</div>;
  }
  if (block.type === "heading") {
    const content = block.link ? <a href={block.link} onClick={(event) => event.preventDefault()} style={{ color: "inherit", textDecoration: block.textDecoration || "none" }}>{block.content}</a> : block.content;
    return React.createElement(block.level === "p" ? "p" : block.level || "h2", { style: { ...style, fontWeight: block.fontWeight, letterSpacing: block.letterSpacing, lineHeight: block.lineHeight, marginBottom: block.marginBottom, marginTop: block.marginTop, textDecoration: block.textDecoration } }, content);
  }
  if (block.type === "text") return <div className="marketing-rich-preview" style={{ ...style, letterSpacing: block.letterSpacing, lineHeight: block.lineHeight }} dangerouslySetInnerHTML={{ __html: sanitizeRichEmailText(block.content) }} />;
  if (block.type === "button") return <div className="marketing-email-button-wrap" style={style}><a href={block.link || "#missing-link"} onClick={(event) => event.preventDefault()} style={{ background: block.background, border: `${block.borderWidth || 0}px solid ${block.borderColor || "transparent"}`, borderRadius: block.borderRadius, boxSizing: "border-box", color: block.textColor, display: block.fullWidth || (mobile && block.mobileFullWidth) ? "block" : "inline-block", fontFamily: block.fontFamily, fontSize: block.fontSize, fontWeight: block.fontWeight, padding: `${block.verticalPadding || 13}px ${block.horizontalPadding || 28}px`, textAlign: "center", width: block.fullWidth || (mobile && block.mobileFullWidth) ? "100%" : "auto" }}>{block.content}</a></div>;
  if (block.type === "treatment") {
    const rows = String(block.content).split(/\n\s*\n/);
    return <div className="marketing-treatment-block" style={style}>{rows.map((row, index) => { const [title, ...copy] = row.split("\n"); const icon = block.itemIcons?.[index]; return <div key={`${title}-${index}`}><span>{icon?.src ? <img src={icon.src} alt={icon.alt || ""} /> : <Sparkles size={15} />}</span><p><strong>{title}</strong><small>{copy.join(" ")}</small></p><ChevronRight size={16} /></div>; })}</div>;
  }
  if (block.type === "offer") return <div className="marketing-offer-block" style={style}><BellRing size={20} /><p>{block.content}</p></div>;
  if (block.type === "divider") return <div className="marketing-divider" style={{ paddingBottom: block.spacingBottom, paddingTop: block.spacingTop, textAlign: block.align }}><i style={{ borderTop: `${block.thickness || 1}px ${block.lineStyle || "solid"} ${block.color || "#ddd4c9"}`, display: "inline-block", width: `${block.width || 100}%` }} /></div>;
  if (block.type === "spacer") return <div style={{ height: Math.max(0, Number(mobile ? block.mobileHeight ?? 20 : block.desktopHeight ?? block.padding ?? 24)) }} aria-label="Spacer" />;
  if (block.type === "video") return <div className="marketing-video-block" style={style}><div style={{ aspectRatio: block.aspectRatio === "4:3" ? "4 / 3" : block.aspectRatio === "1:1" ? "1 / 1" : "16 / 9", borderRadius: block.borderRadius, overflow: "hidden" }}><img src={block.src || "/brand/result-1.jpg"} alt={block.alt || "Video preview"} /><span style={{ color: block.playColor }}><Monitor size={22} /></span></div><strong>{block.content}</strong>{block.caption && <small>{block.caption}</small>}</div>;
  if (block.type === "social") return <div className="marketing-social-block" style={{ ...style, gap: block.iconSpacing }}>{(block.items || []).filter((item) => validMarketingUrl(item.url)).map((item) => <a aria-label={item.label || item.platform} className={`icon-${block.iconStyle || "outline"}`} href={item.url} key={item.id} onClick={(event) => event.preventDefault()} style={{ background: block.iconStyle === "filled" ? block.iconColor : "transparent", borderColor: block.iconColor, color: block.iconStyle === "filled" ? "#fff" : block.iconColor }} title={item.label || item.platform}>{block.iconStyle === "text" ? item.platform : <SocialPlatformIcon platform={item.platform} size={block.iconSize || 24} />}</a>)}</div>;
  if (block.type === "survey") return <div className="marketing-survey-block" style={style}><strong>{block.content}</strong><div>{(block.choices || []).map((choice) => <a href="#survey" key={choice.id} onClick={(event) => event.preventDefault()} style={{ background: block.answerStyle === "text" ? "transparent" : block.background, borderRadius: block.borderRadius, color: block.answerStyle === "text" ? block.color : block.textColor }}>{choice.label}</a>)}</div></div>;
  if (block.type === "code") return <div className="marketing-code-block" style={style} dangerouslySetInnerHTML={{ __html: sanitizeEmailFragment(block.content) }} />;
  if (["product", "productRecommendation"].includes(block.type)) {
    return <div className={`marketing-product-block image-${block.imagePosition || "top"}`} style={{ ...style, background: block.background, border: `${block.borderWidth || 0}px solid ${block.borderColor || "transparent"}`, borderRadius: block.borderRadius }}>
      {!block.hideImage && <img src={block.src || "/brand/result-1.jpg"} alt={block.decorative ? "" : block.alt || block.title || "MACE treatment"} style={{ aspectRatio: block.aspectRatio?.replace(":", " / ") || "4 / 3", objectFit: block.crop || "cover", objectPosition: `${block.focalX ?? 50}% ${block.focalY ?? 50}%` }} />}
      <div style={{ alignSelf: block.contentAlign, padding: block.internalPadding, textAlign: block.align }}>
        {!block.hideCategory && <small style={{ color: block.categoryColor, fontFamily: block.categoryFontFamily, fontSize: block.categoryFontSize }}>{block.type === "productRecommendation" ? block.recommendationLabel || block.category : block.category}</small>}
        <strong style={{ color: block.titleColor, fontFamily: block.titleFontFamily, fontSize: block.titleFontSize, fontWeight: block.titleFontWeight }}>{block.title}</strong>
        {!block.hideDescription && <p style={{ color: block.descriptionColor, fontFamily: block.descriptionFontFamily, fontSize: block.descriptionFontSize }}>{block.description}</p>}
        {!block.hideCta && <a href={block.ctaUrl || "#product"} onClick={(event) => event.preventDefault()} style={{ background: block.ctaStyle === "button" ? block.ctaBackground : "transparent", color: block.ctaStyle === "button" ? "#fff" : block.ctaColor, fontFamily: block.ctaFontFamily, fontSize: block.ctaFontSize, fontWeight: block.ctaFontWeight }}>{block.ctaLabel}</a>}
        {block.secondaryCtaLabel && <a href={block.secondaryCtaUrl || "#secondary"} onClick={(event) => event.preventDefault()}>{block.secondaryCtaLabel}</a>}
      </div>
    </div>;
  }
  if (block.type === "footer") return <div className={`marketing-custom-footer${block.columnLayout === "two" ? " two-column" : ""}${block.mobileStack === false ? " keep-mobile" : ""}`} style={{ ...style, background: block.background, color: block.color }}><div><strong>{block.businessName}</strong><span>{block.address}</span>{block.email && <a href={`mailto:${block.email}`} onClick={(event) => event.preventDefault()}>{block.email}</a>}{block.phone && <span>{block.phone}</span>}{block.website && <a href={block.website} onClick={(event) => event.preventDefault()}>{block.website}</a>}<span className="marketing-footer-socials">{(block.socialItems || []).filter((item) => validMarketingUrl(item.url)).map((item) => <a href={item.url} key={item.id} onClick={(event) => event.preventDefault()}>{item.platform}</a>)}</span></div><div><small>{block.legalText}</small><span><a href="#unsubscribe" onClick={(event) => event.preventDefault()}>{block.unsubscribeText || "Unsubscribe"}</a>{block.preferencesText ? <> · <a href="#preferences" onClick={(event) => event.preventDefault()}>{block.preferencesText}</a></> : null}</span><small>{block.copyrightText}</small></div></div>;
  if (block.type === "contact") return <div className="marketing-contact-block" style={style}>{String(block.content).split("\n").map((line) => <span key={line}>{line}</span>)}</div>;
  return null;
}

function ColorField({ label, onChange, value }) {
  return <label><span>{label}</span><div className="marketing-color-input"><input aria-label={`${label} picker`} onChange={(event) => onChange(event.target.value)} type="color" value={value} /><input aria-label={`${label} hex value`} onChange={(event) => onChange(event.target.value)} value={value} /></div></label>;
}

function marketingIconDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The icon file could not be read."));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("Choose a valid JPG, PNG, or WebP image."));
      image.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(String(reader.result || ""));
          return;
        }
        const scale = Math.min(size / image.width, size / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function TreatmentIconEditor({ icon, notify, onChange, title, uploadImage }) {
  const input = useRef(null);
  const [uploadState, setUploadState] = useState({ error: "", uploading: false });

  async function uploadTreatmentIcon(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
      setUploadState({ error: "Choose a JPG, PNG, or WebP image.", uploading: false });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setUploadState({ error: "The icon must be 3 MB or smaller.", uploading: false });
      return;
    }
    if (!uploadImage) {
      setUploadState({ error: "Icon uploads are not available right now.", uploading: false });
      return;
    }
    setUploadState({ error: "", uploading: true });
    try {
      const result = await uploadImage(await marketingIconDataUrl(file), file.name);
      const iconSrc = String(result?.asset?.url || "");
      if (!iconSrc) throw new Error("The upload did not return an image URL.");
      onChange({ src: iconSrc });
      setUploadState({ error: "", uploading: false });
      notify?.(`${title} icon uploaded.`);
    } catch (error) {
      setUploadState({ error: error?.message || "The icon could not be uploaded.", uploading: false });
    }
  }

  return (
    <section className="marketing-icon-editor">
      <div className="marketing-icon-editor-header">
        <div className="marketing-icon-preview">{icon.src ? <img src={icon.src} alt={icon.alt || `${title} icon preview`} /> : <Sparkles size={20} />}</div>
        <div><strong>{title || "Untitled treatment"}</strong><small>Individual row icon</small></div>
      </div>
      <input accept="image/jpeg,image/png,image/webp" hidden onChange={uploadTreatmentIcon} ref={input} type="file" />
      <div className="marketing-icon-actions">
        <button aria-label={`${icon.src ? "Replace" : "Upload"} icon for ${title}`} disabled={uploadState.uploading} onClick={() => input.current?.click()} type="button"><Upload size={14} /> {uploadState.uploading ? "Uploading…" : icon.src ? "Replace icon" : "Upload icon"}</button>
        {icon.src && <button aria-label={`Remove icon for ${title}`} onClick={() => onChange({ src: "" })} type="button"><Trash2 size={14} /> Remove</button>}
      </div>
      <label><span>Icon URL</span><input aria-label={`${title} icon URL`} placeholder="https://" value={icon.src || ""} onChange={(event) => onChange({ src: event.target.value })} /></label>
      <label><span>Alternative text</span><input aria-label={`${title} icon alternative text`} placeholder="Decorative if left blank" value={icon.alt || ""} onChange={(event) => onChange({ alt: event.target.value })} /></label>
      <small>Public-facing JPG, PNG, or WebP · maximum 3 MB.</small>
      {uploadState.error && <small className="marketing-icon-error" role="alert">{uploadState.error}</small>}
    </section>
  );
}

function MarketingImageControl({ block, loadMedia, notify, onUploadStateChange, updateBlock, uploadImage }) {
  const input = useRef(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file) {
    if (!file) return;
    setMenuOpen(false);
    setDragging(false);
    setUploading(true);
    onUploadStateChange?.(true);
    setError("");
    try {
      if (!uploadImage) throw new Error("Image uploads are not available right now.");
      const result = await uploadImage(await readMarketingImageFile(file), file.name);
      const src = String(result?.asset?.url || "");
      if (!src) throw new Error("The upload did not return an image URL.");
      updateBlock({ src });
      setImageFailed(false);
      notify?.(`${file.name} uploaded and added to this block.`);
    } catch (uploadError) {
      setError(uploadError?.message || "The image could not be uploaded.");
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  }

  function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadFile(file);
  }

  return (
    <section className="marketing-image-control">
      <input accept="image/jpeg,image/png,image/webp" hidden onChange={chooseFile} ref={input} type="file" />
      <div
        className={`marketing-image-control-preview${dragging ? " dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadFile(file); }}
      >
        {block.src && !imageFailed ? <img onError={() => setImageFailed(true)} src={block.src} alt="Selected image preview" style={block.type === "image" ? { height: "auto", objectFit: "contain", transform: "none" } : { objectFit: block.crop || "cover", objectPosition: `${block.focalX ?? 50}% ${block.focalY ?? 50}%`, transform: `scale(${Math.max(100, Number(block.zoom || 100)) / 100})` }} /> : <span><ImageIcon size={24} /><small>{imageFailed ? "Image could not be loaded" : dragging ? "Drop to upload" : "No image selected"}</small></span>}
        {uploading ? <i className="marketing-image-upload-progress"><span /> Uploading securely…</i> : null}
      </div>
      <div className="marketing-image-control-actions">
        <div>
          <button aria-expanded={menuOpen} className="marketing-image-replace" disabled={uploading} onClick={() => setMenuOpen((current) => !current)} type="button">{uploading ? "Uploading…" : block.src ? "Replace" : "Add image"}<ChevronDown size={14} /></button>
          {menuOpen ? <div className="marketing-image-replace-menu" aria-label="Replace image"><button onClick={() => input.current?.click()} type="button"><Upload size={15} /><span><strong>Upload Image</strong><small>Add a new file to Media</small></span></button><button onClick={() => { setMenuOpen(false); setPickerOpen(true); }} type="button"><ImageIcon size={15} /><span><strong>Browse Library</strong><small>Reuse an uploaded image</small></span></button></div> : null}
        </div>
        <button disabled={uploading} onClick={() => input.current?.click()} type="button">Choose File</button>
        {block.src ? <button className="danger" disabled={uploading} onClick={() => { updateBlock({ src: "" }); setImageFailed(false); }} type="button"><Trash2 size={14} /> Remove</button> : null}
      </div>
      <small>{block.type === "image" ? "Drag and drop or choose a JPG, PNG or WebP · maximum 3 MB. The editor displays it up to 600 px wide at its natural aspect ratio." : "Drag and drop or choose a JPG, PNG or WebP · maximum 3 MB. Failed replacements keep the current image."}</small>
      {error ? <small className="marketing-icon-error" role="alert">{error}</small> : null}
      <details><summary>Use an image URL <ChevronDown size={14} /></summary><label><span>Image URL</span><input placeholder="https://" value={block.src || ""} onChange={(event) => { updateBlock({ src: event.target.value }); setImageFailed(false); }} /></label></details>
      {pickerOpen ? <MarketingMediaPicker initialSelectedUrl={block.src || ""} loadMedia={loadMedia} notify={notify} onClose={() => setPickerOpen(false)} onSelect={(asset) => { updateBlock({ src: asset.url }); setImageFailed(false); setPickerOpen(false); notify?.(`${asset.name} added to this block.`); }} uploadImage={uploadImage} /> : null}
    </section>
  );
}

const personalizationOptions = [
  { value: "first_name", label: "First name", fallback: "there" },
  { value: "client", label: "Full name", fallback: "valued client" },
  { value: "email", label: "Email", fallback: "" },
  { value: "branch", label: "Clinic", fallback: "MACE" },
  { value: "company", label: "Company", fallback: "MACE" },
  { value: "campaign", label: "Campaign", fallback: "this campaign" },
  { value: "date", label: "Current date", fallback: "today" },
];

function PersonalizationField({ label, multiline = false, onChange, rows = 4, value = "" }) {
  const field = useRef(null);
  const [token, setToken] = useState("first_name");
  const [fallback, setFallback] = useState("there");

  function insertToken() {
    const input = field.current;
    const syntax = `{{${token}${fallback ? `|${fallback}` : ""}}}`;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${syntax}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + syntax.length, start + syntax.length);
    });
  }

  const control = multiline
    ? <textarea ref={field} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    : <input ref={field} value={value} onChange={(event) => onChange(event.target.value)} />;
  return <label className="marketing-personalization-field"><span>{label}</span>{control}<div className="marketing-token-picker"><select aria-label={`${label} personalization token`} value={token} onChange={(event) => { const selected = personalizationOptions.find((item) => item.value === event.target.value); setToken(event.target.value); setFallback(selected?.fallback || ""); }}>{personalizationOptions.map((option) => <option key={option.value} value={option.value}>{option.label} · {`{{${option.value}}}`}</option>)}</select><input aria-label={`${label} fallback value`} placeholder="Fallback" value={fallback} onChange={(event) => setFallback(event.target.value)} /><button onClick={insertToken} type="button">Insert</button></div></label>;
}

function RichTextEditor({ onChange, value }) {
  const editor = useRef(null);

  useEffect(() => {
    if (editor.current && document.activeElement !== editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value || "";
  }, [value]);

  function command(name, argument = null) {
    editor.current?.focus();
    document.execCommand(name, false, argument);
    onChange(sanitizeRichEmailText(editor.current?.innerHTML || ""));
  }

  function createLink() {
    const url = window.prompt("Enter a safe link URL", "https://");
    if (!url) return;
    if (!validMarketingUrl(url)) {
      window.alert("Use an http, https, mailto, tel, or internal link.");
      return;
    }
    command("createLink", url);
  }

  function insertPersonalization(token, fallback) {
    command("insertText", `{{${token}${fallback ? `|${fallback}` : ""}}}`);
  }

  return <div className="marketing-rich-editor"><div className="marketing-rich-toolbar" role="toolbar" aria-label="Paragraph formatting"><button aria-label="Bold" onClick={() => command("bold")} title="Bold" type="button"><strong>B</strong></button><button aria-label="Italic" onClick={() => command("italic")} title="Italic" type="button"><em>I</em></button><button aria-label="Underline" onClick={() => command("underline")} title="Underline" type="button"><u>U</u></button><button aria-label="Strikethrough" onClick={() => command("strikeThrough")} title="Strikethrough" type="button"><s>S</s></button><label className="marketing-rich-color" title="Text color"><span className="sr-only">Text color</span><input aria-label="Text color" onChange={(event) => command("foreColor", event.target.value)} type="color" /></label><button aria-label="Bulleted list" onClick={() => command("insertUnorderedList")} title="Bulleted list" type="button">• List</button><button aria-label="Numbered list" onClick={() => command("insertOrderedList")} title="Numbered list" type="button">1. List</button><button aria-label="Create link" onClick={createLink} title="Create link" type="button"><Link size={14} /></button><button aria-label="Remove link" onClick={() => command("unlink")} title="Remove link" type="button">Unlink</button><button aria-label="Align left" onClick={() => command("justifyLeft")} title="Align left" type="button"><AlignLeft size={14} /></button><button aria-label="Align center" onClick={() => command("justifyCenter")} title="Align center" type="button"><AlignCenter size={14} /></button><button aria-label="Align right" onClick={() => command("justifyRight")} title="Align right" type="button"><AlignRight size={14} /></button><button aria-label="Clear formatting" onClick={() => command("removeFormat")} title="Clear formatting" type="button"><RotateCcw size={14} /></button><button aria-label="Undo text edit" onClick={() => command("undo")} title="Undo" type="button"><Undo2 size={14} /></button><button aria-label="Redo text edit" onClick={() => command("redo")} title="Redo" type="button"><Redo2 size={14} /></button></div><div className="marketing-rich-surface" contentEditable onInput={(event) => onChange(sanitizeRichEmailText(event.currentTarget.innerHTML))} onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData("text/html"); const text = event.clipboardData.getData("text/plain"); document.execCommand("insertHTML", false, html ? sanitizeRichEmailText(html) : escapePlainText(text)); }} ref={editor} role="textbox" aria-label="Paragraph content" aria-multiline="true" suppressContentEditableWarning /><div className="marketing-rich-tokens"><span>Personalize:</span>{personalizationOptions.slice(0, 4).map((option) => <button key={option.value} onClick={() => insertPersonalization(option.value, option.fallback)} type="button">{option.label}</button>)}</div></div>;
}

function escapePlainText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function NumberField({ label, max, min, onChange, suffix = "px", value }) {
  return <label><span>{label}</span><div className="marketing-input-suffix"><input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value ?? ""} /><span>{suffix}</span></div></label>;
}

function ToggleField({ checked, copy, label, onChange }) {
  return <label className="marketing-property-toggle"><input checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span><strong>{label}</strong>{copy ? <small>{copy}</small> : null}</span></label>;
}

function AlignmentField({ onChange, value }) {
  return <label><span>Alignment</span><div className="marketing-alignment-control">{[{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }].map(({ value: option, icon: Icon }) => <button aria-label={`Align ${option}`} className={value === option ? "active" : ""} key={option} onClick={() => onChange(option)} type="button"><Icon size={17} /></button>)}</div></label>;
}

function ImageContentSettings({ block, loadMedia, notify, onUploadStateChange, updateBlock, uploadImage }) {
  return <><MarketingImageControl block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /><label><span>Alternative text</span><input disabled={block.decorative} placeholder="Describe the image for recipients" value={block.alt || ""} onChange={(event) => updateBlock({ alt: event.target.value })} /><small>{block.decorative ? "Decorative images intentionally use empty alt text." : "Required for recipients who cannot see the image."}</small></label><ToggleField checked={block.decorative} copy="Use only when the image adds no information." label="Mark as decorative" onChange={(decorative) => updateBlock({ decorative, ...(decorative ? { alt: "" } : {}) })} /></>;
}

function ImageStyleSettings({ block, updateBlock }) {
  const logo = block.type === "logo";
  const naturalImage = block.type === "image";
  return <>{naturalImage ? <div className="marketing-natural-image-note"><strong>Natural image size</strong><span>Images fill the available email width up to 600 px. Height follows the uploaded image automatically.</span></div> : <><label><span>Aspect ratio</span><select value={block.aspectRatio || "original"} onChange={(event) => updateBlock({ aspectRatio: event.target.value })}><option value="original">Original</option><option value="1:1">Square 1:1</option><option value="4:3">Landscape 4:3</option><option value="3:2">Landscape 3:2</option><option value="16:9">Widescreen 16:9</option><option value="2:1">Banner 2:1</option></select></label><label><span>Crop behavior</span><select value={block.crop || "cover"} onChange={(event) => updateBlock({ crop: event.target.value })}><option value="cover">Crop to fill</option><option value="contain">Fit entire image</option><option value="fill">Stretch to area</option></select></label><NumberField label="Zoom" min={100} max={200} suffix="%" value={block.zoom ?? 100} onChange={(zoom) => updateBlock({ zoom })} /><div className="marketing-focal-grid"><NumberField label="Focal point X" min={0} max={100} suffix="%" value={block.focalX ?? 50} onChange={(focalX) => updateBlock({ focalX })} /><NumberField label="Focal point Y" min={0} max={100} suffix="%" value={block.focalY ?? 50} onChange={(focalY) => updateBlock({ focalY })} /></div><NumberField label={logo ? "Logo width" : "Display width"} min={logo ? 40 : 20} max={logo ? 420 : 100} suffix={logo ? "px" : "%"} value={block.width ?? (logo ? 140 : 100)} onChange={(width) => updateBlock({ width })} /><NumberField label="Maximum width" min={80} max={1200} value={block.maxWidth ?? 640} onChange={(maxWidth) => updateBlock({ maxWidth })} /><NumberField label="Mobile width" min={logo ? 40 : 20} max={logo ? 420 : 100} suffix={logo ? "px" : "%"} value={logo ? block.mobileWidth ?? block.width ?? 120 : block.responsive?.mobileWidth ?? block.mobileWidth ?? 100} onChange={(mobileWidth) => updateBlock(logo ? { mobileWidth } : { responsive: { ...(block.responsive || {}), mobileWidth } })} /></>}<ColorField label="Border color" value={block.borderColor || "#d8cec4"} onChange={(borderColor) => updateBlock({ borderColor })} /><NumberField label="Border width" min={0} max={12} value={block.borderWidth ?? 0} onChange={(borderWidth) => updateBlock({ borderWidth })} /><NumberField label="Corner radius" min={0} max={80} value={block.borderRadius ?? 0} onChange={(borderRadius) => updateBlock({ borderRadius })} /><ColorField label="Background" value={block.background || "#ffffff"} onChange={(background) => updateBlock({ background })} /><AlignmentField value={block.align || "center"} onChange={(align) => updateBlock({ align })} /><NumberField label="Vertical padding" min={0} max={80} value={block.padding ?? 16} onChange={(padding) => updateBlock({ padding })} /></>;
}

function ProductContentSettings({ block, loadMedia, notify, onUploadStateChange, updateBlock, uploadImage }) {
  const recommendation = block.type === "productRecommendation";
  return <>{recommendation ? <><label><span>Recommendation label</span><input value={block.recommendationLabel || ""} onChange={(event) => updateBlock({ recommendationLabel: event.target.value })} /></label><label><span>Product source</span><select value="manual" disabled><option value="manual">Manual content</option></select><small>Dynamic treatment catalog integration is not enabled; this block always saves reliable fallback content.</small></label></> : null}<ImageContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /><PersonalizationField label="Category or eyebrow" value={block.category || ""} onChange={(category) => updateBlock({ category })} /><PersonalizationField label="Product title" value={block.title || ""} onChange={(title) => updateBlock({ title })} /><PersonalizationField label="Product description" multiline rows={5} value={block.description || ""} onChange={(description) => updateBlock({ description })} /><label><span>Primary CTA label</span><input value={block.ctaLabel || ""} onChange={(event) => updateBlock({ ctaLabel: event.target.value })} /></label><label><span>Primary CTA destination</span><div className={`marketing-input-with-icon${block.ctaUrl && !validMarketingUrl(block.ctaUrl) ? " invalid" : ""}`}><Link size={15} /><input placeholder="https://" value={block.ctaUrl || ""} onChange={(event) => updateBlock({ ctaUrl: event.target.value })} /></div>{block.ctaUrl && !validMarketingUrl(block.ctaUrl) ? <small className="marketing-icon-error">Enter an http, https, mailto, tel, or internal URL.</small> : null}</label><label><span>CTA accessibility title</span><input value={block.ctaTitle || ""} onChange={(event) => updateBlock({ ctaTitle: event.target.value })} /></label><ToggleField checked={block.ctaNewTab !== false} label="Open CTA in a new tab" onChange={(ctaNewTab) => updateBlock({ ctaNewTab })} /><label><span>Secondary CTA label</span><input placeholder="Optional" value={block.secondaryCtaLabel || ""} onChange={(event) => updateBlock({ secondaryCtaLabel: event.target.value })} /></label><label><span>Secondary CTA destination</span><input placeholder="https://" value={block.secondaryCtaUrl || ""} onChange={(event) => updateBlock({ secondaryCtaUrl: event.target.value })} /></label><div className="marketing-field-grid"><ToggleField checked={block.hideImage} label="Hide image" onChange={(hideImage) => updateBlock({ hideImage })} /><ToggleField checked={block.hideCategory} label="Hide category" onChange={(hideCategory) => updateBlock({ hideCategory })} /><ToggleField checked={block.hideDescription} label="Hide description" onChange={(hideDescription) => updateBlock({ hideDescription })} /><ToggleField checked={block.hideCta} label="Hide CTA" onChange={(hideCta) => updateBlock({ hideCta })} /></div></>;
}

function ProductStyleSettings({ block, updateBlock }) {
  const fonts = ["Arial", "Georgia", "Inter", "Helvetica", "Verdana"];
  return <><label><span>Image position</span><select value={block.imagePosition || "top"} onChange={(event) => updateBlock({ imagePosition: event.target.value })}><option value="top">Top</option><option value="left">Left</option><option value="right">Right</option></select></label><ImageStyleSettings block={block} updateBlock={updateBlock} /><label><span>Content vertical alignment</span><select value={block.contentAlign || "top"} onChange={(event) => updateBlock({ contentAlign: event.target.value })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label><label><span>Title font</span><select value={block.titleFontFamily || "Georgia"} onChange={(event) => updateBlock({ titleFontFamily: event.target.value })}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Title size" min={12} max={42} value={block.titleFontSize ?? 20} onChange={(titleFontSize) => updateBlock({ titleFontSize })} /><NumberField label="Title weight" min={300} max={900} suffix="" value={block.titleFontWeight ?? 600} onChange={(titleFontWeight) => updateBlock({ titleFontWeight })} /><ColorField label="Title color" value={block.titleColor || "#4a3324"} onChange={(titleColor) => updateBlock({ titleColor })} /><label><span>Category font</span><select value={block.categoryFontFamily || "Arial"} onChange={(event) => updateBlock({ categoryFontFamily: event.target.value })}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Category size" min={8} max={18} value={block.categoryFontSize ?? 10} onChange={(categoryFontSize) => updateBlock({ categoryFontSize })} /><ColorField label="Category color" value={block.categoryColor || "#8b614b"} onChange={(categoryColor) => updateBlock({ categoryColor })} /><label><span>Description font</span><select value={block.descriptionFontFamily || "Arial"} onChange={(event) => updateBlock({ descriptionFontFamily: event.target.value })}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Description size" min={10} max={24} value={block.descriptionFontSize ?? 13} onChange={(descriptionFontSize) => updateBlock({ descriptionFontSize })} /><ColorField label="Description color" value={block.descriptionColor || "#5f554e"} onChange={(descriptionColor) => updateBlock({ descriptionColor })} /><label><span>CTA style</span><select value={block.ctaStyle || "text"} onChange={(event) => updateBlock({ ctaStyle: event.target.value })}><option value="text">Text link</option><option value="button">Button</option></select></label><label><span>CTA font</span><select value={block.ctaFontFamily || "Arial"} onChange={(event) => updateBlock({ ctaFontFamily: event.target.value })}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="CTA size" min={9} max={24} value={block.ctaFontSize ?? 13} onChange={(ctaFontSize) => updateBlock({ ctaFontSize })} /><NumberField label="CTA weight" min={300} max={900} suffix="" value={block.ctaFontWeight ?? 700} onChange={(ctaFontWeight) => updateBlock({ ctaFontWeight })} /><ColorField label="CTA color" value={block.ctaColor || "#4a3324"} onChange={(ctaColor) => updateBlock({ ctaColor })} />{block.ctaStyle === "button" ? <ColorField label="CTA background" value={block.ctaBackground || "#4a2d1c"} onChange={(ctaBackground) => updateBlock({ ctaBackground })} /> : null}<NumberField label="Internal padding" min={0} max={60} value={block.internalPadding ?? 16} onChange={(internalPadding) => updateBlock({ internalPadding })} /><NumberField label="Element spacing" min={0} max={40} value={block.itemSpacing ?? 8} onChange={(itemSpacing) => updateBlock({ itemSpacing })} /></>;
}

function SocialContentSettings({ block, updateBlock }) {
  const items = Array.isArray(block.items) ? block.items : [];
  function updateItem(id, patch) { updateBlock({ items: items.map((item) => item.id === id ? { ...item, ...patch } : item) }); }
  function moveItem(index, direction) { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; updateBlock({ items: next }); }
  return <div className="marketing-repeater"><p>Only social profiles with valid URLs appear in the final email.</p>{items.map((item, index) => <article key={item.id}><header><strong>{item.platform || `Social link ${index + 1}`}</strong><div><button disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label="Move social link up" type="button"><MoveUp size={14} /></button><button disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label="Move social link down" type="button"><MoveDown size={14} /></button><button onClick={() => updateBlock({ items: items.filter((entry) => entry.id !== item.id) })} aria-label="Delete social link" type="button"><Trash2 size={14} /></button></div></header><label><span>Platform</span><select value={item.platform || "Website"} onChange={(event) => updateItem(item.id, { platform: event.target.value })}>{["Facebook", "Instagram", "LinkedIn", "YouTube", "TikTok", "X/Twitter", "Website", "Email"].map((platform) => <option key={platform}>{platform}</option>)}</select></label><label><span>Profile URL</span><input placeholder="https://" value={item.url || ""} onChange={(event) => updateItem(item.id, { url: event.target.value })} /></label><label><span>Accessible label</span><input value={item.label || ""} onChange={(event) => updateItem(item.id, { label: event.target.value })} /></label></article>)}<button className="marketing-add-repeater" onClick={() => updateBlock({ items: [...items, { id: createBlockId("social"), platform: "Instagram", url: "", label: "Follow us on Instagram" }] })} type="button"><Plus size={15} /> Add social platform</button></div>;
}

function SurveyContentSettings({ block, updateBlock }) {
  const choices = Array.isArray(block.choices) ? block.choices : [];
  function updateChoice(id, patch) { updateBlock({ choices: choices.map((choice) => choice.id === id ? { ...choice, ...patch } : choice) }); }
  function moveChoice(index, direction) { const next = [...choices]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; updateBlock({ choices: next }); }
  return <><PersonalizationField label="Survey question" multiline rows={3} value={block.content || ""} onChange={(content) => updateBlock({ content })} /><div className="marketing-repeater"><h4>Answer choices</h4>{choices.map((choice, index) => <article key={choice.id}><header><strong>Choice {index + 1}</strong><div><button disabled={index === 0} onClick={() => moveChoice(index, -1)} aria-label="Move answer up" type="button"><MoveUp size={14} /></button><button disabled={index === choices.length - 1} onClick={() => moveChoice(index, 1)} aria-label="Move answer down" type="button"><MoveDown size={14} /></button><button disabled={choices.length <= 2} onClick={() => updateBlock({ choices: choices.filter((item) => item.id !== choice.id) })} aria-label="Delete answer" type="button"><Trash2 size={14} /></button></div></header><label><span>Answer label</span><input value={choice.label || ""} onChange={(event) => updateChoice(choice.id, { label: event.target.value, value: choice.value || event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} /></label><label><span>Stored value</span><input value={choice.value || ""} onChange={(event) => updateChoice(choice.id, { value: event.target.value })} /></label></article>)}<button className="marketing-add-repeater" onClick={() => updateBlock({ choices: [...choices, { id: createBlockId("answer"), label: "New answer", value: `answer-${choices.length + 1}` }] })} type="button"><Plus size={15} /> Add answer</button></div><label><span>Custom response destination</span><input placeholder="Leave blank to use MACE response recording" value={block.responseUrl || ""} onChange={(event) => updateBlock({ responseUrl: event.target.value })} /><small>When blank, MACE records the selected answer against this campaign.</small></label><label><span>Confirmation message</span><textarea rows="3" value={block.confirmationMessage || ""} onChange={(event) => updateBlock({ confirmationMessage: event.target.value })} /></label></>;
}

function FooterContentSettings({ block, updateBlock }) {
  return <><PersonalizationField label="Clinic or business name" value={block.businessName || ""} onChange={(businessName) => updateBlock({ businessName })} /><label><span>Address</span><textarea rows="3" value={block.address || ""} onChange={(event) => updateBlock({ address: event.target.value })} /></label><label><span>Email</span><input type="email" value={block.email || ""} onChange={(event) => updateBlock({ email: event.target.value })} /></label><label><span>Phone</span><input value={block.phone || ""} onChange={(event) => updateBlock({ phone: event.target.value })} /></label><label><span>Website</span><input value={block.website || ""} onChange={(event) => updateBlock({ website: event.target.value })} /></label><div className="marketing-footer-social-editor"><h4>Footer social links</h4><SocialContentSettings block={{ ...block, items: block.socialItems || [] }} updateBlock={(patch) => updateBlock({ socialItems: patch.items || [] })} /></div><PersonalizationField label="Custom legal text" multiline rows={4} value={block.legalText || ""} onChange={(legalText) => updateBlock({ legalText })} /><label><span>Unsubscribe text</span><input value={block.unsubscribeText || "Unsubscribe"} onChange={(event) => updateBlock({ unsubscribeText: event.target.value })} /></label><label><span>Unsubscribe link</span><input value={block.unsubscribeUrl || "#unsubscribe"} onChange={(event) => updateBlock({ unsubscribeUrl: event.target.value })} /><small>This required link is protected and cannot be removed from exported marketing email.</small></label><label><span>Manage-preferences text</span><input value={block.preferencesText || ""} onChange={(event) => updateBlock({ preferencesText: event.target.value })} /></label><label><span>Manage-preferences link</span><input value={block.preferencesUrl || "#preferences"} onChange={(event) => updateBlock({ preferencesUrl: event.target.value })} /></label><PersonalizationField label="Copyright text" value={block.copyrightText || ""} onChange={(copyrightText) => updateBlock({ copyrightText })} /></>;
}

function TypographyStyleSettings({ block, updateBlock }) {
  return <><label><span>Font</span><select value={block.fontFamily || "Arial"} onChange={(event) => updateBlock({ fontFamily: event.target.value })}>{["Arial", "Georgia", "Inter", "Helvetica", "Tahoma", "Verdana", "Times New Roman"].map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Desktop size" min={10} max={64} value={block.fontSize ?? 15} onChange={(fontSize) => updateBlock({ fontSize })} /><NumberField label="Mobile size" min={10} max={64} value={block.mobileFontSize ?? block.fontSize ?? 15} onChange={(mobileFontSize) => updateBlock({ mobileFontSize })} /><ColorField label="Text color" value={block.color || "#4a3324"} onChange={(color) => updateBlock({ color })} /><AlignmentField value={block.align || "left"} onChange={(align) => updateBlock({ align })} /><NumberField label="Line height" min={0.8} max={3} suffix="×" value={block.lineHeight ?? 1.5} onChange={(lineHeight) => updateBlock({ lineHeight })} /><NumberField label="Letter spacing" min={-5} max={20} value={block.letterSpacing ?? 0} onChange={(letterSpacing) => updateBlock({ letterSpacing })} /><NumberField label="Vertical padding" min={0} max={80} value={block.padding ?? 16} onChange={(padding) => updateBlock({ padding })} /><NumberField label="Mobile padding" min={0} max={80} value={block.responsive?.mobilePadding ?? block.padding ?? 16} onChange={(mobilePadding) => updateBlock({ responsive: { ...(block.responsive || {}), mobilePadding } })} /><button className="marketing-reset-style" onClick={() => updateBlock({ color: "", fontFamily: "", fontSize: null, mobileFontSize: null, responsive: { ...(block.responsive || {}), mobilePadding: null } })} type="button"><RotateCcw size={14} /> Reset typography to global style</button></>;
}

function LayoutSettings({ block, updateBlock }) {
  return <><ColorField label="Background" value={block.background || "#ffffff"} onChange={(background) => updateBlock({ background })} /><label><span>Background image URL</span><input placeholder="Optional https://" value={block.backgroundImage || ""} onChange={(event) => updateBlock({ backgroundImage: event.target.value })} /></label><NumberField label="Column gap" min={0} max={40} value={block.gap ?? 12} onChange={(gap) => updateBlock({ gap })} /><NumberField label="Internal padding" min={0} max={60} value={block.padding ?? 8} onChange={(padding) => updateBlock({ padding })} /><label><span>Vertical alignment</span><select value={block.verticalAlign || "top"} onChange={(event) => updateBlock({ verticalAlign: event.target.value })}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label><NumberField label="Section width" min={40} max={100} suffix="%" value={block.sectionWidth ?? 100} onChange={(sectionWidth) => updateBlock({ sectionWidth })} /><ToggleField checked={block.contained !== false} label="Contained to email width" onChange={(contained) => updateBlock({ contained })} /><ColorField label="Border color" value={block.borderColor || "#e2d8ce"} onChange={(borderColor) => updateBlock({ borderColor })} /><NumberField label="Border width" min={0} max={12} value={block.borderWidth ?? 0} onChange={(borderWidth) => updateBlock({ borderWidth })} /><NumberField label="Corner radius" min={0} max={60} value={block.borderRadius ?? 0} onChange={(borderRadius) => updateBlock({ borderRadius })} /><ToggleField checked={block.mobileStack !== false} copy="Recommended for two, three, and four-column sections." label="Stack columns on mobile" onChange={(mobileStack) => updateBlock({ mobileStack })} /><ToggleField checked={block.mobileReverse} label="Reverse mobile stacking order" onChange={(mobileReverse) => updateBlock({ mobileReverse })} /></>;
}

function VisibilitySettings({ block, updateBlock }) {
  const visibility = { desktop: true, mobile: true, ...(block.visibility || {}) };
  return <details className="marketing-properties-accordion"><summary>Visibility <ChevronDown size={15} /></summary><div className="marketing-accordion-fields"><div className="marketing-visibility-presets"><button className={visibility.desktop && visibility.mobile ? "active" : ""} onClick={() => updateBlock({ visibility: { desktop: true, mobile: true } })} type="button">All devices</button><button className={visibility.desktop && !visibility.mobile ? "active" : ""} onClick={() => updateBlock({ visibility: { desktop: true, mobile: false } })} type="button">Desktop only</button><button className={!visibility.desktop && visibility.mobile ? "active" : ""} onClick={() => updateBlock({ visibility: { desktop: false, mobile: true } })} type="button">Mobile only</button></div><ToggleField checked={visibility.desktop} label="Show on desktop" onChange={(desktop) => updateBlock({ visibility: { ...visibility, desktop } })} /><ToggleField checked={visibility.mobile} label="Show on mobile" onChange={(mobile) => updateBlock({ visibility: { ...visibility, mobile } })} />{!visibility.desktop && !visibility.mobile ? <small className="marketing-icon-error">This block is hidden everywhere and will not be exported.</small> : null}</div></details>;
}

function LinkTrackingSettings({ block, updateBlock }) {
  const tracking = { enabled: true, utmSource: "mace", utmMedium: "email", utmCampaign: "", label: "", ...(block.tracking || {}) };
  const rawUrl = block.ctaUrl || block.link || block.videoUrl || block.responseUrl || "";
  const trackable = rawUrl && !/^(?:mailto:|tel:|#)/i.test(rawUrl) && !/unsubscribe|preferences/i.test(rawUrl);
  return <details className="marketing-properties-accordion"><summary>Link tracking <ChevronDown size={15} /></summary><div className="marketing-accordion-fields"><ToggleField checked={tracking.enabled} copy={trackable ? "Adds campaign parameters to supported web links." : "Mail, phone, unsubscribe, and preference links are never modified."} label="Enable tracking" onChange={(enabled) => updateBlock({ tracking: { ...tracking, enabled } })} />{rawUrl ? <label><span>Resolved destination</span><input readOnly value={rawUrl} /></label> : <p>Add a destination URL in Content to configure tracking.</p>}<label><span>Tracking label</span><input disabled={!trackable || !tracking.enabled} value={tracking.label} onChange={(event) => updateBlock({ tracking: { ...tracking, label: event.target.value } })} /></label><label><span>UTM source</span><input disabled={!trackable || !tracking.enabled} value={tracking.utmSource} onChange={(event) => updateBlock({ tracking: { ...tracking, utmSource: event.target.value } })} /></label><label><span>UTM medium</span><input disabled={!trackable || !tracking.enabled} value={tracking.utmMedium} onChange={(event) => updateBlock({ tracking: { ...tracking, utmMedium: event.target.value } })} /></label><label><span>UTM campaign</span><input disabled={!trackable || !tracking.enabled} placeholder="Uses campaign name when blank" value={tracking.utmCampaign} onChange={(event) => updateBlock({ tracking: { ...tracking, utmCampaign: event.target.value } })} /></label></div></details>;
}

function BlockContentSettings({ block, loadMedia, notify, onUploadStateChange, updateBlock, uploadImage }) {
  const treatmentRows = block.type === "treatment" ? String(block.content || "").split(/\n\s*\n/).filter(Boolean) : [];
  function updateTreatmentIcon(index, patch) { const itemIcons = Array.from({ length: treatmentRows.length }, (_, itemIndex) => ({ ...(block.itemIcons?.[itemIndex] || {}) })); itemIcons[index] = { ...itemIcons[index], ...patch }; updateBlock({ itemIcons }); }
  if (block.type === "layout") return <div className="marketing-layout-guidance"><Columns2 size={22} /><strong>{block.columns.length} editable column{block.columns.length === 1 ? "" : "s"}</strong><p>Drag content into any column, then select each nested block to edit it. Blocks can move between compatible columns.</p><small>{(block.columnWidths || block.columns.map(() => 1)).join(":")} ratio · {block.mobileStack === false ? "kept side by side" : "stacks on mobile"}</small></div>;
  if (["product", "productRecommendation"].includes(block.type)) return <ProductContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} />;
  if (block.type === "image") return <><ImageContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /><label><span>Caption</span><textarea rows="3" value={block.caption || ""} onChange={(event) => updateBlock({ caption: event.target.value })} /></label><label><span>Destination URL</span><input placeholder="Optional https://" value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} /></label><label><span>Link title</span><input value={block.linkTitle || ""} onChange={(event) => updateBlock({ linkTitle: event.target.value })} /></label></>;
  if (block.type === "logo") return <><ImageContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /><label><span>Website link</span><input value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} /></label></>;
  if (block.type === "heading") return <><PersonalizationField label="Heading text" multiline rows={4} value={block.content || ""} onChange={(content) => updateBlock({ content })} /><label><span>Heading level</span><select value={block.level || "h2"} onChange={(event) => updateBlock({ level: event.target.value })}><option value="h1">H1 · Main heading</option><option value="h2">H2 · Section heading</option><option value="h3">H3 · Subheading</option><option value="p">Paragraph-style heading</option></select></label><label><span>Optional destination link</span><input placeholder="https://" value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} /></label></>;
  if (block.type === "text") return <><label><span>Paragraph content</span><RichTextEditor value={block.content || ""} onChange={(content) => updateBlock({ content })} /></label><small>Formatting is sanitized for safe email output. Paste from Word, Google Docs, or websites is cleaned automatically.</small></>;
  if (block.type === "button") return <><PersonalizationField label="Button label" value={block.content || ""} onChange={(content) => updateBlock({ content })} /><label><span>Destination URL</span><input className={block.link && !validMarketingUrl(block.link) ? "invalid" : ""} placeholder="https://" value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} />{block.link && !validMarketingUrl(block.link) ? <small className="marketing-icon-error">Enter a valid destination.</small> : null}</label><label><span>Tracking identifier</span><input placeholder="Optional internal label" value={block.trackingId || ""} onChange={(event) => updateBlock({ trackingId: event.target.value })} /></label><label><span>Accessibility title</span><input value={block.title || ""} onChange={(event) => updateBlock({ title: event.target.value })} /></label></>;
  if (["divider", "spacer"].includes(block.type)) return <div className="marketing-layout-guidance"><Minus size={22} /><strong>{block.type === "divider" ? "Visual separator" : "Responsive spacing"}</strong><p>Use the Style tab to configure this {block.type} independently for desktop and mobile.</p></div>;
  if (block.type === "video") return <><label><span>Video URL</span><input placeholder="YouTube, Vimeo, or direct destination" value={block.videoUrl || ""} onChange={(event) => updateBlock({ videoUrl: event.target.value, link: event.target.value })} /></label><ImageContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /><PersonalizationField label="Video title" value={block.content || ""} onChange={(content) => updateBlock({ content })} /><label><span>Fallback destination URL</span><input value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} /></label><label><span>Caption</span><textarea rows="3" value={block.caption || ""} onChange={(event) => updateBlock({ caption: event.target.value })} /></label><small>Email clients receive a clickable thumbnail that opens the video in a browser.</small></>;
  if (block.type === "social") return <SocialContentSettings block={block} updateBlock={updateBlock} />;
  if (block.type === "survey") return <SurveyContentSettings block={block} updateBlock={updateBlock} />;
  if (block.type === "code") { const sanitized = sanitizeEmailFragment(block.content); return <><label><span>Email-safe HTML</span><textarea className="marketing-code-editor" rows="14" spellCheck="false" value={block.content || ""} onChange={(event) => updateBlock({ content: event.target.value })} /></label><div className={`marketing-code-validation${sanitized !== block.content ? " warning" : " success"}`}><strong>{sanitized !== block.content ? "Unsafe or unsupported markup will be removed" : "HTML is email-safe"}</strong><p>Scripts, forms, event handlers, embeds, and executable URLs are blocked. Rendering can still vary between email clients.</p></div><div className="marketing-code-mini-preview" dangerouslySetInnerHTML={{ __html: sanitized }} /></>; }
  if (block.type === "footer") return <FooterContentSettings block={block} updateBlock={updateBlock} />;
  if (block.type === "treatment") return <><PersonalizationField label="Treatment rows" multiline rows={8} value={block.content || ""} onChange={(content) => updateBlock({ content })} /><small>Separate each treatment with a blank line. Put the title on the first line and its description below.</small><div className="marketing-treatment-icon-list">{treatmentRows.map((row, index) => <TreatmentIconEditor icon={block.itemIcons?.[index] || {}} key={`${block.id}-icon-${index}`} notify={notify} onChange={(patch) => updateTreatmentIcon(index, patch)} title={row.split("\n")[0].trim()} uploadImage={uploadImage} />)}</div></>;
  if (block.type === "apps") return <div className="marketing-layout-guidance"><CircleAlert size={22} /><strong>Integration unavailable</strong><p>This legacy Apps block is preserved so existing campaigns do not lose content, but it cannot be added to new campaigns until an approved integration is connected.</p></div>;
  return <PersonalizationField label="Text" multiline rows={6} value={block.content || ""} onChange={(content) => updateBlock({ content })} />;
}

function BlockStyleSettings({ block, updateBlock }) {
  if (block.type === "layout") return <LayoutSettings block={block} updateBlock={updateBlock} />;
  if (["product", "productRecommendation"].includes(block.type)) return <ProductStyleSettings block={block} updateBlock={updateBlock} />;
  if (block.type === "video") return <><label><span>Play button style</span><select value={block.playStyle || "circle"} onChange={(event) => updateBlock({ playStyle: event.target.value })}><option value="circle">Circle</option><option value="minimal">Minimal</option><option value="solid">Solid</option></select></label><ColorField label="Play button color" value={block.playColor || "#ffffff"} onChange={(playColor) => updateBlock({ playColor })} /><ImageStyleSettings block={block} updateBlock={updateBlock} /></>;
  if (["image", "logo"].includes(block.type)) return <ImageStyleSettings block={block} updateBlock={updateBlock} />;
  if (block.type === "heading") return <><TypographyStyleSettings block={block} updateBlock={updateBlock} /><NumberField label="Font weight" min={300} max={900} suffix="" value={block.fontWeight ?? 500} onChange={(fontWeight) => updateBlock({ fontWeight })} /><label><span>Text decoration</span><select value={block.textDecoration || "none"} onChange={(event) => updateBlock({ textDecoration: event.target.value })}><option value="none">None</option><option value="underline">Underline</option><option value="line-through">Strikethrough</option></select></label><NumberField label="Margin above" min={0} max={100} value={block.marginTop ?? 0} onChange={(marginTop) => updateBlock({ marginTop })} /><NumberField label="Margin below" min={0} max={100} value={block.marginBottom ?? 0} onChange={(marginBottom) => updateBlock({ marginBottom })} /></>;
  if (block.type === "button") return <><AlignmentField value={block.align || "center"} onChange={(align) => updateBlock({ align })} /><ToggleField checked={block.fullWidth} label="Full width on desktop" onChange={(fullWidth) => updateBlock({ fullWidth })} /><ToggleField checked={block.mobileFullWidth} label="Full width on mobile" onChange={(mobileFullWidth) => updateBlock({ mobileFullWidth })} /><ColorField label="Background" value={block.background || "#4a2d1c"} onChange={(background) => updateBlock({ background })} /><ColorField label="Text color" value={block.textColor || "#ffffff"} onChange={(textColor) => updateBlock({ textColor })} /><label><span>Font</span><select value={block.fontFamily || "Arial"} onChange={(event) => updateBlock({ fontFamily: event.target.value })}><option>Arial</option><option>Georgia</option><option>Inter</option><option>Verdana</option></select></label><NumberField label="Font size" min={10} max={30} value={block.fontSize ?? 15} onChange={(fontSize) => updateBlock({ fontSize })} /><NumberField label="Font weight" min={300} max={900} suffix="" value={block.fontWeight ?? 700} onChange={(fontWeight) => updateBlock({ fontWeight })} /><ColorField label="Border color" value={block.borderColor || "#4a2d1c"} onChange={(borderColor) => updateBlock({ borderColor })} /><NumberField label="Border width" min={0} max={12} value={block.borderWidth ?? 1} onChange={(borderWidth) => updateBlock({ borderWidth })} /><NumberField label="Corner radius" min={0} max={80} value={block.borderRadius ?? 6} onChange={(borderRadius) => updateBlock({ borderRadius })} /><NumberField label="Horizontal padding" min={8} max={80} value={block.horizontalPadding ?? 28} onChange={(horizontalPadding) => updateBlock({ horizontalPadding })} /><NumberField label="Vertical padding" min={4} max={40} value={block.verticalPadding ?? 13} onChange={(verticalPadding) => updateBlock({ verticalPadding })} /><NumberField label="Spacing around button" min={0} max={80} value={block.padding ?? 16} onChange={(padding) => updateBlock({ padding })} /></>;
  if (block.type === "divider") return <><ColorField label="Line color" value={block.color || "#ddd4c9"} onChange={(color) => updateBlock({ color })} /><NumberField label="Thickness" min={1} max={12} value={block.thickness ?? 1} onChange={(thickness) => updateBlock({ thickness })} /><label><span>Line style</span><select value={block.lineStyle || "solid"} onChange={(event) => updateBlock({ lineStyle: event.target.value })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label><NumberField label="Width" min={10} max={100} suffix="%" value={block.width ?? 100} onChange={(width) => updateBlock({ width })} /><AlignmentField value={block.align || "center"} onChange={(align) => updateBlock({ align })} /><NumberField label="Spacing above" min={0} max={100} value={block.spacingTop ?? 16} onChange={(spacingTop) => updateBlock({ spacingTop })} /><NumberField label="Spacing below" min={0} max={100} value={block.spacingBottom ?? 16} onChange={(spacingBottom) => updateBlock({ spacingBottom })} /></>;
  if (block.type === "spacer") return <><NumberField label="Desktop height" min={0} max={240} value={block.desktopHeight ?? 28} onChange={(desktopHeight) => updateBlock({ desktopHeight })} /><NumberField label="Mobile height" min={0} max={240} value={block.mobileHeight ?? 20} onChange={(mobileHeight) => updateBlock({ mobileHeight })} /></>;
  if (block.type === "social") return <><label><span>Icon style</span><select value={block.iconStyle || "outline"} onChange={(event) => updateBlock({ iconStyle: event.target.value })}><option value="outline">Outline</option><option value="filled">Filled</option><option value="text">Text</option></select></label><NumberField label="Icon size" min={14} max={48} value={block.iconSize ?? 24} onChange={(iconSize) => updateBlock({ iconSize })} /><ColorField label="Icon color" value={block.iconColor || "#4a3324"} onChange={(iconColor) => updateBlock({ iconColor })} /><NumberField label="Icon spacing" min={0} max={40} value={block.iconSpacing ?? 12} onChange={(iconSpacing) => updateBlock({ iconSpacing })} /><AlignmentField value={block.align || "center"} onChange={(align) => updateBlock({ align })} /><NumberField label="Vertical padding" min={0} max={80} value={block.padding ?? 16} onChange={(padding) => updateBlock({ padding })} /></>;
  if (block.type === "survey") return <><label><span>Answer style</span><select value={block.answerStyle || "button"} onChange={(event) => updateBlock({ answerStyle: event.target.value })}><option value="button">Buttons</option><option value="text">Text links</option></select></label><ColorField label="Answer background" value={block.background || "#4a2d1c"} onChange={(background) => updateBlock({ background })} /><ColorField label="Answer text" value={block.textColor || "#ffffff"} onChange={(textColor) => updateBlock({ textColor })} /><NumberField label="Corner radius" min={0} max={50} value={block.borderRadius ?? 6} onChange={(borderRadius) => updateBlock({ borderRadius })} /><TypographyStyleSettings block={block} updateBlock={updateBlock} /></>;
  if (block.type === "footer") return <><ColorField label="Background" value={block.background || "#ffffff"} onChange={(background) => updateBlock({ background })} /><ColorField label="Text color" value={block.color || "#4a3324"} onChange={(color) => updateBlock({ color })} /><ColorField label="Link color" value={block.linkColor || "#4a3324"} onChange={(linkColor) => updateBlock({ linkColor })} /><ToggleField checked={block.divider !== false} label="Show top divider" onChange={(divider) => updateBlock({ divider })} /><label><span>Column layout</span><select value={block.columnLayout || "single"} onChange={(event) => updateBlock({ columnLayout: event.target.value })}><option value="single">Single column</option><option value="two">Two columns</option></select></label><ToggleField checked={block.mobileStack !== false} label="Stack footer on mobile" onChange={(mobileStack) => updateBlock({ mobileStack })} /><TypographyStyleSettings block={block} updateBlock={updateBlock} /></>;
  return <TypographyStyleSettings block={block} updateBlock={updateBlock} />;
}

function BlockSettings({ block, loadMedia, notify, onUploadStateChange, settingsTab, setSettingsTab, updateBlock, uploadImage }) {
  if (!block) return <aside className="marketing-block-settings"><MarketingEmpty title="Select a block" copy="Choose a block on the canvas to edit it." /></aside>;
  const definition = blockDefinitions.find((item) => item.type === block.type);
  return <aside className="marketing-block-settings"><div className="marketing-panel-title"><strong>{block.type === "layout" ? `${block.columns.length}-column layout` : block.type === "treatment" ? "Treatments" : definition?.label || "Legacy block"}</strong><ChevronDown size={16} /></div><div className="marketing-settings-tabs"><button aria-selected={settingsTab === "content"} className={settingsTab === "content" ? "active" : ""} onClick={() => setSettingsTab("content")} role="tab" type="button">Content</button><button aria-selected={settingsTab === "style"} className={settingsTab === "style" ? "active" : ""} onClick={() => setSettingsTab("style")} role="tab" type="button">Style</button></div><div className="marketing-settings-fields">{settingsTab === "content" ? <BlockContentSettings block={block} loadMedia={loadMedia} notify={notify} onUploadStateChange={onUploadStateChange} updateBlock={updateBlock} uploadImage={uploadImage} /> : <BlockStyleSettings block={block} updateBlock={updateBlock} />}</div><VisibilitySettings block={block} updateBlock={updateBlock} /><LinkTrackingSettings block={block} updateBlock={updateBlock} /></aside>;
}

function AudienceSizeButton({ estimate, onViewRecipients }) {
  const formattedEstimate = estimate.toLocaleString("en-PH");
  return (
    <button aria-haspopup="dialog" className="marketing-audience-size-button" onClick={onViewRecipients} type="button">
      <strong>{formattedEstimate}</strong>
      <span>View recipients</span>
      <Eye aria-hidden="true" size={14} />
    </button>
  );
}

function AudienceRecipientsDialog({ channel, onClose, recipients, segment }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const pageSize = 50;
  const showEmail = channel !== "SMS";
  const showMobile = channel !== "Email";
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecipients = useMemo(() => {
    if (!normalizedQuery) return recipients;
    return recipients.filter((recipient) => [recipient.fullName, recipient.name, recipient.email, recipient.mobile]
      .some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));
  }, [normalizedQuery, recipients]);
  const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstRecipient = filteredRecipients.length ? ((currentPage - 1) * pageSize) + 1 : 0;
  const lastRecipient = Math.min(currentPage * pageSize, filteredRecipients.length);
  const visibleRecipients = filteredRecipients.slice(firstRecipient ? firstRecipient - 1 : 0, lastRecipient);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    function closeWithEscape(event) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [onClose]);

  return (
    <div aria-label="Audience recipients" aria-modal="true" className="marketing-audience-dialog" role="dialog">
      <button aria-label="Close audience recipients" className="marketing-email-preview-backdrop" onClick={onClose} type="button" />
      <section>
        <header>
          <div><span>Current delivery audience</span><h2>{segment}</h2><p>{recipients.length.toLocaleString("en-PH")} consented recipient{recipients.length === 1 ? "" : "s"} for {channel}</p></div>
          <button aria-label="Close audience recipients" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button>
        </header>
        <div className="marketing-audience-dialog-toolbar">
          <label><Search aria-hidden="true" size={16} /><span className="sr-only">Search audience recipients</span><input aria-label="Search audience recipients" autoFocus onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email or mobile" type="search" value={query} /></label>
          <p>Only contacts with valid details and consent for this channel are shown. Consent and suppressions are checked again before delivery.</p>
        </div>
        <div className="marketing-audience-table-wrap">
          {filteredRecipients.length ? (
            <table className="marketing-audience-recipient-table">
              <caption className="sr-only">Eligible recipients for {segment}</caption>
              <thead><tr><th scope="col">Recipient</th>{showEmail ? <th scope="col">Email address</th> : null}{showMobile ? <th scope="col">Mobile number</th> : null}<th scope="col">Branch</th></tr></thead>
              <tbody>{visibleRecipients.map((recipient, index) => {
                const name = recipient.fullName || recipient.name || "Unnamed client";
                return <tr key={recipient.id || `${recipient.email || recipient.mobile}-${firstRecipient + index}`}><td><span className="marketing-recipient-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span><strong>{name}</strong></td>{showEmail ? <td><Mail aria-hidden="true" size={14} /><span>{recipient.email || "No eligible email"}</span></td> : null}{showMobile ? <td><MessageSquareText aria-hidden="true" size={14} /><span>{recipient.mobile || "No eligible mobile"}</span></td> : null}<td>{recipient.branch || "All branches"}</td></tr>;
              })}</tbody>
            </table>
          ) : <MarketingEmpty title={query ? "No matching recipients" : "No eligible recipients"} copy={query ? "Try a different name, email address or mobile number." : `No contacts currently have valid details and consent for ${channel}.`} />}
        </div>
        <footer>
          <span>Showing {firstRecipient.toLocaleString("en-PH")}–{lastRecipient.toLocaleString("en-PH")} of {filteredRecipients.length.toLocaleString("en-PH")}</span>
          <div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button><span>Page {currentPage} of {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} type="button">Next</button></div>
        </footer>
      </section>
    </div>
  );
}

function ReviewStep({ approvalRequired, canApproveMarketing, draft, estimate, onViewRecipients, warnings }) {
  return (
    <section className="marketing-wizard-page review">
      <div className="marketing-review-card"><span className="marketing-eyebrow">Step 3 of 4</span><h2>Review every client-facing detail.</h2><p>Confirm the audience, channels and content before choosing a delivery time.</p>
        <dl><div><dt>Campaign</dt><dd>{draft.name}</dd></div><div><dt>Channel</dt><dd><ChannelPill value={draft.channel} /></dd></div><div><dt>Audience</dt><dd>{draft.segment}</dd></div><div><dt>Estimated recipients</dt><dd><AudienceSizeButton estimate={estimate} onViewRecipients={onViewRecipients} /></dd></div><div><dt>Email subject</dt><dd>{draft.channel === "SMS" ? "Not applicable" : draft.subject}</dd></div></dl>
        <div className={`marketing-approval-note ${approvalRequired ? "required" : "approved"}`}><Check size={18} aria-hidden="true" /><span><strong>{canApproveMarketing ? "Approved by your admin account" : approvalRequired ? "Administrator approval required" : "No approval step"}</strong><small>{canApproveMarketing ? "Your role can approve and schedule this campaign without a second administrator." : approvalRequired ? "The Marketing approval policy will hold delivery until an Admin or Business Owner approves it." : "The Marketing approval policy is currently turned off."}</small></span></div>
      </div>
      <aside className="marketing-checks-panel"><h3>Campaign checks</h3>{warnings.length ? warnings.map((warning) => <div className="warning" key={warning}><CircleAlert size={16} /><span>{warning}</span></div>) : <div className="success"><Check size={16} /><span>Content, links and required information are ready.</span></div>}<div className="success"><Check size={16} /><span>Unsubscribe footer is included automatically.</span></div><div className="success"><Check size={16} /><span>Consent and suppressions will be rechecked before delivery.</span></div></aside>
    </section>
  );
}

function ScheduleStep({ approvalRequired, canApproveMarketing, draft, estimate, onViewRecipients, updateDraft }) {
  return (
    <section className="marketing-wizard-page schedule">
      <div className="marketing-wizard-card"><span className="marketing-eyebrow">Step 4 of 4</span><h2>Choose when to send.</h2><p>Final delivery remains subject to channel consent, suppression and provider-readiness checks.</p>
        <label><span>Send date and time</span><input type="datetime-local" value={draft.scheduledAt} onChange={(event) => updateDraft({ scheduledAt: event.target.value })} /></label>
        <div className="marketing-final-confirmation"><h3>Final confirmation</h3><dl><div><dt>Channel</dt><dd>{draft.channel}</dd></div><div><dt>Audience</dt><dd>{draft.segment}</dd></div><div><dt>Audience size</dt><dd><AudienceSizeButton estimate={estimate} onViewRecipients={onViewRecipients} /></dd></div><div><dt>Sending time</dt><dd>{draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString("en-PH") : "Choose a time"}</dd></div><div><dt>Approval</dt><dd>{canApproveMarketing ? "Approved by your admin account" : approvalRequired ? "Administrator approval required" : "No approval step"}</dd></div></dl></div>
      </div>
    </section>
  );
}

function ChannelPill({ value = "SMS" }) {
  const email = value.toLowerCase().includes("email");
  const combined = value.includes("+");
  return <span className={`marketing-channel-pill ${combined ? "combined" : email ? "email" : "sms"}`}>{combined ? <Columns2 size={14} /> : email ? <Mail size={14} /> : <MessageSquareText size={14} />}{value}</span>;
}

function StatusPill({ value = "Draft" }) {
  return <span className={`marketing-status-pill status-${String(value).toLowerCase().replace(/\s+/g, "-")}`}>{value}</span>;
}

function MarketingEmpty({ action, copy, onAction, title }) {
  return <div className="marketing-empty"><span><Sparkles size={21} /></span><h3>{title}</h3><p>{copy}</p>{action && <button onClick={onAction} type="button">{action}</button>}</div>;
}

function MarketingLoading() {
  return <div className="marketing-loading" aria-label="Loading Marketing workspace"><div /><div /><div /><span>Loading Marketing workspace…</span></div>;
}

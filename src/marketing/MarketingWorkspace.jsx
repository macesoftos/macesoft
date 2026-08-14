import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
  Redo2,
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

import { marketingHash, marketingRouteFromHash } from "./routes.js";
import {
  buildVisualEmailHtml,
  emailHtmlToPlainText,
  MAX_EMAIL_HTML_LENGTH,
  previewPersonalizedHtml,
  sanitizeImportedEmailHtml,
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

const draftStorageKey = "mace-marketing-campaign-draft-v1";
const templateStorageKey = "mace-marketing-design-templates-v1";

const workspaceNavigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "templates", label: "Templates", icon: BookOpen },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

const campaignSteps = ["Audience", "Design", "Review", "Schedule"];

const blockDefinitions = [
  { type: "logo", label: "Logo", icon: PanelLeft },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "heading", label: "Heading", icon: Columns2 },
  { type: "text", label: "Text", icon: AlignLeft },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "treatment", label: "Treatments", icon: Sparkles },
  { type: "offer", label: "Offer", icon: BellRing },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveDown },
  { type: "social", label: "Social", icon: Users },
  { type: "contact", label: "Contact", icon: Mail },
];

const layoutDefinitions = [
  { type: "layout-1", label: "1 column", columns: 1 },
  { type: "layout-2", label: "2 columns", columns: 2 },
  { type: "layout-3", label: "3 columns", columns: 3 },
  { type: "layout-4", label: "4 columns", columns: 4 },
];

const starterTemplates = [
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
  const base = { id: createBlockId(type), type, align: "center", color: "#4a3324", padding: 16 };
  if (type.startsWith("layout-")) {
    const columnCount = Math.min(4, Math.max(1, Number(type.split("-")[1]) || 1));
    return {
      ...base,
      type: "layout",
      columns: Array.from({ length: columnCount }, () => []),
      background: "#ffffff",
      gap: 12,
      padding: 8,
    };
  }
  const blocks = {
    logo: { ...base, content: "MACE", alt: "MACE Signature Wellness" },
    image: { ...base, src: "/brand/result-1.jpg", alt: "MACE skincare client", link: "" },
    heading: { ...base, content: "Your summer glow starts here", fontSize: 32, fontFamily: "Georgia" },
    text: { ...base, content: "Refresh, restore and reveal brighter-looking skin with treatments selected for the season.", fontSize: 15 },
    button: { ...base, content: "Book a consultation", link: "https://macebydrmace.com/", background: "#4a2d1c" },
    treatment: { ...base, content: "Hydrodermabrasion\nDeeply cleanse and hydrate for smoother, clearer skin.\n\nPico-Rejuvenation Laser\nImprove tone, texture and clarity with minimal downtime." },
    offer: { ...base, content: "Seasonal skin consultation\nReserve your preferred schedule this month." },
    divider: { ...base, content: "" },
    spacer: { ...base, content: "", padding: 28 },
    social: { ...base, content: "Instagram · Facebook · Website", link: "https://macebydrmace.com/" },
    contact: { ...base, content: "MACE Signature Wellness\nDavao City, Philippines\nhello@macebydrmace.com" },
  };
  return blocks[type] ?? blocks.text;
}

function cloneEmailBlock(block) {
  const copy = { ...block, id: createBlockId(block.type) };
  if (block.type === "layout") {
    copy.columns = (block.columns || []).map((column) => column.map(cloneEmailBlock));
  }
  return copy;
}

function normalizedDesignBlock(block) {
  if (!block || typeof block !== "object" || typeof block.id !== "string" || typeof block.type !== "string") return null;
  if (block.type !== "layout") return { ...block };
  const columns = Array.isArray(block.columns) ? block.columns.slice(0, 4) : [];
  return {
    ...block,
    columns: (columns.length ? columns : [[]]).map((column) => (Array.isArray(column) ? column.map(normalizedDesignBlock).filter(Boolean) : [])),
  };
}

function createDefaultBlocks() {
  return ["logo", "image", "heading", "text", "treatment", "button", "divider", "contact"].map(newBlock);
}

function createDefaultDraft() {
  return {
    id: "",
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
    blocks: createDefaultBlocks(),
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
    blocks: savedBlocks.length ? savedBlocks : fallback.blocks,
    step: Math.min(4, Math.max(1, Number(value.step) || 1)),
  };
}

function daysSince(value) {
  if (!value) return -1;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return -1;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
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

function audienceEstimate(clients, segment, channel) {
  const definition = audienceDefinitions.find((item) => item.id === segment) ?? audienceDefinitions[0];
  return clients.filter((client) => definition.matches(client) && channelEligible(client, channel)).length;
}

function campaignDate(campaign) {
  const value = campaign.scheduledAt || campaign.sentAt || campaign.updatedAt || campaign.createdAt;
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

function navigateToMarketing(section, mode = "index", replace = false) {
  const nextUrl = `/${marketingHash(section, mode)}`;
  if (replace) window.history.replaceState(null, "", nextUrl);
  else window.history.pushState(null, "", nextUrl);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function routeFromLocation() {
  return marketingRouteFromHash(window.location.hash) ?? { section: "overview", mode: "index" };
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
      if (contentBlocks.some((block) => !String(block.content ?? block.src ?? "").trim() && !["divider", "spacer"].includes(block.type))) warnings.push("Complete or remove empty content blocks.");
      if (contentBlocks.some((block) => block.type === "button" && !block.link)) warnings.push("Add a destination link to every button.");
      if (contentBlocks.some((block) => block.type === "image" && !block.alt)) warnings.push("Add alternative text to every image.");
    }
  }
  if (draft.channel !== "Email" && !draft.message.trim()) warnings.push("Add text message content.");
  if (/medical|diagnosis|acne|botox|patient|procedure/i.test(`${draft.subject} ${draft.previewText}`)) warnings.push("Review the subject and preview text for sensitive treatment or medical details.");
  return warnings;
}

export default function MarketingWorkspace({
  campaigns = [],
  clients = [],
  globalSearch = "",
  isLoading = false,
  notify,
  onOpenGlobalNavigation,
  openModal,
  saveCampaign,
  sendCampaign,
  sendingCampaignId,
  settings = {},
  templates = [],
}) {
  const [route, setRoute] = useState(routeFromLocation);
  const [draft, setDraft] = useState(() => normalizedDraft(safeJsonRead(draftStorageKey, null)));
  const [savedTemplates, setSavedTemplates] = useState(() => safeJsonRead(templateStorageKey, []));

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
    document.title = route.mode === "create" ? `${draft.name || "Create campaign"} — Marketing — MACE` : `${label} — Marketing — MACE`;
    return () => {
      document.title = "Mace Clinic System";
    };
  }, [draft.name, route.mode, route.section]);

  useEffect(() => {
    safeJsonWrite(draftStorageKey, { ...draft, updatedAt: new Date().toISOString() });
  }, [draft]);

  const eligibleContacts = useMemo(
    () => clients.filter((client) => channelEligible(client, "Email + SMS")).length,
    [clients],
  );

  function navigate(section, mode = "index") {
    navigateToMarketing(section, mode);
    setRoute({ section, mode });
  }

  function beginCampaign(preset = {}) {
    setDraft(normalizedDraft({ ...createDefaultDraft(), step: 1, ...preset }));
    navigate("campaigns", "create");
  }

  function useTemplate(template) {
    beginCampaign({
      name: template.name,
      subject: template.name,
      step: 2,
      editorMode: template.html ? "html" : "visual",
      html: template.html || "",
      blocks: Array.isArray(template.blocks) && template.blocks.length ? template.blocks : createDefaultBlocks(),
    });
  }

  return (
    <div className="marketing-workspace" data-testid="marketing-workspace">
      <aside className="marketing-sidebar" aria-label="Marketing workspace navigation">
        <button
          className="marketing-sidebar-brand"
          onClick={onOpenGlobalNavigation}
          type="button"
          aria-label="Return to MACE applications"
        >
          <img src="/brand/mace-logo.png" alt="MACE" />
          <span>Applications</span>
          <ArrowLeft size={16} aria-hidden="true" />
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
        {route.mode === "create" ? (
          <CampaignBuilder
            clients={clients}
            draft={draft}
            notify={notify}
            onBack={() => navigate("campaigns")}
            onOpenGlobalNavigation={onOpenGlobalNavigation}
            onSaveCampaign={saveCampaign}
            onSaveTemplate={(template) => {
              const next = [...savedTemplates, template];
              setSavedTemplates(next);
              safeJsonWrite(templateStorageKey, next);
            }}
            setDraft={setDraft}
            settings={settings}
            templates={templates}
          />
        ) : (
          <>
            <MarketingHeader
              onCreate={() => beginCampaign()}
              onOpenGlobalNavigation={onOpenGlobalNavigation}
              section={route.section}
            />
            <div className="marketing-page-scroll">
              {isLoading ? (
                <MarketingLoading />
              ) : (
                <MarketingPage
                  campaigns={campaigns}
                  clients={clients}
                  globalSearch={globalSearch}
                  navigate={navigate}
                  notify={notify}
                  onCreate={beginCampaign}
                  onDeleteTemplate={(template) => {
                    const next = savedTemplates.filter((item) => item.id !== template.id);
                    setSavedTemplates(next);
                    safeJsonWrite(templateStorageKey, next);
                    notify?.("Saved template deleted.");
                  }}
                  onDuplicateTemplate={(template) => {
                    const copy = { ...template, id: createBlockId("template"), name: `${template.name} copy` };
                    const next = [...savedTemplates, copy];
                    setSavedTemplates(next);
                    safeJsonWrite(templateStorageKey, next);
                    notify?.("Template duplicated.");
                  }}
                  openModal={openModal}
                  savedTemplates={savedTemplates}
                  section={route.section}
                  sendCampaign={sendCampaign}
                  sendingCampaignId={sendingCampaignId}
                  settings={settings}
                  templates={templates}
                  onUseTemplate={useTemplate}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MarketingHeader({ onCreate, onOpenGlobalNavigation, section }) {
  const label = workspaceNavigation.find((item) => item.id === section)?.label ?? "Overview";
  return (
    <header className="marketing-header">
      <div className="marketing-heading-row">
        <button className="marketing-global-menu" onClick={onOpenGlobalNavigation} type="button" aria-label="Return to MACE applications">
          <Menu size={20} aria-hidden="true" />
        </button>
        <div>
          <p className="marketing-breadcrumb"><span>Marketing</span><ChevronRight size={14} aria-hidden="true" />{label}</p>
          <h1>{label}</h1>
        </div>
      </div>
      {section !== "settings" && (
        <button className="marketing-primary-button" onClick={onCreate} type="button">
          <Plus size={17} aria-hidden="true" /> Create campaign
        </button>
      )}
    </header>
  );
}

function MarketingPage(props) {
  switch (props.section) {
    case "campaigns": return <CampaignsPage {...props} />;
    case "templates": return <TemplatesPage {...props} />;
    case "audiences": return <AudiencesPage {...props} />;
    case "automations": return <AutomationsPage {...props} />;
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

function CampaignsPage({ campaigns, globalSearch, onCreate, openModal, sendCampaign, sendingCampaignId }) {
  const [channel, setChannel] = useState("All channels");
  const [status, setStatus] = useState("All statuses");
  const [query, setQuery] = useState("");
  const filtered = campaigns.filter((campaign) => {
    const search = `${globalSearch} ${query}`.trim().toLowerCase();
    return (!search || `${campaign.name} ${campaign.segment} ${campaign.channel} ${campaign.status}`.toLowerCase().includes(search))
      && (channel === "All channels" || campaign.channel === channel)
      && (status === "All statuses" || campaign.status === status);
  });
  return (
    <div className="marketing-list-page">
      <div className="marketing-toolbar">
        <label className="marketing-search"><Search size={16} /><input aria-label="Search campaigns" onChange={(event) => setQuery(event.target.value)} placeholder="Search campaigns" type="search" value={query} /></label>
        <label><span>Channel</span><select aria-label="Filter by channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option>All channels</option><option>Email</option><option>SMS</option><option>Email + SMS</option></select></label>
        <label><span>Status</span><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Draft</option><option>Scheduled</option><option>Sent</option><option>Partial</option></select></label>
      </div>
      {filtered.length ? (
        <div className="marketing-table-wrap">
          <table className="marketing-table">
            <thead><tr><th>Campaign</th><th>Channel</th><th>Audience</th><th>Status</th><th>Scheduled or sent</th><th>Delivery summary</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {filtered.map((campaign) => (
                <tr key={campaign.id}>
                  <td><strong>{campaign.name}</strong><small>{campaign.subject || "No email subject"}</small></td>
                  <td><ChannelPill value={campaign.channel} /></td>
                  <td>{campaign.segment}</td>
                  <td><StatusPill value={campaign.status} /></td>
                  <td>{campaignDate(campaign)}</td>
                  <td><strong>{Number(campaign.sent || 0).toLocaleString("en-PH")}</strong> delivered<small>{Number(campaign.booked || 0)} bookings</small></td>
                  <td><div className="marketing-row-actions"><button onClick={() => openModal("campaign", campaign)} type="button">Edit</button><button disabled={sendingCampaignId === campaign.id || campaign.channel === "Email + SMS"} onClick={() => sendCampaign(campaign.id)} title={campaign.channel === "Email + SMS" ? "Combined delivery requires the coordinated delivery endpoint" : undefined} type="button">{sendingCampaignId === campaign.id ? "Sending…" : campaign.channel === "Email + SMS" ? "Setup required" : "Send"}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <MarketingEmpty title="No campaigns match these filters" copy="Clear the filters or create a new campaign." action="Create campaign" onAction={onCreate} />}
    </div>
  );
}

function TemplatesPage({ notify, onDeleteTemplate, onDuplicateTemplate, onUseTemplate, savedTemplates, templates }) {
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const allTemplates = [...starterTemplates, ...savedTemplates];
  return (
    <div className="marketing-template-page">
      <section className="marketing-section-block no-surface">
        <div className="marketing-section-heading"><div><h2>Email starting templates</h2><p>Controlled layouts that clinic staff can customise safely.</p></div></div>
        <div className="marketing-template-grid">
          {allTemplates.map((template, index) => (
            <article className="marketing-template-card" key={`${template.id}-${index}`}>
              <div className={`marketing-template-preview preview-${index % 4}`}><span>MACE</span><i /><i /><b /></div>
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
        {templates.length ? <div className="marketing-message-templates">{templates.map((template) => <article key={template.id}><div><MessageSquareText size={18} /><strong>{template.name}</strong><StatusPill value={template.active ? "Active" : "Inactive"} /></div><p>{template.text}</p><small>{template.category}</small></article>)}</div> : <MarketingEmpty title="No text message templates" copy="Templates saved through the current service will appear here." />}
      </section>
      {previewTemplate && <div className="marketing-template-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${previewTemplate.name}`}><button className="marketing-dialog-backdrop" onClick={() => setPreviewTemplate(null)} type="button" aria-label="Close template preview" /><article><header><div><span>Template preview</span><h2>{previewTemplate.name}</h2></div><button onClick={() => setPreviewTemplate(null)} type="button" aria-label="Close template preview"><X size={18} /></button></header><div className="marketing-dialog-email"><strong>MACE</strong><img src="/brand/result-1.jpg" alt="MACE skincare client" /><h3>{previewTemplate.name}</h3><p>{previewTemplate.description || "A reusable MACE campaign design with clinic branding and an unsubscribe footer."}</p><button onClick={() => notify?.("Links are disabled in template preview.")} type="button">Book a consultation</button><footer>MACE Signature Wellness · <u>Unsubscribe</u></footer></div><footer><button onClick={() => setPreviewTemplate(null)} type="button">Close</button><button className="marketing-primary-button" onClick={() => onUseTemplate(previewTemplate)} type="button">Use this template</button></footer></article></div>}
    </div>
  );
}

function AudiencesPage({ clients, onCreate }) {
  return (
    <div className="marketing-audience-page">
      <div className="marketing-consent-notice"><UserCheck size={20} /><div><strong>Consent is applied per channel</strong><p>Estimates use channel-specific consent when available and the existing opt-in for legacy contacts. Suppressions and delivery failures must be rechecked by the provider before sending.</p></div></div>
      <div className="marketing-audience-grid">
        {audienceDefinitions.map((audience) => {
          const emailCount = clients.filter((client) => audience.matches(client) && channelEligible(client, "Email")).length;
          const smsCount = clients.filter((client) => audience.matches(client) && channelEligible(client, "SMS")).length;
          return <article key={audience.id}><div><span className="marketing-audience-icon"><Users size={19} /></span><StatusPill value="Saved" /></div><h3>{audience.name}</h3><p>{audience.description}</p><dl><div><dt>Email</dt><dd>{emailCount}</dd></div><div><dt>SMS</dt><dd>{smsCount}</dd></div></dl><button onClick={() => onCreate({ segment: audience.id, step: 1 })} type="button">Use audience <ChevronRight size={15} /></button></article>;
        })}
      </div>
    </div>
  );
}

function AutomationsPage({ onCreate }) {
  return (
    <div className="marketing-automation-page">
      <div className="marketing-consent-notice neutral"><Workflow size={20} /><div><strong>Start with simple clinic workflows</strong><p>Each automation opens as a reviewable draft. Delivery remains off until timing, channel consent and manager approval are confirmed.</p></div></div>
      <div className="marketing-automation-list">
        {automationDefinitions.map((automation) => <article key={automation.name}><span className="marketing-automation-icon"><CalendarClock size={20} /></span><div><h3>{automation.name}</h3><p>{automation.timing}</p><span>{automation.channel} · {automation.segment}</span></div><StatusPill value="Setup required" /><button onClick={() => onCreate({ name: automation.name, channel: automation.channel, segment: automation.segment, managerApproval: true, step: 1 })} type="button">Set up</button></article>)}
      </div>
    </div>
  );
}

function ReportsPage({ campaigns }) {
  const totalSent = campaigns.reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const emailSent = campaigns.filter((campaign) => campaign.channel?.toLowerCase().includes("email")).reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const smsSent = campaigns.filter((campaign) => campaign.channel === "SMS").reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const totalBooked = campaigns.reduce((sum, campaign) => sum + Number(campaign.booked || 0), 0);
  const maxSent = Math.max(1, ...campaigns.map((campaign) => Number(campaign.sent || 0)));
  return (
    <div className="marketing-reports-page">
      <div className="marketing-summary-strip reports">
        <article><span>Delivered</span><strong>{totalSent.toLocaleString("en-PH")}</strong><small>provider-confirmed messages</small></article>
        <article><span>Bookings recorded</span><strong>{totalBooked.toLocaleString("en-PH")}</strong><small>attributed to campaigns</small></article>
        <article><span>Booking response</span><strong>{totalSent ? `${Math.round((totalBooked / totalSent) * 100)}%` : "—"}</strong><small>bookings divided by delivered</small></article>
      </div>
      <section className="marketing-section-block">
        <div className="marketing-section-heading"><div><h2>Delivery by campaign</h2><p>Open, click, bounce and unsubscribe metrics will appear when the email provider boundary is connected.</p></div></div>
        {campaigns.length ? <div className="marketing-report-bars">{campaigns.slice(0, 8).map((campaign) => <article key={campaign.id}><div><strong>{campaign.name}</strong><span>{campaign.channel}</span></div><div className="marketing-report-track"><i style={{ width: `${Math.max(4, (Number(campaign.sent || 0) / maxSent) * 100)}%` }} /></div><b>{Number(campaign.sent || 0).toLocaleString("en-PH")}</b></article>)}</div> : <MarketingEmpty title="No delivery results yet" copy="Sent campaign results will appear here." />}
      </section>
      <div className="marketing-metric-table"><div><span>Metric</span><span>Email</span><span>SMS</span></div>{["Delivered", "Opened", "Clicked", "Bounced", "Unsubscribed"].map((metric) => <div key={metric}><strong>{metric}</strong><span>{metric === "Delivered" ? emailSent : "—"}</span><span>{metric === "Delivered" ? smsSent : "—"}</span></div>)}</div>
    </div>
  );
}

function MarketingSettingsPage({ notify, openModal, settings }) {
  const [localSettings, setLocalSettings] = useState(() => safeJsonRead("mace-marketing-settings-v1", {
    senderName: settings.company || "MACE Signature Wellness",
    replyTo: "hello@macebydrmace.com",
    unsubscribeText: "You are receiving this because you opted in to MACE marketing. Unsubscribe at any time.",
    managerApproval: true,
  }));
  function save() {
    safeJsonWrite("mace-marketing-settings-v1", localSettings);
    notify?.("Marketing preferences saved on this device.");
  }
  return (
    <div className="marketing-settings-page">
      <section className="marketing-settings-form">
        <div className="marketing-section-heading"><div><h2>Sender identity</h2><p>Shown clearly on all marketing messages.</p></div></div>
        <label><span>Sender name</span><input value={localSettings.senderName} onChange={(event) => setLocalSettings({ ...localSettings, senderName: event.target.value })} /></label>
        <label><span>Reply-to address</span><input type="email" value={localSettings.replyTo} onChange={(event) => setLocalSettings({ ...localSettings, replyTo: event.target.value })} /></label>
        <label className="span-2"><span>Default unsubscribe content</span><textarea rows="4" value={localSettings.unsubscribeText} onChange={(event) => setLocalSettings({ ...localSettings, unsubscribeText: event.target.value })} /></label>
        <label className="marketing-check span-2"><input type="checkbox" checked={localSettings.managerApproval} onChange={(event) => setLocalSettings({ ...localSettings, managerApproval: event.target.checked })} /><span><strong>Require manager approval</strong><small>Add an approval checkpoint before a campaign can be scheduled.</small></span></label>
        <div className="marketing-settings-actions span-2"><button onClick={() => openModal("settings", settings)} type="button">Edit clinic details</button><button className="marketing-primary-button" onClick={save} type="button"><Save size={16} /> Save settings</button></div>
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

function CampaignBuilder({ clients, draft, notify, onBack, onOpenGlobalNavigation, onSaveCampaign, onSaveTemplate, setDraft, settings, templates }) {
  const [selectedId, setSelectedId] = useState(draft.blocks[2]?.id || draft.blocks[0]?.id || "");
  const [preview, setPreview] = useState("desktop");
  const [settingsTab, setSettingsTab] = useState("content");
  const [blockQuery, setBlockQuery] = useState("");
  const [libraryTab, setLibraryTab] = useState("content");
  const [dragState, setDragState] = useState(null);
  const [insertTarget, setInsertTarget] = useState(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [saveState, setSaveState] = useState("Saved locally");
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const htmlFileInput = useRef(null);
  const selectedBlock = findEmailBlock(draft.blocks, selectedId) ?? draft.blocks[0];
  const estimate = audienceEstimate(clients, draft.segment, draft.channel);
  const warnings = campaignWarnings(draft);
  const visualEmailHtml = useMemo(
    () => buildVisualEmailHtml(draft, settings, typeof window === "undefined" ? "https://app.macebydrmace.com" : window.location.origin),
    [draft, settings],
  );
  const importedHtmlResult = useMemo(() => sanitizeImportedEmailHtml(draft.html), [draft.html]);

  useEffect(() => {
    setSaveState("Changes saved locally");
  }, [draft]);

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  }

  function selectEditorMode(editorMode) {
    if (editorMode === "html") {
      updateDraft({ editorMode, html: draft.html || visualEmailHtml });
      return;
    }
    updateDraft({ editorMode: "visual" });
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
    updateDraft({ editorMode: "html", html: result.html });
    notify?.(result.removed ? `HTML imported and cleaned. ${result.removed} unsupported item${result.removed === 1 ? "" : "s"} removed.` : "HTML imported.");
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
    undoStack.current.push(draft.blocks);
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
    updateDraft({ blocks: nextBlocks });
  }

  function updateSelected(patch) {
    commitBlocks(updateEmailBlock(draft.blocks, selectedId, patch));
  }

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
    const removed = removeEmailBlock(draft.blocks, id);
    commitBlocks(removed.blocks);
    const nextSelection = findEmailBlock(removed.blocks, removed.blocks[Math.max(0, location.index - 1)]?.id)
      || (location.containerId !== ROOT_EMAIL_CONTAINER ? findEmailBlock(removed.blocks, String(location.containerId).split("::column::")[0]) : null)
      || flattenEmailBlocks(removed.blocks, true)[0];
    setSelectedId(nextSelection?.id || "");
    setDragAnnouncement("Block deleted.");
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
    redoStack.current.push(draft.blocks);
    updateDraft({ blocks: previous });
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(draft.blocks);
    updateDraft({ blocks: next });
  }

  function dropOnCanvas(event, target = { containerId: ROOT_EMAIL_CONTAINER, index: draft.blocks.length }) {
    event.preventDefault();
    event.stopPropagation();
    const definitionType = event.dataTransfer.getData("application/x-marketing-block-type");
    const blockId = event.dataTransfer.getData("application/x-marketing-block-id");
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

  async function saveDraft() {
    setSaveState("Saving…");
    try {
      const emailResult = draft.channel === "SMS"
        ? { html: "", error: "" }
        : sanitizeImportedEmailHtml(draft.editorMode === "html" ? draft.html : visualEmailHtml);
      if (emailResult.error) throw new Error(emailResult.error);
      if (emailResult.removed) throw new Error("Clean the imported HTML before saving this campaign.");
      const emailSummary = emailHtmlToPlainText(emailResult.html);
      const message = draft.channel === "Email" ? emailSummary : draft.message;
      const savedCampaign = await onSaveCampaign?.({
        id: draft.id,
        name: draft.name,
        segment: draft.segment,
        channel: draft.channel,
        templateId: "",
        subject: draft.subject,
        message,
        html: emailResult.html,
        design: {
          version: 1,
          editorMode: draft.editorMode,
          previewText: draft.previewText,
          blocks: draft.blocks,
        },
        sent: 0,
        booked: 0,
        credits: 0,
        status: "Draft",
      });
      if (savedCampaign?.id && savedCampaign.id !== draft.id) updateDraft({ id: savedCampaign.id });
      setSaveState("Draft saved");
    } catch (error) {
      setSaveState("Save failed");
      notify?.(error.message || "Unable to save the campaign.", "error");
    }
  }

  function continueStep() {
    if (draft.step === 4) {
      notify?.("Scheduling remains unavailable until the approval and scheduling endpoints are connected.", "warning");
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
    updateDraft({ step: Math.min(4, draft.step + 1) });
  }

  return (
    <div className={`marketing-builder builder-step-${draft.step}`}>
      <header className="marketing-builder-header">
        <div className="marketing-builder-title">
          <button className="marketing-global-menu" onClick={onOpenGlobalNavigation} type="button" aria-label="Return to MACE applications"><Menu size={20} /></button>
          <button className="marketing-back-button" onClick={onBack} type="button" aria-label="Back to campaigns"><ArrowLeft size={18} /></button>
          <div><p>Campaigns <ChevronRight size={13} /> Create campaign</p><h1>{draft.name || "Untitled campaign"} <StatusPill value="Draft" /></h1></div>
        </div>
        <div className="marketing-builder-actions"><span>{saveState}</span><button onClick={saveDraft} type="button">Save draft</button><button onClick={() => notify?.("A test delivery endpoint is required before test emails can be sent.", "warning")} type="button">Send test</button><button className="marketing-primary-button" onClick={continueStep} type="button">{draft.step === 4 ? "Confirm schedule" : "Continue"}</button></div>
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
            <div className="marketing-library-tabs" role="tablist" aria-label="Builder elements">
              <button aria-selected={libraryTab === "content"} className={libraryTab === "content" ? "active" : ""} onClick={() => setLibraryTab("content")} role="tab" type="button">Content</button>
              <button aria-selected={libraryTab === "layouts"} className={libraryTab === "layouts" ? "active" : ""} onClick={() => setLibraryTab("layouts")} role="tab" type="button">Layouts</button>
            </div>
            {insertTarget && <div className="marketing-insert-notice"><span><strong>Choose a block</strong><small>It will be inserted at the selected line.</small></span><button onClick={() => setInsertTarget(null)} type="button" aria-label="Cancel insertion"><X size={15} /></button></div>}
            {libraryTab === "content" ? <>
              <div className="marketing-panel-title"><strong>Content blocks</strong><span>Drag to the canvas</span></div>
              <label className="marketing-builder-search"><Search size={15} /><input placeholder="Search blocks" value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} /></label>
              <div className="marketing-block-grid">
                {blockDefinitions.filter((block) => block.label.toLowerCase().includes(blockQuery.toLowerCase())).map(({ type, label, icon: Icon }) => <button draggable key={type} onClick={() => addBlock(type)} onDragEnd={endDrag} onDragStart={(event) => startLibraryDrag(event, type)} type="button" aria-label={`Drag or click to add ${label}`}><span className="marketing-library-grip"><GripVertical size={13} /></span><Icon size={23} /><span>{label}</span></button>)}
              </div>
            </> : <>
              <div className="marketing-panel-title"><strong>Column layouts</strong><span>Stack on mobile</span></div>
              <p className="marketing-library-copy">Add a responsive row, then drag content blocks into each column.</p>
              <div className="marketing-layout-grid">
                {layoutDefinitions.map((layout) => <button draggable key={layout.type} onClick={() => addBlock(layout.type)} onDragEnd={endDrag} onDragStart={(event) => startLibraryDrag(event, layout.type)} type="button" aria-label={`Drag or click to add ${layout.label}`}><span>{Array.from({ length: layout.columns }, (_, index) => <i key={index} />)}</span><strong>{layout.label}</strong></button>)}
              </div>
            </>}
            {draft.channel === "Email + SMS" ? (
              <label className="marketing-companion-message">
                <span>Companion text message</span>
                <textarea maxLength="480" onChange={(event) => updateDraft({ message: event.target.value })} placeholder="Write the coordinated text message…" rows="6" value={draft.message} />
                <small>{draft.message.length}/480 characters</small>
              </label>
            ) : <div className="marketing-saved-sections"><div className="marketing-panel-title"><strong>Saved sections</strong><ChevronDown size={16} /></div><p>Drag and drop your reusable clinic sections here.</p></div>}
          </aside>
          <section className={`marketing-canvas-panel ${dragState ? "is-dragging" : ""}`}>
            <div className="marketing-canvas-toolbar"><div className="marketing-preview-toggle"><button className={preview === "desktop" ? "active" : ""} onClick={() => setPreview("desktop")} type="button"><Monitor size={16} /> Desktop</button><button className={preview === "mobile" ? "active" : ""} onClick={() => setPreview("mobile")} type="button"><Smartphone size={16} /> Mobile</button></div><div><button disabled={!undoStack.current.length} onClick={undo} type="button"><Undo2 size={17} /> Undo</button><button disabled={!redoStack.current.length} onClick={redo} type="button"><Redo2 size={17} /> Redo</button></div></div>
            <div className={`marketing-email-frame ${preview}`}>
              <div className="marketing-email-preheader">{draft.previewText}</div>
              <EmailCanvasList
                blocks={draft.blocks}
                containerId={ROOT_EMAIL_CONTAINER}
                dragState={dragState}
                onDelete={deleteBlock}
                onDragEnd={endDrag}
                onDragStart={startCanvasDrag}
                onDrop={dropOnCanvas}
                onDuplicate={duplicateBlock}
                onInsert={(target) => { setInsertTarget(target); setLibraryTab("content"); }}
                onMove={moveBlock}
                onOver={(over) => setDragState((current) => current ? { ...current, over } : current)}
                onSelect={setSelectedId}
                selectedId={selectedId}
              />
              <footer><strong>{settings.company || "MACE Signature Wellness"}</strong><span>Davao City, Philippines · hello@macebydrmace.com</span><a href="#unsubscribe" onClick={(event) => event.preventDefault()}>Unsubscribe</a></footer>
            </div>
            <span className="marketing-drag-announcement" aria-live="polite">{dragAnnouncement}</span>
            {warnings.length > 0 && <div className="marketing-builder-warning"><CircleAlert size={17} /><span>{warnings.length} campaign check{warnings.length === 1 ? "" : "s"} remaining</span></div>}
          </section>
          <BlockSettings block={selectedBlock} settingsTab={settingsTab} setSettingsTab={setSettingsTab} updateBlock={updateSelected} />
        </div>
      )}
      {draft.step === 2 && draft.channel !== "SMS" && draft.editorMode === "html" && (
        <HtmlEmailEditor
          draft={draft}
          htmlResult={importedHtmlResult}
          notify={notify}
          onClean={cleanImportedHtml}
          preview={preview}
          setPreview={setPreview}
          updateDraft={updateDraft}
        />
      )}
      {draft.step === 3 && <ReviewStep draft={draft} estimate={estimate} warnings={warnings} updateDraft={updateDraft} />}
      {draft.step === 4 && <ScheduleStep draft={draft} estimate={estimate} updateDraft={updateDraft} />}
      {draft.step > 1 && <div className="marketing-builder-mobile-footer"><button onClick={() => updateDraft({ step: Math.max(1, draft.step - 1) })} type="button">Back</button><button className="marketing-primary-button" onClick={continueStep} type="button">{draft.step === 4 ? "Confirm schedule" : "Continue"}</button></div>}
      {draft.step === 2 && draft.channel !== "SMS" && <button className="marketing-save-template" onClick={() => { const result = sanitizeImportedEmailHtml(draft.editorMode === "html" ? draft.html : visualEmailHtml); if (result.error || result.removed) { notify?.(result.error || "Clean the imported HTML before saving it as a template.", "error"); return; } onSaveTemplate({ id: createBlockId("template"), name: draft.name, category: draft.editorMode === "html" ? "Imported HTML" : "Saved design", editorMode: draft.editorMode, html: result.html, blocks: draft.blocks }); notify?.("Design saved to Templates on this device."); }} type="button"><Save size={15} /> Save as template</button>}
    </div>
  );
}

function HtmlEmailEditor({ draft, htmlResult, notify, onClean, preview, setPreview, updateDraft }) {
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
      </aside>
      <section className="marketing-html-source">
        <header><div><strong>HTML source</strong><span>{draft.html.length.toLocaleString("en-US")} / {MAX_EMAIL_HTML_LENGTH.toLocaleString("en-US")}</span></div><small>Supports full documents, tables, media queries and inline CSS.</small></header>
        <textarea aria-label="Email HTML source" onChange={(event) => updateDraft({ html: event.target.value })} ref={sourceRef} spellCheck="false" value={draft.html} />
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

function EmailCanvasList({ blocks, containerId, dragState, onDelete, onDragEnd, onDragStart, onDrop, onDuplicate, onInsert, onMove, onOver, onSelect, selectedId }) {
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
              dragState={dragState}
              isSelected={block.id === selectedId}
              onDelete={onDelete}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDuplicate={onDuplicate}
              onInsert={onInsert}
              onMove={onMove}
              onOver={onOver}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ) : (
            <EmailBlock block={block} dragState={dragState} isSelected={block.id === selectedId} onDelete={onDelete} onDragEnd={onDragEnd} onDragStart={onDragStart} onDuplicate={onDuplicate} onMove={onMove} onSelect={onSelect} />
          )}
          <EmailDropZone containerId={containerId} dragState={dragState} index={index + 1} onDrop={onDrop} onInsert={onInsert} onOver={onOver} />
        </React.Fragment>
      ))}
    </div>
  );
}

function BlockActions({ blockId, onDelete, onDuplicate, onMove }) {
  return <div className="marketing-block-actions"><button onClick={(event) => { event.stopPropagation(); onMove(blockId, -1); }} type="button" aria-label="Move block up"><MoveUp size={15} /></button><button onClick={(event) => { event.stopPropagation(); onMove(blockId, 1); }} type="button" aria-label="Move block down"><MoveDown size={15} /></button><button onClick={(event) => { event.stopPropagation(); onDuplicate(blockId); }} type="button" aria-label="Duplicate block"><Copy size={15} /></button><button onClick={(event) => { event.stopPropagation(); onDelete(blockId); }} type="button" aria-label="Delete block"><Trash2 size={15} /></button></div>;
}

function EmailLayoutBlock({ block, dragState, isSelected, onDelete, onDragEnd, onDragStart, onDrop, onDuplicate, onInsert, onMove, onOver, onSelect, selectedId }) {
  return (
    <section
      aria-label={`${block.columns.length}-column layout`}
      className={`marketing-email-block marketing-layout-block ${isSelected ? "selected" : ""} ${dragState?.blockId === block.id ? "dragging" : ""}`}
      draggable
      onClick={() => onSelect(block.id)}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, block.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(block.id);
        if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); onMove(block.id, -1); }
        if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); onMove(block.id, 1); }
      }}
      style={{ background: block.background || "#ffffff", padding: block.padding ?? 8 }}
      tabIndex={0}
    >
      <span className="marketing-block-grip"><GripVertical size={16} /></span>
      {isSelected && <BlockActions blockId={block.id} onDelete={onDelete} onDuplicate={onDuplicate} onMove={onMove} />}
      <div className="marketing-layout-columns" style={{ gap: block.gap ?? 12, gridTemplateColumns: `repeat(${block.columns.length}, minmax(0, 1fr))` }}>
        {block.columns.map((column, columnIndex) => (
          <div className="marketing-layout-column" key={emailColumnId(block.id, columnIndex)} onClick={(event) => event.stopPropagation()}>
            <EmailCanvasList
              blocks={column}
              containerId={emailColumnId(block.id, columnIndex)}
              dragState={dragState}
              onDelete={onDelete}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDuplicate={onDuplicate}
              onInsert={onInsert}
              onMove={onMove}
              onOver={onOver}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function EmailBlock({ block, dragState, isSelected, onDelete, onDragEnd, onDragStart, onDuplicate, onMove, onSelect }) {
  const style = { color: block.color, textAlign: block.align, paddingTop: block.padding, paddingBottom: block.padding, fontSize: block.fontSize, fontFamily: block.fontFamily };
  return (
    <div className={`marketing-email-block ${isSelected ? "selected" : ""} ${dragState?.blockId === block.id ? "dragging" : ""} type-${block.type}`} draggable onClick={() => onSelect(block.id)} onDragEnd={onDragEnd} onDragStart={(event) => onDragStart(event, block.id)} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === "Enter") onSelect(block.id);
      if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); onMove(block.id, -1); }
      if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); onMove(block.id, 1); }
    }}>
      <span className="marketing-block-grip"><GripVertical size={16} /></span>
      <RenderedBlock block={block} style={style} />
      {isSelected && <BlockActions blockId={block.id} onDelete={onDelete} onDuplicate={onDuplicate} onMove={onMove} />}
    </div>
  );
}

function RenderedBlock({ block, style }) {
  if (block.type === "logo") return <div className="marketing-email-logo" style={style}><img src="/brand/mace-logo.png" alt={block.alt || "MACE"} /></div>;
  if (block.type === "image") return <div className="marketing-email-image" style={style}><img src={block.src || "/brand/result-1.jpg"} alt={block.alt || ""} /></div>;
  if (block.type === "heading") return <h2 style={style}>{block.content}</h2>;
  if (block.type === "text") return <p style={style}>{block.content}</p>;
  if (block.type === "button") return <div className="marketing-email-button-wrap" style={style}><a href={block.link || "#missing-link"} onClick={(event) => event.preventDefault()} style={{ background: block.background }}>{block.content}</a></div>;
  if (block.type === "treatment") {
    const rows = String(block.content).split(/\n\s*\n/);
    return <div className="marketing-treatment-block" style={style}>{rows.map((row, index) => { const [title, ...copy] = row.split("\n"); return <div key={`${title}-${index}`}><span><Sparkles size={15} /></span><p><strong>{title}</strong><small>{copy.join(" ")}</small></p><ChevronRight size={16} /></div>; })}</div>;
  }
  if (block.type === "offer") return <div className="marketing-offer-block" style={style}><BellRing size={20} /><p>{block.content}</p></div>;
  if (block.type === "divider") return <div className="marketing-divider" style={style}><i /></div>;
  if (block.type === "spacer") return <div style={{ height: Math.max(16, Number(block.padding || 24)) }} aria-label="Spacer" />;
  if (block.type === "social") return <div className="marketing-social-block" style={style}>{block.content}</div>;
  if (block.type === "contact") return <div className="marketing-contact-block" style={style}>{String(block.content).split("\n").map((line) => <span key={line}>{line}</span>)}</div>;
  return null;
}

function BlockSettings({ block, settingsTab, setSettingsTab, updateBlock }) {
  if (!block) return <aside className="marketing-block-settings"><MarketingEmpty title="Select a block" copy="Choose a block on the canvas to edit it." /></aside>;
  const definition = blockDefinitions.find((item) => item.type === block.type);
  return (
    <aside className="marketing-block-settings">
      <div className="marketing-panel-title"><strong>{block.type === "layout" ? `${block.columns.length}-column layout` : definition?.label || "Block"}</strong><ChevronDown size={16} /></div>
      <div className="marketing-settings-tabs"><button className={settingsTab === "content" ? "active" : ""} onClick={() => setSettingsTab("content")} type="button">Content</button><button className={settingsTab === "style" ? "active" : ""} onClick={() => setSettingsTab("style")} type="button">Style</button></div>
      {settingsTab === "content" ? block.type === "layout" ? <div className="marketing-layout-guidance"><Columns2 size={22} /><strong>Fill each column</strong><p>Drag content blocks from the left panel into a column. You can reorder content within a column or move it between columns.</p><small>Columns automatically stack on mobile.</small></div> : <div className="marketing-settings-fields">
        {!['divider', 'spacer', 'image', 'logo'].includes(block.type) && <label><span>Text <button onClick={() => updateBlock({ content: `${block.content} {{first_name}}` })} type="button">Personalize</button></span><textarea rows="6" value={block.content || ""} onChange={(event) => updateBlock({ content: event.target.value })} /><small>Available token: {'{{first_name}}'}</small></label>}
        {block.type === "image" && <><label><span>Image URL</span><input value={block.src || ""} onChange={(event) => updateBlock({ src: event.target.value })} /></label><label><span>Alternative text</span><input value={block.alt || ""} onChange={(event) => updateBlock({ alt: event.target.value })} /></label></>}
        {["button", "image", "social"].includes(block.type) && <label><span>Link</span><div className="marketing-input-with-icon"><Link size={15} /><input placeholder="https://" value={block.link || ""} onChange={(event) => updateBlock({ link: event.target.value })} /></div></label>}
      </div> : block.type === "layout" ? <div className="marketing-settings-fields">
        <label><span>Background</span><div className="marketing-color-input"><input type="color" value={block.background || "#ffffff"} onChange={(event) => updateBlock({ background: event.target.value })} /><input value={block.background || "#ffffff"} onChange={(event) => updateBlock({ background: event.target.value })} /></div></label>
        <label><span>Column gap</span><div className="marketing-input-suffix"><input min="0" max="40" type="number" value={block.gap ?? 12} onChange={(event) => updateBlock({ gap: Number(event.target.value) })} /><span>px</span></div></label>
        <label><span>Row padding</span><div className="marketing-input-suffix"><input min="0" max="60" type="number" value={block.padding ?? 8} onChange={(event) => updateBlock({ padding: Number(event.target.value) })} /><span>px</span></div></label>
      </div> : <div className="marketing-settings-fields">
        <label><span>Font</span><select value={block.fontFamily || "Inter"} onChange={(event) => updateBlock({ fontFamily: event.target.value })}><option>Inter</option><option>Georgia</option><option>Arial</option></select></label>
        <label><span>Size</span><div className="marketing-input-suffix"><input min="10" max="64" type="number" value={block.fontSize || 15} onChange={(event) => updateBlock({ fontSize: Number(event.target.value) })} /><span>px</span></div></label>
        <label><span>Color</span><div className="marketing-color-input"><input type="color" value={block.color || "#4a3324"} onChange={(event) => updateBlock({ color: event.target.value })} /><input value={block.color || "#4a3324"} onChange={(event) => updateBlock({ color: event.target.value })} /></div></label>
        <label><span>Alignment</span><div className="marketing-alignment-control">{[{ value: "left", icon: AlignLeft }, { value: "center", icon: AlignCenter }, { value: "right", icon: AlignRight }].map(({ value, icon: Icon }) => <button className={block.align === value ? "active" : ""} key={value} onClick={() => updateBlock({ align: value })} type="button" aria-label={`Align ${value}`}><Icon size={17} /></button>)}</div></label>
        <label><span>Vertical spacing</span><div className="marketing-input-suffix"><input min="0" max="80" type="number" value={block.padding ?? 16} onChange={(event) => updateBlock({ padding: Number(event.target.value) })} /><span>px</span></div></label>
      </div>}
      <details><summary>Visibility <ChevronDown size={15} /></summary><p>Visible on desktop and mobile.</p></details>
      <details><summary>Link tracking <ChevronDown size={15} /></summary><p>Provider tracking is applied when enabled in delivery settings.</p></details>
    </aside>
  );
}

function ReviewStep({ draft, estimate, warnings, updateDraft }) {
  return (
    <section className="marketing-wizard-page review">
      <div className="marketing-review-card"><span className="marketing-eyebrow">Step 3 of 4</span><h2>Review every client-facing detail.</h2><p>Confirm the audience, channels and content before choosing a delivery time.</p>
        <dl><div><dt>Campaign</dt><dd>{draft.name}</dd></div><div><dt>Channel</dt><dd><ChannelPill value={draft.channel} /></dd></div><div><dt>Audience</dt><dd>{draft.segment}</dd></div><div><dt>Estimated recipients</dt><dd>{estimate.toLocaleString("en-PH")}</dd></div><div><dt>Email subject</dt><dd>{draft.channel === "SMS" ? "Not applicable" : draft.subject}</dd></div></dl>
        <label className="marketing-check"><input type="checkbox" checked={draft.managerApproval} onChange={(event) => updateDraft({ managerApproval: event.target.checked })} /><span><strong>Manager approval required</strong><small>Keep this campaign in review until an authorised manager approves it.</small></span></label>
      </div>
      <aside className="marketing-checks-panel"><h3>Campaign checks</h3>{warnings.length ? warnings.map((warning) => <div className="warning" key={warning}><CircleAlert size={16} /><span>{warning}</span></div>) : <div className="success"><Check size={16} /><span>Content, links and required information are ready.</span></div>}<div className="success"><Check size={16} /><span>Unsubscribe footer is included automatically.</span></div><div className="success"><Check size={16} /><span>Consent and suppressions will be rechecked before delivery.</span></div></aside>
    </section>
  );
}

function ScheduleStep({ draft, estimate, updateDraft }) {
  return (
    <section className="marketing-wizard-page schedule">
      <div className="marketing-wizard-card"><span className="marketing-eyebrow">Step 4 of 4</span><h2>Choose when to send.</h2><p>Final delivery remains subject to channel consent, suppression and provider-readiness checks.</p>
        <label><span>Send date and time</span><input type="datetime-local" value={draft.scheduledAt} onChange={(event) => updateDraft({ scheduledAt: event.target.value })} /></label>
        <div className="marketing-final-confirmation"><h3>Final confirmation</h3><dl><div><dt>Channel</dt><dd>{draft.channel}</dd></div><div><dt>Audience</dt><dd>{draft.segment}</dd></div><div><dt>Audience size</dt><dd>{estimate.toLocaleString("en-PH")}</dd></div><div><dt>Sending time</dt><dd>{draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString("en-PH") : "Choose a time"}</dd></div><div><dt>Approval</dt><dd>{draft.managerApproval ? "Manager approval required" : "No approval step"}</dd></div></dl></div>
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

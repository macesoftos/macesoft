const defaultLinkTracking = {
  enabled: true,
  label: "",
  utmSource: "mace",
  utmMedium: "email",
  utmCampaign: "",
};

const defaultVisibility = { desktop: true, mobile: true };
const defaultResponsive = { mobileFontSize: null, mobilePadding: null, mobileWidth: 100 };

export const defaultEmailTheme = {
  canvasBackground: "#f4f1ed",
  contentBackground: "#ffffff",
  textColor: "#4a3324",
  headingColor: "#2f2119",
  linkColor: "#4a3324",
  buttonBackground: "#4a2d1c",
  buttonTextColor: "#ffffff",
  dividerColor: "#ddd4c9",
  fontFamily: "Arial",
  headingFontFamily: "Georgia",
  baseFontSize: 15,
  contentWidth: 640,
  sectionPadding: 16,
  mobilePadding: 16,
};

function commonBlock(id, type) {
  return {
    id,
    type,
    align: "center",
    color: "#4a3324",
    padding: 16,
    visibility: { ...defaultVisibility },
    responsive: { ...defaultResponsive },
    tracking: { ...defaultLinkTracking },
  };
}

export function createEmailBlock(type, createId, layoutDefinitions = []) {
  const id = createId(type);
  const base = commonBlock(id, type);
  if (type.startsWith("layout-")) {
    const definition = layoutDefinitions.find((layout) => layout.type === type) || layoutDefinitions[0] || { widths: [1] };
    return {
      ...base,
      type: "layout",
      columns: definition.widths.map(() => []),
      columnWidths: [...definition.widths],
      background: "#ffffff",
      backgroundImage: "",
      gap: 12,
      padding: 8,
      verticalAlign: "top",
      contained: true,
      sectionWidth: 100,
      borderColor: "#e2d8ce",
      borderWidth: 0,
      borderRadius: 0,
      mobileStack: true,
      mobileReverse: false,
    };
  }

  const definitions = {
    logo: {
      ...base,
      src: "/brand/zenshotech-wordmark.svg",
      alt: "ZenshoTech",
      link: "https://macebydrmace.com/",
      width: 140,
      mobileWidth: 120,
      background: "transparent",
    },
    image: {
      ...base,
      src: "/brand/result-1.jpg",
      alt: "ZenshoTech skincare client",
      decorative: false,
      caption: "",
      link: "",
      linkTitle: "",
      width: 100,
      maxWidth: 600,
      aspectRatio: "original",
      crop: "cover",
      zoom: 100,
      focalX: 50,
      focalY: 50,
      borderColor: "#d8cec4",
      borderWidth: 0,
      borderRadius: 0,
      background: "transparent",
    },
    heading: {
      ...base,
      content: "Your summer glow starts here",
      link: "",
      level: "h1",
      fontSize: 32,
      mobileFontSize: 27,
      fontFamily: "Georgia",
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: 0,
      textDecoration: "none",
      marginTop: 0,
      marginBottom: 0,
    },
    text: {
      ...base,
      content: "Refresh, restore and reveal brighter-looking skin with treatments selected for the season.",
      fontSize: 15,
      mobileFontSize: 15,
      fontFamily: "Arial",
      lineHeight: 1.6,
      letterSpacing: 0,
    },
    button: {
      ...base,
      content: "Book a consultation",
      link: "https://macebydrmace.com/",
      title: "Book a consultation",
      trackingId: "",
      background: "#4a2d1c",
      textColor: "#ffffff",
      fontFamily: "Arial",
      fontSize: 15,
      fontWeight: 700,
      borderColor: "#4a2d1c",
      borderWidth: 1,
      borderRadius: 6,
      horizontalPadding: 28,
      verticalPadding: 13,
      fullWidth: false,
      mobileFullWidth: false,
    },
    treatment: {
      ...base,
      content: "Hydrodermabrasion\nDeeply cleanse and hydrate for smoother, clearer skin.\n\nPico-Rejuvenation Laser\nImprove tone, texture and clarity with minimal downtime.",
      itemIcons: [],
    },
    offer: {
      ...base,
      content: "Seasonal skin consultation\nReserve your preferred schedule this month.",
      background: "#f7f2ec",
    },
    divider: {
      ...base,
      color: "#ddd4c9",
      thickness: 1,
      lineStyle: "solid",
      width: 100,
      spacingTop: 16,
      spacingBottom: 16,
    },
    spacer: {
      ...base,
      padding: 28,
      desktopHeight: 28,
      mobileHeight: 20,
    },
    video: {
      ...base,
      content: "Watch our treatment story",
      videoUrl: "https://macebydrmace.com/",
      src: "/brand/result-1.jpg",
      alt: "ZenshoTech treatment video preview",
      link: "https://macebydrmace.com/",
      caption: "",
      aspectRatio: "16:9",
      playStyle: "circle",
      playColor: "#ffffff",
      width: 100,
      borderRadius: 0,
    },
    social: {
      ...base,
      items: [
        { id: createId("social"), platform: "Instagram", url: "https://instagram.com/", label: "Follow ZenshoTech on Instagram" },
        { id: createId("social"), platform: "Website", url: "https://macebydrmace.com/", label: "Visit the ZenshoTech website" },
      ],
      iconStyle: "outline",
      iconSize: 24,
      iconColor: "#4a3324",
      iconSpacing: 12,
    },
    survey: {
      ...base,
      content: "How was your ZenshoTech experience?",
      choices: [
        { id: createId("answer"), label: "Excellent", value: "excellent" },
        { id: createId("answer"), label: "Good", value: "good" },
        { id: createId("answer"), label: "Needs improvement", value: "needs-improvement" },
      ],
      responseUrl: "",
      confirmationMessage: "Thank you for sharing your feedback.",
      answerStyle: "button",
      background: "#4a2d1c",
      textColor: "#ffffff",
      borderRadius: 6,
    },
    code: {
      ...base,
      content: "<div style=\"padding:20px;text-align:center\">Custom email-safe HTML</div>",
      align: "left",
    },
    product: {
      ...base,
      src: "/brand/result-1.jpg",
      alt: "ZenshoTech signature treatment",
      decorative: false,
      category: "ZENSHOTECH TREATMENT",
      title: "ZenshoTech Signature Treatment",
      description: "Personalised care selected for you.",
      ctaLabel: "Explore",
      ctaUrl: "https://macebydrmace.com/",
      ctaTitle: "Explore this treatment",
      ctaNewTab: true,
      secondaryCtaLabel: "",
      secondaryCtaUrl: "",
      hideImage: false,
      hideCategory: false,
      hideDescription: false,
      hideCta: false,
      imagePosition: "top",
      aspectRatio: "4:3",
      crop: "cover",
      zoom: 100,
      focalX: 50,
      focalY: 50,
      contentAlign: "top",
      background: "#ffffff",
      titleFontFamily: "Georgia",
      titleFontSize: 20,
      titleFontWeight: 600,
      titleColor: "#4a3324",
      categoryFontFamily: "Arial",
      categoryFontSize: 10,
      categoryColor: "#8b614b",
      descriptionFontFamily: "Arial",
      descriptionFontSize: 13,
      descriptionColor: "#5f554e",
      ctaFontFamily: "Arial",
      ctaFontSize: 13,
      ctaFontWeight: 700,
      ctaStyle: "text",
      ctaColor: "#4a3324",
      ctaBackground: "#4a2d1c",
      borderColor: "#d9cfc5",
      borderWidth: 1,
      borderRadius: 6,
      internalPadding: 16,
      itemSpacing: 8,
    },
    productRecommendation: {
      ...base,
      src: "/brand/result-2.jpg",
      alt: "Recommended ZenshoTech treatment",
      decorative: false,
      recommendationLabel: "RECOMMENDED FOR YOU",
      sourceType: "manual",
      productId: "",
      category: "ZENSHOTECH TREATMENT",
      title: "Recommended treatment",
      description: "Explore a treatment chosen around your goals.",
      ctaLabel: "Explore",
      ctaUrl: "https://macebydrmace.com/",
      ctaTitle: "Explore this recommendation",
      ctaNewTab: true,
      secondaryCtaLabel: "",
      secondaryCtaUrl: "",
      hideImage: false,
      hideCategory: false,
      hideDescription: false,
      hideCta: false,
      imagePosition: "top",
      aspectRatio: "4:3",
      crop: "cover",
      zoom: 100,
      focalX: 50,
      focalY: 50,
      contentAlign: "top",
      background: "#fffaf6",
      titleFontFamily: "Georgia",
      titleFontSize: 20,
      titleFontWeight: 600,
      titleColor: "#4a3324",
      categoryFontFamily: "Arial",
      categoryFontSize: 10,
      categoryColor: "#8b614b",
      descriptionFontFamily: "Arial",
      descriptionFontSize: 13,
      descriptionColor: "#5f554e",
      ctaFontFamily: "Arial",
      ctaFontSize: 13,
      ctaFontWeight: 700,
      ctaStyle: "text",
      ctaColor: "#4a3324",
      ctaBackground: "#4a2d1c",
      borderColor: "#d9cfc5",
      borderWidth: 1,
      borderRadius: 6,
      internalPadding: 16,
      itemSpacing: 8,
    },
    footer: {
      ...base,
      businessName: "ZenshoTech",
      address: "Davao City, Philippines",
      email: "hello@macebydrmace.com",
      phone: "",
      website: "https://macebydrmace.com/",
      legalText: "You are receiving this because you opted in to ZenshoTech marketing.",
      unsubscribeText: "Unsubscribe",
      unsubscribeUrl: "#unsubscribe",
      preferencesText: "Manage preferences",
      preferencesUrl: "#preferences",
      copyrightText: "© {{current_year}} ZenshoTech. All rights reserved.",
      socialItems: [],
      background: "#ffffff",
      linkColor: "#4a3324",
      divider: true,
      columnLayout: "single",
      mobileStack: true,
      fontSize: 12,
    },
    contact: {
      ...base,
      content: "ZenshoTech\nDavao City, Philippines\nhello@macebydrmace.com",
      fontSize: 12,
    },
  };

  return definitions[type] || definitions.text;
}

function legacyProductFields(block, fallback) {
  const [legacyTitle, ...legacyDescription] = String(block.content || "").split("\n");
  return {
    category: block.category ?? fallback.category,
    title: (block.title ?? legacyTitle) || fallback.title,
    description: (block.description ?? legacyDescription.join(" ")) || fallback.description,
    ctaLabel: block.ctaLabel ?? fallback.ctaLabel,
    ctaUrl: block.ctaUrl ?? block.link ?? fallback.ctaUrl,
  };
}

export function normalizeEmailBlock(block, createId, layoutDefinitions = []) {
  if (!block || typeof block !== "object" || typeof block.type !== "string") return null;
  const id = typeof block.id === "string" && block.id ? block.id : createId(block.type);
  if (block.type === "layout") {
    const columns = Array.isArray(block.columns) ? block.columns.slice(0, 4) : [[]];
    const fallback = createEmailBlock(`layout-${Math.max(1, columns.length)}`, createId, layoutDefinitions);
    return {
      ...fallback,
      ...block,
      id,
      visibility: { ...defaultVisibility, ...(block.visibility || {}) },
      responsive: { ...defaultResponsive, ...(block.responsive || {}) },
      columns: (columns.length ? columns : [[]]).map((column) => (Array.isArray(column) ? column.map((item) => normalizeEmailBlock(item, createId, layoutDefinitions)).filter(Boolean) : [])),
      columnWidths: Array.isArray(block.columnWidths) && block.columnWidths.length === (columns.length || 1)
        ? block.columnWidths.map((width) => Math.max(1, Number(width) || 1))
        : Array.from({ length: columns.length || 1 }, () => 1),
    };
  }

  const fallback = createEmailBlock(block.type, createId, layoutDefinitions);
  const normalized = {
    ...fallback,
    ...block,
    id,
    visibility: { ...defaultVisibility, ...(block.visibility || {}) },
    responsive: { ...defaultResponsive, ...(block.responsive || {}) },
    tracking: { ...defaultLinkTracking, ...(block.tracking || {}) },
  };
  if (["product", "productRecommendation"].includes(block.type)) {
    Object.assign(normalized, legacyProductFields(block, fallback));
  }
  if (block.type === "logo" && (!block.src || /\/brand\/mace-logo(?:-white)?\.(?:png|svg)$/i.test(block.src))) {
    normalized.src = "/brand/zenshotech-wordmark.svg";
    normalized.alt = "ZenshoTech";
  }
  if (block.type === "video") {
    normalized.videoUrl = block.videoUrl || block.link || fallback.videoUrl;
    normalized.link = block.link || block.videoUrl || fallback.link;
  }
  if (block.type === "social" && !Array.isArray(block.items)) normalized.items = fallback.items;
  if (block.type === "survey" && !Array.isArray(block.choices)) normalized.choices = fallback.choices;
  if (block.type === "footer" && block.content && !block.businessName) {
    const lines = String(block.content).split("\n").filter(Boolean);
    normalized.businessName = lines[0] || fallback.businessName;
    normalized.address = lines[1] || fallback.address;
    normalized.email = lines[2] || fallback.email;
    normalized.legalText = lines.slice(3).join(" ") || fallback.legalText;
  }
  return normalized;
}

export function cloneEmailBlockWithIds(block, createId) {
  const copy = {
    ...block,
    id: createId(block.type),
    visibility: { ...(block.visibility || defaultVisibility) },
    responsive: { ...(block.responsive || defaultResponsive) },
    tracking: { ...(block.tracking || defaultLinkTracking) },
  };
  if (block.type === "layout") {
    copy.columns = (block.columns || []).map((column) => column.map((item) => cloneEmailBlockWithIds(item, createId)));
  }
  if (Array.isArray(block.items)) copy.items = block.items.map((item) => ({ ...item, id: createId("social") }));
  if (Array.isArray(block.choices)) copy.choices = block.choices.map((item) => ({ ...item, id: createId("answer") }));
  if (Array.isArray(block.socialItems)) copy.socialItems = block.socialItems.map((item) => ({ ...item, id: createId("social") }));
  if (Array.isArray(block.itemIcons)) copy.itemIcons = block.itemIcons.map((item) => ({ ...item }));
  return copy;
}

export function validMarketingUrl(value, { allowTokens = true } = {}) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (allowTokens && /{{\s*[a-zA-Z0-9_]+(?:\s*\|\s*[^{}]+)?\s*}}/.test(url)) return true;
  if (/^(?:mailto:|tel:|#)/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return /^\/(?!\/)/.test(url);
  }
}

export function visibleOn(block, device) {
  return block?.visibility?.[device] !== false;
}

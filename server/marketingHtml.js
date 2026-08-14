import sanitizeHtmlLibrary from "sanitize-html";

export const MAX_MARKETING_HTML_LENGTH = 250_000;
export const MAX_MARKETING_DESIGN_LENGTH = 250_000;

const emailTags = [
  "html", "head", "body", "title", "style", "meta",
  "address", "article", "aside", "blockquote", "center", "div", "footer", "header", "main", "section",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "pre",
  "a", "abbr", "b", "br", "cite", "code", "em", "font", "hr", "i", "mark", "s", "small", "span", "strong", "sub", "sup", "u",
  "caption", "col", "colgroup", "table", "tbody", "td", "tfoot", "th", "thead", "tr",
  "li", "ol", "ul", "img",
];

const sharedAttributes = [
  "align", "aria-*", "background", "bgcolor", "border", "cellpadding", "cellspacing", "class", "data-*", "dir",
  "height", "id", "lang", "role", "style", "title", "valign", "width",
];

function marketingHtmlError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cleanUnsafeCss(value) {
  return String(value || "")
    .replace(/@import\s+(?:url\()?[^;]+;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/(?:behavior|-moz-binding)\s*:[^;}]+;?/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^)]*\)/gi, "");
}

function assertHtmlLength(value) {
  const html = String(value || "").trim();
  if (html.length > MAX_MARKETING_HTML_LENGTH) {
    throw marketingHtmlError(`Campaign HTML must be ${MAX_MARKETING_HTML_LENGTH.toLocaleString("en-US")} characters or fewer.`, 413);
  }
  return html;
}

export function sanitizeMarketingHtml(value) {
  const html = assertHtmlLength(value);
  if (!html) return "";

  const cleaned = cleanUnsafeCss(html);
  const sanitized = sanitizeHtmlLibrary(cleaned, {
    allowedTags: emailTags,
    allowedAttributes: {
      "*": sharedAttributes,
      a: [...sharedAttributes, "href", "name", "rel", "target"],
      col: [...sharedAttributes, "span"],
      img: [...sharedAttributes, "alt", "loading", "src"],
      meta: ["charset", "content", "name"],
      table: [...sharedAttributes, "summary"],
      td: [...sharedAttributes, "colspan", "headers", "rowspan"],
      th: [...sharedAttributes, "colspan", "headers", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "cid"],
    allowedSchemesAppliedToAttributes: ["href", "src", "background"],
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    disallowedTagsMode: "completelyDiscard",
    nonTextTags: ["script", "textarea", "option", "xmp", "iframe", "object", "embed", "form", "template", "svg", "math"],
    parser: { lowerCaseAttributeNames: true, lowerCaseTags: true },
    transformTags: {
      a: (tagName, attributes) => ({
        tagName,
        attribs: {
          ...attributes,
          ...(attributes.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  }).trim();

  if (!sanitized) return "";
  if (/<html[\s>]/i.test(sanitized)) return `<!doctype html>\n${sanitized}`;
  return `<!doctype html>\n<html><head><meta charset="utf-8"></head><body>${sanitized}</body></html>`;
}

export function marketingHtmlToText(value) {
  const html = sanitizeMarketingHtml(value);
  if (!html) return "";
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:address|article|blockquote|div|footer|h[1-6]|header|li|main|p|section|table|tr)>/gi, "\n");
  return sanitizeHtmlLibrary(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeMarketingDesign(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw marketingHtmlError("Campaign design must be an object.");
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_MARKETING_DESIGN_LENGTH) {
    throw marketingHtmlError(`Campaign design must be ${MAX_MARKETING_DESIGN_LENGTH.toLocaleString("en-US")} characters or fewer.`, 413);
  }
  return JSON.parse(serialized);
}

export function renderMarketingHtml(value, mergeValues = {}) {
  const html = sanitizeMarketingHtml(value);
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => sanitizeHtmlLibrary(String(mergeValues[key] ?? ""), {
    allowedTags: [],
    allowedAttributes: {},
  }));
}

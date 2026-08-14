export const MAX_EMAIL_HTML_LENGTH = 250_000;

const unsafeElements = "script,iframe,object,embed,form,input,button,textarea,select,option,base,link,video,audio,canvas,svg,math,template,xmp";
const unsafeUrlAttributes = new Set(["href", "src", "background", "poster", "action", "formaction", "srcdoc"]);

export function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value, fallback = "#4a3324") {
  const color = String(value || "").trim();
  return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(color) ? color : fallback;
}

function safeAlign(value) {
  return ["left", "center", "right"].includes(value) ? value : "center";
}

function safeNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function safeEmailUrl(value, origin = "https://app.macebydrmace.com") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^{{\s*[a-zA-Z0-9_]+\s*}}$/.test(url)) return url;
  if (/^(?:https?:|mailto:|tel:|cid:|#)/i.test(url)) return url;
  if (/^(?:\/|\.\/|\.\.\/)/.test(url)) {
    try {
      return new URL(url, origin).href;
    } catch {
      return "";
    }
  }
  return "";
}

function textLines(value) {
  return escapeEmailHtml(value).replace(/\n/g, "<br>");
}

function safeCodeFragment(value) {
  return String(value || "")
    .replace(/<\s*(script|iframe|object|embed|form|video|audio|canvas|svg|math|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|select|option|video|audio|canvas|svg|math|template)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[\s\S]*?\1/gi, "");
}

function blockEmailHtml(block, origin, theme) {
  if (block.type === "layout") {
    const columns = Array.isArray(block.columns) && block.columns.length ? block.columns.slice(0, 4) : [[]];
    const ratios = Array.isArray(block.columnWidths) && block.columnWidths.length === columns.length
      ? block.columnWidths.map((value) => Math.max(1, Number(value) || 1))
      : columns.map(() => 1);
    const totalRatio = ratios.reduce((sum, value) => sum + value, 0);
    const gap = safeNumber(block.gap, 0, 40, 12);
    const padding = safeNumber(block.padding, 0, 60, 8);
    const background = safeColor(block.background, "#ffffff");
    const cells = columns.map((column, index) => {
      const width = Number(((ratios[index] / totalRatio) * 100).toFixed(2));
      const content = (Array.isArray(column) ? column : []).map((child) => blockEmailHtml(child, origin, theme)).join("\n") || "&nbsp;";
      return `<td class="mace-stack-column" width="${width}%" valign="top" style="width:${width}%;padding:${padding}px ${gap / 2}px;background:${background}">${content}</td>`;
    }).join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${background}"><tr>${cells}</tr></table>`;
  }
  const align = safeAlign(block.align);
  const color = safeColor(block.color, theme.textColor);
  const padding = safeNumber(block.padding, 0, 80, 16);
  const fontSize = safeNumber(block.fontSize, 10, 64, 15);
  const style = `padding:${padding}px 28px;text-align:${align};color:${color};`;

  if (block.type === "logo") {
    const src = safeEmailUrl("/brand/mace-logo.png", origin);
    const link = safeEmailUrl(block.link, origin);
    const image = `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(block.alt || "MACE")}" width="140" style="display:inline-block;width:140px;max-width:60%;height:auto;border:0">`;
    return `<div style="${style}">${link ? `<a href="${escapeEmailHtml(link)}" target="_blank">${image}</a>` : image}</div>`;
  }
  if (block.type === "image") {
    const src = safeEmailUrl(block.src, origin);
    const link = safeEmailUrl(block.link, origin);
    const image = `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(block.alt)}" width="640" style="display:block;width:100%;height:auto;border:0">`;
    return `<div style="${style}">${link ? `<a href="${escapeEmailHtml(link)}" target="_blank">${image}</a>` : image}</div>`;
  }
  if (block.type === "heading") {
    return `<h1 style="${style}margin:0;font-family:${block.fontFamily === "Georgia" || theme.fontFamily === "Georgia" ? "Georgia,serif" : "Arial,sans-serif"};font-size:${fontSize}px;line-height:1.2">${textLines(block.content)}</h1>`;
  }
  if (block.type === "text") {
    return `<div style="${style}font-family:${theme.fontFamily === "Georgia" ? "Georgia,serif" : "Arial,sans-serif"};font-size:${fontSize}px;line-height:1.6">${textLines(block.content)}</div>`;
  }
  if (block.type === "button") {
    const link = safeEmailUrl(block.link, origin) || "#";
    return `<div style="${style}"><a href="${escapeEmailHtml(link)}" target="_blank" style="display:inline-block;padding:13px 28px;border-radius:6px;background:${safeColor(block.background, theme.buttonBackground)};color:${theme.buttonTextColor};font-family:Arial,sans-serif;font-size:15px;text-decoration:none">${escapeEmailHtml(block.content)}</a></div>`;
  }
  if (block.type === "treatment") {
    const rows = String(block.content || "").split(/\n\s*\n/).filter(Boolean).map((row, index) => {
      const [title, ...copy] = row.split("\n");
      const rowIcon = block.itemIcons?.[index] || {};
      const iconSrc = safeEmailUrl(rowIcon.src, origin);
      const icon = iconSrc
        ? `<img src="${escapeEmailHtml(iconSrc)}" alt="${escapeEmailHtml(rowIcon.alt || "")}" width="26" style="display:block;width:26px;height:26px;object-fit:contain;border:0">`
        : `<span style="display:inline-block;width:26px;height:26px;border:1px solid #cbb9a8;border-radius:50%;font-size:15px;line-height:26px;text-align:center">&#10022;</span>`;
      return `<tr><td width="46" align="center" valign="middle" style="width:46px;padding:14px 0 14px 18px;border-bottom:1px solid #e6ddd4">${icon}</td><td valign="middle" style="padding:14px 18px 14px 10px;border-bottom:1px solid #e6ddd4"><strong>${escapeEmailHtml(title)}</strong><br><span style="font-size:13px;color:#70675f">${escapeEmailHtml(copy.join(" "))}</span></td></tr>`;
    }).join("");
    return `<div style="${style}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ec">${rows}</table></div>`;
  }
  if (block.type === "offer") {
    return `<div style="${style}"><div style="padding:18px;border:1px solid #dccfc2;background:#f7f2ec;font-family:Arial,sans-serif;line-height:1.5">${textLines(block.content)}</div></div>`;
  }
  if (block.type === "divider") return `<div style="padding:${padding}px 28px"><hr style="margin:0;border:0;border-top:1px solid #ddd4c9"></div>`;
  if (block.type === "spacer") return `<div style="height:${padding}px;line-height:${padding}px">&nbsp;</div>`;
  if (block.type === "video") {
    const src = safeEmailUrl(block.src, origin);
    const link = safeEmailUrl(block.link, origin) || "#";
    return `<div style="${style}"><a href="${escapeEmailHtml(link)}" target="_blank" style="color:${theme.linkColor};text-decoration:none"><img src="${escapeEmailHtml(src)}" alt="Video preview" width="640" style="display:block;width:100%;height:auto;border:0"><strong style="display:block;padding-top:10px">▶ ${escapeEmailHtml(block.content || "Watch video")}</strong></a></div>`;
  }
  if (block.type === "social") {
    const link = safeEmailUrl(block.link, origin) || "#";
    return `<div style="${style}font-family:Arial,sans-serif"><a href="${escapeEmailHtml(link)}" target="_blank" style="color:${theme.linkColor}">${escapeEmailHtml(block.content)}</a></div>`;
  }
  if (block.type === "survey") {
    const link = safeEmailUrl(block.link, origin) || "#";
    return `<div style="${style}font-family:Arial,sans-serif"><strong style="display:block;margin-bottom:12px">${escapeEmailHtml(block.content)}</strong><a href="${escapeEmailHtml(link)}" target="_blank" style="display:inline-block;padding:11px 22px;border-radius:6px;background:${safeColor(block.background, theme.buttonBackground)};color:${theme.buttonTextColor};text-decoration:none">Answer survey</a></div>`;
  }
  if (block.type === "code") return `<div style="${style}">${safeCodeFragment(block.content)}</div>`;
  if (block.type === "apps") return `<div style="${style}font-family:Arial,sans-serif"><strong>Connected app content</strong><br>${textLines(block.content)}</div>`;
  if (["product", "productRecommendation"].includes(block.type)) {
    const src = safeEmailUrl(block.src, origin);
    const link = safeEmailUrl(block.link, origin) || "#";
    const [title, ...copy] = String(block.content || "").split("\n");
    return `<div style="${style}font-family:Arial,sans-serif"><a href="${escapeEmailHtml(link)}" target="_blank" style="color:${theme.linkColor};text-decoration:none"><img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(title || "MACE treatment")}" width="320" style="display:block;width:100%;height:auto;border:0"><small style="display:block;margin-top:12px;text-transform:uppercase;letter-spacing:.08em">${block.type === "productRecommendation" ? "Recommended for you" : "MACE treatment"}</small><strong style="display:block;margin-top:4px;font-size:18px">${escapeEmailHtml(title)}</strong><span style="display:block;margin-top:6px;line-height:1.5">${escapeEmailHtml(copy.join(" "))}</span><u style="display:block;margin-top:10px">Explore</u></a></div>`;
  }
  if (block.type === "footer") return `<div style="${style}font-family:Arial,sans-serif;font-size:${fontSize}px;line-height:1.6">${textLines(block.content)}</div>`;
  if (block.type === "contact") return `<div style="${style}font-family:Arial,sans-serif;font-size:12px;line-height:1.6">${textLines(block.content)}</div>`;
  return `<div style="${style}">${textLines(block.content)}</div>`;
}

export function buildVisualEmailHtml(draft, settings = {}, origin = "https://app.macebydrmace.com") {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const suppliedTheme = draft?.theme && typeof draft.theme === "object" ? draft.theme : {};
  const theme = {
    canvasBackground: safeColor(suppliedTheme.canvasBackground, "#f4f1ed"),
    contentBackground: safeColor(suppliedTheme.contentBackground, "#ffffff"),
    textColor: safeColor(suppliedTheme.textColor, "#4a3324"),
    linkColor: safeColor(suppliedTheme.linkColor, "#4a3324"),
    buttonBackground: safeColor(suppliedTheme.buttonBackground, "#4a2d1c"),
    buttonTextColor: safeColor(suppliedTheme.buttonTextColor, "#ffffff"),
    fontFamily: suppliedTheme.fontFamily === "Georgia" ? "Georgia" : "Arial",
    contentWidth: safeNumber(suppliedTheme.contentWidth, 480, 760, 640),
    mobilePadding: safeNumber(suppliedTheme.mobilePadding, 0, 40, 16),
  };
  const company = settings.company || "MACE Signature Wellness";
  const previewText = escapeEmailHtml(draft?.previewText || "");
  const content = blocks.map((block) => blockEmailHtml(block, origin, theme)).join("\n");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeEmailHtml(draft?.subject || draft?.name || company)}</title>
  <style>body{margin:0;background:${theme.canvasBackground};color:${theme.textColor};font-family:${theme.fontFamily === "Georgia" ? "Georgia,serif" : "Arial,sans-serif"}}table{border-collapse:collapse}img{max-width:100%}@media(max-width:680px){.mace-email{width:100%!important}.mace-pad{padding-left:${theme.mobilePadding}px!important;padding-right:${theme.mobilePadding}px!important}.mace-stack-column{display:block!important;width:100%!important;box-sizing:border-box!important}}</style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.canvasBackground}"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" class="mace-email" width="${theme.contentWidth}" cellpadding="0" cellspacing="0" style="width:${theme.contentWidth}px;max-width:100%;background:${theme.contentBackground}">
      <tr><td>${content}</td></tr>
      <tr><td style="padding:22px 28px;border-top:1px solid #ddd4c9;text-align:center;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:${theme.textColor}"><strong>${escapeEmailHtml(company)}</strong><br>Davao City, Philippines<br><a href="#unsubscribe" style="color:${theme.linkColor}">Unsubscribe</a></td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

function cleanCss(value) {
  return String(value || "")
    .replace(/@import\s+(?:url\()?[^;]+;?/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/(?:behavior|-moz-binding)\s*:[^;}]+;?/gi, "")
    .replace(/url\s*\(\s*(["']?)\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^)]*\)/gi, "");
}

export function sanitizeImportedEmailHtml(value) {
  const source = String(value || "").trim();
  if (source.length > MAX_EMAIL_HTML_LENGTH) {
    return { html: "", removed: 0, error: `HTML must be ${MAX_EMAIL_HTML_LENGTH.toLocaleString("en-US")} characters or fewer.` };
  }
  if (!source) return { html: "", removed: 0, error: "Add or import HTML to continue." };
  if (typeof DOMParser === "undefined") return { html: source, removed: 0, error: "" };

  const document = new DOMParser().parseFromString(source, "text/html");
  let removed = 0;
  document.querySelectorAll(unsafeElements).forEach((element) => {
    removed += 1;
    element.remove();
  });
  document.querySelectorAll("meta[http-equiv]").forEach((element) => {
    removed += 1;
    element.remove();
  });
  document.querySelectorAll("style").forEach((element) => {
    const cleaned = cleanCss(element.textContent);
    if (cleaned !== element.textContent) removed += 1;
    element.textContent = cleaned;
  });
  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ["nonce", "integrity", "ping"].includes(name)) {
        element.removeAttribute(attribute.name);
        removed += 1;
        return;
      }
      if (name === "style") {
        const cleaned = cleanCss(value);
        if (cleaned !== value) removed += 1;
        if (cleaned) element.setAttribute("style", cleaned);
        else element.removeAttribute("style");
        return;
      }
      if (unsafeUrlAttributes.has(name)) {
        const safeUrl = safeEmailUrl(value);
        if (!safeUrl) {
          element.removeAttribute(attribute.name);
          removed += 1;
        } else if (safeUrl !== value) {
          element.setAttribute(attribute.name, safeUrl);
        }
      }
    });
    if (element.tagName === "A" && element.getAttribute("target") === "_blank") {
      element.setAttribute("rel", "noopener noreferrer");
    }
  });
  if (!document.head.querySelector("meta[charset]")) {
    const charset = document.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    document.head.prepend(charset);
  }
  return { html: `<!doctype html>\n${document.documentElement.outerHTML}`, removed, error: "" };
}

export function emailHtmlToPlainText(value) {
  if (typeof DOMParser === "undefined") return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const document = new DOMParser().parseFromString(String(value || ""), "text/html");
  document.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  document.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr").forEach((element) => element.append("\n"));
  return String(document.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function previewPersonalizedHtml(value) {
  const samples = {
    first_name: "Alex",
    client: "Alex Rivera",
    name: "Alex Rivera",
    email: "alex@example.com",
    branch: "MACE Signature Wellness",
    company: "MACE Signature Wellness",
    campaign: "Summer Skin Reset",
    date: new Date().toLocaleDateString("en-PH"),
  };
  return String(value || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => escapeEmailHtml(samples[key] ?? `{{${key}}}`));
}

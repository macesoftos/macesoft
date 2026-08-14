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
  return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|[a-z]{3,20})$/i.test(color) ? color : fallback;
}

function safeAlign(value) {
  return ["left", "center", "right", "justify"].includes(value) ? value : "center";
}

function safeNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function safeFont(value, fallback = "Arial") {
  return ["Arial", "Georgia", "Inter", "Helvetica", "Tahoma", "Verdana", "Times New Roman"].includes(value) ? value : fallback;
}

function fontStack(value) {
  const font = safeFont(value);
  if (["Georgia", "Times New Roman"].includes(font)) return `${font === "Times New Roman" ? "'Times New Roman'" : font},serif`;
  return `${font},Arial,sans-serif`;
}

function safeCssToken(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function safeEmailUrl(value, origin = "https://app.macebydrmace.com") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^{{\s*[a-zA-Z0-9_]+(?:\s*\|\s*[^{}]+)?\s*}}$/.test(url)) return url;
  if (/^(?:https?:|mailto:|tel:|cid:|#)/i.test(url)) return url;
  if (/^(?:\/|\.\/|\.\.\/)/.test(url)) {
    try {
      const marketingAsset = url.match(/^\/api\/uploads\/([^/?#]+)$/);
      if (marketingAsset) return new URL(`/api/public/marketing-assets/${encodeURIComponent(decodeURIComponent(marketingAsset[1]))}`, origin).href;
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

export function sanitizeEmailFragment(value) {
  const source = String(value || "");
  const withoutExecutable = source
    .replace(/<\s*(script|iframe|object|embed|form|video|audio|canvas|svg|math|template|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|input|button|textarea|select|option|video|audio|canvas|svg|math|template|style)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[\s\S]*?\1/gi, "");
  return withoutExecutable;
}

export function sanitizeRichEmailText(value) {
  const clean = sanitizeEmailFragment(value);
  return clean
    .replace(/<(?!\/?(?:a|b|strong|i|em|u|s|br|ul|ol|li|span|p)(?:\s|>|\/))[^>]*>/gi, "")
    .replace(/<(a|span)\b([^>]*)>/gi, (_match, tag, attributes) => {
      const title = attributes.match(/\btitle\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const href = tag.toLowerCase() === "a" ? attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "" : "";
      const style = attributes.match(/\bstyle\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const safeStyle = style.split(";").map((rule) => rule.trim()).filter((rule) => /^(?:color|text-align|text-decoration|font-weight|font-style)\s*:/i.test(rule)).join(";");
      if (tag.toLowerCase() === "a") {
        const safeHref = safeEmailUrl(href);
        return safeHref ? `<a href="${escapeEmailHtml(safeHref)}"${title ? ` title="${escapeEmailHtml(title)}"` : ""}>` : "<span>";
      }
      return `<span${safeStyle ? ` style="${escapeEmailHtml(safeStyle)}"` : ""}>`;
    });
}

function trackedEmailUrl(block, rawUrl, origin) {
  const safe = safeEmailUrl(rawUrl, origin);
  if (!safe || block?.tracking?.enabled === false || /^(?:mailto:|tel:|#)/i.test(safe) || /unsubscribe|preferences/i.test(safe)) return safe;
  try {
    const url = new URL(safe);
    const tracking = block?.tracking || {};
    if (tracking.utmSource) url.searchParams.set("utm_source", tracking.utmSource);
    if (tracking.utmMedium) url.searchParams.set("utm_medium", tracking.utmMedium);
    if (tracking.utmCampaign) url.searchParams.set("utm_campaign", tracking.utmCampaign);
    if (tracking.label) url.searchParams.set("utm_content", tracking.label);
    return url.href;
  } catch {
    return safe;
  }
}

function visibilityClasses(block) {
  const classes = [];
  if (block?.visibility?.desktop === false && block?.visibility?.mobile !== false) classes.push("mace-mobile-only");
  if (block?.visibility?.mobile === false && block?.visibility?.desktop !== false) classes.push("mace-desktop-only");
  return classes.join(" ");
}

function responsiveClasses(block) {
  const classes = [];
  const mobileFont = Number(block?.mobileFontSize ?? block?.responsive?.mobileFontSize);
  const mobilePadding = Number(block?.responsive?.mobilePadding);
  const mobileWidth = Number(block?.responsive?.mobileWidth ?? block?.mobileWidth);
  if (Number.isFinite(mobileFont) && mobileFont >= 10 && mobileFont <= 64) classes.push(`mace-mf-${mobileFont}`);
  if (Number.isFinite(mobilePadding) && mobilePadding >= 0 && mobilePadding <= 80) classes.push(`mace-mp-${mobilePadding}`);
  if (block?.type === "logo") {
    const logoMobileWidth = Number(block.mobileWidth);
    if (Number.isFinite(logoMobileWidth) && logoMobileWidth >= 40 && logoMobileWidth <= 420) classes.push(`mace-logo-mw-${logoMobileWidth}`);
  } else if (Number.isFinite(mobileWidth) && mobileWidth >= 20 && mobileWidth <= 100) classes.push(`mace-mw-${mobileWidth}`);
  if (block?.type === "spacer") classes.push(`mace-sh-${safeNumber(block.mobileHeight, 0, 240, 20)}`);
  return classes.join(" ");
}

function wrapEmailBlock(block, html) {
  if (block?.visibility?.desktop === false && block?.visibility?.mobile === false) return "";
  const classes = [visibilityClasses(block), responsiveClasses(block)].filter(Boolean).join(" ");
  return classes ? `<div class="${classes}">${html}</div>` : html;
}

function ratioHeight(aspectRatio, width = 640) {
  const ratios = { "1:1": 1, "4:3": 3 / 4, "3:2": 2 / 3, "16:9": 9 / 16, "2:1": 1 / 2 };
  return ratios[aspectRatio] ? Math.round(width * ratios[aspectRatio]) : 0;
}

function imageMarkup(block, src, alt, width = 640) {
  const maxWidth = safeNumber(block.maxWidth, 80, 1200, width);
  const displayWidth = safeNumber(block.width, 20, 100, 100);
  const height = ratioHeight(block.aspectRatio, maxWidth);
  const radius = safeNumber(block.borderRadius, 0, 80, 0);
  const borderWidth = safeNumber(block.borderWidth, 0, 12, 0);
  const borderColor = safeColor(block.borderColor, "transparent");
  const focalX = safeNumber(block.focalX, 0, 100, 50);
  const focalY = safeNumber(block.focalY, 0, 100, 50);
  const crop = safeCssToken(block.crop, ["cover", "contain", "fill"], "cover");
  const zoom = safeNumber(block.zoom, 100, 200, 100) / 100;
  const margin = safeAlign(block.align) === "left" ? "0 auto 0 0" : safeAlign(block.align) === "right" ? "0 0 0 auto" : "0 auto";
  return `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(block.decorative ? "" : alt)}" width="${maxWidth}" style="display:block;width:${displayWidth}%;max-width:${maxWidth}px;${height ? `height:${height}px;object-fit:${crop};object-position:${focalX}% ${focalY}%;` : "height:auto;"}margin:${margin};border:${borderWidth}px solid ${borderColor};border-radius:${radius}px;box-sizing:border-box;${zoom > 1 ? `transform:scale(${zoom});transform-origin:${focalX}% ${focalY}%;` : ""}">`;
}

function naturalImageMarkup(block, src, alt) {
  const radius = safeNumber(block.borderRadius, 0, 80, 0);
  const borderWidth = safeNumber(block.borderWidth, 0, 12, 0);
  const borderColor = safeColor(block.borderColor, "transparent");
  const margin = safeAlign(block.align) === "left" ? "0 auto 0 0" : safeAlign(block.align) === "right" ? "0 0 0 auto" : "0 auto";
  return `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(block.decorative ? "" : alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;margin:${margin};border:${borderWidth}px solid ${borderColor};border-radius:${radius}px;box-sizing:border-box">`;
}

function surveyChoiceUrl(draft, block, choice, origin) {
  if (block.responseUrl) {
    try {
      const url = new URL(safeEmailUrl(block.responseUrl, origin));
      url.searchParams.set("answer", choice.value || choice.label);
      return `${url.href}${url.search ? "&" : "?"}recipient={{email|anonymous}}`;
    } catch {
      return "";
    }
  }
  if (!draft?.id) return "";
  const url = new URL(`/api/public/marketing/survey/${encodeURIComponent(draft.id)}/${encodeURIComponent(block.id)}`, origin);
  url.searchParams.set("answer", choice.value || choice.label);
  return `${url.href}&recipient={{email|anonymous}}`;
}

function blockEmailHtmlContent(block, origin, theme, draft) {
  if (block.type === "layout") {
    const columns = Array.isArray(block.columns) && block.columns.length ? block.columns.slice(0, 4) : [[]];
    const ratios = Array.isArray(block.columnWidths) && block.columnWidths.length === columns.length
      ? block.columnWidths.map((value) => Math.max(1, Number(value) || 1))
      : columns.map(() => 1);
    const totalRatio = ratios.reduce((sum, value) => sum + value, 0);
    const gap = safeNumber(block.gap, 0, 40, 12);
    const padding = safeNumber(block.padding, 0, 60, 8);
    const background = safeColor(block.background, "#ffffff");
    const borderWidth = safeNumber(block.borderWidth, 0, 12, 0);
    const borderColor = safeColor(block.borderColor, "transparent");
    const radius = safeNumber(block.borderRadius, 0, 60, 0);
    const verticalAlign = safeCssToken(block.verticalAlign, ["top", "middle", "bottom"], "top");
    const cells = columns.map((column, index) => {
      const width = Number(((ratios[index] / totalRatio) * 100).toFixed(2));
      const content = (Array.isArray(column) ? column : []).map((child) => blockEmailHtml(child, origin, theme, draft)).join("\n") || "&nbsp;";
      return `<td class="${block.mobileStack === false ? "mace-keep-column" : "mace-stack-column"}" width="${width}%" valign="${verticalAlign}" style="width:${width}%;padding:${padding}px ${gap / 2}px;background:${background}">${content}</td>`;
    });
    if (block.mobileReverse) cells.reverse();
    const backgroundImage = safeEmailUrl(block.backgroundImage, origin);
    const sectionWidth = block.contained === false ? 100 : safeNumber(block.sectionWidth, 40, 100, 100);
    return `<table role="presentation" width="${sectionWidth}%" align="center" cellpadding="0" cellspacing="0" style="width:${sectionWidth}%;margin:0 auto;background:${background}${backgroundImage ? ` url('${escapeEmailHtml(backgroundImage)}') center/cover no-repeat` : ""};border:${borderWidth}px solid ${borderColor};border-radius:${radius}px;overflow:hidden"><tr>${cells.join("")}</tr></table>`;
  }

  const align = safeAlign(block.align);
  const color = safeColor(block.color, theme.textColor);
  const padding = safeNumber(block.padding, 0, 80, theme.sectionPadding);
  const fontSize = safeNumber(block.fontSize, 10, 64, theme.baseFontSize);
  const style = `padding:${padding}px 28px;text-align:${align};color:${color};`;

  if (block.type === "logo") {
    const src = safeEmailUrl(block.src || "/brand/mace-logo.png", origin);
    const link = trackedEmailUrl(block, block.link, origin);
    const width = safeNumber(block.width, 40, 420, 140);
    const image = `<img src="${escapeEmailHtml(src)}" alt="${escapeEmailHtml(block.decorative ? "" : block.alt || "MACE")}" width="${width}" style="display:inline-block;width:${width}px;max-width:100%;height:auto;border:0">`;
    return `<div style="${style}background:${safeColor(block.background, "transparent")}">${link ? `<a href="${escapeEmailHtml(link)}" target="_blank" title="${escapeEmailHtml(block.linkTitle || block.alt || "MACE")}">${image}</a>` : image}</div>`;
  }
  if (block.type === "image") {
    const src = safeEmailUrl(block.src, origin);
    const link = trackedEmailUrl(block, block.link, origin);
    const image = src ? naturalImageMarkup(block, src, block.alt) : "";
    return `<div style="${style}background:${safeColor(block.background, "transparent")}">${link ? `<a href="${escapeEmailHtml(link)}" target="_blank" title="${escapeEmailHtml(block.linkTitle || block.alt || "Image link")}" style="text-decoration:none">${image}</a>` : image}${block.caption ? `<div style="padding-top:8px;font-family:${fontStack(theme.fontFamily)};font-size:12px;color:${color}">${escapeEmailHtml(block.caption)}</div>` : ""}</div>`;
  }
  if (block.type === "heading") {
    const level = safeCssToken(block.level, ["h1", "h2", "h3", "p"], "h2");
    const link = trackedEmailUrl(block, block.link, origin);
    const content = textLines(block.content);
    const heading = `<${level} class="mace-responsive-text" style="${style}margin:${safeNumber(block.marginTop, 0, 100, 0)}px 0 ${safeNumber(block.marginBottom, 0, 100, 0)}px;font-family:${fontStack(block.fontFamily || theme.headingFontFamily)};font-size:${fontSize}px;font-weight:${safeNumber(block.fontWeight, 300, 900, 600)};line-height:${safeNumber(block.lineHeight, 0.8, 3, 1.2)};letter-spacing:${safeNumber(block.letterSpacing, -5, 20, 0)}px;text-decoration:${safeCssToken(block.textDecoration, ["none", "underline", "line-through"], "none")}">${content}</${level}>`;
    return link ? `<a href="${escapeEmailHtml(link)}" target="_blank" style="color:inherit;text-decoration:none">${heading}</a>` : heading;
  }
  if (block.type === "text") {
    return `<div class="mace-responsive-text" style="${style}font-family:${fontStack(block.fontFamily || theme.fontFamily)};font-size:${fontSize}px;line-height:${safeNumber(block.lineHeight, 0.8, 3, 1.6)};letter-spacing:${safeNumber(block.letterSpacing, -5, 20, 0)}px">${sanitizeRichEmailText(block.content)}</div>`;
  }
  if (block.type === "button") {
    const link = trackedEmailUrl(block, block.link, origin) || "#";
    const fullWidth = block.fullWidth ? "display:block;text-align:center;width:100%;box-sizing:border-box" : "display:inline-block";
    return `<div style="${style}"><a class="${block.mobileFullWidth ? "mace-mobile-full" : ""}" href="${escapeEmailHtml(link)}" target="_blank" title="${escapeEmailHtml(block.title || block.content)}" data-tracking-id="${escapeEmailHtml(block.trackingId || "")}" style="${fullWidth};padding:${safeNumber(block.verticalPadding, 4, 40, 13)}px ${safeNumber(block.horizontalPadding, 8, 80, 28)}px;border:${safeNumber(block.borderWidth, 0, 12, 1)}px solid ${safeColor(block.borderColor, block.background)};border-radius:${safeNumber(block.borderRadius, 0, 80, 6)}px;background:${safeColor(block.background, theme.buttonBackground)};color:${safeColor(block.textColor, theme.buttonTextColor)};font-family:${fontStack(block.fontFamily)};font-size:${safeNumber(block.fontSize, 10, 30, 15)}px;font-weight:${safeNumber(block.fontWeight, 300, 900, 700)};text-decoration:none">${escapeEmailHtml(block.content)}</a></div>`;
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
    return `<div style="${style}"><div style="padding:18px;border:1px solid #dccfc2;background:${safeColor(block.background, "#f7f2ec")};font-family:${fontStack(theme.fontFamily)};line-height:1.5">${textLines(block.content)}</div></div>`;
  }
  if (block.type === "divider") {
    return `<div style="padding:${safeNumber(block.spacingTop, 0, 100, padding)}px 28px ${safeNumber(block.spacingBottom, 0, 100, padding)}px;text-align:${align}"><hr style="display:inline-block;width:${safeNumber(block.width, 10, 100, 100)}%;margin:0;border:0;border-top:${safeNumber(block.thickness, 1, 12, 1)}px ${safeCssToken(block.lineStyle, ["solid", "dashed", "dotted"], "solid")} ${safeColor(block.color, theme.dividerColor)}"></div>`;
  }
  if (block.type === "spacer") {
    const height = safeNumber(block.desktopHeight ?? block.padding, 0, 240, 28);
    return `<div class="mace-spacer" style="height:${height}px;line-height:${height}px">&nbsp;</div>`;
  }
  if (block.type === "video") {
    const src = safeEmailUrl(block.src, origin);
    const link = trackedEmailUrl(block, block.link || block.videoUrl, origin) || "#";
    const thumbnail = src ? imageMarkup({ ...block, maxWidth: 640, width: block.width || 100 }, src, block.alt || "Video preview", 640) : "";
    return `<div style="${style}"><a href="${escapeEmailHtml(link)}" target="_blank" title="${escapeEmailHtml(block.alt || block.content || "Open video")}" style="color:${theme.linkColor};text-decoration:none">${thumbnail}<strong style="display:block;padding-top:10px">&#9654; ${escapeEmailHtml(block.content || "Watch video")}</strong></a>${block.caption ? `<span style="display:block;padding-top:6px;font-size:12px">${escapeEmailHtml(block.caption)}</span>` : ""}</div>`;
  }
  if (block.type === "social") {
    const items = (Array.isArray(block.items) ? block.items : []).filter((item) => trackedEmailUrl(block, item.url, origin));
    const iconColor = safeColor(block.iconColor, theme.linkColor);
    const iconSize = safeNumber(block.iconSize, 14, 48, 24);
    const links = items.map((item) => {
      const text = block.iconStyle === "text" ? item.platform : String(item.platform || "?").slice(0, 1);
      const iconStyle = block.iconStyle === "text" ? `color:${iconColor};font-size:${Math.max(12, Math.min(iconSize, 18))}px;text-decoration:underline` : `width:${iconSize}px;height:${iconSize}px;border:1px solid ${iconColor};border-radius:50%;background:${block.iconStyle === "filled" ? iconColor : "transparent"};color:${block.iconStyle === "filled" ? "#ffffff" : iconColor};font-size:${Math.max(11, Math.round(iconSize * 0.55))}px;line-height:${iconSize}px;text-align:center;text-decoration:none`;
      return `<a href="${escapeEmailHtml(trackedEmailUrl(block, item.url, origin))}" target="_blank" title="${escapeEmailHtml(item.label || item.platform)}" style="display:inline-block;margin:0 ${safeNumber(block.iconSpacing, 0, 40, 12) / 2}px;${iconStyle}">${escapeEmailHtml(text)}</a>`;
    }).join("");
    return `<div style="${style}font-family:${fontStack(theme.fontFamily)}">${links}</div>`;
  }
  if (block.type === "survey") {
    const choices = (Array.isArray(block.choices) ? block.choices : []).map((choice) => {
      const link = surveyChoiceUrl(draft, block, choice, origin);
      if (!link) return "";
      return `<a href="${escapeEmailHtml(link)}" target="_blank" style="display:inline-block;margin:4px;padding:11px 18px;border:1px solid ${safeColor(block.background, theme.buttonBackground)};border-radius:${safeNumber(block.borderRadius, 0, 50, 6)}px;background:${block.answerStyle === "text" ? "transparent" : safeColor(block.background, theme.buttonBackground)};color:${block.answerStyle === "text" ? theme.linkColor : safeColor(block.textColor, theme.buttonTextColor)};text-decoration:${block.answerStyle === "text" ? "underline" : "none"}">${escapeEmailHtml(choice.label)}</a>`;
    }).join("");
    return `<div style="${style}font-family:${fontStack(theme.fontFamily)}"><strong style="display:block;margin-bottom:12px">${escapeEmailHtml(block.content)}</strong>${choices}</div>`;
  }
  if (block.type === "code") return `<div style="${style}">${sanitizeEmailFragment(block.content)}</div>`;
  if (["product", "productRecommendation"].includes(block.type)) {
    const link = trackedEmailUrl(block, block.ctaUrl, origin) || "#";
    const imageSrc = safeEmailUrl(block.src, origin);
    const image = !block.hideImage && imageSrc ? imageMarkup({ ...block, maxWidth: 480, width: 100 }, imageSrc, block.alt || block.title, 480) : "";
    const category = block.hideCategory ? "" : `<small style="display:block;color:${safeColor(block.categoryColor, "#8b614b")};font-family:${fontStack(block.categoryFontFamily || theme.fontFamily)};font-size:${safeNumber(block.categoryFontSize, 8, 18, 10)}px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${escapeEmailHtml(block.type === "productRecommendation" ? block.recommendationLabel || block.category : block.category)}</small>`;
    const title = `<strong style="display:block;margin-top:${safeNumber(block.itemSpacing, 0, 40, 8)}px;color:${safeColor(block.titleColor, color)};font-family:${fontStack(block.titleFontFamily)};font-size:${safeNumber(block.titleFontSize, 12, 42, 20)}px;font-weight:${safeNumber(block.titleFontWeight, 300, 900, 600)}">${escapeEmailHtml(block.title)}</strong>`;
    const description = block.hideDescription ? "" : `<span style="display:block;margin-top:${safeNumber(block.itemSpacing, 0, 40, 8)}px;color:${safeColor(block.descriptionColor, "#5f554e")};font-family:${fontStack(block.descriptionFontFamily || theme.fontFamily)};font-size:${safeNumber(block.descriptionFontSize, 10, 24, 13)}px;line-height:1.5">${escapeEmailHtml(block.description)}</span>`;
    const cta = block.hideCta ? "" : `<a href="${escapeEmailHtml(link)}" ${block.ctaNewTab === false ? "" : "target=\"_blank\""} title="${escapeEmailHtml(block.ctaTitle || block.ctaLabel)}" style="display:inline-block;margin-top:${safeNumber(block.itemSpacing, 0, 40, 8)}px;font-family:${fontStack(block.ctaFontFamily || theme.fontFamily)};font-size:${safeNumber(block.ctaFontSize, 9, 24, 13)}px;font-weight:${safeNumber(block.ctaFontWeight, 300, 900, 700)};${block.ctaStyle === "button" ? `padding:9px 15px;border-radius:5px;background:${safeColor(block.ctaBackground, theme.buttonBackground)};color:${theme.buttonTextColor};text-decoration:none` : `color:${safeColor(block.ctaColor, theme.linkColor)};text-decoration:underline`}">${escapeEmailHtml(block.ctaLabel)}</a>`;
    const secondary = block.secondaryCtaLabel && trackedEmailUrl(block, block.secondaryCtaUrl, origin) ? `<a href="${escapeEmailHtml(trackedEmailUrl(block, block.secondaryCtaUrl, origin))}" target="_blank" style="display:inline-block;margin:8px 0 0 12px;color:${theme.linkColor}">${escapeEmailHtml(block.secondaryCtaLabel)}</a>` : "";
    const copy = `<div style="padding:${safeNumber(block.internalPadding, 0, 60, 16)}px;text-align:${safeAlign(block.align)}">${category}${title}${description}${cta}${secondary}</div>`;
    const border = `${safeNumber(block.borderWidth, 0, 12, 1)}px solid ${safeColor(block.borderColor, "#d9cfc5")}`;
    if (["left", "right"].includes(block.imagePosition) && image) {
      const cells = block.imagePosition === "left" ? [`<td class="mace-stack-column" width="45%" valign="top">${image}</td>`, `<td class="mace-stack-column" valign="${safeCssToken(block.contentAlign, ["top", "middle", "bottom"], "top")}">${copy}</td>`] : [`<td class="mace-stack-column" valign="${safeCssToken(block.contentAlign, ["top", "middle", "bottom"], "top")}">${copy}</td>`, `<td class="mace-stack-column" width="45%" valign="top">${image}</td>`];
      return `<div style="${style}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${safeColor(block.background, "#ffffff")};border:${border};border-radius:${safeNumber(block.borderRadius, 0, 60, 6)}px;overflow:hidden"><tr>${cells.join("")}</tr></table></div>`;
    }
    return `<div style="${style}"><div style="background:${safeColor(block.background, "#ffffff")};border:${border};border-radius:${safeNumber(block.borderRadius, 0, 60, 6)}px;overflow:hidden">${image}${copy}</div></div>`;
  }
  if (block.type === "footer") {
    const socials = (block.socialItems || []).filter((item) => safeEmailUrl(item.url, origin)).map((item) => `<a href="${escapeEmailHtml(trackedEmailUrl(block, item.url, origin))}" target="_blank" style="color:${safeColor(block.linkColor, theme.linkColor)};margin:0 5px">${escapeEmailHtml(item.platform)}</a>`).join("");
    const linkColor = safeColor(block.linkColor, theme.linkColor);
    const website = safeEmailUrl(block.website, origin);
    const unsubscribe = safeEmailUrl(block.unsubscribeUrl, origin) || "#unsubscribe";
    const preferences = safeEmailUrl(block.preferencesUrl, origin) || "#preferences";
    const identity = `<strong>${escapeEmailHtml(block.businessName)}</strong><br>${escapeEmailHtml(block.address)}${block.phone ? `<br><a href="tel:${escapeEmailHtml(block.phone)}" style="color:${linkColor}">${escapeEmailHtml(block.phone)}</a>` : ""}${block.email ? `<br><a href="mailto:${escapeEmailHtml(block.email)}" style="color:${linkColor}">${escapeEmailHtml(block.email)}</a>` : ""}${website ? `<br><a href="${escapeEmailHtml(website)}" target="_blank" style="color:${linkColor}">${escapeEmailHtml(block.website)}</a>` : ""}${socials ? `<div style="margin-top:8px">${socials}</div>` : ""}`;
    const legal = `${block.legalText ? `<div>${escapeEmailHtml(block.legalText)}</div>` : ""}<div style="margin-top:8px"><a href="${escapeEmailHtml(unsubscribe)}" style="color:${linkColor}">${escapeEmailHtml(block.unsubscribeText || "Unsubscribe")}</a>${block.preferencesText ? ` · <a href="${escapeEmailHtml(preferences)}" style="color:${linkColor}">${escapeEmailHtml(block.preferencesText)}</a>` : ""}</div>${block.copyrightText ? `<div>${escapeEmailHtml(block.copyrightText)}</div>` : ""}`;
    const content = block.columnLayout === "two" ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="${block.mobileStack === false ? "mace-keep-column" : "mace-stack-column"}" width="50%" valign="top" style="padding:0 10px">${identity}</td><td class="${block.mobileStack === false ? "mace-keep-column" : "mace-stack-column"}" width="50%" valign="top" style="padding:0 10px">${legal}</td></tr></table>` : `${identity}<div style="margin-top:10px">${legal}</div>`;
    return `<div style="${style}background:${safeColor(block.background, theme.contentBackground)};font-family:${fontStack(block.fontFamily || theme.fontFamily)};font-size:${fontSize}px;line-height:1.6;${block.divider ? `border-top:1px solid ${theme.dividerColor};` : ""}">${content}</div>`;
  }
  if (block.type === "contact") return `<div style="${style}font-family:${fontStack(theme.fontFamily)};font-size:12px;line-height:1.6">${textLines(block.content)}</div>`;
  return `<div style="${style}">${textLines(block.content)}</div>`;
}

function blockEmailHtml(block, origin, theme, draft) {
  if (!block || typeof block !== "object") return "";
  return wrapEmailBlock(block, blockEmailHtmlContent(block, origin, theme, draft));
}

function walkBlocks(blocks, visit) {
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    visit(block);
    if (block.type === "layout") (block.columns || []).forEach((column) => walkBlocks(column, visit));
  });
}

function responsiveCss(blocks) {
  const fonts = new Set();
  const paddings = new Set();
  const widths = new Set();
  const logoWidths = new Set();
  const spacerHeights = new Set();
  walkBlocks(blocks, (block) => {
    const font = Number(block.mobileFontSize ?? block.responsive?.mobileFontSize);
    const padding = Number(block.responsive?.mobilePadding);
    const width = Number(block.responsive?.mobileWidth ?? block.mobileWidth);
    if (Number.isFinite(font) && font >= 10 && font <= 64) fonts.add(font);
    if (Number.isFinite(padding) && padding >= 0 && padding <= 80) paddings.add(padding);
    if (block.type === "logo") {
      const logoWidth = Number(block.mobileWidth);
      if (Number.isFinite(logoWidth) && logoWidth >= 40 && logoWidth <= 420) logoWidths.add(logoWidth);
    } else if (Number.isFinite(width) && width >= 20 && width <= 100) widths.add(width);
    if (block.type === "spacer") spacerHeights.add(safeNumber(block.mobileHeight, 0, 240, 20));
  });
  return [
    ...[...fonts].map((value) => `.mace-mf-${value} .mace-responsive-text,.mace-responsive-text.mace-mf-${value}{font-size:${value}px!important}`),
    ...[...paddings].map((value) => `.mace-mp-${value}>*{padding-left:${value}px!important;padding-right:${value}px!important}`),
    ...[...widths].map((value) => `.mace-mw-${value} img{width:${value}%!important;max-width:${value}%!important}`),
    ...[...logoWidths].map((value) => `.mace-logo-mw-${value} img{width:${value}px!important;max-width:100%!important}`),
    ...[...spacerHeights].map((value) => `.mace-sh-${value} .mace-spacer{height:${value}px!important;line-height:${value}px!important}`),
  ].join("");
}

function hasEditableFooter(blocks) {
  let found = false;
  walkBlocks(blocks, (block) => { if (block.type === "footer") found = true; });
  return found;
}

export function buildVisualEmailHtml(draft, settings = {}, origin = "https://app.macebydrmace.com") {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const suppliedTheme = draft?.theme && typeof draft.theme === "object" ? draft.theme : {};
  const theme = {
    canvasBackground: safeColor(suppliedTheme.canvasBackground, "#f4f1ed"),
    contentBackground: safeColor(suppliedTheme.contentBackground, "#ffffff"),
    textColor: safeColor(suppliedTheme.textColor, "#4a3324"),
    headingColor: safeColor(suppliedTheme.headingColor, "#2f2119"),
    linkColor: safeColor(suppliedTheme.linkColor, "#4a3324"),
    buttonBackground: safeColor(suppliedTheme.buttonBackground, "#4a2d1c"),
    buttonTextColor: safeColor(suppliedTheme.buttonTextColor, "#ffffff"),
    dividerColor: safeColor(suppliedTheme.dividerColor, "#ddd4c9"),
    fontFamily: safeFont(suppliedTheme.fontFamily, "Arial"),
    headingFontFamily: safeFont(suppliedTheme.headingFontFamily, "Georgia"),
    baseFontSize: safeNumber(suppliedTheme.baseFontSize, 10, 24, 15),
    contentWidth: safeNumber(suppliedTheme.contentWidth, 480, 760, 640),
    sectionPadding: safeNumber(suppliedTheme.sectionPadding, 0, 60, 16),
    mobilePadding: safeNumber(suppliedTheme.mobilePadding, 0, 40, 16),
  };
  const company = settings.company || "MACE Signature Wellness";
  const previewText = escapeEmailHtml(draft?.previewText || "");
  const content = blocks.map((block) => blockEmailHtml(block, origin, theme, draft)).join("\n");
  const protectedFooter = hasEditableFooter(blocks) ? "" : `<tr><td style="padding:22px 28px;border-top:1px solid ${theme.dividerColor};text-align:center;font-family:${fontStack(theme.fontFamily)};font-size:11px;line-height:1.6;color:${theme.textColor}"><strong>${escapeEmailHtml(company)}</strong><br>Davao City, Philippines<br><a href="#unsubscribe" style="color:${theme.linkColor}">Unsubscribe</a> · <a href="#preferences" style="color:${theme.linkColor}">Manage preferences</a></td></tr>`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeEmailHtml(draft?.subject || draft?.name || company)}</title>
  <style>body{margin:0;background:${theme.canvasBackground};color:${theme.textColor};font-family:${fontStack(theme.fontFamily)}}table{border-collapse:collapse}img{max-width:100%}.mace-mobile-only{display:none!important;max-height:0!important;overflow:hidden!important}@media(max-width:680px){.mace-email{width:100%!important}.mace-pad{padding-left:${theme.mobilePadding}px!important;padding-right:${theme.mobilePadding}px!important}.mace-stack-column{display:block!important;width:100%!important;box-sizing:border-box!important}.mace-mobile-full{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}.mace-desktop-only{display:none!important;max-height:0!important;overflow:hidden!important}.mace-mobile-only{display:block!important;max-height:none!important;overflow:visible!important}${responsiveCss(blocks)}}</style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.canvasBackground}"><tr><td class="mace-pad" align="center" style="padding:28px 12px">
    <table role="presentation" class="mace-email" width="${theme.contentWidth}" cellpadding="0" cellspacing="0" style="width:${theme.contentWidth}px;max-width:100%;background:${theme.contentBackground}">
      <tr><td>${content}</td></tr>
      ${protectedFooter}
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
      const attributeValue = attribute.value.trim();
      if (name.startsWith("on") || ["nonce", "integrity", "ping"].includes(name)) {
        element.removeAttribute(attribute.name);
        removed += 1;
        return;
      }
      if (name === "style") {
        const cleaned = cleanCss(attributeValue);
        if (cleaned !== attributeValue) removed += 1;
        if (cleaned) element.setAttribute("style", cleaned);
        else element.removeAttribute("style");
        return;
      }
      if (unsafeUrlAttributes.has(name)) {
        const safeUrl = safeEmailUrl(attributeValue);
        if (!safeUrl) {
          element.removeAttribute(attribute.name);
          removed += 1;
        } else if (safeUrl !== attributeValue) {
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

export function importedEmailHtmlToBlocks(value, createId) {
  const sanitized = sanitizeImportedEmailHtml(value);
  if (sanitized.error || typeof DOMParser === "undefined") return { ...sanitized, blocks: [] };
  const document = new DOMParser().parseFromString(sanitized.html, "text/html");
  const blocks = [];
  const candidates = [...document.body.children];
  candidates.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      blocks.push({ id: createId("heading"), type: "heading", content: element.textContent.trim(), level: tag, align: "left", fontSize: tag === "h1" ? 32 : tag === "h2" ? 26 : 21, padding: 12 });
      return;
    }
    if (tag === "img") {
      blocks.push({ id: createId("image"), type: "image", src: element.getAttribute("src") || "", alt: element.getAttribute("alt") || "", align: "center", padding: 8, visibility: { desktop: true, mobile: true } });
      return;
    }
    if (["p", "ul", "ol"].includes(tag)) {
      blocks.push({ id: createId("text"), type: "text", content: sanitizeRichEmailText(element.outerHTML), align: "left", fontSize: 15, padding: 12, visibility: { desktop: true, mobile: true } });
      return;
    }
    if (tag === "hr") {
      blocks.push({ id: createId("divider"), type: "divider", color: "#ddd4c9", thickness: 1, lineStyle: "solid", width: 100, spacingTop: 16, spacingBottom: 16, visibility: { desktop: true, mobile: true } });
      return;
    }
    const anchor = tag === "a" ? element : element.children.length === 1 && element.firstElementChild?.tagName === "A" ? element.firstElementChild : null;
    if (anchor && anchor.textContent.trim()) {
      blocks.push({ id: createId("button"), type: "button", content: anchor.textContent.trim(), link: anchor.getAttribute("href") || "", align: "center", background: "#4a2d1c", textColor: "#ffffff", padding: 16, visibility: { desktop: true, mobile: true } });
      return;
    }
    if (element.outerHTML.trim()) blocks.push({ id: createId("code"), type: "code", content: sanitizeEmailFragment(element.outerHTML), align: "left", padding: 0, visibility: { desktop: true, mobile: true } });
  });
  return { ...sanitized, blocks };
}

export function emailHtmlToPlainText(value) {
  if (typeof DOMParser === "undefined") return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const document = new DOMParser().parseFromString(String(value || ""), "text/html");
  document.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  document.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,tr").forEach((element) => element.append("\n"));
  return String(document.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function renderPreviewToken(_match, key, fallback = "") {
  const samples = {
    first_name: "Alex",
    client: "Alex Rivera",
    name: "Alex Rivera",
    email: "alex@example.com",
    branch: "MACE Signature Wellness",
    company: "MACE Signature Wellness",
    campaign: "Summer Skin Reset",
    current_year: String(new Date().getFullYear()),
    unsubscribe_url: "#unsubscribe",
    preferences_url: "#preferences",
    date: new Date().toLocaleDateString("en-PH"),
  };
  return escapeEmailHtml(samples[key] ?? fallback.trim() ?? "");
}

export function previewPersonalizedHtml(value) {
  return String(value || "").replace(/{{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*([^{}]*))?\s*}}/g, renderPreviewToken);
}

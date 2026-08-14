const socialIconDefinitions = {
  facebook: {
    label: "Facebook",
    path: "M13.5 22v-8.6h2.9l.44-3.35H13.5V7.91c0-.97.27-1.64 1.69-1.64h1.79V3.28a23.9 23.9 0 0 0-2.61-.23c-2.66 0-4.48 1.62-4.48 4.6v2.4H6.88v3.35h3.01V22h3.61Z",
  },
  instagram: {
    label: "Instagram",
    path: "M7.55 2h8.9A5.55 5.55 0 0 1 22 7.55v8.9A5.55 5.55 0 0 1 16.45 22h-8.9A5.55 5.55 0 0 1 2 16.45v-8.9A5.55 5.55 0 0 1 7.55 2Zm0 2A3.55 3.55 0 0 0 4 7.55v8.9A3.55 3.55 0 0 0 7.55 20h8.9A3.55 3.55 0 0 0 20 16.45v-8.9A3.55 3.55 0 0 0 16.45 4h-8.9ZM12 7.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm5.12-3.5a1.28 1.28 0 1 1 0 2.56 1.28 1.28 0 0 1 0-2.56Z",
  },
  linkedin: {
    label: "LinkedIn",
    path: "M5.15 3.2a2.15 2.15 0 1 1 0 4.3 2.15 2.15 0 0 1 0-4.3ZM3.3 9h3.7v11.8H3.3V9Zm5.85 0h3.55v1.62h.05c.5-.94 1.7-1.93 3.5-1.93 3.75 0 4.45 2.47 4.45 5.68v6.43H17v-5.7c0-1.36-.03-3.11-1.9-3.11-1.9 0-2.19 1.48-2.19 3.01v5.8H9.15V9Z",
  },
  youtube: {
    label: "YouTube",
    path: "M21.58 7.19a2.83 2.83 0 0 0-1.99-2C17.84 4.7 12 4.7 12 4.7s-5.84 0-7.59.49a2.83 2.83 0 0 0-1.99 2A29.4 29.4 0 0 0 1.93 12c0 1.61.17 3.22.49 4.81a2.83 2.83 0 0 0 1.99 2c1.75.49 7.59.49 7.59.49s5.84 0 7.59-.49a2.83 2.83 0 0 0 1.99-2c.32-1.59.49-3.2.49-4.81s-.17-3.22-.49-4.81ZM10 15.4V8.6l5.9 3.4-5.9 3.4Z",
  },
  tiktok: {
    label: "TikTok",
    path: "M14.2 2.5h3.04a5.15 5.15 0 0 0 3.26 3.26V8.8a8.08 8.08 0 0 1-3.22-1.01v6.05a6.34 6.34 0 1 1-6.34-6.34c.4 0 .8.04 1.19.11v3.11a3.3 3.3 0 1 0 2.07 3.06V2.5Z",
  },
  x: {
    label: "X",
    path: "M4.7 3.5h4.35l3.68 4.92 4.17-4.92h2.02l-5.25 6.2 5.63 10.8h-4.36l-4.06-5.43-4.6 5.43H4.27l5.69-6.72L4.7 3.5Zm3.35 1.65 7.71 13.7h1.48L9.53 5.15H8.05Z",
  },
  website: {
    label: "Website",
    path: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm5.93 6h-2.36a15.5 15.5 0 0 0-1.42-3.48A8.05 8.05 0 0 1 17.93 8ZM12 4.06c.7.88 1.3 2.2 1.62 3.94h-3.24C10.7 6.26 11.3 4.94 12 4.06ZM9.85 4.52A15.5 15.5 0 0 0 8.43 8H6.07a8.05 8.05 0 0 1 3.78-3.48ZM4.26 10h3.91a17.92 17.92 0 0 0 0 4H4.26a8.1 8.1 0 0 1 0-4Zm1.81 6h2.36c.3 1.36.78 2.55 1.42 3.48A8.05 8.05 0 0 1 6.07 16ZM12 19.94c-.7-.88-1.3-2.2-1.62-3.94h3.24c-.32 1.74-.92 3.06-1.62 3.94ZM13.9 14h-3.8a15.9 15.9 0 0 1 0-4h3.8a15.9 15.9 0 0 1 0 4Zm.25 5.48A15.5 15.5 0 0 0 15.57 16h2.36a8.05 8.05 0 0 1-3.78 3.48ZM15.83 14a17.92 17.92 0 0 0 0-4h3.91a8.1 8.1 0 0 1 0 4h-3.91Z",
  },
  email: {
    label: "Email",
    path: "M3.5 4.5h17A2.5 2.5 0 0 1 23 7v10a2.5 2.5 0 0 1-2.5 2.5h-17A2.5 2.5 0 0 1 1 17V7a2.5 2.5 0 0 1 2.5-2.5Zm.13 2L12 12.36l8.37-5.86H3.63ZM21 8.38l-8.43 5.9a1 1 0 0 1-1.14 0L3 8.38V17c0 .28.22.5.5.5h17c.28 0 .5-.22.5-.5V8.38Z",
  },
};

export function socialIconKey(platform) {
  const value = String(platform || "").trim().toLowerCase();
  if (value.includes("facebook")) return "facebook";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("linkedin")) return "linkedin";
  if (value.includes("youtube")) return "youtube";
  if (value.includes("tiktok")) return "tiktok";
  if (value === "x" || value.includes("twitter")) return "x";
  if (value.includes("mail") || value.includes("email")) return "email";
  return "website";
}

export function socialIconDefinition(platform) {
  return socialIconDefinitions[socialIconKey(platform)];
}

export function socialIconAssetPath(platform, light = false) {
  const key = socialIconKey(platform);
  return `/brand/social/${key}${light ? "-light" : ""}.svg`;
}

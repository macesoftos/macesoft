import { createHash, randomBytes } from "node:crypto";
import express from "express";

const { Router, raw } = express;
const DEFAULT_MAX_PDF_BYTES = 30 * 1024 * 1024;
const ACCESS_GRANT_LIFETIME_MS = 4 * 60 * 60 * 1000;
const VIEW_DEDUPLICATION_MS = 30 * 60 * 1000;

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function clean(value) {
  return String(value ?? "").trim();
}

function boundedText(value, label, maximum) {
  const text = clean(value);
  if (text.length > maximum) throw httpError(`${label} must be ${maximum} characters or fewer.`, 400);
  return text;
}

function tokenHash(value) {
  return createHash("sha256").update(clean(value)).digest("hex");
}

function publicToken() {
  return randomBytes(24).toString("base64url");
}

function publicOrigin(request) {
  const configured = clean(process.env.APP_ORIGIN).split(",")[0];
  return (configured || `${request.protocol}://${request.get("host")}`).replace(/\/$/, "");
}

function publicLinkFor(request, token) {
  return token ? `${publicOrigin(request)}/flipbook/view/${encodeURIComponent(token)}` : "";
}

function publicBranding(settings, token) {
  return {
    businessName: settings.businessName,
    viewerBackground: settings.viewerBackground,
    logo: settings.logo.startsWith("/api/uploads/")
      ? `/api/public/flipbooks/${encodeURIComponent(token)}/logo`
      : settings.logo,
  };
}

function safeFilename(title) {
  const normalized = clean(title).replace(/[^a-z0-9 _.-]+/gi, "").replace(/\s+/g, " ").trim();
  return `${normalized || "flipbook"}.pdf`;
}

function requestHeaderText(request, name) {
  const rawValue = clean(request.get(name));
  if (!rawValue) return "";
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function parsePageCount(value) {
  const pages = Number(value);
  if (!Number.isInteger(pages) || pages < 1 || pages > 5000) {
    throw httpError("The PDF page count is invalid.", 400);
  }
  return pages;
}

function parseExpiration(value) {
  const input = clean(value);
  if (!input) return null;
  const expiration = new Date(input.length === 10 ? `${input}T23:59:59.999Z` : input);
  if (Number.isNaN(expiration.getTime())) throw httpError("Choose a valid expiration date.", 400);
  if (expiration <= new Date()) throw httpError("Expiration must be in the future.", 400);
  return expiration;
}

function uniqueViewerCounts(viewRows) {
  const byFlipbook = new Map();
  for (const row of viewRows) {
    if (!byFlipbook.has(row.flipbookId)) byFlipbook.set(row.flipbookId, new Set());
    byFlipbook.get(row.flipbookId).add(row.viewerKey);
  }
  return new Map([...byFlipbook].map(([id, keys]) => [id, keys.size]));
}

function serializeFlipbook(row, request, uniqueViewers = 0) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pageCount: row.pageCount,
    status: row.status,
    branch: row.branch,
    publicEnabled: row.publicEnabled,
    passwordProtected: Boolean(row.passwordHash),
    allowDownload: row.allowDownload,
    expiresAt: row.expiresAt,
    publishedAt: row.publishedAt,
    publicLink: publicLinkFor(request, row.publicToken),
    sourceUrl: `/api/flipbooks/${encodeURIComponent(row.id)}/file`,
    byteSize: row.asset?.byteSize || 0,
    createdBy: row.createdBy?.name || "MACE user",
    views: row._count?.views || 0,
    uniqueViewers,
    lastViewed: row.views?.[0]?.viewedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function flipbookInclude() {
  return {
    asset: { select: { byteSize: true, mimeType: true, objectPath: true } },
    createdBy: { select: { name: true } },
    _count: { select: { views: true } },
    views: { select: { viewedAt: true }, orderBy: { viewedAt: "desc" }, take: 1 },
  };
}

export function validatePdfBuffer(buffer, maximumBytes = DEFAULT_MAX_PDF_BYTES) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw httpError("Choose a PDF file to upload.", 400);
  if (buffer.length > maximumBytes) throw httpError(`PDF must be ${Math.floor(maximumBytes / 1024 / 1024)} MB or smaller.`, 413);
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw httpError("The uploaded file is not a valid PDF.", 415);
  }
  const tail = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1");
  if (!tail.includes("%%EOF")) throw httpError("The PDF appears incomplete or damaged.", 415);
  return buffer;
}

export function publicFlipbookState(flipbook, now = new Date()) {
  if (!flipbook || flipbook.status !== "Published" || !flipbook.publicToken) return "not-found";
  if (!flipbook.publicEnabled) return "disabled";
  if (flipbook.expiresAt && flipbook.expiresAt <= now) return "expired";
  return "available";
}

function assertPublicFlipbook(flipbook) {
  const state = publicFlipbookState(flipbook);
  if (state === "not-found") throw httpError("This flipbook is not available.", 404);
  if (state === "disabled") throw httpError("This public link has been disabled.", 410);
  if (state === "expired") throw httpError("This public link has expired.", 410);
  return flipbook;
}

async function workspaceSettings(prisma) {
  return prisma.flipbookWorkspaceSetting.upsert({
    where: { id: "workspace" },
    create: { id: "workspace" },
    update: {},
  });
}

async function uniqueCountsFor(prisma, ids) {
  if (!ids.length) return new Map();
  const rows = await prisma.flipbookView.findMany({
    where: { flipbookId: { in: ids } },
    select: { flipbookId: true, viewerKey: true },
  });
  return uniqueViewerCounts(rows);
}

function internalWhere(actor, branchWhere, id = "") {
  return { ...(id ? { id } : {}), ...branchWhere(actor) };
}

async function findInternalFlipbook({ prisma, actor, branchWhere, id }) {
  const flipbook = await prisma.flipbook.findFirst({
    where: internalWhere(actor, branchWhere, clean(id)),
    include: flipbookInclude(),
  });
  if (!flipbook) throw httpError("Flipbook not found.", 404);
  return flipbook;
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function viewerKeyFor(request) {
  const supplied = boundedText(request.get("x-flipbook-viewer"), "Viewer identifier", 160);
  const fingerprint = supplied || `${request.ip}|${clean(request.get("user-agent"))}`;
  return tokenHash(fingerprint);
}

async function validAccessGrant(prisma, flipbook, request) {
  if (!flipbook.passwordHash) return true;
  const token = clean(request.get("x-flipbook-access"));
  if (!token) return false;
  const grant = await prisma.flipbookAccessGrant.findUnique({ where: { tokenHash: tokenHash(token) } });
  return Boolean(grant && grant.flipbookId === flipbook.id && grant.expiresAt > new Date());
}

async function recordView(prisma, flipbook, request) {
  const viewerKey = viewerKeyFor(request);
  const recent = await prisma.flipbookView.findFirst({
    where: {
      flipbookId: flipbook.id,
      viewerKey,
      viewedAt: { gte: new Date(Date.now() - VIEW_DEDUPLICATION_MS) },
    },
    select: { id: true },
  });
  if (!recent) {
    await prisma.flipbookView.create({
      data: {
        flipbookId: flipbook.id,
        viewerKey,
        userAgent: clean(request.get("user-agent")).slice(0, 500),
      },
    });
  }
}

async function sendStoredPdf({ response, storageRequest, flipbook, download = false }) {
  const stored = await storageRequest(flipbook.asset.objectPath);
  if (!stored.ok) throw httpError("The PDF is currently unavailable.", stored.status === 404 ? 404 : 502);
  const buffer = Buffer.from(await stored.arrayBuffer());
  response.set({
    "Cache-Control": "private, max-age=120",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFilename(flipbook.title)}"`,
    "Content-Length": String(buffer.length),
    "Content-Type": "application/pdf",
  });
  response.send(buffer);
}

export function createFlipbookRouters({
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
}) {
  const internal = Router();
  const publicRouter = Router();
  const maximumBytes = Number(process.env.MAX_FLIPBOOK_BYTES || DEFAULT_MAX_PDF_BYTES);

  internal.get("/", asyncRoute(async (request, response) => {
    const actor = assertReadAllowed(request, "flipbooks");
    const rows = await prisma.flipbook.findMany({
      where: internalWhere(actor, branchWhere),
      orderBy: { updatedAt: "desc" },
      include: flipbookInclude(),
    });
    const uniqueCounts = await uniqueCountsFor(prisma, rows.map((row) => row.id));
    response.json({ flipbooks: rows.map((row) => serializeFlipbook(row, request, uniqueCounts.get(row.id) || 0)) });
  }));

  internal.get("/shared", asyncRoute(async (request, response) => {
    const actor = assertReadAllowed(request, "flipbooks");
    const rows = await prisma.flipbook.findMany({
      where: { ...internalWhere(actor, branchWhere), publicToken: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: flipbookInclude(),
    });
    response.json({
      links: rows.map((row) => ({
        ...serializeFlipbook(row, request),
        linkStatus: !row.publicEnabled ? "Disabled" : row.expiresAt && row.expiresAt <= new Date() ? "Expired" : "Active",
      })),
    });
  }));

  internal.get("/analytics", asyncRoute(async (request, response) => {
    const actor = assertReadAllowed(request, "flipbooks");
    const rows = await prisma.flipbook.findMany({
      where: internalWhere(actor, branchWhere),
      orderBy: { updatedAt: "desc" },
      include: flipbookInclude(),
    });
    const ids = rows.map((row) => row.id);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 13);
    since.setUTCHours(0, 0, 0, 0);
    const viewRows = ids.length ? await prisma.flipbookView.findMany({
      where: { flipbookId: { in: ids }, viewedAt: { gte: since } },
      orderBy: { viewedAt: "asc" },
      select: { flipbookId: true, viewerKey: true, viewedAt: true },
    }) : [];
    const allUnique = await uniqueCountsFor(prisma, ids);
    const timeline = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(since);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, views: viewRows.filter((row) => row.viewedAt.toISOString().slice(0, 10) === key).length };
    });
    const totalViews = rows.reduce((sum, row) => sum + (row._count?.views || 0), 0);
    const uniqueViewers = [...allUnique.values()].reduce((sum, count) => sum + count, 0);
    const lastViewed = rows.map((row) => row.views?.[0]?.viewedAt).filter(Boolean).sort((a, b) => b - a)[0] || null;
    response.json({
      summary: { totalViews, uniqueViewers, lastViewed, timeline },
      flipbooks: rows.map((row) => serializeFlipbook(row, request, allUnique.get(row.id) || 0)),
    });
  }));

  internal.get("/settings", asyncRoute(async (request, response) => {
    assertReadAllowed(request, "flipbooks");
    response.json({ settings: await workspaceSettings(prisma) });
  }));

  internal.put("/settings", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    if (!canManageOrganization(actor.role)) throw httpError("Only an organization administrator can change Flipbook workspace settings.", 403);
    const businessName = boundedText(request.body?.businessName, "Business name", 120) || "MACE";
    const logo = clean(request.body?.logo);
    if (logo && !logo.startsWith("/api/uploads/") && !logo.startsWith("/brand/")) {
      throw httpError("Upload the logo to MACE before saving it.", 400);
    }
    const viewerBackground = clean(request.body?.viewerBackground) || "#f4f1ed";
    if (!/^#[0-9a-f]{6}$/i.test(viewerBackground)) throw httpError("Choose a valid viewer background color.", 400);
    const defaultAccess = clean(request.body?.defaultAccess) === "Password protected"
      ? "Password protected"
      : "Anyone with the link";
    const defaultExpirationDays = Math.max(0, Math.min(365, Number(request.body?.defaultExpirationDays) || 0));
    const settings = await prisma.flipbookWorkspaceSetting.upsert({
      where: { id: "workspace" },
      create: { id: "workspace", logo, businessName, viewerBackground, defaultAccess, defaultAllowDownload: Boolean(request.body?.defaultAllowDownload), defaultExpirationDays },
      update: { logo, businessName, viewerBackground, defaultAccess, defaultAllowDownload: Boolean(request.body?.defaultAllowDownload), defaultExpirationDays },
    });
    response.json({ settings });
  }));

  internal.post("/", raw({ type: ["application/pdf", "application/octet-stream"], limit: maximumBytes }), asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const buffer = validatePdfBuffer(request.body, maximumBytes);
    const title = boundedText(requestHeaderText(request, "x-flipbook-title"), "Flipbook title", 160);
    if (!title) throw httpError("Flipbook title is required.", 400);
    const description = boundedText(requestHeaderText(request, "x-flipbook-description"), "Description", 1000);
    const pageCount = parsePageCount(request.get("x-flipbook-pages"));
    const settings = await workspaceSettings(prisma);
    const assetId = randomBytes(18).toString("base64url");
    const objectPath = `flipbook-pdf/${assetId}.pdf`;
    const uploaded = await storageRequest(objectPath, {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "x-upsert": "false" },
      body: buffer,
    });
    if (!uploaded.ok) throw httpError("Object storage rejected the PDF upload.", 502);

    try {
      const expiration = settings.defaultExpirationDays > 0
        ? new Date(Date.now() + settings.defaultExpirationDays * 24 * 60 * 60 * 1000)
        : null;
      const flipbook = await prisma.$transaction(async (tx) => {
        await tx.uploadAsset.create({
          data: {
            id: assetId,
            objectPath,
            category: "flipbook-pdf",
            branch: actor.branch || "All branches",
            mimeType: "application/pdf",
            byteSize: buffer.length,
            uploadedById: actor.id,
          },
        });
        const created = await tx.flipbook.create({
          data: {
            title,
            description,
            pageCount,
            branch: actor.branch || "All branches",
            assetId,
            createdById: actor.id,
            allowDownload: settings.defaultAllowDownload,
            expiresAt: expiration,
          },
          include: flipbookInclude(),
        });
        await writeAudit(tx, request, {
          area: "Flipbooks",
          action: "Flipbook created",
          details: `${title} uploaded with ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
        });
        return created;
      });
      response.status(201).json({ flipbook: serializeFlipbook(flipbook, request) });
    } catch (error) {
      await storageRequest(objectPath, { method: "DELETE" }).catch(() => {});
      throw error;
    }
  }));

  internal.get("/:id/file", asyncRoute(async (request, response) => {
    const actor = assertReadAllowed(request, "flipbooks");
    const flipbook = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    return sendStoredPdf({ response, storageRequest, flipbook, download: request.query.download === "1" });
  }));

  internal.get("/:id", asyncRoute(async (request, response) => {
    const actor = assertReadAllowed(request, "flipbooks");
    const flipbook = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    const uniqueCount = await prisma.flipbookView.findMany({ where: { flipbookId: flipbook.id }, distinct: ["viewerKey"], select: { viewerKey: true } });
    response.json({ flipbook: serializeFlipbook(flipbook, request, uniqueCount.length) });
  }));

  internal.patch("/:id", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const existing = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    if (!canAccessBranch(actor, existing.branch)) throw httpError("You do not have access to this flipbook.", 403);
    const data = {};
    if (Object.hasOwn(request.body || {}, "title")) {
      data.title = boundedText(request.body.title, "Flipbook title", 160);
      if (!data.title) throw httpError("Flipbook title is required.", 400);
    }
    if (Object.hasOwn(request.body || {}, "description")) data.description = boundedText(request.body.description, "Description", 1000);
    if (Object.hasOwn(request.body || {}, "allowDownload")) data.allowDownload = Boolean(request.body.allowDownload);
    if (Object.hasOwn(request.body || {}, "expiresAt")) data.expiresAt = parseExpiration(request.body.expiresAt);
    if (Object.hasOwn(request.body || {}, "publicEnabled")) data.publicEnabled = existing.status === "Published" && Boolean(request.body.publicEnabled);
    if (Object.hasOwn(request.body || {}, "passwordProtection")) {
      if (request.body.passwordProtection) {
        const password = clean(request.body.password);
        if (!password && !existing.passwordHash) throw httpError("Enter a password before enabling password protection.", 400);
        if (password && password.length < 8) throw httpError("Flipbook passwords must be at least 8 characters.", 400);
        if (password) data.passwordHash = hashPassword(password);
      } else {
        data.passwordHash = "";
        await prisma.flipbookAccessGrant.deleteMany({ where: { flipbookId: existing.id } });
      }
    }
    const updated = await prisma.flipbook.update({ where: { id: existing.id }, data, include: flipbookInclude() });
    response.json({ flipbook: serializeFlipbook(updated, request) });
  }));

  internal.post("/:id/publish", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const existing = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.flipbook.update({
        where: { id: existing.id },
        data: {
          status: "Published",
          publicEnabled: true,
          publicToken: existing.publicToken || publicToken(),
          publishedAt: existing.publishedAt || new Date(),
        },
        include: flipbookInclude(),
      });
      await writeAudit(tx, request, { area: "Flipbooks", action: "Flipbook published", details: `${existing.title} public link enabled.` });
      return row;
    });
    response.json({ flipbook: serializeFlipbook(updated, request) });
  }));

  internal.post("/:id/unpublish", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const existing = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    const updated = await prisma.flipbook.update({
      where: { id: existing.id },
      data: { status: "Draft", publicEnabled: false },
      include: flipbookInclude(),
    });
    response.json({ flipbook: serializeFlipbook(updated, request) });
  }));

  internal.post("/:id/duplicate", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const existing = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    const source = await storageRequest(existing.asset.objectPath);
    if (!source.ok) throw httpError("The source PDF is unavailable.", source.status === 404 ? 404 : 502);
    const buffer = Buffer.from(await source.arrayBuffer());
    const assetId = randomBytes(18).toString("base64url");
    const objectPath = `flipbook-pdf/${assetId}.pdf`;
    const uploaded = await storageRequest(objectPath, { method: "POST", headers: { "Content-Type": "application/pdf", "x-upsert": "false" }, body: buffer });
    if (!uploaded.ok) throw httpError("The duplicate PDF could not be stored.", 502);
    try {
      const duplicate = await prisma.$transaction(async (tx) => {
        await tx.uploadAsset.create({ data: { id: assetId, objectPath, category: "flipbook-pdf", branch: existing.branch, mimeType: "application/pdf", byteSize: buffer.length, uploadedById: actor.id } });
        return tx.flipbook.create({
          data: {
            title: `${existing.title} copy`.slice(0, 160),
            description: existing.description,
            pageCount: existing.pageCount,
            branch: existing.branch,
            assetId,
            createdById: actor.id,
            allowDownload: existing.allowDownload,
          },
          include: flipbookInclude(),
        });
      });
      response.status(201).json({ flipbook: serializeFlipbook(duplicate, request) });
    } catch (error) {
      await storageRequest(objectPath, { method: "DELETE" }).catch(() => {});
      throw error;
    }
  }));

  internal.delete("/:id", asyncRoute(async (request, response) => {
    const actor = assertMutationAllowed(request, "flipbooks");
    const existing = await findInternalFlipbook({ prisma, actor, branchWhere, id: request.params.id });
    const deleted = await storageRequest(existing.asset.objectPath, { method: "DELETE" });
    if (!deleted.ok && deleted.status !== 404) throw httpError("The PDF could not be removed from storage.", 502);
    await prisma.$transaction(async (tx) => {
      await tx.flipbook.delete({ where: { id: existing.id } });
      await tx.uploadAsset.delete({ where: { id: existing.assetId } });
      await writeAudit(tx, request, { area: "Flipbooks", action: "Flipbook deleted", details: `${existing.title} was permanently deleted.` });
    });
    response.status(204).end();
  }));

  publicRouter.get("/:token", asyncRoute(async (request, response) => {
    const flipbook = assertPublicFlipbook(await prisma.flipbook.findUnique({
      where: { publicToken: clean(request.params.token) },
      include: { asset: true },
    }));
    const settings = await workspaceSettings(prisma);
    const unlocked = await validAccessGrant(prisma, flipbook, request);
    const base = {
      title: flipbook.title,
      description: flipbook.description,
      pageCount: flipbook.pageCount,
      allowDownload: flipbook.allowDownload,
      expiresAt: flipbook.expiresAt,
    };
    if (!unlocked) {
      return response.json({ locked: true, flipbook: base, branding: publicBranding(settings, flipbook.publicToken) });
    }
    await recordView(prisma, flipbook, request);
    return response.json({
      locked: false,
      flipbook: {
        ...base,
        sourceUrl: `/api/public/flipbooks/${encodeURIComponent(flipbook.publicToken)}/file`,
      },
      branding: publicBranding(settings, flipbook.publicToken),
    });
  }));

  publicRouter.get("/:token/logo", asyncRoute(async (request, response) => {
    const flipbook = assertPublicFlipbook(await prisma.flipbook.findUnique({ where: { publicToken: clean(request.params.token) } }));
    const settings = await workspaceSettings(prisma);
    const assetId = clean(settings.logo).match(/^\/api\/uploads\/([^/?#]+)$/)?.[1] || "";
    if (!assetId) throw httpError("Viewer logo not found.", 404);
    const asset = await prisma.uploadAsset.findFirst({ where: { id: assetId, category: "flipbook-logo" } });
    if (!asset) throw httpError("Viewer logo not found.", 404);
    const stored = await storageRequest(asset.objectPath);
    if (!stored.ok) throw httpError("Viewer logo is unavailable.", stored.status === 404 ? 404 : 502);
    const buffer = Buffer.from(await stored.arrayBuffer());
    response.set({
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(buffer.length),
      "Content-Type": asset.mimeType,
    });
    response.send(buffer);
  }));

  publicRouter.post("/:token/access", asyncRoute(async (request, response) => {
    const flipbook = assertPublicFlipbook(await prisma.flipbook.findUnique({ where: { publicToken: clean(request.params.token) } }));
    if (!flipbook.passwordHash) return response.json({ accessToken: "" });
    const password = boundedText(request.body?.password, "Password", 200);
    if (!verifyPassword(password, flipbook.passwordHash)) throw httpError("Incorrect flipbook password.", 401);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ACCESS_GRANT_LIFETIME_MS);
    await prisma.$transaction([
      prisma.flipbookAccessGrant.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      prisma.flipbookAccessGrant.create({ data: { flipbookId: flipbook.id, tokenHash: tokenHash(token), expiresAt } }),
    ]);
    response.json({ accessToken: token, expiresAt });
  }));

  publicRouter.get("/:token/file", asyncRoute(async (request, response) => {
    const flipbook = assertPublicFlipbook(await prisma.flipbook.findUnique({
      where: { publicToken: clean(request.params.token) },
      include: { asset: true },
    }));
    if (!await validAccessGrant(prisma, flipbook, request)) throw httpError("Enter the flipbook password to continue.", 401);
    const download = request.query.download === "1";
    if (download && !flipbook.allowDownload) throw httpError("PDF download is disabled for this flipbook.", 403);
    return sendStoredPdf({ response, storageRequest, flipbook, download });
  }));

  return { internal, public: publicRouter };
}

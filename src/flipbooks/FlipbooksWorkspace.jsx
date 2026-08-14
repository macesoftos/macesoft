import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  ExternalLink,
  Eye,
  FileText,
  Fullscreen,
  Globe2,
  Image as ImageIcon,
  Link2,
  LockKeyhole,
  Mail,
  Minus,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  deleteFlipbook,
  deleteFlipbookForever,
  downloadPublicFlipbook,
  duplicateFlipbook,
  getFlipbook,
  listFlipbooks,
  listDeletedFlipbooks,
  loadFlipbookAnalytics,
  loadFlipbookLinks,
  loadFlipbookSettings,
  loadPublicFlipbook,
  publishFlipbook,
  restoreFlipbook,
  saveFlipbookSettings,
  unlockPublicFlipbook,
  unpublishFlipbook,
  updateFlipbook,
  uploadFlipbookPdf,
  uploadImageAsset,
} from "../lib/api.js";
import "./flipbooks.css";

GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const workspaceNav = [
  { label: "Overview", path: "/flipbooks/overview", icon: BookOpen },
  { label: "My Flipbooks", path: "/flipbooks", icon: FileText },
  { label: "Create New", path: "/flipbooks/new", icon: Plus },
  { label: "Shared Links", path: "/flipbooks/shared", icon: Link2 },
  { label: "Analytics", path: "/flipbooks/analytics", icon: BarChart3 },
  { label: "Deleted", path: "/flipbooks/deleted", icon: Trash2 },
  { label: "Settings", path: "/flipbooks/settings", icon: Settings },
];

function formatDate(value, fallback = "Not yet") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function currentPath() {
  return typeof window === "undefined" ? "/flipbooks" : window.location.pathname.replace(/\/+$/, "") || "/";
}

function useWorkspacePath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const navigate = useCallback((nextPath, { replace = false } = {}) => {
    if (replace) window.history.replaceState(null, "", nextPath);
    else window.history.pushState(null, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  return [path, navigate];
}

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

async function copyText(value, onCopied) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  onCopied?.();
}

function StatusPill({ status }) {
  return <span className={`flipbook-status ${String(status).toLowerCase()}`}>{status}</span>;
}

function EmptyFlipbooks({ onCreate }) {
  return (
    <div className="flipbook-empty">
      <span><BookOpen size={28} /></span>
      <h3>Your first flipbook starts with a PDF</h3>
      <p>Upload a guide, brochure, catalogue, or treatment plan and share it with one link.</p>
      <button className="flipbook-primary" type="button" onClick={onCreate}><Plus size={17} /> New Flipbook</button>
    </div>
  );
}

function LoadingState({ label = "Loading flipbook…" }) {
  return (
    <div className="flipbook-loading" role="status">
      <span className="flipbook-spinner" />
      <p>{label}</p>
    </div>
  );
}

function PdfPageCanvas({ document, pageNumber, thumbnail = false }) {
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(!thumbnail);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!thumbnail || !hostRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [thumbnail]);

  useEffect(() => {
    if (!document || !visible || !canvasRef.current) return undefined;
    let cancelled = false;
    let renderTask;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: thumbnail ? 0.28 : 1.55 });
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      });
      return renderTask.promise;
    }).then(() => {
      if (!cancelled) setError("");
    }).catch((renderError) => {
      if (!cancelled && renderError?.name !== "RenderingCancelledException") setError("Page unavailable");
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, thumbnail, visible]);

  return (
    <div className={`pdf-page-canvas ${thumbnail ? "is-thumbnail" : ""}`} ref={hostRef}>
      {!visible && <span className="pdf-page-placeholder" />}
      <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} />
      {error && <small>{error}</small>}
    </div>
  );
}

function usePdfDocument(sourceUrl, accessToken = "") {
  const [state, setState] = useState({ document: null, loading: true, error: "" });
  useEffect(() => {
    if (!sourceUrl) return undefined;
    let cancelled = false;
    const task = getDocument({
      url: sourceUrl,
      withCredentials: true,
      httpHeaders: accessToken ? { "X-Flipbook-Access": accessToken } : undefined,
    });
    setState({ document: null, loading: true, error: "" });
    task.promise.then((document) => {
      if (!cancelled) setState({ document, loading: false, error: "" });
    }).catch((error) => {
      if (!cancelled) setState({ document: null, loading: false, error: error?.message || "The PDF could not be opened." });
    });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [accessToken, sourceUrl]);
  return state;
}

function FlipbookReader({
  sourceUrl,
  pageCount,
  title,
  accessToken = "",
  showThumbnails = false,
  background = "#f4f1ed",
  compact = false,
}) {
  const { document, loading, error } = usePdfDocument(sourceUrl, accessToken);
  const singlePage = useMedia("(max-width: 760px)");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(showThumbnails);
  const [turn, setTurn] = useState("");
  const readerRef = useRef(null);
  const canvasScrollRef = useRef(null);
  const touchRef = useRef(null);
  const effectivePages = document?.numPages || pageCount || 1;
  const step = singlePage ? 1 : 2;
  const visiblePages = singlePage ? [page] : [page, page + 1].filter((number) => number <= effectivePages);

  useEffect(() => {
    setPage((current) => Math.min(current, effectivePages));
  }, [effectivePages]);

  const move = useCallback((direction) => {
    setTurn(direction > 0 ? "next" : "previous");
    setPage((current) => Math.max(1, Math.min(effectivePages, current + direction * step)));
    window.setTimeout(() => setTurn(""), 260);
  }, [effectivePages, step]);

  useEffect(() => {
    const keyboard = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [move]);

  function enterFullscreen() {
    if (window.document.fullscreenElement) void window.document.exitFullscreen();
    else void readerRef.current?.requestFullscreen?.();
  }

  function updateZoom(nextValue) {
    const nextZoom = Math.min(1.8, Math.max(0.7, Number(nextValue.toFixed(1))));
    if (nextZoom === zoom) return;
    const scroller = canvasScrollRef.current;
    const centerX = scroller ? scroller.scrollLeft + scroller.clientWidth / 2 : 0;
    const centerY = scroller ? scroller.scrollTop + scroller.clientHeight / 2 : 0;
    const ratio = nextZoom / zoom;
    setZoom(nextZoom);
    window.requestAnimationFrame(() => {
      if (!scroller) return;
      scroller.scrollLeft = Math.max(0, centerX * ratio - scroller.clientWidth / 2);
      scroller.scrollTop = Math.max(0, centerY * ratio - scroller.clientHeight / 2);
    });
  }

  function fitPages() {
    setZoom(1);
    window.requestAnimationFrame(() => {
      canvasScrollRef.current?.scrollTo({ top: 0, left: 0 });
    });
  }

  function onTouchStart(event) {
    const touch = event.touches?.[0];
    if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event) {
    const start = touchRef.current;
    const touch = event.changedTouches?.[0];
    touchRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > deltaY * 1.25) move(deltaX < 0 ? 1 : -1);
  }

  const rangeLabel = singlePage || visiblePages.length === 1
    ? `${page} / ${effectivePages}`
    : `${visiblePages[0]}–${visiblePages.at(-1)} / ${effectivePages}`;

  return (
    <section className={`flipbook-reader ${compact ? "is-compact" : ""}`} ref={readerRef} style={{ "--viewer-background": background }}>
      <div className="flipbook-reader-tools" aria-label="Viewer controls">
        {showThumbnails && (
          <button type="button" onClick={() => setThumbnailsOpen((value) => !value)} aria-label="Toggle page thumbnails">
            <PanelLeftClose size={17} />
          </button>
        )}
        <span className="flipbook-zoom-value">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={zoom <= 0.7} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17} /></button>
        <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={zoom >= 1.8} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17} /></button>
        <button type="button" onClick={fitPages} aria-label="Fit pages to viewer">Fit</button>
        <button type="button" onClick={enterFullscreen} aria-label="Fullscreen"><Fullscreen size={17} /></button>
      </div>

      <div className="flipbook-reader-body">
        {showThumbnails && thumbnailsOpen && document && (
          <aside className="flipbook-thumbnails" aria-label="Page thumbnails">
            {Array.from({ length: effectivePages }, (_, index) => index + 1).map((number) => (
              <button
                className={visiblePages.includes(number) ? "active" : ""}
                type="button"
                key={number}
                onClick={() => setPage(singlePage ? number : Math.max(1, number % 2 === 0 ? number : number - 1))}
              >
                <PdfPageCanvas document={document} pageNumber={number} thumbnail />
                <span>{number}</span>
              </button>
            ))}
          </aside>
        )}

        <div className="flipbook-canvas-scroll" ref={canvasScrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {loading && <LoadingState label="Preparing pages…" />}
          {error && (
            <div className="flipbook-reader-error">
              <FileText size={28} />
              <strong>We couldn’t render this PDF</strong>
              <p>{error}</p>
            </div>
          )}
          {document && (
            <>
              <button className="flipbook-page-arrow previous" type="button" onClick={() => move(-1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={24} /></button>
              <div
                className={`flipbook-pages turn-${turn}`}
                style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: `${Math.round(1080 * zoom)}px` }}
                aria-label={`${title}, ${rangeLabel}`}
              >
                {visiblePages.map((number) => <PdfPageCanvas document={document} pageNumber={number} key={number} />)}
              </div>
              <button className="flipbook-page-arrow next" type="button" onClick={() => move(1)} disabled={page + step > effectivePages} aria-label="Next page"><ChevronRight size={24} /></button>
            </>
          )}
        </div>
      </div>

      <div className="flipbook-reader-footer">
        <button type="button" onClick={() => move(-1)} disabled={page <= 1}><ChevronLeft size={17} /> Previous</button>
        <strong>{rangeLabel}</strong>
        <input
          aria-label="Flipbook page position"
          type="range"
          min="1"
          max={effectivePages}
          step={step}
          value={page}
          onChange={(event) => setPage(Number(event.target.value))}
        />
        <button type="button" onClick={() => move(1)} disabled={page + step > effectivePages}>Next <ChevronRight size={17} /></button>
      </div>
    </section>
  );
}

function WorkspaceChrome({ path, navigate, children, onExit, session }) {
  const selected = workspaceNav.find((item) => item.path === path)?.path || (path.match(/^\/flipbooks\/[^/]+$/) ? "/flipbooks" : path);
  const initials = session?.name?.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "MA";
  return (
    <div className="flipbook-workspace-shell">
      <aside className="flipbook-subnav">
        <div className="flipbook-subnav-brand"><BookOpen size={18} /><strong>Flipbook Workspace</strong></div>
        <nav className="flipbook-subnav-links" aria-label="Flipbooks workspace">
          {workspaceNav.map(({ label, path: itemPath, icon: Icon }) => (
            <button className={selected === itemPath ? "active" : ""} type="button" key={itemPath} onClick={() => navigate(itemPath)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="flipbook-subnav-footer">
          <button className="flipbook-exit-workspace" type="button" onClick={onExit}><ArrowLeft size={16} /><span>Back to MACE</span></button>
          <div className="flipbook-workspace-account"><span>{initials}</span><div><strong>{session?.name || "MACE User"}</strong><small>{session?.role || "Account"}</small></div></div>
        </div>
      </aside>
      <div className="flipbook-workspace-main">{children}</div>
    </div>
  );
}

function WorkspaceHeader({ title, copy, action }) {
  return (
    <header className="flipbook-page-header">
      <div><h1>{title}</h1><p>{copy}</p></div>
      {action}
    </header>
  );
}

function ActionsMenu({ book, onAction }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const actions = [
    ["Preview", "preview"],
    ["Copy link", "copy"],
    ["Share", "share"],
    ["Analytics", "analytics"],
    ["Rename", "rename"],
    ["Duplicate", "duplicate"],
    [book.status === "Published" ? "Unpublish" : "Publish", book.status === "Published" ? "unpublish" : "publish"],
    ["Delete", "delete"],
  ];

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    const closeMenu = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [open]);

  function toggleMenu() {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = actions.length * 33 + 12;
    const top = rect.bottom + 6 + menuHeight <= window.innerHeight - 8
      ? rect.bottom + 6
      : Math.max(8, rect.top - menuHeight - 6);
    setPosition({ top, left: Math.min(window.innerWidth - 166, Math.max(8, rect.right - 158)) });
    setOpen(true);
  }

  return (
    <div className="flipbook-actions-menu">
      <button ref={triggerRef} type="button" aria-label={`More actions for ${book.title}`} aria-expanded={open} onClick={toggleMenu}><EllipsisVertical size={18} /></button>
      {open && createPortal(
        <div className="flipbook-actions-popover" ref={menuRef} role="menu" style={position}>
          {actions.map(([label, action]) => (
            <button className={action === "delete" ? "danger" : ""} role="menuitem" type="button" key={action} onClick={() => { setOpen(false); onAction(action, book); }}>{action === "delete" && <Trash2 size={15} />}{label}</button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function FlipbooksTable({ books, navigate, onAction }) {
  const [query, setQuery] = useState("");
  const filtered = books.filter((book) => `${book.title} ${book.description} ${book.status}`.toLowerCase().includes(query.toLowerCase()));
  if (!books.length) return <EmptyFlipbooks onCreate={() => navigate("/flipbooks/new")} />;
  return (
    <>
      <label className="flipbook-list-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search flipbooks…" /></label>
      <div className="flipbook-table-wrap">
        <table className="flipbook-table">
          <thead><tr><th>Flipbook</th><th>Pages</th><th>Status</th><th>Updated</th><th>Views</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {filtered.map((book) => (
              <tr key={book.id}>
                <td><button className="flipbook-title-cell" type="button" onClick={() => navigate(`/flipbooks/${book.id}`)}><span><FileText size={20} /></span><span><strong>{book.title}</strong><small>{book.description || formatBytes(book.byteSize)}</small></span></button></td>
                <td>{book.pageCount}</td>
                <td><StatusPill status={book.status} /></td>
                <td>{formatDate(book.updatedAt)}</td>
                <td>{book.status === "Draft" ? "—" : book.views.toLocaleString()}</td>
                <td className="flipbook-row-actions">
                  <button type="button" onClick={() => navigate(`/flipbooks/${book.id}`)} aria-label={`Open ${book.title}`}><Eye size={17} /></button>
                  {book.publicLink && <button type="button" onClick={() => onAction("copy", book)} aria-label={`Copy link for ${book.title}`}><Link2 size={17} /></button>}
                  <ActionsMenu book={book} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="flipbook-no-results">No flipbooks match “{query}”.</p>}
    </>
  );
}

function Toggle({ checked, onChange, label }) {
  return <button className={`flipbook-toggle ${checked ? "on" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

function ShareDialog({ book, onClose, onUpdated, notify }) {
  const [form, setForm] = useState({
    allowDownload: book.allowDownload,
    passwordProtection: book.passwordProtected,
    password: "",
    expiresAt: book.expiresAt ? String(book.expiresAt).slice(0, 10) : "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await updateFlipbook(book.id, form);
      onUpdated(result.flipbook);
      notify("Sharing settings updated.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flipbook-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-flipbook-title">
      <div className="flipbook-modal share-modal">
        <header><div><small>Sharing</small><strong id="share-flipbook-title">Share Flipbook</strong></div><button type="button" onClick={onClose} aria-label="Close share dialog"><X size={19} /></button></header>
        {book.status !== "Published" ? (
          <div className="flipbook-share-draft"><Globe2 size={26} /><h3>Publish before sharing</h3><p>A secure public link will appear as soon as this flipbook is published.</p></div>
        ) : (
          <>
            <label className="flipbook-field"><span>Public link</span><div className="flipbook-copy-field"><input readOnly value={book.publicLink} /><button type="button" onClick={() => void copyText(book.publicLink, () => notify("Link copied."))}><Copy size={16} /> Copy</button></div></label>
            <div className="flipbook-share-status"><Globe2 size={17} /><div><strong>{book.passwordProtected ? "Password protected" : "Anyone with the link"}</strong><span>No MACE account is required.</span></div></div>
            <div className="flipbook-setting-row"><div><strong>Allow PDF download</strong><span>Recipients can save the original file.</span></div><Toggle checked={form.allowDownload} onChange={(value) => setForm({ ...form, allowDownload: value })} label="Allow PDF download" /></div>
            <div className="flipbook-setting-row"><div><strong>Password protection</strong><span>Require a password before pages load.</span></div><Toggle checked={form.passwordProtection} onChange={(value) => setForm({ ...form, passwordProtection: value })} label="Password protection" /></div>
            {form.passwordProtection && <label className="flipbook-field"><span>{book.passwordProtected ? "New password (optional)" : "Password"}</span><input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /></label>}
            <label className="flipbook-field"><span>Link expiration</span><input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
            <a className="flipbook-open-public" href={book.publicLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open Public Viewer</a>
          </>
        )}
        <footer><button className="flipbook-secondary" type="button" onClick={onClose}>Close</button>{book.status === "Published" && <button className="flipbook-primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save access"}</button>}</footer>
      </div>
    </div>
  );
}

function CreateFlipbook({ navigate, notify }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function chooseFile(nextFile) {
    setError("");
    if (!nextFile) return;
    if (nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    if (nextFile.size > MAX_PDF_BYTES) {
      setError("PDF must be 30 MB or smaller.");
      return;
    }
    setProcessing(true);
    try {
      const bytes = new Uint8Array(await nextFile.arrayBuffer());
      const task = getDocument({ data: bytes });
      const document = await task.promise;
      setPageCount(document.numPages);
      setFile(nextFile);
      setTitle(nextFile.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "));
      await task.destroy();
    } catch {
      setError("This PDF appears damaged or password-locked. Upload an accessible PDF.");
    } finally {
      setProcessing(false);
    }
  }

  async function create() {
    if (!file || !title.trim()) return;
    setProcessing(true);
    setError("");
    try {
      const result = await uploadFlipbookPdf(file, { title: title.trim(), description: description.trim(), pageCount }, setProgress);
      notify("Flipbook created as a draft.");
      navigate(`/flipbooks/${result.flipbook.id}`);
    } catch (uploadError) {
      setError(uploadError.message || "The flipbook could not be created.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flipbook-create-page">
      <WorkspaceHeader title="Create New Flipbook" copy="Turn a PDF into a polished document your clients can open anywhere." />
      <div className="flipbook-create-steps" aria-label="Creation progress"><span className="active">1 <b>Upload PDF</b></span><i /><span className={file ? "active" : ""}>2 <b>Details</b></span></div>
      <section
        className={`flipbook-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files?.[0]); }}
      >
        {file ? (
          <><span className="flipbook-file-icon"><FileText size={27} /></span><div><strong>{file.name}</strong><small>{pageCount} pages · {formatBytes(file.size)}</small></div><button type="button" onClick={() => { setFile(null); setPageCount(0); setProgress(0); }}>Replace</button></>
        ) : (
          <><span className="flipbook-upload-icon"><UploadCloud size={28} /></span><h2>{processing ? "Reading your PDF…" : "Drop your PDF here"}</h2><p>or</p><button className="flipbook-secondary" type="button" onClick={() => inputRef.current?.click()}>Browse files</button><small>PDF only · Up to 30 MB</small></>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} />
      </section>
      {file && (
        <section className="flipbook-details-form">
          <div><span>Step 2</span><h2>Add details</h2><p>Use a clear title recipients will recognize.</p></div>
          <label className="flipbook-field"><span>Flipbook title</span><input maxLength="160" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="flipbook-field"><span>Description <small>Optional</small></span><textarea maxLength="1000" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this document for?" /></label>
          {processing && progress > 0 && <div className="flipbook-upload-progress"><span style={{ width: `${progress}%` }} /><small>Uploading {progress}%</small></div>}
          <button className="flipbook-primary create-button" type="button" onClick={create} disabled={processing || !title.trim()}>{processing && progress ? `Uploading ${progress}%` : "Create Flipbook"}</button>
        </section>
      )}
      {error && <p className="flipbook-form-error" role="alert">{error}</p>}
    </div>
  );
}

function OverviewPage({ books, navigate }) {
  const published = books.filter((book) => book.status === "Published");
  const totalViews = books.reduce((sum, book) => sum + book.views, 0);
  return (
    <div>
      <WorkspaceHeader title="Flipbook Overview" copy="Publish client-ready documents and keep every shared link under control." action={<button className="flipbook-primary" type="button" onClick={() => navigate("/flipbooks/new")}><Plus size={17} /> New Flipbook</button>} />
      <div className="flipbook-overview-metrics">
        <article><span><FileText size={18} /></span><small>Total flipbooks</small><strong>{books.length}</strong></article>
        <article><span><Globe2 size={18} /></span><small>Published</small><strong>{published.length}</strong></article>
        <article><span><Eye size={18} /></span><small>Total views</small><strong>{totalViews.toLocaleString()}</strong></article>
        <article><span><Link2 size={18} /></span><small>Active links</small><strong>{published.filter((book) => book.publicEnabled).length}</strong></article>
      </div>
      <div className="flipbook-overview-heading"><div><h2>Recently updated</h2><p>Continue editing or share a published document.</p></div><button type="button" onClick={() => navigate("/flipbooks")}>View all <ChevronRight size={16} /></button></div>
      {books.length ? <FlipbooksTable books={books.slice(0, 5)} navigate={navigate} onAction={(_, book) => navigate(`/flipbooks/${book.id}`)} /> : <EmptyFlipbooks onCreate={() => navigate("/flipbooks/new")} />}
    </div>
  );
}

function AnalyticsPage({ notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadFlipbookAnalytics().then(setData).catch((error) => notify(error.message, "error")).finally(() => setLoading(false));
  }, [notify]);
  if (loading) return <LoadingState label="Loading analytics…" />;
  const summary = data?.summary || { totalViews: 0, uniqueViewers: 0, lastViewed: null, timeline: [] };
  const max = Math.max(1, ...summary.timeline.map((day) => day.views));
  return (
    <div>
      <WorkspaceHeader title="Flipbook Analytics" copy="A clear view of how your published documents are being opened." />
      <div className="flipbook-overview-metrics analytics">
        <article><span><Eye size={18} /></span><small>Total views</small><strong>{summary.totalViews.toLocaleString()}</strong></article>
        <article><span><Users size={18} /></span><small>Unique viewers</small><strong>{summary.uniqueViewers.toLocaleString()}</strong></article>
        <article><span><CalendarClock size={18} /></span><small>Last viewed</small><strong className="metric-date">{formatDate(summary.lastViewed)}</strong></article>
      </div>
      <section className="flipbook-analytics-chart">
        <header><div><h2>Views over time</h2><p>Last 14 days</p></div></header>
        <div className="flipbook-chart-bars">
          {summary.timeline.map((day) => <span key={day.date} title={`${formatDate(day.date)}: ${day.views} views`}><i style={{ height: `${Math.max(4, (day.views / max) * 100)}%` }} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en", { weekday: "narrow" })}</small></span>)}
        </div>
      </section>
      <section className="flipbook-analytics-list"><h2>By flipbook</h2>{data?.flipbooks?.map((book) => <article key={book.id}><div><strong>{book.title}</strong><span>{book.status}</span></div><div><b>{book.views}</b><small>views</small></div><div><b>{book.uniqueViewers}</b><small>unique</small></div><div><b>{formatDate(book.lastViewed)}</b><small>last viewed</small></div></article>)}</section>
    </div>
  );
}

function SharedLinksPage({ notify, navigate }) {
  const [links, setLinks] = useState(null);
  const refresh = useCallback(() => loadFlipbookLinks().then((result) => setLinks(result.links)).catch((error) => notify(error.message, "error")), [notify]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function disable(book) {
    try {
      await updateFlipbook(book.id, { publicEnabled: false });
      notify("Public link disabled.");
      await refresh();
    } catch (error) { notify(error.message, "error"); }
  }
  if (!links) return <LoadingState label="Loading shared links…" />;
  return (
    <div>
      <WorkspaceHeader title="Shared Links" copy="Manage access without deleting the original flipbook." />
      <div className="flipbook-table-wrap"><table className="flipbook-table shared-links-table"><thead><tr><th>Flipbook</th><th>Link</th><th>Status</th><th>Created</th><th>Expires</th><th>Views</th><th>Actions</th></tr></thead><tbody>
        {links.map((book) => <tr key={book.id}><td><strong>{book.title}</strong></td><td><button className="link-preview" type="button" onClick={() => void copyText(book.publicLink, () => notify("Link copied."))}>{book.publicLink.replace(/^https?:\/\//, "").slice(0, 31)}… <Copy size={14} /></button></td><td><StatusPill status={book.linkStatus} /></td><td>{formatDate(book.publishedAt)}</td><td>{book.expiresAt ? formatDate(book.expiresAt) : "Never"}</td><td>{book.views}</td><td><div className="shared-link-actions"><button type="button" onClick={() => void copyText(book.publicLink, () => notify("Link copied."))} aria-label="Copy link"><Copy size={16} /></button><a href={book.publicLink} target="_blank" rel="noreferrer" aria-label="Open public viewer"><ExternalLink size={16} /></a><button type="button" onClick={() => navigate(`/flipbooks/${book.id}`)} aria-label="Edit access"><ShieldCheck size={16} /></button>{book.publicEnabled && <button type="button" onClick={() => void disable(book)}>Disable</button>}</div></td></tr>)}
      </tbody></table>{!links.length && <EmptyFlipbooks onCreate={() => navigate("/flipbooks/new")} />}</div>
    </div>
  );
}

function DeletedFlipbooksPage({ notify }) {
  const [books, setBooks] = useState(null);
  const [busyId, setBusyId] = useState("");
  const refresh = useCallback(() => listDeletedFlipbooks().then((result) => setBooks(result.flipbooks)).catch((error) => notify(error.message, "error")), [notify]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function restore(book) {
    setBusyId(book.id);
    try {
      await restoreFlipbook(book.id);
      notify("Flipbook restored.");
      await refresh();
    } catch (error) { notify(error.message, "error"); } finally { setBusyId(""); }
  }

  async function removeForever(book) {
    if (!window.confirm(`Delete “${book.title}” forever? The PDF and its analytics will be permanently removed.`)) return;
    setBusyId(book.id);
    try {
      await deleteFlipbookForever(book.id);
      notify("Flipbook permanently deleted.");
      await refresh();
    } catch (error) { notify(error.message, "error"); } finally { setBusyId(""); }
  }

  if (!books) return <LoadingState label="Loading deleted flipbooks…" />;
  return (
    <div>
      <WorkspaceHeader title="Deleted" copy="Restore a flipbook or permanently remove its PDF and analytics." />
      {!books.length ? (
        <div className="flipbook-deleted-empty"><Trash2 size={25} /><h2>No deleted flipbooks</h2><p>Flipbooks you delete will stay here until you restore or permanently remove them.</p></div>
      ) : (
        <div className="flipbook-table-wrap"><table className="flipbook-table deleted-flipbooks-table"><thead><tr><th>Flipbook</th><th>Pages</th><th>Deleted</th><th>Previous status</th><th>Actions</th></tr></thead><tbody>
          {books.map((book) => <tr key={book.id}><td><div className="flipbook-deleted-title"><span><FileText size={19} /></span><div><strong>{book.title}</strong><small>{book.description || formatBytes(book.byteSize)}</small></div></div></td><td>{book.pageCount}</td><td>{formatDate(book.deletedAt)}</td><td><StatusPill status={book.status} /></td><td><div className="flipbook-deleted-actions"><button type="button" onClick={() => void restore(book)} disabled={busyId === book.id}><RotateCcw size={15} /> Restore</button><button className="danger" type="button" onClick={() => void removeForever(book)} disabled={busyId === book.id}><Trash2 size={15} /> Delete forever</button></div></td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}

function SettingsPage({ session, notify }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const logoInput = useRef(null);
  useEffect(() => { loadFlipbookSettings().then((result) => setForm(result.settings)).catch((error) => notify(error.message, "error")); }, [notify]);
  if (!form) return <LoadingState label="Loading settings…" />;

  async function uploadLogo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await uploadImageAsset(String(reader.result || ""), "flipbook-logo", session.branch || "All branches");
        setForm((current) => ({ ...current, logo: result.asset.url }));
      } catch (error) { notify(error.message, "error"); }
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveFlipbookSettings(form);
      setForm(result.settings);
      notify("Flipbook settings saved.");
    } catch (error) { notify(error.message, "error"); } finally { setSaving(false); }
  }

  return (
    <div>
      <WorkspaceHeader title="Flipbook Settings" copy="Set the branding and sharing defaults used for new documents." action={<button className="flipbook-primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>} />
      <div className="flipbook-settings-grid">
        <section><div className="settings-section-title"><ImageIcon size={18} /><div><h2>Branding</h2><p>Shown only in the public viewer.</p></div></div><div className="flipbook-logo-setting"><span>{form.logo ? <img src={form.logo} alt="Viewer logo" /> : <BookOpen size={24} />}</span><div><button className="flipbook-secondary" type="button" onClick={() => logoInput.current?.click()}>Upload logo</button>{form.logo && <button type="button" onClick={() => setForm({ ...form, logo: "" })}>Remove</button>}</div><input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(event.target.files?.[0])} /></div><label className="flipbook-field"><span>Clinic or business name</span><input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></label><label className="flipbook-field"><span>Viewer background</span><div className="flipbook-color-input"><input type="color" value={form.viewerBackground} onChange={(event) => setForm({ ...form, viewerBackground: event.target.value })} /><input value={form.viewerBackground} onChange={(event) => setForm({ ...form, viewerBackground: event.target.value })} /></div></label></section>
        <section><div className="settings-section-title"><Share2 size={18} /><div><h2>Sharing defaults</h2><p>Applied when a flipbook is created.</p></div></div><label className="flipbook-field"><span>Default access</span><select value={form.defaultAccess} onChange={(event) => setForm({ ...form, defaultAccess: event.target.value })}><option>Anyone with the link</option><option>Password protected</option></select></label><div className="flipbook-setting-row"><div><strong>Allow downloads</strong><span>Default for new flipbooks.</span></div><Toggle checked={form.defaultAllowDownload} onChange={(value) => setForm({ ...form, defaultAllowDownload: value })} label="Default allow downloads" /></div><label className="flipbook-field"><span>Default expiration</span><select value={form.defaultExpirationDays} onChange={(event) => setForm({ ...form, defaultExpirationDays: Number(event.target.value) })}><option value="0">Never</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label></section>
      </div>
    </div>
  );
}

function EditorPanel({ book, setBook, notify, onShare }) {
  const [tab, setTab] = useState("Share");
  const [form, setForm] = useState({ title: book.title, description: book.description, allowDownload: book.allowDownload, passwordProtection: book.passwordProtected, password: "", expiresAt: book.expiresAt ? String(book.expiresAt).slice(0, 10) : "", publicEnabled: book.publicEnabled });
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const result = await updateFlipbook(book.id, form);
      setBook(result.flipbook);
      setForm((current) => ({ ...current, password: "" }));
      notify("Flipbook updated.");
    } catch (error) { notify(error.message, "error"); } finally { setSaving(false); }
  }
  return (
    <aside className="flipbook-editor-panel">
      <div className="flipbook-panel-tabs">{["Details", "Share", "Appearance", "Access"].map((item) => <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="flipbook-panel-content">
        {tab === "Details" && <><label className="flipbook-field"><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="flipbook-field"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><dl className="flipbook-document-meta"><div><dt>Pages</dt><dd>{book.pageCount}</dd></div><div><dt>File size</dt><dd>{formatBytes(book.byteSize)}</dd></div><div><dt>Updated</dt><dd>{formatDate(book.updatedAt)}</dd></div></dl></>}
        {tab === "Share" && (book.status === "Published" ? <><label className="flipbook-field"><span>Public link</span><div className="flipbook-copy-field stacked"><input readOnly value={book.publicLink} /><button type="button" onClick={() => void copyText(book.publicLink, () => notify("Link copied."))}><Copy size={16} /> Copy</button></div></label><p className="flipbook-panel-hint">Anyone permitted by your access settings can view this link without a MACE account.</p><div className="flipbook-share-buttons"><a href={`mailto:?subject=${encodeURIComponent(book.title)}&body=${encodeURIComponent(book.publicLink)}`}><Mail size={17} /> Email</a><a href={`sms:?body=${encodeURIComponent(`${book.title}: ${book.publicLink}`)}`}><Share2 size={17} /> SMS</a><a href={`https://wa.me/?text=${encodeURIComponent(`${book.title}: ${book.publicLink}`)}`} target="_blank" rel="noreferrer"><Share2 size={17} /> WhatsApp</a><button type="button" onClick={onShare}><MoreHorizontal size={17} /> More</button></div></> : <div className="flipbook-panel-empty"><Globe2 size={23} /><strong>Ready when you are</strong><p>Publish this draft to create its secure public link.</p></div>)}
        {tab === "Appearance" && <div className="flipbook-appearance-info"><span className="mace-viewer-mark"><BookOpen size={23} /></span><h3>MACE public viewer</h3><p>Your workspace logo, business name, and warm neutral viewer background are applied automatically.</p><small>Change workspace branding from Flipbooks → Settings.</small></div>}
        {tab === "Access" && <><div className="flipbook-setting-row"><div><strong>Public link</strong><span>Disable without deleting.</span></div><Toggle checked={form.publicEnabled} onChange={(value) => setForm({ ...form, publicEnabled: value })} label="Public link" /></div><div className="flipbook-setting-row"><div><strong>Allow PDF download</strong><span>Show download in public viewer.</span></div><Toggle checked={form.allowDownload} onChange={(value) => setForm({ ...form, allowDownload: value })} label="Allow download" /></div><div className="flipbook-setting-row"><div><strong>Password protection</strong><span>Protect every page server-side.</span></div><Toggle checked={form.passwordProtection} onChange={(value) => setForm({ ...form, passwordProtection: value })} label="Password protection" /></div>{form.passwordProtection && <label className="flipbook-field"><span>{book.passwordProtected ? "New password (optional)" : "Password"}</span><input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}<label className="flipbook-field"><span>Link expiration</span><input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label></>}
      </div>
      {(tab === "Details" || tab === "Access") && <footer><button className="flipbook-primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Update"}</button></footer>}
    </aside>
  );
}

function FlipbookEditor({ id, navigate, notify, onListChanged }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(false);
  useEffect(() => { getFlipbook(id).then((result) => setBook(result.flipbook)).catch((error) => notify(error.message, "error")).finally(() => setLoading(false)); }, [id, notify]);
  if (loading) return <LoadingState />;
  if (!book) return <div className="flipbook-not-found"><FileText size={30} /><h2>Flipbook not found</h2><button type="button" onClick={() => navigate("/flipbooks")}>Back to Flipbooks</button></div>;

  async function publishOrUpdate() {
    try {
      const result = book.status === "Published" ? await getFlipbook(book.id) : await publishFlipbook(book.id);
      setBook(result.flipbook);
      onListChanged();
      notify(book.status === "Published" ? "Flipbook is up to date." : "Flipbook published. Public link is ready.");
    } catch (error) { notify(error.message, "error"); }
  }

  async function nativeShare() {
    if (book.status !== "Published") { setShare(true); return; }
    if (navigator.share) {
      try { await navigator.share({ title: book.title, text: book.description, url: book.publicLink }); } catch { /* Share sheet dismissed. */ }
    } else setShare(true);
  }

  return (
    <div className="flipbook-editor">
      <header className="flipbook-editor-topbar">
        <div><button type="button" onClick={() => navigate("/flipbooks")} aria-label="Back to Flipbooks"><ArrowLeft size={18} /></button><div><small>Flipbook</small><strong>{book.title}</strong></div><StatusPill status={book.status} /></div>
        <div><button className="flipbook-secondary" type="button" onClick={() => navigate(`/flipbooks/${book.id}/preview`)}><Eye size={17} /> Preview</button><button className="flipbook-secondary" type="button" disabled={!book.publicLink} onClick={() => void copyText(book.publicLink, () => notify("Link copied."))}><Copy size={17} /> Copy Link</button><button className="flipbook-secondary" type="button" onClick={() => void nativeShare()}><Share2 size={17} /> Share</button><button className="flipbook-primary" type="button" onClick={() => void publishOrUpdate()}>{book.status === "Published" ? "Update" : "Publish"}</button></div>
      </header>
      <div className="flipbook-editor-body">
        <FlipbookReader sourceUrl={book.sourceUrl} pageCount={book.pageCount} title={book.title} showThumbnails />
        <EditorPanel key={book.updatedAt} book={book} setBook={(next) => { setBook(next); onListChanged(); }} notify={notify} onShare={() => setShare(true)} />
      </div>
      {share && <ShareDialog book={book} onClose={() => setShare(false)} onUpdated={(next) => { setBook(next); onListChanged(); }} notify={notify} />}
    </div>
  );
}

function FlipbookPreviewPage({ id, navigate, notify }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getFlipbook(id)
      .then((result) => setBook(result.flipbook))
      .catch((error) => notify(error.message, "error"))
      .finally(() => setLoading(false));
  }, [id, notify]);

  if (loading) return <LoadingState label="Loading preview…" />;
  if (!book) return <div className="flipbook-not-found"><FileText size={30} /><h2>Flipbook not found</h2><button type="button" onClick={() => navigate("/flipbooks")}>Back to Flipbooks</button></div>;

  return (
    <div className="flipbook-preview-page">
      <header className="flipbook-editor-topbar">
        <div><button type="button" onClick={() => navigate(`/flipbooks/${book.id}`)} aria-label="Back to editor"><ArrowLeft size={18} /></button><div><small>Preview</small><strong>{book.title}</strong></div><StatusPill status={book.status} /></div>
        <div><button className="flipbook-secondary" type="button" onClick={() => navigate(`/flipbooks/${book.id}`)}><FileText size={17} /> Edit Flipbook</button>{book.publicLink && <button className="flipbook-secondary" type="button" onClick={() => void copyText(book.publicLink, () => notify("Link copied."))}><Copy size={17} /> Copy Link</button>}{book.publicLink && <a className="flipbook-primary" href={book.publicLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open Public Viewer</a>}</div>
      </header>
      <div className="flipbook-preview-page-reader">
        <FlipbookReader sourceUrl={book.sourceUrl} pageCount={book.pageCount} title={book.title} showThumbnails />
      </div>
    </div>
  );
}

export default function FlipbooksWorkspace({ notify, session, onExit }) {
  const [path, navigate] = useWorkspacePath();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const refresh = useCallback(() => listFlipbooks().then((result) => setBooks(result.flipbooks)).catch((error) => notify(error.message, "error")).finally(() => setLoading(false)), [notify]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function action(type, book) {
    try {
      if (type === "preview") navigate(`/flipbooks/${book.id}/preview`);
      if (type === "share") setShare(book);
      if (type === "copy") {
        if (!book.publicLink) return notify("Publish this flipbook before copying its link.", "warning");
        await copyText(book.publicLink, () => notify("Link copied."));
      }
      if (type === "analytics") navigate("/flipbooks/analytics");
      if (type === "rename") {
        const title = window.prompt("Rename flipbook", book.title)?.trim();
        if (title && title !== book.title) await updateFlipbook(book.id, { title });
      }
      if (type === "duplicate") { await duplicateFlipbook(book.id); notify("Draft duplicate created."); }
      if (type === "publish") { await publishFlipbook(book.id); notify("Flipbook published."); }
      if (type === "unpublish") { await unpublishFlipbook(book.id); notify("Flipbook returned to draft."); }
      if (type === "delete" && window.confirm(`Move “${book.title}” to Deleted? You can restore it later.`)) { await deleteFlipbook(book.id); notify("Flipbook moved to Deleted."); }
      if (!["preview", "share", "copy", "analytics"].includes(type)) await refresh();
    } catch (error) { notify(error.message, "error"); }
  }

  const previewMatch = path.match(/^\/flipbooks\/([^/]+)\/preview$/);
  if (previewMatch) return <FlipbookPreviewPage id={decodeURIComponent(previewMatch[1])} navigate={navigate} notify={notify} />;

  const editorMatch = path.match(/^\/flipbooks\/([^/]+)$/);
  const isEditor = editorMatch && !["overview", "new", "shared", "analytics", "deleted", "settings"].includes(editorMatch[1]);
  if (isEditor) return <FlipbookEditor id={decodeURIComponent(editorMatch[1])} navigate={navigate} notify={notify} onListChanged={refresh} />;

  let content;
  if (path === "/flipbooks/new") content = <CreateFlipbook navigate={navigate} notify={notify} />;
  else if (path === "/flipbooks/shared") content = <SharedLinksPage notify={notify} navigate={navigate} />;
  else if (path === "/flipbooks/analytics") content = <AnalyticsPage notify={notify} />;
  else if (path === "/flipbooks/deleted") content = <DeletedFlipbooksPage notify={notify} />;
  else if (path === "/flipbooks/settings") content = <SettingsPage session={session} notify={notify} />;
  else if (path === "/flipbooks/overview") content = loading ? <LoadingState label="Loading overview…" /> : <OverviewPage books={books} navigate={navigate} />;
  else content = loading ? <LoadingState label="Loading flipbooks…" /> : <div><WorkspaceHeader title="Flipbooks" copy="Create, publish and share interactive documents." action={<button className="flipbook-primary" type="button" onClick={() => navigate("/flipbooks/new")}><Plus size={17} /> New Flipbook</button>} /><FlipbooksTable books={books} navigate={navigate} onAction={action} /></div>;

  return (
    <WorkspaceChrome path={path} navigate={navigate} onExit={onExit} session={session}>
      {content}
      {share && <ShareDialog book={share} onClose={() => setShare(null)} onUpdated={(next) => { setShare(next); void refresh(); }} notify={notify} />}
    </WorkspaceChrome>
  );
}

function publicViewerId() {
  const key = "mace-flipbook-viewer-id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function PublicFlipbookViewer({ token }) {
  const [payload, setPayload] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const viewerId = useMemo(publicViewerId, []);

  const load = useCallback(async (credential = accessToken) => {
    setLoading(true);
    setError("");
    try { setPayload(await loadPublicFlipbook(token, credential, viewerId)); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [accessToken, token, viewerId]);
  useEffect(() => { void load(); }, [load]);

  async function unlock(event) {
    event.preventDefault();
    setUnlocking(true);
    setError("");
    try {
      const result = await unlockPublicFlipbook(token, password);
      setAccessToken(result.accessToken);
      setPassword("");
      await load(result.accessToken);
    } catch (unlockError) { setError(unlockError.message); } finally { setUnlocking(false); }
  }

  if (loading) return <main className="public-flipbook-state"><img src="/brand/mace-logo.png" alt="MACE" /><LoadingState label="Opening flipbook…" /></main>;
  if (error && !payload?.locked) return <main className="public-flipbook-state"><img src="/brand/mace-logo.png" alt="MACE" /><div className="public-flipbook-unavailable"><LockKeyhole size={28} /><h1>Flipbook unavailable</h1><p>{error}</p></div></main>;
  if (payload?.locked) return (
    <main className="public-flipbook-lock" style={{ "--public-background": payload.branding?.viewerBackground || "#f4f1ed" }}>
      <section><div className="public-flipbook-brand">{payload.branding?.logo ? <img src={payload.branding.logo} alt="" /> : <BookOpen size={24} />}<strong>{payload.branding?.businessName || "MACE"}</strong></div><span className="public-lock-icon"><LockKeyhole size={24} /></span><h1>{payload.flipbook.title}</h1><p>This flipbook is password protected.</p><form onSubmit={unlock}><label><span>Password</span><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <small role="alert">{error}</small>}<button className="flipbook-primary" type="submit" disabled={unlocking}>{unlocking ? "Opening…" : "Open Flipbook"}</button></form></section>
    </main>
  );
  const book = payload.flipbook;
  const branding = payload.branding || {};
  return (
    <main className="public-flipbook-viewer" style={{ "--public-background": branding.viewerBackground || "#f4f1ed" }}>
      <header><div className="public-flipbook-brand">{branding.logo ? <img src={branding.logo} alt="" /> : <BookOpen size={22} />}<strong>{branding.businessName || "MACE"}</strong></div><div className="public-flipbook-title"><strong>{book.title}</strong><span>{book.pageCount} pages</span></div><div>{book.allowDownload && <button type="button" onClick={() => void downloadPublicFlipbook(token, accessToken, book.title)}><Download size={17} /><span>Download PDF</span></button>}</div></header>
      <FlipbookReader sourceUrl={book.sourceUrl} pageCount={book.pageCount} title={book.title} accessToken={accessToken} background={branding.viewerBackground} />
    </main>
  );
}

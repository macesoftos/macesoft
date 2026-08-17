import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Grid2X2,
  Image as ImageIcon,
  List,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteMarketingMediaForever,
  moveMarketingMediaToDeleted,
  restoreMarketingMedia,
} from "../lib/api.js";

function normalizedAsset(asset) {
  return {
    ...asset,
    name: asset?.name || asset?.originalName || `Marketing image ${String(asset?.id || "").slice(0, 8)}`,
    url: asset?.url || (asset?.id ? `/api/uploads/${encodeURIComponent(asset.id)}` : ""),
  };
}

function mediaBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "Recently uploaded" : date.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
}

export function readMarketingImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
      reject(new Error("Choose a JPG, PNG, or WebP image."));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("The image must be 3 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function MediaLibraryContent({
  askConfirm,
  deleteMediaForever = deleteMarketingMediaForever,
  initialSelectedUrl = "",
  loadMedia,
  moveMediaToDeleted = moveMarketingMediaToDeleted,
  notify,
  onCancel,
  onSelect,
  picker = false,
  restoreMedia = restoreMarketingMedia,
  uploadImage,
}) {
  const input = useRef(null);
  const loadRequest = useRef(0);
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState("");
  const [counts, setCounts] = useState({ active: 0, deleted: 0 });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [sort, setSort] = useState("Newest first");
  const [status, setStatus] = useState("active");
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState("grid");

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++loadRequest.current;
    if (!silent) setLoading(true);
    setError("");
    try {
      if (!loadMedia) throw new Error("The media library is not available right now.");
      const result = await loadMedia({ includeDeleted: !picker });
      if (requestId !== loadRequest.current) return;
      const next = (Array.isArray(result?.assets) ? result.assets : []).map(normalizedAsset);
      const active = next.filter((asset) => !asset.deletedAt).length;
      const deleted = next.filter((asset) => Boolean(asset.deletedAt)).length;
      setAssets(next);
      setCounts({
        active: Number.isFinite(Number(result?.counts?.active)) ? Number(result.counts.active) : active,
        deleted: Number.isFinite(Number(result?.counts?.deleted)) ? Number(result.counts.deleted) : deleted,
      });
      const existing = next.find((asset) => !asset.deletedAt && asset.url === initialSelectedUrl);
      if (existing) setSelectedId(existing.id);
      else if (picker) setSelectedId("");
    } catch (loadError) {
      if (requestId === loadRequest.current) setError(loadError?.message || "The media library could not be loaded.");
    } finally {
      if (requestId === loadRequest.current && !silent) setLoading(false);
    }
  }, [initialSelectedUrl, loadMedia, picker]);

  useEffect(() => {
    void refresh();
    return () => { loadRequest.current += 1; };
  }, [refresh]);

  const visibleAssets = useMemo(() => {
    const search = query.trim().toLowerCase();
    const inCurrentView = assets.filter((asset) => picker ? !asset.deletedAt : Boolean(asset.deletedAt) === (status === "deleted"));
    const filtered = search
      ? inCurrentView.filter((asset) => `${asset.name} ${asset.mimeType} ${asset.branch}`.toLowerCase().includes(search))
      : inCurrentView;
    return [...filtered].sort((left, right) => {
      if (sort === "Oldest first") return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
      if (sort === "A - Z") return left.name.localeCompare(right.name);
      if (sort === "Z - A") return right.name.localeCompare(left.name);
      if (sort === "Smallest first") return Number(left.byteSize || 0) - Number(right.byteSize || 0);
      if (sort === "Largest first") return Number(right.byteSize || 0) - Number(left.byteSize || 0);
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });
  }, [assets, picker, query, sort, status]);

  const selected = assets.find((asset) => !asset.deletedAt && asset.id === selectedId) || null;
  const selectedCount = selectedIds.size;
  const allVisibleSelected = visibleAssets.length > 0 && visibleAssets.every((asset) => selectedIds.has(asset.id));

  function changeStatus(nextStatus) {
    setStatus(nextStatus);
    setSelectedIds(new Set());
    setError("");
  }

  function toggleSelection(id) {
    if (picker) {
      setSelectedId(id);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleAssets.forEach((asset) => next.delete(asset.id));
      else visibleAssets.forEach((asset) => next.add(asset.id));
      return next;
    });
  }

  async function runMediaAction(action, { all = false } = {}) {
    const ids = all ? [] : [...selectedIds];
    setBusy(action);
    setError("");
    try {
      const result = action === "delete"
        ? await moveMediaToDeleted({ ids, all })
        : action === "restore"
          ? await restoreMedia({ ids, all })
          : await deleteMediaForever({ ids, all });
      const changed = Number(result?.count || 0);
      setSelectedIds(new Set());
      await refresh({ silent: true });
      if (action === "delete") notify?.(`${changed} image${changed === 1 ? "" : "s"} moved to Deleted.`);
      if (action === "restore") notify?.(`${changed} image${changed === 1 ? "" : "s"} restored to Media.`);
      if (action === "permanent") notify?.(`${changed} image${changed === 1 ? "" : "s"} deleted forever.`);
      if (action === "permanent" && Number(result?.failedCount || 0)) {
        setError(`${result.failedCount} image${result.failedCount === 1 ? "" : "s"} could not be removed from storage. Try again.`);
      }
    } catch (actionError) {
      await refresh({ silent: true });
      setError(actionError?.message || "The Media action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  function confirmMoveToDeleted(all) {
    const count = all ? counts.active : selectedCount;
    const confirmation = {
      title: all ? "Move all images to Deleted?" : `Move ${count} image${count === 1 ? "" : "s"} to Deleted?`,
      copy: `${all ? "Every image in this Media library" : "The selected image" + (count === 1 ? "" : "s")} will leave the active library. You can restore ${count === 1 && !all ? "it" : "them"} from Deleted.`,
      actionLabel: all ? "Delete all" : "Move to Deleted",
      onConfirm: () => { void runMediaAction("delete", { all }); },
    };
    if (askConfirm) askConfirm(confirmation);
    else confirmation.onConfirm();
  }

  function confirmDeleteForever(all) {
    const count = all ? counts.deleted : selectedCount;
    const confirmation = {
      title: all ? "Delete all images forever?" : `Delete ${count} image${count === 1 ? "" : "s"} forever?`,
      copy: `${all ? "Every image in Deleted" : "The selected image" + (count === 1 ? "" : "s")} and the stored file${count === 1 && !all ? "" : "s"} will be permanently removed. This cannot be undone.`,
      actionLabel: all ? "Empty Deleted" : "Delete forever",
      onConfirm: () => { void runMediaAction("permanent", { all }); },
    };
    if (askConfirm) askConfirm(confirmation);
    else confirmation.onConfirm();
  }

  async function uploadFile(file) {
    setDragging(false);
    setUploading(true);
    setError("");
    try {
      if (!uploadImage) throw new Error("Image uploads are not available right now.");
      const dataUrl = await readMarketingImageFile(file);
      const result = await uploadImage(dataUrl, file.name);
      const asset = normalizedAsset(result?.asset);
      if (!asset.id || !asset.url) throw new Error("The upload did not return a reusable image.");
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setCounts((current) => ({ ...current, active: current.active + 1 }));
      if (picker) setSelectedId(asset.id);
      else setSelectedIds(new Set([asset.id]));
      notify?.(`${asset.name} uploaded to Media.`);
    } catch (uploadError) {
      setError(uploadError?.message || "The image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  function chooseFiles(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadFile(file);
  }

  return (
    <div className={`marketing-media-library${picker ? " picker" : ""}`}>
      <input accept="image/jpeg,image/png,image/webp" hidden onChange={chooseFiles} ref={input} type="file" />
      {!picker ? (
        <nav aria-label="Media library sections" className="marketing-media-tabs">
          <button aria-current={status === "active" ? "page" : undefined} className={status === "active" ? "active" : ""} onClick={() => changeStatus("active")} type="button">Images <span>{counts.active.toLocaleString("en-PH")}</span></button>
          <button aria-current={status === "deleted" ? "page" : undefined} className={status === "deleted" ? "active" : ""} onClick={() => changeStatus("deleted")} type="button"><Trash2 size={14} aria-hidden="true" /> Deleted <span>{counts.deleted.toLocaleString("en-PH")}</span></button>
        </nav>
      ) : null}

      {(picker || status === "active") ? <>
        <div
          className={`marketing-media-drop${dragging ? " dragging" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadFile(file); }}
        >
          <span><Upload size={19} aria-hidden="true" /></span>
          <div><strong>{uploading ? "Uploading image…" : "Drop an image here"}</strong><small>JPG, PNG or WebP · maximum 3 MB</small></div>
          <button disabled={uploading} onClick={() => input.current?.click()} type="button">{uploading ? "Uploading…" : "Upload"}</button>
        </div>
        <p className="marketing-media-notice">Images in Marketing Media are public so email recipients can view them. Do not upload private client or treatment information.</p>
      </> : <div className="marketing-media-deleted-intro"><span><Trash2 size={18} aria-hidden="true" /></span><div><strong>Deleted images</strong><p>Restore images to use them again, or delete them forever when they are no longer needed.</p></div></div>}

      <div className="marketing-media-toolbar">
        <label><Search size={16} aria-hidden="true" /><input aria-label="Search media files" onChange={(event) => setQuery(event.target.value)} placeholder={status === "deleted" && !picker ? "Search deleted images" : "Search files"} type="search" value={query} /></label>
        <label className="marketing-media-sort"><span>Sort by</span><select aria-label="Sort media files" onChange={(event) => setSort(event.target.value)} value={sort}><option>Newest first</option><option>Oldest first</option><option>Smallest first</option><option>Largest first</option><option>A - Z</option><option>Z - A</option></select><ChevronDown size={14} aria-hidden="true" /></label>
        <div className="marketing-media-view" aria-label="Media view"><button aria-label="Grid view" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} type="button"><Grid2X2 size={16} /></button><button aria-label="List view" className={view === "list" ? "active" : ""} onClick={() => setView("list")} type="button"><List size={17} /></button></div>
      </div>

      {!picker ? (
        <div className="marketing-media-bulkbar">
          <button aria-pressed={allVisibleSelected} className="marketing-media-select-all" disabled={loading || !visibleAssets.length || Boolean(busy)} onClick={toggleAllVisible} type="button"><span>{allVisibleSelected ? <Check size={13} aria-hidden="true" /> : null}</span>{allVisibleSelected ? "Deselect all" : "Select all"}</button>
          <p>{selectedCount ? <><strong>{selectedCount.toLocaleString("en-PH")}</strong> selected</> : `${visibleAssets.length.toLocaleString("en-PH")} shown`}</p>
          <div>
            {status === "active" ? <>
              <button disabled={!selectedCount || Boolean(busy)} onClick={() => confirmMoveToDeleted(false)} type="button"><Trash2 size={14} aria-hidden="true" /> Delete selected</button>
              <button className="danger" disabled={!counts.active || Boolean(busy)} onClick={() => confirmMoveToDeleted(true)} type="button">Delete all</button>
            </> : <>
              <button disabled={!selectedCount || Boolean(busy)} onClick={() => { void runMediaAction("restore"); }} type="button"><RotateCcw size={14} aria-hidden="true" /> Restore selected</button>
              <button disabled={!counts.deleted || Boolean(busy)} onClick={() => { void runMediaAction("restore", { all: true }); }} type="button">Restore all</button>
              <button className="danger" disabled={!selectedCount || Boolean(busy)} onClick={() => confirmDeleteForever(false)} type="button"><Trash2 size={14} aria-hidden="true" /> Delete forever</button>
              <button className="danger solid" disabled={!counts.deleted || Boolean(busy)} onClick={() => confirmDeleteForever(true)} type="button">Empty Deleted</button>
            </>}
          </div>
        </div>
      ) : null}

      {error ? <div className="marketing-media-error" role="alert">{error}</div> : null}
      {loading ? <div className="marketing-media-loading"><i /><i /><i /><span>Loading uploaded images…</span></div> : visibleAssets.length ? (
        <div className={`marketing-media-items ${view}`}>
          {visibleAssets.map((asset) => (
            <button aria-label={`${selectedIds.has(asset.id) || asset.id === selectedId ? "Deselect" : "Select"} ${asset.name}`} aria-pressed={picker ? asset.id === selectedId : selectedIds.has(asset.id)} className={(picker ? asset.id === selectedId : selectedIds.has(asset.id)) ? "selected" : ""} key={asset.id} onClick={() => toggleSelection(asset.id)} type="button">
              <span className="marketing-media-thumb"><img src={asset.url} alt="" /><i className="marketing-media-selection">{(picker ? asset.id === selectedId : selectedIds.has(asset.id)) ? <Check size={15} aria-hidden="true" /> : null}</i>{asset.deletedAt ? <em>Deleted</em> : null}</span>
              <span className="marketing-media-meta"><strong title={asset.name}>{asset.name}</strong><small>{asset.deletedAt ? `Deleted ${mediaDate(asset.deletedAt)}` : `${mediaBytes(asset.byteSize)} · ${mediaDate(asset.createdAt)}`}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="marketing-media-empty"><span>{status === "deleted" && !picker ? <Trash2 size={23} /> : <ImageIcon size={23} />}</span><h3>{query ? "No files match your search" : status === "deleted" && !picker ? "No deleted images" : "Your Media library is empty"}</h3><p>{query ? "Try a different file name or clear the search." : status === "deleted" && !picker ? "Images you delete will stay here until you restore them or delete them forever." : "Upload images once, then reuse them in any Marketing campaign."}</p>{status === "active" || picker ? <button onClick={() => input.current?.click()} type="button">Upload image</button> : null}</div>
      )}

      {picker ? <footer className="marketing-media-picker-actions"><span>{selected ? <><strong>{selected.name}</strong><small>{mediaBytes(selected.byteSize)}</small></> : "Select an image to continue"}</span><div><button onClick={onCancel} type="button">Cancel</button><button className="marketing-primary-button" disabled={!selected} onClick={() => selected && onSelect?.(selected)} type="button">Insert image</button></div></footer> : null}
    </div>
  );
}

export function MarketingMediaPage(props) {
  return <MediaLibraryContent {...props} />;
}

export function MarketingMediaPicker({ initialSelectedUrl, loadMedia, notify, onClose, onSelect, uploadImage }) {
  const dialog = (
    <div className="marketing-media-dialog" role="dialog" aria-modal="true" aria-label="Content studio">
      <button aria-label="Close Content studio" className="marketing-media-backdrop" onClick={onClose} type="button" />
      <section>
        <header><div><span>Marketing</span><h2>Content studio</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={19} /></button></header>
        <nav aria-label="Media sources"><button className="active" type="button">Uploads</button></nav>
        <MediaLibraryContent initialSelectedUrl={initialSelectedUrl} loadMedia={loadMedia} notify={notify} onCancel={onClose} onSelect={onSelect} picker uploadImage={uploadImage} />
      </section>
    </div>
  );
  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.querySelector(".marketing-workspace") || document.body);
}

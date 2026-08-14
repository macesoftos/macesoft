import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Grid2X2,
  Image as ImageIcon,
  List,
  Search,
  Upload,
  X,
} from "lucide-react";

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

function MediaLibraryContent({ initialSelectedUrl = "", loadMedia, notify, onCancel, onSelect, picker = false, uploadImage }) {
  const input = useRef(null);
  const [assets, setAssets] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sort, setSort] = useState("Newest first");
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState("grid");

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setError("");
      try {
        if (!loadMedia) throw new Error("The media library is not available right now.");
        const result = await loadMedia();
        if (!active) return;
        const next = (Array.isArray(result?.assets) ? result.assets : []).map(normalizedAsset);
        setAssets(next);
        const existing = next.find((asset) => asset.url === initialSelectedUrl);
        if (existing) setSelectedId(existing.id);
      } catch (loadError) {
        if (active) setError(loadError?.message || "The media library could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    return () => { active = false; };
  }, [initialSelectedUrl, loadMedia]);

  const visibleAssets = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = search
      ? assets.filter((asset) => `${asset.name} ${asset.mimeType} ${asset.branch}`.toLowerCase().includes(search))
      : assets;
    return [...filtered].sort((left, right) => {
      if (sort === "Oldest first") return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
      if (sort === "A - Z") return left.name.localeCompare(right.name);
      if (sort === "Z - A") return right.name.localeCompare(left.name);
      if (sort === "Smallest first") return Number(left.byteSize || 0) - Number(right.byteSize || 0);
      if (sort === "Largest first") return Number(right.byteSize || 0) - Number(left.byteSize || 0);
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });
  }, [assets, query, sort]);

  const selected = assets.find((asset) => asset.id === selectedId) || null;

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
      setSelectedId(asset.id);
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

      <div className="marketing-media-toolbar">
        <label><Search size={16} aria-hidden="true" /><input aria-label="Search media files" onChange={(event) => setQuery(event.target.value)} placeholder="Search files" type="search" value={query} /></label>
        <label className="marketing-media-sort"><span>Sort by</span><select aria-label="Sort media files" onChange={(event) => setSort(event.target.value)} value={sort}><option>Newest first</option><option>Oldest first</option><option>Smallest first</option><option>Largest first</option><option>A - Z</option><option>Z - A</option></select><ChevronDown size={14} aria-hidden="true" /></label>
        <div className="marketing-media-view" aria-label="Media view"><button aria-label="Grid view" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} type="button"><Grid2X2 size={16} /></button><button aria-label="List view" className={view === "list" ? "active" : ""} onClick={() => setView("list")} type="button"><List size={17} /></button></div>
      </div>

      {error ? <div className="marketing-media-error" role="alert">{error}</div> : null}
      {loading ? <div className="marketing-media-loading"><i /><i /><i /><span>Loading uploaded images…</span></div> : visibleAssets.length ? (
        <div className={`marketing-media-items ${view}`}>
          {visibleAssets.map((asset) => (
            <button aria-pressed={asset.id === selectedId} className={asset.id === selectedId ? "selected" : ""} key={asset.id} onClick={() => setSelectedId(asset.id)} type="button">
              <span className="marketing-media-thumb"><img src={asset.url} alt="" />{asset.id === selectedId ? <i><Check size={15} /></i> : null}</span>
              <span className="marketing-media-meta"><strong title={asset.name}>{asset.name}</strong><small>{mediaBytes(asset.byteSize)} · {mediaDate(asset.createdAt)}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="marketing-media-empty"><span><ImageIcon size={23} /></span><h3>{query ? "No files match your search" : "Your Media library is empty"}</h3><p>{query ? "Try a different file name or clear the search." : "Upload images once, then reuse them in any Marketing campaign."}</p><button onClick={() => input.current?.click()} type="button">Upload image</button></div>
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

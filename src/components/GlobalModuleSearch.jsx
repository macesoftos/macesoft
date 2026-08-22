import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

const SEARCH_DELAY_MS = 300;

export default function GlobalModuleSearch({
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  getResults,
  onSelect,
}) {
  const [draft, setDraft] = useState(value || "");
  const [debouncedQuery, setDebouncedQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const listboxId = useId();

  useEffect(() => setDraft(value || ""), [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(draft);
      onChange(draft);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onChange]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const isLoading = draft.trim() !== debouncedQuery.trim();
  const searchState = useMemo(() => {
    if (disabled || !debouncedQuery.trim()) return { results: [], error: "" };
    try {
      return { results: getResults(debouncedQuery).slice(0, 8), error: "" };
    } catch {
      return { results: [], error: "Search is temporarily unavailable." };
    }
  }, [debouncedQuery, disabled, getResults]);
  const { error, results } = searchState;

  useEffect(() => setActiveIndex(results.length ? 0 : -1), [debouncedQuery, results.length]);

  function choose(result) {
    setOpen(false);
    setActiveIndex(-1);
    onSelect(result);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) setOpen(true);
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    }
    if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  const showPanel = open && Boolean(draft.trim()) && !disabled;

  return (
    <div className="global-module-search" ref={rootRef}>
      <div className={`search-box global-module-search-input ${disabled ? "is-disabled" : ""}`}>
        {isLoading ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
        <input
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={showPanel ? listboxId : undefined}
          aria-expanded={showPanel}
          aria-label={label}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          role="combobox"
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(Boolean(event.target.value.trim()));
          }}
          onFocus={() => draft.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {draft && !disabled && (
          <button className="global-module-search-clear" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { setDraft(""); setDebouncedQuery(""); onChange(""); setOpen(false); }}>
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="global-module-search-panel" id={listboxId} role="listbox" aria-label={`${label} results`}>
          {isLoading ? (
            <div className="global-module-search-state"><LoaderCircle className="spin" size={17} /> Searching…</div>
          ) : error ? (
            <div className="global-module-search-state is-error">{error}</div>
          ) : results.length ? results.map((result, index) => (
            <button
              className={`global-module-search-result ${index === activeIndex ? "is-active" : ""}`}
              id={`${listboxId}-${index}`}
              key={`${result.kind}-${result.id}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(result)}
            >
              <span className="global-module-search-result-kind">{result.kind}</span>
              <span className="global-module-search-result-copy">
                <strong>{result.title}</strong>
                <small>{result.subtitle || "Open record"}</small>
              </span>
              {result.meta && <span className="global-module-search-result-meta">{result.meta}</span>}
            </button>
          )) : (
            <div className="global-module-search-state">No results in this section.</div>
          )}
        </div>
      )}
    </div>
  );
}

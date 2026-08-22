import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  Building2,
  CalendarPlus,
  DoorOpen,
  Download,
  HeartPulse,
  Inbox,
  MailPlus,
  Megaphone,
  PackagePlus,
  Plus,
  ReceiptText,
  Sparkles,
  UserPlus,
  UserRoundPlus,
  Upload,
} from "lucide-react";

const actionIcons = {
  appointment: CalendarPlus,
  branch: Building2,
  campaign: Megaphone,
  client: UserPlus,
  email: MailPlus,
  expense: ReceiptText,
  inventory: Boxes,
  "inventory-receive": PackagePlus,
  import: Upload,
  export: Download,
  lead: Inbox,
  package: PackagePlus,
  room: DoorOpen,
  service: Sparkles,
  staff: UserRoundPlus,
  treatment: HeartPulse,
};

export default function GlobalCreateMenu({ actions, onSelect }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    setOpen(false);
  }, [actions]);

  useEffect(() => {
    if (!open) return undefined;

    const focusTimer = window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
    const closeOnPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!actions.length) return null;

  function moveFocus(event) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = actions.length - 1;
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowUp"
          ? currentIndex <= 0 ? lastIndex : currentIndex - 1
          : currentIndex >= lastIndex ? 0 : currentIndex + 1;
    itemRefs.current[nextIndex]?.focus();
  }

  function selectAction(action) {
    setOpen(false);
    onSelect(action);
  }

  return (
    <div className="global-create-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        className="global-create-trigger"
        type="button"
        aria-label="Create new"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Create new"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Plus size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="global-create-dropdown" role="menu" aria-label="Create new" onKeyDown={moveFocus}>
          {actions.map((action, index) => {
            const Icon = actionIcons[action.icon] ?? Plus;
            return (
              <button
                key={action.id}
                ref={(element) => { itemRefs.current[index] = element; }}
                type="button"
                role="menuitem"
                onClick={() => selectAction(action)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

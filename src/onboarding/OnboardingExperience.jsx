import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  Compass,
  ListChecks,
  Minimize2,
  RotateCcw,
  X,
} from "lucide-react";
import {
  apiWorkspaceMutatedEvent,
  loadOnboarding,
  updateOnboarding,
} from "../lib/api.js";

const moduleStepCopy = {
  appointments: ["Manage your schedule", "View upcoming appointments, assign staff, select services, and monitor appointment status."],
  clients: ["Build your client database", "Store client information, treatment history, appointments, notes, and communication records securely."],
  pos: ["Record sales and payments", "Process services and products, apply discounts, and create receipts from the POS."],
  "staff-view": ["Review your team schedule", "See staff availability and working schedules for the active branch."],
  staff: ["Manage your team", "Review the staff members and access controls available to your role."],
  "facetrack-attendance": ["Attendance and FaceTrack", "Open the attendance tools available to you and review your clocking activity."],
  inventory: ["Monitor inventory", "Review available stock, low-stock alerts, and inventory movements for your branch."],
  reports: ["Understand performance", "Open the reports permitted for your role and filter results for your branch."],
  branches: ["Manage your branch", "Review the branch settings and operating details you are authorized to change."],
};

function navStep(moduleId) {
  const [title, description] = moduleStepCopy[moduleId];
  return {
    id: `module-${moduleId}`,
    title,
    description,
    moduleId,
    target: `[data-tour="nav-${moduleId}"]`,
    actionLabel: "Take me there",
  };
}

export function tourStepsFor({ roleKind = "staff", modules = [] } = {}) {
  const allowed = new Set(modules);
  const steps = [];
  if (allowed.has("overview")) {
    steps.push({
      id: "dashboard",
      title: "Your business at a glance",
      description: "See today’s appointments, sales, clients, and important business updates from your dashboard.",
      target: "[data-tour=\"dashboard\"]",
    });
  }
  if (modules.length > 1) {
    steps.push({
      id: "navigation",
      title: "Access your business tools",
      description: "Use the navigation to open only the ZenshoTech modules available to your role.",
      target: "[data-tour=\"main-navigation\"]",
    });
  }

  if (roleKind === "owner" && allowed.has("overview")) {
    steps.push({
      id: "quick-actions",
      title: "Start common tasks quickly",
      description: "Create an appointment, add a client, record a sale, or begin another common task from Quick Actions.",
      target: "[data-tour=\"quick-actions\"]",
    });
    ["appointments", "clients", "pos"].filter((moduleId) => allowed.has(moduleId)).forEach((moduleId) => steps.push(navStep(moduleId)));
    steps.push({
      id: "getting-started",
      title: "Complete your workspace setup",
      description: "Follow this checklist to configure your business before inviting the rest of your team.",
      target: "[data-tour=\"getting-started\"]",
    });
  } else if (roleKind === "manager") {
    ["appointments", "clients", "staff-view", "staff", "inventory", "reports", "branches", "pos", "facetrack-attendance"]
      .filter((moduleId) => allowed.has(moduleId))
      .slice(0, 5)
      .forEach((moduleId) => steps.push(navStep(moduleId)));
  } else {
    ["staff-view", "appointments", "clients", "facetrack-attendance", "pos"]
      .filter((moduleId) => allowed.has(moduleId))
      .slice(0, 4)
      .forEach((moduleId) => steps.push(navStep(moduleId)));
  }

  steps.push({
    id: "complete",
    title: "You’re ready to begin",
    description: "You can restart this tour anytime from Getting Started, your account menu, or Help and Support.",
    final: true,
  });
  return steps;
}

export function useOnboardingController({
  activeModule,
  blocked = false,
  isReady = false,
  onNavigate,
  onRevealModule,
  session,
} = {}) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const refreshTimerRef = useRef(0);
  const mutationVersionRef = useRef(0);

  const steps = useMemo(() => tourStepsFor({ roleKind: payload?.roleKind, modules: payload?.modules || [] }), [payload?.modules, payload?.roleKind]);
  const currentStep = Math.min(Number(payload?.state?.currentStep || 0), Math.max(0, steps.length - 1));

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!session?.id) return null;
    const mutationVersion = mutationVersionRef.current;
    if (!quiet) setLoading(true);
    try {
      const next = await loadOnboarding();
      if (mutationVersion === mutationVersionRef.current) {
        setPayload(next);
        setError("");
      }
      return next;
    } catch (refreshError) {
      setError(refreshError.message || "Getting Started is temporarily unavailable.");
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    setPayload(null);
    setWelcomeOpen(false);
    setTourActive(false);
    if (session?.id) void refresh();
  }, [refresh, session?.id]);

  useEffect(() => {
    if (!payload || !isReady || blocked) return;
    if (!payload.state || !Array.isArray(payload.modules)) {
      setWelcomeOpen(false);
      setTourActive(false);
      return;
    }
    const state = payload.state;
    if (!state.startedAt && !state.completedAt && !state.dismissedAt) {
      const hasDashboard = payload.modules.includes("overview");
      const pathIsDashboard = typeof window === "undefined"
        || ["/dashboard", "/my-workspace"].includes(window.location.pathname);
      setWelcomeOpen(!hasDashboard || (pathIsDashboard && activeModule === "overview"));
      return;
    }
    if (state.startedAt && !state.completedAt && !state.dismissedAt) setTourActive(true);
  }, [activeModule, blocked, isReady, payload]);

  useEffect(() => {
    if (!session?.id || typeof window === "undefined") return undefined;
    const handleMutation = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => void refresh({ quiet: true }), 350);
    };
    const handleFocus = () => void refresh({ quiet: true });
    window.addEventListener(apiWorkspaceMutatedEvent, handleMutation);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener(apiWorkspaceMutatedEvent, handleMutation);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh, session?.id]);

  const persist = useCallback(async (update) => {
    mutationVersionRef.current += 1;
    try {
      const next = await updateOnboarding(update);
      setPayload(next);
      setError("");
      return next;
    } catch (persistError) {
      setError(persistError.message || "Onboarding progress could not be saved.");
      return null;
    }
  }, []);

  const startTour = useCallback(async ({ restart = false } = {}) => {
    const next = await persist({ action: restart ? "restart" : "start" });
    if (!next) return;
    setWelcomeOpen(false);
    setTourActive(true);
    onNavigate?.(next.modules?.includes("overview") ? "overview" : activeModule);
  }, [activeModule, onNavigate, persist]);

  const dismissTour = useCallback(async () => {
    await persist({ action: "dismiss", currentStep });
    setWelcomeOpen(false);
    setTourActive(false);
  }, [currentStep, persist]);

  const goToStep = useCallback(async (step) => {
    const bounded = Math.max(0, Math.min(steps.length - 1, step));
    await persist({ action: "progress", currentStep: bounded });
  }, [persist, steps.length]);

  const completeTour = useCallback(async ({ openChecklist = false } = {}) => {
    await persist({ action: "complete", currentStep: Math.max(0, steps.length - 1) });
    setTourActive(false);
    if (openChecklist) {
      await persist({ action: "open-checklist" });
      if (payload?.modules?.includes("overview")) onNavigate?.("overview");
    }
  }, [onNavigate, payload?.modules, persist, steps.length]);

  const updateChecklist = useCallback((action) => persist({ action }), [persist]);
  const openChecklist = useCallback(async () => {
    await updateChecklist("open-checklist");
    if (payload?.modules?.includes("overview")) onNavigate?.("overview");
  }, [onNavigate, payload?.modules, updateChecklist]);
  const goToChecklistItem = useCallback(async (moduleId) => {
    await updateChecklist("open-checklist");
    onNavigate?.(moduleId);
  }, [onNavigate, updateChecklist]);

  return {
    activeModule,
    completeTour,
    currentStep,
    dismissTour,
    error,
    goToChecklistItem,
    goToStep,
    loading,
    onNavigate,
    onRevealModule,
    openChecklist,
    payload,
    refresh,
    startTour,
    steps,
    tourActive: tourActive && !blocked,
    updateChecklist,
    welcomeOpen: welcomeOpen && !blocked,
  };
}

function visibleTarget(selector) {
  if (!selector || typeof document === "undefined") return null;
  return [...document.querySelectorAll(selector)].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) || null;
}

function targetRect(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const padding = 7;
  return {
    left: Math.max(6, rect.left - padding),
    top: Math.max(6, rect.top - padding),
    width: Math.min(window.innerWidth - 12, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 12, rect.height + padding * 2),
  };
}

function focusableElements(container) {
  return [...container.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
    .filter((element) => !element.hasAttribute("hidden"));
}

export function OnboardingExperience({ controller }) {
  const [highlight, setHighlight] = useState(null);
  const tooltipRef = useRef(null);
  const priorFocusRef = useRef(null);
  const {
    currentStep,
    dismissTour,
    goToStep,
    onRevealModule,
    steps,
    tourActive,
  } = controller;
  const step = steps[currentStep];

  useEffect(() => {
    if (!tourActive || !step || step.final || !step.target) {
      setHighlight(null);
      return undefined;
    }
    let cancelled = false;
    let timeoutId = 0;
    let attempts = 0;
    let target = null;
    let resizeObserver = null;

    onRevealModule?.(step.moduleId);

    const update = () => {
      if (cancelled) return;
      target = visibleTarget(step.target);
      if (!target) {
        attempts += 1;
        if (attempts >= 40) {
          void goToStep(currentStep + 1);
          return;
        }
        timeoutId = window.setTimeout(update, 100);
        return;
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      window.requestAnimationFrame(() => setHighlight(targetRect(target)));
      resizeObserver = new ResizeObserver(() => setHighlight(targetRect(target)));
      resizeObserver.observe(target);
    };
    const recalculate = () => target && setHighlight(targetRect(target));
    update();
    window.addEventListener("resize", recalculate);
    window.addEventListener("orientationchange", recalculate);
    document.addEventListener("scroll", recalculate, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("orientationchange", recalculate);
      document.removeEventListener("scroll", recalculate, true);
    };
  }, [currentStep, goToStep, onRevealModule, step, tourActive]);

  useEffect(() => {
    if (!tourActive || !tooltipRef.current) return undefined;
    priorFocusRef.current = document.activeElement;
    tooltipRef.current.focus();
    const tooltip = tooltipRef.current;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void dismissTour();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements(tooltip);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    tooltip.addEventListener("keydown", handleKeyDown);
    return () => {
      tooltip.removeEventListener("keydown", handleKeyDown);
      priorFocusRef.current?.focus?.();
    };
  }, [currentStep, dismissTour, tourActive]);

  if (typeof document === "undefined") return null;
  const showWelcome = controller.welcomeOpen;
  const showTour = tourActive && step;
  const placeAbove = Boolean(
    highlight
    && highlight.top > 330
    && highlight.top + highlight.height > window.innerHeight * 0.62,
  );
  if (!showWelcome && !showTour) return null;

  return createPortal(
    <>
      {showWelcome && (
        <div className="onboarding-welcome-backdrop" data-testid="onboarding-welcome">
          <section aria-labelledby="onboarding-welcome-title" aria-modal="true" className="onboarding-welcome-dialog" role="dialog">
            <span className="onboarding-welcome-icon" aria-hidden="true"><Compass size={28} /></span>
            <p className="eyebrow">Getting started</p>
            <h2 id="onboarding-welcome-title">Welcome to ZenshoTech</h2>
            <p>Let’s get your workspace ready. Take a quick tour to learn where everything is and what to set up first.</p>
            {controller.error && <p className="onboarding-error" role="alert">{controller.error}</p>}
            <div className="onboarding-welcome-actions">
              <button className="primary-button" type="button" onClick={() => void controller.startTour()} disabled={controller.loading}>Start quick tour</button>
              <button className="secondary-button" type="button" onClick={() => void controller.dismissTour()}>Explore on my own</button>
            </div>
          </section>
        </div>
      )}
      {showTour && (
        <div className="onboarding-tour-layer" data-testid="onboarding-tour">
          {highlight && !step.final && <div aria-hidden="true" className="onboarding-spotlight" style={highlight} />}
          <section
            aria-describedby="onboarding-tour-description"
            aria-labelledby="onboarding-tour-title"
            className={`onboarding-tooltip ${step.final ? "is-final" : ""} ${placeAbove ? "is-above" : "is-below"}`}
            ref={tooltipRef}
            role="dialog"
            tabIndex={-1}
            style={!step.final && highlight ? { "--tour-target-top": `${highlight.top}px`, "--tour-target-bottom": `${highlight.top + highlight.height}px`, "--tour-target-left": `${highlight.left}px`, "--tour-target-width": `${highlight.width}px` } : undefined}
          >
            <header>
              <span>Step {controller.currentStep + 1} of {controller.steps.length}</span>
              <button aria-label="Close and pause tour" type="button" onClick={() => void controller.dismissTour()}><X size={18} /></button>
            </header>
            <h2 id="onboarding-tour-title">{step.title}</h2>
            <p id="onboarding-tour-description">{step.description}</p>
            {controller.error && <p className="onboarding-error" role="alert">{controller.error}</p>}
            {step.final ? (
              <footer className="onboarding-final-actions">
                {controller.payload?.modules?.includes("overview") && <button className="secondary-button" type="button" onClick={() => void controller.completeTour({ openChecklist: true })}><ListChecks size={17} /> Open Getting Started</button>}
                <button className="primary-button" type="button" onClick={() => void controller.completeTour()}>Finish tour</button>
              </footer>
            ) : (
              <>
                {step.actionLabel && step.moduleId && <button className="onboarding-take-me" type="button" onClick={() => controller.onNavigate?.(step.moduleId)}>{step.actionLabel} <ChevronRight size={16} /></button>}
                <footer>
                  <button className="onboarding-skip" type="button" onClick={() => void controller.dismissTour()}>Skip tour</button>
                  <span />
                  <button className="secondary-button" type="button" disabled={controller.currentStep === 0} onClick={() => void controller.goToStep(controller.currentStep - 1)}>Previous</button>
                  <button className="primary-button" type="button" onClick={() => void controller.goToStep(controller.currentStep + 1)}>Next</button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </>,
    document.body,
  );
}

export function GettingStartedChecklist({ controller }) {
  const [expanded, setExpanded] = useState(false);
  const payload = controller?.payload;
  const state = payload?.state;
  const checklist = payload?.checklist;
  if (!payload || !checklist || state?.checklistHiddenAt) return null;

  if (state.checklistMinimized) {
    return (
      <section className="getting-started-card is-minimized" data-tour="getting-started" aria-label="Getting Started checklist" role="region">
        <div><ListChecks size={20} aria-hidden="true" /><span><strong>Getting Started</strong><small>{checklist.completed} of {checklist.total} completed — {checklist.percentage}%</small></span></div>
        <button type="button" onClick={() => void controller.updateChecklist("open-checklist")}><ChevronDown size={18} /> Expand</button>
      </section>
    );
  }

  const incompleteItems = checklist.items.filter((item) => !item.complete);
  const collapsedItems = (incompleteItems.length ? incompleteItems : checklist.items).slice(0, 4);
  const displayedItems = expanded ? checklist.items : collapsedItems;

  return (
    <section className="getting-started-card" data-tour="getting-started" aria-label="Getting Started checklist" role="region">
      <header>
        <div>
          <span className="getting-started-icon" aria-hidden="true"><ListChecks size={21} /></span>
          <span><h2 id="getting-started-title">Getting Started</h2><p>Complete these steps to prepare your ZenshoTech workspace.</p></span>
        </div>
        <button aria-label="Minimize Getting Started checklist" type="button" onClick={() => void controller.updateChecklist("minimize-checklist")}><Minimize2 size={18} /></button>
      </header>
      <div className="getting-started-progress-copy"><strong>{checklist.completed} of {checklist.total} completed — {checklist.percentage}%</strong><span>{checklist.allComplete ? "Workspace setup complete" : "Your progress is saved automatically"}</span></div>
      <div aria-label={`${checklist.percentage}% complete`} aria-valuemax="100" aria-valuemin="0" aria-valuenow={checklist.percentage} className="getting-started-progress" role="progressbar"><span style={{ width: `${checklist.percentage}%` }} /></div>
      {checklist.allComplete ? (
        <div className="getting-started-success"><Check size={20} /><span><strong>Your workspace is ready</strong><small>You can reopen this checklist from Help and Support anytime.</small></span><button type="button" onClick={() => void controller.updateChecklist("hide-checklist")}>Hide checklist</button></div>
      ) : (
        <div className="getting-started-list">
          {displayedItems.map((item) => (
            <button className={item.complete ? "is-complete" : ""} key={item.id} type="button" onClick={() => void controller.goToChecklistItem(item.moduleId)}>
              <span className="getting-started-status-icon" aria-hidden="true">{item.complete ? <Check size={16} /> : item.status === "In progress" ? <Clock3 size={16} /> : <Circle size={16} />}</span>
              <span><strong>{item.title}</strong><small>{item.description}</small></span>
              <span className={`getting-started-status ${item.status.toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
          {checklist.items.length > collapsedItems.length && (
            <button className="getting-started-expand" type="button" onClick={() => setExpanded((current) => !current)}>
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              {expanded ? "Show fewer steps" : `View all ${checklist.items.length} steps`}
            </button>
          )}
        </div>
      )}
      <footer>
        {state.completedAt || state.dismissedAt ? <button type="button" onClick={() => void controller.startTour({ restart: true })}><RotateCcw size={16} /> Restart dashboard tour</button> : state.startedAt ? <button type="button" onClick={() => void controller.startTour()}><Compass size={16} /> Resume quick tour</button> : null}
        {controller.error && <span role="alert">{controller.error}</span>}
      </footer>
    </section>
  );
}

export function OnboardingHelpControls({ controller }) {
  return (
    <div className="onboarding-help-controls">
      <button type="button" onClick={() => void controller.startTour({ restart: true })}><RotateCcw size={18} /><span><strong>Restart dashboard tour</strong><small>Review the controls available to your role.</small></span><ChevronRight size={17} /></button>
      <button type="button" onClick={() => void controller.openChecklist()}><ListChecks size={18} /><span><strong>Open Getting Started checklist</strong><small>Continue your workspace setup tasks.</small></span><ChevronRight size={17} /></button>
    </div>
  );
}

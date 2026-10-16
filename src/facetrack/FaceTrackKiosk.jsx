import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, TabletSmartphone, UserCheck } from "lucide-react";
import {
  createFaceTrackKiosk,
  createFaceTrackKioskChallenge,
  createFaceTrackScannerChallenge,
  loadFaceTrackKioskStatus,
  loadFaceTrackScannerStatus,
  recordFaceTrackKioskAttendance,
  recordFaceTrackScannerAttendance,
  reportFaceTrackScannerDiagnostic,
  reportFaceTrackKioskDiagnostic,
  unlockFaceTrackKiosk,
} from "../lib/api.js";
import { captureFaceSamples, loadFaceRecognitionModels } from "./faceCapture.js";
import { ORGANIZATION_MANAGER_ROLES } from "../organizationRoles.js";
import "./facetrack-kiosk.css";

const ADMIN_ROLES = new Set([...ORGANIZATION_MANAGER_ROLES, "Admin", "Branch Manager"]);

function displayTime(value) {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(value);
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(value);
}

function scanFailureCode(error, stage) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("more than one person")) return "MULTIPLE_FACES";
  if (message.includes("turn your head") || message.includes("live movement")) return "LIVENESS";
  if (message.includes("ambiguous")) return "AMBIGUOUS_MATCH";
  if (message.includes("face not recognized")) return "NO_MATCH";
  if (message.includes("please wait") || message.includes("already complete")) return "ATTENDANCE_STATE";
  if (message.includes("network") || message.includes("fetch")) return "NETWORK";
  if (stage === "camera") return "CAMERA";
  if (stage === "capture") return "FACE_QUALITY";
  return "OTHER";
}

export default function FaceTrackKiosk({ session }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiRef = useRef(null);
  const resetTimerRef = useRef(0);
  const scannerModeRef = useRef("kiosk");
  const [device, setDevice] = useState(null);
  const [scannerMode, setScannerMode] = useState("kiosk");
  const [enrolledEmployees, setEnrolledEmployees] = useState(0);
  const [view, setView] = useState("loading");
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState("Tap Start camera to begin.");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(new Date());
  const [setup, setSetup] = useState({ name: "Clinic entrance iPad", branch: session?.branch === "All branches" ? "" : session?.branch || "", pin: "" });
  const [saving, setSaving] = useState(false);
  const kioskBranches = session?.access?.scope === "all"
    ? session?.access?.branches || []
    : [session?.access?.activeBranch].filter(Boolean);
  const availableBranches = kioskBranches
    .filter((branch) => branch.branchStatus === "Active")
    .map((branch) => ({ id: branch.id, name: branch.name }));
  const scannerBranch = setup.branch || session?.access?.activeBranch?.name || session?.branch || "";
  const canUseAccountScanner = Boolean(session && (
    session.access?.modules?.includes("facetrack-attendance")
    || ADMIN_ROLES.has(session.role)
  ));

  useEffect(() => { scannerModeRef.current = scannerMode; }, [scannerMode]);

  useEffect(() => {
    if (!setup.branch && availableBranches.length) {
      setSetup((current) => ({ ...current, branch: availableBranches[0].name }));
    }
  }, [availableBranches, setup.branch]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadScanner() {
      try {
        const payload = await loadFaceTrackKioskStatus();
        if (cancelled) return;
        setScannerMode("kiosk");
        setDevice(payload.device);
        setEnrolledEmployees(payload.enrolledEmployees || 0);
        setView("ready");
      } catch {
        if (cancelled) return;
        if (canUseAccountScanner && scannerBranch) {
          try {
            const payload = await loadFaceTrackScannerStatus(scannerBranch);
            if (cancelled) return;
            setScannerMode("account");
            setDevice(payload.device);
            setEnrolledEmployees(payload.enrolledEmployees || 0);
            setView("ready");
            return;
          } catch {
            // Fall through to the existing kiosk setup screen when account access is unavailable.
          }
        }
        if (!cancelled) setView("setup");
      }
    }
    void loadScanner();
    return () => { cancelled = true; };
  }, [canUseAccountScanner, scannerBranch]);

  useEffect(() => () => {
    window.clearTimeout(resetTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = useCallback(async () => {
    const startedAt = performance.now();
    setError("");
    setPhase("Loading secure face-recognition models...");
    try {
      const faceapi = await loadFaceRecognitionModels();
      faceApiRef.current = faceapi;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setPhase("Center one face in the oval, then tap Verify face.");
    } catch (nextError) {
      setError(nextError?.name === "NotAllowedError" ? "Camera access was denied. Allow camera access in your browser settings and try again." : "The camera or face-recognition models could not be started.");
      setPhase("Camera unavailable");
      const reportFailure = scannerModeRef.current === "account" ? reportFaceTrackScannerDiagnostic : reportFaceTrackKioskDiagnostic;
      void reportFailure({ outcome: "FAILURE", failureStage: "camera", failureCode: scanFailureCode(nextError, "camera"), elapsedMs: performance.now() - startedAt }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (view === "ready" && !cameraReady) void startCamera();
  }, [cameraReady, startCamera, view]);

  async function captureSamples() {
    if (!faceApiRef.current) throw new Error("Face-recognition models are not ready yet.");
    return captureFaceSamples(faceApiRef.current, videoRef.current, setPhase);
  }

  async function verifyFace() {
    const startedAt = performance.now();
    let stage = "challenge";
    const reportDiagnostic = scannerMode === "account" ? reportFaceTrackScannerDiagnostic : reportFaceTrackKioskDiagnostic;
    setView("scanning");
    setError("");
    try {
      const challenge = scannerMode === "account"
        ? await createFaceTrackScannerChallenge(device.branch)
        : await createFaceTrackKioskChallenge();
      stage = "capture";
      const descriptors = await captureSamples();
      setPhase("Recognizing employee and recording attendance...");
      stage = "match";
      const recordAttendance = scannerMode === "account"
        ? recordFaceTrackScannerAttendance
        : recordFaceTrackKioskAttendance;
      const payload = await recordAttendance({
        descriptors,
        challengeId: challenge.challengeId,
        idempotencyKey: crypto.randomUUID(),
        ...(scannerMode === "account" ? { branch: device.branch } : {}),
      });
      setResult(payload);
      setView("success");
      setPhase(payload.action === "TIME_IN" ? "Time In recorded" : "Time Out recorded");
      void reportDiagnostic({ outcome: "SUCCESS", elapsedMs: performance.now() - startedAt }).catch(() => {});
      resetTimerRef.current = window.setTimeout(() => {
        setResult(null);
        setError("");
        setPhase("Center one face in the oval, then tap Verify face.");
        setView("ready");
      }, 4500);
    } catch (nextError) {
      setError(nextError.message || "Face verification failed.");
      setPhase("Please reposition and try again.");
      setView("ready");
      void reportDiagnostic({ outcome: "FAILURE", failureStage: stage, failureCode: scanFailureCode(nextError, stage), elapsedMs: performance.now() - startedAt }).catch(() => {});
    }
  }

  async function registerKiosk(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = await createFaceTrackKiosk(setup);
      setDevice(payload.device);
      setView("ready");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSaving(false);
    }
  }

  async function exitKiosk() {
    if (scannerMode === "account") {
      window.location.assign("/attendance");
      return;
    }
    const pin = window.prompt("Enter the 6-digit administrator PIN to leave kiosk mode.", "");
    if (pin === null) return;
    try {
      await unlockFaceTrackKiosk(pin);
      window.location.assign("/attendance");
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  if (view === "loading") {
    return <main className="kiosk-loading"><TabletSmartphone /><strong>Opening clinic attendance kiosk...</strong></main>;
  }

  if (view === "setup") {
    const canSetUp = session && ADMIN_ROLES.has(session.role);
    return <main className="kiosk-setup-page"><section className="kiosk-setup-card"><span className="kiosk-logo"><TabletSmartphone /></span><p className="kiosk-kicker">FaceTrack shared iPad</p><h1>Set up clinic kiosk</h1><p>Register this iPad to one clinic branch. Employees will not need to sign in.</p>{canSetUp ? <form onSubmit={registerKiosk}><label><span>Device name</span><input required value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} /></label><label><span>Clinic branch</span><select required value={setup.branch} onChange={(event) => setSetup({ ...setup, branch: event.target.value })}><option value="" disabled>Select an authorized branch</option>{availableBranches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}</select></label><label><span>6-digit administrator PIN</span><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" type="password" value={setup.pin} onChange={(event) => setSetup({ ...setup, pin: event.target.value.replace(/\D/g, "") })} /></label>{error && <div className="kiosk-message error"><AlertCircle />{error}</div>}<button disabled={saving || !availableBranches.length} type="submit"><ShieldCheck />{saving ? "Registering iPad..." : "Register and open kiosk"}</button></form> : <div className="kiosk-setup-signin"><LockKeyhole /><p>An Admin, Business Owner, or Branch Manager must sign in before registering this iPad.</p><a href="/attendance">Go to administrator sign in</a></div>}<small>After setup, enable iPad Guided Access to keep this screen open.</small></section></main>;
  }

  return <main className={`facetrack-kiosk ${view}`}>
    <header className="kiosk-header"><div className="kiosk-device"><span><TabletSmartphone /></span><div><strong>{device?.name}</strong><small>{device?.branch} · {enrolledEmployees} enrolled</small></div></div><div className="kiosk-clock"><strong>{displayTime(now)}</strong><span>{displayDate(now)}</span></div><button type="button" onClick={exitKiosk}><LockKeyhole /> {scannerMode === "account" ? "Back" : "Admin"}</button></header>
    <section className="kiosk-body">
      <div className="kiosk-camera-card"><div className="kiosk-video-wrap"><video muted playsInline ref={videoRef} /><div className="kiosk-face-guide" />{!cameraReady && <div className="kiosk-camera-placeholder"><Camera /><strong>Camera is off</strong><span>Tap Start camera to allow access.</span></div>}{view === "scanning" && <div className="kiosk-scanning"><span /><strong>Checking live face</strong></div>}</div><p>{phase}</p></div>
      <aside className="kiosk-action-panel"><span className="kiosk-kicker">Face recognition attendance</span><h1>Time In / Time Out</h1><p>Stand in front of the camera. FaceTrack recognizes the employee without a name list. The first scan records Time In; the next scan records Time Out.</p><div className="kiosk-privacy"><ShieldCheck /><span>Live face template only. Raw camera images are not uploaded or stored.</span></div>{error && <div className="kiosk-message error"><AlertCircle />{error}</div>}{cameraReady ? <button className="kiosk-scan-button" disabled={view === "scanning"} type="button" onClick={verifyFace}><UserCheck />{view === "scanning" ? "Recognizing employee..." : "Recognize face — Time In / Out"}</button> : <button className="kiosk-scan-button" type="button" onClick={startCamera}><Camera />Start face scanner</button>}<small>No employee selection or manual attendance button is needed. Only employees enrolled for {device?.branch} can use this scanner.</small></aside>
    </section>
    {view === "success" && result && <section className="kiosk-success" aria-live="assertive"><span className="kiosk-success-icon"><CheckCircle2 /></span>{result.employee.photo ? <img src={result.employee.photo} alt="" /> : <span className="kiosk-result-avatar">{result.employee.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}<p>{result.employee.name}</p><h2>{result.action === "TIME_IN" ? "Time In recorded" : "Time Out recorded"}</h2><div><Clock3 /><strong>{displayTime(new Date(result.occurredAt))}</strong></div><small>{result.employee.branch} · Returning to scanner...</small></section>}
  </main>;
}

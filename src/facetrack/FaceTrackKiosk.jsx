import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Clock3, LockKeyhole, ShieldCheck, TabletSmartphone, UserCheck } from "lucide-react";
import {
  createFaceTrackKiosk,
  createFaceTrackKioskChallenge,
  loadFaceTrackKioskStatus,
  recordFaceTrackKioskAttendance,
  unlockFaceTrackKiosk,
} from "../lib/api.js";
import { ORGANIZATION_MANAGER_ROLES } from "../organizationRoles.js";
import "./facetrack-kiosk.css";

const MODEL_URL = "/facetrack-models";
const ADMIN_ROLES = new Set([...ORGANIZATION_MANAGER_ROLES, "Branch Manager"]);

function displayTime(value) {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(value);
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(value);
}

export default function FaceTrackKiosk({ session }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiRef = useRef(null);
  const resetTimerRef = useRef(0);
  const [device, setDevice] = useState(null);
  const [enrolledEmployees, setEnrolledEmployees] = useState(0);
  const [view, setView] = useState("loading");
  const [cameraReady, setCameraReady] = useState(false);
  const [phase, setPhase] = useState("Tap Start camera to begin.");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [now, setNow] = useState(new Date());
  const [setup, setSetup] = useState({ name: "Clinic entrance iPad", branch: session?.branch === "All branches" ? "" : session?.branch || "", pin: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadFaceTrackKioskStatus()
      .then((payload) => {
        if (cancelled) return;
        setDevice(payload.device);
        setEnrolledEmployees(payload.enrolledEmployees || 0);
        setView("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setView("setup");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    window.clearTimeout(resetTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCamera() {
    setError("");
    setPhase("Loading secure face-recognition models...");
    try {
      const faceapi = await import("face-api.js");
      faceApiRef.current = faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
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
      setError(nextError?.name === "NotAllowedError" ? "Camera access was denied. Allow camera access in Safari settings and try again." : "The camera or face-recognition models could not be started.");
      setPhase("Camera unavailable");
    }
  }

  async function captureSamples() {
    const faceapi = faceApiRef.current;
    const descriptors = [];
    const centers = [];
    const prompts = ["Look straight at the camera...", "Turn slightly left...", "Turn slightly right..."];
    for (let index = 0; index < prompts.length; index += 1) {
      setPhase(prompts[index]);
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      const match = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      if (!match) throw new Error("Keep one well-lit face fully visible inside the oval.");
      const box = match.detection.box;
      descriptors.push(Array.from(match.descriptor));
      centers.push(box.x + box.width / 2);
    }
    if (Math.max(...centers) - Math.min(...centers) < 3) throw new Error("Follow the left and right prompts so FaceTrack can confirm live movement.");
    return descriptors;
  }

  async function verifyFace() {
    setView("scanning");
    setError("");
    try {
      const challenge = await createFaceTrackKioskChallenge();
      const descriptors = await captureSamples();
      setPhase("Recognizing employee and recording attendance...");
      const payload = await recordFaceTrackKioskAttendance({
        descriptors,
        challengeId: challenge.challengeId,
        idempotencyKey: crypto.randomUUID(),
      });
      setResult(payload);
      setView("success");
      setPhase(payload.action === "TIME_IN" ? "Time In recorded" : "Time Out recorded");
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
    return <main className="kiosk-setup-page"><section className="kiosk-setup-card"><span className="kiosk-logo"><TabletSmartphone /></span><p className="kiosk-kicker">FaceTrack shared iPad</p><h1>Set up clinic kiosk</h1><p>Register this iPad to one clinic branch. Employees will not need to sign in.</p>{canSetUp ? <form onSubmit={registerKiosk}><label><span>Device name</span><input required value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} /></label><label><span>Clinic branch</span><input required value={setup.branch} onChange={(event) => setSetup({ ...setup, branch: event.target.value })} placeholder="Example: Mace Davao" /></label><label><span>6-digit administrator PIN</span><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" type="password" value={setup.pin} onChange={(event) => setSetup({ ...setup, pin: event.target.value.replace(/\D/g, "") })} /></label>{error && <div className="kiosk-message error"><AlertCircle />{error}</div>}<button disabled={saving} type="submit"><ShieldCheck />{saving ? "Registering iPad..." : "Register and open kiosk"}</button></form> : <div className="kiosk-setup-signin"><LockKeyhole /><p>An Admin, Business Owner, or Branch Manager must sign in before registering this iPad.</p><a href="/#/facetrack-attendance">Go to administrator sign in</a></div>}<small>After setup, enable iPad Guided Access to keep this screen open.</small></section></main>;
  }

  return <main className={`facetrack-kiosk ${view}`}>
    <header className="kiosk-header"><div className="kiosk-device"><span><TabletSmartphone /></span><div><strong>{device?.name}</strong><small>{device?.branch} · {enrolledEmployees} enrolled</small></div></div><div className="kiosk-clock"><strong>{displayTime(now)}</strong><span>{displayDate(now)}</span></div><button type="button" onClick={exitKiosk}><LockKeyhole /> Admin</button></header>
    <section className="kiosk-body">
      <div className="kiosk-camera-card"><div className="kiosk-video-wrap"><video muted playsInline ref={videoRef} /><div className="kiosk-face-guide" />{!cameraReady && <div className="kiosk-camera-placeholder"><Camera /><strong>Camera is off</strong><span>Tap Start camera to allow access.</span></div>}{view === "scanning" && <div className="kiosk-scanning"><span /><strong>Checking live face</strong></div>}</div><p>{phase}</p></div>
      <aside className="kiosk-action-panel"><span className="kiosk-kicker">Shared attendance</span><h1>Time In / Time Out</h1><p>Stand directly in front of the iPad. FaceTrack will recognize you and select the correct attendance action.</p><div className="kiosk-privacy"><ShieldCheck /><span>Live face template only. Raw camera images are not uploaded or stored.</span></div>{error && <div className="kiosk-message error"><AlertCircle />{error}</div>}{cameraReady ? <button className="kiosk-scan-button" disabled={view === "scanning"} type="button" onClick={verifyFace}><UserCheck />{view === "scanning" ? "Verifying..." : "Verify face"}</button> : <button className="kiosk-scan-button" type="button" onClick={startCamera}><Camera />Start camera</button>}<small>Only employees enrolled for {device?.branch} can use this kiosk.</small></aside>
    </section>
    {view === "success" && result && <section className="kiosk-success" aria-live="assertive"><span className="kiosk-success-icon"><CheckCircle2 /></span>{result.employee.photo ? <img src={result.employee.photo} alt="" /> : <span className="kiosk-result-avatar">{result.employee.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>}<p>{result.employee.name}</p><h2>{result.action === "TIME_IN" ? "Time In recorded" : "Time Out recorded"}</h2><div><Clock3 /><strong>{displayTime(new Date(result.occurredAt))}</strong></div><small>{result.employee.branch} · Returning to scanner...</small></section>}
  </main>;
}

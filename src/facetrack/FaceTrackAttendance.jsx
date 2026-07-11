import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, Clock, FilePenLine, RefreshCw, Settings, ShieldCheck, Timer, UserCheck, X } from "lucide-react";
import {
  createFaceTrackChallenge,
  enrollFaceTrackProfile,
  loadFaceTrackOverview,
  recordFaceTrackAttendance,
  reviewFaceTrackCorrection,
  reviewFaceTrackOvertime,
  saveFaceTrackPolicy,
  submitFaceTrackCorrection,
} from "../lib/api.js";
import "./facetrack-attendance.css";

const MODEL_URL = "/facetrack-models";

function dateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function duration(minutes) {
  const value = Number(minutes || 0);
  if (!value) return "0m";
  const hours = Math.floor(value / 60);
  return `${hours ? `${hours}h ` : ""}${value % 60}m`;
}

function localInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Status({ value }) {
  return <span className={`facetrack-status ${String(value).toLowerCase().replaceAll("_", "-")}`}>{String(value).replaceAll("_", " ")}</span>;
}

function CameraDialog({ mode, staffId, staffName, onClose, onComplete }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceApiRef = useRef(null);
  const [phase, setPhase] = useState("Loading secure face models…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const faceapi = await import("face-api.js");
        faceApiRef.current = faceapi;
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        setPhase("Allow camera access and center one face in the frame.");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 540 } }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!cancelled) setReady(true);
      } catch (nextError) {
        setError(nextError?.message?.includes("Permission") ? "Camera permission was denied. Allow camera access and try again." : "The camera or face-recognition models could not be started.");
      }
    }
    initialize();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function captureSamples() {
    const faceapi = faceApiRef.current;
    if (!faceapi) throw new Error("Face-recognition models are not ready yet.");
    const descriptors = [];
    const centers = [];
    for (let index = 0; index < 3; index += 1) {
      setPhase(index === 0 ? "Look straight at the camera…" : index === 1 ? "Turn your head slightly left…" : "Turn your head slightly right…");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const result = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      if (!result) throw new Error("Keep one well-lit face fully visible in the camera.");
      descriptors.push(Array.from(result.descriptor));
      centers.push(result.detection.box.x + result.detection.box.width / 2);
    }
    const movement = Math.max(...centers) - Math.min(...centers);
    if (movement < 3) throw new Error("Liveness check needs visible head movement. Follow the left and right prompts and try again.");
    return descriptors;
  }

  async function verify() {
    if (mode === "enroll" && !consent) return setError("Employee consent is required before biometric enrollment.");
    setBusy(true);
    setError("");
    try {
      const challenge = await createFaceTrackChallenge(mode === "enroll" ? "ENROLL" : "CLOCK");
      const descriptors = await captureSamples();
      setPhase("Verifying identity securely…");
      const result = mode === "enroll"
        ? await enrollFaceTrackProfile({ staffId, descriptors, challengeId: challenge.challengeId, consent: true })
        : await recordFaceTrackAttendance({ descriptors, challengeId: challenge.challengeId, idempotencyKey: crypto.randomUUID() });
      setPhase(mode === "enroll" ? "Face profile enrolled." : `${result.action === "TIME_IN" ? "Time In" : "Time Out"} recorded.`);
      window.setTimeout(() => onComplete(result), 500);
    } catch (nextError) {
      setError(nextError.message || "Face verification failed.");
      setPhase("Center your face and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="facetrack-dialog-backdrop" role="presentation">
      <section className="facetrack-camera-dialog" role="dialog" aria-modal="true" aria-label="Face verification">
        <header><div><span className="facetrack-kicker">{mode === "enroll" ? "Biometric enrollment" : "Attendance verification"}</span><h2>{staffName || "FaceTrack Attendance"}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
        <div className="facetrack-video-wrap">
          <video muted playsInline ref={videoRef} />
          <div className="facetrack-face-guide" aria-hidden="true" />
          {!ready && !error && <div className="facetrack-camera-loading"><RefreshCw className="spin" /> Loading</div>}
        </div>
        <p className="facetrack-camera-instruction">{phase}</p>
        {error && <div className="facetrack-error"><AlertCircle size={17} /> {error}</div>}
        {mode === "enroll" && <label className="facetrack-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I confirm that the employee understands and consents to encrypted face-template processing for attendance.</span></label>}
        <button className="facetrack-primary" disabled={!ready || busy} type="button" onClick={verify}><Camera size={18} /> {busy ? "Checking live face…" : mode === "enroll" ? "Enroll face profile" : "Verify and record time"}</button>
        <small>Raw camera images are processed on this device and are not uploaded or stored.</small>
      </section>
    </div>
  );
}

function CorrectionDialog({ record, onClose, onSaved }) {
  const [timeIn, setTimeIn] = useState(localInputValue(record.timeIn));
  const [timeOut, setTimeOut] = useState(localInputValue(record.timeOut));
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await submitFaceTrackCorrection({ attendanceRecordId: record.id, requestedTimeIn: timeIn ? new Date(timeIn).toISOString() : null, requestedTimeOut: timeOut ? new Date(timeOut).toISOString() : null, reason, attachmentUrl });
      onSaved();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="facetrack-dialog-backdrop"><form className="facetrack-form-dialog" onSubmit={submit}><header><div><span className="facetrack-kicker">Employee request</span><h2>Request time correction</h2></div><button type="button" onClick={onClose}><X /></button></header><p>The original attendance remains unchanged until an administrator approves this request.</p><div className="facetrack-form-grid"><label><span>Requested Time In</span><input type="datetime-local" value={timeIn} onChange={(event) => setTimeIn(event.target.value)} /></label><label><span>Requested Time Out</span><input type="datetime-local" value={timeOut} onChange={(event) => setTimeOut(event.target.value)} /></label><label className="wide"><span>Reason</span><textarea required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why the attendance record needs correction." /></label><label className="wide"><span>Supporting attachment link (optional)</span><input type="url" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="https://…" /></label></div>{error && <div className="facetrack-error"><AlertCircle size={17} /> {error}</div>}<button className="facetrack-primary" disabled={saving} type="submit"><FilePenLine size={18} /> {saving ? "Submitting…" : "Submit for admin approval"}</button></form></div>;
}

export default function FaceTrackAttendance({ session, notify, onExit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [camera, setCamera] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [policyDraft, setPolicyDraft] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await loadFaceTrackOverview();
      setData(result);
      setPolicyDraft(result.policy);
      setSelectedStaff((current) => current || result.staff?.[0]?.id || session.staffId || "");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const profileIds = useMemo(() => new Set(data?.profiles?.map((profile) => profile.staffId) || []), [data]);
  const myEnrolled = profileIds.has(session.staffId);
  const selectedPerson = data?.staff?.find((item) => item.id === selectedStaff);

  async function reviewRequest(request, decision) {
    const comment = window.prompt(decision === "APPROVE" ? "Approval comment (optional)" : "Reason for rejection (required)", "");
    if (comment === null || (decision === "REJECT" && !comment.trim())) return;
    try {
      await reviewFaceTrackCorrection(request.id, { decision, comment });
      notify(`Correction request ${decision === "APPROVE" ? "approved" : "rejected"}.`);
      refresh();
    } catch (nextError) { notify(nextError.message, "error"); }
  }

  async function reviewOvertime(record, status) {
    try {
      await reviewFaceTrackOvertime(record.id, { status, approvedMinutes: record.calculatedOvertimeMinutes });
      notify(`Overtime ${status.toLowerCase()}.`);
      refresh();
    } catch (nextError) { notify(nextError.message, "error"); }
  }

  async function savePolicy(event) {
    event.preventDefault();
    try {
      await saveFaceTrackPolicy(policyDraft);
      notify("FaceTrack policy saved.");
      refresh();
    } catch (nextError) { notify(nextError.message, "error"); }
  }

  if (loading && !data) return <div className="facetrack-loading"><RefreshCw className="spin" /> Loading FaceTrack Attendance…</div>;
  if (error && !data) return <div className="facetrack-error-page"><AlertCircle /><h2>FaceTrack Attendance unavailable</h2><p>{error}</p><button onClick={refresh} type="button">Try again</button></div>;

  const stats = data?.stats || {};
  const records = data?.records || [];
  const requests = data?.requests || [];
  const pendingRequests = requests.filter((item) => item.status === "PENDING").length;
  const navigation = [
    { id: "dashboard", label: "Dashboard", icon: CheckCircle2 },
    { id: "attendance", label: "Timesheets", icon: Clock },
    { id: "requests", label: "Corrections", icon: FilePenLine, count: pendingRequests },
    { id: "profiles", label: "Face profiles", icon: UserCheck },
    ...(data.admin ? [
      { id: "settings", label: "Policies", icon: Settings },
      { id: "audit", label: "Audit trail", icon: ShieldCheck },
    ] : []),
  ];
  const activeLabel = navigation.find((item) => item.id === tab)?.label || "Dashboard";

  return (
    <div className="facetrack-app-shell">
      <aside className="facetrack-module-sidebar" aria-label="FaceTrack menu">
        <div className="facetrack-module-brand">
          <span className="facetrack-module-logo"><Camera size={22} /></span>
          <div><strong>FaceTrack</strong><span>Attendance workspace</span></div>
        </div>
        <nav>
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)} type="button" aria-current={tab === item.id ? "page" : undefined}><Icon size={18} /><span>{item.label}</span>{item.count ? <b>{item.count}</b> : null}</button>;
          })}
        </nav>
        <div className="facetrack-module-account"><span>{session.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{session.name}</strong><small>{session.role}</small></div></div>
        <button className="facetrack-exit" type="button" onClick={onExit}><ArrowLeft size={17} /> Back to ClinicOS</button>
      </aside>

      <div className="facetrack-page">
        <header className="facetrack-workspace-header"><div><span>FaceTrack Attendance</span><h1>{activeLabel}</h1></div><button onClick={refresh} type="button"><RefreshCw className={loading ? "spin" : ""} size={18} /> Refresh</button></header>

        {tab === "dashboard" && <>
          <section className="facetrack-hero">
            <div><span className="facetrack-kicker"><ShieldCheck size={15} /> Verified attendance</span><h2>Accurate time, ready for payroll.</h2><p>Face-verified Time In and Time Out with automatic late, overtime, and approval tracking.</p></div>
            <div className="facetrack-hero-actions">
              {session.staffId && <button className="facetrack-primary light" disabled={!myEnrolled} onClick={() => setCamera({ mode: "clock", staffId: session.staffId, staffName: session.name })} type="button"><Camera /> {myEnrolled ? "Time In / Time Out" : "Enrollment required"}</button>}
              {session.staffId && !myEnrolled && <button className="facetrack-secondary light" onClick={() => setTab("profiles")} type="button"><UserCheck /> Set up face profile</button>}
            </div>
          </section>
          <section className="facetrack-stats">
            <article><UserCheck /><div><strong>{stats.clockedIn || 0}</strong><span>Clocked in</span></div></article>
            <article><CheckCircle2 /><div><strong>{stats.completedToday || 0}</strong><span>Completed today</span></div></article>
            <article><Clock /><div><strong>{stats.lateToday || 0}</strong><span>Late today</span></div></article>
            <article><FilePenLine /><div><strong>{stats.pendingCorrections || 0}</strong><span>Pending corrections</span></div></article>
            <article><Timer /><div><strong>{stats.pendingOvertime || 0}</strong><span>Pending overtime</span></div></article>
          </section>
          <section className="facetrack-dashboard-grid">
            <article><span className="facetrack-kicker">Today</span><h3>Live attendance</h3><strong>{stats.clockedIn || 0}</strong><p>employees currently clocked in</p><button onClick={() => setTab("attendance")} type="button">Open timesheets</button></article>
            <article><span className="facetrack-kicker">Approvals</span><h3>Needs attention</h3><strong>{(stats.pendingCorrections || 0) + (stats.pendingOvertime || 0)}</strong><p>correction or overtime items awaiting review</p><button onClick={() => setTab("requests")} type="button">Review requests</button></article>
          </section>
        </>}

        {tab === "profiles" && <>
          <section className="facetrack-section-intro"><span className="facetrack-kicker">Identity verification</span><h2>Employee face profiles</h2><p>Enroll only while the employee is physically present and has provided consent. Raw camera images stay on the device.</p></section>
          {data.admin ? <section className="facetrack-enrollment-panel"><div><span className="facetrack-kicker">Authorized enrollment</span><h2>Choose an employee</h2><p>Enroll a new profile or securely replace an existing one.</p></div><div className="facetrack-enroll-controls"><select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)}>{data.staff.map((person) => <option value={person.id} key={person.id}>{person.name} · {profileIds.has(person.id) ? "Enrolled" : "Not enrolled"}</option>)}</select><button className="facetrack-primary" disabled={!selectedPerson} onClick={() => setCamera({ mode: "enroll", staffId: selectedPerson.id, staffName: selectedPerson.name })} type="button"><Camera size={18} /> {profileIds.has(selectedStaff) ? "Re-enroll profile" : "Enroll profile"}</button></div></section> : session.staffId && <section className="facetrack-enrollment-panel"><div><span className="facetrack-kicker">My profile</span><h2>{myEnrolled ? "Face profile enrolled" : "Enrollment required"}</h2><p>{myEnrolled ? "Your profile is ready for verified Time In and Time Out." : "Complete enrollment before recording attendance."}</p></div>{!myEnrolled && <button className="facetrack-primary" onClick={() => setCamera({ mode: "enroll", staffId: session.staffId, staffName: session.name })} type="button"><Camera size={18} /> Enroll my face</button>}</section>}
          {data.admin && <section className="facetrack-profile-grid">{data.staff.map((person) => <article key={person.id}><span className="facetrack-profile-avatar">{person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{person.name}</strong><small>{person.branch}</small></div><Status value={profileIds.has(person.id) ? "ENROLLED" : "NOT_ENROLLED"} /></article>)}</section>}
        </>}

      {tab === "attendance" && <section className="facetrack-table-panel"><header><div><span className="facetrack-kicker">Audit-ready records</span><h2>Attendance history</h2></div><span>{records.length} records</span></header><div className="facetrack-table-scroll"><table><thead><tr><th>Employee / date</th><th>Time In</th><th>Time Out</th><th>Worked</th><th>Late</th><th>Overtime</th><th>Status</th><th>Action</th></tr></thead><tbody>{records.length ? records.map((record) => <tr key={record.id}><td><strong>{record.staffName || session.name}</strong><span>{record.workDate} · {record.branch}</span></td><td>{dateTime(record.timeIn)}</td><td>{dateTime(record.timeOut)}</td><td>{duration(record.workedMinutes)}</td><td className={record.lateMinutes ? "facetrack-warning-text" : ""}>{duration(record.lateMinutes)}</td><td><span>{duration(record.calculatedOvertimeMinutes)}</span><Status value={record.overtimeStatus} />{data.admin && record.overtimeStatus === "PENDING_APPROVAL" && <div className="facetrack-inline-actions"><button onClick={() => reviewOvertime(record, "APPROVED")} type="button">Approve</button><button onClick={() => reviewOvertime(record, "REJECTED")} type="button">Reject</button></div>}</td><td><Status value={record.status} /></td><td>{record.staffId === session.staffId && <button className="facetrack-link-button" disabled={record.correctionRequests?.some((item) => item.status === "PENDING")} onClick={() => setCorrection(record)} type="button">Request edit</button>}</td></tr>) : <tr><td className="facetrack-empty" colSpan="8">No FaceTrack attendance records yet.</td></tr>}</tbody></table></div></section>}

      {tab === "requests" && <section className="facetrack-request-grid">{requests.length ? requests.map((request) => <article key={request.id}><header><div><strong>{request.attendanceRecord?.staff?.name || session.name}</strong><span>{request.attendanceRecord?.workDate}</span></div><Status value={request.status} /></header><p>{request.reason}</p><dl><div><dt>Original</dt><dd>{dateTime(request.originalTimeIn)} → {dateTime(request.originalTimeOut)}</dd></div><div><dt>Requested</dt><dd>{dateTime(request.requestedTimeIn || request.originalTimeIn)} → {dateTime(request.requestedTimeOut || request.originalTimeOut)}</dd></div></dl>{request.adminComment && <blockquote>Admin: {request.adminComment}</blockquote>}{data.admin && request.status === "PENDING" && <footer><button className="facetrack-approve" onClick={() => reviewRequest(request, "APPROVE")} type="button">Approve and apply</button><button className="facetrack-reject" onClick={() => reviewRequest(request, "REJECT")} type="button">Reject</button></footer>}</article>) : <div className="facetrack-empty-card">No correction requests.</div>}</section>}

      {tab === "settings" && data.admin && policyDraft && <form className="facetrack-policy" onSubmit={savePolicy}><header><div><span className="facetrack-kicker">Configurable rules</span><h2>Attendance policy</h2></div><label className="facetrack-switch"><input type="checkbox" checked={policyDraft.enabled} onChange={(event) => setPolicyDraft({ ...policyDraft, enabled: event.target.checked })} /><span>Module enabled</span></label></header><div className="facetrack-form-grid"><label><span>Timezone</span><input value={policyDraft.timezone} onChange={(event) => setPolicyDraft({ ...policyDraft, timezone: event.target.value })} /></label><label><span>Late grace period (minutes)</span><input min="0" max="120" type="number" value={policyDraft.graceMinutes} onChange={(event) => setPolicyDraft({ ...policyDraft, graceMinutes: event.target.value })} /></label><label><span>Face-match threshold</span><input min="0.35" max="0.65" step="0.01" type="number" value={policyDraft.matchThreshold} onChange={(event) => setPolicyDraft({ ...policyDraft, matchThreshold: event.target.value })} /></label><label><span>Minimum overtime (minutes)</span><input min="0" max="240" type="number" value={policyDraft.overtimeMinimumMinutes} onChange={(event) => setPolicyDraft({ ...policyDraft, overtimeMinimumMinutes: event.target.value })} /></label><label><span>Biometric retention (days)</span><input min="30" max="3650" type="number" value={policyDraft.retentionDays} onChange={(event) => setPolicyDraft({ ...policyDraft, retentionDays: event.target.value })} /></label><label className="facetrack-consent"><input type="checkbox" checked={policyDraft.overtimeRequiresApproval} onChange={(event) => setPolicyDraft({ ...policyDraft, overtimeRequiresApproval: event.target.checked })} /><span>Overtime requires admin approval</span></label></div><button className="facetrack-primary" type="submit"><ShieldCheck size={18} /> Save policy</button></form>}

      {tab === "audit" && data.admin && <section className="facetrack-table-panel"><header><div><span className="facetrack-kicker">Append-only history</span><h2>FaceTrack audit trail</h2></div><span>{data.auditEntries?.length || 0} entries</span></header><div className="facetrack-table-scroll"><table><thead><tr><th>Date and time</th><th>Employee</th><th>Actor</th><th>Action</th><th>Reason / comment</th></tr></thead><tbody>{data.auditEntries?.length ? data.auditEntries.map((entry) => <tr key={entry.id}><td>{dateTime(entry.createdAt)}</td><td><strong>{entry.attendanceRecord?.staff?.name}</strong><span>{entry.attendanceRecord?.workDate}</span></td><td><strong>{entry.actorName}</strong><span>{entry.actorRole}</span></td><td>{entry.action.startsWith("CLOCK:") ? "FACE VERIFIED CLOCK EVENT" : entry.action.replaceAll("_", " ")}</td><td>{entry.reason || entry.comment || "—"}</td></tr>) : <tr><td className="facetrack-empty" colSpan="5">No audit entries yet.</td></tr>}</tbody></table></div></section>}

      {camera && <CameraDialog {...camera} onClose={() => setCamera(null)} onComplete={(result) => { setCamera(null); notify(result.action ? `${result.action === "TIME_IN" ? "Time In" : "Time Out"} recorded successfully.` : "Face profile enrolled."); refresh(); }} />}
      {correction && <CorrectionDialog record={correction} onClose={() => setCorrection(null)} onSaved={() => { setCorrection(null); notify("Correction request sent for administrator approval."); refresh(); }} />}
      </div>
    </div>
  );
}

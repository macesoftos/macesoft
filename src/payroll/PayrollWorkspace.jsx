import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import {
  addPayrollAdjustment,
  createCommissionRule,
  createPayrollRun,
  deletePayrollAdjustment,
  deletePayrollSchedule,
  loadPayrollOverview,
  loadPayrollRun,
  recalculatePayrollRun,
  savePayrollProfile,
  savePayrollSchedule,
  updateCommissionRule,
  updatePayrollRunStatus,
} from "../lib/api.js";
import "./payroll.css";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const number = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });
const tabs = [
  { id: "runs", label: "Payroll Runs", icon: Landmark },
  { id: "profiles", label: "Employee Pay", icon: Users },
  { id: "schedule", label: "Schedule & Leave", icon: CalendarDays },
  { id: "rules", label: "Commission Rules", icon: Settings2 },
];
const scheduleTypes = ["Work Day", "Day Off", "Vacation Leave", "Emergency Leave", "Sick Leave", "Absent"];
const leaveTypes = new Set(["Vacation Leave", "Emergency Leave", "Sick Leave"]);
const adjustmentTypes = ["Incentive", "Commission Adjustment", "Salary Deduction Adjustment", "Other Deduction"];
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function runDefaults() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = now.getDate();
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    cutoffStart: `${year}-${month}-${day <= 15 ? "01" : "16"}`,
    cutoffEnd: `${year}-${month}-${day <= 15 ? "15" : String(lastDay).padStart(2, "0")}`,
    payDate: isoToday(),
    branch: "All branches",
    notes: "",
  };
}

function emptyProfile(staffId = "") {
  return {
    staffId,
    payType: "Monthly",
    monthlySalary: 0,
    dailyRate: 0,
    hourlyRate: 0,
    periodsPerMonth: 2,
    standardWorkDays: 26,
    standardMinutesPerDay: 480,
    overtimeMultiplier: 1.25,
    workDays: [1, 2, 3, 4, 5, 6],
    paidLeaveCredits: 0,
    active: true,
  };
}

function emptySchedule(staffId = "", branch = "") {
  return { staffId, workDate: isoToday(), branch, type: "Work Day", paid: false, scheduledMinutes: 480, notes: "" };
}

function emptyRule() {
  return {
    id: "",
    name: "",
    role: "Aesthetician",
    serviceId: "",
    branch: "All branches",
    ruleType: "Percentage",
    value: 5,
    discountedRuleType: "",
    discountedValue: 0,
    priority: 10,
    active: true,
    effectiveFrom: "",
    effectiveTo: "",
  };
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function hours(minutes) {
  const value = Number(minutes || 0);
  return value ? `${number.format(value / 60)}h` : "—";
}

function StatusBadge({ status }) {
  return <span className={`payroll-status is-${String(status || "draft").toLowerCase()}`}>{status}</span>;
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <article className="payroll-metric">
      <span><Icon size={18} /></span>
      <div><small>{label}</small><strong>{value}</strong>{detail && <p>{detail}</p>}</div>
    </article>
  );
}

export default function PayrollWorkspace({ notify, onAudit, onExit }) {
  const [overview, setOverview] = useState(null);
  const [activeTab, setActiveTab] = useState("runs");
  const [selectedRun, setSelectedRun] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [runForm, setRunForm] = useState(runDefaults);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [adjustmentForm, setAdjustmentForm] = useState({ type: "Incentive", amount: "", reason: "" });

  const staffById = useMemo(() => new Map((overview?.staff || []).map((person) => [person.id, person])), [overview?.staff]);
  const profileByStaff = useMemo(() => new Map((overview?.profiles || []).map((profile) => [profile.staffId, profile])), [overview?.profiles]);
  const selectedLine = selectedRun?.lines?.find((line) => line.id === selectedLineId) || selectedRun?.lines?.[0] || null;

  const refresh = useCallback(async ({ keepRun = true } = {}) => {
    setError("");
    const data = await loadPayrollOverview();
    setOverview(data);
    if (!keepRun) setSelectedRun(null);
    return data;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh().catch((requestError) => {
      if (active) setError(requestError.message || "Unable to load payroll.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    const firstStaff = overview?.staff?.[0];
    if (!firstStaff || profileForm.staffId) return;
    setProfileForm({ ...emptyProfile(firstStaff.id), ...(profileByStaff.get(firstStaff.id) || {}) });
    setScheduleForm(emptySchedule(firstStaff.id, firstStaff.branch === "All branches" ? "" : firstStaff.branch));
  }, [overview?.staff, profileByStaff, profileForm.staffId]);

  useEffect(() => {
    if (selectedRun?.lines?.length && !selectedRun.lines.some((line) => line.id === selectedLineId)) {
      setSelectedLineId(selectedRun.lines[0].id);
    }
  }, [selectedLineId, selectedRun]);

  async function perform(key, task, successMessage) {
    setBusy(key);
    setError("");
    try {
      const result = await task();
      if (result?.auditLog && onAudit) onAudit(result.auditLog);
      if (successMessage) notify?.(successMessage, "success");
      return result;
    } catch (requestError) {
      const message = requestError.message || "Payroll request failed.";
      setError(message);
      notify?.(message, "error");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function submitRun(event) {
    event.preventDefault();
    const result = await perform("create-run", () => createPayrollRun(runForm), "Draft payroll generated.");
    if (!result) return;
    setSelectedRun(result.run);
    setSelectedLineId(result.run.lines?.[0]?.id || "");
    await refresh();
  }

  async function recalculate() {
    if (!selectedRun) return;
    const result = await perform("recalculate", () => recalculatePayrollRun(selectedRun.id), "Payroll recalculated from current records.");
    if (!result) return;
    setSelectedRun(result.run);
    await refresh();
  }

  async function changeRunStatus(status) {
    if (!selectedRun) return;
    const confirmation = status === "Finalized"
      ? "Finalize this payroll? Included commissions and salary deductions will be locked to this cutoff."
      : status === "Approved"
        ? "Approve this payroll after a fresh recalculation?"
        : "Return this payroll to Draft for corrections?";
    if (!window.confirm(confirmation)) return;
    const result = await perform(`status-${status}`, () => updatePayrollRunStatus(selectedRun.id, status), `Payroll moved to ${status}.`);
    if (!result) return;
    setSelectedRun(result.run);
    await refresh();
  }

  function chooseProfile(staffId) {
    setProfileForm({ ...emptyProfile(staffId), ...(profileByStaff.get(staffId) || {}) });
  }

  async function submitProfile(event) {
    event.preventDefault();
    const result = await perform("profile", () => savePayrollProfile(profileForm.staffId, profileForm), "Employee pay settings saved.");
    if (!result) return;
    setProfileForm((current) => ({ ...current, ...result.profile }));
    await refresh();
  }

  async function submitSchedule(event) {
    event.preventDefault();
    const result = await perform("schedule", () => savePayrollSchedule(scheduleForm), "Schedule entry saved.");
    if (!result) return;
    await refresh();
    setScheduleForm((current) => ({ ...emptySchedule(current.staffId, current.branch), workDate: current.workDate }));
  }

  async function removeSchedule(schedule) {
    if (!window.confirm(`Remove ${schedule.type} on ${formatDate(schedule.workDate)}?`)) return;
    const result = await perform(`schedule-${schedule.id}`, () => deletePayrollSchedule(schedule.id), "Schedule entry removed.");
    if (result !== null) await refresh();
  }

  async function submitRule(event) {
    event.preventDefault();
    const result = await perform("rule", () => ruleForm.id ? updateCommissionRule(ruleForm.id, ruleForm) : createCommissionRule(ruleForm), `Commission rule ${ruleForm.id ? "updated" : "created"}.`);
    if (!result) return;
    setRuleForm(emptyRule());
    await refresh();
  }

  async function toggleRule(rule) {
    const result = await perform(`rule-${rule.id}`, () => updateCommissionRule(rule.id, { ...rule, active: !rule.active }), `Commission rule ${rule.active ? "disabled" : "enabled"}.`);
    if (result) await refresh();
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    if (!selectedRun || !selectedLine) return;
    const result = await perform("adjustment", () => addPayrollAdjustment(selectedRun.id, selectedLine.id, adjustmentForm), "Payroll adjustment added.");
    if (!result) return;
    setSelectedRun(result.run);
    setAdjustmentForm({ type: "Incentive", amount: "", reason: "" });
    await refresh();
  }

  async function removeAdjustment(adjustment) {
    if (!selectedRun || !window.confirm(`Remove this ${adjustment.type.toLowerCase()}?`)) return;
    const result = await perform(`adjustment-${adjustment.id}`, () => deletePayrollAdjustment(selectedRun.id, adjustment.id), "Payroll adjustment removed.");
    if (!result) return;
    setSelectedRun(result.run);
    await refresh();
  }

  if (loading) {
    return <section className="payroll-loading"><LoaderCircle className="spin" size={30} /><strong>Loading payroll records…</strong></section>;
  }

  return (
    <section className="payroll-workspace">
      <header className="payroll-hero">
        <div>
          <button className="payroll-back" type="button" onClick={onExit}><ArrowLeft size={17} /> ZenshoTech</button>
          <p className="eyebrow">Finance · Restricted</p>
          <h2>Payroll workspace</h2>
          <span>Cutoff payroll from FaceTrack attendance, approved schedules, commissions, and POS salary deductions.</span>
        </div>
        <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => void perform("refresh", () => refresh(), "Payroll refreshed.")}><RefreshCw className={busy === "refresh" ? "spin" : ""} size={16} /> Refresh</button>
      </header>

      {error && <div className="payroll-error" role="alert">{error}</div>}

      <div className="payroll-metrics">
        <Metric icon={WalletCards} label="Pending salary deductions" value={currency.format(overview?.pending?.salaryDeductions?.amount || 0)} detail={`${overview?.pending?.salaryDeductions?.count || 0} POS payment(s)`} />
        <Metric icon={CircleDollarSign} label="Pending commissions" value={currency.format(overview?.pending?.commissions?.amount || 0)} detail={`${overview?.pending?.commissions?.count || 0} service earning(s)`} />
        <Metric icon={Users} label="Payroll employees" value={overview?.staff?.length || 0} detail={`${overview?.profiles?.filter((profile) => profile.active).length || 0} active profiles`} />
        <Metric icon={CheckCircle2} label="Finalized cutoffs" value={overview?.runs?.filter((run) => run.status === "Finalized").length || 0} detail={`${overview?.runs?.filter((run) => run.status === "Draft").length || 0} draft(s) to review`} />
      </div>

      <nav className="payroll-tabs" aria-label="Payroll sections">
        {tabs.map(({ id, label, icon: Icon }) => <button className={activeTab === id ? "active" : ""} type="button" key={id} onClick={() => setActiveTab(id)}><Icon size={17} /> {label}</button>)}
      </nav>

      {activeTab === "runs" && (
        <div className="payroll-run-layout">
          <aside className="payroll-panel payroll-run-sidebar">
            <div className="payroll-section-heading"><div><p className="eyebrow">Cutoffs</p><h2>Payroll runs</h2></div><span>{overview?.runs?.length || 0}</span></div>
            <details className="payroll-create-disclosure" open={!overview?.runs?.length}>
              <summary><Plus size={16} /> Generate payroll <ChevronDown size={15} /></summary>
              <form className="payroll-form compact" onSubmit={submitRun}>
                <label><span>Cutoff start</span><input required type="date" value={runForm.cutoffStart} onChange={(event) => setRunForm({ ...runForm, cutoffStart: event.target.value })} /></label>
                <label><span>Cutoff end</span><input required type="date" value={runForm.cutoffEnd} onChange={(event) => setRunForm({ ...runForm, cutoffEnd: event.target.value })} /></label>
                <label><span>Pay date</span><input required type="date" value={runForm.payDate} onChange={(event) => setRunForm({ ...runForm, payDate: event.target.value })} /></label>
                <label><span>Branch scope</span><select value={runForm.branch} onChange={(event) => setRunForm({ ...runForm, branch: event.target.value })}><option>All branches</option>{(overview?.branches || []).filter((branch) => branch.status === "Active").map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
                <label className="wide"><span>Notes</span><textarea rows="2" value={runForm.notes} onChange={(event) => setRunForm({ ...runForm, notes: event.target.value })} /></label>
                <button className="primary-button wide" disabled={Boolean(busy)}><Landmark size={16} /> {busy === "create-run" ? "Generating…" : "Generate draft"}</button>
              </form>
            </details>
            <div className="payroll-run-list">
              {(overview?.runs || []).map((run) => (
                <button className={selectedRun?.id === run.id ? "active" : ""} type="button" key={run.id} onClick={() => { setSelectedRun(run.lines ? run : { ...run, lines: [] }); setSelectedLineId(""); void perform(`run-${run.id}`, async () => { const result = await loadPayrollRun(run.id); setSelectedRun(result.run); return result; }); }}>
                  <span><strong>{formatDate(run.cutoffStart)} – {formatDate(run.cutoffEnd)}</strong><small>{run.branch} · Pay {formatDate(run.payDate)}</small></span>
                  <span><StatusBadge status={run.status} /><b>{currency.format(run.totalNet || 0)}</b></span>
                </button>
              ))}
              {!overview?.runs?.length && <div className="payroll-empty">No payroll runs yet.</div>}
            </div>
          </aside>

          <main className="payroll-panel payroll-run-detail">
            {!selectedRun ? (
              <div className="payroll-empty large"><Landmark size={32} /><h2>Select or generate a payroll run</h2><p>Review employee calculations before approving and finalizing the cutoff.</p></div>
            ) : (
              <>
                <header className="payroll-detail-header">
                  <div><p className="eyebrow">{selectedRun.branch}</p><h2>{formatDate(selectedRun.cutoffStart)} – {formatDate(selectedRun.cutoffEnd)}</h2><span>Pay date: {formatDate(selectedRun.payDate)} · Created by {selectedRun.createdBy}</span></div>
                  <div className="payroll-detail-actions">
                    <StatusBadge status={selectedRun.status} />
                    <button type="button" className="ghost-button" onClick={() => window.print()}><Printer size={16} /> Print</button>
                    {selectedRun.status === "Draft" && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void recalculate()}><RefreshCw className={busy === "recalculate" ? "spin" : ""} size={16} /> Recalculate</button>}
                    {selectedRun.status === "Draft" && <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void changeRunStatus("Approved")}><CheckCircle2 size={16} /> Approve</button>}
                    {selectedRun.status === "Approved" && <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void changeRunStatus("Draft")}>Return to draft</button>}
                    {selectedRun.status === "Approved" && <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void changeRunStatus("Finalized")}><CheckCircle2 size={16} /> Finalize</button>}
                  </div>
                </header>

                <div className="payroll-total-strip">
                  <div><small>Gross pay</small><strong>{currency.format(selectedRun.totalGross || 0)}</strong></div>
                  <div><small>Deductions</small><strong>{currency.format(selectedRun.totalDeductions || 0)}</strong></div>
                  <div><small>Net payroll</small><strong>{currency.format(selectedRun.totalNet || 0)}</strong></div>
                </div>

                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead><tr><th>Employee</th><th>Attendance</th><th>Base</th><th>OT</th><th>Incentives</th><th>Commission</th><th>Deductions</th><th>Net</th></tr></thead>
                    <tbody>
                      {(selectedRun.lines || []).map((line) => (
                        <tr className={selectedLine?.id === line.id ? "active" : ""} key={line.id} onClick={() => setSelectedLineId(line.id)}>
                          <td><strong>{line.staffName}</strong><small>{line.role}</small></td>
                          <td><strong>{number.format(line.workedDays || 0)} / {number.format(line.scheduledDays || 0)} days</strong><small>{hours(line.overtimeMinutes)} OT · {hours(line.undertimeMinutes)} UT</small></td>
                          <td>{currency.format(line.basePay || 0)}</td><td>{currency.format(line.overtimePay || 0)}</td><td>{currency.format(line.incentives || 0)}</td><td>{currency.format(line.commissions || 0)}</td><td>{currency.format(line.totalDeductions || 0)}</td><td><strong>{currency.format(line.netPay || 0)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!selectedRun.lines?.length && <div className="payroll-empty">No employee lines were generated. Configure active employee pay profiles, then recalculate.</div>}

                {selectedLine && <PayrollLineDetail line={selectedLine} run={selectedRun} adjustmentForm={adjustmentForm} setAdjustmentForm={setAdjustmentForm} submitAdjustment={submitAdjustment} removeAdjustment={removeAdjustment} busy={busy} />}
              </>
            )}
          </main>
        </div>
      )}

      {activeTab === "profiles" && (
        <div className="payroll-two-column">
          <aside className="payroll-panel payroll-employee-list">
            <div className="payroll-section-heading"><div><p className="eyebrow">Employees</p><h2>Pay profiles</h2></div></div>
            {(overview?.staff || []).map((person) => {
              const profile = profileByStaff.get(person.id);
              return <button className={profileForm.staffId === person.id ? "active" : ""} type="button" key={person.id} onClick={() => chooseProfile(person.id)}><span><strong>{person.name}</strong><small>{person.role} · {person.branch || "All branches"}</small></span><span>{profile?.active ? profile.payType : "Inactive"}<small>{profile?.payType === "Monthly" ? currency.format(profile.monthlySalary || 0) : profile?.payType === "Daily" ? `${currency.format(profile.dailyRate || 0)}/day` : `${currency.format(profile?.hourlyRate || 0)}/hr`}</small></span></button>;
            })}
          </aside>
          <main className="payroll-panel">
            <div className="payroll-section-heading"><div><p className="eyebrow">Compensation</p><h2>{staffById.get(profileForm.staffId)?.name || "Employee pay"}</h2></div></div>
            <form className="payroll-form" onSubmit={submitProfile}>
              <label><span>Pay type</span><select value={profileForm.payType} onChange={(event) => setProfileForm({ ...profileForm, payType: event.target.value })}><option>Monthly</option><option>Daily</option><option>Hourly</option></select></label>
              {profileForm.payType === "Monthly" && <label><span>Monthly salary</span><input min="0" required type="number" step="0.01" value={profileForm.monthlySalary} onChange={(event) => setProfileForm({ ...profileForm, monthlySalary: event.target.value })} /></label>}
              {profileForm.payType === "Daily" && <label><span>Daily rate</span><input min="0" required type="number" step="0.01" value={profileForm.dailyRate} onChange={(event) => setProfileForm({ ...profileForm, dailyRate: event.target.value })} /></label>}
              {profileForm.payType === "Hourly" && <label><span>Hourly rate</span><input min="0" required type="number" step="0.01" value={profileForm.hourlyRate} onChange={(event) => setProfileForm({ ...profileForm, hourlyRate: event.target.value })} /></label>}
              <label><span>Payroll periods / month</span><input min="1" max="4" type="number" value={profileForm.periodsPerMonth} onChange={(event) => setProfileForm({ ...profileForm, periodsPerMonth: event.target.value })} /></label>
              <label><span>Standard work days / month</span><input min="1" max="31" type="number" value={profileForm.standardWorkDays} onChange={(event) => setProfileForm({ ...profileForm, standardWorkDays: event.target.value })} /></label>
              <label><span>Minutes per work day</span><input min="60" max="1440" type="number" value={profileForm.standardMinutesPerDay} onChange={(event) => setProfileForm({ ...profileForm, standardMinutesPerDay: event.target.value })} /></label>
              <label><span>OT multiplier</span><input min="1" max="5" type="number" step="0.01" value={profileForm.overtimeMultiplier} onChange={(event) => setProfileForm({ ...profileForm, overtimeMultiplier: event.target.value })} /></label>
              <label><span>Paid leave credits</span><input min="0" max="365" type="number" step="0.5" value={profileForm.paidLeaveCredits} onChange={(event) => setProfileForm({ ...profileForm, paidLeaveCredits: event.target.value })} /></label>
              <fieldset className="payroll-weekdays wide"><legend>Regular work days</legend>{weekdayLabels.map((label, day) => <label key={label}><input type="checkbox" checked={(profileForm.workDays || []).includes(day)} onChange={() => setProfileForm((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((value) => value !== day) : [...current.workDays, day].sort() }))} /><span>{label}</span></label>)}</fieldset>
              <label className="payroll-switch wide"><input type="checkbox" checked={profileForm.active} onChange={(event) => setProfileForm({ ...profileForm, active: event.target.checked })} /><span>Include this employee in payroll runs</span></label>
              <div className="payroll-form-actions wide"><button className="primary-button" disabled={!profileForm.staffId || Boolean(busy)}><Save size={16} /> {busy === "profile" ? "Saving…" : "Save pay profile"}</button></div>
            </form>
          </main>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="payroll-two-column schedule">
          <aside className="payroll-panel">
            <div className="payroll-section-heading"><div><p className="eyebrow">Approved input</p><h2>Schedule or leave</h2></div></div>
            <form className="payroll-form compact" onSubmit={submitSchedule}>
              <label className="wide"><span>Employee</span><select required value={scheduleForm.staffId} onChange={(event) => setScheduleForm({ ...scheduleForm, staffId: event.target.value })}>{(overview?.staff || []).map((person) => <option value={person.id} key={person.id}>{person.name} · {person.role}</option>)}</select></label>
              <label><span>Date</span><input required type="date" value={scheduleForm.workDate} onChange={(event) => setScheduleForm({ ...scheduleForm, workDate: event.target.value })} /></label>
              <label><span>Type</span><select value={scheduleForm.type} onChange={(event) => { const type = event.target.value; setScheduleForm({ ...scheduleForm, type, paid: leaveTypes.has(type) ? scheduleForm.paid : false, scheduledMinutes: type === "Day Off" ? 0 : scheduleForm.scheduledMinutes || 480 }); }}>{scheduleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Branch</span><select value={scheduleForm.branch} onChange={(event) => setScheduleForm({ ...scheduleForm, branch: event.target.value })}><option value="">Employee branch</option>{(overview?.branches || []).filter((branch) => branch.status === "Active").map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
              {scheduleForm.type !== "Day Off" && <label><span>Scheduled minutes</span><input min="60" max="1440" type="number" value={scheduleForm.scheduledMinutes} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduledMinutes: event.target.value })} /></label>}
              {leaveTypes.has(scheduleForm.type) && <label className="payroll-switch wide"><input type="checkbox" checked={scheduleForm.paid} onChange={(event) => setScheduleForm({ ...scheduleForm, paid: event.target.checked })} /><span>Paid leave (uses one leave credit)</span></label>}
              <label className="wide"><span>Notes</span><textarea rows="3" value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} /></label>
              <button className="primary-button wide" disabled={Boolean(busy)}><Save size={16} /> {busy === "schedule" ? "Saving…" : "Save approved entry"}</button>
            </form>
            <LeaveBalance overview={overview} staffId={scheduleForm.staffId} profile={profileByStaff.get(scheduleForm.staffId)} />
          </aside>
          <main className="payroll-panel">
            <div className="payroll-section-heading"><div><p className="eyebrow">Latest records</p><h2>Schedule ledger</h2></div><span>{overview?.schedules?.length || 0}</span></div>
            <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Hours</th><th>Paid</th><th>Notes</th><th></th></tr></thead><tbody>{(overview?.schedules || []).map((schedule) => <tr key={schedule.id}><td>{formatDate(schedule.workDate)}</td><td><strong>{staffById.get(schedule.staffId)?.name || "Employee"}</strong><small>{schedule.branch || "Employee branch"}</small></td><td>{schedule.type}</td><td>{schedule.type === "Day Off" ? "—" : hours(schedule.scheduledMinutes)}</td><td>{schedule.paid ? "Yes" : "No"}</td><td>{schedule.notes || "—"}</td><td><button className="payroll-icon-button danger" type="button" disabled={Boolean(busy)} onClick={() => void removeSchedule(schedule)} aria-label="Remove schedule entry"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
            {!overview?.schedules?.length && <div className="payroll-empty">No schedule overrides or leave entries yet. Regular work days come from each pay profile.</div>}
          </main>
        </div>
      )}

      {activeTab === "rules" && (
        <div className="payroll-two-column rules">
          <aside className="payroll-panel">
            <div className="payroll-section-heading"><div><p className="eyebrow">{ruleForm.id ? "Edit rule" : "New rule"}</p><h2>Commission setup</h2></div>{ruleForm.id && <button className="ghost-button" type="button" onClick={() => setRuleForm(emptyRule())}>Cancel</button>}</div>
            <form className="payroll-form compact" onSubmit={submitRule}>
              <label className="wide"><span>Rule name</span><input required value={ruleForm.name} onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })} placeholder="e.g. Nurse NAD standard" /></label>
              <label><span>Employee role</span><select value={ruleForm.role} onChange={(event) => setRuleForm({ ...ruleForm, role: event.target.value })}>{[...new Set((overview?.staff || []).map((person) => person.role))].map((role) => <option key={role}>{role}</option>)}</select></label>
              <label><span>Service</span><select value={ruleForm.serviceId || ""} onChange={(event) => setRuleForm({ ...ruleForm, serviceId: event.target.value })}><option value="">All services</option>{(overview?.services || []).map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
              <label><span>Branch</span><select value={ruleForm.branch} onChange={(event) => setRuleForm({ ...ruleForm, branch: event.target.value })}><option>All branches</option>{(overview?.branches || []).filter((branch) => branch.status === "Active").map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
              <label><span>Commission type</span><select value={ruleForm.ruleType} onChange={(event) => setRuleForm({ ...ruleForm, ruleType: event.target.value })}><option>Percentage</option><option>Fixed amount</option></select></label>
              <label><span>{ruleForm.ruleType === "Percentage" ? "Percent" : "Amount"}</span><input min="0" max={ruleForm.ruleType === "Percentage" ? 100 : undefined} required type="number" step="0.01" value={ruleForm.value} onChange={(event) => setRuleForm({ ...ruleForm, value: event.target.value })} /></label>
              <label><span>When discounted</span><select value={ruleForm.discountedRuleType} onChange={(event) => setRuleForm({ ...ruleForm, discountedRuleType: event.target.value })}><option value="">Use standard rule</option><option>Percentage</option><option>Fixed amount</option></select></label>
              {ruleForm.discountedRuleType && <label><span>Discounted value</span><input min="0" max={ruleForm.discountedRuleType === "Percentage" ? 100 : undefined} required type="number" step="0.01" value={ruleForm.discountedValue} onChange={(event) => setRuleForm({ ...ruleForm, discountedValue: event.target.value })} /></label>}
              <label><span>Priority</span><input min="0" max="1000" type="number" value={ruleForm.priority} onChange={(event) => setRuleForm({ ...ruleForm, priority: event.target.value })} /></label>
              <label><span>Effective from</span><input type="date" value={ruleForm.effectiveFrom} onChange={(event) => setRuleForm({ ...ruleForm, effectiveFrom: event.target.value })} /></label>
              <label><span>Effective to</span><input type="date" value={ruleForm.effectiveTo} onChange={(event) => setRuleForm({ ...ruleForm, effectiveTo: event.target.value })} /></label>
              <label className="payroll-switch wide"><input type="checkbox" checked={ruleForm.active} onChange={(event) => setRuleForm({ ...ruleForm, active: event.target.checked })} /><span>Rule is active</span></label>
              <button className="primary-button wide" disabled={Boolean(busy)}><Save size={16} /> {busy === "rule" ? "Saving…" : ruleForm.id ? "Update rule" : "Create rule"}</button>
            </form>
          </aside>
          <main className="payroll-panel">
            <div className="payroll-section-heading"><div><p className="eyebrow">Automatic earnings</p><h2>Active rules</h2></div><span>{overview?.rules?.length || 0}</span></div>
            <div className="payroll-rule-list">{(overview?.rules || []).map((rule) => <article className={!rule.active ? "inactive" : ""} key={rule.id}><div><strong>{rule.name}</strong><p>{rule.role} · {rule.serviceName || "All services"} · {rule.branch}</p><small>{rule.ruleType === "Percentage" ? `${number.format(rule.value)}% of service value` : `${currency.format(rule.value)} per service`}{rule.discountedRuleType ? ` · Discounted: ${rule.discountedRuleType === "Percentage" ? `${number.format(rule.discountedValue)}%` : currency.format(rule.discountedValue)}` : ""}</small></div><span><StatusBadge status={rule.active ? "Active" : "Inactive"} /><button className="payroll-icon-button" type="button" onClick={() => setRuleForm({ ...emptyRule(), ...rule, serviceId: rule.serviceId || "" })} aria-label="Edit commission rule"><Pencil size={15} /></button><button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => void toggleRule(rule)}>{rule.active ? "Disable" : "Enable"}</button></span></article>)}</div>
          </main>
        </div>
      )}
    </section>
  );
}

function LeaveBalance({ overview, staffId, profile }) {
  const used = (overview?.schedules || []).filter((entry) => entry.staffId === staffId && entry.paid && entry.status === "Approved").length;
  const credits = Number(profile?.paidLeaveCredits || 0);
  return <div className="payroll-leave-balance"><Clock3 size={18} /><span><strong>{number.format(Math.max(0, credits - used))} paid leave credits remaining</strong><small>{number.format(used)} used of {number.format(credits)} configured credits</small></span></div>;
}

function PayrollLineDetail({ line, run, adjustmentForm, setAdjustmentForm, submitAdjustment, removeAdjustment, busy }) {
  const daily = line.calculationDetails?.daily || [];
  return (
    <section className="payroll-line-detail">
      <div className="payroll-section-heading"><div><p className="eyebrow">Employee statement</p><h2>{line.staffName}</h2></div><strong className="payroll-line-net">{currency.format(line.netPay || 0)} net</strong></div>
      <div className="payroll-breakdown">
        <div><span>Base pay</span><strong>{currency.format(line.basePay || 0)}</strong></div><div><span>Overtime</span><strong>{currency.format(line.overtimePay || 0)}</strong></div><div><span>Incentives</span><strong>{currency.format(line.incentives || 0)}</strong></div><div><span>Commissions</span><strong>{currency.format(line.commissions || 0)}</strong></div><div><span>Salary deduction</span><strong>−{currency.format(line.salaryDeductions || 0)}</strong></div><div><span>Other deductions</span><strong>−{currency.format(line.otherDeductions || 0)}</strong></div>
      </div>
      <div className="payroll-detail-grid">
        <details open><summary>Daily attendance ({daily.length}) <ChevronDown size={15} /></summary><div className="payroll-mini-list">{daily.map((day) => <div key={day.workDate}><span><strong>{formatDate(day.workDate)}</strong><small>{day.type}{day.branch ? ` · ${day.branch}` : ""}</small></span><span>{hours(day.regularMinutes)} regular<small>{hours(day.overtimeMinutes)} OT · {hours(day.undertimeMinutes)} undertime</small></span></div>)}</div></details>
        <details open><summary>Automatic commissions ({line.commissionEarnings?.length || 0}) <ChevronDown size={15} /></summary><div className="payroll-mini-list">{(line.commissionEarnings || []).map((earning) => <div key={earning.id}><span><strong>{earning.serviceName}</strong><small>{earning.sourceDate} · {earning.ruleName}</small></span><strong>{currency.format(earning.amount)}</strong></div>)}{!line.commissionEarnings?.length && <p>No automatic commission earnings.</p>}</div></details>
        <details open><summary>POS salary deductions ({line.salaryDeductionRows?.length || 0}) <ChevronDown size={15} /></summary><div className="payroll-mini-list">{(line.salaryDeductionRows || []).map((deduction) => <div key={deduction.id}><span><strong>{deduction.saleInvoice}</strong><small>{deduction.sourceDate} · {deduction.branch}</small></span><strong>−{currency.format(deduction.amount)}</strong></div>)}{!line.salaryDeductionRows?.length && <p>No POS salary deductions.</p>}</div></details>
        <details open><summary>Manual adjustments ({line.adjustments?.length || 0}) <ChevronDown size={15} /></summary><div className="payroll-mini-list">{(line.adjustments || []).map((adjustment) => <div key={adjustment.id}><span><strong>{adjustment.type}</strong><small>{adjustment.reason} · {adjustment.createdBy}</small></span><span><strong>{currency.format(adjustment.amount)}</strong>{run.status === "Draft" && <button className="payroll-icon-button danger" type="button" disabled={Boolean(busy)} onClick={() => void removeAdjustment(adjustment)}><Trash2 size={14} /></button>}</span></div>)}{!line.adjustments?.length && <p>No manual adjustments.</p>}</div></details>
      </div>
      {run.status === "Draft" && <form className="payroll-adjustment-form" onSubmit={submitAdjustment}><select value={adjustmentForm.type} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, type: event.target.value })}>{adjustmentTypes.map((type) => <option key={type}>{type}</option>)}</select><input required type="number" step="0.01" placeholder="Amount" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })} /><input required placeholder="Reason / approval reference" value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} /><button className="secondary-button" disabled={Boolean(busy)}><Plus size={15} /> Add adjustment</button></form>}
    </section>
  );
}

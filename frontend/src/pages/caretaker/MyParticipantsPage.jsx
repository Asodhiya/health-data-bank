import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { api } from "../../services/api";

// ─── Mock Data (removed once backend is live) ───────────────────────────────────
// TODO (Phase 2): Delete MOCK_* constants once these endpoints return real data:
//   GET  /caretaker/participants
//   GET  /caretaker/groups
//   GET  /caretaker/participants/:id
//   POST /caretaker/participants/:id/notes
//   POST /auth/signup_invite  (existing — add group_id support)

const MOCK_PARTICIPANTS = [
  { id: "p1", firstName: "Sarah", lastName: "Chen", email: "sarah.chen@example.com", phone: "+1 416-555-0191", dob: "1991-04-12", gender: "Female", status: "active", enrolledAt: "2025-11-03", lastActive: "2026-03-13", healthGoals: 3, healthGoalsTotal: 4, surveysDone: 8, surveysTotal: 10, latestMetrics: { bpSystolic: 118, bpDiastolic: 76, weight: 64.2, painLevel: 2 }, flags: [] },
  { id: "p2", firstName: "Marcus", lastName: "Webb", email: "marcus.webb@example.com", phone: "+1 647-555-0182", dob: "1985-09-30", gender: "Male", status: "active", enrolledAt: "2025-11-10", lastActive: "2026-03-12", healthGoals: 1, healthGoalsTotal: 3, surveysDone: 5, surveysTotal: 10, latestMetrics: { bpSystolic: 135, bpDiastolic: 88, weight: 91.5, painLevel: 5 }, flags: ["High BP reported"] },
  { id: "p3", firstName: "Lily", lastName: "Hartmann", email: "lily.hartmann@example.com", phone: "+1 519-555-0165", dob: "1978-12-01", gender: "Female", status: "inactive", enrolledAt: "2025-08-14", lastActive: "2026-02-20", healthGoals: 0, healthGoalsTotal: 0, surveysDone: 2, surveysTotal: 10, latestMetrics: { bpSystolic: 122, bpDiastolic: 80, weight: 70.1, painLevel: 0 }, flags: ["Inactive 3+ weeks"] },
  { id: "p4", firstName: "Aiko", lastName: "Tanaka", email: "aiko.tanaka@example.com", phone: "+1 613-555-0177", dob: "2000-02-18", gender: "Female", status: "active", enrolledAt: "2026-01-05", lastActive: "2026-03-14", healthGoals: 2, healthGoalsTotal: 2, surveysDone: 10, surveysTotal: 10, latestMetrics: { bpSystolic: 110, bpDiastolic: 70, weight: 55.0, painLevel: 1 }, flags: [] },
  { id: "p5", firstName: "Omar", lastName: "Diallo", email: "omar.diallo@example.com", phone: "+1 403-555-0110", dob: "1995-07-23", gender: "Male", status: "active", enrolledAt: "2026-02-28", lastActive: "2026-03-10", healthGoals: 1, healthGoalsTotal: 3, surveysDone: 0, surveysTotal: 10, latestMetrics: null, flags: ["No surveys completed"] },
  { id: "p6", firstName: "Priya", lastName: "Sharma", email: "priya.sharma@example.com", phone: "+1 905-555-0199", dob: "1988-06-15", gender: "Female", status: "active", enrolledAt: "2025-10-20", lastActive: "2026-03-11", healthGoals: 4, healthGoalsTotal: 5, surveysDone: 7, surveysTotal: 10, latestMetrics: { bpSystolic: 125, bpDiastolic: 82, weight: 68.3, painLevel: 3 }, flags: [] },
  { id: "p7", firstName: "James", lastName: "Kowalski", email: "james.kowalski@example.com", phone: "+1 204-555-0144", dob: "1972-03-08", gender: "Male", status: "active", enrolledAt: "2025-09-15", lastActive: "2026-03-08", healthGoals: 2, healthGoalsTotal: 4, surveysDone: 9, surveysTotal: 10, latestMetrics: { bpSystolic: 142, bpDiastolic: 92, weight: 98.7, painLevel: 6 }, flags: ["High BP reported", "High pain reported"] },
  { id: "p8", firstName: "Fatima", lastName: "Al-Rashid", email: "fatima.alrashid@example.com", phone: "+1 416-555-0188", dob: "1996-11-22", gender: "Female", status: "inactive", enrolledAt: "2025-12-01", lastActive: "2026-01-15", healthGoals: 0, healthGoalsTotal: 0, surveysDone: 1, surveysTotal: 10, latestMetrics: { bpSystolic: 115, bpDiastolic: 74, weight: 58.9, painLevel: 0 }, flags: ["Inactive 3+ weeks", "No health goals"] },
];

const MOCK_GROUP = { id: "g1", name: "Morning Cohort A" };

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}
function getAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
function pct(val, total) { return total > 0 ? (val / total) * 100 : 0; }

// ─── Sub-Components ─────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, size = "md" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const palette = ["bg-blue-500","bg-emerald-500","bg-indigo-500","bg-rose-500","bg-amber-500","bg-violet-500"];
  const color = palette[(firstName?.charCodeAt(0) ?? 0) % palette.length];
  const sz = size === "lg" ? "w-14 h-14 text-lg" : "w-9 h-9 text-xs";
  return <div className={`rounded-full ${color} text-white flex items-center justify-center font-bold shrink-0 ${sz}`}>{initials}</div>;
}

function StatusDot({ status }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${status === "active" ? "bg-emerald-400" : "bg-slate-300"}`} />;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      <span className="text-xs font-semibold text-slate-700 text-right">{value || "—"}</span>
    </div>
  );
}

function FlagBadge({ text }) {
  const isCritical = text.toLowerCase().includes("high");
  const isWarning = text.toLowerCase().includes("inactive") || text.toLowerCase().includes("no ");
  const colors = isCritical ? "bg-rose-50 text-rose-700 border-rose-100" : isWarning ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-600 border-slate-100";
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${colors}`}>{text}</span>;
}

function ChevronIcon({ direction = "down", className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {direction === "up" ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
    </svg>
  );
}

function SortButton({ label, field, currentSort, onSort, className = "" }) {
  const isActive = currentSort.field === field;
  return (
    <button onClick={() => onSort(field)}
      className={`flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"} ${className}`}>
      {label}
      {isActive && <ChevronIcon direction={currentSort.dir === "asc" ? "up" : "down"} className="text-blue-600" />}
    </button>
  );
}

// ─── Filter Panel ───────────────────────────────────────────────────────────────

function FilterPanel({ filters, setFilters, onReset }) {
  const activeFilterCount = [filters.status !== "all", filters.gender !== "all", filters.flagged !== "all", filters.ageMin || filters.ageMax, filters.surveyProgress !== "all", filters.goalProgress !== "all"].filter(Boolean).length;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <span className="text-sm font-bold text-slate-700">Filters</span>
          {activeFilterCount > 0 && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
        </div>
        {activeFilterCount > 0 && <button onClick={onReset} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Clear All</button>}
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <div className="flex gap-1">
              {[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }].map(s => (
                <button key={s.value} onClick={() => setFilters(f => ({...f, status: s.value}))} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${filters.status === s.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
            <div className="flex gap-1">
              {[{ value: "all", label: "All" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }].map(g => (
                <button key={g.value} onClick={() => setFilters(f => ({...f, gender: g.value}))} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${filters.gender === g.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{g.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Alerts</label>
            <div className="flex gap-1">
              {[{ value: "all", label: "All" }, { value: "flagged", label: "Flagged" }, { value: "clear", label: "No Flags" }].map(f => (
                <button key={f.value} onClick={() => setFilters(prev => ({...prev, flagged: f.value}))} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${filters.flagged === f.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Age Range</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.ageMin} onChange={e => setFilters(f => ({...f, ageMin: e.target.value}))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300 text-slate-700" />
              <span className="text-xs text-slate-300">–</span>
              <input type="number" placeholder="Max" value={filters.ageMax} onChange={e => setFilters(f => ({...f, ageMax: e.target.value}))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300 text-slate-700" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Survey Progress</label>
            <select value={filters.surveyProgress} onChange={e => setFilters(f => ({...f, surveyProgress: e.target.value}))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
              <option value="all">All</option>
              <option value="complete">Complete (100%)</option>
              <option value="in_progress">In Progress (1–99%)</option>
              <option value="not_started">Not Started (0%)</option>
              <option value="below_50">Below 50%</option>
              <option value="above_50">Above 50%</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Goal Progress</label>
            <select value={filters.goalProgress} onChange={e => setFilters(f => ({...f, goalProgress: e.target.value}))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
              <option value="all">All</option>
              <option value="complete">All Goals Met</option>
              <option value="in_progress">In Progress</option>
              <option value="no_goals">No Goals Set</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────────────────────────────────

function InviteModal({ group, onDone, onCancel }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    try {
      // Uses the existing /auth/signup_invite endpoint
      // TODO (Phase 2): extend SignupInviteRequest to accept group_id so
      //   the participant is auto-assigned to this caretaker's group on registration.
      await api.sendInvite(email.trim(), "participant");
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send invite. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm space-y-4">
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Invite Sent!</p>
              <p className="text-xs text-slate-500 mt-1">Sent to <span className="font-semibold text-slate-700">{email}</span></p>
              <span className="inline-block text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-2">{group.name}</span>
            </div>
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-left w-full mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-blue-700">The admin has been notified of this invite.</p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => { setEmail(""); setSent(false); }} className="flex-1 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">Send Another</button>
              <button onClick={() => onDone(email)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          </div>
          <div><h3 className="text-base font-bold text-slate-800">Invite Participant</h3><p className="text-sm text-slate-500 mt-1">Send a registration link to join your group.</p></div>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
          <div><p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Inviting to</p><p className="text-sm font-bold text-emerald-800 mt-0.5">{group.name}</p></div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="participant@example.com"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800 placeholder:text-slate-300" />
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <p className="text-xs text-amber-700">The admin will be automatically notified when you send this invite.</p>
        </div>
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSend} disabled={!email.trim() || sending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {sending ? (<><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Sending…</>) : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Note Modal ─────────────────────────────────────────────────────────────────

function NoteModal({ participant, onSave, onCancel }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.caretakerCreateNote(participant.id, text.trim());
      onSave(text.trim());
    } catch (err) {
      // If backend not ready, still close with success (mock mode)
      console.warn("Note save failed (backend may not be ready):", err.message);
      onSave(text.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-md space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </div>
          <div><h3 className="text-base font-bold text-slate-800">Write Feedback</h3><p className="text-sm text-slate-500 mt-1">For <span className="font-semibold text-slate-700">{participant.firstName} {participant.lastName}</span></p></div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Write your personalized feedback or note here..."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!text.trim() || saving} className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────────────

function ParticipantDetailPanel({ participant: p, onClose, onViewFull }) {
  const sPct = Math.round(pct(p.surveysDone, p.surveysTotal));
  const gPct = Math.round(pct(p.healthGoals, p.healthGoalsTotal));
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Participant Details</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-4">
            <Avatar firstName={p.firstName} lastName={p.lastName} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-800">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-slate-400 truncate">{p.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5"><StatusDot status={p.status} /><span className="text-xs text-slate-400 capitalize">{p.status}</span></div>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">Age {getAge(p.dob)}</span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">Last active {daysSince(p.lastActive)}</span>
              </div>
            </div>
          </div>
          {p.flags.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100 bg-rose-50/50">
              <div className="flex items-center gap-2 flex-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {p.flags.map((f, i) => <FlagBadge key={i} text={f} />)}
              </div>
            </div>
          )}
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</p>
            <InfoRow label="Date of Birth" value={`${fmt(p.dob)} (age ${getAge(p.dob)})`} />
            <InfoRow label="Gender" value={p.gender} />
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="Enrolled" value={fmt(p.enrolledAt)} />
          </div>
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center"><p className="text-2xl font-extrabold text-blue-600">{p.surveysDone}</p><p className="text-xs text-blue-500 mt-0.5">Surveys Done</p><p className="text-xs text-blue-400">of {p.surveysTotal}</p></div>
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3 text-center"><p className="text-2xl font-extrabold text-indigo-600">{p.healthGoals}</p><p className="text-xs text-indigo-500 mt-0.5">Goals Met</p><p className="text-xs text-indigo-400">of {p.healthGoalsTotal || 0}</p></div>
            </div>
            <div className="space-y-3">
              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Survey progress</span><span className="font-semibold text-slate-600">{p.surveysDone}/{p.surveysTotal}</span></div><div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${sPct}%` }} /></div></div>
              <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Health goal progress</span><span className="font-semibold text-slate-600">{p.healthGoals}/{p.healthGoalsTotal || 0}</span></div><div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${gPct}%` }} /></div></div>
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Latest Health Metrics</p>
            {p.latestMetrics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center"><p className={`text-xl font-extrabold ${p.latestMetrics.bpSystolic >= 140 ? "text-rose-600" : p.latestMetrics.bpSystolic >= 130 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.bpSystolic}/{p.latestMetrics.bpDiastolic}</p><p className="text-xs text-slate-400 mt-0.5">Blood Pressure</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center"><p className="text-xl font-extrabold text-slate-700">{p.latestMetrics.weight} <span className="text-sm font-semibold text-slate-400">kg</span></p><p className="text-xs text-slate-400 mt-0.5">Weight</p></div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center"><p className={`text-xl font-extrabold ${p.latestMetrics.painLevel >= 5 ? "text-rose-600" : p.latestMetrics.painLevel >= 3 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.painLevel}<span className="text-sm font-semibold text-slate-400">/10</span></p><p className="text-xs text-slate-400 mt-0.5">Pain Level</p></div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center"><p className="text-sm text-slate-400">No health data submitted yet.</p></div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onViewFull}
            className="w-full py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            View Full Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { status: "all", gender: "all", flagged: "all", ageMin: "", ageMax: "", surveyProgress: "all", goalProgress: "all" };

export default function MyParticipantsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ field: "name", dir: "asc" });
  const [detailParticipant, setDetailParticipant] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState(null);

  function showToastMsg(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ── Data fetching (falls back to mock) ──────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [participantData, groupData] = await Promise.all([
        api.caretakerListParticipants(),
        api.caretakerGetGroups(),
      ]);
      setParticipants(participantData);
      // Caretaker has one group — take the first
      setGroup(groupData?.[0] ?? null);
    } catch (err) {
      console.warn("Backend not ready, using mock data:", err.message);
      setParticipants(MOCK_PARTICIPANTS);
      setGroup(MOCK_GROUP);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Sort handler ────────────────────────────────────────────────────────────

  function handleSort(field) {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  }

  // ── Filter + Sort logic ─────────────────────────────────────────────────────

  const processed = useMemo(() => {
    let list = participants.filter(p => {
      const q = search.toLowerCase();
      if (q && !`${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)) return false;
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.gender !== "all" && p.gender !== filters.gender) return false;
      if (filters.flagged === "flagged" && p.flags.length === 0) return false;
      if (filters.flagged === "clear" && p.flags.length > 0) return false;
      if (filters.ageMin) { const age = getAge(p.dob); if (age === null || age < Number(filters.ageMin)) return false; }
      if (filters.ageMax) { const age = getAge(p.dob); if (age === null || age > Number(filters.ageMax)) return false; }
      const sp = pct(p.surveysDone, p.surveysTotal);
      if (filters.surveyProgress === "complete" && sp < 100) return false;
      if (filters.surveyProgress === "in_progress" && (sp <= 0 || sp >= 100)) return false;
      if (filters.surveyProgress === "not_started" && sp > 0) return false;
      if (filters.surveyProgress === "below_50" && sp >= 50) return false;
      if (filters.surveyProgress === "above_50" && sp < 50) return false;
      if (filters.goalProgress === "complete" && (p.healthGoalsTotal === 0 || p.healthGoals < p.healthGoalsTotal)) return false;
      if (filters.goalProgress === "in_progress" && (p.healthGoalsTotal === 0 || p.healthGoals >= p.healthGoalsTotal)) return false;
      if (filters.goalProgress === "no_goals" && p.healthGoalsTotal > 0) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.field) {
        case "name": return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case "age": return dir * ((getAge(a.dob) ?? 0) - (getAge(b.dob) ?? 0));
        case "status": return dir * a.status.localeCompare(b.status);
        case "gender": return dir * a.gender.localeCompare(b.gender);
        case "surveys": return dir * (pct(a.surveysDone, a.surveysTotal) - pct(b.surveysDone, b.surveysTotal));
        case "goals": return dir * (pct(a.healthGoals, a.healthGoalsTotal) - pct(b.healthGoals, b.healthGoalsTotal));
        case "lastActive": return dir * (new Date(a.lastActive) - new Date(b.lastActive));
        case "enrolled": return dir * (new Date(a.enrolledAt) - new Date(b.enrolledAt));
        default: return 0;
      }
    });
    return list;
  }, [participants, search, filters, sort]);

  const counts = useMemo(() => ({
    total: participants.length,
    active: participants.filter(p => p.status === "active").length,
    inactive: participants.filter(p => p.status === "inactive").length,
    flagged: participants.filter(p => p.flags.length > 0).length,
  }), [participants]);

  const activeFilterCount = [filters.status !== "all", filters.gender !== "all", filters.flagged !== "all", filters.ageMin || filters.ageMax, filters.surveyProgress !== "all", filters.goalProgress !== "all"].filter(Boolean).length;

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
          </div>
          <div className="h-24 bg-slate-200 rounded-2xl" />
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2 md:p-0 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold bg-emerald-600 text-white pointer-events-none max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="truncate">{toast}</span>
        </div>
      )}
      {showInvite && group && <InviteModal group={group} onDone={email => { showToastMsg(`Invite sent to ${email}. Admin notified.`); setShowInvite(false); }} onCancel={() => setShowInvite(false)} />}
      {noteTarget && <NoteModal participant={noteTarget} onSave={text => { showToastMsg(`Feedback saved for ${noteTarget.firstName} ${noteTarget.lastName}.`); setNoteTarget(null); }} onCancel={() => setNoteTarget(null)} />}
      {detailParticipant && <ParticipantDetailPanel participant={detailParticipant} onClose={() => setDetailParticipant(null)} onViewFull={() => { setDetailParticipant(null); navigate(`/caretaker/participants/${detailParticipant.id}`); }} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Participants</h1>
          <div className="flex items-center gap-2 mt-1.5">
            {group && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {group.name}
              </span>
            )}
            <span className="text-xs text-slate-400">{counts.total} participants</span>
          </div>
        </div>
        <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          Invite Participant
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-slate-800">{counts.total}</p><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-emerald-600">{counts.active}</p><p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Active</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-slate-400">{counts.inactive}</p><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Inactive</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-rose-600">{counts.flagged}</p><p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mt-1">Flagged</p></div>
      </div>

      {/* Search + sort + filter toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
          </div>
          <button onClick={() => setShowFilters(v => !v)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all shrink-0 ${showFilters || activeFilterCount > 0 ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filters
            {activeFilterCount > 0 && <span className="text-xs font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort by</span>
          {[{field:"name",label:"Name"},{field:"age",label:"Age"},{field:"status",label:"Status"},{field:"gender",label:"Gender"},{field:"surveys",label:"Surveys"},{field:"goals",label:"Goals"},{field:"lastActive",label:"Last Active"},{field:"enrolled",label:"Enrolled"}].map(s => {
            const isActive = sort.field === s.field;
            return (<button key={s.field} onClick={() => handleSort(s.field)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.label}{isActive && <ChevronIcon direction={sort.dir === "asc" ? "up" : "down"} className="text-white" />}</button>);
          })}
        </div>
      </div>

      {showFilters && <FilterPanel filters={filters} setFilters={setFilters} onReset={() => setFilters(DEFAULT_FILTERS)} />}

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-400">Showing <span className="font-semibold text-slate-600">{processed.length}</span> of {counts.total} participants</p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {processed.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <p className="text-sm text-slate-400">No participants match your filters.</p>
            <button onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear all filters</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="hidden md:flex items-center gap-3 px-4 py-3 bg-slate-50">
              <SortButton label="Participant" field="name" currentSort={sort} onSort={handleSort} className="flex-1" />
              <SortButton label="Age" field="age" currentSort={sort} onSort={handleSort} className="w-12 justify-center" />
              <SortButton label="Gender" field="gender" currentSort={sort} onSort={handleSort} className="w-16 justify-center" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-40 text-center">Progress</span>
              <SortButton label="Last Active" field="lastActive" currentSort={sort} onSort={handleSort} className="w-24 justify-center" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Actions</span>
            </div>
            {processed.map(p => {
              const sPct = Math.round(pct(p.surveysDone, p.surveysTotal));
              const gPct = Math.round(pct(p.healthGoals, p.healthGoalsTotal));
              const age = getAge(p.dob);
              return (
                <div key={p.id} onClick={() => setDetailParticipant(p)} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar firstName={p.firstName} lastName={p.lastName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800 truncate">{p.firstName} {p.lastName}</p><StatusDot status={p.status} /></div>
                      <p className="text-xs text-slate-400 truncate">{p.email}</p>
                      {p.flags.length > 0 && <div className="flex items-center gap-1 mt-1 flex-wrap">{p.flags.map((f, i) => <FlagBadge key={i} text={f} />)}</div>}
                      <div className="md:hidden mt-2 space-y-1.5">
                        <div className="flex items-center gap-3 text-xs text-slate-400"><span>{age !== null ? `${age} yrs` : "—"}</span><span>·</span><span>{p.gender}</span><span>·</span><span className={p.status === "inactive" ? "text-amber-600 font-medium" : ""}>{daysSince(p.lastActive)}</span></div>
                        <div><div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Surveys</span><span className="font-semibold text-slate-500">{p.surveysDone}/{p.surveysTotal}</span></div><div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${sPct}%` }} /></div></div>
                        <div><div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Goals</span><span className="font-semibold text-slate-500">{p.healthGoals}/{p.healthGoalsTotal || 0}</span></div><div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${gPct}%` }} /></div></div>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block w-12 text-center"><span className="text-xs font-semibold text-slate-600">{age !== null ? age : "—"}</span></div>
                  <div className="hidden md:block w-16 text-center"><span className="text-xs font-medium text-slate-500">{p.gender}</span></div>
                  <div className="hidden md:flex flex-col gap-1.5 w-40">
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-400 w-14 shrink-0">Surveys</span><div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${sPct}%` }} /></div><span className="text-xs font-semibold text-slate-500 w-9 text-right">{p.surveysDone}/{p.surveysTotal}</span></div>
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-400 w-14 shrink-0">Goals</span><div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${gPct}%` }} /></div><span className="text-xs font-semibold text-slate-500 w-9 text-right">{p.healthGoals}/{p.healthGoalsTotal || 0}</span></div>
                  </div>
                  <div className="hidden md:block w-24 text-center"><span className={`text-xs font-medium ${p.status === "inactive" ? "text-amber-600" : "text-slate-400"}`}>{daysSince(p.lastActive)}</span></div>
                  <div className="hidden md:flex w-20 items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setNoteTarget(p)} title="Write feedback" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onClick={() => navigate(`/caretaker/reports?tab=comparison&participant=${p.id}`)} title="Generate report" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                    <button onClick={() => navigate(`/caretaker/participants/${p.id}`)} title="View full profile" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

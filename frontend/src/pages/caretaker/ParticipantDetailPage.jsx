import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../../services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
function getAge(dob) { if (!dob) return null; const t = new Date(); const b = new Date(dob); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; }
function daysSince(d) { if (!d) return null; const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); if (diff === 0) return "Today"; if (diff === 1) return "Yesterday"; return `${diff}d ago`; }

// ─── Data transformers ──────────────────────────────────────────────────────────
// Map backend response shapes → what the UI components expect.

function transformParticipant(listItem, groupName, enrolledAt) {
  // The list endpoint returns: participant_id, name, gender, age, status,
  // group_id, survey_progress, goal_progress, last_login_at, last_submission_at
  const nameParts = (listItem.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Derive simple active/inactive + descriptive activity status
  const isActive = listItem.status !== "inactive";
  const activityLabel = {
    highly_active: "Highly Active",
    moderately_active: "Moderately Active",
    low_active: "Low Activity",
    inactive: "Inactive",
  }[listItem.status] || "Unknown";

  // Build flags from activity status
  const flags = [];
  if (listItem.status === "inactive") flags.push("Inactive");
  if (listItem.status === "low_active") flags.push("Low activity");
  if (listItem.survey_progress === "not_started") flags.push("No surveys completed");

  return {
    id: listItem.participant_id,
    firstName,
    lastName,
    email: null,           // not exposed to caretaker endpoints
    phone: null,           // not exposed to caretaker endpoints
    dob: null,             // not exposed (age is available directly)
    age: listItem.age != null ? Math.round(listItem.age) : null,
    gender: listItem.gender || null,
    status: isActive ? "active" : "inactive",
    activityStatus: listItem.status,
    activityLabel,
    groupName: groupName || null,
    groupId: listItem.group_id || null,
    enrolledAt: enrolledAt || null,
    lastActive: listItem.last_login_at || listItem.last_submission_at || null,
    surveyProgress: listItem.survey_progress || "not_started",
    goalProgress: listItem.goal_progress || "not_started",
    latestMetrics: null,   // no endpoint available
    flags,
  };
}

function transformSubmission(raw) {
  return {
    id: raw.submission_id,
    formId: raw.form_id,
    formName: raw.form_name || "Untitled Form",
    submittedAt: raw.submitted_at,
    status: "completed",
    // Field-level answers are not available from the caretaker submissions list endpoint
    fields: [],
  };
}

function transformFeedback(raw) {
  return {
    id: raw.feedback_id,
    text: raw.message || "",
    createdAt: raw.created_at ? raw.created_at.split("T")[0] : null,
    tag: "feedback",
    submissionId: raw.submission_id || null,
  };
}

// ─── Shared Components ──────────────────────────────────────────────────────────

function ChevronIcon({ direction = "down", className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {direction === "up" ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
    </svg>
  );
}

function Avatar({ firstName, lastName, size = "md" }) {
  const i = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const p = ["bg-blue-500","bg-emerald-500","bg-indigo-500","bg-rose-500","bg-amber-500","bg-violet-500"];
  const c = p[(firstName?.charCodeAt(0) ?? 0) % p.length];
  const s = size === "xl" ? "w-16 h-16 text-xl" : size === "lg" ? "w-14 h-14 text-lg" : "w-9 h-9 text-xs";
  return <div className={`rounded-full ${c} text-white flex items-center justify-center font-bold shrink-0 ${s}`}>{i}</div>;
}
function StatusDot({ status }) { return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${status === "active" ? "bg-emerald-400" : "bg-slate-300"}`} />; }
function InfoRow({ label, value }) { return (<div className="flex justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0"><span className="text-xs text-slate-400 font-medium shrink-0">{label}</span><span className="text-xs font-semibold text-slate-700 text-right">{value || "—"}</span></div>); }
function FlagBadge({ text }) {
  const cr = text.toLowerCase().includes("high"); const w = text.toLowerCase().includes("inactive") || text.toLowerCase().includes("no ");
  const cl = cr ? "bg-rose-50 text-rose-700 border-rose-100" : w ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-600 border-slate-100";
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cl}`}>{text}</span>;
}

function EmptyPlaceholder({ icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-14 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
        <h2 className="text-base font-bold text-slate-700">{title}</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md">{description}</p>
      </div>
    </div>
  );
}

function ProgressBadge({ progress }) {
  const styles = {
    not_started: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", label: "Not Started" },
    in_progress: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "In Progress" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Completed" },
  };
  const s = styles[progress] || styles.not_started;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>;
}

// ─── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ p }) {
  return (
    <div className="space-y-6">
      {/* Flags / alerts */}
      {p.flags.length > 0 && (
        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
          <div className="flex items-center gap-2 flex-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider mr-1">Alerts</span>
            {p.flags.map((f, i) => <FlagBadge key={i} text={f} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</p>
          <InfoRow label="Age" value={p.age != null ? `${p.age} years` : null} />
          <InfoRow label="Gender" value={p.gender} />
          <InfoRow label="Email" value={p.email} />
          <InfoRow label="Phone" value={p.phone} />
          <InfoRow label="Enrolled" value={fmt(p.enrolledAt)} />
          <InfoRow label="Last Active" value={daysSince(p.lastActive)} />
          {(!p.email && !p.phone) && (
            <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-slate-400">Contact details are not available in the caretaker view.</p>
            </div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity Summary</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Surveys</p>
              <ProgressBadge progress={p.surveyProgress} />
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3 text-center">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Goals</p>
              <ProgressBadge progress={p.goalProgress} />
            </div>
          </div>
          <div className="space-y-3">
            <InfoRow label="Activity Status" value={p.activityLabel} />
            <InfoRow label="Last Login" value={p.lastActive ? daysSince(p.lastActive) : null} />
            <InfoRow label="Group" value={p.groupName} />
          </div>
        </div>
      </div>

      {/* Health Metrics placeholder */}
      {p.latestMetrics ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Latest Health Metrics</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className={`text-2xl font-extrabold ${p.latestMetrics.bpSystolic >= 140 ? "text-rose-600" : p.latestMetrics.bpSystolic >= 130 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.bpSystolic}/{p.latestMetrics.bpDiastolic}</p><p className="text-xs text-slate-400 mt-1">Blood Pressure</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className="text-2xl font-extrabold text-slate-700">{p.latestMetrics.weight}<span className="text-sm text-slate-400 ml-0.5">kg</span></p><p className="text-xs text-slate-400 mt-1">Weight</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className={`text-2xl font-extrabold ${p.latestMetrics.painLevel >= 5 ? "text-rose-600" : p.latestMetrics.painLevel >= 3 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.painLevel}<span className="text-sm text-slate-400">/10</span></p><p className="text-xs text-slate-400 mt-1">Pain Level</p></div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Latest Health Metrics</p>
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <p className="text-sm font-semibold text-slate-400">No health metrics available</p>
            <p className="text-xs text-slate-300 mt-1">Metrics will appear here once data element mapping and reporting are set up.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Submissions ───────────────────────────────────────────────────────────

function SubmissionsTab({ submissions, participantId, participantName }) {
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ field: "date", dir: "desc" });

  // Feedback state for submission detail view
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const filtered = useMemo(() => {
    let list = submissions.filter(s => {
      if (search && !s.formName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.field === "date") return dir * (new Date(a.submittedAt) - new Date(b.submittedAt));
      if (sort.field === "name") return dir * a.formName.localeCompare(b.formName);
      return 0;
    });
    return list;
  }, [submissions, search, sort]);

  function toggleSort(field) {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim() || !viewingSubmission) return;
    setFeedbackSaving(true);
    try {
      await api.caretakerCreateFeedback(participantId, viewingSubmission.id, feedbackText.trim());
      setFeedbackSuccess(true);
      setFeedbackText("");
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      console.warn("Feedback save failed:", err.message);
    } finally {
      setFeedbackSaving(false);
    }
  }

  // ── Detail view for a single submission ──
  if (viewingSubmission) {
    const s = viewingSubmission;
    return (
      <div className="space-y-4">
        <button onClick={() => { setViewingSubmission(null); setFeedbackText(""); setFeedbackSuccess(false); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Submissions
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{s.formName}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-slate-400">Submitted {fmt(s.submittedAt)}</span>
              </div>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full capitalize">{s.status}</span>
          </div>
        </div>

        {/* Answers placeholder */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">Submission answers are not yet available</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
            Individual answer viewing requires a submission detail endpoint. The submission was recorded on {fmt(s.submittedAt)}.
          </p>
        </div>

        {/* Feedback form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leave Feedback on This Submission</p>
          <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3}
            placeholder={`Write feedback for ${participantName} about this submission...`}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
          <div className="flex items-center justify-between gap-3">
            {feedbackSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Feedback saved
              </div>
            )}
            <div className="flex-1" />
            <button onClick={handleSendFeedback} disabled={!feedbackText.trim() || feedbackSaving}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              {feedbackSaving ? "Saving…" : "Send Feedback"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submissions list ──
  if (submissions.length === 0) {
    return (
      <EmptyPlaceholder
        icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        title="No submissions yet"
        description="This participant hasn't submitted any surveys yet. Submissions will appear here once they complete assigned forms."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search forms by name…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort</span>
          {[{ field: "date", label: "Date" }, { field: "name", label: "Name" }].map(s => (
            <button key={s.field} onClick={() => toggleSort(s.field)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${sort.field === s.field ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {s.label}
              {sort.field === s.field && <ChevronIcon direction={sort.dir === "asc" ? "up" : "down"} className="text-white" />}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 px-1">Showing {filtered.length} of {submissions.length} submissions (read-only)</p>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No submissions match your search.</p>
          <button onClick={() => setSearch("")} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear search</button>
        </div>
      ) : filtered.map(s => (
        <button key={s.id} onClick={() => setViewingSubmission(s)}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all group">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{s.formName}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span>Submitted {fmt(s.submittedAt)}</span>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      ))}
    </div>
  );
}

// ─── Tab: Health Goals ──────────────────────────────────────────────────────────

function GoalsTab() {
  return (
    <EmptyPlaceholder
      icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      title="Health goals not available yet"
      description="The caretaker view for health goals is being developed. Once available, you'll be able to view this participant's goal progress, baselines, and targets here."
    />
  );
}

// ─── Tab: Health Trends ─────────────────────────────────────────────────────────

function TrendsTab() {
  return (
    <EmptyPlaceholder
      icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      title="Health trends not available yet"
      description="Trend visualizations require data element mapping to be configured. Once health data points are being collected and mapped, you'll see charts and trend analysis here."
    />
  );
}

// ─── Tab: Notes & Feedback ──────────────────────────────────────────────────────

function NotesTab({ participantId, participantName, feedbackItems }) {
  const [notes, setNotes] = useState(feedbackItems);
  const [newNote, setNewNote] = useState("");
  const [writeTag, setWriteTag] = useState("check-in");
  const [saving, setSaving] = useState(false);

  // Filter/sort state
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortDir, setSortDir] = useState("desc");

  async function handleSave() {
    if (!newNote.trim()) return;
    setSaving(true);
    // Notes are local-only for now — just add to local state
    setNotes(prev => [{ id: `n${Date.now()}`, text: newNote.trim(), createdAt: new Date().toISOString().split("T")[0], tag: writeTag }, ...prev]);
    setNewNote("");
    setSaving(false);
  }

  const allTags = useMemo(() => {
    const tags = new Set(notes.map(n => n.tag).filter(Boolean));
    return ["all", ...tags];
  }, [notes]);

  const filtered = useMemo(() => {
    let list = notes.filter(n => {
      if (search && !n.text.toLowerCase().includes(search.toLowerCase())) return false;
      if (tagFilter !== "all" && n.tag !== tagFilter) return false;
      return true;
    });
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return dir * (new Date(a.createdAt) - new Date(b.createdAt));
    });
    return list;
  }, [notes, search, tagFilter, sortDir]);

  const tagColors = {
    "check-in": "bg-blue-50 text-blue-700 border-blue-100",
    "recommendation": "bg-indigo-50 text-indigo-700 border-indigo-100",
    "progress": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "initial": "bg-slate-100 text-slate-600 border-slate-200",
    "concern": "bg-rose-50 text-rose-700 border-rose-100",
    "feedback": "bg-violet-50 text-violet-700 border-violet-100",
  };

  return (
    <div className="space-y-5">
      {/* Write new note */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Note</p>
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder={`Write a note about ${participantName}...`}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto">
            {["check-in", "recommendation", "progress", "concern"].map(t => (
              <button key={t} onClick={() => setWriteTag(t)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize ${writeTag === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{t}</button>
            ))}
          </div>
          <button onClick={handleSave} disabled={!newNote.trim() || saving} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-xs text-amber-700">Notes are saved locally in this session only and will not persist when you leave this page. Feedback left on individual submissions is saved to the server.</p>
        </div>
      </div>

      {notes.length === 0 && !search && tagFilter === "all" ? (
        <EmptyPlaceholder
          icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          title="No notes or feedback yet"
          description="Start by writing a note above, or leave feedback on individual submissions from the Submissions tab."
        />
      ) : (
        <>
          {/* Search + filter + sort */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Tag</span>
                {allTags.map(t => (
                  <button key={t} onClick={() => setTagFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize shrink-0 ${tagFilter === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {t === "all" ? "All" : t}
                  </button>
                ))}
              </div>
              <button onClick={() => setSortDir(prev => prev === "desc" ? "asc" : "desc")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all whitespace-nowrap shrink-0">
                {sortDir === "desc" ? "Newest first" : "Oldest first"}
                <ChevronIcon direction={sortDir === "desc" ? "down" : "up"} />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 px-1">Showing {filtered.length} of {notes.length} notes</p>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No notes match your search.</p>
              <button onClick={() => { setSearch(""); setTagFilter("all"); }} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear filters</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(n => (
                <div key={n.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-slate-400">{fmt(n.createdAt)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${tagColors[n.tag] || tagColors["check-in"]}`}>{n.tag}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "submissions", label: "Submissions", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { key: "goals", label: "Health Goals", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "trends", label: "Health Trends", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { key: "notes", label: "Notes & Feedback", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
];

export default function ParticipantDetailPage() {
  const { id: participantId } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();

  const [activeTab, setActiveTab] = useState("overview");
  const [participant, setParticipant] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ──────────────────────────────────────────────────────────────────────────────
  // Data fetching — uses real backend endpoints only, no mock fallbacks.
  //
  //   GET /caretaker/groups                               → group name
  //   GET /caretaker/participants                         → rich participant data
  //   GET /caretaker/groups/{id}/members                  → enrolled date (joined_at)
  //   GET /caretaker/participants/{id}/submissions        → submission list
  //   GET /caretaker/participants/{id}/feedback           → feedback items
  //
  // If the backend returns nothing, placeholders are shown in the UI.
  // ──────────────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch groups → get group id + name
      const groups = await api.caretakerGetGroups();
      const firstGroup = Array.isArray(groups) && groups.length > 0 ? groups[0] : null;

      if (!firstGroup) {
        setError("You are not assigned to any groups.");
        setLoading(false);
        return;
      }

      // 2. Fetch all participants from the list endpoint (richer data than detail)
      const allParticipants = await api.caretakerListParticipants();
      const thisParticipant = Array.isArray(allParticipants)
        ? allParticipants.find(p => p.participant_id === participantId)
        : null;

      if (!thisParticipant) {
        setError("Participant not found.");
        setLoading(false);
        return;
      }

      // 3. Get joined_at from group members
      let enrolledAt = null;
      try {
        const members = await api.caretakerGetGroupMembers(firstGroup.group_id);
        const thisMember = Array.isArray(members)
          ? members.find(m => m.participant_id === participantId)
          : null;
        if (thisMember?.joined_at) {
          enrolledAt = thisMember.joined_at;
        }
      } catch {
        // Non-critical — enrolledAt will show "—"
      }

      // 4. Transform and set participant
      setParticipant(transformParticipant(thisParticipant, firstGroup.name, enrolledAt));

      // 5. Fetch submissions
      try {
        const subData = await api.caretakerListSubmissions(participantId);
        setSubmissions(Array.isArray(subData) ? subData.map(transformSubmission) : []);
      } catch {
        setSubmissions([]);
      }

      // 6. Fetch existing feedback (shown in Notes tab as seed data)
      try {
        const fbData = await api.caretakerListFeedback(participantId);
        setFeedbackItems(Array.isArray(fbData) ? fbData.map(transformFeedback) : []);
      } catch {
        setFeedbackItems([]);
      }

    } catch (err) {
      console.error("Failed to load participant data:", err);
      setError("Something went wrong loading participant data.");
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 rounded w-40" />
          <div className="flex items-center gap-4"><div className="w-16 h-16 bg-slate-200 rounded-full" /><div className="space-y-2 flex-1"><div className="h-6 bg-slate-200 rounded w-48" /><div className="h-4 bg-slate-200 rounded w-64" /></div></div>
          <div className="h-12 bg-slate-200 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[...Array(2)].map((_, i) => <div key={i} className="h-48 bg-slate-200 rounded-2xl" />)}</div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0">
        <button onClick={() => navigate("/caretaker/participants")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to My Participants
        </button>
        <EmptyPlaceholder
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          title="Unable to load participant"
          description={error}
        />
        <div className="flex justify-center mt-4">
          <button onClick={fetchData} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Not found state ──
  if (!participant) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0 text-center py-20">
        <p className="text-sm text-slate-400">Participant not found.</p>
        <button onClick={() => navigate("/caretaker/participants")} className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800">Back to My Participants</button>
      </div>
    );
  }

  const p = participant;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate("/caretaker/participants")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to My Participants
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar firstName={p.firstName} lastName={p.lastName} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{p.firstName} {p.lastName}</h1>
              <StatusDot status={p.status} />
              <span className="text-xs text-slate-400 capitalize">{p.activityLabel}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {p.age != null && <span className="text-xs text-slate-400">Age {p.age}</span>}
              {p.gender && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">{p.gender}</span></>}
              {p.groupName && <><span className="text-xs text-slate-300">·</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{p.groupName}</span></>}
              {p.lastActive && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">Last active {daysSince(p.lastActive)}</span></>}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab p={p} />}
      {activeTab === "submissions" && <SubmissionsTab submissions={submissions} participantId={p.id} participantName={`${p.firstName} ${p.lastName}`} />}
      {activeTab === "goals" && <GoalsTab />}
      {activeTab === "trends" && <TrendsTab />}
      {activeTab === "notes" && <NotesTab participantId={p.id} participantName={`${p.firstName} ${p.lastName}`} feedbackItems={feedbackItems} />}
    </div>
  );
}

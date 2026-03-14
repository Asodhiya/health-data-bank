import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../../services/api";

// ─── Mock Data (removed once backend is live) ───────────────────────────────────
// TODO (Phase 2): Delete all MOCK_* once these endpoints return real data:
//   GET  /caretaker/participants/:id
//   GET  /caretaker/participants/:id/summary
//   GET  /caretaker/submissions?participant_id=:id
//   GET  /caretaker/submissions/:id
//   GET  /caretaker/participants/:id/goals
//   GET  /caretaker/participants/:id/notes
//   POST /caretaker/participants/:id/notes

const MOCK_PARTICIPANT = {
  id: "p7", firstName: "James", lastName: "Kowalski",
  email: "james.kowalski@example.com", phone: "+1 204-555-0144",
  dob: "1972-03-08", gender: "Male", status: "active",
  groupName: "Morning Cohort A",
  enrolledAt: "2025-09-15", lastActive: "2026-03-08",
  healthGoals: 2, healthGoalsTotal: 4, surveysDone: 9, surveysTotal: 10,
  latestMetrics: { bpSystolic: 142, bpDiastolic: 92, weight: 98.7, painLevel: 6 },
  flags: ["High BP reported", "High pain reported"],
};

const MOCK_SUBMISSIONS = [
  { id: "s1", formName: "Perceived Stress Scale (PSS)", category: "Mental Health", submittedAt: "2026-03-08", status: "completed",
    fields: [
      { label: "In the last month, how often have you been upset because of something that happened unexpectedly?", type: "likert", description: "Rate from 0 (Never) to 4 (Very Often)", required: true, answer: "3 — Fairly Often" },
      { label: "In the last month, how often have you felt that you were unable to control the important things in your life?", type: "likert", description: "Rate from 0 (Never) to 4 (Very Often)", required: true, answer: "3 — Fairly Often" },
      { label: "In the last month, how often have you felt nervous and stressed?", type: "likert", description: "Rate from 0 (Never) to 4 (Very Often)", required: true, answer: "4 — Very Often" },
      { label: "In the last month, how often have you felt confident about your ability to handle your personal problems?", type: "likert", description: "Rate from 0 (Never) to 4 (Very Often). Note: This is a reverse-scored item.", required: false, answer: "1 — Almost Never" },
      { label: "In the last month, how often have you felt that things were going your way?", type: "likert", description: "Rate from 0 (Never) to 4 (Very Often). Note: This is a reverse-scored item.", required: true, answer: "1 — Almost Never" },
      { label: "In the last month, how often have you found that you could not cope with all the things that you had to do?", type: "likert", description: null, required: true, answer: "3 — Fairly Often" },
      { label: "In the last month, how often have you been able to control irritations in your life?", type: "likert", description: "Note: This is a reverse-scored item.", required: true, answer: "1 — Almost Never" },
      { label: "In the last month, how often have you felt that you were on top of things?", type: "likert", description: "Note: This is a reverse-scored item.", required: true, answer: "1 — Almost Never" },
      { label: "In the last month, how often have you been angered because of things that were outside of your control?", type: "likert", description: null, required: true, answer: "3 — Fairly Often" },
      { label: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?", type: "likert", description: null, required: true, answer: "3 — Fairly Often" },
    ]},
  { id: "s2", formName: "UCLA Loneliness Scale (Version 3)", category: "Social Wellness", submittedAt: "2026-02-25", status: "completed",
    fields: [
      { label: "How often do you feel that you are 'in tune' with the people around you?", type: "likert", description: "1 = Never, 2 = Rarely, 3 = Sometimes, 4 = Always", required: true, answer: "2 — Rarely" },
      { label: "How often do you feel that you lack companionship?", type: "likert", description: null, required: true, answer: "3 — Sometimes" },
      { label: "How often do you feel that there is no one you can turn to?", type: "likert", description: null, required: true, answer: "2 — Rarely" },
      { label: "How often do you feel alone?", type: "likert", description: null, required: true, answer: "3 — Sometimes" },
      { label: "How often do you feel part of a group of friends?", type: "likert", description: null, required: true, answer: "2 — Rarely" },
      { label: "How often do you feel that you have a lot in common with the people around you?", type: "likert", description: null, required: true, answer: "2 — Rarely" },
      { label: "How often do you feel that you are no longer close to anyone?", type: "likert", description: null, required: true, answer: "3 — Sometimes" },
    ]},
  { id: "s3", formName: "Physical Activity Readiness (PAR-Q)", category: "Physical Health", submittedAt: "2026-02-15", status: "completed",
    fields: [
      { label: "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?", type: "yes_no", description: "Answer Yes or No.", required: true, answer: "No" },
      { label: "Do you feel pain in your chest when you do physical activity?", type: "yes_no", description: null, required: true, answer: "Yes" },
      { label: "In the past month, have you had chest pain when you were not doing physical activity?", type: "yes_no", description: null, required: true, answer: "No" },
      { label: "Do you lose your balance because of dizziness or do you ever lose consciousness?", type: "yes_no", description: null, required: true, answer: "No" },
      { label: "Do you have a bone or joint problem that could be made worse by a change in your physical activity?", type: "yes_no", description: null, required: true, answer: "Yes" },
      { label: "Is your doctor currently prescribing drugs for your blood pressure or heart condition?", type: "yes_no", description: null, required: true, answer: "Yes" },
      { label: "Do you know of any other reason why you should not do physical activity?", type: "yes_no", description: "If yes, please discuss with your caretaker.", required: true, answer: "No" },
    ]},
  { id: "s4", formName: "Dietary Habits Assessment", category: "Nutrition", submittedAt: "2026-02-01", status: "completed",
    fields: [
      { label: "How many servings of fruits and vegetables do you eat per day?", type: "number", description: "One serving is about 1 cup of raw or ½ cup of cooked.", required: true, answer: "3" },
      { label: "How many glasses of water do you drink per day?", type: "number", description: null, required: true, answer: "6" },
      { label: "How often do you eat fast food in a typical week?", type: "select", description: null, required: true, answer: "2–3 times" },
      { label: "Do you follow any specific dietary plan?", type: "text", description: "e.g. vegetarian, low-sodium, diabetic diet", required: false, answer: "Low-sodium (doctor recommended)" },
    ]},
  { id: "s5", formName: "Sleep Quality Index (PSQI)", category: "Sleep", submittedAt: "2026-01-20", status: "completed", fields: [] },
  { id: "s6", formName: "Medication Adherence Scale", category: "Medication", submittedAt: "2026-01-10", status: "completed", fields: [] },
  { id: "s7", formName: "Monthly Wellness Check-in", category: "General", submittedAt: "2025-12-15", status: "completed", fields: [] },
  { id: "s8", formName: "Socio-Demographic Baseline", category: "Demographics", submittedAt: "2025-11-01", status: "completed", fields: [] },
  { id: "s9", formName: "Initial Health Intake Form", category: "General", submittedAt: "2025-09-15", status: "completed", fields: [] },
];

const MOCK_GOALS = [
  { id: "g1", title: "Daily Steps", emoji: "👟", baseline: 3200, current: 7800, target: 10000, unit: "steps", status: "active", startDate: "2026-01-01", targetDate: "2026-04-01" },
  { id: "g2", title: "Lower Blood Pressure", emoji: "❤️", baseline: 150, current: 142, target: 130, unit: "mmHg", status: "active", startDate: "2025-11-01", targetDate: "2026-05-01" },
  { id: "g3", title: "Water Intake", emoji: "💧", baseline: 3, current: 8, target: 8, unit: "glasses/day", status: "completed", startDate: "2025-10-01", targetDate: "2026-01-01" },
  { id: "g4", title: "Weight Loss", emoji: "⚖️", baseline: 105, current: 98.7, target: 90, unit: "kg", status: "active", startDate: "2025-09-15", targetDate: "2026-06-15" },
];

const MOCK_NOTES = [
  { id: "n1", text: "James showed improvement in daily step count but BP is still above target. Discussed medication adherence — he admits missing evening doses on weekends. Agreed to set phone reminders.", createdAt: "2026-03-08", tag: "check-in" },
  { id: "n2", text: "Reviewed latest PSS scores — stress levels remain elevated. Recommended exploring community walking group for both exercise and social support.", createdAt: "2026-02-25", tag: "recommendation" },
  { id: "n3", text: "Weight down 1.5 kg from last month. Positive trend. Encouraged continuing current dietary changes. Flagged chest pain reported in PAR-Q — follow up with GP.", createdAt: "2026-02-15", tag: "progress" },
  { id: "n4", text: "Initial assessment complete. Baseline BP 150/96, weight 105 kg. Set goals for daily steps, BP reduction, water intake, and weight loss. James is motivated but will need regular check-ins.", createdAt: "2025-09-15", tag: "initial" },
];

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
function getAge(dob) { if (!dob) return null; const t = new Date(); const b = new Date(dob); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; }
function daysSince(d) { if (!d) return null; const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); if (diff === 0) return "Today"; if (diff === 1) return "Yesterday"; return `${diff}d ago`; }
function pctVal(v, t) { return t > 0 ? Math.round((v / t) * 100) : 0; }

// ─── Shared Components ──────────────────────────────────────────────────────────

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

// ─── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ p }) {
  const sPct = pctVal(p.surveysDone, p.surveysTotal);
  const gPct = pctVal(p.healthGoals, p.healthGoalsTotal);
  return (
    <div className="space-y-6">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</p>
          <InfoRow label="Date of Birth" value={`${fmt(p.dob)} (age ${getAge(p.dob)})`} />
          <InfoRow label="Gender" value={p.gender} />
          <InfoRow label="Phone" value={p.phone} />
          <InfoRow label="Email" value={p.email} />
          <InfoRow label="Enrolled" value={fmt(p.enrolledAt)} />
          <InfoRow label="Last Active" value={daysSince(p.lastActive)} />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Activity Summary</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center"><p className="text-2xl font-extrabold text-blue-600">{p.surveysDone}</p><p className="text-xs text-blue-500 mt-0.5">Surveys</p><p className="text-xs text-blue-400">of {p.surveysTotal}</p></div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3 text-center"><p className="text-2xl font-extrabold text-indigo-600">{p.healthGoals}</p><p className="text-xs text-indigo-500 mt-0.5">Goals Met</p><p className="text-xs text-indigo-400">of {p.healthGoalsTotal}</p></div>
          </div>
          <div className="space-y-3">
            <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Surveys</span><span className="font-semibold text-slate-600">{sPct}%</span></div><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${sPct}%` }} /></div></div>
            <div><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Goals</span><span className="font-semibold text-slate-600">{gPct}%</span></div><div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${gPct}%` }} /></div></div>
          </div>
        </div>
      </div>
      {p.latestMetrics && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Latest Health Metrics</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className={`text-2xl font-extrabold ${p.latestMetrics.bpSystolic >= 140 ? "text-rose-600" : p.latestMetrics.bpSystolic >= 130 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.bpSystolic}/{p.latestMetrics.bpDiastolic}</p><p className="text-xs text-slate-400 mt-1">Blood Pressure</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className="text-2xl font-extrabold text-slate-700">{p.latestMetrics.weight}<span className="text-sm text-slate-400 ml-0.5">kg</span></p><p className="text-xs text-slate-400 mt-1">Weight</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className={`text-2xl font-extrabold ${p.latestMetrics.painLevel >= 5 ? "text-rose-600" : p.latestMetrics.painLevel >= 3 ? "text-amber-600" : "text-emerald-600"}`}>{p.latestMetrics.painLevel}<span className="text-sm text-slate-400">/10</span></p><p className="text-xs text-slate-400 mt-1">Pain Level</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center"><p className="text-2xl font-extrabold text-emerald-600">{p.surveysDone}<span className="text-sm text-slate-400">/{p.surveysTotal}</span></p><p className="text-xs text-slate-400 mt-1">Surveys Done</p></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Submissions ───────────────────────────────────────────────────────────

function SubmissionsTab({ submissions }) {
  const [viewingSubmission, setViewingSubmission] = useState(null);

  if (viewingSubmission) {
    const s = viewingSubmission;
    return (
      <div className="space-y-4">
        <button onClick={() => setViewingSubmission(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Submissions
        </button>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{s.formName}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{s.category}</span>
                <span className="text-xs text-slate-400">Submitted {fmt(s.submittedAt)}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">{s.fields.length} questions</span>
              </div>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full capitalize">{s.status}</span>
          </div>
        </div>
        {s.fields.length > 0 ? (
          <div className="space-y-3">
            {s.fields.map((f, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-300 bg-slate-100 w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">{f.label}</p>
                      {f.required && <span className="text-rose-400 text-xs mt-0.5 shrink-0">*</span>}
                    </div>
                    {f.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.description}</p>}
                    <span className="inline-block text-xs text-slate-300 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded mt-1">{f.type}</span>
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Response</p>
                      <p className="text-sm font-semibold text-blue-800">{f.answer || <span className="text-slate-400 italic font-normal">No answer provided</span>}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm text-slate-400">Full form answers will load from the backend once connected.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">{submissions.length} form submissions (read-only)</p>
      {submissions.map(s => (
        <button key={s.id} onClick={() => setViewingSubmission(s)}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{s.formName}</p>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{s.category}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span>Submitted {fmt(s.submittedAt)}</span>
              <span>·</span>
              <span>{s.fields.length} questions</span>
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      ))}
    </div>
  );
}

// ─── Tab: Health Goals ──────────────────────────────────────────────────────────

function GoalsTab({ goals }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{goals.length} goals — read-only view (participant manages their own goals)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map(g => {
          const range = Math.abs(g.target - g.baseline);
          const progress = range > 0 ? Math.min(100, Math.round((Math.abs(g.current - g.baseline) / range) * 100)) : (g.current >= g.target ? 100 : 0);
          const isComplete = g.status === "completed";
          const statusColors = isComplete ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200";
          return (
            <div key={g.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">{g.emoji}</div>
                  <div><h3 className="font-bold text-slate-800">{g.title}</h3><p className="text-xs text-slate-400 mt-0.5">{fmt(g.startDate)} → {fmt(g.targetDate)}</p></div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${statusColors}`}>{g.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center"><p className="text-xs text-slate-400">Baseline</p><p className="text-sm font-bold text-slate-600">{g.baseline} <span className="text-xs font-normal text-slate-400">{g.unit}</span></p></div>
                <div className="text-center"><p className="text-xs text-slate-400">Current</p><p className="text-sm font-bold text-blue-600">{g.current} <span className="text-xs font-normal text-slate-400">{g.unit}</span></p></div>
                <div className="text-center"><p className="text-xs text-slate-400">Target</p><p className="text-sm font-bold text-emerald-600">{g.target} <span className="text-xs font-normal text-slate-400">{g.unit}</span></p></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Progress</span><span className="font-semibold text-slate-600">{progress}%</span></div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden"><div className={`h-2 rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Notes & Feedback ──────────────────────────────────────────────────────

function NotesTab({ participantId, participantName, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [tag, setTag] = useState("check-in");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await api.caretakerCreateNote(participantId, newNote.trim(), tag);
    } catch (err) {
      console.warn("Note save via API failed (backend may not be ready):", err.message);
    }
    // Optimistic update regardless
    setNotes(prev => [{ id: `n${Date.now()}`, text: newNote.trim(), createdAt: new Date().toISOString().split("T")[0], tag }, ...prev]);
    setNewNote("");
    setSaving(false);
  }

  const tagColors = {
    "check-in": "bg-blue-50 text-blue-700 border-blue-100",
    "recommendation": "bg-indigo-50 text-indigo-700 border-indigo-100",
    "progress": "bg-emerald-50 text-emerald-700 border-emerald-100",
    "initial": "bg-slate-100 text-slate-600 border-slate-200",
    "concern": "bg-rose-50 text-rose-700 border-rose-100",
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Feedback / Note</p>
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder={`Write feedback for ${participantName}...`}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto">
            {["check-in", "recommendation", "progress", "concern"].map(t => (
              <button key={t} onClick={() => setTag(t)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize ${tag === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{t}</button>
            ))}
          </div>
          <button onClick={handleSave} disabled={!newNote.trim() || saving} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs text-slate-400">{notes.length} notes</p>
        {notes.map(n => (
          <div key={n.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400">{fmt(n.createdAt)}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${tagColors[n.tag] || tagColors["check-in"]}`}>{n.tag}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{n.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "submissions", label: "Submissions", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { key: "goals", label: "Health Goals", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { key: "notes", label: "Notes & Feedback", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
];

export default function ParticipantDetailPage() {
  const { id: participantId } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();

  const [activeTab, setActiveTab] = useState("overview");
  const [participant, setParticipant] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, subData, goalData, noteData] = await Promise.all([
        api.caretakerGetParticipant(participantId),
        api.caretakerListSubmissions({ participant_id: participantId }),
        api.caretakerGetParticipantGoals(participantId),
        api.caretakerListNotes(participantId),
      ]);
      setParticipant(pData);
      setSubmissions(subData);
      setGoals(goalData);
      setNotes(noteData);
    } catch (err) {
      console.warn("Backend not ready, using mock data:", err.message);
      setParticipant(MOCK_PARTICIPANT);
      setSubmissions(MOCK_SUBMISSIONS);
      setGoals(MOCK_GOALS);
      setNotes(MOCK_NOTES);
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
              <span className="text-xs text-slate-400 capitalize">{p.status}</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{p.email}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-400">Age {getAge(p.dob)} · {p.gender}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{p.groupName}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">Last active {daysSince(p.lastActive)}</span>
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
      {activeTab === "submissions" && <SubmissionsTab submissions={submissions} />}
      {activeTab === "goals" && <GoalsTab goals={goals} />}
      {activeTab === "notes" && <NotesTab participantId={p.id} participantName={`${p.firstName} ${p.lastName}`} initialNotes={notes} />}
    </div>
  );
}

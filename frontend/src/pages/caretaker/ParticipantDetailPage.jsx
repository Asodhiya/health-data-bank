import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { usePolling } from "../../hooks/usePolling";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
function getAge(dob) { if (!dob) return null; const t = new Date(); const b = new Date(dob); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a; }
function daysSince(d) { if (!d) return null; const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); if (diff === 0) return "Today"; if (diff === 1) return "Yesterday"; return `${diff}d ago`; }

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const CHART_TT = { borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)", fontSize: "12px" };

// ─── Data transformers ──────────────────────────────────────────────────────────

function transformParticipant(listItem, groupName, enrolledAt) {
  // We keep firstName/lastName for backwards compat with the Avatar component
  // and any future structured uses, but `fullName` is the source of truth for
  // display because we can't reliably split "Mary Anne Smith" or "Jean van der
  // Berg" into first/last without structured fields from the backend.
  const fullName = (listItem.name || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const isActive = listItem.status !== "inactive";
  const activityLabel = {
    highly_active: "Highly Active",
    moderately_active: "Moderately Active",
    low_active: "Low Activity",
    inactive: "Inactive",
  }[listItem.status] || "Unknown";
  const flags = [];
  if (listItem.status === "inactive") flags.push("Inactive");
  if (listItem.status === "low_active") flags.push("Low activity");
  if (listItem.survey_progress === "not_started") flags.push("No surveys completed");
  return {
    id: listItem.participant_id,
    firstName, lastName, fullName,
    email: listItem.email || null,
    phone: listItem.phone || null,
    dob: listItem.dob || null,
    age: listItem.age != null ? Math.round(listItem.age) : null,
    gender: listItem.gender || null,
    status: isActive ? "active" : "inactive",
    activityStatus: listItem.status,
    activityLabel,
    groupName: groupName || null,
    groupId: listItem.group_id || null,
    enrolledAt: enrolledAt || listItem.enrolled_at || null,
    lastActive: listItem.last_login_at || listItem.last_submission_at || null,
    surveyProgress: listItem.survey_progress || "not_started",
    goalProgress: listItem.goal_progress || "not_started",
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

function transformNote(raw) {
  return {
    id: raw.note_id,
    text: raw.text || "",
    createdAt: raw.created_at ? raw.created_at.split("T")[0] : null,
    tag: raw.tag || "check-in",
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

function Avatar({ fullName, size = "md" }) {
  // Compute initials from the first two whitespace-separated tokens.
  // For single-token names ("Sarah") fall back to the first two characters.
  const tokens = (fullName || "").trim().split(/\s+/).filter(Boolean);
  let initials;
  if (tokens.length >= 2) {
    initials = `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`;
  } else if (tokens.length === 1) {
    initials = tokens[0].slice(0, 2);
  } else {
    initials = "?";
  }
  initials = initials.toUpperCase();
  const palette = ["bg-blue-500","bg-emerald-500","bg-indigo-500","bg-rose-500","bg-amber-500","bg-violet-500"];
  const color = palette[(fullName?.charCodeAt(0) ?? 0) % palette.length];
  const sizeClass = size === "xl" ? "w-16 h-16 text-xl" : size === "lg" ? "w-14 h-14 text-lg" : "w-9 h-9 text-xs";
  return <div className={`rounded-full ${color} text-white flex items-center justify-center font-bold shrink-0 ${sizeClass}`}>{initials}</div>;
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
    active: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Active" },
  };
  const s = styles[progress] || styles.not_started;
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>;
}

// ─── Health Metrics Cards (for Overview tab) ────────────────────────────────────

function HealthMetricsCards({ trends }) {
  if (!trends || trends.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Latest Health Metrics</p>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <p className="text-sm font-semibold text-slate-400">No health metrics available yet</p>
          <p className="text-xs text-slate-300 mt-1">Metrics will appear here once health data points are collected.</p>
        </div>
      </div>
    );
  }

  const latest = trends.map(t => {
    const last = t.points[t.points.length - 1];
    const prev = t.points.length >= 2 ? t.points[t.points.length - 2] : null;
    const change = prev ? last.value - prev.value : null;
    return { label: t.label, unit: t.unit, value: last.value, date: last.date, change };
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Latest Health Metrics</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {latest.map((m, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
            <p className="text-2xl font-extrabold text-slate-800">
              {m.value}<span className="text-xs text-slate-400 ml-0.5">{m.unit}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            {m.change !== null && (
              <p className={`text-xs font-semibold mt-1 ${m.change < 0 ? "text-emerald-600" : m.change > 0 ? "text-amber-600" : "text-slate-400"}`}>
                {m.change > 0 ? "+" : ""}{m.change.toFixed(1)} since last
              </p>
            )}
            <p className="text-[10px] text-slate-300 mt-0.5">{fmt(m.date)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ p, trends }) {
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
          <InfoRow label="Age" value={p.age != null ? `${p.age} years` : null} />
          <InfoRow label="Gender" value={p.gender} />
          <InfoRow label="Email" value={p.email} />
          <InfoRow label="Phone" value={p.phone} />
          <InfoRow label="Enrolled" value={fmt(p.enrolledAt)} />
          <InfoRow label="Last Active" value={daysSince(p.lastActive)} />
          {(!p.email && !p.phone) && (
            <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-slate-400">No contact details have been provided by the participant yet.</p>
            </div>
          )}
        </div>

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

      <HealthMetricsCards trends={trends} />
    </div>
  );
}

// ─── Tab: Submissions (with real answer detail) ─────────────────────────────────

function SubmissionsTab({ submissions, participantId, participantName }) {
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [submissionDetail, setSubmissionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ field: "date", dir: "desc" });

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);

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

  async function handleViewSubmission(s) {
    setViewingSubmission(s);
    setSubmissionDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setFeedbackText("");
    setFeedbackSuccess(false);
    setFeedbackError(null);
    try {
      const detail = await api.caretakerGetSubmissionDetail(participantId, s.id);
      setSubmissionDetail(detail);
    } catch (err) {
      setDetailError(err.message || "Could not load submission details. Please try again.");
      setSubmissionDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSendFeedback() {
    if (!feedbackText.trim() || !viewingSubmission) return;
    setFeedbackSaving(true);
    setFeedbackError(null);
    try {
      await api.caretakerCreateFeedback(participantId, viewingSubmission.id, feedbackText.trim());
      setFeedbackSuccess(true);
      setFeedbackText("");
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      setFeedbackError(err.message || "Failed to send feedback. Please try again.");
    } finally {
      setFeedbackSaving(false);
    }
  }

  // ── Detail view for a single submission ──
  if (viewingSubmission) {
    const s = viewingSubmission;
    const detail = submissionDetail;
    return (
      <div className="space-y-4">
        <button onClick={() => { setViewingSubmission(null); setSubmissionDetail(null); setDetailError(null); setFeedbackText(""); setFeedbackSuccess(false); setFeedbackError(null); }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Submissions
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{s.formName}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs text-slate-400">Submitted {fmt(s.submittedAt)}</span>
                {detail && <span className="text-xs text-slate-400">{detail.answers.length} answers</span>}
              </div>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full capitalize">{s.status}</span>
          </div>
        </div>

        {/* Answers section */}
        {detailLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-200 rounded-xl" />)}
            </div>
          </div>
        ) : detailError ? (
          <div className="bg-white rounded-2xl shadow-sm border border-rose-200 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm font-semibold text-rose-700">Couldn't load submission details</p>
            <p className="text-xs text-rose-500 mt-1.5 max-w-sm mx-auto">{detailError}</p>
            <button onClick={() => handleViewSubmission(s)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors">
              Retry
            </button>
          </div>
        ) : detail && detail.answers && detail.answers.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Responses</p>
            </div>
            <div className="divide-y divide-slate-100">
              {detail.answers.map((a, i) => {
                const displayValue = a.value_text || (a.value_number != null ? String(a.value_number) : null) || a.value_date || (a.value_json ? JSON.stringify(a.value_json) : null) || "—";
                const isNumeric = a.value_number != null && !a.value_text;
                return (
                  <div key={a.answer_id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-slate-300 mt-0.5 shrink-0 w-6 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-600 leading-relaxed">{a.field_label || "Untitled field"}</p>
                        <div className="mt-2">
                          {isNumeric ? (
                            <span className="inline-flex items-center gap-1 text-lg font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg">
                              {a.value_number}
                            </span>
                          ) : (
                            <p className="text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{displayValue}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">No answer details available for this submission</p>
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
              The submission was recorded on {fmt(s.submittedAt)} but detailed answers could not be loaded.
            </p>
          </div>
        )}

        {/* Feedback form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leave Feedback on This Submission</p>
          <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3}
            placeholder={`Write feedback for ${participantName} about this submission...`}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
          {feedbackError && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{feedbackError}</p>
          )}
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
        <button key={s.id} onClick={() => handleViewSubmission(s)}
          className="w-full text-left bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all group">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{s.formName}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400"><span>Submitted {fmt(s.submittedAt)}</span></div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      ))}
    </div>
  );
}

// ─── Tab: Health Goals (real data) ──────────────────────────────────────────────

function GoalsTab({ goals, loading: goalsLoading }) {
  if (goalsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}</div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
      </div>
    );
  }

  if (!goals || goals.length === 0) {
    return (
      <EmptyPlaceholder
        icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        title="No health goals set"
        description="This participant hasn't set any health goals yet. Goals will appear here once they add them from their dashboard."
      />
    );
  }

  const statusColors = {
    active: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
    paused: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
    cancelled: { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400" },
  };

  const activeGoals = goals.filter(g => g.status === "active");
  const completedGoals = goals.filter(g => g.status === "completed");
  const otherGoals = goals.filter(g => g.status !== "active" && g.status !== "completed");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 text-center">
          <p className="text-2xl font-extrabold text-slate-800">{goals.length}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Goals</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-4 text-center">
          <p className="text-2xl font-extrabold text-blue-600">{activeGoals.length}</p>
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mt-1">Active</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 px-4 py-4 text-center">
          <p className="text-2xl font-extrabold text-emerald-600">{completedGoals.length}</p>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Completed</p>
        </div>
      </div>

      <div className="space-y-3">
        {[...activeGoals, ...completedGoals, ...otherGoals].map(g => {
          const sc = statusColors[g.status] || statusColors.active;
          const elementLabel = g.element?.label || g.name;
          const elementUnit = g.element?.unit || "";
          return (
            <div key={g.goal_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />
                    <h3 className="text-sm font-bold text-slate-800">{g.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 ml-5">
                    Tracking: <span className="font-semibold text-slate-500">{elementLabel}</span>
                    {elementUnit && <span className="text-slate-300 ml-1">({elementUnit})</span>}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${sc.bg} ${sc.text} ${sc.border}`}>{g.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 ml-5">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Target</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{g.target_value != null ? `${g.target_value} ${elementUnit}` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Start Date</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{g.start_date ? fmt(g.start_date) : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">End Date</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{g.end_date ? fmt(g.end_date) : "Ongoing"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Duration</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">
                    {g.start_date ? `${Math.max(0, Math.floor((Date.now() - new Date(g.start_date).getTime()) / 86400000))}d` : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Health Trends (real data) ─────────────────────────────────────────────

function TrendsTab({ trends, loading: trendsLoading }) {
  const [selectedElements, setSelectedElements] = useState([]);

  // Auto-select first 2 elements when trends load
  useEffect(() => {
    if (trends && trends.length > 0 && selectedElements.length === 0) {
      setSelectedElements(trends.slice(0, 2).map(t => t.element_id));
    }
  }, [trends]);

  if (trendsLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-16 bg-slate-200 rounded-2xl" />
        <div className="h-72 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}</div>
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <EmptyPlaceholder
        icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        title="No health trends data yet"
        description="Trends will appear here once health data points are being collected through survey submissions with data element mapping."
      />
    );
  }

  const toggleElement = (id) => {
    setSelectedElements(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const activeTrends = trends.filter(t => selectedElements.includes(t.element_id));

  const chartData = (() => {
    const dateMap = {};
    activeTrends.forEach(t => {
      t.points.forEach(p => {
        if (!dateMap[p.date]) dateMap[p.date] = { date: p.date };
        dateMap[p.date][t.label] = p.value;
      });
    });
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select Metrics to Chart</p>
        <div className="flex flex-wrap gap-2">
          {trends.map((t, i) => {
            const isSelected = selectedElements.includes(t.element_id);
            return (
              <button key={t.element_id} onClick={() => toggleElement(t.element_id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isSelected ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                style={isSelected ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? "bg-white/40" : ""}`}
                  style={!isSelected ? { backgroundColor: COLORS[i % COLORS.length] } : undefined} />
                {t.label}
                {t.unit && <span className={isSelected ? "text-white/60" : "text-slate-400"}>({t.unit})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {activeTrends.length > 0 && chartData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Health Trends Over Time</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={CHART_TT}
                  labelFormatter={(d) => new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {activeTrends.map((t) => (
                  <Line key={t.element_id} type="monotone" dataKey={t.label}
                    name={t.unit ? `${t.label} (${t.unit})` : t.label}
                    stroke={COLORS[trends.findIndex(x => x.element_id === t.element_id) % COLORS.length]}
                    strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Select at least one metric above to see trends.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTrends.map((t) => {
          const pts = t.points;
          const latest = pts[pts.length - 1];
          const earliest = pts[0];
          const change = pts.length >= 2 ? latest.value - earliest.value : null;
          const min = Math.min(...pts.map(p => p.value));
          const max = Math.max(...pts.map(p => p.value));
          const avg = (pts.reduce((sum, p) => sum + p.value, 0) / pts.length).toFixed(1);
          return (
            <div key={t.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[trends.findIndex(x => x.element_id === t.element_id) % COLORS.length] }} />
                <p className="text-sm font-bold text-slate-800">{t.label}</p>
                {t.unit && <span className="text-xs text-slate-400">({t.unit})</span>}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-lg font-extrabold text-slate-800">{latest.value}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Latest</p></div>
                <div><p className="text-lg font-extrabold text-slate-600">{avg}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Average</p></div>
                <div><p className="text-lg font-extrabold text-slate-500">{min}–{max}</p><p className="text-[10px] text-slate-400 uppercase font-semibold">Range</p></div>
                <div>
                  <p className={`text-lg font-extrabold ${change < 0 ? "text-emerald-600" : change > 0 ? "text-amber-600" : "text-slate-400"}`}>
                    {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}` : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Change</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 mt-2 text-center">{pts.length} data points · {fmt(earliest.date)} to {fmt(latest.date)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Notes & Feedback (unchanged — already working) ────────────────────────

function NotesTab({ participantId, participantName, feedbackItems, noteItems, highlightNoteId = null }) {
  const [notes, setNotes] = useState([...(feedbackItems || []), ...(noteItems || [])]);
  const [generalFeedbackText, setGeneralFeedbackText] = useState("");
  const [generalFeedbackSaving, setGeneralFeedbackSaving] = useState(false);
  const [generalFeedbackSuccess, setGeneralFeedbackSuccess] = useState(false);
  const [generalFeedbackError, setGeneralFeedbackError] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [writeTag, setWriteTag] = useState("check-in");
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    setNotes([...(feedbackItems || []), ...(noteItems || [])]);
  }, [feedbackItems, noteItems]);

  useEffect(() => {
    if (!highlightNoteId) return;
    const target = document.getElementById(`note-${highlightNoteId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightNoteId, notes]);

  async function handleSendGeneralFeedback() {
    if (!generalFeedbackText.trim()) return;
    setGeneralFeedbackSaving(true);
    setGeneralFeedbackError(null);
    try {
      const created = await api.caretakerCreateGeneralFeedback(participantId, generalFeedbackText.trim());
      // Use the API response so the new row has the real feedback_id, not a fake.
      // Falls back to a synthetic shape only if the backend response is unexpectedly empty.
      const newRow = created
        ? { ...transformFeedback(created), tag: "feedback" }
        : {
            id: `f${Date.now()}`,
            text: generalFeedbackText.trim(),
            createdAt: new Date().toISOString(),
            tag: "feedback",
            submissionId: null,
          };
      setNotes(prev => [newRow, ...prev]);
      setGeneralFeedbackSuccess(true);
      setGeneralFeedbackText("");
      setTimeout(() => setGeneralFeedbackSuccess(false), 3000);
    } catch (err) {
      setGeneralFeedbackError(err.message || "Failed to send feedback. Please try again.");
    } finally {
      setGeneralFeedbackSaving(false);
    }
  }

  async function handleSave() {
    if (!newNote.trim()) return;
    setSaving(true);
    setNoteError(null);
    try {
      const created = await api.caretakerCreateNote(participantId, newNote.trim(), writeTag);
      setNotes(prev => [transformNote(created), ...prev]);
      setNewNote("");
    } catch (err) {
      setNoteError(err.message || "Failed to save note. Please try again.");
    } finally {
      setSaving(false);
    }
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
    "participant-message": "bg-amber-50 text-amber-700 border-amber-100",
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">General Feedback</p>
        <textarea
          value={generalFeedbackText}
          onChange={e => setGeneralFeedbackText(e.target.value)}
          rows={3}
          placeholder={`Write feedback for ${participantName} (not tied to a specific submission)...`}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none"
        />
        {generalFeedbackError && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{generalFeedbackError}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          {generalFeedbackSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Feedback saved
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={handleSendGeneralFeedback}
            disabled={!generalFeedbackText.trim() || generalFeedbackSaving}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {generalFeedbackSaving ? "Saving…" : "Send Feedback"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Note</p>
        <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder={`Write a note about ${participantName}...`}
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
        {noteError && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{noteError}</p>
        )}
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
          <p className="text-xs text-amber-700">Notes and feedback are saved to the server and persist across sessions.</p>
        </div>
      </div>

      {notes.length === 0 && !search && tagFilter === "all" ? (
        <EmptyPlaceholder
          icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          title="No notes or feedback yet"
          description="Start by writing a note or sending general feedback above."
        />
      ) : (
        <>
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
                <div
                  key={n.id}
                  id={`note-${n.id}`}
                  className={`bg-white rounded-2xl shadow-sm border p-5 ${String(n.id) === String(highlightNoteId) ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-100"}`}
                >
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
  const [searchParams] = useSearchParams();

  const requestedTab = searchParams.get("tab");
  const highlightedNoteId = searchParams.get("note");
  const [activeTab, setActiveTab] = useState(requestedTab || "overview");
  const [participant, setParticipant] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [noteItems, setNoteItems] = useState([]);
  const [goals, setGoals] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ──────────────────────────────────────────────────────────────────────────────
  // Data fetching
  //
  // B12: previously these 6 fetches ran strictly sequentially —
  //   groups → list → group members → submissions → feedback → notes
  // — meaning the page took ~6× round-trip latency to render. The fetches
  // don't actually depend on each other (each one only needs participantId
  // or the auth context), with the single exception that we need to know
  // the participant's group_id before we can fetch group members for the
  // joined_at field.
  //
  // The fix is to run everything that has no inter-dependency in ONE
  // Promise.allSettled, then do ONE follow-up fetch for group members. Net
  // result: 2 sequential rounds of API latency instead of 6, plus the
  // already-parallel goals/trends fetches running alongside.
  //
  // Each sub-fetch still has its own try/catch (or settled-state check) so
  // a single broken endpoint doesn't blank the whole page.
  // ──────────────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      // Phase 1: fire all 5 caretaker-scoped fetches in parallel.
      const [groupsResult, listResult, subsResult, fbResult, notesResult] = await Promise.allSettled([
        api.caretakerGetGroups(),
        api.caretakerListParticipants(),
        api.caretakerListSubmissions(participantId),
        api.caretakerListFeedback(participantId),
        api.caretakerListNotes(participantId),
      ]);

      const groups = groupsResult.status === "fulfilled" && Array.isArray(groupsResult.value)
        ? groupsResult.value
        : [];
      const firstGroup = groups.length > 0 ? groups[0] : null;
      if (!firstGroup) {
        if (!background) {
          setError("You are not assigned to any groups.");
          setLoading(false);
        }
        return;
      }

      // B8: caretakerListParticipants returns { items, total_count } — find
      // this participant in the items list.
      const allParticipantsResponse = listResult.status === "fulfilled" ? listResult.value : null;
      const allParticipants = Array.isArray(allParticipantsResponse?.items)
        ? allParticipantsResponse.items
        : [];
      const thisParticipant = allParticipants.find(p => p.participant_id === participantId) || null;
      if (!thisParticipant) {
        if (!background) {
          setError("Participant not found.");
          setLoading(false);
        }
        return;
      }

      // Phase 2: ONE follow-up fetch for group members (needed for joined_at).
      // Sequential because it depends on the participant's group_id from Phase 1.
      let enrolledAt = null;
      try {
        const targetGroupId = thisParticipant.group_id || firstGroup.group_id;
        const members = await api.caretakerGetGroupMembers(targetGroupId);
        const thisMember = Array.isArray(members)
          ? members.find(m => m.participant_id === participantId)
          : null;
        if (thisMember?.joined_at) {
          enrolledAt = thisMember.joined_at;
        }
      } catch {
        // Non-critical — enrolledAt will show "—"
      }

      // Apply Phase 1 results to state.
      const participantGroup = groups.find(g => String(g.group_id) === String(thisParticipant.group_id));
      setParticipant(transformParticipant(thisParticipant, participantGroup?.name || firstGroup.name, enrolledAt));

      setSubmissions(
        subsResult.status === "fulfilled" && Array.isArray(subsResult.value)
          ? subsResult.value.map(transformSubmission)
          : []
      );
      setFeedbackItems(
        fbResult.status === "fulfilled" && Array.isArray(fbResult.value)
          ? fbResult.value.map(transformFeedback)
          : []
      );
      setNoteItems(
        notesResult.status === "fulfilled" && Array.isArray(notesResult.value)
          ? notesResult.value.map(transformNote)
          : []
      );
    } catch (err) {
      console.error("Failed to load participant data:", err);
      if (!background) setError("Something went wrong loading participant data.");
    } finally {
      if (!background) setLoading(false);
    }
  }, [participantId]);

  // Fetch goals (non-blocking, separate loading state)
  const fetchGoals = useCallback(async ({ background = false } = {}) => {
    if (!background) setGoalsLoading(true);
    try {
      const data = await api.caretakerGetGoals(participantId);
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      // Leave existing goals in place on background refresh errors.
      if (!background) setGoals([]);
    } finally {
      if (!background) setGoalsLoading(false);
    }
  }, [participantId]);

  // Fetch trends (non-blocking, separate loading state)
  const fetchTrends = useCallback(async ({ background = false } = {}) => {
    if (!background) setTrendsLoading(true);
    try {
      const data = await api.caretakerGetHealthTrends(participantId);
      // Filter out elements with no data points
      setTrends(Array.isArray(data) ? data.filter(t => t.points && t.points.length > 0) : []);
    } catch {
      if (!background) setTrends([]);
    } finally {
      if (!background) setTrendsLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    fetchData();
    fetchGoals();
    fetchTrends();
  }, [fetchData, fetchGoals, fetchTrends]);

  // ── Auto-refresh ────────────────────────────────────────────────────────────
  //
  // Re-pulls participant data, goals, and trends every 30s in the background.
  // Skips the very first call (initial fetch is handled by the useEffect
  // above). Sub-components like NotesTab re-sync their internal state from
  // props via their own useEffects, so new data flows through without
  // remounting and without clobbering any draft/modal state inside them.
  const backgroundRefresh = useCallback(async ({ background = false } = {}) => {
    if (!background) return;
    await Promise.all([
      fetchData({ background: true }),
      fetchGoals({ background: true }),
      fetchTrends({ background: true }),
    ]);
  }, [fetchData, fetchGoals, fetchTrends]);

  usePolling(backgroundRefresh, 30_000);

  useEffect(() => {
    if (!requestedTab) return;
    setActiveTab(requestedTab);
  }, [requestedTab]);

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
          <Avatar fullName={p.fullName} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{p.fullName}</h1>
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
      {activeTab === "overview" && <OverviewTab p={p} trends={trends} />}
      {activeTab === "submissions" && <SubmissionsTab submissions={submissions} participantId={p.id} participantName={p.fullName} />}
      {activeTab === "goals" && <GoalsTab goals={goals} loading={goalsLoading} />}
      {activeTab === "trends" && <TrendsTab trends={trends} loading={trendsLoading} />}
      {activeTab === "notes" && (
        <NotesTab
          participantId={p.id}
          participantName={p.fullName}
          feedbackItems={feedbackItems}
          noteItems={noteItems}
          highlightNoteId={highlightedNoteId}
        />
      )}
    </div>
  );
}

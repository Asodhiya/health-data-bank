import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";

// ─── Status helpers (4-bucket activity model — matches CaretakerDashboard) ─────

const STATUS_LABELS = {
  highly_active: "Highly Active",
  moderately_active: "Moderately Active",
  low_active: "Low Activity",
  inactive: "Inactive",
};

const STATUS_DOT_COLOR = {
  highly_active: "bg-emerald-400",
  moderately_active: "bg-blue-400",
  low_active: "bg-amber-400",
  inactive: "bg-slate-300",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Unknown";
}

// ─── Backend query param builder (B6 + B7) ────────────────────────────────────
//
// Translates the frontend filter/search/sort UI state into the query parameters
// the backend's GET /caretaker/participants route expects. Centralizing this
// here keeps callers (initial fetch, filter-change refetch, "load more") in
// sync, and pins the value mapping (B7) to one place — e.g. the UI uses
// "complete" but the backend expects "completed".

function buildParticipantsQueryParams(filters, search, sort) {
  const params = {};

  // Free-text search
  const trimmedSearch = (search || "").trim();
  if (trimmedSearch) params.q = trimmedSearch;

  // Status — backend accepts the same 5 values plus "active" as "any non-inactive"
  if (filters.status && filters.status !== "all") {
    params.status = filters.status;
  }

  // Gender — passed through (backend lower-cases for comparison)
  if (filters.gender && filters.gender !== "all") {
    params.gender = filters.gender;
  }

  // Alerts → has_alerts boolean
  if (filters.flagged === "flagged") params.has_alerts = true;
  else if (filters.flagged === "clear") params.has_alerts = false;

  // Age range — only send if a real number was typed
  const ageMin = Number(filters.ageMin);
  const ageMax = Number(filters.ageMax);
  if (filters.ageMin !== "" && Number.isFinite(ageMin)) params.age_min = ageMin;
  if (filters.ageMax !== "" && Number.isFinite(ageMax)) params.age_max = ageMax;

  // Survey progress — B7: rename frontend "complete" → backend "completed"
  if (filters.surveyProgress && filters.surveyProgress !== "all") {
    params.survey_progress = filters.surveyProgress === "complete"
      ? "completed"
      : filters.surveyProgress;
  }

  // Goal progress — same B7 rename
  if (filters.goalProgress && filters.goalProgress !== "all") {
    params.goal_progress = filters.goalProgress === "complete"
      ? "completed"
      : filters.goalProgress;
  }

  // Sort — B7: rename frontend "lastActive" → backend "last_active"
  if (sort && sort.field) {
    params.sort_by = sort.field === "lastActive" ? "last_active" : sort.field;
    params.sort_dir = sort.dir === "desc" ? "desc" : "asc";
  }

  return params;
}

// ─── Transform: Backend → Frontend shape ─────────────────────────────────────

function transformParticipant(p, groupsMap) {
  // We keep firstName/lastName for backwards compat with the Avatar component
  // and search/sort heuristics, but `fullName` is the source of truth for
  // display because we can't reliably split "Mary Anne Smith" or "Jean van der
  // Berg" into first/last without structured fields from the backend.
  const fullName = (p.name || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const isActive = p.status !== "inactive";
  const surveysDone = Number(p.survey_submitted_count ?? 0);
  const surveysTotal = Number(p.survey_deployed_count ?? 0);
  const goalsDone = Number(p.goals_completed_count ?? 0);
  const goalsTotal = Number(p.goals_total_count ?? 0);
  const flags = [];
  if (p.status === "inactive") flags.push("Inactive");
  if (p.status === "low_active") flags.push("Low activity");
  if (p.survey_progress === "not_started") flags.push("No surveys completed");
  const gInfo = groupsMap ? groupsMap[p.group_id] : null;
  return {
    id: p.participant_id,
    firstName, lastName, fullName,
    email: p.email || "",
    phone: p.phone || "",
    dob: p.dob || null,
    gender: p.gender || "—",
    age: p.age != null ? Math.round(p.age) : null,
    status: p.status || "inactive",
    isActive,
    enrolledAt: p.enrolled_at || null,
    lastActive: p.last_login_at || p.last_submission_at || null,
    healthGoals: goalsDone,
    healthGoalsTotal: goalsTotal,
    surveysDone,
    surveysTotal,
    flags,
    groupId: p.group_id || null,
    groupName: gInfo ? gInfo.name : null,
  };
}

function transformGroup(g) {
  return { id: g.group_id, name: g.name, description: g.description || "" };
}

function transformGroupForm(f) {
  return {
    deploymentId: f.deployment_id,
    formId: f.form_id,
    groupId: f.group_id,
    groupName: f.group_name,
    title: f.form_title,
    description: f.form_description || "",
    formStatus: f.form_status || "unknown",
    deployedAt: f.deployed_at || null,
    revokedAt: f.revoked_at || null,
    isActive: Boolean(f.is_active),
    participantCount: Number(f.participant_count || 0),
    submittedCount: Number(f.submitted_count || 0),
    completionRate: Number(f.completion_rate || 0),
  };
}

function transformInvite(inv) {
  return {
    id: inv.invite_id,
    email: inv.email,
    status: inv.status,
    sentAt: inv.created_at || null,
    expiresAt: inv.expires_at || null,
    acceptedAt: inv.status === "accepted" ? (inv.created_at || null) : null,
    revokedAt: null,
    role: inv.role || null,
    groupId: inv.group_id || null,
    groupName: inv.group_name || null,
  };
}

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
function daysUntil(d) { if (!d) return ""; const diff = Math.floor((new Date(d).getTime() - Date.now()) / 86400000); if (diff < 0) return "Expired"; if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; return `${diff}d left`; }

// ─── Sub-Components ─────────────────────────────────────────────────────────────

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
  const sz = size === "lg" ? "w-14 h-14 text-lg" : "w-9 h-9 text-xs";
  return <div className={`rounded-full ${color} text-white flex items-center justify-center font-bold shrink-0 ${sz}`}>{initials}</div>;
}

function StatusDot({ status }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_DOT_COLOR[status] || "bg-slate-300"}`} />;
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

function Tip({ text, children }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-800 rotate-45" />
      </div>
    </div>
  );
}

function InviteStatusBadge({ status }) {
  const styles = { pending: "bg-amber-50 text-amber-700 border-amber-200", accepted: "bg-emerald-50 text-emerald-700 border-emerald-200", expired: "bg-slate-100 text-slate-500 border-slate-200", revoked: "bg-rose-50 text-rose-700 border-rose-200" };
  const icons = {
    pending: <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    accepted: <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    expired: <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    revoked: <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  };
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${styles[status] || styles.pending}`}>{icons[status]} {status}</span>;
}

function FormStatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {isActive ? "Active" : "Revoked"}
    </span>
  );
}

function FormsPanel({ forms, groups, onViewForm, hasMore, loadingMore, onLoadMore, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-slate-500">Loading forms...</p>
        </div>
      </div>
    );
  }

  if (!forms.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No deployed forms found for this scope.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Deployed Forms</p>
        <p className="text-xs text-slate-400">{forms.length} total</p>
      </div>
      <div className="divide-y divide-slate-100">
        {forms.map((f) => {
          const submitted = Math.min(f.submittedCount, f.participantCount);
          return (
            <div key={f.deploymentId} className="px-4 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{f.title}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <GroupBadge groupId={f.groupId} groupName={f.groupName} groups={groups} />
                    <FormStatusBadge isActive={f.isActive} />
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Deployed: <span className="font-medium text-slate-600">{fmt(f.deployedAt)}</span>
                </p>
              </div>
                <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">
                    Completion {submitted}/{f.participantCount}
                  </span>
                  <span className="font-semibold text-slate-700">{Math.round(f.completionRate)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, f.completionRate))}%` }} />
                </div>
                </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => onViewForm?.(f)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0A9 9 0 113 12a9 9 0 0118 0z" /></svg>
                  View Questions
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Forms"}
          </button>
        </div>
      )}
    </div>
  );
}

function FormDetailModal({ form, loading, error, onClose }) {
  if (!form && !loading && !error) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute inset-x-4 top-8 bottom-8 max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{form?.title || "Form Details"}</p>
            {form?.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{form.description}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {loading && <p className="text-sm text-slate-500">Loading questions...</p>}
          {!loading && error && <p className="text-sm text-rose-600">{error}</p>}
          {!loading && !error && form && (
            <div className="space-y-3">
              {(form.fields || [])
                .slice()
                .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                .map((field, idx) => (
                  <div key={field.field_id || idx} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {idx + 1}. {field.label}
                        {field.is_required ? <span className="text-rose-500 ml-1">*</span> : null}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {field.field_type}
                      </span>
                    </div>
                    {Array.isArray(field.options) && field.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {field.options
                          .slice()
                          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                          .map((opt) => (
                            <span key={opt.option_id || `${field.field_id}-${opt.value}`} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                              {opt.label}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              {(form.fields || []).length === 0 && <p className="text-sm text-slate-500">No questions found for this form.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── NEW: Group Badge ───────────────────────────────────────────────────────────

const GROUP_COLORS = [
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
];

function getGroupColor(groupId, groups) {
  const idx = groups.findIndex(g => g.id === groupId);
  return GROUP_COLORS[idx >= 0 ? idx % GROUP_COLORS.length : 0];
}

function GroupBadge({ groupId, groupName, groups, size = "sm" }) {
  const c = getGroupColor(groupId, groups);
  const sz = size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${c.bg} ${c.text} border ${c.border} ${sz} rounded-full`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      {groupName}
    </span>
  );
}

// ─── NEW: Group Selector ────────────────────────────────────────────────────────

function GroupSelector({ groups, allParticipants, selectedGroupId, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedGroup = selectedGroupId === "all" ? null : groups.find(g => g.id === selectedGroupId);
  const label = selectedGroup ? selectedGroup.name : "All Groups";
  const totalCount = allParticipants.length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm w-full sm:w-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <span className="truncate">{label}</span>
        <span className="text-xs text-slate-400 font-normal ml-1">
          ({selectedGroupId === "all" ? `${totalCount} total` : `${allParticipants.filter(p => p.groupId === selectedGroupId).length} members`})
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ml-auto sm:ml-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-full mt-1.5 z-20 w-full sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <button onClick={() => { onChange("all"); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedGroupId === "all" ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedGroupId === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${selectedGroupId === "all" ? "text-blue-700" : "text-slate-700"}`}>All Groups</p>
              <p className="text-xs text-slate-400">{totalCount} participants across {groups.length} groups</p>
            </div>
            {selectedGroupId === "all" && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          </button>
          <div className="border-t border-slate-100" />
          {groups.map(g => {
            const memberCount = allParticipants.filter(p => p.groupId === g.id).length;
            const isSelected = selectedGroupId === g.id;
            const gc = getGroupColor(g.id, groups);
            return (
              <button key={g.id} onClick={() => { onChange(g.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-600 text-white" : `${gc.bg} ${gc.text}`}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-slate-700"}`}>{g.name}</p>
                  <p className="text-xs text-slate-400">{memberCount} participants</p>
                </div>
                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </button>
            );
          })}
        </div>
      </>)}
    </div>
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
            <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
              <option value="all">All</option>
              <option value="active">Any Active</option>
              <option value="highly_active">Highly Active</option>
              <option value="moderately_active">Moderately Active</option>
              <option value="low_active">Low Activity</option>
              <option value="inactive">Inactive</option>
            </select>
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
      await api.sendInvite(email.trim(), "participant", group.id);
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
  const [mode, setMode] = useState("note"); // "note" | "feedback"
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isFeedback = mode === "feedback";

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (isFeedback) {
        await api.caretakerCreateGeneralFeedback(participant.id, text.trim());
      } else {
        await api.caretakerCreateNote(participant.id, text.trim());
      }
      onSave(text.trim(), mode);
    } catch (err) {
      setError(err.message || (isFeedback ? "Failed to send feedback. Please try again." : "Failed to save note. Please try again."));
      return;
    } finally {
      setSaving(false);
    }
  }

  // Mode-dependent copy
  const title = isFeedback ? "Send Feedback" : "Add Private Note";
  const subtitle = isFeedback ? "The participant will be notified" : "Only you can see this";
  const placeholder = isFeedback
    ? "Write feedback that the participant will see. They'll receive a notification."
    : "Write a private note for your own records. The participant will not see this.";
  const buttonLabel = saving
    ? (isFeedback ? "Sending…" : "Saving…")
    : (isFeedback ? "Send Feedback" : "Save Note");

  // Mode-dependent styling
  const accent = isFeedback
    ? { iconBg: "bg-emerald-100", iconText: "text-emerald-600", focusRing: "focus:ring-emerald-500", button: "bg-emerald-600 hover:bg-emerald-700" }
    : { iconBg: "bg-blue-100",    iconText: "text-blue-600",    focusRing: "focus:ring-blue-500",    button: "bg-blue-600 hover:bg-blue-700" };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-md space-y-4">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full ${accent.iconBg} flex items-center justify-center shrink-0 transition-colors`}>
            {isFeedback ? (
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${accent.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${accent.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">
              For <span className="font-semibold text-slate-700">{participant.fullName}</span> · {subtitle}
            </p>
          </div>
        </div>

        {/* Mode toggle — prominent, can't be missed */}
        <div className="bg-slate-100 rounded-xl p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setMode("note")}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${mode === "note" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            PRIVATE NOTE
          </button>
          <button
            type="button"
            onClick={() => setMode("feedback")}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${mode === "feedback" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            SEND TO PARTICIPANT
          </button>
        </div>

        {/* Warning banner in feedback mode — extra safety */}
        {isFeedback && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-emerald-800">
              The participant will see this message and receive a notification. Switch to Private Note if you want to keep it to yourself.
            </p>
          </div>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          placeholder={placeholder}
          disabled={saving}
          className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 ${accent.focusRing} focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none disabled:opacity-60`}
        />

        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={!text.trim() || saving} className={`flex-1 py-2.5 text-sm font-bold text-white ${accent.button} rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invites Panel ──────────────────────────────────────────────────────────────

function InvitesPanel({ invites, onRevoke, onResend, onOpenInviteModal, hasMore, loadingMore, onLoadMore }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ field: "sentAt", dir: "desc" });
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const counts = useMemo(() => {
    const c = { all: invites.length, pending: 0, accepted: 0, expired: 0, revoked: 0 };
    invites.forEach(inv => { c[inv.status] = (c[inv.status] || 0) + 1; });
    return c;
  }, [invites]);

  const filtered = useMemo(() => {
    let list = invites.filter(inv => {
      if (search && !inv.email.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.field === "sentAt") return dir * (new Date(a.sentAt) - new Date(b.sentAt));
      if (sort.field === "email") return dir * a.email.localeCompare(b.email);
      if (sort.field === "status") { const order = { pending: 0, expired: 1, revoked: 2, accepted: 3 }; return dir * ((order[a.status] ?? 9) - (order[b.status] ?? 9)); }
      return 0;
    });
    return list;
  }, [invites, search, statusFilter, sort]);

  function toggleSort(field) {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }

  return (
    <div className="space-y-3">
      {/* Invite button */}
      <div className="flex justify-end">
        <button onClick={onOpenInviteModal} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          Invite Participant
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-slate-800">{counts.all}</p><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Sent</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-amber-600">{counts.pending}</p><p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mt-1">Pending</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-emerald-600">{counts.accepted}</p><p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Accepted</p></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4"><p className="text-2xl font-extrabold text-slate-400">{counts.expired + counts.revoked}</p><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Expired / Revoked</p></div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Status</span>
          {["all", "pending", "accepted", "expired", "revoked"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize shrink-0 ${statusFilter === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {s === "all" ? "All" : s}
              <span className={`text-xs ${statusFilter === s ? "text-blue-200" : "text-slate-400"}`}>({counts[s] || 0})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort</span>
          {[{ field: "sentAt", label: "Date Sent" }, { field: "email", label: "Email" }, { field: "status", label: "Status" }].map(s => (
            <button key={s.field} onClick={() => toggleSort(s.field)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${sort.field === s.field ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {s.label}
              {sort.field === s.field && <ChevronIcon direction={sort.dir === "asc" ? "up" : "down"} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">Showing {filtered.length} of {invites.length} invites</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          <p className="text-sm text-slate-400">No invites match your search.</p>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear filters</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
          <div className="hidden md:flex items-center gap-3 px-5 py-3 bg-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-1">Email</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-20 text-center">Status</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-24 text-center">Sent</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-24 text-center">Outcome</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-24 text-right">Actions</span>
          </div>
          {filtered.map(inv => (
            <div key={inv.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{inv.email}</p>
                <div className="md:hidden flex items-center gap-2 mt-1.5 flex-wrap">
                  <InviteStatusBadge status={inv.status} />
                  <span className="text-xs text-slate-400">Sent {daysSince(inv.sentAt)}</span>
                  {inv.status === "pending" && <span className="text-xs text-amber-600 font-medium">{daysUntil(inv.expiresAt)}</span>}
                  {inv.status === "accepted" && inv.acceptedAt && <span className="text-xs text-emerald-600">Joined {fmt(inv.acceptedAt)}</span>}
                  {inv.status === "revoked" && inv.revokedAt && <span className="text-xs text-rose-500">Revoked {fmt(inv.revokedAt)}</span>}
                </div>
              </div>
              <div className="hidden md:block w-20 text-center"><InviteStatusBadge status={inv.status} /></div>
              <div className="hidden md:block w-24 text-center"><span className="text-xs text-slate-500">{fmt(inv.sentAt)}</span></div>
              <div className="hidden md:block w-24 text-center">
                {inv.status === "pending" && <span className="text-xs text-amber-600 font-medium">{daysUntil(inv.expiresAt)}</span>}
                {inv.status === "accepted" && <span className="text-xs text-emerald-600">{fmt(inv.acceptedAt)}</span>}
                {inv.status === "expired" && <span className="text-xs text-slate-400">Expired {fmt(inv.expiresAt)}</span>}
                {inv.status === "revoked" && <span className="text-xs text-rose-500">{fmt(inv.revokedAt)}</span>}
              </div>
              <div className="flex items-center gap-1 md:w-24 md:justify-end">
                {inv.status === "pending" && (
                  confirmRevoke === inv.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { onRevoke(inv.id); setConfirmRevoke(null); }} className="px-2 py-1 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors">Revoke</button>
                      <button onClick={() => setConfirmRevoke(null)} className="px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <Tip text="Resend invite"><button onClick={() => onResend(inv.email, inv.groupId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button></Tip>
                      <Tip text="Revoke invite"><button onClick={() => setConfirmRevoke(inv.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg></button></Tip>
                    </>
                  )
                )}
                {(inv.status === "expired" || inv.status === "revoked") && (
                  <Tip text="Resend invite"><button onClick={() => onResend(inv.email, inv.groupId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button></Tip>
                )}
                {inv.status === "accepted" && (
                  <span className="text-xs text-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {hasMore && (
        <div className="flex justify-end">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More Invites"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel (UPDATED: now shows GroupBadge) ───────────────────────────────

function ParticipantDetailPanel({ participant: p, groups, onClose, onViewFull }) {
  const sPct = Math.round(pct(p.surveysDone, p.surveysTotal));
  const gPct = Math.round(pct(p.healthGoals, p.healthGoalsTotal));

  // ── Fetch data elements tracked for this participant ──
  const [elements, setElements] = useState(null);
  const [elementsLoading, setElementsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setElementsLoading(true);
    setElements(null);

    api.caretakerGetParticipantDataElements(p.id)
      .then((data) => {
        if (!cancelled) setElements(data || []);
      })
      .catch(() => {
        if (!cancelled) setElements([]);
      })
      .finally(() => {
        if (!cancelled) setElementsLoading(false);
      });

    return () => { cancelled = true; };
  }, [p.id]);

  const withData = (elements || []).filter((el) => el.data_point_count > 0);

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
            <Avatar fullName={p.fullName} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-800">{p.fullName}</p>
              <p className="text-xs text-slate-400 truncate">{p.email || "—"}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5"><StatusDot status={p.status} /><span className="text-xs text-slate-400">{getStatusLabel(p.status)}</span></div>
                {p.age != null && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">Age {p.age}</span></>}
                {getAge(p.dob) !== null && !p.age && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">Age {getAge(p.dob)}</span></>}
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">Last active {daysSince(p.lastActive) || "—"}</span>
              </div>
              {p.groupName && <div className="mt-2"><GroupBadge groupId={p.groupId} groupName={p.groupName} groups={groups} size="lg" /></div>}
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
            <InfoRow label="Date of Birth" value={p.dob ? `${fmt(p.dob)} (age ${getAge(p.dob)})` : "—"} />
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
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Health Data Elements</p>
            {elementsLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <p className="text-sm text-slate-400">Loading...</p>
                </div>
              </div>
            ) : withData.length > 0 ? (
              <div className="space-y-2">
                {withData.map((el) => (
                  <div key={el.element_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{el.label || el.code}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {el.unit && <span className="text-[11px] text-slate-400">{el.unit}</span>}
                        {el.unit && el.form_names?.length > 0 && <span className="text-[11px] text-slate-300">·</span>}
                        {el.form_names?.length > 0 && <span className="text-[11px] text-slate-400 truncate">{el.form_names.join(", ")}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{el.data_point_count}</span>
                      {el.is_currently_deployed && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Currently deployed" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm text-slate-400">No health data submitted yet.</p>
              </div>
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

// ─── Placeholder: No Groups Assigned ─────────────────────────────────────────

function NoGroupsPlaceholder() {
  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Participants</h1>
        <p className="text-sm text-slate-400 mt-1">Manage and monitor your assigned participants.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">No groups assigned yet</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            You haven't been assigned to any participant groups. Once an admin assigns you to a group, your participants will appear here.
          </p>
          <div className="mt-8 w-full max-w-sm space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">What you'll be able to do</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", label: "View participant submissions" },
                { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", label: "Generate health reports" },
                { icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", label: "Provide feedback on progress" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                  </div>
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-left max-w-sm w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-blue-700">Contact your administrator to be assigned to a participant group.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder: Group Exists but No Participants ───────────────────────────

function NoParticipantsPlaceholder({ group, onInvite }) {
  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Participants</h1>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {group.name}
          </span>
          <span className="text-xs text-slate-400">0 participants</span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["Total", "Active", "Inactive", "Flagged"].map(label => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
            <p className="text-2xl font-extrabold text-slate-300">0</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">No participants yet</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            Your group <span className="font-semibold text-slate-600">"{group.name}"</span> doesn't have any participants yet. Invite participants to get started.
          </p>
          <button onClick={onInvite} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Invite Participant
          </button>
          <div className="mt-6 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-left max-w-sm w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-xs text-amber-700">Invited participants will appear here once they accept their invitation and complete registration.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder: Error State ────────────────────────────────────────────────

function ErrorPlaceholder({ onRetry }) {
  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Participants</h1>
        <p className="text-sm text-slate-400 mt-1">Manage and monitor your assigned participants.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Something went wrong</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-md">We couldn't load your participant data. This could be a temporary connection issue.</p>
          <button onClick={onRetry} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = { status: "all", gender: "all", flagged: "all", ageMin: "", ageMax: "", surveyProgress: "all", goalProgress: "all" };
const PAGE_SIZE = 10;

export default function MyParticipantsPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [invites, setInvites] = useState([]);
  const [forms, setForms] = useState([]);
  const [participantsHasMore, setParticipantsHasMore] = useState(false);
  const [participantsOffset, setParticipantsOffset] = useState(0);
  const [participantsTotal, setParticipantsTotal] = useState(0);
  const [participantsLoadingMore, setParticipantsLoadingMore] = useState(false);
  const [invitesHasMore, setInvitesHasMore] = useState(false);
  const [invitesOffset, setInvitesOffset] = useState(0);
  const [invitesLoadingMore, setInvitesLoadingMore] = useState(false);
  const [formsHasMore, setFormsHasMore] = useState(false);
  const [formsOffset, setFormsOffset] = useState(0);
  const [formsLoadingMore, setFormsLoadingMore] = useState(false);
  const [formsLoading, setFormsLoading] = useState(false);
  const [view, setView] = useState("participants");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [participantsRefreshing, setParticipantsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ field: "name", dir: "asc" });
  const [detailParticipant, setDetailParticipant] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [toast, setToast] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formDetailLoading, setFormDetailLoading] = useState(false);
  const [formDetailError, setFormDetailError] = useState("");
  const [selectedFormDetail, setSelectedFormDetail] = useState(null);
  const hasBootstrappedRef = useRef(false);
  const groupsMapRef = useRef({});
  const [participantSummary, setParticipantSummary] = useState({ total: 0, active: 0, inactive: 0, flagged: 0 });
  const [activityCounts, setActivityCounts] = useState({ highly_active: 0, moderately_active: 0, low_active: 0, inactive: 0 });
  const [formsSummary, setFormsSummary] = useState({ total: 0, active: 0, revoked: 0 });

  function showToastMsg(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // ── Invite handlers ─────────────────────────────────────────────────────────

  async function handleRevokeInvite(inviteId) {
    try {
      await api.caretakerRevokeInvite(inviteId);
      showToastMsg("Invite revoked successfully.");
      await loadInvitesPage({ reset: true, offsetValue: 0 });
    } catch (err) {
      showToastMsg(`Failed to revoke invite: ${err.message || "Please try again."}`);
    }
  }

  async function handleResendInvite(email, groupId) {
    try {
      await api.sendInvite(email, "participant", groupId);
      showToastMsg(`Invite resent to ${email}.`);
      await loadInvitesPage({ reset: true, offsetValue: 0 });
    } catch (err) {
      showToastMsg(`Failed to resend invite: ${err.message || "Please try again."}`);
    }
  }

  async function handleInviteSent(email) {
    showToastMsg(`Invite sent to ${email}. Admin notified.`);
    setShowInvite(false);
    await loadInvitesPage({ reset: true, offsetValue: 0 });
  }

  async function handleViewForm(formRow) {
    setFormModalOpen(true);
    setFormDetailLoading(true);
    setFormDetailError("");
    setSelectedFormDetail({
      title: formRow.title,
      description: formRow.description,
      fields: [],
    });
    try {
      const detail = await api.caretakerGetFormDetail(formRow.formId, formRow.groupId);
      setSelectedFormDetail(detail);
    } catch (err) {
      setFormDetailError(err?.message || "Failed to load form questions.");
    } finally {
      setFormDetailLoading(false);
    }
  }

  async function handleLoadMoreParticipants() {
    if (participantsLoadingMore || !participantsHasMore) return;
    setParticipantsLoadingMore(true);
    await loadParticipantsPage({
      reset: false,
      offsetValue: participantsOffset,
      queryParamsOverride: buildParticipantsQueryParams(filters, debouncedSearch, sort),
    });
    setParticipantsLoadingMore(false);
  }

  async function handleLoadMoreForms() {
    if (formsLoadingMore || !formsHasMore) return;
    setFormsLoadingMore(true);
    await loadFormsPage({ reset: false, offsetValue: formsOffset });
    setFormsLoadingMore(false);
  }

  async function handleLoadMoreInvites() {
    if (invitesLoadingMore || !invitesHasMore) return;
    setInvitesLoadingMore(true);
    await loadInvitesPage({ reset: false, offsetValue: invitesOffset });
    setInvitesLoadingMore(false);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const selectedGroupQuery = selectedGroupId !== "all" ? selectedGroupId : null;

  const loadSummaries = useCallback(async () => {
    const [pSummary, fSummary, aCounts] = await Promise.all([
      api.caretakerGetParticipantsSummary(selectedGroupQuery).catch(() => ({ total: 0, active: 0, inactive: 0, flagged: 0 })),
      api.caretakerGetFormsSummary(selectedGroupQuery).catch(() => ({ total: 0, active: 0, revoked: 0 })),
      api.caretakerGetActivityCounts(selectedGroupQuery).catch(() => ({ highly_active: 0, moderately_active: 0, low_active: 0, inactive: 0 })),
    ]);
    setParticipantSummary({
      total: Number(pSummary?.total || 0),
      active: Number(pSummary?.active || 0),
      inactive: Number(pSummary?.inactive || 0),
      flagged: Number(pSummary?.flagged || 0),
    });
    setFormsSummary({
      total: Number(fSummary?.total || 0),
      active: Number(fSummary?.active || 0),
      revoked: Number(fSummary?.revoked || 0),
    });
    setActivityCounts({
      highly_active: Number(aCounts?.highly_active || 0),
      moderately_active: Number(aCounts?.moderately_active || 0),
      low_active: Number(aCounts?.low_active || 0),
      inactive: Number(aCounts?.inactive || 0),
    });
  }, [selectedGroupQuery]);

  const loadParticipantsPage = useCallback(async ({ reset = false, groupsMapOverride = null, offsetValue = 0, queryParamsOverride = {} } = {}) => {
    const nextOffset = reset ? 0 : offsetValue;
    const params = {
      limit: PAGE_SIZE,
      offset: nextOffset,
      ...(selectedGroupQuery ? { group_id: selectedGroupQuery } : {}),
      ...queryParamsOverride,
    };
    // B8: response is now { items, total_count } instead of a bare array.
    const participantData = await api.caretakerListParticipants(params).catch(() => null);
    const page = Array.isArray(participantData?.items) ? participantData.items : [];
    const total = Number(participantData?.total_count ?? 0);
    const groupsMap = groupsMapOverride || groupsMapRef.current || {};
    const transformed = page.map((p) => transformParticipant(p, groupsMap));
    setParticipants((prev) => (reset ? transformed : [...prev, ...transformed]));
    const newOffset = nextOffset + transformed.length;
    setParticipantsOffset(newOffset);
    setParticipantsTotal(total);
    // Trust total_count for hasMore. Falls back to length heuristic if the
    // backend ever returns a malformed response.
    setParticipantsHasMore(participantData?.total_count != null
      ? newOffset < total
      : transformed.length === PAGE_SIZE);
  }, [selectedGroupQuery]);

  const loadFormsPage = useCallback(async ({ reset = false, offsetValue = 0 } = {}) => {
    if (reset) setFormsLoading(true);
    const nextOffset = reset ? 0 : offsetValue;
    try {
      const formData = await api.caretakerListForms(selectedGroupQuery, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      }).catch(() => []);
      const page = Array.isArray(formData) ? formData : [];
      const transformed = page.map(transformGroupForm);
      setForms((prev) => (reset ? transformed : [...prev, ...transformed]));
      setFormsOffset(nextOffset + transformed.length);
      setFormsHasMore(transformed.length === PAGE_SIZE);
    } finally {
      if (reset) setFormsLoading(false);
    }
  }, [selectedGroupQuery]);

  const loadInvitesPage = useCallback(async ({ reset = false, offsetValue = 0 } = {}) => {
    const nextOffset = reset ? 0 : offsetValue;
    const inviteData = await api.caretakerListInvites(PAGE_SIZE, nextOffset).catch(() => []);
    const page = Array.isArray(inviteData) ? inviteData : [];
    const transformed = page.map(transformInvite);
    setInvites((prev) => (reset ? transformed : [...prev, ...transformed]));
    setInvitesOffset(nextOffset + transformed.length);
    setInvitesHasMore(transformed.length === PAGE_SIZE);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const groupData = await api.caretakerGetGroups().catch(() => []);
      const transformedGroups = Array.isArray(groupData) ? groupData.map(transformGroup) : [];
      setGroups(transformedGroups);
      const initialGroupMap = {};
      transformedGroups.forEach((g) => { initialGroupMap[g.id] = { group_id: g.id, name: g.name }; });
      groupsMapRef.current = initialGroupMap;
      setParticipants([]);
      setParticipantsOffset(0);
      await loadParticipantsPage({
        reset: true,
        groupsMapOverride: initialGroupMap,
        offsetValue: 0,
        queryParamsOverride: buildParticipantsQueryParams(filters, debouncedSearch, sort),
      });
      await loadSummaries();
      // Lazy tabs: do not load invites/forms until user opens those tabs.
      setInvites([]);
      setInvitesOffset(0);
      setInvitesHasMore(false);
      setForms([]);
      setFormsOffset(0);
      setFormsHasMore(false);
      setFormsLoading(false);
      hasBootstrappedRef.current = true;
    } catch (err) {
      console.error("Failed to load caretaker data:", err);
      setError(true);
    }
    setLoading(false);
  }, [loadParticipantsPage, loadSummaries]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply URL params from dashboard quick actions once groups have loaded.
  // e.g. /caretaker/participants?view=invites&group=<uuid> from the dashboard
  // "Invite Participant" dropdown.
  useEffect(() => {
    if (groups.length === 0) return;
    const viewParam = searchParams.get("view");
    const groupParam = searchParams.get("group");
    if (!viewParam && !groupParam) return;

    if (groupParam && groups.some(g => g.id === groupParam)) {
      setSelectedGroupId(groupParam);
    }
    if (viewParam === "invites") {
      setView("invites");
      setShowInvite(true);
    } else if (viewParam === "participants" || viewParam === "forms") {
      setView(viewParam);
    }

    // Clear the params so a manual refresh doesn't re-open the modal.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  useEffect(() => {
    if (view === "forms" && forms.length === 0) {
      loadFormsPage({ reset: true, offsetValue: 0 });
    }
    if (view === "invites" && invites.length === 0) {
      loadInvitesPage({ reset: true, offsetValue: 0 });
    }
  }, [view, forms.length, invites.length, loadFormsPage, loadInvitesPage]);

  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    // when group or view changes, reset paged datasets and refetch with current filters
    setForms([]);
    setFormsOffset(0);
    setFormsHasMore(false);
    setFormsLoading(view === "forms");
    setParticipantsRefreshing(true);
    loadParticipantsPage({
      reset: true,
      offsetValue: 0,
      queryParamsOverride: buildParticipantsQueryParams(filters, debouncedSearch, sort),
    }).finally(() => setParticipantsRefreshing(false));
    loadSummaries();
    if (view === "forms") {
      loadFormsPage({ reset: true, offsetValue: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupQuery, view, loadParticipantsPage, loadSummaries, loadFormsPage]);

  // Debounce the search input so we don't fire one request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // B6: Refetch participants whenever filters/search/sort change.
  // Server-side filtering replaces the old client-side `processed` memo.
  // Skipped on initial mount — fetchData() handles the first load.
  useEffect(() => {
    if (!hasBootstrappedRef.current) return;
    setParticipantsRefreshing(true);
    loadParticipantsPage({
      reset: true,
      offsetValue: 0,
      queryParamsOverride: buildParticipantsQueryParams(filters, debouncedSearch, sort),
    }).finally(() => setParticipantsRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, debouncedSearch, sort]);

  // ── Sort handler ────────────────────────────────────────────────────────────

  function handleSort(field) {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  }

  // B6: Filter and sort now happen on the server. `processed` is just an alias
  // for `participants` so the JSX consumers below don't need to be rewritten.
  // The previous client-side filter/sort logic was removed when this page moved
  // to server-side filtering — see buildParticipantsQueryParams() at the top of
  // this file and the refetch effects above.
  const processed = participants;

  const counts = useMemo(() => ({
    total: participantSummary.total,
    active: participantSummary.active,
    inactive: participantSummary.inactive,
    flagged: participantSummary.flagged,
  }), [participantSummary]);

  const activeFilterCount = [filters.status !== "all", filters.gender !== "all", filters.flagged !== "all", filters.ageMin || filters.ageMax, filters.surveyProgress !== "all", filters.goalProgress !== "all"].filter(Boolean).length;
  const showGroupColumn = selectedGroupId === "all";
  const selectedGroupName = selectedGroupId === "all" ? null : groups.find(g => g.id === selectedGroupId)?.name;
  const formsForView = useMemo(() => forms, [forms]);

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

  // ── Empty / Error states ───────────────────────────────────────────────────

  if (error) {
    return <ErrorPlaceholder onRetry={() => { setError(false); fetchData(); }} />;
  }

  if (groups.length === 0) {
    return <NoGroupsPlaceholder />;
  }

  if (counts.total === 0 && view === "participants") {
    const selectedGroup = selectedGroupId !== "all" ? groups.find(g => g.id === selectedGroupId) : groups[0];
    return <NoParticipantsPlaceholder group={selectedGroup || groups[0]} onInvite={() => setShowInvite(true)} />;
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
      {showInvite && groups.length > 0 && <InviteModal group={selectedGroupId !== "all" ? groups.find(g => g.id === selectedGroupId) || groups[0] : groups[0]} onDone={handleInviteSent} onCancel={() => setShowInvite(false)} />}
      {noteTarget && <NoteModal participant={noteTarget} onSave={(text, mode) => {
        const name = noteTarget.fullName;
        const msg = mode === "feedback" ? `Feedback sent to ${name}.` : `Note saved for ${name}.`;
        showToastMsg(msg);
        setNoteTarget(null);
      }} onCancel={() => setNoteTarget(null)} />}
      {detailParticipant && <ParticipantDetailPanel participant={detailParticipant} groups={groups} onClose={() => setDetailParticipant(null)} onViewFull={() => { setDetailParticipant(null); navigate(`/caretaker/participants/${detailParticipant.id}`); }} />}
      {formModalOpen && (
        <FormDetailModal
          form={selectedFormDetail}
          loading={formDetailLoading}
          error={formDetailError}
          onClose={() => {
            setFormModalOpen(false);
            setSelectedFormDetail(null);
            setFormDetailError("");
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Participants</h1>
          <p className="text-xs text-slate-400 mt-1">{groups.length} group{groups.length !== 1 ? "s" : ""} · {counts.total} total participants</p>
        </div>
      </div>

      {/* Group Selector */}
      <GroupSelector
        groups={groups}
        allParticipants={processed}
        selectedGroupId={selectedGroupId}
        onChange={(id) => { setSelectedGroupId(id); }}
      />

      {/* View toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1">
        <button onClick={() => setView("participants")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === "participants" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Participants
        </button>
        <button onClick={() => setView("invites")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === "invites" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          Invites
          {invites.filter(i => i.status === "pending").length > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${view === "invites" ? "bg-blue-500 text-white" : "bg-amber-100 text-amber-700"}`}>{invites.filter(i => i.status === "pending").length}</span>}
        </button>
        <button onClick={() => setView("forms")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === "forms" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Forms
          {formsSummary.total > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${view === "forms" ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"}`}>{formsSummary.total}</span>}
        </button>
      </div>

      {/* Invites view */}
      {view === "invites" && (
        <InvitesPanel
          invites={invites}
          onRevoke={handleRevokeInvite}
          onResend={handleResendInvite}
          onOpenInviteModal={() => setShowInvite(true)}
          hasMore={invitesHasMore}
          loadingMore={invitesLoadingMore}
          onLoadMore={handleLoadMoreInvites}
        />
      )}

      {/* Forms view */}
      {view === "forms" && (
        <FormsPanel
          forms={formsForView}
          groups={groups}
          onViewForm={handleViewForm}
          hasMore={formsHasMore}
          loadingMore={formsLoadingMore}
          onLoadMore={handleLoadMoreForms}
          loading={formsLoading}
        />
      )}

      {/* Participants view */}
      {view === "participants" && (<>

      {/* Stat cards — clickable filter chips. Each card toggles its filter on/off,
          with a colored ring when that filter is currently active. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); setSelectedGroupId("all"); }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 text-left transition-all hover:shadow-md hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
          title="Clear all filters"
        >
          <p className="text-2xl font-extrabold text-slate-800">{counts.total}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total</p>
        </button>
        <button
          type="button"
          onClick={() => setFilters(f => ({ ...f, status: f.status === "active" ? "all" : "active" }))}
          className={`bg-white rounded-2xl shadow-sm border px-4 py-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-300 ${filters.status === "active" ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-100 hover:border-emerald-200"}`}
          title={filters.status === "active" ? "Click to clear filter" : "Click to filter by Active"}
        >
          <p className="text-2xl font-extrabold text-emerald-600">{activityCounts.highly_active + activityCounts.moderately_active}</p>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Active</p>
        </button>
        <button
          type="button"
          onClick={() => setFilters(f => ({ ...f, status: f.status === "low_active" ? "all" : "low_active" }))}
          className={`bg-white rounded-2xl shadow-sm border px-4 py-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300 ${filters.status === "low_active" ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-100 hover:border-amber-200"}`}
          title={filters.status === "low_active" ? "Click to clear filter" : "Click to filter by Low Activity"}
        >
          <p className="text-2xl font-extrabold text-amber-600">{activityCounts.low_active}</p>
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mt-1">Low Activity</p>
        </button>
        <button
          type="button"
          onClick={() => setFilters(f => ({ ...f, status: f.status === "inactive" ? "all" : "inactive" }))}
          className={`bg-white rounded-2xl shadow-sm border px-4 py-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300 ${filters.status === "inactive" ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-100 hover:border-slate-300"}`}
          title={filters.status === "inactive" ? "Click to clear filter" : "Click to filter by Inactive"}
        >
          <p className="text-2xl font-extrabold text-slate-400">{activityCounts.inactive}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Inactive</p>
        </button>
        <button
          type="button"
          onClick={() => setFilters(f => ({ ...f, flagged: f.flagged === "flagged" ? "all" : "flagged" }))}
          className={`bg-white rounded-2xl shadow-sm border px-4 py-4 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300 ${filters.flagged === "flagged" ? "border-rose-400 ring-2 ring-rose-200" : "border-slate-100 hover:border-rose-200"}`}
          title={filters.flagged === "flagged" ? "Click to clear filter" : "Click to filter by Flagged"}
        >
          <p className="text-2xl font-extrabold text-rose-600">{counts.flagged}</p>
          <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mt-1">Flagged</p>
        </button>
        <button
          type="button"
          onClick={() => setSelectedGroupId("all")}
          disabled={selectedGroupId === "all"}
          className={`bg-white rounded-2xl shadow-sm border px-4 py-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${selectedGroupId !== "all" ? "border-blue-400 ring-2 ring-blue-200 hover:shadow-md cursor-pointer" : "border-slate-100 cursor-default"}`}
          title={selectedGroupId !== "all" ? "Click to show all groups" : `${groups.length} group${groups.length === 1 ? "" : "s"} assigned`}
        >
          <p className="text-2xl font-extrabold text-blue-600">{groups.length}</p>
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mt-1">Groups</p>
        </button>
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
        <p className="text-xs text-slate-400">
          {participantsRefreshing ? (
            <span className="inline-flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Updating results…
            </span>
          ) : (activeFilterCount > 0 || debouncedSearch) ? (
            <>Showing <span className="font-semibold text-slate-600">{processed.length}</span> of <span className="font-semibold text-slate-600">{participantsTotal}</span> participant{participantsTotal === 1 ? "" : "s"} matching filters{selectedGroupName && <> in <span className="font-semibold text-slate-600">{selectedGroupName}</span></>}</>
          ) : (
            <>Showing <span className="font-semibold text-slate-600">{processed.length}</span> of <span className="font-semibold text-slate-600">{participantsTotal}</span> participant{participantsTotal === 1 ? "" : "s"}{selectedGroupName && <> in <span className="font-semibold text-slate-600">{selectedGroupName}</span></>}</>
          )}
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {processed.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <p className="text-sm text-slate-400">No participants match your filters.</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <button onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Clear all filters</button>
              {participantsHasMore && (
                <button
                  onClick={handleLoadMoreParticipants}
                  disabled={participantsLoadingMore}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                >
                  {participantsLoadingMore ? "Loading more..." : "Load more rows"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="hidden md:flex items-center gap-3 px-4 py-3 bg-slate-50">
              <SortButton label="Participant" field="name" currentSort={sort} onSort={handleSort} className="flex-1" />
              {showGroupColumn && <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-40">Group</span>}
              <SortButton label="Age" field="age" currentSort={sort} onSort={handleSort} className="w-12 justify-center" />
              <SortButton label="Gender" field="gender" currentSort={sort} onSort={handleSort} className="w-16 justify-center" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-40 text-center">Progress</span>
              <SortButton label="Last Active" field="lastActive" currentSort={sort} onSort={handleSort} className="w-24 justify-center" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-20 text-right">Actions</span>
            </div>
            {processed.map(p => {
              const sPct = Math.round(pct(p.surveysDone, p.surveysTotal));
              const gPct = Math.round(pct(p.healthGoals, p.healthGoalsTotal));
              const age = p.age ?? getAge(p.dob);
              return (
                <div key={p.id} onClick={() => setDetailParticipant(p)} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar fullName={p.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-800 truncate">{p.fullName}</p><StatusDot status={p.status} /></div>
                      <p className="text-xs text-slate-400 truncate">{p.email || "—"}</p>
                      {p.flags.length > 0 && <div className="flex items-center gap-1 mt-1 flex-wrap">{p.flags.map((f, i) => <FlagBadge key={i} text={f} />)}</div>}
                      <div className="md:hidden mt-2 space-y-1.5">
                        {showGroupColumn && p.groupName && <GroupBadge groupId={p.groupId} groupName={p.groupName} groups={groups} />}
                        <div className="flex items-center gap-3 text-xs text-slate-400"><span>{age !== null ? `${age} yrs` : "—"}</span><span>·</span><span>{p.gender}</span><span>·</span><span className={p.status === "inactive" ? "text-amber-600 font-medium" : ""}>{daysSince(p.lastActive) || "—"}</span></div>
                        <div><div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Surveys</span><span className="font-semibold text-slate-500">{p.surveysDone}/{p.surveysTotal}</span></div><div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${sPct}%` }} /></div></div>
                        <div><div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Goals</span><span className="font-semibold text-slate-500">{p.healthGoals}/{p.healthGoalsTotal || 0}</span></div><div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${gPct}%` }} /></div></div>
                      </div>
                    </div>
                  </div>
                  {showGroupColumn && (
                    <div className="hidden md:block w-40">
                      {p.groupName && <GroupBadge groupId={p.groupId} groupName={p.groupName} groups={groups} />}
                    </div>
                  )}
                  <div className="hidden md:block w-12 text-center"><span className="text-xs font-semibold text-slate-600">{age !== null ? age : "—"}</span></div>
                  <div className="hidden md:block w-16 text-center"><span className="text-xs font-medium text-slate-500">{p.gender}</span></div>
                  <div className="hidden md:flex flex-col gap-1.5 w-40">
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-400 w-14 shrink-0">Surveys</span><div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-blue-500 h-1 rounded-full" style={{ width: `${sPct}%` }} /></div><span className="text-xs font-semibold text-slate-500 w-9 text-right">{p.surveysDone}/{p.surveysTotal}</span></div>
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-400 w-14 shrink-0">Goals</span><div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden"><div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${gPct}%` }} /></div><span className="text-xs font-semibold text-slate-500 w-9 text-right">{p.healthGoals}/{p.healthGoalsTotal || 0}</span></div>
                  </div>
                  <div className="hidden md:block w-24 text-center"><span className={`text-xs font-medium ${p.status === "inactive" ? "text-amber-600" : "text-slate-400"}`}>{daysSince(p.lastActive) || "—"}</span></div>
                  <div className="hidden md:flex w-20 items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setNoteTarget(p)} title="Add note or send feedback" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                    <button onClick={() => navigate(`/caretaker/reports?tab=comparison&participant=${p.id}`)} title="Generate report" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                    <button onClick={() => navigate(`/caretaker/participants/${p.id}`)} title="View full profile" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {participantsHasMore && (
          <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleLoadMoreParticipants}
              disabled={participantsLoadingMore}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              {participantsLoadingMore ? "Loading..." : "Load More Participants"}
            </button>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

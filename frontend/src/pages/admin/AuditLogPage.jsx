import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounced } from "../../hooks/useDebounced";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// AuditLogPage.jsx
//
// API Integration: GET /admin_only/audit-logs
//   Server-side filters: search, date_from, date_to, actor_role, action, user_id
//   Client-side filters: category (cat), severity (sev), group, specific user
// ═══════════════════════════════════════════════════════════════════════════════

// ── Action Config ──
// Maps backend action strings to display properties.
// Add new entries here when the backend starts logging new event types.
const ACT = {
  LOGIN_SUCCESS:            { title: "Successful Login",       type: "success",  status: "Success",    cat: "auth",   sev: "info" },
  LOGIN_FAILED:             { title: "Failed Login Attempt",   type: "critical", status: "Failed",     cat: "auth",   sev: "critical" },
  LOGOUT:                   { title: "User Logout",            type: "neutral",  status: "Logout",     cat: "auth",   sev: "info" },
  REGISTER_SUCCESS:         { title: "Account Registered",     type: "success",  status: "Registered", cat: "auth",   sev: "info" },
  PASSWORD_RESET_REQUESTED: { title: "Password Reset Request", type: "warning",  status: "Requested",  cat: "auth",   sev: "warning" },
  PASSWORD_RESET_SUCCESS:   { title: "Password Reset Done",    type: "success",  status: "Reset",      cat: "auth",   sev: "info" },
  INVITE_SENT:              { title: "Invite Sent",            type: "neutral",  status: "Sent",       cat: "auth",   sev: "info" },
  ONBOARDING_COMPLETED:     { title: "Onboarding Completed",   type: "success",  status: "Completed",  cat: "auth",   sev: "info" },
  // Future event types — UI is ready, backend just needs to start writing these
  SURVEY_SUBMITTED:         { title: "Survey Submitted",       type: "success",  status: "Submitted",  cat: "data",   sev: "info" },
  DATA_EXPORTED:            { title: "Data Exported",          type: "neutral",  status: "Exported",   cat: "data",   sev: "warning" },
  DATA_DELETED:             { title: "Data Deleted",           type: "critical", status: "Deleted",    cat: "data",   sev: "critical" },
  REPORT_GENERATED:         { title: "Report Generated",       type: "neutral",  status: "Generated",  cat: "data",   sev: "info" },
  ROLE_CHANGED:             { title: "Role Changed",           type: "warning",  status: "Modified",   cat: "admin",  sev: "warning" },
  ACCOUNT_MODIFIED:         { title: "Account Modified",       type: "warning",  status: "Modified",   cat: "admin",  sev: "warning" },
  ACCOUNT_LOCKED:           { title: "Account Locked",         type: "critical", status: "Locked",     cat: "admin",  sev: "critical" },
  BACKUP_CREATED:           { title: "Backup Created",         type: "success",  status: "Created",    cat: "system", sev: "info" },
  BACKUP_RESTORED:          { title: "Backup Restored",        type: "warning",  status: "Restored",   cat: "system", sev: "warning" },
};

const STY = {
  critical: { dot: "bg-rose-500",    badge: "bg-rose-50 text-rose-700 border-rose-100" },
  warning:  { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-100" },
  success:  { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  neutral:  { dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const DETAIL_LABELS = {
  email_attempted: "Email Attempted", identifier_attempted: "Identifier Attempted", target_email: "Target Email", target_role: "Target Role",
  target_group: "Target Group", invite_id: "Invite ID", invited_by: "Invited By",
  device: "Device", role: "Role", reason: "Reason",
  form_name: "Form Name", form_id: "Form ID", status: "Status", target_user: "Affected User",
  previous_role: "Previous Role", new_role: "New Role", format: "Export Format",
  record_count: "Records", group: "Group", anonymized: "Anonymized",
  report_type: "Report Type", participant_count: "Participants",
  file_size: "File Size", snapshot_name: "Snapshot Name", fields_changed: "Fields Changed",
  lockout_duration: "Lockout Duration", email: "Email",
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "auth", label: "Auth & Invites" },
  { value: "data", label: "Data & Surveys" },
  { value: "admin", label: "User & Roles" },
  { value: "system", label: "System" },
];

const SEVERITY_OPTIONS = [
  { v: "all", l: "All" },
  { v: "critical", l: "Critical" },
  { v: "warning", l: "Warning" },
  { v: "info", l: "Normal" },
];

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "researcher", label: "Researcher" },
  { value: "caretaker", label: "Caretaker" },
  { value: "participant", label: "Participant" },
];

const PAGE_SIZES = [10, 25, 50];

// ── Helpers ──
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function parseUserAgent(ua) {
  if (!ua) return null;
  // Browser
  let browser = "Unknown browser";
  if (ua.includes("Edg/"))        browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "Internet Explorer";
  // OS
  let os = "Unknown OS";
  if (ua.includes("Windows NT 10"))   os = "Windows 10/11";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS X"))   os = "macOS";
  else if (ua.includes("Android"))    os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux"))      os = "Linux";
  return `${browser} · ${os}`;
}

function fmtFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function toDateVal(d) { return d ? d.toISOString().split("T")[0] : ""; }

function buildDesc(log) {
  const d = log.details || {};
  if (log.action === "INVITE_SENT") return [log.actor_label, `→ ${d.target_email}`, d.target_role && `(${d.target_role})`, d.target_group && `• ${d.target_group}`].filter(Boolean).join(" ");
  if (log.action === "ROLE_CHANGED") return [d.target_user, d.previous_role && d.new_role && `${d.previous_role} → ${d.new_role}`, log.actor_label !== "Unknown" && `by ${log.actor_label}`].filter(Boolean).join(" · ");
  if (log.action === "DATA_DELETED") return [d.target_user, d.form_name, d.reason && (d.reason.length > 35 ? d.reason.slice(0, 35) + "…" : d.reason)].filter(Boolean).join(" · ");
  const p = [];
  if (log.actor_label && log.actor_label !== "Unknown" && log.actor_label !== "System") p.push(log.actor_label);
  else if (d.identifier_attempted) p.push(d.identifier_attempted);
  else if (d.email_attempted) p.push(d.email_attempted);
  else if (d.target_user) p.push(d.target_user);
  if (d.device) p.push(d.device);
  if (d.form_name) p.push(d.form_name);
  if (d.report_type) p.push(d.report_type);
  if (d.snapshot_name) p.push(d.snapshot_name);
  if (d.reason) p.push(d.reason.length > 30 ? d.reason.slice(0, 30) + "…" : d.reason);
  return p.join(" · ") || "—";
}

// ── Pill Button ──
function Pill({ active, onClick, children, count }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${active ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
      {children}
      {count !== undefined && <span className={`text-[10px] ${active ? "text-blue-200" : "text-slate-400"}`}>({count})</span>}
    </button>
  );
}

const Ico = {
  critical: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  success: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  warning: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  neutral: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function AuditLogPage() {
  const navigate = useNavigate();
  // ── Data state ──
  const [allLogs, setAllLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [catFilter, setCatFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("desc");

  // ── UI state ──
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState(`audit-logs-${new Date().toISOString().split("T")[0]}`);
  const [isExporting, setIsExporting] = useState(false);

  // ── Fetch audit logs — reactive to server-side filter + pagination state ──
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: debouncedSearch || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        actor_role: roleFilter !== "all" ? roleFilter : undefined,
      });
      setAllLogs(data.logs || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError("Failed to load audit logs. Please check your connection and try again.");
      console.error("Audit log fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo, roleFilter, page, pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Cascading dropdown options (derived from server-filtered allLogs) ──
  const uniqueGroups = useMemo(() =>
    [...new Set(allLogs.map(l => l.actor_group).filter(Boolean))].sort(),
  [allLogs]);

  const uniqueUsers = useMemo(() => {
    const pool = groupFilter !== "all" ? allLogs.filter(l => l.actor_group === groupFilter) : allLogs;
    return [...new Set(pool.map(l => l.actor_label).filter(l => l && l !== "Unknown" && l !== "System"))].sort();
  }, [allLogs, groupFilter]);

  // ── Category counts for pills (server already applied search/date/role) ──
  const catCounts = useMemo(() => {
    const r = sevFilter !== "all" ? allLogs.filter(l => (ACT[l.action]?.sev || "info") === sevFilter) : allLogs;
    const c = { all: r.length, auth: 0, data: 0, admin: 0, system: 0 };
    r.forEach(l => { const cat = ACT[l.action]?.cat; if (cat) c[cat] = (c[cat] || 0) + 1; });
    return c;
  }, [allLogs, sevFilter]);

  const activeFilterCount = [catFilter !== "all", sevFilter !== "all", roleFilter !== "all", groupFilter !== "all", userFilter !== "all", dateFrom, dateTo, debouncedSearch].filter(Boolean).length;

  // ── Client-side filters (only cat/sev/group/user remain — server handles the rest) ──
  const filtered = useMemo(() => {
    let r = [...allLogs];
    if (catFilter !== "all") r = r.filter(l => (ACT[l.action]?.cat || "") === catFilter);
    if (sevFilter !== "all") r = r.filter(l => (ACT[l.action]?.sev || "info") === sevFilter);
    if (groupFilter !== "all") r = r.filter(l => l.actor_group === groupFilter);
    if (userFilter !== "all") r = r.filter(l => l.actor_label === userFilter);
    r.sort((a, b) => sort === "desc" ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
    return r;
  }, [allLogs, catFilter, sevFilter, groupFilter, userFilter, sort]);

  // Server handles pagination; client-side filters (cat/sev/group/user) narrow the current page only.
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paged = filtered;

  // ── Export ──
  const handleExport = () => {
    if (filtered.length === 0) return;
    setIsExporting(true);
    try {
      const defaultName = `audit-logs-${new Date().toISOString().split("T")[0]}`;
      const filename = (exportFilename || "").trim() || defaultName;
      const headers = ["Timestamp", "Action", "Category", "Severity", "Actor Name", "Actor Email", "Actor Role", "IP Address", "Device / Browser", "Entity Type", "Entity ID", "Details"];
      const escape = (v) => { if (v == null) return ""; const s = String(v).replace(/"/g, '""'); return /[",\n\r]/.test(s) ? `"${s}"` : s; };
      const rows = filtered.map(l => [
        l.created_at ? new Date(l.created_at).toISOString() : "",
        ACT[l.action]?.title || l.action || "",
        ACT[l.action]?.cat || "",
        ACT[l.action]?.sev || "",
        l.actor_label || "",
        l.actor_email || "",
        l.actor_role || "",
        l.ip_address || "",
        parseUserAgent(l.details?.user_agent) || "",
        l.entity_type || "",
        l.entity_id || "",
        l.details ? JSON.stringify(l.details) : "",
      ].map(escape).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Stats ──
  const stats = useMemo(() => {
    const now = Date.now();
    const h24 = allLogs.filter(l => now - new Date(l.created_at).getTime() < 86400000).length;
    const d7 = allLogs.filter(l => now - new Date(l.created_at).getTime() < 7 * 86400000).length;
    const d30 = allLogs.filter(l => now - new Date(l.created_at).getTime() < 30 * 86400000).length;
    const loginOk = allLogs.filter(l => l.action === "LOGIN_SUCCESS").length;
    const loginFail = allLogs.filter(l => l.action === "LOGIN_FAILED").length;
    const loginTotal = loginOk + loginFail;
    const invSent = allLogs.filter(l => l.action === "INVITE_SENT").length;
    const invAccepted = allLogs.filter(l => l.action === "REGISTER_SUCCESS" && l.details?.invited_by).length;
    const invPending = invSent - invAccepted;
    return { h24, d7, d30, total: totalCount, loginOk, loginFail, loginTotal, invSent, invAccepted, invPending: Math.max(0, invPending) };
  }, [allLogs, totalCount]);

  // ── Reset page when server-side filter state changes ──
  useEffect(() => { setPage(1); }, [debouncedSearch, dateFrom, dateTo, roleFilter]);

  // ── Actions ──
  const clearAll = () => {
    setCatFilter("all"); setSevFilter("all"); setRoleFilter("all");
    setGroupFilter("all"); setUserFilter("all"); setDateFrom(""); setDateTo(""); setPage(1);
    setSearch("");
  };
  const setDatePreset = (days) => {
    const now = new Date(); const from = new Date(now); from.setDate(from.getDate() - days);
    setDateFrom(toDateVal(from)); setDateTo(toDateVal(now)); setPage(1);
  };
  const scrollToLog = () => {
    setTimeout(() => {
      document.getElementById("audit-log-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
  const jumpToDateRange = (days) => { clearAll(); setDatePreset(days); scrollToLog(); };
  const jumpToAction = (act) => {
    clearAll(); setPage(1);
    setSearch(ACT[act]?.title || act);
    scrollToLog();
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading audit logs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <p className="text-sm font-semibold text-rose-700 mb-1">{error}</p>
          <p className="text-xs text-slate-400 mb-4">Check your network connection and try again.</p>
          <button onClick={fetchLogs} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ════════════ PAGE HEADER ════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">Track all system activity — authentication, invites, data changes, and backups</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { clearAll(); fetchLogs(); }} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
          <button
            onClick={() => {
              setExportFilename(`audit-logs-${new Date().toISOString().split("T")[0]}`);
              setShowExportModal(true);
            }}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export {filtered.length > 0 && `(${filtered.length})`}
          </button>
        </div>
      </div>

      {/* ════════════ DASHBOARD CARDS ════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Activity Trend */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity Trend</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">How active the system has been recently. Click a time range to filter the log below.</p>
          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-3xl font-extrabold text-slate-800">{stats.h24}</p>
            <p className="text-sm text-slate-400">events in last 24h</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4">
            {[{ label: "Last 24h", value: stats.h24, days: 1 }, { label: "Last 7 days", value: stats.d7, days: 7 }, { label: "Last 30 days", value: stats.d30, days: 30 }, { label: "All time", value: stats.total, days: 365 }].map(t => (
              <button key={t.label} onClick={() => jumpToDateRange(t.days)} className="group text-left flex-1">
                <p className="text-lg font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{t.value}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition-colors">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Card 2: Login Security */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Login Security</p>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">Login success vs failure ratio. Click a count to see those specific events below.</p>
          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-3xl font-extrabold text-slate-800">{stats.loginTotal > 0 ? Math.round((stats.loginOk / stats.loginTotal) * 100) : 0}%</p>
            <p className="text-sm text-slate-400">success rate</p>
            {stats.loginTotal > 0 && (stats.loginOk / stats.loginTotal) >= 0.8
              ? <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Healthy</span>
              : <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Needs attention</span>
            }
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex gap-6">
            <button onClick={() => jumpToAction("LOGIN_SUCCESS")} className="group text-left">
              <p className="text-lg font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">{stats.loginOk}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Successful</p>
            </button>
            <button onClick={() => jumpToAction("LOGIN_FAILED")} className="group text-left">
              <p className="text-lg font-bold text-rose-600 group-hover:text-rose-700 transition-colors">{stats.loginFail}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-rose-500 transition-colors">Failed</p>
            </button>
            <div>
              <p className="text-lg font-bold text-slate-700">{stats.loginTotal}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total attempts</p>
            </div>
          </div>
        </div>

        {/* Card 3: Invite Pipeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invite Pipeline</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">Track signup invitations from sent to accepted. Click a status to filter the log below.</p>
          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-3xl font-extrabold text-slate-800">{stats.invSent}</p>
            <p className="text-sm text-slate-400">invitations sent</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex gap-6">
            <button onClick={() => jumpToAction("INVITE_SENT")} className="group text-left">
              <p className="text-lg font-bold text-blue-600 group-hover:text-blue-700 transition-colors">{stats.invSent}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-500 transition-colors">Sent</p>
            </button>
            <button onClick={() => jumpToAction("REGISTER_SUCCESS")} className="group text-left">
              <p className="text-lg font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">{stats.invAccepted}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Accepted</p>
            </button>
            <div>
              <p className="text-lg font-bold text-amber-600">{stats.invPending}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending</p>
            </div>
            <div>
              <p className="text-lg font-bold text-indigo-600">{stats.invSent > 0 ? Math.round((stats.invAccepted / stats.invSent) * 100) : 0}%</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acceptance</p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ SEARCH + CONTROLS ════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, IP address, form name…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Category</span>
          {CATEGORY_OPTIONS.map(c => (
            <Pill key={c.value} active={catFilter === c.value} onClick={() => { setCatFilter(c.value); setPage(1); }} count={catCounts[c.value]}>{c.label}</Pill>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort</span>
          <Pill active={sort === "desc"} onClick={() => { setSort("desc"); setPage(1); }}>Newest First</Pill>
          <Pill active={sort === "asc"} onClick={() => { setSort("asc"); setPage(1); }}>Oldest First</Pill>
          <div className="flex-1" />
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${showFilters || activeFilterCount > 0 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            {showFilters ? "Hide Filters" : "More Filters"}
            {activeFilterCount > 0 && <span className="text-xs font-bold bg-white text-blue-600 w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* ════════════ ADVANCED FILTERS ════════════ */}
      {showFilters && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              <span className="text-sm font-bold text-slate-700">Filters</span>
              {activeFilterCount > 0 && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
            </div>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Clear All</button>}
          </div>
          <div className="p-4 space-y-4">
            {/* Severity */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Severity</label>
              <div className="flex gap-1.5">
                {SEVERITY_OPTIONS.map(s => (
                  <Pill key={s.v} active={sevFilter === s.v} onClick={() => { setSevFilter(s.v); setPage(1); }}>{s.l}</Pill>
                ))}
              </div>
            </div>
            {/* Role, Group, User */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
                <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setGroupFilter("all"); setUserFilter("all"); setPage(1); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Group / Cohort</label>
                <select value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setUserFilter("all"); setPage(1); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
                  <option value="all">All Groups</option>
                  {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">User</label>
                <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
                  <option value="all">All Users</option>
                  {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {/* Date Range */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date Range</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white" />
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white" />
                <div className="flex gap-1.5">
                  {[{ l: "Today", d: 0 }, { l: "7d", d: 7 }, { l: "30d", d: 30 }, { l: "90d", d: 90 }].map(p => (
                    <button key={p.l} onClick={() => setDatePreset(p.d)} className="flex-1 px-2 py-2 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-center">{p.l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ RESULTS COUNT ════════════ */}
      <p id="audit-log-table" className="text-xs text-slate-400 px-1">Showing {filtered.length} of {totalCount} events</p>

      {/* ════════════ EVENT LOG TABLE ════════════ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Column headers */}
        <div className="hidden md:flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-6"></span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-[2]">Event</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-[3]">Details</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-28">IP Address</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-32 text-right">Time</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-24 text-right">Status</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {paged.length === 0 && (
            <div className="px-6 py-12 text-center">
              <svg className="h-10 w-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <p className="text-sm font-medium text-slate-500">
                {allLogs.length === 0 ? "No audit events recorded yet. Logs will appear here as users interact with the system." : "No events match your current filters."}
              </p>
              {allLogs.length > 0 && <button onClick={() => { clearAll(); setSearch(""); }} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear filters</button>}
            </div>
          )}

          {paged.map(log => {
            const c = ACT[log.action] || { title: log.action, type: "neutral", status: log.action, cat: "other", sev: "info" };
            const s = STY[c.type] || STY.neutral;
            const isExp = expanded === log.audit_id;

            return (
              <div key={log.audit_id}>
                <button onClick={() => setExpanded(isExp ? null : log.audit_id)} className="w-full text-left px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  {/* Mobile */}
                  <div className="md:hidden flex items-start gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dot} shrink-0 mt-1.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.badge} shrink-0`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{buildDesc(log)}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {log.actor_role && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded capitalize">{log.actor_role}</span>}
                        {log.actor_group && <span className="text-[10px] font-medium text-slate-400">{log.actor_group}</span>}
                        <span className="text-[10px] text-slate-400">{timeAgo(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:flex md:items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dot} shrink-0`} />
                    <div className="flex-[2] min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {log.actor_role && <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded capitalize">{log.actor_role}</span>}
                        {log.actor_group && <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{log.actor_group}</span>}
                      </div>
                    </div>
                    <p className="flex-[3] text-xs text-slate-500 truncate">{buildDesc(log)}</p>
                    <p className="w-28 text-xs text-slate-500 font-mono shrink-0">{log.ip_address || "—"}</p>
                    <div className="w-32 text-right shrink-0">
                      <p className="text-xs text-slate-500">{timeAgo(log.created_at)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(log.created_at)}</p>
                    </div>
                    <div className="w-24 text-right shrink-0">
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>{c.status}</span>
                    </div>
                  </div>
                </button>

                {/* ── Expanded Detail Panel ── */}
                {isExp && (
                  <div className="px-5 pb-4 bg-slate-50/50">
                    <div className="md:ml-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-5">
                      {/* Section 1: Event Summary */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full ${s.dot} shrink-0`} />
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">{c.title}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{buildDesc(log)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>{c.status}</span>
                            <span className="text-[10px] font-mono text-slate-300 bg-slate-50 px-2 py-1 rounded">{log.audit_id}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[["Action Code", log.action, true], ["Category", c.cat], ["Severity", c.sev], ["Entity Type", log.entity_type || "N/A"]].map(([label, value, mono]) => (
                            <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                              <p className={`text-xs text-slate-700 mt-0.5 capitalize ${mono ? "font-mono" : ""}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section 2: Actor Information */}
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Actor Information</p>
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                            {log.actor_label && log.actor_label !== "Unknown" && log.actor_label !== "System"
                              ? log.actor_label.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
                              : log.actor_label === "System" ? "SY" : "?"
                            }
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Name</p>
                              {log.actor_user_id && log.actor_label && log.actor_label !== "Unknown" && log.actor_label !== "System"
                                ? <button onClick={() => navigate(`/admin/users/${log.actor_user_id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5 text-left">{log.actor_label}</button>
                                : <p className="text-xs text-slate-700 mt-0.5">{log.actor_label || "N/A"}</p>
                              }
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                              {log.actor_email && log.actor_user_id
                                ? <button onClick={() => navigate(`/admin/users/${log.actor_user_id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-0.5 text-left truncate block max-w-full">{log.actor_email}</button>
                                : <p className="text-xs text-slate-400 mt-0.5 italic">Not available</p>
                              }
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">User ID</p>
                              {log.actor_user_id
                                ? <button onClick={() => navigate(`/admin/users/${log.actor_user_id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono mt-0.5 text-left break-all">{log.actor_user_id}</button>
                                : <p className="text-xs text-slate-700 font-mono mt-0.5">N/A</p>
                              }
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Role</p>
                              {log.actor_role
                                ? <p className="text-xs text-slate-700 mt-0.5 capitalize">{log.actor_role}</p>
                                : <p className="text-xs text-slate-400 mt-0.5 italic">Not available</p>
                              }
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Group / Cohort</p>
                              <p className="text-xs text-slate-400 mt-0.5 italic">Not available</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Entity ID</p>
                              {log.entity_id && log.entity_type === "user"
                                ? <button onClick={() => navigate(`/admin/users/${log.entity_id}`)} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono mt-0.5 text-left break-all">{log.entity_id}</button>
                                : <p className="text-xs text-slate-700 font-mono mt-0.5">{log.entity_id || "N/A"}</p>
                              }
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Request Context */}
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Request Context</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[["IP Address", log.ip_address || "N/A", true], ["Timestamp", fmtFull(log.created_at)]].map(([label, value, mono]) => (
                            <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
                              <p className={`text-xs text-slate-700 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
                            </div>
                          ))}
                          <div className="bg-slate-50 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Device / Browser</p>
                            {parseUserAgent(log.details?.user_agent)
                              ? <p className="text-xs text-slate-700 mt-0.5" title={log.details.user_agent}>{parseUserAgent(log.details.user_agent)}</p>
                              : <p className="text-xs text-slate-400 mt-0.5 italic">Not available</p>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Additional Details */}
                      {Object.keys(log.details || {}).length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Additional Details</p>
                          <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                              {Object.entries(log.details).filter(([k]) => k !== "device").map(([k, v]) => (
                                <div key={k}>
                                  <p className="text-[10px] text-slate-400 font-medium">{DETAIL_LABELS[k] || k}</p>
                                  <p className="text-xs text-slate-700 mt-0.5">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ════════════ PAGINATION ════════════ */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">
              {filtered.length > 0
                ? <><span className="font-bold text-slate-700">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-bold text-slate-700">{filtered.length}</span></>
                : "No results"}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">per page</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1.5 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1.5 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>
            {(() => {
              let start = Math.max(1, page - 2);
              let end = Math.min(totalPages, start + 4);
              if (end - start < 4) start = Math.max(1, end - 4);
              const pages = [];
              for (let i = start; i <= end; i++) pages.push(i);
              return pages.map(p => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 text-xs font-semibold rounded-lg transition-all ${p === page ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>{p}</button>
              ));
            })()}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1.5 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Last</button>
          </div>
        </div>
      </div>

      {/* ════════════ EXPORT MODAL ════════════ */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Export Audit Logs</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filtered.length} {filtered.length === 1 ? "record" : "records"} will be exported</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">File name</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={exportFilename}
                  onChange={e => setExportFilename(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder={`audit-logs-${new Date().toISOString().split("T")[0]}`}
                />
                <span className="text-sm text-slate-400 shrink-0">.csv</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${isExporting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {isExporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

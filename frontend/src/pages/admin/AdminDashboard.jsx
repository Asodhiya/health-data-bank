import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { api } from "../../services/api";
import { useNavigate } from "react-router-dom";
import NotificationsPanel from "../../components/NotificationsPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapActionToDisplay(action) {
  switch (action) {
    case "LOGIN_SUCCESS": return { title: "Successful Login", type: "success", status: "Success" };
    case "LOGIN_FAILED": return { title: "Failed Login Attempt", type: "critical", status: "Failed" };
    case "LOGOUT": return { title: "User Logout", type: "info", status: "Logout" };
    case "REGISTER_SUCCESS": return { title: "New Account Registered", type: "success", status: "Registered" };
    case "PASSWORD_RESET_REQUESTED": return { title: "Password Reset Requested", type: "info", status: "Modified" };
    default: return { title: action, type: "info", status: action };
  }
}

function buildDescription(log) {
  const parts = [];
  if (log.actor_label && log.actor_label !== "Unknown") parts.push(`User: ${log.actor_label}`);
  else if (log.details?.email_attempted) parts.push(`Email: ${log.details.email_attempted}`);
  if (log.ip_address) parts.push(`IP: ${log.ip_address}`);
  return parts.join(" • ") || "No additional info";
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function formatBackupDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getLogStyles(type) {
  switch (type) {
    case "critical": return { bg: "bg-rose-50", text: "text-rose-600", badgeBg: "bg-rose-100", badgeText: "text-rose-700" };
    case "success": return { bg: "bg-emerald-50", text: "text-emerald-600", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" };
    default: return { bg: "bg-blue-50", text: "text-blue-600", badgeBg: "bg-blue-100", badgeText: "text-blue-700" };
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [tableView, setTableView] = useState("participants");
  const [showAllUsers, setShowAllUsers] = useState(false);
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [recentBackups, setRecentBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);

  const [groups, setGroups] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [users, setUsers] = useState([]);

  // Fetch audit logs
  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getAuditLogs({ limit: showAllLogs ? 20 : 3 })
      .then((data) => { setLogs(data.logs || []); setTotalLogs(data.total || 0); })
      .catch((err) => { setError("Could not load security logs."); console.error(err); })
      .finally(() => setLoading(false));
  }, [showAllLogs]);

  // Fetch backups
  useEffect(() => {
    api.listBackups()
      .then((data) => setRecentBackups((Array.isArray(data) ? data : []).slice(0, 3)))
      .catch(() => setRecentBackups([]))
      .finally(() => setBackupsLoading(false));
  }, []);

  // Fetch groups + caretakers + users (deduplicated)
  useEffect(() => {
    api.adminGetGroups().then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => setGroups([]));
    api.adminGetCaretakers().then(d => setCaretakers(Array.isArray(d) ? d : [])).catch(() => setCaretakers([]));
    api.adminListUsers().then(d => {
      const arr = Array.isArray(d) ? d : [];
      const seen = new Set();
      setUsers(arr.filter(u => !seen.has(u.id) && seen.add(u.id)));
    }).catch(() => setUsers([]));
  }, []);

  // ── Computed ──
  const failedLogins = useMemo(() => logs.filter(l => l.action === "LOGIN_FAILED").length, [logs]);
  const alertNeedleAngle = useMemo(() => -70 + (Math.min(failedLogins, 5) / 5) * 140, [failedLogins]);
  const alertDashOffset = useMemo(() => 125.6 * (1 - Math.min(failedLogins, 5) / 5), [failedLogins]);

  // All role counts from the same users array — matches UserManagementPage
  const distributionData = useMemo(() => [
    { name: "Participants", count: users.filter(u => u.role === "participant").length, color: "#6366f1" },
    { name: "Caretakers", count: users.filter(u => u.role === "caretaker").length, color: "#10b981" },
    { name: "Researchers", count: users.filter(u => u.role === "researcher").length, color: "#f59e0b" },
    { name: "Admins", count: users.filter(u => u.role === "admin").length, color: "#ef4444" },
    { name: "Groups", count: groups.length, color: "#3b82f6" },
  ], [groups, users]);

  const totalUsers = users.length;

  const roleBadge = (role) => {
    const s = { participant: "bg-blue-50 text-blue-600", caretaker: "bg-emerald-50 text-emerald-600", researcher: "bg-indigo-50 text-indigo-600", admin: "bg-rose-50 text-rose-600" };
    return s[role] || "bg-slate-50 text-slate-600";
  };

  // ── Users table: unified across all roles ──
  const tableRoleKey = tableView === "admins" ? "admin" : tableView === "caretakers" ? "caretaker" : tableView === "researchers" ? "researcher" : "participant";

  const tableRows = useMemo(() => {
    return users.filter(u => u.role === tableRoleKey);
  }, [tableRoleKey, users]);

  const visibleRows = showAllUsers ? tableRows : tableRows.slice(0, 10);
  const hasMoreRows = tableRows.length > 10;

  // Column config per role
  const col3Label = tableRoleKey === "caretaker" ? "Organization" : tableRoleKey === "participant" ? "Group" : "Role";
  const getCol3 = (u) => {
    if (tableRoleKey === "caretaker") return u.organization || "—";
    if (tableRoleKey === "participant") return u.group || "—";
    return tableRoleKey.charAt(0).toUpperCase() + tableRoleKey.slice(1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">System health status • Identify risks • Spot bad actors</p>
      </div>

      {/* GAUGES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Server Load — static */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Server Load</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible"><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" /><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="82" /></svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 -rotate-45 rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">34%</p>
          <p className="text-sm text-slate-500 font-medium">Healthy</p>
        </div>
        {/* Uptime — static */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Uptime</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible"><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" /><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="0" /></svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 rotate-[70deg] rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">99.97%</p>
          <p className="text-sm text-slate-500 font-medium">Excellent</p>
        </div>
        {/* Security Alerts — dynamic */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100 ring-1 ring-rose-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">Security Alerts</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center z-10">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible"><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" /><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={alertDashOffset} /></svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-rose-600 origin-bottom -translate-x-1/2 rounded-full transition-transform duration-500" style={{ transform: `translateX(-50%) rotate(${alertNeedleAngle}deg)` }}></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-rose-700 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-rose-500 mt-4 relative z-10">{failedLogins} Failed</p>
          <p className="text-sm text-rose-600 font-bold relative z-10">Recent logins</p>
        </div>
      </div>

      {/* QUICK ACTION */}
      <button onClick={() => navigate("/settings")}
        className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 text-left hover:shadow-md hover:border-slate-200 transition-all group flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">System Settings</p>
          <p className="text-xs text-slate-400 mt-0.5">Configuration & policies</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>

      {/* BACKUP & RESTORE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:border-blue-200 hover:shadow-md transition-all">
        <div onClick={() => navigate("/backup")} className="px-6 py-5 flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <div><h3 className="text-lg font-bold text-slate-800">Backup & Restore</h3><p className="text-xs text-slate-400 mt-0.5">Create snapshots, restore, or schedule automatic backups</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{recentBackups.length > 0 ? `${recentBackups.length} on record` : "Protected"}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
        <div className="border-t border-slate-100">
          {backupsLoading ? (
            <div className="px-6 py-6 text-center"><svg className="animate-spin h-5 w-5 mx-auto text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-xs text-slate-400 mt-2">Loading backups…</p></div>
          ) : recentBackups.length === 0 ? (
            <div className="px-6 py-6 text-center"><div className="w-10 h-10 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg></div><p className="text-sm text-slate-400">No backups yet</p><p className="text-xs text-slate-300 mt-0.5">Create your first snapshot from the Backup & Restore page</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentBackups.map((b, i) => {
                const totalRows = b.table_row_counts ? Object.values(b.table_row_counts).reduce((a, v) => a + v, 0) : null;
                const tableCount = b.table_row_counts ? Object.keys(b.table_row_counts).length : null;
                const checksumShort = b.checksum ? `${b.checksum.slice(0, 6)}…${b.checksum.slice(-4)}` : null;
                return (
                  <div key={b.backup_id || i} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                      <div className="min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{b.storage_path || b.snapshot_name || `Backup ${i + 1}`}</p><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5"><span className="text-xs text-slate-400">{formatBackupDate(b.created_at)}</span>{tableCount && <span className="text-xs text-slate-400">{tableCount} tables{totalRows ? ` · ${totalRows.toLocaleString()} rows` : ""}</span>}{checksumShort && <span className="text-xs text-slate-300 font-mono">{checksumShort}</span>}</div></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0"><span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Verified</span><span className="text-xs text-slate-400">{timeAgo(b.created_at)}</span></div>
                  </div>
                );
              })}
              <div onClick={() => navigate("/backup")} className="px-6 py-3 text-center cursor-pointer hover:bg-slate-50 transition-colors"><span className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">View all backups & settings →</span></div>
            </div>
          )}
        </div>
      </div>

      {/* SECURITY LOGS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 relative shadow-sm">
          <div><h2 className="text-lg font-bold text-slate-800">Recent Security Logs</h2>{!loading && <p className="text-xs text-slate-400 mt-0.5">{totalLogs} total events recorded</p>}</div>
          <button onClick={() => setShowAllLogs(!showAllLogs)} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-md">{showAllLogs ? "Show Less" : "View All"}</button>
        </div>
        <div className={`divide-y divide-slate-100 transition-all duration-300 ${showAllLogs ? "max-h-96 overflow-y-auto" : ""}`}>
          {loading && <div className="px-6 py-8 text-center text-slate-400 text-sm">Loading logs…</div>}
          {error && <div className="px-6 py-8 text-center text-rose-500 text-sm">{error}</div>}
          {!loading && !error && logs.length === 0 && <div className="px-6 py-8 text-center text-slate-400 text-sm">No audit events recorded yet. Logs will appear here after users log in, log out, or register.</div>}
          {!loading && !error && logs.map((log) => {
            const { title, type, status } = mapActionToDisplay(log.action);
            const styles = getLogStyles(type);
            return (
              <div key={log.audit_id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}>
                    {type === "critical" && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    {type === "success" && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    {type === "info" && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  </div>
                  <div><p className="text-sm font-bold text-slate-800">{title}</p><p className="text-xs text-slate-500 mt-0.5">{buildDescription(log)}</p></div>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto">
                  <span className={`text-xs font-bold ${styles.badgeBg} ${styles.badgeText} px-2.5 py-1 rounded-full uppercase tracking-wide`}>{status}</span>
                  <span className="text-xs text-slate-400 mt-1">{timeAgo(log.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PLATFORM OVERVIEW — Groups & user allocation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div onClick={() => navigate("/users")} className="flex justify-between items-end mb-6 cursor-pointer group">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Platform Overview</h2>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </div>
            <p className="text-sm text-slate-500 mt-1">User distribution & groups — click to manage</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-blue-600">{totalUsers}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total Users</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} layout="vertical" margin={{ left: 30, right: 30 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} />
              <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} className="cursor-pointer"
                onClick={() => navigate("/users")}>
                {distributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* USERS TABLE — switchable by role, 10-row cap */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800">Users</h2>
              <select value={tableView} onChange={e => { setTableView(e.target.value); setShowAllUsers(false); }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="participants">Participants</option>
                <option value="caretakers">Caretakers</option>
                <option value="researchers">Researchers</option>
                <option value="admins">Admins</option>
              </select>
              <span className="text-xs text-slate-400">{tableRows.length} total</span>
            </div>
            <button onClick={() => navigate("/users")} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Manage All Users →</button>
          </div>

          <div className={showAllUsers && hasMoreRows ? "max-h-[32rem] overflow-auto" : ""}>
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">{col3Label}</th>
                <th className="px-6 py-4">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {tableRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-400">No {tableView} registered yet. Send an invite from User Management.</td></tr>
                ) : visibleRows.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{u.email || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{getCol3(u)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${u.status ? roleBadge(tableRoleKey) : "bg-slate-50 text-slate-400"}`}>
                        {u.status ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMoreRows && (
            <div className="px-6 py-3 border-t border-slate-100 text-center">
              <button onClick={() => setShowAllUsers(!showAllUsers)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                {showAllUsers ? "Show less" : `View all ${tableRows.length} ${tableView} →`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <NotificationsPanel role="admin" />
    </div>
  );
}

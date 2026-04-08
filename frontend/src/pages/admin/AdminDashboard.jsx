import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

function formatBackupDate(isoString) {
  if (!isoString) return "No backups yet";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.adminGetDashboardSummary();
        if (!cancelled) setSummary(data || null);
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError("Could not load dashboard summary.");
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const nowMs = Date.now();
  const totalUsers = summary?.users?.total ?? 0;
  const activeUsers = summary?.users?.active ?? 0;
  const lockedUsers = summary?.users?.locked ?? 0;
  const invitesPending = summary?.invites?.pending ?? 0;
  const failedLogins = summary?.security?.failed_logins ?? 0;
  const groupsWithoutCaretaker = summary?.groups?.without_caretaker ?? 0;
  const latestBackupAt = summary?.backup?.latest_created_at ?? null;
  const backupAgeHours = latestBackupAt
    ? Math.max(0, Math.floor((nowMs - new Date(latestBackupAt).getTime()) / (1000 * 60 * 60)))
    : null;

  const surveyDailyRate = summary?.survey?.daily_completion_rate ?? 0;
  const surveyDoneToday = summary?.survey?.completed_today ?? 0;
  const surveyExpectedToday = summary?.survey?.expected_today ?? 0;

  const needsAttention = useMemo(() => {
    const items = [];
    if (groupsWithoutCaretaker > 0) {
      items.push({
        key: "groups-without-caretaker",
        title: `${groupsWithoutCaretaker} group${groupsWithoutCaretaker > 1 ? "s" : ""} without caretaker`,
        body: "Assign caretakers to avoid unmanaged participants.",
        cta: "Manage Groups",
        onClick: () => navigate("/users"),
        tone: "rose",
      });
    }
    if (lockedUsers > 0) {
      items.push({
        key: "locked-users",
        title: `${lockedUsers} locked account${lockedUsers > 1 ? "s" : ""}`,
        body: "Review recent failed logins and unlock legitimate users.",
        cta: "Review Users",
        onClick: () => navigate("/users"),
        tone: "amber",
      });
    }
    if (backupAgeHours === null || backupAgeHours > 24) {
      items.push({
        key: "backup-stale",
        title: backupAgeHours === null ? "No backup on record" : `Backup stale (${backupAgeHours}h old)`,
        body: "Create or verify a fresh backup snapshot.",
        cta: "Open Backup",
        onClick: () => navigate("/backup"),
        tone: "indigo",
      });
    }
    if (failedLogins > 0) {
      items.push({
        key: "failed-logins",
        title: `${failedLogins} failed login event${failedLogins > 1 ? "s" : ""}`,
        body: "Inspect security events for suspicious activity.",
        cta: "Open Audit Logs",
        onClick: () => navigate("/audit-logs"),
        tone: "rose",
      });
    }
    return items;
  }, [backupAgeHours, failedLogins, groupsWithoutCaretaker, lockedUsers, navigate]);

  const toneClasses = {
    rose: "border-rose-100 bg-rose-50/60",
    amber: "border-amber-100 bg-amber-50/60",
    indigo: "border-indigo-100 bg-indigo-50/60",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Actionable signals first. Details live in dedicated pages.</p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 min-h-[136px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Users</p>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0M12 11a4 4 0 100-8 4 4 0 000 8m8 9a8 8 0 10-16 0" /></svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-blue-600">{loading ? "—" : `${activeUsers}/${totalUsers}`}</p>
          <p className="text-sm text-slate-500">Active users</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 min-h-[136px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Invites</p>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9 6 9-6m-18 8h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" /></svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-600">{loading ? "—" : invitesPending}</p>
          <p className="text-sm text-slate-500">Pending invites</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 min-h-[136px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Survey Fill</p>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-3M5 21h14a1 1 0 001-1V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1z" /></svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-indigo-600">{loading ? "—" : `${surveyDailyRate}%`}</p>
          <p className="text-sm text-slate-500">Today ({surveyDoneToday}/{surveyExpectedToday})</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 min-h-[136px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Backup Freshness</p>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7m-16 0c0 2.21 3.582 4 8 4s8-1.79 8-4m-16 0c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-600">
            {loading ? "—" : backupAgeHours === null ? "None" : `${backupAgeHours}h`}
          </p>
          <p className="text-sm text-slate-500">{loading ? "Loading…" : formatBackupDate(latestBackupAt)}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 min-h-[136px]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security</p>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" /></svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-rose-600">{loading ? "—" : failedLogins}</p>
          <p className="text-sm text-slate-500">Failed logins</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">Needs Attention</h2>
          {needsAttention.length > 0 && (
            <span className="text-[11px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
              {needsAttention.length} alert{needsAttention.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading alerts…</p>
        ) : needsAttention.length === 0 ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
            No urgent alerts right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {needsAttention.map((item) => (
              <div key={item.key} className={`rounded-xl border p-4 shadow-sm ${toneClasses[item.tone] || "border-slate-100 bg-slate-50"}`}>
                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-600 mt-1">{item.body}</p>
                <button
                  onClick={item.onClick}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  {item.cta}
                  <span aria-hidden>→</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-base font-bold text-slate-800 mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button onClick={() => navigate("/users")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Users & Roles</p>
            <p className="text-xs text-slate-500 mt-0.5">Manage accounts, groups, invites.</p>
          </button>
          <button onClick={() => navigate("/admin/insights")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">System Insights</p>
            <p className="text-xs text-slate-500 mt-0.5">Gauges, onboarding, survey analytics.</p>
          </button>
          <button onClick={() => navigate("/backup")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Backup & Restore</p>
            <p className="text-xs text-slate-500 mt-0.5">Snapshots, restore, schedules.</p>
          </button>
          <button onClick={() => navigate("/audit-logs")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Audit Logs</p>
            <p className="text-xs text-slate-500 mt-0.5">Security and system event history.</p>
          </button>
          <button onClick={() => navigate("/admin/messages")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">Messages & Feedback</p>
            <p className="text-xs text-slate-500 mt-0.5">Notifications and user feedback inbox.</p>
          </button>
          <button onClick={() => navigate("/settings")} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">System Settings</p>
            <p className="text-xs text-slate-500 mt-0.5">Configuration and controls.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

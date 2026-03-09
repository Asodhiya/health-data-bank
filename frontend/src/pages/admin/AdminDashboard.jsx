import { useState, useEffect } from "react";
import { api } from "../../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a raw action string from the DB to a display-friendly shape.
 * Keeps the UI in sync with whatever action strings the backend writes.
 */
function mapActionToDisplay(action) {
  switch (action) {
    case "LOGIN_SUCCESS":
      return { title: "Successful Login", type: "success", status: "Success" };
    case "LOGIN_FAILED":
      return { title: "Failed Login Attempt", type: "critical", status: "Failed" };
    case "LOGOUT":
      return { title: "User Logout", type: "info", status: "Logout" };
    case "REGISTER_SUCCESS":
      return { title: "New Account Registered", type: "success", status: "Registered" };
    case "PASSWORD_RESET_REQUESTED":
      return { title: "Password Reset Requested", type: "info", status: "Modified" };
    default:
      return { title: action, type: "info", status: action };
  }
}

/**
 * Build the subtitle line shown under the event title.
 * Uses actor_label (name or email) and ip_address from the log entry.
 */
function buildDescription(log) {
  const parts = [];
  if (log.actor_label && log.actor_label !== "Unknown") {
    parts.push(`User: ${log.actor_label}`);
  } else if (log.details?.email_attempted) {
    parts.push(`Email: ${log.details.email_attempted}`);
  }
  if (log.ip_address) {
    parts.push(`IP: ${log.ip_address}`);
  }
  return parts.join(" • ") || "No additional info";
}

/**
 * Convert an ISO timestamp to a relative "X mins ago" label.
 */
function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

/**
 * Style map for each log type (matches existing Tailwind classes).
 */
function getLogStyles(type) {
  switch (type) {
    case "critical":
      return {
        bg: "bg-rose-50", text: "text-rose-600",
        badgeBg: "bg-rose-100", badgeText: "text-rose-700",
      };
    case "success":
      return {
        bg: "bg-emerald-50", text: "text-emerald-600",
        badgeBg: "bg-emerald-100", badgeText: "text-emerald-700",
      };
    case "info":
    default:
      return {
        bg: "bg-blue-50", text: "text-blue-600",
        badgeBg: "bg-blue-100", badgeText: "text-blue-700",
      };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch 3 logs for the preview, or 20 when expanded
  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .getAuditLogs({ limit: showAllLogs ? 20 : 3 })
      .then((data) => {
        setLogs(data.logs);
        setTotalLogs(data.total);
      })
      .catch((err) => {
        setError("Could not load security logs.");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [showAllLogs]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          System health status • Identify risks • Spot bad actors
        </p>
      </div>

      {/* TOP METRIC GAUGES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Server Load */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Server Load</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="82" />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 -rotate-45 rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">34%</p>
          <p className="text-sm text-slate-500 font-medium">Healthy</p>
        </div>

        {/* Card 2: Uptime */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Uptime</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="0" />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 rotate-[70deg] rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">99.97%</p>
          <p className="text-sm text-slate-500 font-medium">Excellent</p>
        </div>

        {/* Card 3: Security Alerts — shows count of LOGIN_FAILED from real data */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100 ring-1 ring-rose-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">Security Alerts</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center z-10">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset="30" />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-rose-600 origin-bottom -translate-x-1/2 rotate-[45deg] rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-rose-700 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-rose-500 mt-4 relative z-10">
            {logs.filter((l) => l.action === "LOGIN_FAILED").length} Failed
          </p>
          <p className="text-sm text-rose-600 font-bold relative z-10">Recent logins</p>
        </div>
      </div>

      {/* RECENT SECURITY LOGS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 relative shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Recent Security Logs</h2>
            {!loading && (
              <p className="text-xs text-slate-400 mt-0.5">{totalLogs} total events recorded</p>
            )}
          </div>
          <button
            onClick={() => setShowAllLogs(!showAllLogs)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-md"
          >
            {showAllLogs ? "Show Less" : "View All"}
          </button>
        </div>

        {/* Log rows */}
        <div className={`divide-y divide-slate-100 transition-all duration-300 ${showAllLogs ? "max-h-96 overflow-y-auto" : ""}`}>
          {loading && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">Loading logs…</div>
          )}

          {error && (
            <div className="px-6 py-8 text-center text-rose-500 text-sm">{error}</div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              No audit events recorded yet. Logs will appear here after users log in, log out, or register.
            </div>
          )}

          {!loading && !error && logs.map((log) => {
            const { title, type, status } = mapActionToDisplay(log.action);
            const styles = getLogStyles(type);
            const desc = buildDescription(log);

            return (
              <div
                key={log.audit_id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Icon avatar */}
                  <div className={`w-10 h-10 rounded-full ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}>
                    {type === "critical" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {type === "success" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {type === "info" && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto">
                  <span className={`text-xs font-bold ${styles.badgeBg} ${styles.badgeText} px-2.5 py-1 rounded-full uppercase tracking-wide`}>
                    {status}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">{timeAgo(log.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* USER ROLE DISTRIBUTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800">User Distribution</h2>
            <p className="text-sm text-slate-500 mt-1">Active accounts across the platform</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-blue-600">1,025</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total Users</p>
          </div>
        </div>
        <div className="space-y-5">
          {[
            { label: "Participants", color: "bg-blue-500", pct: 83, count: 850 },
            { label: "Caretakers", color: "bg-emerald-500", pct: 11, count: 120 },
            { label: "Researchers", color: "bg-indigo-500", pct: 5, count: 45 },
            { label: "Admins", color: "bg-rose-500", pct: 1, count: 10 },
          ].map(({ label, color, pct, count }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold text-slate-700 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
                  {label}
                </span>
                <span className="text-slate-500 font-medium">{count} users ({pct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className={`${color} h-2.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

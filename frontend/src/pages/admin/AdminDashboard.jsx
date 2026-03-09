import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import api from "../../utils/axiosInstance";
import { useOutletContext } from "react-router-dom";
// Mock data array (This mimics what the backend will eventually send)
const mockSecurityLogs = [
  {
    id: 1,
    type: "critical",
    title: "Failed Login Attempt",
    desc: "IP: 192.168.1.45 • Unknown Device",
    status: "Failed",
    time: "2 mins ago",
  },
  {
    id: 2,
    type: "success",
    title: "Caretaker Login",
    desc: "User: Nayan • Chrome / Mac OS",
    status: "Success",
    time: "15 mins ago",
  },
  {
    id: 3,
    type: "info",
    title: "Password Policy Updated",
    desc: "Admin: You • System Settings",
    status: "Modified",
    time: "1 hour ago",
  },
  {
    id: 4,
    type: "success",
    title: "Data Export Completed",
    desc: "Researcher: Dr. Smith • Weekly Report",
    status: "Success",
    time: "2 hours ago",
  },
  {
    id: 5,
    type: "critical",
    title: "Multiple Failed Logins",
    desc: "IP: 45.33.22.11 • 5 attempts blocked",
    status: "Blocked",
    time: "3 hours ago",
  },
  {
    id: 6,
    type: "info",
    title: "System Backup Created",
    desc: "Automated Routine • Server US-East",
    status: "Success",
    time: "5 hours ago",
  },
  {
    id: 7,
    type: "success",
    title: "Participant Account Created",
    desc: "Admin: You • ID: #8849",
    status: "Success",
    time: "6 hours ago",
  },
  {
    id: 8,
    type: "critical",
    title: "Unrecognized Device Detected",
    desc: "Caretaker Account • Mobile App",
    status: "Flagged",
    time: "12 hours ago",
  },
  {
    id: 9,
    type: "info",
    title: "API Keys Regenerated",
    desc: "System Settings • Automated Rotation",
    status: "Modified",
    time: "1 day ago",
  },
  {
    id: 10,
    type: "success",
    title: "Database Sync Complete",
    desc: "Health Records • Version 2.4",
    status: "Success",
    time: "1 day ago",
  },
];
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
  const [users, setUsers] = useState([]);

  // Fetch users for the management part
  useEffect(() => {
    api
      .get("/admin_only/view_roles")
      .then((res) => setUsers(res.data))
      .catch((err) => console.log("Waiting for Admin Role API...", err));
  }, []);

  // THE CHART DATA (Keep this mock for your demo)
  const distributionData = [
    { name: "Participants", count: 850, color: "#3b82f6" },
    { name: "Caretakers", count: 120, color: "#10b981" },
    { name: "Researchers", count: 45, color: "#6366f1" },
    { name: "Admins", count: 10, color: "#f43f5e" },
  ];
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
            <h2 className="text-lg font-bold text-slate-800">
              User Distribution
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Real-time account breakdown
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-blue-600">1,025</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Total Users
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distributionData}
              layout="vertical"
              margin={{ left: 30, right: 30 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold text-slate-800">
              User Management
            </h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {/* Later you will map real 'users' here */}
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-700">
                  Monkey D. Luffy
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  luffy@grandline.com
                </td>
                <td className="px-6 py-4">
                  <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                    Participant
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:underline text-xs font-bold">
                    Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

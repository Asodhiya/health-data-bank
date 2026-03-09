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

export default function AdminDashboard() {
  // Track if the log view is expanded
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

  // Decide which logs to show based on the state
  const visibleLogs = showAllLogs
    ? mockSecurityLogs
    : mockSecurityLogs.slice(0, 3);

  // Helper function to quickly style each log based on its 'type'
  const getLogStyles = (type) => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-rose-50",
          text: "text-rose-600",
          badgeBg: "bg-rose-100",
          badgeText: "text-rose-700",
        };
      case "success":
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-600",
          badgeBg: "bg-emerald-100",
          badgeText: "text-emerald-700",
        };
      case "info":
      default:
        return {
          bg: "bg-blue-50",
          text: "text-blue-600",
          badgeBg: "bg-blue-100",
          badgeText: "text-blue-700",
        };
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">System Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          System health status • Identify risks • Spot bad actors
        </p>
      </div>

      {/* STEP 1: TOP METRIC GAUGES (Unchanged) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Server Load */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Server Load
          </h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg
              viewBox="0 0 100 55"
              className="w-full h-full overflow-visible"
            >
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset="82"
              />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 -rotate-45 rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">34%</p>
          <p className="text-sm text-slate-500 font-medium">Healthy</p>
        </div>

        {/* Card 2: Uptime */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Uptime
          </h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg
              viewBox="0 0 100 55"
              className="w-full h-full overflow-visible"
            >
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#10b981"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset="0"
              />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 rotate-[70deg] rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-500 mt-4">
            99.97%
          </p>
          <p className="text-sm text-slate-500 font-medium">Excellent</p>
        </div>

        {/* Card 3: Security Alerts */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100 ring-1 ring-rose-50 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 relative z-10">
            Security Alerts
          </h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center z-10">
            <svg
              viewBox="0 0 100 55"
              className="w-full h-full overflow-visible"
            >
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#ef4444"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset="30"
              />
            </svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-rose-600 origin-bottom -translate-x-1/2 rotate-[45deg] rounded-full"></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-rose-700 rounded-full -translate-x-1/2"></div>
          </div>
          <p className="text-3xl font-extrabold text-rose-500 mt-4 relative z-10">
            1 Critical
          </p>
          <p className="text-sm text-rose-600 font-bold relative z-10">
            Action Req
          </p>
        </div>
      </div>

      {/* STEP 2: RECENT SECURITY LOGS Dynamic & Scrollable!) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header Area */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white z-10 relative shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">
            Recent Security Logs
          </h2>
          <button
            onClick={() => setShowAllLogs(!showAllLogs)}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-md"
          >
            {showAllLogs ? "Show Less" : "View All"}
          </button>
        </div>

        {/* Logs List Container (Scrollable when expanded) */}
        <div
          className={`divide-y divide-slate-100 transition-all duration-300 ${showAllLogs ? "max-h-96 overflow-y-auto custom-scrollbar" : ""}`}
        >
          {visibleLogs.map((log) => {
            const styles = getLogStyles(log.type);

            return (
              <div
                key={log.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Dynamic Icon Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full ${styles.bg} ${styles.text} flex items-center justify-center shrink-0`}
                  >
                    {log.type === "critical" && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    )}
                    {log.type === "success" && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    {log.type === "info" && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {log.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{log.desc}</p>
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto">
                  <span
                    className={`text-xs font-bold ${styles.badgeBg} ${styles.badgeText} px-2.5 py-1 rounded-full uppercase tracking-wide`}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {log.time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* STEP 3: USER ROLE DISTRIBUTION */}
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

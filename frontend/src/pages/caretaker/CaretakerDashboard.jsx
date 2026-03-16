import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom"; // 👈 Add this!
import api from "../../utils/axiosInstance";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import NotificationsPanel from "../../components/NotificationsPanel";

// Mock Data: This represents what Nayan's backend will eventually send
const mockGroupMembers = [
  { id: 1, name: "N. Karki", status: "Active", state: "good" },
  {
    id: 2,
    name: "N. Sherpa",
    status: "Last seen 2 days ago",
    state: "warning",
  },
  { id: 3, name: "A. Shodhiya", status: "Active", state: "good" },
  {
    id: 4,
    name: "A. Chataut",
    status: "Inactive for 2 weeks",
    state: "critical",
  },
  { id: 5, name: "R. Patel", status: "Active", state: "good" },
  { id: 6, name: "S. Kim", status: "Active", state: "good" },
  { id: 7, name: "J. Wong", status: "Last seen 1 day ago", state: "warning" },
  { id: 8, name: "M. Silva", status: "Active", state: "good" },
];

// Array 2: Alerts (This is what visibleAlerts uses!)
const mockAlerts = [
  {
    id: 1,
    name: "N. Mir",
    issue: "High pain Reported",
    btnText: "View",
    btnColor: "blue",
  },
  {
    id: 2,
    name: "D. Job",
    issue: "Missed 5 Check-ins",
    btnText: "Alert",
    btnColor: "amber",
  },
  {
    id: 3,
    name: "Group",
    issue: "< 70% Active",
    btnText: "Review",
    btnColor: "indigo",
  },
  {
    id: 4,
    name: "A. Smith",
    issue: "Blood pressure spike",
    btnText: "Call",
    btnColor: "rose",
  },
  {
    id: 5,
    name: "T. Jones",
    issue: "Requested new forms",
    btnText: "View",
    btnColor: "blue",
  },
];

export default function CaretakerDashboard() {
  const { user } = useOutletContext();
  const [members, setMembers] = useState(mockGroupMembers);
  const [loading, setLoading] = useState(true);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // 1. THE HYDRATION SKELETON (Ready for Nayan's backend)
  useEffect(() => {
    // We will use a placeholder URL until team creates the Caretaker routes
    api
      .get("/caretaker/overview")
      .then((response) => {
        // setMembers(response.data.members);
      })
      .catch((err) => console.log("Waiting for backend endpoints...", err))
      .finally(() => setLoading(false));
  }, []);

  // 2. THE CHART DATA
  const pieData = [
    { name: "Active", value: 6, color: "#10b981" }, // Emerald
    { name: "Warning", value: 2, color: "#f59e0b" }, // Amber
    { name: "Critical", value: 1, color: "#f43f5e" }, // Rose
  ];

  const visibleAlerts = showAllAlerts ? mockAlerts : mockAlerts.slice(0, 3);

  // Helper to get the right dot color based on state
  const getDotColor = (state) => {
    switch (state) {
      case "good":
        return "bg-emerald-500";
      case "warning":
        return "bg-amber-500";
      case "critical":
        return "bg-rose-500";
      default:
        return "bg-slate-300";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Caretaker Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your assigned groups and manage participant health.
        </p>
      </div>

      {/* STEP 1: CRITICAL ALERTS BANNER */}
      <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100 shadow-sm relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none opacity-50"></div>

        <div className="flex justify-between items-center gap-2 mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-rose-600"
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
            <h2 className="text-lg font-bold text-rose-800 uppercase tracking-wide">
              Critical Alerts{" "}
              <span className="text-sm font-medium text-rose-600 capitalize normal-case">
                (Action Required)
              </span>
            </h2>
          </div>

          <button
            onClick={() => setShowAllAlerts(!showAllAlerts)}
            className="text-sm font-medium text-rose-700 bg-white/50 hover:bg-white px-3 py-1.5 rounded-md transition-colors"
          >
            {showAllAlerts ? "Show Less" : "View All"}
          </button>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 transition-all duration-300 ${
            showAllAlerts
              ? "max-h-60 overflow-y-auto custom-scrollbar pr-2"
              : ""
          }`}
        >
          {visibleAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white rounded-xl p-4 border border-rose-100 shadow-sm flex justify-between items-center h-fit"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <span className="font-bold text-sm">!</span>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {alert.name}{" "}
                  <span className="text-slate-400 font-normal mx-1">→</span>{" "}
                  {alert.issue}
                </p>
              </div>
              <button
                className={`bg-${alert.btnColor}-50 text-${alert.btnColor}-600 hover:bg-${alert.btnColor}-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors`}
              >
                {alert.btnText}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM GRID SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STEP 2: GROUP STATUS OVERVIEW */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h2 className="text-lg font-bold text-slate-800">
                Group Status Overview
              </h2>
            </div>
            <span className="text-sm font-medium text-slate-400">
              8 members
            </span>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto max-h-[400px] p-2 custom-scrollbar">
            <div className="divide-y divide-slate-50">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${getDotColor(member.state)}`}
                    ></span>
                    <p className="font-bold text-slate-800">{member.name}</p>
                    <p className="text-sm text-slate-500">— {member.status}</p>
                  </div>

                  {/* Show "Remind" button only if not in good standing */}
                  {member.state !== "good" && (
                    <button className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Remind
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 3: GROUP HEALTH SNAPSHOT */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
          <h2 className="text-lg font-bold text-slate-800 mb-6">
            Group Health Snapshot
          </h2>

          <div className="flex-1 flex flex-col justify-center items-center">
            {/* Custom SVG Donut Chart */}
            {/* DYNAMIC RECHARTS DONUT CHART */}
            <div className="relative w-full h-64 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ color: "#1e293b", fontWeight: "bold" }}
                  />
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60} // This makes it a donut instead of a full pie!
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Text overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">
                  Total
                </span>
                <span className="text-4xl font-extrabold text-slate-800">
                  9
                </span>
              </div>
            </div>

            {/* Stat Blocks */}
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* Stat 1 */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0"></div>
                <div>
                  <p className="text-xl font-bold text-emerald-700">73%</p>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                    Active
                  </p>
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-blue-500 shrink-0"></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">25%</p>
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap">
                    Forms Submitted
                  </p>
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-indigo-500 shrink-0"></div>
                <div>
                  <p className="text-xl font-bold text-indigo-700">99%</p>
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    Stable Patients
                  </p>
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-rose-500 shrink-0"></div>
                <div>
                  <p className="text-xl font-bold text-rose-700">0%</p>
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                    Critical
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS PANEL */}
      <NotificationsPanel role="caretaker" />
    </div>
  );
}

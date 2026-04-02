import { Link, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 shadow-md rounded-lg border border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase">
          {payload[0].payload.name}
        </p>
        <p className="text-sm font-bold text-slate-800">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function ParticipantDashboard() {
  // For now we are setting up our use mock data here :

  const { user } = useOutletContext();

  const [surveys, setSurveys] = useState([]);
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // We fetch everything in parallel for speed
        const [surveyData, goalData, statsData] = await Promise.all([
          api.getAssignedSurveys(),
          api.listParticipantGoals(),
          api.getMyStats(), // 🟢 Fetching real chart data
        ]);

        setSurveys(surveyData || []);
        setGoals(goalData || []);
        setStats(statsData);

        console.log("📊 Stats Data Loaded:", statsData);
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Detect if the user is on a mobile screen (under 640px wide)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial size
    setIsMobile(window.innerWidth < 640);

    // Update if they rotate their phone or resize the window
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Current Date:
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // greetings on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: "☀️" };
    if (hour < 18) return { text: "Good afternoon", icon: "🌤️" };
    return { text: "Good evening", icon: "🌙" };
  };

  const greetings = getGreeting();

  const chartData = stats
    ? [
        { name: "Active Surveys", score: stats.active_forms, color: "#3b82f6" },
        { name: "Forms Filled", score: stats.forms_filled, color: "#10b981" },
        { name: "Active Goals", score: stats.active_goals, color: "#f59e0b" },
        {
          name: "Goals Remaining",
          score: stats.goal_remaining,
          color: "#ef4444",
        },
        { name: "Goals Met", score: stats.goals_met, color: "#8b5cf6" },
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0">
      {/* STEP 1: TOP WELCOME BANNER */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Left Side: Greeting & Pill */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            {greetings.text} , {user?.firstName}! {greetings.icon}
          </h1>

          {/* Hydration Pill */}
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 00-.707.293l-4 4a1 1 0 101.414 1.414L9 5.414V13a1 1 0 102 0V5.414l2.293 2.293a1 1 0 001.414-1.414l-4-4A1 1 0 0010 2z"
                clipRule="evenodd"
              />
            </svg>
            Remember to stay hydrated today
          </div>
        </div>

        {/* Right Side: Weather & Date Placeholder */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 w-full md:w-auto">
          {/* Weather Icon (Cloud/Sun) */}
          <div className="text-amber-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
            </svg>
          </div>

          {/* Date Info */}
          <div>
            <p className="text-sm font-medium text-slate-500">Today</p>
            <p className="text-lg font-bold text-slate-800">{todayFormatted}</p>
          </div>
        </div>
      </div>

      {/* STEP 2: HEALTH OVERVIEW & PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Progress Chart (Takes up 2 columns on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">
            Progress Bar
          </h2>

          <div className="space-y-5">
            {/* Week 1 Bar */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-2">
                Daily Acitivity Overview
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Tracking your survey completions and goal progress.
              </p>
              <div className="h-64 w-full">
                {chartData && chartData.length > 0 ? (
                  /* THE ACTUAL CHART */
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 10, left: 10, bottom: 0 }} // Added top margin for labels
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        // If mobile, hide text (false). If desktop, show text with standard styling.
                        tick={
                          isMobile ? false : { fontSize: 12, fill: "#64748b" }
                        }
                        // Shrink the bottom gap on mobile so the chart looks perfectly centered
                        height={isMobile ? 10 : 30}
                        axisLine={false}
                        tickLine={false}
                      />
                      {/* 🟢 YAxis is hidden, but still exists so the bars have a coordinate system */}
                      <YAxis hide={true} domain={[0, "dataMax + 1"]} />

                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        content={<CustomTooltip />}
                      />

                      <Bar
                        dataKey="score"
                        radius={[6, 6, 0, 0]}
                        barSize={40}
                        animationDuration={1000}
                        // We'll use a simple background here; if it doesn't show, it's fine!
                        background={{ fill: "#f1f5f9", radius: 6 }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  /* THE EMPTY STATE */
                  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <span className="text-4xl mb-3 block">📊</span>
                    <p className="text-slate-700 font-medium">
                      No health data available yet.
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Complete your first survey to generate your score!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Success: The Game-Changer Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 mx-auto shadow-inner border border-blue-100/50">
              <span className="text-3xl">🎯</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              Daily Success
            </h2>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1">
              Today's Completion
            </p>
          </div>

          <div className="my-8 text-center relative">
            {/* Large Percentage Display */}
            <span className="text-6xl font-black text-slate-800 tracking-tighter">
              {stats
                ? Math.round(
                    ((stats.forms_filled + (stats.goals_met || 0)) /
                      (stats.active_forms + stats.active_goals || 1)) *
                      100,
                  )
                : 0}
              <span className="text-2xl text-blue-500 ml-1">%</span>
            </span>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-50">
            {/* Remaining Tasks Badge */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-500">
                Tasks Left
              </span>
              <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-rose-100">
                {stats
                  ? stats.active_forms -
                    stats.forms_filled +
                    (stats.active_goals - (stats.goals_met || 0))
                  : 0}
              </span>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-1000 ease-out rounded-full shadow-sm"
                  style={{
                    width: `${stats ? Math.round(((stats.forms_filled + (stats.goals_met || 0)) / (stats.active_forms + stats.active_goals || 1)) * 100) : 0}%`,
                  }}
                ></div>
              </div>

              {/* Dynamic Sub-text */}
              <p className="text-[11px] text-center text-slate-400 font-medium italic">
                {stats?.forms_filled + stats?.goals_met === 0
                  ? "Click 'Start Entry' below to begin!"
                  : "Keep going, you're doing great!"}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* STEP 3: SURVEY TEMPLATES CAROUSEL */}
      <div className="bg-blue-600 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        {/* Section Header & Arrow Buttons */}
        <div className="flex justify-between items-end mb-6 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-white">
              Daily Health Surveys
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Select a template to log your data for today.
            </p>
          </div>

          {/* Desktop Carousel Arrows (Visual placeholders) */}
          <div className="hidden md:flex gap-2">
            <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
        {/* Horizontal Scroll Container */}
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x relative z-10 custom-scrollbar">
          {loading ? (
            <p className="text-white animate-pulse">
              Checking for assigned surveys... 🔍
            </p>
          ) : surveys && surveys.length > 0 ? ( // 👈 Use 'surveys' here
            surveys.map((survey) => (
              <div
                key={survey.form_id}
                className="min-w-[260px] bg-white rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4 text-xl">
                  {/* If backend doesn't have icons, use a default */}
                  {survey.icon || "📋"}
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {survey.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-6 flex-1 line-clamp-2">
                  {survey.description || "Daily health tracking survey."}
                </p>
                <Link
                  to={`/participant/surveys/${survey.form_id}`}
                  className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition-colors shadow-sm block"
                >
                  Start Entry
                </Link>
              </div>
            ))
          ) : (
            <div className="min-w-[260px] w-full bg-white/10 rounded-xl p-8 text-center border border-white/20 backdrop-blur-sm">
              <span className="text-4xl mb-3 block">🎉</span>
              <h3 className="text-xl font-bold text-white">
                You're all caught up!
              </h3>
              <p className="text-blue-100 mt-2">
                No surveys assigned today. Enjoy your day off!
              </p>
            </div>
          )}
        </div>{" "}
      </div>
    </div>
  );
}

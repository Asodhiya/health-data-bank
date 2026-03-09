import { Link, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../utils/axiosInstance";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// 🎨 CUSTOM CHART HOVER EFFECT
const CustomTooltip = ({ active, payload, label }) => {
  // "active" means the mouse is hovering. "payload" holds our data!
  if (active && payload && payload.length) {
    // payload[0].payload gives us access to {name, score, focus}
    const data = payload[0].payload;

    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 outline-none">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <p className="text-sm font-medium text-slate-700">
            Score: <span className="text-blue-600">{data.score}%</span>
          </p>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 inline-block px-2 py-1 rounded-md mt-1 border border-slate-100">
          Focus: {data.focus}
        </p>
      </div>
    );
  }
  return null;
};

export default function ParticipantDashboard() {
  // For now we are setting up our use mock data here :

  const { user } = useOutletContext();

  console.log(user);

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

  // survey list from backend, Empty List
  const [surveys, setSurveys] = useState([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);

  // ⚠️ DELETE THIS LATER: Fake data just to see the UI while DB is empty
  const dummySurveys = [
    {
      id: 1,
      title: "Nutrition Log",
      description: "Record your meals and water intake for the day.",
      icon: "🥗",
    },
    {
      id: 2,
      title: "Sleep Tracker",
      description: "Log your sleep hours and resting quality.",
      icon: "😴",
    },
    {
      id: 3,
      title: "Mood Check-in",
      description: "A quick check-in on your stress and mental wellbeing.",
      icon: "🧠",
    },
  ];

  // ⚠️ DELETE THIS LATER: Fake data for the Recharts BarChart
  const healthScoreData = [
    { name: "Week 1", score: 85, focus: "Nutrition" },
    { name: "Week 2", score: 92, focus: "Sleep" },
    { name: "Week 3", score: 78, focus: "Activity" },
    { name: "Week 4", score: 88, focus: "Mood" },
  ];

  // 🔄 SWITCH: Change this to `surveys` when real data is added to the DB.
  const displaySurveys = dummySurveys;

  useEffect(() => {
    api
      .get("/participant/surveys/assigned")
      .then((response) => {
        console.log("📋 Raw Survey Data:", response.data);

        setSurveys(response.data);
      })
      .catch((err) => {
        console.error("Failed to fetch surveys:", err);
      })
      .finally(() => {
        setLoadingSurveys(false);
      });
  }, []);

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
            Monthly Health Score
          </h2>

          <div className="space-y-5">
            {/* Week 1 Bar */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-2">
                Monthly Health Score
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Your overall wellness average for the past 4 weeks.
              </p>

              {/* THE RECHARTS COMPONENT */}
              {/* THE RECHARTS COMPONENT OR EMPTY STATE */}
              <div className="h-64 w-full">
                {healthScoreData && healthScoreData.length > 0 ? (
                  /* THE ACTUAL CHART */
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={healthScoreData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        content={<CustomTooltip />}
                      />
                      <Bar
                        dataKey="score"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                        barSize={40}
                        animationDuration={1500}
                      />
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

        {/* Quick Stats: Current Streak (Takes 1 column) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            {/* Flame Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-amber-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Current Streak</h2>
          <div className="flex items-baseline justify-center gap-1 mt-2">
            <span className="text-5xl font-extrabold text-slate-800">12</span>
            <span className="text-slate-500 font-medium">days</span>
          </div>
          <p className="text-sm text-slate-500 mt-4 px-2">
            You're doing great! Keep logging your daily surveys to maintain your
            health streak.
          </p>
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
          {/* Card 1: Nutrition */}
          {/* Horizontal Scroll Container */}
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x relative z-10 custom-scrollbar">
            {/* PASTE STARTING HERE 👇 */}
            {loadingSurveys ? (
              <p className="text-white animate-pulse">
                Checking for assigned surveys... 🔍
              </p>
            ) : displaySurveys.length > 0 ? (
              displaySurveys.map((survey) => (
                <div
                  key={survey.id}
                  className="min-w-[260px] bg-slate-50 rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4 text-xl">
                    {survey.icon || "📋"}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {survey.title}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 mb-6 flex-1">
                    {survey.description}
                  </p>
                  <Link
                    to="/participant/survey"
                    className="w-full text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg font-medium transition-colors"
                  >
                    Start Survey
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
          {/* Make sure this closing div is still here! */}
        </div>
      </div>
    </div>
  );
}

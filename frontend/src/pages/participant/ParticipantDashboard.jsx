import { Link } from "react-router-dom";

export default function ParticipantDashboard() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0">
      {/* STEP 1: TOP WELCOME BANNER */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Left Side: Greeting & Pill */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Good morning, Bobo Boys! ☀️
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
            <p className="text-lg font-bold text-slate-800">Feb 19, 2026</p>
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
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-600">
                  Week 1 (Nutrition Focus)
                </span>
                <span className="text-blue-600 font-bold">85%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out w-[85%]"></div>
              </div>
            </div>

            {/* Week 2 Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-600">
                  Week 2 (Sleep Focus)
                </span>
                <span className="text-blue-600 font-bold">92%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out w-[92%]"></div>
              </div>
            </div>

            {/* Week 3 Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-600">
                  Week 3 (Activity Focus)
                </span>
                <span className="text-blue-600 font-bold">78%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out w-[78%]"></div>
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
        {/* Decorative background circle (faded white) to add texture */}
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
          <div className="min-w-[260px] bg-slate-50 rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
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
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Nutrition Log</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6 flex-1">
              Record your meals and water intake for the day.
            </p>
            <Link
              to="/participant/survey"
              className="w-full text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg font-medium transition-colors"
            >
              Start Survey
            </Link>
          </div>

          {/* Card 2: Sleep */}
          <div className="min-w-[260px] bg-slate-50 rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
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
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Sleep Tracker</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6 flex-1">
              Log your sleep hours and resting quality.
            </p>
            <button className="w-full text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg font-medium transition-colors">
              Start Survey
            </button>
          </div>

          {/* Card 3: Mental Health */}
          <div className="min-w-[260px] bg-slate-50 rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
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
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Mood Check-in</h3>
            <p className="text-sm text-slate-500 mt-1 mb-6 flex-1">
              A quick check-in on your stress and mental wellbeing.
            </p>
            <button className="w-full text-center bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg font-medium transition-colors">
              Start Survey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

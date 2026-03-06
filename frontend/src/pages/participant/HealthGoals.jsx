import { useState } from "react";

export default function HealthGoals() {
  // We will use this state later to open/close our "Create Goal" popup
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            My Health Goals
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Track your daily targets and build healthy habits.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Create New Goal
        </button>
      </div>

      {/* 2. SUMMARY CARDS ZONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Goal Overview */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
          <h3 className="text-slate-500 font-bold text-sm mb-4 tracking-wide uppercase">
            Weekly Overview
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium">Sleep</span>
                <span className="font-bold text-slate-800">80%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full w-[80%] transition-all duration-500"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700 font-medium">Hydration</span>
                <span className="font-bold text-slate-800">70%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full w-[70%] transition-all duration-500"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Streaks & Trophies */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-500 text-lg">🔥</span>
            <h3 className="text-slate-500 font-bold text-sm tracking-wide uppercase">
              Streaks & Trophies
            </h3>
          </div>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex justify-between items-center">
              <span className="font-medium">Water Intake</span>
              <span className="font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs">
                12 Days
              </span>
            </li>
            <li className="flex justify-between items-center">
              <span className="font-medium">Activity</span>
              <span className="font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs">
                6 Days
              </span>
            </li>
          </ul>
          <div className="mt-4 bg-green-50 text-green-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 border border-green-100">
            <span>🏆</span> Water goal met yesterday!
          </div>
        </div>

        {/* Card 3: Reminders */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
          <h3 className="text-slate-500 font-bold text-sm mb-4 tracking-wide uppercase">
            Action Items
          </h3>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3 bg-rose-50 p-3 rounded-lg border border-rose-100">
              <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></div>
              <p className="text-slate-800 font-medium">
                Log your morning water intake (2 glasses).
              </p>
            </li>
            <li className="flex items-start gap-3 p-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
              <p className="text-slate-600">
                Update your sleep tracker for last night.
              </p>
            </li>
          </ul>
        </div>
      </div>

      {/* 3. ACTIVE GOALS GRID ZONE (Empty for now) */}
      {/* 3. ACTIVE GOALS GRID ZONE */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Active Goals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Goal Card 1: Water */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                  💧
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Water Intake
                </h3>
              </div>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-full">
                In Progress
              </span>
            </div>

            <div className="mt-auto">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-500">Today's Progress</span>
                <span className="text-blue-600 font-bold">5 / 8 glasses</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                <div className="bg-blue-500 h-2.5 rounded-full w-[62%] transition-all duration-500"></div>
              </div>

              {/* Quick Log Controls */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-blue-600 font-bold text-xl transition-colors flex items-center justify-center">
                  -
                </button>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-800 text-lg">5</span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Glasses
                  </span>
                </div>
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-blue-600 font-bold text-xl transition-colors flex items-center justify-center">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Goal Card 2: Steps */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl">
                  👟
                </div>
                <h3 className="font-bold text-slate-800 text-lg">
                  Daily Steps
                </h3>
              </div>
              <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-bold px-2.5 py-1 rounded-full">
                Goal Met!
              </span>
            </div>

            <div className="mt-auto">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-500">Today's Progress</span>
                <span className="text-green-600 font-bold">
                  10,200 / 10k steps
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                <div className="bg-green-500 h-2.5 rounded-full w-[100%] transition-all duration-500"></div>
              </div>

              {/* Quick Log Controls */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 font-bold text-xl transition-colors flex items-center justify-center">
                  -
                </button>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-800 text-sm">
                    Update
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Manual Entry
                  </span>
                </div>
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 font-bold text-xl transition-colors flex items-center justify-center">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Goal Card 3: Sleep */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                  🌙
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Sleep</h3>
              </div>
              <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold px-2.5 py-1 rounded-full">
                Pending
              </span>
            </div>

            <div className="mt-auto">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-500">Last Night</span>
                <span className="text-indigo-600 font-bold">0 / 8 hours</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6">
                <div className="bg-indigo-200 h-2.5 rounded-full w-[5%] transition-all duration-500"></div>
              </div>

              {/* Quick Log Controls */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 font-bold text-xl transition-colors flex items-center justify-center">
                  -
                </button>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-800 text-lg">0</span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    Hours
                  </span>
                </div>
                <button className="w-10 h-10 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 font-bold text-xl transition-colors flex items-center justify-center">
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 4. MODAL OVERLAY ZONE (Empty for now) */}
      {/* 4. MODAL OVERLAY ZONE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          {/* Modal Container */}
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                Create New Goal
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body (Form) */}
            <div className="p-6 space-y-5">
              {/* Goal Type */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Goal Category
                </label>
                <select className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-700 font-medium">
                  <option value="hydration">💧 Hydration</option>
                  <option value="activity">👟 Activity & Steps</option>
                  <option value="sleep">🌙 Sleep</option>
                  <option value="nutrition">🥗 Nutrition</option>
                </select>
              </div>

              {/* Target & Unit Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Daily Target
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 8"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-700 font-medium"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Unit
                  </label>
                  <select className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-700 font-medium">
                    <option value="glasses">Glasses</option>
                    <option value="steps">Steps</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>

              {/* Duration Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert("Goal Saved! (We will wire this to Supabase later)");
                  setIsModalOpen(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

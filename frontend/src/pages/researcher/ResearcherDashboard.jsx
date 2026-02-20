import { useState, useMemo } from "react";

// 1. Expanded Mock Data based on your detailed researcher requirements
const mockResearchData = [
  {
    id: "USR-128",
    group: "Group A",
    survey: "Mental Health",
    age: 52,
    gender: "Male",
    score: 42,
    maxScore: 50,
    status: "Completed",
    date: "2026-02-18",
  },
  {
    id: "USR-045",
    group: "Group B",
    survey: "Daily Check-in",
    age: 28,
    gender: "Female",
    score: 7,
    maxScore: 10,
    status: "Completed",
    date: "2026-02-18",
  },
  {
    id: "USR-312",
    group: "Control",
    survey: "Mental Health",
    age: 61,
    gender: "Female",
    score: 21,
    maxScore: 50,
    status: "Incomplete",
    date: "2026-02-17",
  },
  {
    id: "USR-067",
    group: "Group A",
    survey: "Demographics",
    age: 38,
    gender: "Non-binary",
    score: null,
    maxScore: null,
    status: "Completed",
    date: "2026-02-17",
  },
  {
    id: "USR-198",
    group: "Group B",
    survey: "Mental Health",
    age: 55,
    gender: "Male",
    score: 38,
    maxScore: 50,
    status: "Completed",
    date: "2026-02-16",
  },
  {
    id: "USR-255",
    group: "Control",
    survey: "Daily Check-in",
    age: 65,
    gender: "Female",
    score: 4,
    maxScore: 10,
    status: "Completed",
    date: "2026-02-16",
  },
  {
    id: "USR-401",
    group: "Group A",
    survey: "Daily Check-in",
    age: 41,
    gender: "Male",
    score: 8,
    maxScore: 10,
    status: "Completed",
    date: "2026-02-15",
  },
  {
    id: "USR-089",
    group: "Group B",
    survey: "Mental Health",
    age: 59,
    gender: "Female",
    score: 45,
    maxScore: 50,
    status: "Completed",
    date: "2026-02-15",
  },
  {
    id: "USR-502",
    group: "Group A",
    survey: "Mental Health",
    age: 22,
    gender: "Female",
    score: 31,
    maxScore: 50,
    status: "Completed",
    date: "2026-02-14",
  },
  {
    id: "USR-114",
    group: "Control",
    survey: "Daily Check-in",
    age: 34,
    gender: "Male",
    score: 2,
    maxScore: 10,
    status: "Dropped",
    date: "2026-02-14",
  },
];

export default function ResearcherDashboard() {
  // 2. Comprehensive Filter State
  const [group, setGroup] = useState("All");
  const [surveyType, setSurveyType] = useState("All");
  const [gender, setGender] = useState("All");
  const [status, setStatus] = useState("All");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [minScore, setMinScore] = useState("");

  // 3. The Core Processing Engine (Runs every time a filter changes)
  const filteredData = useMemo(() => {
    return mockResearchData.filter((row) => {
      const matchGroup = group === "All" || row.group === group;
      const matchSurvey = surveyType === "All" || row.survey === surveyType;
      const matchGender = gender === "All" || row.gender === gender;
      const matchStatus = status === "All" || row.status === status;

      const matchMinAge = minAge === "" || row.age >= parseInt(minAge);
      const matchMaxAge = maxAge === "" || row.age <= parseInt(maxAge);
      const matchMinScore =
        minScore === "" ||
        (row.score !== null && row.score >= parseInt(minScore));

      return (
        matchGroup &&
        matchSurvey &&
        matchGender &&
        matchStatus &&
        matchMinAge &&
        matchMaxAge &&
        matchMinScore
      );
    });
  }, [group, surveyType, gender, status, minAge, maxAge, minScore]);

  // 4. Dynamic Calculations (Mean & Count based on filtered results)
  const stats = useMemo(() => {
    const count = filteredData.length;
    const scoredRows = filteredData.filter((r) => r.score !== null);

    // Calculate Mean (Average) safely
    const mean =
      scoredRows.length > 0
        ? (
            scoredRows.reduce((acc, row) => acc + row.score, 0) /
            scoredRows.length
          ).toFixed(1)
        : "N/A";

    return { count, mean, scoredCount: scoredRows.length };
  }, [filteredData]);

  // Helper to quickly clear all filters
  const resetFilters = () => {
    setGroup("All");
    setSurveyType("All");
    setGender("All");
    setStatus("All");
    setMinAge("");
    setMaxAge("");
    setMinScore("");
  };

  return (
    // Changed to full width container (max-w-none or just no max-w constraint) to give the table maximum breathing room
    <div className="w-full space-y-6">
      {/* PAGE HEADER & EXPORT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Raw Data Explorer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Filter participant responses, analyze summary statistics, and export
            your cohort.
          </p>
        </div>

        {/* Export matches the filtered dataset! */}
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm">
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export {stats.count} Rows (CSV)
        </button>
      </div>

      {/* TOP SECTION: THE FILTER ENGINE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
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
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Query Parameters
          </h2>
          <button
            onClick={resetFilters}
            className="text-sm font-bold text-slate-400 hover:text-rose-500 transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {/* Group / Cohort */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Cohort Group
            </label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            >
              <option value="All">All Cohorts</option>
              <option value="Group A">Group A (Treatment)</option>
              <option value="Group B">Group B (Treatment)</option>
              <option value="Control">Control Group</option>
            </select>
          </div>

          {/* Survey Type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Survey Type
            </label>
            <select
              value={surveyType}
              onChange={(e) => setSurveyType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            >
              <option value="All">All Surveys</option>
              <option value="Mental Health">Mental Health</option>
              <option value="Daily Check-in">Daily Check-in</option>
              <option value="Demographics">Demographics</option>
            </select>
          </div>

          {/* Demographics: Gender */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            >
              <option value="All">Any Gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          {/* Demographics: Age Range */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Age Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scores & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Min Score
              </label>
              <input
                type="number"
                placeholder="e.g. 10"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              >
                <option value="All">All</option>
                <option value="Completed">Done</option>
                <option value="Incomplete">Inc.</option>
                <option value="Dropped">Drop</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: DYNAMIC SUMMARY CALCULATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Filtered Results
            </p>
            <p className="text-2xl font-extrabold text-slate-800">
              {stats.count}{" "}
              <span className="text-sm font-medium text-slate-500 normal-case">
                rows
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Mean Score
            </p>
            <p className="text-2xl font-extrabold text-slate-800">
              {stats.mean}{" "}
              <span className="text-sm font-medium text-slate-500 normal-case">
                avg
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Scored Submissions
            </p>
            <p className="text-2xl font-extrabold text-slate-800">
              {stats.scoredCount}{" "}
              <span className="text-sm font-medium text-slate-500 normal-case">
                valid rows
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: FULL WIDTH RAW DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Participant ID
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Group
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Demographics
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Survey Type
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Raw Score
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-blue-600 font-medium">
                      {row.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200">
                        {row.group}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">
                        {row.age} yrs
                      </p>
                      <p className="text-xs text-slate-500">{row.gender}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {row.survey}
                    </td>
                    <td className="px-6 py-4">
                      {row.score !== null ? (
                        <p className="text-sm font-bold text-slate-800">
                          {row.score}{" "}
                          <span className="text-slate-400 font-normal">
                            / {row.maxScore}
                          </span>
                        </p>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${
                          row.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "Incomplete"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {row.date}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-slate-300 mx-auto mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    <p className="text-slate-600 font-bold text-lg">
                      No matching records found
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      Adjust your query parameters to see more data.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

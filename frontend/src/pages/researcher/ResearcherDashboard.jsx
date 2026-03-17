import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../services/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ResearcherDashboard() {
  // 👈 2. Safe user fallback so the sidebar/layout doesn't crash
  const { user } = useOutletContext() || {};

  const [queryData, setQueryData] = useState({ columns: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState([]);

  // 👈 3. New states to hold our filter data (we will use these in Step 2)
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [filters, setFilters] = useState({
    survey_id: "",
    group_id: "",
    search: "",
    status: "",
    gender: "",
    age_min: "",
    age_max: "",
  });

  const [viewMode, setViewMode] = useState("table"); // "table" or "charts"

  // 👈 4. Fetch the real data using api.js
  useEffect(() => {
    setLoading(true);
    // Fetch both the survey list and the table data at the same time
    Promise.all([
      api.getAvailableSurveys().catch(() => []),
      api.getResearcherResults().catch(() => ({ columns: [], data: [] })),
    ])
      .then(([surveysRes, resultsRes]) => {
        setAvailableSurveys(surveysRes || []);
        setQueryData({
          columns: resultsRes.columns || [],
          data: resultsRes.data || [],
        });
      })
      .catch((err) => console.error("API Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // RE-ADD STATS CALCULATION (Unchanged)
  const stats = useMemo(() => {
    const count = queryData.data.length;
    const scoredRows = queryData.data.filter(
      (r) => r.score !== null && r.score !== undefined,
    );
    const mean =
      scoredRows.length > 0
        ? (
            scoredRows.reduce((acc, row) => acc + Number(row.score), 0) /
            scoredRows.length
          ).toFixed(1)
        : "0.0";

    return {
      count,
      mean,
      scoredCount: scoredRows.length,
    };
  }, [queryData]);

  // DERIVE CHART DATA
  const chartData = useMemo(() => {
    const genderCounts = { male: 0, female: 0, other: 0 };
    const ageBuckets = { "Under 25": 0, "26-35": 0, "36-50": 0, "51+": 0 };

    queryData.data.forEach((row) => {
      // Tally Gender
      const g = (row.gender || "").toLowerCase();
      if (genderCounts[g] !== undefined) genderCounts[g]++;

      // Tally Age Buckets
      const a = row.age;
      if (a) {
        if (a <= 25) ageBuckets["Under 25"]++;
        else if (a >= 26 && a <= 35) ageBuckets["26-35"]++;
        else if (a >= 36 && a <= 50) ageBuckets["36-50"]++;
        else if (a >= 51) ageBuckets["51+"]++;
      }
    });

    return {
      gender: [
        { name: "Male", value: genderCounts.male },
        { name: "Female", value: genderCounts.female },
        { name: "Other", value: genderCounts.other },
      ].filter((d) => d.value > 0), // Only show genders that actually exist in the data
      age: Object.keys(ageBuckets).map((k) => ({
        name: k,
        count: ageBuckets[k],
      })),
    };
  }, [queryData]);

  const CHART_COLORS = ["#3b82f6", "#10b981", "#6366f1"]; // Blue, Emerald, Indigo

  // 👈 5. Updated Reset Function
  const resetFilters = () => {
    setLoading(true);
    setFilters({
      survey_id: "",
      group_id: "",
      search: "",
      status: "",
      gender: "",
      age_min: "",
      age_max: "",
    });
    api
      .getResearcherResults()
      .then((res) =>
        setQueryData({ columns: res.columns || [], data: res.data || [] }),
      )
      .catch((err) => console.error("API Error:", err))
      .finally(() => setLoading(false));
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Clean filters (removes empty strings)
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== ""),
      );
      await api.downloadResearcherResults(activeFilters);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    setLoading(true);
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== ""),
    );
    api
      .getResearcherResults(activeFilters)
      .then((res) =>
        setQueryData({ columns: res.columns || [], data: res.data || [] }),
      )
      .catch((err) => console.error("Filter Error:", err))
      .finally(() => setLoading(false));
  };

  if (loading)
    return (
      <div className="p-10 text-slate-500 font-bold">
        Connecting to Research Vault...
      </div>
    );

  // DO NOT DELETE OR CHANGE ANYTHING BELOW THIS LINE.
  // Your `return (` starts here!

  return (
    <div className="w-full space-y-6">
      {/* PAGE HEADER & EXPORT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, {user?.first_name || "Researcher"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyzing {stats.count} participant responses in the database.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || stats.count === 0}
          className={`px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm text-sm ${isExporting || stats.count === 0 ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"}`}
        >
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {isExporting
            ? "Exporting CSV..."
            : `Export ${stats.count} Rows (CSV)`}
        </button>
      </div>

      {/* NEW SECTION: DATA FILTERS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Data Filters
          </h2>
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
          >
            Clear Filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Search Box (Spans 2 columns) */}
          <input
            type="text"
            placeholder="🔍 Search name or email..."
            className="lg:col-span-2 p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 placeholder-slate-400"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />

          {/* 2. Survey Dropdown (Spans 2 columns) */}
          <select
            className="lg:col-span-2 p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500"
            value={filters.survey_id}
            onChange={(e) => handleFilterChange("survey_id", e.target.value)}
          >
            <option value="">All Surveys</option>
            {availableSurveys.map((s) => (
              <option key={s.form_id || s.id} value={s.form_id || s.id}>
                {s.title || s.name}
              </option>
            ))}
          </select>

          {/* 3. Group ID */}
          <input
            type="text"
            placeholder="Group ID (Optional)"
            className="p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 placeholder-slate-400"
            value={filters.group_id}
            onChange={(e) => handleFilterChange("group_id", e.target.value)}
          />

          {/* 4. Status Dropdown */}
          <select
            className="p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500"
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive / Dropped</option>
          </select>

          {/* 5. Gender Dropdown */}
          <select
            className="p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500"
            value={filters.gender}
            onChange={(e) => handleFilterChange("gender", e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>

          {/* 6. Age Range (Grouped in one column) */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min Age"
              className="w-1/2 p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500"
              value={filters.age_min}
              onChange={(e) => handleFilterChange("age_min", e.target.value)}
            />
            <input
              type="number"
              placeholder="Max Age"
              className="w-1/2 p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500"
              value={filters.age_max}
              onChange={(e) => handleFilterChange("age_max", e.target.value)}
            />
          </div>

          {/* 7. Apply Button (Spans full width at the bottom) */}
          <button
            onClick={applyFilters}
            className="lg:col-span-4 bg-slate-800 text-white p-2.5 rounded-lg text-sm font-bold hover:bg-blue-600 transition shadow-sm active:scale-95 flex justify-center items-center"
          >
            {loading ? "Searching Database..." : "Apply Filters"}
          </button>
        </div>
      </div>

      {/* SECTION A: THE ATTRIBUTE SELECTOR */}
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
            Visible Attributes
          </h2>
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
          >
            Refresh Schema
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {queryData.columns.map((col) => (
            <label key={col.id} className="flex items-center gap-2 ...">
              <input
                type="checkbox"
                checked={!hiddenColumns.includes(col.id)} // It's checked if it's NOT in the hidden list
                onChange={() => {
                  if (hiddenColumns.includes(col.id)) {
                    setHiddenColumns(
                      hiddenColumns.filter((id) => id !== col.id),
                    ); // Remove from hidden
                  } else {
                    setHiddenColumns([...hiddenColumns, col.id]); // Add to hidden
                  }
                }}
                className="..."
              />
              <span>{col.text}</span>
            </label>
          ))}
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Filtered Results
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.count} Rows
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Mean Score
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.mean} Avg
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Valid Entries
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.scoredCount} Scored
            </p>
          </div>
        </div>
      </div>

      {/* SECTION D: VIEW TOGGLE & CONTENT */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* THE TOGGLE HEADER */}
        <div className="flex border-b border-slate-100 bg-slate-50 p-2">
          <button
            onClick={() => setViewMode("table")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === "table" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            📋 Raw Data Table
          </button>
          <button
            onClick={() => setViewMode("charts")}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === "charts" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            📊 Analytics & Charts
          </button>
        </div>

        {/* CONDITIONALLY RENDER TABLE OR CHARTS */}
        <div className="p-0">
          {viewMode === "table" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {queryData.columns
                      .filter((col) => !hiddenColumns.includes(col.id))
                      .map((col) => (
                        <th
                          key={col.id}
                          className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest"
                        >
                          {col.text || col.id}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queryData.data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      {queryData.columns
                        .filter((col) => !hiddenColumns.includes(col.id))
                        .map((col) => {
                          const value = row[col.id];
                          return (
                            <td
                              key={col.id}
                              className="px-6 py-4 text-sm font-bold text-slate-700"
                            >
                              {col.id.includes("id") && value ? (
                                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                  {value.substring(0, 8)}...
                                </span>
                              ) : value !== null && value !== undefined ? (
                                String(value)
                              ) : (
                                <span className="text-slate-300 italic">—</span>
                              )}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {queryData.data.length === 0 && !loading && (
                <div className="p-20 flex flex-col items-center justify-center text-slate-300">
                  <span className="text-6xl mb-4">📭</span>
                  <p className="font-black text-xs uppercase tracking-widest">
                    No Participant Data Found
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* THE NEW CHARTS VIEW */
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50/50">
              {/* Chart 1: Gender Distribution */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-6 text-center uppercase tracking-widest">
                  Gender Distribution
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.gender}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.gender.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          `${value} Participants`,
                          "Count",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {chartData.gender.map((entry, index) => (
                    <div
                      key={entry.name}
                      className="flex items-center gap-2 text-xs font-bold text-slate-600"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      ></span>
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: Age Demographics */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-6 text-center uppercase tracking-widest">
                  Age Demographics
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.age}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: 12,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 12,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

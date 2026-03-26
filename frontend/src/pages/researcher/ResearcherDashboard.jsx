import { useState, useEffect, useMemo, useRef } from "react";
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
  const [filtering, setFiltering] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState([]);

  const [attributeSearch, setAttributeSearch] = useState("");

  // 👈 3. New states to hold our filter data (we will use these in Step 2)
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  // 🟢 UPDATED: group_id is now an array (group_ids) for multi-select
  const [filters, setFilters] = useState({
    survey_id: "",
    group_ids: [],
    search: "",
    status: "",
    gender: "",
    primary_language: "",
    date_range: "all_time", // 🟢 New!
    age_min: "18", // 🟢 New!
    age_max: "100", // 🟢 New!
  });

  const [surveySearch, setSurveySearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  // Ref to detect clicking outside the dropdowns
  const filterRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsSurveyOpen(false);
        setIsGroupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [viewMode, setViewMode] = useState("table"); // "table" or "charts"

  // 1. Initial Data Load — load surveys+groups first so the page renders immediately,
  //    then fetch results in the background (shown as filtering spinner, not full-page block)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAvailableSurveys().catch(() => []),
      api.listGroups().catch(() => []),
    ])
      .then(([formsRes, groupsRes]) => {
        setAvailableSurveys(formsRes || []);
        const fetchedGroups = groupsRes || [];
        setAllGroups(fetchedGroups);
        setAvailableGroups(fetchedGroups);
      })
      .catch((err) => console.error("API Error:", err))
      .finally(() => setLoading(false));

    // Results load in the background — page is already visible by the time this finishes
    setFiltering(true);
    api
      .getResearcherResults()
      .then((resultsRes) =>
        setQueryData({
          columns: (resultsRes.columns || []).filter(
            (col) =>
              col.id !== "participant_id" &&
              col.text?.toLowerCase() !== "participant id",
          ),
          data: resultsRes.data || [],
        }),
      )
      .catch((err) => console.error("Results Error:", err))
      .finally(() => setFiltering(false));
  }, []);

  // 2. The Instant Local Group Filter (NOW WITH AUTO-SELECT!)
  useEffect(() => {
    if (!filters.survey_id) {
      setAvailableGroups(allGroups); // Show all if no survey is selected
      // Don't auto-clear groups here just in case they are browsing all surveys
    } else {
      const survey = availableSurveys.find(
        (s) => (s.form_id || s.id) === filters.survey_id,
      );

      if (
        survey &&
        survey.deployed_groups &&
        survey.deployed_groups.length > 0
      ) {
        // Find the actual group objects from the master list
        const validGroups = allGroups.filter((g) =>
          survey.deployed_groups.includes(g.name),
        );
        setAvailableGroups(validGroups);

        // 🟢 THE FIX: Auto-select ALL deployed groups by default!
        const validIds = validGroups.map((g) => g.group_id || g.id);
        setFilters((prev) => ({
          ...prev,
          group_ids: validIds, // Instantly selects them all so the pills appear
        }));
      } else {
        setAvailableGroups([]);
        setFilters((prev) => ({ ...prev, group_ids: [] }));
      }
    }
  }, [filters.survey_id, allGroups, availableSurveys]);

  // Auto-fetch when any filter changes (debounced 400ms)
  const filterMounted = useRef(false);
  useEffect(() => {
    if (!filterMounted.current) { filterMounted.current = true; return; }
    const timer = setTimeout(() => applyFilters(), 400);
    return () => clearTimeout(timer);
  }, [filters.survey_id, filters.gender, filters.status, filters.primary_language, filters.age_min, filters.age_max]);

  // NEW STATS CALCULATION: Filtered Results, Total Participants, Active Groups
  const stats = useMemo(() => {
    const count = queryData.data.length;

    // 🟢 NEW RATIO LOGIC
    const selectedCount = filters.group_ids.length;
    const totalAssigned = availableGroups.length;

    return {
      count,
      totalParticipants: count,
      // This creates the "1 of 2" text
      activeGroupsText:
        selectedCount > 0
          ? `${selectedCount} of ${totalAssigned}`
          : totalAssigned > 0
            ? `All (${totalAssigned})`
            : "0",
      isFiltered: selectedCount > 0 && selectedCount < totalAssigned,
    };
  }, [queryData, filters.group_ids, availableGroups]);

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
      group_ids: [],
      search: "",
      status: "",
      gender: "",
      primary_language: "",
      date_range: "all_time",
      age_min: "18",
      age_max: "65",
    });
    api
      .getResearcherResults()
      .then((res) =>
        setQueryData({
          columns: (res.columns || []).filter(
            (col) =>
              col.id !== "participant_id" &&
              col.text?.toLowerCase() !== "participant id",
          ),
          data: res.data || [],
        }),
      )
      .catch((err) => console.error("API Error:", err))
      .finally(() => setLoading(false));
  };


  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([k, v]) => k !== "group_ids" && v !== ""),
      );
      await api.downloadResearcherResults(activeFilters, hiddenColumns);
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
    setFiltering(true);
    const activeFilters = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (key === "group_ids") {
        // group filtering not yet implemented on backend, skip
      } else if (value !== "" && value !== "all_time") {
        activeFilters[key] = value;
      }
    });

    api
      .getResearcherResults(activeFilters)
      .then((res) =>
        setQueryData({
          columns: (res.columns || []).filter(
            (col) =>
              col.id !== "participant_id" &&
              col.text?.toLowerCase() !== "participant id",
          ),
          data: res.data || [],
        }),
      )
      .catch((err) => console.error("Filter Error:", err))
      .finally(() => setFiltering(false));
  };

  if (loading)
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold animate-pulse text-blue-400">
          Loading Health Data Bank... 🩺
        </p>
      </div>
    );

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
          {isExporting ? "Exporting..." : `Export ${stats.count} Rows (CSV)`}
        </button>
      </div>
      {/* ── NEW DATA FILTERS UI (MOCKUP STYLE) ── */}
      <div
        className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
        ref={filterRef}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Data filters
            </h2>
            {/* Active Filters Badge */}
            {(filters.group_ids.length > 0 ||
              filters.survey_id ||
              filters.status ||
              filters.gender ||
              filters.primary_language) && (
              <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-100 uppercase tracking-wide">
                {[filters.survey_id, filters.status, filters.gender, filters.primary_language, ...filters.group_ids].filter(Boolean).length} filters active
              </span>
            )}
          </div>
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 px-4 py-1.5 rounded-full transition-colors flex items-center gap-1"
          >
            Clear filters
          </button>
        </div>

        <div className="space-y-5">
          {/* Survey Combobox */}
          {/* ── Survey Combobox ── */}
          <div className="relative z-30">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Survey
            </label>

            {/* Inner wrapper keeps dropdown perfectly attached to the input */}
            <div className="relative">
              <div className="flex items-center border border-slate-200 rounded-lg p-1.5 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm">
                <span className="pl-2 pr-2 text-slate-400">
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                {filters.survey_id && !isSurveyOpen ? (
                  <div
                    className="flex-1 text-sm font-medium text-slate-800 p-1 cursor-pointer truncate"
                    onClick={() => setIsSurveyOpen(true)}
                  >
                    {availableSurveys.find(
                      (s) => (s.form_id || s.id) === filters.survey_id,
                    )?.title || "Selected Survey"}
                  </div>
                ) : (
                  <input
                    type="text"
                    className="flex-1 text-sm text-slate-800 p-1 outline-none bg-transparent placeholder-slate-400"
                    placeholder="Search for a survey..."
                    value={surveySearch}
                    onChange={(e) => setSurveySearch(e.target.value)}
                    onFocus={() => setIsSurveyOpen(true)}
                  />
                )}
                {filters.survey_id && (
                  <button
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        survey_id: "",
                        group_ids: [],
                      }))
                    }
                    className="p-1 hover:bg-slate-100 rounded-md text-slate-400 mr-1 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Dropdown snaps directly below the input using top-full */}
              {isSurveyOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                  {(() => {
                    const q = surveySearch.toLowerCase();
                    const published = availableSurveys.filter((s) => s.status !== "DELETED" && (s.title || "").toLowerCase().includes(q));
                    const deleted = availableSurveys.filter((s) => s.status === "DELETED" && (s.title || "").toLowerCase().includes(q));
                    const renderItem = (s) => (
                      <div
                        key={s.form_id || s.id}
                        className={`px-4 py-2.5 text-sm font-medium cursor-pointer border-b border-slate-50 last:border-0 truncate ${
                          s.status === "DELETED"
                            ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({ ...prev, survey_id: s.form_id || s.id }));
                          setSurveySearch("");
                          setIsSurveyOpen(false);
                        }}
                      >
                        {s.title || s.name}{s.status === "DELETED" && " (Deleted)"}
                      </div>
                    );
                    return (
                      <>
                        {published.length > 0 && (
                          <>
                            <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-y border-slate-100">
                              Published Forms
                            </div>
                            {published.map(renderItem)}
                          </>
                        )}
                        {deleted.length > 0 && (
                          <>
                            <div className="px-4 py-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider bg-rose-50 border-y border-rose-100">
                              Deleted Forms
                            </div>
                            {deleted.map(renderItem)}
                          </>
                        )}
                        {published.length === 0 && deleted.length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-400">No surveys found</div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ── Groups Combobox ── */}
          <div className="relative z-20">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 flex justify-between items-center">
              Groups
              {filters.group_ids.length > 0 && (
                <button
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, group_ids: [] }))
                  }
                  className="text-[10px] text-blue-500 hover:text-blue-700 uppercase tracking-widest font-bold"
                >
                  Deselect All
                </button>
              )}
            </label>

            <div className="relative">
              <div className="flex items-center border border-slate-200 rounded-lg p-1.5 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm">
                <span className="pl-2 pr-2 text-slate-400">
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 20v-2a3 3 0 00-5.356-1.857M15 20H9m6 0v-2c0-.656-.126-1.283-.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM7 10a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  className="flex-1 text-sm text-slate-800 p-1 outline-none bg-transparent placeholder-slate-400"
                  placeholder={
                    filters.survey_id
                      ? "Filter assigned groups..."
                      : "Select a survey first..."
                  }
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  onFocus={() => setIsGroupOpen(true)}
                />
              </div>

              {/* 🟢 DROPDOWN: absolute positioning prevents "popping" */}
              {isGroupOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-48 overflow-y-auto z-[100]">
                  {availableGroups
                    .filter((g) =>
                      (g.name || "")
                        .toLowerCase()
                        .includes(groupSearch.toLowerCase()),
                    )
                    .map((g) => {
                      const gid = g.group_id || g.id;
                      const isChecked = filters.group_ids.includes(gid);
                      return (
                        <label
                          key={gid}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFilters((prev) => ({
                                ...prev,
                                group_ids: isChecked
                                  ? prev.group_ids.filter((id) => id !== gid)
                                  : [...prev.group_ids, gid],
                              }));
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate flex-1">{g.name}</span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 🟢 PILLS: Only show when dropdown is CLOSED for a cleaner look */}
            {!isGroupOpen && filters.group_ids.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in slide-in-from-top-1">
                {filters.group_ids.map((gid) => {
                  const g = allGroups.find((x) => (x.group_id || x.id) === gid);
                  return (
                    <span
                      key={gid}
                      className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-[11px] font-bold border border-blue-100 shadow-sm"
                    >
                      {g?.name || `Group ${gid}`}
                      <button
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            group_ids: prev.group_ids.filter(
                              (id) => id !== gid,
                            ),
                          }))
                        }
                        className="hover:bg-blue-200 hover:text-rose-600 rounded-full p-0.5"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 3: Status, Gender, Language */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Participant status
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Gender
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.gender}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, gender: e.target.value }))
                }
              >
                <option value="">All genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Primary language
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.primary_language || ""}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    primary_language: e.target.value,
                  }))
                }
              >
                <option value="">All languages</option>
                <option value="english">English</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 4: Date Range & Age Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Date range
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.date_range}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    date_range: e.target.value,
                  }))
                }
              >
                <option value="all_time">All time</option>
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="last_3_months">Last 3 months</option>
                <option value="last_year">Last year</option>
              </select>
            </div>

            {/* Custom Age Range Control */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-500">
                  Age range
                </label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {filters.age_min || 0} – {filters.age_max || 100}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="120"
                  placeholder="Min"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm text-center"
                  value={filters.age_min}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, age_min: e.target.value }))
                  }
                />
                <span className="text-slate-300 font-bold">-</span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  placeholder="Max"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm text-center"
                  value={filters.age_max}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, age_max: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={applyFilters}
            className="w-full bg-[#1e5899] hover:bg-blue-800 text-white py-3 rounded-lg text-sm font-bold transition shadow-md active:scale-[0.99] mt-4 flex justify-center items-center gap-2"
          >
            {loading ? "Applying filters..." : "Apply filters"}
          </button>
        </div>
      </div>

      {/* SECTION A: THE ATTRIBUTE SELECTOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 pb-4 border-b border-slate-100">
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

          <div className="flex items-center gap-4 w-full md:w-auto">
            {/* 🟢 NEW: Search Bar for the checkboxes */}
            <input
              type="text"
              placeholder="🔍 Search attributes..."
              value={attributeSearch}
              onChange={(e) => setAttributeSearch(e.target.value)}
              className="p-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 w-full md:w-64"
            />
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest whitespace-nowrap"
            >
              Refresh Schema
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {queryData.columns
            // 🟢 SAFELY filter the checkboxes based on the search bar typing
            .filter((col) =>
              String(col?.text || col?.id || "")
                .toLowerCase()
                .includes(String(attributeSearch || "").toLowerCase()),
            )
            .map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(col.id)}
                  onChange={() => {
                    if (hiddenColumns.includes(col.id)) {
                      setHiddenColumns(
                        hiddenColumns.filter((id) => id !== col.id),
                      );
                    } else {
                      setHiddenColumns([...hiddenColumns, col.id]);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  {col?.text || col?.id}
                </span>
              </label>
            ))}

          {/* Quick empty state if they search for something that doesn't exist */}
          {queryData.columns.filter((col) =>
            String(col?.text || col?.id || "")
              .toLowerCase()
              .includes(String(attributeSearch || "").toLowerCase()),
          ).length === 0 && (
            <p className="text-sm text-slate-400 italic">
              No attributes match your search.
            </p>
          )}
        </div>
      </div>

      {/* MIDDLE SECTION: DYNAMIC SUMMARY CALCULATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Filtered Results (Kept this one!) */}
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

        {/* Card 2: Total Participants (NEW) */}
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M15 20v-2a3 3 0 00-5.356-1.857M15 20H9m6 0v-2c0-.656-.126-1.283-.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM7 10a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total Participants
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.totalParticipants} Unique
            </p>
          </div>
        </div>

        {/* Card 3: Active Groups (NEW) */}
        {/* Card 3: Active Groups */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${stats.isFiltered ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"}`}
          >
            {/* Same SVG as before */}
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Active Groups
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.activeGroupsText}
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
            <div className={`overflow-x-auto relative transition-opacity duration-200 ${filtering ? "opacity-50 pointer-events-none" : ""}`}>
              {filtering && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="text-sm text-slate-500 font-medium bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">Updating...</span>
                </div>
              )}
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

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
  const [allForms, setAllForms] = useState([]);
  // 🟢 UPDATED: group_id is now an array (group_ids) for multi-select
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [filters, setFilters] = useState({
    survey_id: "",
    group_ids: [],
    search: "",
    status: "",
    gender: "",
    primary_language: "",
    date_range: "all_time",
    age_min: "18",
    age_max: "100",
    highest_education_level: "",
    marital_status: "",
    living_arrangement: "",
    dependents: "",
    pronouns: "",
    occupation_status: "",
  });

  const [surveySearch, setSurveySearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);

  // 🟢 NEW: Individual refs for each dropdown so they close properly
  const surveyDropdownRef = useRef(null);
  const groupDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If click is outside the survey box, close survey
      if (
        surveyDropdownRef.current &&
        !surveyDropdownRef.current.contains(event.target)
      ) {
        setIsSurveyOpen(false);
      }
      // If click is outside the group box, close group
      if (
        groupDropdownRef.current &&
        !groupDropdownRef.current.contains(event.target)
      ) {
        setIsGroupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [viewMode, setViewMode] = useState("table"); // "table" or "charts"

  // 1. Initial Data Load — load surveys+groups first so the page renders immediately,
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAvailableSurveys().catch(() => []),
      api.listGroups().catch(() => []),
      api.listForms().catch(() => []), // 🟢 FETCH THE FULL FORMS LIST HERE
    ])
      .then(([formsRes, groupsRes, allFormsRes]) => {
        setAvailableSurveys(formsRes || []);

        const fetchedGroups = groupsRes || [];
        setAllGroups(fetchedGroups);
        setAvailableGroups(fetchedGroups);

        setAllForms(allFormsRes || []); // 🟢 STORE THE FULL FORMS LIST
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

  // 2. The Instant Local Group Filter (USING LISTFORMS DATA)
  useEffect(() => {
    if (!filters.survey_id) {
      setAvailableGroups(allGroups); // Show all groups if no survey selected
      return;
    }

    // 🟢 Look up the survey in allForms because it contains deployed_groups!
    const surveyDetails = allForms.find(
      (s) => (s.form_id || s.id) === filters.survey_id,
    );

    // Grab the exact arrays you saw in the Network tab
    const groupIds = surveyDetails?.deployed_group_ids || [];
    const groupNames = surveyDetails?.deployed_groups || [];

    if (groupIds.length > 0) {
      // Zip the IDs and Names together perfectly
      const mappedGroups = groupIds.map((id, index) => ({
        id: id,
        group_id: id,
        name: groupNames[index] || `Group ${id.substring(0, 8)}`,
      }));

      setAvailableGroups(mappedGroups);

      // Auto-select them so the blue pills appear instantly
      setFilters((prev) => {
        const currentStr = (prev.group_ids || []).slice().sort().join(",");
        const newStr = groupIds.slice().sort().join(",");
        if (currentStr === newStr) return prev; // Prevent infinite loops

        return { ...prev, group_ids: [...groupIds] };
      });
    } else {
      // Survey has zero deployed groups
      setAvailableGroups([]);
      setFilters((prev) => ({ ...prev, group_ids: [] }));
    }
  }, [filters.survey_id, allGroups, allForms]); // 🟢 Added allForms to dependencies

  // Auto-fetch when any filter changes (debounced 400ms)
  const filterMounted = useRef(false);
  useEffect(() => {
    if (!filterMounted.current) {
      filterMounted.current = true;
      return;
    }
    const timer = setTimeout(() => applyFilters(), 400);
    return () => clearTimeout(timer);
  }, [
    filters.survey_id,
    filters.group_ids, // 🟢 THIS WAS MISSING: It makes the table refresh when you click a pill
    filters.gender,
    filters.status,
    filters.primary_language,
    filters.age_min,
    filters.age_max,
    filters.highest_education_level,
    filters.marital_status,
    filters.living_arrangement,
    filters.dependents,
    filters.pronouns,
    filters.occupation_status,
  ]);

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

  // ── TABLE SORTING STATE & LOGIC ──
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...queryData.data];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        // We use ?? "" to safely handle those annoying null values we talked about!
        const aValue = a[sortConfig.key] ?? "";
        const bValue = b[sortConfig.key] ?? "";

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [queryData.data, sortConfig]);

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

  // 🟢 NEW: Smart age validation that runs when the user clicks away from the input
  const handleAgeBlur = (field) => {
    setFilters((prev) => {
      let currentMin = parseInt(prev.age_min, 10);
      let currentMax = parseInt(prev.age_max, 10);

      // Fallbacks if they leave it totally blank
      if (isNaN(currentMin)) currentMin = 18;
      if (isNaN(currentMax)) currentMax = 120;

      // 1. Absolute Caps: Nothing below 18, nothing above 120
      if (currentMin < 18) currentMin = 18;
      if (currentMin > 120) currentMin = 120;
      if (currentMax > 120) currentMax = 120;
      if (currentMax < 18) currentMax = 18;

      // 2. Logic Check: Min cannot be higher than Max
      if (field === "min" && currentMin > currentMax) {
        currentMin = currentMax;
      }
      if (field === "max" && currentMax < currentMin) {
        currentMax = currentMin;
      }

      return {
        ...prev,
        age_min: String(currentMin),
        age_max: String(currentMax),
      };
    });
  };

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
      age_max: "100",
      // 🟢 Add to reset
      highest_education_level: "",
      marital_status: "",
      living_arrangement: "",
      dependents: "",
      pronouns: "",
      occupation_status: "",
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
        Object.entries(filters).filter(
          ([k, v]) => k !== "group_ids" && v !== "",
        ),
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
        if (value.length > 0) {
          activeFilters.group_id = value.join(","); // 👈 LOOK HERE
        }
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
              filters.primary_language ||
              filters.highest_education_level ||
              filters.marital_status ||
              filters.living_arrangement ||
              filters.dependents ||
              filters.pronouns ||
              filters.occupation_status) && (
              <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-blue-100 uppercase tracking-wide">
                {
                  [
                    filters.survey_id,
                    filters.status,
                    filters.gender,
                    filters.primary_language,
                    filters.highest_education_level,
                    filters.marital_status,
                    filters.living_arrangement,
                    filters.dependents,
                    filters.pronouns,
                    filters.occupation_status,
                    ...filters.group_ids,
                  ].filter(Boolean).length
                }{" "}
                filters active
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
          {/* ── Survey Combobox ── */}
          <div className="relative z-20" ref={surveyDropdownRef}>
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
                    const published = availableSurveys.filter(
                      (s) =>
                        s.status !== "DELETED" &&
                        (s.title || "").toLowerCase().includes(q),
                    );
                    const deleted = availableSurveys.filter(
                      (s) =>
                        s.status === "DELETED" &&
                        (s.title || "").toLowerCase().includes(q),
                    );
                    const renderItem = (s) => (
                      <div
                        key={s.form_id || s.id}
                        className={`px-4 py-2.5 text-sm font-medium cursor-pointer border-b border-slate-50 last:border-0 truncate ${
                          s.status === "DELETED"
                            ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            survey_id: s.form_id || s.id,
                          }));
                          setSurveySearch("");
                          setIsSurveyOpen(false);
                        }}
                      >
                        {s.title || s.name}
                        {s.status === "DELETED" && " (Deleted)"}
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
                          <div className="px-4 py-3 text-sm text-slate-400">
                            No surveys found
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ── Groups Combobox ── */}
          <div className="relative z-10" ref={groupDropdownRef}>
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
                  // Find the group in our fetched list, fallback to allGroups
                  const g =
                    availableGroups.find((x) => (x.group_id || x.id) === gid) ||
                    allGroups.find((x) => (x.group_id || x.id) === gid);
                  return (
                    <span
                      key={gid}
                      className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-[11px] font-bold border border-blue-100 shadow-sm"
                    >
                      {/* Render the actual mapped name! */}
                      {g?.name || `Group ${gid.substring(0, 8)}`}
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
                {/* 🟢 MIN AGE INPUT */}
                <input
                  type="number"
                  min="18"
                  max="120"
                  placeholder="Min"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm text-center"
                  value={filters.age_min}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, age_min: e.target.value }))
                  }
                  onBlur={() => handleAgeBlur("min")}
                  onKeyDown={(e) => e.key === "Enter" && handleAgeBlur("min")}
                />

                <span className="text-slate-300 font-bold">-</span>

                {/* 🟢 MAX AGE INPUT */}
                <input
                  type="number"
                  min="18"
                  max="120"
                  placeholder="Max"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm text-center"
                  value={filters.age_max}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, age_max: e.target.value }))
                  }
                  onBlur={() => handleAgeBlur("max")}
                  onKeyDown={(e) => e.key === "Enter" && handleAgeBlur("max")}
                />
              </div>
            </div>
          </div>

          {/* ── NEW: Expandable More Filters Section ── */}
          {showMoreFilters && (
            <div className="space-y-4 pt-4 border-t border-slate-100 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Education Level */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Education level
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.highest_education_level}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        highest_education_level: e.target.value,
                      }))
                    }
                  >
                    <option value="">All levels</option>
                    <option value="High School">High School</option>
                    <option value="Bachelors">Bachelors</option>
                    <option value="Masters">Masters</option>
                    <option value="PhD">PhD</option>
                  </select>
                </div>
                {/* Marital status */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Marital status
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.marital_status}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        marital_status: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
                {/* Living arrangement */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Living arrangement
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.living_arrangement}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        living_arrangement: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="Alone">Alone</option>
                    <option value="With Partner">With Partner</option>
                    <option value="With Family">With Family</option>
                    <option value="With Roommates">With Roommates</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dependents */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Dependents
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.dependents}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dependents: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                {/* Pronouns */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Pronouns
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.pronouns}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        pronouns: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="He/Him">He/Him</option>
                    <option value="She/Her">She/Her</option>
                    <option value="They/Them">They/Them</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {/* Occupation */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Occupation
                  </label>
                  <select
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                    value={filters.occupation_status}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        occupation_status: e.target.value,
                      }))
                    }
                  >
                    <option value="">All</option>
                    <option value="Don't work">Don't work</option>
                    <option value="Less than 10 hrs/week">
                      Less than 10 hrs/week
                    </option>
                    <option value="Full-time">Full-time</option>
                    <option value="Student">Student</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors mt-2"
          >
            {showMoreFilters ? (
              <>
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
                    strokeWidth={2.5}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Less filters
              </>
            ) : (
              <>
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
                    strokeWidth={2.5}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                More filters
              </>
            )}
          </button>

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
            <div
              className={`overflow-x-auto relative transition-opacity duration-200 ${filtering ? "opacity-50 pointer-events-none" : ""}`}
            >
              {filtering && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="text-sm text-slate-500 font-medium bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                    Updating...
                  </span>
                </div>
              )}
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {/* 1. Add the static Row Number header */}
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-12">
                      #
                    </th>

                    {queryData.columns
                      .filter((col) => !hiddenColumns.includes(col.id))
                      .map((col) => (
                        <th
                          key={col.id}
                          className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors select-none"
                          onClick={() => handleSort(col.id)}
                        >
                          {/* 2. Make it clickable and show sort arrows */}
                          <div className="flex items-center gap-1.5">
                            {col.text || col.id}
                            <span className="text-slate-300">
                              {sortConfig.key === col.id
                                ? sortConfig.direction === "asc"
                                  ? "↑"
                                  : "↓"
                                : "↕"}
                            </span>
                          </div>
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* 1. We map over sortedData instead of queryData.data! */}
                  {sortedData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      {/* 2. Add the Row Number cell */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {rowIndex + 1}
                      </td>

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

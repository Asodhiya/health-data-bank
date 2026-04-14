import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from "recharts";
import { fmt } from "../../utils/dateFormatters";
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const CHART_TT = { borderRadius: "10px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)", fontSize: "12px" };

function Tip({ text, children }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-800 rotate-45" />
      </div>
    </div>
  );
}

function ScopeBadge({ scope }) {
  const s = { group: "bg-emerald-50 text-emerald-700 border-emerald-100", comparison: "bg-indigo-50 text-indigo-700 border-indigo-100", trends: "bg-blue-50 text-blue-700 border-blue-100" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${s[scope] || s.group}`}>{scope}</span>;
}

// ─── Shared: Numerical / Graphical view toggle ──────────────────────────────────
// Used at the top of each report view (Group, Comparison, Trends) to flip between
// a numbers-first layout (tables, stat cards) and a chart-first layout.
function ViewToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">View</span>
      <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
        <button
          onClick={() => onChange("numerical")}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${value === "numerical" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Numerical
        </button>
        <button
          onClick={() => onChange("graphical")}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${value === "graphical" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Graphical
        </button>
      </div>
    </div>
  );
}

// ─── Shared: MetricPicker (driven by real elements) ─────────────────────────────

// ─── Shared: MetricPicker (Reports v2 — grouped by form, with metadata) ────────
//
// Replaces the old hardcoded inferCategory hack. Each metric is grouped by the
// FIRST form_name that surfaces it (or "Other / Unmapped" if none). Each row
// also shows the datatype badge and the data point count so caretakers know
// what they're picking and how much data exists for it. The description (if
// any) shows on hover.
function MetricPicker({ elements, selected, onChange, label = "Select Metrics", emptyMessage = "No metrics available." }) {
  const [expanded, setExpanded] = useState(false);

  // Group by primary form. Multi-form elements appear under their first form
  // alphabetically — keeps the grouping deterministic without duplicating rows.
  const groups = useMemo(() => {
    const out = {};
    elements.forEach(e => {
      const forms = Array.isArray(e.form_names) && e.form_names.length > 0
        ? [...e.form_names].sort()
        : [];
      const key = forms[0] || "Other / Unmapped";
      if (!out[key]) out[key] = [];
      out[key].push(e);
    });
    // Sort each group by label for stable display
    Object.values(out).forEach(arr => arr.sort((a, b) => (a.label || "").localeCompare(b.label || "")));
    return out;
  }, [elements]);

  const toggleMetric = (id) => onChange(selected.includes(id) ? selected.filter(k => k !== id) : [...selected, id]);
  const toggleGroup = (groupKey) => {
    const ids = groups[groupKey].map(e => e.element_id);
    const allSelected = ids.every(id => selected.includes(id));
    if (allSelected) onChange(selected.filter(id => !ids.includes(id)));
    else onChange([...new Set([...selected, ...ids])]);
  };

  // Datatype → short badge label. Falls through to raw datatype if unknown.
  const datatypeBadge = (dt) => {
    if (!dt) return null;
    const lower = String(dt).toLowerCase();
    if (lower.includes("int") || lower.includes("number") || lower.includes("float") || lower.includes("decimal")) return { text: "number", className: "bg-blue-50 text-blue-600 border-blue-100" };
    if (lower.includes("bool")) return { text: "yes/no", className: "bg-violet-50 text-violet-600 border-violet-100" };
    if (lower.includes("scale") || lower.includes("rating")) return { text: "scale", className: "bg-amber-50 text-amber-600 border-amber-100" };
    if (lower.includes("date") || lower.includes("time")) return { text: "date", className: "bg-emerald-50 text-emerald-600 border-emerald-100" };
    if (lower.includes("text") || lower.includes("string")) return { text: "text", className: "bg-slate-50 text-slate-500 border-slate-100" };
    return { text: lower, className: "bg-slate-50 text-slate-500 border-slate-100" };
  };

  if (elements.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <p className="text-xs text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-2">
          {elements.length > 1 && (
            <button onClick={() => onChange(selected.length === elements.length ? [] : elements.map(e => e.element_id))}
              className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 transition-colors">
              {selected.length === elements.length ? "Deselect all" : "Select all"}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            {expanded ? "Collapse" : `${selected.length} selected — Edit`}
          </button>
        </div>
      </div>
      {!expanded ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No metrics selected</span>
          ) : selected.map(id => {
            const e = elements.find(x => x.element_id === id);
            return e ? (
              <span key={id} className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                {e.label}
                <button onClick={() => toggleMetric(id)} className="text-blue-400 hover:text-blue-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ) : null;
          })}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3 max-h-72 overflow-y-auto">
          {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([groupKey, groupElements]) => {
            const allSelected = groupElements.every(e => selected.includes(e.element_id));
            const someSelected = groupElements.some(e => selected.includes(e.element_id));
            return (
              <div key={groupKey}>
                <button onClick={() => toggleGroup(groupKey)} className="flex items-center gap-2 mb-1.5 group w-full text-left">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${allSelected ? "bg-blue-600 border-blue-600" : someSelected ? "bg-blue-200 border-blue-400" : "border-slate-300 group-hover:border-slate-400"}`}>
                    {(allSelected || someSelected) && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"} /></svg>}
                  </div>
                  <span className="text-xs font-bold text-slate-600 truncate">{groupKey}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{groupElements.length} metric{groupElements.length === 1 ? "" : "s"}</span>
                </button>
                <div className="grid grid-cols-1 gap-1 ml-6">
                  {groupElements.map(e => {
                    const badge = datatypeBadge(e.datatype);
                    const dpCount = Number(e.data_point_count || 0);
                    const isDeployed = e.is_currently_deployed !== false; // group elements don't have this field; treat as deployed
                    return (
                      <label key={e.element_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors group/row" title={e.description || ""}>
                        <input type="checkbox" checked={selected.includes(e.element_id)} onChange={() => toggleMetric(e.element_id)} className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0" />
                        <span className="text-xs text-slate-700 truncate flex-1">{e.label}</span>
                        {badge && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.className} shrink-0`}>{badge.text}</span>
                        )}
                        {e.unit && <span className="text-[10px] text-slate-400 shrink-0">{e.unit}</span>}
                        <span className={`text-[10px] font-semibold shrink-0 ${dpCount > 0 ? "text-slate-500" : "text-slate-300"}`} title={dpCount === 0 ? "No data points yet" : `${dpCount} data points`}>
                          {dpCount}
                        </span>
                        {!isDeployed && (
                          <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded shrink-0" title="No longer collected via current forms — historical data only">historical</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <button onClick={() => onChange(elements.map(e => e.element_id))} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Select All</button>
            <span className="text-xs text-slate-300">·</span>
            <button onClick={() => onChange(elements.filter(e => Number(e.data_point_count || 0) > 0).map(e => e.element_id))} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Select With Data</button>
            <span className="text-xs text-slate-300">·</span>
            <button onClick={() => onChange([])} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear All</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateRangeRow({ from, to, onFromChange, onToChange }) {
  const presets = [
    { l: "7d", from: () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; } },
    { l: "30d", from: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; } },
    { l: "90d", from: () => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; } },
    { l: "1y", from: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; } },
    { l: "All", from: () => "" },
  ];
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
      <div className="flex items-center gap-2 mb-2">
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
        <span className="text-xs text-slate-300">to</span>
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
      </div>
      <div className="flex gap-1">
        {presets.map(p => (
          <button key={p.l} type="button" onClick={() => { onFromChange(p.from()); onToChange(new Date().toISOString().split("T")[0]); }}
            className="px-2 py-1 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">{p.l}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Group Report ──────────────────────────────────────────────────────────

function GroupReportTab({ groups, selectedGroupId, elements }) {
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [chartMetric, setChartMetric] = useState(null);
  const [chartType, setChartType] = useState("bar");
  const [viewMode, setViewMode] = useState("numerical"); // "numerical" | "graphical"
  const [error, setError] = useState(null);

  useEffect(() => {
    if (elements.length === 0) {
      setMetrics([]);
    } else {
      setMetrics(elements.map(e => e.element_id));
    }
  }, [elements]);

  const groupName = selectedGroupId === "all" ? "All Groups" : groups.find(g => g.id === selectedGroupId)?.name || "Group";
  const requiresSpecificGroup = selectedGroupId === "all";

  async function handleGenerate() {
    if (requiresSpecificGroup) {
      setError("Please select a specific group from the dropdown above.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const payload = {
        element_ids: metrics,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        participant_status: statusFilter,
        gender: genderFilter || null,
        age_min: ageMin !== "" ? parseInt(ageMin, 10) : null,
        age_max: ageMax !== "" ? parseInt(ageMax, 10) : null,
      };
      const data = await api.caretakerGenerateGroupReport(selectedGroupId, payload);
      setReport(data.payload || data);
      const elems = data.payload?.elements || data.elements || [];
      if (elems.length > 0) setChartMetric(elems[0].element_id);
    } catch (err) {
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { setReport(null); }, [selectedGroupId]);

  const hasFilters = genderFilter || ageMin !== "" || ageMax !== "" || statusFilter !== "all";

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Generate Group Report</h2>
              <p className="text-xs text-slate-400 mt-0.5">Aggregate health data across all participants in <span className="font-semibold text-slate-500">{groupName}</span></p>
            </div>
          </div>

          {requiresSpecificGroup ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-amber-700">Select a specific group to continue</p>
              <p className="text-xs text-amber-600 mt-1">Pick a group from the dropdown above.</p>
            </div>
          ) : elements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No health data elements found for this group.</p>
              <p className="text-xs text-slate-300 mt-1">Participants need to submit surveys with mapped data elements first.</p>
            </div>
          ) : (
            <>
              <MetricPicker elements={elements} selected={metrics} onChange={setMetrics} emptyMessage="No metrics available for this group." />
              <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

              {/* ── Participant Filters ── */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Participant Filters</p>
                  {hasFilters && (
                    <button onClick={() => { setStatusFilter("all"); setGenderFilter(""); setAgeMin(""); setAgeMax(""); }}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">Clear all</button>
                  )}
                </div>

                {/* Activity status */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Activity Status</label>
                  <div className="flex gap-1.5">
                    {[{ v: "all", l: "All" }, { v: "active", l: "Active" }, { v: "inactive", l: "Inactive" }].map(s => (
                      <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s.v ? "bg-blue-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"}`}>{s.l}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Gender */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Gender</label>
                    <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
                      <option value="">All Genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Age Range */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Age Range</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} placeholder="Min"
                        min="0" max="150"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-300" />
                      <span className="text-xs text-slate-300">to</span>
                      <input type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} placeholder="Max"
                        min="0" max="150"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}
              <button onClick={handleGenerate} disabled={metrics.length === 0 || generating}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {generating ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Generate Report</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const elems = report.elements || [];
  const totalParticipants = elems.length > 0 ? Math.max(...elems.map(e => e.participant_count || 0)) : 0;
  const totalDataPoints = elems.reduce((s, e) => s + (e.count || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setReport(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Configuration
        </button>
        {elems.length > 0 && <ViewToggle value={viewMode} onChange={setViewMode} />}
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">Group Report — {groupName}</span>
        <span>·</span><span>{elems.length} metrics</span>
        <span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
        <span>·</span><span className="capitalize">{statusFilter} participants</span>
        {genderFilter && <><span>·</span><span>{genderFilter}</span></>}
        {(ageMin !== "" || ageMax !== "") && <><span>·</span><span>Age {ageMin || "0"}–{ageMax || "∞"}</span></>}
      </div>

      {elems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No data found for the selected metrics and date range.</p>
          <button onClick={() => setReport(null)} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Adjust configuration</button>
        </div>
      ) : (
        <>
          {/* ── Overview Summary Cards ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-blue-600">{elems.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Metrics Tracked</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-emerald-600">{totalParticipants}</p>
              <p className="text-xs text-slate-400 mt-0.5">Participants</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold text-indigo-600">{totalDataPoints}</p>
              <p className="text-xs text-slate-400 mt-0.5">Data Points</p>
            </div>
          </div>

          {/* ── Chart with Bar/Line toggle (Graphical view) ── */}
          {viewMode === "graphical" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average vs Median Comparison</p>
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setChartType("bar")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "bar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Bar
                  </button>
                  <button onClick={() => setChartType("line")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "line" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>Line
                  </button>
                </div>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={elems} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} formatter={(v, name, props) => [`${v} ${props.payload.unit || ""}`, name]} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="avg" name="Average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="median" name="Median" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={elems} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} formatter={(v, name, props) => [`${v} ${props.payload.unit || ""}`, name]} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line type="monotone" dataKey="avg" name="Average" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5, fill: "#3b82f6" }} />
                    <Line type="monotone" dataKey="median" name="Median" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981" }} />
                    <Line type="monotone" dataKey="min" name="Min" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={{ r: 3, fill: "#94a3b8" }} />
                    <Line type="monotone" dataKey="max" name="Max" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={{ r: 3, fill: "#f59e0b" }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {/* ── Full Statistics Table (Numerical view) ── */}
          {viewMode === "numerical" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Statistical Summary</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Metric</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Avg</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Median</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Std Dev</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Min</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Max</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Points</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Participants</th>
                </tr></thead>
                <tbody>
                  {elems.map(e => (
                    <tr key={e.element_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{e.label} <span className="text-slate-400 font-normal">({e.unit})</span></td>
                      <td className="py-2.5 px-4 text-center font-bold text-blue-600">{e.avg ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{e.median ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{e.stddev ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{e.min ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{e.max ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center text-slate-400">{e.count}</td>
                      <td className="py-2.5 px-4 text-center text-slate-400">{e.participant_count || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Comparison Report (with MetricPicker) ─────────────────────────────────

function ComparisonTab({ participants, groups, selectedGroupId, initialParticipantId }) {
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const appliedInitialRef = useRef(false);
  const [compareWith, setCompareWith] = useState("group");
  const [compareParticipantId, setCompareParticipantId] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("numerical"); // "numerical" | "graphical"
  const [chartType, setChartType] = useState("bar"); // "bar" | "line"
  // Reports v2: participant-aware metric pool. Replaces the previous
  // group-level elements prop, which showed metrics that may not exist
  // for the chosen participant.
  const [participantElements, setParticipantElements] = useState([]);
  const [elementsLoading, setElementsLoading] = useState(false);

  // Reports v2: derive the effective comparison group from the SELECTED
  // PARTICIPANT (not from groups[0]). This fixes the bug where comparing
  // a participant from group B against "the group" silently used group A.
  const subjectParticipant = participants.find(p => p.participant_id === selectedParticipant);
  const effectiveGroupId = selectedGroupId !== "all"
    ? selectedGroupId
    : subjectParticipant?.group_id || null;
  const effectiveGroupName = effectiveGroupId
    ? groups.find(g => g.id === effectiveGroupId)?.name || "Their Group"
    : "Their Group";

  // One-shot URL pre-select (carried over from before)
  useEffect(() => {
    if (appliedInitialRef.current) return;
    if (!initialParticipantId) return;
    if (participants.some(p => p.participant_id === initialParticipantId)) {
      setSelectedParticipant(initialParticipantId);
      appliedInitialRef.current = true;
    }
  }, [initialParticipantId, participants]);

  // Reports v2: load participant-relevant elements when selection changes.
  useEffect(() => {
    if (!selectedParticipant) {
      setParticipantElements([]);
      setMetrics([]);
      return;
    }
    setElementsLoading(true);
    api.caretakerGetParticipantDataElements(selectedParticipant)
      .then(data => {
        const items = Array.isArray(data) ? data.map(e => ({
          element_id: e.element_id,
          code: e.code,
          label: e.label || e.code || "Unknown",
          unit: e.unit || "",
          datatype: e.datatype || null,
          description: e.description || null,
          form_names: Array.isArray(e.form_names) ? e.form_names : [],
          data_point_count: Number(e.data_point_count || 0),
          is_currently_deployed: e.is_currently_deployed !== false,
        })) : [];
        setParticipantElements(items);
        // Auto-select the first 4 elements that actually have data points,
        // falling back to the first 4 of any kind if none have data.
        const withData = items.filter(e => e.data_point_count > 0).slice(0, 4);
        const fallback = items.slice(0, 4);
        setMetrics((withData.length > 0 ? withData : fallback).map(e => e.element_id));
      })
      .catch(() => {
        setParticipantElements([]);
        setMetrics([]);
      })
      .finally(() => setElementsLoading(false));
  }, [selectedParticipant]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const queryParams = { compare_with: compareWith };
      if (compareWith === "participant" && compareParticipantId) {
        queryParams.compare_participant_id = compareParticipantId;
      }
      if (compareWith === "group") {
        // Reports v2: use the participant's own group when "All Groups" is
        // selected, instead of silently falling back to groups[0].
        if (!effectiveGroupId) {
          setError("Cannot determine which group to compare against. Pick a specific group from the dropdown above, or choose a different comparison.");
          setGenerating(false);
          return;
        }
        queryParams.group_id = effectiveGroupId;
      }
      const payload = {
        date_from: dateFrom || null,
        date_to: dateTo || null,
        element_ids: metrics.length > 0 ? metrics : [],
      };
      const data = await api.caretakerGenerateComparisonReport(selectedParticipant, queryParams, payload);
      setReport(data.payload || data);
    } catch (err) {
      console.error("Comparison report failed:", err);
      setError(err.message || "Failed to generate comparison report.");
    } finally {
      setGenerating(false);
    }
  }

  if (!report) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Comparison Report</h2>
            <p className="text-xs text-slate-400 mt-0.5">Compare a participant against the group average or another participant</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Participant</p>
          <select value={selectedParticipant} onChange={e => setSelectedParticipant(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
            <option value="">Select a participant…</option>
            {participants.map(p => <option key={p.participant_id} value={p.participant_id}>{p.name}</option>)}
          </select>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Compare Against</p>
          <div className="flex gap-1.5 flex-wrap">
            {[{ v: "group", l: `Group Avg (${effectiveGroupName})` }, { v: "participant", l: "Another Participant" }, { v: "all", l: "All Participants" }].map(opt => (
              <button key={opt.v} onClick={() => setCompareWith(opt.v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all border min-w-0 ${compareWith === opt.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {compareWith === "participant" && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Compare Participant</p>
            <select value={compareParticipantId} onChange={e => setCompareParticipantId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
              <option value="">Select…</option>
              {participants.filter(p => p.participant_id !== selectedParticipant).map(p => (
                <option key={p.participant_id} value={p.participant_id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reports v2: metric picker is now participant-aware. Empty state
            depends on whether a participant is selected at all. */}
        {!selectedParticipant ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-xs text-slate-400">Select a participant above to see the metrics tracked for them.</p>
          </div>
        ) : elementsLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-xs text-slate-400 animate-pulse">Loading metrics for this participant…</p>
          </div>
        ) : (
          <MetricPicker
            elements={participantElements}
            selected={metrics}
            onChange={setMetrics}
            label="Metrics to Compare"
            emptyMessage="This participant has no tracked metrics yet."
          />
        )}

        <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}

        <button onClick={handleGenerate}
          disabled={!selectedParticipant || metrics.length === 0 || generating || (compareWith === "participant" && !compareParticipantId)}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {generating ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>Generate Comparison</>
          )}
        </button>
      </div>
    );
  }

  const elems = report.elements || [];
  const subjectName = participants.find(p => p.participant_id === selectedParticipant)?.name || "Participant";
  const compLabel = compareWith === "group" ? effectiveGroupName : compareWith === "all" ? "All Participants" : participants.find(p => p.participant_id === compareParticipantId)?.name || "Comparison";
  const barData = elems.map(e => ({ label: e.label, unit: e.unit, [subjectName]: e.subject?.avg, [compLabel]: e.comparison?.avg }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setReport(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Configuration
        </button>
        {elems.length > 0 && <ViewToggle value={viewMode} onChange={setViewMode} />}
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">{subjectName} vs {compLabel}</span>
        <span>·</span><span>{elems.length} elements</span>
        <span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
      </div>

      {elems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No data found for this comparison.</p>
          <button onClick={() => setReport(null)} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Adjust configuration</button>
        </div>
      ) : (
        <>
          {viewMode === "graphical" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Comparison</p>
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setChartType("bar")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "bar" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Bar
                </button>
                <button onClick={() => setChartType("line")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "line" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>Line
                </button>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={barData} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey={subjectName} fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={compLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={barData} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey={subjectName} stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: "#6366f1" }} />
                    <Line type="monotone" dataKey={compLabel} stroke="#94a3b8" strokeWidth={2.5} dot={{ r: 5, fill: "#94a3b8" }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
          )}
          {viewMode === "numerical" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detailed Comparison</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Element</th>
                  <th className="text-center text-xs font-bold text-indigo-500 uppercase tracking-wider py-2.5 px-4">{subjectName.split(" ")[0]} Avg</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">{compLabel.split(" ")[0]} Avg</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Diff</th>
                </tr></thead>
                <tbody>
                  {elems.map(e => {
                    const diff = e.subject?.avg != null && e.comparison?.avg != null ? e.subject.avg - e.comparison.avg : null;
                    return (
                      <tr key={e.element_id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">{e.label} <span className="text-slate-400 font-normal">({e.unit})</span></td>
                        <td className="py-2.5 px-4 text-center font-bold text-indigo-600">{e.subject?.avg ?? "—"}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">{e.comparison?.avg ?? "—"}</td>
                        <td className={`py-2.5 px-4 text-center font-bold ${diff != null ? (diff < 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-slate-400") : "text-slate-400"}`}>
                          {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Health Trends (with metric visibility toggles in results) ─────────────

function TrendsTab({ participants }) {
  const [selectedId, setSelectedId] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState(null);
  const [visibleMetrics, setVisibleMetrics] = useState([]);
  const [viewMode, setViewMode] = useState("graphical"); // "numerical" | "graphical"
  const [chartType, setChartType] = useState("line"); // "line" | "bar" — global, flips all metric charts
  // Reports v2: participant-aware metric pool, replaces the previous
  // group-level elements prop.
  const [participantElements, setParticipantElements] = useState([]);
  const [elementsLoading, setElementsLoading] = useState(false);

  const toggleVisible = (id) => {
    setVisibleMetrics(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  // Reports v2: load participant-relevant data elements when selection changes.
  useEffect(() => {
    if (!selectedId) {
      setParticipantElements([]);
      setMetrics([]);
      return;
    }
    setElementsLoading(true);
    api.caretakerGetParticipantDataElements(selectedId)
      .then(data => {
        const items = Array.isArray(data) ? data.map(e => ({
          element_id: e.element_id,
          code: e.code,
          label: e.label || e.code || "Unknown",
          unit: e.unit || "",
          datatype: e.datatype || null,
          description: e.description || null,
          form_names: Array.isArray(e.form_names) ? e.form_names : [],
          data_point_count: Number(e.data_point_count || 0),
          is_currently_deployed: e.is_currently_deployed !== false,
        })) : [];
        setParticipantElements(items);
        // For Trends, prefer metrics that have data — picking metrics with
        // 0 data points just produces an empty chart.
        const withData = items.filter(e => e.data_point_count > 0).slice(0, 3);
        setMetrics(withData.map(e => e.element_id));
      })
      .catch(() => {
        setParticipantElements([]);
        setMetrics([]);
      })
      .finally(() => setElementsLoading(false));
  }, [selectedId]);

  async function handleGenerate() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (metrics.length > 0) params.element_ids = metrics;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await api.caretakerGetHealthTrends(selectedId, params);
      const filtered = Array.isArray(data) ? data.filter(t => t.points && t.points.length > 0) : [];
      setTrends(filtered);
      setVisibleMetrics(filtered.map(t => t.element_id));
    } catch (err) {
      console.error("Health trends fetch failed:", err);
      setError(err.message || "Failed to load health trends.");
      setTrends([]);
    } finally {
      setLoading(false);
    }
  }

  const pName = participants.find(p => p.participant_id === selectedId)?.name || "Participant";

  if (!trends) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Health Trends</h2>
            <p className="text-xs text-slate-400 mt-0.5">View a participant's health data over time</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Participant</p>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
            <option value="">Choose a participant…</option>
            {participants.map(p => <option key={p.participant_id} value={p.participant_id}>{p.name}</option>)}
          </select>
        </div>

        {/* Reports v2: metric picker is participant-aware. */}
        {!selectedId ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-xs text-slate-400">Select a participant above to see the metrics tracked for them.</p>
          </div>
        ) : elementsLoading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-xs text-slate-400 animate-pulse">Loading metrics for this participant…</p>
          </div>
        ) : (
          <MetricPicker
            elements={participantElements}
            selected={metrics}
            onChange={setMetrics}
            label="Metrics to Track"
            emptyMessage="This participant has no tracked metrics yet."
          />
        )}

        <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}

        <button onClick={handleGenerate} disabled={!selectedId || loading}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading...</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>Generate Trends</>
          )}
        </button>
      </div>
    );
  }

  // ── Results ──
  const displayedTrends = trends.filter(t => visibleMetrics.includes(t.element_id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => { setTrends(null); setVisibleMetrics([]); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Configuration
        </button>
        {trends.length > 0 && <ViewToggle value={viewMode} onChange={setViewMode} />}
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">{pName}</span>
        <span>·</span><span>{trends.length} metrics with data</span>
        <span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
      </div>

      {/* Metric visibility toggles + (graphical only) chart-type toggle */}
      {trends.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show / Hide Metrics</p>
            {viewMode === "graphical" && (
              <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setChartType("line")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "line" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>Line
                </button>
                <button onClick={() => setChartType("bar")} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${chartType === "bar" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Bar
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {trends.map((t, i) => {
              const isVisible = visibleMetrics.includes(t.element_id);
              return (
                <button key={t.element_id} onClick={() => toggleVisible(t.element_id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    isVisible ? "text-white border-transparent" : "bg-white text-slate-400 border-slate-200 line-through"
                  }`}
                  style={isVisible ? { backgroundColor: COLORS[i % COLORS.length] } : undefined}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isVisible ? "bg-white/40" : "bg-slate-300"}`} />
                  {t.label}
                  {t.unit && <span className={isVisible ? "text-white/60" : "text-slate-300"}>({t.unit})</span>}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {viewMode === "graphical"
              ? "Click a metric to show or hide its chart below"
              : "Click a metric to show or hide its summary below"}
          </p>
        </div>
      )}

      {trends.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No trend data found for this participant in the selected date range.</p>
          <button onClick={() => { setTrends(null); setVisibleMetrics([]); }} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Adjust configuration</button>
        </div>
      ) : displayedTrends.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">All metrics are hidden. Click a metric above to show it.</p>
        </div>
      ) : viewMode === "numerical" ? (
        /* ── Numerical view: per-metric summary cards ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayedTrends.map((t) => {
            const pts = (t.points || []).filter(p => p && p.value != null);
            const firstVal = pts.length > 0 ? pts[0].value : null;
            const lastVal = pts.length > 0 ? pts[pts.length - 1].value : null;
            const minVal = pts.length > 0 ? Math.min(...pts.map(p => p.value)) : null;
            const maxVal = pts.length > 0 ? Math.max(...pts.map(p => p.value)) : null;
            const delta = firstVal != null && lastVal != null ? lastVal - firstVal : null;
            const deltaPct = delta != null && firstVal !== 0 && firstVal != null
              ? ((delta / Math.abs(firstVal)) * 100)
              : null;
            const deltaColor = delta == null
              ? "text-slate-400 bg-slate-50"
              : delta < 0
                ? "text-emerald-600 bg-emerald-50"
                : delta > 0
                  ? "text-amber-600 bg-amber-50"
                  : "text-slate-500 bg-slate-50";
            return (
              <div key={t.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{t.label}</p>
                    <p className="text-[11px] text-slate-400">{pts.length} data point{pts.length !== 1 ? "s" : ""}{t.unit ? ` · ${t.unit}` : ""}</p>
                  </div>
                  {delta != null && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${deltaColor}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                      {deltaPct != null && <span className="opacity-60"> ({deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(0)}%)</span>}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-blue-600">{firstVal ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">First</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-indigo-600">{lastVal ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">Last</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-slate-500">{minVal ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">Min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-slate-500">{maxVal ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">Max</p>
                  </div>
                </div>
                {pts.length >= 2 && firstVal != null && lastVal != null && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    {fmt(pts[0].date)} → {fmt(pts[pts.length - 1].date)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Graphical view: per-metric charts (Line or Bar depending on chartType) ── */
        displayedTrends.map((t) => (
          <div key={t.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.label}{t.unit && <span className="text-slate-300 font-normal normal-case"> ({t.unit})</span>}</p>
              {t.points.length >= 2 && (() => {
                const change = t.points[t.points.length - 1].value - t.points[0].value;
                return (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${change < 0 ? "bg-emerald-50 text-emerald-700" : change > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {change > 0 ? "+" : ""}{change.toFixed(1)} overall
                  </span>
                );
              })()}
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart data={t.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={d => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} formatter={v => t.unit ? `${v} ${t.unit}` : `${v}`} labelFormatter={d => fmt(d)} />
                    <Line type="monotone" dataKey="value" name={t.label} stroke={COLORS[trends.indexOf(t) % COLORS.length]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                ) : (
                  <BarChart data={t.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickFormatter={d => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} formatter={v => t.unit ? `${v} ${t.unit}` : `${v}`} labelFormatter={d => fmt(d)} />
                    <Bar dataKey="value" name={t.label} fill={COLORS[trends.indexOf(t) % COLORS.length]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tab: History ───────────────────────────────────────────────────────────────

function HistoryTab({ selectedGroupId, groups }) {
  const [reports, setReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [viewing, setViewing] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    setHistoryLoading(true);
    api.caretakerListReports()
      .then(data => {
        setReports((data || []).map(r => ({
          id: r.report_id,
          scope: r.scope || "unknown",
          groupId: r.group_id || null,
          groupName: r.group_name || null,
          participantId: r.participant_id || null,
          createdAt: r.created_at,
          dateFrom: r.date_from || null,
          dateTo: r.date_to || null,
          participantStatus: r.participant_status || null,
          compareWith: r.compare_with || null,
          elementCount: r.element_count || 0,
          elementLabels: r.element_labels || [],
        })));
      })
      .catch(() => setReports([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { setViewing(null); }, [selectedGroupId]);

  useEffect(() => {
    setGroupFilter(selectedGroupId === "all" ? "all" : selectedGroupId);
  }, [selectedGroupId]);

  const reportGroups = useMemo(() => {
    const seen = new Map();
    reports.forEach(r => {
      if (r.groupId && r.groupName && !seen.has(r.groupId)) {
        seen.set(r.groupId, r.groupName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const hasFilters = search || scopeFilter !== "all" || groupFilter !== "all" || dateFromFilter || dateToFilter;

  function clearAllFilters() {
    setSearch("");
    setScopeFilter("all");
    setGroupFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
  }

  const filtered = useMemo(() => reports.filter(r => {
    // When a specific group is selected, only show reports that belong to it.
    // Reports with no groupId (orphaned or cross-group comparisons) are hidden.
    if (groupFilter !== "all" && (!r.groupId || r.groupId !== groupFilter)) return false;
    if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
    if (dateFromFilter) {
      const created = new Date(r.createdAt);
      if (created < new Date(dateFromFilter)) return false;
    }
    if (dateToFilter) {
      const created = new Date(r.createdAt);
      const endOfDay = new Date(dateToFilter);
      endOfDay.setDate(endOfDay.getDate() + 1);
      if (created >= endOfDay) return false;
    }
    if (search) {
      const needle = search.toLowerCase();
      const haystack = `${r.scope} ${r.groupName || ""} ${r.elementLabels.join(" ")} ${fmt(r.createdAt)} ${r.compareWith || ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }), [search, scopeFilter, groupFilter, dateFromFilter, dateToFilter, reports]);

  async function handleViewReport(r) {
    setDetailLoading(true);
    setDetailError(null);
    setViewing({ ...r, payload: null, params: null });
    try {
      const detail = await api.caretakerGetReport(r.id);
      setViewing({ ...r, payload: detail.payload || {}, params: detail.parameters || {} });
    } catch (err) {
      setDetailError(err.message || "Couldn't load this report. Please try again.");
      setViewing({ ...r, payload: {}, params: {} });
    } finally {
      setDetailLoading(false);
    }
  }

  if (historyLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
        <p className="text-sm text-slate-400 animate-pulse">Loading report history…</p>
      </div>
    );
  }

  // ── Detail view ──
  if (viewing) {
    const elems = viewing.payload?.elements || [];
    const isComparison = viewing.scope === "comparison";
    const config = viewing.params || {};

    return (
      <div className="space-y-5">
        <button onClick={() => { setViewing(null); setDetailError(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to History
        </button>

        {/* Report metadata header */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ScopeBadge scope={viewing.scope} />
          <span>·</span><span>Generated {fmt(viewing.createdAt)}</span>
          {viewing.groupName && <><span>·</span><span className="font-medium text-slate-600">{viewing.groupName}</span></>}
          {elems.length > 0 && <><span>·</span><span>{elems.length} metrics</span></>}
          {(config.date_from || viewing.dateFrom) && (config.date_to || viewing.dateTo) && (
            <><span>·</span><span>{config.date_from || viewing.dateFrom} → {config.date_to || viewing.dateTo}</span></>
          )}
          {config.participant_status && config.participant_status !== "all" && <><span>·</span><span className="capitalize">{config.participant_status} participants</span></>}
          {config.gender && <><span>·</span><span>{config.gender}</span></>}
          {(config.age_min != null || config.age_max != null) && <><span>·</span><span>Age {config.age_min ?? 0}–{config.age_max ?? "∞"}</span></>}
          {isComparison && config.compare_with && <><span>·</span><span>vs {config.compare_with}</span></>}
        </div>

        {detailLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-200 rounded-xl" />)}
            </div>
          </div>
        ) : detailError ? (
          <div className="bg-white rounded-2xl shadow-sm border border-rose-200 px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm font-semibold text-rose-700">Couldn't load this report</p>
            <p className="text-xs text-rose-500 mt-1.5 max-w-sm mx-auto">{detailError}</p>
            <button onClick={() => handleViewReport(viewing)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors">
              Retry
            </button>
          </div>
        ) : elems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
            <p className="text-sm text-slate-400">This report has no data.</p>
          </div>
        ) : (
          <>
            {/* Metric cards — enhanced for group reports, compact for comparison */}
            {!isComparison ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {elems.map(e => {
                  const range = (e.max != null && e.min != null) ? (e.max - e.min) : null;
                  return (
                    <div key={e.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
                      <p className="text-sm font-bold text-slate-700 mb-0.5">{e.label}</p>
                      <p className="text-[11px] text-slate-400 mb-2">{e.participant_count || "—"} participants · {e.count} data points</p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center"><p className="text-lg font-extrabold text-blue-600">{e.avg ?? "—"}</p><p className="text-[10px] text-slate-400">Avg</p></div>
                        <div className="text-center"><p className="text-lg font-extrabold text-emerald-600">{e.median ?? "—"}</p><p className="text-[10px] text-slate-400">Median</p></div>
                        <div className="text-center"><p className="text-lg font-extrabold text-slate-500">{e.min ?? "—"}</p><p className="text-[10px] text-slate-400">Min</p></div>
                        <div className="text-center"><p className="text-lg font-extrabold text-slate-500">{e.max ?? "—"}</p><p className="text-[10px] text-slate-400">Max</p></div>
                      </div>
                      {(e.stddev != null || range != null) && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
                          {e.stddev != null && <p className="text-[11px] text-slate-400">Std Dev: <span className="font-semibold text-slate-600">{e.stddev}</span></p>}
                          {range != null && <p className="text-[11px] text-slate-400">Range: <span className="font-semibold text-slate-600">{range.toFixed(1)}</span></p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {elems.map(e => (
                  <div key={e.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400 mb-0.5 truncate">{e.label}</p>
                    <p className="text-lg font-extrabold text-indigo-600">{e.subject?.avg ?? "—"}</p>
                    <p className="text-xs text-slate-400">vs <span className="font-semibold text-slate-500">{e.comparison?.avg ?? "—"}</span></p>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report Data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Element</th>
                    {isComparison ? (
                      <><th className="text-center text-xs font-bold text-indigo-500 uppercase tracking-wider py-2.5 px-4">Subject</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Comparison</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Diff</th></>
                    ) : (
                      <><th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Avg</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Median</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Min</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Max</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Std Dev</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Points</th></>
                    )}
                  </tr></thead>
                  <tbody>
                    {elems.map(e => {
                      const diff = isComparison && e.subject?.avg != null && e.comparison?.avg != null ? e.subject.avg - e.comparison.avg : null;
                      return (
                        <tr key={e.element_id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{e.label} {e.unit && <span className="text-slate-400 font-normal">({e.unit})</span>}</td>
                          {isComparison ? (
                            <><td className="py-2.5 px-4 text-center font-bold text-indigo-600">{e.subject?.avg ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.comparison?.avg ?? "—"}</td>
                            <td className={`py-2.5 px-4 text-center font-bold ${diff != null ? (diff < 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-slate-400") : "text-slate-400"}`}>
                              {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                            </td></>
                          ) : (
                            <><td className="py-2.5 px-4 text-center font-bold text-blue-600">{e.avg ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center font-bold text-emerald-600">{e.median ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.min ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.max ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.stddev ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-400">{e.count ?? "—"}</td></>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by type, group, or metric…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
        </div>

        {/* Filter row 1: type + group */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase self-center mr-1">Type:</span>
            {[{ v: "all", l: "All" }, { v: "group", l: "Group" }, { v: "comparison", l: "Comparison" }].map(s => (
              <button key={s.v} onClick={() => setScopeFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${scopeFilter === s.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.l}</button>
            ))}
          </div>
          {reportGroups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Group:</span>
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600">
                <option value="all">All Groups</option>
                {reportGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Filter row 2: date range */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Generated:</span>
          <input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600" />
          <span className="text-xs text-slate-300">to</span>
          <input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-600" />
          {(dateFromFilter || dateToFilter) && (
            <button onClick={() => { setDateFromFilter(""); setDateToFilter(""); }} className="text-[10px] font-semibold text-slate-400 hover:text-rose-500">✕</button>
          )}
        </div>

        {/* Clear all */}
        {hasFilters && (
          <div className="flex justify-end">
            <button onClick={clearAllFilters} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800">Clear all filters</button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 px-1">{filtered.length} report{filtered.length !== 1 ? "s" : ""}{reports.length !== filtered.length ? ` (${reports.length} total)` : ""}</p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">{reports.length === 0 ? "No reports generated yet. Use the Group or Comparison tabs to create one." : "No reports match your filters."}</p>
          {hasFilters && (
            <button onClick={clearAllFilters} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear filters</button>
          )}
        </div>
      ) : filtered.map(r => (
        <div key={r.id} onClick={() => handleViewReport(r)}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 hover:bg-slate-50 hover:border-slate-200 transition-all cursor-pointer group">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors capitalize">{r.scope} Report</p>
                <ScopeBadge scope={r.scope} />
                {r.compareWith && r.compareWith !== "group" && (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">vs {r.compareWith}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <p className="text-xs text-slate-400">{fmt(r.createdAt)}</p>
                {r.groupName && <><span className="text-xs text-slate-300">·</span><p className="text-xs text-slate-500 font-medium">{r.groupName}</p></>}
                {r.elementCount > 0 && <><span className="text-xs text-slate-300">·</span><p className="text-xs text-slate-400">{r.elementCount} metric{r.elementCount !== 1 ? "s" : ""}</p></>}
                {r.dateFrom && r.dateTo && <><span className="text-xs text-slate-300">·</span><p className="text-xs text-slate-400">{r.dateFrom} → {r.dateTo}</p></>}
              </div>
              {r.elementLabels.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {r.elementLabels.map((label, i) => (
                    <span key={i} className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">{label}</span>
                  ))}
                  {r.elementCount > r.elementLabels.length && (
                    <span className="text-[10px] text-slate-400">+{r.elementCount - r.elementLabels.length} more</span>
                  )}
                </div>
              )}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Group Selector ─────────────────────────────────────────────────────────────

function ReportsGroupSelector({ groups, selectedGroupId, onChange, totalParticipants }) {
  const [open, setOpen] = useState(false);
  const selected = selectedGroupId === "all" ? null : groups.find(g => g.id === selectedGroupId);
  const label = selected ? selected.name : "All Groups";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm w-full sm:w-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <span className="truncate">{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ml-auto sm:ml-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-full mt-1.5 z-20 w-full sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <button onClick={() => { onChange("all"); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedGroupId === "all" ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedGroupId === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <div className="flex-1"><p className={`text-sm font-semibold ${selectedGroupId === "all" ? "text-blue-700" : "text-slate-700"}`}>All Groups</p><p className="text-xs text-slate-400">{totalParticipants} participants</p></div>
            {selectedGroupId === "all" && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          </button>
          <div className="border-t border-slate-100" />
          {groups.map(g => {
            const isSelected = selectedGroupId === g.id;
            return (
              <button key={g.id} onClick={() => { onChange(g.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="flex-1"><p className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-slate-700"}`}>{g.name}</p></div>
                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: "group", label: "Group Report", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "comparison", label: "Comparison", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { key: "trends", label: "Health Trends", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { key: "history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
];

export default function ReportsPage() {
  const { user } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Capture URL params exactly once on first render.
  // We don't want these to re-read after we clear the URL below.
  const [initialTab] = useState(() => {
    const t = searchParams.get("tab");
    return ["group", "comparison", "trends", "history"].includes(t) ? t : null;
  });
  const [initialParticipantId] = useState(() => searchParams.get("participant"));

  const [activeTab, setActiveTab] = useState(initialTab || "group");
  const [participants, setParticipants] = useState([]);
  const [participantsLoadedFor, setParticipantsLoadedFor] = useState("none");
  const [participantTotal, setParticipantTotal] = useState(0);
  const [groups, setGroups] = useState([]);
  const [elements, setElements] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Reports v2: only fetch group summary + groups at page level. Element
      // pools are now per-tab and per-context (the GroupReport tab loads
      // elements for the selected group; ComparisonTab and TrendsTab load
      // elements for the selected participant). Fixes the previous bug where
      // the page would load gData[0]'s elements and use them for everything,
      // including reports about other groups.
      const [pSummary, gData] = await Promise.all([
        api.caretakerGetParticipantsSummary().catch(() => ({ total: 0 })),
        api.caretakerGetGroups().catch(() => []),
      ]);
      setParticipantTotal(Number(pSummary?.total || 0));
      setParticipants([]);
      setParticipantsLoadedFor("none");
      const transformedGroups = Array.isArray(gData)
        ? gData.map(g => ({ id: g.group_id, name: g.name }))
        : [];
      setGroups(transformedGroups);
      setElements([]);
    } catch (err) {
      setLoadError(err.message || "Couldn't load reports data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reports v2: when a SPECIFIC group is selected, load that group's
  // elements (used by GroupReportTab). When "All Groups" is selected, clear
  // them — there is no meaningful "all groups elements pool" because the
  // group report endpoint only operates on one group at a time. The
  // GroupReportTab will show a "select a specific group" message in that case.
  useEffect(() => {
    if (groups.length === 0) return;
    if (selectedGroupId === "all") {
      setElements([]);
      return;
    }
    api.caretakerGetGroupElements(selectedGroupId)
      .then(data => {
        setElements(Array.isArray(data) ? data.map(e => ({
          element_id: e.element_id,
          code: e.code,
          label: e.label || e.code || "Unknown",
          unit: e.unit || "",
          datatype: e.datatype || null,
          description: e.description || null,
          form_names: Array.isArray(e.form_names) ? e.form_names : [],
          data_point_count: Number(e.data_point_count || 0),
        })) : []);
      })
      .catch(() => setElements([]));
  }, [selectedGroupId, groups]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Clear URL params after applying them so refresh doesn't re-trigger.
  useEffect(() => {
    if (initialTab || initialParticipantId) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== "comparison" && activeTab !== "trends") return;
    const scope = selectedGroupId === "all" ? "all" : selectedGroupId;
    if (participantsLoadedFor === scope) return;
    api.caretakerListParticipants({
      limit: 100,
      offset: 0,
      ...(selectedGroupId !== "all" ? { group_id: selectedGroupId } : {}),
      sort_by: "name",
    })
      .then((data) => {
        // B8: response is { items, total_count }; we only need items here.
        const items = Array.isArray(data?.items) ? data.items : [];
        setParticipants(items);
        setParticipantsLoadedFor(scope);
      })
      .catch(() => {
        setParticipants([]);
        setParticipantsLoadedFor(scope);
      });
  }, [activeTab, selectedGroupId, participantsLoadedFor]);

  const filteredParticipants = selectedGroupId === "all"
    ? participants
    : participants.filter(p => p.group_id === selectedGroupId);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-32" />
          <div className="h-12 bg-slate-200 rounded-2xl" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto p-2 md:p-0">
        <div className="bg-white rounded-2xl shadow-sm border border-rose-200 px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-base font-bold text-rose-700">Couldn't load Reports</h2>
          <p className="text-xs text-rose-500 mt-1.5 max-w-md mx-auto">{loadError}</p>
          <button onClick={fetchData}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-400 mt-1">Generate and review health reports for your groups.</p>
      </div>

      {groups.length > 0 && (
        <ReportsGroupSelector groups={groups} selectedGroupId={selectedGroupId} onChange={setSelectedGroupId} totalParticipants={participantTotal} />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <Tip key={tab.key} text={tab.label}>
            <button onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          </Tip>
        ))}
      </div>

      {activeTab === "group" && <GroupReportTab groups={groups} selectedGroupId={selectedGroupId} elements={elements} />}
      {activeTab === "comparison" && <ComparisonTab participants={filteredParticipants} groups={groups} selectedGroupId={selectedGroupId} initialParticipantId={initialParticipantId} />}
      {activeTab === "trends" && <TrendsTab participants={filteredParticipants} />}
      {activeTab === "history" && <HistoryTab selectedGroupId={selectedGroupId} groups={groups} />}
    </div>
  );
}

// ─── Category inference helper ──────────────────────────────────────────────────

// Reports v2: inferCategory was deleted — replaced by real form-based grouping
// in MetricPicker. The hardcoded English-substring categories were both
// inaccurate and unrelated to actual data structure.

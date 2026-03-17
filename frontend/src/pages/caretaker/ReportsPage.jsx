import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../services/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const CARETAKER_GROUP = { id: "g1", name: "Morning Cohort A" };

const MOCK_PARTICIPANTS = [
  { id: "p1", name: "Sarah Chen", status: "active" },
  { id: "p2", name: "Marcus Webb", status: "active" },
  { id: "p3", name: "Lily Hartmann", status: "inactive" },
  { id: "p4", name: "Aiko Tanaka", status: "active" },
  { id: "p5", name: "Omar Diallo", status: "active" },
  { id: "p6", name: "Priya Sharma", status: "active" },
  { id: "p7", name: "James Kowalski", status: "active" },
  { id: "p8", name: "Fatima Al-Rashid", status: "inactive" },
];

const ALL_METRICS = [
  { key: "bpSystolic", label: "Systolic BP", unit: "mmHg", category: "Vitals" },
  { key: "bpDiastolic", label: "Diastolic BP", unit: "mmHg", category: "Vitals" },
  { key: "weight", label: "Weight", unit: "kg", category: "Vitals" },
  { key: "painLevel", label: "Pain Level", unit: "/10", category: "Vitals" },
  { key: "stressScore", label: "Stress Score (PSS)", unit: "/40", category: "Mental Health" },
  { key: "lonelinessScore", label: "Loneliness Score", unit: "/80", category: "Social Wellness" },
  { key: "sleepHours", label: "Sleep Duration", unit: "hrs", category: "Lifestyle" },
  { key: "waterIntake", label: "Water Intake", unit: "glasses", category: "Lifestyle" },
  { key: "exerciseMinutes", label: "Exercise", unit: "min/day", category: "Lifestyle" },
  { key: "surveyCompletion", label: "Survey Completion", unit: "%", category: "Engagement" },
  { key: "goalCompletion", label: "Goal Completion", unit: "%", category: "Engagement" },
];

const METRIC_CATEGORIES = [...new Set(ALL_METRICS.map(m => m.category))];

function generateGroupData(metrics) {
  const participants = MOCK_PARTICIPANTS;
  const data = {};
  metrics.forEach(mk => {
    const m = ALL_METRICS.find(x => x.key === mk);
    if (!m) return;
    const values = participants.map(() => {
      const ranges = { bpSystolic: [105, 150], bpDiastolic: [65, 95], weight: [50, 105], painLevel: [0, 8], stressScore: [5, 35], lonelinessScore: [20, 65], sleepHours: [4, 9], waterIntake: [2, 10], exerciseMinutes: [0, 60], surveyCompletion: [0, 100], goalCompletion: [0, 100] };
      const [lo, hi] = ranges[mk] || [0, 100];
      return Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;
    });
    data[mk] = { label: m.label, unit: m.unit, category: m.category, avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10, min: Math.min(...values), max: Math.max(...values), perParticipant: participants.map((p, i) => ({ name: p.name.split(" ")[0][0] + ". " + p.name.split(" ").slice(1).join(" "), value: values[i], status: p.status })) };
  });
  return data;
}

function generateTrends(months, metrics) {
  return months.map((month, i) => {
    const row = { month };
    metrics.forEach(mk => {
      const ranges = { bpSystolic: [125, 150], bpDiastolic: [78, 96], weight: [75, 105], painLevel: [2, 8], stressScore: [10, 30], lonelinessScore: [25, 55], sleepHours: [5, 8], waterIntake: [4, 9], exerciseMinutes: [10, 45], surveyCompletion: [40, 95], goalCompletion: [20, 80] };
      const [lo, hi] = ranges[mk] || [0, 100];
      row[mk] = Math.round((hi - (hi - lo) * (i / (months.length - 1 || 1)) + (Math.random() - 0.5) * 5) * 10) / 10;
    });
    return row;
  });
}

const MONTH_OPTIONS = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025"];
const MONTH_SHORT = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const MOCK_REPORT_HISTORY = [
  { id: "r1", scope: "group", title: "Group Report — March 2026", createdAt: "2026-03-10", metrics: ["Systolic BP", "Weight", "Pain Level"], type: "graph" },
  { id: "r2", scope: "comparison", title: "James Kowalski vs Group", createdAt: "2026-03-08", metrics: ["BP", "Surveys", "Goals"], type: "numeric" },
  { id: "r3", scope: "trends", title: "Health Trends — Priya Sharma", createdAt: "2026-02-28", metrics: ["Systolic BP", "Weight"], type: "graph" },
  { id: "r4", scope: "group", title: "Group Report — February 2026", createdAt: "2026-02-15", metrics: ["All Vitals", "Engagement"], type: "graph" },
  { id: "r5", scope: "comparison", title: "Sarah Chen vs Group", createdAt: "2026-02-10", metrics: ["Vitals", "Lifestyle"], type: "numeric" },
  { id: "r6", scope: "trends", title: "Health Trends — Marcus Webb", createdAt: "2026-01-25", metrics: ["Pain Level", "Exercise"], type: "graph" },
  { id: "r7", scope: "group", title: "Group Report — January 2026", createdAt: "2026-01-12", metrics: ["All metrics"], type: "graph" },
];

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
const CHART_TT = { borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)", fontSize: "12px" };
const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#84cc16"];

// ─── Shared Components ──────────────────────────────────────────────────────────

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

function MetricPicker({ selected, onChange, label = "Select Metrics" }) {
  const [expanded, setExpanded] = useState(false);
  const toggleMetric = (key) => onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  const toggleCategory = (cat) => {
    const catKeys = ALL_METRICS.filter(m => m.category === cat).map(m => m.key);
    const allSelected = catKeys.every(k => selected.includes(k));
    if (allSelected) onChange(selected.filter(k => !catKeys.includes(k)));
    else onChange([...new Set([...selected, ...catKeys])]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          {expanded ? "Collapse" : `${selected.length} selected — Edit`}
        </button>
      </div>
      {!expanded ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No metrics selected</span>
          ) : selected.map(key => {
            const m = ALL_METRICS.find(x => x.key === key);
            return m ? (
              <span key={key} className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                {m.label}
                <button onClick={() => toggleMetric(key)} className="text-blue-400 hover:text-blue-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ) : null;
          })}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3 max-h-60 overflow-y-auto">
          {METRIC_CATEGORIES.map(cat => {
            const catMetrics = ALL_METRICS.filter(m => m.category === cat);
            const allCatSelected = catMetrics.every(m => selected.includes(m.key));
            const someCatSelected = catMetrics.some(m => selected.includes(m.key));
            return (
              <div key={cat}>
                <button onClick={() => toggleCategory(cat)} className="flex items-center gap-2 mb-1.5 group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allCatSelected ? "bg-blue-600 border-blue-600" : someCatSelected ? "bg-blue-200 border-blue-400" : "border-slate-300 group-hover:border-slate-400"}`}>
                    {(allCatSelected || someCatSelected) && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allCatSelected ? "M5 13l4 4L19 7" : "M20 12H4"} /></svg>}
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{cat}</span>
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-6">
                  {catMetrics.map(m => (
                    <label key={m.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors">
                      <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggleMetric(m.key)} className="w-3.5 h-3.5 rounded accent-blue-600" />
                      <span className="text-xs text-slate-700">{m.label}</span>
                      <span className="text-xs text-slate-300 ml-auto">{m.unit}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <button onClick={() => onChange(ALL_METRICS.map(m => m.key))} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Select All</button>
            <span className="text-xs text-slate-300">·</span>
            <button onClick={() => onChange([])} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Clear All</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DateRangeRow({ from, to, onFromChange, onToChange }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Date Range</label>
      <div className="flex items-center gap-2">
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
        <span className="text-xs text-slate-300">to</span>
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
      </div>
    </div>
  );
}

function ReportTypeRow({ value, onChange }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Report Type</label>
      <div className="flex gap-1.5">
        {[{ v: "graph", l: "Graphical", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }, { v: "numeric", l: "Numeric", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" }].map(t => (
          <button key={t.v} onClick={() => onChange(t.v)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${value === t.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} /></svg>
            {t.l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Group Report ──────────────────────────────────────────────────────────

function GroupReport({ participants = MOCK_PARTICIPANTS, groupName = CARETAKER_GROUP.name }) {
  const [metrics, setMetrics] = useState(["bpSystolic", "weight", "painLevel", "surveyCompletion"]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState("2026-03-14");
  const [reportType, setReportType] = useState("graph");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generated, setGenerated] = useState(false);
  const [chartMetric, setChartMetric] = useState(null);

  const data = useMemo(() => generated ? generateGroupData(metrics) : null, [generated, metrics]);
  const trends = useMemo(() => generated ? generateTrends(MONTH_SHORT, metrics) : null, [generated, metrics]);

  function handleGenerate() {
    setGenerated(true);
    setChartMetric(metrics[0] || null);
  }

  if (!generated) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Configure Group Report</h2>
              <p className="text-xs text-slate-400 mt-0.5">Aggregate data across all participants in {groupName}</p>
            </div>
          </div>

          <MetricPicker selected={metrics} onChange={setMetrics} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <ReportTypeRow value={reportType} onChange={setReportType} />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Include Participants</label>
            <div className="flex gap-1.5">
              {[{ v: "all", l: "All" }, { v: "active", l: "Active Only" }, { v: "inactive", l: "Inactive Only" }].map(s => (
                <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.l}</button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={metrics.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Generate Group Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back to configure */}
      <button onClick={() => setGenerated(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>

      {/* Config summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">Group Report</span>
        <span>·</span>
        <span>{metrics.length} metrics</span>
        <span>·</span>
        <span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
        <span>·</span>
        <span className="capitalize">{statusFilter} participants</span>
        <span>·</span>
        <span className="capitalize">{reportType}</span>
      </div>

      {/* Metric summary cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data).slice(0, 8).map(([key, m]) => (
            <div key={key} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setChartMetric(key)}>
              <p className="text-xs text-slate-400 mb-0.5 truncate">{m.label}</p>
              <p className="text-xl font-extrabold text-slate-800">{m.avg}<span className="text-xs text-slate-400 ml-0.5">{m.unit}</span></p>
              <p className="text-xs text-slate-300 mt-0.5">{m.min} — {m.max}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart area — single metric at a time */}
      {reportType === "graph" && chartMetric && data?.[chartMetric] && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{data[chartMetric].label} — Per Participant</p>
            <div className="flex gap-1 overflow-x-auto">
              {metrics.map(mk => {
                const m = ALL_METRICS.find(x => x.key === mk);
                return (
                  <Tip key={mk} text={`View ${m?.label}`}>
                    <button onClick={() => setChartMetric(mk)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${chartMetric === mk ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{m?.label?.split(" ")[0]}</button>
                  </Tip>
                );
              })}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data[chartMetric].perParticipant} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <ReTooltip contentStyle={CHART_TT} formatter={(v) => `${v} ${data[chartMetric].unit}`} />
                <Bar dataKey="value" name={data[chartMetric].label} fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly trends — select which metrics to overlay */}
      {reportType === "graph" && trends && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Monthly Group Trends</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <ReTooltip contentStyle={CHART_TT} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {metrics.slice(0, 4).map((mk, i) => {
                  const m = ALL_METRICS.find(x => x.key === mk);
                  return <Line key={mk} type="monotone" dataKey={mk} name={m?.label || mk} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {metrics.length > 4 && <p className="text-xs text-slate-400 italic mt-2 text-center">Showing first 4 metrics on chart. Click metric cards above to focus individual metrics.</p>}
        </div>
      )}

      {/* Numeric table */}
      {reportType === "numeric" && data && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Numeric Summary</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Metric</th>
                <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Avg</th>
                <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Min</th>
                <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Max</th>
                <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Unit</th>
              </tr></thead>
              <tbody>
                {Object.entries(data).map(([key, m]) => (
                  <tr key={key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-700">{m.label}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-600">{m.avg}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{m.min}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{m.max}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Comparison ────────────────────────────────────────────────────────────

function ComparisonReport({ participants = MOCK_PARTICIPANTS, groupName = CARETAKER_GROUP.name }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [includeGroupAvg, setIncludeGroupAvg] = useState(true);
  const [metrics, setMetrics] = useState(["bpSystolic", "bpDiastolic", "weight", "painLevel", "surveyCompletion", "goalCompletion"]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState("2026-03-14");
  const [generated, setGenerated] = useState(false);

  function toggleParticipant(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // Generate mock values per participant per metric (seeded by id so values are stable)
  const mockData = useMemo(() => {
    if (!generated) return null;
    const ranges = { bpSystolic: [105, 150], bpDiastolic: [65, 95], weight: [50, 105], painLevel: [0, 8], stressScore: [5, 35], lonelinessScore: [20, 65], sleepHours: [4, 9], waterIntake: [2, 10], exerciseMinutes: [0, 60], surveyCompletion: [0, 100], goalCompletion: [0, 100] };
    const seed = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
    const vals = {};
    selectedIds.forEach(pid => {
      vals[pid] = {};
      metrics.forEach(mk => {
        const [lo, hi] = ranges[mk] || [0, 100];
        const s = seed(pid + mk);
        vals[pid][mk] = Math.round((lo + (s % 1000) / 1000 * (hi - lo)) * 10) / 10;
      });
    });
    // Group averages
    if (includeGroupAvg) {
      vals["__group__"] = {};
      metrics.forEach(mk => {
        const [lo, hi] = ranges[mk] || [0, 100];
        vals["__group__"][mk] = Math.round(((lo + hi) / 2) * 10) / 10;
      });
    }
    return vals;
  }, [generated, selectedIds, metrics, includeGroupAvg]);

  if (!generated) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Configure Comparison Report</h2>
            <p className="text-xs text-slate-400 mt-0.5">Compare two or more participants head-to-head, optionally against the group average</p>
          </div>
        </div>

        {/* Multi-select participants */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
            Select Participants <span className="text-slate-300 font-normal normal-case">(pick 2 or more)</span>
          </label>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-48 overflow-y-auto">
            {participants.map(p => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <label key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-white border border-transparent"}`}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleParticipant(p.id)} className="w-4 h-4 rounded accent-indigo-600" />
                  <span className="text-sm font-medium text-slate-700">{p.name}</span>
                  <span className={`text-xs ml-auto ${p.status === "active" ? "text-emerald-500" : "text-slate-400"}`}>{p.status}</span>
                </label>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-slate-400">{selectedIds.length} selected:</span>
              {selectedIds.map(id => {
                const p = participants.find(x => x.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {p?.name?.split(" ")[0]}
                    <button onClick={() => toggleParticipant(id)} className="text-indigo-400 hover:text-indigo-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Include group average toggle */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors">
          <input type="checkbox" checked={includeGroupAvg} onChange={e => setIncludeGroupAvg(e.target.checked)} className="w-4 h-4 rounded accent-emerald-600" />
          <div>
            <span className="text-sm font-semibold text-emerald-800">Include Group Average</span>
            <p className="text-xs text-emerald-600 mt-0.5">Add the {groupName} average as a reference column</p>
          </div>
        </label>

        <MetricPicker selected={metrics} onChange={setMetrics} label="Metrics to Compare" />
        <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        <button onClick={() => setGenerated(true)} disabled={selectedIds.length < 2 || metrics.length === 0}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          {selectedIds.length < 2 ? "Select at least 2 participants" : "Generate Comparison"}
        </button>
      </div>
    );
  }

  const selectedPeople = selectedIds.map(id => participants.find(p => p.id === id)).filter(Boolean);
  const columnIds = includeGroupAvg ? [...selectedIds, "__group__"] : [...selectedIds];
  const columnNames = columnIds.map(id => id === "__group__" ? "Group Avg" : participants.find(p => p.id === id)?.name?.split(" ")[0] || id);
  const lowerBetterKeys = new Set(["bpSystolic", "bpDiastolic", "weight", "painLevel", "stressScore", "lonelinessScore"]);

  // Radar data: normalize each metric to 0-100 scale for visual comparison
  const radarData = useMemo(() => {
    return metrics.slice(0, 8).map(mk => {
      const m = ALL_METRICS.find(x => x.key === mk);
      const row = { metric: m?.label?.split(" ").slice(0, 2).join(" ") || mk };
      columnIds.forEach((id, i) => {
        row[`val_${i}`] = mockData?.[id]?.[mk] != null ? Math.round(Math.min(100, Math.max(0, mockData[id][mk]))) : 0;
      });
      return row;
    });
  }, [metrics, columnIds, mockData]);

  return (
    <div className="space-y-5">
      <button onClick={() => setGenerated(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">{selectedPeople.map(p => p.name.split(" ")[0]).join(" vs ")}{includeGroupAvg ? " vs Group" : ""}</span>
        <span>·</span><span>{metrics.length} metrics</span><span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
      </div>

      {/* Head-to-head table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4 sticky left-0 bg-slate-50 z-10">Metric</th>
              {columnIds.map((id, i) => (
                <th key={id} className={`text-center text-xs font-bold uppercase tracking-wider py-2.5 px-3 ${id === "__group__" ? "text-emerald-600" : `text-${["indigo", "rose", "amber", "blue", "violet", "pink", "teal", "orange"][i % 8]}-600`}`}>
                  {columnNames[i]}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {metrics.map(mk => {
                const m = ALL_METRICS.find(x => x.key === mk);
                const values = columnIds.map(id => mockData?.[id]?.[mk] ?? "—");
                const isLB = lowerBetterKeys.has(mk);
                const numVals = values.filter(v => typeof v === "number");
                const best = numVals.length > 0 ? (isLB ? Math.min(...numVals) : Math.max(...numVals)) : null;
                return (
                  <tr key={mk} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-700 sticky left-0 bg-white z-10">{m?.label} <span className="text-slate-300">{m?.unit}</span></td>
                    {values.map((v, i) => (
                      <td key={i} className={`py-2.5 px-3 text-center font-bold ${typeof v === "number" && v === best ? "text-emerald-600" : columnIds[i] === "__group__" ? "text-emerald-700/70" : "text-slate-700"}`}>
                        {v}{typeof v === "number" && v === best && " ✓"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar chart */}
      {radarData.length >= 3 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Performance Radar</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#64748b" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                {columnIds.map((id, i) => (
                  <Radar key={id} name={columnNames[i]} dataKey={`val_${i}`}
                    stroke={id === "__group__" ? "#10b981" : COLORS[i % COLORS.length]}
                    fill={id === "__group__" ? "#10b981" : COLORS[i % COLORS.length]}
                    fillOpacity={id === "__group__" ? 0.08 : 0.12}
                    strokeWidth={id === "__group__" ? 1.5 : 2}
                    strokeDasharray={id === "__group__" ? "4 4" : undefined} />
                ))}
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <ReTooltip contentStyle={CHART_TT} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Health Trends (with Notes) ────────────────────────────────────────────

const MOCK_NOTES_BY_PARTICIPANT = {
  p7: [
    { id: "n1", text: "James showed improvement in daily step count but BP is still above target. Discussed medication adherence.", createdAt: "2026-03-08", tag: "check-in" },
    { id: "n2", text: "Reviewed latest PSS scores — stress levels remain elevated. Recommended exploring community walking group.", createdAt: "2026-02-25", tag: "recommendation" },
    { id: "n3", text: "Weight down 1.5 kg from last month. Positive trend. Flagged chest pain reported in PAR-Q — follow up with GP.", createdAt: "2026-02-15", tag: "progress" },
  ],
  p1: [
    { id: "n10", text: "Sarah's BP is well-controlled and she's been consistent with surveys. Great progress overall.", createdAt: "2026-03-10", tag: "progress" },
  ],
};

function HealthTrendsReport({ participants = MOCK_PARTICIPANTS }) {
  const [selectedId, setSelectedId] = useState("");
  const [metrics, setMetrics] = useState(["bpSystolic", "bpDiastolic"]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState("2026-03-14");
  const [generated, setGenerated] = useState(false);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [noteTag, setNoteTag] = useState("check-in");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState("");

  const trends = useMemo(() => generated ? generateTrends(MONTH_SHORT, metrics) : null, [generated, metrics]);

  function handleGenerate() {
    setGenerated(true);
    // Load notes for selected participant from API
    api.caretakerListNotes(selectedId)
      .then(data => setNotes(data))
      .catch(() => setNotes(MOCK_NOTES_BY_PARTICIPANT[selectedId] || []));
    setNewNote("");
    setEditingNoteId(null);
  }

  async function handleSaveNote() {
    if (!newNote.trim()) return;
    const note = { id: `n${Date.now()}`, text: newNote.trim(), createdAt: new Date().toISOString().split("T")[0], tag: noteTag };
    setNotes(prev => [note, ...prev]);
    setNewNote("");
    try {
      await api.caretakerCreateNote(selectedId, newNote.trim(), noteTag);
    } catch (err) {
      console.warn("Note save via API failed (backend may not be ready):", err.message);
    }
  }

  function handleEditNote(noteId) {
    const n = notes.find(x => x.id === noteId);
    if (n) { setEditingNoteId(noteId); setEditText(n.text); }
  }

  async function handleSaveEdit(noteId) {
    if (!editText.trim()) return;
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text: editText.trim() } : n));
    setEditingNoteId(null);
    setEditText("");
    try {
      await api.caretakerUpdateNote(noteId, editText.trim());
    } catch (err) {
      console.warn("Note update via API failed:", err.message);
    }
  }

  async function handleDeleteNote(noteId) {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await api.caretakerDeleteNote(noteId);
    } catch (err) {
      console.warn("Note delete via API failed:", err.message);
    }
  }

  const tagColors = { "check-in": "bg-blue-50 text-blue-700 border-blue-100", "recommendation": "bg-indigo-50 text-indigo-700 border-indigo-100", "progress": "bg-emerald-50 text-emerald-700 border-emerald-100", "concern": "bg-rose-50 text-rose-700 border-rose-100" };

  if (!generated) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Configure Health Trends</h2>
            <p className="text-xs text-slate-400 mt-0.5">View how a participant's metrics change over time and add notes</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Participant</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full md:w-72 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white">
            <option value="">Select a participant…</option>
            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <MetricPicker selected={metrics} onChange={setMetrics} label="Metrics to Track" />
        <DateRangeRow from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        <button onClick={handleGenerate} disabled={!selectedId || metrics.length === 0}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Generate Trends
        </button>
      </div>
    );
  }

  const pName = participants.find(p => p.id === selectedId)?.name || "Participant";

  return (
    <div className="space-y-5">
      <button onClick={() => setGenerated(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">{pName}</span><span>·</span><span>{metrics.length} metrics</span><span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
      </div>

      {/* Charts — one per metric */}
      {trends && metrics.map((mk, idx) => {
        const m = ALL_METRICS.find(x => x.key === mk);
        return (
          <div key={mk} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{m?.label || mk} <span className="text-slate-300 font-normal normal-case">({m?.unit})</span></p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <ReTooltip contentStyle={CHART_TT} formatter={(v) => `${v} ${m?.unit || ""}`} />
                  <Line type="monotone" dataKey={mk} name={m?.label} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}

      {/* ── Notes & Feedback Section ────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <p className="text-sm font-bold text-slate-700">Notes & Feedback for {pName}</p>
          <span className="text-xs text-slate-400 ml-auto">{notes.length} notes · synced with participant profile</span>
        </div>

        {/* Write new note */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3} placeholder={`Add a note about ${pName}...`}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none bg-white" />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 overflow-x-auto">
              {["check-in", "recommendation", "progress", "concern"].map(t => (
                <button key={t} onClick={() => setNoteTag(t)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap capitalize ${noteTag === t ? "bg-blue-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"}`}>{t}</button>
              ))}
            </div>
            <button onClick={handleSaveNote} disabled={!newNote.trim()} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              Save Note
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="divide-y divide-slate-100">
          {notes.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-400">No notes yet for {pName}.</p>
              <p className="text-xs text-slate-300 mt-1">Notes you add here will appear on their participant profile too.</p>
            </div>
          ) : notes.map(n => (
            <div key={n.id} className="px-5 py-4 group hover:bg-slate-50/50 transition-colors">
              {editingNoteId === n.id ? (
                <div className="space-y-2">
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                    <button onClick={() => handleSaveEdit(n.id)} disabled={!editText.trim()} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{fmt(n.createdAt)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${tagColors[n.tag] || tagColors["check-in"]}`}>{n.tag}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tip text="Edit note">
                        <button onClick={() => handleEditNote(n.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </Tip>
                      <Tip text="Delete note">
                        <button onClick={() => handleDeleteNote(n.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </Tip>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{n.text}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sync notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Notes added here are synced with {pName}'s <strong>Notes & Feedback</strong> tab on their participant detail page. Edits and deletions are reflected everywhere.</span>
      </div>
    </div>
  );
}

// ─── Tab: History ───────────────────────────────────────────────────────────────

function ReportHistory() {
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");

  const filtered = useMemo(() => MOCK_REPORT_HISTORY.filter(r => {
    if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, scopeFilter]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[{ v: "all", l: "All" }, { v: "group", l: "Group" }, { v: "comparison", l: "Comparison" }, { v: "trends", l: "Trends" }].map(s => (
            <button key={s.v} onClick={() => setScopeFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${scopeFilter === s.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 px-1">{filtered.length} reports</p>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No reports match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all cursor-pointer group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{r.title}</p>
                  <ScopeBadge scope={r.scope} />
                  <span className="text-xs text-slate-300 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded capitalize">{r.type}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>{fmt(r.createdAt)}</span>
                  <span>·</span>
                  <span>{r.metrics.join(", ")}</span>
                </div>
              </div>
              <Tip text="View report">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </Tip>
            </div>
          ))}
        </div>
      )}
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

// ─── Group Selector (shared pattern) ────────────────────────────────────────

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

export default function ReportsPage() {
  const { user } = useOutletContext();
  const [activeTab, setActiveTab] = useState("group");
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, gData] = await Promise.all([
        api.caretakerListParticipants().catch(() => []),
        api.caretakerGetGroups().catch(() => []),
      ]);
      setParticipants(Array.isArray(pData) ? pData : []);
      const transformedGroups = Array.isArray(gData)
        ? gData.map(g => ({ id: g.group_id, name: g.name }))
        : [];
      setGroups(transformedGroups);
    } catch (err) {
      console.warn("Failed to load reports data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // Filter participants by selected group
  const filteredParticipants = selectedGroupId === "all"
    ? participants
    : participants.filter(p => p.group_id === selectedGroupId);

  const selectedGroupName = selectedGroupId === "all"
    ? (groups.length > 0 ? "All Groups" : "No Group")
    : (groups.find(g => g.id === selectedGroupId)?.name || "Group");

  // Normalize participant shape for child components
  const normalizedParticipants = filteredParticipants.length > 0 ? filteredParticipants.map(p => ({
    id: p.id || p.participant_id,
    name: p.name || `${p.firstName || ""} ${p.lastName || ""}`.trim(),
    status: p.status || "active",
  })) : MOCK_PARTICIPANTS;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-sm text-slate-400 mt-1">Generate and review health reports.</p>
      </div>

      {/* Group Selector */}
      {groups.length > 0 && (
        <ReportsGroupSelector
          groups={groups}
          selectedGroupId={selectedGroupId}
          onChange={setSelectedGroupId}
          totalParticipants={participants.length}
        />
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

      {activeTab === "group" && <GroupReport participants={normalizedParticipants} groupName={selectedGroupName} />}
      {activeTab === "comparison" && <ComparisonReport participants={normalizedParticipants} groupName={selectedGroupName} />}
      {activeTab === "trends" && <HealthTrendsReport participants={normalizedParticipants} />}
      {activeTab === "history" && <ReportHistory />}
    </div>
  );
}

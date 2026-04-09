import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { api } from "../../services/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend } from "recharts";

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
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

// ─── Shared: MetricPicker (driven by real elements) ─────────────────────────────

function MetricPicker({ elements, selected, onChange, label = "Select Metrics" }) {
  const [expanded, setExpanded] = useState(false);

  const categories = useMemo(() => {
    const cats = {};
    elements.forEach(e => {
      const cat = e.category || "Other";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(e);
    });
    return cats;
  }, [elements]);

  const toggleMetric = (id) => onChange(selected.includes(id) ? selected.filter(k => k !== id) : [...selected, id]);
  const toggleCategory = (cat) => {
    const ids = categories[cat].map(e => e.element_id);
    const allSelected = ids.every(id => selected.includes(id));
    if (allSelected) onChange(selected.filter(id => !ids.includes(id)));
    else onChange([...new Set([...selected, ...ids])]);
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
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-3 max-h-60 overflow-y-auto">
          {Object.entries(categories).map(([cat, catElements]) => {
            const allSelected = catElements.every(e => selected.includes(e.element_id));
            const someSelected = catElements.some(e => selected.includes(e.element_id));
            return (
              <div key={cat}>
                <button onClick={() => toggleCategory(cat)} className="flex items-center gap-2 mb-1.5 group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allSelected ? "bg-blue-600 border-blue-600" : someSelected ? "bg-blue-200 border-blue-400" : "border-slate-300 group-hover:border-slate-400"}`}>
                    {(allSelected || someSelected) && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSelected ? "M5 13l4 4L19 7" : "M20 12H4"} /></svg>}
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{cat}</span>
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-6">
                  {catElements.map(e => (
                    <label key={e.element_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors">
                      <input type="checkbox" checked={selected.includes(e.element_id)} onChange={() => toggleMetric(e.element_id)} className="w-3.5 h-3.5 rounded accent-blue-600" />
                      <span className="text-xs text-slate-700">{e.label}</span>
                      <span className="text-xs text-slate-300 ml-auto">{e.unit}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2 border-t border-slate-200">
            <button onClick={() => onChange(elements.map(e => e.element_id))} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Select All</button>
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

function GroupReportTab({ groups, selectedGroupId, elements }) {
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState("graph");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [chartMetric, setChartMetric] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (elements.length > 0 && metrics.length === 0) {
      setMetrics(elements.slice(0, 4).map(e => e.element_id));
    }
  }, [elements]);

  const groupName = selectedGroupId === "all" ? "All Groups" : groups.find(g => g.id === selectedGroupId)?.name || "Group";

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const groupId = selectedGroupId !== "all" ? selectedGroupId : groups[0]?.id;
      if (!groupId) { setError("No group selected."); setGenerating(false); return; }
      const payload = {
        element_ids: metrics,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        report_type: reportType,
      };
      const data = await api.caretakerGenerateGroupReport(groupId, payload);
      setReport(data.payload || data);
      const elems = data.payload?.elements || data.elements || [];
      if (elems.length > 0) setChartMetric(elems[0].element_id);
    } catch (err) {
      console.error("Group report generation failed:", err);
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { setReport(null); }, [selectedGroupId]);

  if (!report) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Configure Group Report</h2>
              <p className="text-xs text-slate-400 mt-0.5">Aggregate data across all participants in <span className="font-semibold text-slate-500">{groupName}</span></p>
            </div>
          </div>

          {elements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No data elements configured for this group yet.</p>
              <p className="text-xs text-slate-300 mt-1">Ask a researcher to set up data element mappings for the surveys deployed to this group.</p>
            </div>
          ) : (
            <>
              <MetricPicker elements={elements} selected={metrics} onChange={setMetrics} />
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
              {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">{error}</p>}
              <button onClick={handleGenerate} disabled={metrics.length === 0 || generating}
                className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {generating ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Generate Group Report</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const elems = report.elements || [];

  return (
    <div className="space-y-5">
      <button onClick={() => setReport(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">Group Report — {groupName}</span>
        <span>·</span><span>{elems.length} metrics</span>
        <span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
        <span>·</span><span className="capitalize">{statusFilter} participants</span>
        <span>·</span><span className="capitalize">{reportType}</span>
      </div>

      {elems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No data found for the selected metrics and date range.</p>
          <button onClick={() => setReport(null)} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Adjust configuration</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {elems.map(e => (
              <div key={e.element_id} onClick={() => setChartMetric(e.element_id)}
                className={`bg-white rounded-2xl shadow-sm border px-4 py-3 text-center cursor-pointer transition-colors ${chartMetric === e.element_id ? "border-blue-200 bg-blue-50/30" : "border-slate-100 hover:border-blue-200"}`}>
                <p className="text-xs text-slate-400 mb-0.5 truncate">{e.label}</p>
                <p className="text-xl font-extrabold text-slate-800">{e.avg}<span className="text-xs text-slate-400 ml-0.5">{e.unit}</span></p>
                <p className="text-xs text-slate-300 mt-0.5">{e.min} — {e.max}</p>
                <p className="text-[10px] text-slate-300">{e.count} data points</p>
              </div>
            ))}
          </div>
          {reportType === "graph" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Values</p>
                <div className="flex gap-1 overflow-x-auto">
                  {elems.map(e => (
                    <button key={e.element_id} onClick={() => setChartMetric(e.element_id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${chartMetric === e.element_id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {e.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={elems} margin={{ bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <ReTooltip contentStyle={CHART_TT} formatter={(v, name, props) => [`${v} ${props.payload.unit}`, "Average"]} />
                    <Bar dataKey="avg" name="Group Average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Numeric Summary</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Metric</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Avg</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Min</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Max</th>
                  <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Count</th>
                </tr></thead>
                <tbody>
                  {elems.map(e => (
                    <tr key={e.element_id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{e.label} <span className="text-slate-400 font-normal">({e.unit})</span></td>
                      <td className="py-2.5 px-4 text-center font-bold text-blue-600">{e.avg}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{e.min}</td>
                      <td className="py-2.5 px-4 text-center text-slate-500">{e.max}</td>
                      <td className="py-2.5 px-4 text-center text-slate-400">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Comparison Report (with MetricPicker) ─────────────────────────────────

function ComparisonTab({ participants, groups, selectedGroupId, elements, initialParticipantId }) {
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const appliedInitialRef = useRef(false);
  const [compareWith, setCompareWith] = useState("group");
  const [compareParticipantId, setCompareParticipantId] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const groupName = selectedGroupId === "all" ? "All Groups" : groups.find(g => g.id === selectedGroupId)?.name || "Group";

  // One-shot: when participants load and we have an initialParticipantId from
  // the URL (e.g. navigating from MyParticipantsPage "Generate report"),
  // pre-select that participant. The ref makes sure we only do this once —
  // so if the caretaker later picks a different participant, we don't
  // override their choice.
  useEffect(() => {
    if (appliedInitialRef.current) return;
    if (!initialParticipantId) return;
    if (participants.some(p => p.participant_id === initialParticipantId)) {
      setSelectedParticipant(initialParticipantId);
      appliedInitialRef.current = true;
    }
  }, [initialParticipantId, participants]);

  // Auto-select first 4 elements
  useEffect(() => {
    if (elements.length > 0 && metrics.length === 0) {
      setMetrics(elements.slice(0, 4).map(e => e.element_id));
    }
  }, [elements]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const queryParams = { compare_with: compareWith };
      if (compareWith === "participant" && compareParticipantId) {
        queryParams.compare_participant_id = compareParticipantId;
      }
      if (compareWith === "group") {
        queryParams.group_id = selectedGroupId !== "all" ? selectedGroupId : groups[0]?.id;
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
            {[{ v: "group", l: `Group Avg (${groupName})` }, { v: "participant", l: "Another Participant" }, { v: "all", l: "All Participants" }].map(opt => (
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

        <MetricPicker elements={elements} selected={metrics} onChange={setMetrics} label="Metrics to Compare" />

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
  const compLabel = compareWith === "group" ? groupName : compareWith === "all" ? "All Participants" : participants.find(p => p.participant_id === compareParticipantId)?.name || "Comparison";
  const barData = elems.map(e => ({ label: e.label, unit: e.unit, [subjectName]: e.subject?.avg, [compLabel]: e.comparison?.avg }));

  return (
    <div className="space-y-5">
      <button onClick={() => setReport(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Average Comparison</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <ReTooltip contentStyle={CHART_TT} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey={subjectName} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={compLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
        </>
      )}
    </div>
  );
}

// ─── Tab: Health Trends (with metric visibility toggles in results) ─────────────

function TrendsTab({ participants, elements }) {
  const [selectedId, setSelectedId] = useState("");
  const [metrics, setMetrics] = useState([]);
  const [dateFrom, setDateFrom] = useState("2025-09-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState(null);
  const [error, setError] = useState(null);
  const [visibleMetrics, setVisibleMetrics] = useState([]);

  const toggleVisible = (id) => {
    setVisibleMetrics(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (elements.length > 0 && metrics.length === 0) {
      setMetrics(elements.slice(0, 3).map(e => e.element_id));
    }
  }, [elements]);

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

        {elements.length > 0 && (
          <MetricPicker elements={elements} selected={metrics} onChange={setMetrics} label="Metrics to Track" />
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
      <button onClick={() => { setTrends(null); setVisibleMetrics([]); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Configuration
      </button>

      <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-bold text-slate-700">{pName}</span>
        <span>·</span><span>{trends.length} metrics with data</span>
        <span>·</span><span>{fmt(dateFrom)} — {fmt(dateTo)}</span>
      </div>

      {/* Metric visibility toggles */}
      {trends.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Show / Hide Metrics</p>
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
          <p className="text-[10px] text-slate-400 mt-2">Click a metric to show or hide its chart below</p>
        </div>
      )}

      {trends.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No trend data found for this participant in the selected date range.</p>
          <button onClick={() => { setTrends(null); setVisibleMetrics([]); }} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Adjust configuration</button>
        </div>
      ) : displayedTrends.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">All metrics are hidden. Click a metric above to show its chart.</p>
        </div>
      ) : displayedTrends.map((t, idx) => (
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
              <LineChart data={t.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={d => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <ReTooltip contentStyle={CHART_TT} formatter={v => t.unit ? `${v} ${t.unit}` : `${v}`} labelFormatter={d => fmt(d)} />
                <Line type="monotone" dataKey="value" name={t.label} stroke={COLORS[trends.indexOf(t) % COLORS.length]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: History ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [reports, setReports] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    api.caretakerListReports()
      .then(data => {
        setReports((data || []).map(r => ({
          id: r.report_id,
          scope: r.scope || "unknown",
          createdAt: r.created_at,
        })));
      })
      .catch(() => setReports([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  const filtered = useMemo(() => reports.filter(r => {
    if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
    if (search && !`${r.scope} ${fmt(r.createdAt)}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, scopeFilter, reports]);

  async function handleViewReport(r) {
    setDetailLoading(true);
    setDetailError(null);
    setViewing({ ...r, payload: null });
    try {
      const detail = await api.caretakerGetReport(r.id);
      setViewing({ ...r, payload: detail.payload || {} });
    } catch (err) {
      setDetailError(err.message || "Couldn't load this report. Please try again.");
      setViewing({ ...r, payload: {} });
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

  if (viewing) {
    const elems = viewing.payload?.elements || [];
    const isComparison = viewing.scope === "comparison";

    return (
      <div className="space-y-5">
        <button onClick={() => { setViewing(null); setDetailError(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to History
        </button>
        <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ScopeBadge scope={viewing.scope} />
          <span>·</span><span>Generated {fmt(viewing.createdAt)}</span>
          <span>·</span><span>{elems.length} elements</span>
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
            {!isComparison && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {elems.map(e => (
                  <div key={e.element_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 text-center">
                    <p className="text-xs text-slate-400 mb-0.5 truncate">{e.label}</p>
                    <p className="text-xl font-extrabold text-slate-800">{e.avg}<span className="text-xs text-slate-400 ml-0.5">{e.unit}</span></p>
                    <p className="text-xs text-slate-300 mt-0.5">{e.min} — {e.max}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report Data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Element</th>
                    {isComparison ? (
                      <><th className="text-center text-xs font-bold text-indigo-500 uppercase tracking-wider py-2.5 px-4">Subject Avg</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Comparison Avg</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Diff</th></>
                    ) : (
                      <><th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Avg</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Min</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Max</th>
                      <th className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2.5 px-4">Count</th></>
                    )}
                  </tr></thead>
                  <tbody>
                    {elems.map(e => {
                      const diff = isComparison && e.subject?.avg != null && e.comparison?.avg != null ? e.subject.avg - e.comparison.avg : null;
                      return (
                        <tr key={e.element_id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{e.label} <span className="text-slate-400 font-normal">({e.unit})</span></td>
                          {isComparison ? (
                            <><td className="py-2.5 px-4 text-center font-bold text-indigo-600">{e.subject?.avg ?? "—"}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.comparison?.avg ?? "—"}</td>
                            <td className={`py-2.5 px-4 text-center font-bold ${diff != null ? (diff < 0 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-slate-400") : "text-slate-400"}`}>
                              {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                            </td></>
                          ) : (
                            <><td className="py-2.5 px-4 text-center font-bold text-blue-600">{e.avg}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.min}</td>
                            <td className="py-2.5 px-4 text-center text-slate-500">{e.max}</td>
                            <td className="py-2.5 px-4 text-center text-slate-400">{e.count}</td></>
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[{ v: "all", l: "All" }, { v: "group", l: "Group" }, { v: "comparison", l: "Comparison" }].map(s => (
            <button key={s.v} onClick={() => setScopeFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${scopeFilter === s.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{s.l}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 px-1">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</p>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">{reports.length === 0 ? "No reports generated yet. Use the Group or Comparison tabs to create one." : "No reports match your search."}</p>
        </div>
      ) : filtered.map(r => (
        <div key={r.id} onClick={() => handleViewReport(r)}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors capitalize">{r.scope} Report</p>
              <ScopeBadge scope={r.scope} />
            </div>
            <p className="text-xs text-slate-400 mt-1">Generated {fmt(r.createdAt)}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
      if (Array.isArray(gData) && gData.length > 0) {
        try {
          const elemData = await api.caretakerGetGroupElements(gData[0].group_id);
          const elems = Array.isArray(elemData) ? elemData.map(e => ({
            ...e, element_id: e.element_id,
            label: e.label || e.code || "Unknown",
            unit: e.unit || "",
            category: e.category || inferCategory(e.label || e.code || ""),
          })) : [];
          setElements(elems);
        } catch { setElements([]); }
      }
    } catch (err) {
      setLoadError(err.message || "Couldn't load reports data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId === "all" || groups.length === 0) return;
    api.caretakerGetGroupElements(selectedGroupId)
      .then(data => {
        setElements(Array.isArray(data) ? data.map(e => ({
          ...e, element_id: e.element_id,
          label: e.label || e.code || "Unknown",
          unit: e.unit || "",
          category: e.category || inferCategory(e.label || e.code || ""),
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
        setParticipants(Array.isArray(data) ? data : []);
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
      {activeTab === "comparison" && <ComparisonTab participants={filteredParticipants} groups={groups} selectedGroupId={selectedGroupId} elements={elements} initialParticipantId={initialParticipantId} />}
      {activeTab === "trends" && <TrendsTab participants={filteredParticipants} elements={elements} />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

// ─── Category inference helper ──────────────────────────────────────────────────

function inferCategory(label) {
  const l = label.toLowerCase();
  if (l.includes("bp") || l.includes("blood") || l.includes("weight") || l.includes("pain") || l.includes("heart") || l.includes("bmi")) return "Vitals";
  if (l.includes("stress") || l.includes("anxiety") || l.includes("depress") || l.includes("mental") || l.includes("mood")) return "Mental Health";
  if (l.includes("lonely") || l.includes("social") || l.includes("connect")) return "Social Wellness";
  if (l.includes("sleep") || l.includes("exercise") || l.includes("water") || l.includes("diet") || l.includes("alcohol") || l.includes("screen")) return "Lifestyle";
  if (l.includes("survey") || l.includes("goal") || l.includes("complet")) return "Engagement";
  return "Other";
}

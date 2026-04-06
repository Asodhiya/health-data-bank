import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../services/api";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(val, unit) {
  if (val === null || val === undefined) return "—";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M${unit ? " " + unit : ""}`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K${unit ? " " + unit : ""}`;
  return `${val}${unit ? " " + unit : ""}`;
}

// ── Searchable element selector ────────────────────────────────────────────

function ElementSearchSelect({ value, elements, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const selected = elements.find((el) => el.element_id === value);

  const filtered = elements.filter((el) => {
    const q = query.toLowerCase();
    return (
      (el.label || "").toLowerCase().includes(q) ||
      (el.code || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (el) => {
    onChange(el.element_id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className={`mt-1 w-full flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm text-left transition ${
          open ? "border-blue-400" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        {selected ? (
          <span className="text-slate-800 font-medium">{selected.label}
            <span className="ml-2 font-mono text-[11px] text-slate-400">{selected.code}</span>
          </span>
        ) : (
          <span className="text-slate-300">Select a health metric…</span>
        )}
        <svg className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                autoFocus
                type="text"
                placeholder="Search by name or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 transition"
              />
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-300 text-center">No matches found.</li>
            ) : (
              filtered.map((el) => (
                <li
                  key={el.element_id}
                  onClick={() => handleSelect(el)}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition ${
                    el.element_id === value
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-medium">{el.label}</span>
                  <span className="font-mono text-[11px] text-slate-300 ml-3 shrink-0">{el.code}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Stats panel ────────────────────────────────────────────────────────────

function StatsPanel({ template, dataElements, onClose }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [view, setView] = useState("progress"); // "progress" | "distribution" | "data"
  const [granularity, setGranularity] = useState("month"); // "week" | "month" | "year"
  const [exporting, setExporting] = useState(null); // "summary" | "raw" | null
  const [rawData, setRawData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  const element = dataElements.find((el) => el.element_id === template.element_id);
  const unit = element?.unit || template.element?.unit || "";

  useEffect(() => {
    setLoadingStats(true);
    setStats(null);
    api.getGoalTemplateStats(template.template_id, granularity)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [template.template_id, granularity]);

  useEffect(() => {
    if (view !== "data") return;
    if (rawData) return; // already loaded
    setLoadingRaw(true);
    api.getGoalRawDatapoints(template.template_id)
      .then(setRawData)
      .catch(console.error)
      .finally(() => setLoadingRaw(false));
  }, [view, template.template_id]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{template.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Metric: {element?.label || template.element?.label || "Unknown"}
            {unit && <> · Unit: {unit}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("progress")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              view === "progress"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            Progress over time
          </button>
          <button
            onClick={() => setView("distribution")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              view === "distribution"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            Distribution
          </button>
          <button
            onClick={() => setView("data")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              view === "data"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            Raw Data
          </button>
          {view === "progress" && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 ml-1">
              {["week", "month", "year"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition capitalize ${
                    granularity === g
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
          {/* Export buttons */}
          <div className="flex items-center gap-1 ml-1">
            <button
              disabled={exporting !== null}
              onClick={async () => {
                setExporting("summary");
                try { await api.exportGoalSummary(template.template_id, granularity, template.name); }
                catch (e) { alert("Export failed: " + e.message); }
                finally { setExporting(null); }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting === "summary" ? "Exporting…" : "Summary CSV"}
            </button>
            <button
              disabled={exporting !== null}
              onClick={async () => {
                setExporting("raw");
                try { await api.exportGoalRaw(template.template_id, template.name); }
                catch (e) { alert("Export failed: " + e.message); }
                finally { setExporting(null); }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting === "raw" ? "Exporting…" : "Raw CSV"}
            </button>
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-slate-300 hover:text-slate-500 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loadingStats ? (
        <div className="h-56 flex items-center justify-center text-slate-300 text-sm animate-pulse">
          Loading stats…
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 px-6 pb-4">
            {[
              { label: "Participants tracking", value: stats?.participants_tracking ?? "—" },
              { label: "Avg current value", value: fmt(stats?.avg_current_value, unit) },
              { label: "Completion rate", value: stats?.completion_rate != null ? `${stats.completion_rate}%` : "—" },
              { label: "Default target", value: fmt(stats?.default_target, unit) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 font-medium mb-1">{label}</p>
                <p className="text-xl font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="px-6 pb-6">
            {view === "progress" ? (
              stats?.progress_over_time?.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.progress_over_time} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgb(0 0 0 / 0.08)", fontSize: 12 }}
                        formatter={(v) => [fmt(v, unit), "Avg value"]}
                      />
                      {stats.default_target != null && (
                        <ReferenceLine y={stats.default_target} stroke="#86efac" strokeDasharray="6 3" strokeWidth={2} />
                      )}
                      <Line type="monotone" dataKey="avg" stroke="#1e40af" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} name="Avg participant value" />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-2 justify-center">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="w-6 h-0.5 bg-blue-800 inline-block" /> Avg participant value
                    </span>
                    {stats.default_target != null && (
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="w-6 h-0.5 bg-green-400 inline-block border-dashed border-t-2" /> Target
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-300 text-sm">
                  No data collected yet for this metric.
                </div>
              )
            ) : (
              stats?.distribution?.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distribution} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgb(0 0 0 / 0.08)", fontSize: 12 }}
                        formatter={(v) => [v, "Participants"]}
                      />
                      <Bar dataKey="count" fill="#1e40af" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-300 text-sm">
                  No distribution data available yet.
                </div>
              )
            )}
            {view === "data" && (
              loadingRaw ? (
                <div className="h-56 flex items-center justify-center text-slate-300 text-sm animate-pulse">Loading data…</div>
              ) : rawData?.length > 0 ? (
                <div className="overflow-auto max-h-64 rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Value {unit && `(${unit})`}</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Observed At</th>
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rawData.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{r.value}</td>
                          <td className="px-4 py-2.5 text-slate-500">{r.observed_at}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              r.source === "goal" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                            }`}>
                              {r.source || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-300 text-sm">
                  No data points recorded yet.
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 6;

// ── Main page ──────────────────────────────────────────────────────────────

export default function GoalTemplates() {
  const [templates, setTemplates] = useState([]);
  const [dataElements, setDataElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    element_id: "",
    default_target: 0,
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, elementsData] = await Promise.all([
        api.listGoalTemplates(),
        api.listElements(),
      ]);
      setTemplates(templatesData || []);
      const metricsList = Array.isArray(elementsData) ? elementsData : elementsData.elements || [];
      setDataElements(metricsList);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: "", description: "", element_id: "", default_target: 0 });
    setShowModal(true);
  };

  const openEditModal = (template, e) => {
    e.stopPropagation();
    setEditingId(template.template_id);
    setFormData({
      name: template.name || "",
      description: template.description || "",
      element_id: template.element_id || "",
      default_target: template.default_target || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.element_id) return;
    try {
      if (editingId) {
        await api.updateGoalTemplate(editingId, formData);
        if (selectedTemplate?.template_id === editingId) {
          setSelectedTemplate((prev) => ({ ...prev, ...formData }));
        }
      } else {
        await api.createGoalTemplate(formData);
      }
      setShowModal(false);
      fetchAllData();
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };

  const handleDelete = async (template_id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this goal template?")) return;
    try {
      await api.deleteGoalTemplate(template_id);
      if (selectedTemplate?.template_id === template_id) setSelectedTemplate(null);
      fetchAllData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleCardClick = (t) => {
    setSelectedTemplate((prev) => prev?.template_id === t.template_id ? null : t);
  };

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const elLabel = dataElements.find((el) => el.element_id === t.element_id)?.label || "";
    return t.name.toLowerCase().includes(q) || elLabel.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  if (loading) return (
    <div className="p-10 text-slate-400 animate-pulse text-sm font-medium">Loading…</div>
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Health Goals</h1>
          <p className="text-sm text-slate-500 mt-1">Define goal templates for participants to track</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm text-sm bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
        >
          + Create template
        </button>
      </div>

      {/* Stats panel for selected template */}
      {selectedTemplate ? (
        <StatsPanel
          template={selectedTemplate}
          dataElements={dataElements}
          onClose={() => setSelectedTemplate(null)}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center py-14 gap-3">
          <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-slate-400 font-medium">Select a goal template below to view participant progress and statistics</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center border border-slate-200 rounded-lg p-1.5 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm">
          <span className="pl-2 pr-2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-slate-800 p-1 outline-none bg-transparent placeholder-slate-400"
          />
          <span className="text-xs text-slate-400 font-medium pr-2">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Cards grid */}
      {paginated.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 py-16 text-center text-slate-400 text-sm">
          No templates found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((t) => {
            const isSelected = selectedTemplate?.template_id === t.template_id;
            const element = dataElements.find((el) => el.element_id === t.element_id);
            const unit = element?.unit || t.element?.unit || "";
            return (
              <div
                key={t.template_id}
                onClick={() => handleCardClick(t)}
                className={`bg-white rounded-2xl border p-5 shadow-sm cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:shadow-md hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    t.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => openEditModal(t, e)}
                      className="text-slate-300 hover:text-blue-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(t.template_id, e)}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-800 mb-1">{t.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{t.description}</p>

                <div className="flex items-end justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Metric</p>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">
                      {(element?.label || t.element?.label || "Unknown").replace(/ /g, "\u00A0")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Default target</p>
                    <p className="text-lg font-bold text-blue-500">
                      {fmt(t.default_target, unit)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition shadow-sm"
          >
            ‹ Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 text-sm rounded-lg font-semibold transition shadow-sm ${
                p === page ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            Next ›
          </button>
          <span className="text-xs text-slate-300 ml-1">Page {page} of {totalPages}</span>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {editingId ? "Edit goal template" : "New goal template"}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Goal name</label>
                  <input
                    required
                    type="text"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 transition"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Linked data element</label>
                  <ElementSearchSelect
                    value={formData.element_id}
                    elements={dataElements}
                    onChange={(id) => setFormData({ ...formData, element_id: id })}
                  />
                  {!formData.element_id && (
                    <p className="text-[11px] text-rose-400 mt-1 ml-1">Required</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default target</label>
                  <input
                    required
                    type="number"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 transition"
                    value={formData.default_target}
                    onChange={(e) => setFormData({ ...formData, default_target: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                  <textarea
                    rows="3"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 transition resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition shadow-sm"
                >
                  {editingId ? "Save changes" : "Create goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";
import { SearchDataElementModal } from "../../components/survey/FieldEditor";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────────

const toTitleCase = (str = "") =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

function fmt(val, unit) {
  if (val === null || val === undefined) return "—";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M${unit ? " " + unit : ""}`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K${unit ? " " + unit : ""}`;
  return `${val}${unit ? " " + unit : ""}`;
}


// ── Raw data table ─────────────────────────────────────────────────────────

const RAW_PAGE_SIZE = 8;

function RawDataTable({ rawData, loadingRaw, unit, templateId }) {
  const [rawPage, setRawPage] = useState(1);

  useEffect(() => { setRawPage(1); }, [templateId]);

  if (loadingRaw) {
    return <div className="h-56 flex items-center justify-center text-slate-300 text-sm animate-pulse">Loading data…</div>;
  }
  if (!rawData?.length) {
    return <div className="h-56 flex items-center justify-center text-slate-300 text-sm">No data points recorded yet.</div>;
  }

  const totalRawPages = Math.ceil(rawData.length / RAW_PAGE_SIZE);
  const paginated = rawData.slice((rawPage - 1) * RAW_PAGE_SIZE, rawPage * RAW_PAGE_SIZE);
  const startIdx = (rawPage - 1) * RAW_PAGE_SIZE;

  return (
    <div className="space-y-3">
      {/* Summary line */}
      <p className="text-xs text-slate-400 px-1">
        Showing {startIdx + 1}–{Math.min(startIdx + RAW_PAGE_SIZE, rawData.length)} of {rawData.length} entries
      </p>

      <div className="rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-8">#</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Time</th>
              <th className="px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Value {unit && `(${unit})`}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginated.map((r, i) => {
              const [datePart, timePart] = (r.observed_at || "— —").split(" ");
              return (
                <tr key={r.observed_at ? `${r.observed_at}-${r.value}` : i} className="hover:bg-slate-50 transition">
                  <td className="px-3 py-2.5 text-slate-300 text-xs font-medium">{startIdx + i + 1}</td>
                  <td className="px-3 py-2.5 text-slate-600 font-medium">{datePart}</td>
                  <td className="px-3 py-2.5 text-slate-400">{timePart}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">{r.value} <span className="text-slate-400 font-normal text-xs">{unit}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalRawPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">Page {rawPage} of {totalRawPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRawPage((p) => Math.max(1, p - 1))}
              disabled={rawPage === 1}
              className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              ‹ Prev
            </button>
            {Array.from({ length: totalRawPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setRawPage(p)}
                className={`w-7 h-7 text-xs rounded-lg font-semibold transition ${p === rawPage ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setRawPage((p) => Math.min(totalRawPages, p + 1))}
              disabled={rawPage === totalRawPages}
              className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats panel ────────────────────────────────────────────────────────────

function StatsPanel({ template, dataElements, onClose }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [view, setView] = useState("progress"); // "progress" | "distribution" | "data"
  const [granularity, setGranularity] = useState("month"); // "week" | "month" | "year"
  const [exporting, setExporting] = useState(null); // "summary" | "raw" | null
  const [rawData, setRawData] = useState(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  // Reset raw data when template changes so stale data isn't shown
  useEffect(() => { setRawData(null); }, [template.template_id]);

  const element = dataElements.find((el) => el.element_id === template.element_id);
  const unit = element?.unit || template.element?.unit || "";

  useEffect(() => {
    setLoadingStats(true);
    setStats(null);
    setStatsError(false);
    api.getGoalTemplateStats(template.template_id, granularity)
      .then(setStats)
      .catch(() => setStatsError(true))
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
          <h2 className="text-lg font-bold text-slate-900">{toTitleCase(template.name)}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Metric: {element?.label || template.element?.label || "Unknown"}
            {unit && <> · Unit: {unit}</>}
            {" · "}{template.direction === "at_most" ? "At most" : "At least"} · {template.progress_mode === "absolute" ? "Absolute" : "Incremental"}
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
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
          {/* Export buttons */}
          {(() => {
            const hasData = stats && (
              (stats.progress_over_time?.length > 0) ||
              (stats.distribution?.length > 0) ||
              (stats.avg_current_value != null)
            );
            const exportDisabled = exporting !== null || !hasData;
            const exportTitle = !hasData ? "No data to export yet" : undefined;
            return (
              <div className="flex items-center gap-1 ml-1">
                <button
                  disabled={exportDisabled}
                  title={exportTitle}
                  onClick={async () => {
                    setExporting("summary");
                    try { await api.exportGoalSummary(template.template_id, granularity, template.name); }
                    catch (e) { alert("Export failed: " + e.message); }
                    finally { setExporting(null); }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting === "summary" ? "Exporting…" : "Summary CSV"}
                </button>
                <button
                  disabled={exportDisabled}
                  title={exportTitle}
                  onClick={async () => {
                    setExporting("raw");
                    try { await api.exportGoalRaw(template.template_id, template.name); }
                    catch (e) { alert("Export failed: " + e.message); }
                    finally { setExporting(null); }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {exporting === "raw" ? "Exporting…" : "Raw CSV"}
                </button>
              </div>
            );
          })()}
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
      ) : statsError ? (
        <div className="h-56 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-slate-400">Failed to load stats.</p>
          <button
            disabled={loadingStats}
            onClick={() => {
              if (loadingStats) return;
              setStatsError(false);
              setLoadingStats(true);
              api.getGoalTemplateStats(template.template_id, granularity)
                .then(setStats)
                .catch(() => setStatsError(true))
                .finally(() => setLoadingStats(false));
            }}
            className="text-xs text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
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
                <p className="text-xl font-bold text-slate-900">{value}</p>
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
                        <ReferenceLine y={stats.default_target} stroke="#86efac" strokeDasharray="6 3" strokeWidth={2}
                          label={{ value: template.direction === "at_most" ? "Target (at most)" : "Target (at least)", position: "insideBottomLeft", fontSize: 10, fill: "#4ade80", fontWeight: 600, dy: -4 }}
                        />
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
                        <span className="w-6 h-0.5 bg-green-400 inline-block border-dashed border-t-2" />
                        Target ({template.direction === "at_most" ? "at most" : "at least"})
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-56 flex items-center justify-center text-slate-300 text-sm">
                  No data collected yet for this metric.
                </div>
              )
            ) : view === "distribution" ? (
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
            ) : (
              <RawDataTable rawData={rawData} loadingRaw={loadingRaw} unit={unit} target={stats?.default_target} templateId={template.template_id} />
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

function GoalTemplateSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 w-14 bg-slate-100 rounded-full" />
        <div className="flex gap-1.5">
          <div className="w-6 h-6 bg-slate-100 rounded-lg" />
          <div className="w-6 h-6 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="h-4 w-3/4 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-full bg-slate-50 rounded mb-1" />
      <div className="h-3 w-2/3 bg-slate-50 rounded mb-4" />
      <div className="flex justify-between pt-3 border-t border-slate-100">
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-6 w-16 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export default function GoalTemplates() {
  const [templates, setTemplates] = useState([]);
  const [deletedTemplates, setDeletedTemplates] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [dataElements, setDataElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCreateElement, setShowCreateElement] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    element_id: "",
    default_target: 0,
    progress_mode: "incremental",
    direction: "at_least",
  });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesData, elementsData, deletedData] = await Promise.all([
        api.listGoalTemplates(),
        api.listElements(),
        api.listDeletedGoalTemplates(),
      ]);
      setTemplates(templatesData || []);
      setDeletedTemplates(deletedData || []);
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
    setFormData({
      name: "",
      description: "",
      element_id: "",
      default_target: 0,
      progress_mode: "incremental",
      direction: "at_least",
    });
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
      progress_mode: template.progress_mode || "incremental",
      direction: template.direction || "at_least",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.element_id) {
      showToast("Please select a data element before saving.");
      return;
    }
    try {
      if (editingId) {
        await api.updateGoalTemplate(editingId, formData);
        if (selectedTemplate?.template_id === editingId) {
          setSelectedTemplate((prev) => prev ? ({ ...prev, ...formData }) : null);
        }
        showToast("Changes saved successfully");
      } else {
        await api.createGoalTemplate(formData);
        showToast("Goal template created");
      }
      setShowModal(false);
      fetchAllData();
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteGoalTemplate(deleteTarget.template_id);
      if (selectedTemplate?.template_id === deleteTarget.template_id) setSelectedTemplate(null);
      setDeleteTarget(null);
      fetchAllData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleRestore = async (template_id) => {
    try {
      await api.restoreGoalTemplate(template_id);
      fetchAllData();
    } catch (err) {
      alert("Restore failed: " + err.message);
    }
  };

  const handleCardClick = (t) => {
    setSelectedTemplate((prev) => prev?.template_id === t.template_id ? null : t);
  };

  const filtered = (showDeleted ? deletedTemplates : templates).filter((t) => {
    const q = search.toLowerCase();
    const elLabel = showDeleted
      ? (t.element?.label || "Unknown")
      : (dataElements.find((el) => el.element_id === t.element_id)?.label || "Unknown");
    return t.name.toLowerCase().includes(q) || elLabel.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sort === "alpha") return (a.name || "").localeCompare(b.name || "");
    if (sort === "modified") {
      const ta = a.modified_at ? new Date(a.modified_at).getTime() : 0;
      const tb = b.modified_at ? new Date(b.modified_at).getTime() : 0;
      return tb - ta;
    }
    // newest (default)
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, showDeleted, sort]);

  return (
    <div className="w-full space-y-6">
      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">How Health Goals Work</h2>
                  <p className="text-xs text-slate-500 mt-0.5">A quick guide for researchers</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm text-slate-600">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</span>
                <div>
                  <p className="font-semibold text-slate-800">Create a goal template</p>
                  <p className="text-slate-500 text-xs mt-0.5">A template defines a measurable metric (e.g. daily steps, sleep hours) linked to a data element and a default target value. Participants then adopt the goal and set their own personal target.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</span>
                <div>
                  <p className="font-semibold text-slate-800">Participants track progress</p>
                  <p className="text-slate-500 text-xs mt-0.5">Once a participant activates a goal, their survey responses that map to the same data element are automatically recorded as progress entries.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</span>
                <div>
                  <p className="font-semibold text-slate-800">Click a card to view stats</p>
                  <p className="text-slate-500 text-xs mt-0.5">Select any goal template card to open the stats panel. You can view progress over time, value distribution across participants, and the raw data log.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
                <div>
                  <p className="font-semibold text-slate-800">Deleting a template</p>
                  <p className="text-slate-500 text-xs mt-0.5">Deleting a template does not erase participant data. All recorded values are preserved and the template can be restored from the Deleted tab at any time.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowHelp(false)} className="w-full py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Goals</h1>
          <p className="text-sm text-slate-500 mt-1">Define goal templates for participants to track</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition"
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">?</span>
            How it works
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
          >
            + Create template
          </button>
        </div>
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

      {/* Search + Sort + Active/Deleted toggle */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
        <div className="flex-1 flex items-center border border-slate-200 rounded-xl p-1.5 bg-white focus-within:border-slate-400 transition-all">
          <span className="pl-2 pr-2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder={showDeleted ? "Search deleted templates..." : "Search templates..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-slate-800 p-1 outline-none bg-transparent placeholder-slate-400"
          />
          <span className="text-xs text-slate-400 font-medium pr-2">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Sort */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 shrink-0">
          {[{ key: "newest", label: "Newest" }, { key: "modified", label: "Modified" }, { key: "alpha", label: "A → Z" }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                sort === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active / Deleted toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1 shrink-0">
          <button
            onClick={() => { setShowDeleted(false); setSearch(""); setSelectedTemplate(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              !showDeleted ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => { setShowDeleted(true); setSearch(""); setSelectedTemplate(null); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              showDeleted ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Deleted
            {deletedTemplates.length > 0 && (
              <span className="text-[10px] font-bold bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full leading-none">
                {deletedTemplates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <GoalTemplateSkeleton key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 py-16 text-center text-slate-400 text-sm">
          {showDeleted ? "No deleted templates." : "No templates found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((t) => {
            const isSelected = selectedTemplate?.template_id === t.template_id;
            const element = dataElements.find((el) => el.element_id === t.element_id);
            const unit = element?.unit || t.element?.unit || "";
            const elLabel = element?.label || t.element?.label || "Unknown";

            if (showDeleted) {
              return (
                <div
                  key={t.template_id}
                  onClick={() => setSelectedTemplate(isSelected ? null : t)}
                  className={`bg-white/80 rounded-2xl border border-dashed p-5 shadow-sm cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-slate-300 hover:shadow-md hover:border-slate-400"
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-rose-50 text-rose-400">
                      Deleted
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRestore(t.template_id); }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition"
                    >
                      Restore
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-600 mb-1">{toTitleCase(t.name)}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{t.description}</p>

                  <div className="flex gap-1.5 mb-4">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                      {t.direction === "at_most" ? "At most" : "At least"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                      {t.progress_mode === "absolute" ? "Absolute" : "Incremental"}
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Metric</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {elLabel.replace(/ /g, "\u00A0")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Default target</p>
                      <p className="text-lg font-bold text-slate-400">
                        {fmt(t.default_target, unit)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

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
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                    Active
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
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1">{toTitleCase(t.name)}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{t.description}</p>

                <div className="flex gap-1.5 mb-4">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {t.direction === "at_most" ? "At most" : "At least"}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {t.progress_mode === "absolute" ? "Absolute" : "Incremental"}
                  </span>
                </div>

                <div className="flex items-end justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Metric</p>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">
                      {elLabel.replace(/ /g, "\u00A0")}
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

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-900">Delete goal template?</h2>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                You're about to delete <span className="font-semibold text-slate-700">"{toTitleCase(deleteTarget.name)}"</span>.
              </p>
            </div>

            <div className="px-6 py-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">What happens</p>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <p className="text-sm text-slate-600">All collected data points are <span className="font-semibold">preserved</span> — nothing is lost.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <p className="text-sm text-slate-600">The template can be <span className="font-semibold">restored</span> at any time from the Deleted tab.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                <p className="text-sm text-slate-600">Participants will no longer see this goal on their dashboard.</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition shadow-sm"
              >
                Delete template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${editingId ? "bg-blue-50" : "bg-slate-100"}`}>
                <svg className={`w-4 h-4 ${editingId ? "text-blue-500" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {editingId
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  }
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId ? "Edit goal template" : "New goal template"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingId ? "Update the name, target, or description" : "Define a new goal for participants to track"}
                </p>
                <p className="text-[10px] font-black uppercase text-slate-400 mt-2">
                  Behavior:{" "}
                  <span className="text-slate-600">
                    {formData.progress_mode || "incremental"} · {formData.direction || "at_least"}
                  </span>
                </p>
                <p className="text-[10px] font-black uppercase text-slate-400 mt-2">
                  Behavior:{" "}
                  <span className="text-slate-600">
                    {t.progress_mode || "incremental"} · {t.direction || "at_least"}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-4">

                {/* Goal name */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Goal name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Daily Step Goal"
                    className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition placeholder-slate-300"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Linked data element */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Linked data element</label>
                  {editingId ? (
                    <div className="mt-1.5 flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50">
                      <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-sm text-slate-500 flex-1">
                        {dataElements.find((el) => el.element_id === formData.element_id)?.label || "—"}
                      </span>
                      <span className="text-[11px] text-slate-300 font-medium">locked</span>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => setShowCreateElement(true)}
                        className={`mt-1.5 flex items-center justify-between px-3 py-2.5 border rounded-xl text-sm cursor-pointer transition ${
                          formData.element_id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate">
                          {dataElements.find((el) => el.element_id === formData.element_id)?.label || "Select a data element…"}
                        </span>
                        <svg className="w-4 h-4 shrink-0 ml-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {!formData.element_id && (
                        <p className="text-[11px] text-rose-400 mt-1 ml-1">Required — select a metric to track</p>
                      )}
                    </>
                  )}
                </div>

                {/* Default target */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default target</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 10000"
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition placeholder-slate-300"
                      value={formData.default_target === 0 ? "" : formData.default_target}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setFormData({ ...formData, default_target: val === "" ? 0 : parseInt(val) });
                      }}
                    />
                    {(() => {
                      const unit = dataElements.find((el) => el.element_id === formData.element_id)?.unit;
                      return unit ? (
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-2.5 rounded-xl shrink-0">{unit}</span>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Direction + Progress Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Direction</label>
                    <select
                      className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
                      value={formData.direction}
                      onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    >
                      <option value="at_least">At least</option>
                      <option value="at_most">At most</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress mode</label>
                    <select
                      className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
                      value={formData.progress_mode}
                      onChange={(e) => setFormData({ ...formData, progress_mode: e.target.value })}
                    >
                      <option value="incremental">Incremental</option>
                      <option value="absolute">Absolute</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description <span className="text-slate-300 normal-case font-normal">(optional)</span></label>
                  <textarea
                    rows="3"
                    placeholder="Describe what this goal is tracking and why..."
                    className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition resize-none placeholder-slate-300"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

<<<<<<< HEAD
              <div className="px-6 pb-5 flex gap-3 justify-end">
=======
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Default Target
                </label>
                <input
                  required
                  type="number"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm"
                  value={formData.default_target}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_target: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                    Direction
                  </label>
                  <select
                    className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400"
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  >
                    <option value="at_least">At least</option>
                    <option value="at_most">At most</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Progress Mode
                </label>
                <select
                  className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400"
                  value={formData.progress_mode}
                  onChange={(e) => setFormData({ ...formData, progress_mode: e.target.value })}
                >
                  <option value="incremental">Incremental</option>
                  <option value="absolute">Absolute</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
>>>>>>> origin/developer
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition shadow-sm bg-blue-700 hover:bg-blue-800"
                >
                  {editingId ? "Save changes" : "Create goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Data element search modal — z-[60] to sit above create/edit modal */}
      {showCreateElement && (
        <SearchDataElementModal
          value={formData.element_id}
          dataElements={dataElements}
          onChange={(id) => { setFormData((prev) => ({ ...prev, element_id: id })); setShowCreateElement(false); }}
          onCreated={(newElement) => { setDataElements((prev) => [...prev, newElement]); }}
          onClose={() => setShowCreateElement(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}

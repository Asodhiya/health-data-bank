import { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const toTitleCase = (str = "") =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const normalizeType = (dt = "") => {
  const d = dt.toLowerCase();
  if (d === "boolean" || d === "bool") return "boolean";
  if (d === "text" || d === "string") return "text";
  if (d === "date") return "date";
  return "number";
};

const typeLabel = (dt) => {
  const t = normalizeType(dt);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TYPE_FILTERS = ["All", "Number", "Boolean", "Text", "Date"];

// ── Component ─────────────────────────────────────────────────────────────────

const DataElementManager = () => {
  const [elements, setElements]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [mappingFilter, setMappingFilter] = useState("All"); // "All" | "Mapped" | "Unmapped"
  const [sort, setSort] = useState("newest"); // "newest" | "alpha"
  const [surveyCountMap, setSurveyCountMap] = useState({});
  const [elementLinksMap, setElementLinksMap] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newEl, setNewEl]           = useState({ code: "", name: "", datatype: "number", unit: "", description: "" });
  const [creating, setCreating]     = useState(false);

  // Detail drawer
  const [selectedEl, setSelectedEl] = useState(null);

  // Info banner
  const [showInfo, setShowInfo] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Initial load error
  const [loadError, setLoadError] = useState(false);

  // Mapping load error
  const [mappingError, setMappingError] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // element object to delete
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { loadData(); }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const els = await api.listElements();
      setElements(els || []);
      await buildSurveyCounts();
    } catch (err) {
      console.error("Load error:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const buildSurveyCounts = async () => {
    try {
      const mappings = await api.getAllMappings();
      const countMap = {};
      const linksMap = {};
      (mappings || []).forEach(({ element_id, field_id, field_label, form_id, form_title, form_status, form_version }) => {
        if (!countMap[element_id]) countMap[element_id] = new Set();
        countMap[element_id].add(form_id);
        if (!linksMap[element_id]) linksMap[element_id] = [];
        linksMap[element_id].push({ form_id, form_title, form_status, form_version, field_id, field_label });
      });
      setSurveyCountMap(
        Object.fromEntries(Object.entries(countMap).map(([k, v]) => [k, v.size]))
      );
      setElementLinksMap(linksMap);
      setMappingError(false);
    } catch (err) {
      console.error("Survey count error:", err);
      setMappingError(true);
    }
  };

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return elements.filter((el) => {
      const id = el.element_id || el.id;
      const isMapped = (surveyCountMap[id] || 0) > 0;
      const matchSearch =
        !q ||
        (el.label || "").toLowerCase().includes(q) ||
        (el.code || "").toLowerCase().includes(q);
      const matchType =
        typeFilter === "All" ||
        normalizeType(el.datatype) === typeFilter.toLowerCase();
      const matchMapping =
        mappingFilter === "All" ||
        (mappingFilter === "Mapped" && isMapped) ||
        (mappingFilter === "Unmapped" && !isMapped);
      return matchSearch && matchType && matchMapping;
    }).sort((a, b) => {
      if (sort === "alpha") return (a.label || a.name || "").localeCompare(b.label || b.name || "");
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [elements, search, typeFilter, mappingFilter, surveyCountMap, sort]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createDataElement({
        code: newEl.code.trim().toLowerCase(),
        label: newEl.name.trim(),
        datatype: newEl.datatype,
        unit: newEl.unit.trim() || null,
        description: newEl.description.trim() || null,
      });
      setElements((p) => [...p, res]);
      setNewEl({ code: "", name: "", datatype: "number", unit: "", description: "" });
      setShowCreate(false);
    } catch (err) {
      alert(err.message || "Code already exists.");
    } finally {
      setCreating(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = (el) => setDeleteTarget(el);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.element_id || deleteTarget.id;
    setDeleting(true);
    try {
      await api.deleteElement(id);
      setElements((p) => p.filter((el) => (el.element_id || el.id) !== id));
      if (selectedEl && (selectedEl.element_id || selectedEl.id) === id)
        setSelectedEl(null);
      setDeleteTarget(null);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">How Data Elements Work</h2>
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
                  <p className="font-semibold text-slate-800">What is a data element?</p>
                  <p className="text-slate-500 text-xs mt-0.5">A data element is a standardised variable (e.g. <span className="font-mono bg-slate-100 px-1 rounded">blood_pressure</span>, <span className="font-mono bg-slate-100 px-1 rounded">sleep_hours</span>) that acts as the common language across the system. Every survey question must be mapped to one.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</span>
                <div>
                  <p className="font-semibold text-slate-800">Mapped vs Unmapped</p>
                  <p className="text-slate-500 text-xs mt-0.5">A <span className="font-semibold text-emerald-700">Mapped</span> element is linked to at least one survey question. An <span className="font-semibold text-slate-600">Unmapped</span> element exists but isn't collecting data yet — assign it to a survey question in the Survey Builder.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</span>
                <div>
                  <p className="font-semibold text-slate-800">Click a row to inspect</p>
                  <p className="text-slate-500 text-xs mt-0.5">Clicking any row opens a detail panel showing the element's type, unit, description, and every survey it is currently linked to.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">!</span>
                <div>
                  <p className="font-semibold text-slate-800">Deleting an element</p>
                  <p className="text-slate-500 text-xs mt-0.5">If an element is mapped to a published survey or health goal, it is deactivated rather than permanently deleted — all collected data is preserved.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowHelp(false)} className="w-full py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="px-6 pt-8 pb-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Elements</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Browse and manage your standardized metrics library
            </p>
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
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
            >
              + Add Element
            </button>
          </div>
        </div>

        {/* Info banner */}
        {showInfo && (
          <div className="relative bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-5">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-blue-300 hover:text-blue-500 text-sm font-bold leading-none"
            >
              ✕
            </button>
            <div className="flex gap-3">
              <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-blue-900 mb-1">What are data elements?</p>
                <p className="text-sm text-blue-800 leading-relaxed">
                  A data element is a standardized variable (e.g. <span className="font-semibold">"blood_pressure"</span>, <span className="font-semibold">"sleep_hours"</span>) that acts as the
                  common language across the system. Every survey question in the <span className="font-semibold">Survey Builder</span> must be
                  mapped to a data element so responses can be tracked over time. Data elements also power{" "}
                  <span className="font-semibold text-blue-700">Health Goals</span> — participants set targets against them.
                </p>
                <p className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
                  If a data element is in use (mapped to a survey or health goal), deleting it will deactivate it instead of removing it permanently. Deactivated elements disappear from this list and cannot be newly mapped, but existing data is preserved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mapping error warning */}
        {mappingError && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-sm text-amber-800">
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>Could not load survey mappings. Mapped/Unmapped counts may be inaccurate.</span>
            <button onClick={buildSurveyCounts} className="ml-auto text-xs font-semibold text-amber-700 hover:underline shrink-0">Retry</button>
          </div>
        )}

        {/* Stats row */}
        {(() => {
          const total = elements.length;
          const mapped = elements.filter((el) => surveyCountMap[el.element_id || el.id] > 0).length;
          const unmapped = total - mapped;
          return (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Total elements</p>
                <p className="text-2xl font-bold text-slate-900">{total}</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Mapped</p>
                <p className="text-2xl font-bold text-slate-900">{mapped}</p>
              </div>
              <div className="bg-slate-100 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Unmapped</p>
                <p className="text-2xl font-bold text-slate-500">{unmapped}</p>
              </div>
            </div>
          );
        })()}

        {/* Search */}
        <input
          placeholder="Search by code or name..."
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 bg-white mb-4"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3 border border-slate-200 rounded-full px-3 py-2 w-fit">
          {/* Type group */}
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Type</span>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                typeFilter === t
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Status group */}
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Status</span>
          {[
            { key: "All",      label: "All" },
            { key: "Mapped",   label: "Mapped" },
            { key: "Unmapped", label: "Unmapped" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMappingFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                mappingFilter === key
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pb-2">
          <p className="text-sm text-slate-400">{filtered.length} elements</p>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>Sort:</span>
            {[{ key: "newest", label: "Newest" }, { key: "alpha", label: "A → Z" }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  sort === key ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Element table ── */}
      <div className="px-6 pb-10">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading…</div>
        ) : loadError ? (
          <div className="py-20 text-center text-sm">
            <p className="text-slate-400">Failed to load data elements.</p>
            <button onClick={loadData} className="mt-2 text-xs text-blue-500 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-300 text-sm">No elements found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide rounded-l-lg">Label</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Datatype</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Unit</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide rounded-r-lg"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((el) => {
                const id = el.element_id || el.id;
                const count = surveyCountMap[id] || 0;
                const isMapped = count > 0;

                return (
                  <tr
                    key={id}
                    onClick={() => setSelectedEl(el)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {toTitleCase(el.label || el.name)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block font-mono text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-full">
                        {el.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {normalizeType(el.datatype)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {el.unit || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {isMapped && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                            {count} {count === 1 ? "survey" : "surveys"}
                          </span>
                        )}
                        <svg
                          className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add data element</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Define a new standardized variable that survey questions can be mapped to.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="border border-slate-200 rounded-lg w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition shrink-0 ml-4"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col overflow-hidden">
              <div className="px-7 space-y-5 overflow-y-auto">

                {/* Code */}
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                    Code <span className="text-red-400 text-xs font-semibold">required</span>
                  </label>
                  <input
                    placeholder="e.g. blood_pressure"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                    value={newEl.code}
                    onChange={(e) => setNewEl({ ...newEl, code: e.target.value })}
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    A unique machine-readable identifier. Use{" "}
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">snake_case</code>
                    , no spaces or special characters. Once saved, this cannot be changed.
                  </p>
                </div>

                {/* Label */}
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                    Label <span className="text-red-400 text-xs font-semibold">required</span>
                  </label>
                  <input
                    placeholder="e.g. Blood Pressure"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                    value={newEl.name}
                    onChange={(e) => setNewEl({ ...newEl, name: e.target.value })}
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    A human-readable name shown to researchers and participants in the UI.
                  </p>
                </div>

                {/* Data type + Unit */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                      Data type <span className="text-red-400 text-xs font-semibold">required</span>
                    </label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white"
                      value={newEl.datatype}
                      onChange={(e) => setNewEl({ ...newEl, datatype: e.target.value })}
                    >
                      <option value="number">Number</option>
                      <option value="string">Text</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {newEl.datatype === "number" && "Numeric values — use for measurements, counts, or scores."}
                      {newEl.datatype === "string" && "Free-text values — use for open-ended responses."}
                      {newEl.datatype === "boolean" && "Yes/No values — use for binary questions."}
                      {newEl.datatype === "date" && "Date values — use for timestamps or date entries."}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                      Unit <span className="text-slate-400 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      placeholder="e.g. mmHg, hrs, kg"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                      value={newEl.unit}
                      onChange={(e) => setNewEl({ ...newEl, unit: e.target.value })}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      The unit of measurement displayed alongside values.
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                    Description <span className="text-slate-400 text-xs font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Describe what this element measures and any collection notes for researchers…"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none resize-none h-24 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                    value={newEl.description}
                    onChange={(e) => setNewEl({ ...newEl, description: e.target.value })}
                  />
                </div>

                {/* Info box */}
                <div className="flex gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    If this element is later mapped to a survey or health goal, deleting it will deactivate it rather than permanently remove it.
                    Make sure the code and type are correct before saving.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 mt-6 px-7 py-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 border border-slate-900 bg-white rounded-xl text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {creating ? "Adding…" : "Add element"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Element detail drawer ── */}
      {selectedEl && (
        <div className="fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div className="flex-1 bg-black/20" onClick={() => setSelectedEl(null)} />

          {/* panel */}
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">

            {/* Drawer header */}
            <div className="px-6 py-5 border-b flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase shrink-0 bg-blue-100 text-blue-700"
                >
                  {selectedEl.code}
                </span>
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {toTitleCase(selectedEl.label || selectedEl.name)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {typeLabel(selectedEl.datatype)}
                    {selectedEl.unit ? ` · ${selectedEl.unit}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDelete(selectedEl)}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 hover:bg-red-50 rounded transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedEl(null)}
                  className="text-slate-400 hover:text-slate-600 transition ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Overview ── */}
            {(() => {
              const elId = selectedEl.element_id || selectedEl.id;
              const links = elementLinksMap[elId] || [];
              const byForm = {};
              links.forEach(({ form_id, form_title, form_status, form_version, field_label }) => {
                if (!byForm[form_id]) byForm[form_id] = { form_title, form_status, form_version, fields: [] };
                byForm[form_id].fields.push(field_label);
              });
              const surveyCount = Object.keys(byForm).length;

              return (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                  {/* Details */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Details
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Type</p>
                        <p className="text-sm font-semibold text-slate-800">{typeLabel(selectedEl.datatype)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Unit</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedEl.unit || "—"}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Code</p>
                        <p className="text-sm font-semibold font-mono text-slate-800">{selectedEl.code}</p>
                      </div>
                      {selectedEl.created_at && (
                        <div className="bg-slate-50 rounded-xl px-4 py-3">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Created</p>
                          <p className="text-sm font-semibold text-slate-800">
                            {new Date(selectedEl.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedEl.description && (
                      <div className="mt-3 bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Description</p>
                        <p className="text-sm text-slate-600">{selectedEl.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Linked surveys */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Linked Surveys
                      {surveyCount > 0 && (
                        <span className="ml-2 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {surveyCount}
                        </span>
                      )}
                    </p>
                    {surveyCount === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                        <p className="text-sm text-slate-400">Not linked to any surveys yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(byForm).map(([fid, { form_title, form_status, form_version, fields }]) => {
                          const published = form_status === "PUBLISHED";
                          const archived = form_status === "ARCHIVED";
                          const cardStyle = published
                            ? "border-emerald-100 bg-emerald-50"
                            : archived
                            ? "border-slate-200 bg-slate-50"
                            : "border-orange-100 bg-orange-50";
                          const titleStyle = published
                            ? "text-emerald-900"
                            : archived
                            ? "text-slate-700"
                            : "text-orange-900";
                          const fieldStyle = published
                            ? "text-emerald-700 border-emerald-200"
                            : archived
                            ? "text-slate-600 border-slate-200"
                            : "text-orange-700 border-orange-200";
                          const badgeStyle = published
                            ? "bg-emerald-200 text-emerald-700"
                            : archived
                            ? "bg-slate-200 text-slate-600"
                            : "bg-orange-200 text-orange-700";
                          return (
                            <div
                              key={fid}
                              className={`rounded-xl border px-4 py-3 ${cardStyle}`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <p className={`text-sm font-semibold ${titleStyle}`}>
                                  {form_title}
                                  {form_version > 1 && (
                                    <span className="ml-1 font-normal text-xs opacity-60">v{form_version}</span>
                                  )}
                                </p>
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badgeStyle}`}>
                                  {form_status === "PUBLISHED" ? "Published" : form_status === "ARCHIVED" ? "Archived" : "Draft"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {fields.map((fl, idx) => (
                                  <span
                                    key={idx}
                                    className={`text-[11px] bg-white border px-2.5 py-0.5 rounded-full font-medium ${fieldStyle}`}
                                  >
                                    {fl}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Delete <span className="font-mono">{deleteTarget.code}</span>?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{toTitleCase(deleteTarget.label)}</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[10px]">!</span>
                  <span>This element will be removed from the list and can no longer be mapped to new survey fields.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-[10px]">!</span>
                  <span>Any <strong>draft</strong> survey fields mapped to this element will be unlinked automatically.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[10px]">✓</span>
                  <span>Published surveys and all collected health data remain intact.</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataElementManager;
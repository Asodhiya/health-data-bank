import { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const normalizeType = (dt = "") => {
  const d = dt.toLowerCase();
  if (d === "boolean" || d === "bool") return "boolean";
  if (d === "text" || d === "string") return "text";
  if (d === "date") return "date";
  return "number";
};

const supportsUnit = (dt = "") => normalizeType(dt) === "number";

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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // element object to delete
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => { loadData(); }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const els = await api.listElements();
      setElements(els || []);
      buildSurveyCounts();
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildSurveyCounts = async () => {
    try {
      const mappings = await api.getAllMappings();
      const countMap = {};
      const linksMap = {};
      (mappings || []).forEach(({ element_id, field_id, field_label, form_id, form_title, form_status }) => {
        if (!countMap[element_id]) countMap[element_id] = new Set();
        countMap[element_id].add(form_id);
        if (!linksMap[element_id]) linksMap[element_id] = [];
        linksMap[element_id].push({ form_id, form_title, form_status, field_id, field_label });
      });
      setSurveyCountMap(
        Object.fromEntries(Object.entries(countMap).map(([k, v]) => [k, v.size]))
      );
      setElementLinksMap(linksMap);
    } catch (err) {
      console.error("Survey count error:", err);
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
      return new Date(b.created_at) - new Date(a.created_at);
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
        unit: supportsUnit(newEl.datatype) ? newEl.unit.trim() || null : null,
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

      {/* ── Page header ── */}
      <div className="px-6 pt-8 pb-2">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Elements</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Browse and manage your standardized metrics library
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 transition"
          >
            + Add Element
          </button>
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
                  Once a data element is mapped to a survey question or health goal, it cannot be deleted.
                </p>
              </div>
            </div>
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
                      {el.label || el.name}
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
                      onChange={(e) =>
                        setNewEl((prev) => ({
                          ...prev,
                          datatype: e.target.value,
                          unit: supportsUnit(e.target.value) ? prev.unit : "",
                        }))
                      }
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
                      disabled={!supportsUnit(newEl.datatype)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                      value={newEl.unit}
                      onChange={(e) => setNewEl({ ...newEl, unit: e.target.value })}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      {supportsUnit(newEl.datatype)
                        ? "The unit of measurement displayed alongside numeric values."
                        : "Units are only used for numeric data elements."}
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
                    Once a data element is mapped to a survey question or health goal, it cannot be deleted.
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
                    {selectedEl.label || selectedEl.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {typeLabel(selectedEl.datatype)}
                    {selectedEl.unit ? ` · ${selectedEl.unit}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(() => {
                  const elId = selectedEl.element_id || selectedEl.id;
                  const linkedToPublished = (elementLinksMap[elId] || []).some(
                    (l) => l.form_status === "PUBLISHED"
                  );
                  return linkedToPublished ? (
                    <span
                      title="Cannot delete: linked to a published survey"
                      className="text-xs text-slate-300 font-semibold px-2 py-1 cursor-not-allowed select-none"
                    >
                      Delete
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(selectedEl)}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 hover:bg-red-50 rounded transition"
                    >
                      Delete
                    </button>
                  );
                })()}
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
              links.forEach(({ form_id, form_title, form_status, field_label }) => {
                if (!byForm[form_id]) byForm[form_id] = { form_title, form_status, fields: [] };
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
                        {Object.entries(byForm).map(([fid, { form_title, form_status, fields }]) => {
                          const published = form_status === "PUBLISHED";
                          return (
                            <div
                              key={fid}
                              className={`rounded-xl border px-4 py-3 ${
                                published
                                  ? "border-emerald-100 bg-emerald-50"
                                  : "border-orange-100 bg-orange-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <p className={`text-sm font-semibold ${published ? "text-emerald-900" : "text-orange-900"}`}>
                                  {form_title}
                                </p>
                                {!published && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">
                                    Draft
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {fields.map((fl, idx) => (
                                  <span
                                    key={idx}
                                    className={`text-[11px] bg-white border px-2.5 py-0.5 rounded-full font-medium ${
                                      published
                                        ? "text-emerald-700 border-emerald-200"
                                        : "text-orange-700 border-orange-200"
                                    }`}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-red-50 mx-auto mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-900 text-center mb-1">Delete element?</p>
            <p className="text-sm text-slate-500 text-center mb-1">
              <span className="font-mono font-semibold text-slate-700">{deleteTarget.code}</span>
            </p>
            <p className="text-xs text-slate-400 text-center mb-6">
              This will permanently remove the element and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
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

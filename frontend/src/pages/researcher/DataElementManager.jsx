import { useState, useEffect, useMemo } from "react";
import { api } from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiErrors";

// ── Helpers ──────────────────────────────────────────────────────────────────

const toTitleCase = (str = "") =>
  str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const normalizeType = (dt = "") => {
  const d = dt.toLowerCase();
  if (d === "boolean" || d === "bool") return "boolean";
  if (d === "text" || d === "string") return "text";
  if (d === "date") return "date";
  if (d === "integer" || d === "int") return "integer";
  if (["number", "float", "double", "decimal", "numeric"].includes(d)) return "float";
  return "float";
};

const supportsUnit = (dt = "") => ["integer", "float"].includes(normalizeType(dt));

const typeLabel = (dt) => {
  const t = normalizeType(dt);
  if (t === "integer") return "Integer";
  if (t === "float") return "Float";
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TYPE_FILTERS = ["All", "Integer", "Float", "Boolean", "Text", "Date"];

// ── Component ─────────────────────────────────────────────────────────────────

const DataElementManager = () => {
  const [elements, setElements]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");
  const [mappingFilter, setMappingFilter] = useState("All"); // "All" | "Mapped" | "Unmapped"
  const [sort, setSort] = useState("newest"); // "newest" | "alpha"
  const [surveyCountMap, setSurveyCountMap] = useState({});
  const [elementLinksMap, setElementLinksMap] = useState({});
  const [goalCountMap, setGoalCountMap] = useState({});
  const [goalLinksMap, setGoalLinksMap] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newEl, setNewEl]           = useState({ code: "", name: "", datatype: "float", unit: "", description: "" });
  const [creating, setCreating]     = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [editEl, setEditEl]         = useState({ id: "", name: "", datatype: "integer", unit: "", description: "" });
  const [updating, setUpdating]     = useState(false);

  // Detail drawer
  const [selectedEl, setSelectedEl] = useState(null);

  // Info banner
  const [showInfo, setShowInfo] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Initial load error
  const [loadError, setLoadError] = useState(false);

  // Mapping load error
  const [mappingError, setMappingError] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // element object to delete
  const [deleting, setDeleting]         = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => { buildSurveyCounts(); }, []);
  useEffect(() => { setPage(1); }, [search, showDeleted, typeFilter, mappingFilter, sort]);
  useEffect(() => { loadData(); }, [page, search, showDeleted, typeFilter, mappingFilter, sort]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await api.listElementsPaged({
        deleted: showDeleted,
        page,
        pageSize: PAGE_SIZE,
        search,
        typeFilter,
        mappingFilter,
        sort,
      });
      setElements(response?.items || []);
      setTotalCount(Number(response?.total_count || 0));
      setTotalPages(Math.max(1, Number(response?.total_pages || 1)));
    } catch (err) {
      console.error("Load error:", err);
      setLoadError(true);
      setElements([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const buildSurveyCounts = async () => {
    setElementLinksMap({});
    setGoalLinksMap({});
    setMappingError("");
    try {
      const [mappingsResult, templatesResult] = await Promise.allSettled([
        api.getAllMappings(),
        api.listGoalTemplates(),
      ]);

      if (mappingsResult.status === "fulfilled") {
        const mappings = mappingsResult.value || [];
        const countMap = {};
        const linksMap = {};
        mappings.forEach(({ element_id, field_id, field_label, form_id, form_title, form_status, form_version }) => {
          if (!countMap[element_id]) countMap[element_id] = new Set();
          countMap[element_id].add(form_id);
          if (!linksMap[element_id]) linksMap[element_id] = [];
          linksMap[element_id].push({ form_id, form_title, form_status, form_version, field_id, field_label });
        });
        setSurveyCountMap(Object.fromEntries(Object.entries(countMap).map(([k, v]) => [k, v.size])));
        setElementLinksMap(linksMap);
      }

      if (templatesResult.status === "fulfilled") {
        const templates = templatesResult.value || [];
        const gCountMap = {};
        const gLinksMap = {};
        templates.forEach((t) => {
          if (!t.element_id) return;
          gCountMap[t.element_id] = (gCountMap[t.element_id] || 0) + 1;
          if (!gLinksMap[t.element_id]) gLinksMap[t.element_id] = [];
          gLinksMap[t.element_id].push({ template_id: t.template_id, name: t.name });
        });
        setGoalCountMap(gCountMap);
        setGoalLinksMap(gLinksMap);
      }

      const failedSources = [];
      if (mappingsResult.status === "rejected") failedSources.push("survey mappings");
      if (templatesResult.status === "rejected") failedSources.push("goal template links");

      setMappingError(
        failedSources.length
          ? `Could not load ${failedSources.join(" and ")}. Mapped/Unmapped counts may be inaccurate.`
          : ""
      );
    } catch (err) {
      console.error("Survey count error:", err);
      setMappingError("Could not load data element linkage counts. Mapped/Unmapped counts may be inaccurate.");
    }
  };

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return elements.filter((el) => {
      const id = el.element_id || el.id;
      return el && id;
    });
  }, [elements]);

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
      setNewEl({ code: "", name: "", datatype: "float", unit: "", description: "" });
      setShowCreate(false);
      setPage(1);
      await loadData();
    } catch (err) {
      alert(getApiErrorMessage(err, "Code already exists."));
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
      if (selectedEl && (selectedEl.element_id || selectedEl.id) === id)
        setSelectedEl(null);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      alert(`Delete failed: ${getApiErrorMessage(err, "Unknown error")}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (el) => {
    const id = el.element_id || el.id;
    setRestoringId(id);
    try {
      const restored = await api.restoreElement(id);
      if (selectedEl && (selectedEl.element_id || selectedEl.id) === id) {
        setSelectedEl(restored);
      }
      await loadData();
    } catch (err) {
      alert(`Restore failed: ${getApiErrorMessage(err, "Unknown error")}`);
    } finally {
      setRestoringId(null);
    }
  };

  const openEdit = (el) => {
    setEditEl({
      id: el.element_id || el.id,
      name: el.label || el.name || "",
      datatype: normalizeType(el.datatype),
      unit: el.unit || "",
      description: el.description || "",
    });
    setShowEdit(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editEl.id) return;
    setUpdating(true);
    try {
      const payload = {
        label: editEl.name.trim(),
        datatype: editEl.datatype,
        unit: supportsUnit(editEl.datatype) ? editEl.unit.trim() || null : null,
        description: editEl.description.trim() || null,
      };
      const updated = await api.updateElement(editEl.id, payload);
      setElements((prev) => prev.map((item) => (
        (item.element_id || item.id) === editEl.id ? updated : item
      )));
      if (selectedEl && (selectedEl.element_id || selectedEl.id) === editEl.id) {
        setSelectedEl(updated);
      }
      setShowEdit(false);
      await loadData();
    } catch (err) {
      alert(getApiErrorMessage(err, "Failed to update data element."));
    } finally {
      setUpdating(false);
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
      <div className="px-4 pt-6 pb-2 sm:px-6 sm:pt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Elements</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Browse and manage your standardized metrics library
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:self-start">
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
            <span>{mappingError}</span>
            <button onClick={buildSurveyCounts} className="ml-auto text-xs font-semibold text-amber-700 hover:underline shrink-0">Retry</button>
          </div>
        )}

        {/* Stats row */}
        {(() => {
          const pageTotal = filtered.length;
          const mapped = filtered.filter((el) => (surveyCountMap[el.element_id || el.id] || 0) > 0 || (goalCountMap[el.element_id || el.id] || 0) > 0).length;
          const unmapped = pageTotal - mapped;
          return (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">{showDeleted ? "Deleted total" : "Active total"}</p>
                <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Mapped on this page</p>
                <p className="text-2xl font-bold text-slate-900">{mapped}</p>
              </div>
              <div className="bg-slate-100 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Unmapped on this page</p>
                <p className="text-2xl font-bold text-slate-500">{unmapped}</p>
              </div>
              <div className="bg-amber-50 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 font-medium mb-0.5">Shown on this page</p>
                <p className="text-2xl font-bold text-amber-700">{pageTotal}</p>
              </div>
            </div>
          );
        })()}

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 w-fit">
            <button
              onClick={() => { setShowDeleted(false); setSelectedEl(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                !showDeleted ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-white"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => { setShowDeleted(true); setSelectedEl(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                showDeleted ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-white"
              }`}
            >
              Deleted
            </button>
          </div>

          <input
            placeholder={showDeleted ? "Search deleted elements..." : "Search by code or name..."}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-400 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
          <p className="text-sm text-slate-400">{totalCount} {showDeleted ? "deleted" : "active"} elements</p>
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
        ) : totalCount === 0 ? (
          <div className="py-20 text-center text-slate-300 text-sm">{showDeleted ? "No deleted elements found." : "No elements found."}</div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide rounded-l-lg">Label</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Code</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Datatype</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Unit</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((el) => {
                const id = el.element_id || el.id;
                const count = surveyCountMap[id] || 0;
                const goalCount = goalCountMap[id] || 0;
                const isMapped = count > 0 || goalCount > 0;

                return (
                  <tr
                    key={id}
                    onClick={() => setSelectedEl(el)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-[160px] sm:max-w-none">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate">{toTitleCase(el.label || el.name)}</span>
                        {showDeleted && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 w-fit">
                            Deleted
                          </span>
                        )}
                        <span className="sm:hidden font-mono text-xs text-blue-600 truncate">{el.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="inline-block font-mono text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-full">
                        {el.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">
                      {normalizeType(el.datatype)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell">
                      {el.unit || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {goalCount > 0 && (
                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs font-semibold rounded-full border border-violet-100 hidden sm:inline-block">
                            {goalCount} {goalCount === 1 ? "goal" : "goals"}
                          </span>
                        )}
                        {isMapped && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100 hidden sm:inline-block">
                            {count} {count === 1 ? "survey" : "surveys"}
                          </span>
                        )}
                        {showDeleted ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(el);
                            }}
                            disabled={restoringId === id}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                              restoringId === id
                                ? "text-slate-400 bg-slate-100 cursor-not-allowed"
                                : "text-blue-700 bg-blue-50 hover:bg-blue-100"
                            }`}
                          >
                            {restoringId === id ? "Restoring..." : "Restore"}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(el);
                            }}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                              isMapped
                                ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                                : "text-rose-600 bg-rose-50 hover:bg-rose-100"
                            }`}
                          >
                            {isMapped ? "Deactivate" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !loadError && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 pb-2">
            <p className="text-xs text-slate-400">
              Showing {totalCount === 0 ? 0 : ((page - 1) * PAGE_SIZE + 1)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs font-semibold rounded-lg transition ${
                    p === page ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
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
                    onChange={(e) => setNewEl({ ...newEl, code: e.target.value.replace(/\s/g, "_").toLowerCase() })}
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
                      <option value="integer">Integer</option>
                      <option value="float">Float</option>
                      <option value="string">Text</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {newEl.datatype === "integer" && "Whole numbers only — use for counts like steps, reps, or push-ups."}
                      {newEl.datatype === "float" && "Decimal values allowed — use for measurements like weight, hours, or intake."}
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

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleUpdate}>
              <div className="border-b border-slate-100 px-7 py-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Edit Data Element</h2>
                  <p className="text-sm text-slate-500 mt-1">Safely migrate older numeric elements to integer or float.</p>
                </div>
                <button type="button" onClick={() => setShowEdit(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-7 py-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                    Label <span className="text-red-400 text-xs font-semibold">required</span>
                  </label>
                  <input
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                    value={editEl.name}
                    onChange={(e) => setEditEl({ ...editEl, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                      Data type <span className="text-red-400 text-xs font-semibold">required</span>
                    </label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition bg-white"
                      value={editEl.datatype}
                      onChange={(e) =>
                        setEditEl((prev) => ({
                          ...prev,
                          datatype: e.target.value,
                          unit: supportsUnit(e.target.value) ? prev.unit : "",
                        }))
                      }
                    >
                      <option value="integer">Integer</option>
                      <option value="float">Float</option>
                      <option value="string">Text</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {editEl.datatype === "integer" && "Whole numbers only — best for counts like reps, steps, and pills."}
                      {editEl.datatype === "float" && "Decimal values allowed — best for measurements like water, hours, or weight."}
                      {editEl.datatype === "string" && "Free-text values — use for open-ended responses."}
                      {editEl.datatype === "boolean" && "Yes/No values — use for binary questions."}
                      {editEl.datatype === "date" && "Date values — use for timestamps or date entries."}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                      Unit <span className="text-slate-400 text-xs font-normal">(optional)</span>
                    </label>
                    <input
                      disabled={!supportsUnit(editEl.datatype)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                      value={editEl.unit}
                      onChange={(e) => setEditEl({ ...editEl, unit: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
                    Description <span className="text-slate-400 text-xs font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none resize-none h-24 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
                    value={editEl.description}
                    onChange={(e) => setEditEl({ ...editEl, description: e.target.value })}
                  />
                </div>

                <div className="flex gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-7.4 12.82A1 1 0 003.76 18h16.48a1 1 0 00.87-1.5l-7.4-12.82a1 1 0 00-1.74 0z" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    For elements already in use, only numeric-to-numeric migrations are allowed. This keeps existing survey mappings, goals, and health data safe.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 px-7 py-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 border border-slate-900 bg-white rounded-xl text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  {updating ? "Saving..." : "Save changes"}
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
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl">

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
                {selectedEl.is_active === false ? (
                  <button
                    onClick={() => handleRestore(selectedEl)}
                    disabled={restoringId === (selectedEl.element_id || selectedEl.id)}
                    className={`text-xs font-semibold px-2 py-1 rounded transition ${
                      restoringId === (selectedEl.element_id || selectedEl.id)
                        ? "text-slate-400 bg-slate-100 cursor-not-allowed"
                        : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    }`}
                  >
                    {restoringId === (selectedEl.element_id || selectedEl.id) ? "Restoring..." : "Restore"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openEdit(selectedEl)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-semibold px-2 py-1 hover:bg-blue-50 rounded transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selectedEl)}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 hover:bg-red-50 rounded transition"
                    >
                      Delete
                    </button>
                  </>
                )}
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
              const linkedGoals = goalLinksMap[elId] || [];

              return (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                  {/* Details */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Details
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

                  {/* Linked health goals */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Linked Health Goals
                      {linkedGoals.length > 0 && (
                        <span className="ml-2 bg-violet-100 text-violet-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {linkedGoals.length}
                        </span>
                      )}
                    </p>
                    {linkedGoals.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                        <p className="text-sm text-slate-400">Not linked to any health goals yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {linkedGoals.map((g) => (
                          <div key={g.template_id} className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-semibold text-violet-900">{toTitleCase(g.name)}</p>
                          </div>
                        ))}
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

import { useState, useEffect, useRef, useCallback } from 'react';
import FieldInput from '../../components/survey/FieldInput';
import { FieldCard, AddFieldPanel, newField, uid } from '../../components/survey/FieldEditor';
import { api } from '../../services/api';

/* Toast animation — injected once, not per render */
if (typeof document !== 'undefined' && !document.getElementById('hdb-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'hdb-toast-styles';
  style.textContent = `
    @keyframes toastSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  `;
  document.head.appendChild(style);
}

/* ── SVG icons ── */
const Svg = ({ d, size = 18, sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const PlusIco      = () => <Svg d="M12 5v14M5 12h14" />;
const SearchIco    = () => <Svg size={16} d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />;
const BackIco      = () => <Svg size={16} d="M19 12H5M12 19l-7-7 7-7" />;
const FilterIco    = () => <Svg size={15} d={<><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></>} />;
const EditIco      = () => <Svg size={16} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />;
const TrashIco     = () => <Svg size={16} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />;
const CheckIco     = () => <Svg size={16} d={<><polyline points="20 6 9 17 4 12"/></>} />;
const UnpublishIco = () => <Svg size={16} d={<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>} />;
const WarnIco      = () => <Svg size={14} d={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>} />;
const InfoIco      = () => <Svg size={14} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>} />;
const UsersIco     = () => <Svg size={12} d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />;
const CalIco       = () => <Svg size={12} d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />;
const AlertIco     = () => <Svg size={13} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} />;
const SortIco      = () => <Svg size={14} d={<><line x1="4" y1="6" x2="13" y2="6"/><line x1="4" y1="12" x2="10" y2="12"/><line x1="4" y1="18" x2="7" y2="18"/><polyline points="17 10 20 6 23 10"/><line x1="20" y1="6" x2="20" y2="18"/></>} />;
const SaveIco      = () => <Svg size={13} sw={2} d={<><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>} />;
const MonitorIco   = () => <Svg size={16} d={<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>} />;
const TabletIco    = () => <Svg size={16} d={<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>} />;
const PhoneIco     = () => <Svg size={16} d={<><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>} />;

function StatusBadge({ status }) {
  const cls = status === 'PUBLISHED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
  return <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>;
}


/* ── HELPERS: Data Transformation ── */
const transformForSave = (form) => {
  return {
    ...form,
    fields: form.fields.map(f => {
      if (f.field_type === 'likert') {
        const min = f.likertMin ?? 0;
        const max = f.likertMax ?? 4;
        const labels = f.likertLabels || [];
        const generatedOptions = Array.from({ length: max - min + 1 }, (_, i) => {
          const val = min + i;
          return { label: labels[i] || '', value: val, display_order: i + 1 };
        });
        return { ...f, options: generatedOptions, likertMin: undefined, likertMax: undefined, likertLabels: undefined };
      }
      return {
        ...f,
        options: f.options.map((o, i) => ({
          label: o.label, value: parseInt(o.value) || (i + 1), display_order: i + 1
        }))
      };
    })
  };
};

const transformForEdit = (backendForm) => {
  return {
    ...backendForm,
    fields: backendForm.fields.map(f => {
      if (f.field_type === 'likert') {
        const sortedOpts = f.options.sort((a, b) => a.value - b.value);
        const min = sortedOpts.length > 0 ? sortedOpts[0].value : 0;
        const max = sortedOpts.length > 0 ? sortedOpts[sortedOpts.length - 1].value : 4;
        const labels = sortedOpts.map(o => o.label);
        return { ...f, id: f.field_id || f.id, likertMin: min, likertMax: max, likertLabels: labels, options: [] };
      }
      return { ...f, id: f.field_id || f.id, options: f.options.map(o => ({ ...o, id: o.option_id || uid() })) };
    })
  };
};

/* ── Helper: human-friendly recency ── */
const daysSince = (dateStr) => {
  if (!dateStr) return '';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const timeAgo = (date) => {
  if (!date) return '';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};


/* ══════════════════════════════════════════════
   CONFIRM MODAL — reusable for all actions
   ══════════════════════════════════════════════ */
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onClose, disabled, children }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-4">{message}</p>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 font-medium hover:text-slate-700 transition">Cancel</button>
          <button onClick={onConfirm} disabled={disabled}
            className={`px-4 py-2 text-sm text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass || 'bg-blue-600 hover:bg-blue-700'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   FORM LIST VIEW
   #6 tab counts, #7 sort, #8 publish date, #9 empty state
   ══════════════════════════════════════════════ */
function FormListView({ forms, onEdit, onCreate, onDelete, onPublish, onUnpublish, groups, pageTitle = 'Survey Forms' }) {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort]                 = useState('edited');
  const [showSort, setShowSort]         = useState(false);
  const [groupFilter, setGroupFilter]   = useState('ALL');
  const [groupSearch, setGroupSearch]   = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) setGroupDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [selected, setSelected]         = useState(new Set());
  const [modal, setModal]               = useState(null);
  const [publishGroups, setPublishGroups] = useState(new Set());
  const [publishGroupSearch, setPublishGroupSearch] = useState('');
  const [publishError, setPublishError] = useState('');

  const hasDateFilter  = dateFrom || dateTo;
  const hasGroupFilter = groupFilter !== 'ALL';
  const activeFilterCount = (hasDateFilter ? 1 : 0) + (hasGroupFilter ? 1 : 0);

  /* #6 — Status counts */
  const counts = {
    ALL: forms.length,
    DRAFT: forms.filter((f) => f.status === 'DRAFT').length,
    PUBLISHED: forms.filter((f) => f.status === 'PUBLISHED').length,
  };

  const filtered = forms.filter((f) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchGroup  = groupFilter === 'ALL' || (f.status === 'PUBLISHED' && Array.isArray(f.deployed_group_ids) && f.deployed_group_ids.map(String).includes(groupFilter));
    const matchFrom   = !dateFrom || new Date(f.created_at) >= new Date(dateFrom);
    const matchTo     = !dateTo   || new Date(f.created_at) <= new Date(dateTo + 'T23:59:59.999');
    return matchSearch && matchStatus && matchGroup && matchFrom && matchTo;
  });

  /* #7 — Sort */
  const sortLabels = { newest: 'Newest first', oldest: 'Oldest first', alpha: 'A → Z', edited: 'Recently edited' };
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'alpha')  return a.title.localeCompare(b.title);
    if (sort === 'edited') return new Date(b.updated_at) - new Date(a.updated_at);
    return 0;
  });

  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.form_id)));
  };
  const clearFilters = () => { setDateFrom(''); setDateTo(''); setGroupFilter('ALL'); setShowFilters(false); };

  const selectedForms     = forms.filter((f) => selected.has(f.form_id));
  const selectedDrafts    = selectedForms.filter((f) => f.status === 'DRAFT');
  const selectedPublished = selectedForms.filter((f) => f.status === 'PUBLISHED');

  const handleConfirmDelete = () => {
    modal.ids.forEach((id) => onDelete(id));
    setSelected((prev) => { const n = new Set(prev); modal.ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
  };
  const handleConfirmPublish = () => {
    if (publishGroups.size === 0) return;
    const groupIds = [...publishGroups];
    modal.ids.forEach((id) => {
      const f = forms.find((x) => x.form_id === id);
      if (f && f.status === 'DRAFT') onPublish(id, groupIds);
    });
    setSelected((prev) => { const n = new Set(prev); modal.ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
    setPublishGroups(new Set());
  };
  const handleConfirmUnpublish = () => {
    modal.ids.forEach((id) => {
      const f = forms.find((x) => x.form_id === id);
      if (f && f.status === 'PUBLISHED') onUnpublish(id);
    });
    setSelected((prev) => { const n = new Set(prev); modal.ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
  };

  const groupName = (gid) => (groups.find((g) => g.group_id === gid) || {}).name || '';

  /* #9 — Empty state */
  if (forms.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">{pageTitle}</h2>
        </div>
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Svg size={36} sw={1.5} stroke="#3b82f6" d={<><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Create your first survey</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Build a survey form with questions, then publish it to a participant group to start collecting responses.
          </p>
          <button onClick={onCreate}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition">
            <PlusIco /> New Form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1">
            <span className="text-slate-400">Dashboard</span><span className="text-slate-300">/</span><span className="text-slate-600 font-medium">Surveys</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{pageTitle}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{forms.length} forms total</p>
        </div>
        <button onClick={onCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
          <PlusIco /> New Form
        </button>
      </div>

      {/* Search + Status + Sort + Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIco /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>

          {/* #6 — Tabs with counts */}
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {['ALL', 'DRAFT', 'PUBLISHED'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${statusFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold leading-none ${statusFilter === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-400'}`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>

          {/* #7 — Sort dropdown */}
          <div className="relative shrink-0">
            <button onClick={() => setShowSort(!showSort)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                sort !== 'newest' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}>
              <SortIco /> {sortLabels[sort]}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                {Object.entries(sortLabels).map(([key, label]) => (
                  <button key={key} onClick={() => { setSort(key); setShowSort(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition ${sort === key ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shrink-0 ${
              activeFilterCount > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}>
            <FilterIco /> Filters
            {activeFilterCount > 0 && (
              <span className="text-xs rounded-full px-1.5 font-bold leading-none bg-blue-100 text-blue-700">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Created After</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Created On or Before</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>
              <div className="relative" ref={groupDropdownRef}>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Group</label>
                <button
                  onClick={() => setGroupDropdownOpen((o) => !o)}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition min-w-[200px] w-full">
                  <span className="truncate text-slate-700">
                    {groupFilter === 'ALL' ? 'All Groups' : (groups.find((g) => String(g.group_id) === groupFilter)?.name ?? 'All Groups')}
                  </span>
                  <Svg size={14} d="M6 9l6 6 6-6" className="shrink-0 text-slate-400" />
                </button>
                {groupDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-lg">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        autoFocus
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder="Search groups…"
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto py-1">
                      <button
                        onClick={() => { setGroupFilter('ALL'); setGroupDropdownOpen(false); setGroupSearch(''); }}
                        className={`w-full text-left px-3 py-2 text-sm transition ${groupFilter === 'ALL' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>
                        All Groups
                      </button>
                      {groups
                        .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                        .map((g) => (
                          <button key={g.group_id}
                            onClick={() => { setGroupFilter(String(g.group_id)); setGroupDropdownOpen(false); setGroupSearch(''); }}
                            className={`w-full text-left px-3 py-2 text-sm transition ${String(groupFilter) === String(g.group_id) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>
                            {g.name}
                          </button>
                        ))}
                      {groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-slate-400">No groups found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {(hasDateFilter || hasGroupFilter) && (
                <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-rose-500 font-medium transition pb-1">Clear all filters</button>
              )}
            </div>
          </div>
        )}
      </div>

      {publishError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 mb-3 text-sm text-rose-700">
          <AlertIco /> {publishError}
        </div>
      )}

      {/* Multi-select toolbar */}
      <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-2.5 mb-3 transition-all ${
        selected.size > 0 ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'
      }`}>
        <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
          {selected.size > 0
            ? <span className="font-medium text-blue-700">{selected.size} form{selected.size > 1 ? 's' : ''} selected</span>
            : <span className="text-slate-400">Select forms</span>}
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            {selectedDrafts.length > 0 && (
              <button onClick={() => setModal({ type: 'publish', ids: [...selected] })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition">
                <CheckIco /> Publish{selectedDrafts.length > 1 ? ` (${selectedDrafts.length})` : ''}
              </button>
            )}
            {selectedPublished.length > 0 && (
              <button onClick={() => setModal({ type: 'unpublish', ids: [...selected] })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition">
                <UnpublishIco /> Unpublish{selectedPublished.length > 1 ? ` (${selectedPublished.length})` : ''}
              </button>
            )}
            <button onClick={() => setModal({ type: 'delete', ids: [...selected], isPublished: selectedPublished.length > 0 })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-100 hover:bg-rose-200 rounded-lg transition">
              <TrashIco /> Delete{selected.size > 1 ? ` (${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>

      {/* Form cards */}
      <div className="space-y-3">
        {sorted.map((form) => {
          const isSel = selected.has(form.form_id);
          const fieldCount = form.field_count ?? (form.fields ? form.fields.length : 0);
          return (
            <div key={form.form_id}
              className={`bg-white rounded-xl border p-4 sm:p-5 shadow-sm hover:shadow-md cursor-pointer transition-all group ${
                isSel ? 'border-blue-300 ring-1 ring-blue-100' :
                form.status === 'DRAFT' ? 'border-l-4 border-amber-400 border-t border-r border-b border-t-slate-200 border-r-slate-200 border-b-slate-200' :
                'border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={isSel}
                  onChange={() => toggleSelect(form.form_id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-400 shrink-0 cursor-pointer" />

                <div className="flex-1 min-w-0" onClick={() => onEdit(form)}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{form.title}</h3>
                    <StatusBadge status={form.status} />
                  </div>
                  {form.description && <p className="text-xs text-slate-500 line-clamp-1">{form.description}</p>}
                  {form.deployed_groups?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {form.deployed_groups.map((g) => (
                        <span key={g} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <UsersIco />{g}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1"><CalIco /> {new Date(form.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>·</span>
                    <span>{fieldCount} question{fieldCount !== 1 ? 's' : ''}</span>

                    {form.status === 'DRAFT' && form.updated_at && (
                      <><span>·</span><span className="text-amber-500 font-medium">Edited {daysSince(form.updated_at)}</span></>
                    )}

                    {/* #8 — Publish date on published cards */}
                    {form.status === 'PUBLISHED' && form.published_at && (
                      <><span>·</span><span className="text-emerald-600 font-medium">Published {daysSince(form.published_at)}</span></>
                    )}

                    {form.status === 'PUBLISHED' && form.group_id && (
                      <><span>·</span><span className="flex items-center gap-1"><UsersIco /> {groupName(form.group_id)}</span></>
                    )}
                  </div>

                  {form.status === 'DRAFT' && fieldCount < 5 && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 w-fit">
                      <AlertIco /> Only {fieldCount} question{fieldCount !== 1 ? 's' : ''} — add more before publishing
                    </div>
                  )}
                </div>

                {/* Quick actions on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {form.status === 'DRAFT' && (
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Publish"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!form.field_count || form.field_count === 0) {
                          setPublishError(`"${form.title}" has no questions. Add at least one question before publishing.`);
                          setTimeout(() => setPublishError(''), 5000);
                          return;
                        }
                        setPublishError('');
                        setModal({ type: 'publish', ids: [form.form_id], formTitle: form.title });
                      }}>
                      <CheckIco />
                    </button>
                  )}
                  {form.status === 'PUBLISHED' && (
                    <button className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition" title="Unpublish"
                      onClick={(e) => { e.stopPropagation(); setModal({ type: 'unpublish', ids: [form.form_id], formTitle: form.title }); }}>
                      <UnpublishIco />
                    </button>
                  )}
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Edit"
                    onClick={(e) => { e.stopPropagation(); onEdit(form); }}>
                    <EditIco />
                  </button>
                  <button className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition" title="Delete"
                    onClick={(e) => { e.stopPropagation(); setModal({ type: 'delete', ids: [form.form_id], formTitle: form.title, isPublished: form.status === 'PUBLISHED' }); }}>
                    <TrashIco />
                  </button>
                </div>

                <span className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1 shrink-0" onClick={() => onEdit(form)}>
                  <Svg size={18} d="M9 5l7 7-7 7" />
                </span>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">No forms found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* ── DELETE MODAL ── */}
      {modal?.type === 'delete' && (
        <ConfirmModal title={modal.ids.length === 1 ? 'Delete Form' : 'Delete Forms'}
          message={modal.formTitle ? `Are you sure you want to delete "${modal.formTitle}"? This action cannot be undone.` : `Are you sure you want to delete ${modal.ids.length} form${modal.ids.length > 1 ? 's' : ''}? This action cannot be undone.`}
          confirmLabel="Delete" confirmClass="bg-rose-600 hover:bg-rose-700" onConfirm={handleConfirmDelete} onClose={() => setModal(null)}>
          {modal.isPublished && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 mb-2">
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5"><WarnIco /></span>
                <div><strong>Warning:</strong> {modal.ids.length === 1 ? 'This form is' : 'Some selected forms are'} currently published.
                  <button onClick={() => setModal({ ...modal, type: 'unpublish' })} className="ml-1 underline font-semibold hover:text-amber-900 transition">Unpublish instead?</button></div>
              </div>
            </div>
          )}
        </ConfirmModal>
      )}

      {/* ── PUBLISH MODAL (multi-group) ── */}
      {modal?.type === 'publish' && (
        <ConfirmModal title={modal.formTitle ? `Publish "${modal.formTitle}"` : 'Publish Forms'}
          message={modal.formTitle ? `Assign "${modal.formTitle}" to one or more groups.` : `Publish ${selectedDrafts.length} draft form${selectedDrafts.length > 1 ? 's' : ''}? Select groups to assign.`}
          confirmLabel={publishGroups.size > 1 ? `Publish to ${publishGroups.size} Groups` : 'Publish'}
          confirmClass="bg-emerald-600 hover:bg-emerald-700" onConfirm={handleConfirmPublish}
          onClose={() => { setModal(null); setPublishGroups(new Set()); setPublishGroupSearch(''); }} disabled={publishGroups.size === 0}>
          <div className="mb-1">
            <input
              autoFocus
              value={publishGroupSearch}
              onChange={(e) => setPublishGroupSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 transition mb-2"
            />
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => {
                if (publishGroups.size === groups.length) setPublishGroups(new Set());
                else setPublishGroups(new Set(groups.map((g) => g.group_id)));
              }} className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition">
                {publishGroups.size === groups.length ? 'Deselect all' : 'Select all'}
              </button>
              {publishGroups.size > 0 && (
                <p className="text-xs text-emerald-600 font-medium">{publishGroups.size} group{publishGroups.size > 1 ? 's' : ''} selected</p>
              )}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {groups
                .filter((g) => g.name.toLowerCase().includes(publishGroupSearch.toLowerCase()))
                .map((g) => {
                  const checked = publishGroups.has(g.group_id);
                  return (
                    <label key={g.group_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setPublishGroups((prev) => { const n = new Set(prev); n.has(g.group_id) ? n.delete(g.group_id) : n.add(g.group_id); return n; })}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                      <span className="text-sm font-medium text-slate-700 truncate flex-1">{g.name}</span>
                      {checked && <span className="text-emerald-600 shrink-0"><Svg size={14} sw={2.5} d={<polyline points="20 6 9 17 4 12" />} /></span>}
                    </label>
                  );
                })}
              {groups.filter((g) => g.name.toLowerCase().includes(publishGroupSearch.toLowerCase())).length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-2">No groups match your search</p>
              )}
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* ── UNPUBLISH MODAL ── */}
      {modal?.type === 'unpublish' && (
        <ConfirmModal title={modal.formTitle ? `Unpublish "${modal.formTitle}"` : 'Unpublish Forms'}
          message={modal.formTitle ? `Unpublish "${modal.formTitle}"? It will revert to draft status.` : `Unpublish ${selectedPublished.length} form${selectedPublished.length > 1 ? 's' : ''}?`}
          confirmLabel="Unpublish" confirmClass="bg-amber-600 hover:bg-amber-700" onConfirm={handleConfirmUnpublish} onClose={() => setModal(null)}>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5"><InfoIco /></span>
              <span>Unpublished forms revert to draft. Participants will lose access.</span>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}


/* ── Preview description expand/collapse ── */
function PreviewDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 100;
  return (
    <p className="text-xs text-slate-500 mb-3 italic">
      {isLong && !expanded ? (
        <>{text.slice(0, 100)}… <button onClick={() => setExpanded(true)} className="not-italic text-blue-500 hover:text-blue-700 font-semibold transition">more</button></>
      ) : (
        <>{text}{isLong && <button onClick={() => setExpanded(false)} className="ml-1 not-italic text-blue-500 hover:text-blue-700 font-semibold transition">less</button>}</>
      )}
    </p>
  );
}


/* ══════════════════════════════════════════════
   PREVIEW VIEW — #11 device toggle
   ══════════════════════════════════════════════ */
function PreviewView({ title, description, fields }) {
  const [device, setDevice] = useState('desktop');
  const widthCls = { desktop: 'max-w-2xl', tablet: 'max-w-md', phone: 'max-w-[320px]' }[device];

  return (
    <div>
      {/* #11 — Device toggle */}
      <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl mb-4 w-fit mx-auto">
        {[
          { k: 'desktop', ico: <MonitorIco />, l: 'Desktop' },
          { k: 'tablet',  ico: <TabletIco />,  l: 'Tablet' },
          { k: 'phone',   ico: <PhoneIco />,   l: 'Phone' },
        ].map((d) => (
          <button key={d.k} onClick={() => setDevice(d.k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${device === d.k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {d.ico} {d.l}
          </button>
        ))}
      </div>

      <div className={`mx-auto transition-all duration-300 ${widthCls} ${device === 'phone' ? 'border-4 border-slate-300 rounded-3xl p-2 bg-slate-100' : ''}`}>
        {device === 'phone' && <div className="w-16 h-1 bg-slate-300 rounded-full mx-auto mb-2" />}
        <div className="bg-blue-600 rounded-t-2xl px-6 py-5 text-white">
          <h2 className="text-lg font-bold">{title || 'Untitled Form'}</h2>
          {description && <p className="text-sm text-blue-100 mt-1">{description}</p>}
          <p className="text-xs text-blue-200 mt-2">{fields.length} question{fields.length !== 1 && 's'} • ~{Math.ceil(fields.length * 0.5)} min • <span className="text-red-200">*</span> = required</p>
        </div>
        {/* Mock progress bar */}
        <div className="bg-white border-x border-slate-200 px-4 py-2.5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">0 of {fields.length} answered</span>
            <span className="font-bold text-blue-600">0%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500 w-0" /></div>
        </div>
        <div className="bg-white border border-t-0 border-slate-200 rounded-b-2xl shadow-sm divide-y divide-slate-100">
          {fields.map((f, i) => (
            <div key={f.id} className="px-6 py-5">
              <p className="text-sm font-semibold text-slate-800 mb-1">
                <span className="text-slate-400 mr-1.5">{i + 1}.</span>
                {f.label || 'Untitled question'}
                {f.is_required && <span className="text-rose-400 ml-1">*</span>}
              </p>
              {f.description && <PreviewDescription text={f.description} />}
              <FieldInput field={f} value={undefined} onChange={() => {}} onToggleMulti={() => {}} disabled />
            </div>
          ))}
          {fields.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No questions to preview</div>}
        </div>
        {device === 'phone' && <div className="w-24 h-1 bg-slate-300 rounded-full mx-auto mt-2" />}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   PUBLISH MODAL — multi-group checkbox select
   Used by BuilderView; fetches groups via api.listGroups()
   ══════════════════════════════════════════════ */
function PublishModal({ onClose, onConfirm, title: formTitle, deployedGroupIds = [] }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [groupSearch, setGroupSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGroups().then((data) => {
      setGroups(data);
      setSelectedGroups(new Set(deployedGroupIds.map(String)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleGroup = (gid) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedGroups.size === groups.length) setSelectedGroups(new Set());
    else setSelectedGroups(new Set(groups.map((g) => g.group_id)));
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Publish Survey</h3>
        <p className="text-sm text-slate-500 mb-4">
          {formTitle ? `Assign "${formTitle}" to one or more groups.` : 'Select groups to assign this survey to.'}
        </p>
        {loading ? (
          <div className="space-y-2 mb-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-6 mb-4">
            <p className="text-sm text-slate-400">No groups available.</p>
            <p className="text-xs text-slate-400 mt-1">Create a participant group first.</p>
          </div>
        ) : (
          <div className="mb-4">
            <input
              autoFocus
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 transition mb-2"
            />
            <div className="flex items-center justify-between mb-2">
              <button onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition">
                {selectedGroups.size === groups.length ? 'Deselect all' : 'Select all'}
              </button>
              {selectedGroups.size > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {groups
                .filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                .map((g) => {
                  const checked = selectedGroups.has(g.group_id);
                  return (
                    <label key={g.group_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGroup(g.group_id)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700 block truncate">{g.name}</span>
                      </div>
                      {checked && (
                        <span className="text-emerald-600 shrink-0">
                          <Svg size={14} sw={2.5} d={<polyline points="20 6 9 17 4 12" />} />
                        </span>
                      )}
                    </label>
                  );
                })}
              {groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-2">No groups match your search</p>
              )}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 font-medium hover:text-slate-700 transition">Cancel</button>
          <button
            onClick={() => onConfirm([...selectedGroups], new Set(deployedGroupIds.map(String)))}
            disabled={selectedGroups.size === 0 && deployedGroupIds.length === 0}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   BUILDER VIEW
   #1 unsaved changes, #2 auto-save, #3 drag reorder, #4 validation
   ══════════════════════════════════════════════ */
function BuilderView({ form, onSave, onBack, onPublish, onDelete, dataElements, onDataElementCreated }) {
  const [title, setTitle]       = useState(form?.title || '');
  const [desc, setDesc]         = useState(form?.description || '');
  const [fields, setFields]     = useState(form?.fields || []);
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [mode, setMode]         = useState('edit');
  const [showPublish, setShowPublish] = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationContext, setValidationContext] = useState('saving');
  const [validationErrorIds, setValidationErrorIds] = useState(new Set());
  const [lastSaved, setLastSaved]       = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  const isDraft = !form?.status || form.status === 'DRAFT';
  const autoSaveTimer = useRef(null);
  const isDirtyRef = useRef(false);

  /* Track dirty state */
  const markDirty = () => { isDirtyRef.current = true; };
  useEffect(() => { markDirty(); }, [title, desc, fields]);

  /* #2 — Auto-save indicator (debounced 5s, localStorage backup) */
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      const formId = form?.form_id || 'new';
      try {
        localStorage.setItem(`hdb_builder_draft_${formId}`, JSON.stringify({ title, description: desc, fields, savedAt: new Date().toISOString() }));
      } catch { /* ignore storage errors */ }
      setTimeout(() => {
        setLastSaved(new Date());
        setAutoSaveStatus('saved');
        isDirtyRef.current = false;
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      }, 300);
    }, 5000);
  }, [title, desc, fields, form]);

  const handleTitleChange = (v) => { setTitle(v); triggerAutoSave(); };
  const handleDescChange = (v) => { setDesc(v); triggerAutoSave(); };

  /* #1 — Unsaved changes warning */
  const handleBackClick = () => {
    if (isDirtyRef.current) setShowUnsavedModal(true);
    else onBack();
  };

  /* #1 — beforeunload protection */
  useEffect(() => {
    const handler = (e) => { if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => { window.removeEventListener('beforeunload', handler); if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  /* Refresh timeAgo display */
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 15000); return () => clearInterval(i); }, []);

  /* #4 — Validation */
  const validate = ({ requireElementLinks = false } = {}) => {
    const errs = [];
    const errIds = new Set();
    setValidationContext(requireElementLinks ? 'publishing' : 'saving');
    if (!title.trim()) errs.push('Form title is required');
    if (requireElementLinks && fields.length === 0) errs.push('Add at least one question before publishing');
    fields.forEach((f, i) => {
      const n = `Question ${i + 1}`;
      if (!f.label.trim()) { errs.push(`${n}: Question text is required`); errIds.add(f.id); }
      if (requireElementLinks && !f.element_id) { errs.push(`${n}: Must be linked to a data element before publishing`); errIds.add(f.id); }
      if (f.field_type === 'likert' && (f.likertMin ?? 0) >= (f.likertMax ?? 4)) { errs.push(`${n}: Likert min must be less than max`); errIds.add(f.id); }
      if (['single_select', 'multi_select', 'dropdown'].includes(f.field_type)) {
        if (!f.options || f.options.length < 2) { errs.push(`${n}: Needs at least 2 options`); errIds.add(f.id); }
        else if (f.options.some((o) => !o.label.trim())) { errs.push(`${n}: All options need labels`); errIds.add(f.id); }
      }
    });
    setValidationErrors(errs);
    setValidationErrorIds(errIds);
    return errs.length === 0;
  };

  const MAX_FIELDS = 30;

  const addField = (type) => {
    if (fields.length >= MAX_FIELDS) return;
    const f = newField(type);
    f.display_order = fields.length;
    setFields((prev) => [...prev, f]);
    setExpanded(f.id);
    triggerAutoSave();
  };

  const updateField = (id, data) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));
    triggerAutoSave();
  };

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (expanded === id) setExpanded(null);
    triggerAutoSave();
  };

  const duplicateField = (id) => {
    const src = fields.find((f) => f.id === id);
    if (!src) return;
    const dup = { ...src, id: uid(), label: src.label + ' (copy)', options: src.options.map((o) => ({ ...o, id: uid() })) };
    const idx = fields.findIndex((f) => f.id === id);
    const next = [...fields];
    next.splice(idx + 1, 0, dup);
    setFields(next.map((f, i) => ({ ...f, display_order: i })));
    setExpanded(dup.id);
    triggerAutoSave();
  };

  const moveField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next.map((f, i) => ({ ...f, display_order: i })));
    triggerAutoSave();
  };

  /* #3 — Native drag-and-drop */
  const dragIdx = useRef(null);
  const onDragStart = (i) => { dragIdx.current = i; };
  const onDrop = (i) => {
    if (dragIdx.current === null || dragIdx.current === i) return;
    const n = [...fields];
    const [item] = n.splice(dragIdx.current, 1);
    n.splice(i, 0, item);
    setFields(n.map((f, j) => ({ ...f, display_order: j })));
    dragIdx.current = null;
    triggerAutoSave();
  };

  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === fields.length) setSelected(new Set());
    else setSelected(new Set(fields.map((f) => f.id)));
  };
  const deleteSelected = () => {
    setFields((prev) => prev.filter((f) => !selected.has(f.id)).map((f, i) => ({ ...f, display_order: i })));
    setSelected(new Set());
    setExpanded(null);
    triggerAutoSave();
  };

  const handleSaveDraft = () => {
    if (!validate()) return;
    onSave({ ...form, title, description: desc, fields });
    isDirtyRef.current = false;
  };

  const handlePublishClick = () => {
    if (!validate({ requireElementLinks: true })) return;
    setShowPublish(true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <button onClick={handleBackClick} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition">
          <BackIco /> All Forms
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {/* #2 — Auto-save indicator */}
          {lastSaved && (
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-2">
              {autoSaveStatus === 'saving' ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Saving...</>
              ) : autoSaveStatus === 'saved' ? (
                <><Svg size={11} sw={2.5} stroke="#16a34a" d={<polyline points="20 6 9 17 4 12" />} /> Saved</>
              ) : (
                <>Auto-saved {timeAgo(lastSaved)}</>
              )}
            </span>
          )}
          {isDraft ? (
            <>
              <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                <button onClick={() => setMode('edit')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${mode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Edit</button>
                <button onClick={() => setMode('preview')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${mode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Preview</button>
              </div>
              <button onClick={handleSaveDraft} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm flex items-center gap-1.5">
                <SaveIco /> Save Draft
              </button>
            </>
          ) : (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl font-medium">
              Remove from all groups to edit
            </span>
          )}
          {form?.form_id && !form.form_id.startsWith('tmp-') && (
            <button onClick={() => setShowDelete(true)} className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition shadow-sm">
              Delete
            </button>
          )}
          <button onClick={handlePublishClick} className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition shadow-sm ${isDraft ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isDraft ? 'Publish' : 'Manage Groups'}
          </button>
        </div>
      </div>

      {/* #4 — Validation errors panel */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
          <p className="text-xs font-bold text-rose-700 mb-1">Please fix the following before {validationContext}:</p>
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs text-rose-600 flex items-center gap-1.5"><AlertIco /> {err}</p>
          ))}
        </div>
      )}

      {!isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
          This form is published and cannot be edited. Use <strong>Manage Groups</strong> to remove it from all groups, which will revert it to a draft.
        </div>
      )}

      {mode === 'edit' ? (
        <div className="flex-1 overflow-y-auto pr-1">
          <div className={`rounded-xl border p-5 mb-4 shadow-sm ${!isDraft ? 'pointer-events-none bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Form title…"
              className={`w-full text-lg font-bold text-slate-800 bg-transparent border-0 border-b-2 pb-2 focus:outline-none transition placeholder-slate-300 ${
                !title.trim() && validationErrors.length > 0 ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
              }`} />
            <textarea value={desc} onChange={(e) => handleDescChange(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full text-sm text-slate-600 bg-transparent border-0 border-b border-slate-100 mt-3 pb-1 focus:outline-none focus:border-blue-400 transition resize-none placeholder-slate-300" />
          </div>

          {/* Multi-select toolbar for questions */}
          {fields.length > 0 && (
            <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-2.5 mb-3 transition-all ${
              selected.size > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'
            }`}>
              <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={selected.size === fields.length && fields.length > 0} onChange={selectAll}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                {selected.size > 0
                  ? <span className="font-medium text-rose-600">{selected.size} question{selected.size > 1 ? 's' : ''} selected</span>
                  : <span className="text-slate-400">Select questions</span>}
              </label>
              {selected.size > 0 && (
                <button onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-100 hover:bg-rose-200 rounded-lg transition">
                  <TrashIco /> Delete Selected
                </button>
              )}
            </div>
          )}

          {fields.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No questions yet</p>
              <p className="text-xs mt-1">Add your first question below</p>
            </div>
          )}
          <div className="space-y-2.5 mb-4">
            {fields.map((f, i) => (
              <FieldCard key={f.id} field={f} index={i} total={fields.length}
                isExpanded={expanded === f.id}
                isSelected={selected.has(f.id)}
                hasError={validationErrorIds.has(f.id)}
                readOnly={!isDraft}
                onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                onSelect={() => toggleSelect(f.id)}
                onUpdate={(data) => updateField(f.id, data)}
                onRemove={() => removeField(f.id)}
                onDuplicate={() => duplicateField(f.id)}
                onMove={(dir) => moveField(i, dir)}
                onDragStart={onDragStart}
                onDragOver={() => {}}
                onDrop={onDrop}
                dataElements={dataElements}
                onDataElementCreated={onDataElementCreated} />
            ))}
          </div>
          {fields.length < MAX_FIELDS ? (
            <button onClick={() => setShowAdd(true)} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2">
              <PlusIco /> Add Question <span className="text-xs font-normal opacity-60">{fields.length} / {MAX_FIELDS}</span>
            </button>
          ) : (
            <div className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 flex items-center justify-center gap-2">
              Maximum of {MAX_FIELDS} questions reached
            </div>
          )}
          {showAdd && <AddFieldPanel onAdd={addField} onClose={() => setShowAdd(false)} />}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto"><PreviewView title={title} description={desc} fields={fields} /></div>
      )}

      {showPublish && (
        <PublishModal title={title} onClose={() => setShowPublish(false)} deployedGroupIds={form?.deployed_group_ids || []} onConfirm={(groupIds, prevDeployed) => onPublish({ ...form, title, description: desc, fields }, groupIds, prevDeployed)} />
      )}

      {showDelete && (
        <ConfirmModal title={`Delete "${title || 'Untitled Form'}"`}
          message="This form will be removed from the builder. Any participant responses already submitted will be preserved in the query data."
          confirmLabel="Delete" confirmClass="bg-rose-600 hover:bg-rose-700"
          onConfirm={() => { onDelete(form.form_id); setShowDelete(false); }} onClose={() => setShowDelete(false)} />
      )}


      {/* #1 — Unsaved changes modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUnsavedModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Svg size={24} sw={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="#d97706" />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center mb-1">Unsaved changes</h3>
              <p className="text-sm text-slate-500 text-center">You have changes that haven't been saved. What would you like to do?</p>
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <button onClick={() => { handleSaveDraft(); setShowUnsavedModal(false); }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
                Save &amp; Leave
              </button>
              <button onClick={() => { setShowUnsavedModal(false); isDirtyRef.current = false; onBack(); }}
                className="w-full py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition">
                Discard &amp; Leave
              </button>
              <button onClick={() => setShowUnsavedModal(false)}
                className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition">
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   ══════════════════════════════════════════════ */
export default function SurveyBuilderPage() {
  const [forms, setForms]             = useState([]);
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState('list');
  const [editingForm, setEditingForm] = useState(null);
  const [toast, setToast]             = useState(null);
  const [dataElements, setDataElements] = useState([]);

  useEffect(() => { api.listElements().then(setDataElements).catch(() => {}); }, []);

  const loadForms = async () => {
    try {
      const data = await api.listForms();
      setForms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await api.listGroups();
      setGroups(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadForms();
    loadGroups();
    // Restore builder session after a page refresh
    try {
      const session = localStorage.getItem('hdb_builder_session');
      if (session) {
        const { formId, form } = JSON.parse(session);
        // For new forms, restore from draft if available
        const draftKey = `hdb_builder_draft_${formId}`;
        const draft = localStorage.getItem(draftKey);
        if (draft) {
          const { title, description, fields } = JSON.parse(draft);
          setEditingForm({ ...(form || {}), title, description, fields });
        } else {
          setEditingForm(form);
        }
        setView('builder');
      }
    } catch { /* ignore */ }
  }, []);

  /* Infer role context from URL path for display purposes */
  const isAdminContext = window.location.pathname.startsWith('/surveys');
  const pageTitle = isAdminContext ? 'Survey Management' : 'Survey Forms';

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleEdit = async (form) => {
    try {
      const fullForm = await api.getFormDetail(form.form_id);
      const transformed = transformForEdit(fullForm);
      localStorage.setItem('hdb_builder_session', JSON.stringify({ formId: fullForm.form_id, form: transformed }));
      setEditingForm(transformed);
      setView('builder');
    } catch (err) {
      showToast('Error loading form');
    }
  };

  const handleCreate = () => {
    localStorage.setItem('hdb_builder_session', JSON.stringify({ formId: 'new', form: null }));
    setEditingForm(null);
    setView('builder');
  };
  const handleBack = () => {
    localStorage.removeItem('hdb_builder_session');
    setView('list');
    setEditingForm(null);
    loadForms();
  };

  const handleSave = async (formData) => {
    try {
      const payload = transformForSave(formData);
      if (formData.form_id && !formData.form_id.startsWith('tmp-')) {
        await api.updateForm(formData.form_id, payload);
      } else {
        await api.createForm(payload);
      }
      showToast('Draft saved!');
      handleBack();
    } catch (err) {
      showToast(err.message || 'Error saving form');
    }
  };

  const handlePublishFromBuilder = async (formData, groupIds, prevDeployed = new Set()) => {
    try {
      let formId = formData.form_id;
      if (!formId || formId.startsWith('tmp-')) {
        const payload = transformForSave(formData);
        const newForm = await api.createForm(payload);
        formId = newForm.form_id;
      }
      const finalIds = new Set(Array.isArray(groupIds) ? groupIds : [groupIds]);
      const toPublish   = [...finalIds].filter((gid) => !prevDeployed.has(gid));
      const toUnpublish = [...prevDeployed].filter((gid) => !finalIds.has(gid));
      if (finalIds.size === 0 && prevDeployed.size > 0) {
        await api.unpublishForm(formId);
      } else {
        await Promise.all([
          ...toPublish.map((gid) => api.publishForm(formId, gid)),
          ...toUnpublish.map((gid) => api.unpublishFormFromGroup(formId, gid)),
        ]);
      }
      showToast('Group assignments saved!');
      handleBack();
    } catch (err) {
      showToast(err.message || 'Error saving group assignments');
    }
  };

  const handleDelete = async (formId) => {
    try {
      await api.deleteForm(formId);
      setForms((prev) => prev.filter((f) => f.form_id !== formId));
      if (view === 'builder') handleBack();
      showToast('Form deleted');
    } catch (err) {
      showToast('Error deleting form');
    }
  };

  const handlePublishFromList = async (formId, groupIds) => {
    try {
      const ids = Array.isArray(groupIds) ? groupIds : [groupIds];
      await Promise.all(ids.map((gid) => api.publishForm(formId, gid)));
      showToast(ids.length > 1 ? `Published to ${ids.length} groups!` : 'Form published!');
      loadForms();
    } catch (err) {
      showToast('Error publishing form');
    }
  };

  const handleUnpublish = async (formId) => {
    try {
      await api.unpublishForm(formId);
      showToast('Form unpublished');
      loadForms();
    } catch (err) {
      showToast('Error unpublishing form');
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6"><div className="h-7 w-40 bg-slate-200 rounded-lg animate-pulse" /><div className="h-10 w-28 bg-slate-200 rounded-xl animate-pulse" /></div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
            <div className="flex items-center gap-2.5 mb-2"><div className="h-5 w-2/3 bg-slate-200 rounded" /><div className="h-5 w-16 bg-slate-100 rounded-full" /></div>
            <div className="h-4 w-full bg-slate-100 rounded mb-3" />
            <div className="flex items-center gap-3"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-3 w-16 bg-slate-100 rounded" /><div className="h-3 w-24 bg-slate-100 rounded" /></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {view === 'list' && (
        <FormListView
          forms={forms}
          groups={groups}
          onEdit={handleEdit}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onPublish={handlePublishFromList}
          onUnpublish={handleUnpublish}
          pageTitle={pageTitle}
        />
      )}
      {view === 'builder' && (
        <BuilderView
          form={editingForm}
          onSave={handleSave}
          onBack={handleBack}
          onPublish={handlePublishFromBuilder}
          onUnpublish={handleUnpublish}
          onDelete={handleDelete}
          dataElements={dataElements}
          onDataElementCreated={(el) => setDataElements((prev) => [...prev, el])}

        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[toastSlideUp_0.3s_ease-out]">
          <div className="bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>
        </div>
      )}
    </div>
  );
}

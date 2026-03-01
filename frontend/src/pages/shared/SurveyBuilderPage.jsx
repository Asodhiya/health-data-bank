import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FieldInput from '../../components/survey/FieldInput';
import { FieldCard, AddFieldPanel, FIELD_TYPES, newField, uid } from '../../components/survey/FieldEditor';
import { api } from '../../services/api';

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
const XIco         = () => <Svg size={14} sw={2} d="M18 6L6 18M6 6l12 12" />;
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
   ══════════════════════════════════════════════ */
function FormListView({ forms, onEdit, onCreate, onDelete, onPublish, onUnpublish, groups }) {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [groupFilter, setGroupFilter]   = useState('ALL');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [selected, setSelected]         = useState(new Set());
  const [modal, setModal]               = useState(null);
  const [publishGroup, setPublishGroup] = useState('');

  const hasDateFilter  = dateFrom || dateTo;
  const hasGroupFilter = groupFilter !== 'ALL';
  const activeFilterCount = (hasDateFilter ? 1 : 0) + (hasGroupFilter ? 1 : 0);

  const filtered = forms.filter((f) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchGroup  = groupFilter === 'ALL' || f.group_id === groupFilter;
    const matchFrom   = !dateFrom || f.created_at >= dateFrom;
    const matchTo     = !dateTo   || f.created_at <= dateTo;
    return matchSearch && matchStatus && matchGroup && matchFrom && matchTo;
  });

  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.form_id)));
  };
  const clearFilters = () => { setDateFrom(''); setDateTo(''); setGroupFilter('ALL'); setShowFilters(false); };

  /* ── Selection-derived values ── */
  const selectedForms     = forms.filter((f) => selected.has(f.form_id));
  const selectedDrafts    = selectedForms.filter((f) => f.status === 'DRAFT');
  const selectedPublished = selectedForms.filter((f) => f.status === 'PUBLISHED');

  /* ── Confirm handlers ── */
  const handleConfirmDelete = () => {
    modal.ids.forEach((id) => onDelete(id));
    setSelected((prev) => { const n = new Set(prev); modal.ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
  };

  const handleConfirmPublish = () => {
    if (!publishGroup) return;
    modal.ids.forEach((id) => {
      const f = forms.find((x) => x.form_id === id);
      if (f && f.status === 'DRAFT') onPublish(id, publishGroup);
    });
    setSelected((prev) => { const n = new Set(prev); modal.ids.forEach((id) => n.delete(id)); return n; });
    setModal(null);
    setPublishGroup('');
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

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Survey Forms</h2>
          <p className="text-sm text-slate-500 mt-0.5">{forms.length} forms total</p>
        </div>
        <button onClick={onCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
          <PlusIco /> New Form
        </button>
      </div>

      {/* Search + Status + Filters toggle */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIco /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {['ALL', 'DRAFT', 'PUBLISHED'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${statusFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shrink-0 ${
              activeFilterCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}>
            <FilterIco />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Created After</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Created Before</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Group</label>
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition min-w-[200px]">
                  <option value="ALL">All Groups</option>
                  {groups.map((g) => (
                    <option key={g.group_id} value={g.group_id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {(hasDateFilter || hasGroupFilter) && (
                <button onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-rose-500 font-medium transition pb-1">Clear all filters</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multi-select toolbar */}
      <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-2.5 mb-3 transition-all ${
        selected.size > 0 ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'
      }`}>
        <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={selectAll}
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
        {filtered.map((form) => {
          const isSel = selected.has(form.form_id);
          const fieldCount = form.fields ? form.fields.length : 0;
          return (
            <div key={form.form_id}
              className={`bg-white rounded-xl border p-4 sm:p-5 shadow-sm hover:shadow-md cursor-pointer transition-all group ${
                isSel ? 'border-blue-300 ring-1 ring-blue-100' :
                form.status === 'DRAFT' ? 'border-l-4 border-amber-400 border-t border-r border-b border-t-slate-200 border-r-slate-200 border-b-slate-200' :
                'border-slate-200 hover:border-slate-300'
              }`}>
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <input type="checkbox" checked={isSel}
                  onChange={() => toggleSelect(form.form_id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-400 shrink-0 cursor-pointer" />

                {/* Content — clicking opens editor */}
                <div className="flex-1 min-w-0" onClick={() => onEdit(form)}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{form.title}</h3>
                    <StatusBadge status={form.status} />
                  </div>

                  {form.description && <p className="text-xs text-slate-500 line-clamp-1">{form.description}</p>}

                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1"><CalIco /> {new Date(form.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>·</span>
                    <span>{fieldCount} question{fieldCount !== 1 ? 's' : ''}</span>

                    {form.status === 'DRAFT' && form.updated_at && (
                      <><span>·</span><span className="text-amber-500 font-medium">Edited {daysSince(form.updated_at)}</span></>
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
                      onClick={(e) => { e.stopPropagation(); setModal({ type: 'publish', ids: [form.form_id], formTitle: form.title }); }}>
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

                <span className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1 shrink-0"
                  onClick={() => onEdit(form)}>
                  <Svg size={18} d="M9 5l7 7-7 7" />
                </span>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">No forms found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* ── DELETE MODAL ── */}
      {modal?.type === 'delete' && (
        <ConfirmModal
          title={modal.ids.length === 1 ? 'Delete Form' : 'Delete Forms'}
          message={modal.formTitle
            ? `Are you sure you want to delete "${modal.formTitle}"? This action cannot be undone.`
            : `Are you sure you want to delete ${modal.ids.length} form${modal.ids.length > 1 ? 's' : ''}? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmClass="bg-rose-600 hover:bg-rose-700"
          onConfirm={handleConfirmDelete}
          onClose={() => setModal(null)}
        >
          {modal.isPublished && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 mb-2">
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5"><WarnIco /></span>
                <div>
                  <strong>Warning:</strong> {modal.ids.length === 1 ? 'This form is' : 'Some selected forms are'} currently published and available to participants.
                  Consider unpublishing first to notify assigned groups.
                  <button onClick={() => setModal({ ...modal, type: 'unpublish' })}
                    className="ml-1 underline font-semibold hover:text-amber-900 transition">Unpublish instead?</button>
                </div>
              </div>
            </div>
          )}
        </ConfirmModal>
      )}

      {/* ── PUBLISH MODAL ── */}
      {modal?.type === 'publish' && (
        <ConfirmModal
          title={modal.formTitle ? `Publish "${modal.formTitle}"` : 'Publish Forms'}
          message={modal.formTitle
            ? `Select a group to assign "${modal.formTitle}" to.`
            : `Publish ${selectedDrafts.length} draft form${selectedDrafts.length > 1 ? 's' : ''}? Select a group to assign.`}
          confirmLabel="Publish"
          confirmClass="bg-emerald-600 hover:bg-emerald-700"
          onConfirm={handleConfirmPublish}
          onClose={() => { setModal(null); setPublishGroup(''); }}
          disabled={!publishGroup}
        >
          <select value={publishGroup} onChange={(e) => setPublishGroup(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <option value="">-- Select Group --</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>{g.name}</option>
            ))}
          </select>
        </ConfirmModal>
      )}

      {/* ── UNPUBLISH MODAL ── */}
      {modal?.type === 'unpublish' && (
        <ConfirmModal
          title={modal.formTitle ? `Unpublish "${modal.formTitle}"` : 'Unpublish Forms'}
          message={modal.formTitle
            ? `Unpublish "${modal.formTitle}"? It will revert to draft status and become unavailable to participants.`
            : `Unpublish ${selectedPublished.length} form${selectedPublished.length > 1 ? 's' : ''}? They will revert to draft status and become unavailable to participants.`}
          confirmLabel="Unpublish"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          onConfirm={handleConfirmUnpublish}
          onClose={() => setModal(null)}
        >
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5"><InfoIco /></span>
              <span>Unpublished forms revert to draft status. Participants in the assigned group will no longer be able to access {modal.formTitle ? 'this form' : 'these forms'}.</span>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   PREVIEW VIEW — renders form as participant would see it
   ══════════════════════════════════════════════ */
function PreviewView({ title, description, fields }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-blue-600 rounded-t-2xl px-6 py-5 text-white">
        <h2 className="text-lg font-bold">{title || 'Untitled Form'}</h2>
        {description && <p className="text-sm text-blue-100 mt-1">{description}</p>}
        <p className="text-xs text-blue-200 mt-2">
          {fields.length} question{fields.length !== 1 && 's'} •{' '}
          <span className="text-red-200">*</span> = required
        </p>
      </div>
      <div className="bg-white border border-t-0 border-slate-200 rounded-b-2xl shadow-sm divide-y divide-slate-100">
        {fields.map((f, i) => (
          <div key={f.id} className="px-6 py-5">
            <p className="text-sm font-semibold text-slate-800 mb-1">
              <span className="text-slate-400 mr-1.5">{i + 1}.</span>
              {f.label || 'Untitled question'}
              {f.is_required && <span className="text-rose-400 ml-1">*</span>}
            </p>
            {f.description && (
              <p className="text-xs text-slate-500 mb-3 italic">{f.description}</p>
            )}
            <FieldInput field={f} value={undefined} onChange={() => {}} onToggleMulti={() => {}} disabled />
          </div>
        ))}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   PUBLISH MODAL (from builder — uses api.listGroups)
   ══════════════════════════════════════════════ */
function PublishModal({ onClose, onConfirm }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGroups().then((data) => { setGroups(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Publish Survey</h3>
        <p className="text-sm text-slate-500 mb-4">Select a group to assign this survey to.</p>
        {loading ? (
          <p className="text-sm text-slate-400">Loading groups...</p>
        ) : (
          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg mb-4 text-sm">
            <option value="">-- Select Group --</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>{g.name}</option>
            ))}
          </select>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 font-medium">Cancel</button>
          <button onClick={() => onConfirm(selectedGroup)} disabled={!selectedGroup}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">Publish</button>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   BUILDER VIEW
   ══════════════════════════════════════════════ */
function BuilderView({ form, onSave, onBack, onPublish }) {
  const [title, setTitle]       = useState(form?.title || '');
  const [desc, setDesc]         = useState(form?.description || '');
  const [fields, setFields]     = useState(form?.fields || []);
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [mode, setMode]         = useState('edit');
  const [showPublish, setShowPublish] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const isDraft = !form?.status || form.status === 'DRAFT';

  const addField = (type) => {
    const f = newField(type);
    f.display_order = fields.length;
    setFields((prev) => [...prev, f]);
    setExpanded(f.id);
  };

  const updateField = (id, data) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...data } : f)));

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (expanded === id) setExpanded(null);
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
  };

  const moveField = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next.map((f, i) => ({ ...f, display_order: i })));
  };

  const handleSaveDraft = () => {
    onSave({ ...form, title, description: desc, fields });
  };

  /* ── Multi-select for questions ── */
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
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition">
          <BackIco /> All Forms
        </button>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            <button onClick={() => setMode('edit')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${mode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Edit</button>
            <button onClick={() => setMode('preview')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${mode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Preview</button>
          </div>
          <button onClick={handleSaveDraft} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm">Save Draft</button>
          {isDraft && (
            <button onClick={() => setShowPublish(true)} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm">Publish</button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title…" className="w-full text-lg font-bold text-slate-800 bg-transparent border-0 border-b-2 border-slate-200 pb-2 focus:outline-none focus:border-blue-500 transition placeholder-slate-300" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full text-sm text-slate-600 bg-transparent border-0 border-b border-slate-100 mt-3 pb-1 focus:outline-none focus:border-blue-400 transition resize-none placeholder-slate-300" />
          </div>

          {/* Multi-select toolbar for questions */}
          {fields.length > 0 && (
            <div className={`flex items-center justify-between bg-white border rounded-xl px-4 py-2.5 mb-3 transition-all ${
              selected.size > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'
            }`}>
              <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox"
                  checked={selected.size === fields.length && fields.length > 0}
                  onChange={selectAll}
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
            </div>
          )}
          <div className="space-y-2.5 mb-4">
            {fields.map((f, i) => (
              <FieldCard key={f.id} field={f} index={i} total={fields.length}
                isExpanded={expanded === f.id}
                isSelected={selected.has(f.id)}
                onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                onSelect={() => toggleSelect(f.id)}
                onUpdate={(data) => updateField(f.id, data)}
                onRemove={() => removeField(f.id)}
                onDuplicate={() => duplicateField(f.id)}
                onMove={(dir) => moveField(i, dir)} />
            ))}
          </div>
          <button onClick={() => setShowAdd(true)} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"><PlusIco /> Add Question</button>
          {showAdd && <AddFieldPanel onAdd={addField} onClose={() => setShowAdd(false)} />}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto"><PreviewView title={title} description={desc} fields={fields} /></div>
      )}

      {showPublish && (
        <PublishModal onClose={() => setShowPublish(false)} onConfirm={(groupId) => onPublish(form, groupId)} />
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

  useEffect(() => { loadForms(); loadGroups(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleEdit = async (form) => {
    try {
      const fullForm = await api.getFormDetail(form.form_id);
      setEditingForm(transformForEdit(fullForm));
      setView('builder');
    } catch (err) {
      showToast('Error loading form');
    }
  };

  const handleCreate = () => { setEditingForm(null); setView('builder'); };
  const handleBack   = () => { setView('list'); setEditingForm(null); loadForms(); };

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
      showToast('Error saving form');
    }
  };

  const handlePublishFromBuilder = async (formData, groupId) => {
    try {
      let formId = formData.form_id;
      if (!formId || formId.startsWith('tmp-')) {
        const payload = transformForSave(formData);
        const newForm = await api.createForm(payload);
        formId = newForm.form_id;
      } else {
        const payload = transformForSave(formData);
        await api.updateForm(formId, payload);
      }
      await api.publishForm(formId, groupId);
      showToast('Form published!');
      handleBack();
    } catch (err) {
      showToast('Error publishing form');
    }
  };

  /* ── List-level actions (called from FormListView) ── */
  const handleDelete = async (formId) => {
    try {
      await api.deleteForm(formId);
      setForms((prev) => prev.filter((f) => f.form_id !== formId));
      showToast('Form deleted');
    } catch (err) {
      showToast('Error deleting form');
    }
  };

  const handlePublishFromList = async (formId, groupId) => {
    try {
      await api.publishForm(formId, groupId);
      showToast('Form published!');
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

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-slate-400 text-base">Loading forms...</p></div>;

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
        />
      )}
      {view === 'builder' && (
        <BuilderView form={editingForm} onSave={handleSave} onBack={handleBack} onPublish={handlePublishFromBuilder} />
      )}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-bounce">{toast}</div>}
    </div>
  );
}

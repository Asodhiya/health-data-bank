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

const PlusIco   = () => <Svg d="M12 5v14M5 12h14" />;
const SearchIco = () => <Svg size={16} d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />;
const CalIco    = () => <Svg size={15} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const XIco      = () => <Svg size={14} sw={2} d="M18 6L6 18M6 6l12 12" />;
const BackIco   = () => <Svg size={16} d="M19 12H5M12 19l-7-7 7-7" />;

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
          return {
            label: labels[i] || '',
            value: val,
            display_order: i + 1
          };
        });
        return {
          ...f,
          options: generatedOptions,
          likertMin: undefined, likertMax: undefined, likertLabels: undefined
        };
      }
      return {
        ...f,
        options: f.options.map((o, i) => ({
          label: o.label,
          value: parseInt(o.value) || (i + 1),
          display_order: i + 1
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
        return {
          ...f,
          id: f.field_id || f.id,
          likertMin: min,
          likertMax: max,
          likertLabels: labels,
          options: []
        };
      }
      return {
        ...f,
        id: f.field_id || f.id,
        options: f.options.map(o => ({
          ...o,
          id: o.option_id || uid()
        }))
      };
    })
  };
};


/* ══════════════════════════════════════════════
   FORM LIST VIEW
   ══════════════════════════════════════════════ */
function FormListView({ forms, onEdit, onCreate }) {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const hasDateFilter = dateFrom || dateTo;

  const filtered = forms.filter((f) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchFrom   = !dateFrom || f.created_at >= dateFrom;
    const matchTo     = !dateTo   || f.created_at <= dateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  const clearDates = () => { setDateFrom(''); setDateTo(''); setShowDateFilter(false); };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Survey Forms</h2>
          <p className="text-sm text-slate-500 mt-0.5">{forms.length} forms total</p>
        </div>
        <button onClick={onCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
            px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
          <PlusIco /> New Form
        </button>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIco /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {['ALL', 'DRAFT', 'PUBLISHED'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all
                  ${statusFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border
              transition-all shrink-0
              ${hasDateFilter
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}>
            <CalIco />
            {hasDateFilter ? 'Dates active' : 'Filter by date'}
            {hasDateFilter && (
              <span onClick={(e) => { e.stopPropagation(); clearDates(); }}
                className="ml-1 hover:text-rose-500 transition"><XIco /></span>
            )}
          </button>
        </div>
        {showDateFilter && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs font-semibold text-slate-500">Created between</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
            <span className="text-xs text-slate-400">and</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
            {hasDateFilter && (
              <button onClick={clearDates}
                className="text-xs text-slate-400 hover:text-rose-500 font-medium transition">Clear dates</button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map((form) => (
          <div key={form.form_id} onClick={() => onEdit(form)}
            className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm
              hover:shadow-md hover:border-slate-300 cursor-pointer transition-all group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="text-sm font-bold text-slate-800 truncate
                    group-hover:text-blue-600 transition-colors">{form.title}</h3>
                  <StatusBadge status={form.status} />
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">{form.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>{form.fields ? form.fields.length : 0} fields</span>
                  <span>Created {new Date(form.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <span className="text-slate-300 group-hover:text-blue-500 transition-colors mt-1">
                <Svg size={18} d="M9 5l7 7-7 7" />
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">No forms found</p>
          </div>
        )}
      </div>
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
            <p className="text-sm font-semibold text-slate-800 mb-3">
              <span className="text-slate-400 mr-1.5">{i + 1}.</span>
              {f.label || 'Untitled question'}
              {f.is_required && <span className="text-rose-400 ml-1">*</span>}
            </p>
            <FieldInput field={f} value={undefined} onChange={() => {}} onToggleMulti={() => {}} disabled />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   PUBLISH MODAL
   ══════════════════════════════════════════════ */
function PublishModal({ onClose, onConfirm }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGroups().then(data => {
      setGroups(data);
      setLoading(false);
    }).catch(() => setLoading(false));
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
            {groups.map(g => (
              <option key={g.group_id} value={g.group_id}>{g.name}</option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 font-medium">Cancel</button>
          <button onClick={() => onConfirm(selectedGroup)} disabled={!selectedGroup}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">
            Publish
          </button>
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
          {fields.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No questions yet</p>
            </div>
          )}
          <div className="space-y-2.5 mb-4">
            {fields.map((f, i) => (
              <FieldCard key={f.id} field={f} index={i} total={fields.length} isExpanded={expanded === f.id} onToggle={() => setExpanded(expanded === f.id ? null : f.id)} onUpdate={(data) => updateField(f.id, data)} onRemove={() => removeField(f.id)} onDuplicate={() => duplicateField(f.id)} onMove={(dir) => moveField(i, dir)} />
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

  useEffect(() => { loadForms(); }, []);

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

  const handlePublish = async (formData, groupId) => {
    try {
      // Ensure saved first? Usually good practice, but let's assume it's saved or we save it now.
      // For simplicity, we just publish the ID. If it's new, we must create it first.
      let formId = formData.form_id;
      if (!formId || formId.startsWith('tmp-')) {
        const payload = transformForSave(formData);
        const newForm = await api.createForm(payload);
        formId = newForm.form_id;
      } else {
        // Update before publish to ensure latest changes
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

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-slate-400 text-base">Loading forms...</p></div>;

  return (
    <div className="max-w-4xl mx-auto">
      {view === 'list' && <FormListView forms={forms} onEdit={handleEdit} onCreate={handleCreate} />}
      {view === 'builder' && <BuilderView form={editingForm} onSave={handleSave} onBack={handleBack} onPublish={handlePublish} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-bounce">{toast}</div>}
    </div>
  );
}

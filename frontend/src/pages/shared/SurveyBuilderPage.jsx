import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FieldInput from '../../components/survey/FieldInput';
import { FieldCard, AddFieldPanel, FIELD_TYPES, newField, uid } from '../../components/survey/FieldEditor';
// import { api } from '../../services/api';   // uncomment when backend is ready

/*
  SurveyBuilderPage — form management for researcher & admin.

  Route:  /survey-builder   (registered under both ResearcherRoute and AdminRoute)
  Layout: renders inside DashboardLayout <Outlet /> (has sidebar)

  Modes:  "list"    → form list with search, status filter, date filter
          "builder" → edit/create form (edit mode + preview mode toggle)

  Data flow (future):
    GET    /api/v1/form_management/list               → all forms
    GET    /api/v1/form_management/detail/:id          → single form + fields
    POST   /api/v1/form_management/create              → create new form
    PUT    /api/v1/form_management/update/:id           → update existing form
    DELETE /api/v1/form_management/delete/:id           → delete form
    POST   /api/v1/form_management/:id/publish          → publish form
    POST   /api/v1/form_management/:id/unpublish        → return to draft
*/


/* ── Mock data ── */
const MOCK_FORMS = [
  { form_id: '1', title: 'Perceived Stress Scale (PSS)', status: 'PUBLISHED', description: '10 questions about stress levels over the last month.', created_at: '2026-02-10', fields: [
    { id: 'f1', label: 'How often have you been upset because of something that happened unexpectedly?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
    { id: 'f2', label: 'How often have you felt unable to control the important things in your life?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
    { id: 'f3', label: 'How often have you felt nervous and stressed?', field_type: 'likert', is_required: true, display_order: 2, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
  ]},
  { form_id: '2', title: 'UCLA Loneliness Scale (Version 3)', status: 'DRAFT', description: '20 items measuring loneliness and social connection.', created_at: '2026-02-12', fields: [
    { id: 'f4', label: 'How often do you feel "in tune" with the people around you?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
    { id: 'f5', label: 'How often do you feel that you lack companionship?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
  ]},
  { form_id: '3', title: 'Knowledge Confidence Scale', status: 'DRAFT', description: '18 questions about confidence across health and wellness topics.', created_at: '2026-01-25', fields: [] },
  { form_id: '4', title: 'Connections Intake Questionnaire', status: 'PUBLISHED', description: 'Intake form for the Connections program.', created_at: '2026-01-15', fields: [
    { id: 'f6', label: 'Where do you live?', field_type: 'single_select', is_required: true, display_order: 0, options: [{id:'o1',label:'On campus',value:1},{id:'o2',label:'With Friends',value:2},{id:'o3',label:'With Family',value:3},{id:'o4',label:'Other',value:4}] },
    { id: 'f7', label: 'What causes stress in your life?', field_type: 'multi_select', is_required: false, display_order: 1, options: [{id:'o5',label:'School',value:1},{id:'o6',label:'Work',value:2},{id:'o7',label:'Social life',value:3},{id:'o8',label:'Home life',value:4}] },
    { id: 'f8', label: 'How many days per week of aerobic activity?', field_type: 'number', is_required: true, display_order: 2, options: [] },
    { id: 'f9', label: 'Date of Birth', field_type: 'date', is_required: true, display_order: 3, options: [] },
  ]},
];


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
      {/* Header */}
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

      {/* Search + Status filter + Date toggle */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIco /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search forms…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>

          {/* Status filter */}
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {['ALL', 'DRAFT', 'PUBLISHED'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all
                  ${statusFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Date filter toggle */}
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

        {/* Date range row */}
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

      {/* Results count */}
      {(search || statusFilter !== 'ALL' || hasDateFilter) && (
        <p className="text-xs text-slate-400 mb-3">{filtered.length} result{filtered.length !== 1 && 's'} found</p>
      )}

      {/* Form cards */}
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
                  <span>{form.fields.length} field{form.fields.length !== 1 && 's'}</span>
                  <span>Created {form.created_at}</span>
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
            <p className="text-sm">Try adjusting your search or filters</p>
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
        {fields.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400 text-sm">No questions to preview</div>
        )}
        {fields.length > 0 && (
          <div className="px-6 py-4">
            <button disabled className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl opacity-60 cursor-not-allowed">
              Submit (Preview Only)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   BUILDER VIEW — edit + preview toggle
   ══════════════════════════════════════════════ */
function BuilderView({ form, onSave, onBack }) {
  const [title, setTitle]       = useState(form?.title || '');
  const [desc, setDesc]         = useState(form?.description || '');
  const [fields, setFields]     = useState(form?.fields || []);
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [mode, setMode]         = useState('edit'); // 'edit' | 'preview'

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
    const dup = {
      ...src,
      id: uid(),
      label: src.label + ' (copy)',
      options: src.options.map((o) => ({ ...o, id: uid() })),
    };
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

  const handleSave = (status) => {
    onSave({
      ...(form || {}),
      form_id: form?.form_id || uid(),
      title,
      description: desc,
      fields,
      status,
      created_at: form?.created_at || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition">
          <BackIco /> All Forms
        </button>
        <div className="flex items-center gap-2">
          {/* Edit / Preview toggle */}
          <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            <button onClick={() => setMode('edit')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition
                ${mode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Edit
            </button>
            <button onClick={() => setMode('preview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition
                ${mode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
              Preview
            </button>
          </div>

          <button onClick={() => handleSave('DRAFT')}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200
              rounded-xl hover:bg-slate-50 transition shadow-sm">
            Save Draft
          </button>
          {isDraft && (
            <button onClick={() => handleSave('PUBLISHED')}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700
                rounded-xl transition shadow-sm">
              Publish
            </button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        /* ── EDIT MODE ── */
        <div className="flex-1 overflow-y-auto pr-1">
          {/* Form meta */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Form title…"
              className="w-full text-lg font-bold text-slate-800 bg-transparent border-0 border-b-2
                border-slate-200 pb-2 focus:outline-none focus:border-blue-500 transition placeholder-slate-300" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Description (optional)" rows={2}
              className="w-full text-sm text-slate-600 bg-transparent border-0 border-b border-slate-100
                mt-3 pb-1 focus:outline-none focus:border-blue-400 transition resize-none placeholder-slate-300" />
          </div>

          {/* Field list */}
          {fields.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">No questions yet</p>
              <p className="text-sm mt-1">Click below to add your first question</p>
            </div>
          )}

          <div className="space-y-2.5 mb-4">
            {fields.map((f, i) => (
              <FieldCard key={f.id} field={f} index={i} total={fields.length}
                isExpanded={expanded === f.id}
                onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
                onUpdate={(data) => updateField(f.id, data)}
                onRemove={() => removeField(f.id)}
                onDuplicate={() => duplicateField(f.id)}
                onMove={(dir) => moveField(i, dir)} />
            ))}
          </div>

          {/* Add question button */}
          <button onClick={() => setShowAdd(true)}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm
              font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600
              hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2">
            <PlusIco /> Add Question
          </button>

          {showAdd && <AddFieldPanel onAdd={addField} onClose={() => setShowAdd(false)} />}
        </div>
      ) : (
        /* ── PREVIEW MODE ── */
        <div className="flex-1 overflow-y-auto">
          <PreviewView title={title} description={desc} fields={fields} />
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
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState('list');  // 'list' | 'builder'
  const [editingForm, setEditingForm] = useState(null);
  const [toast, setToast]             = useState(null);

  useEffect(() => {
    /*
      TODO: Replace with real API call:
        const data = await api.listForms();
        setForms(data);
    */
    const timer = setTimeout(() => {
      setForms(MOCK_FORMS);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleEdit   = (form) => { setEditingForm(form); setView('builder'); };
  const handleCreate = ()     => { setEditingForm(null); setView('builder'); };
  const handleBack   = ()     => { setView('list'); setEditingForm(null); };

  const handleSave = (formData) => {
    /*
      TODO: Replace with real API call:
        if (formData.form_id.startsWith('tmp-')) {
          await api.createForm(formData);     // POST /create
        } else {
          await api.updateForm(formData);     // PUT /update/:id
        }
        if (formData.status === 'PUBLISHED') {
          await api.publishForm(formData.form_id, groupId);
        }
    */
    setForms((prev) => {
      const exists = prev.find((f) => f.form_id === formData.form_id);
      if (exists) return prev.map((f) => (f.form_id === formData.form_id ? formData : f));
      return [formData, ...prev];
    });
    showToast(formData.status === 'PUBLISHED' ? 'Form published!' : 'Draft saved!');
    setView('list');
    setEditingForm(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-base">Loading forms...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {view === 'list' && (
        <FormListView forms={forms} onEdit={handleEdit} onCreate={handleCreate} />
      )}
      {view === 'builder' && (
        <BuilderView form={editingForm} onSave={handleSave} onBack={handleBack} />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white
          px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}

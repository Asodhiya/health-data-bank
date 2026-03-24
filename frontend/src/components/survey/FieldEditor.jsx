/*
  Survey Builder sub-components — used by SurveyBuilderPage.

  Exports:
    FieldCard      – collapsible field editor card (with drag handle)
    AddFieldPanel  – modal to pick a new field type
    FIELD_TYPES    – registry of available types
    newField       – factory to create a blank field
    uid            – unique ID generator
*/
import { useState, useMemo } from 'react';
import { api } from '../../services/api';

/* ── SVG helper — matches project pattern ── */
const Svg = ({ d, size = 18, sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const PlusIco  = () => <Svg d="M12 5v14M5 12h14" />;
const TrashIco = () => <Svg size={16} d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />;
const ChevUp   = () => <Svg size={14} d="M18 15l-6-6-6 6" />;
const ChevDn   = () => <Svg size={14} d="M6 9l6 6 6-6" />;
const CopyIco  = () => <Svg size={15} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2V6a2 2 0 012-2" />;
const GripIco  = () => <Svg size={16} sw={2} d={<><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>} />;


/* ═══════════════════════════════════════════
   FIELD TYPE REGISTRY
   ═══════════════════════════════════════════ */
export const FIELD_TYPES = [
  { value: 'likert',        label: 'Likert Scale',     icon: '⊞', desc: 'Rating row (1–5, 0–4, etc.)' },
  { value: 'single_select', label: 'Single Choice',    icon: '◉', desc: 'Pick one (radio)' },
  { value: 'multi_select',  label: 'Multiple Choice',  icon: '☑', desc: 'Pick many (checkbox)' },
  { value: 'text',          label: 'Text Input',       icon: 'Tt', desc: 'Short or long answer' },
  { value: 'number',        label: 'Number',           icon: '#',  desc: 'Numeric value' },
  { value: 'date',          label: 'Date',             icon: '📅', desc: 'Date picker' },
  { value: 'dropdown',      label: 'Dropdown',         icon: '▾',  desc: 'Select menu' },
];


/* ═══════════════════════════════════════════
   FACTORY — create a blank field
   ═══════════════════════════════════════════ */
let _counter = 0;
export const uid = () => `tmp-${Date.now()}-${_counter++}`;

const defaultOpt = (i) => ({ id: uid(), label: `Option ${i + 1}`, value: i + 1 });

export function newField(type) {
  return {
    id: uid(),
    label: '',
    description: '',
    field_type: type,
    is_required: false,
    display_order: 0,
    element_id: null,
    options: ['single_select', 'multi_select', 'dropdown'].includes(type)
      ? [defaultOpt(0), defaultOpt(1)]
      : [],
    likertMin: 1,
    likertMax: 5,
    likertLabels: type === 'likert'
      ? ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']
      : [],
  };
}


/* ═══════════════════════════════════════════
   OPTION EDITOR — for single/multi/dropdown
   ═══════════════════════════════════════════ */
function OptionEditor({ options, onChange }) {
  const update = (i, key, val) => {
    const next = [...options];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const add    = () => onChange([...options, defaultOpt(options.length)]);
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Answer Options</p>
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2 group/opt">
          <span className="text-xs text-slate-400 w-5 text-right font-mono">{i + 1}.</span>
          <input value={opt.label} onChange={(e) => update(i, 'label', e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
          <input type="number" value={opt.value}
            onChange={(e) => update(i, 'value', parseInt(e.target.value) || 0)}
            title="Score value"
            className="w-14 px-2 py-1.5 text-sm border border-slate-200 rounded-lg text-center bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
          {options.length > 2 && (
            <button onClick={() => remove(i)}
              className="text-slate-300 hover:text-rose-500 transition p-0.5
                opacity-0 group-hover/opt:opacity-100">
              <TrashIco />
            </button>
          )}
        </div>
      ))}
      <button onClick={add}
        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition mt-1">
        <PlusIco /> Add option
      </button>
    </div>
  );
}


/* ═══════════════════════════════════════════
   LIKERT CONFIG — scale range + labels
   ═══════════════════════════════════════════ */
const LIKERT_MIN = 1;

function LikertConfig({ field, onChange }) {
  const updateLabel = (i, val) => {
    const next = [...(field.likertLabels || [])];
    next[i] = val;
    onChange({ ...field, likertLabels: next });
  };

  const syncLabels = (max) => {
    const count = max - LIKERT_MIN + 1;
    const existing = field.likertLabels || [];
    return Array.from({ length: count }, (_, i) => existing[i] || `Label ${i + 1}`);
  };

  const count = (field.likertMax ?? 5) - LIKERT_MIN + 1;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Likert Scale</p>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500">Max value</label>
        <input type="number" min={2} max={10} value={field.likertMax ?? 5}
          onChange={(e) => {
            const v = Math.max(2, parseInt(e.target.value) || 5);
            onChange({ ...field, likertMax: v, likertMin: LIKERT_MIN, likertLabels: syncLabels(v) });
          }}
          className="w-24 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-slate-500">Scale labels ({count})</label>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-5 text-right font-mono">
              {LIKERT_MIN + i}
            </span>
            <input value={(field.likertLabels || [])[i] || ''}
              onChange={(e) => updateLabel(i, e.target.value)}
              placeholder={`Label for ${(field.likertMin ?? 0) + i}`}
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
          </div>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   DATA ELEMENT SELECTOR — searchable dropdown
   ═══════════════════════════════════════════ */
function DataElementSelector({ value, dataElements = [], onChange, onCreated }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDatatype, setNewDatatype] = useState('numeric');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dataElements.filter(
      (e) => e.label?.toLowerCase().includes(q) || e.code?.toLowerCase().includes(q)
    );
  }, [search, dataElements]);

  const selected = dataElements.find((e) => e.element_id === value);

  const handleCreate = async () => {
    if (!newLabel.trim() || !newCode.trim()) { setCreateError('Label and code are required'); return; }
    setSaving(true);
    setCreateError('');
    try {
      const el = await api.createDataElement({ label: newLabel.trim(), code: newCode.trim().toLowerCase().replace(/\s+/g, '_'), datatype: newDatatype });
      onCreated?.(el);
      onChange(el.element_id);
      setCreating(false);
      setOpen(false);
      setNewLabel(''); setNewCode(''); setNewDatatype('numeric');
    } catch (e) {
      setCreateError(e.message || 'Failed to create element');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Link Data Element</label>
        {!value && <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">• Required</span>}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <div
          onClick={() => { setOpen((o) => !o); setCreating(false); }}
          className={`flex-1 flex items-center justify-between px-3 py-2 text-sm border rounded-lg cursor-pointer transition
            ${value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
          <span className="truncate">{selected ? `${selected.label || selected.code}` : 'Select a data element…'}</span>
          <Svg size={14} d="M6 9l6 6 6-6" />
        </div>
        {value && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            title="Remove link"
            className="p-2 text-slate-400 hover:text-rose-500 transition shrink-0">
            <Svg size={14} sw={2.5} d="M18 6L6 18M6 6l12 12" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {!creating ? (
            <>
              <div className="p-2 border-b border-slate-100 flex gap-2">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search elements…"
                  className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
                <button
                  onClick={() => setCreating(true)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shrink-0">
                  + New
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">No elements found</p>
                )}
                {filtered.map((e) => (
                  <button key={e.element_id}
                    onClick={() => { onChange(e.element_id); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition flex items-center justify-between
                      ${e.element_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}>
                    <span className="truncate">{e.label || e.code}</span>
                    <span className="text-xs text-slate-400 ml-2 shrink-0">{e.code}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Create New Data Element</p>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Blood Pressure)"
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)}
                placeholder="Code (e.g. blood_pressure)"
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              <select value={newDatatype} onChange={(e) => setNewDatatype(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-white">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
              </select>
              {createError && <p className="text-xs text-rose-500">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setCreating(false)} className="flex-1 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition">Cancel</button>
                <button onClick={handleCreate} disabled={saving}
                  className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition">
                  {saving ? 'Creating…' : 'Create & Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   FIELD CARD — collapsible editor for one field.
   Supports drag-and-drop via native HTML5 DnD.
   ═══════════════════════════════════════════ */
export function FieldCard({
  field, index, total, isExpanded, isSelected,
  onToggle, onSelect, onUpdate, onRemove, onDuplicate, onMove,
  onDragStart, onDragOver, onDrop, dataElements = [], onDataElementCreated,
}) {
  const [showDesc, setShowDesc] = useState(false);
  const info = FIELD_TYPES.find((t) => t.value === field.field_type) || {};
  const hasOpts = ['single_select', 'multi_select', 'dropdown'].includes(field.field_type);
  const isLikert = field.field_type === 'likert';
  const hasDescription = !!(field.description);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart?.(index);
      }}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(index); }}
      className={`bg-white rounded-xl border transition-all duration-200
        ${isSelected
          ? 'border-rose-300 ring-1 ring-rose-100'
          : isExpanded
            ? 'border-blue-300 shadow-md ring-1 ring-blue-50'
            : 'border-slate-200 shadow-sm hover:border-slate-300'
        }`}>

      {/* Header — always visible */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle */}
        <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition shrink-0">
          <GripIco />
        </span>

        {onSelect && (
          <input type="checkbox" checked={!!isSelected}
            onChange={onSelect}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400 shrink-0 cursor-pointer" />
        )}

        <div className="flex-1 min-w-0 cursor-pointer select-none" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="text-base w-6 text-center opacity-70">{info.icon}</span>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {field.label || <span className="text-slate-400 italic">Untitled question</span>}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-8">
            {info.label}
            {field.is_required && <span className="text-rose-400 ml-1">• Required</span>}
            {hasDescription && <span className="text-blue-400 ml-1">• Has description</span>}
          </p>
        </div>
        <span className="text-xs font-mono text-slate-300 mr-1">Q{index + 1}</span>
        <div className="flex flex-col -my-1">
          <button onClick={(e) => { e.stopPropagation(); onMove(-1); }}
            disabled={index === 0}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-20 transition p-0.5">
            <ChevUp />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMove(1); }}
            disabled={index === total - 1}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-20 transition p-0.5">
            <ChevDn />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Question Text</label>
            <input value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Enter your question…"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition" />
          </div>

          <div>
            <button onClick={() => setShowDesc(!showDesc)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
              <Svg size={13} d={showDesc ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
              {showDesc ? 'Hide description' : (hasDescription ? 'Show description' : 'Add description')}
            </button>
            {showDesc && (
              <div className="mt-2">
                <textarea value={field.description || ''} onChange={(e) => onUpdate({ description: e.target.value })}
                  placeholder="Add helper text that participants will see below this question…" rows={2}
                  className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50/50
                    focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition resize-none placeholder-slate-400" />
                <p className="text-xs text-slate-400 mt-1">This description appears below the question text when participants fill out the form.</p>
              </div>
            )}
          </div>

          <DataElementSelector
            value={field.element_id || null}
            dataElements={dataElements}
            onChange={(id) => onUpdate({ element_id: id })}
            onCreated={onDataElementCreated}
          />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={field.is_required}
                onChange={(e) => onUpdate({ is_required: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
              Required
            </label>
            <div className="flex-1" />
            <button onClick={onDuplicate} className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition"><CopyIco /> Duplicate</button>
            <button onClick={onRemove} className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition"><TrashIco /> Delete</button>
          </div>

          {hasOpts && <OptionEditor options={field.options} onChange={(opts) => onUpdate({ options: opts })} />}
          {isLikert && <LikertConfig field={field} onChange={(data) => onUpdate(data)} />}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   ADD FIELD PANEL — modal to pick type
   ═══════════════════════════════════════════ */
export function AddFieldPanel({ onAdd, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Add a Field</h3>
          <p className="text-xs text-slate-500 mt-0.5">Choose a field type for your question</p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
          {FIELD_TYPES.map((t) => (
            <button key={t.value} onClick={() => { onAdd(t.value); onClose(); }}
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-200
                hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left group">
              <span className="text-xl mt-0.5 w-7 text-center group-hover:scale-110 transition-transform">{t.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

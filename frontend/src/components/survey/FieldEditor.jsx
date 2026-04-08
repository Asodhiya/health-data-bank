/*
  Survey Builder sub-components — used by SurveyBuilderPage.

  Exports:
    FieldCard      – collapsible field editor card (with drag handle)
    AddFieldPanel  – modal to pick a new field type
    FIELD_TYPES    – registry of available types
    newField       – factory to create a blank field
    uid            – unique ID generator
*/
import { useState, useMemo, useEffect, useRef } from 'react';
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
const MAX_OPTIONS = 10;

function OptionEditor({ options, onChange }) {
  const update = (i, key, val) => {
    const next = [...options];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const add    = () => { if (options.length < MAX_OPTIONS) onChange([...options, defaultOpt(options.length)]); };
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));
  const move   = (i, dir) => {
    const next = [...options];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Answer Options</p>
        <p className="text-xs text-slate-400">{options.length} / {MAX_OPTIONS}</p>
      </div>
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2 group/opt">
          <div className="flex flex-col -my-0.5 shrink-0">
            <button onClick={() => move(i, -1)} disabled={i === 0}
              className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition p-0.5">
              <ChevUp />
            </button>
            <button onClick={() => move(i, 1)} disabled={i === options.length - 1}
              className="text-slate-300 hover:text-slate-600 disabled:opacity-20 transition p-0.5">
              <ChevDn />
            </button>
          </div>
          <span className="text-xs text-slate-400 w-5 text-right font-mono shrink-0">{i + 1}.</span>
          <input value={opt.label} onChange={(e) => update(i, 'label', e.target.value)}
            placeholder={`Option ${i + 1}`}
            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
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
      {options.length < MAX_OPTIONS ? (
        <button onClick={add}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition mt-1">
          <PlusIco /> Add option
        </button>
      ) : (
        <p className="text-xs text-slate-400 mt-1">Maximum of {MAX_OPTIONS} options reached.</p>
      )}
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
export function CreateDataElementModal({ onClose, onCreated, onLinked }) {
  const [newLabel, setNewLabel] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDatatype, setNewDatatype] = useState('numeric');
  const [newDescription, setNewDescription] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const errorTimer = useRef(null);

  const showError = (msg) => {
    clearTimeout(errorTimer.current);
    setCreateError(msg);
    errorTimer.current = setTimeout(() => setCreateError(''), 10000);
  };

  useEffect(() => () => clearTimeout(errorTimer.current), []);

  const supportsUnit = newDatatype === 'numeric';

  const handleCreate = async () => {
    if (!newLabel.trim() || !newCode.trim()) { showError('Label and code are required.'); return; }
    setSaving(true);
    setCreateError('');
    try {
      const el = await api.createDataElement({
        label: newLabel.trim(),
        code: newCode.trim().toLowerCase().replace(/\s+/g, '_'),
        datatype: newDatatype,
        description: newDescription.trim() || undefined,
        unit: supportsUnit ? newUnit.trim() || undefined : undefined,
      });
      onCreated?.(el);
      onLinked(el.element_id);
      onClose();
    } catch (e) {
      showError(e.message || 'Failed to create element');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col min-h-[70vh] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Create Data Element</h3>
          <p className="text-sm text-slate-500 mt-0.5">Define a data element to link to this question. This tells the system what kind of health data this question collects, so responses can be tracked and analysed over time.</p>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Label <span className="text-rose-500">*</span></label>
            <input autoFocus value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Blood Pressure"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Code <span className="text-rose-500">*</span></label>
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. blood_pressure"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
            <p className="text-xs text-slate-400 mt-1">Unique identifier — lowercase, underscores only.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Data Type</label>
              <select value={newDatatype} onChange={(e) => {
                const nextType = e.target.value;
                setNewDatatype(nextType);
                if (nextType !== 'numeric') setNewUnit('');
              }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition bg-white">
                <option value="numeric">Numeric</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Unit</label>
              <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                disabled={!supportsUnit}
                placeholder="e.g. mmHg, kg"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              <p className="text-xs text-slate-400 mt-1">
                {supportsUnit ? 'Only numeric elements use units.' : 'Units are disabled for non-numeric elements.'}
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what this element measures and why it matters (e.g. Tracks systolic blood pressure to monitor cardiovascular health trends)…" rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none" />
          </div>
        </div>

        {createError && (
          <p className="text-xs text-rose-500 px-5 pt-3">{createError}</p>
        )}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition">
            {saving ? 'Creating…' : 'Create & Link'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchDataElementModal({ value, dataElements, onChange, onCreated, onClose }) {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dataElements.filter(
      (e) => e.label?.toLowerCase().includes(q) || e.code?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)
    );
  }, [search, dataElements]);

  if (showCreateModal) {
    return (
      <CreateDataElementModal
        onClose={() => setShowCreateModal(false)}
        onCreated={onCreated}
        onLinked={(id) => { onChange(id); onClose(); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col min-h-[70vh] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Link Data Element</h3>
          <p className="text-sm text-slate-500 mt-0.5">Select an existing element that this question measures, or create a new one.</p>
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by label, code or description…"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shrink-0">
              + New Element
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No elements found</p>
              <p className="text-xs mt-1">Try a different search or create a new element</p>
            </div>
          )}
          {filtered.map((e) => {
            const isSelected = e.element_id === value;
            return (
              <button key={e.element_id}
                onClick={() => { onChange(e.element_id); onClose(); }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  isSelected ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/40'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{e.label || e.code}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {e.unit && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{e.unit}</span>}
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{e.datatype || 'numeric'}</span>
                    {isSelected && <span className="text-xs text-emerald-600 font-semibold">✓ Linked</span>}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{e.code}</p>
                {e.description && (
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{e.description}</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DataElementSelector({ value, dataElements = [], onChange, onCreated, readOnly = false }) {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const selected = dataElements.find((e) => e.element_id === value);

  if (readOnly) {
    const deactivated = value && !selected;
    return (
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Linked Data Element</label>
        <div className={`mt-1 px-3 py-2 text-sm border rounded-lg ${
          selected
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : deactivated
            ? 'border-slate-300 bg-slate-100 text-slate-500 italic'
            : 'border-slate-200 bg-slate-50 text-slate-400 italic'
        }`}>
          {selected
            ? `${selected.label || selected.code}`
            : deactivated
            ? 'Data element deactivated'
            : 'No data element linked'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Link Data Element</label>
          {!value && <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">• Required</span>}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <div
            onClick={() => setShowSearchModal(true)}
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
      </div>

      {showSearchModal && (
        <SearchDataElementModal
          value={value}
          dataElements={dataElements}
          onChange={onChange}
          onCreated={onCreated}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {showCreateModal && (
        <CreateDataElementModal
          onClose={() => setShowCreateModal(false)}
          onCreated={onCreated}
          onLinked={(id) => { onChange(id); }}
        />
      )}
    </>
  );
}


/* ═══════════════════════════════════════════
   FIELD CARD — collapsible editor for one field.
   Supports drag-and-drop via native HTML5 DnD.
   ═══════════════════════════════════════════ */
export function FieldCard({
  field, index, total, isExpanded, isSelected, hasError = false, readOnly = false,
  onToggle, onSelect, onUpdate, onRemove, onDuplicate, onMove,
  onDragStart, onDragOver, onDrop, dataElements = [], onDataElementCreated,
}) {
  const [showDesc, setShowDesc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const info = FIELD_TYPES.find((t) => t.value === field.field_type) || {};

  const isPopulated = field.label?.trim() ||
    field.element_id ||
    field.options?.some((o) => o.label?.trim());

  const handleDeleteClick = () => {
    if (isPopulated) { setConfirmDelete(true); } else { onRemove(); }
  };
  const hasOpts = ['single_select', 'multi_select', 'dropdown'].includes(field.field_type);
  const isLikert = field.field_type === 'likert';
  const hasDescription = !!(field.description);

  return (
    <div
      draggable={!readOnly}
      onDragStart={!readOnly ? (e) => { e.dataTransfer.setData('text/plain', String(index)); onDragStart?.(index); } : undefined}
      onDragOver={!readOnly ? (e) => { e.preventDefault(); onDragOver?.(index); } : undefined}
      onDrop={!readOnly ? (e) => { e.preventDefault(); onDrop?.(index); } : undefined}
      className={`bg-white rounded-xl border transition-all duration-200
        ${isSelected
          ? 'border-rose-300 ring-1 ring-rose-100'
          : hasError
            ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/30'
            : isExpanded
              ? 'border-blue-300 shadow-md ring-1 ring-blue-50'
              : 'border-slate-200 shadow-sm hover:border-slate-300'
        }`}>

      {/* Header — always visible */}
      <div className="flex items-center gap-2 px-4 py-3">
        {!readOnly && (
          <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition shrink-0">
            <GripIco />
          </span>
        )}

        {onSelect && !readOnly && (
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
        {!readOnly && (
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
        )}
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Question Text</label>
            {readOnly
              ? <p className="mt-1 px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg">{field.label}</p>
              : <input value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  placeholder="Enter your question…"
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50
                    focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition" />
            }
          </div>

          {hasDescription && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
              {readOnly
                ? <p className="mt-1 px-3 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg">{field.description}</p>
                : <>
                    <button onClick={() => setShowDesc(!showDesc)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                      <Svg size={13} d={showDesc ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                      {showDesc ? 'Hide description' : 'Show description'}
                    </button>
                    {showDesc && (
                      <div className="mt-2">
                        <textarea value={field.description || ''} onChange={(e) => onUpdate({ description: e.target.value })}
                          placeholder="Add helper text…" rows={2}
                          className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-blue-50/50
                            focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition resize-none placeholder-slate-400" />
                      </div>
                    )}
                  </>
              }
            </div>
          )}

          {!readOnly && !hasDescription && (
            <div>
              <button onClick={() => setShowDesc(!showDesc)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                <Svg size={13} d={showDesc ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                {showDesc ? 'Hide description' : 'Add description'}
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
          )}

          <DataElementSelector
            value={field.element_id || null}
            dataElements={dataElements}
            onChange={readOnly ? undefined : (id) => onUpdate({ element_id: id })}
            onCreated={readOnly ? undefined : onDataElementCreated}
            readOnly={readOnly}
          />

          {readOnly ? (
            <p className="text-xs text-slate-400">
              {field.is_required ? '• Required question' : '• Optional question'}
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={field.is_required}
                  onChange={(e) => onUpdate({ is_required: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                Required
              </label>
              <div className="flex-1" />
              <button onClick={onDuplicate} className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition shrink-0"><CopyIco /> Duplicate</button>
              {confirmDelete ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 shrink-0">
                  <span className="text-xs text-rose-700 font-medium">Delete this question?</span>
                  <button onClick={onRemove} className="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded transition">Yes</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">Cancel</button>
                </div>
              ) : (
                <button onClick={handleDeleteClick} className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition"><TrashIco /> Delete</button>
              )}
            </div>
          )}

          {hasOpts && <OptionEditor options={field.options} onChange={readOnly ? undefined : (opts) => onUpdate({ options: opts })} readOnly={readOnly} />}
          {isLikert && <LikertConfig field={field} onChange={readOnly ? undefined : (data) => onUpdate(data)} readOnly={readOnly} />}
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

/*
  FieldInput — renders the correct form control for a given field type.

  Used by:
    - SurveyFillPage  (participant fills out forms)
    - SurveyBuilderPage preview mode (researcher/admin previews forms)

  Props:
    field         – { id, label, field_type, options, likertMin, likertMax, likertLabels }
    value         – current answer value (controlled)
    onChange      – (newValue) => void
    onToggleMulti – (optionValue) => void   (only for multi_select)
    disabled      – boolean (for preview / read-only)
*/

const Svg = ({ d, size = 18, sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export default function FieldInput({ field, value, onChange, onToggleMulti, disabled = false }) {
  const t = field.field_type;

  /* ── Likert Scale ── */
  if (t === 'likert') {
    const min = field.likertMin ?? 0;
    const max = field.likertMax ?? 4;
    const labels = field.likertLabels || [];

    return (
      <div className="overflow-x-auto -mx-1">
        <div className="flex items-stretch gap-1.5 min-w-fit px-1">
          {Array.from({ length: max - min + 1 }, (_, i) => {
            const val = min + i;
            const selected = value === val;
            return (
              <label key={val}
                className={`flex flex-col items-center gap-2 px-2.5 py-3 rounded-xl cursor-pointer
                  transition-all flex-1 min-w-[60px] text-center border
                  ${selected
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                    : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                  } ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
                <span className="text-xs text-slate-500 leading-tight min-h-[2rem] flex items-center">
                  {labels[i] || ''}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition
                  ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className="text-xs font-mono text-slate-400">{val}</span>
                <input type="radio" name={`field-${field.id}`} value={val}
                  checked={selected} onChange={() => onChange(val)} className="sr-only" />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Single Select (radio) ── */
  if (t === 'single_select') {
    return (
      <div className="space-y-2">
        {(field.options || []).map((opt) => {
          const selected = value === opt.value;
          return (
            <label key={opt.id || opt.value}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                ${selected
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                  : 'border-slate-150 hover:bg-slate-50 hover:border-slate-200'
                } ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition
                ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                {selected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-slate-700">{opt.label}</span>
              <input type="radio" name={`field-${field.id}`} value={opt.value}
                checked={selected} onChange={() => onChange(opt.value)} className="sr-only" />
            </label>
          );
        })}
      </div>
    );
  }

  /* ── Multi Select (checkbox) ── */
  if (t === 'multi_select') {
    const arr = value || [];
    return (
      <div className="space-y-2">
        {(field.options || []).map((opt) => {
          const checked = arr.includes(opt.value);
          return (
            <label key={opt.id || opt.value}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                ${checked
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                  : 'border-slate-150 hover:bg-slate-50 hover:border-slate-200'
                } ${disabled ? 'pointer-events-none opacity-70' : ''}`}>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition
                ${checked ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                {checked && <Svg size={12} sw={3} d="M20 6L9 17l-5-5" stroke="white" />}
              </div>
              <span className="text-sm text-slate-700">{opt.label}</span>
              <input type="checkbox" checked={checked}
                onChange={() => onToggleMulti(opt.value)} className="sr-only" />
            </label>
          );
        })}
      </div>
    );
  }

  /* ── Dropdown ── */
  if (t === 'dropdown') {
    return (
      <select value={value ?? ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value))}
        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition appearance-none disabled:opacity-60">
        <option value="">Select an option…</option>
        {(field.options || []).map((o) => (
          <option key={o.id || o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  /* ── Text ── */
  if (t === 'text') {
    const isLong = (field.label?.length > 80) ||
      field.label?.toLowerCase().includes('anything else') ||
      field.label?.toLowerCase().includes('specify');
    return isLong ? (
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder="Type your answer…" rows={3}
        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition resize-none disabled:opacity-60" />
    ) : (
      <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
        disabled={disabled} placeholder="Type your answer…"
        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition disabled:opacity-60" />
    );
  }

  /* ── Number ── */
  if (t === 'number') {
    return (
      <input type="number" value={value ?? ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder="0"
        className="w-44 px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition disabled:opacity-60" />
    );
  }

  /* ── Date ── */
  if (t === 'date') {
    return (
      <input type="date" value={value || ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-52 px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
          transition disabled:opacity-60" />
    );
  }

  return <p className="text-xs text-slate-400">Unsupported field type: {t}</p>;
}

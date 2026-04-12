import { useState, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../../services/api";

// ── Icons ───────────────────────────────────────────────────────────────────
const I = ({ d, c = "h-5 w-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);
const IconPlus = () => <I d="M12 4v16m8-8H4" />;
const IconTrash = () => <I d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />;
const IconUp = () => <I d="M5 15l7-7 7 7" />;
const IconDown = () => <I d="M19 9l-7 7-7-7" />;
const IconEdit = () => <I d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />;
const IconEye = () => <I d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />;
const Spinner = () => (
  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Top-level tabs ──────────────────────────────────────────────────────────
const TABS = [
  { key: "consent", label: "Consent form" },
  { key: "background", label: "Background info" },
  { key: "intake", label: "Intake form" },
  { key: "preview", label: "Preview" },
];

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Dropdown Multi select" },
  { value: "dropdown", label: "Dropdown Single select" },
  { value: "textarea", label: "Text area" },
];

const HARDCODED_PROFILE_COLUMNS = new Set([
  "dob", "gender", "pronouns", "primary_language", "country_of_origin",
  "marital_status", "highest_education_level", "living_arrangement",
  "dependents", "occupation_status",
]);

const PROFILE_FIELD_FALLBACK = [
  { value: "", label: "None" },
  { value: "dob", label: "Date of birth" },
  { value: "gender", label: "Gender" },
  { value: "pronouns", label: "Pronouns" },
  { value: "primary_language", label: "Primary languages" },
  { value: "country_of_origin", label: "Country of origin" },
  { value: "marital_status", label: "Marital status" },
  { value: "highest_education_level", label: "Highest education level" },
  { value: "living_arrangement", label: "Living arrangement" },
  { value: "dependents", label: "Dependents" },
  { value: "occupation_status", label: "Occupation / status" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function moveItem(arr, from, to) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// ═════════════════════════════════════════════════════════════════════════════
//  CONSENT EDITOR
// ═════════════════════════════════════════════════════════════════════════════
function ConsentEditor({ consent, setConsent }) {
  const { title, subtitle, items } = consent;

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setConsent({ ...consent, items: next });
  };

  const addItem = () => {
    setConsent({
      ...consent,
      items: [
        ...items,
        { id: `item_${Date.now()}`, text: "", required: true },
      ],
    });
  };

  const removeItem = (idx) => {
    setConsent({ ...consent, items: items.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Consent form template</h3>
        <p className="text-xs text-slate-400 mb-5">
          All items are required — each becomes a checkbox the participant must agree to during onboarding
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setConsent({ ...consent, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="e.g. Informed Consent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Subtitle <span className="text-slate-300 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={subtitle || ""}
              onChange={(e) => setConsent({ ...consent, subtitle: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="e.g. Please review and agree to the following before continuing"
            />
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Consent Items</label>
          <span className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 group">
              <div className="flex gap-3">
                {/* Number badge */}
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>

                {/* Text area */}
                <div className="flex-1 min-w-0">
                  <textarea
                    value={item.text}
                    onChange={(e) => updateItem(idx, "text", e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                    rows={2}
                    placeholder="Enter consent item text..."
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => idx > 0 && setConsent({ ...consent, items: moveItem(items, idx, idx - 1) })}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <IconUp />
                  </button>
                  <button
                    onClick={() => idx < items.length - 1 && setConsent({ ...consent, items: moveItem(items, idx, idx + 1) })}
                    disabled={idx === items.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <IconDown />
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors w-full justify-center"
        >
          <IconPlus /> Add consent item
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  BACKGROUND INFO EDITOR
// ═════════════════════════════════════════════════════════════════════════════
function BackgroundEditor({ background, setBackground }) {
  const { title, subtitle, sections } = background;

  const updateSection = (idx, field, value) => {
    const next = [...sections];
    next[idx] = { ...next[idx], [field]: value };
    setBackground({ ...background, sections: next });
  };

  const addSection = () => {
    setBackground({
      ...background,
      sections: [...sections, { heading: "", body: "", style: "" }],
    });
  };

  const removeSection = (idx) => {
    setBackground({ ...background, sections: sections.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Background information template</h3>
        <p className="text-xs text-slate-400 mb-5">
          Participants must read this document before signing the consent form
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setBackground({ ...background, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="e.g. Background Information Sheet"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Subtitle <span className="text-slate-300 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={subtitle || ""}
              onChange={(e) => setBackground({ ...background, subtitle: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              placeholder="e.g. Appendix A — Please read carefully before proceeding"
            />
          </div>
        </div>
      </div>

      {/* Sections list */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Sections</label>
          <span className="text-xs text-slate-400">{sections.length} section{sections.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="space-y-5">
          {sections.map((section, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden">
              {/* Section header bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={section.heading || ""}
                  onChange={(e) => updateSection(idx, "heading", e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  placeholder="Section heading (optional)"
                />
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => idx > 0 && setBackground({ ...background, sections: moveItem(sections, idx, idx - 1) })}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <IconUp />
                  </button>
                  <button
                    onClick={() => idx < sections.length - 1 && setBackground({ ...background, sections: moveItem(sections, idx, idx + 1) })}
                    disabled={idx === sections.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <IconDown />
                  </button>
                  <button
                    onClick={() => removeSection(idx)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              {/* Body textarea */}
              <div className="px-4 py-4">
                <textarea
                  value={section.body || ""}
                  onChange={(e) => updateSection(idx, "body", e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  style={{ minHeight: "180px" }}
                  placeholder="Section body (supports Markdown)"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <IconEdit /> Supports <strong>**bold**</strong> and <em>*italic*</em> markdown
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={section.style === "card"}
                        onChange={(e) => updateSection(idx, "style", e.target.checked ? "card" : "")}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-500">Card style</span>
                      <span className="text-xs text-slate-300">— wraps in a bordered card for the participant</span>
                    </label>
                  </div>
                  <span className="text-xs text-slate-400">{(section.body || "").length} chars</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addSection}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors w-full justify-center"
        >
          <IconPlus /> Add section
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  PROFILE FIELD SEARCH MODAL
// ═════════════════════════════════════════════════════════════════════════════
function ProfileFieldModal({ value, dataElements, onSelect, onClose }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dataElements.filter(
      (e) =>
        e.label?.toLowerCase().includes(q) ||
        e.code?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [search, dataElements]);

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Profile Field Mapping</h3>
          <p className="text-sm text-slate-500 mt-0.5">Select a data element to link this field to.</p>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by label, code or description…"
            className="w-full mt-3 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {/* None option */}
          <button
            onClick={() => { onSelect(""); onClose(); }}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              !value ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/40"
            }`}
          >
            <span className="text-sm font-semibold text-slate-400 italic">None</span>
          </button>

          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">No elements found</p>
              <p className="text-xs mt-1">Try a different search</p>
            </div>
          )}
          {filtered.map((e) => {
            const isSelected = e.code === value;
            return (
              <button
                key={e.element_id || e.code}
                onClick={() => { onSelect(e.code); onClose(); }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  isSelected ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{e.label || e.code}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {e.unit && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{e.unit}</span>}
                    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{e.datatype || "text"}</span>
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

// ═════════════════════════════════════════════════════════════════════════════
//  INTAKE FORM EDITOR
// ═════════════════════════════════════════════════════════════════════════════
function IntakeEditor({ intakeFields, setIntakeFields, profileFieldOptions, dataElements }) {
  const [profileModalIdx, setProfileModalIdx] = useState(null);
  const hasSelectOptions = (type) => ["single_select", "multi_select", "dropdown"].includes(type);
  // Only count duplicates for hardcoded profile columns (last-wins conflict).
  // Data element mappings are fine to duplicate — each creates its own HealthDataPoint.
  const mappedCounts = intakeFields.reduce((acc, field) => {
    if (!field.profile_field || !HARDCODED_PROFILE_COLUMNS.has(field.profile_field)) return acc;
    acc[field.profile_field] = (acc[field.profile_field] || 0) + 1;
    return acc;
  }, {});

  const updateField = (idx, key, value) => {
    const next = [...intakeFields];
    next[idx] = { ...next[idx], [key]: value };
    if (key === "field_type") {
      if (!hasSelectOptions(value)) next[idx].options = [];
      next[idx].config = {};
    }
    setIntakeFields(next);
  };

  const updateConfig = (idx, configKey, configValue) => {
    setIntakeFields((prev) => {
      const next = [...prev];
      const prevConfig = next[idx].config || {};
      if (configValue === undefined || configValue === null || configValue === false) {
        const { [configKey]: _, ...rest } = prevConfig;
        next[idx] = { ...next[idx], config: rest };
      } else {
        next[idx] = { ...next[idx], config: { ...prevConfig, [configKey]: configValue } };
      }
      return next;
    });
  };

  const addField = () => {
    setIntakeFields([
      ...intakeFields,
      { label: "", field_type: "text", is_required: true, display_order: intakeFields.length + 1, profile_field: "", show_on_profile: false, config: {}, options: [] },
    ]);
  };

  const removeField = (idx) => {
    setIntakeFields(intakeFields.filter((_, i) => i !== idx));
  };

  const addOption = (fieldIdx) => {
    const next = [...intakeFields];
    const opts = next[fieldIdx].options || [];
    next[fieldIdx] = { ...next[fieldIdx], options: [...opts, { label: "", value: opts.length, display_order: opts.length }] };
    setIntakeFields(next);
  };

  const updateOption = (fieldIdx, optIdx, key, value) => {
    const next = [...intakeFields];
    const opts = [...(next[fieldIdx].options || [])];
    opts[optIdx] = { ...opts[optIdx], [key]: value };
    next[fieldIdx] = { ...next[fieldIdx], options: opts };
    setIntakeFields(next);
  };

  const removeOption = (fieldIdx, optIdx) => {
    const next = [...intakeFields];
    next[fieldIdx] = { ...next[fieldIdx], options: (next[fieldIdx].options || []).filter((_, i) => i !== optIdx) };
    setIntakeFields(next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Intake form fields</h3>
        <p className="text-xs text-slate-400 mb-2">
          These are the intake questions shown to participants during onboarding
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-5">
          <p className="text-xs text-blue-600">
            Map a field to a participant profile column when its answer should also update the participant record.
          </p>
        </div>
        {Object.values(mappedCounts).some((count) => count > 1) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-amber-700">
              Warning: two or more intake fields map to the same profile field. The last answered field will win on submit.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {intakeFields.map((field, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(idx, "label", e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                    placeholder="Field label (e.g. Undergraduate Program)"
                  />
                  <div className="flex items-center gap-4">
                    <select
                      value={field.field_type}
                      onChange={(e) => updateField(idx, "field_type", e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(e) => updateField(idx, "is_required", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-500">Required</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.show_on_profile || false}
                        onChange={(e) => updateField(idx, "show_on_profile", e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium text-slate-500">Show on profile</span>
                    </label>
                  </div>
                  {field.show_on_profile && (!field.profile_field || !HARDCODED_PROFILE_COLUMNS.has(field.profile_field)) && (
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      Appears under <span className="font-semibold">Additional Information</span> on participant profile
                    </p>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Profile field mapping
                    </label>
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => setProfileModalIdx(idx)}
                        className={`flex-1 flex items-center justify-between px-3 py-2 text-sm border rounded-lg cursor-pointer transition ${
                          field.profile_field
                            ? "border-blue-300 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate">
                          {field.profile_field
                            ? profileFieldOptions.find((o) => o.value === field.profile_field)?.label || field.profile_field
                            : "Select a data element…"}
                        </span>
                        <svg className="h-4 w-4 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                      {field.profile_field && (
                        <button
                          onClick={() => updateField(idx, "profile_field", "")}
                          title="Remove mapping"
                          className="p-2 text-slate-400 hover:text-rose-500 transition shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {field.profile_field && mappedCounts[field.profile_field] > 1 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700">
                          Duplicate mapping
                        </span>
                      )}
                    </div>
                    {profileModalIdx === idx && (
                      <ProfileFieldModal
                        value={field.profile_field}
                        dataElements={dataElements}
                        onSelect={(code) => updateField(idx, "profile_field", code)}
                        onClose={() => setProfileModalIdx(null)}
                      />
                    )}
                  </div>
                  {hasSelectOptions(field.field_type) && (
                    <div className="pl-2 border-l-2 border-violet-200 space-y-2">
                      <span className="text-xs font-medium text-slate-500">Options</span>
                      {(field.options || []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => updateOption(idx, oi, "label", e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                            placeholder={`Option ${oi + 1}`}
                          />
                          <button
                            onClick={() => removeOption(idx, oi)}
                            className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(idx)}
                        className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                      >
                        + Add option
                      </button>
                    </div>
                  )}

                  {/* ── Field config panel ── */}
                  {(field.field_type === "number" || field.field_type === "date" || field.field_type === "dropdown" || field.field_type === "multi_select" || field.field_type === "single_select") && (
                    <div className="pl-2 border-l-2 border-blue-200 space-y-2.5 mt-1">
                      <span className="text-xs font-medium text-blue-600">Field configuration</span>

                      {/* Number: min / max */}
                      {field.field_type === "number" && (
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            Min
                            <input
                              type="number"
                              value={field.config?.min ?? ""}
                              onChange={(e) => updateConfig(idx, "min", e.target.value === "" ? undefined : Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            Max
                            <input
                              type="number"
                              value={field.config?.max ?? ""}
                              onChange={(e) => updateConfig(idx, "max", e.target.value === "" ? undefined : Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                          </label>
                        </div>
                      )}

                      {/* Date: validation rule */}
                      {field.field_type === "date" && (
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          Validation
                          <select
                            value={field.config?.max_date_rule || ""}
                            onChange={(e) => updateConfig(idx, "max_date_rule", e.target.value || undefined)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="">None</option>
                            <option value="adult_18">Must be 18+</option>
                          </select>
                        </label>
                      )}

                      {/* Dropdown / Multi-select: searchable, predefined list, creatable */}
                      {(field.field_type === "dropdown" || field.field_type === "multi_select") && (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!field.config?.searchable}
                              onChange={(e) => {
                                updateConfig(idx, "searchable", e.target.checked || undefined);
                                if (!e.target.checked) {
                                  updateConfig(idx, "creatable", undefined);
                                  updateConfig(idx, "predefined_list", undefined);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-600">Searchable</span>
                          </label>
                          {field.config?.searchable && (
                            <>
                              <label className="flex items-center gap-2 text-xs text-slate-500 ml-6">
                                Predefined list
                                <select
                                  value={field.config?.predefined_list || ""}
                                  onChange={(e) => updateConfig(idx, "predefined_list", e.target.value || undefined)}
                                  className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                  <option value="">None (use manual options)</option>
                                  <option value="languages">Languages</option>
                                  <option value="countries">Countries</option>
                                  <option value="pronouns">Pronouns</option>
                                </select>
                              </label>
                              {field.field_type === "multi_select" && (
                                <label className="flex items-center gap-2 cursor-pointer ml-6">
                                  <input
                                    type="checkbox"
                                    checked={!!field.config?.creatable}
                                    onChange={(e) => updateConfig(idx, "creatable", e.target.checked || undefined)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-slate-600">Allow custom entries</span>
                                </label>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* Single select: conditional sub-field */}
                      {field.field_type === "single_select" && (
                        <>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!field.config?.conditional}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateConfig(idx, "conditional", { trigger_value: "Yes", sub_field_type: "number", sub_config: { min: 0, max: 10 } });
                                } else {
                                  updateConfig(idx, "conditional", undefined);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-600">Conditional sub-field</span>
                          </label>
                          {field.config?.conditional && (
                            <div className="ml-6 space-y-2 p-2.5 bg-white border border-slate-200 rounded-lg">
                              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                Trigger value
                                <input
                                  type="text"
                                  value={field.config.conditional.trigger_value || ""}
                                  onChange={(e) => updateConfig(idx, "conditional", { ...field.config.conditional, trigger_value: e.target.value })}
                                  className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  placeholder="Yes"
                                />
                              </label>
                              <p className="text-[11px] text-slate-400">Sub-field type: Number</p>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                  Min
                                  <input
                                    type="number"
                                    value={field.config.conditional.sub_config?.min ?? ""}
                                    onChange={(e) => updateConfig(idx, "conditional", {
                                      ...field.config.conditional,
                                      sub_config: { ...(field.config.conditional.sub_config || {}), min: e.target.value === "" ? undefined : Number(e.target.value) },
                                    })}
                                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                                  Max
                                  <input
                                    type="number"
                                    value={field.config.conditional.sub_config?.max ?? ""}
                                    onChange={(e) => updateConfig(idx, "conditional", {
                                      ...field.config.conditional,
                                      sub_config: { ...(field.config.conditional.sub_config || {}), max: e.target.value === "" ? undefined : Number(e.target.value) },
                                    })}
                                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => idx > 0 && setIntakeFields(moveItem(intakeFields, idx, idx - 1))}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <IconUp />
                  </button>
                  <button
                    onClick={() => idx < intakeFields.length - 1 && setIntakeFields(moveItem(intakeFields, idx, idx + 1))}
                    disabled={idx === intakeFields.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <IconDown />
                  </button>
                  <button
                    onClick={() => removeField(idx)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"
                    title="Remove"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addField}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition-colors w-full justify-center"
        >
          <IconPlus /> Add field
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  PREVIEW (participant view)
// ═════════════════════════════════════════════════════════════════════════════
function Preview({ consent, background, intakeFields, profileFieldOptions }) {
  const [previewTab, setPreviewTab] = useState("consent");

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-1">Participant preview</h3>
        <p className="text-xs text-slate-400 mb-4">
          This is how the onboarding pages will appear to participants
        </p>

        {/* Preview sub-tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "consent", label: "Consent form" },
            { key: "background", label: "Background info" },
            { key: "intake", label: "Intake form" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setPreviewTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                previewTab === t.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Preview content card */}
        <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/30 max-h-[600px] overflow-y-auto">
          {previewTab === "consent" && <ConsentPreview consent={consent} />}
          {previewTab === "background" && <BackgroundPreview background={background} />}
          {previewTab === "intake" && <IntakePreview intakeFields={intakeFields} />}
        </div>
      </div>
    </div>
  );
}

function ConsentPreview({ consent }) {
  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold text-slate-800 mb-1">{consent.title || "Untitled"}</h2>
        {consent.subtitle && <p className="text-sm text-slate-400">{consent.subtitle}</p>}
      </div>
      <div className="space-y-3">
        {consent.items.map((item, idx) => (
          <div key={item.id || idx} className="flex items-start gap-3 border border-slate-100 rounded-xl p-4">
            <input type="checkbox" disabled className="w-4 h-4 mt-0.5 rounded border-slate-300" />
            <div className="flex-1">
              <p className="text-sm text-slate-700">{item.text || "(empty)"}</p>
            </div>
          </div>
        ))}
      </div>
      {consent.items.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">No consent items yet</p>
      )}
    </div>
  );
}

function BackgroundPreview({ background }) {
  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold text-slate-800 mb-1">{background.title || "Untitled"}</h2>
        {background.subtitle && <p className="text-sm text-slate-400">{background.subtitle}</p>}
      </div>
      <div>
        {background.sections.map((section, i) => (
          <div
            key={i}
            className={
              section.style === "card"
                ? "bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4"
                : "mb-4"
            }
          >
            {section.heading && (
              <h4 className="text-sm font-bold text-slate-800 mt-4 mb-2">{section.heading}</h4>
            )}
            <div className="prose prose-sm prose-slate max-w-none [&_table]:w-full [&_th]:text-left [&_td]:py-1 [&_th]:py-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body || ""}</ReactMarkdown>
            </div>
          </div>
        ))}
        {background.sections.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No sections yet</p>
        )}
      </div>
    </div>
  );
}

function IntakePreview({ intakeFields }) {
  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold text-slate-800 mb-1">Intake Questionnaire</h2>
        <p className="text-sm text-slate-400">Preview of intake form fields</p>
      </div>
      <p className="text-xs text-slate-400 italic mb-4">
        Fields mapped to profile columns update participant profile data as well as the intake submission.
      </p>
      <div className="space-y-3">
        {intakeFields.map((field, idx) => (
          <div key={idx} className="border border-slate-100 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">
              <span className="text-violet-600 font-bold mr-1">{idx + 1}.</span>
              {field.label || "(empty)"}
              {field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
            </p>
            {field.profile_field && (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                Maps to {profileFieldOptions.find((opt) => opt.value === field.profile_field)?.label || field.profile_field}
              </p>
            )}
            {["single_select", "multi_select", "dropdown"].includes(field.field_type) ? (
              <div className="flex flex-wrap gap-2">
                {(field.options || []).map((opt, oi) => (
                  <span key={oi} className="px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-500 bg-white">
                    {opt.label || `Option ${oi + 1}`}
                  </span>
                ))}
                {(!field.options || field.options.length === 0) && (
                  <span className="text-xs text-slate-300 italic">No options defined</span>
                )}
              </div>
            ) : (
              <div className="w-full h-9 bg-slate-100 border border-slate-200 rounded-lg" />
            )}
          </div>
        ))}
        {intakeFields.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">No intake fields yet</p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingManagementPage() {
  const [activeTab, setActiveTab] = useState("consent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmModal, setConfirmModal] = useState(null); // { count, onConfirm }
  const [dirty, setDirty] = useState(false);

  // Consent state
  const [consent, setConsentRaw] = useState({ title: "", subtitle: "", items: [] });
  // Background state
  const [background, setBackgroundRaw] = useState({ title: "", subtitle: "", sections: [] });
  // Intake state
  const [intakeFields, setIntakeFieldsRaw] = useState([]);
  const [profileFieldOptions, setProfileFieldOptions] = useState(PROFILE_FIELD_FALLBACK);
  const [dataElements, setDataElements] = useState([]);

  // Wrap setters to track dirty state
  const setConsent = useCallback((val) => { setConsentRaw(val); setDirty(true); setSuccess(""); }, []);
  const setBackground = useCallback((val) => { setBackgroundRaw(val); setDirty(true); setSuccess(""); }, []);
  const setIntakeFields = useCallback((val) => {
    setIntakeFieldsRaw(typeof val === "function" ? (prev) => { const next = val(prev); setDirty(true); setSuccess(""); return next; } : val);
    if (typeof val !== "function") { setDirty(true); setSuccess(""); }
  }, []);

  // Fetch both templates on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [consentData, bgData, intakeData, elements] = await Promise.all([
          api.getConsentForm(),
          api.getBackgroundInfo(),
          api.getAdminIntakeForm().catch(() => null),
          api.listElements().catch(() => []),
        ]);
        if (cancelled) return;
        if (elements.length > 0) {
          setDataElements(elements);
          setProfileFieldOptions([
            { value: "", label: "None" },
            ...elements.map((el) => ({ value: el.code, label: el.label })),
          ]);
        }
        setConsentRaw({
          title: consentData.title || "",
          subtitle: consentData.subtitle || "",
          items: consentData.items || [],
        });
        setBackgroundRaw({
          title: bgData.title || "",
          subtitle: bgData.subtitle || "",
          sections: bgData.sections || [],
        });
        if (intakeData) {
          setIntakeFieldsRaw(
            (intakeData.fields || []).map((f) => ({
              field_id: f.field_id || null,
              label: f.label,
              field_type: f.field_type,
              is_required: f.is_required,
              display_order: f.display_order,
              profile_field: f.profile_field || "",
              config: f.config || {},
              element_id: f.element_id || null,
              options: (f.options || []).map((o) => ({
                label: o.label || "",
                value: o.value,
                display_order: o.display_order,
              })),
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load onboarding templates.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const doPublish = async () => {
    setError("");
    setSaving(true);
    try {
      const [,, intakeResult] = await Promise.all([
        api.updateConsentTemplate({
          title: consent.title,
          subtitle: consent.subtitle || null,
          items: consent.items,
        }),
        api.updateBackgroundTemplate({
          title: background.title,
          subtitle: background.subtitle || null,
          sections: background.sections,
        }),
        api.updateIntakeForm({
          fields: intakeFields.map((f, i) => ({ ...f, display_order: i + 1 })),
        }),
      ]);
      const resetCount = intakeResult?.participants_reset || 0;
      setSuccess(
        resetCount > 0
          ? `Published. ${resetCount} participant${resetCount === 1 ? "" : "s"} will need to redo the intake form.`
          : "Onboarding templates published successfully."
      );
      setDirty(false);
    } catch (err) {
      setError(err.message || "Failed to publish templates.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!consent.title.trim()) {
      setError("Consent form title is required.");
      setActiveTab("consent");
      return;
    }
    if (consent.items.some((item) => !item.text.trim())) {
      setError("All consent items must have text.");
      setActiveTab("consent");
      return;
    }
    if (!background.title.trim()) {
      setError("Background info title is required.");
      setActiveTab("background");
      return;
    }
    if (intakeFields.some((f) => !f.label.trim())) {
      setError("All intake fields must have a label.");
      setActiveTab("intake");
      return;
    }

    // Check if any completed participants would be affected
    try {
      const { count } = await api.getIntakeAffectedCount();
      if (count > 0) {
        setConfirmModal({ count, onConfirm: doPublish });
        return;
      }
    } catch {
      // If the check fails, proceed without confirmation
    }

    await doPublish();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm publish</h3>
            <p className="text-sm text-slate-600 mb-5">
              Publishing changes will require{" "}
              <span className="font-semibold text-amber-700">{confirmModal.count} participant{confirmModal.count === 1 ? "" : "s"}</span>{" "}
              to redo the intake form. Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                Publish anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Onboarding Templates</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage onboarding templates shown to new participants
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            dirty && !saving
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {saving ? <Spinner /> : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {saving ? "Publishing..." : "Publish"}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-400 hover:text-rose-600 ml-4">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-400 hover:text-emerald-600 ml-4">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "consent" && <ConsentEditor consent={consent} setConsent={setConsent} />}
      {activeTab === "background" && <BackgroundEditor background={background} setBackground={setBackground} />}
      {activeTab === "intake" && <IntakeEditor intakeFields={intakeFields} setIntakeFields={setIntakeFields} profileFieldOptions={profileFieldOptions} dataElements={dataElements} />}
      {activeTab === "preview" && <Preview consent={consent} background={background} intakeFields={intakeFields} profileFieldOptions={profileFieldOptions} />}
    </div>
  );
}

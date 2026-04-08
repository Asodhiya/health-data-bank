import { useState, useEffect, useCallback } from "react";
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
const IconSave = () => <I d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />;
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
  { value: "multi_select", label: "Multi select" },
  { value: "dropdown", label: "Dropdown" },
  { value: "textarea", label: "Text area" },
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
          Each item becomes a checkbox the participant must agree to during onboarding
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
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) => updateItem(idx, "required", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-slate-500">Required</span>
                  </label>
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
//  INTAKE FORM EDITOR
// ═════════════════════════════════════════════════════════════════════════════
function IntakeEditor({ intakeFields, setIntakeFields }) {
  const hasSelectOptions = (type) => ["single_select", "multi_select", "dropdown"].includes(type);

  const updateField = (idx, key, value) => {
    const next = [...intakeFields];
    next[idx] = { ...next[idx], [key]: value };
    if (key === "field_type" && !hasSelectOptions(value)) {
      next[idx].options = [];
    }
    setIntakeFields(next);
  };

  const addField = () => {
    setIntakeFields([
      ...intakeFields,
      { label: "", field_type: "text", is_required: true, display_order: intakeFields.length + 1, options: [] },
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
          These are the survey-style questions on the intake page
        </p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-5">
          <p className="text-xs text-blue-600">
            The intake page always includes fixed demographics (Name, DOB, Sex, Pronouns, Language, Marital Status, Education, Living Arrangement, Dependents, Occupation). The fields below appear in the Lifestyle &amp; Wellness section after demographics.
          </p>
        </div>

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
function Preview({ consent, background, intakeFields }) {
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
              {item.required && (
                <span className="text-xs font-bold text-rose-500 mt-1 inline-block">Required *</span>
              )}
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
        Demographics section (DOB, Sex, Pronouns, etc.) appears above these fields.
      </p>
      <div className="space-y-3">
        {intakeFields.map((field, idx) => (
          <div key={idx} className="border border-slate-100 rounded-xl p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">
              <span className="text-violet-600 font-bold mr-1">{idx + 1}.</span>
              {field.label || "(empty)"}
              {field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
            </p>
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
  const [dirty, setDirty] = useState(false);

  // Consent state
  const [consent, setConsentRaw] = useState({ title: "", subtitle: "", items: [] });
  // Background state
  const [background, setBackgroundRaw] = useState({ title: "", subtitle: "", sections: [] });
  // Intake state
  const [intakeFields, setIntakeFieldsRaw] = useState([]);

  // Wrap setters to track dirty state
  const setConsent = useCallback((val) => { setConsentRaw(val); setDirty(true); setSuccess(""); }, []);
  const setBackground = useCallback((val) => { setBackgroundRaw(val); setDirty(true); setSuccess(""); }, []);
  const setIntakeFields = useCallback((val) => { setIntakeFieldsRaw(val); setDirty(true); setSuccess(""); }, []);

  // Fetch both templates on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [consentData, bgData, intakeData] = await Promise.all([
          api.getConsentForm(),
          api.getBackgroundInfo(),
          api.getAdminIntakeForm().catch(() => null),
        ]);
        if (cancelled) return;
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
              label: f.label,
              field_type: f.field_type,
              is_required: f.is_required,
              display_order: f.display_order,
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

    setError("");
    setSaving(true);
    try {
      await Promise.all([
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
      setSuccess("Onboarding templates saved successfully. A new version has been created.");
      setDirty(false);
    } catch (err) {
      setError(err.message || "Failed to save templates.");
    } finally {
      setSaving(false);
    }
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
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {saving ? <Spinner /> : <IconSave />}
          {saving ? "Saving..." : "Save changes"}
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
      {activeTab === "intake" && <IntakeEditor intakeFields={intakeFields} setIntakeFields={setIntakeFields} />}
      {activeTab === "preview" && <Preview consent={consent} background={background} intakeFields={intakeFields} />}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { sanitizeText } from "../../utils/sanitize";
import { COUNTRIES, PREDEFINED_LISTS } from "../../utils/formOptions";

const EMPTY_ANSWERS = {};

function normalizeFieldValue(field, value) {
  if (field.field_type === "multi_select") {
    return Array.isArray(value) ? value : [];
  }
  return value ?? "";
}

function isAnswered(field, value) {
  if (field.field_type === "multi_select") {
    return Array.isArray(value) && value.length > 0;
  }
  if (field.config?.conditional) {
    // For conditional fields the value is a number (including 0 for "No")
    return value !== null && value !== undefined && value !== "";
  }
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function minimumAdultDob() {
  const today = new Date();
  const min = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return min.toISOString().split("T")[0];
}

function buildInitialAnswers(fields) {
  return fields.reduce((acc, field) => {
    if (field.field_type === "multi_select") {
      acc[field.field_id] = [];
    } else if (field.config?.conditional) {
      acc[field.field_id] = "";
    } else {
      acc[field.field_id] = "";
    }
    return acc;
  }, {});
}

function renderFieldError(error) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>;
}

/* ── Shared styles ─────────────────────────────────────────── */

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-shadow focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200";

const chipClass = (selected) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
    selected
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
  }`;

/* ── SearchableSelect (single value, e.g. country) ────────── */

function SearchableSelect({ value, onChange, options, placeholder = "Start typing to search..." }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (!event.target.value.trim()) onChange("");
        }}
        className={inputClass}
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-2 text-sm text-slate-400">No results found.</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option);
                  setQuery(option);
                  setOpen(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                  value === option ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}
      {open && (
        <button
          type="button"
          aria-label="Close dropdown"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ── SearchableMultiSelect (multi value, e.g. languages) ──── */

function SearchableMultiSelect({ value, onChange, options, placeholder = "Start typing to search...", creatable = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const selectedValues = Array.isArray(value) ? value : [];

  const filtered = options.filter(
    (option) =>
      option.toLowerCase().includes(query.toLowerCase()) && !selectedValues.includes(option),
  );

  const handleSelect = (option) => {
    if (!selectedValues.includes(option)) {
      onChange([...selectedValues, option]);
    }
    setQuery("");
    inputRef.current?.focus();
  };

  const handleRemove = (option) => {
    onChange(selectedValues.filter((v) => v !== option));
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && query.trim()) {
      event.preventDefault();
      // If creatable and no exact match in options, add custom entry
      const exactMatch = options.find((o) => o.toLowerCase() === query.trim().toLowerCase());
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (creatable && !selectedValues.includes(query.trim())) {
        onChange([...selectedValues, query.trim()]);
        setQuery("");
      }
    }
    if (event.key === "Backspace" && !query && selectedValues.length > 0) {
      onChange(selectedValues.slice(0, -1));
    }
  };

  return (
    <div className="relative">
      {/* Selected chips */}
      <div
        className="flex min-h-[48px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-shadow focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedValues.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {item}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(item);
              }}
              className="ml-0.5 text-blue-400 hover:text-blue-600"
              aria-label={`Remove ${item}`}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder={selectedValues.length === 0 ? placeholder : ""}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 && !creatable && (
            <p className="px-4 py-2 text-sm text-slate-400">No results found.</p>
          )}
          {filtered.length === 0 && creatable && query.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(query.trim())}
              className="block w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
            >
              Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(option)}
              className="block w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {open && (
        <button
          type="button"
          aria-label="Close dropdown"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ── ConditionalField (Yes/No + sub-input) ────────────────── */

function ConditionalField({ field, value, onChange }) {
  const cond = field.config.conditional;
  const triggerValue = cond.trigger_value || "Yes";
  const noValue = triggerValue === "Yes" ? "No" : "Yes";
  const subConfig = cond.sub_config || {};

  // Derive toggle state from value
  // value === "" means not answered, value === 0 means "No", value > 0 means "Yes" + number
  const isTriggered = value !== "" && value !== 0 && value !== "0";
  const toggleState = value === "" ? null : isTriggered ? triggerValue : noValue;
  const numberValue = isTriggered ? value : "";

  const handleToggle = (selected) => {
    if (selected === triggerValue) {
      // Switch to Yes — set empty string so number input appears but isn't submitted yet
      onChange(field, "");
      // Actually we need a way to show the number input. Let's use a sentinel.
      // We'll treat the state as: null = unanswered, "TRIGGERED" = yes but no number yet, number = yes + value, 0 = no
      // Simpler: just set to "" temporarily — the user must enter a number
      // Actually let's rethink: when No is selected, value = 0. When Yes is selected but no number yet, value = "".
      // When Yes + number, value = the number.
      onChange(field, "");
    } else {
      onChange(field, 0);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[triggerValue, noValue].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleToggle(opt)}
            className={chipClass(toggleState === opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {toggleState === triggerValue && (
        <input
          type="number"
          min={subConfig.min ?? undefined}
          max={subConfig.max ?? undefined}
          step="1"
          value={numberValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(field, "");
            } else {
              onChange(field, Number(raw));
            }
          }}
          className={inputClass}
          placeholder={`Enter a number${subConfig.min != null ? ` (min ${subConfig.min}` : ""}${subConfig.max != null ? `${subConfig.min != null ? ", " : " ("}max ${subConfig.max})` : subConfig.min != null ? ")" : ""}`}
        />
      )}
    </div>
  );
}

/* ── QuestionCard ──────────────────────────────────────────── */

function QuestionCard({ index, field, value, onChange, error, maxDob }) {
  const config = field.config || {};
  const options = field.options || [];

  // Determine rendering mode using config with profile_field fallbacks (backward compat)
  const isSearchable = config.searchable || field.profile_field === "country_of_origin";
  const predefinedList = config.predefined_list
    ? PREDEFINED_LISTS[config.predefined_list]
    : field.profile_field === "country_of_origin"
      ? COUNTRIES
      : null;
  const isCreatable = config.creatable || false;
  const isConditional = !!config.conditional;
  const dateMax =
    config.max_date_rule === "adult_18" || field.profile_field === "dob" ? maxDob : undefined;
  const numberMin =
    config.min ?? (field.profile_field === "dependents" ? 0 : undefined);
  const numberMax = config.max ?? undefined;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-slate-700">
        <span className="mr-1 font-bold text-blue-600">{index + 1}.</span>
        {field.label}
        {field.is_required && <span className="ml-0.5 text-rose-500">*</span>}
      </p>

      {field.profile_field && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Saves to profile: {field.profile_field.replaceAll("_", " ")}
        </p>
      )}

      {/* Conditional single_select (e.g. Dependents Yes/No + number) */}
      {field.field_type === "single_select" && isConditional && (
        <ConditionalField field={field} value={value} onChange={onChange} />
      )}

      {/* Searchable multi-select with predefined list (e.g. Languages) */}
      {field.field_type === "multi_select" && predefinedList && isSearchable && (
        <SearchableMultiSelect
          value={value}
          onChange={(next) => onChange(field, next)}
          options={predefinedList}
          creatable={isCreatable}
          placeholder={`Start typing to search ${config.predefined_list || "options"}...`}
        />
      )}

      {/* Searchable single-select dropdown with predefined list (e.g. Country) */}
      {field.field_type === "dropdown" && predefinedList && isSearchable && (
        <SearchableSelect
          value={value}
          onChange={(next) => onChange(field, next)}
          options={predefinedList}
          placeholder={`Start typing to search ${config.predefined_list || "options"}...`}
        />
      )}

      {/* Regular dropdown (no predefined list, not searchable) */}
      {field.field_type === "dropdown" && !(predefinedList && isSearchable) && (
        <select
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className={inputClass}
        >
          <option value="">Select an option</option>
          {options.map((option, optionIndex) => (
            <option key={`${field.field_id}-${optionIndex}`} value={option.label || option.value || ""}>
              {option.label || `Option ${optionIndex + 1}`}
            </option>
          ))}
        </select>
      )}

      {/* Single select chips (non-conditional) */}
      {field.field_type === "single_select" && !isConditional && (
        <div className="flex flex-wrap gap-2">
          {options.map((option, optionIndex) => {
            const optionValue = option.label || option.value || "";
            const selected = value === optionValue;
            return (
              <button
                key={`${field.field_id}-${optionIndex}`}
                type="button"
                onClick={() => onChange(field, optionValue)}
                className={chipClass(selected)}
              >
                {option.label || `Option ${optionIndex + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Multi-select chips (no predefined list) */}
      {field.field_type === "multi_select" && !(predefinedList && isSearchable) && (
        <div className="flex flex-wrap gap-2">
          {options.map((option, optionIndex) => {
            const optionValue = option.label || option.value || "";
            const selectedValues = Array.isArray(value) ? value : [];
            const selected = selectedValues.includes(optionValue);
            return (
              <button
                key={`${field.field_id}-${optionIndex}`}
                type="button"
                onClick={() => {
                  const next = selected
                    ? selectedValues.filter((v) => v !== optionValue)
                    : [...selectedValues, optionValue];
                  onChange(field, next);
                }}
                className={chipClass(selected)}
              >
                {option.label || `Option ${optionIndex + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Textarea */}
      {field.field_type === "textarea" && (
        <textarea
          value={value}
          onChange={(event) => onChange(field, sanitizeText(event.target.value, 1000))}
          className={`${inputClass} min-h-[120px] resize-y`}
        />
      )}

      {/* Text */}
      {field.field_type === "text" && (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(field, sanitizeText(event.target.value, 200))}
          className={inputClass}
        />
      )}

      {/* Number */}
      {field.field_type === "number" && (
        <input
          type="number"
          min={numberMin}
          max={numberMax}
          step="1"
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className={inputClass}
        />
      )}

      {/* Date */}
      {field.field_type === "date" && (
        <input
          type="date"
          max={dateMax}
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className={inputClass}
        />
      )}

      {renderFieldError(error)}
    </div>
  );
}

/* ── Main IntakePage ──────────────────────────────────────── */

export default function IntakePage() {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);

  const maxDob = useMemo(() => minimumAdultDob(), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await api.getIntakeForm();
        if (cancelled) return;
        const nextFields = Array.isArray(data?.fields) ? data.fields : [];
        setFields(nextFields);
        setAnswers(buildInitialAnswers(nextFields));
      } catch (error) {
        if (!cancelled) {
          setFetchError(error.message || "Form not configured. Please contact an administrator.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fieldErrors = useMemo(() => {
    const next = {};

    fields.forEach((field) => {
      const value = normalizeFieldValue(field, answers[field.field_id]);
      const config = field.config || {};

      if (field.is_required && !isAnswered(field, value)) {
        next[field.field_id] = "This field is required.";
        return;
      }

      // Date validation: config-driven or profile_field fallback
      if (field.field_type === "date" && value) {
        if (config.max_date_rule === "adult_18" || field.profile_field === "dob") {
          if (value > maxDob) {
            next[field.field_id] = "Participant must be at least 18 years old.";
          }
        }
      }

      // Conditional field validation
      if (config.conditional && value !== "" && value !== 0 && value !== "0") {
        const sub = config.conditional.sub_config || {};
        const num = Number(value);
        if (!Number.isInteger(num) || (sub.min != null && num < sub.min) || (sub.max != null && num > sub.max)) {
          next[field.field_id] = `Must be a whole number${sub.min != null ? ` (min ${sub.min}` : ""}${sub.max != null ? `${sub.min != null ? ", " : " ("}max ${sub.max})` : sub.min != null ? ")" : ""}.`;
        }
      }

      // Number field validation: config-driven or profile_field fallback
      if (field.field_type === "number" && value !== "") {
        const parsed = Number(value);
        const min = config.min ?? (field.profile_field === "dependents" ? 0 : undefined);
        const max = config.max ?? undefined;
        if (!Number.isFinite(parsed)) {
          next[field.field_id] = "Must be a valid number.";
        } else if (min != null && parsed < min) {
          next[field.field_id] = `Must be at least ${min}.`;
        } else if (max != null && parsed > max) {
          next[field.field_id] = `Must be at most ${max}.`;
        }
      }
    });

    return next;
  }, [answers, fields, maxDob]);

  const handleChange = (field, nextValue) => {
    setSubmitError("");
    setAnswers((previous) => ({
      ...previous,
      [field.field_id]: nextValue,
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(fieldErrors).length > 0 || submitting) {
      setSubmitError("Please complete all required fields before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const payload = {
      answers: fields
        .map((field) => ({
          field_id: field.field_id,
          value: normalizeFieldValue(field, answers[field.field_id]),
        }))
        .filter(({ value }) =>
          Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== "",
        ),
    };

    try {
      await api.submitIntake(payload);
      await api.completeOnboarding();
      sessionStorage.removeItem("consent_answers");
      sessionStorage.removeItem("consent_signature");
      await refetch();
      navigate("/participant");
    } catch (error) {
      if (error?.status === 409) {
        setSubmitError("This intake form was already submitted for your account. Please sign out and back in if the page did not update.");
      } else {
        setSubmitError(error.message || "Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <h2 className="text-lg font-bold text-rose-700">Unable to load intake form</h2>
          <p className="mt-2 text-sm text-rose-600">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Intake form not configured</h2>
          <p className="mt-2 text-sm text-slate-500">There are no intake fields available yet. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Intake Questionnaire</h2>
        <p className="mt-1 text-sm text-slate-400">Please complete the following information before entering the participant dashboard.</p>
      </div>

      {submitError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <QuestionCard
            key={field.field_id}
            index={index}
            field={field}
            value={normalizeFieldValue(field, answers[field.field_id])}
            onChange={handleChange}
            error={fieldErrors[field.field_id]}
            maxDob={maxDob}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-400">
          {fields.length - Object.keys(fieldErrors).length} of {fields.length} fields currently valid
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Intake"}
        </button>
      </div>
    </div>
  );
}
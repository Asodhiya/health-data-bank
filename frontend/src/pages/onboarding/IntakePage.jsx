import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { sanitizeText } from "../../utils/sanitize";
import { COUNTRIES } from "../../utils/formOptions";

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
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function minimumAdultDob() {
  const today = new Date();
  const min = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return min.toISOString().split("T")[0];
}

function buildInitialAnswers(fields) {
  return fields.reduce((acc, field) => {
    acc[field.field_id] = field.field_type === "multi_select" ? [] : "";
    return acc;
  }, {});
}

function renderFieldError(error) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>;
}

function SearchableSelect({ value, onChange, options, placeholder = "Search..." }) {
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
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-shadow focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-2 text-sm text-slate-400">No countries found.</p>
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
          aria-label="Close country list"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function QuestionCard({ index, field, value, onChange, error, maxDob }) {
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-shadow focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200";
  const options = field.options || [];

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

      {field.field_type === "textarea" && (
        <textarea
          value={value}
          onChange={(event) => onChange(field, sanitizeText(event.target.value, 1000))}
          className={`${inputClass} min-h-[120px] resize-y`}
        />
      )}

      {field.field_type === "text" && (
        field.profile_field === "country_of_origin" ? (
          <SearchableSelect
            value={value}
            onChange={(nextValue) => onChange(field, nextValue)}
            options={COUNTRIES}
            placeholder="Search and choose a country"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(field, sanitizeText(event.target.value, 200))}
            className={inputClass}
          />
        )
      )}

      {field.field_type === "number" && (
        <input
          type="number"
          min={field.profile_field === "dependents" ? "0" : undefined}
          step="1"
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className={inputClass}
        />
      )}

      {field.field_type === "date" && (
        <input
          type="date"
          max={field.profile_field === "dob" ? maxDob : undefined}
          value={value}
          onChange={(event) => onChange(field, event.target.value)}
          className={inputClass}
        />
      )}

      {field.field_type === "dropdown" && (
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

      {field.field_type === "single_select" && (
        <div className="flex flex-wrap gap-2">
          {options.map((option, optionIndex) => {
            const optionValue = option.label || option.value || "";
            const selected = value === optionValue;
            return (
              <button
                key={`${field.field_id}-${optionIndex}`}
                type="button"
                onClick={() => onChange(field, optionValue)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {option.label || `Option ${optionIndex + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {field.field_type === "multi_select" && (
        <div className="space-y-2">
          {options.map((option, optionIndex) => {
            const optionValue = option.label || option.value || "";
            const selectedValues = Array.isArray(value) ? value : [];
            const checked = selectedValues.includes(optionValue);
            return (
              <label
                key={`${field.field_id}-${optionIndex}`}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedValues, optionValue]
                      : selectedValues.filter((entry) => entry !== optionValue);
                    onChange(field, next);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>{option.label || `Option ${optionIndex + 1}`}</span>
              </label>
            );
          })}
        </div>
      )}

      {renderFieldError(error)}
    </div>
  );
}

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

      if (field.is_required && !isAnswered(field, value)) {
        next[field.field_id] = "This field is required.";
        return;
      }

      if (field.profile_field === "dob" && value) {
        if (value > maxDob) {
          next[field.field_id] = "Participant must be at least 18 years old.";
        }
      }

      if (field.profile_field === "dependents" && value !== "") {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) {
          next[field.field_id] = "Dependents must be a whole number greater than or equal to 0.";
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

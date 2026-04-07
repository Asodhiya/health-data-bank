import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText } from '../../utils/sanitize';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { LANGUAGES, COUNTRIES } from '../../utils/formOptions';

/* ── Reusable chip selector (single or multi select) ── */
function ChipSelect({ options, value, onChange, multi = false }) {
  const toggle = (opt) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt]);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = multi ? (value || []).includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              selected
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ── Typeahead dropdown — supports single or multi select ──
   multi mode: value is an array, shows chips, allows adding custom entries
   single mode: value is a string, shows one chip when selected              */
function Autocomplete({ options, value, onChange, placeholder = 'Search...', allowCustom = false, multi = false, inputClass = '' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = multi ? (value || []) : (value ? [value] : []);
  const filtered = options.filter(
    (o) => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o),
  );
  const trimmed = query.trim();
  const showAddCustom = allowCustom && trimmed && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase()) && !selected.some((s) => s.toLowerCase() === trimmed.toLowerCase());

  const add = (val) => {
    if (multi) { onChange([...selected, val]); }
    else { onChange(val); }
    setQuery('');
    setOpen(false);
  };

  const remove = (val) => {
    if (multi) { onChange(selected.filter((s) => s !== val)); }
    else { onChange(''); }
  };

  return (
    <div ref={ref} className="relative">
      {/* Selected chips + inline input */}
      <div className={`${inputClass} flex flex-wrap gap-1.5 min-h-[44px] items-center !py-2`}>
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium whitespace-nowrap">
            {s}
            <button type="button" className="ml-0.5 hover:text-blue-900 text-base leading-none" onClick={() => remove(s)}>&times;</button>
          </span>
        ))}
        {(multi || !value) && (
          <input
            type="text"
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
            placeholder={selected.length ? '' : placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && (filtered.length > 0 || showAddCustom) && (
        <ul className="absolute z-20 w-full mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg text-sm">
          {filtered.map((opt) => (
            <li key={opt} className="px-4 py-2 hover:bg-blue-50 cursor-pointer" onClick={() => add(opt)}>{opt}</li>
          ))}
          {showAddCustom && (
            <li className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-blue-600 font-medium border-t border-slate-100" onClick={() => add(trimmed)}>
              Add &ldquo;<strong>{trimmed}</strong>&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ── Question card wrapper ── */
function Q({ num, label, required = true, children }) {
  return (
    <div className="border border-slate-100 rounded-xl p-4 mb-4">
      <p className="text-sm font-medium text-slate-700 mb-2">
        <span className="text-blue-600 font-bold mr-1">{num}.</span>
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}

export default function IntakePage() {
  const navigate = useNavigate();
  const { refetch } = useAuth();
  // ── Demographics ──
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [pronounsOther, setPronounsOther] = useState('');
  const [languages, setLanguages] = useState([]);

  // ── Lifestyle questions ──
  const [maritalStatus, setMaritalStatus] = useState('');
  const [highestEducation, setHighestEducation] = useState('');

  const [q1, setQ1] = useState('');
  const [q1Other, setQ1Other] = useState('');
  const [q2, setQ2] = useState('');
  const [q2Count, setQ2Count] = useState('');
  const [q4, setQ4] = useState('');

  const [countryOfOrigin, setCountryOfOrigin] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── DOB constraints: must be ≥ 18 years old, no future dates ── */
  const today = new Date();
  const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split('T')[0];

  const dobError = dob && dob > maxDob
    ? 'You must be at least 18 years old.'
    : '';

  /*
    Helper: wrap every text onChange with sanitizeText.
    maxLen parameter controls field-specific limits.
  */
  const onText = (setter, maxLen = 200) => (e) => {
    setter(sanitizeText(e.target.value, maxLen));
  };

  /*
    Pronouns: valid if a preset is selected, OR "Other" is
    selected AND the custom text field is filled.
  */
  const pronounsValid =
    pronouns && (pronouns !== 'Other' || pronounsOther.trim().length > 0);

  /*
    Validation — every required field must be filled.
    "Other" / conditional text fields must also be filled
    when their parent option is selected.
  */
  const isValid = () => {
    if (!dob || dobError || !sex || !pronounsValid || languages.length === 0) return false;
    if (!countryOfOrigin) return false;
    if (!maritalStatus || !highestEducation) return false;
    if (!q1) return false;
    if (q1 === 'Other' && !q1Other.trim()) return false;
    if (!q2) return false;
    if (q2 === 'Yes' && (!q2Count || parseInt(q2Count, 10) < 1)) return false;
    if (!q4) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isValid() || isSubmitting) {
      setError('Please complete all required fields before submitting.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    const profile = {
      dob,
      gender: sex,
      pronouns: pronouns === 'Other' ? pronounsOther : pronouns,
      primary_language: languages.join(', '),
      country_of_origin: countryOfOrigin,
      living_arrangement: q1 === 'Other' ? q1Other : q1,
      dependents: q2 === 'Yes' ? parseInt(q2Count, 10) : 0,
      occupation_status: q4,
      marital_status: maritalStatus,
      highest_education_level: highestEducation,
    };

    const answers = [];

    try {
      await api.submitIntake({ profile, answers });
      await api.completeOnboarding();
      await refetch(); // refresh auth context so intake_completed becomes true
      navigate('/participant');
    } catch (err) {
      if (err?.status === 409) {
        setError('This intake form was already submitted for your account. Please sign out and back in if the page did not update.');
      } else {
        setError(err.message || 'Failed to submit. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Shared Tailwind input classes */
  const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  return (
    <>
      {/* Page heading */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          Intake Questionnaire
        </h2>
        <p className="text-sm text-slate-400">
          Appendix D — Connections for Healthy Living
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          SECTION 1: DEMOGRAPHICS
      ═══════════════════════════════════════════════ */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Personal Information
      </p>

      {/* Name — auto-filled from registration, read-only */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Name
        </label>
        <input
          type="text"
          className={`${inputClass} bg-slate-100 cursor-not-allowed text-slate-400`}
          value="Auto-filled from registration"
          readOnly
        />
        <p className="text-xs text-slate-400 mt-1">Auto-filled from your account</p>
      </div>

      {/* Row: DOB + Sex */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Date of Birth <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            className={inputClass}
            value={dob}
            max={maxDob}
            onChange={(e) => setDob(e.target.value)}
          />
          {dobError && (
            <p className="text-xs text-rose-500 mt-1">{dobError}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Sex <span className="text-rose-500">*</span>
          </label>
          <ChipSelect options={['Male', 'Female']} value={sex} onChange={setSex} />
        </div>
      </div>

      {/* Pronouns — "Other" reveals a text input */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Preferred Pronouns <span className="text-rose-500">*</span>
        </label>
        <ChipSelect
          options={['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Other']}
          value={pronouns}
          onChange={setPronouns}
        />
        {pronouns === 'Other' && (
          <input
            type="text"
            className={`${inputClass} mt-2.5`}
            placeholder="Enter your pronouns..."
            maxLength={50}
            value={pronounsOther}
            onChange={onText(setPronounsOther, 50)}
          />
        )}
      </div>

      {/* Language */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Language Spoken at Home <span className="text-rose-500">*</span>
        </label>
        <Autocomplete
          options={LANGUAGES}
          value={languages}
          onChange={setLanguages}
          placeholder="Start typing to search languages..."
          allowCustom
          multi
          inputClass={inputClass}
        />
      </div>

      {/* Country of Origin */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Country of Origin <span className="text-rose-500">*</span>
        </label>
        <Autocomplete
          options={COUNTRIES}
          value={countryOfOrigin}
          onChange={setCountryOfOrigin}
          placeholder="Start typing to search countries..."
          inputClass={inputClass}
        />
      </div>

      {/* Marital Status */}
      <div className="mb-3.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Marital Status <span className="text-rose-500">*</span>
        </label>
        <ChipSelect
          options={['Single', 'Married', 'Common-law', 'Separated', 'Divorced', 'Widowed']}
          value={maritalStatus}
          onChange={setMaritalStatus}
        />
      </div>

      {/* Highest Education Level */}
      <div>
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Highest Education Level <span className="text-rose-500">*</span>
        </label>
        <ChipSelect
          options={['High school', 'Some college/university', "Bachelor's degree", "Master's degree", 'Doctoral degree', 'Trade/vocational']}
          value={highestEducation}
          onChange={setHighestEducation}
        />
      </div>

      <hr className="border-slate-100 my-5" />

      {/* ═══════════════════════════════════════════════
          SECTION 2: LIFESTYLE QUESTIONS (1–13)
      ═══════════════════════════════════════════════ */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Lifestyle &amp; Wellness Questions
      </p>

      {/* Q1 */}
      <Q num={1} label="Who do you live with?">
        <ChipSelect options={['Alone', 'With Family', 'With Friends', 'With Partner', 'With Roommates', 'Other']} value={q1} onChange={setQ1} />
        {q1 === 'Other' && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q1Other} onChange={onText(setQ1Other, 200)} />
        )}
      </Q>

      {/* Q2 */}
      <Q num={2} label="Do you have any dependents?">
        <ChipSelect options={['No', 'Yes']} value={q2} onChange={(v) => { setQ2(v); if (v === 'No') setQ2Count(''); }} />
        {q2 === 'Yes' && (
          <input type="number" className={`${inputClass} mt-2.5`} placeholder="How many dependents?" min={1} max={10} value={q2Count} onChange={(e) => {
            const val = e.target.value;
            if (val === '' || (parseInt(val, 10) >= 1 && parseInt(val, 10) <= 10)) setQ2Count(val);
          }} />
        )}
      </Q>

      {/* Q3 */}
      <Q num={3} label="What is your employment status?">
        <ChipSelect options={['Unemployed', 'Part-time', 'Full-time', 'Self-employed', 'Freelance', 'Student', 'Retired']} value={q4} onChange={setQ4} />
      </Q>

      <hr className="border-slate-100 my-5" />

      {/* ── Navigation ── */}
      <div className="flex gap-3">
        <button
          type="button"
          className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={() => navigate('/onboarding/consent')}
        >
          ← Back
        </button>
        <button
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
            isValid() && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!isValid() || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Submitting...' : 'Submit &amp; Complete Onboarding'}
        </button>
      </div>
    </>
  );
}

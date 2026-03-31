import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText } from '../../utils/sanitize';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  const fieldMapRef = useRef({});  // display_order → field_id

  // Fetch intake form field IDs on mount
  useEffect(() => {
    api.getIntakeForm().then((form) => {
      const map = {};
      form.fields.forEach((f) => { map[f.display_order] = f.field_id; });
      fieldMapRef.current = map;
    }).catch(() => {});
  }, []);

  // ── Demographics ──
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [pronounsOther, setPronounsOther] = useState('');
  const [program, setProgram] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [language, setLanguage] = useState('');
  const [international, setInternational] = useState('');
  const [country, setCountry] = useState('');

  // ── Lifestyle questions ──
  const [maritalStatus, setMaritalStatus] = useState('');
  const [highestEducation, setHighestEducation] = useState('');

  const [q1, setQ1] = useState('');
  const [q1Other, setQ1Other] = useState('');
  const [q2, setQ2] = useState('');
  const [q2Specify, setQ2Specify] = useState('');
  const [q4, setQ4] = useState('');

  const [error, setError] = useState('');

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
    Country is intentionally NOT required.
  */
  const isValid = () => {
    if (!dob || !sex || !pronounsValid || !program || !yearOfStudy || !language || !international) return false;
    if (!maritalStatus || !highestEducation) return false;
    if (!q1) return false;
    if (q1 === 'Other' && !q1Other.trim()) return false;
    if (!q2) return false;
    if (q2 === 'Yes' && !q2Specify.trim()) return false;
    if (!q4) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isValid()) {
      setError('Please complete all required fields before submitting.');
      return;
    }
    setError('');

    const fm = fieldMapRef.current;

    const profile = {
      dob,
      gender: sex,
      pronouns: pronouns === 'Other' ? pronounsOther : pronouns,
      primary_language: language,
      living_arrangement: q1 === 'Other' ? q1Other : q1,
      dependents: q2 === 'Yes',
      occupation_status: q4,
      marital_status: maritalStatus,
      highest_education_level: highestEducation,
    };

    const answers = [
      { field_id: fm[1], value: program },
      { field_id: fm[2], value: yearOfStudy },
      { field_id: fm[3], value: international },
      { field_id: fm[4], value: international === 'Yes' ? country || null : null },
    ].filter(a => a.field_id && a.value !== null && a.value !== undefined && a.value !== '');

    try {
      await api.submitIntake({ profile, answers });
      await api.completeOnboarding();
      await refetch(); // refresh auth context so intake_completed becomes true
      navigate('/participant');
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
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
            onChange={(e) => setDob(e.target.value)}
          />
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
        <input
          type="text"
          className={inputClass}
          placeholder="e.g. English"
          maxLength={100}
          value={language}
          onChange={onText(setLanguage, 100)}
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

      {/* Row: Program + Year of Study */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Undergraduate Program <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Computer Science"
            maxLength={200}
            value={program}
            onChange={onText(setProgram, 200)}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Year of Study <span className="text-rose-500">*</span>
          </label>
          <ChipSelect options={['1', '2', '3', '4', '5+']} value={yearOfStudy} onChange={setYearOfStudy} />
        </div>
      </div>

      {/* International Student */}
      <div className="mb-4">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          International Student <span className="text-rose-500">*</span>
        </label>
        <ChipSelect options={['Yes', 'No']} value={international} onChange={setInternational} />
        {international === 'Yes' && (
          <div className="mt-2.5">
            <input
              type="text"
              className={inputClass}
              placeholder="Which country are you from? (optional)"
              maxLength={100}
              value={country}
              onChange={onText(setCountry, 100)}
            />
            <p className="text-xs text-slate-400 mt-1">This is optional — you don't have to share this</p>
          </div>
        )}
      </div>

      {/* Q1 */}
      <Q num={1} label="Where do you live?">
        <ChipSelect options={['On campus', 'With Friends', 'With Family', 'Other']} value={q1} onChange={setQ1} />
        {q1 === 'Other' && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q1Other} onChange={onText(setQ1Other, 200)} />
        )}
      </Q>

      {/* Q2 */}
      <Q num={2} label="Do you have any dependents?">
        <ChipSelect options={['No', 'Yes']} value={q2} onChange={setQ2} />
        {q2 === 'Yes' && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q2Specify} onChange={onText(setQ2Specify, 200)} />
        )}
      </Q>

      {/* Q3 */}
      <Q num={3} label="Do you work?">
        <ChipSelect options={["Don't work", 'Less than 10 hrs/week', '10–20 hrs/week', 'Over 20 hrs/week']} value={q4} onChange={setQ4} />
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
            isValid()
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!isValid()}
          onClick={handleSubmit}
        >
          Submit &amp; Complete Onboarding
        </button>
      </div>
    </>
  );
}

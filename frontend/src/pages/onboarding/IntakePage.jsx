import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText, sanitizeNumber } from '../../utils/sanitize';
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
  const [q3, setQ3] = useState([]);
  const [q3Other, setQ3Other] = useState('');
  const [q4, setQ4] = useState('');
  const [q5, setQ5] = useState([]);
  const [q6, setQ6] = useState([]);
  const [q6Other, setQ6Other] = useState('');
  const [q7, setQ7] = useState([]);
  const [q7Other, setQ7Other] = useState('');
  const [q8, setQ8] = useState([]);
  const [q8Other, setQ8Other] = useState('');
  const [q9, setQ9] = useState('');
  const [q10, setQ10] = useState('');
  const [q11, setQ11] = useState('');
  const [q12, setQ12] = useState('');
  const [q13, setQ13] = useState('');

  const [error, setError] = useState('');

  /*
    Helper: wrap every text onChange with sanitizeText.
    maxLen parameter controls field-specific limits.
  */
  const onText = (setter, maxLen = 200) => (e) => {
    setter(sanitizeText(e.target.value, maxLen));
  };

  /*
    Helper: wrap number onChange with sanitizeNumber.
    Rejects invalid or out-of-range values silently.
  */
  const onNumber = (setter, min, max) => (e) => {
    const result = sanitizeNumber(e.target.value, min, max);
    if (result !== null) setter(result);
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
    if (q3.length === 0) return false;
    if (q3.includes('Other') && !q3Other.trim()) return false;
    if (!q4 || q5.length === 0 || q6.length === 0) return false;
    if (q6.includes('Other drugs') && !q6Other.trim()) return false;
    if (q7.length === 0 || q8.length === 0) return false;
    if (q7.includes('Other') && !q7Other.trim()) return false;
    if (q8.includes('Other') && !q8Other.trim()) return false;
    if (!q9 || !q10 || !q11 || !q12 || !q13) return false;
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
      { field_id: fm[1],  value: program },
      { field_id: fm[2],  value: yearOfStudy },
      { field_id: fm[3],  value: international },
      { field_id: fm[4],  value: international === 'Yes' ? country || null : null },
      { field_id: fm[5],  value: q3.includes('Other') ? [...q3.filter(v => v !== 'Other'), q3Other] : q3 },
      { field_id: fm[6],  value: q5 },
      { field_id: fm[7],  value: q6.includes('Other drugs') ? [...q6.filter(v => v !== 'Other drugs'), q6Other] : q6 },
      { field_id: fm[8],  value: q7.includes('Other') ? [...q7.filter(v => v !== 'Other'), q7Other] : q7 },
      { field_id: fm[9],  value: q8.includes('Other') ? [...q8.filter(v => v !== 'Other'), q8Other] : q8 },
      { field_id: fm[10], value: q9 },
      { field_id: fm[11], value: Number(q10) },
      { field_id: fm[12], value: Number(q11) },
      { field_id: fm[13], value: q12 },
      { field_id: fm[14], value: q13 },
    ].filter(a => a.field_id && a.value !== null && a.value !== undefined && a.value !== '');

    try {
      await api.submitIntake({ profile, answers });
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
      <Q num={3} label="What access to transportation do you have? (Select all that apply)">
        <ChipSelect options={['Bus', 'Walking', 'Car', 'Bike', 'Other']} value={q3} onChange={setQ3} multi />
        {q3.includes('Other') && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q3Other} onChange={onText(setQ3Other, 200)} />
        )}
      </Q>

      {/* Q4 */}
      <Q num={4} label="Do you work?">
        <ChipSelect options={["Don't work", 'Less than 10 hrs/week', '10–20 hrs/week', 'Over 20 hrs/week']} value={q4} onChange={setQ4} />
      </Q>

      {/* Q5 */}
      <Q num={5} label="What causes stress in your life? (Select all that apply)">
        <ChipSelect options={['School', 'Work', 'Social life', 'Home life']} value={q5} onChange={setQ5} multi />
      </Q>

      {/* Q6 — "Other drugs" reveals text input */}
      <Q num={6} label="In the past month, which of these substances have you consumed? (Select all that apply)">
        <ChipSelect options={['Alcohol', 'THC / Cannabis', 'Cigarettes / Tobacco / Vaping', 'Other drugs', 'None']} value={q6} onChange={setQ6} multi />
        {q6.includes('Other drugs') && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify which substance(s)..." maxLength={200} value={q6Other} onChange={onText(setQ6Other, 200)} />
        )}
      </Q>

      {/* Q7 */}
      <Q num={7} label="Do you have any barriers to eating the foods that you want to? (Select all that apply)">
        <ChipSelect options={['Income', 'Transportation', 'Lack of variety/choice', 'Lack of storage', 'Lack of kitchen access', 'Lack of food skills', 'Loneliness', 'Health conditions', 'None', 'Other']} value={q7} onChange={setQ7} multi />
        {q7.includes('Other') && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q7Other} onChange={onText(setQ7Other, 200)} />
        )}
      </Q>

      {/* Q8 */}
      <Q num={8} label="Where do you eat most of your meals? (Select all that apply)">
        <ChipSelect options={['At home', 'On campus (cafeteria)', 'On campus (brought from home)', 'Restaurants', 'Other']} value={q8} onChange={setQ8} multi />
        {q8.includes('Other') && (
          <input type="text" className={`${inputClass} mt-2.5`} placeholder="Please specify..." maxLength={200} value={q8Other} onChange={onText(setQ8Other, 200)} />
        )}
      </Q>

      {/* Q9 */}
      <Q num={9} label="Do you eat alone or with others for the majority of your meals?">
        <ChipSelect options={['Alone', 'With others', 'Mix of both']} value={q9} onChange={setQ9} />
      </Q>

      {/* Q10 — Days per week: 0–7 only */}
      <Q num={10} label="In a typical week, how many days do you perform moderate (brisk walking) to vigorous (running) aerobic activity?">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="7"
            className={`${inputClass} w-20 text-center`}
            placeholder="0"
            value={q10}
            onChange={onNumber(setQ10, 0, 7)}
          />
          <span className="text-sm text-slate-500">days per week</span>
        </div>
      </Q>

      {/* Q11 — Minutes: 0–1440 (max 24 hrs in a day) */}
      <Q num={11} label="On average, for those days, how many minutes of moderate-to-vigorous aerobic activity do you do?">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="1440"
            className={`${inputClass} w-20 text-center`}
            placeholder="0"
            value={q11}
            onChange={onNumber(setQ11, 0, 1440)}
          />
          <span className="text-sm text-slate-500">minutes</span>
        </div>
      </Q>

      {/* Q12 */}
      <Q num={12} label="Which category would you be most interested in focusing on during this program?">
        <ChipSelect options={['Cardio / Endurance', 'Functional Strength / Resistance', 'Both']} value={q12} onChange={setQ12} />
      </Q>

      {/* Q13 */}
      <Q num={13} label="On a typical day, how many hours do you spend sitting (school, work, commuting)?">
        <ChipSelect options={['< 1 hour', '1–3 hours', '3–5 hours', '> 5 hours']} value={q13} onChange={setQ13} />
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

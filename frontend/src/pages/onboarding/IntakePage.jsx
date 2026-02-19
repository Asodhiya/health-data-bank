import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText, sanitizeNumber, trimPayload } from '../../utils/sanitize';

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
    <div className="intake-chip-group">
      {options.map((opt) => {
        const selected = multi ? (value || []).includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            className={`intake-chip ${selected ? 'intake-chip-selected' : ''}`}
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
    <div className="intake-question-card">
      <p className="intake-question-label">
        <span className="intake-question-num">{num}.</span>
        {label}
        {required && <span className="intake-required-star">*</span>}
      </p>
      {children}
    </div>
  );
}

export default function IntakePage() {
  const navigate = useNavigate();

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

  const handleSubmit = () => {
    if (!isValid()) {
      setError('Please complete all required fields before submitting.');
      return;
    }
    setError('');

    // TODO: Send intake data to backend API
    // trimPayload trims every string right before sending
    // const payload = trimPayload({
    //   demographics: {
    //     dob, sex,
    //     pronouns: pronouns === 'Other' ? pronounsOther : pronouns,
    //     program, yearOfStudy, language,
    //     international,
    //     country: international === 'Yes' ? country || null : null,
    //   },
    //   questions: {
    //     living: q1 === 'Other' ? q1Other : q1,
    //     dependents: q2 === 'Yes' ? q2Specify : 'No',
    //     transportation: q3.includes('Other') ? [...q3.filter(v => v !== 'Other'), q3Other] : q3,
    //     work: q4,
    //     stress_sources: q5,
    //     substances: q6.includes('Other drugs') ? [...q6.filter(v => v !== 'Other drugs'), q6Other] : q6,
    //     food_barriers: q7.includes('Other') ? [...q7.filter(v => v !== 'Other'), q7Other] : q7,
    //     meal_locations: q8.includes('Other') ? [...q8.filter(v => v !== 'Other'), q8Other] : q8,
    //     eat_alone_or_others: q9,
    //     aerobic_days_per_week: Number(q10),
    //     aerobic_minutes: Number(q11),
    //     exercise_focus: q12,
    //     sitting_hours: q13,
    //   },
    //   submitted_at: new Date().toISOString(),
    // });
    // await api.submitIntake(payload);

    navigate('/participant');
  };

  return (
    <>
      {/* Page heading */}
      <div className="text-center" style={{ marginBottom: '1.25rem' }}>
        <h2
          className="text-2xl font-bold"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-primary)',
            marginBottom: '0.25rem',
          }}
        >
          Intake Questionnaire
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Appendix D — Connections for Healthy Living
        </p>
      </div>

      {/* Error */}
      {error && <div className="auth-error">{error}</div>}

      {/* ═══════════════════════════════════════════════
          SECTION 1: DEMOGRAPHICS
      ═══════════════════════════════════════════════ */}
      <p className="onboarding-section-label">Personal Information</p>

      {/* Name — auto-filled from registration, read-only */}
      <div style={{ marginBottom: '14px' }}>
        <label className="consent-field-label">Name</label>
        <input
          type="text"
          className="intake-input intake-input-readonly"
          value="Auto-filled from registration"
          readOnly
        />
        <p className="intake-hint">Auto-filled from your account</p>
      </div>

      {/* Row: DOB + Sex */}
      <div className="intake-row" style={{ marginBottom: '14px' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label className="consent-field-label">
            Date of Birth <span className="intake-required-star">*</span>
          </label>
          <input
            type="date"
            className="intake-input"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label className="consent-field-label">
            Sex <span className="intake-required-star">*</span>
          </label>
          <ChipSelect options={['Male', 'Female']} value={sex} onChange={setSex} />
        </div>
      </div>

      {/* Pronouns — "Other" reveals a text input */}
      <div style={{ marginBottom: '14px' }}>
        <label className="consent-field-label">
          Preferred Pronouns <span className="intake-required-star">*</span>
        </label>
        <ChipSelect
          options={['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Other']}
          value={pronouns}
          onChange={setPronouns}
        />
        {pronouns === 'Other' && (
          <input
            type="text"
            className="intake-input"
            style={{ marginTop: '10px' }}
            placeholder="Enter your pronouns..."
            maxLength={50}
            value={pronounsOther}
            onChange={onText(setPronounsOther, 50)}
          />
        )}
      </div>

      {/* International Student — "Yes" reveals optional country field */}
      <div style={{ marginBottom: '14px' }}>
        <label className="consent-field-label">
          International Student <span className="intake-required-star">*</span>
        </label>
        <ChipSelect options={['Yes', 'No']} value={international} onChange={setInternational} />
        {international === 'Yes' && (
          <div style={{ marginTop: '10px' }}>
            <input
              type="text"
              className="intake-input"
              placeholder="Which country are you from? (optional)"
              maxLength={100}
              value={country}
              onChange={onText(setCountry, 100)}
            />
            <p className="intake-hint">This is optional — you don't have to share this</p>
          </div>
        )}
      </div>

      {/* Row: Program + Year of Study */}
      <div className="intake-row" style={{ marginBottom: '14px' }}>
        <div style={{ flex: '1 1 260px' }}>
          <label className="consent-field-label">
            Undergraduate Program <span className="intake-required-star">*</span>
          </label>
          <input
            type="text"
            className="intake-input"
            placeholder="e.g. Computer Science"
            maxLength={200}
            value={program}
            onChange={onText(setProgram, 200)}
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="consent-field-label">
            Year of Study <span className="intake-required-star">*</span>
          </label>
          <ChipSelect options={['1', '2', '3', '4', '5+']} value={yearOfStudy} onChange={setYearOfStudy} />
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="consent-field-label">
          Language Spoken at Home <span className="intake-required-star">*</span>
        </label>
        <input
          type="text"
          className="intake-input"
          placeholder="e.g. English"
          maxLength={100}
          value={language}
          onChange={onText(setLanguage, 100)}
        />
      </div>

      <hr className="onboarding-divider" />

      {/* ═══════════════════════════════════════════════
          SECTION 2: LIFESTYLE QUESTIONS (1–13)
      ═══════════════════════════════════════════════ */}
      <p className="onboarding-section-label">Lifestyle &amp; Wellness Questions</p>

      {/* Q1 */}
      <Q num={1} label="Where do you live?">
        <ChipSelect options={['On campus', 'With Friends', 'With Family', 'Other']} value={q1} onChange={setQ1} />
        {q1 === 'Other' && (
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify..." maxLength={200} value={q1Other} onChange={onText(setQ1Other, 200)} />
        )}
      </Q>

      {/* Q2 */}
      <Q num={2} label="Do you have any dependents?">
        <ChipSelect options={['No', 'Yes']} value={q2} onChange={setQ2} />
        {q2 === 'Yes' && (
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify..." maxLength={200} value={q2Specify} onChange={onText(setQ2Specify, 200)} />
        )}
      </Q>

      {/* Q3 */}
      <Q num={3} label="What access to transportation do you have? (Select all that apply)">
        <ChipSelect options={['Bus', 'Walking', 'Car', 'Bike', 'Other']} value={q3} onChange={setQ3} multi />
        {q3.includes('Other') && (
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify..." maxLength={200} value={q3Other} onChange={onText(setQ3Other, 200)} />
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
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify which substance(s)..." maxLength={200} value={q6Other} onChange={onText(setQ6Other, 200)} />
        )}
      </Q>

      {/* Q7 */}
      <Q num={7} label="Do you have any barriers to eating the foods that you want to? (Select all that apply)">
        <ChipSelect options={['Income', 'Transportation', 'Lack of variety/choice', 'Lack of storage', 'Lack of kitchen access', 'Lack of food skills', 'Loneliness', 'Health conditions', 'None', 'Other']} value={q7} onChange={setQ7} multi />
        {q7.includes('Other') && (
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify..." maxLength={200} value={q7Other} onChange={onText(setQ7Other, 200)} />
        )}
      </Q>

      {/* Q8 */}
      <Q num={8} label="Where do you eat most of your meals? (Select all that apply)">
        <ChipSelect options={['At home', 'On campus (cafeteria)', 'On campus (brought from home)', 'Restaurants', 'Other']} value={q8} onChange={setQ8} multi />
        {q8.includes('Other') && (
          <input type="text" className="intake-input" style={{ marginTop: 10 }} placeholder="Please specify..." maxLength={200} value={q8Other} onChange={onText(setQ8Other, 200)} />
        )}
      </Q>

      {/* Q9 */}
      <Q num={9} label="Do you eat alone or with others for the majority of your meals?">
        <ChipSelect options={['Alone', 'With others', 'Mix of both']} value={q9} onChange={setQ9} />
      </Q>

      {/* Q10 — Days per week: 0–7 only */}
      <Q num={10} label="In a typical week, how many days do you perform moderate (brisk walking) to vigorous (running) aerobic activity?">
        <div className="intake-number-row">
          <input
            type="number"
            min="0"
            max="7"
            className="intake-input intake-number-input"
            placeholder="0"
            value={q10}
            onChange={onNumber(setQ10, 0, 7)}
          />
          <span className="intake-number-unit">days per week</span>
        </div>
      </Q>

      {/* Q11 — Minutes: 0–1440 (max 24 hrs in a day) */}
      <Q num={11} label="On average, for those days, how many minutes of moderate-to-vigorous aerobic activity do you do?">
        <div className="intake-number-row">
          <input
            type="number"
            min="0"
            max="1440"
            className="intake-input intake-number-input"
            placeholder="0"
            value={q11}
            onChange={onNumber(setQ11, 0, 1440)}
          />
          <span className="intake-number-unit">minutes</span>
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

      <hr className="onboarding-divider" />

      {/* ── Navigation ── */}
      <div className="consent-nav-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/onboarding/consent')}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 1 }}
          disabled={!isValid()}
          onClick={handleSubmit}
        >
          Submit &amp; Complete Onboarding
        </button>
      </div>
    </>
  );
}

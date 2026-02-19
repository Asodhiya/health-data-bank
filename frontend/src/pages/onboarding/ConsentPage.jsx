import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText, sanitizeEmail, trimPayload } from '../../utils/sanitize';

/*
  All 13 consent items from Appendix B.
  "required: true" means the user MUST answer YES to proceed.
  "required: false" means the user can answer YES or NO freely.
*/
const CONSENT_ITEMS = [
  { id: 'read_understood', text: 'I have read and understand the Background Information Sheet.', required: true },
  { id: 'right_to_withdraw', text: 'I understand that I have the right to withdraw from the research study at any time without reason, and I will receive no penalty.', required: true },
  { id: 'direct_quotations', text: 'I give permission for the use of direct quotations.', required: false },
  { id: 'future_contact', text: 'I give permission for the research team to contact me for future research studies.', required: false },
  { id: 'freedom_withdraw', text: 'I understand that I have the freedom to withdraw from the research study by February 28, 2023. All information collected from you within this study will be deleted.', required: true },
  { id: 'no_waiver', text: 'I understand that no waiver of rights is sought.', required: true },
  { id: 'keep_copy', text: 'I understand that I can keep a copy of the signed and dated consent form.', required: true },
  { id: 'confidential', text: 'I understand that the information will be kept confidential within the limits of the law.', required: true },
  { id: 'agree_participate', text: 'I agree to participate in the research study.', required: true },
  { id: 'use_data', text: 'I give permission for the use of my data.', required: true },
  { id: 'contact_ethics', text: 'I understand that I can contact the UPEI Research Ethics Board at (902) 620-5104, or by email at researchcompliance@upei.ca.', required: true },
  { id: 'group_confidential', text: 'I understand that the program will take place in a group setting so information shared within the group will remain confidential.', required: true },
  { id: 'no_guarantee', text: 'Participants are reminded to keep information shared during group sessions confidential but that the research team cannot guarantee confidentiality of group sessions.', required: true },
];

/* Format today's date for display */
function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* Reusable YES / NO toggle component */
function YesNoToggle({ value, onChange }) {
  return (
    <div className="consent-toggle-group">
      <button
        type="button"
        className={`consent-toggle-btn ${value === 'yes' ? 'consent-toggle-yes' : ''}`}
        onClick={() => onChange('yes')}
      >
        Yes
      </button>
      <button
        type="button"
        className={`consent-toggle-btn ${value === 'no' ? 'consent-toggle-no' : ''}`}
        onClick={() => onChange('no')}
      >
        No
      </button>
    </div>
  );
}

export default function ConsentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [signature, setSignature] = useState('');
  const [wantResults, setWantResults] = useState(false);
  const [resultEmail, setResultEmail] = useState('');
  const [error, setError] = useState('');

  const setAnswer = (id, val) => setAnswers({ ...answers, [id]: val });

  /* Validation checks */
  const allAnswered = CONSENT_ITEMS.every((c) => answers[c.id] !== undefined);
  const requiredItems = CONSENT_ITEMS.filter((c) => c.required);
  const allRequiredYes = requiredItems.every((c) => answers[c.id] === 'yes');
  const canSubmit = allAnswered && allRequiredYes && signature.trim().length > 0;

  const handleSubmit = () => {
    if (!allAnswered) {
      setError('Please answer all consent items before proceeding.');
      return;
    }
    if (!allRequiredYes) {
      setError('You must select YES on all required items to participate in this study.');
      return;
    }
    if (!signature.trim()) {
      setError('Please type your full name as your digital signature.');
      return;
    }
    setError('');

    // TODO: Send consent data to backend API
    // trimPayload trims all strings right before sending
    // const payload = trimPayload({
    //   answers,
    //   signature: signature,
    //   consent_date: new Date().toISOString(),
    //   want_results: wantResults,
    //   result_email: wantResults ? resultEmail : null,
    // });
    // await api.submitConsent(payload);

    navigate('/onboarding/intake');
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
          Letter of Informed Consent
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Appendix B — Connections for Healthy Living
        </p>
      </div>

      {/* Error */}
      {error && <div className="auth-error">{error}</div>}

      {/* ── Section 1: Consent Checklist ── */}
      <p className="onboarding-section-label">Participant Consent Checklist</p>

      <div className="consent-checklist">
        {CONSENT_ITEMS.map((item) => {
          const val = answers[item.id];
          const isRequiredNo = item.required && val === 'no';

          return (
            <div
              key={item.id}
              className={`consent-item ${
                isRequiredNo ? 'consent-item-error' : ''
              } ${val === 'yes' ? 'consent-item-yes' : ''}`}
            >
              <div style={{ flex: 1 }}>
                <p className="consent-item-text">{item.text}</p>
                {item.required && (
                  <span
                    className={`consent-item-badge ${
                      isRequiredNo ? 'consent-item-badge-error' : ''
                    }`}
                  >
                    {isRequiredNo ? '⚠ Required — must be YES to participate' : 'Required'}
                  </span>
                )}
              </div>
              <YesNoToggle value={val} onChange={(v) => setAnswer(item.id, v)} />
            </div>
          );
        })}
      </div>

      {/* ── Divider ── */}
      <hr className="onboarding-divider" />

      {/* ── Section 2: Digital Signature ── */}
      <p className="onboarding-section-label">Digital Signature</p>

      <div style={{ marginBottom: '0.5rem' }}>
        <label className="consent-field-label">Full Name (Participant Signature)</label>
        <input
          type="text"
          className="consent-signature-input"
          placeholder="Type your full legal name"
          maxLength={200}
          value={signature}
          onChange={(e) => setSignature(sanitizeText(e.target.value, 200))}
        />
      </div>

      {/* Auto date */}
      <p className="consent-auto-date">
        Date of consent:{' '}
        <span className="consent-auto-date-value">{formatDate()}</span>
        <span className="consent-auto-date-note">(recorded automatically)</span>
      </p>

      {/* ── Divider ── */}
      <hr className="onboarding-divider" />

      {/* ── Section 3: Optional Results Request ── */}
      <p className="onboarding-section-label">Sharing Study Results (Optional)</p>

      <div className="consent-optional-card">
        <label className="consent-checkbox-label">
          <input
            type="checkbox"
            checked={wantResults}
            onChange={(e) => setWantResults(e.target.checked)}
            className="consent-checkbox"
          />
          <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
            I would like to receive the results of the study by email
          </span>
        </label>

        {wantResults && (
          <input
            type="email"
            className="auth-input"
            style={{ paddingLeft: '16px', marginTop: '12px' }}
            placeholder="your.email@example.com"
            maxLength={254}
            value={resultEmail}
            onChange={(e) => setResultEmail(sanitizeEmail(e.target.value))}
          />
        )}
      </div>

      {/* ── Progress counter ── */}
      <div className="consent-progress">
        <span>
          {Object.keys(answers).length} of {CONSENT_ITEMS.length} items answered
        </span>
        {canSubmit && (
          <span className="consent-progress-ready">✓ Ready to submit</span>
        )}
      </div>

      {/* ── Navigation buttons ── */}
      <div className="consent-nav-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/onboarding/background')}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 1 }}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Sign &amp; Continue to Intake Form
        </button>
      </div>
    </>
  );
}

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
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
          value === 'yes'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
        onClick={() => onChange('yes')}
      >
        Yes
      </button>
      <button
        type="button"
        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
          value === 'no'
            ? 'bg-slate-600 text-white border-slate-600'
            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
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
  //const [wantResults, setWantResults] = useState(false);
  //const [resultEmail, setResultEmail] = useState('');
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
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          Letter of Informed Consent
        </h2>
        <p className="text-sm text-slate-400">
          Appendix B — Connections for Healthy Living
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* ── Section 1: Consent Checklist ── */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Participant Consent Checklist
      </p>

      <div className="space-y-3 mb-6">
        {CONSENT_ITEMS.map((item) => {
          const val = answers[item.id];
          const isRequiredNo = item.required && val === 'no';

          return (
            <div
              key={item.id}
              className={`border rounded-xl p-4 transition-colors ${
                isRequiredNo
                  ? 'border-rose-200 bg-rose-50/30'
                  : val === 'yes'
                    ? 'border-blue-200 bg-blue-50/30'
                    : 'border-slate-100'
              }`}
            >
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{item.text}</p>
                  {item.required && (
                    <span
                      className={`inline-block text-xs font-bold mt-1.5 ${
                        isRequiredNo ? 'text-rose-500' : 'text-rose-500'
                      }`}
                    >
                      {isRequiredNo ? '⚠ Required — must be YES to participate' : 'Required'}
                    </span>
                  )}
                </div>
                <YesNoToggle value={val} onChange={(v) => setAnswer(item.id, v)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Divider ── */}
      <hr className="border-slate-100 mb-5" />

      {/* ── Section 2: Digital Signature ── */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Digital Signature
      </p>

      <div className="mb-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Full Name (Participant Signature)
        </label>
        <input
          type="text"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          placeholder="Type your full legal name"
          maxLength={200}
          value={signature}
          onChange={(e) => setSignature(sanitizeText(e.target.value, 200))}
        />
      </div>

      {/* Auto date */}
      <div className="flex items-center gap-2 mb-5 text-xs text-slate-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>
          Date of consent:{' '}
          <strong className="text-slate-600">{formatDate()}</strong>
          <span className="text-slate-400 ml-1">(recorded automatically)</span>
        </span>
      </div>
      
      {/* 
      <hr className="border-slate-100 mb-5" />
      */}
      {/* 
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Sharing Study Results (Optional)
      </p>

      <div className="border border-slate-100 rounded-xl p-4 mb-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={wantResults}
            onChange={(e) => setWantResults(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            I would like to receive the results of the study by email
          </span>
        </label>

        {wantResults && (
          <input
            type="email"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow mt-3"
            placeholder="your.email@example.com"
            maxLength={254}
            value={resultEmail}
            onChange={(e) => setResultEmail(sanitizeEmail(e.target.value))}
          />
        )}
      </div>
      */}
      
      {/* ── Progress counter ── */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
        <span>
          {Object.keys(answers).length} of {CONSENT_ITEMS.length} items answered
        </span>
        {canSubmit && (
          <span className="text-emerald-600 font-bold">✓ Ready to submit</span>
        )}
      </div>

      {/* ── Navigation buttons ── */}
      <div className="flex gap-3">
        <button
          type="button"
          className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={() => navigate('/onboarding/background')}
        >
          ← Back
        </button>
        <button
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          Sign &amp; Continue to Intake Form
        </button>
      </div>
    </>
  );
}

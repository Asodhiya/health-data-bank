import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sanitizeText, sanitizeEmail, trimPayload } from '../../utils/sanitize';
import { api } from '../../services/api';

/* Format today's date for display */
function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}


export default function ConsentPage() {
  const navigate = useNavigate();
  const [consentItems, setConsentItems] = useState([]);
  const [templateTitle, setTemplateTitle] = useState('Letter of Informed Consent');
  const [templateSubtitle, setTemplateSubtitle] = useState('Appendix B — Connections for Healthy Living');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [answers, setAnswers] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('consent_answers') || '{}'); } catch { return {}; }
  });
  const [signature, setSignature] = useState(() => sessionStorage.getItem('consent_signature') || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Fetch consent template from backend */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getConsentForm();
        if (cancelled) return;
        setConsentItems(data.items || []);
        if (data.title) setTemplateTitle(data.title);
        if (data.subtitle) setTemplateSubtitle(data.subtitle);
      } catch (err) {
        if (!cancelled) setFetchError(err.message || 'Failed to load consent form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { sessionStorage.setItem('consent_answers', JSON.stringify(answers)); }, [answers]);
  useEffect(() => { sessionStorage.setItem('consent_signature', signature); }, [signature]);

  const toggleAnswer = (id) => {
    setAnswers((prev) => ({ ...prev, [id]: prev[id] === 'yes' ? 'no' : 'yes' }));
  };

  /* Validation checks */
  const allAgreed = consentItems.length > 0 && consentItems.every((c) => answers[c.id] === 'yes');
  const canSubmit = allAgreed && signature.trim().length > 0;

  const handleSubmit = async () => {
    if (!allAgreed) {
      setError('You must agree to all consent items to participate in this study.');
      return;
    }
    if (!signature.trim()) {
      setError('Please type your full name as your digital signature.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const payload = trimPayload({
        answers,
        signature,
      });
      await api.submitConsent(payload);
      navigate('/onboarding/intake');
    } catch (err) {
      setError(err.message || 'Failed to submit consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Page heading */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">
          {templateTitle}
        </h2>
        <p className="text-sm text-slate-400">
          {templateSubtitle}
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-slate-400 text-sm">Loading consent form...</div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mb-4">
          {fetchError}
        </div>
      )}

      {/* Error */}
      {!loading && !fetchError && error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!loading && !fetchError && (<>
      {/* ── Section 1: Consent Checklist ── */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Participant Consent Checklist
      </p>

      <div className="space-y-3 mb-6">
        {consentItems.map((item) => {
          const checked = answers[item.id] === 'yes';

          return (
            <label
              key={item.id}
              className={`flex items-start gap-3 border rounded-xl p-4 transition-colors cursor-pointer ${
                checked
                  ? 'border-blue-200 bg-blue-50/30'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleAnswer(item.id)}
                className="w-5 h-5 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-slate-700">{item.text}</span>
            </label>
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

      {/* ── Progress counter ── */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
        <span>
          {consentItems.filter((c) => answers[c.id] === 'yes').length} of {consentItems.length} items agreed
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
            canSubmit && !isSubmitting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? 'Submitting...' : 'Sign & Continue to Intake Form'}
        </button>
      </div>
      </>
      )}
    </>
  );
}

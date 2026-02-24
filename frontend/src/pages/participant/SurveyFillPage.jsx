import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FieldInput from '../../components/survey/FieldInput';
// import { api } from '../../services/api';   // uncomment when backend is ready

/*
  SurveyFillPage — participant fills out a deployed survey.

  Route:  /participant/surveys/:id
  Layout: renders inside NoSideDashboardLayout <Outlet />

  Data flow (future):
    GET  /api/v1/form_management/detail/:id   → form + fields + options
    GET  /api/v1/submissions/:formId/draft     → saved partial answers (if any)
    POST /api/v1/submissions/:formId/save      → save partial answers
    POST /api/v1/submissions/:formId/submit    → final submission
*/


/* ── Mock data — same forms as FormListPage, with full fields ── */
const MOCK_FORM_DETAIL = {
  '1': {
    form_id: '1', title: 'Perceived Stress Scale (PSS)',
    description: 'The questions in this scale ask about your feelings and thoughts during the last month. In each case, indicate how often you felt or thought a certain way.',
    category: 'Mental Health',
    fields: [
      { id: 'f1', label: 'In the last month, how often have you been upset because of something that happened unexpectedly?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f2', label: 'In the last month, how often have you felt that you were unable to control the important things in your life?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f3', label: 'In the last month, how often have you felt nervous and stressed?', field_type: 'likert', is_required: true, display_order: 2, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f4', label: 'In the last month, how often have you felt confident about your ability to handle your personal problems?', field_type: 'likert', is_required: true, display_order: 3, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f5', label: 'In the last month, how often have you felt that things were going your way?', field_type: 'likert', is_required: true, display_order: 4, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
    ],
  },
  '2': {
    form_id: '2', title: 'UCLA Loneliness Scale (Version 3)',
    description: 'Indicate how often each of the statements below is descriptive of you.',
    category: 'Social Wellness',
    fields: [
      { id: 'f6', label: 'How often do you feel that you are "in tune" with the people around you?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
      { id: 'f7', label: 'How often do you feel that you lack companionship?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
      { id: 'f8', label: 'How often do you feel that there is no one you can turn to?', field_type: 'likert', is_required: true, display_order: 2, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
      { id: 'f9', label: 'How often do you feel alone?', field_type: 'likert', is_required: true, display_order: 3, options: [], likertMin: 1, likertMax: 4, likertLabels: ['Never','Rarely','Sometimes','Often'] },
    ],
  },
  '4': {
    form_id: '4', title: 'Connections Intake Questionnaire',
    description: 'Please complete this intake form for the Connections program. All information is kept confidential.',
    category: 'Intake',
    fields: [
      { id: 'f10', label: 'Where do you live?', field_type: 'single_select', is_required: true, display_order: 0, options: [{id:'o1',label:'On campus',value:1},{id:'o2',label:'With Friends',value:2},{id:'o3',label:'With Family',value:3},{id:'o4',label:'Other',value:4}] },
      { id: 'f11', label: 'Do you have any dependents?', field_type: 'single_select', is_required: true, display_order: 1, options: [{id:'o5',label:'No',value:0},{id:'o6',label:'Yes',value:1}] },
      { id: 'f12', label: 'What access to transportation do you have?', field_type: 'multi_select', is_required: false, display_order: 2, options: [{id:'o7',label:'Bus',value:1},{id:'o8',label:'Walking',value:2},{id:'o9',label:'Car',value:3},{id:'o10',label:'Bike',value:4}] },
      { id: 'f13', label: 'Do you work?', field_type: 'dropdown', is_required: true, display_order: 3, options: [{id:'o12',label:"Don't work",value:0},{id:'o13',label:'Less than 10 hours per week',value:1},{id:'o14',label:'10–20 hours per week',value:2},{id:'o15',label:'Over 20 hours per week',value:3}] },
      { id: 'f14', label: 'What causes stress in your life? (Select all that apply)', field_type: 'multi_select', is_required: false, display_order: 4, options: [{id:'o16',label:'School',value:1},{id:'o17',label:'Work',value:2},{id:'o18',label:'Social life',value:3},{id:'o19',label:'Home life',value:4}] },
      { id: 'f15', label: 'In a typical week, how many days do you perform moderate to vigorous aerobic activity?', field_type: 'number', is_required: true, display_order: 5, options: [] },
      { id: 'f16', label: 'Date of Birth', field_type: 'date', is_required: true, display_order: 6, options: [] },
      { id: 'f17', label: 'Is there anything else youd like us to know?', field_type: 'text', is_required: false, display_order: 7, options: [] },
    ],
  },
};

/* localStorage key for draft answers (mock persistence) */
const draftKey = (formId) => `hdb_draft_${formId}`;


/* ── SVG helper ── */
const Svg = ({ d, size = 18, sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const SaveIco = () => (
  <Svg size={13} sw={2} d={<>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </>} />
);


/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   ══════════════════════════════════════════════ */
export default function SurveyFillPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [answers, setAnswers]     = useState({});
  const [errors, setErrors]       = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  /* ── Load form + any saved draft ── */
  useEffect(() => {
    /*
      TODO: Replace with real API calls:
        const formData = await api.getFormDetail(id);
        const draft    = await api.getDraftAnswers(id);
    */
    const timer = setTimeout(() => {
      const formData = MOCK_FORM_DETAIL[id];
      if (formData) {
        setForm(formData);
        // Load saved draft from localStorage (mock persistence)
        try {
          const draft = localStorage.getItem(draftKey(id));
          if (draft) setAnswers(JSON.parse(draft));
        } catch { /* ignore */ }
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [id]);

  /* ── Derived state ── */
  const fields = form?.fields || [];
  const answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== null;
  }).length;
  const progress = fields.length > 0 ? Math.round((answeredCount / fields.length) * 100) : 0;
  const hasAnyAnswers = answeredCount > 0;

  /* ── Handlers ── */
  const setAnswer = (fieldId, value) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const toggleMulti = (fieldId, optValue) => {
    setAnswers((prev) => {
      const arr = prev[fieldId] || [];
      return {
        ...prev,
        [fieldId]: arr.includes(optValue)
          ? arr.filter((v) => v !== optValue)
          : [...arr, optValue],
      };
    });
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  };

  const validate = () => {
    const errs = {};
    fields.forEach((f) => {
      if (!f.is_required) return;
      const v = answers[f.id];
      if (v === undefined || v === '' || v === null || (Array.isArray(v) && v.length === 0)) {
        errs[f.id] = 'This question is required';
      }
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = fields.find((f) => errs[f.id]);
      if (first) {
        document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    return Object.keys(errs).length === 0;
  };

  const handleSaveExit = () => {
    /* TODO: POST /api/v1/submissions/:formId/save  body: { answers } */
    localStorage.setItem(draftKey(id), JSON.stringify(answers));
    setSaved(true);
  };

  const handleSubmit = () => {
    if (!validate()) return;
    /* TODO: POST /api/v1/submissions/:formId/submit  body: { answers } */
    localStorage.removeItem(draftKey(id));
    setSubmitted(true);
  };

  const handleBackClick = () => {
    if (hasAnyAnswers) {
      setShowExitPrompt(true);
    } else {
      navigate('/participant/survey');
    }
  };

  const goBack = () => navigate('/participant/survey');

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-base">Loading survey...</p>
      </div>
    );
  }

  /* ── Form not found ── */
  if (!form) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-2xl mb-3">😕</p>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Survey not found</h2>
        <p className="text-sm text-slate-500 mb-6">This survey may have been removed or you don't have access.</p>
        <button onClick={goBack}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">
          Back to My Surveys
        </button>
      </div>
    );
  }

  /* ── Saved confirmation ── */
  if (saved) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Svg size={36} sw={2} stroke="#2563eb" d={<>
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </>} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Progress Saved!</h2>
        <p className="text-slate-500 mb-1">
          Your answers for <span className="font-semibold">{form.title}</span> have been saved.
        </p>
        <p className="text-sm text-slate-400 mb-8">You can come back anytime to finish and submit.</p>
        <button onClick={goBack}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">
          Back to My Surveys
        </button>
      </div>
    );
  }

  /* ── Submitted confirmation ── */
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Svg size={36} sw={2.5} d="M20 6L9 17l-5-5" stroke="#059669" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Survey Submitted!</h2>
        <p className="text-slate-500 mb-1">
          Thank you for completing <span className="font-semibold">{form.title}</span>.
        </p>
        <p className="text-sm text-slate-400 mb-8">Your responses have been saved securely.</p>
        <button onClick={goBack}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">
          Back to My Surveys
        </button>
      </div>
    );
  }

  /* ── Main fill-out view ── */
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back button */}
      <button onClick={handleBackClick}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition mb-4">
        <Svg size={16} d="M19 12H5M12 19l-7-7 7-7" /> My Surveys
      </button>

      {/* Form header */}
      <div className="bg-blue-600 rounded-2xl px-6 py-5 text-white shadow-sm relative overflow-hidden mb-5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        {form.category && (
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">{form.category}</span>
        )}
        <h1 className="text-lg font-bold mt-1">{form.title}</h1>
        {form.description && (
          <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">{form.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs text-blue-200">
          <span>{fields.length} question{fields.length !== 1 && 's'}</span>
          <span>~{Math.ceil(fields.length * 0.5)} min</span>
          <span className="text-red-200">* = required</span>
        </div>
      </div>

      {/* Sticky progress + Save & Exit */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm mb-5 sticky top-16 z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">{answeredCount} of {fields.length} answered</span>
            <span className="font-bold text-blue-600">{progress}%</span>
          </div>
          {hasAnyAnswers && (
            <button onClick={handleSaveExit}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500
                hover:text-blue-600 transition px-2.5 py-1 rounded-lg hover:bg-blue-50
                border border-transparent hover:border-blue-200">
              <SaveIco /> Save &amp; Exit
            </button>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {fields.map((field, i) => {
          const hasErr = !!errors[field.id];
          return (
            <div key={field.id} id={`q-${field.id}`}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all
                ${hasErr ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200'}`}>
              <p className="text-sm font-semibold text-slate-800 mb-4 leading-relaxed">
                <span className="text-slate-400 mr-2 font-mono text-xs">{i + 1}.</span>
                {field.label}
                {field.is_required && <span className="text-rose-400 ml-1">*</span>}
              </p>

              <FieldInput
                field={field}
                value={answers[field.id]}
                onChange={(v) => setAnswer(field.id, v)}
                onToggleMulti={(v) => toggleMulti(field.id, v)}
              />

              {hasErr && (
                <p className="text-xs text-rose-500 mt-2 font-medium flex items-center gap-1">
                  <Svg size={13} sw={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="#ef4444" />
                  {errors[field.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit footer */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            {answeredCount === fields.length
              ? <span className="text-emerald-600 font-semibold">All questions answered — ready to submit!</span>
              : <span>{fields.length - answeredCount} question{fields.length - answeredCount !== 1 && 's'} remaining</span>}
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {hasAnyAnswers && (
              <button onClick={handleSaveExit}
                className="flex-1 sm:flex-none px-5 py-3 text-sm font-semibold text-slate-600
                  bg-white border border-slate-200 rounded-xl hover:bg-slate-50
                  hover:border-slate-300 transition shadow-sm">
                Save &amp; Exit
              </button>
            )}
            <button onClick={handleSubmit}
              className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700
                text-white text-sm font-bold rounded-xl transition shadow-sm">
              Submit Survey
            </button>
          </div>
        </div>
      </div>

      {/* Exit prompt modal */}
      {showExitPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowExitPrompt(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Svg size={24} sw={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="#d97706" />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center mb-1">You have unsaved answers</h3>
              <p className="text-sm text-slate-500 text-center">Would you like to save your progress before leaving?</p>
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <button onClick={handleSaveExit}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">
                Save &amp; Exit
              </button>
              <button onClick={goBack}
                className="w-full py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition">
                Discard &amp; Leave
              </button>
              <button onClick={() => setShowExitPrompt(false)}
                className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition">
                Continue Filling
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

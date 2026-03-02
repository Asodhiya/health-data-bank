import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FieldInput from '../../components/survey/FieldInput';
// import { api } from '../../services/api';   // uncomment when backend is ready

/*
  SurveyFillPage — participant fills out a deployed survey.

  Route:  /participant/surveys/:id
  Layout: renders inside NoSideDashboardLayout <Outlet />

  Features:
    - Auto-save with debounce (3s after last change, localStorage now, API later)
    - "Last saved" indicator in sticky progress bar
    - Submit confirmation modal with answer summary
    - Read-only view for completed forms (loads submitted answers)
    - "Next unanswered" jump button
    - Keyboard shortcuts for likert (1-5 keys)
    - beforeunload save protection
    - Answer feedback flash animation
    - Description expand/collapse
    - Return-to-position on resume

  Data flow (future):
    GET  /api/v1/form_management/detail/:id   → form + fields + options
    GET  /api/v1/submissions/:formId/draft     → saved partial answers (if any)
    GET  /api/v1/submissions/:formId/result    → submitted answers (completed)
    POST /api/v1/submissions/:formId/save      → save partial answers
    POST /api/v1/submissions/:formId/submit    → final submission
*/


/* ── Mock data ── */
const MOCK_FORM_DETAIL = {
  '1': {
    form_id: '1', title: 'Perceived Stress Scale (PSS)',
    description: 'The questions in this scale ask about your feelings and thoughts during the last month. In each case, indicate how often you felt or thought a certain way.',
    category: 'Mental Health',
    fields: [
      { id: 'f1', label: 'In the last month, how often have you been upset because of something that happened unexpectedly?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f2', label: 'In the last month, how often have you felt that you were unable to control the important things in your life?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f3', label: 'In the last month, how often have you felt nervous and stressed?', field_type: 'likert', is_required: true, display_order: 2, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
      { id: 'f4', label: 'In the last month, how often have you felt confident about your ability to handle your personal problems?', field_type: 'likert', is_required: false, display_order: 3, options: [], likertMin: 0, likertMax: 4, likertLabels: ['Never','Almost Never','Sometimes','Fairly Often','Very Often'] },
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
  '3': {
    form_id: '3', title: 'Knowledge Confidence Scale',
    description: 'How confident are you in the following areas?',
    category: 'Self-Assessment',
    submittedAnswers: { c1: 3, c2: 4, c3: 2 },
    fields: [
      { id: 'c1', label: 'How confident are you about managing your physical health?', field_type: 'likert', is_required: true, display_order: 0, options: [], likertMin: 1, likertMax: 5, likertLabels: ['Not at all','Slightly','Moderately','Very','Extremely'] },
      { id: 'c2', label: 'How confident are you about managing stress?', field_type: 'likert', is_required: true, display_order: 1, options: [], likertMin: 1, likertMax: 5, likertLabels: ['Not at all','Slightly','Moderately','Very','Extremely'] },
      { id: 'c3', label: 'How confident are you about maintaining social connections?', field_type: 'likert', is_required: true, display_order: 2, options: [], likertMin: 1, likertMax: 5, likertLabels: ['Not at all','Slightly','Moderately','Very','Extremely'] },
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


/* ── SVG helper ── */
const Svg = ({ d, size = 18, sw = 1.8, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
    strokeLinejoin="round" {...rest}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const SaveIco = () => <Svg size={13} sw={2} d={<><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>} />;
const LockIco = () => <Svg size={14} d={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>} />;
const WarnIco = () => <Svg size={20} sw={2} d={<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>} />;
const DownArrowIco = () => <Svg size={13} sw={2} d={<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>} />;

const draftKey = (formId) => `hdb_draft_${formId}`;

const timeAgo = (date) => {
  if (!date) return '';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/* ── Check if a field has a valid answer ── */
const isAnswered = (v) => Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== null;


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
  const [showExitPrompt, setShowExitPrompt]     = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [lastSavedAt, setLastSavedAt]   = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [descExpanded, setDescExpanded] = useState(false);              // #14
  const [flashId, setFlashId]           = useState(null);               // #13
  const [focusedFieldIdx, setFocusedFieldIdx] = useState(-1);          // #7

  const isReadOnly = useRef(false);
  const autoSaveTimer = useRef(null);
  const answersRef = useRef(answers);                                   // #11 — always-fresh ref for beforeunload
  answersRef.current = answers;

  /* ── Load form + draft ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      const formData = MOCK_FORM_DETAIL[id];
      if (formData) {
        setForm(formData);
        if (formData.submittedAnswers) {
          isReadOnly.current = true;
          setAnswers(formData.submittedAnswers);
        } else {
          try {
            const draft = localStorage.getItem(draftKey(id));
            if (draft) {
              const parsed = JSON.parse(draft);
              setAnswers(parsed.answers || {});
              if (parsed.savedAt) setLastSavedAt(new Date(parsed.savedAt));

              // If previously submitted via this client, enter read-only mode
              if (parsed.submitted) {
                isReadOnly.current = true;
              } else if (parsed.lastFieldId) {
                // #15 — Return-to-position: scroll to last answered field
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    document.getElementById(`q-${parsed.lastFieldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 400);
                });
              }
            }
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
    }, 300);
    return () => {
      clearTimeout(timer);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [id]);

  /* ── #11 — beforeunload: save on tab close ── */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isReadOnly.current) return;
      const ans = answersRef.current;
      if (Object.keys(ans).length > 0) {
        localStorage.setItem(draftKey(id), JSON.stringify({ answers: ans, savedAt: new Date().toISOString(), lastFieldId: lastAnsweredFieldId(ans) }));
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id]);

  /* ── Derived state ── */
  const fields = form?.fields || [];
  const answeredCount = Object.keys(answers).filter((k) => isAnswered(answers[k])).length;
  const progress = fields.length > 0 ? Math.round((answeredCount / fields.length) * 100) : 0;
  const hasAnyAnswers = answeredCount > 0;
  const requiredCount = fields.filter((f) => f.is_required).length;
  const requiredAnswered = fields.filter((f) => f.is_required && isAnswered(answers[f.id])).length;

  /* Find last field that has an answer (for resume position) */
  const lastAnsweredFieldId = (ans) => {
    for (let i = fields.length - 1; i >= 0; i--) {
      if (isAnswered(ans[fields[i].id])) return fields[i].id;
    }
    return null;
  };

  /* #5 — Find first unanswered required field */
  const firstUnansweredIdx = fields.findIndex((f) => f.is_required && !isAnswered(answers[f.id]));
  const firstUnansweredId = firstUnansweredIdx >= 0 ? fields[firstUnansweredIdx].id : null;

  const jumpToNextUnanswered = () => {
    if (firstUnansweredId) {
      document.getElementById(`q-${firstUnansweredId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedFieldIdx(firstUnansweredIdx);
    }
  };

  /* ── Auto-save (debounced 3s) ── */
  const doAutoSave = useCallback(() => {
    if (isReadOnly.current || Object.keys(answers).length === 0) return;
    setAutoSaveStatus('saving');
    const now = new Date();
    localStorage.setItem(draftKey(id), JSON.stringify({ answers, savedAt: now.toISOString(), lastFieldId: lastAnsweredFieldId(answers) }));
    setTimeout(() => {
      setLastSavedAt(now);
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 400);
  }, [answers, id, fields]);

  /* Re-render for timeAgo */
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 15000); return () => clearInterval(i); }, []);

  /* ── Handlers ── */
  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doAutoSave(), 3000);
  };

  const setAnswer = (fieldId, value) => {
    if (isReadOnly.current) return;
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
    // #13 — flash animation
    setFlashId(fieldId);
    setTimeout(() => setFlashId(null), 600);
    triggerAutoSave();
  };

  const toggleMulti = (fieldId, optValue) => {
    if (isReadOnly.current) return;
    setAnswers((prev) => {
      const arr = prev[fieldId] || [];
      return { ...prev, [fieldId]: arr.includes(optValue) ? arr.filter((v) => v !== optValue) : [...arr, optValue] };
    });
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
    setFlashId(fieldId);
    setTimeout(() => setFlashId(null), 600);
    triggerAutoSave();
  };

  /* #7 — Keyboard navigation for likert */
  useEffect(() => {
    if (isReadOnly.current) return;
    const handler = (e) => {
      if (focusedFieldIdx < 0 || focusedFieldIdx >= fields.length) return;
      // Don't capture if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const field = fields[focusedFieldIdx];
      if (field.field_type !== 'likert') return;

      const min = field.likertMin ?? 0;
      const max = field.likertMax ?? 4;
      const num = parseInt(e.key);
      if (isNaN(num)) return;

      const val = min + num - 1; // key "1" = first option = min
      if (val >= min && val <= max) {
        e.preventDefault();
        setAnswer(field.id, val);
        // Auto-advance to next question after a short delay
        setTimeout(() => {
          if (focusedFieldIdx < fields.length - 1) {
            const nextIdx = focusedFieldIdx + 1;
            setFocusedFieldIdx(nextIdx);
            document.getElementById(`q-${fields[nextIdx].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedFieldIdx, fields]);

  const validate = () => {
    const errs = {};
    fields.forEach((f) => {
      if (!f.is_required) return;
      const v = answers[f.id];
      if (!isAnswered(v)) errs[f.id] = 'This question is required';
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = fields.find((f) => errs[f.id]);
      if (first) document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return Object.keys(errs).length === 0;
  };

  const handleManualSave = () => {
    const now = new Date();
    localStorage.setItem(draftKey(id), JSON.stringify({ answers, savedAt: now.toISOString(), lastFieldId: lastAnsweredFieldId(answers) }));
    setLastSavedAt(now);
    setAutoSaveStatus('saved');
    setTimeout(() => setAutoSaveStatus('idle'), 2000);
  };

  const handleSaveExit = () => { handleManualSave(); navigate('/participant/survey'); };
  const handleSubmitClick = () => { if (!validate()) return; setShowSubmitConfirm(true); };
  const handleConfirmSubmit = () => {
    // Persist submission so it survives page reload
    localStorage.setItem(draftKey(id), JSON.stringify({
      answers,
      savedAt: new Date().toISOString(),
      submitted: true,
    }));
    setSubmitted(true);
    setShowSubmitConfirm(false);
  };
  const handleBackClick = () => {
    if (isReadOnly.current) { navigate('/participant/survey'); return; }
    if (hasAnyAnswers) setShowExitPrompt(true);
    else navigate('/participant/survey');
  };
  const goBack = () => navigate('/participant/survey');

  /* ── Loading ── */
  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-slate-400 text-base">Loading survey...</p></div>;

  if (!form) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <p className="text-2xl mb-3">😕</p>
      <h2 className="text-lg font-bold text-slate-800 mb-2">Survey not found</h2>
      <p className="text-sm text-slate-500 mb-6">This survey may have been removed or you don't have access.</p>
      <button onClick={goBack} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">Back to My Surveys</button>
    </div>
  );

  if (submitted) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
        <Svg size={36} sw={2.5} d="M20 6L9 17l-5-5" stroke="#059669" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Survey Submitted!</h2>
      <p className="text-slate-500 mb-1">Thank you for completing <span className="font-semibold">{form.title}</span>.</p>
      <p className="text-sm text-slate-400 mb-8">Your responses have been saved securely.</p>
      <button onClick={goBack} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">Back to My Surveys</button>
    </div>
  );

  const readOnly = isReadOnly.current;
  /* #14 — Determine if description needs truncation */
  const descText = form.description || '';
  const descLong = descText.length > 120;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={handleBackClick} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium transition mb-4">
        <Svg size={16} d="M19 12H5M12 19l-7-7 7-7" /> My Surveys
      </button>

      {/* Header */}
      <div className={`rounded-2xl px-6 py-5 text-white shadow-sm relative overflow-hidden mb-5 ${readOnly ? 'bg-emerald-600' : 'bg-blue-600'}`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        {readOnly && (
          <div className="flex items-center gap-1.5 text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1"><LockIco /> Read-only — previously submitted</div>
        )}
        {!readOnly && form.category && <span className="text-xs font-bold uppercase tracking-wider text-blue-200">{form.category}</span>}
        <h1 className="text-lg font-bold mt-1">{form.title}</h1>

        {/* #14 — Description expand/collapse */}
        {descText && (
          <div className={`text-sm mt-1.5 leading-relaxed ${readOnly ? 'text-emerald-100' : 'text-blue-100'}`}>
            {descLong && !descExpanded ? (
              <>
                <span>{descText.slice(0, 120)}… </span>
                <button onClick={() => setDescExpanded(true)} className="underline opacity-80 hover:opacity-100 transition text-xs font-semibold">Read more</button>
              </>
            ) : (
              <>
                <span>{descText}</span>
                {descLong && <button onClick={() => setDescExpanded(false)} className="ml-1 underline opacity-80 hover:opacity-100 transition text-xs font-semibold">Show less</button>}
              </>
            )}
          </div>
        )}

        <div className={`flex items-center gap-4 mt-4 text-xs ${readOnly ? 'text-emerald-200' : 'text-blue-200'}`}>
          <span>{fields.length} question{fields.length !== 1 && 's'}</span>
          {!readOnly && <span>~{Math.ceil(fields.length * 0.5)} min</span>}
          {!readOnly && <span className="text-red-200">* = required</span>}
          {readOnly && <span>Submitted responses</span>}
        </div>
      </div>

      {/* Sticky progress bar */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm mb-5 sticky top-16 z-10">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-slate-500 font-medium">{answeredCount} of {fields.length} answered</span>
              <span className="font-bold text-blue-600">{progress}%</span>
              {lastSavedAt && (
                <span className="text-slate-400 flex items-center gap-1 ml-2">
                  {autoSaveStatus === 'saving' ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Saving...</>
                  ) : autoSaveStatus === 'saved' ? (
                    <><Svg size={11} sw={2.5} stroke="#16a34a" d={<polyline points="20 6 9 17 4 12" />} /> Saved</>
                  ) : (
                    <>Saved {timeAgo(lastSavedAt)}</>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* #5 — Jump to next unanswered */}
              {firstUnansweredId && (
                <button onClick={jumpToNextUnanswered}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition px-2 py-1 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200">
                  <DownArrowIco /> Next unanswered
                </button>
              )}
              {hasAnyAnswers && (
                <button onClick={handleSaveExit}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200">
                  <SaveIco /> Save &amp; Exit
                </button>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* #7 — Keyboard hint for likert-heavy forms */}
      {!readOnly && fields.length > 3 && fields.filter((f) => f.field_type === 'likert').length >= fields.length * 0.6 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 mb-4 flex items-center gap-2">
          <Svg size={14} sw={2} stroke="#3b82f6" d={<><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>} />
          <span>Tip: Click a question card, then press number keys to answer Likert questions. Auto-advances to next question.</span>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4 mb-6">
        {fields.map((field, i) => {
          const hasErr = !!errors[field.id];
          const isFlashing = flashId === field.id;
          const isFocused = focusedFieldIdx === i;
          return (
            <div key={field.id} id={`q-${field.id}`}
              /* #7 — click to focus for keyboard nav */
              onClick={() => !readOnly && setFocusedFieldIdx(i)}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all cursor-pointer
                ${readOnly ? 'border-slate-200 opacity-90 cursor-default' :
                  isFlashing ? 'border-emerald-400 ring-2 ring-emerald-100' :
                  hasErr ? 'border-rose-300 ring-1 ring-rose-100' :
                  isFocused ? 'border-blue-300 ring-1 ring-blue-100' :
                  'border-slate-200'}`}>
              <p className="text-sm font-semibold text-slate-800 mb-4 leading-relaxed">
                <span className="text-slate-400 mr-2 font-mono text-xs">{i + 1}.</span>
                {field.label}
                {field.is_required && !readOnly && <span className="text-rose-400 ml-1">*</span>}
              </p>
              <FieldInput field={field} value={answers[field.id]} onChange={(v) => setAnswer(field.id, v)} onToggleMulti={(v) => toggleMulti(field.id, v)} disabled={readOnly} />
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
      {!readOnly && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {answeredCount === fields.length
                ? <span className="text-emerald-600 font-semibold">All questions answered — ready to submit!</span>
                : <span>{fields.length - answeredCount} question{fields.length - answeredCount !== 1 && 's'} remaining</span>}
            </p>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {hasAnyAnswers && (
                <button onClick={handleSaveExit} className="flex-1 sm:flex-none px-5 py-3 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm">Save &amp; Exit</button>
              )}
              <button onClick={handleSubmitClick} className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition shadow-sm">Submit Survey</button>
            </div>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-10 text-center">
          <p className="text-sm text-emerald-700 font-medium mb-3">These are your submitted responses. They cannot be edited.</p>
          <button onClick={goBack} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">Back to My Surveys</button>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSubmitConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Svg size={28} sw={2} stroke="#2563eb" d={<><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center mb-2">Submit Survey?</h3>
              <p className="text-sm text-slate-500 text-center mb-4">
                You're about to submit <strong>{answeredCount}</strong> answer{answeredCount > 1 ? 's' : ''} for <strong>{form.title}</strong>. This action cannot be undone.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-xs text-slate-600 mb-1"><span>Questions answered</span><span className="font-bold">{answeredCount}/{fields.length}</span></div>
                <div className="flex justify-between text-xs text-slate-600 mb-1"><span>Required completed</span><span className="font-bold text-emerald-600">{requiredAnswered}/{requiredCount}</span></div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
              </div>
              {answeredCount < fields.length && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5"><WarnIco /></span>
                    <span>You have {fields.length - answeredCount} unanswered optional question{fields.length - answeredCount > 1 ? 's' : ''}. You can still submit.</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <button onClick={handleConfirmSubmit} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">Yes, Submit My Answers</button>
              <button onClick={() => setShowSubmitConfirm(false)} className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition">Go Back and Review</button>
            </div>
          </div>
        </div>
      )}

      {/* Exit prompt modal */}
      {showExitPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowExitPrompt(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Svg size={24} sw={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="#d97706" />
              </div>
              <h3 className="text-base font-bold text-slate-800 text-center mb-1">You have unsaved answers</h3>
              <p className="text-sm text-slate-500 text-center">Would you like to save your progress before leaving?</p>
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <button onClick={handleSaveExit} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition">Save &amp; Exit</button>
              <button onClick={goBack} className="w-full py-2.5 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition">Discard &amp; Leave</button>
              <button onClick={() => setShowExitPrompt(false)} className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition">Continue Filling</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

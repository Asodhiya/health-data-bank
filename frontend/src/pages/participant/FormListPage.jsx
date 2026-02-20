import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import { api } from '../../services/api';   // uncomment when backend is ready

/*
  FormListPage — participant's survey list.

  Renders inside NoSideDashboardLayout's <Outlet />,
  so it inherits the nav bar automatically.

  Shows all forms deployed to this participant's group,
  split into "To Complete" and "Completed" sections.

  Data source (current):  mock data below
  Data source (future):   GET /api/v1/surveys/deployed
    → reads FormDeployment → SurveyForm → FormField (count)
    → reads FormSubmission for this participant (status)
*/


/* ── Mock data — replace with API call when backend is ready ──
   Each object mirrors what GET /api/v1/surveys/deployed would return,
   based on DB tables: SurveyForm, FormField (count), FormSubmission.
*/
const MOCK_DEPLOYED_FORMS = [
  {
    form_id: '1',
    title: 'Perceived Stress Scale (PSS)',
    description: '10 questions about your stress levels over the last month.',
    question_count: 10,
    status: 'pending',       // 'pending' | 'in_progress' | 'completed'
    category: 'Mental Health',
    answered: 0,
  },
  {
    form_id: '2',
    title: 'UCLA Loneliness Scale (Version 3)',
    description: '20 items measuring feelings of loneliness and social connection.',
    question_count: 20,
    status: 'in_progress',
    category: 'Social Wellness',
    answered: 8,
  },
  {
    form_id: '3',
    title: 'Knowledge Confidence Scale',
    description: '18 questions about your confidence across health and wellness topics.',
    question_count: 18,
    status: 'completed',
    category: 'Self-Assessment',
    answered: 18,
  },
];


/* ── SVG Icon helper — same pattern as ProfilePage ── */
const Ico = ({ d, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const ClockIcon = () => (
  <Ico size={13} sw={2} d={<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>} />
);
const ArrowIcon = () => (
  <Ico size={15} sw={2} d={<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>} />
);
const CheckSmallIcon = () => (
  <Ico size={14} sw={2.5} stroke="#16a34a" d={<polyline points="20 6 9 17 4 12" />} />
);


/* ══════════════════════════════════════════════
   FORM ROW — single survey card in the list
   ══════════════════════════════════════════════ */
function FormRow({ form, onStart }) {
  const isCompleted = form.status === 'completed';
  const isActive    = form.status === 'in_progress';
  const estMin      = Math.ceil(form.question_count * 0.5);

  const buttonLabel = {
    pending:     'Start Survey',
    in_progress: 'Continue',
    completed:   'View Results',
  }[form.status];

  const progressPct = isActive && form.answered
    ? Math.round((form.answered / form.question_count) * 100)
    : 0;

  /* Card border color based on status */
  const cardBorder = isActive
    ? 'border-blue-200 bg-blue-50/20'
    : isCompleted
      ? 'border-emerald-200 bg-emerald-50/20'
      : 'border-slate-100';

  /* Category pill color */
  const categoryColor = isActive
    ? 'bg-blue-50 text-blue-600 border-blue-200'
    : 'bg-slate-50 text-slate-500 border-slate-200';

  /* Button style based on status */
  const btnStyle = isActive
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : isCompleted
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div
      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md cursor-pointer ${cardBorder}`}
      onClick={() => onStart(form.form_id)}
    >
      {/* Top: category + meta */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${categoryColor}`}>
          {form.category}
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><ClockIcon /> {estMin} min</span>
          <span>{form.question_count} Qs</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-slate-800 mb-1">{form.title}</h3>

      {/* Description */}
      <p className="text-sm text-slate-500 mb-4">{form.description}</p>

      {/* Bottom: progress/status + button */}
      <div className="flex items-end justify-between gap-4">
        {isActive && form.answered ? (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">
                {form.answered}/{form.question_count} answered
              </span>
              <span className="text-xs font-bold text-blue-600">{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : isCompleted ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckSmallIcon /> Submitted
          </span>
        ) : (
          <div />
        )}

        <button
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${btnStyle}`}
          onClick={(e) => { e.stopPropagation(); onStart(form.form_id); }}
        >
          {buttonLabel}
          {!isCompleted && <ArrowIcon />}
        </button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   Pure content — renders inside NoSideDashboardLayout's <Outlet />.
   ══════════════════════════════════════════════ */
export default function FormListPage() {
  const navigate = useNavigate();
  const [forms, setForms]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /*
      TODO: Replace with real API call when backend endpoints exist:

      api.getDeployedForms()
        .then(setForms)
        .catch(console.error)
        .finally(() => setLoading(false));
    */
    const timer = setTimeout(() => {
      setForms(MOCK_DEPLOYED_FORMS);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = (formId) => {
    // Navigates to the Generic Form Renderer (to be built next)
    navigate(`/participant/surveys/${formId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-base">Loading your surveys...</p>
      </div>
    );
  }

  const inProgress = forms.filter((f) => f.status === 'in_progress');
  const pending    = forms.filter((f) => f.status === 'pending');
  const completed  = forms.filter((f) => f.status === 'completed');
  const active     = [...inProgress, ...pending]; // in-progress shown first

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Breadcrumb + Title */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <span className="text-slate-400">Dashboard</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">Surveys</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800">My Surveys</h1>
      </div>

      <div>
        {/* To Complete section */}
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              To Complete
            </h2>
            <div className="space-y-3 mb-6">
              {active.map((form) => (
                <FormRow key={form.form_id} form={form} onStart={handleStart} />
              ))}
            </div>
          </section>
        )}

        {/* Completed section */}
        {completed.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Completed
            </h2>
            <div className="space-y-3">
              {completed.map((form) => (
                <FormRow key={form.form_id} form={form} onStart={handleStart} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {forms.length === 0 && (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            No surveys have been assigned to you yet.
          </div>
        )}
      </div>
    </div>
  );
}

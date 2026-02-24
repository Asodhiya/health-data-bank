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
    deployed_at: '2026-02-18',
  },
  {
    form_id: '2',
    title: 'UCLA Loneliness Scale (Version 3)',
    description: '20 items measuring feelings of loneliness and social connection.',
    question_count: 20,
    status: 'in_progress',
    category: 'Social Wellness',
    answered: 8,
    deployed_at: '2026-02-15',
  },
  {
    form_id: '3',
    title: 'Knowledge Confidence Scale',
    description: '18 questions about your confidence across health and wellness topics.',
    question_count: 18,
    status: 'completed',
    category: 'Self-Assessment',
    answered: 18,
    deployed_at: '2026-02-10',
  },
  {
    form_id: '4',
    title: 'Connections Intake Questionnaire',
    description: 'Intake form for the Connections program.',
    question_count: 10,
    status: 'pending',
    category: 'Intake',
    answered: 0,
    deployed_at: '2026-02-08',
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
const SearchIco = () => (
  <Ico size={16} d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />
);
const CalIco = () => (
  <Ico size={15} d={<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />
);
const XIco = () => (
  <Ico size={14} sw={2} d={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />
);

function StatusBadge({ status }) {
  const cls = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  const label = { completed: 'Filled', in_progress: 'In Progress', pending: 'Unfilled' }[status] || status;
  return <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}


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

  /* Filters */
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState('ALL');    // 'ALL' | 'UNFILLED' | 'FILLED'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

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
    navigate(`/participant/surveys/${formId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400 text-base">Loading your surveys...</p>
      </div>
    );
  }

  /* ── Filtering logic ── */
  const hasDateFilter = dateFrom || dateTo;
  const getGroup = (status) => (status === 'completed' ? 'FILLED' : 'UNFILLED');

  const filtered = forms.filter((f) => {
    const matchSearch = f.title.toLowerCase().includes(search.toLowerCase());
    const matchTab    = tab === 'ALL' || getGroup(f.status) === tab;
    const matchFrom   = !dateFrom || (f.deployed_at && f.deployed_at >= dateFrom);
    const matchTo     = !dateTo   || (f.deployed_at && f.deployed_at <= dateTo);
    return matchSearch && matchTab && matchFrom && matchTo;
  });

  const counts = {
    ALL:      forms.length,
    UNFILLED: forms.filter((f) => f.status !== 'completed').length,
    FILLED:   forms.filter((f) => f.status === 'completed').length,
  };

  const clearDates = () => { setDateFrom(''); setDateTo(''); setShowDateFilter(false); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Breadcrumb + Title */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <span className="text-slate-400">Dashboard</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">Surveys</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">My Surveys</h1>
          <p className="text-sm text-slate-500">{forms.length} surveys assigned</p>
        </div>
      </div>

      {/* ── Search + Tabs + Date filter ── */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIco /></span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search surveys…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>

          {/* All / Unfilled / Filled tabs */}
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {[
              { key: 'ALL',      label: 'All' },
              { key: 'UNFILLED', label: 'Unfilled' },
              { key: 'FILLED',   label: 'Filled' },
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5
                  ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold leading-none
                  ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-400'}`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Date filter toggle */}
          <button onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border
              transition-all shrink-0
              ${hasDateFilter
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}>
            <CalIco />
            {hasDateFilter ? 'Dates active' : 'Filter by date'}
            {hasDateFilter && (
              <span onClick={(e) => { e.stopPropagation(); clearDates(); }}
                className="ml-1 hover:text-rose-500 transition"><XIco /></span>
            )}
          </button>
        </div>

        {/* Date range row */}
        {showDateFilter && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs font-semibold text-slate-500">Assigned between</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
            <span className="text-xs text-slate-400">and</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
            {hasDateFilter && (
              <button onClick={clearDates}
                className="text-xs text-slate-400 hover:text-rose-500 font-medium transition">Clear</button>
            )}
          </div>
        )}
      </div>

      {/* Results count when filtering */}
      {(search || tab !== 'ALL' || hasDateFilter) && (
        <p className="text-xs text-slate-400 mb-3">{filtered.length} result{filtered.length !== 1 && 's'} found</p>
      )}

      {/* ── Survey cards ── */}
      <div className="space-y-3">
        {filtered.map((form) => (
          <FormRow key={form.form_id} form={form} onStart={handleStart} />
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">No surveys found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

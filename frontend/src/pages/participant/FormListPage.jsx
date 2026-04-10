import { useState, useCallback } from "react";
import { usePolling } from "../../hooks/usePolling";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

/*
  FormListPage — participant's survey list.

  Renders inside NoSideDashboardLayout's <Outlet />,
  so it inherits the nav bar automatically.

  Shows all forms deployed to this participant's group,
  with search, sort, date filters, and urgency-based ordering.

  Data source:  GET /api/v1/participant/surveys/assigned
  Fallback:     mock data + localStorage hydration (when backend unavailable)
*/

/* ── Transform backend response → frontend shape ── */
const STATUS_MAP = {
  NEW: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};
const fmtDateStr = (d) =>
  d ? new Date(d).toISOString().split("T")[0] : undefined;

const transformAssigned = (item) => ({
  form_id: String(item.form_id),
  title: item.title,
  description: item.description || "",
  question_count: item.question_count || 0,
  version: item.version || 1,
  status: STATUS_MAP[item.status] || item.status || "pending",
  category: item.category || "",
  answered: item.answered_count ?? item.answered ?? 0,
  deployed_at: fmtDateStr(item.deployed_at),
  due_date: fmtDateStr(item.due_date),
  submitted_at: fmtDateStr(item.submitted_at),
});

// /* ── Mock data — replace with API call when backend is ready ── */
// const MOCK_DEPLOYED_FORMS = [
//   {
//     form_id: '1',
//     title: 'Perceived Stress Scale (PSS)',
//     description: '10 questions about your stress levels over the last month.',
//     question_count: 10,
//     status: 'pending',
//     category: 'Mental Health',
//     answered: 0,
//     deployed_at: '2026-02-18',
//     due_date: '2026-03-15',
//   },
//   {
//     form_id: '2',
//     title: 'UCLA Loneliness Scale (Version 3)',
//     description: '20 items measuring feelings of loneliness and social connection.',
//     question_count: 20,
//     status: 'in_progress',
//     category: 'Social Wellness',
//     answered: 8,
//     deployed_at: '2026-02-15',
//     due_date: '2026-03-01',
//   },
//   {
//     form_id: '3',
//     title: 'Knowledge Confidence Scale',
//     description: '18 questions about your confidence across health and wellness topics.',
//     question_count: 18,
//     status: 'completed',
//     category: 'Self-Assessment',
//     answered: 18,
//     deployed_at: '2026-02-10',
//     submitted_at: '2026-02-12',
//   },
//   {
//     form_id: '4',
//     title: 'Connections Intake Questionnaire',
//     description: 'Intake form for the Connections program.',
//     question_count: 10,
//     status: 'pending',
//     category: 'Intake',
//     answered: 0,
//     deployed_at: '2026-02-08',
//   },
// ];

/* ── SVG Icon helper ── */
const Ico = ({
  d,
  size = 20,
  stroke = "currentColor",
  fill = "none",
  sw = 1.8,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

const ClockIcon = () => (
  <Ico
    size={13}
    sw={2}
    d={
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    }
  />
);
const ArrowIcon = () => (
  <Ico
    size={15}
    sw={2}
    d={
      <>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </>
    }
  />
);
const CheckSmallIco = () => (
  <Ico
    size={14}
    sw={2.5}
    stroke="#16a34a"
    d={<polyline points="20 6 9 17 4 12" />}
  />
);
const SearchIco = () => (
  <Ico
    size={16}
    d={
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    }
  />
);
const CalIco = () => (
  <Ico
    size={15}
    d={
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    }
  />
);
const XIco = () => (
  <Ico
    size={14}
    sw={2}
    d={
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    }
  />
);
const SortIco = () => (
  <Ico
    size={14}
    d={
      <>
        <line x1="4" y1="6" x2="13" y2="6" />
        <line x1="4" y1="12" x2="10" y2="12" />
        <line x1="4" y1="18" x2="7" y2="18" />
        <polyline points="17 10 20 6 23 10" />
        <line x1="20" y1="6" x2="20" y2="18" />
      </>
    }
  />
);
const EyeIco = () => (
  <Ico
    size={15}
    d={
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    }
  />
);
const SurveyEmptyIco = () => (
  <Ico
    size={36}
    sw={1.5}
    stroke="#3b82f6"
    d={
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="9" y1="9" x2="21" y2="9" />
      </>
    }
  />
);
const AlertIco = () => (
  <Ico
    size={12}
    sw={2}
    d={
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    }
  />
);

/* ── Due date helpers ── */
const fmtDate = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "";
const daysUntil = (s) =>
  s ? Math.ceil((new Date(s).getTime() - Date.now()) / 86400000) : Infinity;

/* ══════════════════════════════════════════════
   FORM ROW — single survey card
   ══════════════════════════════════════════════ */
function FormRow({ form, onStart }) {
  const isDone = form.status === "completed";
  const isActive = form.status === "in_progress";
  const estMin = Math.ceil(form.question_count * 0.5);
  const pct =
    isActive && form.answered
      ? Math.round((form.answered / form.question_count) * 100)
      : 0;

  const border = isActive
    ? "border-blue-200 bg-blue-50/20"
    : isDone
      ? "border-emerald-200 bg-emerald-50/20"
      : "border-slate-100";
  const catColor = isActive
    ? "bg-blue-50 text-blue-600 border-blue-200"
    : "bg-slate-50 text-slate-500 border-slate-200";
  const btnStyle = isActive
    ? "bg-blue-600 hover:bg-blue-700 text-white"
    : isDone
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
      : "bg-blue-600 hover:bg-blue-700 text-white";
  const btnLabel = {
    pending: "Start Survey",
    in_progress: "Continue",
    completed: "View Results",
  }[form.status];
  const btnIcon = isDone ? <EyeIco /> : <ArrowIcon />;

  /* #3 — Due date */
  const dueDays = daysUntil(form.due_date);
  const isOverdue = !isDone && form.due_date && dueDays < 0;
  const isDueSoon = !isDone && form.due_date && dueDays >= 0 && dueDays <= 3;

  return (
    <div
      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md cursor-pointer ${border}`}
      onClick={() => onStart(form.form_id)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* #10 — category pill only if value exists */}
          {form.category && (
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${catColor}`}
            >
              {form.category}
            </span>
          )}
          {/* #3 — due date pill */}
          {form.due_date && !isDone && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isOverdue
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : isDueSoon
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              {isOverdue && <AlertIco />}
              {isOverdue ? "Overdue" : `Due ${fmtDate(form.due_date)}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <ClockIcon /> {estMin} min
          </span>
          <span>{form.question_count} Qs</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-slate-800">{form.title}</h3>
        {form.version > 1 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">
            v{form.version}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4 line-clamp-2">
        {form.description}
      </p>

      <div className="flex items-end justify-between gap-4">
        {isActive && form.answered ? (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">
                {form.answered}/{form.question_count} answered
              </span>
              <span className="text-xs font-bold text-blue-600">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : isDone ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckSmallIco /> Submitted
            {/* #12 — submission timestamp */}
            {form.submitted_at && (
              <span className="font-normal text-slate-400 ml-1">
                {fmtDate(form.submitted_at)}
              </span>
            )}
          </span>
        ) : (
          <div />
        )}

        <button
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${btnStyle}`}
          onClick={(e) => {
            e.stopPropagation();
            onStart(form.form_id);
          }}
        >
          {btnLabel} {btnIcon}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE EXPORT
   ══════════════════════════════════════════════ */
export default function FormListPage() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("ALL");
  const [sort, setSort] = useState("urgency");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const loadForms = useCallback(async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const data = await api.getAssignedSurveys();
      const validData = Array.isArray(data) ? data : [];
      setForms(validData.map(transformAssigned));
    } catch (err) {
      console.error("API Error fetching survey list:", err);
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(loadForms, 60_000);

  const handleStart = (formId) => navigate(`/participant/surveys/${formId}`);

  if (loading)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="h-7 w-40 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-24 bg-slate-200 rounded-full" />
                <div className="h-5 w-16 bg-slate-100 rounded-full" />
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-full bg-slate-100 rounded mb-4" />
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="h-9 w-28 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  /* ── Better empty state ── */
  if (forms.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">My Surveys</h1>
        </div>
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <SurveyEmptyIco />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            No surveys yet
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed mb-2">
            Your researcher hasn't assigned any surveys to your group yet.
            You'll see them here once they're published.
          </p>
          <p className="text-xs text-slate-400">
            Check back soon — you'll receive a notification when new surveys are
            available.
          </p>
        </div>
      </div>
    );
  }

  /* ── Filtering ── */
  const hasDateFilter = dateFrom || dateTo;
  const getGroup = (s) => (s === "completed" ? "FILLED" : "UNFILLED");

  const filtered = forms.filter((f) => {
    const matchSearch =
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      (f.category && f.category.toLowerCase().includes(search.toLowerCase()));
    const matchTab = tab === "ALL" || getGroup(f.status) === tab;
    const matchFrom = !dateFrom || (f.deployed_at && f.deployed_at >= dateFrom);
    const matchTo = !dateTo || (f.deployed_at && f.deployed_at <= dateTo);
    return matchSearch && matchTab && matchFrom && matchTo;
  });

  /* ── Sorting — urgency factors in due dates ── */
  const statusPriority = { in_progress: 0, pending: 1, completed: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "urgency") {
      const pa = statusPriority[a.status] ?? 9,
        pb = statusPriority[b.status] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = daysUntil(a.due_date),
        db = daysUntil(b.due_date);
      if (da !== db) return da - db;
      return new Date(b.deployed_at) - new Date(a.deployed_at);
    }
    if (sort === "newest")
      return new Date(b.deployed_at) - new Date(a.deployed_at);
    if (sort === "oldest")
      return new Date(a.deployed_at) - new Date(b.deployed_at);
    if (sort === "alpha") return a.title.localeCompare(b.title);
    return 0;
  });

  const counts = {
    ALL: forms.length,
    UNFILLED: forms.filter((f) => f.status !== "completed").length,
    FILLED: forms.filter((f) => f.status === "completed").length,
  };
  const sortLabels = {
    urgency: "Urgency",
    newest: "Newest first",
    oldest: "Oldest first",
    alpha: "A → Z",
  };
  const clearDates = () => {
    setDateFrom("");
    setDateTo("");
    setShowDateFilter(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <span className="text-slate-400">Dashboard</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 font-medium">Surveys</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">My Surveys</h1>
          <p className="text-sm text-slate-500">
            {forms.length} surveys assigned
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIco />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search surveys or categories…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start">
            {[
              { key: "ALL", label: "All" },
              { key: "UNFILLED", label: "Unfilled" },
              { key: "FILLED", label: "Filled" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${tab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t.label}
                <span
                  className={`text-xs rounded-full px-1.5 py-0.5 font-bold leading-none ${tab === t.key ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-400"}`}
                >
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSort(!showSort)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${sort !== "urgency" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              <SortIco /> {sortLabels[sort]}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[150px]">
                {Object.entries(sortLabels).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setSort(k);
                      setShowSort(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition ${sort === k ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shrink-0 ${hasDateFilter ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            <CalIco /> {hasDateFilter ? "Dates active" : "Date"}
            {hasDateFilter && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  clearDates();
                }}
                className="ml-1 hover:text-rose-500 transition"
              >
                <XIco />
              </span>
            )}
          </button>
        </div>
        {showDateFilter && (
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs font-semibold text-slate-500">
              Assigned between
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            <span className="text-xs text-slate-400">and</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
            {hasDateFilter && (
              <button
                onClick={clearDates}
                className="text-xs text-slate-400 hover:text-rose-500 font-medium transition"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {(search || tab !== "ALL" || hasDateFilter) && (
        <p className="text-xs text-slate-400 mb-3">
          {sorted.length} result{sorted.length !== 1 && "s"} found
        </p>
      )}

      <div className="space-y-3">
        {sorted.map((f) => (
          <FormRow key={f.form_id} form={f} onStart={handleStart} />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-semibold">No surveys match your filters</p>
            <p className="text-sm mt-1">
              Try adjusting your search, tab, or date range
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

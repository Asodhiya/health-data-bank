import { useState, useEffect } from "react";
import { api } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────



// ── SVG icons ──────────────────────────────────────────────────────────────

const Icon = ({ d, size = 16, sw = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const IcoOverview = () => (
  <Icon
    size={15}
    d={
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    }
  />
);

const IcoCompare = () => (
  <Icon
    size={15}
    d={
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    }
  />
);

const IcoGoals = () => (
  <Icon
    size={15}
    d={
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    }
  />
);


// ── Skeleton ───────────────────────────────────────────────────────────────

const Skeleton = ({ className = "" }) => (
  <div className={`bg-slate-100 rounded-2xl animate-pulse ${className}`} />
);

// ── Tabs config ────────────────────────────────────────────────────────────

const PILLS_INITIAL = 10;

function TabButton({ id, activeTab, onClick, icon, label, badge }) {
  const active = activeTab === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700"
      }`}
    >
      {icon}
      {label}
      {badge != null && (
        <span
          className={`ml-0.5 text-xs font-bold ${active ? "text-blue-200" : "text-slate-400"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ParticipantHealthSummary() {
  const [tab, setTab] = useState("overview");
  const [elements, setElements] = useState([]);
  const [timeseries, setTimeseries] = useState([]);
  const [vsGroup, setVsGroup] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [elementsData, vsGroupData, goalsData, timeseriesData] = await Promise.all([
          api.getMyElementsData(),
          api.getMyVsGroupStats().catch(() => null),
          api.listParticipantGoals(),
          api.getMyHealthTimeseries().catch(() => []),
        ]);
        setElements(elementsData || []);
        setVsGroup(vsGroupData);
        setGoals(goalsData || []);
        setTimeseries(timeseriesData || []);
        if (vsGroupData?.elements?.length) {
          setSelectedElement(vsGroupData.elements[0].element_id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goalsCompleted = goals.filter((g) => g.is_completed).length;
  const totalGoals = goals.length;
  const totalDataPoints = elements.reduce((s, e) => s + (e.count ?? 0), 0);
  const vsElements = vsGroup?.elements ?? [];
  const activeSelected = vsElements.find(
    (e) => e.element_id === selectedElement,
  );

  const summaryLine = () => {
    const parts = [];
    if (totalGoals > 0)
      parts.push(
        goalsCompleted === totalGoals
          ? `All ${totalGoals} goals completed`
          : `${goalsCompleted} of ${totalGoals} goal${totalGoals > 1 ? "s" : ""} completed`,
      );
    if (totalDataPoints > 0)
      parts.push(
        `${totalDataPoints} data point${totalDataPoints !== 1 ? "s" : ""} recorded`,
      );
    return parts.length
      ? parts.join(" · ")
      : "Complete a survey to see your health data here.";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Health Summary
        </h1>
        {loading ? (
          <Skeleton className="h-4 w-56 mt-2" />
        ) : (
          <p className="text-base text-slate-500 mt-2">{summaryLine()}</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 text-sm">
          Could not load your health data. Please try again later.
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex gap-2">
        <TabButton
          id="overview"
          activeTab={tab}
          onClick={setTab}
          icon={<IcoOverview />}
          label="Overview"
          badge={elements.length > 0 ? elements.length : null}
        />
        <TabButton
          id="compare"
          activeTab={tab}
          onClick={setTab}
          icon={<IcoCompare />}
          label="Compare"
          badge={null}
        />
        <TabButton
          id="goals"
          activeTab={tab}
          onClick={setTab}
          icon={<IcoGoals />}
          label="Goals"
          badge={totalGoals > 0 ? `${goalsCompleted}/${totalGoals}` : null}
        />
      </div>

      {/* ── Tab panels ── */}
      {tab === "overview" && (
        <OverviewTab elements={elements} timeseries={timeseries} loading={loading} />
      )}
      {tab === "compare" && (
        <CompareTab
          vsElements={vsElements}
          activeSelected={activeSelected}
          selectedElement={selectedElement}
          setSelectedElement={setSelectedElement}
          loading={loading}
        />
      )}
      {tab === "goals" && <GoalsTab goals={goals} timeseries={timeseries} loading={loading} />}
    </div>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ points, color = "#3b82f6" }) {
  const filtered = (points || []).filter((p) => p.value_number != null);

  if (filtered.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-slate-300">Not enough data</span>
      </div>
    );
  }

  const W = 200, H = 64, PAD = 4;
  const vals = filtered.map((p) => p.value_number);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const pts = filtered.map((p, i) => {
    const x = PAD + (i / (filtered.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (p.value_number - minV) / range) * (H - PAD * 2);
    return [x, y];
  });

  const polyline = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} ${pts[pts.length - 1][0].toFixed(1)},${H} ${pts[0][0].toFixed(1)},${H}`;
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace("#","")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="3.5" fill={color} />
    </svg>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 36500 },
];

function filterPointsByDays(points, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return points.filter((p) => p.observed_at && new Date(p.observed_at) >= cutoff);
}

function calcTrend(vals) {
  if (vals.length < 2) return { direction: "flat", pct: null };
  const mid = Math.floor(vals.length / 2);
  const firstAvg = vals.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondAvg = vals.slice(mid).reduce((a, b) => a + b, 0) / (vals.length - mid);
  if (firstAvg === 0) return { direction: "flat", pct: null };
  const pct = ((secondAvg - firstAvg) / firstAvg) * 100;
  const direction = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  return { direction, pct: Math.abs(pct).toFixed(1) };
}

const METRIC_INITIAL = 8;

function OverviewTab({ elements, timeseries, loading }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [selectedId, setSelectedId] = useState(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // Auto-select first element once loaded
  const resolvedId = selectedId || (elements[0]?.element_id ?? null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
          <IcoOverview />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No metrics yet</p>
        <p className="text-sm text-slate-500 mt-1">Complete a survey and your health data will appear here.</p>
      </div>
    );
  }

  const tsMap = {};
  timeseries.forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  const filteredElements = elements.filter((el) =>
    el.label.toLowerCase().includes(metricSearch.toLowerCase())
  );
  const visibleElements = showAllMetrics || metricSearch ? filteredElements : filteredElements.slice(0, METRIC_INITIAL);
  const hiddenCount = filteredElements.length - METRIC_INITIAL;

  const activeEl = elements.find((e) => e.element_id === resolvedId) || elements[0];
  const allPoints = tsMap[activeEl.element_id] || [];
  const points = filterPointsByDays(allPoints, rangeDays);
  const vals = points.map((p) => p.value_number).filter((v) => v != null && Number.isFinite(v));

  const latest = vals.length ? vals[vals.length - 1] : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : activeEl.avg;
  const min = vals.length ? Math.min(...vals) : activeEl.min;
  const max = vals.length ? Math.max(...vals) : activeEl.max;
  const { direction, pct } = calcTrend(vals);

  const trendColor = direction === "up" ? "#22c55e" : direction === "down" ? "#f59e0b" : "#3b82f6";
  const trendBg = direction === "up" ? "bg-emerald-50 text-emerald-600" : direction === "down" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";
  const trendLabel = direction === "up" ? `↑ ${pct}%` : direction === "down" ? `↓ ${pct}%` : "→ Stable";

  return (
    <div className="space-y-4">

      {/* Metric selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* Search bar — only shown when there are enough elements */}
        {elements.length > METRIC_INITIAL && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search metrics..."
              value={metricSearch}
              onChange={(e) => { setMetricSearch(e.target.value); setShowAllMetrics(true); }}
              className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {visibleElements.map((el) => (
            <button
              key={el.element_id}
              onClick={() => setSelectedId(el.element_id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                el.element_id === resolvedId
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {el.label}
            </button>
          ))}

          {!metricSearch && hiddenCount > 0 && !showAllMetrics && (
            <button
              onClick={() => setShowAllMetrics(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              +{hiddenCount} more
            </button>
          )}
          {!metricSearch && showAllMetrics && filteredElements.length > METRIC_INITIAL && (
            <button
              onClick={() => setShowAllMetrics(false)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              Show less
            </button>
          )}
        </div>
      </div>

      {/* Main chart card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        {/* Accent bar */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(to right, ${trendColor}, ${trendColor}44)` }} />

        <div className="p-5">
          {/* Header row: name + range toggle */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">{activeEl.label}</p>
              <div className="flex items-end gap-2">
                <p className="text-5xl font-black text-slate-800 leading-none tracking-tight">
                  {latest != null ? Number(latest).toFixed(1) : avg != null ? Number(avg).toFixed(1) : "—"}
                </p>
                <p className="text-sm font-semibold text-slate-400 mb-1">{activeEl.unit || ""}</p>
                {pct != null && (
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full mb-1 ${trendBg}`}>
                    {trendLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Day range dropdown */}
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="shrink-0 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Chart */}
          <div className="w-full h-40">
            <Sparkline points={points} color={trendColor} />
          </div>

          {/* Stats row */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-2">
            {[
              { label: "Latest", val: latest },
              { label: "Avg", val: avg },
              { label: "Min", val: min },
              { label: "Max", val: max },
            ].map(({ label, val }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-slate-50">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{label}</span>
                <span className="text-sm font-black text-slate-700">
                  {val != null ? Number(val).toFixed(1) : "—"}
                </span>
                {activeEl.unit && <span className="text-[10px] text-slate-400">{activeEl.unit}</span>}
              </div>
            ))}
          </div>

          {/* Entry count */}
          <p className="text-xs text-slate-400 text-center mt-3">
            {vals.length} {vals.length === 1 ? "entry" : "entries"} in the last {rangeDays} days
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Compare tab ────────────────────────────────────────────────────────────

function CompareTab({
  vsElements,
  activeSelected,
  selectedElement,
  setSelectedElement,
  loading,
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = vsElements.filter((el) =>
    el.label.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = search
    ? filtered
    : showAll
      ? filtered
      : filtered.slice(0, PILLS_INITIAL);
  const hiddenCount = filtered.length - PILLS_INITIAL;

  if (loading) return <Skeleton className="h-64" />;

  if (vsElements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100 p-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <IcoCompare />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No group data yet</p>
        <p className="text-sm text-slate-400">
          Comparison data will appear once your group has enough submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search metrics…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowAll(false);
        }}
        className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-300 bg-white shadow-sm"
      />

      {/* Pills */}
      <div className="flex flex-wrap gap-2">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 py-1">
            No metrics match "{search}"
          </p>
        ) : (
          visible.map((el) => (
            <button
              key={el.element_id}
              onClick={() => setSelectedElement(el.element_id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                selectedElement === el.element_id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700"
              }`}
            >
              {el.label}
            </button>
          ))
        )}

        {!search && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            {showAll ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>

      {activeSelected && <ComparisonVisual el={activeSelected} />}
    </div>
  );
}

// ── Goals tab ──────────────────────────────────────────────────────────────

// ── Goals tab helpers ─────────────────────────────────────────────────────

function getLastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

function fmtShortDay(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function fmtShortDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

// ── Goals tab ─────────────────────────────────────────────────────────────

function GoalsTab({ goals, timeseries, loading }) {
  const [activeGoalId, setActiveGoalId] = useState(null);

  const resolvedId = activeGoalId || goals[0]?.goal_id || null;
  const activeGoal = goals.find((g) => g.goal_id === resolvedId) || goals[0];

  if (loading) {
    return (
      <div className="flex gap-4">
        <Skeleton className="w-48 h-80 rounded-2xl shrink-0" />
        <Skeleton className="flex-1 h-80 rounded-2xl" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <IcoGoals />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No goals set yet</p>
        <a href="/participant/healthgoals" className="inline-block text-sm text-blue-600 font-semibold hover:underline mt-1">
          Add your first goal →
        </a>
      </div>
    );
  }

  // build timeseries map: element_id → points
  const tsMap = {};
  timeseries.forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  return (
    <div className="flex gap-4 min-h-[480px]">
      {/* ── Left sidebar ── */}
      <div className="w-44 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Goals</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {goals.map((g) => {
            const isActive = g.goal_id === resolvedId;
            const done = g.is_completed;
            return (
              <button
                key={g.goal_id}
                onClick={() => setActiveGoalId(g.goal_id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all border-l-2 ${
                  isActive
                    ? "bg-blue-50 border-blue-500"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-400" : "bg-blue-400"}`} />
                <span className={`text-xs leading-tight line-clamp-2 ${isActive ? "font-bold text-blue-700" : "font-medium text-slate-600"}`}>
                  {g.name ?? g.element?.label ?? "Goal"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-medium">
            {goals.filter(g => g.is_completed).length} of {goals.length} goals active
          </p>
          <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${goals.length ? (goals.filter(g => g.is_completed).length / goals.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {activeGoal && (
        <GoalDetail goal={activeGoal} tsPoints={tsMap[activeGoal.element_id] || []} />
      )}
    </div>
  );
}

function GoalDetail({ goal, tsPoints }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Animate bars in on mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, [goal.goal_id]);

  const name = goal.name ?? goal.element?.label ?? "Goal";
  const unit = goal.element?.unit || "";
  const current = goal.current_value ?? 0;
  const target = goal.target_value ?? 1;
  const done = goal.is_completed;
  const ctx = goal.completion_context || {};
  const windowStart = ctx.window_start ? new Date(ctx.window_start) : null;
  const windowEnd = ctx.window_end ? new Date(ctx.window_end) : null;
  const progressMode = ctx.progress_mode || goal.progress_mode || "incremental";
  const direction = ctx.direction || goal.direction || "at_least";
  const windowType = ctx.window || goal.window || "daily";

  const pct = Math.min(100, Math.max(0, target > 0
    ? direction === "at_most"
      ? current > 0 ? Math.round((target / current) * 100) : 0
      : Math.round((current / target) * 100)
    : 0));

  // Last 7 days bar chart from timeseries
  const days = getLastNDays(7);
  const barData = days.map((day) => {
    const dayPts = tsPoints.filter((p) => p.observed_at && isSameDay(new Date(p.observed_at), day));
    const vals = dayPts.map((p) => p.value_number).filter((v) => v != null && Number.isFinite(v));
    const total = progressMode === "absolute"
      ? vals.length ? vals[vals.length - 1] : 0
      : vals.reduce((a, b) => a + b, 0);
    return { day, total, isToday: isSameDay(day, new Date()), pts: dayPts };
  });
  const barMax = Math.max(...barData.map((b) => b.total), target, 1);

  // Entries: if a day is selected show that day's, otherwise show window entries
  const windowEntries = tsPoints.filter((p) => {
    if (!p.observed_at) return false;
    const d = new Date(p.observed_at);
    if (windowStart && d < windowStart) return false;
    if (windowEnd && d > windowEnd) return false;
    return true;
  }).sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at));

  const selectedBarData = selectedDay != null ? barData[selectedDay] : null;
  const displayedEntries = selectedBarData
    ? selectedBarData.pts.sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
    : windowEntries;
  const entriesLabel = selectedBarData
    ? `${fmtShortDay(selectedBarData.day)} ${selectedBarData.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${displayedEntries.length})`
    : `This ${windowType} window (${windowEntries.length})`;

  // Human-readable tags
  const windowTag = { daily: "Daily goal", weekly: "Weekly goal", monthly: "Monthly goal" }[windowType] ?? `${windowType} goal`;
  const directionTag = direction === "at_most"
    ? `Stay under ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`
    : `Reach ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`;
  const statusTag = done ? "Done today ✓" : "In progress";

  const tags = [windowTag, directionTag, statusTag];

  const tagColors = {
    "Done today ✓": "bg-emerald-50 text-emerald-600 border-emerald-100",
    "In progress": "bg-blue-50 text-blue-600 border-blue-100",
  };

  // Human-readable context note
  const contextNote = progressMode === "incremental"
    ? windowType === "daily"
      ? "Each log you add counts toward your daily total. Resets at midnight."
      : `Each log you add counts toward your ${windowType} total.`
    : "Your most recent log is used as your current progress value.";

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{name}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Today, {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {windowType === "daily" ? " · resets midnight" : ""}
            </p>
          </div>
          <a
            href="/participant/healthgoals"
            className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all whitespace-nowrap"
          >
            + Log entry
          </a>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t) => (
            <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tagColors[t] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Big value + progress */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{name}</p>
            <div className="flex items-end gap-1.5">
              <p className={`text-4xl font-black leading-none tracking-tight ${done ? "text-emerald-600" : "text-blue-600"}`}>
                {Number(current).toLocaleString()}
              </p>
              <p className="text-sm font-semibold text-slate-400 mb-1">{unit}</p>
            </div>
            <p className="text-xs text-slate-400 mt-1">of {Number(target).toLocaleString()} {unit} target</p>
          </div>

          {/* Circular pct */}
          <div className="shrink-0 relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={done ? "#22c55e" : "#3b82f6"} strokeWidth="3"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700">{pct}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{pct}% complete</span>
            <span>target: {Number(target).toLocaleString()} {unit}</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${done ? "bg-emerald-400" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Weekly bars */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 7 Days</p>
            {selectedDay != null && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-all"
              >
                Clear ✕
              </button>
            )}
          </div>

          <div className="flex items-end gap-1.5" style={{ height: "88px" }}>
            {barData.map(({ day, total, isToday }, idx) => {
              const barPct = barMax > 0 ? (total / barMax) * 100 : 0;
              const metTarget = total >= target;
              const isHovered = hoveredBar === idx;
              const isSelected = selectedDay === idx;
              const animatedPct = mounted ? Math.max(barPct, total > 0 ? 6 : 0) : 0;

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 flex flex-col items-center gap-1 cursor-pointer group relative"
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                      {total > 0 ? `${Number(total).toLocaleString()} ${unit}` : "No data"}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  )}

                  {/* Bar container */}
                  <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ease-out ${
                        isSelected
                          ? "ring-2 ring-offset-1 ring-blue-400"
                          : ""
                      } ${
                        isToday
                          ? metTarget ? "bg-emerald-400" : "bg-blue-500"
                          : metTarget
                            ? isHovered ? "bg-emerald-300" : "bg-emerald-200"
                            : isHovered ? "bg-slate-300" : "bg-slate-200"
                      }`}
                      style={{
                        height: `${animatedPct}%`,
                        transition: "height 0.5s cubic-bezier(0.34,1.56,0.64,1), background-color 0.15s",
                      }}
                    />
                  </div>

                  <span className={`text-[9px] font-bold transition-colors ${
                    isSelected ? "text-blue-600" : isToday ? "text-blue-500" : "text-slate-400"
                  }`}>
                    {isToday ? "Today" : fmtShortDay(day)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Context note */}
        <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
          <span className="mt-0.5 shrink-0">⏱</span>
          <p>{contextNote}</p>
        </div>

        {/* Entries list — filtered by selected bar or shows window entries */}
        {displayedEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Entries · {entriesLabel}
            </p>
            <div className="space-y-1.5">
              {displayedEntries.slice(0, 10).map((p) => (
                <div key={p.data_id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  <span className="text-slate-400 text-xs w-16 shrink-0">{fmtShortDate(p.observed_at)}</span>
                  <span className="font-bold text-slate-700 font-mono text-sm">
                    {p.value_number != null ? `${Number(p.value_number).toLocaleString()} ${unit}` : p.value_text ?? "—"}
                  </span>
                  {p.notes && <span className="text-xs text-slate-400 italic truncate">{p.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Comparison visual ──────────────────────────────────────────────────────

function ComparisonVisual({ el }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [el.element_id]);

  const meAvg = el.subject?.avg;
  const groupAvg = el.comparison?.avg;
  const groupMin = el.comparison?.min;
  const groupMax = el.comparison?.max;
  const diff = meAvg != null && groupAvg != null ? meAvg - groupAvg : null;
  const hasRange = groupMin != null && groupMax != null && groupMax !== groupMin;

  const status = () => {
    if (diff == null) return { label: "No data yet", badge: "bg-white/20 text-white", color: "text-slate-400" };
    if (Math.abs(diff) < 0.5) return { label: "Right on track", badge: "bg-white/20 text-white", color: "text-slate-600" };
    if (diff > 0) return { label: "Above average", badge: "bg-emerald-400/30 text-emerald-100", color: "text-emerald-600" };
    return { label: "Below average", badge: "bg-amber-400/30 text-amber-100", color: "text-amber-600" };
  };
  const st = status();

  // Bar heights — scale both against the higher of the two values or groupMax
  const barCeiling = Math.max(meAvg ?? 0, groupAvg ?? 0, groupMax ?? 0, 1);
  const mePct = meAvg != null ? Math.min((meAvg / barCeiling) * 100, 100) : 0;
  const groupPct = groupAvg != null ? Math.min((groupAvg / barCeiling) * 100, 100) : 0;
  const groupMinPct = groupMin != null ? Math.min((groupMin / barCeiling) * 100, 100) : 0;
  const groupMaxPct = groupMax != null ? Math.min((groupMax / barCeiling) * 100, 100) : 0;

  const BAR_H = 140;

  return (
    <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">

      {/* ── Gradient hero header ── */}
      <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 px-6 py-6 text-white overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
        <div className="absolute right-4 bottom-2 w-14 h-14 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-blue-200 text-[11px] font-bold uppercase tracking-widest mb-2">{el.label}</p>
            <p className="text-5xl font-black leading-none tracking-tight">
              {meAvg != null ? Number(meAvg).toFixed(1) : "—"}
            </p>
            <p className="text-blue-200 text-sm mt-1.5 font-medium">{el.unit || "your average"}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${st.badge}`}>{st.label}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6 bg-white space-y-5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Where you stand</p>

        {/* ── Side-by-side bars — full width ── */}
        <div className="flex items-end gap-4" style={{ height: `${BAR_H + 48}px` }}>

          {/* YOU bar */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <span className={`text-sm font-black tabular-nums ${st.color}`}>
              {meAvg != null ? `${Number(meAvg).toFixed(1)} ${el.unit || ""}` : "—"}
            </span>
            <div className="relative w-full flex items-end rounded-t-2xl overflow-hidden bg-blue-50" style={{ height: `${BAR_H}px` }}>
              <div
                className="w-full rounded-t-2xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700"
                style={{
                  height: mounted && meAvg != null ? `${mePct}%` : "0%",
                  transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            </div>
            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">You</span>
          </div>

          {/* GROUP bar */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <span className="text-sm font-black tabular-nums text-slate-500">
              {groupAvg != null ? `${Number(groupAvg).toFixed(1)} ${el.unit || ""}` : "—"}
            </span>
            <div className="relative w-full flex items-end rounded-t-2xl overflow-hidden bg-slate-100" style={{ height: `${BAR_H}px` }}>
              {/* Range band */}
              {hasRange && (
                <div
                  className="absolute w-full bg-slate-300/50"
                  style={{ bottom: `${groupMinPct}%`, height: `${groupMaxPct - groupMinPct}%` }}
                />
              )}
              <div
                className="w-full rounded-t-2xl bg-gradient-to-t from-slate-500 to-slate-300 relative z-10 transition-all duration-700"
                style={{
                  height: mounted && groupAvg != null ? `${groupPct}%` : "0%",
                  transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            </div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Group avg</span>
          </div>
        </div>

        {/* Range legend */}
        {hasRange && (
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>Min {Number(groupMin).toFixed(1)}{el.unit ? ` ${el.unit}` : ""}</span>
            <span>Max {Number(groupMax).toFixed(1)}{el.unit ? ` ${el.unit}` : ""}</span>
          </div>
        )}

        {/* Plain-English diff */}
        {diff != null ? (
          <p className="text-sm text-slate-500 leading-relaxed text-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            {Math.abs(diff) < 0.5
              ? "You're right in line with the group average. Great consistency!"
              : <>You're{" "}
                  <span className={`font-bold ${diff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {Number(Math.abs(diff)).toFixed(1)}{el.unit ? ` ${el.unit}` : ""} {diff > 0 ? "above" : "below"}
                  </span>
                  {" "}the group average.</>
            }
          </p>
        ) : (
          <p className="text-sm text-slate-400 text-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            Not enough data to compare yet.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────────


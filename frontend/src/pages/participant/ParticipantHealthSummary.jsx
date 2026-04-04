import { useState, useEffect } from "react";
import { api } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v, unit) =>
  v != null ? `${Number(v).toFixed(1)}${unit ? ` ${unit}` : ""}` : "—";

const windowLabel = (w) =>
  ({ daily: "Daily", weekly: "Weekly", monthly: "Monthly" })[w] ?? w ?? "";

const directionIcon = (d) =>
  d === "increase" ? "↑" : d === "decrease" ? "↓" : "→";

const rangePct = (value, lo, hi) => {
  if (value == null || lo == null || hi == null || hi === lo) return 50;
  return Math.min(
    100,
    Math.max(0, Math.round(((value - lo) / (hi - lo)) * 100)),
  );
};

const goalPct = (current, target, direction) => {
  if (current == null || !target) return 0;
  const raw =
    direction === "decrease"
      ? ((target - (current - target)) / target) * 100
      : (current / target) * 100;
  return Math.min(100, Math.max(0, Math.round(raw)));
};

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

const IcoCheck = () => <Icon size={14} sw={2.5} d="M20 6L9 17l-5-5" />;

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
  const [vsGroup, setVsGroup] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [elementsData, vsGroupData, goalsData] = await Promise.all([
          api.getMyElementsData(),
          api.getMyVsGroupStats().catch(() => null),
          api.listParticipantGoals(),
        ]);
        setElements(elementsData || []);
        setVsGroup(vsGroupData);
        setGoals(goalsData || []);
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
        <OverviewTab elements={elements} loading={loading} />
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
      {tab === "goals" && <GoalsTab goals={goals} loading={loading} />}
    </div>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────

function OverviewTab({ elements, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
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
        <p className="text-sm text-slate-500 mt-1">
          Complete a survey and your health data will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {elements.map((el) => (
        <div
          key={el.element_id}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden"
        >
          {/* Blue accent strip */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-blue-400" />

          <div className="p-5">
            {/* Icon + label row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <IcoOverview />
              </div>
              <p className="text-sm font-semibold text-slate-600 truncate leading-tight">
                {el.label}
              </p>
            </div>

            {/* Big value */}
            <p className="text-4xl font-black text-slate-800 leading-none tracking-tight">
              {el.avg != null ? Number(el.avg).toFixed(1) : "—"}
            </p>
            <p className="text-sm font-semibold text-slate-400 mt-1">
              {el.unit ?? ""}
            </p>

            {/* Divider + count */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Average</p>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {el.count} {el.count === 1 ? "entry" : "entries"}
              </span>
            </div>
          </div>
        </div>
      ))}
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

function GoalsTab({ goals, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100 p-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <IcoGoals />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No goals set yet</p>
        <a
          href="/participant/healthgoals"
          className="inline-block text-sm text-blue-600 font-semibold hover:underline mt-1"
        >
          Add your first goal →
        </a>
      </div>
    );
  }

  const done = goals.filter((g) => g.is_completed);
  const active = goals.filter((g) => !g.is_completed);

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard key={g.goal_id} goal={g} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            Completed
          </p>
          {done.map((g) => (
            <GoalCard key={g.goal_id} goal={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comparison visual ──────────────────────────────────────────────────────

function ComparisonVisual({ el }) {
  const meAvg = el.subject?.avg;
  const groupAvg = el.comparison?.avg;
  const groupMin = el.comparison?.min;
  const groupMax = el.comparison?.max;

  const myPct = rangePct(meAvg, groupMin, groupMax);
  const groupPct = rangePct(groupAvg, groupMin, groupMax);
  const diff = meAvg != null && groupAvg != null ? meAvg - groupAvg : null;

  const statusText = () => {
    if (diff == null) return "Not enough data to compare yet.";
    if (Math.abs(diff) < 0.5)
      return "You're right on par with your group — keep it up!";
    if (diff > 0)
      return `You're tracking ${Number(Math.abs(diff)).toFixed(1)} ${el.unit ?? ""} above your group average.`;
    return `You're tracking ${Number(Math.abs(diff)).toFixed(1)} ${el.unit ?? ""} below your group average.`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Blue accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-blue-400" />

      <div className="p-6 space-y-6">
        {/* Values row */}
        <div className="flex items-stretch gap-4">
          <div className="flex-1 bg-blue-50 rounded-2xl p-4 border border-blue-100">
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">
              You
            </p>
            <p className="text-3xl font-black text-blue-700 leading-none">
              {fmt(meAvg, el.unit)}
            </p>
          </div>
          <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
              Group avg
            </p>
            <p className="text-3xl font-black text-slate-500 leading-none">
              {fmt(groupAvg, el.unit)}
            </p>
          </div>
        </div>

        {/* Range track */}
        <div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-3">
            Where you stand
          </p>
          {/* Track */}
          <div className="w-full h-4 bg-slate-100 rounded-full relative overflow-visible">
            {/* Group range band */}
            <div className="absolute inset-y-0 left-[10%] right-[10%] bg-slate-200 rounded-full" />
            {/* Group avg tick */}
            {groupAvg != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-6 bg-slate-400 rounded-full"
                style={{ left: `${groupPct}%` }}
              />
            )}
            {/* Your dot */}
            {meAvg != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-lg transition-all duration-700 flex items-center justify-center"
                style={{ left: `${myPct}%` }}
              >
                <span className="w-2 h-2 bg-white rounded-full block" />
              </div>
            )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
            <span>
              {groupMin != null
                ? `Min · ${Number(groupMin).toFixed(1)}`
                : "Low"}
            </span>
            <span>
              {groupMax != null
                ? `Max · ${Number(groupMax).toFixed(1)}`
                : "High"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0 border-2 border-white shadow-sm" />
            You
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-1 bg-slate-400 rounded-full shrink-0" />
            Group average
          </span>
        </div>

        {/* Plain English status */}
        <p className="text-sm text-slate-600 bg-blue-50 rounded-xl px-4 py-3 leading-relaxed border border-blue-100">
          {statusText()}
        </p>
      </div>
    </div>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────────

function GoalCard({ goal }) {
  const pct = goalPct(goal.current_value, goal.target_value, goal.direction);
  const done = goal.is_completed;

  return (
    <div
      className={`bg-white rounded-2xl border p-5 shadow-sm shadow-slate-100 transition-all ${
        done
          ? "border-slate-200"
          : "border-slate-100 hover:border-slate-200 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-bold text-slate-800">
            {goal.name ?? goal.element?.label ?? "Goal"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {windowLabel(goal.window)}
            {goal.direction &&
              ` · ${directionIcon(goal.direction)} ${goal.direction}`}
          </p>
        </div>
        {done ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <IcoCheck /> Done
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
            In progress
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400 px-0.5">
          <span>
            {goal.current_value != null
              ? fmt(goal.current_value, goal.element?.unit)
              : "No data yet"}
          </span>
          <span>Target: {fmt(goal.target_value, goal.element?.unit)}</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              done
                ? "bg-gradient-to-r from-blue-500 to-blue-600"
                : "bg-gradient-to-r from-blue-400 to-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-[11px] text-slate-400">{pct}%</p>
      </div>
    </div>
  );
}

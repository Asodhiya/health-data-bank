import { useState, useEffect, useCallback, useRef } from "react";
import { usePolling } from "../../hooks/usePolling";
import { api } from "../../services/api";
import GuideTooltip from "../../components/GuideTooltip";
import SVGIcon from "../../components/SVGIcon";
import { getLastNDays, fmtShortDay, fmtEntryStamp, isSameDay } from "../../utils/dateFormatters";

// ── Icons ──────────────────────────────────────────────────────────────────

const Svg = SVGIcon;

const PlusIco    = () => <Svg d="M12 5v14M5 12h14" size={18} />;
const TrashIco   = () => <Svg d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={15} />;
const CloseIco   = () => <Svg d="M18 6L6 18M6 6l12 12" size={20} />;
const AlertIco   = () => <Svg size={13} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} />;
const TargetIco  = ({ size = 22 }) => <Svg size={size} d={<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>} />;
const PencilIco  = () => <Svg d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />;
const MenuIco    = () => <Svg d="M4 6h16M4 12h16M4 18h16" size={18} />;
const ChevronIco = () => <Svg d="M9 18l6-6-6-6" size={16} sw={2.5} />;
const GripIco    = () => (
  <Svg size={12} stroke="none" fill="currentColor" d={
    <>
      <circle cx="9"  cy="6"  r="1.2" /><circle cx="15" cy="6"  r="1.2" />
      <circle cx="9"  cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" />
      <circle cx="9"  cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" />
    </>
  } />
);

// ── Helpers ────────────────────────────────────────────────────────────────

const normalizeDatatype = (raw) => {
  const n = String(raw || "number").trim().toLowerCase();
  if (n === "string") return "text";
  if (n === "bool") return "boolean";
  if (["int", "integer"].includes(n)) return "integer";
  if (["float", "double", "decimal", "numeric"].includes(n)) return "float";
  if (!["text", "number", "boolean", "integer", "float"].includes(n)) return "number";
  return n;
};

function usesBooleanLogging(datatype) {
  return normalizeDatatype(datatype) === "boolean";
}

function usesIntegerLogging(datatype) {
  return normalizeDatatype(datatype) === "integer";
}

function isNumericDatatype(datatype) {
  return ["number", "integer", "float"].includes(normalizeDatatype(datatype));
}

// Both manual goal logs and survey submissions for the same element count as readings
const GOAL_PROGRESS_SOURCE_TYPES = new Set(["goal", "survey"]);

function getGoalTrackingPoints(points = []) {
  return (points || []).filter((point) =>
    GOAL_PROGRESS_SOURCE_TYPES.has(String(point?.source_type || "").toLowerCase())
  );
}

function getCompletedGoalMessage(goal) {
  const windowType = String(goal?.completion_context?.window || goal?.window || "daily").toLowerCase();
  if (windowType === "none") {
    return "This goal is already completed and no longer accepts entries.";
  }
  return `This ${windowType} goal is already completed for the current window.`;
}

function getGoalUsagePercent(current, target, direction) {
  const numericCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
  const numericTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
  if (numericTarget <= 0) return 0;

  if (direction === "at_most") {
    return Math.min(100, Math.max(0, Math.round((numericCurrent / numericTarget) * 100)));
  }

  return Math.min(100, Math.max(0, Math.round((numericCurrent / numericTarget) * 100)));
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HealthGoals() {
  const [activeGoals, setActiveGoals]     = useState([]);
  const [templates, setTemplates]         = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const templatesFetched                  = useRef(false);
  const [timeseries, setTimeseries]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeGoalId, setActiveGoalId]   = useState(null);

  const [isDrawerOpen, setIsDrawerOpen]   = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [logInputs, setLogInputs]         = useState({});
  const [logErrors, setLogErrors]         = useState({});
  const [addErrors, setAddErrors]         = useState({});
  const [customTargets, setCustomTargets] = useState({});
  const [customWindows, setCustomWindows] = useState({});
  const [drawerSearch, setDrawerSearch]   = useState("");
  const [drawerPage, setDrawerPage]       = useState(1);
  const DRAWER_PAGE_SIZE = 5;
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [logModalGoal, setLogModalGoal]   = useState(null); // goal being logged via modal
  const [goalOrder, setGoalOrder]         = useState(() => {
    try { return JSON.parse(localStorage.getItem("hdb-goal-order") || "[]"); }
    catch { return []; }
  });
  const [draggedId, setDraggedId]         = useState(null);
  const [dragOverId, setDragOverId]       = useState(null);
  const [isGoalSheetOpen, setIsGoalSheetOpen] = useState(false);

  const MAX_GOALS = 10;
  const isAtLimit = activeGoals.length >= MAX_GOALS;

  const fetchData = useCallback(async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const [goalsData, tsData] = await Promise.all([
        api.listParticipantGoals().catch(() => []),
        api.getMyHealthTimeseries().catch(() => []),
      ]);
      const goals = Array.isArray(goalsData) ? goalsData : [];
      setActiveGoals(goals);
      setTimeseries(Array.isArray(tsData) ? tsData : []);
      setGoalOrder((prev) => {
        const ids = goals.map((g) => g.goal_id);
        const kept = prev.filter((id) => ids.includes(id));
        const added = ids.filter((id) => !kept.includes(id));
        const next = [...kept, ...added];
        localStorage.setItem("hdb-goal-order", JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error("Error fetching goals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 30_000);

  // Lazy-load goal templates only when the drawer opens — avoids shipping the
  // full template library on initial dashboard load, and skips it from polling.
  useEffect(() => {
    if (!isDrawerOpen || templatesFetched.current) return;
    let cancelled = false;
    setTemplatesLoading(true);
    api.browseGoalTemplates()
      .then((data) => {
        if (cancelled) return;
        setTemplates(Array.isArray(data) ? data : []);
        templatesFetched.current = true;
      })
      .catch(() => { if (!cancelled) setTemplates([]); })
      .finally(() => { if (!cancelled) setTemplatesLoading(false); });
    return () => { cancelled = true; };
  }, [isDrawerOpen]);

  // Refresh templates after a goal is added/removed so stale availability
  // flags don't linger if the drawer stays open.
  const refreshTemplates = useCallback(async () => {
    if (!templatesFetched.current) return;
    try {
      const data = await api.browseGoalTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  // Sorted goals — respects user-defined drag order
  const sortedGoals = [...activeGoals].sort((a, b) => {
    const ai = goalOrder.indexOf(a.goal_id);
    const bi = goalOrder.indexOf(b.goal_id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Auto-select first goal (in sorted order)
  const resolvedGoalId = activeGoalId || sortedGoals[0]?.goal_id || null;
  const activeGoal = sortedGoals.find((g) => g.goal_id === resolvedGoalId) || sortedGoals[0];

  const tsMap = {};
  timeseries.forEach((ts) => { tsMap[ts.element_id] = getGoalTrackingPoints(ts.points); });

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e, goalId) => {
    setDraggedId(goalId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, goalId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (goalId !== draggedId) setDragOverId(goalId);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    setGoalOrder((prev) => {
      const order = [...prev];
      const from = order.indexOf(draggedId);
      const to   = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, draggedId);
      localStorage.setItem("hdb-goal-order", JSON.stringify(order));
      return order;
    });
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddGoal = async (templateId) => {
    if (isAtLimit) return;
    setAddErrors((p) => ({ ...p, [templateId]: null }));
    try {
      setActionLoading(templateId);
      const rawTarget = customTargets[templateId];
      const parsedTarget =
        rawTarget === "" || rawTarget == null ? undefined : Number(rawTarget);
      const selectedWindow = customWindows[templateId] || "daily";
      await api.addGoalFromTemplate(
        templateId,
        {
          target_value:
            Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : undefined,
          window: selectedWindow,
        },
      );
      setCustomTargets((p) => ({ ...p, [templateId]: "" }));
      setCustomWindows((p) => ({ ...p, [templateId]: "daily" }));
      await fetchData();
      refreshTemplates();
    } catch (err) {
      const msg = err?.response?.status === 409
        ? "You already track this metric with another goal."
        : err?.response?.status === 400
          ? "You've reached the 10-goal limit."
          : err?.message || "Failed to add goal. Please try again.";
      setAddErrors((p) => ({ ...p, [templateId]: msg }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogProgress = async (goalId, customValue = 1) => {
    if (customValue === "" || customValue === null) return;
    setLogErrors((p) => ({ ...p, [goalId]: null }));
    const goal = activeGoals.find((item) => item.goal_id === goalId);
    if (goal?.is_completed) {
      setLogErrors((p) => ({ ...p, [goalId]: getCompletedGoalMessage(goal) }));
      return;
    }
    if (typeof customValue === "string" && !isNaN(customValue) && customValue.trim() !== "") {
      if (Number(customValue) < 0) {
        setLogErrors((p) => ({ ...p, [goalId]: "Value cannot be negative." }));
        return;
      }
    } else if (typeof customValue === "number" && customValue < 0) {
      setLogErrors((p) => ({ ...p, [goalId]: "Value cannot be negative." }));
      return;
    }
    try {
      setActionLoading(`log_${goalId}`);
      let val = customValue;
      if (typeof val === "string" && val.trim() !== "" && !isNaN(val)) val = Number(val);
      const payload = { observed_at: new Date().toISOString() };
      if (typeof val === "string") payload.value_text = val;
      else if (typeof val === "boolean") payload.value_bool = val;
      else payload.value = Number(val);
      await api.logGoalProgress(goalId, payload);
      setLogInputs((p) => ({ ...p, [goalId]: "" }));
      setLogModalGoal(null);
      await fetchData();
    } catch (err) {
      setLogErrors((p) => ({ ...p, [goalId]: err?.message || "Failed to save. Please try again." }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      setActionLoading(`del_${goalId}`);
      await api.deleteParticipantGoal(goalId);
      setConfirmDeleteId(null);
      if (resolvedGoalId === goalId) setActiveGoalId(null);
      await fetchData();
      refreshTemplates();
    } catch (err) {
      console.error("Failed to delete goal:", err);
      setConfirmDeleteId(null);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading && activeGoals.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-40">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm text-slate-500 font-medium">Loading your health goals...</p>
      </div>
    );
  }

  // ── Page ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Goals</h1>
          <p className="text-sm text-slate-500 mt-1">Track and log your daily wellness habits.</p>
        </div>
        <div className="flex items-center gap-3">
          <GuideTooltip tip="How many goals you currently have active. You can have up to 10 at a time." position="bottom">
            <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Active</span>
              <span className={`text-sm font-bold ${isAtLimit ? "text-rose-500" : "text-slate-800"}`}>
                {activeGoals.length} / {MAX_GOALS}
              </span>
            </div>
          </GuideTooltip>
          <GuideTooltip tip="Browse the goal library to add new wellness habits recommended for your health plan." position="bottom">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <PlusIco /> Browse Goals
            </button>
          </GuideTooltip>
        </div>
      </div>

      {/* Empty state */}
      {activeGoals.length === 0 ? (
        <div className="bg-white rounded-2xl p-14 text-center border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <TargetIco size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Ready to build healthy habits?</h3>
          <p className="text-sm text-slate-500 mt-2 mb-6 max-w-sm mx-auto leading-relaxed">
            Browse the goal library to find habits recommended for you.
          </p>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            Explore Library
          </button>
        </div>
      ) : (
        /* ── Sidebar + Detail layout ── */
        <div className="flex flex-col lg:flex-row gap-4 min-h-[520px]">

          {/* ── Mobile goal selector bar (tap to open bottom sheet) ── */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsGoalSheetOpen(true)}
              className="w-full flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MenuIco />
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Current Goal</p>
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {activeGoal?.name ?? activeGoal?.element?.label ?? "Select a goal"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-slate-400">
                  {sortedGoals.filter((g) => g.is_completed).length}/{sortedGoals.length}
                </span>
                <ChevronIco />
              </div>
            </button>
          </div>

          {/* ── Mobile bottom sheet backdrop ── */}
          {isGoalSheetOpen && (
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsGoalSheetOpen(false)}
            />
          )}

          {/* ── Mobile bottom sheet ── */}
          <div className={`fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 flex flex-col transition-transform duration-300 ease-out ${isGoalSheetOpen ? "translate-y-0" : "translate-y-full"}`}
            style={{ maxHeight: "75vh" }}>
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">My Goals</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {sortedGoals.filter((g) => g.is_completed).length} of {sortedGoals.length} completed
                </p>
              </div>
              <button
                onClick={() => setIsGoalSheetOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-all"
              >
                <CloseIco />
              </button>
            </div>
            {/* Progress bar */}
            <div className="px-5 py-2 border-b border-slate-100">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${sortedGoals.length ? (sortedGoals.filter((g) => g.is_completed).length / sortedGoals.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            {/* Goal list */}
            <div className="flex-1 overflow-y-auto py-2">
              {sortedGoals.map((g) => {
                const isActive = g.goal_id === resolvedGoalId;
                const done = g.is_completed;
                const isConfirming = confirmDeleteId === g.goal_id;
                const isDragging = draggedId === g.goal_id;
                const isOver = dragOverId === g.goal_id;
                return (
                  <div
                    key={g.goal_id}
                    className="relative group"
                    draggable
                    onDragStart={(e) => handleDragStart(e, g.goal_id)}
                    onDragOver={(e) => handleDragOver(e, g.goal_id)}
                    onDrop={(e) => handleDrop(e, g.goal_id)}
                    onDragEnd={handleDragEnd}
                    style={{ opacity: isDragging ? 0.4 : 1 }}
                  >
                    {isOver && !isDragging && (
                      <div className="absolute top-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full z-10" />
                    )}
                    <button
                      onClick={() => { setActiveGoalId(g.goal_id); setConfirmDeleteId(null); setIsGoalSheetOpen(false); }}
                      className={`w-full text-left px-5 py-3.5 flex items-center gap-3 transition-all border-l-2 ${
                        isActive ? "bg-blue-50 border-blue-500" : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-slate-300 shrink-0 cursor-grab active:cursor-grabbing"><GripIco /></span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-400" : "bg-blue-400"}`} />
                      <span className={`text-sm leading-tight flex-1 text-left ${isActive ? "font-bold text-blue-700" : "font-medium text-slate-700"}`}>
                        {g.name ?? g.element?.label ?? "Goal"}
                      </span>
                      {done && <span className="text-xs font-bold text-emerald-600 shrink-0">✓ Done</span>}
                    </button>
                    {/* Delete in sheet */}
                    {!isConfirming ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(g.goal_id); setActiveGoalId(g.goal_id); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <TrashIco />
                      </button>
                    ) : (
                      <div className="px-5 pb-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Remove this goal?</span>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-lg hover:bg-slate-100 transition-all">Cancel</button>
                        <button
                          onClick={() => { handleDeleteGoal(g.goal_id); setIsGoalSheetOpen(false); }}
                          className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-lg transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar — hidden on mobile, shown on lg+ */}
          <div className="hidden lg:flex w-48 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col">
            <div className="px-4 py-3 border-b border-slate-100">
              <GuideTooltip tip="Click a goal to see its details. Drag the grip handle ⠿ to reorder your goals." position="right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-default">My Goals</p>
              </GuideTooltip>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {sortedGoals.map((g) => {
                const isActive = g.goal_id === resolvedGoalId;
                const done = g.is_completed;
                const isConfirming = confirmDeleteId === g.goal_id;
                const isDragging = draggedId === g.goal_id;
                const isOver = dragOverId === g.goal_id;
                return (
                  <div
                    key={g.goal_id}
                    className="relative group"
                    draggable
                    onDragStart={(e) => handleDragStart(e, g.goal_id)}
                    onDragOver={(e) => handleDragOver(e, g.goal_id)}
                    onDrop={(e) => handleDrop(e, g.goal_id)}
                    onDragEnd={handleDragEnd}
                    style={{ opacity: isDragging ? 0.4 : 1 }}
                  >
                    {/* Drop indicator */}
                    {isOver && !isDragging && (
                      <div className="absolute top-0 left-3 right-3 h-0.5 bg-blue-500 rounded-full z-10" />
                    )}
                    <button
                      onClick={() => { setActiveGoalId(g.goal_id); setConfirmDeleteId(null); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all border-l-2 pr-8 ${
                        isActive ? "bg-blue-50 border-blue-500" : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      {/* Grip handle */}
                      <span className="text-slate-300 group-hover:text-slate-400 shrink-0 cursor-grab active:cursor-grabbing">
                        <GripIco />
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-400" : "bg-blue-400"}`} />
                      <span className={`text-xs leading-tight line-clamp-2 ${isActive ? "font-bold text-blue-700" : "font-medium text-slate-600"}`}>
                        {g.name ?? g.element?.label ?? "Goal"}
                      </span>
                    </button>
                    {/* Trash — only visible on hover, not when confirming */}
                    {!isConfirming && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(g.goal_id); setActiveGoalId(g.goal_id); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <TrashIco />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Progress footer */}
            <div className="px-4 py-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-medium">
                {sortedGoals.filter((g) => g.is_completed).length} of {sortedGoals.length} completed
              </p>
              <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${sortedGoals.length ? (sortedGoals.filter((g) => g.is_completed).length / sortedGoals.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {activeGoal && (
            <GoalDetail
              key={activeGoal.goal_id}
              goal={activeGoal}
              tsPoints={tsMap[activeGoal.element_id] || []}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              actionLoading={actionLoading}
              handleDeleteGoal={handleDeleteGoal}
              onLogEntry={() => setLogModalGoal(activeGoal)}
            />
          )}
        </div>
      )}

      {/* ── Log Entry Modal ─────────────────────────────────────────────── */}
      {logModalGoal && (
        <LogEntryModal
          goal={logModalGoal}
          logInputs={logInputs}
          setLogInputs={setLogInputs}
          logErrors={logErrors}
          setLogErrors={setLogErrors}
          actionLoading={actionLoading}
          onLog={handleLogProgress}
          onClose={() => { setLogModalGoal(null); setLogErrors({}); }}
        />
      )}

      {/* ── Browse Goals Drawer ─────────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => { setIsDrawerOpen(false); setDrawerSearch(""); setDrawerPage(1); }} />
      )}
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col rounded-l-2xl border-l border-slate-200 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-6 py-5 flex items-center justify-between bg-white rounded-tl-2xl border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Goal Library</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select habits to track</p>
          </div>
          <button
            onClick={() => { setIsDrawerOpen(false); setDrawerSearch(""); setDrawerPage(1); }}
            className="w-8 h-8 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full flex items-center justify-center transition-all"
          >
            <CloseIco size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search goals..."
              value={drawerSearch}
              onChange={(e) => { setDrawerSearch(e.target.value); setDrawerPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
            />
            {drawerSearch && (
              <button
                onClick={() => { setDrawerSearch(""); setDrawerPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <CloseIco size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isAtLimit && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2">
              <AlertIco size={14} className="mt-0.5 shrink-0" />
              <p>Dashboard full (10/10). Remove a goal to make room for a new one.</p>
            </div>
          )}

          {templatesLoading && templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">Loading templates…</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">No templates available.</p>
            </div>
          ) : (
            templates.map((template) => {
              const tId = template.template_id;
              const name = template.name || template.element?.label || "Wellness Goal";
              const desc = template.description || template.element?.description || "";
              const datatype = normalizeDatatype(template.element?.datatype);
              const target = template.default_target ?? 1;
              const unit = template.element?.unit || "";
              const customTarget = customTargets[tId] ?? "";
              const templateWindow = (template.window || "daily").toLowerCase();
              const isTrackedTemplate = (template.progress_mode || "incremental").toLowerCase() === "absolute";
              // For absolute goals, window is fixed to the template's window; participants can't change it
              const selectedWindow = isTrackedTemplate ? templateWindow : (customWindows[tId] ?? "daily");
              const isAlreadyAdded = activeGoals.some((g) => g.template_id === tId);
              const isLoading = actionLoading === tId;
              const addError = addErrors[tId];

              return (
                <div
                  key={tId}
                  className={`bg-white border rounded-xl p-5 transition-all ${
                    isAlreadyAdded ? "border-slate-100 opacity-60" : "border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-bold text-slate-800 leading-tight pr-2 capitalize">{name}</h4>
                    <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-slate-100 whitespace-nowrap">
                      {selectedWindow === "none" ? "No reset" : selectedWindow}
                    </span>
                  </div>
                  {desc && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{desc}</p>}
                  <div className="mb-4 space-y-2">
                    {isTrackedTemplate ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl">
                        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                          {templateWindow === "none" ? "Track until reached" : `${templateWindow.charAt(0).toUpperCase() + templateWindow.slice(1)} tracked goal`}
                        </span>
                        <span className="text-xs text-violet-500 ml-auto">1 reading/day</span>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Time Frame
                        </label>
                        <select
                          value={selectedWindow}
                          onChange={(e) =>
                            setCustomWindows((p) => ({ ...p, [tId]: e.target.value }))
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="none">No reset</option>
                        </select>
                      </div>
                    )}
                    <p className="text-xs text-blue-600 font-semibold">
                      Default target: {target}{unit ? ` ${unit}` : ""}
                    </p>
                    {isNumericDatatype(datatype) && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Your Target
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step={usesIntegerLogging(datatype) ? "1" : "any"}
                          value={customTarget}
                          onChange={(e) =>
                            setCustomTargets((p) => ({ ...p, [tId]: e.target.value }))
                          }
                          placeholder={`${target}${unit ? ` ${unit}` : ""}`}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-[10px] text-slate-400">
                          Leave blank to use the default target.
                        </p>
                        {usesIntegerLogging(datatype) && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Whole numbers only.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {addError && (
                    <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mb-3">
                      <AlertIco size={12} /> {addError}
                    </p>
                  )}
                  <button
                    onClick={() => handleAddGoal(tId)}
                    disabled={isAlreadyAdded || isAtLimit || actionLoading === tId}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isAlreadyAdded
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : isAtLimit
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : actionLoading === tId
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
                    }`}
                  >
                    {isLoading ? "Adding..." : isAlreadyAdded ? "✓ Added" : "+ Add Goal"}
                  </button>
                </div>
              );
            })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] text-slate-400 font-medium">
                      {(safePage - 1) * DRAWER_PAGE_SIZE + 1}–{Math.min(safePage * DRAWER_PAGE_SIZE, filteredTemplates.length)} of {filteredTemplates.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDrawerPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
                      >
                        ‹
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => setDrawerPage(pg)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            pg === safePage
                              ? "bg-blue-600 text-white border border-blue-600"
                              : "border border-slate-200 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {pg}
                        </button>
                      ))}
                      <button
                        onClick={() => setDrawerPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── GoalDetail ─────────────────────────────────────────────────────────────

function GoalDetail({ goal, tsPoints, confirmDeleteId, setConfirmDeleteId, actionLoading, handleDeleteGoal, onLogEntry }) {
  const [hoveredBar, setHoveredBar] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const name        = goal.name ?? goal.element?.label ?? "Goal";
  const unit        = goal.element?.unit || "";
  const desc        = goal.description || goal.element?.description || "";
  const current     = goal.current_value ?? 0;
  const target      = goal.target_value ?? 1;
  const done        = goal.is_completed;
  const ctx         = goal.completion_context || {};
  const windowStart = ctx.window_start ? new Date(ctx.window_start) : null;
  const windowEnd   = ctx.window_end   ? new Date(ctx.window_end)   : null;
  const progressMode = ctx.progress_mode || goal.progress_mode || "incremental";
  const direction    = ctx.direction    || goal.direction    || "at_least";
  const windowType   = ctx.window       || goal.window       || "daily";
  const isConfirming = confirmDeleteId === goal.goal_id;
  const completionMessage = getCompletedGoalMessage(goal);

  // Absolute goals: latest reading = progress, max 1 log per calendar day
  const isTrackedMode = progressMode === "absolute";

  // Check if already logged today (applies to all absolute goals)
  const loggedToday = isTrackedMode && tsPoints.some(
    (p) => p.observed_at && isSameDay(new Date(p.observed_at), new Date())
  );

  const pct = getGoalUsagePercent(current, target, direction);

  // Last 7 days bar chart
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

  // Entries
  const windowEntries = tsPoints.filter((p) => {
    if (!p.observed_at) return false;
    const d = new Date(p.observed_at);
    if (windowStart && d < windowStart) return false;
    if (windowEnd   && d > windowEnd)   return false;
    return true;
  }).sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at));

  const selectedBarData = selectedDay != null ? barData[selectedDay] : null;
  const displayedEntries = selectedBarData
    ? selectedBarData.pts.sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
    : windowEntries;
  const entriesLabel = selectedBarData
    ? `${fmtShortDay(selectedBarData.day)} ${selectedBarData.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${displayedEntries.length})`
    : isTrackedMode && windowType === "none"
      ? `All readings (${windowEntries.length})`
      : `This ${windowType} window (${windowEntries.length})`;

  // Tags
  const windowTagText = isTrackedMode
    ? windowType === "none"
      ? "Track until reached"
      : { weekly: "Weekly tracked", monthly: "Monthly tracked" }[windowType] ?? `${windowType} tracked`
    : { daily: "Daily goal", weekly: "Weekly goal", monthly: "Monthly goal" }[windowType] ?? `${windowType} goal`;
  const directionTag = direction === "at_most"
    ? `Stay under ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`
    : `Reach ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`;
  const statusTag   = done ? "Done ✓" : (loggedToday) ? "Logged today ✓" : "In progress";
  const tags        = [windowTagText, directionTag, statusTag];
  const tagColors   = {
    "Done ✓":           "bg-emerald-50 text-emerald-600 border-emerald-100",
    "Logged today ✓":   "bg-teal-50 text-teal-600 border-teal-100",
    "In progress":      "bg-blue-50 text-blue-600 border-blue-100",
    "Track until reached": "bg-violet-50 text-violet-600 border-violet-100",
    "Weekly tracked":   "bg-violet-50 text-violet-600 border-violet-100",
    "Monthly tracked":  "bg-violet-50 text-violet-600 border-violet-100",
  };

  const contextNote = isTrackedMode
    ? windowType === "none"
      ? "Log your reading once per day. Progress is tracked until you permanently reach your target."
      : `Log your reading once per day. Your latest reading counts toward this ${windowType} goal.`
    : windowType === "daily"
      ? "Each log counts toward your daily total and resets at midnight."
      : `Each log counts toward your ${windowType} total.`;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">{name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Today, {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {isTrackedMode
                ? windowType === "none" ? " · one reading per day, no reset" : ` · one reading per day · ${windowType} window`
                : windowType === "daily" ? " · resets midnight" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Delete confirm or trash button */}
            {isConfirming ? (
              <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-xl px-3 py-1.5 shadow-sm">
                <span className="text-xs font-semibold text-slate-600">Remove?</span>
                <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
                <button
                  onClick={() => handleDeleteGoal(goal.goal_id)}
                  disabled={actionLoading === `del_${goal.goal_id}`}
                  className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-lg disabled:opacity-50 transition-all"
                >
                  {actionLoading === `del_${goal.goal_id}` ? "Removing…" : "Remove"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(goal.goal_id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                title="Remove goal"
              >
                <TrashIco />
              </button>
            )}
            <GuideTooltip
              tip={
                done ? completionMessage
                : loggedToday ? "A reading for this metric was already recorded today (via survey or manual log). Come back tomorrow."
                : "Record today's reading for this goal."
              }
              position="bottom"
            >
              <button
                onClick={(done || loggedToday) ? undefined : onLogEntry}
                disabled={done || loggedToday}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  done
                    ? "text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed"
                    : loggedToday
                      ? "text-teal-600 bg-teal-50 border-teal-100 cursor-not-allowed"
                      : "text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100"
                }`}
              >
                <PencilIco />
                {done ? "Completed" : loggedToday ? "Logged today" : "Log entry"}
              </button>
            </GuideTooltip>
          </div>
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

        {/* Description */}
        {desc && (
          <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">About this goal</p>
            <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
          </div>
        )}

        {isTrackedMode ? (
          /* ── Absolute goal UI ─────────────────────────────────────────── */
          <>
            {/* Latest reading vs target */}
            <div className={`flex items-center justify-between rounded-2xl px-5 py-4 border ${done ? "bg-emerald-50 border-emerald-100" : loggedToday ? "bg-teal-50 border-teal-100" : "bg-slate-50 border-slate-100"}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-400">Latest reading</p>
                {current > 0 ? (
                  <div className="flex items-end gap-1.5">
                    <span className={`text-4xl font-black leading-none tracking-tight ${done ? "text-emerald-600" : "text-slate-800"}`}>
                      {Number(current).toLocaleString()}
                    </span>
                    {unit && <span className="text-sm font-semibold text-slate-400 mb-1">{unit}</span>}
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-slate-300">No reading yet</span>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Target: {direction === "at_most" ? "≤" : "≥"} {Number(target).toLocaleString()}{unit ? ` ${unit}` : ""}
                </p>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-100" : current > 0 ? "bg-rose-50" : "bg-slate-100"}`}>
                {done ? (
                  <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : current > 0 ? (
                  <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Last 7 days — dot strip showing each day's reading vs target */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Last 7 Days</p>
              <div className="flex items-stretch gap-1.5">
                {barData.map(({ day, isToday, pts }, idx) => {
                  const reading = pts.length
                    ? pts.reduce((latest, p) =>
                        !latest || new Date(p.observed_at) > new Date(latest.observed_at) ? p : latest
                      , null)?.value_number
                    : null;
                  const hasReading = reading != null && Number.isFinite(reading);
                  const met = hasReading && (direction === "at_most" ? reading <= target : reading >= target);
                  const isHovered = hoveredBar === idx;
                  return (
                    <div
                      key={day.toISOString()}
                      className="flex-1 flex flex-col items-center gap-1.5 group relative cursor-default"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {isHovered && hasReading && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                          {Number(reading).toLocaleString()} {unit}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      )}
                      <div className={`w-full h-10 rounded-lg flex items-center justify-center transition-all ${
                        !hasReading
                          ? "bg-slate-50 border border-slate-100"
                          : met
                            ? isToday ? "bg-emerald-400" : "bg-emerald-100"
                            : isToday ? "bg-rose-400" : "bg-rose-100"
                      }`}>
                        {hasReading && (
                          <span className={`text-[10px] font-black ${
                            met
                              ? isToday ? "text-white" : "text-emerald-700"
                              : isToday ? "text-white" : "text-rose-600"
                          }`}>
                            {Number(reading).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold ${isToday ? "text-blue-500" : "text-slate-400"}`}>
                        {isToday ? "Today" : fmtShortDay(day)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-3 h-3 rounded bg-emerald-200 inline-block" /> Met target
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-3 h-3 rounded bg-rose-200 inline-block" /> Missed target
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block" /> No reading
                </span>
              </div>
            </div>

            {/* Context note */}
            <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 border border-slate-100">
              <span className="mt-0.5 shrink-0">⏱</span>
              <p>
                {done
                  ? `Target reached${windowType === "none" ? " — this goal is permanently complete." : `. This ${windowType} window will reset soon.`}`
                  : contextNote
                }
              </p>
            </div>
          </>
        ) : (
          /* ── Incremental goal UI (unchanged) ─────────────────────────── */
          <>
            {/* Big value + circular progress */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current progress</p>
                <div className="flex items-end gap-1.5">
                  <p className={`text-4xl font-black leading-none tracking-tight ${done ? "text-emerald-600" : "text-blue-600"}`}>
                    {Number(current).toLocaleString()}
                  </p>
                  {unit && <p className="text-sm font-semibold text-slate-400 mb-1">{unit}</p>}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {direction === "at_most" ? "out of" : "of"} {Number(target).toLocaleString()} {unit} {direction === "at_most" ? "max" : "target"}
                </p>
              </div>
              <div className="shrink-0 relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={done ? "#22c55e" : "#3b82f6"} strokeWidth="3"
                    strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700">{pct}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>{direction === "at_most" ? `${pct}% of limit used` : `${pct}% complete`}</span>
                <span>target: {Number(target).toLocaleString()} {unit}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${done ? "bg-emerald-400" : "bg-blue-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Last 7 days bars */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 7 Days</p>
                {selectedDay != null && (
                  <button onClick={() => setSelectedDay(null)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-all">
                    Clear ✕
                  </button>
                )}
              </div>
              <div className="flex items-end gap-1.5" style={{ height: "88px" }}>
                {barData.map(({ day, total, isToday }, idx) => {
                  const barPct    = barMax > 0 ? (total / barMax) * 100 : 0;
                  const metTarget = direction === "at_most" ? total <= target : total >= target;
                  const isHovered  = hoveredBar === idx;
                  const isSelected = selectedDay === idx;
                  const animPct    = mounted ? Math.max(barPct, total > 0 ? 6 : 0) : 0;
                  return (
                    <div
                      key={day.toISOString()}
                      className="flex-1 flex flex-col items-center gap-1 cursor-pointer group relative"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                      onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
                    >
                      {isHovered && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                          {total > 0 ? `${Number(total).toLocaleString()} ${unit}` : "No data"}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                        </div>
                      )}
                      <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
                        <div
                          className={`w-full rounded-t-lg ${isSelected ? "ring-2 ring-offset-1 ring-blue-400" : ""} ${
                            isToday
                              ? metTarget ? "bg-emerald-400" : "bg-blue-500"
                              : metTarget
                                ? isHovered ? "bg-emerald-300" : "bg-emerald-200"
                                : isHovered ? "bg-slate-300" : "bg-slate-200"
                          }`}
                          style={{
                            height: `${animPct}%`,
                            transition: "height 0.5s cubic-bezier(0.34,1.56,0.64,1), background-color 0.15s",
                          }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${isSelected ? "text-blue-600" : isToday ? "text-blue-500" : "text-slate-400"}`}>
                        {isToday ? "Today" : fmtShortDay(day)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Context note */}
            <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 border border-slate-100">
              <span className="mt-0.5 shrink-0">⏱</span>
              <p>{done ? `${completionMessage} It will open again in the next window.` : contextNote}</p>
            </div>
          </>
        )}

        {/* Entries list */}
        {displayedEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Entries · {entriesLabel}
            </p>
            <div className="space-y-1.5">
              {displayedEntries.slice(0, 10).map((p) => (
                <div key={p.data_id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  <span className="text-slate-400 text-xs w-16 shrink-0">{fmtEntryStamp(p.observed_at)}</span>
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

// ── Log Entry Modal ────────────────────────────────────────────────────────

function LogEntryModal({ goal, logInputs, setLogInputs, logErrors, setLogErrors, actionLoading, onLog, onClose }) {
  const goalId   = goal.goal_id;
  const name     = goal.name ?? goal.element?.label ?? "Goal";
  const unit     = goal.element?.unit || "";
  const desc     = goal.description || goal.element?.description || "";
  const datatype = normalizeDatatype(goal.element?.datatype);
  const progressMode = goal.progress_mode || "incremental";
  const direction = goal.direction || "at_least";
  const target   = goal.target_value ?? 1;
  const current  = goal.current_value ?? 0;
  const done     = goal.is_completed;
  const isLogging = actionLoading === `log_${goalId}`;
  const isBooleanGoal = usesBooleanLogging(datatype);
  const isNumericGoal = isNumericDatatype(datatype);
  const isIntegerGoal = usesIntegerLogging(datatype);
  const completionMessage = getCompletedGoalMessage(goal);

  const inputVal = logInputs[goalId] || "";
  const setVal = (v) => {
    setLogInputs((p) => ({ ...p, [goalId]: v }));
    setLogErrors((p) => ({ ...p, [goalId]: null }));
  };

  const submit = (value = inputVal) => onLog(goalId, value);

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Log Entry</p>
            <h3 className="text-base font-bold text-slate-800 leading-tight">{name}</h3>
            {unit && <p className="text-xs text-slate-400 mt-0.5">Unit: {unit}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0">
            <CloseIco size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Description */}
          {desc && (
            <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
              {desc}
            </p>
          )}

          {/* Current progress summary */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Current progress</span>
            <span className={`font-bold ${done ? "text-emerald-600" : "text-blue-600"}`}>
              {Number(current).toLocaleString()} {direction === "at_most" ? "of max" : "/"} {Number(target).toLocaleString()} {unit}
            </span>
          </div>

          {done && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {completionMessage}
            </div>
          )}

          {/* Input area */}
          <div className="space-y-2">
            {datatype === "text" && (
              <input
                type="text"
                autoFocus
                placeholder="Write your entry..."
                value={inputVal}
                onChange={(e) => setVal(e.target.value)}
                disabled={done}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
              />
            )}
            {isNumericGoal && (
              <div className="flex gap-2">
                <input
                  type="number"
                  autoFocus
                  min="0"
                  step={isIntegerGoal ? "1" : "any"}
                  placeholder={progressMode === "absolute" ? `Current value${unit ? ` (${unit})` : ""}` : `Add amount${unit ? ` (${unit})` : ""}`}
                  value={inputVal}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={done}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                />
              </div>
            )}
            {isIntegerGoal && (
              <p className="text-xs text-slate-400">
                Whole numbers only for this goal.
              </p>
            )}
            {isBooleanGoal && (
              <p className="text-sm text-slate-500 text-center py-2">
                Record whether you completed this goal for the current window.
              </p>
            )}

            {/* Error */}
            {logErrors[goalId] && (
              <p className="text-xs text-rose-500 font-medium flex items-center gap-1">
                <AlertIco size={12} /> {logErrors[goalId]}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all">
            Cancel
          </button>
          {isBooleanGoal ? (
            <>
              <button
                onClick={() => submit(false)}
                disabled={isLogging || done}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLogging ? "Saving…" : "No"}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={isLogging || done}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLogging ? "Saving…" : "Yes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => submit(inputVal)}
              disabled={isLogging || done || inputVal === ""}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {isLogging ? "Saving…" : progressMode === "absolute" ? "Set value" : "Log amount"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

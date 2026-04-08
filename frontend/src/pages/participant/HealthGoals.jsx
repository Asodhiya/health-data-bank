import { useState, useEffect } from "react";
import { api } from "../../services/api";

// ── Icons ──────────────────────────────────────────────────────────────────

const Svg = ({ d, size = 20, sw = 1.8, stroke = "currentColor", fill = "none", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const PlusIco    = () => <Svg d="M12 5v14M5 12h14" size={18} />;
const TrashIco   = () => <Svg d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" size={15} />;
const CloseIco   = () => <Svg d="M18 6L6 18M6 6l12 12" size={20} />;
const AlertIco   = () => <Svg size={13} d={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>} />;
const TargetIco  = ({ size = 22 }) => <Svg size={size} d={<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>} />;
const PencilIco  = () => <Svg d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" size={14} />;
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
  if (["int","integer","float","double","decimal","numeric"].includes(n)) return "number";
  if (!["text","number","boolean"].includes(n)) return "number";
  return n;
};

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
function fmtEntryStamp(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isSameDay(d, new Date())) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function usesBooleanLogging(datatype) {
  return normalizeDatatype(datatype) === "boolean";
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function HealthGoals() {
  const [activeGoals, setActiveGoals]     = useState([]);
  const [templates, setTemplates]         = useState([]);
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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [logModalGoal, setLogModalGoal]   = useState(null); // goal being logged via modal
  const [goalOrder, setGoalOrder]         = useState(() => {
    try { return JSON.parse(localStorage.getItem("hdb-goal-order") || "[]"); }
    catch { return []; }
  });
  const [draggedId, setDraggedId]         = useState(null);
  const [dragOverId, setDragOverId]       = useState(null);

  const MAX_GOALS = 10;
  const isAtLimit = activeGoals.length >= MAX_GOALS;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsData, templatesData, tsData] = await Promise.all([
        api.listParticipantGoals().catch(() => []),
        api.browseGoalTemplates().catch(() => []),
        api.getMyHealthTimeseries().catch(() => []),
      ]);
      const goals = Array.isArray(goalsData) ? goalsData : [];
      setActiveGoals(goals);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setTimeseries(Array.isArray(tsData) ? tsData : []);
      // Sync order: keep custom positions, append new goals, drop deleted ones
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
  };

  useEffect(() => { fetchData(); }, []);

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
  timeseries.forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

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
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Active</span>
            <span className={`text-sm font-bold ${isAtLimit ? "text-rose-500" : "text-slate-800"}`}>
              {activeGoals.length} / {MAX_GOALS}
            </span>
          </div>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <PlusIco /> Browse Goals
          </button>
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
        <div className="flex gap-4 min-h-[520px]">

          {/* Sidebar */}
          <div className="w-48 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Goals</p>
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
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsDrawerOpen(false)} />
      )}
      <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col rounded-l-2xl border-l border-slate-200 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-6 py-5 flex items-center justify-between bg-white rounded-tl-2xl border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Goal Library</h2>
            <p className="text-sm text-slate-500 mt-0.5">Select habits to track</p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="w-8 h-8 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full flex items-center justify-center transition-all"
          >
            <CloseIco size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isAtLimit && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2">
              <AlertIco size={14} className="mt-0.5 shrink-0" />
              <p>Dashboard full (10/10). Remove a goal to make room for a new one.</p>
            </div>
          )}

          {templates.length === 0 ? (
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
              const selectedWindow = customWindows[tId] ?? "daily";
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
                    <p className="text-xs text-blue-600 font-semibold">
                      Default target: {target}{unit ? ` ${unit}` : ""}
                    </p>
                    {datatype === "number" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Your Target
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
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
                    disabled={isAlreadyAdded || isAtLimit || isLoading}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isAlreadyAdded
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : isAtLimit
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
                    }`}
                  >
                    {isLoading ? "Adding..." : isAlreadyAdded ? "✓ Added" : "+ Add Goal"}
                  </button>
                </div>
              );
            })
          )}
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

  const pct = Math.min(100, Math.max(0, target > 0
    ? direction === "at_most"
      ? current <= target ? 100 : Math.round((target / current) * 100)
      : Math.round((current / target) * 100)
    : 0));

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
    : `This ${windowType} window (${windowEntries.length})`;

  // Tags
  const windowTag   = { daily: "Daily goal", weekly: "Weekly goal", monthly: "Monthly goal" }[windowType] ?? `${windowType} goal`;
  const directionTag = direction === "at_most"
    ? `Stay under ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`
    : `Reach ${Number(target).toLocaleString()}${unit ? " " + unit : ""}`;
  const statusTag   = done ? "Done ✓" : "In progress";
  const tags        = [windowTag, directionTag, statusTag];
  const tagColors   = {
    "Done ✓":      "bg-emerald-50 text-emerald-600 border-emerald-100",
    "In progress": "bg-blue-50 text-blue-600 border-blue-100",
  };

  const contextNote = progressMode === "incremental"
    ? windowType === "daily"
      ? "Each log counts toward your daily total and resets at midnight."
      : `Each log counts toward your ${windowType} total.`
    : "Your most recent log is used as your current progress value.";

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 leading-tight truncate">{name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Today, {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {windowType === "daily" ? " · resets midnight" : ""}
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
            <button
              onClick={onLogEntry}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all"
            >
              <PencilIco /> Log entry
            </button>
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
            <p className="text-xs text-slate-400 mt-1">of {Number(target).toLocaleString()} {unit} target</p>
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
              const barPct  = barMax > 0 ? (total / barMax) * 100 : 0;
              const metTarget = total >= target;
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
          <p>{contextNote}</p>
        </div>

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
  const isNumericGoal = datatype === "number";

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

          {/* Input area */}
          <div className="space-y-2">
            {datatype === "text" && (
              <input
                type="text"
                autoFocus
                placeholder="Write your entry..."
                value={inputVal}
                onChange={(e) => setVal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
              />
            )}
            {isNumericGoal && (
              <div className="flex gap-2">
                <input
                  type="number"
                  autoFocus
                  min="0"
                  placeholder={progressMode === "absolute" ? `Current value${unit ? ` (${unit})` : ""}` : `Add amount${unit ? ` (${unit})` : ""}`}
                  value={inputVal}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                />
              </div>
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
                disabled={isLogging}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLogging ? "Saving…" : "No"}
              </button>
              <button
                onClick={() => submit(true)}
                disabled={isLogging}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLogging ? "Saving…" : "Yes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => submit(inputVal)}
              disabled={isLogging || inputVal === ""}
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

import { useState, useEffect } from "react";
import { api } from "../../services/api";

/* ── SVG Helpers (Clean & Beautiful) ── */
const Svg = ({
  d,
  size = 20,
  sw = 1.8,
  stroke = "currentColor",
  fill = "none",
  ...rest
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
    {...rest}
  >
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const PlusIco = () => <Svg d="M12 5v14M5 12h14" size={18} />;
const TrashIco = () => (
  <Svg
    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
    size={16}
  />
);
const TargetIco = () => (
  <Svg
    d={
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    }
  />
);
const CloseIco = () => <Svg d="M18 6L6 18M6 6l12 12" size={20} />;
const CheckIco = () => (
  <Svg stroke="#10b981" sw={2.5} d="M20 6L9 17l-5-5" size={18} />
);
const FireIco = () => (
  <Svg d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
);
const AlertIco = () => (
  <Svg
    size={16}
    d={
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    }
  />
);

const normalizeDatatype = (rawType) => {
  const normalized = String(rawType || "number").trim().toLowerCase();
  if (normalized === "string") return "text";
  if (normalized === "bool") return "boolean";
  if (
    normalized === "int" ||
    normalized === "integer" ||
    normalized === "float" ||
    normalized === "double" ||
    normalized === "decimal" ||
    normalized === "numeric"
  ) {
    return "number";
  }
  if (normalized !== "text" && normalized !== "number" && normalized !== "boolean") {
    return "number";
  }
  return normalized;
};

export default function HealthGoals() {
  const [activeGoals, setActiveGoals] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // 🟢 NEW: State to hold the dynamic input values for each card
  const [logInputs, setLogInputs] = useState({});

  const MAX_GOALS = 10;
  const isAtLimit = activeGoals.length >= MAX_GOALS;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsData, templatesData] = await Promise.all([
        api.listParticipantGoals().catch(() => []),
        api.browseGoalTemplates().catch(() => []),
      ]);
      setActiveGoals(Array.isArray(goalsData) ? goalsData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    } catch (err) {
      console.error("🚨 Error fetching goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddGoal = async (templateId) => {
    if (isAtLimit) return;
    try {
      setActionLoading(templateId);
      await api.addGoalFromTemplate(templateId);
      await fetchData();
    } catch (err) {
      console.error("Failed to add goal:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // 🟢 UPDATED: Dynamically handle numbers, text, or booleans
  const handleLogProgress = async (goalId, customValue = 1) => {
    if (customValue === "" || customValue === null) return;

    try {
      setActionLoading(`log_${goalId}`);

      // Parse numbers if needed, otherwise send text directly
      let finalValue = customValue;
      if (
        typeof customValue === "string" &&
        customValue.trim() !== "" &&
        !isNaN(customValue)
      ) {
        finalValue = Number(customValue);
      }

      const payload = { observed_at: new Date().toISOString() };
      if (typeof finalValue === "string") payload.value_text = finalValue;
      else if (typeof finalValue === "boolean") payload.value_bool = finalValue;
      else payload.value_number = Number(finalValue);

      await api.logGoalProgress(goalId, payload);

      // Clear the input field for this specific goal
      setLogInputs((prev) => ({ ...prev, [goalId]: "" }));
      await fetchData();
    } catch (err) {
      console.error("Failed to log progress:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Remove this goal from your dashboard?")) return;
    try {
      setActionLoading(`del_${goalId}`);
      await api.deleteParticipantGoal(goalId);
      await fetchData();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && activeGoals.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-40">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500 font-medium">
          Loading your health goals...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Goals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your daily wellness habits.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Active Goals
            </span>
            <span
              className={`text-sm font-bold ${isAtLimit ? "text-rose-500" : "text-slate-800"}`}
            >
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

      {activeGoals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <TargetIco size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            Ready to build healthy habits?
          </h3>
          <p className="text-sm text-slate-500 mt-2 mb-6 max-w-sm mx-auto leading-relaxed">
            Your dashboard is empty. Browse the goal library to find habits
            recommended for you.
          </p>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            Explore Library
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeGoals.map((goal) => {
            const activeGoalId = goal.goal_id || goal.id;
            const name =
              goal.name ||
              goal.title ||
              (goal.element && goal.element.label) ||
              "Wellness Goal";
            const desc =
              goal.description ||
              (goal.element && goal.element.description) ||
              "Description not provided.";

            // 🟢 Determine Datatype from the Element (defaults to number if missing)
            const datatype = normalizeDatatype(goal.element?.datatype);
            const progressMode = goal.progress_mode || "incremental";
            const goalMode = goal.goal_mode || "daily";
            const direction = goal.direction || "at_least";
            const windowMode =
              goal.completion_context?.window || goal.window || "daily";

            const target = goal.target_value ?? goal.default_target ?? 1;
            const current = goal.current_value ?? 0;
            const unit = goal.unit || (goal.element && goal.element.unit) || "";
            const unitText = unit ? ` ${unit}` : "";

            // Text goals don't use percentages, they just save entries
            const isTextGoal = datatype === "text";
            const numericCurrent =
              typeof current === "number" ? current : Number(current);
            const safeCurrent = Number.isFinite(numericCurrent)
              ? numericCurrent
              : 0;
            const progressPct = isTextGoal
              ? 100
              : direction === "at_most"
                ? safeCurrent > 0 && target > 0
                  ? Math.min(Math.round((target / safeCurrent) * 100), 100)
                  : 0
                : target > 0
                  ? Math.min(Math.round((safeCurrent / target) * 100), 100)
                  : 0;
            const isCompleted = Boolean(goal.is_completed);

            return (
              <div
                key={activeGoalId}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col relative group transition-all hover:shadow-md hover:border-blue-200"
              >
                <button
                  onClick={() => handleDeleteGoal(activeGoalId)}
                  disabled={actionLoading === `del_${activeGoalId}`}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove Goal"
                >
                  <TrashIco />
                </button>

                <div className="flex items-start gap-4 mb-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {isCompleted ? (
                      <FireIco size={24} />
                    ) : (
                      <TargetIco size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight mb-1 pr-6 capitalize">
                      {name}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {goalMode === "long_term" ? "Long-Term" : "Daily"} Goal •{" "}
                      {windowMode}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-500 line-clamp-2 mb-6 min-h-[2.5rem]">
                  {desc}
                </p>

                {/* Status Section based on Datatype */}
                <div className="mt-auto mb-5">
                  {!isTextGoal && (
                    <>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Progress
                        </span>
                        <span
                          className={`text-sm font-bold ${isCompleted ? "text-emerald-500" : "text-slate-800"}`}
                        >
                          {safeCurrent}{" "}
                          <span className="text-slate-400 font-medium">
                            {direction === "at_most" ? "≤" : "/"} {target}
                            {unitText}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${isCompleted ? "bg-emerald-500" : "bg-blue-500"}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </>
                  )}
                  {isTextGoal && (
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Journal Entry
                    </div>
                  )}
                </div>

                {/* 🟢 DYNAMIC LOGGING UI ── */}
                {isCompleted && !isTextGoal ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-600 cursor-default border border-emerald-100 flex items-center justify-center gap-2"
                  >
                    <CheckIco size={16} /> Completed Today
                  </button>
                ) : (
                  <div className="flex gap-2">
                    {/* UI for Text input */}
                    {datatype === "text" && (
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          type="text"
                          placeholder="Write your entry..."
                          value={logInputs[activeGoalId] || ""}
                          onChange={(e) =>
                            setLogInputs({
                              ...logInputs,
                              [activeGoalId]: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() =>
                            handleLogProgress(
                              activeGoalId,
                              logInputs[activeGoalId],
                            )
                          }
                          disabled={
                            actionLoading === `log_${activeGoalId}` ||
                            !logInputs[activeGoalId]
                          }
                          className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                        >
                          {actionLoading === `log_${activeGoalId}`
                            ? "Saving..."
                            : "Save Entry"}
                        </button>
                      </div>
                    )}

                    {/* UI for Large Numbers (e.g. 2000ml) */}
                    {datatype === "number" && progressMode === "absolute" && (
                      <>
                        <input
                          type="number"
                          placeholder={`Current value`}
                          value={logInputs[activeGoalId] || ""}
                          onChange={(e) =>
                            setLogInputs({
                              ...logInputs,
                              [activeGoalId]: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() =>
                            handleLogProgress(
                              activeGoalId,
                              logInputs[activeGoalId],
                            )
                          }
                          disabled={
                            actionLoading === `log_${activeGoalId}` ||
                            !logInputs[activeGoalId]
                          }
                          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                        >
                          {actionLoading === `log_${activeGoalId}`
                            ? "..."
                            : "Set Value"}
                        </button>
                      </>
                    )}

                    {datatype === "number" &&
                      progressMode !== "absolute" &&
                      target > 10 && (
                      <>
                        <input
                          type="number"
                          placeholder={`Amount`}
                          value={logInputs[activeGoalId] || ""}
                          onChange={(e) =>
                            setLogInputs({
                              ...logInputs,
                              [activeGoalId]: e.target.value,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() =>
                            handleLogProgress(
                              activeGoalId,
                              logInputs[activeGoalId],
                            )
                          }
                          disabled={
                            actionLoading === `log_${activeGoalId}` ||
                            !logInputs[activeGoalId]
                          }
                          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                        >
                          {actionLoading === `log_${activeGoalId}`
                            ? "..."
                            : "Log"}
                        </button>
                      </>
                    )}

                    {/* UI for Small Numbers (e.g. 5 veggies) or Booleans */}
                    {(datatype === "boolean" ||
                      (datatype === "number" &&
                        progressMode !== "absolute" &&
                        target <= 10)) && (
                      <button
                        onClick={() => handleLogProgress(activeGoalId, 1)}
                        disabled={actionLoading === `log_${activeGoalId}`}
                        className="w-full py-2.5 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
                      >
                        {actionLoading === `log_${activeGoalId}`
                          ? "Logging..."
                          : `+1 Log Progress`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── DRAWER (Library) ────────────────────────────── */}

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col rounded-l-2xl border-l border-slate-200 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="px-6 py-5 flex items-center justify-between bg-white rounded-tl-2xl border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Goal Library</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select habits to track
            </p>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="w-8 h-8 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full flex items-center justify-center transition-all"
          >
            <CloseIco size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {isAtLimit && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2 mb-4">
              <span className="mt-0.5">
                <AlertIco size={14} />
              </span>
              <p>
                Dashboard full (10/10). Remove a goal to make room for a new
                one.
              </p>
            </div>
          )}

          {templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-slate-500">No templates available.</p>
            </div>
          ) : (
            templates.map((template) => {
              const tId = template.template_id;
              const name =
                template.name ||
                (template.element && template.element.label) ||
                "Wellness Goal";
              const desc =
                template.description ||
                (template.element && template.element.description) ||
                "Description not provided.";
              const datatype = normalizeDatatype(template.element?.datatype);
              const target = template.default_target ?? 1;
              const unit = (template.element && template.element.unit) || "";
              const unitText = unit ? ` ${unit}` : "";

              const isAlreadyAdded = activeGoals.some(
                (g) => g.template_id === tId,
              );
              const isLoading = actionLoading === tId;

              return (
                <div
                  key={tId}
                  className={`bg-white border rounded-xl p-5 transition-all ${
                    isAlreadyAdded
                      ? "border-slate-100 opacity-60"
                      : "border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-bold text-slate-800 leading-tight pr-2 capitalize">
                      {name}
                    </h4>
                    <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap border border-slate-100">
                      Daily
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mb-5 line-clamp-2">
                    {desc}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-xs font-medium text-slate-500">
                      {datatype === "text" ? (
                        "Text Entry"
                      ) : (
                        <>
                          Target:{" "}
                          <span className="text-slate-800 font-bold">
                            {target}
                            {unitText}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddGoal(tId)}
                      disabled={isAtLimit || isAlreadyAdded || isLoading}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        isAlreadyAdded
                          ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100"
                          : isAtLimit
                            ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                      }`}
                    >
                      {isLoading
                        ? "Adding..."
                        : isAlreadyAdded
                          ? "Tracking"
                          : "+ Add Goal"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

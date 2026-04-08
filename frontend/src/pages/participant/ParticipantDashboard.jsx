import { Link, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { PieChart, Pie, Cell } from "recharts";

const DonutRing = ({ filled, total, color, label, sublabel, children }) => {
  const remaining = Math.max(0, total - filled);
  const isEmpty = total === 0;
  const data = isEmpty ? [{ value: 1 }] : [{ value: filled }, { value: remaining }];
  const ringColors = isEmpty ? ["#e2e8f0"] : [color, "#e2e8f0"];
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative w-44 h-44">
        <PieChart width={176} height={176}>
          <Pie
            data={data}
            cx={84}
            cy={84}
            innerRadius={58}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={3}
            stroke="#f8fafc"
            animationDuration={900}
          >
            {ringColors.map((c, i) => <Cell key={i} fill={c} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-black text-slate-800 leading-none">
            {pct}<span className="text-lg font-medium text-slate-400">%</span>
          </span>
          <span className="text-sm text-slate-500 mt-1 font-semibold">{filled} / {total}</span>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <p className="text-xs text-slate-400">{sublabel}</p>
      {children && <div className="mt-1 w-full">{children}</div>}
    </div>
  );
};

export default function ParticipantDashboard() {
  // For now we are setting up our use mock data here :

  const { user } = useOutletContext();

  const [surveys, setSurveys] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [surveyData, goalsData] = await Promise.all([
          api.getAssignedSurveys(),
          api.listParticipantGoals().catch(() => []),
        ]);

        setSurveys(surveyData || []);
        setGoals(Array.isArray(goalsData) ? goalsData : []);
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Weather — Open-Meteo (free, no API key), falls back to time-of-day if denied
  useEffect(() => {
    const WMO_MAP = {
      0:  { icon: "☀️",  label: "Clear sky",       color: "text-amber-500" },
      1:  { icon: "🌤️", label: "Mainly clear",     color: "text-amber-400" },
      2:  { icon: "⛅",  label: "Partly cloudy",    color: "text-slate-400" },
      3:  { icon: "☁️",  label: "Overcast",         color: "text-slate-400" },
      45: { icon: "🌫️", label: "Foggy",            color: "text-slate-400" },
      48: { icon: "🌫️", label: "Foggy",            color: "text-slate-400" },
      51: { icon: "🌦️", label: "Light drizzle",    color: "text-sky-400"   },
      61: { icon: "🌧️", label: "Rain",             color: "text-sky-500"   },
      71: { icon: "❄️",  label: "Snow",             color: "text-sky-300"   },
      80: { icon: "🌦️", label: "Showers",          color: "text-sky-400"   },
      95: { icon: "⛈️",  label: "Thunderstorm",     color: "text-slate-600" },
    };

    const getTimeBasedWeather = () => {
      const h = new Date().getHours();
      if (h < 6)  return { icon: "🌙", label: "Night",     color: "text-slate-500", temp: null };
      if (h < 12) return { icon: "☀️", label: "Morning",   color: "text-amber-500", temp: null };
      if (h < 17) return { icon: "🌤️", label: "Afternoon", color: "text-amber-400", temp: null };
      if (h < 20) return { icon: "🌇", label: "Evening",   color: "text-orange-400", temp: null };
      return              { icon: "🌙", label: "Night",     color: "text-slate-500", temp: null };
    };

    if (!navigator.geolocation) {
      setWeather(getTimeBasedWeather());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current_weather=true`
          );
          const data = await res.json();
          const code = data.current_weather?.weathercode;
          const temp = Math.round(data.current_weather?.temperature);
          const match = WMO_MAP[code] ?? (typeof code === "number" ? WMO_MAP[Math.floor(code / 10) * 10] : undefined) ?? getTimeBasedWeather();
          setWeather({ ...match, temp });
        } catch {
          setWeather(getTimeBasedWeather());
        }
      },
      () => setWeather(getTimeBasedWeather())
    );
  }, []);

  // Current Date:
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // greetings on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: "☀️" };
    if (hour < 18) return { text: "Good afternoon", icon: "🌤️" };
    return { text: "Good evening", icon: "🌙" };
  };

  const greetings = getGreeting();

  // Per-status breakdown from the rich survey data we already fetch
  const completedSurveys = surveys.filter((s) => s.status === "COMPLETED").length;
  const inProgressSurveys = surveys.filter((s) => s.status === "IN_PROGRESS").length;
  const newSurveys = surveys.filter((s) => s.status === "NEW").length;
  const totalSurveys = surveys.length;

  // Goal counts derived from individual goal statuses (accurate for incremental + direction goals)
  const activeGoalsCount = goals.length;
  const goalsMetCount = goals.filter((g) => g.is_completed).length;
  const goalsRemainingCount = activeGoalsCount - goalsMetCount;

  // Daily success card: total assigned surveys vs goals
  const todaySurveyTarget = totalSurveys;
  const totalTarget = todaySurveyTarget + activeGoalsCount;
  const totalDone = completedSurveys + goalsMetCount;
  const dailyPercent =
    totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
  const tasksLeft = totalTarget - totalDone;

  // Daily Success — contextual status label based on progress
  const getDailyStatus = () => {
    if (totalTarget === 0) return null;
    if (dailyPercent === 100) return { label: "All done!", color: "text-emerald-600" };
    if (dailyPercent >= 75) return { label: "Almost there!", color: "text-blue-500" };
    if (dailyPercent >= 50) return { label: "Halfway there", color: "text-amber-500" };
    if (dailyPercent > 0) return { label: "Just getting started", color: "text-slate-500" };
    return { label: "Ready to begin?", color: "text-slate-400" };
  };
  const dailyStatus = getDailyStatus();

  // Health tip pill — survey nudge overrides time-based tip
  const getHealthTip = () => {
    const pendingCount = newSurveys + inProgressSurveys;
    if (!loading && pendingCount > 0) {
      return {
        icon: "📋",
        text: pendingCount === 1
          ? "You have 1 survey to complete today"
          : `You have ${pendingCount} surveys to complete today`,
        color: "bg-amber-50 text-amber-700",
      };
    }
    if (!loading && pendingCount === 0 && totalSurveys > 0) {
      return { icon: "🌿", text: "All surveys done — enjoy your day", color: "bg-teal-50 text-teal-600" };
    }
    const hour = new Date().getHours();
    if (hour < 10) return { icon: "💧", text: "Start your day with a glass of water", color: "bg-blue-50 text-blue-700" };
    if (hour < 12) return { icon: "🧘", text: "A short stretch can boost your focus", color: "bg-blue-50 text-blue-700" };
    if (hour < 15) return { icon: "🚶", text: "Take a short walk to refresh your mind", color: "bg-blue-50 text-blue-700" };
    if (hour < 18) return { icon: "💧", text: "Stay hydrated — drink some water", color: "bg-blue-50 text-blue-700" };
    if (hour < 21) return { icon: "🍽️", text: "Eat a balanced dinner for recovery", color: "bg-blue-50 text-blue-700" };
    return { icon: "🌙", text: "Wind down — avoid screens before bed", color: "bg-slate-50 text-slate-600" };
  };
  const healthTip = getHealthTip();

  // Keyword-based survey icon — scans title for health topic keywords
  const getSurveyIcon = (title = "") => {
    const t = title.toLowerCase();
    if (/blood|pressure|heart|cardiac|pulse/.test(t))  return "❤️";
    if (/food|diet|nutrition|meal|eating|calor/.test(t)) return "🥗";
    if (/stress|mental|anxiety|mood|psych/.test(t))     return "🧠";
    if (/sleep|rest|insomnia|fatigue/.test(t))          return "😴";
    if (/exercise|fitness|steps|walk|activ|sport/.test(t)) return "🏃";
    if (/water|hydrat|fluid/.test(t))                   return "💧";
    if (/weight|bmi|body/.test(t))                      return "⚖️";
    if (/pain|discomfort|symptom/.test(t))              return "🩺";
    if (/medic|drug|prescription/.test(t))              return "💊";
    if (/breath|lung|respiratory/.test(t))              return "🫁";
    return "📋";
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0 bg-slate-50 min-h-screen">
      {/* STEP 1: TOP WELCOME BANNER */}
      <div className="bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Left Side: Greeting & Pill */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            {greetings.text}, {user?.first_name || "there"}! {greetings.icon}
          </h1>

          {/* Dynamic Health Tip Pill */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-500 ${healthTip.color}`}>
            <span>{healthTip.icon}</span>
            {healthTip.text}
          </div>
        </div>

        {/* Right Side: Weather & Date */}
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 w-full md:w-auto">
          <div className={`text-4xl leading-none ${weather?.color ?? "text-slate-300"}`}>
            {weather ? weather.icon : "…"}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              {weather ? weather.label : "Loading…"}
              {weather?.temp != null && (
                <span className="ml-1.5 text-slate-700 font-semibold">{weather.temp}°C</span>
              )}
            </p>
            <p className="text-lg font-bold text-slate-800">{todayFormatted}</p>
          </div>
        </div>
      </div>

      {/* STEP 2: HEALTH OVERVIEW & PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Overview — Donut Rings */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-md shadow-slate-100 border border-slate-100 flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Daily Activity</h2>
            <p className="text-sm text-slate-400 mt-1">Today's progress at a glance</p>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-around gap-10 py-4">
            {loading ? (
              <div className="flex gap-10 w-full justify-around">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-44 h-44 rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-44 h-44 rounded-full bg-slate-100 animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded-full animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                {/* Survey ring — uses full assigned list for a stable denominator */}
                <DonutRing
                  filled={completedSurveys}
                  total={totalSurveys}
                  color="#7dd3fc"
                  label="Assigned Surveys"
                  sublabel="completed overall"
                >
                  <div className="flex justify-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-sky-300" />
                      {completedSurveys} Done
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-300" />
                      {inProgressSurveys} In Progress
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                      {newSurveys} New
                    </span>
                  </div>
                </DonutRing>

                <div className="hidden sm:block h-32 w-px bg-slate-100" />
                <div className="block sm:hidden w-32 h-px bg-slate-100" />

                {/* Goals ring — today's target vs met */}
                <DonutRing
                  filled={goalsMetCount}
                  total={activeGoalsCount}
                  color="#86efac"
                  label="Health Goals"
                  sublabel="met today"
                >
                  <div className="flex justify-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-300" />
                      {goalsMetCount} Met
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
                      {goalsRemainingCount} Remaining
                    </span>
                  </div>
                </DonutRing>
              </>
            )}
          </div>
        </div>

        {/* Daily Success Card */}
        <div className={`rounded-2xl p-6 shadow-md border flex flex-col justify-between h-full transition-colors duration-500 ${!loading && totalTarget === 0 ? "bg-emerald-50 border-emerald-100 shadow-emerald-100" : "bg-white border-slate-100 shadow-slate-100"}`}>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Today's Progress</p>
            <h2 className="text-lg font-bold text-slate-800 mt-0.5">Daily Success</h2>
          </div>

          {loading ? (
            <div className="my-6 space-y-4">
              <div className="h-12 w-24 bg-slate-100 rounded-xl animate-pulse mx-auto" />
              <div className="h-3 w-40 bg-slate-100 rounded-full animate-pulse mx-auto" />
              <div className="h-3 w-32 bg-slate-100 rounded-full animate-pulse mx-auto" />
            </div>
          ) : totalTarget === 0 ? (
            /* REST DAY / ALL CAUGHT UP EMPTY STATE */
            <div className="my-6 text-center space-y-3">
              <p className="text-2xl font-black text-emerald-600 tracking-tight">
                You're all caught up!
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                No surveys or goals assigned for today.
                <br />
                Enjoy your day off! 🌿
              </p>
            </div>
          ) : (
            <div className="my-6 text-center space-y-2">
              {/* Contextual status label */}
              <p className={`text-xs font-bold uppercase tracking-widest ${dailyStatus?.color}`}>
                {dailyStatus?.label}
              </p>
              {/* Big percentage */}
              <div>
                <span className="text-6xl font-black text-slate-800 tracking-tighter">
                  {dailyPercent}
                </span>
                <span className="text-2xl text-slate-400 ml-1">%</span>
              </div>
              {/* Survey / Goal split pills */}
              <div className="flex justify-center gap-3 pt-1">
                <span className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-sky-100">
                  📋 {completedSurveys} / {todaySurveyTarget} surveys
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-100">
                  🎯 {goalsMetCount} / {activeGoalsCount} goals
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-slate-100">
            {loading ? (
              <div className="w-full bg-slate-100 h-2 rounded-full animate-pulse" />
            ) : totalTarget === 0 ? (
              /* Full green bar for rest day */
              <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full w-full rounded-full shadow-sm" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400 font-medium px-0.5">
                  <span>{totalDone} done</span>
                  <span>{tasksLeft} left</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${dailyPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* STEP 3: SURVEY TEMPLATES CAROUSEL */}
      <div className="bg-slate-800 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        {/* Section Header & Arrow Buttons */}
        <div className="flex justify-between items-end mb-6 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-white">
              Daily Health Surveys
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Select a template to log your data for today.
            </p>
          </div>

        </div>
        {/* Horizontal Scroll Container */}
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x relative z-10 custom-scrollbar">
          {loading ? (
            <p className="text-white animate-pulse">
              Checking for assigned surveys... 🔍
            </p>
          ) : surveys && surveys.length > 0 ? ( // 👈 Use 'surveys' here
            surveys.map((survey) => (
              <div
                key={survey.form_id}
                className="min-w-[260px] bg-white rounded-xl p-5 shadow-sm snap-start flex flex-col border border-slate-100"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-4 text-xl">
                  {getSurveyIcon(survey.title)}
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {survey.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-6 flex-1 line-clamp-2">
                  {survey.description || "Daily health tracking survey."}
                </p>
                {survey.status === "COMPLETED" ? (
                  <Link
                    to={`/participant/surveys/${survey.form_id}`}
                    className="w-full text-center bg-sky-400 hover:bg-sky-500 text-white py-2 rounded-lg font-bold transition-colors shadow-sm block"
                  >
                    View Entry
                  </Link>
                ) : (
                  <Link
                    to={`/participant/surveys/${survey.form_id}`}
                    className="w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-2 rounded-lg font-bold transition-colors shadow-sm block"
                  >
                    Start Entry
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="min-w-[260px] w-full bg-white/10 rounded-xl p-8 text-center border border-white/20 backdrop-blur-sm">
              <span className="text-4xl mb-3 block">🎉</span>
              <h3 className="text-xl font-bold text-white">
                You're all caught up!
              </h3>
              <p className="text-slate-400 mt-2">
                No surveys assigned today. Enjoy your day off!
              </p>
            </div>
          )}
        </div>{" "}
      </div>
    </div>
  );
}

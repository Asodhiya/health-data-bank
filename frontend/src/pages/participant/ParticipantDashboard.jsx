import { Link, useOutletContext } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { usePolling } from "../../hooks/usePolling";
import { api } from "../../services/api";
import { PieChart, Pie } from "recharts";
import MedicalCrossIcon from "../../components/MedicalCrossIcon";
import GuideTooltip from "../../components/GuideTooltip";

const DonutRing = ({ filled, total, color, label, sublabel, children }) => {
  const remaining = Math.max(0, total - filled);
  const isEmpty = total === 0;
  const data = isEmpty
    ? [{ value: 1, fill: "#DBEAFE" }]
    : [{ value: filled, fill: color }, { value: remaining, fill: "#DBEAFE" }];
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
            stroke="#F8FAFC"
            animationDuration={900}
          />
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-black leading-none" style={{ color: "#1E3A8A" }}>
            {pct}<span className="text-lg font-medium" style={{ color: "#3B82F6" }}>%</span>
          </span>
          <span className="text-sm mt-1 font-semibold" style={{ color: "#3B82F6" }}>{filled} / {total}</span>
        </div>
      </div>
      <p className="text-sm font-bold" style={{ color: "#1E3A8A" }}>{label}</p>
      <p className="text-xs" style={{ color: "#3B82F6" }}>{sublabel}</p>
      {children && <div className="mt-1 w-full">{children}</div>}
    </div>
  );
};

export default function ParticipantDashboard() {
  const { user } = useOutletContext();

  const [surveys, setSurveys] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [careTeam, setCareTeam] = useState(null);

  const fetchDashboardData = useCallback(async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const [surveyData, goalsData, careTeamData] = await Promise.all([
        api.getAssignedSurveys(),
        api.listParticipantGoals().catch(() => []),
        api.participantGetCareTeam().catch(() => null),
      ]);
      setSurveys(surveyData || []);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setCareTeam(careTeamData);
    } catch (err) {
      console.error("Dashboard Sync Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchDashboardData, 30_000);

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

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: "☀️" };
    if (hour < 18) return { text: "Good afternoon", icon: "🌤️" };
    return { text: "Good evening", icon: "🌙" };
  };

  const greetings = getGreeting();

  const completedSurveys = surveys.filter((s) => s.status === "COMPLETED").length;
  const inProgressSurveys = surveys.filter((s) => s.status === "IN_PROGRESS").length;
  const newSurveys = surveys.filter((s) => s.status === "NEW").length;
  const totalSurveys = surveys.length;

  const activeGoalsCount = goals.length;
  const goalsMetCount = goals.filter((g) => g.is_completed).length;
  const goalsRemainingCount = activeGoalsCount - goalsMetCount;

  const todaySurveyTarget = totalSurveys;
  const totalTarget = todaySurveyTarget + activeGoalsCount;
  const totalDone = completedSurveys + goalsMetCount;
  const dailyPercent =
    totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
  const tasksLeft = totalTarget - totalDone;

  const getDailyStatus = () => {
    if (totalTarget === 0) return null;
    if (dailyPercent === 100) return { label: "All done!", color: "text-emerald-600" };
    if (dailyPercent >= 75) return { label: "Almost there!", color: "text-blue-500" };
    if (dailyPercent >= 50) return { label: "Halfway there", color: "text-amber-500" };
    if (dailyPercent > 0) return { label: "Just getting started", color: "text-slate-500" };
    return { label: "Ready to begin?", color: "text-slate-400" };
  };
  const dailyStatus = getDailyStatus();

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
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0 min-h-screen" style={{ background: "#F8FAFC" }}>
      {/* STEP 1: TOP WELCOME BANNER */}
      <div className="rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6" style={{ background: "#fff", border: "1px solid #DBEAFE", boxShadow: "0 4px 16px 0 #DBEAFE" }}>
        {/* Left: Greeting & tip */}
        <div className="space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#1E3A8A" }}>
            {greetings.text}, {user?.first_name || "there"}! {greetings.icon}
          </h1>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-500 ${healthTip.color}`}>
            <span>{healthTip.icon}</span>
            {healthTip.text}
          </div>
        </div>
        {/* Right: Weather & Date */}
        <div className="flex items-center gap-4 p-4 rounded-xl w-full md:w-auto" style={{ background: "#F8FAFC", border: "1px solid #DBEAFE" }}>
          <div className={`text-4xl leading-none ${weather?.color ?? "text-slate-300"}`}>
            {weather ? weather.icon : "…"}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "#3B82F6" }}>
              {weather ? weather.label : "Loading…"}
              {weather?.temp != null && <span className="ml-1.5 font-semibold" style={{ color: "#1E3A8A" }}>{weather.temp}°C</span>}
            </p>
            <p className="text-lg font-bold" style={{ color: "#1E3A8A" }}>{todayFormatted}</p>
          </div>
        </div>
      </div>

      {/* STEP 2: HEALTH OVERVIEW & PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Overview — Donut Rings */}
        <div className="lg:col-span-2 rounded-2xl p-6 shadow-md flex flex-col" style={{ background: "#fff", border: "1px solid #DBEAFE", boxShadow: "0 4px 16px 0 #DBEAFE" }}>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#1E3A8A" }}>Daily Activity</h2>
              <p className="text-sm mt-1" style={{ color: "#3B82F6" }}>Today's progress at a glance</p>
            </div>
            <GuideTooltip tip="These rings show how many surveys you've completed and how many health goals you've met today." position="left">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full cursor-default select-none" style={{ background: "#EFF6FF", color: "#3B82F6" }}>?</span>
            </GuideTooltip>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-around gap-10 py-4">
            {loading ? (
              <div className="flex gap-10 w-full justify-around">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-44 h-44 rounded-full animate-pulse" style={{ background: "#DBEAFE" }} />
                  <div className="h-3 w-24 rounded-full animate-pulse" style={{ background: "#DBEAFE" }} />
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-44 h-44 rounded-full animate-pulse" style={{ background: "#DBEAFE" }} />
                  <div className="h-3 w-24 rounded-full animate-pulse" style={{ background: "#DBEAFE" }} />
                </div>
              </div>
            ) : (
              <>
                <DonutRing
                  filled={completedSurveys}
                  total={totalSurveys}
                  color="#3B82F6"
                  label="Assigned Surveys"
                  sublabel="completed overall"
                >
                  <div className="flex justify-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1" style={{ color: "#3B82F6" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3B82F6" }} />
                      {completedSurveys} Done
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "#3B82F6" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#93C5FD" }} />
                      {inProgressSurveys} In Progress
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "#93C5FD" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#DBEAFE" }} />
                      {newSurveys} New
                    </span>
                  </div>
                </DonutRing>

                <div className="hidden sm:block h-32 w-px" style={{ background: "#DBEAFE" }} />
                <div className="block sm:hidden w-32 h-px" style={{ background: "#DBEAFE" }} />

                <DonutRing
                  filled={goalsMetCount}
                  total={activeGoalsCount}
                  color="#1E3A8A"
                  label="Health Goals"
                  sublabel="met today"
                >
                  <div className="flex justify-center gap-3 text-xs mt-1">
                    <span className="flex items-center gap-1" style={{ color: "#1E3A8A" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#1E3A8A" }} />
                      {goalsMetCount} Met
                    </span>
                    <span className="flex items-center gap-1" style={{ color: "#3B82F6" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#DBEAFE" }} />
                      {goalsRemainingCount} Remaining
                    </span>
                  </div>
                </DonutRing>
              </>
            )}
          </div>
        </div>

        {/* Daily Success Card */}
        <div className={`rounded-2xl p-6 shadow-md flex flex-col justify-between h-full transition-colors duration-500 ${!loading && totalTarget === 0 ? "bg-emerald-50 border-emerald-100" : ""}`}
          style={!loading && totalTarget === 0 ? {} : { background: "#fff", border: "1px solid #DBEAFE", boxShadow: "0 4px 16px 0 #DBEAFE" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#3B82F6" }}>Today's Progress</p>
              <h2 className="text-lg font-bold mt-0.5" style={{ color: "#1E3A8A" }}>Daily Success</h2>
            </div>
            <GuideTooltip tip="Your overall daily score — combines completed surveys and goals into one percentage." position="left">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full cursor-default select-none" style={{ background: "#EFF6FF", color: "#3B82F6" }}>?</span>
            </GuideTooltip>
          </div>

          {loading ? (
            <div className="my-6 space-y-4">
              <div className="h-12 w-24 rounded-xl animate-pulse mx-auto" style={{ background: "#DBEAFE" }} />
              <div className="h-3 w-40 rounded-full animate-pulse mx-auto" style={{ background: "#DBEAFE" }} />
              <div className="h-3 w-32 rounded-full animate-pulse mx-auto" style={{ background: "#DBEAFE" }} />
            </div>
          ) : totalTarget === 0 ? (
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
              <p className={`text-xs font-bold uppercase tracking-widest ${dailyStatus?.color}`}>
                {dailyStatus?.label}
              </p>
              <div>
                <span className="text-6xl font-black tracking-tighter" style={{ color: "#1E3A8A" }}>
                  {dailyPercent}
                </span>
                <span className="text-2xl ml-1" style={{ color: "#3B82F6" }}>%</span>
              </div>
              <div className="flex justify-center gap-3 pt-1">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: "#EFF6FF", color: "#1E3A8A", border: "1px solid #DBEAFE" }}>
                  📋 {completedSurveys} / {todaySurveyTarget} surveys
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-100">
                  🎯 {goalsMetCount} / {activeGoalsCount} goals
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6" style={{ borderTop: "1px solid #DBEAFE" }}>
            {loading ? (
              <div className="w-full h-2 rounded-full animate-pulse" style={{ background: "#DBEAFE" }} />
            ) : totalTarget === 0 ? (
              <div className="w-full bg-emerald-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full w-full rounded-full shadow-sm" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium px-0.5" style={{ color: "#3B82F6" }}>
                  <span>{totalDone} done</span>
                  <span>{tasksLeft} left</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#DBEAFE" }}>
                  <div
                    className="h-full transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${dailyPercent}%`, background: "linear-gradient(to right, #3B82F6, #1E3A8A)" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 2.5: CARE TEAM */}
      {careTeam?.groups?.length > 0 && (() => {
        const group = careTeam.groups[0];
        const caretaker = group.caretaker;
        return (
          <div className="rounded-2xl p-6 shadow-md" style={{ background: "#fff", border: "1px solid #DBEAFE", boxShadow: "0 4px 16px 0 #DBEAFE" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Group info */}
              <div className="flex items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 64 64" fill="none" className="shrink-0">
                  <defs>
                    <linearGradient id="ct-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                    <clipPath id="ct-clip">
                      <rect x="4" y="4" width="56" height="56" rx="14" />
                    </clipPath>
                  </defs>
                  <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#ct-bg)" />
                  <rect x="4" y="4" width="56" height="28" rx="14" fill="white" fillOpacity="0.08" />
                  <g clipPath="url(#ct-clip)">
                    <polyline points="4,30 14,30 18,18 23,40 27,24 31,33 34,28 38,28 42,30 60,30" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95" />
                  </g>
                  <line x1="12" y1="40" x2="52" y2="40" stroke="white" strokeWidth="0.75" strokeOpacity="0.3" />
                  <text x="32" y="54" textAnchor="middle" fontFamily="'Arial Black', Arial, sans-serif" fontWeight="900" fontSize="13" letterSpacing="1.5" fill="white" fillOpacity="0.97">HDB</text>
                </svg>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#3B82F6" }}>Your Group</p>
                  <p className="text-base font-bold leading-tight" style={{ color: "#1E3A8A" }}>{group.group_name}</p>
                  {group.group_description && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#3B82F6" }}>{group.group_description}</p>
                  )}
                </div>
              </div>

              {/* Caretaker */}
              {caretaker ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 sm:ml-auto" style={{ background: "#F8FAFC", border: "1px solid #DBEAFE" }}>
                  <MedicalCrossIcon size={36} />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest leading-none mb-0.5" style={{ color: "#3B82F6" }}>Care Lead</p>
                    <p className="text-sm font-bold leading-tight" style={{ color: "#1E3A8A" }}>{caretaker.name}</p>
                    {(caretaker.title || caretaker.specialty) && (
                      <p className="text-xs leading-tight mt-0.5" style={{ color: "#3B82F6" }}>
                        {[caretaker.title, caretaker.specialty].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 sm:ml-auto" style={{ background: "#F8FAFC", border: "1px solid #DBEAFE" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#DBEAFE", color: "#3B82F6" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: "#3B82F6" }}>No caretaker assigned yet</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* STEP 3: SURVEY TEMPLATES CAROUSEL */}
      <div className="rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden" style={{ background: "#1E3A8A" }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" style={{ background: "#3B82F6", opacity: 0.12 }} />
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h2 className="text-xl font-bold text-white">Daily Health Surveys</h2>
            <p className="text-sm mt-1" style={{ color: "#DBEAFE" }}>
              Select a template to log your data for today.
            </p>
          </div>
          <GuideTooltip tip="A quick way to fill in and view your daily health surveys assigned by your care team." position="left">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full cursor-default select-none mt-1" style={{ background: "rgba(219,234,254,0.15)", color: "#DBEAFE", border: "1px solid rgba(219,234,254,0.3)" }}>?</span>
          </GuideTooltip>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-4 snap-x relative z-10 custom-scrollbar">
          {loading ? (
            <p className="text-white animate-pulse">Checking for assigned surveys... 🔍</p>
          ) : surveys && surveys.length > 0 ? (
            surveys.map((survey) => (
              <div
                key={survey.form_id}
                className="min-w-[260px] rounded-xl p-5 shadow-sm snap-start flex flex-col"
                style={{ background: "#fff", border: "1px solid #DBEAFE" }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 text-xl" style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                  {getSurveyIcon(survey.title)}
                </div>
                <h3 className="text-lg font-bold" style={{ color: "#1E3A8A" }}>
                  {survey.title}
                </h3>
                <p className="text-sm mt-1 mb-6 flex-1 line-clamp-2" style={{ color: "#3B82F6" }}>
                  {survey.description || "Daily health tracking survey."}
                </p>
                {survey.status === "COMPLETED" ? (
                  <Link
                    to={`/participant/surveys/${survey.form_id}`}
                    className="w-full text-center py-2 rounded-lg font-bold transition-colors shadow-sm block text-white"
                    style={{ background: "#3B82F6" }}
                  >
                    View Entry
                  </Link>
                ) : (
                  <Link
                    to={`/participant/surveys/${survey.form_id}`}
                    className="w-full text-center py-2 rounded-lg font-bold transition-colors shadow-sm block text-white"
                    style={{ background: "#1E3A8A" }}
                  >
                    Start Entry
                  </Link>
                )}
              </div>
            ))
          ) : (
            <div className="min-w-[260px] w-full rounded-xl p-8 text-center backdrop-blur-sm" style={{ background: "rgba(219,234,254,0.12)", border: "1px solid rgba(219,234,254,0.25)" }}>
              <span className="text-4xl mb-3 block">🎉</span>
              <h3 className="text-xl font-bold text-white">You're all caught up!</h3>
              <p className="mt-2" style={{ color: "#DBEAFE" }}>No surveys assigned today. Enjoy your day off!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

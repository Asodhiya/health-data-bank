import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { useNavigate } from "react-router-dom";

export default function AdminInsightsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sysLoading, setSysLoading] = useState(true);

  const [sysStats, setSysStats] = useState(null);
  const [groups, setGroups] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [onboardingStats, setOnboardingStats] = useState(null);
  const [surveyStats, setSurveyStats] = useState(null);
  const [roleSummary, setRoleSummary] = useState([]);
  const [participantCountsByGroup, setParticipantCountsByGroup] = useState({});
  const [assigningGroupId, setAssigningGroupId] = useState(null);
  const [assignCaretakerSelection, setAssignCaretakerSelection] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setSysLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        api.adminGetSystemStats(),
        api.adminGetGroups(),
        api.adminGetCaretakers(),
        api.adminGetOnboardingStats(),
        api.adminGetSurveyStats(),
        api.adminGetRoleGroupStats(),
      ]);

      if (cancelled) return;

      const [
        systemStatsRes,
        groupsRes,
        caretakersRes,
        onboardingRes,
        surveyRes,
        roleGroupRes,
      ] = results;

      const failed = [];
      if (systemStatsRes.status === "fulfilled") setSysStats(systemStatsRes.value ?? null);
      else { setSysStats(null); failed.push("system stats"); }

      if (groupsRes.status === "fulfilled") setGroups(Array.isArray(groupsRes.value) ? groupsRes.value : []);
      else { setGroups([]); failed.push("groups"); }

      if (caretakersRes.status === "fulfilled") setCaretakers(Array.isArray(caretakersRes.value) ? caretakersRes.value : []);
      else { setCaretakers([]); failed.push("caretakers"); }

      if (onboardingRes.status === "fulfilled") setOnboardingStats(onboardingRes.value ?? null);
      else { setOnboardingStats(null); failed.push("onboarding"); }

      if (surveyRes.status === "fulfilled") setSurveyStats(surveyRes.value ?? null);
      else { setSurveyStats(null); failed.push("surveys"); }

      if (roleGroupRes.status === "fulfilled") {
        setRoleSummary(Array.isArray(roleGroupRes.value?.role_summary) ? roleGroupRes.value.role_summary : []);
        setParticipantCountsByGroup(roleGroupRes.value?.participant_counts_by_group || {});
      } else {
        setRoleSummary([]);
        setParticipantCountsByGroup({});
        failed.push("role health");
      }

      setError(failed.length ? `Could not fully load insights: ${failed.join(", ")}.` : null);
      setLoading(false);
      setSysLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const caretakerNameById = useMemo(() => {
    const map = {};
    caretakers.forEach((c) => {
      map[c.caretaker_id] = c.name;
    });
    return map;
  }, [caretakers]);

  const cpuPct = sysStats?.cpu_percent ?? 0;
  const cpuOffset = 125.6 * (1 - cpuPct / 100);
  const cpuNeedle = -70 + (cpuPct / 100) * 140;
  const cpuColor = cpuPct < 50 ? "#10b981" : cpuPct < 80 ? "#f59e0b" : "#ef4444";
  const cpuLabel = cpuPct < 50 ? "Healthy" : cpuPct < 80 ? "Moderate" : "High";

  const uptimeStr = sysStats?.uptime_formatted ?? "—";
  const uptimeSec = sysStats?.uptime_seconds ?? 0;
  const uptimePct = Math.min(100, (uptimeSec / (30 * 86400)) * 100);
  const uptimeOffset = 125.6 * (1 - uptimePct / 100);
  const uptimeNeedle = -70 + (uptimePct / 100) * 140;

  const groupsWithoutCaretaker = groups.filter((g) => !g.caretaker_id).length;
  const groupsWithoutParticipants = groups.filter((g) => !(participantCountsByGroup[g.group_id] || 0)).length;

  const handleAssignCaretakerQuick = async (groupId) => {
    const selectedUserId = assignCaretakerSelection[groupId];
    if (!selectedUserId) return;
    try {
      setAssigningGroupId(groupId);
      await api.adminAssignCaretaker(selectedUserId, groupId);
      const updated = await api.adminGetGroups();
      setGroups(Array.isArray(updated) ? updated : []);
    } catch (e) {
      console.error("Assign caretaker failed:", e);
    } finally {
      setAssigningGroupId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">System Insights</h1>
          <p className="text-sm text-slate-500 mt-1">Operational analytics and group-level health.</p>
        </div>
        <button onClick={() => navigate("/admin")} className="self-start sm:self-auto px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">Back to Dashboard</button>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Server Load</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible"><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" /><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={cpuColor} strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={cpuOffset} className="transition-all duration-700" /></svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 rounded-full transition-transform duration-700" style={{ transform: `translateX(-50%) rotate(${cpuNeedle}deg)` }}></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          {sysLoading ? (<p className="text-sm text-slate-400 mt-4 animate-pulse">Loading…</p>) : (<><p className="text-3xl font-extrabold mt-4" style={{ color: cpuColor }}>{cpuPct}%</p><p className="text-sm text-slate-500 font-medium">{cpuLabel}</p>{sysStats && (<p className="text-xs text-slate-400 mt-1">RAM: {sysStats.memory_used_gb}/{sysStats.memory_total_gb} GB ({sysStats.memory_percent}%)</p>)}</>)}
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Uptime</h3>
          <div className="relative w-32 h-16 mb-2 flex justify-center">
            <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible"><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" /><path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={uptimeOffset} className="transition-all duration-700" /></svg>
            <div className="absolute bottom-0 left-1/2 w-1 h-12 bg-slate-700 origin-bottom -translate-x-1/2 rounded-full transition-transform duration-700" style={{ transform: `translateX(-50%) rotate(${uptimeNeedle}deg)` }}></div>
            <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2"></div>
          </div>
          {sysLoading ? (<p className="text-sm text-slate-400 mt-4 animate-pulse">Loading…</p>) : (<><p className="text-3xl font-extrabold text-emerald-500 mt-4">{uptimeStr}</p><p className="text-sm text-slate-500 font-medium">System uptime</p>{sysStats && (<p className="text-xs text-slate-400 mt-1">Disk: {sysStats.disk_used_gb}/{sysStats.disk_total_gb} GB ({sysStats.disk_percent}%)</p>)}</>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">Onboarding Funnel</h2><span className="text-xs text-slate-400">Participants</span></div>{!onboardingStats ? (<p className="text-sm text-slate-400">{loading ? "Loading onboarding stats…" : "No onboarding data available."}</p>) : (<div className="space-y-3">{[["PENDING", onboardingStats.pending], ["BACKGROUND_READ", onboardingStats.background_read], ["CONSENT_GIVEN", onboardingStats.consent_given], ["INTAKE_SUBMITTED", onboardingStats.intake_submitted], ["COMPLETE", onboardingStats.complete]].map(([label, value]) => { const total = onboardingStats.total_participants || 1; const pct = Math.min(100, Math.round((value / total) * 100)); return (<div key={label}><div className="flex justify-between text-xs text-slate-500 mb-1"><span className="font-semibold">{label}</span><span>{value}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div></div>); })}</div>)}</div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">Survey Completion</h2><span className="text-xs text-slate-400">Daily participant fill-rate</span></div>{!surveyStats ? (<p className="text-sm text-slate-400">{loading ? "Loading survey stats…" : "No survey data available."}</p>) : (<><div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4"><div><p className="text-3xl font-extrabold text-indigo-600">{surveyStats.overall?.daily_completion_rate ?? 0}%</p><p className="text-sm text-slate-500">Today's completion rate</p></div><p className="text-xs text-slate-400">{surveyStats.overall?.completed_today ?? 0} / {surveyStats.overall?.expected_today ?? 0} expected submissions</p></div><p className="text-xs text-slate-500 mb-3">Fill frequency: <span className="font-semibold text-slate-700">{surveyStats.overall?.avg_daily_submissions_7d ?? 0}</span> avg submissions/day (last 7 days)</p><div className="space-y-2 max-h-40 overflow-auto pr-1">{(surveyStats.per_group || []).slice(0, 8).map((g) => (<div key={g.group_id} className="flex items-center justify-between text-sm"><span className="text-slate-600 truncate pr-2">{g.group_name}<span className="text-xs text-slate-400 ml-2">({g.completed_today}/{g.expected_today})</span></span><span className="font-semibold text-slate-800">{g.daily_completion_rate}%</span></div>))}{(surveyStats.per_group || []).length === 0 && <p className="text-sm text-slate-400">No active group deployments.</p>}</div></>)}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">Groups Overview</h2><button onClick={() => navigate("/users")} className="text-xs font-semibold text-blue-600 hover:text-blue-800">Manage</button></div>
          <div className="flex gap-2 mb-4"><span className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-600">No caretaker: {groupsWithoutCaretaker}</span><span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">No participants: {groupsWithoutParticipants}</span></div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">{groups.map((g) => (<div key={g.group_id} className="border border-slate-100 rounded-xl p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-700 truncate">{g.name}</p><span className="text-xs text-slate-400">{participantCountsByGroup[g.group_id] || 0} members</span></div><p className="text-xs text-slate-500 mt-1">Caretaker: {g.caretaker_id ? (caretakerNameById[g.caretaker_id] || "Assigned") : "Unassigned"}</p>{!g.caretaker_id && (<div className="mt-2 flex gap-2"><select value={assignCaretakerSelection[g.group_id] || ""} onChange={(e) => setAssignCaretakerSelection((prev) => ({ ...prev, [g.group_id]: e.target.value }))} className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50"><option value="">Select caretaker</option>{caretakers.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}</select><button onClick={() => handleAssignCaretakerQuick(g.group_id)} disabled={assigningGroupId === g.group_id || !assignCaretakerSelection[g.group_id]} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:bg-emerald-300">{assigningGroupId === g.group_id ? "Assigning…" : "Assign"}</button></div>)}</div>))}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-slate-800">User Role Health</h2><button onClick={() => navigate("/users")} className="text-xs font-semibold text-blue-600 hover:text-blue-800">View users</button></div>
          <div className="space-y-3">{roleSummary.map((r) => (<div key={r.role} className="border border-slate-100 rounded-xl p-3"><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700 capitalize">{r.role}s</span><span className="text-slate-500">{r.total}</span></div><div className="flex gap-3 text-xs mt-1"><span className="text-emerald-700">Active: {r.active}</span><span className="text-slate-500">Inactive: {r.inactive}</span></div></div>))}</div>
        </div>
      </div>
    </div>
  );
}

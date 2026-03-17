import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import NotificationsPanel from "../../components/NotificationsPanel";

// ─── Group Selector (shared pattern) ────────────────────────────────────────────

function GroupSelector({ groups, selectedGroupId, onChange, totalParticipants }) {
  const [open, setOpen] = useState(false);
  const selected = selectedGroupId === "all" ? null : groups.find(g => g.id === selectedGroupId);
  const label = selected ? selected.name : "All Groups";

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm w-full sm:w-auto">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <span className="truncate">{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-400 transition-transform ml-auto sm:ml-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-full mt-1.5 z-20 w-full sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <button onClick={() => { onChange("all"); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedGroupId === "all" ? "bg-blue-50" : "hover:bg-slate-50"}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedGroupId === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${selectedGroupId === "all" ? "text-blue-700" : "text-slate-700"}`}>All Groups</p>
              <p className="text-xs text-slate-400">{totalParticipants} participants across {groups.length} groups</p>
            </div>
            {selectedGroupId === "all" && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          </button>
          <div className="border-t border-slate-100" />
          {groups.map(g => {
            const isSelected = selectedGroupId === g.id;
            return (
              <button key={g.id} onClick={() => { onChange(g.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? "text-blue-700" : "text-slate-700"}`}>{g.name}</p>
                </div>
                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function daysSince(d) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

function getDotColor(status) {
  switch (status) {
    case "highly_active": return "bg-emerald-500";
    case "moderately_active": return "bg-blue-500";
    case "low_active": return "bg-amber-500";
    case "inactive": return "bg-slate-300";
    default: return "bg-slate-300";
  }
}

function getStatusLabel(status) {
  switch (status) {
    case "highly_active": return "Active";
    case "moderately_active": return "Moderately active";
    case "low_active": return "Low activity";
    case "inactive": return "Inactive";
    default: return status;
  }
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────

export default function CaretakerDashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [participants, setParticipants] = useState([]);
  const [activityCounts, setActivityCounts] = useState({ highly_active: 0, moderately_active: 0, low_active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupData, participantData] = await Promise.all([
        api.caretakerGetGroups().catch(() => []),
        api.caretakerListParticipants().catch(() => []),
      ]);

      const transformedGroups = Array.isArray(groupData)
        ? groupData.map(g => ({ id: g.group_id, name: g.name, description: g.description || "" }))
        : [];
      setGroups(transformedGroups);

      const pList = Array.isArray(participantData) ? participantData : [];
      setParticipants(pList);

      // Fetch activity counts
      try {
        const counts = await api.caretakerGetActivityCounts();
        setActivityCounts(counts);
      } catch {
        // Compute from participant list as fallback
        const counts = { highly_active: 0, moderately_active: 0, low_active: 0, inactive: 0 };
        pList.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
        setActivityCounts(counts);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived data based on selected group ──────────────────────────────────

  const filteredParticipants = useMemo(() => {
    if (selectedGroupId === "all") return participants;
    return participants.filter(p => p.group_id === selectedGroupId);
  }, [participants, selectedGroupId]);

  const filteredCounts = useMemo(() => {
    if (selectedGroupId === "all") return activityCounts;
    const counts = { highly_active: 0, moderately_active: 0, low_active: 0, inactive: 0 };
    filteredParticipants.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
    return counts;
  }, [filteredParticipants, activityCounts, selectedGroupId]);

  const totalMembers = filteredCounts.highly_active + filteredCounts.moderately_active + filteredCounts.low_active + filteredCounts.inactive;
  const activeCount = filteredCounts.highly_active + filteredCounts.moderately_active;
  const activePct = totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0;
  const inactivePct = totalMembers > 0 ? Math.round((filteredCounts.inactive / totalMembers) * 100) : 0;
  const lowPct = totalMembers > 0 ? Math.round((filteredCounts.low_active / totalMembers) * 100) : 0;

  const pieData = useMemo(() => [
    { name: "Active", value: activeCount, color: "#10b981" },
    { name: "Low Activity", value: filteredCounts.low_active, color: "#f59e0b" },
    { name: "Inactive", value: filteredCounts.inactive, color: "#94a3b8" },
  ].filter(d => d.value > 0), [activeCount, filteredCounts]);

  // ── Members list sorted by activity ────────────────────────────────────────

  const membersList = useMemo(() => {
    return [...filteredParticipants]
      .map(p => ({
        id: p.participant_id,
        name: p.name,
        status: p.status,
        lastActive: p.last_login_at || p.last_submission_at || null,
      }))
      .sort((a, b) => {
        const order = { inactive: 0, low_active: 1, moderately_active: 2, highly_active: 3 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
      });
  }, [filteredParticipants]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-12 bg-slate-200 rounded-xl w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-slate-200 rounded-2xl" />
            <div className="h-96 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* PAGE HEADER */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Caretaker Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your assigned groups and manage participant health.
        </p>
      </div>

      {/* GROUP SELECTOR */}
      {groups.length > 0 && (
        <GroupSelector
          groups={groups}
          selectedGroupId={selectedGroupId}
          onChange={setSelectedGroupId}
          totalParticipants={participants.length}
        />
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <p className="text-2xl font-extrabold text-slate-800">{totalMembers}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <p className="text-2xl font-extrabold text-emerald-600">{activeCount}</p>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Active</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <p className="text-2xl font-extrabold text-amber-600">{filteredCounts.low_active}</p>
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mt-1">Low Activity</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <p className="text-2xl font-extrabold text-slate-400">{filteredCounts.inactive}</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Inactive</p>
        </div>
      </div>

      {/* BOTTOM GRID SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GROUP STATUS OVERVIEW — real participant list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h2 className="text-lg font-bold text-slate-800">Participant Status</h2>
            </div>
            <span className="text-sm font-medium text-slate-400">{totalMembers} members</span>
          </div>

          {membersList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-sm text-slate-400">No participants assigned yet.</p>
              <button onClick={() => navigate("/caretaker/participants")} className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">Go to My Participants</button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[400px] p-2 custom-scrollbar">
              <div className="divide-y divide-slate-50">
                {membersList.map(member => (
                  <div key={member.id}
                    onClick={() => navigate(`/caretaker/participants/${member.id}`)}
                    className="p-4 flex justify-between items-center hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${getDotColor(member.status)}`} />
                      <p className="font-bold text-slate-800">{member.name}</p>
                      <p className="text-sm text-slate-500">— {getStatusLabel(member.status)}</p>
                    </div>
                    {member.lastActive && (
                      <span className="text-xs text-slate-400">{daysSince(member.lastActive)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GROUP HEALTH SNAPSHOT — real activity breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Activity Breakdown</h2>

          {totalMembers === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              <p className="text-sm text-slate-400">No activity data to display.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center">
              {/* Donut chart */}
              <div className="relative w-full h-64 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      itemStyle={{ color: "#1e293b", fontWeight: "bold" }}
                    />
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" animationDuration={1500}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Total</span>
                  <span className="text-4xl font-extrabold text-slate-800">{totalMembers}</span>
                </div>
              </div>

              {/* Stat Blocks */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-emerald-700">{activePct}%</p>
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</p>
                  </div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-amber-500 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-amber-700">{lowPct}%</p>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Low Activity</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-slate-400 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-slate-600">{inactivePct}%</p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive</p>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-blue-500 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-blue-700">{groups.length}</p>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Groups</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICATIONS PANEL */}
      <NotificationsPanel role="caretaker" />
    </div>
  );
}

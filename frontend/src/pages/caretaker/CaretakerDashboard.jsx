import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import NotificationsPanel from "../../components/NotificationsPanel";

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

// ─── SVG Icons ──────────────────────────────────────────────────────────────────

const Ico = ({ d, size = 20, sw = 1.8, stroke = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

const UsersIco = () => <Ico d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const ActivityIco = () => <Ico d={<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>} />;
const AlertIco = () => <Ico d={<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>} />;
const ChartIco = () => <Ico d={<><path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2z" /><path d="M9 19V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" /></>} />;
const InviteIco = () => <Ico d={<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>} />;
const ListIco = () => <Ico d={<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>} />;
const ArrowIco = () => <Ico size={14} sw={2} d={<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>} />;
const ChevDn = () => <Ico size={14} sw={2} d={<polyline points="6 9 12 15 18 9" />} />;
const InactiveIco = () => <Ico d={<><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>} />;

// ─── Group Selector ─────────────────────────────────────────────────────────────

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
                <p className={`text-sm font-semibold flex-1 ${isSelected ? "text-blue-700" : "text-slate-700"}`}>{g.name}</p>
                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </button>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────────────────────

function QuickActions({ groups, navigate }) {
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button onClick={() => navigate("/caretaker/reports")}
        className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all text-left">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><ChartIco /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Generate Report</p>
          <p className="text-xs text-slate-400 mt-0.5">Group or comparison</p>
        </div>
        <span className="text-slate-300 group-hover:text-blue-500 transition-colors"><ArrowIco /></span>
      </button>

      <div className="relative">
        <button onClick={() => setInviteOpen(!inviteOpen)}
          className="group w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-emerald-200 hover:shadow-md transition-all text-left">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><InviteIco /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Invite Participant</p>
            <p className="text-xs text-slate-400 mt-0.5">Send to a group</p>
          </div>
          <span className={`text-slate-300 transition-transform ${inviteOpen ? "rotate-180" : ""}`}><ChevDn /></span>
        </button>
        {inviteOpen && (<>
          <div className="fixed inset-0 z-10" onClick={() => setInviteOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">Select group to invite into</p>
            {groups.length === 0 ? (
              <p className="px-4 py-4 text-xs text-slate-400 text-center">No groups assigned yet.</p>
            ) : groups.map(g => (
              <button key={g.id} onClick={() => { setInviteOpen(false); navigate(`/caretaker/participants?view=invites&group=${g.id}`); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 flex-1">{g.name}</p>
                <span className="text-slate-300"><ArrowIco /></span>
              </button>
            ))}
          </div>
        </>)}
      </div>

      <button onClick={() => navigate("/caretaker/participants")}
        className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all text-left">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><ListIco /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">All Participants</p>
          <p className="text-xs text-slate-400 mt-0.5">View, filter & manage</p>
        </div>
        <span className="text-slate-300 group-hover:text-indigo-500 transition-colors"><ArrowIco /></span>
      </button>
    </div>
  );
}

// ─── Stat Cards ─────────────────────────────────────────────────────────────────

function StatCards({ totalMembers, activeCount, lowCount, inactiveCount, activePct, lowPct, inactivePct }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><UsersIco /></div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{totalMembers}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Participants</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">All participants across selected group(s)</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><ActivityIco /></div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-emerald-600 leading-none">{activeCount}</p>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mt-1">Active</p>
          </div>
        </div>
        {totalMembers > 0 && (
          <div className="mt-2.5">
            <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${activePct}%` }} />
            </div>
            <p className="text-xs text-emerald-400 mt-1 text-right font-semibold">{activePct}%</p>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Submitted a survey within the last <span className="font-semibold text-slate-500">14 days</span></p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><AlertIco /></div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-amber-600 leading-none">{lowCount}</p>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mt-1">Low Activity</p>
          </div>
        </div>
        {totalMembers > 0 && (
          <div className="mt-2.5">
            <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${lowPct}%` }} />
            </div>
            <p className="text-xs text-amber-400 mt-1 text-right font-semibold">{lowPct}%</p>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Last submission was <span className="font-semibold text-slate-500">15–30 days</span> ago</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><InactiveIco /></div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-slate-400 leading-none">{inactiveCount}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Inactive</p>
          </div>
        </div>
        {totalMembers > 0 && inactiveCount > 0 && (
          <div className="mt-2.5">
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-slate-400 transition-all duration-700" style={{ width: `${inactivePct}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1 text-right font-semibold">{inactivePct}%</p>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">No submissions in <span className="font-semibold text-slate-500">30+ days</span></p>
      </div>
    </div>
  );
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

      try {
        const counts = await api.caretakerGetActivityCounts();
        setActivityCounts(counts);
      } catch {
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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-12 bg-slate-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-slate-200 rounded-2xl" />
            <div className="h-96 bg-slate-200 rounded-2xl" />
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Caretaker Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Monitor your assigned groups and manage participant health.</p>
      </div>

      {groups.length > 0 && (
        <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onChange={setSelectedGroupId} totalParticipants={participants.length} />
      )}

      <QuickActions groups={groups} navigate={navigate} />

      <StatCards totalMembers={totalMembers} activeCount={activeCount} lowCount={filteredCounts.low_active} inactiveCount={filteredCounts.inactive} activePct={activePct} lowPct={lowPct} inactivePct={inactivePct} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <div key={member.id} onClick={() => navigate(`/caretaker/participants/${member.id}`)}
                    className="p-4 flex justify-between items-center hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${getDotColor(member.status)}`} />
                      <p className="font-bold text-slate-800">{member.name}</p>
                      <p className="text-sm text-slate-500">— {getStatusLabel(member.status)}</p>
                    </div>
                    {member.lastActive && <span className="text-xs text-slate-400">{daysSince(member.lastActive)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Activity Breakdown</h2>
          {totalMembers === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
              <p className="text-sm text-slate-400">No activity data to display.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center">
              <div className="relative w-full h-64 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} itemStyle={{ color: "#1e293b", fontWeight: "bold" }} />
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" animationDuration={1500}>
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Total</span>
                  <span className="text-4xl font-extrabold text-slate-800">{totalMembers}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                  <div><p className="text-xl font-bold text-emerald-700">{activePct}%</p><p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active</p></div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-amber-500 shrink-0" />
                  <div><p className="text-xl font-bold text-amber-700">{lowPct}%</p><p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Low Activity</p></div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-slate-400 shrink-0" />
                  <div><p className="text-xl font-bold text-slate-600">{inactivePct}%</p><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive</p></div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm bg-blue-500 shrink-0" />
                  <div><p className="text-xl font-bold text-blue-700">{groups.length}</p><p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Groups</p></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <NotificationsPanel role="caretaker" />
    </div>
  );
}

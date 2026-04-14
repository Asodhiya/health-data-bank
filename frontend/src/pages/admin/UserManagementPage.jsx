import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

// ── Constants ────────────────────────────────────────────────────────────────
const ROLES = [
  { value: "participant", label: "Participants", color: "bg-blue-600", lightBg: "bg-blue-50", lightText: "text-blue-700", border: "border-blue-200", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { value: "caretaker", label: "Caretakers", color: "bg-emerald-600", lightBg: "bg-emerald-50", lightText: "text-emerald-700", border: "border-emerald-200", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { value: "researcher", label: "Researchers", color: "bg-indigo-600", lightBg: "bg-indigo-50", lightText: "text-indigo-700", border: "border-indigo-200", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { value: "admin", label: "Admins", color: "bg-rose-600", lightBg: "bg-rose-50", lightText: "text-rose-700", border: "border-rose-200", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];
const INV_STYLES = { pending: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400 animate-pulse", label: "Pending" }, accepted: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400", label: "Accepted" }, expired: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400", label: "Expired" }, revoked: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-400", label: "Revoked" } };
const SUB_STYLES = { completed: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" }, in_progress: { bg: "bg-amber-50", text: "text-amber-700", label: "In Progress" }, new: { bg: "bg-blue-50", text: "text-blue-700", label: "New" } };
const GOAL_STYLES = { completed: { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" }, active: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" }, in_progress: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" }, not_started: { bg: "bg-slate-100", text: "text-slate-500", bar: "bg-slate-300" } };
const USERS_PAGE_SIZE = 10;
const INVITES_PAGE_SIZE = 10;

// ── Icons & Utils ────────────────────────────────────────────────────────────
const Ic = ({ d, c = "h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
const IconSearch = () => <Ic d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" c="h-4 w-4" />;
const IconPlus = () => <Ic d="M12 4v16m8-8H4" c="h-4 w-4" />;
const IconX = () => <Ic d="M6 18L18 6M6 6l12 12" />;
const IconCheck = () => <Ic d="M5 13l4 4L19 7" />;
const IconTrash = () => <Ic d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" c="h-4 w-4" />;
const IconEdit = () => <Ic d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" c="h-4 w-4" />;
const IconUsers = () => <Ic d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" c="h-4 w-4" />;
const IconMail = () => <Ic d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" c="h-4 w-4" />;
const IconSend = () => <Ic d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" c="h-4 w-4" />;
const IconBan = () => <Ic d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" c="h-4 w-4" />;
const IconRefresh = () => <Ic d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" c="h-4 w-4" />;
const IconClock = () => <Ic d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" c="h-3.5 w-3.5" />;
const IconKey = () => <Ic d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" c="h-4 w-4" />;
const IconPause = () => <Ic d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" c="h-4 w-4" />;
const IconChevron = ({ open }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const Spinner = () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
const BigSpinner = () => <svg className="animate-spin h-8 w-8 text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
function fmtTime(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function timeUntil(iso) { const ms = new Date(iso) - Date.now(); if (ms < 0) return "Expired"; const h = Math.floor(ms / 3600000); if (h < 1) return `${Math.floor(ms / 60000)}m`; if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; }
function isLocked(user) { return !!user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now(); }

// ── Backend → Frontend user transform ────────────────────────────────────────
// Backend UserListItem uses snake_case + boolean status.
// Frontend components use camelCase + string status ("active" / "inactive").
function transformUser(u) {
  return {
    id: u.id,
    firstName: u.first_name || "",
    lastName: u.last_name || "",
    email: u.email || "",
    phone: u.phone || "",
    address: u.address || "",
    role: u.role || "",
    status: u.status === true ? "active" : "inactive",
    joinedAt: u.joined_at || null,
    lastLoginAt: u.last_login_at || null,
    groupId: u.group_id ? String(u.group_id) : null,
    group: u.group || null,
    caretakerId: u.caretaker_id ? String(u.caretaker_id) : null,
    caretaker: u.caretaker || null,
    dob: u.dob || null,
    gender: u.gender || null,
    pronouns: u.pronouns || null,
    primaryLanguage: u.primary_language || null,
    countryOfOrigin: u.country_of_origin || null,
    maritalStatus: u.marital_status || null,
    highestEducation: u.highest_education_level || null,
    occupationStatus: u.occupation_status || null,
    dependents: u.dependents ?? null,
    livingArrangement: u.living_arrangement || null,
    onboardingStatus: u.onboarding_status || null,
    programEnrolledAt: u.program_enrolled_at || null,
    title: u.title || null,
    credentials: u.credentials || null,
    organization: u.organization || null,
    department: u.department || null,
    specialty: u.specialty || null,
    bio: u.bio || null,
    workingHoursStart: u.working_hours_start || null,
    workingHoursEnd: u.working_hours_end || null,
    contactPreference: u.contact_preference || null,
    availableDays: Array.isArray(u.available_days) ? u.available_days : [],
    roleTitle: u.role_title || null,
    anonymizedFrom: u.anonymized_from || null,
    selfDeactivatedAt: u.self_deactivated_at || null,
    lockedUntil: u.locked_until || null,
  };
}

// ── Reusable ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }) { const ini = (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); const cols = ["bg-blue-500", "bg-emerald-500", "bg-indigo-500", "bg-rose-500", "bg-amber-500", "bg-violet-500"]; const sz = size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs"; return <div className={`rounded-full ${cols[(name?.charCodeAt(0) || 0) % cols.length]} text-white flex items-center justify-center font-bold shrink-0 ${sz}`}>{ini}</div>; }
function RoleBadge({ role }) { const r = ROLES.find(x => x.value === role); return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${r?.lightBg} ${r?.lightText}`}>{r?.label?.replace(/s$/, "") || role}</span>; }
function StatusDot({ status }) { return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${status === "active" ? "bg-emerald-400 animate-pulse" : "bg-slate-300"}`} />; }
function Toast({ show, message, type, onClose }) { if (!show) return null; const ok = type !== "error"; return <div className={`fixed top-20 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[200] max-w-sm w-[calc(100%-3rem)] sm:w-full border rounded-xl p-4 shadow-lg flex items-start gap-3 animate-slide-in ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>{ok ? <IconCheck /> : <IconX />}</div><div className="flex-1"><p className="text-sm font-semibold">{ok ? "Done" : "Error"}</p><p className="text-sm mt-0.5 opacity-80">{message}</p></div><button onClick={onClose} className="text-current opacity-40 hover:opacity-70 shrink-0"><IconX /></button></div>; }
function Modal({ open, onClose, children, maxW = "max-w-md" }) { if (!open) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className={`relative bg-white rounded-2xl shadow-xl ${maxW} w-full p-6 max-h-[85vh] overflow-y-auto`}>{children}</div></div>; }
function InfoRow({ label, value }) { return <div className="flex justify-between py-1.5 border-b border-slate-50 last:border-0"><span className="text-xs text-slate-400">{label}</span><span className="text-xs font-semibold text-slate-700">{value || "—"}</span></div>; }

// ── Searchable filter dropdown ──────────────────────────────────────────────
function SearchableSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()));
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(p => !p); setQ(""); }}
        className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap">
        {selected?.label || placeholder}
        <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 w-52 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-xs text-slate-400 italic">No results</p>
              : filtered.map(o => (
                <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${o.value === value ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
                  {o.label}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Placeholder: empty state for sections awaiting backend ───────────────────
function ApiPendingBanner({ endpoint, description }) {
  return (
    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto">
        <Ic d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" c="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-400">{description}</p>
      <p className="text-xs text-slate-300">Waiting for <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-400">{endpoint}</code></p>
    </div>
  );
}

// ── Create Group Modal (REAL API + participant assignment) ───────────────────
function CreateGroupModal({ open, onClose, onConfirm, caretakers, users }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cId, setCId] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const allParticipants = (users || []).filter(u => u.role === "participant")
    .sort((a, b) => { if (!a.groupId && b.groupId) return -1; if (a.groupId && !b.groupId) return 1; return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); });
  const filtered = allParticipants.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const toggleParticipant = (id) => {
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const newGroup = await api.adminCreateGroup({ name: name.trim(), description: desc.trim() });
      if (cId) { try { await api.adminAssignCaretaker(cId, newGroup.group_id); } catch (e) { console.error("Caretaker assignment failed:", e); } }
      onConfirm(newGroup, cId, null, selectedParticipants);
      setName(""); setDesc(""); setCId(""); setSelectedParticipants([]); setParticipantSearch("");
    } catch (err) { onConfirm(null, null, err.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={() => !loading && onClose()} maxW="max-w-lg">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Create New Group</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Cohort C"
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Brief description of this group…"
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assign Caretaker</label>
          <select value={cId} onChange={e => setCId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl">
            <option value="">None (assign later)</option>
            {caretakers.map(c => <option key={c.caretaker_id} value={c.user_id}>{c.name} — {c.title || "Caretaker"}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Add Participants {selectedParticipants.length > 0 && <span className="text-blue-600">({selectedParticipants.length} selected)</span>}
          </label>
          {allParticipants.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">No participants available.</p>
              <p className="text-xs text-slate-300 mt-0.5">Invite new participants first.</p>
            </div>
          ) : (
            <>
              <input type="text" value={participantSearch} onChange={e => setParticipantSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 mb-2" />
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">No matches found.</p>
                ) : filtered.map(u => {
                  const isSelected = selectedParticipants.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => toggleParticipant(u.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}>
                        {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                      {u.groupId
                        ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">In: {u.group || "Group"}</span>
                        : <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Ungrouped</span>
                      }
                    </button>
                  );
                })}
              </div>
              {selectedParticipants.length > 0 && (
                <button onClick={() => setSelectedParticipants([])} className="text-xs text-slate-400 hover:text-slate-600 mt-1.5">Clear selection</button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button>
        <button onClick={submit} disabled={!name.trim() || loading}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <><Spinner /> Creating…</> : "Create"}
        </button>
      </div>
    </Modal>
  );
}

// ── Invite Modal (REAL API) ──────────────────────────────────────────────────
function InviteModal({ open, onClose, groups, preselectedRole, onInviteSent, onError }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState(preselectedRole || ""); const [groupId, setGroupId] = useState(""); const [status, setStatus] = useState(null);
  const send = async () => { setStatus("loading"); try { await api.sendInvite(email.trim(), role, groupId || undefined); onInviteSent?.({ email: email.trim(), role, groupId, group_name: groups.find(g => g.group_id === groupId)?.name || null }); setStatus("success"); } catch (err) { setStatus(null); onError?.(err.message || "Failed to send invite."); } };
  const reset = () => { setEmail(""); setRole(preselectedRole || ""); setGroupId(""); setStatus(null); };
  if (status === "success") return <Modal open={open} onClose={() => { reset(); onClose(); }}><div className="text-center py-4 space-y-3"><div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><IconCheck /></div><p className="text-lg font-bold text-slate-800">Invite Sent!</p><p className="text-sm text-slate-500">Link sent to <span className="font-semibold text-slate-700">{email}</span></p><div className="flex gap-3 pt-2"><button onClick={reset} className="flex-1 px-4 py-2.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl">Another</button><button onClick={() => { reset(); onClose(); }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Done</button></div></div></Modal>;
  return <Modal open={open} onClose={() => status !== "loading" && onClose()}><h3 className="text-lg font-bold text-slate-800 mb-1">Invite New User</h3><p className="text-sm text-slate-400 mb-4">One-time registration link</p><div className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" name="group-invite-email" autoComplete="off" className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-300" /></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label><div className="grid grid-cols-2 gap-2">{ROLES.map(r => <button key={r.value} onClick={() => { setRole(r.value); if (r.value !== "participant" && r.value !== "caretaker") setGroupId(""); }} className={`px-3 py-2.5 rounded-xl border text-sm font-semibold text-left ${role === r.value ? `${r.lightBg} ${r.border} ${r.lightText} ring-1 ring-current` : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{r.label.replace(/s$/, "")}</button>)}</div></div>{(role === "participant" || role === "caretaker") && <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{role === "caretaker" ? "Assign to Group" : "Group"}</label><select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"><option value="">{role === "caretaker" ? "Assign later" : "No group"}</option>{role === "participant" ? groups.filter(g => g.caretaker_id).map(g => <option key={g.group_id} value={g.group_id}>{g.name}</option>) : groups.map(g => <option key={g.group_id} value={g.group_id}>{g.name}{g.caretaker_name ? ` (has: ${g.caretaker_name})` : ""}</option>)}</select>{role === "caretaker" && groupId && (() => { const g = groups.find(x => x.group_id === groupId); return g?.caretaker_name ? <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700"><span className="font-semibold">Note:</span> {g.name} already has {g.caretaker_name}. The new caretaker will replace them.</div> : <p className="mt-1.5 text-xs text-emerald-600 font-medium">Will be assigned to {g?.name} upon registration.</p>; })()}{role === "caretaker" && !groupId && <p className="mt-1.5 text-xs text-slate-400">You can assign them later from the Groups section.</p>}</div>}{role === "admin" && <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700"><span className="font-semibold">Elevated access.</span> Full platform permissions.</div>}</div><div className="flex gap-3 mt-6"><button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={send} disabled={!email.trim() || !role || status === "loading"} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">{status === "loading" ? <><Spinner /> Sending…</> : <><IconMail /> Send</>}</button></div></Modal>;
}

// ── Edit User Modal (REAL API for password reset) ────────────────────────────
function EditUserModal({ open, onClose, user, onSave }) {
  // Start empty — placeholder shows current value. User types to override.
  // Component is remounted via key={user.id} in parent so state resets per user.
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [pwMode,    setPwMode]    = useState(null);
  const [newPw,     setNewPw]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isBusy = saving || sendingReset;

  if (!user) return null;

  const orig = { firstName: user.firstName || "", lastName: user.lastName || "", email: user.email || "", phone: user.phone || "" };

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    if (input === "(") {
      setPhone("");
      return;
    }
    const digits = input.replace(/\D/g, '').substring(0, 10);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits}`;
    }
    setPhone(formatted);
  };

  // A field is "changed" if the user has typed something that differs from the original
  const isDirty = firstName !== "" || lastName !== "" || email !== "" || phone !== "" || newPw !== "";
  const canSave = isDirty;

  const handleSave = async () => {
    setSaving(true); setSaveError("");

    const newEmail = email.trim();
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setSaveError("Please enter a valid email address.");
      setSaving(false);
      return;
    }

    const newPhone = phone.trim();
    const phoneDigits = newPhone.replace(/\D/g, '');
    if (newPhone) {
      if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
        setSaveError("Phone number must contain exactly 10 digits.");
        setSaving(false);
        return;
      }
    }

    try {
      await onSave({
        firstName: firstName.trim() !== "" ? firstName : orig.firstName,
        lastName: lastName.trim() !== "" ? lastName : orig.lastName,
        email: newEmail !== "" ? newEmail : orig.email,
        phone: newPhone !== "" ? phoneDigits : orig.phone,
        newPw: newPw.trim() !== "" ? newPw : undefined
      });
    }
    catch (err) { setSaveError(err.message || "Failed to save changes."); setSaving(false); return; }
    setSaving(false);
  };

  const handleClose = () => { if (isBusy) return; if (isDirty) { setConfirmDiscard(true); } else { onClose(); } };
  const handleResetEmail = async () => { 
    setSendingReset(true);
    try { await api.forgotPassword(user.email); } catch {} 
    setSendingReset(false);
    setResetSent(true); 
  };

  // placeholder:text-slate-400 shows the current value greyed; actual typed input is black
  const inputCls = "w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400 placeholder:font-normal text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

  if (confirmDiscard) {
    return <Modal open={open} onClose={() => setConfirmDiscard(false)} maxW="max-w-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Discard changes?</h3>
          <p className="text-sm text-slate-400">Your edits haven't been saved.</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setConfirmDiscard(false)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Keep Editing</button>
        <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl">Discard</button>
      </div>
    </Modal>;
  }

  return <Modal open={open} onClose={handleClose} maxW="max-w-lg">
    <h3 className="text-lg font-bold text-slate-800">Edit User</h3>
    <p className="text-sm text-slate-400 mb-1">{user.firstName} {user.lastName} · <RoleBadge role={user.role} /></p>
    <p className="text-xs text-slate-400 mb-4">Greyed text shows the current value. Click a field and type to replace it.</p>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={orig.firstName || "First name"} className={inputCls} disabled={isBusy} /></div>
        <div><label className={labelCls}>Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={orig.lastName || "Last name"} className={inputCls} disabled={isBusy} /></div>
      </div>
      <div><label className={labelCls}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={orig.email || "Email"} className={inputCls} disabled={isBusy} /></div>
      <div><label className={labelCls}>Phone</label><input type="tel" value={phone} onChange={handlePhoneChange} placeholder={orig.phone || "Phone"} className={inputCls} maxLength={14} disabled={isBusy} /></div>
      <div className="border-t border-slate-100 pt-4">
        <label className={labelCls}>Password</label>
        <div className="flex gap-2">
          <button onClick={() => {
            if (pwMode === "set") setNewPw("");
            setPwMode(pwMode === "set" ? null : "set");
          }} disabled={isBusy} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 ${pwMode === "set" ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200" : "border-slate-200 text-slate-500 hover:bg-slate-50"} disabled:opacity-50 disabled:cursor-not-allowed`}><IconKey /> Set Temp Password</button>
          <button onClick={handleResetEmail} disabled={resetSent || isBusy} className={`flex-1 px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 ${resetSent ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"} disabled:opacity-50 disabled:cursor-not-allowed`}><IconMail /> {sendingReset ? <><Spinner /> Sending…</> : resetSent ? "Reset Sent!" : "Send Reset Link"}</button>
        </div>
        {pwMode === "set" && <div className="mt-3 space-y-2"><input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Temporary password" className={`${inputCls} font-mono placeholder:font-sans`} disabled={isBusy} /><p className="text-xs text-slate-400">User must change this on next login.</p></div>}
      </div>
      {!isDirty && <p className="text-xs text-slate-400 text-center">Type in any field above to enable saving.</p>}
      {saveError && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg><p className="text-xs text-red-700">{saveError}</p></div>}
    </div>
    <div className="flex gap-3 mt-6">
      <button onClick={handleClose} disabled={isBusy} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
      <button onClick={handleSave} disabled={!canSave || isBusy} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? <><Spinner /> Saving…</> : "Save"}</button>
    </div>
  </Modal>;
}

// ── Other Modals ─────────────────────────────────────────────────────────────
// ── Assign Caretaker Modal (REAL API) ────────────────────────────────────────
function AssignCaretakerModal({ open, onClose, group, caretakers, onAssign }) {
  const [sel, setSel] = useState("");
  const [assigning, setAssigning] = useState(false);
  if (!open || !group) return null;
  const handleAssign = async () => {
    if (!sel) return;
    setAssigning(true);
    try { await onAssign(group, sel); } finally { setAssigning(false); setSel(""); }
  };
  return <Modal open={open} onClose={() => { if (!assigning) { setSel(""); onClose(); } }}>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><IconUsers /></div>
      <div><h3 className="text-lg font-bold text-slate-800">Assign Caretaker</h3><p className="text-sm text-slate-500">to <span className="font-semibold text-slate-700">{group.name}</span></p></div>
    </div>
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {caretakers.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center"><p className="text-sm text-slate-400">No caretakers registered yet.</p><p className="text-xs text-slate-300 mt-1">Send an invite first to create a caretaker account.</p></div>
      ) : caretakers.map(c => (
        <button key={c.caretaker_id} onClick={() => setSel(c.user_id)}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${sel === c.user_id ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400" : "border-slate-200 hover:bg-slate-50"}`}>
          <Avatar name={c.name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">{c.title ? `${c.title} ` : ""}{c.name}</p>
            <p className="text-xs text-slate-400">{c.organization || "—"} · {c.email || "—"}</p>
          </div>
          {sel === c.user_id && <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><IconCheck /></div>}
        </button>
      ))}
    </div>
    <div className="flex gap-3 mt-6">
      <button onClick={() => { setSel(""); onClose(); }} disabled={assigning} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button>
      <button onClick={handleAssign} disabled={!sel || assigning} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">{assigning ? <><Spinner /> Assigning…</> : "Assign"}</button>
    </div>
  </Modal>;
}
function DeactivateModal({ open, onClose, user, onConfirm, loading }) { if (!open || !user) return null; return <Modal open={open} onClose={() => !loading && onClose()}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><IconPause /></div><div><h3 className="text-lg font-bold text-slate-800">Deactivate User</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div><div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">User won't be able to log in. Data is preserved. You can reactivate or delete later.</div><div className="flex gap-3 mt-4"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Processing…</> : "Deactivate"}</button></div></Modal>; }
function DeleteModal({ open, onClose, user, onDelete, loading }) { if (!open || !user) return null; return <Modal open={open} onClose={() => !loading && onClose()}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><IconTrash /></div><div><h3 className="text-lg font-bold text-slate-800">Delete & Anonymize</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div>{user.status === "active" ? <><div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 font-semibold">Deactivate this user first.</div><div className="flex gap-3 mt-4"><button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Close</button></div></> : <><div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700"><span className="font-semibold">This will:</span> remove identifying account details and keep retained submissions and health data in anonymized form.</div><div className="flex gap-3 mt-4"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={() => onDelete("anonymize")} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Deleting…</> : "Delete & Anonymize"}</button></div></>}</Modal>; }
function RevokeModal({ open, onClose, onConfirm, invite, loading }) { if (!open || !invite) return null; return <Modal open={open} onClose={() => !loading && onClose()}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><IconBan /></div><div><h3 className="text-lg font-bold text-slate-800">Revoke Invite</h3><p className="text-sm text-slate-500">{invite.email}</p></div></div><p className="text-xs text-slate-400 mt-3">The registration link will be invalidated.</p><div className="flex gap-3 mt-4"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Revoking…</> : "Revoke"}</button></div></Modal>; }

function ReactivateModal({ open, onClose, user, onConfirm, loading }) { if (!open || !user) return null; return <Modal open={open} onClose={() => !loading && onClose()}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><IconRefresh /></div><div><h3 className="text-lg font-bold text-slate-800">Reactivate User</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div><div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700">A password reset link will be sent to their email. They must set a new password to log in.</div><div className="flex gap-3 mt-4"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Processing…</> : "Reactivate"}</button></div></Modal>; }

// ── Reactivate Anonymized Modal ─────────────────────────────────────────────
function ReactivateAnonymizedModal({ open, onClose, user, onConfirm }) {
  const [email, setEmail] = useState(user?.anonymizedFrom || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const handle = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Invalid email."); return; }
    setError(""); setLoading(true);
    try { await api.adminReactivateUser(user.id, { email: trimmed }); onConfirm(trimmed); }
    catch (err) { setError(err.message || "Failed to reactivate."); }
    finally { setLoading(false); }
  };
  return <Modal open={open} onClose={() => !loading && onClose()}>
    <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Ic d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></div><div><h3 className="text-lg font-bold text-slate-800">Reactivate Anonymized Account</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div>
    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 mb-4">This account was anonymized. Provide an email to send a password reset link.</div>
    {user.anonymizedFrom && <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Original Email</p><p className="text-sm text-slate-700 font-mono">{user.anonymizedFrom}</p></div>}
    <div className="mb-4"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Email</label><input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="user@example.com" className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-300" />{error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}</div>
    <div className="flex gap-3"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Sending…</> : "Reactivate & Send Reset"}</button></div>
  </Modal>;
}

// ── Add Existing Participants to Group Modal ─────────────────────────────────
const MODAL_PAGE_SIZE = 8;
function AddParticipantsModal({ open, onClose, group, onConfirm }) {
  const [selected, setSelected] = useState(new Set());
  // map of id → display name, persisted across page turns
  const [selectedNames, setSelectedNames] = useState({});
  const [selDropOpen, setSelDropOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open || !group) return;
    setFetching(true);
    api.adminListUsersPaged(MODAL_PAGE_SIZE, page * MODAL_PAGE_SIZE, debouncedSearch, "name", "asc", "participant", group.group_id, true)
      .then(res => {
        const raw = Array.isArray(res?.items) ? res.items : [];
        setItems(raw.map(transformUser));
        setTotal(Number(res?.total || 0));
      })
      .catch(() => setItems([]))
      .finally(() => setFetching(false));
  }, [open, group, debouncedSearch, page]);

  // Reset on open
  useEffect(() => { if (open) { setSelected(new Set()); setSelectedNames({}); setSelDropOpen(false); setSearch(""); setPage(0); } }, [open]);

  const totalPages = Math.ceil(total / MODAL_PAGE_SIZE);
  const toggle = (u) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(u.id)) {
        n.delete(u.id);
        setSelectedNames(m => { const c = { ...m }; delete c[u.id]; return c; });
      } else {
        n.add(u.id);
        setSelectedNames(m => ({ ...m, [u.id]: `${u.firstName} ${u.lastName}` }));
      }
      return n;
    });
  };

  const removeSelected = (id) => {
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    setSelectedNames(m => { const c = { ...m }; delete c[id]; return c; });
  };

  const handle = async () => {
    setSubmitting(true);
    setAddError("");
    try { for (const id of selected) { await api.adminMoveParticipant(id, group.group_id); } onConfirm(group, [...selected]); }
    catch (err) { setAddError(err.message || "Failed to add participant. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (!open || !group) return null;
  return <Modal open={open} onClose={() => { if (!submitting) { setAddError(""); onClose(); } }} maxW="max-w-lg">
    <h3 className="text-lg font-bold text-slate-800 mb-1">Add Participants to {group.name}</h3>
    <p className="text-sm text-slate-400 mb-4">{fetching ? "Loading…" : `${total} available`}</p>
    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" name="add-participant-search" autoComplete="off" className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 mb-3 placeholder:text-slate-300" />
    <div className="border border-slate-200 rounded-xl divide-y divide-slate-50 min-h-[80px]">
      {fetching ? <p className="text-xs text-slate-400 p-4 text-center">Loading…</p>
      : items.length === 0 ? <p className="text-xs text-slate-400 p-4 text-center">No eligible participants found.</p>
      : items.map(u => { const isSel = selected.has(u.id); return <button key={u.id} onClick={() => toggle(u)} className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${isSel ? "bg-blue-50" : "hover:bg-slate-50"}`}><div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSel ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}>{isSel && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}</div><Avatar name={`${u.firstName} ${u.lastName}`} size="sm" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-700 truncate">{u.firstName} {u.lastName}</p><p className="text-xs text-slate-400 truncate">{u.email}</p></div>{u.group ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">In: {u.group}</span> : <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">Ungrouped</span>}</button>; })}
    </div>
    {totalPages > 1 && <div className="flex items-center justify-between mt-2 px-1">
      <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || fetching} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200">← Prev</button>
      <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1 || fetching} className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg disabled:opacity-40 hover:bg-slate-200">Next →</button>
    </div>}
    {selected.size > 0 && <div className="mt-3 border border-blue-100 rounded-xl overflow-hidden">
      <button onClick={() => setSelDropOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
        <span>{selected.size} selected</span>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 transition-transform ${selDropOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>
      {selDropOpen && <ul className="divide-y divide-blue-50 max-h-36 overflow-y-auto bg-white">
        {Object.entries(selectedNames).map(([id, name]) => (
          <li key={id} className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-700">{name}</span>
            <button onClick={() => removeSelected(id)} className="text-slate-400 hover:text-red-500 transition-colors ml-2 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </li>
        ))}
      </ul>}
    </div>}
    {addError && <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg><p className="text-xs text-red-700">{addError}</p></div>}
    <div className="flex gap-3 mt-4"><button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={selected.size === 0 || submitting} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">{submitting ? <><Spinner /> Adding…</> : `Add ${selected.size || ""}`}</button></div>
  </Modal>;
}

// ── Change Group Modal ───────────────────────────────────────────────────────
function ChangeGroupModal({ open, onClose, targets, groups, onMove }) {
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const close = () => { if (!loading) { setSelected(""); setError(""); onClose(); } };

  const handle = async () => {
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      await onMove(selected);
      setSelected("");
    } catch (err) {
      setError(err.message || "Failed to move participant.");
    } finally {
      setLoading(false);
    }
  };

  const names = (targets || []).map(u => `${u.firstName} ${u.lastName}`.trim() || u.email).join(", ");

  return (
    <Modal open={open} onClose={close}>
      <h3 className="text-lg font-bold text-slate-800 mb-1">Change Group</h3>
      <p className="text-sm text-slate-400 mb-4 truncate">{names}</p>
      <div className="space-y-2 mb-4">
        <button
          onClick={() => setSelected("none")}
          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${selected === "none" ? "bg-rose-50 border-rose-200 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          Remove from group
        </button>
        {groups.map(g => (
          <button
            key={g.group_id}
            onClick={() => setSelected(g.group_id)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${selected === g.group_id ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {g.name}
            {g.caretaker_name && <span className="text-xs text-slate-400 ml-2">· {g.caretaker_name}</span>}
          </button>
        ))}
      </div>
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>}
      <div className="flex gap-3">
        <button onClick={close} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button>
        <button onClick={handle} disabled={!selected || loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <><Spinner /> Moving…</> : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

// ── User Detail Drawer ───────────────────────────────────────────────────────
function UserDrawer({ user, users, groups, caretakers, onClose, onEdit, onDeactivate, onReactivate, onUnlock, onDelete, onChangeGroup, onChangeRole }) {
  const navigate = useNavigate();
  const [subExp, setSubExp] = useState(null);
  const [goalExp, setGoalExp] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [goals, setGoals] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "participant") { setSubmissions(null); setGoals(null); return; }
    setSubmissions(null); setGoals(null);
    let cancelled = false;
    (async () => {
      try {
        const [s, g] = await Promise.all([
          api.adminGetUserSubmissions(user.id),
          api.adminGetUserGoals(user.id),
        ]);
        if (!cancelled) {
          setSubmissions(Array.isArray(s) ? s : []);
          setGoals(Array.isArray(g) ? g : []);
        }
      } catch {
        if (!cancelled) { setSubmissions([]); setGoals([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;
  const isAnonymized = user.email?.startsWith("deleted_");
  const locked = isLocked(user);
  const ct = user.role === "participant" && user.caretakerId ? (() => { const c = caretakers.find(c => String(c.caretaker_id) === String(user.caretakerId)); return c ? { firstName: c.name?.split(" ")[0], lastName: c.name?.split(" ").slice(1).join(" "), title: c.title, organization: c.organization } : null; })() : null;
  const managed = user.role === "caretaker" ? (() => { const ctId = caretakers.find(c => String(c.user_id) === String(user.id))?.caretaker_id; return ctId ? users.filter(u => u.role === "participant" && String(u.caretakerId) === String(ctId)) : []; })() : [];
  const grp = user.groupId ? groups.find(g => String(g.group_id) === String(user.groupId)) : null;

  return <div className="fixed inset-0 z-40 flex justify-end"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} /><div className="relative z-10 w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0"><h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">User Details</h2><button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"><IconX /></button></div>
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-4"><Avatar name={`${user.firstName} ${user.lastName}`} size="lg" /><div className="min-w-0"><p className="text-lg font-bold text-slate-800">{user.firstName} {user.lastName}</p><p className="text-xs text-slate-400 truncate">{user.email}</p><div className="flex items-center gap-2 mt-1.5 flex-wrap"><RoleBadge role={user.role} /><StatusDot status={user.status} /><span className="text-xs text-slate-400 capitalize">{user.status}</span>{locked && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase">Locked</span>}{isAnonymized && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">Anonymized</span>}</div></div></div>
      <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Account</p><InfoRow label="Phone" value={user.phone} /><InfoRow label="Address" value={user.address} /><InfoRow label="Joined" value={fmt(user.joinedAt)} /><InfoRow label="Lock status" value={locked ? `Locked until ${fmtTime(user.lockedUntil)}` : "Not locked"} /></div>

      {user.role === "participant" && <>
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Profile</p><InfoRow label="DOB" value={fmt(user.dob)} /><InfoRow label="Gender" value={user.gender} /><InfoRow label="Pronouns" value={user.pronouns} /><InfoRow label="Language" value={user.primaryLanguage} /><InfoRow label="Country of Origin" value={user.countryOfOrigin} /></div>
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Demographics</p><InfoRow label="Marital Status" value={user.maritalStatus} /><InfoRow label="Education" value={user.highestEducation} /><InfoRow label="Employment" value={user.occupationStatus} /><InfoRow label="Dependents" value={user.dependents != null ? String(user.dependents) : null} /><InfoRow label="Living Arrangement" value={user.livingArrangement} /><InfoRow label="Onboarding" value={user.onboardingStatus} /><InfoRow label="Enrolled" value={fmtTime(user.programEnrolledAt)} /></div>
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Group</p>{grp ? <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between"><div><p className="text-sm font-bold text-emerald-800">{grp.name}</p><p className="text-xs text-emerald-600 mt-0.5">{grp.description}</p></div><button onClick={() => onChangeGroup([user])} className="text-xs font-semibold text-blue-600 shrink-0">Change</button></div> : <div className="flex items-center justify-between"><p className="text-xs text-slate-400 italic">Not assigned</p><button onClick={() => onChangeGroup([user])} className="text-xs font-semibold text-blue-600">Assign</button></div>}</div>
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Caretaker</p>{ct ? <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3"><Avatar name={`${ct.firstName} ${ct.lastName}`} size="sm" /><div><p className="text-sm font-semibold text-slate-800">{ct.firstName} {ct.lastName}</p><p className="text-xs text-slate-400">{ct.title} · {ct.organization}</p></div></div> : <p className="text-xs text-slate-400 italic">No caretaker</p>}</div>

        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Submissions</p>
          {submissions === null ? <div className="flex items-center justify-center py-4"><Spinner /><span className="text-xs text-slate-400 ml-2">Loading…</span></div>
            : submissions.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No submissions yet.</p>
            : <div className="space-y-2">{submissions.map(s => { const st = SUB_STYLES[s.status] || SUB_STYLES.new; const ex = subExp === s.id; return <div key={s.id} className="border border-slate-100 rounded-xl overflow-hidden"><button onClick={() => setSubExp(ex ? null : s.id)} className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-50/50"><div className="min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{s.form_name}</p><p className="text-xs text-slate-400 mt-0.5">{s.submitted_at ? fmtTime(s.submitted_at) : "Draft"}</p></div><div className="flex items-center gap-2 shrink-0"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span><IconChevron open={ex} /></div></button>{ex && <div className="px-3 pb-3 border-t border-slate-50 space-y-1.5 pt-2">{(s.answers || []).map((a, i) => <div key={i} className="bg-slate-50 rounded-lg px-3 py-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{a.field}</p><p className="text-sm text-slate-700 mt-0.5">{a.value}</p></div>)}</div>}</div>; })}</div>}
        </div>

        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Health Goals</p>
          {goals === null ? <div className="flex items-center justify-center py-4"><Spinner /><span className="text-xs text-slate-400 ml-2">Loading…</span></div>
            : goals.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No health goals set.</p>
            : <div className="space-y-2">{goals.map(g => { const gs = GOAL_STYLES[g.status] || GOAL_STYLES.in_progress; const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current / g.target_value) * 100)) : 0; const ex = goalExp === g.id; return <div key={g.id} className="border border-slate-100 rounded-xl overflow-hidden"><button onClick={() => setGoalExp(ex ? null : g.id)} className="w-full px-3 py-2.5 text-left hover:bg-slate-50/50"><div className="flex items-center justify-between mb-1.5"><p className="text-sm font-semibold text-slate-700">{g.name}</p><div className="flex items-center gap-2"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${gs.bg} ${gs.text}`}>{g.status.replace("_", " ")}</span><IconChevron open={ex} /></div></div><div className="flex items-center justify-between text-xs mb-1"><span className="text-slate-400">Target: {g.target}</span><span className="font-semibold text-slate-600">{pct}%</span></div><div className="w-full bg-slate-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${gs.bar}`} style={{ width: `${pct}%` }} /></div></button>{ex && (g.logs || []).length > 0 && <div className="px-3 pb-3 border-t border-slate-50 pt-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Log</p>{g.logs.map((l, i) => <div key={i} className="flex justify-between bg-slate-50 rounded-lg px-3 py-1.5 mb-1"><span className="text-xs text-slate-400">{l.date}</span><span className="text-xs font-semibold text-slate-700">{l.value} {g.unit}</span></div>)}</div>}</div>; })}</div>}
        </div>
      </>}

      {user.role === "caretaker" && <>
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Professional</p>
          <InfoRow label="Title" value={user.title} />
          <InfoRow label="Credentials" value={user.credentials} />
          <InfoRow label="Organization" value={user.organization} />
          <InfoRow label="Department" value={user.department} />
          <InfoRow label="Specialty" value={user.specialty} />
          <InfoRow label="Bio" value={user.bio} />
        </div>
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Availability</p>
          <InfoRow label="Hours" value={user.workingHoursStart && user.workingHoursEnd ? `${user.workingHoursStart} - ${user.workingHoursEnd}` : null} />
          <InfoRow label="Days" value={user.availableDays.length ? user.availableDays.join(", ") : null} />
          <InfoRow label="Contact Preference" value={user.contactPreference} />
        </div>
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Participants ({managed.length})</p>{managed.length === 0 ? <p className="text-xs text-slate-400 italic">No participants linked yet</p> : <div className="space-y-2">{managed.map(p => <div key={p.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-3"><Avatar name={`${p.firstName} ${p.lastName}`} size="sm" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{p.firstName} {p.lastName}</p><p className="text-xs text-slate-400">{p.group || "No group"}</p></div><StatusDot status={p.status} /></div>)}</div>}</div>
      </>}
      {user.role === "researcher" && <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Research</p><InfoRow label="Title" value={user.title} /><InfoRow label="Credentials" value={user.credentials} /><InfoRow label="Organization" value={user.organization} /><InfoRow label="Department" value={user.department} /><InfoRow label="Specialty" value={user.specialty} /><InfoRow label="Bio" value={user.bio} /></div>}
      {user.role === "admin" && <div className="px-5 py-4 border-b border-slate-100"><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin</p><InfoRow label="Title" value={user.title} /><InfoRow label="Role Title" value={user.roleTitle} /><InfoRow label="Organization" value={user.organization} /><InfoRow label="Department" value={user.department} /><InfoRow label="Bio" value={user.bio} /><InfoRow label="Contact Preference" value={user.contactPreference} /></div>}
    </div>
    <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
      <button onClick={() => { onClose(); navigate(`/admin/users/${user.id}`); }} className="w-full py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"><Ic d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" c="h-4 w-4" /> View Full Details</button>
      <button onClick={() => onEdit(user)} className="w-full py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 flex items-center justify-center gap-2"><IconEdit /> Edit</button>
      <button onClick={() => onChangeRole(user)} className="w-full py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center justify-center gap-2"><IconSwitch /> Change Role</button>
      {user.role === "participant" && <button onClick={() => onChangeGroup([user])} className="w-full py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 flex items-center justify-center gap-2"><IconUsers /> Change Group</button>}
      {locked && <button onClick={() => onUnlock(user)} className="w-full py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center gap-2"><IconKey /> Unlock Account</button>}
      {user.status === "active" ? <button onClick={() => onDeactivate(user)} className="w-full py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 flex items-center justify-center gap-2"><IconPause /> Deactivate</button>
        : <div className="grid grid-cols-2 gap-2"><button onClick={() => onReactivate(user)} className="py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 flex items-center justify-center gap-2"><IconRefresh /> Reactivate</button><button onClick={() => onDelete(user)} className="py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 flex items-center justify-center gap-2"><IconTrash /> Delete</button></div>}
    </div>
  </div></div>;
}

// ── Sort icon helper ────────────────────────────────────────────────────────
const IconSort = ({ dir }) => <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={dir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>;
const IconDownload = () => <Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" c="h-4 w-4" />;
const IconSwitch = () => <Ic d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" c="h-4 w-4" />;

// ── Change Role Modal ─────────────────────────────────────────────────────────
function ChangeRoleModal({ open, onClose, user, onConfirm }) {
  const [sel, setSel] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const available = ROLES.filter(r => r.value !== user.role);
  return <Modal open={open} onClose={() => !loading && onClose()}>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><IconSwitch /></div>
      <div><h3 className="text-lg font-bold text-slate-800">Change Role</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName} · currently <span className="font-semibold capitalize">{user.role}</span></p></div>
    </div>
    <div className="space-y-2">
      {available.map(r => (
        <button key={r.value} onClick={() => setSel(r.value)}
          className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${sel === r.value ? `${r.lightBg} ${r.border} ring-1 ring-current` : "border-slate-200 hover:bg-slate-50"}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sel === r.value ? `${r.color} text-white` : `${r.lightBg} ${r.lightText}`}`}><Ic d={r.icon} c="h-4 w-4" /></div>
          <div><p className={`text-sm font-semibold ${sel === r.value ? r.lightText : "text-slate-700"}`}>{r.label.replace(/s$/, "")}</p></div>
        </button>
      ))}
    </div>
    {sel === "admin" && <div className="mt-3 bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700"><span className="font-semibold">Warning:</span> Admins have full platform access including user management, backups, and system settings.</div>}
    <div className="flex gap-3 mt-6">
      <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button>
      <button onClick={async () => { setLoading(true); await onConfirm(user, sel); setLoading(false); setSel(""); }} disabled={!sel || loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">{loading ? <><Spinner /> Changing…</> : "Change Role"}</button>
    </div>
  </Modal>;
}

// ── Edit Group Modal ──────────────────────────────────────────────────────────
function EditGroupModal({ open, onClose, group, onSave }) {
  const [name, setName] = useState(group?.name || "");
  const [desc, setDesc] = useState(group?.description || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (group) { setName(group.name || ""); setDesc(group.description || ""); } }, [group]);
  if (!open || !group) return null;
  return <Modal open={open} onClose={() => !saving && onClose()}>
    <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Group</h3>
    <div className="space-y-4">
      <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Group Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
      <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" /></div>
    </div>
    <div className="flex gap-3 mt-6">
      <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl disabled:opacity-50">Cancel</button>
      <button onClick={async () => { setSaving(true); await onSave(group, name.trim(), desc.trim()); setSaving(false); }} disabled={!name.trim() || saving} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">{saving ? <><Spinner /> Saving…</> : "Save"}</button>
    </div>
  </Modal>;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [roleTotals, setRoleTotals] = useState({});
  const [groups, setGroups] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [invitesOffset, setInvitesOffset] = useState(0);
  const [invitesHasMore, setInvitesHasMore] = useState(false);
  const [invitesLoadingMore, setInvitesLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usersAvailable, setUsersAvailable] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [invitesAvailable, setInvitesAvailable] = useState(null);

  // Search, filter, sort
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeRole, setActiveRole] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterCaretaker, setFilterCaretaker] = useState("all");
  const [sort, setSort] = useState({ field: "name", dir: "asc" });

  // UI state
  const [detailUser, setDetailUser] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [showInvite, setShowInvite] = useState(false);
  const [invitePreRole, setInvitePreRole] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupsExpanded, setGroupsExpanded] = useState(false);
  const [groupMembersByGroup, setGroupMembersByGroup] = useState({});
  const [groupMembersLoading, setGroupMembersLoading] = useState({});
  const [invitesExpanded, setInvitesExpanded] = useState(false);
  const [inviteFilter, setInviteFilter] = useState("all");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteRoleFilter, setInviteRoleFilter] = useState("all");
  const [inviteGroupFilter, setInviteGroupFilter] = useState("all");
  const [inviteDateFilter, setInviteDateFilter] = useState("all");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [changeGroupTargets, setChangeGroupTargets] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [assignCaretakerTarget, setAssignCaretakerTarget] = useState(null);
  const [changeRoleTarget, setChangeRoleTarget] = useState(null);
  const [editGroupTarget, setEditGroupTarget] = useState(null);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [reactivateAnonymizedTarget, setReactivateAnonymizedTarget] = useState(null);
  const [addParticipantsTarget, setAddParticipantsTarget] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  // Group detail modal
  const [selectedGroupModal, setSelectedGroupModal] = useState(null);
  const [groupModalTab, setGroupModalTab] = useState("Participants");
  const [groupModalSurveys, setGroupModalSurveys] = useState([]);
  const [groupModalSurveysLoading, setGroupModalSurveysLoading] = useState(false);
  const [groupModalGoals, setGroupModalGoals] = useState(null);
  const [groupModalGoalsLoading, setGroupModalGoalsLoading] = useState(false);
  const [groupModalPage, setGroupModalPage] = useState(1);
  const GROUP_MODAL_PAGE_SIZE = 8;
  const didRunSearchSync = useRef(false);
  const msg = (m, t = "success") => { setToast({ show: true, message: m, type: t }); setTimeout(() => setToast(p => ({ ...p, show: false })), 3500); };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch all data on mount ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setInvitesAvailable(null);
    const [groupsRes, caretakersRes, usersPageRes, invitesRes, roleStatsRes] = await Promise.allSettled([
      api.adminGetGroups(),
      api.adminGetCaretakers(),
      api.adminListUsersPaged(USERS_PAGE_SIZE, 0, "", sort.field, sort.dir),
      api.adminListInvites(INVITES_PAGE_SIZE, 0),
      api.adminGetRoleGroupStats(),
    ]);

    const groupsData = groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value) ? groupsRes.value : [];
    const caretakersData = caretakersRes.status === "fulfilled" && Array.isArray(caretakersRes.value) ? caretakersRes.value : [];

    if (groupsRes.status !== "fulfilled" || caretakersRes.status !== "fulfilled") {
      console.error("Failed to load groups/caretakers.");
    }

    const enriched = groupsData.map((grp) => {
      const ct = caretakersData.find((x) => String(x.caretaker_id) === String(grp.caretaker_id));
      return {
        ...grp,
        group_id: String(grp.group_id),
        caretaker_id: grp.caretaker_id ? String(grp.caretaker_id) : null,
        caretaker_name: ct?.name || null,
        member_count: grp.member_count || 0,
      };
    });
    setGroups(enriched);
    setCaretakers(caretakersData);

    if (usersPageRes.status === "fulfilled") {
      const page = usersPageRes.value;
      const mapped = Array.isArray(page?.items) ? page.items.map(transformUser) : [];
      const seen = new Set();
      const uniqueMapped = mapped.filter((x) => !seen.has(x.id) && seen.add(x.id));
      setUsers(uniqueMapped);
      setUsersTotal(Number(page?.total || 0));
      setUsersOffset(uniqueMapped.length);
      setUsersAvailable(true);
      setUsersError(page?._fallback ? (page?._error || "Paged endpoint unavailable; using fallback list.") : "");
    } else {
      setUsers([]);
      setUsersTotal(0);
      setUsersOffset(0);
      setUsersAvailable(false);
      setUsersError(usersPageRes.reason?.message || "Failed to load users.");
    }

    if (invitesRes.status === "fulfilled") {
      const firstPage = Array.isArray(invitesRes.value) ? invitesRes.value : [];
      setInvites(firstPage);
      setInvitesOffset(firstPage.length);
      setInvitesHasMore(firstPage.length === INVITES_PAGE_SIZE);
      setInvitesAvailable(true);
    } else {
      setInvites([]);
      setInvitesOffset(0);
      setInvitesHasMore(false);
      setInvitesAvailable(false);
    }

    if (roleStatsRes.status === "fulfilled" && Array.isArray(roleStatsRes.value?.role_summary)) {
      const map = {};
      roleStatsRes.value.role_summary.forEach((r) => {
        const key = String(r.role || "").toLowerCase();
        map[key] = Number(r.total || 0);
      });
      setRoleTotals(map);
    } else {
      setRoleTotals({});
    }
    setLoading(false);
  }, [sort.dir, sort.field]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!detailUser?.id) return;
    const refreshedUser = users.find((u) => u.id === detailUser.id);
    if (refreshedUser) {
      setDetailUser(refreshedUser);
    }
  }, [users, detailUser?.id]);


  useEffect(() => {
    if (!didRunSearchSync.current) {
      didRunSearchSync.current = true;
      return;
    }

    let cancelled = false;
    const syncUsersForSearch = async () => {
      setLoading(true);
      try {
        const page = await api.adminListUsersPaged(USERS_PAGE_SIZE, 0, debouncedSearch, sort.field, sort.dir);
        if (cancelled) return;
        const mapped = Array.isArray(page?.items) ? page.items.map(transformUser) : [];
        const seen = new Set();
        const uniqueMapped = mapped.filter((x) => !seen.has(x.id) && seen.add(x.id));
        setUsers(uniqueMapped);
        setUsersTotal(Number(page?.total || 0));
        setUsersOffset(uniqueMapped.length);
        setUsersAvailable(true);
        setUsersError(page?._fallback ? (page?._error || "Paged endpoint unavailable; using fallback list.") : "");
        setSelected(new Set());
      } catch (err) {
        if (cancelled) return;
        setUsers([]);
        setUsersTotal(0);
        setUsersOffset(0);
        setUsersAvailable(false);
        setUsersError(err.message || "Failed to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    syncUsersForSearch();
    return () => { cancelled = true; };
  }, [debouncedSearch, sort.dir, sort.field]);

  const loadMoreUsers = useCallback(async () => {
    if (usersLoadingMore || usersOffset >= usersTotal) return;
    setUsersLoadingMore(true);
    try {
      const page = await api.adminListUsersPaged(USERS_PAGE_SIZE, usersOffset, debouncedSearch, sort.field, sort.dir);
      const mapped = Array.isArray(page?.items) ? page.items.map(transformUser) : [];
      const uniquePage = [];
      {
        const pageSeen = new Set();
        for (const row of mapped) {
          if (pageSeen.has(row.id)) continue;
          pageSeen.add(row.id);
          uniquePage.push(row);
        }
      }
      setUsers(p => {
        const seen = new Set(p.map(x => x.id));
        const next = [];
        for (const row of uniquePage) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          next.push(row);
        }
        return [...p, ...next];
      });
      setUsersOffset(prev => prev + uniquePage.length);
      setUsersTotal(Number(page?.total || usersTotal));
    } catch (err) {
      msg(err.message || "Failed to load more users.", "error");
    } finally {
      setUsersLoadingMore(false);
    }
  }, [debouncedSearch, sort.dir, sort.field, usersLoadingMore, usersOffset, usersTotal]);

  const refreshInvites = useCallback(async () => {
    try {
      const firstPage = await api.adminListInvites(INVITES_PAGE_SIZE, 0);
      const rows = Array.isArray(firstPage) ? firstPage : [];
      setInvites(rows);
      setInvitesOffset(rows.length);
      setInvitesHasMore(rows.length === INVITES_PAGE_SIZE);
      setInvitesAvailable(true);
    } catch {
      // silently fail — existing list remains visible
    }
  }, []);

  const loadMoreInvites = useCallback(async () => {
    if (invitesLoadingMore || !invitesHasMore) return;
    setInvitesLoadingMore(true);
    try {
      const nextPage = await api.adminListInvites(INVITES_PAGE_SIZE, invitesOffset);
      const nextRows = Array.isArray(nextPage) ? nextPage : [];
      setInvites((prev) => {
        const seen = new Set(prev.map((x) => x.invite_id));
        const uniqueNext = nextRows.filter((x) => !seen.has(x.invite_id));
        return [...prev, ...uniqueNext];
      });
      setInvitesOffset((prev) => prev + nextRows.length);
      setInvitesHasMore(nextRows.length === INVITES_PAGE_SIZE);
    } catch (err) {
      msg(err.message || "Failed to load more invites.", "error");
    } finally {
      setInvitesLoadingMore(false);
    }
  }, [invitesLoadingMore, invitesHasMore, invitesOffset]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = {};
    ROLES.forEach(r => {
      if (typeof roleTotals[r.value] === "number") c[r.value] = roleTotals[r.value];
      else c[r.value] = users.filter(u => u.role === r.value).length;
    });
    return c;
  }, [users, roleTotals]);
  const inviteCounts = useMemo(() => { const c = { all: invites.length, pending: 0, accepted: 0, expired: 0, revoked: 0 }; invites.forEach(i => { if (c[i.status] !== undefined) c[i.status]++; }); return c; }, [invites]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterStatus !== "all") c++;
    if (filterGroup !== "all") c++;
    if (filterCaretaker !== "all") c++;
    return c;
  }, [filterStatus, filterGroup, filterCaretaker]);

  // ── Filter + Sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.filter(u => {
      if (q && !`${u.firstName || ""} ${u.lastName || ""} ${u.email || ""}`.toLowerCase().includes(q)) return false;
      if (activeRole && u.role !== activeRole) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (filterGroup !== "all") {
        if (u.role === "caretaker") {
          const ctId = caretakers.find(c => String(c.user_id) === String(u.id))?.caretaker_id;
          const ctGroupIds = ctId ? groups.filter(g => String(g.caretaker_id) === String(ctId)).map(g => g.group_id) : [];
          if (filterGroup === "unassigned") { if (ctGroupIds.length > 0) return false; }
          else if (!ctGroupIds.includes(filterGroup)) return false;
        } else {
          if (filterGroup === "unassigned") { if (u.groupId) return false; }
          else if (u.groupId !== filterGroup) return false;
        }
      }
      if (filterCaretaker !== "all") {
        if (filterCaretaker === "none") { if (u.caretakerId) return false; }
        else if (String(u.caretakerId) !== filterCaretaker) return false;
      }
      return true;
    });

    if (q) {
      const relevance = (u) => {
        const first = (u.firstName || "").toLowerCase();
        const last = (u.lastName || "").toLowerCase();
        const full = `${first} ${last}`.trim();
        const email = (u.email || "").toLowerCase();

        if (full === q) return 0;
        if (first === q || last === q) return 1;
        if (full.startsWith(q)) return 2;
        if (first.startsWith(q) || last.startsWith(q)) return 3;
        if (email.startsWith(q)) return 4;
        return 5;
      };

      list.sort((a, b) => {
        const ra = relevance(a);
        const rb = relevance(b);
        if (ra !== rb) return ra - rb;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
      return list;
    }

    return list;
  }, [users, search, activeRole, filterStatus, filterGroup, filterCaretaker]);

  const filteredInvites = useMemo(() => {
    const now = Date.now();
    return invites.filter(i => {
      if (inviteFilter !== "all" && i.status !== inviteFilter) return false;
      if (inviteRoleFilter !== "all" && i.role !== inviteRoleFilter) return false;
      if (inviteGroupFilter !== "all") { if (inviteGroupFilter === "none" && i.group_id) return false; if (inviteGroupFilter !== "none" && i.group_id !== inviteGroupFilter) return false; }
      if (inviteSearch) { const q = inviteSearch.toLowerCase(); if (!i.email.toLowerCase().includes(q) && !(i.invited_by || "").toLowerCase().includes(q)) return false; }
      if (inviteDateFilter !== "all") { const c = new Date(i.created_at).getTime(); if (inviteDateFilter === "24h" && now - c > 86400000) return false; if (inviteDateFilter === "7d" && now - c > 7 * 86400000) return false; if (inviteDateFilter === "30d" && now - c > 30 * 86400000) return false; }
      return true;
    });
  }, [invites, inviteFilter, inviteRoleFilter, inviteGroupFilter, inviteSearch, inviteDateFilter]);
  const hasInvFilters = inviteSearch || inviteRoleFilter !== "all" || inviteGroupFilter !== "all" || inviteDateFilter !== "all";
  const hasUserFilters = Boolean(
    search ||
    activeRole ||
    filterStatus !== "all" ||
    filterGroup !== "all" ||
    filterCaretaker !== "all"
  );
  const hasClientSideUserFilters = Boolean(
    activeRole ||
    filterStatus !== "all" ||
    filterGroup !== "all" ||
    filterCaretaker !== "all"
  );
  const hasMoreUsers = usersOffset < usersTotal;

  // For client-side-only filters, keep fetching pages so the filter can apply to the full dataset.
  useEffect(() => {
    if (!hasClientSideUserFilters || loading || usersLoadingMore || !hasMoreUsers) return;
    const timer = setTimeout(() => {
      loadMoreUsers();
    }, 150);
    return () => clearTimeout(timer);
  }, [hasClientSideUserFilters, hasMoreUsers, loadMoreUsers, loading, usersLoadingMore, usersOffset]);

  const allSel = filtered.length > 0 && filtered.every(u => selected.has(u.id));
  const toggleAll = () => { if (allSel) setSelected(new Set()); else setSelected(new Set(filtered.map(u => u.id))); };
  const toggleOne = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };

  const handleSort = (field) => {
    setSort(prev => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
  };

  const clearFilters = () => { setFilterStatus("all"); setFilterGroup("all"); setFilterCaretaker("all"); setSearch(""); };

  const openUserDrawerFromGroup = useCallback(async (userId) => {
    setSelectedGroupModal(null);

    const normalizedId = String(userId);
    const existingUser = users.find((user) => String(user.id) === normalizedId);
    if (existingUser) {
      setDetailUser(existingUser);
      return;
    }

    try {
      const fetchedUser = await api.adminGetUserById(userId);
      setDetailUser(transformUser(fetchedUser));
    } catch (err) {
      msg(err.message || "Failed to load user details.", "error");
    }
  }, [users]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDeleteGroup = async (g) => { try { await api.adminDeleteGroup(g.group_id); setGroups(p => p.filter(x => x.group_id !== g.group_id)); setGroupMembersByGroup(prev => { const next = { ...prev }; delete next[g.group_id]; return next; }); if (selectedGroupModal?.group_id === g.group_id) setSelectedGroupModal(null); msg(`"${g.name}" deleted.`); } catch (err) { msg(err.message || "Failed.", "error"); } };
  const handleDeactivate = async (u) => {
    setDeactivateLoading(true);
    try {
      await api.adminUpdateUserStatus(u.id, "inactive");
      await fetchData();
      msg(`${u.firstName} deactivated.`);
    } catch (err) {
      msg(err.message || "Failed to deactivate user.", "error");
    } finally {
      setDeactivateLoading(false);
      setDeactivateTarget(null);
    }
  };
  const handleReactivate = (u) => {
    if (u.email?.startsWith("deleted_")) { setReactivateAnonymizedTarget(u); return; }
    setReactivateTarget(u);
  };

  const confirmReactivate = async () => {
    const u = reactivateTarget;
    setReactivateLoading(true);
    try {
      await api.adminReactivateUser(u.id);
      await fetchData();
      setReactivateTarget(null);
      msg(`${u.firstName} reactivated. Password reset email sent.`);
    } catch (err) {
      msg(err.message || "Failed to reactivate user.", "error");
    } finally {
      setReactivateLoading(false);
    }
  };
  const handleUnlock = async (u) => {
    try {
      await api.adminUnlockUser(u.id);
      setUsers(p => p.map(x => x.id === u.id ? { ...x, lockedUntil: null } : x));
      if (detailUser?.id === u.id) setDetailUser(p => ({ ...p, lockedUntil: null }));
      msg(`${u.firstName} unlocked.`);
    } catch (err) {
      msg(err.message || "Failed to unlock user.", "error");
    }
  };
  const handleAnonymizedReactivated = (newEmail) => {
    const u = reactivateAnonymizedTarget;
    setUsers(p => p.map(x => x.id === u.id ? { ...x, status: "active", email: newEmail } : x));
    if (detailUser?.id === u.id) setDetailUser(p => ({ ...p, status: "active", email: newEmail }));
    setReactivateAnonymizedTarget(null);
    msg(`Account reactivated. Reset sent to ${newEmail}`);
  };
  const handleDelete = async (u, mode) => {
    setDeleteLoading(true);
    // Auto-unassign caretaker from groups before deletion
    if (u.role === "caretaker") {
      const ctId = caretakers.find(c => String(c.user_id) === String(u.id))?.caretaker_id;
      if (ctId) {
        const affectedGroups = groups.filter(g => String(g.caretaker_id) === String(ctId));
        for (const g of affectedGroups) { try { await api.adminUnassignCaretaker(g.group_id); } catch {} }
        setGroups(p => p.map(g => String(g.caretaker_id) === String(ctId) ? { ...g, caretaker_id: null, caretaker_name: null } : g));
      }
    }
    try { await api.adminDeleteUser(u.id, mode); } catch {}
    const deletedUser = {
      ...u,
      firstName: "Deleted",
      lastName: `User #${u.id}`,
      email: `deleted_${u.id}@deleted.local`,
      phone: "—",
      address: "—",
      status: "inactive",
      role: u.role,
    };
    setUsers(p => p.map(x => x.id === u.id ? deletedUser : x));
    if (detailUser?.id === u.id) setDetailUser(p => ({ ...p, ...deletedUser }));
    msg(mode === "anonymize" ? "User anonymized." : "User account deleted. Retained data was anonymized.");
    setDeleteLoading(false); setDeleteTarget(null);
  };
  const handleEditSave = async (data) => {
    const orig = editTarget;
    const apiPayload = {};
    // Only include fields that changed AND are non-empty (prevents accidental overwrites)
    if (data.firstName.trim() && data.firstName.trim() !== (orig.firstName || "").trim()) apiPayload.first_name = data.firstName.trim();
    if (data.lastName.trim()  && data.lastName.trim()  !== (orig.lastName  || "").trim()) apiPayload.last_name  = data.lastName.trim();
    if (data.email.trim()     && data.email.trim()     !== (orig.email     || "").trim()) apiPayload.email      = data.email.trim();
    if (data.phone !== (orig.phone || "")) apiPayload.phone = data.phone || null;
    if (data.newPw) apiPayload.password = data.newPw;
    if (Object.keys(apiPayload).length > 0) {
      await api.adminUpdateUser(orig.id, apiPayload); // throws on error → caught by modal
    }
    setUsers(p => p.map(u => u.id === orig.id ? { ...u, ...data } : u));
    if (detailUser?.id === orig.id) setDetailUser(p => ({ ...p, ...data }));
    setEditTarget(null);
    msg("User updated.");
  };
  const handleChangeGroup = async (groupId) => {
    const isUnassign = groupId === "none";
    const g = isUnassign ? null : groups.find(x => x.group_id === groupId);
    for (const t of changeGroupTargets) {
      // throws on error — shared modal catches and shows inline
      await api.adminMoveParticipant(t.id, isUnassign ? null : groupId);
      setUsers(p => p.map(u => u.id === t.id ? { ...u, groupId: isUnassign ? null : groupId, group: g?.name || null, caretakerId: g?.caretaker_id || null, caretaker: g?.caretaker_name || null } : u));
      if (detailUser?.id === t.id) setDetailUser(p => ({ ...p, groupId: isUnassign ? null : groupId, group: g?.name || null }));
      setGroups(prev => prev.map(group => {
        if (group.group_id === t.groupId) return { ...group, member_count: Math.max(0, Number(group.member_count || 0) - 1) };
        if (!isUnassign && group.group_id === groupId) return { ...group, member_count: Number(group.member_count || 0) + 1 };
        return group;
      }));
      setGroupMembersByGroup(prev => {
        const next = { ...prev };
        if (t.groupId && Array.isArray(next[t.groupId])) {
          next[t.groupId] = next[t.groupId].filter(member => member.participant_id !== t.id);
        }
        if (!isUnassign && Array.isArray(next[groupId])) {
          const exists = next[groupId].some(member => member.participant_id === t.id);
          if (!exists) {
            next[groupId] = [
              ...next[groupId],
              { participant_id: t.id, name: `${t.firstName} ${t.lastName}`.trim() || t.email || "Unknown", joined_at: null },
            ];
          }
        }
        return next;
      });
    }
    setChangeGroupTargets(null);
    msg(isUnassign ? "Removed from group." : `Moved to "${g?.name}".`);
  };
  const handleAssignCaretaker = async (group, userId) => {
    try {
      await api.adminAssignCaretaker(userId, group.group_id);
      const ct = caretakers.find(c => String(c.user_id) === String(userId));
      setGroups(p => p.map(g => g.group_id === group.group_id ? { ...g, caretaker_id: ct?.caretaker_id || userId, caretaker_name: ct?.name || "Assigned" } : g));
      setAssignCaretakerTarget(null);
      msg(`${ct?.name || "Caretaker"} assigned to "${group.name}".`);
    } catch (err) {
      msg(err.message || "Failed to assign caretaker.", "error");
    }
  };
  const handleUnassignCaretaker = async (group) => {
    try {
      await api.adminUnassignCaretaker(group.group_id);
      setGroups(p => p.map(g => g.group_id === group.group_id ? { ...g, caretaker_id: null, caretaker_name: null } : g));
      msg(`Caretaker removed from "${group.name}".`);
    } catch (err) {
      msg(err.message || "Failed to remove caretaker.", "error");
    }
  };
  const handleChangeRole = async (user, newRole) => {
    try {
      await api.adminUpdateUser(user.id, { role: newRole });
      await fetchData();
    } catch (err) {
      msg(err.message || "Failed to change role.", "error");
      return;
    }
    setChangeRoleTarget(null);
    msg(`${user.firstName} is now a ${newRole}.`);
  };
  const handleEditGroup = async (group, newName, newDesc) => {
    try { await api.adminUpdateGroup(group.group_id, { name: newName, description: newDesc }); } catch {}
    setGroups(p => p.map(g => g.group_id === group.group_id ? { ...g, name: newName, description: newDesc } : g));
    setEditGroupTarget(null);
    msg(`Group renamed to "${newName}".`);
  };
  const handleExportCSV = () => {
    if (filtered.length === 0) { msg("No users to export.", "error"); return; }
    const cols = ["Name", "Email", "Role", "Status", "Group", "Caretaker", "Joined"];
    const rows = filtered.map(u => [
      `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      u.email || "", u.role || "", u.status || "", u.group || "", u.caretaker || "", u.joinedAt || "",
    ]);
    const csv = [cols.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    msg(`Exported ${filtered.length} users.`);
  };


  // Load health goals lazily when "Health goals" tab is opened in the group modal
  useEffect(() => {
    if (groupModalTab !== "Health goals" || !selectedGroupModal || groupModalGoals !== null) return;
    const members = groupMembersByGroup[selectedGroupModal.group_id] || [];
    if (members.length === 0) { setGroupModalGoals({}); return; }
    setGroupModalGoalsLoading(true);
    api.adminGetGroupGoals(selectedGroupModal.group_id)
      .then(goalsMap => setGroupModalGoals(goalsMap || {}))
      .catch(() => setGroupModalGoals({}))
      .finally(() => setGroupModalGoalsLoading(false));
  }, [groupModalTab, selectedGroupModal, groupModalGoals, groupMembersByGroup]);

  const openGroupModal = async (group) => {
    setSelectedGroupModal(group);
    setGroupModalTab("Participants");
    setGroupModalPage(1);
    setGroupModalSurveys([]);
    setGroupModalGoals(null);
    // Load members if not cached
    if (!groupMembersByGroup[group.group_id] && !groupMembersLoading[group.group_id]) {
      setGroupMembersLoading(prev => ({ ...prev, [group.group_id]: true }));
      try {
        const members = await api.adminGetGroupMembers(group.group_id);
        setGroupMembersByGroup(prev => ({ ...prev, [group.group_id]: Array.isArray(members) ? members : [] }));
      } catch { setGroupMembersByGroup(prev => ({ ...prev, [group.group_id]: [] })); }
      finally { setGroupMembersLoading(prev => ({ ...prev, [group.group_id]: false })); }
    }
    // Load surveys
    setGroupModalSurveysLoading(true);
    try {
      const surveys = await api.getGroupSurveys(group.group_id);
      setGroupModalSurveys(Array.isArray(surveys) ? surveys : []);
    } catch { setGroupModalSurveys([]); }
    finally { setGroupModalSurveysLoading(false); }
  };

  const handleRemoveGroupMember = async (member, group) => {
    try {
      await api.adminMoveParticipant(member.participant_id, null);
      setGroupMembersByGroup(prev => ({
        ...prev,
        [group.group_id]: (prev[group.group_id] || []).filter(m => m.participant_id !== member.participant_id),
      }));
      setGroups(p => p.map(g => g.group_id === group.group_id ? { ...g, member_count: Math.max(0, Number(g.member_count || 0) - 1) } : g));
      setUsers(p => p.map(u => u.id === member.participant_id ? { ...u, groupId: null, group: null } : u));
      msg(`${member.name} removed from group.`);
    } catch (err) { msg(err.message || "Failed to remove participant.", "error"); }
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const getColumns = () => { switch (activeRole) { case "participant": return ["Name", "Group", "Caretaker", "Status", "Joined"]; case "caretaker": return ["Name", "Group", "Organization", "Title", "Status"]; case "researcher": return ["Name", "Institution", "Department", "Status"]; case "admin": return ["Name", "Email", "Status", "Joined"]; default: return ["Name", "Email", "Role", "Status", "Joined"]; } };
  const getCell = (u, col) => { switch (col) { case "Name": return <div className="flex items-center gap-3 min-w-0"><Avatar name={`${u.firstName} ${u.lastName}`} size="sm" /><div><p className="text-sm font-semibold text-slate-800 truncate">{u.firstName} {u.lastName}</p><div className="flex items-center gap-1.5 mt-0.5 flex-wrap">{isLocked(u) && <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded uppercase">Locked</span>}{u.email?.startsWith("deleted_") && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Anonymized</span>}</div></div></div>; case "Email": return <span className="text-sm text-slate-500 truncate">{u.email}</span>; case "Role": return <RoleBadge role={u.role} />; case "Status": return <div className="flex items-center gap-1.5 flex-wrap"><StatusDot status={u.status} /><span className="text-xs text-slate-500 capitalize">{u.status}</span>{isLocked(u) && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase">Locked</span>}</div>; case "Joined": return <span className="text-xs text-slate-400">{fmt(u.joinedAt)}</span>; case "Group": {
      if (u.role === "caretaker") {
        const ct = caretakers.find(c => String(c.user_id) === String(u.id));
        const grps = ct ? groups.filter(g => String(g.caretaker_id) === String(ct.caretaker_id)) : [];
        if (grps.length === 0) return <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Unassigned</span>;
        return <div className="flex flex-wrap gap-1">{grps.map(g => <span key={g.group_id} className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{g.name}</span>)}</div>;
      }
      return u.group ? <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{u.group}</span> : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Unassigned</span>;
    } case "Caretaker": return <span className="text-xs text-slate-600">{u.caretaker || "—"}</span>; case "Organization": return <span className="text-xs text-slate-600">{u.organization || "—"}</span>; case "Title": return <span className="text-xs text-slate-600">{u.title || "—"}</span>; case "Institution": return <span className="text-xs text-slate-600">{u.institution || "—"}</span>; case "Department": return <span className="text-xs text-slate-600">{u.department || "—"}</span>; default: return "—"; } };
  const columns = getColumns();

  const colSortMap = { Name: "name", Email: "email", Role: "role", Status: "status", Joined: "joined", Group: "group" };
  const showGroupColumn = !activeRole || activeRole === "participant" || activeRole === "caretaker";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <style>{`@keyframes slide-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}.animate-slide-in{animation:slide-in .3s ease-out}`}</style>
      <Toast {...toast} onClose={() => setToast(p => ({ ...p, show: false }))} />
      <UserDrawer user={detailUser} users={users} groups={groups} caretakers={caretakers} onClose={() => setDetailUser(null)} onEdit={setEditTarget} onDeactivate={setDeactivateTarget} onReactivate={handleReactivate} onUnlock={handleUnlock} onDelete={setDeleteTarget} onChangeGroup={setChangeGroupTargets} onChangeRole={setChangeRoleTarget} />
      <InviteModal open={showInvite} onClose={() => { setShowInvite(false); setInvitePreRole(""); }} groups={groups} preselectedRole={invitePreRole} onError={(m) => msg(m, "error")} onInviteSent={() => { refreshInvites(); msg("Invite sent."); }} />
      <CreateGroupModal open={showCreateGroup} onClose={() => setShowCreateGroup(false)} caretakers={caretakers} users={users} onConfirm={(newGroup, cId, error, assignedParticipants) => { if (error) { msg(error, "error"); return; } const ct = caretakers.find(c => String(c.user_id) === cId); const gid = String(newGroup.group_id); setGroups(p => [...p, { ...newGroup, group_id: gid, caretaker_id: cId || null, caretaker_name: ct?.name || null, member_count: (assignedParticipants || []).length }]); if (assignedParticipants?.length) { setUsers(p => p.map(u => assignedParticipants.includes(u.id) ? { ...u, groupId: gid, group: newGroup.name } : u)); } setShowCreateGroup(false); msg(`"${newGroup.name}" created${assignedParticipants?.length ? ` with ${assignedParticipants.length} participant${assignedParticipants.length > 1 ? "s" : ""}` : ""}.`); }} />
      <EditUserModal key={editTarget?.id || "edit"} open={!!editTarget} onClose={() => setEditTarget(null)} user={editTarget} onSave={handleEditSave} />
      <ChangeGroupModal open={!!changeGroupTargets} onClose={() => setChangeGroupTargets(null)} targets={changeGroupTargets || []} groups={groups} onMove={handleChangeGroup} />
      <ChangeRoleModal open={!!changeRoleTarget} onClose={() => setChangeRoleTarget(null)} user={changeRoleTarget} onConfirm={handleChangeRole} />
      <EditGroupModal open={!!editGroupTarget} onClose={() => setEditGroupTarget(null)} group={editGroupTarget} onSave={handleEditGroup} />
      <DeactivateModal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} user={deactivateTarget} onConfirm={() => handleDeactivate(deactivateTarget)} loading={deactivateLoading} />
      <DeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} user={deleteTarget} onDelete={(mode) => handleDelete(deleteTarget, mode)} loading={deleteLoading} />
      <RevokeModal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} onConfirm={async () => { setRevokeLoading(true); try { await api.adminRevokeInvite(revokeTarget.invite_id); } catch {} setInvites(p => p.map(i => i.invite_id === revokeTarget.invite_id ? { ...i, status: "revoked" } : i)); setRevokeLoading(false); setRevokeTarget(null); msg("Invite revoked."); }} invite={revokeTarget} loading={revokeLoading} />
      <AssignCaretakerModal open={!!assignCaretakerTarget} onClose={() => setAssignCaretakerTarget(null)} group={assignCaretakerTarget} caretakers={caretakers} onAssign={handleAssignCaretaker} />
      <ReactivateModal open={!!reactivateTarget} onClose={() => setReactivateTarget(null)} user={reactivateTarget} onConfirm={confirmReactivate} loading={reactivateLoading} />
      <ReactivateAnonymizedModal open={!!reactivateAnonymizedTarget} onClose={() => setReactivateAnonymizedTarget(null)} user={reactivateAnonymizedTarget} onConfirm={handleAnonymizedReactivated} />
      <AddParticipantsModal open={!!addParticipantsTarget} onClose={() => setAddParticipantsTarget(null)} group={addParticipantsTarget} onConfirm={(group, pIds) => { setUsers(p => p.map(u => pIds.includes(u.id) ? { ...u, groupId: group.group_id, group: group.name } : u)); setGroups(prev => prev.map(g => g.group_id === group.group_id ? { ...g, member_count: Number(g.member_count || 0) + pIds.length } : g)); setGroupMembersByGroup(prev => { if (!Array.isArray(prev[group.group_id])) return prev; const additions = users.filter(u => pIds.includes(u.id)).map(u => ({ participant_id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.email || "Unknown", joined_at: null })).filter(member => !prev[group.group_id].some(existing => existing.participant_id === member.participant_id)); return { ...prev, [group.group_id]: [...prev[group.group_id], ...additions] }; }); setAddParticipantsTarget(null); msg(`${pIds.length} participant${pIds.length > 1 ? "s" : ""} added to "${group.name}".`); }} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800">Users & Roles</h1><p className="text-sm text-slate-500 mt-1">Manage accounts, groups, invites, and permissions</p></div><div className="flex items-center gap-2 shrink-0"><button onClick={handleExportCSV} disabled={filtered.length === 0} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-2 disabled:opacity-40"><IconDownload /> Export CSV</button><button onClick={() => setShowInvite(true)} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2"><IconMail /> Invite User</button></div></div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{ROLES.map(r => { const a = activeRole === r.value; return <button key={r.value} onClick={() => setActiveRole(a ? null : r.value)} className={`bg-white rounded-2xl p-5 border shadow-sm transition-all text-left ${a ? `${r.border} ring-2 ring-current ${r.lightBg}` : "border-slate-100 hover:border-slate-200 hover:shadow-md"}`}><div className="flex items-center justify-between mb-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a ? `${r.color} text-white` : `${r.lightBg} ${r.lightText}`}`}><Ic d={r.icon} c="h-5 w-5" /></div>{a && <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Filtered</span>}</div><p className="text-3xl font-extrabold text-slate-800">{loading ? "—" : counts[r.value]}</p><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">{r.label}</p></button>; })}</div>

      {/* Groups & Cohorts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button onClick={() => setGroupsExpanded(!groupsExpanded)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><IconUsers /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Groups & Cohorts</h2>
              <p className="text-xs text-slate-400">{loading ? "Loading…" : `${groups.length} group${groups.length !== 1 ? "s" : ""}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span onClick={e => { e.stopPropagation(); setShowCreateGroup(true); }} className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
              <IconPlus /> New
            </span>
            <IconChevron open={groupsExpanded} />
          </div>
        </button>
        {groupsExpanded && (
          <div className="border-t border-slate-100">
            {groups.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-400">No groups yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {groups.map(g => (
                  <button key={g.group_id} onClick={() => openGroupModal(g)}
                    className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-slate-50/60 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${g.caretaker_id ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                      <IconUsers />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{g.name}</p>
                      {g.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{g.description}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{Number(g.member_count || 0)} member{Number(g.member_count || 0) !== 1 ? "s" : ""}</p>
                    </div>
                    {g.caretaker_name && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0 hidden sm:inline-flex">{g.caretaker_name}</span>
                    )}
                    <svg className="h-4 w-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invites Tracker */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><button onClick={() => setInvitesExpanded(!invitesExpanded)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/50"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><IconSend /></div><div><h2 className="text-base font-bold text-slate-800">Invites Tracker</h2><div className="flex items-center gap-2 mt-0.5 flex-wrap">{invites.length === 0 ? <span className="text-xs text-slate-400">{invitesAvailable === null || loading ? "Loading…" : invitesAvailable ? "No invites yet" : "Failed to load invites"}</span> : <>{inviteCounts.pending > 0 && <span className="text-xs font-semibold text-amber-600">{inviteCounts.pending} pending</span>}{inviteCounts.accepted > 0 && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-emerald-600">{inviteCounts.accepted} accepted</span></>}</>}</div></div></div><IconChevron open={invitesExpanded} /></button>
        {invitesExpanded && <div className="border-t border-slate-100">
          {(invitesAvailable === null || loading) && invites.length === 0 ? (
            <div className="px-6 py-8 text-center"><p className="text-sm text-slate-400">Loading invites…</p></div>
          ) : !invitesAvailable && invites.length === 0 ? (
            <div className="p-6"><ApiPendingBanner endpoint="GET /admin_only/invites" description="Could not load invites from backend. Try refresh, then check backend logs if it persists." /></div>
          ) : <>
            <div className="px-6 py-3 border-b border-slate-50 space-y-3"><div className="flex gap-1.5 overflow-x-auto pb-0.5">{[{ v: "all", l: "All" }, { v: "pending", l: "Pending" }, { v: "accepted", l: "Accepted" }, { v: "expired", l: "Expired" }, { v: "revoked", l: "Revoked" }].map(t => <button key={t.v} onClick={() => setInviteFilter(t.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${inviteFilter === t.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{t.l} <span className="opacity-60">({inviteCounts[t.v]})</span></button>)}</div><div className="flex flex-col sm:flex-row gap-2"><div className="relative flex-1"><div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"><IconSearch /></div><input value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Email or sender…" name="invite-search" autoComplete="off" className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-300" /></div><select value={inviteRoleFilter} onChange={e => setInviteRoleFilter(e.target.value)} className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-600"><option value="all">All Roles</option>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label.replace(/s$/, "")}</option>)}</select><select value={inviteDateFilter} onChange={e => setInviteDateFilter(e.target.value)} className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-600"><option value="all">Any Time</option><option value="24h">24h</option><option value="7d">7 days</option><option value="30d">30 days</option></select></div>{hasInvFilters && <div className="flex items-center justify-between"><p className="text-xs text-slate-400">{filteredInvites.length} match</p><button onClick={() => { setInviteSearch(""); setInviteRoleFilter("all"); setInviteGroupFilter("all"); setInviteDateFilter("all"); }} className="text-xs font-semibold text-blue-600">Clear</button></div>}</div>
            {filteredInvites.length === 0 ? <div className="px-6 py-8 text-center"><p className="text-sm text-slate-400">No invites match your filters.</p></div> : <div className="divide-y divide-slate-50">{filteredInvites.map(inv => { const s = INV_STYLES[inv.status] || INV_STYLES.pending; return <div key={inv.invite_id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50"><div className="flex items-center gap-3 flex-1 min-w-0"><div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.bg} ${s.text}`}><IconMail /></div><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="text-sm font-semibold text-slate-700 truncate">{inv.email}</p><RoleBadge role={inv.role} /></div><div className="flex items-center gap-2 mt-0.5 flex-wrap">{inv.group_name && <span className="text-xs text-emerald-600 font-medium">{inv.group_name}</span>}{inv.invited_by && <span className="text-xs text-slate-400">by {inv.invited_by}</span>}<span className="flex items-center gap-1 text-xs text-slate-400"><IconClock /> {fmtTime(inv.created_at)}</span></div></div></div><div className="flex items-center gap-2 pl-12 sm:pl-0 shrink-0">{inv.status === "pending" && inv.expires_at && <span className="text-xs text-amber-600 font-medium">{timeUntil(inv.expires_at)}</span>}<span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</span>{inv.status === "pending" && <button onClick={() => setRevokeTarget(inv)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"><IconBan /></button>}{inv.status === "expired" && <button onClick={() => { setInvites(p => p.map(i => i.invite_id === inv.invite_id ? { ...i, status: "pending", expires_at: new Date(Date.now() + 48 * 3600000).toISOString() } : i)); msg(`Resent to ${inv.email}.`); }} className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50"><IconRefresh /></button>}</div></div>; })}</div>}
            {invitesHasMore && !hasInvFilters && (
              <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">Loaded {invitesOffset} invites</p>
                <button
                  onClick={loadMoreInvites}
                  disabled={invitesLoadingMore}
                  className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {invitesLoadingMore ? <><Spinner /> Loading…</> : "Load More Invites"}
                </button>
              </div>
            )}
          </>}
        </div>}
      </div>

      {/* ═══ ENHANCED SEARCH + FILTERS + SORT ═══ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"><IconSearch /></div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email…" name="user-search" autoComplete="off"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-300" />
          </div>
          {(search || activeFilterCount > 0) && (
            <button onClick={clearFilters} className="px-3 py-2.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shrink-0 flex items-center gap-1">
              <IconX /> Clear{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {showGroupColumn && groups.length > 0 && (
            <SearchableSelect
              value={filterGroup}
              onChange={setFilterGroup}
              placeholder="All Groups"
              options={[
                { value: "all", label: "All Groups" },
                { value: "unassigned", label: "Unassigned" },
                ...groups.map(g => ({ value: g.group_id, label: g.name })),
              ]}
            />
          )}

          {showGroupColumn && caretakers.length > 0 && (
            <SearchableSelect
              value={filterCaretaker}
              onChange={setFilterCaretaker}
              placeholder="All Caretakers"
              options={[
                { value: "all", label: "All Caretakers" },
                { value: "none", label: "No Caretaker" },
                ...caretakers.map(c => ({ value: c.caretaker_id, label: c.name })),
              ]}
            />
          )}
        </div>

        {/* Sort row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">Sort</span>
          {[
            { field: "name",   label: "Name" },
            { field: "status", label: "Status" },
            { field: "joined", label: "Joined" },
          ].map(s => (
            <button key={s.field} onClick={() => handleSort(s.field)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${sort.field === s.field ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {s.label}
              {sort.field === s.field && <IconSort dir={sort.dir} />}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk */}
      {selected.size > 0 && <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between"><p className="text-sm font-semibold text-white">{selected.size} selected</p><div className="flex items-center gap-2">{users.filter(u => selected.has(u.id)).every(u => u.role === "participant") && <button onClick={() => setChangeGroupTargets(users.filter(u => selected.has(u.id)))} className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-900/50 rounded-lg hover:bg-emerald-800/60">Move Group</button>}<button onClick={async () => { const sel = users.filter(u => selected.has(u.id) && u.status === "active"); if (sel.length === 0) { msg("No active users in selection.", "error"); return; } for (const u of sel) { try { await api.adminUpdateUserStatus(u.id, "inactive"); } catch {} } setUsers(p => p.map(u => selected.has(u.id) ? { ...u, status: "inactive" } : u)); setSelected(new Set()); msg(`${sel.length} user${sel.length > 1 ? "s" : ""} deactivated.`); }} className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-900/50 rounded-lg hover:bg-amber-800/60">Deactivate</button><button onClick={async () => { const sel = users.filter(u => selected.has(u.id) && u.status === "inactive"); if (sel.length === 0) { msg("No inactive users in selection.", "error"); return; } for (const u of sel) { try { await api.adminUpdateUserStatus(u.id, "active"); } catch {} } setUsers(p => p.map(u => selected.has(u.id) && u.status === "inactive" ? { ...u, status: "active" } : u)); setSelected(new Set()); msg(`${sel.length} user${sel.length > 1 ? "s" : ""} reactivated.`); }} className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-900/50 rounded-lg hover:bg-emerald-800/60">Reactivate</button><button onClick={async () => { const sel = users.filter(u => selected.has(u.id) && u.status === "inactive"); if (sel.length === 0) { msg("Only inactive users can be deleted. Deactivate first.", "error"); return; } for (const u of sel) { try { await api.adminDeleteUser(u.id, "anonymize"); } catch {} } setUsers(p => p.filter(u => !selected.has(u.id) || u.status === "active").map(u => { if (!selected.has(u.id)) return u; return { ...u, firstName: "Deleted", lastName: `User #${u.id}`, email: `deleted_${u.id}@removed.local`, phone: "—", status: "inactive" }; })); setSelected(new Set()); msg(`${sel.length} user${sel.length > 1 ? "s" : ""} anonymized.`); }} className="px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-900/50 rounded-lg hover:bg-rose-800/60">Delete</button><button onClick={() => setSelected(new Set())} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">Clear</button></div></div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">
            {loading
              ? "Loading…"
              : hasUserFilters
                ? `${filtered.length} matching filters • ${users.length} loaded${usersTotal ? ` of ${usersTotal}` : ""} users`
                : `${users.length} shown${usersTotal ? ` of ${usersTotal}` : ""} users`}
          </p>
          <div className="flex items-center gap-2">
            {!loading && hasUserFilters && hasMoreUsers && (
              <span className="text-[11px] text-slate-400">Searching all users…</span>
            )}
            {!loading && usersAvailable && hasMoreUsers && (
              <button
                onClick={loadMoreUsers}
                disabled={usersLoadingMore}
                className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
              >
                {usersLoadingMore ? <><Spinner /> Loading…</> : "Load More"}
              </button>
            )}
            {activeRole && <button onClick={() => setActiveRole(null)} className="text-xs font-semibold text-blue-600 flex items-center gap-1"><IconX /> Clear</button>}
          </div>
        </div>
        {loading ? <div className="px-6 py-16 flex flex-col items-center gap-3"><BigSpinner /><p className="text-sm text-slate-400">Loading users…</p></div>
          : !usersAvailable && users.length === 0 ? <div className="p-6"><ApiPendingBanner endpoint="GET /admin_only/users (or /admin_only/users/paged)" description={usersError || "Could not load users from backend. Check API/container logs and retry."} /></div>
          : filtered.length === 0 ? <div className="px-6 py-12 text-center"><p className="text-sm text-slate-400">No users match your filters.</p><button onClick={clearFilters} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800">Clear all filters</button></div>
          : <>
            {/* ── Mobile card list (< sm) ── */}
            <div className="sm:hidden divide-y divide-slate-50">
              {filtered.map(user => {
                const isSel = selected.has(user.id);
                return (
                  <div key={user.id} onClick={() => setDetailUser(user)}
                    className={`px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-colors ${isSel ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
                    <div onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(user.id)}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                    </div>
                    <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">
                          {user.firstName} {user.lastName}
                        </p>
                        <RoleBadge role={user.role} />
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusDot status={user.status} />
                        <span className="text-xs text-slate-500 capitalize">{user.status}</span>
                        {user.group && <span className="text-xs text-emerald-600 font-medium">{user.group}</span>}
                        {isLocked(user) && <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded uppercase">Locked</span>}
                      </div>
                    </div>
                    <svg className="h-4 w-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table (≥ sm) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="bg-slate-50/80">
                  <th className="pl-4 pr-2 py-3 w-10"><input type="checkbox" checked={allSel} onChange={toggleAll} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" /></th>
                  {columns.map(col => {
                    const sf = colSortMap[col];
                    return <th key={col} className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {sf ? <button onClick={() => handleSort(sf)} className="inline-flex items-center gap-1 hover:text-slate-600 transition-colors">{col}{sort.field === sf && <IconSort dir={sort.dir} />}</button> : col}
                    </th>;
                  })}
                  <th className="px-3 py-3 w-12"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(user => (
                    <tr key={user.id} onClick={() => setDetailUser(user)}
                      className={`transition-colors cursor-pointer ${selected.has(user.id) ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                      <td className="pl-4 pr-2 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleOne(user.id)} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                      </td>
                      {columns.map(col => (
                        <td key={col} className={`px-3 py-3 ${col === "Name" ? "max-w-[200px] overflow-hidden" : "whitespace-nowrap"}`}>
                          {getCell(user, col)}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>}
        {!loading && usersAvailable && hasMoreUsers && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Loaded {usersOffset} of {usersTotal} users
            </p>
            <button
              onClick={loadMoreUsers}
              disabled={usersLoadingMore}
              className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
            >
              {usersLoadingMore ? <><Spinner /> Loading…</> : "Load More"}
            </button>
          </div>
        )}
      </div>

      {/* ════════════ GROUP DETAIL MODAL ════════════ */}
      {selectedGroupModal && (() => {
        const g = groups.find(x => x.group_id === selectedGroupModal.group_id) || selectedGroupModal;
        const modalMembers = groupMembersByGroup[g.group_id] || [];
        const modalMembersLoading = !!groupMembersLoading[g.group_id];
        const MODAL_TABS = ["Participants", "Survey forms", "Health goals"];
        return (
          <div className="fixed inset-0 z-40 flex flex-col sm:items-center sm:justify-center sm:bg-slate-900/40"
            onClick={e => e.target === e.currentTarget && setSelectedGroupModal(null)}>
            <div className="flex-1 sm:flex-none w-full sm:max-w-2xl bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-2xl flex flex-col sm:max-h-[90vh]">

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><IconUsers /></div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-800 truncate">{g.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {g.description && <><span className="truncate">{g.description}</span><span className="mx-1.5">·</span></>}
                      {Number(g.member_count || 0)} member{Number(g.member_count || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedGroupModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5"><IconX /></button>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2 shrink-0">
                <button onClick={() => setAddParticipantsTarget(g)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  <IconPlus /> Add participant
                </button>
                <button onClick={() => setEditGroupTarget(g)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                  <IconEdit /> Edit
                </button>
                <button onClick={() => handleDeleteGroup(g)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">
                  <IconTrash /> Delete
                </button>
              </div>

              {/* Caretaker banner */}
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <p className="text-xs text-slate-600">
                  {g.caretaker_name
                    ? <><span className="text-slate-400">Caretaker: </span><span className="font-semibold text-slate-700">{g.caretaker_name}</span></>
                    : <span className="text-amber-600 font-medium">No caretaker assigned</span>}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setAssignCaretakerTarget(g)}
                    className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors">
                    {g.caretaker_name ? "Reassign" : "Assign"}
                  </button>
                  {g.caretaker_name && (
                    <button onClick={() => handleUnassignCaretaker(g)}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors">
                      Unassign
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto">
                {MODAL_TABS.map(t => (
                  <button key={t} onClick={() => { setGroupModalTab(t); setGroupModalPage(1); }}
                    className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      groupModalTab === t ? "text-blue-600 border-blue-600 bg-blue-50/30" : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                    }`}>
                    {t}
                    {t === "Participants" && <span className="ml-1.5 text-[11px] text-slate-400">({modalMembers.length})</span>}
                    {t === "Survey forms" && groupModalSurveys.length > 0 && <span className="ml-1.5 text-[11px] text-slate-400">({groupModalSurveys.length})</span>}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {(() => {
                // Compute paged slices for all three tabs
                const pMembers  = modalMembers;
                const pSurveys  = groupModalSurveys;
                const pGoals    = modalMembers; // iterate members for goals tab
                const activeList = groupModalTab === "Participants" ? pMembers
                                 : groupModalTab === "Survey forms"  ? pSurveys
                                 : pGoals;
                const totalPages = Math.max(1, Math.ceil(activeList.length / GROUP_MODAL_PAGE_SIZE));
                const safePage   = Math.min(groupModalPage, totalPages);
                const sliceStart = (safePage - 1) * GROUP_MODAL_PAGE_SIZE;
                const sliceEnd   = sliceStart + GROUP_MODAL_PAGE_SIZE;
                const pagedMembers  = pMembers.slice(sliceStart, sliceEnd);
                const pagedSurveys  = pSurveys.slice(sliceStart, sliceEnd);
                const pagedGoalRows = pGoals.slice(sliceStart, sliceEnd);

                const Pagination = () => activeList.length <= GROUP_MODAL_PAGE_SIZE ? null : (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 shrink-0 bg-white">
                    <p className="text-xs text-slate-400">
                      <span className="font-semibold text-slate-600">{sliceStart + 1}–{Math.min(sliceEnd, activeList.length)}</span> of {activeList.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setGroupModalPage(1)} disabled={safePage === 1}
                        className="px-2 py-1 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">First</button>
                      <button onClick={() => setGroupModalPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                        className="px-2 py-1 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg">{safePage}</span>
                      <button onClick={() => setGroupModalPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                        className="px-2 py-1 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                      <button onClick={() => setGroupModalPage(totalPages)} disabled={safePage === totalPages}
                        className="px-2 py-1 text-xs font-semibold text-slate-500 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">Last</button>
                    </div>
                  </div>
                );

                return (
                  <>
                    <div className="overflow-y-auto flex-1">

                      {/* Participants */}
                      {groupModalTab === "Participants" && (
                        modalMembersLoading ? (
                          <div className="py-12 text-center"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                        ) : pMembers.length === 0 ? (
                          <div className="py-14 text-center px-6">
                            <p className="text-sm font-semibold text-slate-600 mb-1">No participants yet</p>
                            <p className="text-xs text-slate-400 mb-4">Add participants to this group.</p>
                            <button onClick={() => setAddParticipantsTarget(g)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                              <IconPlus /> Add participant
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {pagedMembers.map(m => (
                              <div key={m.participant_id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                <Avatar name={m.name} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <button onClick={() => openUserDrawerFromGroup(m.participant_id)}
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left truncate block">
                                    {m.name}
                                  </button>
                                  <p className="text-xs text-slate-400 mt-0.5">Joined {fmt(m.joined_at)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <StatusDot status={m.status || "active"} />
                                  <span className="text-xs text-slate-500 capitalize hidden sm:inline">{m.status || "active"}</span>
                                  <button onClick={() => handleRemoveGroupMember(m, g)}
                                    className="text-xs font-semibold text-rose-400 hover:text-rose-600 transition-colors ml-1">
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* Survey forms */}
                      {groupModalTab === "Survey forms" && (
                        groupModalSurveysLoading ? (
                          <div className="py-12 text-center"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                        ) : pSurveys.length === 0 ? (
                          <div className="py-14 text-center px-6">
                            <p className="text-sm font-semibold text-slate-600 mb-1">No surveys published to this group</p>
                            <p className="text-xs text-slate-400">Publish a survey from the Survey Builder to assign it here.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {pagedSurveys.map((s, i) => (
                              <div key={s.form_id || s.id || i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-700 truncate">{s.title || s.name || "Untitled form"}</p>
                                  {s.published_at && <p className="text-xs text-slate-400 mt-0.5">Published {fmt(s.published_at)}</p>}
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                  s.status === "published" || s.is_published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {s.status || (s.is_published ? "published" : "draft")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* Health goals */}
                      {groupModalTab === "Health goals" && (
                        groupModalGoalsLoading ? (
                          <div className="py-12 text-center"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
                        ) : pGoals.length === 0 ? (
                          <div className="py-14 text-center px-6">
                            <p className="text-sm text-slate-400">No participants to show goals for.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {pagedGoalRows.map(m => {
                              const memberGoals = groupModalGoals?.[m.participant_id] || [];
                              const active    = memberGoals.filter(gl => gl.status === "active" || gl.status === "in_progress").length;
                              const completed = memberGoals.filter(gl => gl.status === "completed").length;
                              return (
                                <div key={m.participant_id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                                  <Avatar name={m.name} size="sm" />
                                  <div className="flex-1 min-w-0">
                                    <button onClick={() => openUserDrawerFromGroup(m.participant_id)}
                                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline text-left truncate block">
                                      {m.name}
                                    </button>
                                    {groupModalGoals === null ? (
                                      <p className="text-xs text-slate-400 mt-0.5">Loading…</p>
                                    ) : memberGoals.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic mt-0.5">No goals set</p>
                                    ) : (
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {active > 0 && <span className="text-blue-600 font-medium">{active} active</span>}
                                        {active > 0 && completed > 0 && <span className="mx-1">·</span>}
                                        {completed > 0 && <span className="text-emerald-600 font-medium">{completed} completed</span>}
                                        {active === 0 && completed === 0 && `${memberGoals.length} goal${memberGoals.length !== 1 ? "s" : ""}`}
                                      </p>
                                    )}
                                  </div>
                                  {groupModalGoals !== null && memberGoals.length > 0 && (
                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">{memberGoals.length}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                    <Pagination />
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

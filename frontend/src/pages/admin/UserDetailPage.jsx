import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../services/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES = [
  { value: "participant", label: "Participants", lightBg: "bg-blue-50", lightText: "text-blue-700", border: "border-blue-200" },
  { value: "caretaker", label: "Caretakers", lightBg: "bg-emerald-50", lightText: "text-emerald-700", border: "border-emerald-200" },
  { value: "researcher", label: "Researchers", lightBg: "bg-indigo-50", lightText: "text-indigo-700", border: "border-indigo-200" },
  { value: "admin", label: "Admins", lightBg: "bg-rose-50", lightText: "text-rose-700", border: "border-rose-200" },
];

const ACTION_STYLES = {
  LOGIN_SUCCESS:        { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Login" },
  LOGIN_FAILED:         { bg: "bg-rose-50",    tx: "text-rose-700",    lb: "Failed Login" },
  LOGOUT:               { bg: "bg-slate-100",  tx: "text-slate-600",   lb: "Logout" },
  SURVEY_SUBMITTED:     { bg: "bg-blue-50",    tx: "text-blue-700",    lb: "Survey Submitted" },
  GOAL_LOGGED:          { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Goal Logged" },
  PASSWORD_RESET_REQ:   { bg: "bg-amber-50",   tx: "text-amber-700",   lb: "Password Reset Requested" },
  PASSWORD_RESET:       { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Password Reset" },
  REGISTER:             { bg: "bg-indigo-50",  tx: "text-indigo-700",  lb: "Registered" },
  REGISTER_SUCCESS:     { bg: "bg-indigo-50",  tx: "text-indigo-700",  lb: "Registered" },
  USER_STATUS_CHANGED:  { bg: "bg-amber-50",   tx: "text-amber-700",   lb: "Status Changed" },
  USER_REACTIVATED:     { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Reactivated" },
  USER_DELETED:         { bg: "bg-rose-50",    tx: "text-rose-700",    lb: "User Deleted" },
  PROFILE_UPDATED:      { bg: "bg-blue-50",    tx: "text-blue-700",    lb: "Profile Updated" },
  FORM_CREATED:         { bg: "bg-blue-50",    tx: "text-blue-700",    lb: "Form Created" },
  FORM_PUBLISHED:       { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Form Published" },
  BACKUP_CREATED:       { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Backup Created" },
  CARETAKER_ASSIGNED:   { bg: "bg-emerald-50", tx: "text-emerald-700", lb: "Caretaker Assigned" },
  CARETAKER_UNASSIGNED: { bg: "bg-amber-50",   tx: "text-amber-700",   lb: "Caretaker Unassigned" },
  GROUP_CREATED:        { bg: "bg-violet-50",  tx: "text-violet-700",  lb: "Group Created" },
  ROLE_CHANGED:         { bg: "bg-indigo-50",  tx: "text-indigo-700",  lb: "Role Changed" },
  INVITE_SENT:          { bg: "bg-indigo-50",  tx: "text-indigo-700",  lb: "Invite Sent" },
};

const GOAL_BAR = { completed: "bg-emerald-500", in_progress: "bg-blue-500", active: "bg-blue-500", not_started: "bg-slate-300" };

// ── Shared UI ─────────────────────────────────────────────────────────────────
const Ic = ({ d, c = "h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
const Spinner = () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
const BigSpinner = () => <svg className="animate-spin h-8 w-8 text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

function Avatar({ name, size = "md" }) {
  const ini = (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const cols = ["bg-blue-500", "bg-emerald-500", "bg-indigo-500", "bg-rose-500", "bg-amber-500", "bg-violet-500"];
  const sz = size === "xl" ? "w-16 h-16 text-xl" : size === "lg" ? "w-12 h-12 text-base" : size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return <div className={`rounded-full ${cols[(name?.charCodeAt(0) || 0) % cols.length]} text-white flex items-center justify-center font-bold shrink-0 ${sz}`}>{ini}</div>;
}
function StatusDot({ status }) { return <span className={`inline-block w-2.5 h-2.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />; }
function RoleBadge({ role }) { const r = ROLES.find(x => x.value === role); return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${r?.lightBg || "bg-slate-100"} ${r?.lightText || "text-slate-600"}`}>{role}</span>; }
function InfoRow({ label, value }) { return <div className="flex justify-between py-2 border-b border-slate-50 last:border-0"><span className="text-xs text-slate-400">{label}</span><span className="text-sm text-slate-700 font-medium text-right max-w-[60%]">{value || <span className="text-slate-300 italic">—</span>}</span></div>; }
function StatCard({ label, value, sub, icon, color = "blue" }) { const c = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", violet: "bg-violet-50 text-violet-600" }; return <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm"><div className="flex items-center gap-3 mb-2"><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c[color]}`}><Ic d={icon} c="h-4 w-4" /></div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p></div><p className="text-2xl font-extrabold text-slate-800">{value}</p>{sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}</div>; }
function Modal({ open, onClose, children }) { if (!open) return null; return <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} /><div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">{children}</div></div>; }
function Toast({ message, onClose }) { if (!message) return null; return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]"><div className="px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white bg-emerald-600">{message}</div></div>; }

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }); }
function fmtTime(d) { if (!d) return "—"; return new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function timeAgo(d) { if (!d) return "—"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return "Just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }
function isLocked(user) { return !!user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now(); }

function ApiPendingBanner({ endpoint, description }) {
  return <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
    <p className="text-sm text-slate-400">{description}</p>
    <p className="text-[10px] text-slate-300 font-mono mt-2">{endpoint}</p>
  </div>;
}

// ── Change Role Modal ─────────────────────────────────────────────────────────
function ChangeRoleModal({ open, onClose, user, onConfirm }) {
  const [sel, setSel] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const handle = async () => {
    if (!sel || sel === user.role) return;
    setLoading(true);
    try {
      await api.request(`/admin_only/linkrole`, { method: "POST", body: JSON.stringify({ user_id: user.id, role_name: sel }) });
      onConfirm(sel);
    } catch (err) { console.error("Role change failed:", err); }
    finally { setLoading(false); setSel(""); }
  };
  return <Modal open={open} onClose={() => { setSel(""); onClose(); }}>
    <h3 className="text-lg font-bold text-slate-800 mb-1">Change Role</h3>
    <p className="text-sm text-slate-400 mb-4">{user.firstName} {user.lastName} — currently <span className="font-semibold capitalize">{user.role}</span></p>
    <div className="space-y-2">{ROLES.map(r => { const cur = r.value === user.role; return <button key={r.value} onClick={() => setSel(r.value)} disabled={cur} className={`w-full text-left px-4 py-3 rounded-xl border transition-all capitalize ${cur ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : sel === r.value ? `${r.lightBg} ${r.border} ${r.lightText} ring-1 ring-current font-semibold` : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{r.value}{cur && <span className="text-xs ml-2 text-slate-400">(current)</span>}</button>; })}</div>
    {sel === "admin" && sel !== user.role && <div className="mt-3 bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700"><span className="font-semibold">Warning:</span> Admin has full platform access.</div>}
    <div className="flex gap-3 mt-5"><button onClick={() => { setSel(""); onClose(); }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={!sel || sel === user.role || loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">{loading ? <><Spinner /> Changing…</> : "Change Role"}</button></div>
  </Modal>;
}

// ── Change Group Modal (with No Group / Unassign option) ───────────────────────
function ChangeGroupModal({ open, onClose, user, groups, onConfirm }) {
  const [sel, setSel] = useState("");
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const handle = async () => {
    setLoading(true);
    try {
      if (sel === "none") {
        // Unassign: move to null group
        await api.adminMoveParticipant(user.id, null);
      } else {
        await api.adminMoveParticipant(user.id, sel);
      }
      onConfirm(sel === "none" ? null : sel);
    } catch (err) { console.error("Group change failed:", err); }
    finally { setLoading(false); setSel(""); }
  };
  return <Modal open={open} onClose={() => { setSel(""); onClose(); }}>
    <h3 className="text-lg font-bold text-slate-800 mb-1">Change Group</h3>
    <p className="text-sm text-slate-400 mb-4">{user.firstName} {user.lastName}{user.group ? ` — in ${user.group}` : " — no group"}</p>
    <div className="space-y-2">
      <button onClick={() => setSel("none")} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${sel === "none" ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
        <p className="text-sm font-semibold">No Group</p>
        <p className="text-xs text-slate-400 mt-0.5">Remove from all groups</p>
      </button>
      {(groups || []).map(g => {
        const cur = user.groupId && String(user.groupId) === String(g.group_id);
        return <button key={g.group_id} onClick={() => setSel(g.group_id)} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${sel === g.group_id ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300" : "border-slate-200 hover:bg-slate-50"}`}>
          <p className="text-sm font-semibold text-slate-700">{g.name}{cur && <span className="text-xs ml-2 text-emerald-600">(current)</span>}</p>
          {g.caretaker_name && <p className="text-xs text-slate-400 mt-0.5">{g.caretaker_name}</p>}
        </button>;
      })}
    </div>
    <div className="flex gap-3 mt-5"><button onClick={() => { setSel(""); onClose(); }} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={!sel || loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">{loading ? <><Spinner /> Moving…</> : sel === "none" ? "Unassign" : "Move"}</button></div>
  </Modal>;
}

// ── Deactivate / Reactivate Confirmation ──────────────────────────────────────
function StatusModal({ open, onClose, user, onConfirm }) {
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const isActive = user.status === "active";
  const handle = async () => {
    setLoading(true);
    try { await api.adminUpdateUserStatus(user.id, isActive ? "inactive" : "active"); onConfirm(); }
    catch (err) { console.error("Status change failed:", err); }
    finally { setLoading(false); }
  };
  return <Modal open={open} onClose={() => !loading && onClose()}>
    <div className="flex items-center gap-3 mb-4"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}><Ic d={isActive ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"} /></div><div><h3 className="text-lg font-bold text-slate-800">{isActive ? "Deactivate" : "Reactivate"} User</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div>
    <div className={`${isActive ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"} border rounded-xl p-3 text-sm mb-4`}>{isActive ? "User won't be able to log in. Data is preserved." : "User will regain access to their account."}</div>
    <div className="flex gap-3"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={loading} className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-70 ${isActive ? "bg-amber-600" : "bg-emerald-600"}`}>{loading ? <><Spinner /> Processing…</> : isActive ? "Deactivate" : "Reactivate"}</button></div>
  </Modal>;
}

// ── Delete Confirmation ──────────────────────────────────────────────────────
function DeleteModal({ open, onClose, user, groups, onConfirm }) {
  const [mode, setMode] = useState("anonymize");
  const [loading, setLoading] = useState(false);
  if (!open || !user) return null;
  const affectedGroups = user.role === "caretaker" ? (groups || []).filter(g => String(g.caretaker_user_id || g.caretaker_id) === String(user.id)) : [];
  const handle = async () => {
    setLoading(true);
    try { await api.adminDeleteUser(user.id, mode); onConfirm(mode); }
    catch (err) { console.error("Delete failed:", err); }
    finally { setLoading(false); }
  };
  return <Modal open={open} onClose={() => !loading && onClose()}>
    <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Ic d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></div><div><h3 className="text-lg font-bold text-slate-800">Delete User</h3><p className="text-sm text-slate-500">{user.firstName} {user.lastName}</p></div></div>
    {affectedGroups.length > 0 && <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 mb-4"><p className="font-semibold mb-1">This caretaker is assigned to {affectedGroups.length} group{affectedGroups.length > 1 ? "s" : ""}:</p><ul className="list-disc list-inside text-xs space-y-0.5">{affectedGroups.map(g => <li key={g.group_id}>{g.name}</li>)}</ul><p className="mt-2 text-xs">They will be automatically unassigned.</p></div>}
    <div className="space-y-2">
      <button onClick={() => setMode("anonymize")} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${mode === "anonymize" ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}><p className="text-sm font-semibold text-slate-700">Delete & Anonymize</p><p className="text-xs text-slate-400 mt-0.5">Replace name/email — submissions and health data kept.</p></button>
      <button onClick={() => setMode("permanent")} className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${mode === "permanent" ? "border-rose-500 bg-rose-50 ring-1 ring-rose-200" : "border-slate-200 hover:bg-slate-50"}`}><p className="text-sm font-semibold text-slate-700">Delete Permanently</p><p className="text-xs text-slate-400 mt-0.5">Remove account and ALL data. Cannot be undone.</p></button>
    </div>
    {mode === "permanent" && <div className="mt-3 bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700"><span className="font-semibold">Warning:</span> All data will be erased.</div>}
    <div className="flex gap-3 mt-4"><button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl">Cancel</button><button onClick={handle} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70">{loading ? <><Spinner /> Deleting…</> : mode === "anonymize" ? "Anonymize" : "Delete"}</button></div>
  </Modal>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function UserDetailPage() {
  const { id: userId } = useParams();
  const navigate = useNavigate();

  // ── Data state ──
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [submissions, setSubmissions] = useState(null);
  const [goals, setGoals] = useState(null);
  const [activityLogs, setActivityLogs] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const msg = (m) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  // ── UI state ──
  const [tab, setTab] = useState("profile");
  const [actFilter, setActFilter] = useState("all");
  const [expSub, setExpSub] = useState(null);
  const [expGoal, setExpGoal] = useState(null);
  const [showResolved, setShowResolved] = useState(false);

  // ── Modal state ──
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [showChangeGroup, setShowChangeGroup] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // ── Transform backend user to component format ──
  const transformUser = (u) => ({
    id: u.id,
    firstName: u.first_name || "",
    lastName: u.last_name || "",
    email: u.email || "",
    phone: u.phone || "",
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
    maritalStatus: u.marital_status || null,
    highestEducation: u.highest_education_level || null,
    occupationStatus: u.occupation_status || null,
    dependents: u.dependents || null,
    livingArrangement: u.living_arrangement || null,
    onboardingStatus: u.onboarding_status || null,
    programEnrolledAt: u.program_enrolled_at || null,
    lockedUntil: u.locked_until || null,
    failedLoginAttempts: u.failed_login_attempts || 0,
    anonymizedFrom: u.anonymized_from || null,
    // Caretaker profile fields
    title: u.title || null,
    credentials: u.credentials || null,
    organization: u.organization || null,
    department: u.department || null,
    specialty: u.specialty || null,
    bio: u.bio || null,
    workingHoursStart: u.working_hours_start || null,
    workingHoursEnd: u.working_hours_end || null,
    contactPreference: u.contact_preference || null,
    availableDays: u.available_days || null,
    // Admin profile fields
    roleTitle: u.role_title || null,
    // Researcher profile fields
    ethicsApproval: u.ethics_approval || null,
  });

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allUsers, grps, cts] = await Promise.all([
        api.adminListUsers(),
        api.adminGetGroups(),
        api.adminGetCaretakers(),
      ]);

      const rawUser = (allUsers || []).find(u => String(u.id) === String(userId));
      if (!rawUser) { setError("User not found."); setLoading(false); return; }

      const transformed = transformUser(rawUser);
      setUser(transformed);
      setGroups(Array.isArray(grps) ? grps : []);
      setCaretakers(Array.isArray(cts) ? cts : []);

      // Fetch role-specific data
      if (transformed.role === "participant") {
        try { const s = await api.adminGetUserSubmissions(userId); setSubmissions(Array.isArray(s) ? s : []); } catch { setSubmissions([]); }
        try { const g = await api.adminGetUserGoals(userId); setGoals(Array.isArray(g) ? g : []); } catch { setGoals([]); }
      }

      // Fetch activity logs (audit logs filtered to this user — requires backend user_id filter)
      try {
        const logs = await api.getAuditLogs({ limit: 50, offset: 0 });
        // Client-side filter until backend supports user_id param
        const userLogs = (logs?.logs || logs || []).filter(l =>
          String(l.actor_user_id) === String(userId) || String(l.entity_id) === String(userId)
        );
        setActivityLogs(userLogs);
      } catch { setActivityLogs([]); }

    } catch (err) {
      setError(err.message || "Failed to load user data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived ──
  const isAnonymized = user?.email?.startsWith("deleted_");
  const locked = isLocked(user);
  const filteredActivity = useMemo(() => {
    if (!activityLogs) return [];
    if (actFilter === "all") return activityLogs;
    return activityLogs.filter(a => {
      if (actFilter === "logins") return (a.action || "").includes("LOGIN") || a.action === "LOGOUT";
      if (actFilter === "security") return (a.action || "").includes("PASSWORD") || a.action === "LOGIN_FAILED";
      return true;
    });
  }, [activityLogs, actFilter]);

  // ── Tab configuration per role ──
  const getTabs = () => {
    if (!user) return [];
    const base = [
      { k: "profile", l: "Profile" },
      { k: "activity", l: "Activity" },
    ];
    if (user.role === "participant") {
      base.push({ k: "submissions", l: `Submissions${submissions ? ` (${submissions.length})` : ""}` });
      base.push({ k: "goals", l: `Goals${goals ? ` (${goals.length})` : ""}` });
    }
    base.push({ k: "security", l: "Security" });
    return base;
  };
  const tabs = getTabs();

  // ── Action handlers ──
  const handleRoleChanged = (newRole) => {
    setUser(p => ({ ...p, role: newRole }));
    setShowChangeRole(false);
    msg(`Role changed to ${newRole}.`);
    fetchData(); // Refresh to pick up any profile changes
  };

  const handleGroupChanged = (newGroupId) => {
    const g = newGroupId ? groups.find(x => String(x.group_id) === String(newGroupId)) : null;
    setUser(p => ({ ...p, groupId: newGroupId, group: g?.name || null }));
    setShowChangeGroup(false);
    msg(g ? `Moved to ${g.name}.` : "Removed from group.");
  };

  const handleStatusChanged = () => {
    setUser(p => ({ ...p, status: p.status === "active" ? "inactive" : "active" }));
    setShowStatusModal(false);
    msg(user.status === "active" ? "User deactivated." : "User reactivated.");
  };

  const handleUnlocked = async () => {
    try {
      await api.adminUnlockUser(user.id);
      setUser(p => ({ ...p, lockedUntil: null, failedLoginAttempts: 0 }));
      msg("User unlocked.");
    } catch (err) {
      msg(err.message || "Failed to unlock user.");
    }
  };

  const handleDeleted = () => {
    setShowDeleteModal(false);
    msg("User deleted.");
    navigate("/users");
  };

  // ── Loading / Error states ──
  if (loading) {
    return <div className="max-w-5xl mx-auto p-6"><div className="flex flex-col items-center justify-center py-24 gap-3"><BigSpinner /><p className="text-sm text-slate-400">Loading user details…</p></div></div>;
  }
  if (error || !user) {
    return <div className="max-w-5xl mx-auto p-6"><div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center"><p className="text-lg font-bold text-slate-800 mb-2">User Not Found</p><p className="text-sm text-slate-400 mb-6">{error || "The requested user could not be loaded."}</p><button onClick={() => navigate("/users")} className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl">Back to Users & Roles</button></div></div>;
  }

  // ── Render ──
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate("/users")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">
        <Ic d="M10 19l-7-7m0 0l7-7m-7 7h18" c="h-4 w-4" /> Back to Users & Roles
      </button>

      {/* ═══ HEADER + ACTIONS ═══ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar name={`${user.firstName} ${user.lastName}`} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{user.firstName} {user.lastName}</h1>
              <RoleBadge role={user.role} />
              <StatusDot status={user.status} />
              <span className="text-sm text-slate-500 capitalize font-medium">{user.status}</span>
              {locked && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase">Locked</span>}
              {isAnonymized && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">Anonymized</span>}
            </div>
            <p className="text-sm text-slate-400 mt-1">{user.email}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
              <span>Joined {fmt(user.joinedAt)}</span>
              {user.lastLoginAt && <span>Last login {timeAgo(user.lastLoginAt)}</span>}
              {user.group && <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">{user.group}</span>}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowChangeRole(true)} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5">
            <Ic d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" c="h-3.5 w-3.5" /> Change Role
          </button>
          {user.role === "participant" && (
            <button onClick={() => setShowChangeGroup(true)} className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5">
              <Ic d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" c="h-3.5 w-3.5" /> Change Group
            </button>
          )}
          {locked && (
            <button onClick={handleUnlocked} className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1.5">
              <Ic d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" c="h-3.5 w-3.5" /> Unlock
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => setShowStatusModal(true)} className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 border ${user.status === "active" ? "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100" : "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"}`}>
            <Ic d={user.status === "active" ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"} c="h-3.5 w-3.5" />
            {user.status === "active" ? "Deactivate" : "Reactivate"}
          </button>
          {user.status === "inactive" && (
            <button onClick={() => setShowDeleteModal(true)} className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1.5">
              <Ic d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" c="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ═══ QUICK STATS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Last Login" value={user.lastLoginAt ? timeAgo(user.lastLoginAt) : "Never"} sub={fmtTime(user.lastLoginAt)} icon="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" color="blue" />
        {user.role === "participant" && <>
          <StatCard label="Submissions" value={submissions?.length ?? "—"} sub="All time" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="violet" />
          <StatCard label="Active Goals" value={goals ? goals.filter(g => g.status === "active" || !g.is_completed).length : "—"} sub={goals ? `${goals.filter(g => g.is_completed).length} completed` : ""} icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" color="emerald" />
        </>}
        {user.role !== "participant" && <>
          <StatCard label="Account Status" value={user.status === "active" ? "Active" : "Inactive"} sub={`Failed logins: ${user.failedLoginAttempts}`} icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" color={user.status === "active" ? "emerald" : "amber"} />
          <StatCard label="Activity" value={activityLogs?.length ?? "—"} sub="Total events" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="violet" />
        </>}
        <StatCard label="Failed Logins" value={user.failedLoginAttempts} sub={locked ? `Locked until ${fmtTime(user.lockedUntil)}` : "Not locked"} icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" color={user.failedLoginAttempts > 3 || locked ? "rose" : "amber"} />
      </div>

      {/* ═══ TABBED CONTENT ═══ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); setActFilter("all"); }}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${tab === t.k ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="p-6">

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account — all roles */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Account</h3>
                <div className="bg-slate-50 rounded-xl p-4">
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Phone" value={user.phone} />
                  <InfoRow label="Address" value={user.address} />
                  <InfoRow label="Joined" value={fmtTime(user.joinedAt)} />
                </div>
              </div>

              {/* Participant-specific */}
              {user.role === "participant" && <>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Information</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <InfoRow label="Date of Birth" value={fmt(user.dob)} />
                    <InfoRow label="Gender" value={user.gender} />
                    <InfoRow label="Pronouns" value={user.pronouns} />
                    <InfoRow label="Language" value={user.primaryLanguage} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Demographics</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <InfoRow label="Marital Status" value={user.maritalStatus} />
                    <InfoRow label="Education" value={user.highestEducation} />
                    <InfoRow label="Employment" value={user.occupationStatus} />
                    <InfoRow label="Dependents" value={user.dependents != null ? (user.dependents ? "Yes" : "No") : null} />
                    <InfoRow label="Living Arrangement" value={user.livingArrangement} />
                    <InfoRow label="Onboarding" value={user.onboardingStatus ? <span className={user.onboardingStatus === "COMPLETED" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{user.onboardingStatus}</span> : null} />
                    <InfoRow label="Enrolled" value={fmtTime(user.programEnrolledAt)} />
                  </div>
                </div>
                {user.group && <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Group & Caretaker</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <InfoRow label="Group" value={<span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">{user.group}</span>} />
                    <InfoRow label="Caretaker" value={user.caretaker} />
                  </div>
                </div>}
              </>}

              {/* Caretaker-specific */}
              {user.role === "caretaker" && <>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Professional</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <InfoRow label="Title" value={user.title} />
                    <InfoRow label="Credentials" value={user.credentials} />
                    <InfoRow label="Organization" value={user.organization} />
                    <InfoRow label="Department" value={user.department} />
                    <InfoRow label="Specialty" value={user.specialty} />
                    <InfoRow label="Bio" value={user.bio} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Availability</h3>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <InfoRow label="Hours" value={user.workingHoursStart && user.workingHoursEnd ? `${user.workingHoursStart} – ${user.workingHoursEnd}` : null} />
                    <InfoRow label="Days" value={user.availableDays?.join(", ")} />
                    <InfoRow label="Contact Preference" value={user.contactPreference} />
                  </div>
                </div>
              </>}

              {/* Researcher-specific */}
              {user.role === "researcher" && <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Academic</h3>
                <div className="bg-slate-50 rounded-xl p-4">
                  <InfoRow label="Title" value={user.title} />
                  <InfoRow label="Credentials" value={user.credentials} />
                  <InfoRow label="Organization" value={user.organization} />
                  <InfoRow label="Department" value={user.department} />
                  <InfoRow label="Specialty" value={user.specialty} />
                  <InfoRow label="Bio" value={user.bio} />
                </div>
              </div>}

              {/* Admin-specific */}
              {user.role === "admin" && <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Role</h3>
                <div className="bg-slate-50 rounded-xl p-4">
                  <InfoRow label="Title" value={user.title} />
                  <InfoRow label="Role Title" value={user.roleTitle} />
                  <InfoRow label="Department" value={user.department} />
                  <InfoRow label="Organization" value={user.organization} />
                  <InfoRow label="Contact Preference" value={user.contactPreference} />
                  <InfoRow label="Bio" value={user.bio} />
                </div>
              </div>}
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {tab === "activity" && (
            <div>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {[{ v: "all", l: "All" }, { v: "logins", l: "Logins" }, { v: "security", l: "Security" }].map(f =>
                  <button key={f.v} onClick={() => setActFilter(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${actFilter === f.v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{f.l}</button>
                )}
              </div>
              {activityLogs === null ? (
                <div className="flex items-center justify-center py-8 gap-2"><Spinner /><span className="text-sm text-slate-400">Loading activity…</span></div>
              ) : filteredActivity.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No activity events{actFilter !== "all" ? " matching this filter" : ""}.</p>
              ) : (
                <div className="space-y-2">
                  {filteredActivity.map(a => {
                    const s = ACTION_STYLES[a.action] || { bg: "bg-slate-100", tx: "text-slate-600", lb: a.action?.replace(/_/g, " ") || "Event" };
                    const detail = a.details ? (typeof a.details === "object" ? JSON.stringify(a.details) : a.details) : null;
                    return (
                      <div key={a.audit_id || a.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl ${s.bg}`}>
                        <div className={`w-2 h-2 rounded-full ${s.tx.replace("text-", "bg-")} shrink-0 mt-2`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${s.tx}`}>{s.lb}</span>
                            {detail && detail !== "{}" && <span className="text-xs text-slate-500 truncate max-w-xs">— {detail}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>{fmtTime(a.created_at)}</span>
                            {a.ip_address && <span>IP: {a.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SUBMISSIONS TAB (participant only) ── */}
          {tab === "submissions" && (
            <div>
              {submissions === null ? (
                <div className="flex items-center justify-center py-8 gap-2"><Spinner /><span className="text-sm text-slate-400">Loading submissions…</span></div>
              ) : submissions.length === 0 ? (
                <ApiPendingBanner endpoint="GET /admin_only/users/{id}/submissions" description="Submission history will appear here once data is available." />
              ) : (
                <div className="space-y-2">
                  {submissions.map(s => {
                    const ex = expSub === s.id;
                    return (
                      <div key={s.id} className="border border-slate-100 rounded-xl overflow-hidden">
                        <button onClick={() => setExpSub(ex ? null : s.id)} className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/50">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{s.form_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{fmtTime(s.submitted_at)}</p>
                          </div>
                          <Ic d={ex ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} c="h-4 w-4 text-slate-400" />
                        </button>
                        {ex && (s.answers || []).length > 0 && (
                          <div className="px-4 pb-4 border-t border-slate-50 space-y-2 pt-3">
                            {s.answers.map((a, i) => (
                              <div key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{a.field || a.label || `Field ${i + 1}`}</p>
                                <p className="text-sm text-slate-700 mt-0.5">{a.value || "—"}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {ex && (s.answers || []).length === 0 && (
                          <div className="px-4 pb-4 border-t border-slate-50 pt-3">
                            <p className="text-xs text-slate-400 italic">Answer details not available yet.</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── GOALS TAB (participant only) ── */}
          {tab === "goals" && (
            <div>
              {goals === null ? (
                <div className="flex items-center justify-center py-8 gap-2"><Spinner /><span className="text-sm text-slate-400">Loading goals…</span></div>
              ) : goals.length === 0 ? (
                <ApiPendingBanner endpoint="GET /admin_only/users/{id}/goals" description="Health goals will appear here once data is available." />
              ) : (
                <div className="space-y-3">
                  {goals.map(g => {
                    const targetVal = parseFloat(g.target_value) || 0;
                    const currentVal = parseFloat(g.current) || parseFloat(g.current_value) || 0;
                    const pct = targetVal > 0 ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;
                    const met = g.is_completed || pct >= 100;
                    const ex = expGoal === g.id;
                    const barColor = met ? "bg-emerald-500" : GOAL_BAR[g.status] || "bg-blue-500";

                    return (
                      <div key={g.id} className="border border-slate-100 rounded-xl overflow-hidden">
                        <button onClick={() => setExpGoal(ex ? null : g.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50/50">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-slate-700">{g.name}</p>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${met ? "bg-emerald-50 text-emerald-700" : g.status === "active" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                                {met ? "Met" : g.status}
                              </span>
                              <Ic d={ex ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} c="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-slate-400">Target: {g.target || targetVal} {g.unit || ""}</span>
                            <span className="font-semibold text-slate-600">{currentVal}/{targetVal} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                        {ex && (g.logs || []).length > 0 && (
                          <div className="px-4 pb-3 border-t border-slate-50 pt-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Logs</p>
                            {g.logs.map((l, i) => (
                              <div key={i} className="flex justify-between bg-slate-50 rounded-lg px-3 py-1.5 mb-1">
                                <span className="text-xs text-slate-400">{l.date}</span>
                                <span className="text-xs font-semibold text-slate-700">{l.value} {g.unit || ""}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {tab === "security" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Account Security</h3>
                <div className="bg-slate-50 rounded-xl p-4">
                  <InfoRow label="Account Status" value={
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={user.status} />
                      <span className={`capitalize font-semibold ${user.status === "active" ? "text-emerald-600" : "text-slate-500"}`}>{user.status}</span>
                    </div>
                  } />
                  <InfoRow label="Failed Login Attempts" value={<span className={user.failedLoginAttempts > 3 ? "text-rose-600 font-semibold" : ""}>{user.failedLoginAttempts}</span>} />
                  <InfoRow label="Account Locked" value={locked ? <span className="text-rose-600 font-semibold">Until {fmtTime(user.lockedUntil)}</span> : <span className="text-emerald-600">No</span>} />
                  <InfoRow label="Last Login" value={fmtTime(user.lastLoginAt)} />
                  <InfoRow label="MFA" value={<span className="text-amber-600 font-medium">Not implemented</span>} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Security Events</h3>
                {activityLogs ? (
                  <div className="space-y-2">
                    {activityLogs.filter(a => (a.action || "").includes("PASSWORD") || a.action === "LOGIN_FAILED" || (a.action || "").includes("REGISTER")).slice(0, 5).map(a => {
                      const s = ACTION_STYLES[a.action] || { bg: "bg-slate-100", tx: "text-slate-600", lb: a.action };
                      return (
                        <div key={a.audit_id || a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.bg}`}>
                          <div className={`w-2 h-2 rounded-full ${s.tx.replace("text-", "bg-")} shrink-0`} />
                          <div className="flex-1">
                            <p className={`text-xs font-semibold ${s.tx}`}>{s.lb}</p>
                            <p className="text-[10px] text-slate-400">{fmtTime(a.created_at)}{a.ip_address ? ` · ${a.ip_address}` : ""}</p>
                          </div>
                        </div>
                      );
                    })}
                    {activityLogs.filter(a => (a.action || "").includes("PASSWORD") || a.action === "LOGIN_FAILED").length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">No security events found.</p>
                    )}
                  </div>
                ) : (
                  <ApiPendingBanner endpoint="GET /admin_only/audit-logs?user_id=..." description="Security events will appear once the audit log supports user filtering." />
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      <ChangeRoleModal open={showChangeRole} onClose={() => setShowChangeRole(false)} user={user} onConfirm={handleRoleChanged} />
      <ChangeGroupModal open={showChangeGroup} onClose={() => setShowChangeGroup(false)} user={user} groups={groups} onConfirm={handleGroupChanged} />
      <StatusModal open={showStatusModal} onClose={() => setShowStatusModal(false)} user={user} onConfirm={handleStatusChanged} />
      <DeleteModal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} user={user} groups={groups} onConfirm={handleDeleted} />

      <Toast message={toast} />
    </div>
  );
}

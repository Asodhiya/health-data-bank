import { useState, useMemo } from "react";
import { api } from "../../services/api";

// ─── Mock Data ──────────────────────────────────────────────────────────────────
// TODO (Phase 2): Replace these with real API calls:
//   MOCK_GROUPS → const { data } = await api.getAdminGroups()
//   MOCK_USERS  → const { data } = await api.getAdminUsers()
//
// Required new endpoints:
//   GET    /admin/users             → all users with role-specific profile data
//   GET    /admin/groups            → all groups with caretaker info
//   DELETE /admin/users/bulk        → body: { user_ids: string[] }
//   PATCH  /admin/users/:id/role    → body: { role: string }
//   PATCH  /admin/users/:id/group   → body: { group_id: string | null }
//
// Also: add optional `group_id: Optional[uuid.UUID]` to backend SignupInviteRequest

const MOCK_GROUPS = [
  { id: "g1", name: "Morning Cohort A",     description: "Early-morning check-in group",  caretakerId: "c1" },
  { id: "g2", name: "Evening Cohort B",     description: "Post-work wellness program",     caretakerId: "c2" },
  { id: "g3", name: "Rehabilitation Alpha", description: "Post-surgery recovery track",    caretakerId: "c1" },
  { id: "g4", name: "Unassigned",           description: "Pending group placement",        caretakerId: null },
];

const MOCK_USERS = [
  {
    id: "1", firstName: "Sarah",  lastName: "Chen",
    email: "sarah.chen@example.com", phone: "+1 416-555-0191",
    address: "22 Maple St, Toronto, ON",
    role: "participant", status: "active", joinedAt: "2025-11-03",
    profile: { dob: "1991-04-12", gender: "Female", programEnrolledAt: "2025-11-03",
      groupId: "g1", caretakerId: "c1", healthGoals: 3, surveysDone: 8, surveysTotal: 10 },
  },
  {
    id: "2", firstName: "Marcus", lastName: "Webb",
    email: "marcus.webb@example.com", phone: "+1 647-555-0182",
    address: "88 Birch Ave, Mississauga, ON",
    role: "participant", status: "active", joinedAt: "2025-11-10",
    profile: { dob: "1985-09-30", gender: "Male", programEnrolledAt: "2025-11-10",
      groupId: "g2", caretakerId: "c2", healthGoals: 1, surveysDone: 5, surveysTotal: 10 },
  },
  {
    id: "3", firstName: "Priya",  lastName: "Nair",
    email: "priya.nair@example.com", phone: "+1 905-555-0143",
    address: "5 Cedar Blvd, Hamilton, ON",
    role: "caretaker", status: "active", joinedAt: "2025-10-18",
    profile: { caretakerId: "c1", title: "Registered Nurse",
      organization: "Hamilton Health Sciences", participantIds: ["1", "5", "7"] },
  },
  {
    id: "4", firstName: "Daniel", lastName: "Osei",
    email: "daniel.osei@example.com", phone: "+1 416-555-0174",
    address: "14 Oak Crescent, Brampton, ON",
    role: "researcher", status: "active", joinedAt: "2025-09-22",
    profile: { institution: "University of Toronto",
      department: "Epidemiology & Public Health", surveysCreated: 4 },
  },
  {
    id: "5", firstName: "Lily",   lastName: "Hartmann",
    email: "lily.hartmann@example.com", phone: "+1 519-555-0165",
    address: "31 Pine Rd, London, ON",
    role: "participant", status: "inactive", joinedAt: "2025-08-14",
    profile: { dob: "1978-12-01", gender: "Female", programEnrolledAt: "2025-08-14",
      groupId: "g1", caretakerId: "c1", healthGoals: 0, surveysDone: 2, surveysTotal: 10 },
  },
  {
    id: "6", firstName: "James",  lastName: "Rivera",
    email: "james.rivera@example.com", phone: "+1 416-555-0106",
    address: "9 Elm Ct, Toronto, ON",
    role: "admin", status: "active", joinedAt: "2025-07-01",
    profile: {},
  },
  {
    id: "7", firstName: "Aiko",   lastName: "Tanaka",
    email: "aiko.tanaka@example.com", phone: "+1 613-555-0177",
    address: "52 Spruce Lane, Ottawa, ON",
    role: "participant", status: "active", joinedAt: "2026-01-05",
    profile: { dob: "2000-02-18", gender: "Female", programEnrolledAt: "2026-01-05",
      groupId: "g3", caretakerId: "c1", healthGoals: 2, surveysDone: 10, surveysTotal: 10 },
  },
  {
    id: "8", firstName: "Thomas", lastName: "Müller",
    email: "thomas.muller@example.com", phone: "+1 905-555-0188",
    address: "77 Walnut Dr, Oakville, ON",
    role: "caretaker", status: "active", joinedAt: "2026-01-19",
    profile: { caretakerId: "c2", title: "Physiotherapist",
      organization: "Oakville Wellness Centre", participantIds: ["2"] },
  },
  {
    id: "9", firstName: "Fatima", lastName: "Al-Hassan",
    email: "fatima.hassan@example.com", phone: "+1 204-555-0199",
    address: "3 Aspen Way, Winnipeg, MB",
    role: "researcher", status: "inactive", joinedAt: "2025-12-02",
    profile: { institution: "University of Manitoba",
      department: "Chronic Disease Management", surveysCreated: 1 },
  },
  {
    id: "10", firstName: "Omar",  lastName: "Diallo",
    email: "omar.diallo@example.com", phone: "+1 403-555-0110",
    address: "19 Poplar St, Calgary, AB",
    role: "participant", status: "active", joinedAt: "2026-02-28",
    profile: { dob: "1995-07-23", gender: "Male", programEnrolledAt: "2026-02-28",
      groupId: "g4", caretakerId: null, healthGoals: 1, surveysDone: 0, surveysTotal: 10 },
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────────

// Phase 2: uncomment these entries and remove the "Coming Soon" banner once the
// UserPermissionDeny backend table and RBAC updates are in place.
const RESTRICTABLE_ADMIN_PERMISSIONS = [
  // { code: "send:invite",   label: "Send Invites",    description: "Invite new users to the platform" },
  // { code: "role:read_all", label: "View All Roles",  description: "Read role assignments across all users" },
  // { code: "audit:read",    label: "Read Audit Logs", description: "Access the security & audit log page" },
  // { code: "user:manage",   label: "Manage Users",    description: "Edit or deactivate user accounts" },
];

const ROLES = [
  { value: "participant", label: "Participant", color: "bg-blue-100 text-blue-700"       },
  { value: "caretaker",   label: "Caretaker",   color: "bg-emerald-100 text-emerald-700" },
  { value: "researcher",  label: "Researcher",  color: "bg-indigo-100 text-indigo-700"   },
  { value: "admin",       label: "Admin",       color: "bg-rose-100 text-rose-700"       },
];

const ROLE_DESCRIPTIONS = {
  participant: "Can fill surveys & track health goals",
  caretaker:   "Manages & monitors participants",
  researcher:  "Builds surveys & views analytics",
  admin:       "Full platform access",
};

// Only participants can be promoted; caretaker/researcher/admin role is locked.
const PARTICIPANT_PROMOTABLE_ROLES = ["caretaker", "researcher"];

// ─── Utilities ──────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Shared sub-components ──────────────────────────────────────────────────────

function RoleBadge({ role, size = "sm" }) {
  const r = ROLES.find((x) => x.value === role);
  const sz = size === "xs" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-block rounded-full font-bold uppercase tracking-wide whitespace-nowrap ${sz} ${
        r?.color ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {r?.label ?? role}
    </span>
  );
}

function Avatar({ firstName, lastName, size = "md" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const palette = [
    "bg-blue-500", "bg-emerald-500", "bg-indigo-500",
    "bg-rose-500",  "bg-amber-500",  "bg-violet-500",
  ];
  const color = palette[(firstName?.charCodeAt(0) ?? 0) % palette.length];
  const sz = size === "lg" ? "w-14 h-14 text-lg" : "w-8 h-8 text-xs";
  return (
    <div
      className={`rounded-full ${color} text-white flex items-center justify-center font-bold shrink-0 ${sz}`}
    >
      {initials}
    </div>
  );
}

function StatusDot({ status }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        status === "active" ? "bg-emerald-400" : "bg-slate-300"
      }`}
    />
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 font-medium shrink-0">{label}</span>
      <span className="text-xs text-slate-700 font-semibold text-right">{value || "—"}</span>
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────────────────────────────
// On mobile, modals slide up from the bottom (items-end).
// On sm+ they center in the viewport (sm:items-center).

function RemoveModal({ targets, onConfirm, onCancel }) {
  const plural = targets.length > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Remove {plural ? `${targets.length} Users` : "User"}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {plural
                ? `This will permanently remove ${targets.length} users. This cannot be undone.`
                : (
                  <>
                    Remove{" "}
                    <span className="font-semibold text-slate-700">
                      {targets[0].firstName} {targets[0].lastName}
                    </span>
                    ? This cannot be undone.
                  </>
                )}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({ user, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(user.role);
  const changed = selected !== user.role;
  const options = [user.role, ...PARTICIPANT_PROMOTABLE_ROLES];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Change Role</h3>
            <p className="text-sm text-slate-500 mt-1">
              Select a new role for{" "}
              <span className="font-semibold text-slate-700">
                {user.firstName} {user.lastName}
              </span>.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((r) => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                selected === r
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-400"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <RoleBadge role={r} size="xs" />
                <span className="text-xs text-slate-400 font-normal text-left">
                  {ROLE_DESCRIPTIONS[r]}
                </span>
              </div>
              {selected === r && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => changed && onConfirm(selected)}
            disabled={!changed}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeGroupModal({ targets, groups, onConfirm, onCancel }) {
  const plural = targets.length > 1;
  const currentGroupId = !plural ? (targets[0]?.profile?.groupId ?? null) : null;
  const [selected, setSelected] = useState(currentGroupId ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Change Group</h3>
            <p className="text-sm text-slate-500 mt-1">
              {plural
                ? `Move ${targets.length} participants to a new group.`
                : (
                  <>
                    Move{" "}
                    <span className="font-semibold text-slate-700">
                      {targets[0].firstName} {targets[0].lastName}
                    </span>{" "}
                    to a new group.
                  </>
                )}
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {groups.map((g) => {
            const caretaker = MOCK_USERS.find(
              (u) => u.profile?.caretakerId === g.caretakerId && u.role === "caretaker"
            );
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected === g.id
                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{g.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {caretaker
                        ? `${caretaker.firstName} ${caretaker.lastName}`
                        : "No caretaker"}
                    </p>
                  </div>
                  {selected === g.id && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected || selected === currentGroupId}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Panel ──────────────────────────────────────────────────────────
// Full-screen on mobile. On sm+ it slides in from the right as a drawer.

function UserDetailPanel({ user, users, groups, onClose, onRemove, onChangeRole, onChangeGroup }) {
  const group = groups.find((g) => g.id === user.profile?.groupId);

  const caretaker = users.find(
    (u) => u.profile?.caretakerId === user.profile?.caretakerId && u.role === "caretaker"
  );

  const managedParticipants =
    user.role === "caretaker"
      ? users.filter((u) => user.profile?.participantIds?.includes(u.id))
      : [];

  const canChangeRole  = user.role === "participant";
  const canChangeGroup = user.role === "participant";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel: full-width on mobile, max-w-sm drawer on sm+ */}
      <div className="relative z-10 w-full sm:max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            User Details
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Identity block */}
          <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-4">
            <Avatar firstName={user.firstName} lastName={user.lastName} size="lg" />
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <RoleBadge role={user.role} />
                <div className="flex items-center gap-1.5">
                  <StatusDot status={user.status} />
                  <span className="text-xs text-slate-400 capitalize">{user.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Account
            </p>
            <InfoRow label="Phone"   value={user.phone}         />
            <InfoRow label="Address" value={user.address}       />
            <InfoRow label="Joined"  value={fmt(user.joinedAt)} />
          </div>

          {/* ── Participant ── */}
          {user.role === "participant" && (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Participant Profile
                </p>
                <InfoRow label="Date of Birth" value={fmt(user.profile?.dob)}               />
                <InfoRow label="Gender"        value={user.profile?.gender}                 />
                <InfoRow label="Enrolled"      value={fmt(user.profile?.programEnrolledAt)} />
              </div>

              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Group
                </p>
                {group ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                    <p className="text-sm font-bold text-emerald-800">{group.name}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{group.description}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not assigned to a group</p>
                )}
              </div>

              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Caretaker
                </p>
                {caretaker && user.profile?.caretakerId ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <Avatar firstName={caretaker.firstName} lastName={caretaker.lastName} />
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {caretaker.firstName} {caretaker.lastName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {caretaker.profile?.title} · {caretaker.profile?.organization}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No caretaker assigned</p>
                )}
              </div>

              <div className="px-5 py-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Activity
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center">
                    <p className="text-2xl font-extrabold text-blue-600">
                      {user.profile?.surveysDone}
                    </p>
                    <p className="text-xs text-blue-500 mt-0.5">Surveys Done</p>
                    <p className="text-xs text-blue-400">of {user.profile?.surveysTotal}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-3 text-center">
                    <p className="text-2xl font-extrabold text-indigo-600">
                      {user.profile?.healthGoals}
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">Health Goals</p>
                    <p className="text-xs text-indigo-400">active</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Caretaker ── */}
          {user.role === "caretaker" && (
            <>
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Caretaker Profile
                </p>
                <InfoRow label="Title"        value={user.profile?.title}        />
                <InfoRow label="Organization" value={user.profile?.organization} />
              </div>

              {/* Groups owned by this caretaker */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Groups
                </p>
                {(() => {
                  const ownedGroups = groups.filter(
                    (g) => g.caretakerId === user.profile?.caretakerId
                  );
                  if (ownedGroups.length === 0) {
                    return <p className="text-xs text-slate-400 italic">No groups assigned</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {ownedGroups.map((g) => {
                        const memberCount = managedParticipants.filter(
                          (p) => p.profile?.groupId === g.id
                        ).length;
                        return (
                          <div
                            key={g.id}
                            className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-emerald-800 truncate">
                                {g.name}
                              </p>
                              <p className="text-xs text-emerald-600 mt-0.5 truncate">
                                {g.description}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full shrink-0">
                              {memberCount} {memberCount === 1 ? "member" : "members"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Participants under this caretaker */}
              <div className="px-5 py-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Participants ({managedParticipants.length})
                </p>
                {managedParticipants.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No participants assigned</p>
                ) : (
                  <div className="space-y-3">
                    {managedParticipants.map((p) => {
                      const g = groups.find((g) => g.id === p.profile?.groupId);
                      const surveyPct = p.profile?.surveysTotal
                        ? Math.round((p.profile.surveysDone / p.profile.surveysTotal) * 100)
                        : 0;
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                        >
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
                            <Avatar firstName={p.firstName} lastName={p.lastName} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {p.firstName} {p.lastName}
                                </p>
                                <StatusDot status={p.status} />
                              </div>
                              <p className="text-xs text-slate-400 truncate">{p.email}</p>
                            </div>
                          </div>
                          <div className="px-4 py-2.5 space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Group</span>
                              {g
                                ? <span className="font-semibold text-emerald-700">{g.name}</span>
                                : <span className="text-slate-400 italic">Unassigned</span>
                              }
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">DOB</span>
                              <span className="font-semibold text-slate-700">{fmt(p.profile?.dob)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Gender</span>
                              <span className="font-semibold text-slate-700">{p.profile?.gender ?? "—"}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Health Goals</span>
                              <span className="font-semibold text-indigo-600">
                                {p.profile?.healthGoals ?? 0} active
                              </span>
                            </div>
                            <div className="pt-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-400">Survey progress</span>
                                <span className="font-semibold text-slate-600">
                                  {p.profile?.surveysDone}/{p.profile?.surveysTotal}
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${surveyPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Researcher ── */}
          {user.role === "researcher" && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Researcher Profile
              </p>
              <InfoRow label="Institution"     value={user.profile?.institution}    />
              <InfoRow label="Department"      value={user.profile?.department}     />
              <InfoRow label="Surveys Created" value={user.profile?.surveysCreated} />
            </div>
          )}

          {/* ── Admin ── */}
          {user.role === "admin" && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Admin Profile
              </p>
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3">
                <p className="text-xs text-rose-700 font-semibold">Full platform access</p>
                <p className="text-xs text-rose-500 mt-0.5">
                  This account has elevated permissions across the system.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 space-y-2 shrink-0">
          {canChangeGroup && (
            <button
              onClick={onChangeGroup}
              className="w-full py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Change Group
            </button>
          )}
          {canChangeRole && (
            <button
              onClick={onChangeRole}
              className="w-full py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Change Role
            </button>
          )}
          <button
            onClick={onRemove}
            className="w-full py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove User
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Form ────────────────────────────────────────────────────────────────
// NOTE: When backend group_id support is added to SignupInviteRequest, update the
// api.sendInvite() call to also pass groupId.

function InviteForm() {
  const [email, setEmail]             = useState("");
  const [role, setRole]               = useState("");
  const [groupId, setGroupId]         = useState(null); // null = general invite (no group)
  const [status, setStatus]           = useState(null); // null | "loading" | "success" | "error"
  const [errorMsg, setErrorMsg]       = useState("");
  const [lastInvited, setLastInvited] = useState(null);

  const isAdmin       = role === "admin";
  const isParticipant = role === "participant";
  const comingSoon    = isAdmin && RESTRICTABLE_ADMIN_PERMISSIONS.length === 0;

  // Exclude the placeholder "Unassigned" group (caretakerId = null) from picker
  const invitableGroups = MOCK_GROUPS.filter((g) => g.caretakerId !== null);

  function reset() {
    setEmail("");
    setRole("");
    setGroupId(null);
    setStatus(null);
    setErrorMsg("");
  }

  async function handleSubmit() {
    if (!email.trim() || !role) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.sendInvite(email.trim(), role);
      // TODO (Phase 2): await api.sendInvite(email.trim(), role, groupId)
      setLastInvited({ email: email.trim(), role, groupId });
      setStatus("success");
    } catch (err) {
      setErrorMsg(err.message || "Failed to send invite. Please try again.");
      setStatus("error");
    }
  }

  // ── Success state ──
  if (status === "success" && lastInvited) {
    const roleObj = ROLES.find((r) => r.value === lastInvited.role);
    const grpObj  = MOCK_GROUPS.find((g) => g.id === lastInvited.groupId);
    return (
      <div className="flex flex-col items-center text-center gap-4 py-6">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-800">Invite Sent!</p>
          <p className="text-xs text-slate-500">
            Sent to{" "}
            <span className="font-semibold text-slate-700">{lastInvited.email}</span>
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${roleObj?.color}`}>
              {roleObj?.label}
            </span>
            {lastInvited.role === "participant" && (
              lastInvited.groupId && grpObj ? (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                  {grpObj.name}
                </span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                  No group
                </span>
              )
            )}
          </div>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Send Another
        </button>
      </div>
    );
  }

  // ── Form state ──
  return (
    <div className="space-y-4">

      {/* Email */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 placeholder:text-slate-300"
        />
      </div>

      {/* Role picker */}
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Role
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => { setRole(r.value); setGroupId(null); }}
              className={`px-2 py-2 rounded-xl border text-xs font-semibold transition-all ${
                role === r.value
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group picker — only shown when Participant is selected */}
      {isParticipant && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Group Assignment
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">

            {/* General / no group */}
            <button
              onClick={() => setGroupId(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between ${
                groupId === null
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-slate-700">General invite</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  No group — admin can assign later
                </p>
              </div>
              {groupId === null && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Group-specific options */}
            {invitableGroups.map((g) => {
              const caretaker = MOCK_USERS.find(
                (u) => u.profile?.caretakerId === g.caretakerId && u.role === "caretaker"
              );
              const memberCount = MOCK_USERS.filter((u) => u.profile?.groupId === g.id).length;
              return (
                <button
                  key={g.id}
                  onClick={() => setGroupId(g.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    groupId === g.id
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{g.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {caretaker
                        ? `${caretaker.firstName} ${caretaker.lastName}`
                        : "No caretaker"}{" "}
                      · {memberCount} {memberCount === 1 ? "member" : "members"}
                    </p>
                  </div>
                  {groupId === g.id && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin warning */}
      {isAdmin && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-bold text-rose-700">
              Inviting an Admin — elevated access
            </p>
          </div>
          {comingSoon && (
            <div className="flex items-center gap-2 bg-white border border-rose-100 rounded-lg px-3 py-2">
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                Coming Soon
              </span>
              <p className="text-xs text-slate-400">
                Fine-grained permission controls in a future update.
              </p>
            </div>
          )}
          {/* Renders once RESTRICTABLE_ADMIN_PERMISSIONS is populated (Phase 2) */}
          {RESTRICTABLE_ADMIN_PERMISSIONS.map((perm) => (
            <label
              key={perm.code}
              className="flex items-start gap-2 p-2 rounded-lg bg-white border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors"
            >
              <input type="checkbox" className="mt-0.5 accent-rose-600" />
              <div>
                <p className="text-xs font-semibold text-slate-700">{perm.label}</p>
                <p className="text-xs text-slate-400">{perm.description}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2.5 rounded-xl">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!email.trim() || !role || status === "loading"}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Sending…
          </>
        ) : (
          "Send Invite"
        )}
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [users, setUsers]           = useState(MOCK_USERS);
  const [groups]                    = useState(MOCK_GROUPS);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selected, setSelected]     = useState(new Set());
  const [detailUser, setDetailUser] = useState(null);
  const [modal, setModal]           = useState(null); // { type: "remove"|"role"|"group", targets }
  const [toast, setToast]           = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = search.toLowerCase();
        const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`
          .toLowerCase()
          .includes(q);
        const matchesRole = filterRole === "all" || u.role === filterRole;
        return matchesSearch && matchesRole;
      }),
    [users, search, filterRole]
  );

  const counts = useMemo(() => {
    const c = { all: users.length };
    ROLES.forEach((r) => { c[r.value] = users.filter((u) => u.role === r.value).length; });
    return c;
  }, [users]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach((u) => next.delete(u.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((u) => next.add(u.id));
      setSelected(next);
    }
  }

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  const selectedUsers        = users.filter((u) => selected.has(u.id));
  const selectedParticipants = selectedUsers.filter((u) => u.role === "participant");
  const allSelectedParticipants =
    someSelected && selectedUsers.every((u) => u.role === "participant");

  // ── Mutation handlers ──────────────────────────────────────────────────────

  function confirmRemove(targets) {
    // TODO (Phase 2): await api.removeUsers(targets.map(u => u.id))
    const ids = new Set(targets.map((u) => u.id));
    setUsers((prev) => prev.filter((u) => !ids.has(u.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    if (detailUser && ids.has(detailUser.id)) setDetailUser(null);
    showToast(
      targets.length === 1
        ? `${targets[0].firstName} ${targets[0].lastName} has been removed.`
        : `${targets.length} users have been removed.`
    );
    setModal(null);
  }

  function confirmRoleChange(userId, newRole) {
    // TODO (Phase 2): await api.changeUserRole(userId, newRole)
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    if (detailUser?.id === userId) {
      setDetailUser((prev) => ({ ...prev, role: newRole }));
    }
    showToast(`Role changed to ${newRole}.`);
    setModal(null);
  }

  function confirmGroupChange(targetIds, newGroupId) {
    // TODO (Phase 2): await api.changeUserGroup(targetIds, newGroupId)
    const grp = groups.find((g) => g.id === newGroupId);
    setUsers((prev) =>
      prev.map((u) =>
        targetIds.includes(u.id)
          ? { ...u, profile: { ...u.profile, groupId: newGroupId, caretakerId: grp?.caretakerId ?? null } }
          : u
      )
    );
    if (detailUser && targetIds.includes(detailUser.id)) {
      setDetailUser((prev) => ({
        ...prev,
        profile: { ...prev.profile, groupId: newGroupId, caretakerId: grp?.caretakerId ?? null },
      }));
    }
    showToast(
      targetIds.length === 1
        ? `Participant moved to "${grp?.name}".`
        : `${targetIds.length} participants moved to "${grp?.name}".`
    );
    setModal(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-0 relative">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold bg-emerald-600 text-white pointer-events-none max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "remove" && (
        <RemoveModal
          targets={modal.targets}
          onConfirm={() => confirmRemove(modal.targets)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "role" && (
        <ChangeRoleModal
          user={modal.targets[0]}
          onConfirm={(r) => confirmRoleChange(modal.targets[0].id, r)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "group" && (
        <ChangeGroupModal
          targets={modal.targets}
          groups={groups}
          onConfirm={(gId) => confirmGroupChange(modal.targets.map((u) => u.id), gId)}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Detail panel */}
      {detailUser && (
        <UserDetailPanel
          user={detailUser}
          users={users}
          groups={groups}
          onClose={() => setDetailUser(null)}
          onRemove={() => setModal({ type: "remove", targets: [detailUser] })}
          onChangeRole={() => setModal({ type: "role", targets: [detailUser] })}
          onChangeGroup={() => setModal({ type: "group", targets: [detailUser] })}
        />
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Users &amp; Roles
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Invite new users · Manage existing accounts · Assign roles &amp; groups
        </p>
      </div>

      {/* Main two-column grid
          Mobile:  single column, users list first, invite card below
          Tablet:  single column (lg breakpoint triggers two-column)
          Desktop: 1/3 invite card (sticky) + 2/3 user list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Invite card (right on desktop, below list on mobile/tablet) ── */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:sticky lg:top-4">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">Send an Invite</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Recipient gets a one-time registration link.
              </p>
            </div>
            <div className="p-5">
              <InviteForm />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                How it works
              </p>
              {[
                "Enter email & select a role",
                "Choose a group for participants, or leave general",
                "They receive a one-time registration link",
                "Role & group are assigned on registration",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Users section (first on mobile/tablet) ── */}
        <div className="lg:col-span-2 space-y-3 order-1 lg:order-2">

          {/* Search + filter bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300"
              />
            </div>
            {/* Horizontally scrollable on mobile so all tabs stay visible */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[{ value: "all", label: "All" }, ...ROLES].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setFilterRole(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    filterRole === r.value
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {r.label}{" "}
                  <span className="opacity-60">({counts[r.value] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          {someSelected && (
            <div className="bg-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {selected.size} selected
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {allSelectedParticipants && (
                  <button
                    onClick={() => setModal({ type: "group", targets: selectedParticipants })}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-900/50 rounded-lg hover:bg-emerald-800/60 transition-colors flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Change Group
                  </button>
                )}
                <button
                  onClick={() => setModal({ type: "remove", targets: selectedUsers })}
                  className="px-3 py-1.5 text-xs font-bold text-rose-300 bg-rose-900/50 rounded-lg hover:bg-rose-800/60 transition-colors flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* User list */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">
                No users match your search.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">

                {/* Column header — hidden on mobile, visible on sm+ */}
                <div className="hidden sm:flex items-center gap-3 px-4 py-3 bg-slate-50">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-1">
                    User
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-24 text-center">
                    Role
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider w-20 text-right">
                    Actions
                  </span>
                </div>

                {filtered.map((user) => {
                  const isSelected     = selected.has(user.id);
                  const canChangeRole  = user.role === "participant";
                  const canChangeGroup = user.role === "participant";
                  const group = groups.find((g) => g.id === user.profile?.groupId);

                  return (
                    <div
                      key={user.id}
                      onClick={() => setDetailUser(user)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(user.id)}
                        className="w-4 h-4 rounded accent-blue-600 shrink-0 cursor-pointer"
                      />

                      {/* Avatar + info */}
                      <Avatar firstName={user.firstName} lastName={user.lastName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {user.firstName} {user.lastName}
                          </p>
                          <StatusDot status={user.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                          {group && (
                            <span className="text-xs text-emerald-600 font-medium hidden md:block shrink-0">
                              · {group.name}
                            </span>
                          )}
                        </div>
                        {/* Role badge inline on mobile (replaces the hidden column) */}
                        <div className="sm:hidden mt-1">
                          <RoleBadge role={user.role} />
                        </div>
                      </div>

                      {/* Role badge column — desktop only */}
                      <div className="w-24 hidden sm:flex justify-center">
                        <RoleBadge role={user.role} />
                      </div>

                      {/* Action icon buttons */}
                      <div
                        className="w-20 flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canChangeGroup && (
                          <button
                            onClick={() => setModal({ type: "group", targets: [user] })}
                            title="Change group"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        )}
                        {canChangeRole && (
                          <button
                            onClick={() => setModal({ type: "role", targets: [user] })}
                            title="Change role"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ type: "remove", targets: [user] })}
                          title="Remove user"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prototype / backend reminder note */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Prototype — uses mock data.</strong> Needs:{" "}
              <code className="bg-amber-100 px-1 rounded">GET /admin/users</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">DELETE /admin/users/bulk</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">PATCH /admin/users/:id/role</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">PATCH /admin/users/:id/group</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">GET /admin/groups</code>.{" "}
              Backend{" "}
              <code className="bg-amber-100 px-1 rounded">SignupInviteRequest</code>{" "}
              needs optional{" "}
              <code className="bg-amber-100 px-1 rounded">group_id</code>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

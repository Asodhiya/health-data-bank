import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../services/api";

// ── Backup scope definitions ─────────────────────────────────────────────────
// NOTE: The backend currently only supports "full" backups.
// Selective scopes are shown in the UI for future implementation.
// When the backend gains a `scope` query param on GET /admin_only/backup,
// simply pass selectedScope to the API call.
const BACKUP_SCOPES = [
  {
    id: "full",
    label: "Full Backup",
    description: "Complete database — all tables, all data",
    badge: "Recommended",
    badgeColor: "bg-emerald-100 text-emerald-700",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    tables: "All 32 tables",
    includes: ["Users & profiles", "Forms & submissions", "Health data & goals", "Groups & membership", "Audit logs & notifications", "System configuration"],
  },
  {
    id: "health_data",
    label: "Health Data Only",
    description: "Participant health records, submissions, and goals",
    badge: "Compliance",
    badgeColor: "bg-blue-100 text-blue-700",
    icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    tables: "12 tables",
    includes: ["Form submissions & answers", "Health data points", "Health goals & progress", "Data elements & mappings", "Goal templates", "Reports"],
  },
  {
    id: "forms_surveys",
    label: "Forms & Surveys",
    description: "Survey templates, fields, options, and deployments",
    badge: "Portable",
    badgeColor: "bg-violet-100 text-violet-700",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    tables: "6 tables",
    includes: ["Survey forms", "Form fields & options", "Field-element mappings", "Form deployments", "Data elements"],
  },
  {
    id: "system_config",
    label: "System Configuration",
    description: "Users, roles, permissions, and group structure",
    badge: "Lightweight",
    badgeColor: "bg-amber-100 text-amber-700",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    tables: "7 tables",
    includes: ["Users & profiles", "Roles & permissions", "Groups & membership"],
  },
  {
    id: "audit_logs",
    label: "Audit & Activity Logs",
    description: "Security logs, notifications, and system events",
    badge: "Archival",
    badgeColor: "bg-slate-200 text-slate-600",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    tables: "3 tables",
    includes: ["Audit log entries", "Notifications", "Reminders"],
  },
];

const SCOPE_LABELS = Object.fromEntries(BACKUP_SCOPES.map((s) => [s.id, s.label]));

// ── Icons ────────────────────────────────────────────────────────────────────
const SvgIcon = ({ d, className = "h-5 w-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);
const IconDownload = () => <SvgIcon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />;
const IconUpload = () => <SvgIcon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />;
const IconShield = () => <SvgIcon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />;
const IconCheck = () => <SvgIcon d="M5 13l4 4L19 7" />;
const IconX = () => <SvgIcon d="M6 18L18 6M6 6l12 12" />;
const IconWarning = () => <SvgIcon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="h-6 w-6" />;
const IconClock = () => <SvgIcon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4" />;
const IconDatabase = () => <SvgIcon d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" className="h-4 w-4" />;
const IconTrash = () => <SvgIcon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />;
const IconChevron = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const IconCalendar = () => <SvgIcon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />;
const IconRefresh = () => <SvgIcon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const Spinner = () => (
  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function daysAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

const TABLE_GROUPS = [
  { label: "Users & Profiles", keys: ["users", "participant_profile", "caretaker_profile", "researcher_profile", "admin_profile", "roles", "permissions", "user_roles", "role_permissions"] },
  { label: "Forms & Submissions", keys: ["survey_forms", "form_fields", "field_options", "form_submissions", "submission_answers", "form_deployments"] },
  { label: "Groups & Membership", keys: ["groups", "group_members"] },
  { label: "Health Data", keys: ["health_goals", "health_data_points", "data_elements", "goal_templates"] },
  { label: "System", keys: ["audit_log", "notifications", "reports"] },
];

// ── Generic Modal ────────────────────────────────────────────────────────────
function Modal({ open, onClose, children, maxW = "max-w-md" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl ${maxW} w-full p-6 max-h-[90vh] overflow-y-auto`}>{children}</div>
    </div>
  );
}

// ── Confirm Restore Modal ────────────────────────────────────────────────────
function ConfirmRestoreModal({ open, onClose, onConfirm, fileName, loading }) {
  return (
    <Modal open={open} onClose={() => !loading && onClose()}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><IconWarning /></div>
        <div><h3 className="text-lg font-bold text-slate-800">Confirm Database Restore</h3><p className="text-sm text-slate-500 mt-0.5">This action cannot be undone</p></div>
      </div>
      <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-rose-800">This will permanently:</p>
        <ul className="text-sm text-rose-700 space-y-1 ml-4 list-disc">
          <li>Wipe all current data in the affected tables</li>
          <li>Replace it with data from the backup file</li>
          <li>Log out all active users</li>
        </ul>
      </div>
      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
        <IconDatabase />
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{fileName}</p><p className="text-xs text-slate-400">Backup file to restore from</p></div>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
          {loading ? <><Spinner /> Restoring…</> : "Yes, Restore Database"}
        </button>
      </div>
    </Modal>
  );
}

// ── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, onClose, onConfirm, backupName, loading }) {
  return (
    <Modal open={open} onClose={() => !loading && onClose()}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><IconTrash /></div>
        <div><h3 className="text-lg font-bold text-slate-800">Delete Backup</h3><p className="text-sm text-slate-500 mt-0.5">Remove this snapshot permanently</p></div>
      </div>
      <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3">
        <p className="text-sm font-semibold text-slate-700">{backupName}</p>
        <p className="text-xs text-slate-400 mt-0.5">This backup record will be deleted. You will not be able to restore from it.</p>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
          {loading ? <><Spinner /> Deleting…</> : "Delete Backup"}
        </button>
      </div>
    </Modal>
  );
}

// ── Backup Detail Drawer ─────────────────────────────────────────────────────
function BackupDetail({ backup, onUploadLegacy }) {
  const hasCounts = backup.table_row_counts && Object.keys(backup.table_row_counts).length > 0;
  const groups = hasCounts
    ? TABLE_GROUPS.filter((g) => g.keys.some((k) => backup.table_row_counts[k] !== undefined))
    : [];

  return (
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${backup.can_inline_restore ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {backup.can_inline_restore ? "One-click restore ready" : "Manual upload restore"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
          Checksum verified
        </span>
        {backup.can_inline_restore ? null : (
          <button
            onClick={() => onUploadLegacy?.(backup)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
          >
            Upload this backup file to restore
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Snapshot name", value: backup.storage_path || backup.snapshot_name || "—" },
          { label: "Created at", value: backup.created_at ? formatDate(backup.created_at) : "—" },
          { label: "Checksum (SHA-256)", value: backup.checksum ? `${backup.checksum.slice(0, 8)}…${backup.checksum.slice(-6)}` : "—" },
          { label: "Tables", value: hasCounts ? `${Object.keys(backup.table_row_counts).length} tables` : "—" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-100 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
            <p className="text-sm font-semibold text-slate-700 mt-1 truncate" title={item.value}>{item.value}</p>
          </div>
        ))}
      </div>

      {hasCounts && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Table Row Counts</p>
          </div>
          <div className="divide-y divide-slate-50">
            {groups.map((group) => {
              const activeKeys = group.keys.filter((k) => backup.table_row_counts[k] !== undefined);
              if (activeKeys.length === 0) return null;
              const total = activeKeys.reduce((sum, k) => sum + (backup.table_row_counts[k] || 0), 0);
              return (
                <div key={group.label} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{group.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{activeKeys.map((k) => `${k.replace(/_/g, " ")} (${backup.table_row_counts[k] || 0})`).join(" · ")}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-600 tabular-nums">{total.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between">
            <span className="text-sm font-bold text-slate-700">Total rows</span>
            <span className="text-sm font-bold text-blue-600 tabular-nums">
              {Object.values(backup.table_row_counts).reduce((a, b) => a + b, 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {!hasCounts && (
        <p className="text-sm text-slate-400 text-center py-4">
          Detailed row counts are not available for this backup. Row counts are included in backups created after this update.
        </p>
      )}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ show, type, message, onClose }) {
  if (!show) return null;
  const ok = type === "success";
  return (
    <div className={`fixed top-20 right-6 z-50 max-w-sm w-full border rounded-xl p-4 shadow-lg flex items-start gap-3 animate-slide-in ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
        {ok ? <IconCheck /> : <IconX />}
      </div>
      <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{ok ? "Success" : "Error"}</p><p className="text-sm mt-0.5 opacity-80">{message}</p></div>
      <button onClick={onClose} className="text-current opacity-40 hover:opacity-70 shrink-0 mt-0.5"><IconX /></button>
    </div>
  );
}

function SearchableSelect({ value, onChange, options, placeholder = "Search..." }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  const filtered = (() => {
    if (!query) return options;
    const normalized = query.toLowerCase();
    const startsWith = options.filter((o) => o.toLowerCase().startsWith(normalized));
    const contains = options.filter(
      (o) => !o.toLowerCase().startsWith(normalized) && o.toLowerCase().includes(normalized),
    );
    return [...startsWith, ...contains];
  })();

  const handleSelect = (selected) => {
    onChange(selected);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
  };

  const handleFocus = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      handleFocus();
      e.preventDefault();
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((idx) => Math.min(idx + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((idx) => Math.max(idx - 1, 0));
      return;
    }

    if (e.key === "Enter" && filtered[highlightedIndex]) {
      e.preventDefault();
      handleSelect(filtered[highlightedIndex]);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
        placeholder={placeholder}
        value={open ? query : value || ""}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlightedIndex(0); }}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setQuery(""); }} />
          <ul
            className="fixed z-20 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg"
            style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, width: `${dropdownPos.width}px` }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt, index) => (
                <li
                  key={opt}
                  className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : opt === value
                        ? "text-blue-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function AutoBackupPanel({ showToast }) {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [time, setTime] = useState("03:00");
  const [day, setDay] = useState("sunday");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [retention, setRetention] = useState("5");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(true);
  const [notifyOnFail, setNotifyOnFail] = useState(true);
  const [autoScope, setAutoScope] = useState("full");
  const [nextRunAt, setNextRunAt] = useState(null);
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(detectedTz);

  useEffect(() => {
    let active = true;

    const loadSchedule = async () => {
      try {
        setLoading(true);
        const schedule = await api.adminGetBackupSchedule();
        if (!active) return;
        setEnabled(Boolean(schedule.enabled));
        setFrequency(schedule.frequency || "weekly");
        setTime(schedule.time || "03:00");
        setDay(schedule.day_of_week || "sunday");
        setDayOfMonth(String(schedule.day_of_month || 1));
        setRetention(String(schedule.retention_count ?? 5));
        setNotifyOnSuccess(Boolean(schedule.notify_on_success));
        setNotifyOnFail(Boolean(schedule.notify_on_failure));
        setAutoScope(schedule.scope || "full");
        setTimezone(schedule.timezone || detectedTz);
        setNextRunAt(schedule.next_run_at || null);
      } catch (err) {
        if (active) showToast("error", err.message || "Failed to load backup schedule.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSchedule();
    return () => {
      active = false;
    };
  }, [detectedTz]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const schedule = await api.adminUpdateBackupSchedule({
        enabled,
        frequency,
        time,
        day_of_week: frequency === "weekly" || frequency === "biweekly" ? day : null,
        day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
        timezone,
        scope: autoScope,
        retention_count: Number(retention),
        notify_on_success: notifyOnSuccess,
        notify_on_failure: notifyOnFail,
      });
      setNextRunAt(schedule.next_run_at || null);
      setSaved(true);
      showToast("success", "Automatic backup schedule saved.");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      showToast("error", err.message || "Failed to save backup schedule.");
    } finally {
      setSaving(false);
    }
  };

  const tzShort = timezone.replace(/_/g, " ");
  const nextBackupLabel = () => {
    if (nextRunAt) {
      return new Date(nextRunAt).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
        timeZoneName: "short",
      });
    }
    if (frequency === "daily") return `Tomorrow at ${time} (${tzShort})`;
    if (frequency === "monthly") {
      const s = dayOfMonth === "1" ? "st" : dayOfMonth === "2" ? "nd" : dayOfMonth === "3" ? "rd" : "th";
      return `${dayOfMonth}${s} of next month at ${time} (${tzShort})`;
    }
    return `${day.charAt(0).toUpperCase() + day.slice(1)} at ${time} (${tzShort})`;
  };

  const selClass = (val, current) => val === current
    ? "bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-200"
    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><IconRefresh /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Automatic Backups</h2>
            <p className="text-xs text-slate-400">Schedule recurring database snapshots</p>
          </div>
        </div>
        <button onClick={() => setEnabled(!enabled)} className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center animate-fade-in">
          <p className="text-sm text-slate-400">Loading automatic backup settings…</p>
        </div>
      ) : enabled ? (
        <div className="p-6 space-y-5 animate-fade-in">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-3a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 101.414-1.414L11 9.586V7z" clipRule="evenodd" />
            </svg>
            <span><span className="font-semibold">Live schedule.</span> Automatic backups now run from the backend scheduler. Full Backup is the active scope for scheduled runs right now.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 Weeks</option><option value="monthly">Monthly</option>
              </select>
            </div>
            {(frequency === "weekly" || frequency === "biweekly") && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Day of Week</label>
                <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  {["sunday","monday","tuesday","wednesday","thursday","friday","saturday"].map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            )}
            {frequency === "monthly" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Day of Month</label>
                <select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Timezone</label>
              <SearchableSelect
                value={timezone}
                onChange={setTimezone}
                options={Intl.supportedValuesOf("timeZone")}
                placeholder="Search for a timezone..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Retention Policy</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[{ value: "3", label: "Keep last 3" }, { value: "5", label: "Keep last 5" }, { value: "10", label: "Keep last 10" }, { value: "0", label: "Keep all" }].map((opt) => (
                <button key={opt.value} onClick={() => setRetention(opt.value)} className={`px-3 py-2.5 text-sm font-medium rounded-xl border transition-all ${selClass(opt.value, retention)}`}>{opt.label}</button>
              ))}
            </div>
            {retention !== "0" && <p className="text-xs text-slate-400 mt-2">Older backups beyond the last {retention} will be automatically deleted.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin Notifications</label>
            <div className="flex flex-col sm:flex-row gap-3">
              {[{ checked: notifyOnSuccess, set: setNotifyOnSuccess, title: "On success", desc: "Notify admins when a scheduled backup completes" }, { checked: notifyOnFail, set: setNotifyOnFail, title: "On failure", desc: "Notify admins if a scheduled backup fails" }].map((n) => (
                <label key={n.title} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors flex-1">
                  <input type="checkbox" checked={n.checked} onChange={(e) => n.set(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <div><p className="text-sm font-medium text-slate-700">{n.title}</p><p className="text-xs text-slate-400">{n.desc}</p></div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <IconCalendar />
              <span>Next backup: <span className="font-semibold text-slate-800">{nextBackupLabel()}</span></span>
            </div>
            <button onClick={handleSave} disabled={saving} className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${saved ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-blue-600 text-white hover:bg-blue-700"} ${saving ? "opacity-70 cursor-not-allowed" : ""}`}>
              {saving ? <><Spinner /> Saving…</> : saved ? <><IconCheck /> Saved</> : "Save Schedule"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center animate-fade-in">
          <p className="text-sm text-slate-400">Automatic backups are disabled. Toggle the switch above to configure a schedule.</p>
        </div>
      )}
    </div>
  );
}

function ConfirmHistoryRestoreModal({ open, onClose, onConfirm, backupName, loading }) {
  return (
    <Modal open={open} onClose={() => !loading && onClose()}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><IconWarning /></div>
        <div><h3 className="text-lg font-bold text-slate-800">Restore From Backup History</h3><p className="text-sm text-slate-500 mt-0.5">This action cannot be undone</p></div>
      </div>
      <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-rose-800">This will permanently:</p>
        <ul className="text-sm text-rose-700 space-y-1 ml-4 list-disc">
          <li>Wipe all current data in the affected tables</li>
          <li>Replace it with the selected backup snapshot</li>
          <li>Log out all active users</li>
        </ul>
      </div>
      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-3">
        <IconDatabase />
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{backupName}</p><p className="text-xs text-slate-400">Backup snapshot selected for one-click restore</p></div>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
          {loading ? <><Spinner /> Restoring…</> : "Restore This Backup"}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main Page ────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function BackupRestorePage() {
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [selectedScope, setSelectedScope] = useState("full");
  const [scopeExpanded, setScopeExpanded] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [historyRestoreTarget, setHistoryRestoreTarget] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef(null);
  const restoreSectionRef = useRef(null);

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 5000);
  };

  const currentScope = BACKUP_SCOPES.find((s) => s.id === selectedScope);

  // ── Load backup history on mount ───────────────────────────────────────────
  const fetchBackups = useCallback(async () => {
    try {
      setBackupsLoading(true);
      // Keep initial admin load light; full history can be added with pagination later.
      const data = await api.listBackups(50);
      setBackups(data);
    } catch (err) {
      console.error("Failed to load backup history:", err);
      // Non-blocking — page still works for create/restore
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  // ── Create Backup (real API — blob download) ───────────────────────────────
  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await api.downloadBackup();
      showToast("success", `${currentScope.label} created and downloaded successfully.`);
      // Refresh the backup list since the backend records each backup
      fetchBackups();
    } catch (err) {
      showToast("error", err.message || "Failed to create backup.");
    } finally {
      setBackupLoading(false);
    }
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      showToast("error", "Invalid file type. Please upload a .json backup file.");
      return;
    }
    setRestoreFile(file);
    setRestorePreview(null);
  };

  const triggerLegacyUpload = (backup) => {
    restoreSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    fileInputRef.current?.click();
    showToast("success", `Select the downloaded JSON file for '${backup.storage_path}' to continue restoring.`);
  };
  const onDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }, []);
  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  // ── Restore (real API — FormData upload) ───────────────────────────────────
  const handleRestore = async () => {
    setRestoreLoading(true);
    try {
      const result = await api.restoreBackup(restoreFile);
      showToast("success", result.message || "Database restored successfully.");
      setRestoreFile(null);
      setRestorePreview(null);
      setConfirmRestore(false);
      fetchBackups();
    } catch (err) {
      showToast("error", err.message || "Restore failed. The file may be corrupted or invalid.");
    } finally {
      setRestoreLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      if (!restoreFile) {
        setRestorePreview(null);
        return;
      }

      try {
        const preview = await api.previewRestoreBackup(restoreFile);
        if (active) setRestorePreview(preview);
      } catch (err) {
        if (active) {
          setRestorePreview(null);
          showToast("error", err.message || "Failed to preview backup file.");
        }
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [restoreFile]);

  const handleHistoryRestore = async () => {
    if (!historyRestoreTarget) return;
    setRestoreLoading(true);
    try {
      const result = await api.restoreBackupFromHistory(historyRestoreTarget.backup_id);
      showToast("success", result.message || "Database restored successfully.");
      setHistoryRestoreTarget(null);
      fetchBackups();
    } catch (err) {
      showToast("error", err.message || "Restore failed for this backup.");
    } finally {
      setRestoreLoading(false);
    }
  };

  // ── Delete (real API) ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteBackup(deleteTarget.backup_id);
      setBackups((prev) => prev.filter((b) => b.backup_id !== deleteTarget.backup_id));
      if (expandedId === deleteTarget?.backup_id) setExpandedId(null);
      showToast("success", "Backup deleted successfully.");
    } catch (err) {
      showToast("error", err.message || "Failed to delete backup.");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <style>{`
        @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      <ConfirmRestoreModal open={confirmRestore} onClose={() => setConfirmRestore(false)} onConfirm={handleRestore} fileName={restoreFile?.name || ""} loading={restoreLoading} />
      <ConfirmHistoryRestoreModal open={!!historyRestoreTarget} onClose={() => setHistoryRestoreTarget(null)} onConfirm={handleHistoryRestore} backupName={historyRestoreTarget?.storage_path || ""} loading={restoreLoading} />
      <ConfirmDeleteModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} backupName={deleteTarget?.storage_path || ""} loading={deleteLoading} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Backup & Restore</h1>
        <p className="text-sm text-slate-500 mt-1">Create database snapshots, manage backups, and restore from previous states</p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5"><IconShield /></div>
        <div>
          <p className="text-sm font-semibold text-blue-800">Integrity-verified backups</p>
          <p className="text-sm text-blue-600 mt-0.5">Every backup is signed with a SHA-256 checksum. Restores are rejected if the file has been modified or corrupted.</p>
        </div>
      </div>

      {/* Two-column: Create / Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Backup */}
        <div ref={restoreSectionRef} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><IconDownload /></div>
            <div><h2 className="text-lg font-bold text-slate-800">Create Backup</h2><p className="text-xs text-slate-400">Export a database snapshot</p></div>
          </div>
          <div className="flex-1 space-y-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Backup Scope</label>
            <button onClick={() => setScopeExpanded(!scopeExpanded)} className="w-full text-left bg-slate-50 border border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 text-slate-600"><SvgIcon d={currentScope.icon} className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{currentScope.label}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${currentScope.badgeColor}`}>{currentScope.badge}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{currentScope.tables} · {currentScope.description}</p>
              </div>
              <IconChevron open={scopeExpanded} />
            </button>

            {scopeExpanded && (
              <div className="space-y-2 animate-fade-in">
                {BACKUP_SCOPES.map((scope) => {
                  const active = selectedScope === scope.id;
                  return (
                    <button key={scope.id} onClick={() => { setSelectedScope(scope.id); setScopeExpanded(false); }}
                      className={`w-full text-left rounded-xl p-3 border transition-all flex items-start gap-3 ${active ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${active ? "bg-blue-100 text-blue-600" : "bg-slate-50 text-slate-400"}`}><SvgIcon d={scope.icon} className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${active ? "text-blue-800" : "text-slate-700"}`}>{scope.label}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${scope.badgeColor}`}>{scope.badge}</span>
                          {scope.id !== "full" && <span className="text-[9px] text-slate-400 italic">coming soon</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{scope.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {scope.includes.map((item) => <span key={item} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{item}</span>)}
                        </div>
                      </div>
                      {active && <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-1"><IconCheck /></div>}
                    </button>
                  );
                })}
              </div>
            )}

            {!scopeExpanded && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
                {[["Format", "JSON"], ["Verification", "SHA-256 checksum"], ["Tables", currentScope.tables]].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-medium text-slate-700">{v}</span></div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleCreateBackup} disabled={backupLoading || selectedScope !== "full"} className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {backupLoading ? <><Spinner /> Creating snapshot…</> : <><IconDownload /> Create & Download Backup</>}
          </button>
          {selectedScope !== "full" && <p className="text-xs text-center text-slate-400 mt-2">Selective scopes require a backend update. Only Full Backup is active.</p>}
        </div>

        {/* Restore */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><IconUpload /></div>
            <div><h2 className="text-lg font-bold text-slate-800">Restore from Backup</h2><p className="text-xs text-slate-400">Upload a previous backup file</p></div>
          </div>
          <div className="flex-1">
            <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? "border-blue-400 bg-blue-50" : restoreFile ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"}`}>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
              {restoreFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><IconCheck /></div>
                  <p className="text-sm font-semibold text-emerald-800">{restoreFile.name}</p>
                  <p className="text-xs text-emerald-600">{(restoreFile.size / 1024).toFixed(1)} KB · Ready to restore</p>
                  <button onClick={(e) => { e.stopPropagation(); setRestoreFile(null); }} className="text-xs text-slate-400 hover:text-rose-500 underline transition-colors">Remove file</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center mx-auto"><IconUpload /></div>
                  <p className="text-sm font-medium text-slate-600">Drag & drop a backup file here</p>
                  <p className="text-xs text-slate-400">or click to browse · JSON files only</p>
                </div>
              )}
            </div>
            {restorePreview && (
              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{restorePreview.snapshot_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {restorePreview.created_at ? formatDate(restorePreview.created_at) : "Unknown backup time"}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    restorePreview.checksum_verified
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {restorePreview.checksum_verified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg border border-slate-100 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tables</p>
                    <p className="text-sm font-semibold text-slate-700 mt-1">{restorePreview.table_count}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-100 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rows</p>
                    <p className="text-sm font-semibold text-slate-700 mt-1">{restorePreview.total_rows?.toLocaleString?.() || restorePreview.total_rows}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full ${restorePreview.auth_fields_sanitized ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {restorePreview.auth_fields_sanitized ? "Auth fields sanitized" : "Auth sanitization unknown"}
                  </span>
                  {restorePreview.matched_backup_id && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Matched backup history record
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-amber-700"><span className="font-semibold">Destructive operation.</span> Restoring will wipe data in the affected tables and replace it with the backup contents.</p>
            </div>
          </div>
          <button onClick={() => setConfirmRestore(true)} disabled={!restoreFile} className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <IconUpload /> Restore Database
          </button>
        </div>
      </div>

      {/* Auto-Backup Settings */}
      <AutoBackupPanel showToast={showToast} />

      {/* Backup History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Backup History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {backupsLoading ? "Loading…" : `${backups.length} snapshot${backups.length !== 1 ? "s" : ""} on record — click any row to see details`}
          </p>
        </div>

        {backupsLoading ? (
          <div className="px-6 py-12 text-center"><Spinner /><p className="text-sm text-slate-400 mt-2">Loading backup history…</p></div>
        ) : backups.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3"><IconDatabase /></div>
            <p className="text-sm text-slate-400">No backups yet. Create your first snapshot above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((b) => {
              const isExpanded = expandedId === b.backup_id;
              const totalRows = b.table_row_counts ? Object.values(b.table_row_counts).reduce((a, v) => a + v, 0) : null;
              const tableCount = b.table_row_counts ? Object.keys(b.table_row_counts).length : null;
              return (
                <div key={b.backup_id}>
                  <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                    <button onClick={() => setExpandedId(isExpanded ? null : b.backup_id)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
                        <IconCheck />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-700 truncate">{b.storage_path || b.snapshot_name}</p>
                          <IconChevron open={isExpanded} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-slate-400"><IconClock /> {formatDate(b.created_at)}</span>
                          {tableCount && <span className="flex items-center gap-1 text-xs text-slate-400"><IconDatabase /> {tableCount} tables{totalRows ? ` · ${totalRows.toLocaleString()} rows` : ""}</span>}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (b.can_inline_restore) {
                            setHistoryRestoreTarget(b);
                          } else {
                            triggerLegacyUpload(b);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${b.can_inline_restore ? "text-amber-700 bg-amber-50 hover:bg-amber-100" : "text-blue-700 bg-blue-50 hover:bg-blue-100"}`}
                        title={b.can_inline_restore ? "Restore this backup from history" : "This older backup must be restored by uploading its downloaded JSON file in the Restore from Backup panel"}
                      >
                        {b.can_inline_restore ? "Restore" : "Upload file"}
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Verified</span>
                      <span className="text-xs text-slate-400 hidden sm:inline">{daysAgo(b.created_at)}</span>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                        className="ml-1 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="Delete backup">
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                  {isExpanded && <BackupDetail backup={b} onUploadLegacy={triggerLegacyUpload} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

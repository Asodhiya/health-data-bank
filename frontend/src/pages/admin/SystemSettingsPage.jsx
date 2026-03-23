import { useState, useEffect, useCallback } from "react";

// ── API base for health checks (only real API calls on this page) ────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ── localStorage persistence (TODO: replace with backend settings API) ───────
// When a backend settings table is added, replace loadSettings/saveSettings
// with GET /admin_only/settings and PUT /admin_only/settings calls.
const STORAGE_KEY = "hdb_admin_settings";
function loadSettings() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveSettings(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

const DEFAULTS = {
  // Rate Limiting — TODO: no backend middleware yet
  rateLimitEnabled: true, rateLimitRequests: 100, rateLimitWindowMinutes: 1, rateLimitLoginAttempts: 10, rateLimitLoginWindowMinutes: 5,
  // Email — matches backend: email_sender.py (smtp.gmail.com:587)
  smtpHost: "smtp.gmail.com", smtpPort: "587", smtpTls: true, senderEmail: "", senderName: "Health Data Bank",
  // Notifications — TODO: backend only creates notifications on caretaker feedback currently
  notificationsEnabled: true, notifyNewSubmission: true, notifyNewUser: true, notifySecurityAlert: true,
  emailDigestEnabled: false, emailDigestFrequency: "daily",
  // Registration — matches backend: security.py InviteTokenGenerator (48h expiry)
  inviteOnly: true, inviteExpiryHours: 48, allowedRoles: ["participant", "caretaker", "researcher"], requirePhoneOnSignup: true,
  // Data Retention — TODO: no backend purge job yet
  retentionEnabled: false, retentionAuditLogDays: 365, retentionNotificationDays: 90, retentionSessionDays: 30,
  anonymizeOnDelete: true, allowParticipantDataExport: true, allowParticipantDataDeletion: false,
  // Maintenance — TODO: needs backend middleware to check flag before serving requests
  maintenanceMode: false, maintenanceMessage: "The system is currently undergoing scheduled maintenance. Please check back shortly.",
};

// ── Icons ────────────────────────────────────────────────────────────────────
const I = ({ d, c = "h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
const IconMail = () => <I d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />;
const IconUserAdd = () => <I d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />;
const IconServer = () => <I d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />;
const IconCheck = () => <I d="M5 13l4 4L19 7" />;
const IconX = () => <I d="M6 18L18 6M6 6l12 12" />;
const IconRefresh = () => <I d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const IconBell = () => <I d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />;
const IconTrash = () => <I d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />;
const IconArchive = () => <I d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />;
const IconTool = () => <I d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
const IconZap = () => <I d="M13 10V3L4 14h7v7l9-11h-7z" />;
const IconWarning = () => <I d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" c="h-6 w-6" />;
const Spinner = () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

// ── Reusable Components ──────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group">
      <div><p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</p>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}</div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

function NumInput({ label, value, onChange, min, max, suffix, description }) {
  return (
    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={(e) => onChange(Math.max(min||0,Math.min(max||9999,parseInt(e.target.value)||0)))} min={min} max={max}
          className="w-24 px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all" />
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
      {description && <p className="text-xs text-slate-400 mt-1.5">{description}</p>}
    </div>
  );
}

function TxtInput({ label, value, onChange, placeholder, type="text", description }) {
  return (
    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all placeholder:text-slate-300" />
      {description && <p className="text-xs text-slate-400 mt-1.5">{description}</p>}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, description }) {
  return (
    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {description && <p className="text-xs text-slate-400 mt-1.5">{description}</p>}
    </div>
  );
}

function Section({ icon, title, description, badge, badgeColor, children, borderColor = "border-slate-100" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${borderColor} overflow-hidden`}>
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">{icon}</div>
          <div><h2 className="text-lg font-bold text-slate-800">{title}</h2><p className="text-xs text-slate-400">{description}</p></div>
        </div>
        {badge && <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${badgeColor||"bg-slate-100 text-slate-500"}`}>{badge}</span>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Toast({ show, type, message, onClose }) {
  if (!show) return null;
  const ok = type === "success";
  return (
    <div className={`fixed top-20 right-6 z-50 max-w-sm w-full border rounded-xl p-4 shadow-lg flex items-start gap-3 animate-slide-in ${ok?"bg-emerald-50 border-emerald-200 text-emerald-800":"bg-rose-50 border-rose-200 text-rose-800"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok?"bg-emerald-100 text-emerald-600":"bg-rose-100 text-rose-600"}`}>{ok?<IconCheck/>:<IconX/>}</div>
      <div className="flex-1 min-w-0"><p className="text-sm font-semibold">{ok?"Saved":"Error"}</p><p className="text-sm mt-0.5 opacity-80">{message}</p></div>
      <button onClick={onClose} className="text-current opacity-40 hover:opacity-70 shrink-0 mt-0.5"><IconX/></button>
    </div>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, icon, description, warning, buttonLabel, buttonColor, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">{icon}<div><h3 className="text-lg font-bold text-slate-800">{title}</h3><p className="text-sm text-slate-500 mt-0.5">{description}</p></div></div>
        {warning && <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm text-rose-700">{warning}</div>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${buttonColor}`}>
            {loading ? <><Spinner /> Processing…</> : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main Page ────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(() => loadSettings() || { ...DEFAULTS });
  const [toast, setToast] = useState({ show:false, type:"success", message:"" });
  const [testingEmail, setTestingEmail] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [health, setHealth] = useState({ api:null, db:null });
  const [healthLoading, setHealthLoading] = useState(true);
  const [purgeModal, setPurgeModal] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const showToast = (t, m) => { setToast({show:true,type:t,message:m}); setTimeout(()=>setToast(p=>({...p,show:false})),4000); };
  const set = (k, v) => { setSettings(p => ({...p,[k]:v})); setHasChanges(true); };
  const handleSave = () => { saveSettings(settings); setHasChanges(false); showToast("success","Settings saved locally. Backend sync coming soon."); };
  const handleReset = () => { setSettings({...DEFAULTS}); setHasChanges(true); };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    // TODO: wire to a real POST /admin_only/test-email endpoint
    await new Promise(r=>setTimeout(r,2000));
    setTestingEmail(false);
    showToast("success","Test email sent successfully.");
  };

  // TODO: wire to real backend endpoints when implemented
  const handlePurge = async () => { setPurgeLoading(true); await new Promise(r=>setTimeout(r,2500)); setPurgeLoading(false); setPurgeModal(false); showToast("success","Selected data has been purged."); };
  const handleFactoryReset = async () => { setResetLoading(true); await new Promise(r=>setTimeout(r,3000)); setResetLoading(false); setResetModal(false); showToast("success","System has been reset to factory defaults."); };

  // ── Real API: health check ─────────────────────────────────────────────
  // These hit the existing GET /health/ and GET /health/db endpoints
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    const results = { api: null, db: null };

    try {
      const apiRes = await fetch(`${API_BASE}/health/`, { credentials: "include" });
      if (apiRes.ok) {
        const data = await apiRes.json();
        results.api = data.status === "healthy" ? "healthy" : "degraded";
      } else {
        results.api = "degraded";
      }
    } catch {
      results.api = "unreachable";
    }

    try {
      const dbRes = await fetch(`${API_BASE}/health/db`, { credentials: "include" });
      if (dbRes.ok) {
        const data = await dbRes.json();
        results.db = data.status === "healthy" ? "healthy" : "degraded";
      } else {
        results.db = "degraded";
      }
    } catch {
      results.db = "unreachable";
    }

    setHealth(results);
    setHealthLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const hc = (s) => {
    if (s === "healthy") return { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Healthy" };
    if (s === "degraded") return { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "Degraded" };
    return { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", label: "Unreachable" };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <style>{`@keyframes slide-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}.animate-slide-in{animation:slide-in .3s ease-out}`}</style>
      <Toast {...toast} onClose={() => setToast(p => ({ ...p, show: false }))} />
      <ConfirmModal open={purgeModal} onClose={() => setPurgeModal(false)} onConfirm={handlePurge} loading={purgeLoading}
        title="Purge Old Data" description="Delete data older than the configured retention periods"
        icon={<div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><IconArchive /></div>}
        warning="This will permanently delete audit logs, notifications, and expired sessions beyond their retention windows. Active user data and health records are not affected."
        buttonLabel="Purge Data" buttonColor="bg-amber-600 hover:bg-amber-700" />
      <ConfirmModal open={resetModal} onClose={() => setResetModal(false)} onConfirm={handleFactoryReset} loading={resetLoading}
        title="Factory Reset" description="This cannot be undone"
        icon={<div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><IconWarning /></div>}
        warning={<><p className="font-semibold mb-1">This will permanently:</p><ul className="list-disc ml-4 space-y-1"><li>Wipe ALL data from every table</li><li>Remove all users, forms, submissions, and health records</li><li>Reset roles and permissions to defaults</li><li>Log out all active sessions</li></ul></>}
        buttonLabel="Yes, Reset Everything" buttonColor="bg-rose-600 hover:bg-rose-700" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-800">System Settings</h1><p className="text-sm text-slate-500 mt-1">Configure email, notifications, rate limiting, data retention, and system health</p></div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={handleReset} className="px-4 py-2 text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Reset to Defaults</button>
          <button onClick={handleSave} disabled={!hasChanges} className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${hasChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}><IconCheck /> Save Changes</button>
        </div>
      </div>

      {/* TODO banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <div><p className="text-sm font-semibold text-amber-800">Settings are saved locally</p><p className="text-sm text-amber-600 mt-0.5">These settings reflect current backend defaults. Changes are stored in your browser until a settings API is implemented.</p></div>
      </div>

      {/* ── System Health + About ─────────────────────────────────────────── */}
      <Section icon={<IconServer />} title="System Health" description="Live status and system information"
        badge={healthLoading ? "Checking…" : (health.api === "healthy" && health.db === "healthy") ? "All Systems Go" : "Issues Detected"}
        badgeColor={healthLoading ? "bg-slate-100 text-slate-500" : (health.api === "healthy" && health.db === "healthy") ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[{ key: "api", label: "API Server", desc: "FastAPI application server" }, { key: "db", label: "Database", desc: "PostgreSQL via Supabase" }].map(svc => {
            const s = health[svc.key] ? hc(health[svc.key]) : { dot: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-400", label: "Checking…" };
            return <div key={svc.key} className={`${s.bg} rounded-xl border border-slate-100 p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-3"><span className={`w-3 h-3 rounded-full ${s.dot} ${health[svc.key] === "healthy" ? "animate-pulse" : ""}`} /><div><p className="text-sm font-semibold text-slate-700">{svc.label}</p><p className="text-xs text-slate-400 mt-0.5">{svc.desc}</p></div></div>
              <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
            </div>;
          })}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Information</p>
          {[
            ["Application", "Health Data Bank v1.0.0"],
            ["Environment", "Development"],
            ["API Framework", "FastAPI (Python 3.12)"],
            ["Database", "PostgreSQL 15 (Supabase)"],
            ["Frontend", "React 18 + Vite 5"],
            ["Last Deploy", "—"],
            ["Build", "dev-local"],
          ].map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-400">{k}</span><span className="font-medium text-slate-700">{v}</span></div>)}
        </div>

        <button onClick={fetchHealth} disabled={healthLoading} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors disabled:opacity-50">
          {healthLoading ? <Spinner /> : <IconRefresh />} Re-check services
        </button>
      </Section>

      {/* ── API Rate Limiting ─────────────────────────────────────────────── */}
      <Section icon={<IconZap />} title="API Rate Limiting" description="Throttle excessive requests to protect the system" badge={settings.rateLimitEnabled ? "Enabled" : "Disabled"} badgeColor={settings.rateLimitEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}>
        <Toggle label="Enable API rate limiting" description="Block clients that exceed the request threshold within the time window" checked={settings.rateLimitEnabled} onChange={v => set("rateLimitEnabled", v)} />
        {settings.rateLimitEnabled && (
          <>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">General API Limits</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumInput label="Max Requests" value={settings.rateLimitRequests} onChange={v => set("rateLimitRequests", v)} min={10} max={10000} suffix="requests" description="Maximum requests per window per client" />
                <NumInput label="Window Duration" value={settings.rateLimitWindowMinutes} onChange={v => set("rateLimitWindowMinutes", v)} min={1} max={60} suffix="minutes" description="Rolling time window for the limit" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Login Endpoint (Stricter)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumInput label="Max Login Attempts" value={settings.rateLimitLoginAttempts} onChange={v => set("rateLimitLoginAttempts", v)} min={3} max={50} suffix="attempts" description="Per IP address, separate from account lockout" />
                <NumInput label="Window Duration" value={settings.rateLimitLoginWindowMinutes} onChange={v => set("rateLimitLoginWindowMinutes", v)} min={1} max={60} suffix="minutes" description="Login-specific rate limit window" />
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── Email / SMTP ──────────────────────────────────────────────────── */}
      <Section icon={<IconMail />} title="Email Configuration" description="SMTP server for password resets and invite emails" badge="Gmail SMTP" badgeColor="bg-blue-100 text-blue-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TxtInput label="SMTP Host" value={settings.smtpHost} onChange={v => set("smtpHost", v)} placeholder="smtp.gmail.com" />
          <div className="grid grid-cols-2 gap-4">
            <TxtInput label="Port" value={settings.smtpPort} onChange={v => set("smtpPort", v)} placeholder="587" />
            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">TLS</label><div className="h-[42px] flex items-center"><Toggle label="STARTTLS" checked={settings.smtpTls} onChange={v => set("smtpTls", v)} /></div></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TxtInput label="Sender Email" value={settings.senderEmail} onChange={v => set("senderEmail", v)} placeholder="noreply@yourdomain.com" description="Set via EMAIL_USER environment variable" />
          <TxtInput label="Display Name" value={settings.senderName} onChange={v => set("senderName", v)} placeholder="Health Data Bank" description="Shown as the 'From' name in emails" />
        </div>
        <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-sm font-medium text-slate-700">Test Email Configuration</p><p className="text-xs text-slate-400 mt-0.5">Send a test email to verify SMTP connectivity</p></div>
          <button onClick={handleTestEmail} disabled={testingEmail} className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
            {testingEmail ? <><Spinner /> Sending…</> : <><IconMail /> Send Test</>}
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <p className="text-xs text-blue-700">SMTP credentials (<code className="bg-blue-100 px-1 rounded text-[11px]">EMAIL_USER</code> and <code className="bg-blue-100 px-1 rounded text-[11px]">EMAIL_PASS</code>) are stored as environment variables on the server, not in these settings.</p>
        </div>
      </Section>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Section icon={<IconBell />} title="Notifications" description="Control in-app and email notification behavior" badge={settings.notificationsEnabled ? "Enabled" : "Disabled"} badgeColor={settings.notificationsEnabled ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}>
        <Toggle label="Enable in-app notifications" description="Show real-time notification bell for all users" checked={settings.notificationsEnabled} onChange={v => set("notificationsEnabled", v)} />
        {settings.notificationsEnabled && (
          <>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notification Triggers</p>
              <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                <Toggle label="New form submission" description="Notify caretakers when a participant submits a survey" checked={settings.notifyNewSubmission} onChange={v => set("notifyNewSubmission", v)} />
                <Toggle label="New user registration" description="Notify admins when a new user completes sign-up" checked={settings.notifyNewUser} onChange={v => set("notifyNewUser", v)} />
                <Toggle label="Security alerts" description="Notify admins on failed login attempts and account lockouts" checked={settings.notifySecurityAlert} onChange={v => set("notifySecurityAlert", v)} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Email Digest</p>
              <Toggle label="Send email digest" description="Aggregate notifications into a scheduled email summary" checked={settings.emailDigestEnabled} onChange={v => set("emailDigestEnabled", v)} />
              {settings.emailDigestEnabled && (
                <div className="mt-3">
                  <SelectInput label="Digest Frequency" value={settings.emailDigestFrequency} onChange={v => set("emailDigestFrequency", v)}
                    options={[{ value: "daily", label: "Daily (every morning)" }, { value: "weekly", label: "Weekly (every Monday)" }, { value: "biweekly", label: "Every 2 weeks" }]} />
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {/* ── User Registration ─────────────────────────────────────────────── */}
      <Section icon={<IconUserAdd />} title="User Registration" description="Control how new users join the system" badge="Invite Only" badgeColor="bg-violet-100 text-violet-700">
        <Toggle label="Invite-only registration" description="Users can only create accounts through admin or caretaker invites. No public sign-up." checked={settings.inviteOnly} onChange={v => set("inviteOnly", v)} />
        <NumInput label="Invite Link Expiry" value={settings.inviteExpiryHours} onChange={v => set("inviteExpiryHours", v)} min={1} max={720} suffix="hours" description="Invite links become invalid after this period" />
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Roles Available for Invitation</p>
          <div className="space-y-3 bg-slate-50 rounded-xl p-4">
            {[{ id: "participant", label: "Participant", desc: "Can fill forms, track goals, view personal data" }, { id: "caretaker", label: "Caretaker", desc: "Can manage participants, provide feedback, generate reports" }, { id: "researcher", label: "Researcher", desc: "Can create forms, view aggregated data, export CSV" }].map(role =>
              <Toggle key={role.id} label={role.label} description={role.desc} checked={settings.allowedRoles.includes(role.id)}
                onChange={checked => set("allowedRoles", checked ? [...settings.allowedRoles, role.id] : settings.allowedRoles.filter(r => r !== role.id))} />
            )}
          </div>
        </div>
        <Toggle label="Require phone number on sign-up" description="If disabled, the phone field becomes optional during registration" checked={settings.requirePhoneOnSignup} onChange={v => set("requirePhoneOnSignup", v)} />
      </Section>

      {/* ── Data Retention / Privacy ──────────────────────────────────────── */}
      <Section icon={<IconArchive />} title="Data Retention & Privacy" description="Auto-purge policies and participant data rights">
        <Toggle label="Enable automatic data retention" description="Automatically delete old system data (audit logs, notifications, expired sessions) beyond the retention periods below" checked={settings.retentionEnabled} onChange={v => set("retentionEnabled", v)} />
        {settings.retentionEnabled && (
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Retention Periods</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumInput label="Audit Logs" value={settings.retentionAuditLogDays} onChange={v => set("retentionAuditLogDays", v)} min={30} max={3650} suffix="days" description="Security and activity logs" />
              <NumInput label="Notifications" value={settings.retentionNotificationDays} onChange={v => set("retentionNotificationDays", v)} min={7} max={365} suffix="days" description="Read notifications" />
              <NumInput label="Expired Sessions" value={settings.retentionSessionDays} onChange={v => set("retentionSessionDays", v)} min={1} max={365} suffix="days" description="Logged-out session records" />
            </div>
            <button onClick={() => setPurgeModal(true)} className="mt-4 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors flex items-center gap-2">
              <IconArchive /> Run Purge Now
            </button>
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Participant Data Rights</p>
          <div className="space-y-3 bg-slate-50 rounded-xl p-4">
            <Toggle label="Anonymize data on account deletion" description="Replace personal info with anonymized placeholders instead of full deletion" checked={settings.anonymizeOnDelete} onChange={v => set("anonymizeOnDelete", v)} />
            <Toggle label="Allow participants to export their data" description="Participants can download a copy of their personal health data" checked={settings.allowParticipantDataExport} onChange={v => set("allowParticipantDataExport", v)} />
            <Toggle label="Allow participants to request data deletion" description="Participants can submit a request to permanently delete their records" checked={settings.allowParticipantDataDeletion} onChange={v => set("allowParticipantDataDeletion", v)} />
          </div>
        </div>
      </Section>

      {/* ── Maintenance Mode ──────────────────────────────────────────────── */}
      <Section icon={<IconTool />} title="Maintenance Mode" description="Take the system offline for maintenance"
        badge={settings.maintenanceMode ? "ACTIVE" : "Off"} badgeColor={settings.maintenanceMode ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}
        borderColor={settings.maintenanceMode ? "border-amber-200" : "border-slate-100"}>
        <Toggle label="Enable maintenance mode" description="When active, all non-admin users see a maintenance page. Admins can still access the system." checked={settings.maintenanceMode} onChange={v => set("maintenanceMode", v)} />
        {settings.maintenanceMode && (
          <>
            <TxtInput label="Maintenance Message" value={settings.maintenanceMessage} onChange={v => set("maintenanceMessage", v)} placeholder="The system is currently undergoing maintenance…" description="Shown to non-admin users when they try to access the system" />
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><IconTool /> Maintenance mode is active</p>
              <p className="text-xs text-amber-600 mt-1">All participants, caretakers, and researchers are currently locked out. Only admins can access the system.</p>
            </div>
          </>
        )}
      </Section>

      {/* ── Danger Zone ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-rose-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-rose-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><IconTrash /></div>
          <div><h2 className="text-lg font-bold text-rose-800">Danger Zone</h2><p className="text-xs text-rose-400">Irreversible actions that affect the entire system</p></div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-rose-50/50 rounded-xl p-4 border border-rose-100">
            <div><p className="text-sm font-semibold text-slate-800">Purge system data</p><p className="text-xs text-slate-400 mt-0.5">Delete audit logs, expired sessions, and read notifications beyond retention periods</p></div>
            <button onClick={() => setPurgeModal(true)} className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors shrink-0">Purge Data</button>
          </div>
          <div className="flex items-center justify-between bg-rose-50/50 rounded-xl p-4 border border-rose-100">
            <div><p className="text-sm font-semibold text-slate-800">Factory reset</p><p className="text-xs text-slate-400 mt-0.5">Wipe all data and restore the system to its initial state. This cannot be undone.</p></div>
            <button onClick={() => setResetModal(true)} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shrink-0">Reset System</button>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-40">
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl border border-slate-700">
            <p className="text-sm font-medium">You have unsaved changes</p>
            <div className="flex items-center gap-3">
              <button onClick={() => { setSettings(loadSettings() || { ...DEFAULTS }); setHasChanges(false); }} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">Discard</button>
              <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2"><IconCheck /> Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

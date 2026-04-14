import { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ── Icons ────────────────────────────────────────────────────────────────────
const I = ({ d, c = "h-5 w-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
const IconMail    = () => <I d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />;
const IconServer  = () => <I d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />;
const IconCheck   = () => <I d="M5 13l4 4L19 7" />;
const IconX       = () => <I d="M6 18L18 6M6 6l12 12" />;
const IconRefresh = () => <I d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const IconTool    = () => <I d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
const IconUserAdd = () => <I d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />;
const Spinner     = () => <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;

// ── Reusable Components ───────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? "opacity-50" : "cursor-pointer group"}`}>
      <div>
        <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-blue-600" : "bg-slate-300"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-sm py-1 gap-3">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="font-medium text-slate-700 text-right">{value}</span>
    </div>
  );
}

function Section({ icon, title, description, badge, badgeColor, children, borderColor = "border-slate-100" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${borderColor} overflow-hidden`}>
      <div className="px-6 py-5 border-b border-slate-100 flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">{icon}</div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
        {badge && <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${badgeColor || "bg-slate-100 text-slate-500"}`}>{badge}</span>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Toast({ show, type, message, onClose }) {
  if (!show) return null;
  const ok = type === "success";
  return (
    <div className={`fixed top-20 right-6 z-50 max-w-sm w-full border rounded-xl p-4 shadow-lg flex items-start gap-3 animate-slide-in ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
        {ok ? <IconCheck /> : <IconX />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{ok ? "Saved" : "Error"}</p>
        <p className="text-sm mt-0.5 opacity-80">{message}</p>
      </div>
      <button onClick={onClose} className="text-current opacity-40 hover:opacity-70 shrink-0 mt-0.5"><IconX /></button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Main Page ─────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
export default function SystemSettingsPage() {
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  // ── System Health ──────────────────────────────────────────────────────────
  const [health, setHealth] = useState({ api: null, db: null });
  const [healthLoading, setHealthLoading] = useState(true);

  // ── Maintenance Mode ───────────────────────────────────────────────────────
  const [maintenance, setMaintenance] = useState({ enabled: false, message: "" });
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceDirty, setMaintenanceDirty] = useState(false);
  const [maintenanceOriginal, setMaintenanceOriginal] = useState(null);

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(p => ({ ...p, show: false })), 4000);
  };

  // ── Health check ───────────────────────────────────────────────────────────
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    const results = { api: null, db: null };
    try {
      const res = await fetch(`${API_BASE}/health/`, { credentials: "include" });
      results.api = res.ok ? ((await res.json()).status === "healthy" ? "healthy" : "degraded") : "degraded";
    } catch { results.api = "unreachable"; }
    try {
      const res = await fetch(`${API_BASE}/health/db`, { credentials: "include" });
      results.db = res.ok ? ((await res.json()).status === "healthy" ? "healthy" : "degraded") : "degraded";
    } catch { results.db = "unreachable"; }
    setHealth(results);
    setHealthLoading(false);
  }, []);

  // ── Maintenance load ────────────────────────────────────────────────────────
  const fetchMaintenance = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const data = await api.adminGetMaintenanceSettings();
      const m = { enabled: data.enabled, message: data.message || "" };
      setMaintenance(m);
      setMaintenanceOriginal(m);
    } catch {
      showToast("error", "Could not load maintenance settings.");
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); fetchMaintenance(); }, [fetchHealth, fetchMaintenance]);

  const setMaintenanceField = (field, value) => {
    setMaintenance(p => {
      const next = { ...p, [field]: value };
      setMaintenanceDirty(
        next.enabled !== maintenanceOriginal?.enabled ||
        next.message !== maintenanceOriginal?.message
      );
      return next;
    });
  };

  const handleSaveMaintenance = async () => {
    setMaintenanceSaving(true);
    try {
      const data = await api.adminUpdateMaintenanceSettings(maintenance);
      const m = { enabled: data.enabled, message: data.message || "" };
      setMaintenance(m);
      setMaintenanceOriginal(m);
      setMaintenanceDirty(false);
      showToast("success", maintenance.enabled ? "Maintenance mode is now active." : "Maintenance mode disabled.");
    } catch {
      showToast("error", "Failed to save maintenance settings.");
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleDiscardMaintenance = () => {
    setMaintenance(maintenanceOriginal);
    setMaintenanceDirty(false);
  };

  // ── Health status helpers ──────────────────────────────────────────────────
  const hc = (s) => {
    if (s === "healthy")     return { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Healthy" };
    if (s === "degraded")    return { dot: "bg-amber-500",   bg: "bg-amber-50",   text: "text-amber-700",   label: "Degraded" };
    return                          { dot: "bg-rose-500",    bg: "bg-rose-50",    text: "text-rose-700",    label: "Unreachable" };
  };

  const allHealthy = health.api === "healthy" && health.db === "healthy";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <style>{`@keyframes slide-in{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}.animate-slide-in{animation:slide-in .3s ease-out}`}</style>
      <Toast {...toast} onClose={() => setToast(p => ({ ...p, show: false }))} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">System health, maintenance mode, and server configuration</p>
      </div>

      {/* ── System Health ─────────────────────────────────────────────────── */}
      <Section
        icon={<IconServer />}
        title="System Health"
        description="Live status of backend services"
        badge={healthLoading ? "Checking…" : allHealthy ? "All Systems Go" : "Issues Detected"}
        badgeColor={healthLoading ? "bg-slate-100 text-slate-500" : allHealthy ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: "api", label: "API Server",  desc: "FastAPI application server" },
            { key: "db",  label: "Database",    desc: "PostgreSQL via Supabase" },
          ].map(svc => {
            const s = health[svc.key] ? hc(health[svc.key]) : { dot: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-400", label: "Checking…" };
            return (
              <div key={svc.key} className={`${s.bg} rounded-xl border border-slate-100 p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${s.dot} ${health[svc.key] === "healthy" ? "animate-pulse" : ""}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{svc.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{svc.desc}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Information</p>
          <InfoRow label="Application"   value="Health Data Bank v1.0.0" />
          <InfoRow label="Environment"   value="Development" />
          <InfoRow label="API Framework" value="FastAPI (Python 3.12)" />
          <InfoRow label="Database"      value="PostgreSQL 15 (Supabase)" />
          <InfoRow label="Frontend"      value="React 18 + Vite 5" />
        </div>

        <button
          onClick={fetchHealth}
          disabled={healthLoading}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {healthLoading ? <Spinner /> : <IconRefresh />} Re-check services
        </button>
      </Section>

      {/* ── Email Configuration ───────────────────────────────────────────── */}
      <Section icon={<IconMail />} title="Email Configuration" description="SMTP server for password resets and invite emails" badge="Gmail SMTP" badgeColor="bg-blue-100 text-blue-700">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Configuration</p>
          <InfoRow label="SMTP Host"    value="smtp.gmail.com" />
          <InfoRow label="Port"         value="587 (STARTTLS)" />
          <InfoRow label="Sender Name"  value="Health Data Bank" />
          <InfoRow label="Credentials"  value="Set via environment variables" />
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <p className="text-xs text-blue-700">
            SMTP credentials (<code className="bg-blue-100 px-1 rounded text-[11px]">EMAIL_USER</code> and <code className="bg-blue-100 px-1 rounded text-[11px]">EMAIL_PASS</code>) are configured as server environment variables and cannot be changed from this UI.
          </p>
        </div>
      </Section>

      {/* ── User Registration ─────────────────────────────────────────────── */}
      <Section icon={<IconUserAdd />} title="User Registration" description="How new users join the system" badge="Invite Only" badgeColor="bg-violet-100 text-violet-700">
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Configuration</p>
          <InfoRow label="Registration mode" value="Invite only" />
          <InfoRow label="Invite link expiry" value="48 hours" />
          <InfoRow label="Roles available"    value="Participant, Caretaker, Researcher" />
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          <p className="text-xs text-blue-700">Registration settings are configured in the server environment. Send invites from the <strong>User Management</strong> page.</p>
        </div>
      </Section>

      {/* ── Maintenance Mode ──────────────────────────────────────────────── */}
      <Section
        icon={<IconTool />}
        title="Maintenance Mode"
        description="Take the system offline for all non-admin users"
        badge={maintenanceLoading ? "Loading…" : maintenance.enabled ? "ACTIVE" : "Off"}
        badgeColor={maintenanceLoading ? "bg-slate-100 text-slate-500" : maintenance.enabled ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}
        borderColor={maintenance.enabled ? "border-amber-200" : "border-slate-100"}
      >
        {maintenanceLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Loading…</div>
        ) : (
          <>
            <Toggle
              label="Enable maintenance mode"
              description="When active, participants, caretakers, and researchers see a maintenance page. Admins can still access the system."
              checked={maintenance.enabled}
              onChange={v => setMaintenanceField("enabled", v)}
            />

            {maintenance.enabled && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Maintenance Message</label>
                  <textarea
                    value={maintenance.message}
                    onChange={e => setMaintenanceField("message", e.target.value)}
                    rows={3}
                    placeholder="The system is currently undergoing scheduled maintenance. Please check back shortly."
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all placeholder:text-slate-300 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">Shown to non-admin users while maintenance is active.</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><IconTool /> Maintenance mode is active</p>
                  <p className="text-xs text-amber-600 mt-1">All participants, caretakers, and researchers are currently locked out.</p>
                </div>
              </>
            )}

            {maintenanceDirty && (
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={handleDiscardMaintenance}
                  disabled={maintenanceSaving}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveMaintenance}
                  disabled={maintenanceSaving}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                {maintenanceSaving ? <><Spinner /> Saving…</> : <><IconCheck /> {maintenance.enabled ? (maintenanceOriginal?.enabled ? "Save Changes" : "Start Maintenance Mode") : "Disable Maintenance Mode"}</>}
                </button>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

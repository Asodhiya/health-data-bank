import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

// ─── Field config ───────────────────────────────────────────────────────────────

const TITLES = ["Mr.", "Ms.", "Mrs.", "Mx.", "Dr.", "Prof."];

const REQUIRED_FIELDS = [
  { key: "role_title", label: "Position / Role Title" },
  { key: "department", label: "Department" },
  { key: "organization", label: "Organization" },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AdminOnboardingPage() {
  const navigate = useNavigate();
  const { user, logout, refetch } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const [form, setForm] = useState({
    title: "",
    role_title: "",
    department: "",
    organization: "",
    bio: "",
    contact_preference: "email",
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);
  const fieldRefs = useRef({});

  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: typeof val === "object" && val?.target ? val.target.value : val }));

  const missing = REQUIRED_FIELDS.filter(f => !form[f.key]?.trim());
  const progress = REQUIRED_FIELDS.length - missing.length;

  const scrollTo = (key) => {
    fieldRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    fieldRefs.current[key]?.focus?.();
  };

  async function handleSubmit() {
    setTouched(true);
    if (missing.length > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      scrollTo(missing[0].key);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.adminUpdateProfile(form);
      await refetch();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isReq = (key) => touched && !form[key]?.trim();

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-xl space-y-6">
        {/* Logout */}
        <div className="flex justify-end">
          <button type="button" className="rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoggingOut} onClick={handleLogout}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.first_name || "Admin"}</h1>
          <p className="text-sm text-slate-400 mt-1.5">Complete your admin profile to get started.</p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Completion</span>
            <span className="text-xs font-bold text-slate-700">{progress}/{REQUIRED_FIELDS.length}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${(progress / REQUIRED_FIELDS.length) * 100}%` }} />
          </div>
        </div>

        {/* Missing fields banner */}
        {touched && missing.length > 0 && (
          <div className={`bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Missing required fields</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map(f => (
                <button key={f.key} onClick={() => scrollTo(f.key)}
                  className="text-xs font-semibold bg-white text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full hover:bg-rose-100 transition-colors">
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-700">Admin Profile</p>
            <p className="text-xs text-slate-400 mt-0.5">This information will be visible to other system administrators.</p>
          </div>
          <div className="p-5 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
              <div className="flex gap-1.5 flex-wrap">
                {TITLES.map(t => (
                  <button key={t} onClick={() => set("title")(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${form.title === t ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Title — required */}
            <div ref={el => fieldRefs.current.role_title = el}
              className={`rounded-xl transition-all ${isReq("role_title") ? "border-l-4 border-rose-400 bg-rose-50/30 pl-3" : ""}`}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Position / Role Title <span className="text-rose-500">*</span> {isReq("role_title") && <span className="text-rose-500 normal-case font-semibold ml-1">Required</span>}
              </label>
              <input type="text" value={form.role_title} onChange={set("role_title")} placeholder="e.g. System Administrator, IT Director" maxLength={50}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-800 placeholder:text-slate-300" />
            </div>

            {/* Department — required */}
            <div ref={el => fieldRefs.current.department = el}
              className={`rounded-xl transition-all ${isReq("department") ? "border-l-4 border-rose-400 bg-rose-50/30 pl-3" : ""}`}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Department <span className="text-rose-500">*</span> {isReq("department") && <span className="text-rose-500 normal-case font-semibold ml-1">Required</span>}
              </label>
              <input type="text" value={form.department} onChange={set("department")} placeholder="e.g. Information Technology, Operations" maxLength={50}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-800 placeholder:text-slate-300" />
            </div>

            {/* Organization — required */}
            <div ref={el => fieldRefs.current.organization = el}
              className={`rounded-xl transition-all ${isReq("organization") ? "border-l-4 border-rose-400 bg-rose-50/30 pl-3" : ""}`}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Organization <span className="text-rose-500">*</span> {isReq("organization") && <span className="text-rose-500 normal-case font-semibold ml-1">Required</span>}
              </label>
              <input type="text" value={form.organization} onChange={set("organization")} placeholder="e.g. UPEI, Halifax Health Authority" maxLength={50}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-800 placeholder:text-slate-300" />
            </div>

            {/* Bio — optional */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bio <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
              <textarea value={form.bio} onChange={set("bio")} rows={3} placeholder="A brief description of your role and responsibilities…" maxLength={300}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-slate-800 placeholder:text-slate-300 resize-none" />
              <p className="text-xs text-slate-400 mt-1 text-right">{(form.bio || "").length}/300</p>
            </div>

            {/* Contact Preference */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Preferred Contact Method</label>
              <div className="flex gap-1.5">
                {[{ v: "email", l: "Email" }, { v: "phone", l: "Phone" }, { v: "in_app", l: "In-App" }].map(opt => (
                  <button key={opt.v} onClick={() => set("contact_preference")(opt.v)}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${form.contact_preference === opt.v ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-4 py-3 rounded-xl">{error}</p>}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={saving}
          className="w-full py-3 text-sm font-bold text-white bg-rose-600 rounded-2xl hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
          {saving ? (
            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving…</>
          ) : "Complete Setup"}
        </button>

        <p className="text-xs text-slate-300 text-center">You can update this information anytime from your profile settings.</p>
      </div>

      <style>{`
        @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
      `}</style>
    </div>
  );
}

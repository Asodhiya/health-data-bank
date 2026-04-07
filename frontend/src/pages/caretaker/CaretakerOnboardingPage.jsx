import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

/* ── Shake keyframe (injected once) ── */
if (typeof document !== "undefined" && !document.getElementById("hdb-shake-style")) {
  const style = document.createElement("style");
  style.id = "hdb-shake-style";
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}

function ChipSelect({ options, value, onChange, multi = false }) {
  const toggle = (opt) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt]);
    } else {
      onChange(opt);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = multi ? (value || []).includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              selected
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Field({ id, label, required = false, missing = false, shake = false, children, hint }) {
  return (
    <div
      id={id}
      className={`mb-5 rounded-lg transition-all duration-300 ${
        missing
          ? `border-l-[3px] border-l-rose-400 pl-3.5 bg-rose-50/30 py-2.5 -ml-1 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`
          : "pl-0"
      }`}
    >
      <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {missing && (
          <span className="text-[10px] font-bold text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded-full ml-1">
            Required
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow placeholder-slate-400";

const REQUIRED_FIELDS = [
  { key: "credentials", label: "License / Credentials" },
  { key: "availableDays", label: "Available Days" },
];

function isFieldFilled(key, form) {
  if (key === "availableDays") return (form.availableDays || []).length > 0;
  return typeof form[key] === "string" ? form[key].trim() !== "" : !!form[key];
}

export default function CaretakerOnboardingPage() {
  const navigate = useNavigate();
  const { logout, refetch } = useAuth();
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
    organization: "",
    credentials: "",
    specialty: "",
    bio: "",
    workingHoursStart: "09:00",
    workingHoursEnd: "17:00",
    contactPreference: "email",
    availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  });

  const [touched, setTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [shakeFields, setShakeFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (field) => (val) => {
    if (!touched) setTouched(true);
    setForm((prev) => ({ ...prev, [field]: val }));
  };
  const setInput = (field) => (e) => set(field)(e.target.value);

  const missingFields = REQUIRED_FIELDS.filter((f) => !isFieldFilled(f.key, form));
  const completedCount = REQUIRED_FIELDS.length - missingFields.length;
  const progressPct = Math.round((completedCount / REQUIRED_FIELDS.length) * 100);

  const showMissing = attempted;
  const isMissing = (key) => showMissing && !isFieldFilled(key, form);
  const isShaking = (key) => shakeFields.includes(key);

  const handleSubmit = async () => {
    setAttempted(true);
    setError("");

    if (missingFields.length > 0) {
      const keys = missingFields.map((f) => f.key);
      setShakeFields(keys);
      setTimeout(() => setShakeFields([]), 500);
      document.getElementById(`field-${keys[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSaving(true);
    try {
      await api.caretakerUpdateProfile({
        title: form.title || null,
        organization: form.organization || null,
        credentials: form.credentials,
        specialty: form.specialty || null,
        bio: form.bio || null,
        working_hours_start: form.workingHoursStart,
        working_hours_end: form.workingHoursEnd,
        contact_preference: form.contactPreference,
        available_days: form.availableDays,
      });
      await refetch();
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl flex flex-col items-center">
          <div className="w-full mb-6 flex items-start justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 tracking-tight">
              Health Data Bank
            </h1>
            <button type="button" className="shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoggingOut} onClick={handleLogout}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
          <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-8 sm:p-10 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">You're all set!</h2>
            <p className="text-slate-500 mb-1">Your caretaker profile has been saved.</p>
            <p className="text-sm text-slate-400 mb-8">
              You can update these details anytime from your Profile page.
            </p>
            <button
              onClick={() => navigate("/caretaker", { replace: true })}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 tracking-tight mb-6 text-center">
          Health Data Bank
        </h1>

        <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Complete Your Profile</h2>
            <p className="text-sm text-slate-500">
              Let participants know how to reach you and when you're available.
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-400">
                {completedCount === REQUIRED_FIELDS.length ? (
                  <span className="text-emerald-600 font-semibold">All required fields completed</span>
                ) : (
                  <>{completedCount} of {REQUIRED_FIELDS.length} required fields</>
                )}
              </span>
              <span className={`text-xs font-bold ${progressPct === 100 ? "text-emerald-600" : "text-blue-600"}`}>
                {progressPct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progressPct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2.5 rounded-xl mb-5">
              {error}
            </div>
          )}

          {showMissing && missingFields.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-rose-700">
                  {missingFields.length} required field{missingFields.length > 1 ? "s" : ""} still needed:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {missingFields.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => document.getElementById(`field-${f.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="text-[11px] font-medium text-rose-600 bg-rose-100 hover:bg-rose-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Professional Info ═══ */}
          <div className="border border-slate-100 rounded-xl p-5 mb-5">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
              Professional Information
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field id="field-title" label="Title">
                <ChipSelect
                  options={["Dr.", "Prof.", "Mr.", "Ms.", "Mx."]}
                  value={form.title}
                  onChange={set("title")}
                />
              </Field>

              <Field id="field-organization" label="Organization" hint="e.g. UPEI, Island Health Authority">
                <input
                  className={inputCls}
                  placeholder="e.g. UPEI Faculty of Science"
                  value={form.organization}
                  onChange={setInput("organization")}
                  maxLength={50}
                />
              </Field>
            </div>

            <Field
              id="field-credentials"
              label="License / Credentials"
              required
              missing={isMissing("credentials")}
              shake={isShaking("credentials")}
              hint="e.g. RN, MD, CSEP-CEP — displayed next to your name"
            >
              <input
                className={isMissing("credentials") ? "w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-shadow placeholder-slate-400" : inputCls}
                placeholder="e.g. RN, MD, CSEP-CEP"
                value={form.credentials}
                onChange={setInput("credentials")}
                maxLength={50}
              />
            </Field>

            <Field id="field-specialty" label="Specialty / Focus Area">
              <input
                className={inputCls}
                placeholder="e.g. Mental Health, Sports Medicine, Chronic Disease"
                value={form.specialty}
                onChange={setInput("specialty")}
                maxLength={80}
              />
            </Field>

            <Field id="field-bio" label="Short Bio">
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="Tell participants about your background and approach..."
                value={form.bio}
                onChange={setInput("bio")}
                maxLength={300}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{form.bio.length}/300</p>
            </Field>
          </div>

          {/* ═══ Availability ═══ */}
          <div className="border border-slate-100 rounded-xl p-5 mb-6">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4">
              Availability &amp; Contact
            </p>

            <Field id="field-workingHours" label="Working Hours">
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={form.workingHoursStart}
                  onChange={setInput("workingHoursStart")}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
                <span className="text-xs text-slate-400 font-medium">to</span>
                <input
                  type="time"
                  value={form.workingHoursEnd}
                  onChange={setInput("workingHoursEnd")}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
              </div>
            </Field>

            <Field id="field-contactPreference" label="Preferred Contact Method">
              <ChipSelect
                options={["Email", "Phone", "Either"]}
                value={form.contactPreference.charAt(0).toUpperCase() + form.contactPreference.slice(1)}
                onChange={(v) => set("contactPreference")(v.toLowerCase())}
              />
            </Field>

            <Field
              id="field-availableDays"
              label="Available Days"
              required
              missing={isMissing("availableDays")}
              shake={isShaking("availableDays")}
            >
              <ChipSelect
                options={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                value={form.availableDays}
                onChange={set("availableDays")}
                multi
              />
            </Field>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Complete Setup"
            )}
          </button>

          <p className="text-xs text-slate-400 text-center mt-3">
            You can update any of this information later from your Profile page.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <a href="#" className="hover:text-slate-500 transition-colors">Terms &amp; Conditions</a>
          <span>|</span>
          <a href="#" className="hover:text-slate-500 transition-colors">About Us</a>
          <span>|</span>
          <a href="#" className="hover:text-slate-500 transition-colors">Copyright</a>
        </div>
      </div>
    </div>
  );
}

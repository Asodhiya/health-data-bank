import { useAuth } from "../../contexts/AuthContext";

export default function MaintenancePage() {
  const { maintenance } = useAuth();
  const message = maintenance?.message || "The system is currently undergoing scheduled maintenance. Please check back shortly.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border border-amber-100 rounded-3xl shadow-sm p-8 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Maintenance Mode</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-3">We&rsquo;re making an update</h1>
        <p className="text-base text-slate-600 mt-4">{message}</p>
        <div className="mt-8 text-sm text-slate-400">Admin users can still sign in during maintenance.</div>
      </div>
    </div>
  );
}

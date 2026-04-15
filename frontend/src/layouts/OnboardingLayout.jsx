import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import HDBLogo from '../components/HDBLogo';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/*
  Figure out which step (1–3) is active based on the current URL.
  This avoids needing to pass props from App.jsx — the layout
  reads the route directly.
*/
const STEPS = [
  { num: 1, label: 'Background Info', path: '/onboarding/background' },
  { num: 2, label: 'Informed Consent', path: '/onboarding/consent' },
  { num: 3, label: 'Intake Form', path: '/onboarding/intake' },
];

function Stepper({ currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((step, i) => {
        const isDone = currentStep > step.num;
        const isActive = currentStep === step.num;

        return (
          <div key={step.num} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  isDone
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isActive
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {isDone ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600'
                    : isDone
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {i < STEPS.length - 1 && (
              <div
                className={`w-12 sm:w-20 h-0.5 mx-2 mb-5 ${
                  isDone ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Match current path to step number, default to 1
  const currentStep =
    STEPS.find((s) => location.pathname === s.path)?.num || 1;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl flex flex-col items-center">
        <div className="w-full mb-5 flex items-start justify-between gap-3">
          <HDBLogo size="lg" />
          <button
            type="button"
            className="shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        {/* Step indicator */}
        <Stepper currentStep={currentStep} />

        {/* Card — wider than AuthLayout's max-w-md */}
        <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-6 sm:p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <Link to="/terms" className="hover:text-slate-500 transition-colors">Terms and conditions</Link>
          <span>·</span>
          <span>© 2026 University of Prince Edward Island</span>
        </div>
      </div>
    </div>
  );
}

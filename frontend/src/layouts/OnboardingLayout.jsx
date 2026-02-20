import { Outlet, useLocation } from 'react-router-dom';

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
    <div className="onboarding-stepper animate-fade-up-delay-1">
      {STEPS.map((step, i) => {
        const isDone = currentStep > step.num;
        const isActive = currentStep === step.num;

        return (
          <div key={step.num} className="onboarding-stepper-row">
            {/* Step circle */}
            <div className="onboarding-step-group">
              <div
                className={`onboarding-step-circle ${
                  isDone ? 'onboarding-step-done' : ''
                } ${isActive ? 'onboarding-step-active' : ''}`}
              >
                {isDone ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`onboarding-step-label ${
                  isActive ? 'onboarding-step-label-active' : ''
                } ${isDone ? 'onboarding-step-label-done' : ''}`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line between steps */}
            {i < STEPS.length - 1 && (
              <div
                className={`onboarding-step-connector ${
                  isDone ? 'onboarding-step-connector-done' : ''
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

  // Match current path to step number, default to 1
  const currentStep =
    STEPS.find((s) => location.pathname === s.path)?.num || 1;

  return (
    <div className="auth-bg" style={{ padding: '2rem 1rem' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Brand — same as AuthLayout */}
        <h1
          className="animate-fade-up"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
            fontWeight: 800,
            color: 'var(--color-primary-800)',
            letterSpacing: '-0.02em',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}
        >
          Health Data Bank
        </h1>

        {/* Step indicator */}
        <Stepper currentStep={currentStep} />

        {/* Card — wider than AuthLayout's 420px */}
        <div
          className="glass-card animate-fade-up-delay-2"
          style={{ width: '100%', padding: '2rem 2.25rem' }}
        >
          <Outlet />
        </div>

        {/* Footer — same as AuthLayout */}
        <div
          className="animate-fade-up-delay-3"
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>
            Terms &amp; Conditions
          </a>
          <span>|</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>
            About Us
          </a>
          <span>|</span>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>
            Copyright
          </a>
        </div>
      </div>
    </div>
  );
}

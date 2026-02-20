import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sanitizeEmail } from '../utils/sanitize';

const COOLDOWN_SECONDS = 90;  // 1 minute 30 seconds
const MAX_RESENDS = 5;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  // ── Resend logic ──
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);       // seconds remaining
  const timerRef = useRef(null);

  /*
    Start the countdown timer.
    Ticks every second, clears itself when it hits 0.
  */
  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  /*
    Format seconds as M:SS for button label.
    e.g. 90 → "1:30", 9 → "0:09"
  */
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');

    // TODO: Two backend calls needed here:
    // 1. Send password reset link to user's email
    //    await api.requestPasswordReset(email.trim());
    //
    // 2. Notify admin that a password reset was requested
    //    await api.notifyAdminPasswordReset(email.trim());
    //
    // For security, always show the success state even if the
    // email doesn't exist — this prevents email enumeration attacks.

    setSent(true);
    setResendCount(1);  // First send counts as attempt #1
    startCooldown();
  };

  const handleResend = () => {
    if (cooldown > 0 || resendCount >= MAX_RESENDS) return;

    // TODO: Resend reset link
    // await api.requestPasswordReset(email.trim());
    // await api.notifyAdminPasswordReset(email.trim());

    setResendCount((prev) => prev + 1);
    startCooldown();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Is the resend button permanently locked?
  const maxedOut = resendCount >= MAX_RESENDS;

  // Resend button label changes based on state
  const getResendLabel = () => {
    if (maxedOut) return 'Maximum resend attempts reached';
    if (cooldown > 0) return `Resend available in ${formatTime(cooldown)}`;
    return 'Resend Link to This Email';
  };

  /* ── Success state ── */
  if (sent) {
    return (
      <>
        {/* Heading with inline green checkmark */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '8px',
        }}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16a34a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <h2 className="forgot-heading" style={{ margin: 0 }}>
            Reset Link Sent
          </h2>
        </div>

        <p className="forgot-subtitle">
          A password reset link has been sent to:
        </p>

        <p className="forgot-email-display">{email}</p>

        <p className="forgot-hint">
          If you don't see it, check your spam folder.
        </p>

        {/* Resend to SAME email — timer locked */}
        <button
          type="button"
          className="btn-secondary"
          style={{
            width: '100%',
            marginBottom: '10px',
            opacity: (cooldown > 0 || maxedOut) ? 0.5 : 1,
            cursor: (cooldown > 0 || maxedOut) ? 'not-allowed' : 'pointer',
          }}
          disabled={cooldown > 0 || maxedOut}
          onClick={handleResend}
        >
          {getResendLabel()}
        </button>

        {/* Attempt counter */}
        {/* Max attempts message — only shows after 5 resends */}
        {maxedOut && (
          <p style={{
            textAlign: 'center',
            fontSize: '11px',
            color: '#dc2626',
            margin: '0 0 16px',
            fontWeight: 600,
          }}>
            Please contact your administrator for further assistance.
          </p>
        )}

        {/* Try a different email */}
        <button
          type="button"
          className="btn-secondary"
          style={{ width: '100%', marginBottom: '12px' }}
          onClick={() => {
            clearInterval(timerRef.current);
            setSent(false);
            setEmail('');
            setError('');
            setCooldown(0);
            setResendCount(0);
          }}
        >
          Try a Different Email
        </button>

        {/* Back to login */}
        <Link to="/login" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
          Back to Login
        </Link>
      </>
    );
  }

  /* ── Form state ── */
  return (
    <>
      {/* Lock icon */}
      <div className="forgot-icon forgot-icon-lock">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h2 className="forgot-heading">Forgot Password?</h2>

      <p className="forgot-subtitle">
        Enter your registered email to receive a password reset link.
      </p>

      {/* Error */}
      {error && <div className="auth-error">{error}</div>}

      {/* Email input */}
      <div style={{ marginBottom: '20px' }}>
        <label className="auth-label">Email Address</label>
        <div className="auth-input-wrapper">
          <svg
            className="auth-input-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <input
            type="email"
            className="auth-input auth-input-with-icon"
            placeholder="you@example.com"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%' }}
        onClick={handleSubmit}
      >
        Send Reset Link
      </button>

      {/* Back to login link */}
      <p className="auth-footer-text">
        Remember your password?{' '}
        <Link to="/login" className="auth-link">
          Back to Login
        </Link>
      </p>
    </>
  );
}

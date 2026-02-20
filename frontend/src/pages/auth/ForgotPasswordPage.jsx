import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { sanitizeEmail } from '../../utils/sanitize';

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
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-bold text-slate-800">
            Reset Link Sent
          </h2>
        </div>

        <p className="text-sm text-slate-500 text-center mb-1">
          A password reset link has been sent to:
        </p>

        <p className="text-sm font-bold text-slate-800 text-center mb-3">{email}</p>

        <p className="text-xs text-slate-400 text-center mb-5">
          If you don't see it, check your spam folder.
        </p>

        {/* Resend to SAME email — timer locked */}
        <button
          type="button"
          className="w-full py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={cooldown > 0 || maxedOut}
          onClick={handleResend}
        >
          {getResendLabel()}
        </button>

        {/* Max attempts message — only shows after 5 resends */}
        {maxedOut && (
          <p className="text-xs text-rose-600 font-semibold text-center mb-4">
            Please contact your administrator for further assistance.
          </p>
        )}

        {/* Try a different email */}
        <button
          type="button"
          className="w-full py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors mb-3"
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
        <Link
          to="/login"
          className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm text-center"
        >
          Back to Login
        </Link>
      </>
    );
  }

  /* ── Form state ── */
  return (
    <>
      {/* Lock icon */}
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Forgot Password?</h2>

      <p className="text-sm text-slate-500 text-center mb-6">
        Enter your registered email to receive a password reset link.
      </p>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm px-4 py-2.5 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Email input */}
      <div className="mb-5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Email Address
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
            </svg>
          </span>
          <input
            type="email"
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
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
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        onClick={handleSubmit}
      >
        Send Reset Link
      </button>

      {/* Back to login link */}
      <p className="text-center mt-5 text-sm text-slate-500">
        Remember your password?{' '}
        <Link to="/login" className="font-semibold text-blue-600 hover:underline">
          Back to Login
        </Link>
      </p>
    </>
  );
}

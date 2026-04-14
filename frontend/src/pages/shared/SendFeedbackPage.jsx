import { useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

// Categories must match the FeedbackCategory Literal in
// backend/app/schemas/schemas.py. If the backend list changes, update here.
const CATEGORY_OPTIONS = [
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Bug report" },
  { value: "issue", label: "Issue" },
  { value: "feature", label: "Feature request" },
  { value: "accessibility", label: "Accessibility" },
  { value: "support", label: "Support request" },
  { value: "account", label: "Account" },
  { value: "performance", label: "Performance" },
];

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SUBJECT_LENGTH = 200;

export default function SendFeedbackPage() {
  const { user, role, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Page the user came from — silently passed in router state from the footer
  // link, used as page_path on the backend payload for admin triage context.
  // Not visible in the UI. Falls back to null if the user landed here directly
  // (e.g. typed the URL, came from a bookmark).
  const fromPath = location.state?.from || null;

  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Auth gate — redirect to login if unauthenticated. This page isn't wrapped
  // in a role-specific route guard, so we handle the check here.
  if (authLoading) return null;
  if (!user || !role) return <Navigate to="/login" replace />;

  const dashboardPath = `/${role}`;

  const trimmedMessage = message.trim();
  const messageLength = message.length;
  const messageTooLong = messageLength > MAX_MESSAGE_LENGTH;
  const canSubmit = trimmedMessage.length > 0 && !messageTooLong && !submitting;

  const counterColor =
    messageLength === 0
      ? "text-slate-400"
      : messageLength > MAX_MESSAGE_LENGTH
      ? "text-rose-600"
      : messageLength > MAX_MESSAGE_LENGTH * 0.9
      ? "text-amber-600"
      : "text-slate-400";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        category,
        message: trimmedMessage,
      };
      const trimmedSubject = subject.trim();
      if (trimmedSubject) payload.subject = trimmedSubject;
      if (fromPath) payload.page_path = fromPath;
      await api.submitSystemFeedback(payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendAnother() {
    setCategory("general");
    setSubject("");
    setMessage("");
    setSubmitted(false);
    setError(null);
  }

  // ── Success state: replaces the form entirely ────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Thanks — we got it</h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Your feedback has been recorded and will be reviewed by the platform team.
              {role === "admin" && (
                <>
                  {" "}
                  You can view it in your{" "}
                  <Link to="/admin/messages" className="text-blue-600 hover:text-blue-800 font-semibold">
                    inbox
                  </Link>
                  .
                </>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSendAnother}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Send another
              </button>
              <button
                type="button"
                onClick={() => navigate(dashboardPath)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Back to dashboard
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms and conditions</Link>
            <span>·</span>
            <span>© 2026 University of Prince Edward Island</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <Link
            to={dashboardPath}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Send feedback</h1>
              <p className="text-xs text-slate-500 mt-0.5">Report a bug, request a feature, or tell us what's on your mind</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
              <span className="text-[10px] text-slate-400">Optional</span>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary"
              maxLength={MAX_SUBJECT_LENGTH}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
              <span className={`text-[10px] font-semibold ${counterColor}`}>
                {messageLength} / {MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Describe what you'd like us to know. If reporting a bug, include what you were doing and what happened."
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 resize-y"
            />
            {messageTooLong && (
              <p className="text-[11px] text-rose-600 mt-1">
                Message is too long. Please shorten it to {MAX_MESSAGE_LENGTH} characters or fewer.
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms and conditions</Link>
          <span>·</span>
          <span>© 2026 University of Prince Edward Island</span>
        </div>
      </div>
    </div>
  );
}

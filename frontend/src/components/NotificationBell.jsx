import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

// ─── Mock Notifications (fallback when backend unavailable) ─────────────────────

const MOCK_NOTIFICATIONS = [
  { id: 1, title: "New submission", message: "James Kowalski submitted Perceived Stress Scale (PSS)", created_at: "2026-03-14T10:30:00Z", is_read: false, type: "submission", link: "/caretaker/participants/p7?tab=submissions" },
  { id: 2, title: "High BP alert", message: "James Kowalski's systolic BP is 142 mmHg — above the 140 threshold", created_at: "2026-03-14T09:15:00Z", is_read: false, type: "flag", link: "/caretaker/participants/p7" },
  { id: 3, title: "Participant inactive", message: "Lily Hartmann hasn't been active for 3 weeks", created_at: "2026-03-13T14:00:00Z", is_read: false, type: "inactivity", link: "/caretaker/participants/p3" },
  { id: 4, title: "Goal deadline approaching", message: "James Kowalski's 'Daily Steps' goal expires in 17 days", created_at: "2026-03-13T08:00:00Z", is_read: true, type: "goal", link: "/caretaker/participants/p7?tab=goals" },
  { id: 5, title: "Invite accepted", message: "omar.diallo@example.com accepted your invitation and registered", created_at: "2026-02-28T16:20:00Z", is_read: true, type: "invite", link: "/caretaker/participants?view=invites" },
  { id: 6, title: "New submission", message: "Priya Sharma submitted Monthly Wellness Check-in", created_at: "2026-02-27T11:45:00Z", is_read: true, type: "submission", link: "/caretaker/participants/p6?tab=submissions" },
  { id: 7, title: "Weekly group summary", message: "Your weekly report for Morning Cohort A is ready — 6/8 active, 3 new submissions", created_at: "2026-02-24T07:00:00Z", is_read: true, type: "summary", link: "/caretaker/reports" },
  { id: 8, title: "High pain reported", message: "James Kowalski reported pain level 6/10 — above threshold", created_at: "2026-02-20T13:30:00Z", is_read: true, type: "flag", link: "/caretaker/participants/p7" },
];

// ─── Utilities ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

const TYPE_STYLES = {
  submission: { bg: "bg-blue-100", text: "text-blue-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
  flag: { bg: "bg-rose-100", text: "text-rose-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> },
  inactivity: { bg: "bg-amber-100", text: "text-amber-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  goal: { bg: "bg-emerald-100", text: "text-emerald-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  invite: { bg: "bg-indigo-100", text: "text-indigo-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /> },
  summary: { bg: "bg-violet-100", text: "text-violet-600", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
};

function NotiIcon({ type }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.submission;
  return (
    <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${s.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{s.icon}</svg>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function NotificationBell({ role }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications(role);
      setNotifications(data);
    } catch {
      setNotifications(MOCK_NOTIFICATIONS);
    }
  }, [role]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Poll every 60 seconds for new notifications
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recent = notifications.slice(0, 8);

  async function handleMarkRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    try { await api.markNotificationRead(role, id); } catch { /* optimistic */ }
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    for (const id of unreadIds) {
      try { await api.markNotificationRead(role, id); } catch { /* optimistic */ }
    }
  }

  function handleClick(n) {
    if (!n.is_read) handleMarkRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && <span className="text-xs font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.3 21a1.94 1.94 0 003.4 0" /></svg>
                <p className="text-sm text-slate-400">No notifications yet.</p>
              </div>
            ) : recent.map(n => (
              <button key={n.id} onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${!n.is_read ? "bg-blue-50/40" : ""}`}>
                <NotiIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${!n.is_read ? "text-slate-800" : "text-slate-600"}`}>{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
          {notifications.length > 8 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-center">
              <button onClick={() => { setOpen(false); navigate(`/${role}/`); }} className="text-xs font-semibold text-blue-600 hover:text-blue-800">See all on Dashboard</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

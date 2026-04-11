import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { usePolling } from "../hooks/usePolling";

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
    <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center shrink-0`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${s.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{s.icon}</svg>
    </div>
  );
}

// ─── Filter Labels ──────────────────────────────────────────────────────────────

const TYPE_LABELS = [
  { key: "all", label: "All" },
  { key: "flag", label: "Alerts" },
  { key: "submission", label: "Submissions" },
  { key: "inactivity", label: "Inactivity" },
  { key: "goal", label: "Goals" },
  { key: "invite", label: "Invites" },
  { key: "summary", label: "Summaries" },
];

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function NotificationsPanel({ role }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications(role);
      setNotifications(Array.isArray(data) ? data.map(n => ({ ...n, id: n.notification_id || n.id })) : []);
    } catch {
      setNotifications([]);
    }
  }, [role]);

  usePolling(() => {
    fetchNotifications();
  }, 60000);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = useMemo(() => {
    let list = notifications;
    if (filter !== "all") list = list.filter(n => n.type === filter);
    return list;
  }, [notifications, filter]);

  const displayed = showAll ? filtered : filtered.slice(0, 5);

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
    if (n.link) navigate(n.link);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.3 21a1.94 1.94 0 003.4 0" />
          </svg>
          <h2 className="text-lg font-bold text-slate-800">Notifications</h2>
          {unreadCount > 0 && <span className="text-xs font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">{unreadCount} unread</span>}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="self-start text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors sm:self-auto">Mark all read</button>
        )}
      </div>

      {/* Filter pills */}
      <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-1.5 overflow-x-auto">
        {TYPE_LABELS.map(t => {
          const count = t.key === "all" ? notifications.length : notifications.filter(n => n.type === t.key).length;
          if (t.key !== "all" && count === 0) return null;
          return (
            <button key={t.key} onClick={() => { setFilter(t.key); setShowAll(false); }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${filter === t.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {t.label}
              <span className={`text-xs ${filter === t.key ? "text-blue-200" : "text-slate-400"}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-50">
        {displayed.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No notifications{filter !== "all" ? " in this category" : " yet"}.</p>
          </div>
        ) : displayed.map(n => (
          <div key={n.id} onClick={() => handleClick(n)}
            className={`px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer ${!n.is_read ? "bg-blue-50/30" : ""}`}>
            <NotiIcon type={n.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${!n.is_read ? "text-slate-800" : "text-slate-600"}`}>{n.title}</p>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
              <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && (
              <button onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors shrink-0 mt-1">
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {filtered.length > 5 && !showAll && (
        <div className="px-5 py-3 border-t border-slate-100 text-center">
          <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Show all {filtered.length} notifications
          </button>
        </div>
      )}
      {showAll && filtered.length > 5 && (
        <div className="px-5 py-3 border-t border-slate-100 text-center">
          <button onClick={() => setShowAll(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Show less
          </button>
        </div>
      )}
    </div>
  );
}

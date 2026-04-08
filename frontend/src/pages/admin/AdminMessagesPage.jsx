import { useEffect, useMemo, useState } from "react";
import NotificationsPanel from "../../components/NotificationsPanel";
import { api } from "../../services/api";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In Review" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

function fmtDate(value) {
  if (!value) return "Unknown time";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Unknown time";
  return dt.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const map = {
    new: "bg-blue-50 text-blue-700",
    in_review: "bg-amber-50 text-amber-700",
    in_progress: "bg-indigo-50 text-indigo-700",
    resolved: "bg-emerald-50 text-emerald-700",
    dismissed: "bg-slate-100 text-slate-600",
  };
  const label = STATUS_OPTIONS.find((x) => x.value === status)?.label || status || "Unknown";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${map[status] || map.dismissed}`}>
      {label}
    </span>
  );
}

export default function AdminMessagesPage() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError("");
        const rows = await api.adminListSystemFeedback();
        if (!active) return;
        setFeedback(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!active) return;
        setFeedback([]);
        setError(err.message || "Unable to load feedback right now.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredFeedback = useMemo(() => {
    if (statusFilter === "all") return feedback;
    return feedback.filter((f) => f.status === statusFilter);
  }, [feedback, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: feedback.length, new: 0, in_review: 0, in_progress: 0, resolved: 0, dismissed: 0 };
    feedback.forEach((f) => { if (c[f.status] !== undefined) c[f.status] += 1; });
    return c;
  }, [feedback]);

  async function handleStatusChange(item, nextStatus) {
    if (!item?.feedback_id || item.status === nextStatus) return;
    setUpdatingId(item.feedback_id);
    const prev = item.status;
    setFeedback((list) => list.map((x) => (x.feedback_id === item.feedback_id ? { ...x, status: nextStatus } : x)));
    try {
      const updated = await api.adminUpdateSystemFeedbackStatus(item.feedback_id, nextStatus);
      setFeedback((list) => list.map((x) => (x.feedback_id === item.feedback_id ? { ...x, ...updated } : x)));
    } catch {
      setFeedback((list) => list.map((x) => (x.feedback_id === item.feedback_id ? { ...x, status: prev } : x)));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Messages & Feedback</h1>
          <p className="mt-1 text-slate-500">Review platform feedback reports and admin notifications.</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Feedback Inbox</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{counts.all} item{counts.all === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <h2 className="text-lg font-bold text-slate-800">System Feedback Inbox</h2>
            <p className="mt-1 text-sm text-slate-500">User-reported feedback, bugs, and support issues.</p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {[{ key: "all", label: "All" }, ...STATUS_OPTIONS.map((x) => ({ key: x.value, label: x.label }))].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    statusFilter === opt.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label} <span className={`${statusFilter === opt.key ? "text-blue-200" : "text-slate-400"}`}>({counts[opt.key] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Loading feedback…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : filteredFeedback.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No feedback in this filter.</p>
            </div>
          ) : (
            filteredFeedback.map((item) => (
              <article key={item.feedback_id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.subject || "General feedback"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.category} • {fmtDate(item.created_at)} • user {String(item.user_id || "unknown").slice(0, 8)}
                    </p>
                    {item.page_path && <p className="mt-1 text-xs text-slate-400">Page: {item.page_path}</p>}
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.message}</p>
                <div className="mt-4 flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500">Update status:</label>
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(item, e.target.value)}
                    disabled={updatingId === item.feedback_id}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </article>
            ))
          )}
        </section>

        <section>
          <NotificationsPanel role="admin" />
        </section>
      </div>
    </div>
  );
}


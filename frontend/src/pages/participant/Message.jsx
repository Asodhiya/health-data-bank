import { useEffect, useMemo, useState } from "react";
import NotificationsPanel from "../../components/NotificationsPanel";
import { api } from "../../services/api";

function formatFeedbackDate(value) {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FeedbackCard({ item }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Caretaker Feedback</p>
          <p className="mt-1 text-xs text-slate-400">
            Received {formatFeedbackDate(item.created_at)}
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
          Feedback
        </span>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {item.message}
      </p>
    </div>
  );
}

export default function Messages() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFeedback() {
      try {
        setError("");
        const data = await api.participantListFeedback();
        if (!active) return;
        setFeedback(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Unable to load feedback right now.");
        setFeedback([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFeedback();
    return () => {
      active = false;
    };
  }, []);

  const feedbackCountLabel = useMemo(() => {
    const count = feedback.length;
    return `${count} message${count === 1 ? "" : "s"}`;
  }, [feedback.length]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Messages & Feedback
          </h1>
          <p className="mt-1 text-slate-500">
            Review updates from your care team and keep track of important system notifications.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Care Team Inbox
          </p>
          <p className="mt-1 text-lg font-bold text-slate-800">{feedbackCountLabel}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <h2 className="text-lg font-bold text-slate-800">Caretaker Feedback</h2>
            <p className="mt-1 text-sm text-slate-500">
              Personal feedback sent by your caretaker appears here.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Loading feedback…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : feedback.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">
                No feedback yet.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                When your caretaker sends guidance or comments, it will show up here.
              </p>
            </div>
          ) : (
            feedback.map((item) => (
              <FeedbackCard key={item.feedback_id || item.id} item={item} />
            ))
          )}
        </section>

        <section>
          <NotificationsPanel role="participant" />
        </section>
      </div>
    </div>
  );
}

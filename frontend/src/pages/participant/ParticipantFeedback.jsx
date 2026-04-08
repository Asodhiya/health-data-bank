import { useState, useEffect } from "react";
import { api } from "../../services/api";
import NotificationsPanel from "../../components/NotificationsPanel";

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const groupByDate = (items) => {
  const groups = {};
  items.forEach((item) => {
    const d = new Date(item.created_at);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    let label;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else
      label = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  return groups;
};

const FILTERS = ["All", "On Submissions", "General Notes"];

// ── Component ──────────────────────────────────────────────────────────────
export default function ParticipantFeedback() {
  const [filter, setFilter] = useState("All");
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    api.participantListFeedback()
      .then((data) => { if (active) setFeedback(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = feedback.filter((fb) => {
    if (filter === "On Submissions") return fb.submission_id !== null;
    if (filter === "General Notes") return fb.submission_id === null;
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Caretaker Feedback
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Notes and feedback from your caretaker on your health progress.
          </p>
        </div>
        <span className="self-start sm:self-center inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold border border-blue-100">
          💬 {feedback.length} total
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 text-sm">
          Could not load feedback. Please try again later.
        </div>
      )}

      {/* Two-column layout: feedback left, notifications right */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

        {/* ── Left: Feedback timeline ── */}
        <div className="space-y-6">
          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Content */}
          {!loading && !error && (
            <>
              {/* Filter tabs */}
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map((f) => {
                  const count =
                    f === "All"
                      ? feedback.length
                      : f === "On Submissions"
                      ? feedback.filter((fb) => fb.submission_id).length
                      : feedback.filter((fb) => !fb.submission_id).length;

                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        filter === f
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                      }`}
                    >
                      {f}
                      <span className={`ml-1.5 text-xs font-bold ${filter === f ? "text-blue-200" : "text-slate-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Empty state */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-3xl">
                    💬
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">No feedback here</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    {filter === "All"
                      ? "Your caretaker hasn't left any feedback yet."
                      : `No ${filter.toLowerCase()} to show.`}
                  </p>
                </div>
              ) : (
                /* Timeline */
                <div className="space-y-8">
                  {Object.entries(grouped).map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                          {dateLabel}
                        </span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>

                      <div className="relative">
                        <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />
                        <div className="space-y-6">
                          {items.map((fb) => {
                            const isGeneral = !fb.submission_id;
                            return (
                              <div key={fb.feedback_id} className="flex gap-5 relative">
                                <div
                                  className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm z-10 border-2 border-white shadow-sm ${
                                    isGeneral ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-600"
                                  }`}
                                >
                                  {isGeneral ? "📝" : "📋"}
                                </div>

                                <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-5 space-y-3">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="space-y-0.5">
                                      <p className="text-sm font-bold text-slate-800">Your Caretaker</p>
                                      {fb.survey_title && (
                                        <p className="text-xs text-blue-600 font-medium">{fb.survey_title}</p>
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                                        isGeneral
                                          ? "bg-slate-100 text-slate-500"
                                          : "bg-blue-50 text-blue-600 border border-blue-100"
                                      }`}
                                    >
                                      {isGeneral ? "General note" : "On submission"}
                                    </span>
                                  </div>

                                  <p className="text-sm text-slate-700 leading-relaxed">{fb.message}</p>

                                  <p className="text-xs text-slate-400">{formatDate(fb.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Notifications ── */}
        <div>
          <NotificationsPanel role="participant" />
        </div>

      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { usePolling } from "../../hooks/usePolling";
import { api } from "../../services/api";
import NotificationsPanel from "../../components/NotificationsPanel";
import GuideTooltip from "../../components/GuideTooltip";
import { formatDateTime } from "../../utils/dateFormatters";

const BellIco = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
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
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchFeedback = useCallback(async () => {
    try {
      const data = await api.participantListFeedback();
      setFeedback(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchFeedback, 60_000);

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
        <div className="flex items-center gap-3 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold border border-blue-100">
            💬 {feedback.length} total
          </span>
          {/* Bell button — mobile only */}
          <button
            onClick={() => setNotifOpen(true)}
            className="lg:hidden relative w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-all"
            aria-label="Open notifications"
          >
            <BellIco />
          </button>
        </div>
      </div>

      {/* ── Notifications mobile sheet ── */}
      {notifOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setNotifOpen(false)}
        />
      )}
      <div className={`fixed inset-x-0 bottom-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 flex flex-col transition-transform duration-300 ease-out ${notifOpen ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-base font-bold text-slate-800">Notifications</h3>
          <button
            onClick={() => setNotifOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-all text-slate-500"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <NotificationsPanel role="participant" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 text-sm">
          Could not load feedback. Please try again later.
        </div>
      )}

      {/* Two-column layout: feedback left, notifications right */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

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
              <div className="flex gap-2 flex-wrap items-center">
                {FILTERS.map((f) => {
                  const count =
                    f === "All"
                      ? feedback.length
                      : f === "On Submissions"
                      ? feedback.filter((fb) => fb.submission_id).length
                      : feedback.filter((fb) => !fb.submission_id).length;

                  const tipMap = {
                    "All": "Show all feedback from your caretaker.",
                    "On Submissions": "Feedback your caretaker left on a specific survey you submitted.",
                    "General Notes": "General notes your caretaker wrote about your overall health progress — not tied to a specific survey.",
                  };

                  return (
                    <GuideTooltip key={f} tip={tipMap[f]} position="bottom">
                      <button
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
                    </GuideTooltip>
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
                              <div key={fb.feedback_id} className="flex gap-3 sm:gap-5 relative">
                                <div
                                  className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm z-10 border-2 border-white shadow-sm ${
                                    isGeneral ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-600"
                                  }`}
                                >
                                  {isGeneral ? "📝" : "📋"}
                                </div>

                                <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 sm:p-5 space-y-3 min-w-0">
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

                                  <p className="text-xs text-slate-400">{formatDateTime(fb.created_at)}</p>
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

        {/* ── Right: Notifications (desktop only) ── */}
        <div className="hidden lg:block sticky top-4 self-start">
          <NotificationsPanel role="participant" />
        </div>

      </div>
    </div>
  );
}

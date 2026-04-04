import { useState } from "react";

// ── Mock data matching backend FeedbackItem schema ─────────────────────────
// Real fields from backend: feedback_id, caretaker_id, participant_id,
// submission_id (nullable), message, created_at
// caretaker_name & survey_title are NOT returned by backend yet —
// will be resolved once participant feedback endpoint is added.
const MOCK_FEEDBACK = [
  {
    feedback_id: "f1",
    caretaker_id: "c1",
    participant_id: "p1",
    submission_id: "s1",
    message:
      "Great job completing the Blood Pressure survey on time! I noticed your readings have been slightly elevated this week. Please make sure you're taking your medication consistently and try to reduce salt intake.",
    created_at: "2026-04-02T09:15:00Z",
    // These two will come from a joined query once backend endpoint is ready
    survey_title: "Blood Pressure Survey",
  },
  {
    feedback_id: "f2",
    caretaker_id: "c1",
    participant_id: "p1",
    submission_id: null,
    message:
      "Just a general reminder — your hydration goal has been looking good this week. Keep it up! Also remember your next check-in is scheduled for Friday.",
    created_at: "2026-04-01T14:30:00Z",
    survey_title: null,
  },
  {
    feedback_id: "f3",
    caretaker_id: "c1",
    participant_id: "p1",
    submission_id: "s2",
    message:
      "I reviewed your Food Survey from yesterday. Your meal patterns look balanced overall. Consider adding more leafy greens to your diet. Let me know if you have any questions about your nutrition plan.",
    created_at: "2026-03-30T11:00:00Z",
    survey_title: "Food Survey Form",
  },
  {
    feedback_id: "f4",
    caretaker_id: "c1",
    participant_id: "p1",
    submission_id: "s3",
    message:
      "Your stress scale responses indicate moderate stress levels. This is something we should discuss in our next session. In the meantime, try the breathing exercises we talked about.",
    created_at: "2026-03-28T16:45:00Z",
    survey_title: "Perceived Stress Scale",
  },
  {
    feedback_id: "f5",
    caretaker_id: "c1",
    participant_id: "p1",
    submission_id: null,
    message:
      "You've been very consistent with logging your data this month. That consistency makes it much easier for me to track your progress accurately. Keep it up!",
    created_at: "2026-03-25T08:00:00Z",
    survey_title: null,
  },
];

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

  const filtered = MOCK_FEEDBACK.filter((fb) => {
    if (filter === "On Submissions") return fb.submission_id !== null;
    if (filter === "General Notes") return fb.submission_id === null;
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
        {/* Total count badge */}
        <span className="self-start sm:self-center inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full text-sm font-semibold border border-teal-100">
          💬 {MOCK_FEEDBACK.length} total
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const count =
            f === "All"
              ? MOCK_FEEDBACK.length
              : f === "On Submissions"
              ? MOCK_FEEDBACK.filter((fb) => fb.submission_id).length
              : MOCK_FEEDBACK.filter((fb) => !fb.submission_id).length;

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                filter === f
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white text-stone-500 border-stone-200 hover:border-teal-300 hover:text-teal-700"
              }`}
            >
              {f}
              <span
                className={`ml-1.5 text-xs font-bold ${
                  filter === f ? "text-teal-200" : "text-stone-400"
                }`}
              >
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
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  {dateLabel}
                </span>
                <div className="flex-1 h-px bg-stone-100" />
              </div>

              {/* Timeline items for this date */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-stone-200" />

                <div className="space-y-6">
                  {items.map((fb) => {
                    const isGeneral = !fb.submission_id;

                    return (
                      <div key={fb.feedback_id} className="flex gap-5 relative">
                        {/* Timeline dot */}
                        <div
                          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm z-10 border-2 border-white shadow-sm ${
                            isGeneral
                              ? "bg-stone-100 text-stone-500"
                              : "bg-teal-50 text-teal-600"
                          }`}
                        >
                          {isGeneral ? "📝" : "📋"}
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-teal-200 transition-all p-5 space-y-3">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-slate-800">
                                Your Caretaker
                              </p>
                              {fb.survey_title && (
                                <p className="text-xs text-teal-600 font-medium">
                                  {fb.survey_title}
                                </p>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                                isGeneral
                                  ? "bg-stone-100 text-stone-500"
                                  : "bg-teal-50 text-teal-600 border border-teal-100"
                              }`}
                            >
                              {isGeneral ? "General note" : "On submission"}
                            </span>
                          </div>

                          {/* Message */}
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {fb.message}
                          </p>

                          {/* Timestamp */}
                          <p className="text-xs text-slate-400">
                            {formatDate(fb.created_at)}
                          </p>
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
    </div>
  );
}

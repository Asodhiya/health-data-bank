import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { useResearcherMeta } from "../../hooks/useResearcherMeta";

const STATUS_STYLES = {
  PUBLISHED:   "bg-emerald-50 text-emerald-600",
  UNPUBLISHED: "bg-slate-100 text-slate-400",
};

const FILTER_OPTIONS = ["all", "PUBLISHED"];

const FILTER_LABELS = {
  all:       "All",
  PUBLISHED: "Published",
};

const FILTER_ACTIVE_STYLES = {
  all:       "bg-slate-900 text-white",
  PUBLISHED: "bg-blue-600 text-white",
};

function SurveyModal({ group, onClose }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setSurveys([]);
    setStatusFilter("all");
    api.getGroupSurveys(group.group_id)
      .then((data) => setSurveys(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [group.group_id]);

  const visible = statusFilter === "all" ? surveys : surveys.filter((s) => s.status === statusFilter);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{group.name}</h2>
            {group.description && (
              <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">{group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter pills */}
        {!loading && surveys.length > 0 && (
          <div className="px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap">
            {FILTER_OPTIONS.map((opt) => {
              const count = opt === "all" ? surveys.length : surveys.filter((s) => s.status === opt).length;
              if (opt !== "all" && count === 0) return null;
              const active = statusFilter === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setStatusFilter(opt)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                    active ? FILTER_ACTIVE_STYLES[opt] : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {FILTER_LABELS[opt]}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-white text-slate-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Survey list */}
        <div className="max-h-[55vh] overflow-y-auto px-4 py-3 sm:px-6">
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm animate-pulse">Loading surveys…</div>
          ) : loadError ? (
            <div className="py-10 text-center text-sm">
              <p className="text-slate-400">Failed to load surveys.</p>
              <button
                onClick={() => {
                  setLoadError(false);
                  setLoading(true);
                  api.getGroupSurveys(group.group_id)
                    .then((data) => setSurveys(Array.isArray(data) ? data : []))
                    .catch(() => setLoadError(true))
                    .finally(() => setLoading(false));
                }}
                className="mt-2 text-xs text-blue-500 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              {surveys.length === 0 ? "No surveys published to this group." : `No ${FILTER_LABELS[statusFilter]?.toLowerCase()} surveys.`}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((s) => (
                <div key={s.form_id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {s.title}
                      {s.version > 1 && (
                        <span className="ml-1.5 text-[11px] font-bold text-slate-400">v{s.version}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Published {s.deployed_at ? new Date(s.deployed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      {s.revoked_at && (
                        <span className="ml-2 text-slate-300">· Unpublished {new Date(s.revoked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 sm:gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {s.submission_count ?? 0} submission{(s.submission_count ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_STYLES[s.status] || "bg-slate-100 text-slate-400"}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100" />
        <div className="h-5 w-20 bg-slate-100 rounded-full" />
      </div>
      <div className="h-4 w-2/3 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-full bg-slate-50 rounded mb-1" />
      <div className="h-3 w-3/4 bg-slate-50 rounded" />
    </div>
  );
}

export default function Groups() {
  const { groups, loading, error, refresh } = useResearcherMeta({ includeGroups: true });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const loadError = Boolean(error);

  const filtered = groups.filter((g) =>
    g.name?.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">How Groups / Cohorts Work</h2>
                  <p className="text-xs text-slate-500 mt-0.5">A quick guide for researchers</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm text-slate-600">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</span>
                <div>
                  <p className="font-semibold text-slate-800">What is a group?</p>
                  <p className="text-slate-500 text-xs mt-0.5">A group (or cohort) is a segment of participants assigned by an admin. Researchers cannot create or modify groups — they are managed by administrators.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</span>
                <div>
                  <p className="font-semibold text-slate-800">Click a card to see surveys</p>
                  <p className="text-slate-500 text-xs mt-0.5">Clicking any group card opens a popup showing all survey forms that have been published to that group, along with submission counts and publish dates.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">3</span>
                <div>
                  <p className="font-semibold text-slate-800">Publishing surveys to groups</p>
                  <p className="text-slate-500 text-xs mt-0.5">To assign a survey to a group, go to the Survey Builder, open a draft form, and publish it — you will be prompted to select one or more groups.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">4</span>
                <div>
                  <p className="font-semibold text-slate-800">Member count</p>
                  <p className="text-slate-500 text-xs mt-0.5">The member count shows how many participants are currently active in each group. Participants who have left the group are not included.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowHelp(false)} className="w-full py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups / Cohorts</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track participant segments</p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition shrink-0"
        >
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">?</span>
          How it works
        </button>
      </div>

      {/* Survey modal */}
      {selected && (
        <SurveyModal group={selected} onClose={() => setSelected(null)} />
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center border border-slate-200 rounded-xl bg-white focus-within:border-slate-400 transition-all">
          <span className="pl-2 pr-2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm text-slate-800 p-1 outline-none bg-transparent placeholder-slate-400"
          />
          <span className="hidden pr-2 text-xs font-medium text-slate-400 sm:inline">
            {filtered.length} group{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <GroupSkeleton key={i} />)}
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 py-16 text-center text-sm">
          <p className="text-slate-400">Failed to load groups.</p>
          <button onClick={refresh} className="mt-2 text-xs text-blue-500 hover:underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 py-16 text-center text-slate-400 text-sm">
          No groups found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((group) => (
            <div
              key={group.group_id}
              onClick={() => setSelected(selected?.group_id === group.group_id ? null : group)}
              className={`bg-white rounded-2xl border p-5 shadow-sm cursor-pointer transition-all flex flex-col justify-between ${
                selected?.group_id === group.group_id
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-slate-200 hover:shadow-md hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                    {group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1">{group.name || "Unnamed Group"}</h3>
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                  {group.description || "No description provided for this group."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

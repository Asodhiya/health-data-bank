import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { useResearcherMeta } from "../../hooks/useResearcherMeta";
import { useAuth } from "../../contexts/AuthContext";

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

const CADENCE_OPTIONS = [
  { value: "once", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function SurveyModal({ group, onClose, currentUser }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableForms, setAvailableForms] = useState([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSearch, setPublishSearch] = useState("");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedCadence, setSelectedCadence] = useState("once");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [unpublishingId, setUnpublishingId] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const loadGroupSurveys = () => {
    setLoading(true);
    setLoadError(false);
    api.getGroupSurveys(group.group_id)
      .then((data) => setSurveys(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  const loadAvailableForms = () => {
    setFormsLoading(true);
    setFormsError("");
    api.listForms()
      .then((data) => setAvailableForms(Array.isArray(data) ? data : []))
      .catch((error) => setFormsError(error?.message || "Failed to load surveys."))
      .finally(() => setFormsLoading(false));
  };

  useEffect(() => {
    setSurveys([]);
    setStatusFilter("all");
    setAvailableForms([]);
    setFormsLoading(true);
    setFormsError("");
    setPublishOpen(false);
    setPublishSearch("");
    setSelectedFormId("");
    setSelectedCadence("once");
    setPublishError("");
    setConfirmAction(null);
    loadGroupSurveys();
    loadAvailableForms();
  }, [group.group_id]);

  const visible = statusFilter === "all" ? surveys : surveys.filter((s) => s.status === statusFilter);

  const publishableForms = useMemo(() => {
    const term = normalizeSearchText(publishSearch);
    return (availableForms || [])
      .filter((form) => String(form?.created_by || "") === String(currentUser?.user_id || ""))
      .filter((form) => String(form?.status || "").toUpperCase() !== "DELETED")
      .filter((form) => {
        const searchable = normalizeSearchText([
          form?.title || "",
          form?.version ? `v${form.version}` : "",
        ].join(" "));
        return !term || searchable.includes(term);
      })
      .sort((a, b) =>
        String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
          sensitivity: "base",
        }),
      );
  }, [availableForms, currentUser?.user_id, publishSearch]);

  const selectedForm = publishableForms.find(
    (form) => String(form.form_id || form.id) === String(selectedFormId),
  );

  const alreadyAssigned = surveys.some(
    (survey) =>
      String(survey.form_id || "") === String(selectedFormId) &&
      String(survey.status || "").toUpperCase() === "PUBLISHED",
  );

  const handlePublish = async () => {
    if (!selectedFormId) return;
    setPublishing(true);
    setPublishError("");
    try {
      await api.publishForm(selectedFormId, {
        groupId: group.group_id,
        cadence: selectedCadence,
      });
      setPublishOpen(false);
      setSelectedFormId("");
      setSelectedCadence("once");
      setPublishSearch("");
      loadGroupSurveys();
    } catch (error) {
      setPublishError(error?.message || "Failed to publish survey to this group.");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async (survey) => {
    if (!survey?.form_id) return;
    setUnpublishingId(String(survey.form_id));
    setPublishError("");
    try {
      await api.unpublishFormFromGroup(survey.form_id, group.group_id);
      loadGroupSurveys();
    } catch (error) {
      setPublishError(error?.message || "Failed to revoke survey from this group.");
    } finally {
      setUnpublishingId("");
    }
  };

  const confirmPublish = () => {
    if (!selectedFormId || alreadyAssigned) return;
    setConfirmAction({
      type: "publish",
      title: selectedForm?.title || "this survey",
      cadence: selectedCadence,
    });
  };

  const confirmUnpublish = (survey) => {
    if (!survey?.form_id || !survey?.can_unpublish) return;
    setConfirmAction({
      type: "revoke",
      survey,
      title: survey.title || "this survey",
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === "publish") {
      await handlePublish();
    } else if (confirmAction.type === "revoke" && confirmAction.survey) {
      await handleUnpublish(confirmAction.survey);
    }
    setConfirmAction(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-4 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">{group.name}</h2>
            {group.description && (
              <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">{group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <button
              onClick={() => setPublishOpen((prev) => !prev)}
              className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 sm:flex-none"
            >
              {publishOpen ? "Close assign" : "Assign survey"}
            </button>
            <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-300 transition-colors hover:text-slate-500 sm:border-transparent sm:p-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {publishOpen && (
          <div className="max-h-[48vh] shrink-0 overflow-y-auto border-b border-slate-100 bg-slate-50 px-4 py-4 sm:max-h-[26rem] sm:px-6">
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Your surveys
                </label>
                <input
                  type="text"
                  value={publishSearch}
                  onChange={(event) => setPublishSearch(event.target.value)}
                  placeholder="Search your surveys..."
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                />
                <div
                  className="max-h-48 min-h-40 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white sm:max-h-52 sm:min-h-52"
                  onWheel={(event) => event.stopPropagation()}
                  onTouchMove={(event) => event.stopPropagation()}
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {formsLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="rounded-lg border border-slate-100 px-3 py-2">
                          <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
                          <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-slate-50" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedFormId("")}
                        className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition sm:flex-row sm:items-center sm:justify-between ${
                          !selectedFormId ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">No survey selected</span>
                        {!selectedFormId ? <span className="text-[11px] font-semibold sm:shrink-0">Selected</span> : null}
                      </button>
                      {publishableForms.map((form) => {
                        const isSelected = String(selectedFormId) === String(form.form_id);
                        return (
                          <button
                            key={form.form_id}
                            type="button"
                            onClick={() => setSelectedFormId(form.form_id)}
                            className={`flex w-full flex-col items-start gap-1.5 border-t border-slate-100 px-3 py-2 text-left transition sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${
                              isSelected ? "bg-emerald-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`break-words text-sm font-semibold leading-5 sm:truncate ${isSelected ? "text-emerald-700" : "text-slate-800"}`}>
                                {form.title}
                                {form.version ? ` (v${form.version})` : ""}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-400">{form.status || "Unknown"}</p>
                            </div>
                            {isSelected ? (
                              <span className="text-[11px] font-semibold text-emerald-700 sm:shrink-0">Selected</span>
                            ) : null}
                          </button>
                        );
                      })}
                      {!formsLoading && !formsError && publishableForms.length === 0 && (
                        <p className="px-3 py-3 text-xs text-slate-400">No owned surveys match your search.</p>
                      )}
                    </>
                  )}
                </div>
                {formsLoading && <p className="mt-1 text-xs text-slate-400">Loading your surveys in the background...</p>}
                {!formsLoading && formsError && <p className="mt-1 text-xs text-rose-500">{formsError}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Cadence
                </label>
                <select
                  value={selectedCadence}
                  onChange={(event) => setSelectedCadence(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
                >
                  {CADENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {selectedForm && (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                  Assigning <span className="font-semibold text-slate-700">{selectedForm.title}</span>
                  {selectedForm.version ? ` (v${selectedForm.version})` : ""} to <span className="font-semibold text-slate-700">{group.name}</span>.
                </div>
              )}
              {alreadyAssigned && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This survey is already published to this group.
                </div>
              )}
              {publishError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {publishError}
                </div>
              )}
              {confirmAction?.type === "publish" && (
                <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="font-semibold text-slate-900">Publish this survey to the group?</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{confirmAction.title}</span> will be assigned to{" "}
                    <span className="font-semibold text-slate-700">{group.name}</span> with{" "}
                    <span className="font-semibold text-slate-700">{confirmAction.cadence}</span> cadence.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAction}
                      disabled={publishing}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {publishing ? "Publishing..." : "Yes, publish"}
                    </button>
                  </div>
                </div>
              )}
              <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50 px-4 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
                <button
                  onClick={confirmPublish}
                  disabled={!selectedFormId || publishing || alreadyAssigned}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
                >
                  {publishing ? "Assigning..." : "Assign to group"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter pills */}
        {!loading && surveys.length > 0 && (
          <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3 sm:px-6">
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
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm animate-pulse">Loading surveys…</div>
          ) : loadError ? (
            <div className="py-10 text-center text-sm">
              <p className="text-slate-400">Failed to load surveys.</p>
              <button
                onClick={() => {
                  setLoadError(false);
                  loadGroupSurveys();
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
                    <p className="break-words text-sm font-semibold text-slate-800 sm:truncate">
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
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {s.submission_count ?? 0} submission{(s.submission_count ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${STATUS_STYLES[s.status] || "bg-slate-100 text-slate-400"}`}>
                      {s.status}
                    </span>
                    {s.status === "PUBLISHED" && (
                      <button
                        onClick={() => confirmUnpublish(s)}
                        disabled={!s.can_unpublish || unpublishingId === String(s.form_id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                          s.can_unpublish
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                            : "cursor-not-allowed bg-slate-100 text-slate-400"
                        }`}
                        title={
                          s.can_unpublish
                            ? "Revoke this survey from the group"
                            : "Only the form author or the researcher who deployed it can revoke it"
                        }
                      >
                        {unpublishingId === String(s.form_id) ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {confirmAction?.type === "revoke" && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-slate-900">Revoke this survey from the group?</p>
              <p className="mt-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{confirmAction.title}</span> will be removed from{" "}
                <span className="font-semibold text-slate-700">{group.name}</span>. Participants in this group will lose access to it.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={unpublishingId === String(confirmAction?.survey?.form_id || "")}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {unpublishingId === String(confirmAction?.survey?.form_id || "") ? "Revoking..." : "Yes, revoke"}
                </button>
              </div>
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
  const { user } = useAuth();
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
                  <p className="font-semibold text-slate-800">Assign surveys from the group</p>
                  <p className="text-slate-500 text-xs mt-0.5">Open a group card, then use the assign action to publish one of your surveys directly to that cohort with the cadence you want.</p>
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
        <SurveyModal group={selected} currentUser={user} onClose={() => setSelected(null)} />
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

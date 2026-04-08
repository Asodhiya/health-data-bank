const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";
const inFlightGetRequests = new Map();

function normalizeNotificationRole(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "admin_only";
  if (normalized === "participant") return "participant";
  if (normalized === "caretaker") return "caretaker";
  if (normalized === "researcher") return "researcher";
  return normalized;
}

function formatRetryAfter(secondsHeader) {
  const seconds = Number(secondsHeader);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function formatRateLimitMessage(detail, retryAfter) {
  const waitTime = formatRetryAfter(retryAfter);
  const waitSuffix = waitTime ? ` Please wait ${waitTime} and try again.` : " Please try again later.";

  if (detail.includes("auth:login:identifier")) {
    return `Too many login attempts for this account.${waitSuffix}`;
  }

  if (detail.includes("auth:login:ip")) {
    return `Too many login attempts from this network.${waitSuffix}`;
  }

  if (detail.includes("auth:forgot-password:email")) {
    return `Too many password reset requests for this email.${waitSuffix}`;
  }

  if (detail.includes("auth:forgot-password:ip")) {
    return `Too many password reset requests from this network.${waitSuffix}`;
  }

  if (detail.includes("auth:register")) {
    return `Too many registration attempts.${waitSuffix}`;
  }

  if (detail.includes("auth:reset-password")) {
    return `Too many password reset attempts.${waitSuffix}`;
  }

  if (detail.includes("auth:signup_invite")) {
    return `Too many invite requests.${waitSuffix}`;
  }

  return `Too many requests.${waitSuffix}`;
}

function getErrorMessage(res, data) {
  const detail =
    typeof data?.detail === "string"
      ? data.detail
      : Array.isArray(data?.detail)
        ? data.detail.map((d) => d.msg).join(", ")
        : "Something went wrong";

  if (res.status === 429) {
    return formatRateLimitMessage(detail, res.headers.get("Retry-After"));
  }

  return detail;
}

function buildRequestError(res, data) {
  const error = new Error(getErrorMessage(res, data));
  error.status = res.status;
  error.data = data;
  if (data?.code) error.code = data.code;
  if (data?.maintenance) error.maintenance = data.maintenance;
  return error;
}

async function parseJsonSafely(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const method = String(options.method || "GET").toUpperCase();

  const run = async () => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      return null;
    }

    if (!res.ok) {
      throw buildRequestError(res, data);
    }

    return data;
  };

  if (method !== "GET") {
    return run();
  }

  const key = `${method}:${endpoint}`;
  if (inFlightGetRequests.has(key)) {
    return inFlightGetRequests.get(key);
  }

  const promise = run().finally(() => {
    inFlightGetRequests.delete(key);
  });
  inFlightGetRequests.set(key, promise);
  return promise;
}

export const api = {
  login: (identifier, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

  selfDeactivateAccount: () =>
    request("/auth/self-deactivate", { method: "POST" }),

  me: () => request("/auth/me"),

  forgotPassword: (email) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, new_password) =>
    request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),

  updateUser: (payload) =>
    request("/user/update_user", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Form Management (researcher/admin) ──
  listForms: () => request("/form_management/list"),

  getFormDetail: (formId) => request(`/form_management/detail/${formId}`),

  createForm: (payload) =>
    request("/form_management/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateForm: (formId, payload) =>
    request(`/form_management/update/${formId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteForm: (formId) =>
    request(`/form_management/delete/${formId}`, {
      method: "DELETE",
    }),

  deleteFormFamily: (formId) =>
    request(`/form_management/delete/${formId}/family`, {
      method: "DELETE",
    }),

  listGroups: () => request("/form_management/groups"),
  getGroupSurveys: (groupId) => request(`/form_management/groups/${groupId}/surveys`),

  publishForm: (formId, groupId) =>
    request(`/form_management/${formId}/publish?group_id=${groupId}`, {
      method: "POST",
    }),

  unpublishForm: (formId) =>
    request(`/form_management/${formId}/unpublish-all`, {
      method: "POST",
    }),

  unpublishFormFromGroup: (formId, groupId) =>
    request(`/form_management/${formId}/unpublish/${groupId}`, {
      method: "POST",
    }),

  branchForm: (formId) =>
    request(`/form_management/${formId}/branch`, {
      method: "POST",
    }),

  getPublishPreview: (formId, groupIds) =>
    request(`/form_management/${formId}/publish-preview?group_ids=${groupIds.join(",")}`),

  archiveForm: (formId) =>
    request(`/form_management/${formId}/archive`, { method: "POST" }),

// ── Admin: Audit Logs ──
  getAuditLogs: ({ limit = 20, offset = 0, action, user_id } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (action) params.set("action", action);
    if (user_id) params.set("user_id", user_id);
    return request(`/admin_only/audit-logs?${params.toString()}`);
  },

  // ── Admin: Backup & Restore ──

  downloadBackup: async () => {
    const res = await fetch(`${API_BASE}/admin_only/backup`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await parseJsonSafely(res);
      throw new Error(getErrorMessage(res, err));
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?(.+?)"?$/);
    const filename = match
      ? match[1]
      : `backup_${new Date().toISOString().split("T")[0]}.json`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  restoreBackup: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/admin_only/restore`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) throw new Error(getErrorMessage(res, data));
    return data;
  },

  previewRestoreBackup: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/admin_only/restore/preview`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await parseJsonSafely(res);
    if (!res.ok) throw new Error(getErrorMessage(res, data));
    return data;
  },

  listBackups: (limit) =>
    request(`/admin_only/backups${limit ? `?limit=${limit}` : ""}`),

  deleteBackup: (backupId) =>
    request(`/admin_only/backups/${backupId}`, { method: "DELETE" }),

  restoreBackupFromHistory: (backupId) =>
    request(`/admin_only/backups/${backupId}/restore`, { method: "POST" }),

  previewBackupFromHistory: (backupId) =>
    request(`/admin_only/backups/${backupId}/preview`),

  adminGetBackupSchedule: () => request("/admin_only/backup-schedule"),

  adminUpdateBackupSchedule: (payload) =>
    request("/admin_only/backup-schedule", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  adminGetMaintenanceSettings: () => request("/admin_only/maintenance-settings"),

  adminUpdateMaintenanceSettings: (payload) =>
    request("/admin_only/maintenance-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  // ── Admin: Groups (REAL — backed by /admin_only/groups) ──

  adminGetGroups: () => request("/admin_only/groups"),
  adminGetGroupMembers: (groupId) => request(`/admin_only/groups/${groupId}/members`),

  adminCreateGroup: (payload) =>
    request("/admin_only/groups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adminDeleteGroup: (groupId) =>
    request(`/admin_only/groups/${groupId}`, { method: "DELETE" }),

  // ── Admin: Caretakers (REAL — backed by /admin_only/caretakers) ──

  adminGetCaretakers: () => request("/admin_only/caretakers"),

  adminAssignCaretaker: (userId, groupId) =>
    request("/admin_only/assign-caretaker", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, group_id: groupId }),
    }),

  adminUnassignCaretaker: (groupId) =>
    request(`/admin_only/assign-caretaker/${groupId}`, { method: "DELETE" }),

  adminMoveParticipant: (userId, groupId) =>
    request(`/admin_only/users/${userId}/group`, {
      method: "PATCH",
      body: JSON.stringify({ group_id: groupId }),
    }),

  adminUpdateGroup: (groupId, payload) =>
    request(`/admin_only/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  adminGetUserSubmissions: (userId) =>
    request(`/admin_only/users/${userId}/submissions`),

  adminGetUserGoals: (userId) =>
    request(`/admin_only/users/${userId}/goals`),

  // ── Admin: Invites ──
  adminListInvites: (limit, offset = 0) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString();
    return request(`/admin_only/invites${qs ? `?${qs}` : ""}`);
  },

  adminRevokeInvite: (inviteId) =>
    request(`/admin_only/invites/${inviteId}`, { method: "DELETE" }),

  // ── Admin: User Management ──
  adminListUsers: () => request("/admin_only/users"),
  adminGetUserById: (userId) => request(`/admin_only/users/by-id/${userId}`),
  adminListUsersPaged: async (limit = 50, offset = 0, search = "", sortField = "joined", sortDir = "desc") => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      sort_field: String(sortField || "joined"),
      sort_dir: String(sortDir || "desc"),
    });
    if (String(search || "").trim()) {
      params.set("search", String(search).trim());
    }

    try {
      return await request(`/admin_only/users/paged?${params.toString()}`);
    } catch (error) {
      // Backward-compatible fallback for environments that only expose /users.
      const full = await request("/admin_only/users");
      const normalizedSearch = String(search || "").trim().toLowerCase();
      const list = Array.isArray(full) ? full : [];
      const filtered = normalizedSearch
        ? list.filter((user) => {
            const haystack = `${user?.first_name || ""} ${user?.last_name || ""} ${user?.email || ""}`.toLowerCase();
            return haystack.includes(normalizedSearch);
          })
        : list;
      const safeField = String(sortField || "joined").toLowerCase();
      const safeDir = String(sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        switch (safeField) {
          case "name":
            return safeDir * `${a?.first_name || ""} ${a?.last_name || ""}`.localeCompare(`${b?.first_name || ""} ${b?.last_name || ""}`);
          case "email":
            return safeDir * String(a?.email || "").localeCompare(String(b?.email || ""));
          case "status":
            return safeDir * String(Boolean(a?.status)).localeCompare(String(Boolean(b?.status)));
          case "role":
            return safeDir * String(a?.role || "").localeCompare(String(b?.role || ""));
          case "group":
            return safeDir * String(a?.group || "").localeCompare(String(b?.group || ""));
          case "joined":
          default:
            return safeDir * (new Date(a?.joined_at || 0) - new Date(b?.joined_at || 0));
        }
      });
      const safeOffset = Math.max(0, Number(offset) || 0);
      const safeLimit = Math.max(1, Number(limit) || 50);
      return {
        total: filtered.length,
        limit: safeLimit,
        offset: safeOffset,
        items: filtered.slice(safeOffset, safeOffset + safeLimit),
        _fallback: true,
        _error: error?.message || null,
      };
    }
  },
  adminGetOnboardingStats: () => request("/admin_only/stats/onboarding"),
  adminGetSurveyStats: () => request("/admin_only/stats/surveys"),
  adminGetRoleGroupStats: () => request("/admin_only/stats/roles-groups"),
  adminGetDashboard: ({ auditLimit = 3 } = {}) =>
    request(`/admin_only/dashboard?audit_limit=${auditLimit}`),
  adminGetDashboardSummary: () =>
    request("/admin_only/dashboard/summary"),

  adminUpdateUser: (userId, payload) =>
    request(`/admin_only/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  adminUpdateUserStatus: (userId, status) =>
    request(`/admin_only/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminReactivateUser: (userId, payload = {}) =>
    request(`/admin_only/users/${userId}/reactivate`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adminUnlockUser: (userId) =>
    request(`/admin_only/users/${userId}/unlock`, {
      method: "POST",
    }),

  adminDeleteUser: (userId, mode) =>
    request(`/admin_only/users/${userId}`, {
      method: "DELETE",
      body: JSON.stringify({ mode }),
    }),

  // Admin Profile (requires backend changes)
  adminGetProfile: () => request("/admin_only/profile"),
  adminGetSystemStats: () => request("/admin_only/system-stats"),
  adminListSystemFeedback: () => request("/feedback"),
  adminUpdateSystemFeedbackStatus: (feedbackId, status) =>
    request(`/feedback/${feedbackId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminUpdateProfile: (payload) =>
    request("/admin_only/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // ── Auth: Invite ──
  sendInvite: (email, target_role, group_id) =>
    request("/auth/signup_invite", {
      method: "POST",
      body: JSON.stringify({ email, target_role, ...(group_id ? { group_id } : {}) }),
    }),

  validateInvite: (token) => request(`/auth/validate-invite?token=${token}`),

  registerWithInvite: (token, payload) =>
    request(`/auth/register?token=${token}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Intake (onboarding) ──
  getIntakeForm: () => request('/onboarding/form'),

  submitIntake: (payload) =>
    request('/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markBackgroundRead: () =>
    request('/onboarding/background-read', {
      method: 'POST',
    }),

  submitConsent: (payload) =>
    request('/onboarding/consent', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  completeOnboarding: () =>
    request('/onboarding/complete', {
      method: 'POST',
    }),

  getBackgroundInfo: () => request('/onboarding/background-info'),

  getConsentForm: () => request('/onboarding/consent-form'),

  updateConsentTemplate: (payload) =>
    request('/onboarding/admin/consent-template', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateBackgroundTemplate: (payload) =>
    request('/onboarding/admin/background-template', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getAdminIntakeForm: () => request('/onboarding/admin/intake-form'),

  updateIntakeForm: (payload) =>
    request('/onboarding/admin/intake-form', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // ── Survey Fill (participant) ──
  getDeployedForms: () => request("/participant/surveys/assigned"),

  getParticipantFormDetail: (formId) =>
    request(`/participant/surveys/${formId}`),

  getSurveyResponse: (formId) =>
    request(`/participant/surveys/${formId}/response`),

  saveDraftAnswers: (formId, answers) =>
    request(`/participant/surveys/${formId}/save`, {
      method: "POST",
      body: JSON.stringify(answers),
    }),

  submitSurvey: (formId, answers) =>
    request(`/participant/surveys/${formId}/submit`, {
      method: "POST",
      body: JSON.stringify(answers),
    }),

  // ── Data Elements (researcher) ──

  listElements: () =>
    request(`/data-elements/elements?t=${new Date().getTime()}`),

  createDataElement: (payload) =>
    request("/data-elements/data_element", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteElement: (element_id) =>
    request(`/data-elements/${element_id}`, { method: "DELETE" }),

  getAllMappings: () =>
    request(`/data-elements/all-mappings`),

  getFieldMapping: (field_id) =>
    request(`/data-elements/fields/${field_id}/map`),

  mapField: (field_id, payload) =>
    request(`/data-elements/fields/${field_id}/map`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  unmapField: (field_id, element_id) =>
    request(`/data-elements/fields/${field_id}/map?element_id=${element_id}`, {
      method: "DELETE",
    }),

  // ── Caretaker ──────────────────────────────────────────────────────────────
  // Backend routes: backend/app/api/routes/Caretakers.py

  // Profile (requires backend changes — see pending backend backlog)
  caretakerGetProfile: () => request("/caretaker/profile"),

  caretakerUpdateProfile: (payload) =>
    request("/caretaker/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  researcherGetProfile: () => request("/researcher/profile"),

  researcherUpdateProfile: (payload) =>
    request("/researcher/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Groups
  caretakerGetGroups: () => request("/caretaker/groups"),

  caretakerGetGroup: (groupId) => request(`/caretaker/groups/${groupId}`),

  caretakerGetGroupMembers: (groupId) =>
    request(`/caretaker/groups/${groupId}/members`),

  caretakerGetGroupElements: (groupId) =>
    request(`/caretaker/groups/${groupId}/elements`),

  caretakerListForms: (groupId, options = {}) => {
    const params = new URLSearchParams();
    if (groupId) params.set("group_id", groupId);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return request(`/caretaker/forms${qs ? `?${qs}` : ""}`);
  },

  caretakerGetFormDetail: (formId, groupId) => {
    const qs = groupId ? `?group_id=${groupId}` : "";
    return request(`/caretaker/forms/${formId}${qs}`);
  },

  // Participants
  caretakerListParticipants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants${qs ? `?${qs}` : ""}`);
  },
  caretakerGetParticipantsSummary: (groupId) => {
    const qs = groupId ? `?group_id=${groupId}` : "";
    return request(`/caretaker/participants-summary${qs}`);
  },
  caretakerGetFormsSummary: (groupId) => {
    const qs = groupId ? `?group_id=${groupId}` : "";
    return request(`/caretaker/forms-summary${qs}`);
  },

  caretakerGetParticipant: (participantId, groupId) =>
    request(`/caretaker/participants/${participantId}?group_id=${groupId}`),

  caretakerGetActivityCounts: (groupId) => {
    const qs = groupId ? `?group_id=${groupId}` : "";
    return request(`/caretaker/participants/activity-counts${qs}`);
  },

  // Submissions
  caretakerListSubmissions: (participantId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants/${participantId}/submissions${qs ? `?${qs}` : ""}`);
  },

  caretakerGetSubmissionDetail: (participantId, submissionId) =>
    request(`/caretaker/participants/${participantId}/submissions/${submissionId}`),

  // Feedback
  caretakerListFeedback: (participantId) =>
    request(`/caretaker/participants/${participantId}/feedback`),

  participantListFeedback: () =>
    request("/participant/feedback"),

  caretakerCreateFeedback: (participantId, submissionId, message) =>
    request(`/caretaker/participants/${participantId}/submissions/${submissionId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  caretakerCreateGeneralFeedback: (participantId, message) =>
    request(`/caretaker/participants/${participantId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // Health Goals (read-only for caretaker)
  caretakerGetGoals: (participantId) =>
    request(`/caretaker/participants/${participantId}/goals`),

  // Alias for backward compatibility
  caretakerGetParticipantGoals: (participantId) =>
    request(`/caretaker/participants/${participantId}/goals`),

  // Health Trends
  caretakerGetHealthTrends: (participantId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(
      `/caretaker/participants/${participantId}/health-trends${qs ? `?${qs}` : ""}`,
    );
  },

  // Notes
  caretakerListNotes: (participantId) =>
    request(`/caretaker/participants/${participantId}/notes`),

  caretakerCreateNote: (participantId, text, tag) =>
    request(`/caretaker/participants/${participantId}/notes`, {
      method: "POST",
      body: JSON.stringify({ text, tag }),
    }),

  caretakerUpdateNote: (noteId, text) =>
    request(`/caretaker/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ text }),
    }),

  caretakerDeleteNote: (noteId) =>
    request(`/caretaker/notes/${noteId}`, { method: "DELETE" }),

  // Reports
  caretakerGenerateGroupReport: (groupId, payload) =>
    request(`/caretaker/reports/group/generate?group_id=${groupId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  caretakerGenerateComparisonReport: (participantId, queryParams = {}, payload = {}) => {
    const params = new URLSearchParams({ participant_id: participantId, ...queryParams });
    return request(`/caretaker/reports/comparison?${params.toString()}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  caretakerGenerateParticipantReport: (participantId, payload) =>
    request(`/caretaker/reports/participant?participant_id=${participantId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  caretakerGetReport: (reportId) => request(`/caretaker/reports/${reportId}`),

  caretakerListReports: () => request("/caretaker/reports"),

  // Invites (no backend endpoint yet)
  caretakerListInvites: (limit, offset = 0) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString();
    return request(`/caretaker/invites${qs ? `?${qs}` : ""}`);
  },

  caretakerRevokeInvite: (inviteId) =>
    request(`/caretaker/invites/${inviteId}`, {
      method: "DELETE",
    }),

  // ── Notifications (shared across roles) ──────────────────────────────────

  getNotifications: (role) => {
    const r = normalizeNotificationRole(role);
    return request(`/${r}/notifications`);
  },

  markNotificationRead: (role, notificationId) =>
    request(`/${normalizeNotificationRole(role)}/notifications/${notificationId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_read: true }),
    }),

  // ── Researcher Analytics ──

  getAvailableSurveys: () => request("/researcher/query/available-surveys"),

  getResearcherResults: (params = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => sp.append(key, v));
      } else {
        sp.append(key, value);
      }
    });
    const qs = sp.toString();
    return request(`/researcher/query/results${qs ? `?${qs}` : ""}`);
  },

  // 3. Generate the CSV file download URL
  // We don't use the standard request() here because we need to handle a file Blob, not JSON!
  downloadResearcherResults: async (params = {}, excludeColumns = []) => {
    const allParams = { ...params };
    if (excludeColumns.length > 0) allParams.exclude_columns = excludeColumns.join(",");
    const qs = new URLSearchParams(allParams).toString();
    const res = await fetch(
      `${API_BASE}/researcher/query/results/download${qs ? `?${qs}` : ""}`,
      { credentials: "include" },
    );

    if (!res.ok) throw new Error("Failed to download CSV");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  // ── Goal Templates (Researcher) ──
  listGoalTemplates: () => request("/goal-templates"),

  createGoalTemplate: (payload) =>
    request("/goal-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateGoalTemplate: (templateId, payload) =>
    request(`/goal-templates/${templateId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteGoalTemplate: (templateId) =>
    request(`/goal-templates/${templateId}`, {
      method: "DELETE",
    }),

<<<<<<< HEAD
  listDeletedGoalTemplates: () => request("/goal-templates/deleted"),

  restoreGoalTemplate: (templateId) =>
    request(`/goal-templates/${templateId}/restore`, { method: "POST" }),

  getGoalTemplateStats: (templateId, granularity = "month") =>
    request(`/goal-templates/${templateId}/stats?granularity=${granularity}`),

  getGoalRawDatapoints: (templateId) =>
    request(`/goal-templates/${templateId}/raw`),

  exportGoalSummary: async (templateId, granularity = "month", templateName = "goal") => {
    const res = await fetch(
      `${API_BASE}/goal-templates/${templateId}/export/summary?granularity=${granularity}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName}_summary_${granularity}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  exportGoalRaw: async (templateId, templateName = "goal") => {
    const res = await fetch(
      `${API_BASE}/goal-templates/${templateId}/export/raw`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName}_raw_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

=======
>>>>>>> origin/developer
  // ── Participant: Profile ──
  participantGetProfile: () => request("/participant/profile"),
  participantUpdateProfile: (payload) =>
    request("/participant/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // ── Participant: Surveys ──
  getAssignedSurveys: () => request("/participant/surveys/assigned"),

  // ── Participant: Health Goals ──

  browseGoalTemplates: () => request("/participant/goal-templates"),

  listParticipantGoals: () => request("/participant/goals"),

  getParticipantGoal: (goalId) => request(`/participant/goals/${goalId}`),

  addGoalFromTemplate: (templateId, payload = {}) =>
    request(`/participant/goals/add/${templateId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateParticipantGoal: (goalId, payload) =>
    request(`/participant/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteParticipantGoal: (goalId) =>
    request(`/participant/goals/${goalId}`, { method: "DELETE" }),

  logGoalProgress: (goalId, payload) =>
    request(`/participant/goals/${goalId}/log`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getGoalLogs: (goalId, days = 7) =>
    request(`/participant/goals/${goalId}/logs?days=${days}`),

  // ── Participant Stats (for Charts) ──

  getMyStats: () => request("/stats/stats_me"),

  getAvailableElements: () => request("/stats/me/available-elements"),

  getMyElementsData: () => request("/stats/me/elements"),

  getMyHealthTimeseries: (params = {}) => {
    const qs = new URLSearchParams();
    if (Array.isArray(params.element_ids)) {
      params.element_ids.forEach((id) => qs.append("element_ids", id));
    }
    if (params.date_from) {
      qs.set("date_from", params.date_from);
    }
    if (params.date_to) {
      qs.set("date_to", params.date_to);
    }
    return request(`/stats/me/health-timeseries${qs.toString() ? `?${qs.toString()}` : ""}`);
  },

  getMyVsGroupStats: () => request("/stats/me/vs-group"),
};

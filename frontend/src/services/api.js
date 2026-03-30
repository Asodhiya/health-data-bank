const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  const data = await res.json();
 
  if (!res.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg).join(", ")
          : "Something went wrong";
    throw new Error(msg);
  }
 
  return data;
}

export const api = {
  login: (identifier, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () => request("/auth/logout", { method: "POST" }),

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

  listGroups: () => request("/form_management/groups"),

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

  getFormDeployments: (formId) =>
    request(`/form_management/${formId}/deployments`),

  // ── Admin: Audit Logs ──
  getAuditLogs: ({ limit = 20, offset = 0, action } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (action) params.set("action", action);
    return request(`/admin_only/audit-logs?${params.toString()}`);
  },

  // ── Admin: Backup & Restore ──

  downloadBackup: async () => {
    const res = await fetch(`${API_BASE}/admin_only/backup`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create backup");
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Restore failed");
    return data;
  },

  // TODO (backend): Add GET /admin_only/backups endpoint
  listBackups: () => request("/admin_only/backups"),

  // TODO (backend): Add DELETE /admin_only/backups/{backup_id} endpoint
  deleteBackup: (backupId) =>
    request(`/admin_only/backups/${backupId}`, { method: "DELETE" }),

  // ── Admin: Groups (REAL — backed by /admin_only/groups) ──

  adminGetGroups: () => request("/admin_only/groups"),

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

  adminUpdateGroup: (groupId, payload) =>
    request(`/admin_only/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // ── Admin: Invites ──
  // TODO (backend): Add GET /admin_only/invites and DELETE /admin_only/invites/{id}
  adminListInvites: () => request("/admin_only/invites"),

  adminRevokeInvite: (inviteId) =>
    request(`/admin_only/invites/${inviteId}`, { method: "DELETE" }),

  // ── Admin: User Management ──
  // TODO (backend): Add CRUD endpoints for user management
  adminListUsers: () => request("/admin_only/users"),

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

  adminDeleteUser: (userId, mode) =>
    request(`/admin_only/users/${userId}`, {
      method: "DELETE",
      body: JSON.stringify({ mode }),
    }),

  // Admin Profile (requires backend changes)
  adminGetProfile: () => request("/admin_only/profile"),

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

  // Participants
  caretakerListParticipants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants${qs ? `?${qs}` : ""}`);
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

  caretakerCreateFeedback: (participantId, submissionId, message) =>
    request(`/caretaker/participants/${participantId}/submissions/${submissionId}/feedback`, {
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

  // Notes (no backend endpoint — kept for future use)
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
  caretakerListInvites: () => request("/caretaker/invites"),

  caretakerRevokeInvite: (inviteId) =>
    request(`/caretaker/invites/${inviteId}/revoke`, {
      method: "POST",
    }),

  // ── Notifications (shared across roles) ──────────────────────────────────

  getNotifications: (role) => request(`/${role}/notifications`),

  markNotificationRead: (role, notificationId) =>
    request(`/${role}/notifications/${notificationId}`, {
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

  // ── Participant: Surveys ──
  getAssignedSurveys: () => request("/participant/surveys/assigned"),

  // ── Participant: Health Goals ──

  browseGoalTemplates: () => request("/participant/goal-templates"),

  listParticipantGoals: () => request("/participant/goals"),

  getParticipantGoal: (goalId) => request(`/participant/goals/${goalId}`),

  addGoalFromTemplate: (templateId, targetValue = null) => {
    const url = `/participant/goals/add/${templateId}${targetValue ? `?target_value=${targetValue}` : ""}`;
    return request(url, { method: "POST" });
  },

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

  // ── Participant Stats (for Charts) ──

  getMyStats: () => request("/stats/stats_me"),

  getAvailableElements: () => request("/stats/me/available-elements"),

  getMyElementsData: () => request("/stats/me/elements"),

  getMyVsGroupStats: () => request("/stats/me/vs-group"),
};
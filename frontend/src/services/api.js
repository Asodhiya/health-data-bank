const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong");
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
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
    request(`/form_management/${formId}/unpublish`, {
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

  // Downloads the full backup as a JSON file (blob, not JSON response).
  // Uses raw fetch because the endpoint returns a binary blob with
  // Content-Disposition header, not a JSON body.
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

  // Uploads a backup JSON file to restore the database.
  // Uses raw fetch because the endpoint expects multipart/form-data,
  // not a JSON body. Do NOT set Content-Type — the browser sets it
  // automatically with the correct boundary for FormData.
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

  // List all backup records, newest first.
  // TODO (backend): Add GET /admin_only/backups endpoint to admin_only.py
  // that queries the backups table and returns backup_id, storage_path,
  // checksum, created_at, created_by, and table_row_counts.
  listBackups: () => request("/admin_only/backups"),

  // Delete a backup record by ID.
  // TODO (backend): Add DELETE /admin_only/backups/{backup_id} endpoint
  // to admin_only.py that removes the record from the backups table.
  deleteBackup: (backupId) =>
    request(`/admin_only/backups/${backupId}`, { method: "DELETE" }),

  // ── Auth: Invite ──
  sendInvite: (email, target_role) =>
    request("/auth/signup_invite", {
      method: "POST",
      body: JSON.stringify({ email, target_role }),
    }),

  validateInvite: (token) => request(`/auth/validate-invite?token=${token}`),

  registerWithInvite: (token, payload) =>
    request(`/auth/register?token=${token}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Intake (onboarding) ──
  getIntakeForm: () => request('/participant/intake/form'),

  submitIntake: (payload) =>
    request('/participant/intake', {
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

  // ── Data Elements (researcher) added by Nima──
  // ── Data Elements (Standardization Hub) ──

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

  // Map: field_id in path, element_id and transform_rule in body
  mapField: (field_id, payload) =>
    request(`/data-elements/fields/${field_id}/map`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Unmap: field_id in path, element_id in query string (?element_id=...)
  unmapField: (field_id, element_id) =>
    request(`/data-elements/fields/${field_id}/map?element_id=${element_id}`, {
      method: "DELETE",
    }),

  // ── Caretaker ──────────────────────────────────────────────────────────────
  // Backend routes: backend/app/api/routes/Caretakers.py

  // Groups
  caretakerGetGroups: () => request("/caretaker/groups"),

  caretakerGetGroup: (groupId) => request(`/caretaker/groups/${groupId}`),

  // FIX: added groupId — backend requires group_id as query param
  caretakerGetGroupMembers: (groupId) =>
    request(`/caretaker/groups/${groupId}/members`),

  caretakerGetGroupElements: (groupId) =>
    request(`/caretaker/groups/${groupId}/elements`),

  // Participants
  caretakerListParticipants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants${qs ? `?${qs}` : ""}`);
  },

  // FIX: added groupId — backend requires group_id as query param
  caretakerGetParticipant: (participantId, groupId) =>
    request(`/caretaker/participants/${participantId}?group_id=${groupId}`),

  caretakerGetActivityCounts: (groupId) => {
    const qs = groupId ? `?group_id=${groupId}` : "";
    return request(`/caretaker/participants/activity-counts${qs}`);
  },

  // FIX: participantId is now a path param (was incorrectly a query param)
  caretakerListSubmissions: (participantId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants/${participantId}/submissions${qs ? `?${qs}` : ""}`);
  },

  // NEW: Feedback (read + create) — backed by real endpoints
  caretakerListFeedback: (participantId) =>
    request(`/caretaker/participants/${participantId}/feedback`),

  caretakerCreateFeedback: (participantId, submissionId, message) =>
    request(`/caretaker/participants/${participantId}/submissions/${submissionId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // Health Goals (read-only for caretaker — no endpoint yet)
  caretakerGetParticipantGoals: (participantId) =>
    request(`/caretaker/participants/${participantId}/goals`),

  // Health Trends (no endpoint yet)
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
  // FIX: URL was /reports/group, backend is /reports/group/generate
  caretakerGenerateGroupReport: (groupId, payload) =>
    request(`/caretaker/reports/group/generate?group_id=${groupId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // FIX: now accepts queryParams for compare_with, compare_participant_id, group_id
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

  // 1. Get the list of published surveys for the dropdown
  getAvailableSurveys: () => request("/researcher/query/available-surveys"),

  // 2. Fetch the actual data and columns (accepts optional filters like survey_id)
  getResearcherResults: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/researcher/query/results${qs ? `?${qs}` : ""}`);
  },

  // 3. Generate the CSV file download URL
  // We don't use the standard request() here because we need to handle a file Blob, not JSON!
  downloadResearcherResults: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(
      `${API_BASE}/researcher/query/results/download${qs ? `?${qs}` : ""}`,
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );

    if (!res.ok) throw new Error("Failed to download CSV");

    // Convert response to a blob and trigger browser download
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  // ── Participant: Surveys (alias used by participant pages) ──
  getAssignedSurveys: () => request("/participant/surveys/assigned"),

  // ── Participant: Health Goals ──

  // Browse templates created by researchers
  browseGoalTemplates: () => request("/participant/goal-templates"),

  // List goals already active on the participant's dashboard
  listParticipantGoals: () => request("/participant/goals"),

  // Get a single goal's status
  getParticipantGoal: (goalId) => request(`/participant/goals/${goalId}`),

  // Add a goal from a template.
  // Note: target_value is passed as a query param per the backend
  addGoalFromTemplate: (templateId, targetValue = null) => {
    const url = `/participant/goals/add/${templateId}${targetValue ? `?target_value=${targetValue}` : ""}`;
    return request(url, { method: "POST" });
  },

  // Update a goal (e.g. changing the target)
  updateParticipantGoal: (goalId, payload) =>
    request(`/participant/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Delete a goal from the dashboard
  deleteParticipantGoal: (goalId) =>
    request(`/participant/goals/${goalId}`, { method: "DELETE" }),

  // Log progress (e.g. "drank 500ml")
  logGoalProgress: (goalId, payload) =>
    request(`/participant/goals/${goalId}/log`, {
      method: "POST",
      body: JSON.stringify(payload), // { value: number, observed_at: string }
    }),

  // ── Participant Stats (for Charts) ──

  // Gets the overall health score/stats for the logged-in participant
  getMyStats: () => request("/stats/stats_me"),

  // Gets the available elements (metrics) the participant is tracking
  getAvailableElements: () => request("/stats/me/available-elements"),

  // Gets specific data points for the participant's elements
  getMyElementsData: () => request("/stats/me/elements"),

  // Gets comparison data (Participant vs. Group average)
  getMyVsGroupStats: () => request("/stats/me/vs-group"),
};
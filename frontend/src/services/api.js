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
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, new_password) =>
    request('/auth/reset-password', {
      method: 'POST',
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

  // ── Caretaker ──
  // Backend stubs: backend/app/api/routes/Caretakers.py
  // All calls fall back to mock data on the frontend when backend returns 404.

  // Participants
  caretakerListParticipants: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants${qs ? `?${qs}` : ""}`);
  },

  caretakerGetParticipant: (participantId) =>
    request(`/caretaker/participants/${participantId}`),

  // Groups
  caretakerGetGroups: () => request("/caretaker/groups"),

  // Submissions (read-only for caretaker)
  caretakerListSubmissions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/submissions${qs ? `?${qs}` : ""}`);
  },

  caretakerGetSubmission: (submissionId) =>
    request(`/caretaker/submissions/${submissionId}`),

  // Health Goals (read-only for caretaker)
  caretakerGetParticipantGoals: (participantId) =>
    request(`/caretaker/participants/${participantId}/goals`),

  // Health Trends
  caretakerGetHealthTrends: (participantId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/caretaker/participants/${participantId}/health-trends${qs ? `?${qs}` : ""}`);
  },

  // Notes & Feedback
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
    request(`/caretaker/reports/group?group_id=${groupId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  caretakerGenerateComparisonReport: (participantId, payload) =>
    request(`/caretaker/reports/comparison?participant_id=${participantId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  caretakerGenerateParticipantReport: (participantId, payload) =>
    request(`/caretaker/reports/participant?participant_id=${participantId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  caretakerGetReport: (reportId) =>
    request(`/caretaker/reports/${reportId}`),

  caretakerListInvites: () =>
    request("/caretaker/invites"),

  caretakerRevokeInvite: (inviteId) =>
    request(`/caretaker/invites/${inviteId}/revoke`, {
      method: "POST",
    }),

  // ── Notifications (shared across roles) ──────────────────────────────────

  getNotifications: (role) =>
    request(`/${role}/notifications`),

  markNotificationRead: (role, notificationId) =>
    request(`/${role}/notifications/${notificationId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_read: true }),
    }),
};
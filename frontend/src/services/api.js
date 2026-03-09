const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload) =>
    request('/auth/register_participant', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  me: () =>
    request('/auth/me'),

  updateUser: (payload) =>
    request('/user/update_user', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ── Form Management (researcher/admin) ──
  listForms: () =>
    request('/form_management/list'),

  getFormDetail: (formId) =>
    request(`/form_management/detail/${formId}`),

  createForm: (payload) =>
    request('/form_management/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateForm: (formId, payload) =>
    request(`/form_management/update/${formId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteForm: (formId) =>
    request(`/form_management/delete/${formId}`, {
      method: 'DELETE',
    }),

  listGroups: () =>
    request('/form_management/groups'),

  publishForm: (formId, groupId) =>
    request(`/form_management/${formId}/publish?group_id=${groupId}`, {
      method: 'POST',
    }),

  unpublishForm: (formId) =>
    request(`/form_management/${formId}/unpublish`, {
      method: 'POST',
    }),

  getFormDeployments: (formId) =>
    request(`/form_management/${formId}/deployments`),

  // ── Survey Fill (participant) ──
  // Backend: GET /api/v1/participant/surveys/assigned
  getDeployedForms: () =>
    request('/participant/surveys/assigned'),

  // Backend: GET /api/v1/participant/surveys/:formId
  getParticipantFormDetail: (formId) =>
    request(`/participant/surveys/${formId}`),

  // Backend: GET /api/v1/participant/surveys/:formId/response
  getSurveyResponse: (formId) =>
    request(`/participant/surveys/${formId}/response`),

  // Backend: POST /api/v1/participant/surveys/:formId/save
  // Body: [{field_id, value}, ...]
  saveDraftAnswers: (formId, answers) =>
    request(`/participant/surveys/${formId}/save`, {
      method: 'POST',
      body: JSON.stringify(answers),
    }),

  // Backend: POST /api/v1/participant/surveys/:formId/submit
  // Body: [{field_id, value}, ...]
  submitSurvey: (formId, answers) =>
    request(`/participant/surveys/${formId}/submit`, {
      method: 'POST',
      body: JSON.stringify(answers),
    }),

  // ── Participant Goals ──
  getGoals: () =>
    request('/participant/goals'),

  getGoal: (goalId) =>
    request(`/participant/goals/${goalId}`),

  addGoalFromTemplate: (templateId, targetValue) =>
    request(`/participant/goals/add/${templateId}${targetValue != null ? `?target_value=${targetValue}` : ''}`, {
      method: 'POST',
    }),

  updateGoal: (goalId, payload) =>
    request(`/participant/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteGoal: (goalId) =>
    request(`/participant/goals/${goalId}`, { method: 'DELETE' }),

  // ── Goal Templates (participant browse) ──
  getGoalTemplates: () =>
    request('/participant/goal-templates'),
};

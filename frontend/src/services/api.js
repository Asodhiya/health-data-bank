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

  publishForm: (formId, groupId) =>
    request(`/form_management/${formId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId }),
    }),

  unpublishForm: (formId) =>
    request(`/form_management/${formId}/unpublish`, {
      method: 'POST',
    }),

  // ── Survey Fill (participant) ──
  getDeployedForms: () =>
    request('/surveys/deployed'),

  getDraftAnswers: (formId) =>
    request(`/submissions/${formId}/draft`),

  saveDraftAnswers: (formId, answers) =>
    request(`/submissions/${formId}/save`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  submitSurvey: (formId, answers) =>
    request(`/submissions/${formId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
};

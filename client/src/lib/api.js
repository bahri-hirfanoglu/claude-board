const BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

// Global error listeners
const errorListeners = new Set();
export function onApiError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}
function notifyError(msg) {
  errorListeners.forEach((fn) => fn(msg));
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (e) {
    notifyError('Network error — server unreachable');
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = err.error || `Request failed (${res.status})`;
    if (res.status >= 500) notifyError(msg);
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => request('/api/projects'),
  getProjectsSummary: () => request('/api/projects/summary'),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (projectId) => request(`/api/projects/${projectId}/tasks`),
  getTask: (id) => request(`/api/tasks/${id}`),
  createTask: (projectId, data) =>
    request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  getTaskLogs: (id, limit = 500) => request(`/api/tasks/${id}/logs?limit=${limit}`),
  stopTask: (id) => request(`/api/tasks/${id}/stop`, { method: 'POST' }),
  restartTask: (id) => request(`/api/tasks/${id}/restart`, { method: 'POST' }),
  requestChanges: (id, feedback) =>
    request(`/api/tasks/${id}/request-changes`, { method: 'POST', body: JSON.stringify({ feedback }) }),
  getRevisions: (id) => request(`/api/tasks/${id}/revisions`),
  getTaskDetail: (id) => request(`/api/tasks/${id}/detail`),

  // Planning
  startPlanning: (projectId, data) =>
    request(`/api/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify(data) }),
  cancelPlanning: (projectId) =>
    request(`/api/projects/${projectId}/plan/cancel`, { method: 'POST' }),
  getPlanningStatus: (projectId) =>
    request(`/api/projects/${projectId}/plan/status`),

  // Stats & Activity
  getStats: (projectId) => request(`/api/projects/${projectId}/stats`),
  getActivity: (projectId, limit = 50, offset = 0) =>
    request(`/api/projects/${projectId}/activity?limit=${limit}&offset=${offset}`),
  getClaudeUsage: () => request('/api/stats/claude-usage'),

  // CLAUDE.md
  getClaudeMd: (projectId) => request(`/api/projects/${projectId}/claude-md`),
  saveClaudeMd: (projectId, content) =>
    request(`/api/projects/${projectId}/claude-md`, { method: 'PUT', body: JSON.stringify({ content }) }),

  // Snippets
  getSnippets: (projectId) => request(`/api/projects/${projectId}/snippets`),
  createSnippet: (projectId, data) =>
    request(`/api/projects/${projectId}/snippets`, { method: 'POST', body: JSON.stringify(data) }),
  updateSnippet: (id, data) => request(`/api/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSnippet: (id) => request(`/api/snippets/${id}`, { method: 'DELETE' }),

  // Templates
  getTemplates: (projectId) => request(`/api/projects/${projectId}/templates`),
  createTemplate: (projectId, data) =>
    request(`/api/projects/${projectId}/templates`, { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),

  // Attachments
  uploadAttachments: async (taskId, files) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const res = await fetch(`${BASE}/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
  getAttachments: (taskId) => request(`/api/tasks/${taskId}/attachments`),
  deleteAttachment: (id) => request(`/api/attachments/${id}`, { method: 'DELETE' }),

  // Roles
  getRoles: (projectId) => request(`/api/projects/${projectId}/roles`),
  getGlobalRoles: () => request('/api/roles/global'),
  createRole: (projectId, data) =>
    request(`/api/projects/${projectId}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id, data) => request(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id) => request(`/api/roles/${id}`, { method: 'DELETE' }),

  // Webhooks
  getWebhooks: (projectId) => request(`/api/projects/${projectId}/webhooks`),
  createWebhook: (projectId, data) =>
    request(`/api/projects/${projectId}/webhooks`, { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id, data) => request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWebhook: (id) => request(`/api/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id) => request(`/api/webhooks/${id}/test`, { method: 'POST' }),

  // Auth
  getAuthStatus: () => request('/api/auth/status'),
  enableAuth: () => request('/api/auth/enable', { method: 'POST' }),
  disableAuth: () => request('/api/auth/disable', { method: 'POST' }),
};

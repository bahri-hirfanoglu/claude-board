const BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
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
  createTask: (projectId, data) => request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) => request(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  getTaskLogs: (id, limit = 500) => request(`/api/tasks/${id}/logs?limit=${limit}`),
  stopTask: (id) => request(`/api/tasks/${id}/stop`, { method: 'POST' }),
  restartTask: (id) => request(`/api/tasks/${id}/restart`, { method: 'POST' }),
  requestChanges: (id, feedback) => request(`/api/tasks/${id}/request-changes`, { method: 'POST', body: JSON.stringify({ feedback }) }),
  getRevisions: (id) => request(`/api/tasks/${id}/revisions`),

  // Stats & Activity
  getStats: (projectId) => request(`/api/projects/${projectId}/stats`),
  getActivity: (projectId, limit = 50, offset = 0) => request(`/api/projects/${projectId}/activity?limit=${limit}&offset=${offset}`),

  // CLAUDE.md
  getClaudeMd: (projectId) => request(`/api/projects/${projectId}/claude-md`),
  saveClaudeMd: (projectId, content) => request(`/api/projects/${projectId}/claude-md`, { method: 'PUT', body: JSON.stringify({ content }) }),
};

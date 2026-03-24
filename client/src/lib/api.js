// Detect Tauri environment
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let invoke;
if (IS_TAURI) {
  invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
}

// MCP HTTP port (used by Tauri backend for Claude runner)
const MCP_PORT = 4000;

// ─── HTTP fallback (web mode / dev) ───
const BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

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

// ─── Tauri invoke wrapper with error handling ───
async function tauriCall(cmd, args = {}) {
  try {
    return await invoke(cmd, args);
  } catch (e) {
    const msg = typeof e === 'string' ? e : e?.message || 'Unknown error';
    notifyError(msg);
    throw new Error(msg);
  }
}

// ─── API: auto-switches between Tauri IPC and HTTP ───
export const api = IS_TAURI
  ? {
      // Projects
      getProjects: () => tauriCall('get_projects'),
      getProjectsSummary: () => tauriCall('get_projects_summary'),
      getProject: (id) => tauriCall('get_project', { id }),
      createProject: (data) => tauriCall('create_project', data),
      updateProject: (id, data) => tauriCall('update_project', { id, ...data }),
      deleteProject: (id) => tauriCall('delete_project', { id }),
      getProjectGroups: () => tauriCall('get_project_groups'),

      // Tasks
      getTasks: (projectId) => tauriCall('get_tasks', { projectId }),
      getTask: (id) => tauriCall('get_task', { id }),
      createTask: (projectId, data) => tauriCall('create_task', { projectId, ...data }),
      updateTask: (id, data) => tauriCall('update_task', { id, ...data }),
      updateStatus: (id, status) => tauriCall('change_task_status', { id, status, mcpPort: MCP_PORT }),
      deleteTask: (id) => tauriCall('delete_task', { id }),
      getTaskLogs: (id, limit = 500) => tauriCall('get_task_logs', { id, limit }),
      stopTask: (id) => tauriCall('stop_task', { id }),
      restartTask: (id) => tauriCall('restart_task', { id, mcpPort: MCP_PORT }),
      requestChanges: (id, feedback) => tauriCall('request_changes', { id, feedback, mcpPort: MCP_PORT }),
      getRevisions: (id) => tauriCall('get_revisions', { id }),
      getTaskDetail: (id) => tauriCall('get_task_detail', { id }),
      reorderQueue: (projectId, taskIds) => tauriCall('reorder_queue', { projectId, taskIds }),
      setTaskDependency: (id, dependsOn) => tauriCall('set_task_dependency', { id, dependsOn }),
      getPipelineStatus: (projectId) => tauriCall('get_pipeline_status', { projectId }),

      // Planning
      startPlanning: (projectId, data) => tauriCall('start_planning', { projectId, ...data }),
      approvePlan: (projectId, tasks, model) => tauriCall('approve_plan', { projectId, tasks, model }),
      cancelPlanning: (projectId) => tauriCall('cancel_planning', { projectId }),
      getPlanningStatus: (projectId) => tauriCall('get_planning_status', { projectId }),

      // Stats & Activity
      getStats: (projectId) => tauriCall('get_project_stats', { projectId }),
      getActivity: (projectId, limit = 50, offset = 0) =>
        tauriCall('get_activity', { projectId, limit, offset }),
      getClaudeUsage: () => tauriCall('get_claude_usage'),

      // CLAUDE.md
      getClaudeMd: (projectId) => tauriCall('get_claude_md', { projectId }),
      saveClaudeMd: (projectId, content) => tauriCall('save_claude_md', { projectId, content }),

      // Snippets
      getSnippets: (projectId) => tauriCall('get_snippets', { projectId }),
      createSnippet: (projectId, data) => tauriCall('create_snippet', { projectId, ...data }),
      updateSnippet: (id, data) => tauriCall('update_snippet', { id, ...data }),
      deleteSnippet: (id) => tauriCall('delete_snippet', { id }),

      // Templates
      getTemplates: (projectId) => tauriCall('get_templates', { projectId }),
      createTemplate: (projectId, data) => tauriCall('create_template', { projectId, ...data }),
      updateTemplate: (id, data) => tauriCall('update_template', { id, ...data }),
      deleteTemplate: (id) => tauriCall('delete_template', { id }),

      // Attachments — file upload needs special handling in Tauri
      uploadAttachments: async (taskId, files) => {
        const results = [];
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const fileData = Array.from(new Uint8Array(arrayBuffer));
          const result = await tauriCall('upload_attachment', {
            taskId,
            fileData,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
          });
          results.push(result);
        }
        return results;
      },
      getAttachments: (taskId) => tauriCall('get_attachments', { taskId }),
      deleteAttachment: (id) => tauriCall('delete_attachment', { id }),

      // Roles
      getRoles: (projectId) => tauriCall('get_roles', { projectId }),
      getGlobalRoles: () => tauriCall('get_global_roles'),
      createRole: (projectId, data) => tauriCall('create_role', { projectId, ...data }),
      updateRole: (id, data) => tauriCall('update_role', { id, ...data }),
      deleteRole: (id) => tauriCall('delete_role', { id }),

      // Webhooks
      getWebhooks: (projectId) => tauriCall('get_webhooks', { projectId }),
      createWebhook: (projectId, data) => tauriCall('create_webhook', { projectId, ...data }),
      updateWebhook: (id, data) => tauriCall('update_webhook', { id, ...data }),
      deleteWebhook: (id) => tauriCall('delete_webhook', { id }),
      testWebhook: (id) => tauriCall('test_webhook', { id }),

      // Auth
      getAuthStatus: () => tauriCall('get_auth_status'),
      enableAuth: () => tauriCall('enable_auth'),
      disableAuth: () => tauriCall('disable_auth'),

      // Claude Manager
      getAuthInfo: () => tauriCall('get_auth_info'),
      listMcpServers: () => tauriCall('list_mcp_servers'),
      addMcpServer: (name, commandStr, args, scope, env) =>
        tauriCall('add_mcp_server', { name, commandStr, args, scope, env }),
      removeMcpServer: (name, scope) => tauriCall('remove_mcp_server', { name, scope }),
      listPlugins: () => tauriCall('list_plugins'),
      installPlugin: (name) => tauriCall('install_plugin', { name }),
      uninstallPlugin: (name) => tauriCall('uninstall_plugin', { name }),
      togglePlugin: (name, enabled) => tauriCall('toggle_plugin', { name, enabled }),
      listMarketplaces: () => tauriCall('list_marketplaces'),
      addMarketplace: (source, scope) => tauriCall('add_marketplace', { source, scope }),
      removeMarketplace: (name) => tauriCall('remove_marketplace', { name }),
      getClaudeSettings: () => tauriCall('get_claude_settings'),
      saveClaudeSettings: (settings) => tauriCall('save_claude_settings', { settings }),
      listAgents: () => tauriCall('list_agents'),
      getClaudeVersion: () => tauriCall('get_claude_version'),
      updateClaudeCli: () => tauriCall('update_claude_cli'),
      getHooks: () => tauriCall('get_hooks'),
      saveHooks: (hooks) => tauriCall('save_hooks', { hooks }),
      listSessions: () => tauriCall('list_sessions'),
      getPermissionRules: () => tauriCall('get_permission_rules'),
      scanCodebase: (projectId, mode = 'overwrite') => tauriCall('scan_codebase', { projectId, mode }),
      saveScanResult: (projectId, content, mode = 'overwrite') => tauriCall('save_scan_result', { projectId, content, mode }),
      getSuggestions: () => tauriCall('get_suggestions'),
      // Custom Commands & Skills
      listCustomCommands: () => tauriCall('list_custom_commands'),
      listCustomSkills: () => tauriCall('list_custom_skills'),
    }
  : {
      // ─── HTTP mode (web / Node.js server) ───
      getProjects: () => request('/api/projects'),
      getProjectsSummary: () => request('/api/projects/summary'),
      getProject: (id) => request(`/api/projects/${id}`),
      createProject: (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
      updateProject: (id, data) =>
        request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteProject: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),

      getTasks: (projectId) => request(`/api/projects/${projectId}/tasks`),
      getTask: (id) => request(`/api/tasks/${id}`),
      createTask: (projectId, data) =>
        request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
      updateTask: (id, data) =>
        request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      updateStatus: (id, status) =>
        request(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
      getTaskLogs: (id, limit = 500) => request(`/api/tasks/${id}/logs?limit=${limit}`),
      stopTask: (id) => request(`/api/tasks/${id}/stop`, { method: 'POST' }),
      restartTask: (id) => request(`/api/tasks/${id}/restart`, { method: 'POST' }),
      requestChanges: (id, feedback) =>
        request(`/api/tasks/${id}/request-changes`, {
          method: 'POST',
          body: JSON.stringify({ feedback }),
        }),
      getRevisions: (id) => request(`/api/tasks/${id}/revisions`),
      getTaskDetail: (id) => request(`/api/tasks/${id}/detail`),

      startPlanning: (projectId, data) =>
        request(`/api/projects/${projectId}/plan`, { method: 'POST', body: JSON.stringify(data) }),
      cancelPlanning: (projectId) =>
        request(`/api/projects/${projectId}/plan/cancel`, { method: 'POST' }),
      getPlanningStatus: (projectId) => request(`/api/projects/${projectId}/plan/status`),

      getStats: (projectId) => request(`/api/projects/${projectId}/stats`),
      getActivity: (projectId, limit = 50, offset = 0) =>
        request(`/api/projects/${projectId}/activity?limit=${limit}&offset=${offset}`),
      getClaudeUsage: () => request('/api/stats/claude-usage'),

      getClaudeMd: (projectId) => request(`/api/projects/${projectId}/claude-md`),
      saveClaudeMd: (projectId, content) =>
        request(`/api/projects/${projectId}/claude-md`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        }),

      getSnippets: (projectId) => request(`/api/projects/${projectId}/snippets`),
      createSnippet: (projectId, data) =>
        request(`/api/projects/${projectId}/snippets`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateSnippet: (id, data) =>
        request(`/api/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteSnippet: (id) => request(`/api/snippets/${id}`, { method: 'DELETE' }),

      getTemplates: (projectId) => request(`/api/projects/${projectId}/templates`),
      createTemplate: (projectId, data) =>
        request(`/api/projects/${projectId}/templates`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateTemplate: (id, data) =>
        request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),

      uploadAttachments: async (taskId, files) => {
        const formData = new FormData();
        for (const file of files) formData.append('files', file);
        const res = await fetch(`${BASE}/api/tasks/${taskId}/attachments`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      },
      getAttachments: (taskId) => request(`/api/tasks/${taskId}/attachments`),
      deleteAttachment: (id) => request(`/api/attachments/${id}`, { method: 'DELETE' }),

      getRoles: (projectId) => request(`/api/projects/${projectId}/roles`),
      getGlobalRoles: () => request('/api/roles/global'),
      createRole: (projectId, data) =>
        request(`/api/projects/${projectId}/roles`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateRole: (id, data) =>
        request(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteRole: (id) => request(`/api/roles/${id}`, { method: 'DELETE' }),

      getWebhooks: (projectId) => request(`/api/projects/${projectId}/webhooks`),
      createWebhook: (projectId, data) =>
        request(`/api/projects/${projectId}/webhooks`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateWebhook: (id, data) =>
        request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteWebhook: (id) => request(`/api/webhooks/${id}`, { method: 'DELETE' }),
      testWebhook: (id) => request(`/api/webhooks/${id}/test`, { method: 'POST' }),

      getAuthStatus: () => request('/api/auth/status'),
      enableAuth: () => request('/api/auth/enable', { method: 'POST' }),
      disableAuth: () => request('/api/auth/disable', { method: 'POST' }),
    };

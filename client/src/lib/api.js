// Detect Tauri environment
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

let invoke;
if (IS_TAURI) {
  invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);
}

// MCP HTTP port (used by Tauri backend for Claude runner)
const MCP_PORT = parseInt(import.meta.env.VITE_MCP_PORT || '4000', 10);

// ─── HTTP fallback (web mode / dev) ───
const BASE = import.meta.env.DEV ? `http://localhost:${MCP_PORT}` : '';

const errorListeners = new Set();
export function onApiError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}
export function notifyError(msg) {
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
    if (res.status >= 400) notifyError(msg);
    throw new Error(msg);
  }
  return res.json();
}

async function tauriCall(cmd, args = {}) {
  try {
    return await invoke(cmd, args);
  } catch (e) {
    const msg = typeof e === 'string' ? e : e?.message || 'Unknown error';
    notifyError(msg);
    throw new Error(msg);
  }
}

// ─── Unified dispatch: define each method once ───
function call(cmd, method, path, tauriArgs = {}, httpBody) {
  if (IS_TAURI) return tauriCall(cmd, tauriArgs);
  const opts = { method };
  if (httpBody !== undefined) opts.body = JSON.stringify(httpBody);
  return request(path, opts);
}

export const api = {
  // ─── Projects ───
  getProjects: () => call('get_projects', 'GET', '/api/projects'),
  getProjectsSummary: () => call('get_projects_summary', 'GET', '/api/projects/summary'),
  getProject: (id) => call('get_project', 'GET', `/api/projects/${id}`, { id }),
  createProject: (data) => call('create_project', 'POST', '/api/projects', data, data),
  updateProject: (id, data) => call('update_project', 'PUT', `/api/projects/${id}`, { id, ...data }, data),
  deleteProject: (id) => call('delete_project', 'DELETE', `/api/projects/${id}`, { id }),

  // ─── Tasks ───
  getTasks: (projectId) => call('get_tasks', 'GET', `/api/projects/${projectId}/tasks`, { projectId }),
  getTask: (id) => call('get_task', 'GET', `/api/tasks/${id}`, { id }),
  createTask: (projectId, data) =>
    call('create_task', 'POST', `/api/projects/${projectId}/tasks`, { projectId, ...data }, data),
  updateTask: (id, data) => call('update_task', 'PUT', `/api/tasks/${id}`, { id, ...data }, data),
  updateStatus: (id, status) =>
    call('change_task_status', 'PATCH', `/api/tasks/${id}/status`, { id, status, mcpPort: MCP_PORT }, { status }),
  deleteTask: (id) => call('delete_task', 'DELETE', `/api/tasks/${id}`, { id }),
  getTaskLogs: (id, limit = 500) => call('get_task_logs', 'GET', `/api/tasks/${id}/logs?limit=${limit}`, { id, limit }),
  stopTask: (id) => call('stop_task', 'POST', `/api/tasks/${id}/stop`, { id }),
  restartTask: (id) => call('restart_task', 'POST', `/api/tasks/${id}/restart`, { id, mcpPort: MCP_PORT }),
  requestChanges: (id, feedback) =>
    call(
      'request_changes',
      'POST',
      `/api/tasks/${id}/request-changes`,
      { id, feedback, mcpPort: MCP_PORT },
      { feedback },
    ),
  getRevisions: (id) => call('get_revisions', 'GET', `/api/tasks/${id}/revisions`, { id }),
  getTaskDetail: (id) => call('get_task_detail', 'GET', `/api/tasks/${id}/detail`, { id }),

  // ─── Planning ───
  startPlanning: (projectId, data) =>
    call('start_planning', 'POST', `/api/projects/${projectId}/plan`, { projectId, ...data }, data),
  cancelPlanning: (projectId) =>
    call('cancel_planning', 'POST', `/api/projects/${projectId}/plan/cancel`, { projectId }),
  getPlanningStatus: (projectId) =>
    call('get_planning_status', 'GET', `/api/projects/${projectId}/plan/status`, { projectId }),

  // ─── Stats & Activity ───
  getStats: (projectId) => call('get_project_stats', 'GET', `/api/projects/${projectId}/stats`, { projectId }),
  getActivity: (projectId, limit = 50, offset = 0) =>
    call('get_activity', 'GET', `/api/projects/${projectId}/activity?limit=${limit}&offset=${offset}`, {
      projectId,
      limit,
      offset,
    }),
  getClaudeUsage: () => call('get_claude_usage', 'GET', '/api/stats/claude-usage'),

  // ─── CLAUDE.md ───
  getClaudeMd: (projectId) => call('get_claude_md', 'GET', `/api/projects/${projectId}/claude-md`, { projectId }),
  saveClaudeMd: (projectId, content) =>
    call('save_claude_md', 'PUT', `/api/projects/${projectId}/claude-md`, { projectId, content }, { content }),

  // ─── Snippets ───
  getSnippets: (projectId) => call('get_snippets', 'GET', `/api/projects/${projectId}/snippets`, { projectId }),
  createSnippet: (projectId, data) =>
    call('create_snippet', 'POST', `/api/projects/${projectId}/snippets`, { projectId, ...data }, data),
  updateSnippet: (id, data) => call('update_snippet', 'PUT', `/api/snippets/${id}`, { id, ...data }, data),
  deleteSnippet: (id) => call('delete_snippet', 'DELETE', `/api/snippets/${id}`, { id }),

  // ─── Templates ───
  getTemplates: (projectId) => call('get_templates', 'GET', `/api/projects/${projectId}/templates`, { projectId }),
  createTemplate: (projectId, data) =>
    call('create_template', 'POST', `/api/projects/${projectId}/templates`, { projectId, ...data }, data),
  updateTemplate: (id, data) => call('update_template', 'PUT', `/api/templates/${id}`, { id, ...data }, data),
  deleteTemplate: (id) => call('delete_template', 'DELETE', `/api/templates/${id}`, { id }),

  // ─── Attachments ───
  uploadAttachments: IS_TAURI
    ? async (taskId, files) => {
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
      }
    : async (taskId, files) => {
        const formData = new FormData();
        for (const file of files) formData.append('files', file);
        const res = await fetch(`${BASE}/api/tasks/${taskId}/attachments`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      },
  getAttachments: (taskId) => call('get_attachments', 'GET', `/api/tasks/${taskId}/attachments`, { taskId }),
  deleteAttachment: (id) => call('delete_attachment', 'DELETE', `/api/attachments/${id}`, { id }),

  // ─── Roles ───
  getRoles: (projectId) => call('get_roles', 'GET', `/api/projects/${projectId}/roles`, { projectId }),
  getGlobalRoles: () => call('get_global_roles', 'GET', '/api/roles/global'),
  createRole: (projectId, data) =>
    call('create_role', 'POST', `/api/projects/${projectId}/roles`, { projectId, ...data }, data),
  updateRole: (id, data) => call('update_role', 'PUT', `/api/roles/${id}`, { id, ...data }, data),
  deleteRole: (id) => call('delete_role', 'DELETE', `/api/roles/${id}`, { id }),

  // ─── Webhooks ───
  getWebhooks: (projectId) => call('get_webhooks', 'GET', `/api/projects/${projectId}/webhooks`, { projectId }),
  createWebhook: (projectId, data) =>
    call('create_webhook', 'POST', `/api/projects/${projectId}/webhooks`, { projectId, ...data }, data),
  updateWebhook: (id, data) => call('update_webhook', 'PUT', `/api/webhooks/${id}`, { id, ...data }, data),
  deleteWebhook: (id) => call('delete_webhook', 'DELETE', `/api/webhooks/${id}`, { id }),
  testWebhook: (id) => call('test_webhook', 'POST', `/api/webhooks/${id}/test`, { id }),

  // ─── Auth ───
  getAuthStatus: () => call('get_auth_status', 'GET', '/api/auth/status'),
  enableAuth: () => call('enable_auth', 'POST', '/api/auth/enable'),
  disableAuth: () => call('disable_auth', 'POST', '/api/auth/disable'),

  // ─── App Settings ───
  getAppSettings: () => call('get_app_settings', 'GET', '/api/settings'),
  updateAppSettings: (data) => call('update_app_settings', 'PUT', '/api/settings', { data }, data),

  // ─── GitHub Issues sync ───
  githubDetectRepo: (workingDir) =>
    call('github_detect_repo', 'POST', '/api/github/detect-repo', { workingDir }, { workingDir }),
  githubCheckStatus: (repo) => call('github_check_status', 'POST', '/api/github/check-status', { repo }, { repo }),
  githubFetchIssues: (projectId) =>
    call('github_fetch_issues', 'POST', `/api/projects/${projectId}/github/issues`, { projectId }, {}),
  githubImportIssues: (projectId, issueNumbers) =>
    call(
      'github_import_issues',
      'POST',
      `/api/projects/${projectId}/github/import`,
      { projectId, issueNumbers },
      { issueNumbers },
    ),
  githubCloseIssue: (projectId, taskId) =>
    call('github_close_issue', 'POST', `/api/projects/${projectId}/github/close`, { projectId, taskId }, { taskId }),

  // ─── Tauri-only: Claude Manager & extended features ───
  ...(IS_TAURI
    ? {
        getProjectGroups: () => tauriCall('get_project_groups'),
        reorderQueue: (projectId, taskIds) => tauriCall('reorder_queue', { projectId, taskIds }),
        setTaskDependency: (id, dependsOn) => tauriCall('set_task_dependency', { id, dependsOn }),
        addDependency: (taskId, dependsOnId, conditionType) =>
          tauriCall('add_task_dependency', {
            taskId: Number(taskId),
            dependsOnId: Number(dependsOnId),
            conditionType: conditionType || null,
          }),
        removeDependency: (taskId, dependsOnId) =>
          tauriCall('remove_task_dependency', { taskId: Number(taskId), dependsOnId: Number(dependsOnId) }),
        getTaskDependencies: (taskId) => tauriCall('get_task_dependencies', { taskId: Number(taskId) }),
        getTaskEvents: (taskId, limit = 500) => tauriCall('get_task_events', { taskId: Number(taskId), limit }),
        getExecutionWaves: (projectId) => tauriCall('get_execution_waves', { projectId }),
        getDependencyGraph: (projectId) => tauriCall('get_dependency_graph', { projectId }),
        getPipelineStatus: (projectId) => tauriCall('get_pipeline_status', { projectId }),
        getActiveFileMap: () => tauriCall('get_active_file_map'),
        getAgentActivity: (projectId) => tauriCall('get_agent_activity', { projectId }),
        getTaskDiff: (taskId) => tauriCall('get_task_diff', { taskId: Number(taskId) }),
        approvePlan: (projectId, tasks, model, dependencies, topic) =>
          tauriCall('approve_plan', { projectId, tasks, model, dependencies, topic }),
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
        prescanStats: (projectId) => tauriCall('prescan_stats', { projectId }),
        scanCodebase: (projectId, scanType = 'detailed', customPrompt = null) =>
          tauriCall('scan_codebase', { projectId, scanType, customPrompt }),
        saveScanResult: (projectId, content, scanType = null, mode = 'overwrite') =>
          tauriCall('save_scan_result', { projectId, content, scanType, mode }),
        getScanHistory: (projectId) => tauriCall('get_scan_history', { projectId }),
        getScanDetail: (id) => tauriCall('get_scan_detail', { id }),
        deleteScan: (id) => tauriCall('delete_scan', { id }),
        getSuggestions: () => tauriCall('get_suggestions'),
        listCustomCommands: () => tauriCall('list_custom_commands'),
        listCustomSkills: () => tauriCall('list_custom_skills'),
        saveCustomSkill: (name, content) => tauriCall('save_custom_skill', { name, content }),
        deleteCustomSkill: (name) => tauriCall('delete_custom_skill', { name }),
        fetchGithubSkills: (repoUrl, path) => tauriCall('fetch_github_skills', { repoUrl, path: path || null }),
        fetchSkillContent: (url) => tauriCall('fetch_skill_content', { url }),
        // ─── Workflow Templates ───
        getWorkflowTemplates: (projectId) => tauriCall('get_workflow_templates', { projectId }),
        createWorkflowTemplate: (projectId, name, description, steps) =>
          tauriCall('create_workflow_template', { projectId, name, description, steps }),
        updateWorkflowTemplate: (id, name, description, steps) =>
          tauriCall('update_workflow_template', { id, name, description, steps }),
        deleteWorkflowTemplate: (id) => tauriCall('delete_workflow_template', { id }),
        applyWorkflowTemplate: (templateId, projectId) =>
          tauriCall('apply_workflow_template', { templateId, projectId }),
        // ─── Circuit Breaker ───
        resetCircuitBreaker: (id) => tauriCall('reset_circuit_breaker', { id }),
      }
    : {}),
};

import { queryAll, queryOne, run } from './connection.js';

const TYPE_PREFIXES = { feature: 'FTR', bugfix: 'BUG', refactor: 'RFT', docs: 'DOC', test: 'TST', chore: 'CHR' };

export function generateTaskKey(projectId, taskType) {
  // Increment counter
  run('UPDATE projects SET task_counter=COALESCE(task_counter,1000)+1 WHERE id=?', [projectId]);
  const project = queryOne('SELECT project_key, task_counter FROM projects WHERE id=?', [projectId]);
  const prefix = TYPE_PREFIXES[taskType] || 'TSK';
  const pKey = project?.project_key || 'PRJ';
  const counter = project?.task_counter || 1001;
  return `${prefix}-${pKey}-${counter}`;
}

export const queries = {
  // CRUD
  getTasksByProject: {
    all: (pid) => queryAll('SELECT * FROM tasks WHERE project_id=? ORDER BY status,sort_order,id', [pid]),
  },
  getTaskById: { get: (id) => queryOne('SELECT * FROM tasks WHERE id=?', [id]) },
  createTask: {
    run: (pid, title, desc, priority, type, criteria, model, effort, roleId = null) => {
      const taskKey = generateTaskKey(pid, type || 'feature');
      return run(
        'INSERT INTO tasks (project_id,title,description,priority,task_type,acceptance_criteria,model,thinking_effort,role_id,task_key) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [
          pid,
          title,
          desc,
          priority,
          type || 'feature',
          criteria || '',
          model || 'sonnet',
          effort || 'medium',
          roleId,
          taskKey,
        ],
      );
    },
  },
  updateTask: {
    run: (title, desc, priority, type, criteria, model, effort, roleId, id) => {
      // If task_type changed, update the prefix in task_key
      const existing = queryOne('SELECT task_type, task_key FROM tasks WHERE id=?', [id]);
      const newType = type || 'feature';
      let keyUpdate = '';
      const params = [title, desc, priority, newType, criteria || '', model || 'sonnet', effort || 'medium', roleId];
      if (existing && existing.task_type !== newType && existing.task_key) {
        const oldPrefix = TYPE_PREFIXES[existing.task_type] || 'TSK';
        const newPrefix = TYPE_PREFIXES[newType] || 'TSK';
        const newKey = existing.task_key.replace(oldPrefix, newPrefix);
        keyUpdate = ',task_key=?';
        params.push(newKey);
      }
      params.push(id);
      return run(
        `UPDATE tasks SET title=?,description=?,priority=?,task_type=?,acceptance_criteria=?,model=?,thinking_effort=?,role_id=?${keyUpdate},updated_at=datetime('now','localtime') WHERE id=?`,
        params,
      );
    },
  },
  deleteTask: { run: (id) => run('DELETE FROM tasks WHERE id=?', [id]) },

  // Status & time tracking
  updateTaskStatus: {
    run: (status, id) =>
      run("UPDATE tasks SET status=?,updated_at=datetime('now','localtime') WHERE id=?", [status, id]),
  },
  setTaskStarted: {
    run: (id) =>
      run(
        "UPDATE tasks SET started_at=datetime('now','localtime'),last_resumed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?",
        [id],
      ),
  },
  setTaskResumed: {
    run: (id) =>
      run(
        "UPDATE tasks SET last_resumed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?",
        [id],
      ),
  },
  pauseTaskTimer: {
    run: (id) =>
      run(
        `UPDATE tasks SET work_duration_ms=COALESCE(work_duration_ms,0)+CAST((julianday('now','localtime')-julianday(last_resumed_at))*86400000 AS INTEGER),last_resumed_at=NULL,updated_at=datetime('now','localtime') WHERE id=? AND last_resumed_at IS NOT NULL`,
        [id],
      ),
  },
  setTaskCompleted: {
    run: (id) =>
      run(
        "UPDATE tasks SET completed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?",
        [id],
      ),
  },
  finalizeTaskTimer: {
    run: (id) =>
      run(
        `UPDATE tasks SET work_duration_ms=COALESCE(work_duration_ms,0)+CASE WHEN last_resumed_at IS NOT NULL THEN CAST((julianday('now','localtime')-julianday(last_resumed_at))*86400000 AS INTEGER) ELSE 0 END,last_resumed_at=NULL,completed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?`,
        [id],
      ),
  },

  // Usage tracking
  setTaskUsageLive: {
    run: (input, output, cacheRead, cacheCreation, cost, model, id) =>
      run(
        `UPDATE tasks SET input_tokens=?,output_tokens=?,cache_read_tokens=?,cache_creation_tokens=?,total_cost=?,model_used=?,updated_at=datetime('now','localtime') WHERE id=?`,
        [input, output, cacheRead, cacheCreation, cost, model, id],
      ),
  },
  updateTaskNumTurns: {
    run: (turns, id) =>
      run("UPDATE tasks SET num_turns=?,updated_at=datetime('now','localtime') WHERE id=?", [turns, id]),
  },
  incrementRateLimitHits: {
    run: (id) =>
      run(
        "UPDATE tasks SET rate_limit_hits=COALESCE(rate_limit_hits,0)+1,updated_at=datetime('now','localtime') WHERE id=?",
        [id],
      ),
  },
  updateTaskClaudeSession: {
    run: (sid, id) =>
      run("UPDATE tasks SET claude_session_id=?,updated_at=datetime('now','localtime') WHERE id=?", [sid, id]),
  },
  updateTaskBranch: {
    run: (branchName, id) =>
      run("UPDATE tasks SET branch_name=?,updated_at=datetime('now','localtime') WHERE id=?", [branchName, id]),
  },
  updateTaskGitInfo: {
    run: (commits, prUrl, diffStat, id) =>
      run("UPDATE tasks SET commits=?,pr_url=?,diff_stat=?,updated_at=datetime('now','localtime') WHERE id=?", [
        JSON.stringify(commits),
        prUrl,
        diffStat,
        id,
      ]),
  },

  // Logs
  getRecentTaskLogs: {
    all: (tid, limit) =>
      queryAll('SELECT * FROM task_logs WHERE task_id=? ORDER BY id DESC LIMIT ?', [tid, limit]).map((row) => ({
        ...row,
        meta: row.meta ? JSON.parse(row.meta) : null,
      })),
  },
  addTaskLog: {
    run: (tid, msg, type, meta = null) =>
      run('INSERT INTO task_logs (task_id,message,log_type,meta) VALUES (?,?,?,?)', [
        tid,
        msg,
        type,
        meta ? JSON.stringify(meta) : null,
      ]),
  },
  clearTaskLogs: { run: (tid) => run('DELETE FROM task_logs WHERE task_id=?', [tid]) },

  // Revisions
  addRevision: {
    run: (tid, num, feedback) =>
      run('INSERT INTO task_revisions (task_id,revision_number,feedback) VALUES (?,?,?)', [tid, num, feedback]),
  },
  getRevisions: {
    all: (tid) => queryAll('SELECT * FROM task_revisions WHERE task_id=? ORDER BY revision_number ASC', [tid]),
  },
  incrementRevisionCount: {
    run: (id) =>
      run(
        "UPDATE tasks SET revision_count=COALESCE(revision_count,0)+1,updated_at=datetime('now','localtime') WHERE id=?",
        [id],
      ),
  },

  // Queue
  getNextQueuedTask: (pid) =>
    queryOne(
      "SELECT * FROM tasks WHERE project_id=? AND status='backlog' ORDER BY priority DESC,queue_position ASC,id ASC LIMIT 1",
      [pid],
    ),
  getRunningCount: (pid) => {
    const r = queryOne("SELECT COUNT(*) as count FROM tasks WHERE project_id=? AND status='in_progress'", [pid]);
    return r?.count || 0;
  },
};

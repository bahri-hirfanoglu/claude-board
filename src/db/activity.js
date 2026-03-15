import { queryAll, run } from './connection.js';

export const activityLog = {
  add: (projectId, taskId, eventType, message, metadata = {}) => {
    try {
      return run('INSERT INTO activity_log (project_id,task_id,event_type,message,metadata) VALUES (?,?,?,?,?)', [
        projectId,
        taskId,
        eventType,
        message,
        JSON.stringify(metadata),
      ]);
    } catch (e) {
      console.error('[Activity]', e.message);
    }
  },
  getByProject: (projectId, limit = 50, offset = 0) => {
    return queryAll(
      `SELECT a.*, t.title as task_title FROM activity_log a LEFT JOIN tasks t ON a.task_id=t.id
       WHERE a.project_id=? ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [projectId, limit, offset],
    ).map((r) => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
  },
  getByTask: (taskId, limit = 30) => {
    return queryAll('SELECT * FROM activity_log WHERE task_id=? ORDER BY id DESC LIMIT ?', [taskId, limit]).map(
      (r) => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }),
    );
  },
};

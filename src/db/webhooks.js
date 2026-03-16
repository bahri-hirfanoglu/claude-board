import { queryAll, queryOne, run } from './connection.js';

export const webhookQueries = {
  getByProject: (projectId) =>
    queryAll('SELECT * FROM webhooks WHERE project_id=? ORDER BY created_at DESC', [projectId]).map((w) => ({
      ...w,
      events: JSON.parse(w.events || '[]'),
    })),

  getById: (id) => {
    const w = queryOne('SELECT * FROM webhooks WHERE id=?', [id]);
    if (w) w.events = JSON.parse(w.events || '[]');
    return w;
  },

  getEnabledByProject: (projectId) =>
    queryAll('SELECT * FROM webhooks WHERE project_id=? AND enabled=1', [projectId]).map((w) => ({
      ...w,
      events: JSON.parse(w.events || '[]'),
    })),

  create: (projectId, name, url, platform, events) =>
    run('INSERT INTO webhooks (project_id,name,url,platform,events) VALUES (?,?,?,?,?)', [
      projectId,
      name,
      url,
      platform || 'custom',
      JSON.stringify(events || []),
    ]),

  update: (id, name, url, platform, events, enabled) =>
    run(
      "UPDATE webhooks SET name=?,url=?,platform=?,events=?,enabled=?,updated_at=datetime('now','localtime') WHERE id=?",
      [name, url, platform || 'custom', JSON.stringify(events || []), enabled ? 1 : 0, id],
    ),

  delete: (id) => run('DELETE FROM webhooks WHERE id=?', [id]),
};

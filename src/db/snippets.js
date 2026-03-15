import { queryAll, queryOne, run } from './connection.js';

export const snippetQueries = {
  getByProject: (pid) => queryAll('SELECT * FROM context_snippets WHERE project_id=? ORDER BY sort_order,id', [pid]),
  getEnabledByProject: (pid) => queryAll('SELECT * FROM context_snippets WHERE project_id=? AND enabled=1 ORDER BY sort_order,id', [pid]),
  getById: (id) => queryOne('SELECT * FROM context_snippets WHERE id=?', [id]),
  create: (pid, title, content) => run(
    'INSERT INTO context_snippets (project_id,title,content) VALUES (?,?,?)', [pid, title, content]
  ),
  update: (id, title, content, enabled) => run(
    "UPDATE context_snippets SET title=?,content=?,enabled=?,updated_at=datetime('now','localtime') WHERE id=?",
    [title, content, enabled ? 1 : 0, id]
  ),
  delete: (id) => run('DELETE FROM context_snippets WHERE id=?', [id]),
};

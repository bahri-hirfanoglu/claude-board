import { queryAll, queryOne, run } from './connection.js';

export const roleQueries = {
  getByProject: (pid) =>
    queryAll('SELECT * FROM roles WHERE project_id=? OR project_id IS NULL ORDER BY project_id IS NULL, name', [pid]),
  getGlobal: () => queryAll('SELECT * FROM roles WHERE project_id IS NULL ORDER BY name'),
  getById: (id) => queryOne('SELECT * FROM roles WHERE id=?', [id]),
  create: (pid, name, description, prompt, color) =>
    run('INSERT INTO roles (project_id,name,description,prompt,color) VALUES (?,?,?,?,?)', [
      pid,
      name,
      description,
      prompt,
      color,
    ]),
  update: (id, name, description, prompt, color) =>
    run("UPDATE roles SET name=?,description=?,prompt=?,color=?,updated_at=datetime('now','localtime') WHERE id=?", [
      name,
      description,
      prompt,
      color,
      id,
    ]),
  delete: (id) => run('DELETE FROM roles WHERE id=?', [id]),
};

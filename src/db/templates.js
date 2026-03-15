import { queryAll, queryOne, run } from './connection.js';

export const templateQueries = {
  getByProject: (pid) => queryAll('SELECT * FROM prompt_templates WHERE project_id=? ORDER BY id', [pid]),
  getById: (id) => queryOne('SELECT * FROM prompt_templates WHERE id=?', [id]),
  create: (pid, name, description, template, variables, task_type, model, thinking_effort) =>
    run(
      'INSERT INTO prompt_templates (project_id,name,description,template,variables,task_type,model,thinking_effort) VALUES (?,?,?,?,?,?,?,?)',
      [
        pid,
        name,
        description,
        template,
        variables,
        task_type || 'feature',
        model || 'sonnet',
        thinking_effort || 'medium',
      ],
    ),
  update: (id, name, description, template, variables, task_type, model, thinking_effort) =>
    run(
      "UPDATE prompt_templates SET name=?,description=?,template=?,variables=?,task_type=?,model=?,thinking_effort=?,updated_at=datetime('now','localtime') WHERE id=?",
      [name, description, template, variables, task_type, model, thinking_effort, id],
    ),
  delete: (id) => run('DELETE FROM prompt_templates WHERE id=?', [id]),
};

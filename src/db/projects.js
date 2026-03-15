import { queryAll, queryOne, run } from './connection.js';

export const projectQueries = {
  getAll: () => queryAll('SELECT * FROM projects ORDER BY name'),
  getById: (id) => queryOne('SELECT * FROM projects WHERE id = ?', [id]),
  getBySlug: (slug) => queryOne('SELECT * FROM projects WHERE slug = ?', [slug]),
  create: (name, slug, workingDir, icon, iconSeed, permissionMode, allowedTools) =>
    run(
      'INSERT INTO projects (name,slug,working_dir,icon,icon_seed,permission_mode,allowed_tools) VALUES (?,?,?,?,?,?,?)',
      [name, slug, workingDir, icon || 'marble', iconSeed || '', permissionMode || 'auto-accept', allowedTools || ''],
    ),
  update: (id, name, slug, workingDir, icon, iconSeed, permissionMode, allowedTools) =>
    run(
      "UPDATE projects SET name=?,slug=?,working_dir=?,icon=?,icon_seed=?,permission_mode=?,allowed_tools=?,updated_at=datetime('now','localtime') WHERE id=?",
      [
        name,
        slug,
        workingDir,
        icon || 'marble',
        iconSeed || '',
        permissionMode || 'auto-accept',
        allowedTools || '',
        id,
      ],
    ),
  updateQueue: (id, autoQueue, maxConcurrent) =>
    run("UPDATE projects SET auto_queue=?,max_concurrent=?,updated_at=datetime('now','localtime') WHERE id=?", [
      autoQueue ? 1 : 0,
      maxConcurrent || 1,
      id,
    ]),
  updateGitSettings: (id, autoBranch, autoPr, prBaseBranch) =>
    run(
      "UPDATE projects SET auto_branch=?,auto_pr=?,pr_base_branch=?,updated_at=datetime('now','localtime') WHERE id=?",
      [autoBranch ? 1 : 0, autoPr ? 1 : 0, prBaseBranch || 'main', id],
    ),
  delete: (id) => run('DELETE FROM projects WHERE id = ?', [id]),
  getSummary: () =>
    queryAll(
      `SELECT p.*, COUNT(t.id) as total_tasks,
       COUNT(CASE WHEN t.status='done' THEN 1 END) as done_tasks,
       COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as active_tasks,
       COUNT(CASE WHEN t.status='backlog' THEN 1 END) as backlog_tasks,
       COUNT(CASE WHEN t.status='testing' THEN 1 END) as testing_tasks,
       SUM(COALESCE(t.input_tokens,0)+COALESCE(t.output_tokens,0)) as total_tokens,
       SUM(COALESCE(t.total_cost,0)) as total_cost,
       MAX(t.updated_at) as last_activity
     FROM projects p LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id ORDER BY p.name`,
    ),
};

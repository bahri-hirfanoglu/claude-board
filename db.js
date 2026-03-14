import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'tasks.db');

const SQL = await initSqlJs();

let db;
if (existsSync(DB_PATH)) {
  const buffer = readFileSync(DB_PATH);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

db.run('PRAGMA foreign_keys = ON');

db.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    working_dir TEXT NOT NULL,
    gitlab_token TEXT DEFAULT '',
    gitlab_url TEXT DEFAULT 'https://gitlab.com',
    gitlab_project_ids TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    updated_at DATETIME DEFAULT (datetime('now','localtime'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','testing','done')),
    priority INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    branch_name TEXT,
    pr_url TEXT,
    pr_server_url TEXT,
    pr_client_url TEXT,
    claude_session_id TEXT,
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    updated_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','system')),
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.run('CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)');

function save() {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function run(sql, params = []) {
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
  const lastId = result[0]?.values[0]?.[0] ?? 0;
  save();
  return { lastInsertRowid: Number(lastId) };
}

// ============ Projects ============
export const projectQueries = {
  getAll: () => queryAll('SELECT * FROM projects ORDER BY name'),
  getById: (id) => queryOne('SELECT * FROM projects WHERE id = ?', [id]),
  getBySlug: (slug) => queryOne('SELECT * FROM projects WHERE slug = ?', [slug]),
  create: (name, slug, workingDir, gitlabToken, gitlabUrl, gitlabProjectIds) => run(
    'INSERT INTO projects (name, slug, working_dir, gitlab_token, gitlab_url, gitlab_project_ids) VALUES (?, ?, ?, ?, ?, ?)',
    [name, slug, workingDir, gitlabToken || '', gitlabUrl || 'https://gitlab.com', gitlabProjectIds || '[]']
  ),
  update: (id, name, slug, workingDir, gitlabToken, gitlabUrl, gitlabProjectIds) => run(
    "UPDATE projects SET name = ?, slug = ?, working_dir = ?, gitlab_token = ?, gitlab_url = ?, gitlab_project_ids = ?, updated_at = datetime('now','localtime') WHERE id = ?",
    [name, slug, workingDir, gitlabToken || '', gitlabUrl || 'https://gitlab.com', gitlabProjectIds || '[]', id]
  ),
  delete: (id) => run('DELETE FROM projects WHERE id = ?', [id]),
};

// ============ Tasks ============
export const queries = {
  getAllTasks: {
    all: () => queryAll('SELECT * FROM tasks ORDER BY status, sort_order, id'),
  },
  getTasksByProject: {
    all: (projectId) => queryAll('SELECT * FROM tasks WHERE project_id = ? ORDER BY status, sort_order, id', [projectId]),
  },
  getTaskById: {
    get: (id) => queryOne('SELECT * FROM tasks WHERE id = ?', [id]),
  },
  getTasksByStatus: {
    all: (status) => queryAll('SELECT * FROM tasks WHERE status = ? ORDER BY sort_order, id', [status]),
  },
  createTask: {
    run: (projectId, title, description, priority) => run(
      'INSERT INTO tasks (project_id, title, description, priority) VALUES (?, ?, ?, ?)',
      [projectId, title, description, priority]
    ),
  },
  updateTask: {
    run: (title, description, priority, id) => run(
      "UPDATE tasks SET title = ?, description = ?, priority = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [title, description, priority, id]
    ),
  },
  updateTaskStatus: {
    run: (status, id) => run(
      "UPDATE tasks SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [status, id]
    ),
  },
  updateTaskBranch: {
    run: (branchName, id) => run(
      "UPDATE tasks SET branch_name = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [branchName, id]
    ),
  },
  updateTaskPR: {
    run: (prServerUrl, prClientUrl, id) => run(
      "UPDATE tasks SET pr_server_url = ?, pr_client_url = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [prServerUrl, prClientUrl, id]
    ),
  },
  updateTaskClaudeSession: {
    run: (sessionId, id) => run(
      "UPDATE tasks SET claude_session_id = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [sessionId, id]
    ),
  },
  updateTaskSortOrder: {
    run: (sortOrder, id) => run(
      "UPDATE tasks SET sort_order = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [sortOrder, id]
    ),
  },
  deleteTask: {
    run: (id) => run('DELETE FROM tasks WHERE id = ?', [id]),
  },
  getTaskLogs: {
    all: (taskId) => queryAll('SELECT * FROM task_logs WHERE task_id = ? ORDER BY id ASC', [taskId]),
  },
  getRecentTaskLogs: {
    all: (taskId, limit) => queryAll('SELECT * FROM task_logs WHERE task_id = ? ORDER BY id DESC LIMIT ?', [taskId, limit]),
  },
  addTaskLog: {
    run: (taskId, message, logType) => run(
      'INSERT INTO task_logs (task_id, message, log_type) VALUES (?, ?, ?)',
      [taskId, message, logType]
    ),
  },
  clearTaskLogs: {
    run: (taskId) => run('DELETE FROM task_logs WHERE task_id = ?', [taskId]),
  },
};

save();

export default db;

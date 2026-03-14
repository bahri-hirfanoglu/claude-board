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
    task_type TEXT DEFAULT 'feature' CHECK(task_type IN ('feature','bugfix','refactor','docs','test','chore')),
    acceptance_criteria TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    branch_name TEXT,
    claude_session_id TEXT,
    started_at DATETIME,
    completed_at DATETIME,
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

// Migrations for existing databases
function columnExists(table, column) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return false;
  return result[0].values.some(row => row[1] === column);
}

if (!columnExists('tasks', 'started_at')) {
  db.run('ALTER TABLE tasks ADD COLUMN started_at DATETIME');
}
if (!columnExists('tasks', 'completed_at')) {
  db.run('ALTER TABLE tasks ADD COLUMN completed_at DATETIME');
}
if (!columnExists('tasks', 'task_type')) {
  db.run("ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'feature'");
}
if (!columnExists('tasks', 'acceptance_criteria')) {
  db.run("ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT DEFAULT ''");
}

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
  create: (name, slug, workingDir) => run(
    'INSERT INTO projects (name, slug, working_dir) VALUES (?, ?, ?)',
    [name, slug, workingDir]
  ),
  update: (id, name, slug, workingDir) => run(
    "UPDATE projects SET name = ?, slug = ?, working_dir = ?, updated_at = datetime('now','localtime') WHERE id = ?",
    [name, slug, workingDir, id]
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
    run: (projectId, title, description, priority, taskType, acceptanceCriteria) => run(
      'INSERT INTO tasks (project_id, title, description, priority, task_type, acceptance_criteria) VALUES (?, ?, ?, ?, ?, ?)',
      [projectId, title, description, priority, taskType || 'feature', acceptanceCriteria || '']
    ),
  },
  updateTask: {
    run: (title, description, priority, taskType, acceptanceCriteria, id) => run(
      "UPDATE tasks SET title = ?, description = ?, priority = ?, task_type = ?, acceptance_criteria = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [title, description, priority, taskType || 'feature', acceptanceCriteria || '', id]
    ),
  },
  updateTaskStatus: {
    run: (status, id) => run(
      "UPDATE tasks SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [status, id]
    ),
  },
  setTaskStarted: {
    run: (id) => run(
      "UPDATE tasks SET started_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?",
      [id]
    ),
  },
  setTaskCompleted: {
    run: (id) => run(
      "UPDATE tasks SET completed_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?",
      [id]
    ),
  },
  updateTaskBranch: {
    run: (branchName, id) => run(
      "UPDATE tasks SET branch_name = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [branchName, id]
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

// ============ Stats ============
export const statsQueries = {
  getTasksByStatus: (projectId) => queryAll(
    'SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status',
    [projectId]
  ),
  getTasksByPriority: (projectId) => queryAll(
    'SELECT priority, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY priority',
    [projectId]
  ),
  getTasksByType: (projectId) => queryAll(
    'SELECT task_type, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY task_type',
    [projectId]
  ),
  getAvgDuration: (projectId) => queryOne(
    `SELECT AVG((julianday(completed_at) - julianday(started_at)) * 24 * 60) as avg_minutes,
            MIN((julianday(completed_at) - julianday(started_at)) * 24 * 60) as min_minutes,
            MAX((julianday(completed_at) - julianday(started_at)) * 24 * 60) as max_minutes,
            COUNT(*) as count
     FROM tasks WHERE project_id = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL`,
    [projectId]
  ),
  getCompletionTimeline: (projectId) => queryAll(
    `SELECT date(completed_at) as day, COUNT(*) as count
     FROM tasks WHERE project_id = ? AND completed_at IS NOT NULL
     AND completed_at >= datetime('now', '-14 days')
     GROUP BY date(completed_at) ORDER BY day`,
    [projectId]
  ),
  getRecentCompleted: (projectId) => queryAll(
    `SELECT id, title, task_type, priority, started_at, completed_at,
            ROUND((julianday(completed_at) - julianday(started_at)) * 24 * 60, 1) as duration_minutes
     FROM tasks WHERE project_id = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 10`,
    [projectId]
  ),
};

save();

export default db;

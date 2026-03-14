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
    model TEXT DEFAULT 'sonnet',
    thinking_effort TEXT DEFAULT 'medium',
    sort_order INTEGER DEFAULT 0,
    branch_name TEXT,
    claude_session_id TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    num_turns INTEGER DEFAULT 0,
    rate_limit_hits INTEGER DEFAULT 0,
    model_used TEXT,
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

const migrations = [
  ['projects', 'icon', "ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT 'marble'"],
  ['projects', 'icon_seed', "ALTER TABLE projects ADD COLUMN icon_seed TEXT DEFAULT ''"],
  ['tasks', 'started_at', 'ALTER TABLE tasks ADD COLUMN started_at DATETIME'],
  ['tasks', 'completed_at', 'ALTER TABLE tasks ADD COLUMN completed_at DATETIME'],
  ['tasks', 'task_type', "ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'feature'"],
  ['tasks', 'acceptance_criteria', "ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT DEFAULT ''"],
  ['tasks', 'model', "ALTER TABLE tasks ADD COLUMN model TEXT DEFAULT 'sonnet'"],
  ['tasks', 'thinking_effort', "ALTER TABLE tasks ADD COLUMN thinking_effort TEXT DEFAULT 'medium'"],
  ['tasks', 'input_tokens', 'ALTER TABLE tasks ADD COLUMN input_tokens INTEGER DEFAULT 0'],
  ['tasks', 'output_tokens', 'ALTER TABLE tasks ADD COLUMN output_tokens INTEGER DEFAULT 0'],
  ['tasks', 'cache_read_tokens', 'ALTER TABLE tasks ADD COLUMN cache_read_tokens INTEGER DEFAULT 0'],
  ['tasks', 'cache_creation_tokens', 'ALTER TABLE tasks ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0'],
  ['tasks', 'total_cost', 'ALTER TABLE tasks ADD COLUMN total_cost REAL DEFAULT 0'],
  ['tasks', 'num_turns', 'ALTER TABLE tasks ADD COLUMN num_turns INTEGER DEFAULT 0'],
  ['tasks', 'rate_limit_hits', 'ALTER TABLE tasks ADD COLUMN rate_limit_hits INTEGER DEFAULT 0'],
  ['tasks', 'model_used', 'ALTER TABLE tasks ADD COLUMN model_used TEXT'],
];

for (const [table, col, sql] of migrations) {
  if (!columnExists(table, col)) db.run(sql);
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
  create: (name, slug, workingDir, icon, iconSeed) => run(
    'INSERT INTO projects (name, slug, working_dir, icon, icon_seed) VALUES (?, ?, ?, ?, ?)',
    [name, slug, workingDir, icon || 'marble', iconSeed || '']
  ),
  update: (id, name, slug, workingDir, icon, iconSeed) => run(
    "UPDATE projects SET name = ?, slug = ?, working_dir = ?, icon = ?, icon_seed = ?, updated_at = datetime('now','localtime') WHERE id = ?",
    [name, slug, workingDir, icon || 'marble', iconSeed || '', id]
  ),
  delete: (id) => run('DELETE FROM projects WHERE id = ?', [id]),
  getSummary: () => queryAll(
    `SELECT p.*,
       COUNT(t.id) as total_tasks,
       COUNT(CASE WHEN t.status = 'done' THEN 1 END) as done_tasks,
       COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as active_tasks,
       COUNT(CASE WHEN t.status = 'backlog' THEN 1 END) as backlog_tasks,
       COUNT(CASE WHEN t.status = 'testing' THEN 1 END) as testing_tasks,
       SUM(COALESCE(t.input_tokens, 0) + COALESCE(t.output_tokens, 0)) as total_tokens,
       SUM(COALESCE(t.total_cost, 0)) as total_cost,
       MAX(t.updated_at) as last_activity
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     GROUP BY p.id
     ORDER BY p.name`
  ),
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
    run: (projectId, title, description, priority, taskType, acceptanceCriteria, model, thinkingEffort) => run(
      'INSERT INTO tasks (project_id, title, description, priority, task_type, acceptance_criteria, model, thinking_effort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projectId, title, description, priority, taskType || 'feature', acceptanceCriteria || '', model || 'sonnet', thinkingEffort || 'medium']
    ),
  },
  updateTask: {
    run: (title, description, priority, taskType, acceptanceCriteria, model, thinkingEffort, id) => run(
      "UPDATE tasks SET title = ?, description = ?, priority = ?, task_type = ?, acceptance_criteria = ?, model = ?, thinking_effort = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [title, description, priority, taskType || 'feature', acceptanceCriteria || '', model || 'sonnet', thinkingEffort || 'medium', id]
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
  updateTaskUsage: {
    run: (inputTokens, outputTokens, cacheRead, cacheCreation, totalCost, numTurns, modelUsed, id) => run(
      `UPDATE tasks SET
        input_tokens = COALESCE(input_tokens, 0) + ?,
        output_tokens = COALESCE(output_tokens, 0) + ?,
        cache_read_tokens = COALESCE(cache_read_tokens, 0) + ?,
        cache_creation_tokens = COALESCE(cache_creation_tokens, 0) + ?,
        total_cost = COALESCE(total_cost, 0) + ?,
        num_turns = ?,
        model_used = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?`,
      [inputTokens, outputTokens, cacheRead, cacheCreation, totalCost, numTurns, modelUsed, id]
    ),
  },
  incrementRateLimitHits: {
    run: (id) => run(
      "UPDATE tasks SET rate_limit_hits = COALESCE(rate_limit_hits, 0) + 1, updated_at = datetime('now','localtime') WHERE id = ?",
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
    `SELECT id, title, task_type, priority, model, model_used, input_tokens, output_tokens,
            cache_read_tokens, cache_creation_tokens, total_cost, num_turns, rate_limit_hits,
            started_at, completed_at,
            ROUND((julianday(completed_at) - julianday(started_at)) * 24 * 60, 1) as duration_minutes
     FROM tasks WHERE project_id = ? AND started_at IS NOT NULL AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 10`,
    [projectId]
  ),
  getClaudeUsage: (projectId) => queryOne(
    `SELECT
       SUM(COALESCE(input_tokens, 0)) as total_input_tokens,
       SUM(COALESCE(output_tokens, 0)) as total_output_tokens,
       SUM(COALESCE(cache_read_tokens, 0)) as total_cache_read,
       SUM(COALESCE(cache_creation_tokens, 0)) as total_cache_creation,
       SUM(COALESCE(total_cost, 0)) as total_cost,
       SUM(COALESCE(num_turns, 0)) as total_turns,
       SUM(COALESCE(rate_limit_hits, 0)) as total_rate_limits,
       COUNT(CASE WHEN input_tokens > 0 THEN 1 END) as tasks_with_usage
     FROM tasks WHERE project_id = ?`,
    [projectId]
  ),
  getModelBreakdown: (projectId) => queryAll(
    `SELECT COALESCE(model_used, model, 'unknown') as model_name,
            COUNT(*) as count,
            SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) as total_tokens,
            SUM(COALESCE(total_cost, 0)) as total_cost
     FROM tasks WHERE project_id = ? AND (input_tokens > 0 OR status IN ('in_progress','testing','done'))
     GROUP BY model_name`,
    [projectId]
  ),
};

save();

export default db;

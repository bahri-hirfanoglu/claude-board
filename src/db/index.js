import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data.db');
const LEGACY_PATH = join(__dirname, '..', '..', 'tasks.db');

// ─── Initialize Database ───
const SQL = await initSqlJs();

let db;
// Support legacy DB path migration
const dbPath = existsSync(DB_PATH) ? DB_PATH : existsSync(LEGACY_PATH) ? LEGACY_PATH : DB_PATH;
if (existsSync(dbPath)) {
  db = new SQL.Database(readFileSync(dbPath));
} else {
  db = new SQL.Database();
}
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// ─── Save with debounce ───
let saveTimer = null;
function save() {
  if (saveTimer) return; // already scheduled
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(DB_PATH, Buffer.from(db.export()));
    } catch (e) {
      console.error('[DB] Save error:', e.message);
    }
    saveTimer = null;
  }, 100);
}

function saveSync() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try {
    writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (e) {
    console.error('[DB] Save error:', e.message);
  }
}

// ─── Query Helpers ───
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : null;
  } finally {
    stmt.free();
  }
}

export function run(sql, params = []) {
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
  const lastId = result[0]?.values[0]?.[0] ?? 0;
  save();
  return { lastInsertRowid: Number(lastId) };
}

// ─── Schema ───
db.run(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  working_dir TEXT NOT NULL,
  icon TEXT DEFAULT 'marble',
  icon_seed TEXT DEFAULT '',
  permission_mode TEXT DEFAULT 'auto-accept',
  allowed_tools TEXT DEFAULT '',
  auto_queue INTEGER DEFAULT 0,
  max_concurrent INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)`);

db.run(`CREATE TABLE IF NOT EXISTS tasks (
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
  queue_position INTEGER DEFAULT 0,
  branch_name TEXT,
  claude_session_id TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_creation_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0,
  num_turns INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  revision_count INTEGER DEFAULT 0,
  model_used TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','tool_result','system')),
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS task_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL,
  feedback TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  task_id INTEGER,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

// Indexes
db.run('CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_task_revisions_task_id ON task_revisions(task_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at)');

// ─── Migrations ───
function columnExists(table, column) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return false;
  return result[0].values.some(row => row[1] === column);
}

const migrations = [
  ['projects', 'icon', "ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT 'marble'"],
  ['projects', 'icon_seed', "ALTER TABLE projects ADD COLUMN icon_seed TEXT DEFAULT ''"],
  ['projects', 'permission_mode', "ALTER TABLE projects ADD COLUMN permission_mode TEXT DEFAULT 'auto-accept'"],
  ['projects', 'allowed_tools', "ALTER TABLE projects ADD COLUMN allowed_tools TEXT DEFAULT ''"],
  ['projects', 'auto_queue', 'ALTER TABLE projects ADD COLUMN auto_queue INTEGER DEFAULT 0'],
  ['projects', 'max_concurrent', 'ALTER TABLE projects ADD COLUMN max_concurrent INTEGER DEFAULT 1'],
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
  ['tasks', 'revision_count', 'ALTER TABLE tasks ADD COLUMN revision_count INTEGER DEFAULT 0'],
  ['tasks', 'queue_position', 'ALTER TABLE tasks ADD COLUMN queue_position INTEGER DEFAULT 0'],
];

for (const [table, col, sql] of migrations) {
  if (!columnExists(table, col)) {
    try { db.run(sql); } catch (e) { console.error(`[DB] Migration ${table}.${col}:`, e.message); }
  }
}

// Migrate task_logs CHECK constraint if needed
try {
  const tableInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_logs'");
  if (tableInfo.length && tableInfo[0].values[0][0] && !tableInfo[0].values[0][0].includes('tool_result')) {
    db.run('BEGIN TRANSACTION');
    db.run('ALTER TABLE task_logs RENAME TO task_logs_old');
    db.run(`CREATE TABLE task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','tool_result','system')),
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )`);
    db.run('INSERT INTO task_logs SELECT * FROM task_logs_old');
    db.run('DROP TABLE task_logs_old');
    db.run('CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)');
    db.run('COMMIT');
  }
} catch (e) {
  try { db.run('ROLLBACK'); } catch {}
}

saveSync();

// ─── Project Queries ───
export const projectQueries = {
  getAll: () => queryAll('SELECT * FROM projects ORDER BY name'),
  getById: (id) => queryOne('SELECT * FROM projects WHERE id = ?', [id]),
  getBySlug: (slug) => queryOne('SELECT * FROM projects WHERE slug = ?', [slug]),
  create: (name, slug, workingDir, icon, iconSeed, permissionMode, allowedTools) => run(
    'INSERT INTO projects (name, slug, working_dir, icon, icon_seed, permission_mode, allowed_tools) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, slug, workingDir, icon || 'marble', iconSeed || '', permissionMode || 'auto-accept', allowedTools || '']
  ),
  update: (id, name, slug, workingDir, icon, iconSeed, permissionMode, allowedTools) => run(
    "UPDATE projects SET name=?, slug=?, working_dir=?, icon=?, icon_seed=?, permission_mode=?, allowed_tools=?, updated_at=datetime('now','localtime') WHERE id=?",
    [name, slug, workingDir, icon || 'marble', iconSeed || '', permissionMode || 'auto-accept', allowedTools || '', id]
  ),
  updateQueue: (id, autoQueue, maxConcurrent) => run(
    "UPDATE projects SET auto_queue=?, max_concurrent=?, updated_at=datetime('now','localtime') WHERE id=?",
    [autoQueue ? 1 : 0, maxConcurrent || 1, id]
  ),
  delete: (id) => run('DELETE FROM projects WHERE id = ?', [id]),
  getSummary: () => queryAll(
    `SELECT p.*,
       COUNT(t.id) as total_tasks,
       COUNT(CASE WHEN t.status='done' THEN 1 END) as done_tasks,
       COUNT(CASE WHEN t.status='in_progress' THEN 1 END) as active_tasks,
       COUNT(CASE WHEN t.status='backlog' THEN 1 END) as backlog_tasks,
       COUNT(CASE WHEN t.status='testing' THEN 1 END) as testing_tasks,
       SUM(COALESCE(t.input_tokens,0)+COALESCE(t.output_tokens,0)) as total_tokens,
       SUM(COALESCE(t.total_cost,0)) as total_cost,
       MAX(t.updated_at) as last_activity
     FROM projects p LEFT JOIN tasks t ON t.project_id=p.id
     GROUP BY p.id ORDER BY p.name`
  ),
};

// ─── Task Queries ───
export const queries = {
  getTasksByProject: {
    all: (projectId) => queryAll('SELECT * FROM tasks WHERE project_id=? ORDER BY status, sort_order, id', [projectId]),
  },
  getTaskById: {
    get: (id) => queryOne('SELECT * FROM tasks WHERE id=?', [id]),
  },
  createTask: {
    run: (projectId, title, description, priority, taskType, acceptanceCriteria, model, thinkingEffort) => run(
      'INSERT INTO tasks (project_id,title,description,priority,task_type,acceptance_criteria,model,thinking_effort) VALUES (?,?,?,?,?,?,?,?)',
      [projectId, title, description, priority, taskType || 'feature', acceptanceCriteria || '', model || 'sonnet', thinkingEffort || 'medium']
    ),
  },
  updateTask: {
    run: (title, description, priority, taskType, acceptanceCriteria, model, thinkingEffort, id) => run(
      "UPDATE tasks SET title=?,description=?,priority=?,task_type=?,acceptance_criteria=?,model=?,thinking_effort=?,updated_at=datetime('now','localtime') WHERE id=?",
      [title, description, priority, taskType || 'feature', acceptanceCriteria || '', model || 'sonnet', thinkingEffort || 'medium', id]
    ),
  },
  updateTaskStatus: { run: (status, id) => run("UPDATE tasks SET status=?,updated_at=datetime('now','localtime') WHERE id=?", [status, id]) },
  setTaskStarted: { run: (id) => run("UPDATE tasks SET started_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?", [id]) },
  setTaskCompleted: { run: (id) => run("UPDATE tasks SET completed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?", [id]) },
  setTaskUsageLive: {
    run: (input, output, cacheRead, cacheCreation, cost, modelUsed, id) => run(
      `UPDATE tasks SET input_tokens=?,output_tokens=?,cache_read_tokens=?,cache_creation_tokens=?,total_cost=?,model_used=?,updated_at=datetime('now','localtime') WHERE id=?`,
      [input, output, cacheRead, cacheCreation, cost, modelUsed, id]
    ),
  },
  updateTaskNumTurns: { run: (turns, id) => run("UPDATE tasks SET num_turns=?,updated_at=datetime('now','localtime') WHERE id=?", [turns, id]) },
  incrementRateLimitHits: { run: (id) => run("UPDATE tasks SET rate_limit_hits=COALESCE(rate_limit_hits,0)+1,updated_at=datetime('now','localtime') WHERE id=?", [id]) },
  updateTaskClaudeSession: { run: (sessionId, id) => run("UPDATE tasks SET claude_session_id=?,updated_at=datetime('now','localtime') WHERE id=?", [sessionId, id]) },
  deleteTask: { run: (id) => run('DELETE FROM tasks WHERE id=?', [id]) },
  // Logs
  getRecentTaskLogs: { all: (taskId, limit) => queryAll('SELECT * FROM task_logs WHERE task_id=? ORDER BY id DESC LIMIT ?', [taskId, limit]) },
  addTaskLog: { run: (taskId, message, logType) => run('INSERT INTO task_logs (task_id,message,log_type) VALUES (?,?,?)', [taskId, message, logType]) },
  clearTaskLogs: { run: (taskId) => run('DELETE FROM task_logs WHERE task_id=?', [taskId]) },
  // Revisions
  addRevision: { run: (taskId, revNum, feedback) => run('INSERT INTO task_revisions (task_id,revision_number,feedback) VALUES (?,?,?)', [taskId, revNum, feedback]) },
  getRevisions: { all: (taskId) => queryAll('SELECT * FROM task_revisions WHERE task_id=? ORDER BY revision_number ASC', [taskId]) },
  incrementRevisionCount: { run: (id) => run("UPDATE tasks SET revision_count=COALESCE(revision_count,0)+1,updated_at=datetime('now','localtime') WHERE id=?", [id]) },
  // Queue
  getNextQueuedTask: (projectId) => queryOne(
    "SELECT * FROM tasks WHERE project_id=? AND status='backlog' ORDER BY priority DESC, queue_position ASC, id ASC LIMIT 1",
    [projectId]
  ),
  getRunningCount: (projectId) => {
    const row = queryOne("SELECT COUNT(*) as count FROM tasks WHERE project_id=? AND status='in_progress'", [projectId]);
    return row?.count || 0;
  },
  updateQueuePosition: { run: (pos, id) => run("UPDATE tasks SET queue_position=?,updated_at=datetime('now','localtime') WHERE id=?", [pos, id]) },
};

// ─── Stats Queries ───
export const statsQueries = {
  getTasksByStatus: (pid) => queryAll('SELECT status,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY status', [pid]),
  getTasksByPriority: (pid) => queryAll('SELECT priority,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY priority', [pid]),
  getTasksByType: (pid) => queryAll('SELECT task_type,COUNT(*) as count FROM tasks WHERE project_id=? GROUP BY task_type', [pid]),
  getAvgDuration: (pid) => queryOne(
    `SELECT AVG((julianday(completed_at)-julianday(started_at))*24*60) as avg_minutes,
            MIN((julianday(completed_at)-julianday(started_at))*24*60) as min_minutes,
            MAX((julianday(completed_at)-julianday(started_at))*24*60) as max_minutes,
            COUNT(*) as count
     FROM tasks WHERE project_id=? AND started_at IS NOT NULL AND completed_at IS NOT NULL`, [pid]
  ),
  getCompletionTimeline: (pid) => queryAll(
    `SELECT date(completed_at) as day, COUNT(*) as count
     FROM tasks WHERE project_id=? AND completed_at IS NOT NULL AND completed_at>=datetime('now','-14 days')
     GROUP BY date(completed_at) ORDER BY day`, [pid]
  ),
  getRecentCompleted: (pid) => queryAll(
    `SELECT id,title,task_type,priority,model,model_used,input_tokens,output_tokens,
            cache_read_tokens,cache_creation_tokens,total_cost,num_turns,rate_limit_hits,
            started_at,completed_at,
            ROUND((julianday(completed_at)-julianday(started_at))*24*60,1) as duration_minutes
     FROM tasks WHERE project_id=? AND started_at IS NOT NULL AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 10`, [pid]
  ),
  getClaudeUsage: (pid) => queryOne(
    `SELECT SUM(COALESCE(input_tokens,0)) as total_input_tokens,
       SUM(COALESCE(output_tokens,0)) as total_output_tokens,
       SUM(COALESCE(cache_read_tokens,0)) as total_cache_read,
       SUM(COALESCE(cache_creation_tokens,0)) as total_cache_creation,
       SUM(COALESCE(total_cost,0)) as total_cost,
       SUM(COALESCE(num_turns,0)) as total_turns,
       SUM(COALESCE(rate_limit_hits,0)) as total_rate_limits,
       COUNT(CASE WHEN input_tokens>0 THEN 1 END) as tasks_with_usage
     FROM tasks WHERE project_id=?`, [pid]
  ),
  getModelBreakdown: (pid) => queryAll(
    `SELECT COALESCE(model_used,model,'unknown') as model_name,
            COUNT(*) as count,
            SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)) as total_tokens,
            SUM(COALESCE(total_cost,0)) as total_cost
     FROM tasks WHERE project_id=? AND (input_tokens>0 OR status IN ('in_progress','testing','done'))
     GROUP BY model_name`, [pid]
  ),
};

// ─── Activity Log ───
export const activityLog = {
  add: (projectId, taskId, eventType, message, metadata = {}) => {
    try {
      return run(
        'INSERT INTO activity_log (project_id,task_id,event_type,message,metadata) VALUES (?,?,?,?,?)',
        [projectId, taskId, eventType, message, JSON.stringify(metadata)]
      );
    } catch (e) {
      console.error('[Activity]', e.message);
    }
  },
  getByProject: (projectId, limit = 50, offset = 0) => {
    const rows = queryAll(
      `SELECT a.*, t.title as task_title
       FROM activity_log a LEFT JOIN tasks t ON a.task_id=t.id
       WHERE a.project_id=? ORDER BY a.id DESC LIMIT ? OFFSET ?`,
      [projectId, limit, offset]
    );
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
  },
  getByTask: (taskId, limit = 30) => {
    const rows = queryAll(
      'SELECT * FROM activity_log WHERE task_id=? ORDER BY id DESC LIMIT ?',
      [taskId, limit]
    );
    return rows.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
  },
};

// Graceful shutdown
process.on('SIGTERM', saveSync);
process.on('SIGINT', saveSync);

export default db;

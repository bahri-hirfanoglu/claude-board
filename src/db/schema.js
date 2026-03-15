import db from './connection.js';
import { save } from './connection.js';

// ─── Tables ───
db.run(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, working_dir TEXT NOT NULL,
  icon TEXT DEFAULT 'marble', icon_seed TEXT DEFAULT '',
  permission_mode TEXT DEFAULT 'auto-accept', allowed_tools TEXT DEFAULT '',
  auto_queue INTEGER DEFAULT 0, max_concurrent INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)`);

db.run(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog','in_progress','testing','done')),
  priority INTEGER DEFAULT 0,
  task_type TEXT DEFAULT 'feature' CHECK(task_type IN ('feature','bugfix','refactor','docs','test','chore')),
  acceptance_criteria TEXT DEFAULT '', model TEXT DEFAULT 'sonnet', thinking_effort TEXT DEFAULT 'medium',
  sort_order INTEGER DEFAULT 0, queue_position INTEGER DEFAULT 0,
  branch_name TEXT, claude_session_id TEXT,
  input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0, cache_creation_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0, num_turns INTEGER DEFAULT 0, rate_limit_hits INTEGER DEFAULT 0,
  revision_count INTEGER DEFAULT 0, model_used TEXT,
  started_at DATETIME, completed_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, message TEXT NOT NULL,
  log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','tool_result','system')),
  meta TEXT,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS task_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL,
  revision_number INTEGER NOT NULL, feedback TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS claude_limits (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rate_limit_type TEXT,
  status TEXT,
  resets_at INTEGER,
  overage_status TEXT,
  is_using_overage INTEGER DEFAULT 0,
  last_model TEXT,
  last_cost_usd REAL DEFAULT 0,
  context_window INTEGER DEFAULT 0,
  max_output_tokens INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)`);

db.run(`CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
  task_id INTEGER, event_type TEXT NOT NULL, message TEXT NOT NULL, metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

// ─── Indexes ───
[
 'idx_task_logs_task_id ON task_logs(task_id)',
 'idx_tasks_status ON tasks(status)',
 'idx_tasks_project ON tasks(project_id)',
 'idx_tasks_project_status ON tasks(project_id, status)',
 'idx_tasks_created ON tasks(created_at)',
 'idx_projects_slug ON projects(slug)',
 'idx_task_revisions_task_id ON task_revisions(task_id)',
 'idx_activity_project ON activity_log(project_id)',
 'idx_activity_created ON activity_log(created_at)',
].forEach(idx => db.run(`CREATE INDEX IF NOT EXISTS ${idx}`));

// ─── Migrations ───
function colExists(table, col) {
  const r = db.exec(`PRAGMA table_info(${table})`);
  return r.length > 0 && r[0].values.some(row => row[1] === col);
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
  ['task_logs', 'meta', 'ALTER TABLE task_logs ADD COLUMN meta TEXT'],
  ['tasks', 'commits', "ALTER TABLE tasks ADD COLUMN commits TEXT DEFAULT '[]'"],
  ['tasks', 'pr_url', 'ALTER TABLE tasks ADD COLUMN pr_url TEXT'],
];

for (const [table, col, sql] of migrations) {
  if (!colExists(table, col)) { try { db.run(sql); } catch {} }
}

// Migrate task_logs CHECK constraint
try {
  const info = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_logs'");
  if (info.length && info[0].values[0][0] && !info[0].values[0][0].includes('tool_result')) {
    db.run('BEGIN TRANSACTION');
    db.run('ALTER TABLE task_logs RENAME TO task_logs_old');
    db.run(`CREATE TABLE task_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, message TEXT NOT NULL,
      log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','tool_result','system')),
      created_at DATETIME DEFAULT (datetime('now','localtime')), FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE)`);
    db.run('INSERT INTO task_logs SELECT * FROM task_logs_old');
    db.run('DROP TABLE task_logs_old');
    db.run('CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)');
    db.run('COMMIT');
  }
} catch { try { db.run('ROLLBACK'); } catch {} }

save();

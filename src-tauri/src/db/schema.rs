use rusqlite::Connection;

pub fn create_tables(conn: &Connection) {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, working_dir TEXT NOT NULL,
            icon TEXT DEFAULT 'marble', icon_seed TEXT DEFAULT '',
            permission_mode TEXT DEFAULT 'auto-accept', allowed_tools TEXT DEFAULT '',
            auto_queue INTEGER DEFAULT 0, max_concurrent INTEGER DEFAULT 1,
            auto_branch INTEGER DEFAULT 1, auto_pr INTEGER DEFAULT 0, pr_base_branch TEXT DEFAULT 'main',
            project_key TEXT DEFAULT '', task_counter INTEGER DEFAULT 1000,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
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
            work_duration_ms INTEGER DEFAULT 0, last_resumed_at DATETIME,
            commits TEXT DEFAULT '[]', pr_url TEXT, diff_stat TEXT,
            role_id INTEGER, task_key TEXT DEFAULT '',
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, message TEXT NOT NULL,
            log_type TEXT DEFAULT 'info' CHECK(log_type IN ('info','error','success','claude','tool','tool_result','system')),
            meta TEXT,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL,
            revision_number INTEGER NOT NULL, feedback TEXT NOT NULL,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS claude_limits (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            rate_limit_type TEXT, status TEXT, resets_at INTEGER,
            overage_status TEXT, is_using_overage INTEGER DEFAULT 0,
            last_model TEXT, last_cost_usd REAL DEFAULT 0,
            context_window INTEGER DEFAULT 0, max_output_tokens INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
            task_id INTEGER, event_type TEXT NOT NULL, message TEXT NOT NULL, metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS context_snippets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
            title TEXT NOT NULL, content TEXT NOT NULL, enabled INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS task_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL,
            mime_type TEXT, size INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS prompt_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT,
            template TEXT NOT NULL, variables TEXT,
            task_type TEXT DEFAULT 'feature', model TEXT DEFAULT 'sonnet', thinking_effort TEXT DEFAULT 'medium',
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER, name TEXT NOT NULL, description TEXT DEFAULT '',
            prompt TEXT DEFAULT '', color TEXT DEFAULT '#6B7280',
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL,
            platform TEXT DEFAULT 'custom' CHECK(platform IN ('slack','discord','teams','custom')),
            events TEXT DEFAULT '[]', enabled INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT (datetime('now','localtime')),
            updated_at DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS auth_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            api_key_hash TEXT, enabled INTEGER DEFAULT 0
        );
        ",
    )
    .expect("Failed to create tables");

    // Indexes
    let indexes = [
        "CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug)",
        "CREATE INDEX IF NOT EXISTS idx_task_revisions_task_id ON task_revisions(task_id)",
        "CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_context_snippets_project ON context_snippets(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id)",
        "CREATE INDEX IF NOT EXISTS idx_prompt_templates_project ON prompt_templates(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id)",
        "CREATE INDEX IF NOT EXISTS idx_roles_project ON roles(project_id)",
    ];
    for idx in indexes {
        conn.execute_batch(idx).ok();
    }
}

fn col_exists(conn: &Connection, table: &str, col: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&sql).unwrap();
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap();
    for name in rows.flatten() {
        if name == col {
            return true;
        }
    }
    false
}

pub fn run_migrations(conn: &Connection) {
    let migrations: Vec<(&str, &str, &str)> = vec![
        ("projects", "icon", "ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT 'marble'"),
        ("projects", "icon_seed", "ALTER TABLE projects ADD COLUMN icon_seed TEXT DEFAULT ''"),
        ("projects", "permission_mode", "ALTER TABLE projects ADD COLUMN permission_mode TEXT DEFAULT 'auto-accept'"),
        ("projects", "allowed_tools", "ALTER TABLE projects ADD COLUMN allowed_tools TEXT DEFAULT ''"),
        ("projects", "auto_queue", "ALTER TABLE projects ADD COLUMN auto_queue INTEGER DEFAULT 0"),
        ("projects", "max_concurrent", "ALTER TABLE projects ADD COLUMN max_concurrent INTEGER DEFAULT 1"),
        ("projects", "auto_branch", "ALTER TABLE projects ADD COLUMN auto_branch INTEGER DEFAULT 1"),
        ("projects", "auto_pr", "ALTER TABLE projects ADD COLUMN auto_pr INTEGER DEFAULT 0"),
        ("projects", "pr_base_branch", "ALTER TABLE projects ADD COLUMN pr_base_branch TEXT DEFAULT 'main'"),
        ("projects", "project_key", "ALTER TABLE projects ADD COLUMN project_key TEXT DEFAULT ''"),
        ("projects", "task_counter", "ALTER TABLE projects ADD COLUMN task_counter INTEGER DEFAULT 1000"),
        ("tasks", "started_at", "ALTER TABLE tasks ADD COLUMN started_at DATETIME"),
        ("tasks", "completed_at", "ALTER TABLE tasks ADD COLUMN completed_at DATETIME"),
        ("tasks", "task_type", "ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'feature'"),
        ("tasks", "acceptance_criteria", "ALTER TABLE tasks ADD COLUMN acceptance_criteria TEXT DEFAULT ''"),
        ("tasks", "model", "ALTER TABLE tasks ADD COLUMN model TEXT DEFAULT 'sonnet'"),
        ("tasks", "thinking_effort", "ALTER TABLE tasks ADD COLUMN thinking_effort TEXT DEFAULT 'medium'"),
        ("tasks", "input_tokens", "ALTER TABLE tasks ADD COLUMN input_tokens INTEGER DEFAULT 0"),
        ("tasks", "output_tokens", "ALTER TABLE tasks ADD COLUMN output_tokens INTEGER DEFAULT 0"),
        ("tasks", "cache_read_tokens", "ALTER TABLE tasks ADD COLUMN cache_read_tokens INTEGER DEFAULT 0"),
        ("tasks", "cache_creation_tokens", "ALTER TABLE tasks ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0"),
        ("tasks", "total_cost", "ALTER TABLE tasks ADD COLUMN total_cost REAL DEFAULT 0"),
        ("tasks", "num_turns", "ALTER TABLE tasks ADD COLUMN num_turns INTEGER DEFAULT 0"),
        ("tasks", "rate_limit_hits", "ALTER TABLE tasks ADD COLUMN rate_limit_hits INTEGER DEFAULT 0"),
        ("tasks", "model_used", "ALTER TABLE tasks ADD COLUMN model_used TEXT"),
        ("tasks", "revision_count", "ALTER TABLE tasks ADD COLUMN revision_count INTEGER DEFAULT 0"),
        ("tasks", "queue_position", "ALTER TABLE tasks ADD COLUMN queue_position INTEGER DEFAULT 0"),
        ("tasks", "commits", "ALTER TABLE tasks ADD COLUMN commits TEXT DEFAULT '[]'"),
        ("tasks", "pr_url", "ALTER TABLE tasks ADD COLUMN pr_url TEXT"),
        ("tasks", "diff_stat", "ALTER TABLE tasks ADD COLUMN diff_stat TEXT"),
        ("tasks", "work_duration_ms", "ALTER TABLE tasks ADD COLUMN work_duration_ms INTEGER DEFAULT 0"),
        ("tasks", "last_resumed_at", "ALTER TABLE tasks ADD COLUMN last_resumed_at DATETIME"),
        ("tasks", "role_id", "ALTER TABLE tasks ADD COLUMN role_id INTEGER"),
        ("tasks", "task_key", "ALTER TABLE tasks ADD COLUMN task_key TEXT DEFAULT ''"),
        ("task_logs", "meta", "ALTER TABLE task_logs ADD COLUMN meta TEXT"),
    ];

    for (table, col, sql) in migrations {
        if !col_exists(conn, table, col) {
            conn.execute_batch(sql).ok();
        }
    }

    // Backfill empty model fields
    conn.execute("UPDATE tasks SET model='sonnet' WHERE model IS NULL OR model=''", []).ok();

    // Generate project_key for projects that don't have one
    backfill_project_keys(conn);
    backfill_task_keys(conn);
}

pub fn generate_project_key(slug: &str) -> String {
    if slug.is_empty() {
        return "PRJ".to_string();
    }
    let cleaned: String = slug.chars().filter(|c| c.is_alphanumeric() || *c == '-').collect();
    let parts: Vec<&str> = cleaned.split('-').filter(|s| !s.is_empty()).collect();
    if parts.len() >= 2 {
        parts.iter()
            .map(|p| p.chars().next().unwrap_or('X'))
            .collect::<String>()
            .to_uppercase()
            .chars()
            .take(4)
            .collect()
    } else {
        let alpha: String = slug.chars().filter(|c| c.is_alphabetic()).collect();
        let key: String = alpha.chars().take(3).collect();
        if key.is_empty() { "PRJ".to_string() } else { key.to_uppercase() }
    }
}

fn backfill_project_keys(conn: &Connection) {
    let mut stmt = conn
        .prepare("SELECT id, slug, project_key FROM projects")
        .unwrap();
    let rows: Vec<(i64, String, Option<String>)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .unwrap()
        .flatten()
        .collect();

    for (id, slug, key) in rows {
        if key.as_deref().unwrap_or("").is_empty() {
            let new_key = generate_project_key(&slug);
            conn.execute("UPDATE projects SET project_key=?1 WHERE id=?2", rusqlite::params![new_key, id]).ok();
        }
    }
}

pub fn get_type_prefix(task_type: &str) -> &str {
    match task_type {
        "feature" => "FTR",
        "bugfix" => "BUG",
        "refactor" => "RFT",
        "docs" => "DOC",
        "test" => "TST",
        "chore" => "CHR",
        _ => "TSK",
    }
}

fn backfill_task_keys(conn: &Connection) {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.task_type, t.project_id, p.project_key FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.task_key IS NULL OR t.task_key='' ORDER BY t.project_id, t.id"
    ).unwrap();
    let rows: Vec<(i64, String, i64, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get::<_, String>(3).unwrap_or_default()))
        })
        .unwrap()
        .flatten()
        .collect();

    if rows.is_empty() {
        return;
    }

    // Load counters
    let mut counters = std::collections::HashMap::new();
    let mut cstmt = conn.prepare("SELECT id, task_counter FROM projects").unwrap();
    let crow: Vec<(i64, i64)> = cstmt
        .query_map([], |row| Ok((row.get(0)?, row.get::<_, i64>(1).unwrap_or(1000))))
        .unwrap()
        .flatten()
        .collect();
    for (pid, counter) in crow {
        counters.insert(pid, counter);
    }

    for (tid, task_type, project_id, project_key) in &rows {
        let counter = counters.entry(*project_id).or_insert(1000);
        *counter += 1;
        let prefix = get_type_prefix(task_type);
        let pkey = if project_key.is_empty() { "PRJ" } else { project_key.as_str() };
        let key = format!("{}-{}-{}", prefix, pkey, counter);
        conn.execute("UPDATE tasks SET task_key=?1 WHERE id=?2", rusqlite::params![key, tid]).ok();
    }

    for (pid, counter) in &counters {
        conn.execute("UPDATE projects SET task_counter=?1 WHERE id=?2", rusqlite::params![counter, pid]).ok();
    }
}

pub use get_type_prefix as type_prefix;
pub use generate_project_key as project_key_from_slug;

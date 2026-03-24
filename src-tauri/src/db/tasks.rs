use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;
use super::schema::type_prefix;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<i64>,
    pub task_type: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub model: Option<String>,
    pub thinking_effort: Option<String>,
    pub sort_order: Option<i64>,
    pub queue_position: Option<i64>,
    pub branch_name: Option<String>,
    pub claude_session_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub total_cost: Option<f64>,
    pub num_turns: Option<i64>,
    pub rate_limit_hits: Option<i64>,
    pub revision_count: Option<i64>,
    pub model_used: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub work_duration_ms: Option<i64>,
    pub last_resumed_at: Option<String>,
    pub commits: Option<String>,
    pub pr_url: Option<String>,
    pub diff_stat: Option<String>,
    pub role_id: Option<i64>,
    pub task_key: Option<String>,
    pub depends_on: Option<i64>,
    pub retry_count: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub is_running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskLog {
    pub id: i64,
    pub task_id: i64,
    pub message: String,
    pub log_type: Option<String>,
    pub meta: Option<serde_json::Value>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRevision {
    pub id: i64,
    pub task_id: i64,
    pub revision_number: i64,
    pub feedback: String,
    pub created_at: Option<String>,
}

pub fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        status: row.get("status")?,
        priority: row.get("priority")?,
        task_type: row.get("task_type")?,
        acceptance_criteria: row.get("acceptance_criteria")?,
        model: row.get("model")?,
        thinking_effort: row.get("thinking_effort")?,
        sort_order: row.get("sort_order")?,
        queue_position: row.get("queue_position")?,
        branch_name: row.get("branch_name")?,
        claude_session_id: row.get("claude_session_id")?,
        input_tokens: row.get("input_tokens")?,
        output_tokens: row.get("output_tokens")?,
        cache_read_tokens: row.get("cache_read_tokens")?,
        cache_creation_tokens: row.get("cache_creation_tokens")?,
        total_cost: row.get("total_cost")?,
        num_turns: row.get("num_turns")?,
        rate_limit_hits: row.get("rate_limit_hits")?,
        revision_count: row.get("revision_count")?,
        model_used: row.get("model_used")?,
        started_at: row.get("started_at")?,
        completed_at: row.get("completed_at")?,
        work_duration_ms: row.get("work_duration_ms")?,
        last_resumed_at: row.get("last_resumed_at")?,
        commits: row.get("commits")?,
        pr_url: row.get("pr_url")?,
        diff_stat: row.get("diff_stat")?,
        role_id: row.get("role_id")?,
        task_key: row.get("task_key")?,
        depends_on: row.get("depends_on")?,
        retry_count: row.get("retry_count")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        is_running: false,
    })
}

pub fn update_queue_position(db: &DbPool, task_id: i64, position: i64) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET queue_position=?1 WHERE id=?2", params![position, task_id]).ok();
}

pub fn update_depends_on(db: &DbPool, task_id: i64, depends_on: Option<i64>) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET depends_on=?1 WHERE id=?2", params![depends_on, task_id]).ok();
}

pub fn increment_retry(db: &DbPool, task_id: i64) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET retry_count=COALESCE(retry_count,0)+1 WHERE id=?1", params![task_id]).ok();
}

pub fn is_dependency_met(db: &DbPool, task: &Task) -> bool {
    match task.depends_on {
        None => true,
        Some(dep_id) => {
            let conn = db.lock();
            let status: Option<String> = conn
                .query_row("SELECT status FROM tasks WHERE id=?1", params![dep_id], |r| r.get(0))
                .ok();
            matches!(status.as_deref(), Some("done") | Some("testing"))
        }
    }
}

pub fn get_by_project(db: &DbPool, project_id: i64) -> Vec<Task> {
    let conn = db.lock();
    let mut stmt = conn
        .prepare("SELECT * FROM tasks WHERE project_id=?1 ORDER BY status,sort_order,id")
        .unwrap();
    stmt.query_map(params![project_id], |row| row_to_task(row))
        .unwrap()
        .flatten()
        .collect()
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Task> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM tasks WHERE id=?1").unwrap();
    stmt.query_row(params![id], |row| row_to_task(row))
        .ok()
}

fn generate_task_key(conn: &rusqlite::Connection, project_id: i64, task_type: &str) -> String {
    conn.execute(
        "UPDATE projects SET task_counter=COALESCE(task_counter,1000)+1 WHERE id=?1",
        params![project_id],
    ).unwrap();

    let (pkey, counter): (String, i64) = conn
        .prepare("SELECT project_key, task_counter FROM projects WHERE id=?1")
        .unwrap()
        .query_row(params![project_id], |row| {
            Ok((row.get::<_, String>(0).unwrap_or_else(|_| "PRJ".into()), row.get(1).unwrap_or(1001)))
        })
        .unwrap_or(("PRJ".into(), 1001));

    let prefix = type_prefix(task_type);
    let pk = if pkey.is_empty() { "PRJ" } else { &pkey };
    format!("{}-{}-{}", prefix, pk, counter)
}

pub fn create(
    db: &DbPool,
    project_id: i64, title: &str, description: &str,
    priority: i64, task_type: &str, acceptance_criteria: &str,
    model: &str, thinking_effort: &str, role_id: Option<i64>,
) -> i64 {
    let conn = db.lock();
    let task_key = generate_task_key(&conn, project_id, task_type);
    conn.execute(
        "INSERT INTO tasks (project_id,title,description,priority,task_type,acceptance_criteria,model,thinking_effort,role_id,task_key) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![project_id, title, description, priority, task_type, acceptance_criteria, model, thinking_effort, role_id, task_key],
    ).unwrap();
    conn.last_insert_rowid()
}

pub fn update(
    db: &DbPool, id: i64,
    title: &str, description: &str, priority: i64,
    task_type: &str, acceptance_criteria: &str,
    model: &str, thinking_effort: &str, role_id: Option<i64>,
) {
    let conn = db.lock();
    // Check if task_type changed to update key prefix
    let existing: Option<(String, String)> = conn
        .prepare("SELECT task_type, task_key FROM tasks WHERE id=?1")
        .unwrap()
        .query_row(params![id], |row| Ok((row.get(0)?, row.get(1)?)))
        .ok();

    if let Some((old_type, old_key)) = existing {
        if old_type != task_type && !old_key.is_empty() {
            let old_prefix = type_prefix(&old_type);
            let new_prefix = type_prefix(task_type);
            let new_key = old_key.replacen(old_prefix, new_prefix, 1);
            conn.execute(
                "UPDATE tasks SET title=?1,description=?2,priority=?3,task_type=?4,acceptance_criteria=?5,model=?6,thinking_effort=?7,role_id=?8,task_key=?9,updated_at=datetime('now','localtime') WHERE id=?10",
                params![title, description, priority, task_type, acceptance_criteria, model, thinking_effort, role_id, new_key, id],
            ).unwrap();
            return;
        }
    }

    conn.execute(
        "UPDATE tasks SET title=?1,description=?2,priority=?3,task_type=?4,acceptance_criteria=?5,model=?6,thinking_effort=?7,role_id=?8,updated_at=datetime('now','localtime') WHERE id=?9",
        params![title, description, priority, task_type, acceptance_criteria, model, thinking_effort, role_id, id],
    ).unwrap();
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM tasks WHERE id=?1", params![id]).unwrap();
}

pub fn update_status(db: &DbPool, id: i64, status: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET status=?1,updated_at=datetime('now','localtime') WHERE id=?2",
        params![status, id],
    ).unwrap();
}

pub fn set_started(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET started_at=datetime('now','localtime'),last_resumed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

pub fn set_resumed(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET last_resumed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

pub fn pause_timer(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET work_duration_ms=COALESCE(work_duration_ms,0)+CAST((julianday('now','localtime')-julianday(last_resumed_at))*86400000 AS INTEGER),last_resumed_at=NULL,updated_at=datetime('now','localtime') WHERE id=?1 AND last_resumed_at IS NOT NULL",
        params![id],
    ).unwrap();
}

pub fn set_completed(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET completed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

pub fn finalize_timer(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET work_duration_ms=COALESCE(work_duration_ms,0)+CASE WHEN last_resumed_at IS NOT NULL THEN CAST((julianday('now','localtime')-julianday(last_resumed_at))*86400000 AS INTEGER) ELSE 0 END,last_resumed_at=NULL,completed_at=datetime('now','localtime'),updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

pub fn set_usage_live(db: &DbPool, id: i64, input: i64, output: i64, cache_read: i64, cache_creation: i64, cost: f64, model: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET input_tokens=?1,output_tokens=?2,cache_read_tokens=?3,cache_creation_tokens=?4,total_cost=?5,model_used=?6,updated_at=datetime('now','localtime') WHERE id=?7",
        params![input, output, cache_read, cache_creation, cost, model, id],
    ).unwrap();
}

pub fn update_num_turns(db: &DbPool, id: i64, turns: i64) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET num_turns=?1,updated_at=datetime('now','localtime') WHERE id=?2", params![turns, id]).unwrap();
}

pub fn increment_rate_limit_hits(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET rate_limit_hits=COALESCE(rate_limit_hits,0)+1,updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

pub fn update_claude_session(db: &DbPool, id: i64, session_id: &str) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET claude_session_id=?1,updated_at=datetime('now','localtime') WHERE id=?2", params![session_id, id]).unwrap();
}

pub fn update_branch(db: &DbPool, id: i64, branch_name: &str) {
    let conn = db.lock();
    conn.execute("UPDATE tasks SET branch_name=?1,updated_at=datetime('now','localtime') WHERE id=?2", params![branch_name, id]).unwrap();
}

pub fn update_git_info(db: &DbPool, id: i64, commits: &str, pr_url: Option<&str>, diff_stat: Option<&str>) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET commits=?1,pr_url=?2,diff_stat=?3,updated_at=datetime('now','localtime') WHERE id=?4",
        params![commits, pr_url, diff_stat, id],
    ).unwrap();
}

// Logs
pub fn get_recent_logs(db: &DbPool, task_id: i64, limit: i64) -> Vec<TaskLog> {
    let conn = db.lock();
    let mut stmt = conn
        .prepare("SELECT * FROM task_logs WHERE task_id=?1 ORDER BY id DESC LIMIT ?2")
        .unwrap();
    stmt.query_map(params![task_id, limit], |row| {
        let meta_str: Option<String> = row.get("meta")?;
        let meta = meta_str.and_then(|s| serde_json::from_str(&s).ok());
        Ok(TaskLog {
            id: row.get("id")?,
            task_id: row.get("task_id")?,
            message: row.get("message")?,
            log_type: row.get("log_type")?,
            meta,
            created_at: row.get("created_at")?,
        })
    })
    .unwrap()
    .flatten()
    .collect()
}

pub fn add_log(db: &DbPool, task_id: i64, message: &str, log_type: &str, meta: Option<&str>) {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO task_logs (task_id,message,log_type,meta) VALUES (?1,?2,?3,?4)",
        params![task_id, message, log_type, meta],
    ).ok();
}

pub fn clear_logs(db: &DbPool, task_id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM task_logs WHERE task_id=?1", params![task_id]).unwrap();
}

// Revisions
pub fn get_revisions(db: &DbPool, task_id: i64) -> Vec<TaskRevision> {
    let conn = db.lock();
    let mut stmt = conn
        .prepare("SELECT * FROM task_revisions WHERE task_id=?1 ORDER BY revision_number ASC")
        .unwrap();
    stmt.query_map(params![task_id], |row| {
        Ok(TaskRevision {
            id: row.get("id")?,
            task_id: row.get("task_id")?,
            revision_number: row.get("revision_number")?,
            feedback: row.get("feedback")?,
            created_at: row.get("created_at")?,
        })
    })
    .unwrap()
    .flatten()
    .collect()
}

pub fn add_revision(db: &DbPool, task_id: i64, revision_number: i64, feedback: &str) {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO task_revisions (task_id,revision_number,feedback) VALUES (?1,?2,?3)",
        params![task_id, revision_number, feedback],
    ).unwrap();
}

pub fn increment_revision_count(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute(
        "UPDATE tasks SET revision_count=COALESCE(revision_count,0)+1,updated_at=datetime('now','localtime') WHERE id=?1",
        params![id],
    ).unwrap();
}

// Queue
pub fn get_next_queued(db: &DbPool, project_id: i64) -> Option<Task> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM tasks WHERE project_id=?1 AND status='backlog' ORDER BY priority DESC,queue_position ASC,id ASC LIMIT 1").unwrap();
    stmt.query_row(params![project_id], |row| row_to_task(row))
        .ok()
}

pub fn get_running_count(db: &DbPool, project_id: i64) -> i64 {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM tasks WHERE project_id=?1 AND status='in_progress'").unwrap();
    stmt.query_row(params![project_id], |row| row.get(0))
        .unwrap_or(0)
}

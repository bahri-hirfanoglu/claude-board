use rusqlite::params;
use super::DbPool;
use super::tasks::Task;
use crate::error::AppError;
use std::collections::HashSet;

/// Add a dependency edge: task_id depends on depends_on_id.
/// Returns error if it would create a cycle.
pub fn add_dependency(db: &DbPool, task_id: i64, depends_on_id: i64) -> Result<(), AppError> {
    if task_id == depends_on_id {
        return Err(AppError::NotFound("Task cannot depend on itself".into()));
    }
    if detect_cycle(db, task_id, depends_on_id) {
        return Err(AppError::NotFound("Adding this dependency would create a cycle".into()));
    }
    let conn = db.lock();
    conn.execute(
        "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?1, ?2)",
        params![task_id, depends_on_id],
    )?;
    Ok(())
}

/// Remove a dependency edge.
pub fn remove_dependency(db: &DbPool, task_id: i64, depends_on_id: i64) {
    let conn = db.lock();
    conn.execute(
        "DELETE FROM task_dependencies WHERE task_id=?1 AND depends_on_id=?2",
        params![task_id, depends_on_id],
    ).ok();
}

/// Remove all dependencies for a task (both as child and parent).
pub fn remove_all_for_task(db: &DbPool, task_id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM task_dependencies WHERE task_id=?1 OR depends_on_id=?1", params![task_id]).ok();
}

/// Get parent task IDs (tasks that this task depends on).
pub fn get_parent_ids(db: &DbPool, task_id: i64) -> Vec<i64> {
    let conn = db.lock();
    let mut stmt = conn.prepare(
        "SELECT depends_on_id FROM task_dependencies WHERE task_id=?1"
    ).unwrap();
    stmt.query_map(params![task_id], |r| r.get(0))
        .unwrap()
        .flatten()
        .collect()
}

/// Get child task IDs (tasks that depend on this task).
pub fn get_child_ids(db: &DbPool, task_id: i64) -> Vec<i64> {
    let conn = db.lock();
    let mut stmt = conn.prepare(
        "SELECT task_id FROM task_dependencies WHERE depends_on_id=?1"
    ).unwrap();
    stmt.query_map(params![task_id], |r| r.get(0))
        .unwrap()
        .flatten()
        .collect()
}

/// Check if ALL parent dependencies of a task are met (status = done or testing).
pub fn are_all_parents_met(db: &DbPool, task_id: i64) -> bool {
    let conn = db.lock();
    // Count parents that are NOT done/testing
    let unmet: i64 = conn.query_row(
        "SELECT COUNT(*) FROM task_dependencies td
         JOIN tasks t ON t.id = td.depends_on_id
         WHERE td.task_id = ?1 AND t.status NOT IN ('done', 'testing')",
        params![task_id],
        |r| r.get(0),
    ).unwrap_or(0);
    unmet == 0
}

/// Get all backlog tasks in a project that have all dependencies met (ready to run).
pub fn get_ready_tasks(db: &DbPool, project_id: i64) -> Vec<Task> {
    let conn = db.lock();
    let mut stmt = conn.prepare(
        "SELECT t.* FROM tasks t
         WHERE t.project_id = ?1 AND t.status = 'backlog'
         AND NOT EXISTS (
             SELECT 1 FROM task_dependencies td
             JOIN tasks parent ON parent.id = td.depends_on_id
             WHERE td.task_id = t.id AND parent.status NOT IN ('done', 'testing')
         )
         ORDER BY t.priority DESC, t.queue_position ASC, t.id ASC"
    ).unwrap();
    stmt.query_map(params![project_id], |r| super::tasks::row_to_task(r))
        .unwrap()
        .flatten()
        .collect()
}

/// Detect if adding depends_on_id as a parent of task_id would create a cycle.
/// Uses DFS: walks ancestors of depends_on_id to check if task_id is reachable.
fn detect_cycle(db: &DbPool, task_id: i64, depends_on_id: i64) -> bool {
    let conn = db.lock();
    let mut visited = HashSet::new();
    let mut stack = vec![depends_on_id];

    while let Some(current) = stack.pop() {
        if current == task_id {
            return true;
        }
        if !visited.insert(current) {
            continue;
        }
        let mut stmt = conn.prepare(
            "SELECT depends_on_id FROM task_dependencies WHERE task_id=?1"
        ).unwrap();
        let parents: Vec<i64> = stmt.query_map(params![current], |r| r.get(0))
            .unwrap()
            .flatten()
            .collect();
        stack.extend(parents);
    }
    false
}

/// Get execution waves for a project: groups of tasks that can run in parallel.
/// Wave 0 = no dependencies, Wave 1 = depends only on wave 0, etc.
pub fn get_execution_waves(db: &DbPool, project_id: i64) -> Vec<Vec<Task>> {
    let all_tasks = super::tasks::get_by_project(db, project_id);
    if all_tasks.is_empty() {
        return vec![];
    }

    let mut assigned: HashSet<i64> = HashSet::new();
    let mut waves: Vec<Vec<Task>> = Vec::new();

    // Also treat done/testing tasks as already resolved
    for t in &all_tasks {
        if matches!(t.status.as_deref(), Some("done") | Some("testing")) {
            assigned.insert(t.id);
        }
    }

    let pending: Vec<&Task> = all_tasks.iter()
        .filter(|t| matches!(t.status.as_deref(), Some("backlog") | Some("in_progress")))
        .collect();

    loop {
        let wave: Vec<Task> = pending.iter()
            .filter(|t| !assigned.contains(&t.id))
            .filter(|t| {
                let parents = get_parent_ids(db, t.id);
                parents.is_empty() || parents.iter().all(|p| assigned.contains(p))
            })
            .map(|t| (*t).clone())
            .collect();

        if wave.is_empty() {
            break;
        }

        for t in &wave {
            assigned.insert(t.id);
        }
        waves.push(wave);
    }

    waves
}

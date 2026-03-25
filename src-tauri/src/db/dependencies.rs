use rusqlite::params;
use super::DbPool;
use super::tasks::Task;
use crate::error::AppError;
use std::collections::HashSet;

/// Add a dependency edge: task_id depends on depends_on_id.
/// condition_type: "always" (default), "on_success", "on_failure"
/// Returns error if it would create a cycle.
pub fn add_dependency(db: &DbPool, task_id: i64, depends_on_id: i64, condition_type: Option<&str>) -> Result<(), AppError> {
    if task_id == depends_on_id {
        return Err(AppError::Validation("Task cannot depend on itself".into()));
    }
    if detect_cycle(db, task_id, depends_on_id) {
        return Err(AppError::Validation("Adding this dependency would create a cycle".into()));
    }
    let ctype = condition_type.unwrap_or("always");
    let conn = db.lock();
    conn.execute(
        "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id, condition_type) VALUES (?1, ?2, ?3)",
        params![task_id, depends_on_id, ctype],
    )?;
    Ok(())
}

/// Remove a dependency edge.
pub fn remove_dependency(db: &DbPool, task_id: i64, depends_on_id: i64) -> Result<(), AppError> {
    let conn = db.lock();
    conn.execute(
        "DELETE FROM task_dependencies WHERE task_id=?1 AND depends_on_id=?2",
        params![task_id, depends_on_id],
    )?;
    Ok(())
}

/// Remove all dependencies for a task (both as child and parent).
pub fn remove_all_for_task(db: &DbPool, task_id: i64) -> Result<(), AppError> {
    let conn = db.lock();
    conn.execute("DELETE FROM task_dependencies WHERE task_id=?1 OR depends_on_id=?1", params![task_id])?;
    Ok(())
}

/// Get parent task IDs (tasks that this task depends on).
pub fn get_parent_ids(db: &DbPool, task_id: i64) -> Vec<i64> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT depends_on_id FROM task_dependencies WHERE task_id=?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let result = match stmt.query_map(params![task_id], |r| r.get(0)) {
        Ok(rows) => rows.flatten().collect(),
        Err(_) => vec![],
    };
    result
}

/// Get child task IDs (tasks that depend on this task).
pub fn get_child_ids(db: &DbPool, task_id: i64) -> Vec<i64> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT task_id FROM task_dependencies WHERE depends_on_id=?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let result = match stmt.query_map(params![task_id], |r| r.get(0)) {
        Ok(rows) => rows.flatten().collect(),
        Err(_) => vec![],
    };
    result
}

/// Check if ALL parent dependencies of a task are met, respecting condition_type.
/// - "always" / "on_success": parent must be done or testing
/// - "on_failure": parent must have failed (exhausted retries and still in backlog)
pub fn are_all_parents_met(db: &DbPool, task_id: i64) -> bool {
    let conn = db.lock();

    // Count unmet dependencies using condition-aware logic:
    // "always" or "on_success" → parent.status IN ('done','testing')
    // "on_failure" → parent failed: status='backlog' AND retry_count >= project.max_retries AND retry_count > 0
    //   (a task that was retried and is back in backlog with max retries hit = failed)
    let unmet: i64 = conn.query_row(
        "SELECT COUNT(*) FROM task_dependencies td
         JOIN tasks t ON t.id = td.depends_on_id
         WHERE td.task_id = ?1
         AND NOT (
             CASE COALESCE(td.condition_type, 'always')
                 WHEN 'on_failure' THEN
                     (t.status = 'backlog' AND COALESCE(t.retry_count, 0) > 0)
                 ELSE
                     t.status IN ('done', 'testing')
             END
         )",
        params![task_id],
        |r| r.get(0),
    ).unwrap_or(0);
    unmet == 0
}

/// Get all backlog tasks in a project that have all dependencies met (ready to run).
/// Supports conditional dependencies: always/on_success require parent done/testing,
/// on_failure requires parent to have exhausted retries.
pub fn get_ready_tasks(db: &DbPool, project_id: i64) -> Vec<Task> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT t.* FROM tasks t
         WHERE t.project_id = ?1 AND t.status = 'backlog'
         AND NOT EXISTS (
             SELECT 1 FROM task_dependencies td
             JOIN tasks parent ON parent.id = td.depends_on_id
             WHERE td.task_id = t.id
             AND NOT (
                 CASE COALESCE(td.condition_type, 'always')
                     WHEN 'on_failure' THEN
                         (parent.status = 'backlog' AND COALESCE(parent.retry_count, 0) > 0
                          AND COALESCE(parent.retry_count, 0) >= COALESCE(
                              (SELECT max_retries FROM projects WHERE id = parent.project_id), 0))
                     ELSE
                         parent.status IN ('done', 'testing')
                 END
             )
         )
         ORDER BY t.priority DESC, t.queue_position ASC, t.id ASC"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let result = match stmt.query_map(params![project_id], |r| super::tasks::row_to_task(r)) {
        Ok(rows) => rows.flatten().collect(),
        Err(_) => vec![],
    };
    result
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
        let mut stmt = match conn.prepare(
            "SELECT depends_on_id FROM task_dependencies WHERE task_id=?1"
        ) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let parents: Vec<i64> = match stmt.query_map(params![current], |r| r.get(0)) {
            Ok(rows) => rows.flatten().collect(),
            Err(_) => vec![],
        };
        drop(stmt);
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

/// Get dependency graph summary for a project (used by frontend orchestration view).
pub fn get_graph_data(db: &DbPool, project_id: i64) -> serde_json::Value {
    let all_tasks = super::tasks::get_by_project(db, project_id);

    let edges: Vec<serde_json::Value> = {
        let conn = db.lock();
        let mut stmt = match conn.prepare(
            "SELECT td.task_id, td.depends_on_id, COALESCE(td.condition_type, 'always') FROM task_dependencies td
             JOIN tasks t ON t.id = td.task_id WHERE t.project_id = ?1"
        ) {
            Ok(s) => s,
            Err(_) => return serde_json::json!({ "tasks": all_tasks, "edges": [], "waves": [] }),
        };
        let rows: Vec<(i64, i64, String)> = match stmt.query_map(params![project_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get::<_, String>(2).unwrap_or_else(|_| "always".into())))
        }) {
            Ok(r) => r.flatten().collect(),
            Err(_) => vec![],
        };
        drop(stmt);
        rows.into_iter().map(|(child, parent, ctype)| {
            serde_json::json!({ "from": parent, "to": child, "conditionType": ctype })
        }).collect()
    };

    let waves = get_execution_waves(db, project_id);

    serde_json::json!({
        "tasks": all_tasks,
        "edges": edges,
        "waves": waves.iter().enumerate().map(|(i, w)| {
            serde_json::json!({
                "index": i,
                "taskIds": w.iter().map(|t| t.id).collect::<Vec<_>>(),
            })
        }).collect::<Vec<_>>(),
    })
}

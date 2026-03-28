use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub steps: Option<String>, // JSON array of WorkflowStep
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub title: String,
    pub description: Option<String>,
    pub task_type: Option<String>,
    pub model: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub depends_on_steps: Vec<usize>, // indices into steps array
    pub condition_type: Option<String>, // always, on_success, on_failure, on_any
}

pub fn get_by_project(db: &DbPool, project_id: i64) -> Vec<WorkflowTemplate> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id, project_id, name, description, steps, created_at, updated_at FROM workflow_templates WHERE project_id=?1 ORDER BY name"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("workflows get_by_project: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![project_id], |r| {
        Ok(WorkflowTemplate {
            id: r.get(0)?,
            project_id: r.get(1)?,
            name: r.get(2)?,
            description: r.get(3)?,
            steps: r.get(4)?,
            created_at: r.get(5)?,
            updated_at: r.get(6)?,
        })
    }) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("workflows get_by_project query: {}", e); vec![] }
    };
    result
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<WorkflowTemplate> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT id, project_id, name, description, steps, created_at, updated_at FROM workflow_templates WHERE id=?1"
    ) {
        Ok(s) => s,
        Err(_) => return None,
    };
    let result = stmt.query_row(params![id], |r| {
        Ok(WorkflowTemplate {
            id: r.get(0)?,
            project_id: r.get(1)?,
            name: r.get(2)?,
            description: r.get(3)?,
            steps: r.get(4)?,
            created_at: r.get(5)?,
            updated_at: r.get(6)?,
        })
    }).ok();
    result
}

pub fn create(db: &DbPool, project_id: i64, name: &str, description: &str, steps: &str) -> i64 {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO workflow_templates (project_id, name, description, steps) VALUES (?1, ?2, ?3, ?4)",
        params![project_id, name, description, steps],
    ).ok();
    conn.last_insert_rowid()
}

pub fn update(db: &DbPool, id: i64, name: &str, description: &str, steps: &str) {
    let conn = db.lock();
    conn.execute(
        "UPDATE workflow_templates SET name=?1, description=?2, steps=?3, updated_at=datetime('now','localtime') WHERE id=?4",
        params![name, description, steps, id],
    ).ok();
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM workflow_templates WHERE id=?1", params![id]).ok();
}

use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub template: String,
    pub variables: Option<String>,
    pub task_type: Option<String>,
    pub model: Option<String>,
    pub thinking_effort: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to(row: &rusqlite::Row) -> rusqlite::Result<Template> {
    Ok(Template {
        id: row.get("id")?, project_id: row.get("project_id")?,
        name: row.get("name")?, description: row.get("description")?,
        template: row.get("template")?, variables: row.get("variables")?,
        task_type: row.get("task_type")?, model: row.get("model")?,
        thinking_effort: row.get("thinking_effort")?,
        created_at: row.get("created_at")?, updated_at: row.get("updated_at")?,
    })
}

pub fn get_by_project(db: &DbPool, pid: i64) -> Vec<Template> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM prompt_templates WHERE project_id=?1 ORDER BY id") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_project: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![pid], |r| row_to(r)) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_by_project: {}", e); vec![] }
    };
    result
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Template> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM prompt_templates WHERE id=?1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_id: {}", e); return None; }
    };
    stmt.query_row(params![id], |r| row_to(r)).ok()
}

pub fn create(db: &DbPool, pid: i64, name: &str, description: Option<&str>, template: &str, variables: Option<&str>, task_type: &str, model: &str, thinking_effort: &str) -> i64 {
    let conn = db.lock();
    match conn.execute(
        "INSERT INTO prompt_templates (project_id,name,description,template,variables,task_type,model,thinking_effort) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        params![pid, name, description, template, variables, task_type, model, thinking_effort],
    ) {
        Ok(_) => {},
        Err(e) => { log::error!("create: {}", e); return 0; }
    };
    conn.last_insert_rowid()
}

pub fn update(db: &DbPool, id: i64, name: &str, description: Option<&str>, template: &str, variables: Option<&str>, task_type: &str, model: &str, thinking_effort: &str) {
    let conn = db.lock();
    if let Err(e) = conn.execute(
        "UPDATE prompt_templates SET name=?1,description=?2,template=?3,variables=?4,task_type=?5,model=?6,thinking_effort=?7,updated_at=datetime('now','localtime') WHERE id=?8",
        params![name, description, template, variables, task_type, model, thinking_effort, id],
    ) { log::error!("update: {}", e); }
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    if let Err(e) = conn.execute("DELETE FROM prompt_templates WHERE id=?1", params![id]) { log::error!("delete: {}", e); }
}

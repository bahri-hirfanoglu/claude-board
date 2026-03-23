use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub id: i64,
    pub project_id: i64,
    pub task_id: Option<i64>,
    pub event_type: String,
    pub message: String,
    pub metadata: serde_json::Value,
    pub task_title: Option<String>,
    pub created_at: Option<String>,
}

pub fn add(db: &DbPool, project_id: i64, task_id: Option<i64>, event_type: &str, message: &str, metadata: Option<&str>) {
    let conn = db.lock();
    conn.execute(
        "INSERT INTO activity_log (project_id,task_id,event_type,message,metadata) VALUES (?1,?2,?3,?4,?5)",
        params![project_id, task_id, event_type, message, metadata.unwrap_or("{}")],
    ).ok();
}

pub fn get_by_project(db: &DbPool, project_id: i64, limit: i64, offset: i64) -> Vec<ActivityEntry> {
    let conn = db.lock();
    let mut stmt = conn.prepare(
        "SELECT a.*, t.title as task_title FROM activity_log a LEFT JOIN tasks t ON a.task_id=t.id WHERE a.project_id=?1 ORDER BY a.id DESC LIMIT ?2 OFFSET ?3"
    ).unwrap();
    stmt.query_map(params![project_id, limit, offset], |row| {
        let meta_str: String = row.get::<_, String>("metadata").unwrap_or_else(|_| "{}".into());
        let metadata = serde_json::from_str(&meta_str).unwrap_or(serde_json::Value::Object(Default::default()));
        Ok(ActivityEntry {
            id: row.get("id")?,
            project_id: row.get("project_id")?,
            task_id: row.get("task_id")?,
            event_type: row.get("event_type")?,
            message: row.get("message")?,
            metadata,
            task_title: row.get("task_title").ok(),
            created_at: row.get("created_at")?,
        })
    }).unwrap().flatten().collect()
}

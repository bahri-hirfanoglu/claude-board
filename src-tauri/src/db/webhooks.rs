use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub url: String,
    pub platform: Option<String>,
    pub events: Vec<String>,
    pub enabled: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to(row: &rusqlite::Row) -> rusqlite::Result<Webhook> {
    let events_str: String = row.get::<_, String>("events").unwrap_or_else(|_| "[]".into());
    let events: Vec<String> = serde_json::from_str(&events_str).unwrap_or_default();
    Ok(Webhook {
        id: row.get("id")?, project_id: row.get("project_id")?,
        name: row.get("name")?, url: row.get("url")?,
        platform: row.get("platform")?, events, enabled: row.get("enabled")?,
        created_at: row.get("created_at")?, updated_at: row.get("updated_at")?,
    })
}

pub fn get_by_project(db: &DbPool, pid: i64) -> Vec<Webhook> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM webhooks WHERE project_id=?1 ORDER BY created_at DESC") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_project: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![pid], row_to) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_by_project: {}", e); vec![] }
    };
    result
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Webhook> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM webhooks WHERE id=?1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_id: {}", e); return None; }
    };
    stmt.query_row(params![id], row_to).ok()
}

pub fn get_enabled_by_project(db: &DbPool, pid: i64) -> Vec<Webhook> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM webhooks WHERE project_id=?1 AND enabled=1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_enabled_by_project: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![pid], row_to) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_enabled_by_project: {}", e); vec![] }
    };
    result
}

pub fn create(db: &DbPool, pid: i64, name: &str, url: &str, platform: Option<&str>, events: &[String]) -> i64 {
    let conn = db.lock();
    let events_json = serde_json::to_string(events).unwrap_or_else(|_| "[]".into());
    match conn.execute(
        "INSERT INTO webhooks (project_id,name,url,platform,events) VALUES (?1,?2,?3,?4,?5)",
        params![pid, name, url, platform.unwrap_or("custom"), events_json],
    ) {
        Ok(_) => {},
        Err(e) => { log::error!("create: {}", e); return 0; }
    };
    conn.last_insert_rowid()
}

pub fn update(db: &DbPool, id: i64, name: &str, url: &str, platform: Option<&str>, events: &[String], enabled: bool) {
    let conn = db.lock();
    let events_json = serde_json::to_string(events).unwrap_or_else(|_| "[]".into());
    if let Err(e) = conn.execute(
        "UPDATE webhooks SET name=?1,url=?2,platform=?3,events=?4,enabled=?5,updated_at=datetime('now','localtime') WHERE id=?6",
        params![name, url, platform.unwrap_or("custom"), events_json, enabled as i64, id],
    ) { log::error!("update: {}", e); }
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    if let Err(e) = conn.execute("DELETE FROM webhooks WHERE id=?1", params![id]) { log::error!("delete: {}", e); }
}

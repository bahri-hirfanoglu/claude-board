use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: i64,
    pub task_id: i64,
    pub filename: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
    pub created_at: Option<String>,
}

fn row_to(row: &rusqlite::Row) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get("id")?, task_id: row.get("task_id")?,
        filename: row.get("filename")?, original_name: row.get("original_name")?,
        mime_type: row.get("mime_type")?, size: row.get("size")?,
        created_at: row.get("created_at")?,
    })
}

pub fn get_by_task(db: &DbPool, task_id: i64) -> Vec<Attachment> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM task_attachments WHERE task_id=?1 ORDER BY id") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_task: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![task_id], |r| row_to(r)) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_by_task: {}", e); vec![] }
    };
    result
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Attachment> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM task_attachments WHERE id=?1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_id: {}", e); return None; }
    };
    stmt.query_row(params![id], |r| row_to(r)).ok()
}

pub fn create(db: &DbPool, task_id: i64, filename: &str, original_name: &str, mime_type: Option<&str>, size: i64) -> i64 {
    let conn = db.lock();
    match conn.execute(
        "INSERT INTO task_attachments (task_id,filename,original_name,mime_type,size) VALUES (?1,?2,?3,?4,?5)",
        params![task_id, filename, original_name, mime_type, size],
    ) {
        Ok(_) => {},
        Err(e) => { log::error!("create: {}", e); return 0; }
    };
    conn.last_insert_rowid()
}

pub fn remove(db: &DbPool, id: i64) {
    let conn = db.lock();
    if let Err(e) = conn.execute("DELETE FROM task_attachments WHERE id=?1", params![id]) { log::error!("remove: {}", e); }
}

pub fn remove_by_task(db: &DbPool, task_id: i64) {
    let conn = db.lock();
    if let Err(e) = conn.execute("DELETE FROM task_attachments WHERE task_id=?1", params![task_id]) { log::error!("remove_by_task: {}", e); }
}

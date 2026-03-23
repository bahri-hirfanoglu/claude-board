use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: i64,
    pub project_id: i64,
    pub title: String,
    pub content: String,
    pub enabled: Option<i64>,
    pub sort_order: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

fn row_to_snippet(row: &rusqlite::Row) -> rusqlite::Result<Snippet> {
    Ok(Snippet {
        id: row.get("id")?, project_id: row.get("project_id")?,
        title: row.get("title")?, content: row.get("content")?,
        enabled: row.get("enabled")?, sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?, updated_at: row.get("updated_at")?,
    })
}

pub fn get_by_project(db: &DbPool, pid: i64) -> Vec<Snippet> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM context_snippets WHERE project_id=?1 ORDER BY sort_order,id").unwrap();
    stmt.query_map(params![pid], |r| row_to_snippet(r)).unwrap().flatten().collect()
}

pub fn get_enabled_by_project(db: &DbPool, pid: i64) -> Vec<Snippet> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM context_snippets WHERE project_id=?1 AND enabled=1 ORDER BY sort_order,id").unwrap();
    stmt.query_map(params![pid], |r| row_to_snippet(r)).unwrap().flatten().collect()
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Snippet> {
    let conn = db.lock();
    let mut stmt = conn.prepare("SELECT * FROM context_snippets WHERE id=?1").unwrap();
    stmt.query_row(params![id], |r| row_to_snippet(r)).ok()
}

pub fn create(db: &DbPool, pid: i64, title: &str, content: &str) -> i64 {
    let conn = db.lock();
    conn.execute("INSERT INTO context_snippets (project_id,title,content) VALUES (?1,?2,?3)", params![pid, title, content]).unwrap();
    conn.last_insert_rowid()
}

pub fn update(db: &DbPool, id: i64, title: &str, content: &str, enabled: bool) {
    let conn = db.lock();
    conn.execute(
        "UPDATE context_snippets SET title=?1,content=?2,enabled=?3,updated_at=datetime('now','localtime') WHERE id=?4",
        params![title, content, enabled as i64, id],
    ).unwrap();
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    conn.execute("DELETE FROM context_snippets WHERE id=?1", params![id]).unwrap();
}

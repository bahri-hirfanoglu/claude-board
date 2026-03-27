use rusqlite::params;
use serde::{Deserialize, Serialize};
use super::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scan {
    pub id: i64,
    pub project_id: i64,
    pub scan_type: String,
    pub content: String,
    pub summary: Option<String>,
    pub tech_stack: Option<String>,
    pub file_count: i64,
    pub line_count: i64,
    pub languages: Option<String>,
    pub project_types: Option<String>,
    pub created_at: String,
}

fn row_to_scan(row: &rusqlite::Row) -> rusqlite::Result<Scan> {
    Ok(Scan {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        scan_type: row.get("scan_type")?,
        content: row.get("content")?,
        summary: row.get("summary")?,
        tech_stack: row.get("tech_stack")?,
        file_count: row.get("file_count")?,
        line_count: row.get("line_count")?,
        languages: row.get("languages")?,
        project_types: row.get("project_types")?,
        created_at: row.get("created_at")?,
    })
}

#[allow(clippy::too_many_arguments)]
pub fn create(
    db: &DbPool, project_id: i64, scan_type: &str, content: &str,
    summary: Option<&str>, tech_stack: Option<&str>,
    file_count: i64, line_count: i64,
    languages: Option<&str>, project_types: Option<&str>,
) -> i64 {
    let conn = db.lock();
    match conn.execute(
        "INSERT INTO scans (project_id, scan_type, content, summary, tech_stack, file_count, line_count, languages, project_types) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![project_id, scan_type, content, summary, tech_stack, file_count, line_count, languages, project_types],
    ) {
        Ok(_) => {}
        Err(e) => { log::error!("create scan: {}", e); return 0; }
    };
    conn.last_insert_rowid()
}

pub fn get_by_project(db: &DbPool, project_id: i64) -> Vec<Scan> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM scans WHERE project_id=?1 ORDER BY created_at DESC LIMIT 20") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_project: {}", e); return vec![]; }
    };
    let result = match stmt.query_map(params![project_id], row_to_scan) {
        Ok(rows) => rows.flatten().collect(),
        Err(e) => { log::error!("get_by_project: {}", e); vec![] }
    };
    result
}

pub fn get_by_id(db: &DbPool, id: i64) -> Option<Scan> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM scans WHERE id=?1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_by_id: {}", e); return None; }
    };
    stmt.query_row(params![id], row_to_scan).ok()
}

pub fn get_latest(db: &DbPool, project_id: i64) -> Option<Scan> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT * FROM scans WHERE project_id=?1 ORDER BY created_at DESC LIMIT 1") {
        Ok(s) => s,
        Err(e) => { log::error!("get_latest: {}", e); return None; }
    };
    stmt.query_row(params![project_id], row_to_scan).ok()
}

pub fn delete(db: &DbPool, id: i64) {
    let conn = db.lock();
    if let Err(e) = conn.execute("DELETE FROM scans WHERE id=?1", params![id]) {
        log::error!("delete scan: {}", e);
    }
}

pub fn cleanup_old(db: &DbPool, project_id: i64, keep_count: usize) {
    let conn = db.lock();
    // Get the id of the Nth most recent scan, then delete everything older
    let mut stmt = match conn.prepare(
        "SELECT id FROM scans WHERE project_id=?1 ORDER BY created_at DESC LIMIT 1 OFFSET ?2"
    ) {
        Ok(s) => s,
        Err(e) => { log::error!("cleanup_old: {}", e); return; }
    };
    let cutoff_id: Option<i64> = stmt.query_row(params![project_id, keep_count as i64], |row| row.get(0)).ok();
    if let Some(cutoff) = cutoff_id {
        if let Err(e) = conn.execute(
            "DELETE FROM scans WHERE project_id=?1 AND id < ?2",
            params![project_id, cutoff],
        ) {
            log::error!("cleanup_old delete: {}", e);
        }
    }
}

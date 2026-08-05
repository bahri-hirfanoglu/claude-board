//! Storage for the synced model catalog: the upstream cache and the tombstones
//! that keep a user's deletion from being undone by the next sync.

use rusqlite::params;

use crate::db::DbPool;
use crate::services::model_catalog::ModelEntry;

/// Swaps the whole upstream cache inside one transaction, so an interrupted
/// write can never leave a half-populated catalog.
///
/// An empty payload is rejected: `derive_models` returns empty for anything it
/// cannot read, and emptying the cache on a bad response would strip the model
/// dropdown for a user who is merely offline.
pub fn replace_upstream(db: &DbPool, rows: &[ModelEntry]) -> Result<(), String> {
    if rows.is_empty() {
        return Err("refusing to replace the model cache with an empty list".into());
    }
    crate::db::with_transaction(db, |conn| {
        conn.execute("DELETE FROM upstream_models", [])
            .map_err(|e| e.to_string())?;
        for r in rows {
            conn.execute(
                "INSERT INTO upstream_models
                    (model_id, label, color, input_cost_per_mtok, output_cost_per_mtok, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    r.value,
                    r.label,
                    r.color,
                    r.input_cost_per_mtok,
                    r.output_cost_per_mtok,
                    r.sort_order
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

pub fn list_upstream(db: &DbPool) -> Vec<ModelEntry> {
    let conn = db.lock();
    let mut stmt = match conn.prepare(
        "SELECT model_id, label, color, input_cost_per_mtok, output_cost_per_mtok, sort_order
         FROM upstream_models ORDER BY sort_order ASC, model_id ASC",
    ) {
        Ok(s) => s,
        Err(e) => {
            log::error!("upstream_models prepare: {}", e);
            return vec![];
        }
    };
    let rows = stmt.query_map([], |row| {
        Ok(ModelEntry {
            value: row.get(0)?,
            label: row.get(1)?,
            color: row.get(2).ok(),
            source: "upstream".into(),
            input_cost_per_mtok: row.get(3).ok(),
            output_cost_per_mtok: row.get(4).ok(),
            custom_id: None,
            sort_order: row.get::<_, i64>(5).unwrap_or(0),
        })
    });
    match rows {
        Ok(it) => it.flatten().collect(),
        Err(e) => {
            log::error!("upstream_models query: {}", e);
            vec![]
        }
    }
}

/// Newest `synced_at` in the cache, or `None` when it has never been written.
pub fn synced_at(db: &DbPool) -> Option<String> {
    let conn = db.lock();
    conn.query_row("SELECT MAX(synced_at) FROM upstream_models", [], |r| {
        r.get::<_, Option<String>>(0)
    })
    .ok()
    .flatten()
}

/// Hours elapsed since `ts`, computed by SQLite so it matches how the timestamp
/// was written. `None` when the value cannot be parsed.
pub fn hours_since(db: &DbPool, ts: &str) -> Option<i64> {
    let conn = db.lock();
    conn.query_row(
        "SELECT CAST((julianday(datetime('now','localtime')) - julianday(?1)) * 24 AS INTEGER)",
        params![ts],
        |r| r.get::<_, Option<i64>>(0),
    )
    .ok()
    .flatten()
}

pub fn add_tombstone(db: &DbPool, model_id: &str) -> Result<(), String> {
    let conn = db.lock();
    conn.execute(
        "INSERT OR IGNORE INTO model_tombstones (model_id) VALUES (?1)",
        params![model_id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn remove_tombstone(db: &DbPool, model_id: &str) -> Result<(), String> {
    let conn = db.lock();
    conn.execute(
        "DELETE FROM model_tombstones WHERE model_id=?1",
        params![model_id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

pub fn list_tombstones(db: &DbPool) -> Vec<String> {
    let conn = db.lock();
    let mut stmt = match conn.prepare("SELECT model_id FROM model_tombstones") {
        Ok(s) => s,
        Err(e) => {
            log::error!("model_tombstones prepare: {}", e);
            return vec![];
        }
    };
    let rows = stmt.query_map([], |r| r.get::<_, String>(0));
    match rows {
        Ok(it) => it.flatten().collect(),
        Err(e) => {
            log::error!("model_tombstones query: {}", e);
            vec![]
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use parking_lot::Mutex;
    use std::sync::Arc;

    fn pool() -> DbPool {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        schema::create_tables(&conn);
        Arc::new(Mutex::new(conn))
    }

    fn entry(value: &str, sort: i64) -> ModelEntry {
        ModelEntry {
            value: value.into(),
            label: format!("Label {}", value),
            color: Some("bg-purple-500/20 text-purple-300".into()),
            source: "upstream".into(),
            input_cost_per_mtok: Some(5.0),
            output_cost_per_mtok: Some(25.0),
            custom_id: None,
            sort_order: sort,
        }
    }

    #[test]
    fn round_trips_upstream_rows_in_sort_order() {
        let db = pool();
        replace_upstream(&db, &[entry("b", 20), entry("a", 10)]).unwrap();
        let got = list_upstream(&db);
        assert_eq!(
            got.iter().map(|r| r.value.as_str()).collect::<Vec<_>>(),
            vec!["a", "b"]
        );
        assert_eq!(got[0].label, "Label a");
        assert_eq!(got[0].input_cost_per_mtok, Some(5.0));
        assert_eq!(got[0].source, "upstream");
    }

    #[test]
    fn replace_upstream_drops_rows_absent_from_the_new_payload() {
        let db = pool();
        replace_upstream(&db, &[entry("old", 10), entry("keep", 20)]).unwrap();
        replace_upstream(&db, &[entry("keep", 20)]).unwrap();
        assert_eq!(
            list_upstream(&db)
                .iter()
                .map(|r| r.value.as_str())
                .collect::<Vec<_>>(),
            vec!["keep"]
        );
    }

    #[test]
    fn replace_upstream_rejects_an_empty_payload() {
        let db = pool();
        replace_upstream(&db, &[entry("keep", 10)]).unwrap();
        assert!(replace_upstream(&db, &[]).is_err());
        assert_eq!(
            list_upstream(&db).len(),
            1,
            "a bad sync must not empty the cache"
        );
    }

    #[test]
    fn records_a_sync_timestamp() {
        let db = pool();
        assert!(synced_at(&db).is_none());
        replace_upstream(&db, &[entry("a", 10)]).unwrap();
        assert!(synced_at(&db).is_some());
    }

    #[test]
    fn reports_a_fresh_cache_as_zero_hours_old() {
        let db = pool();
        replace_upstream(&db, &[entry("a", 10)]).unwrap();
        let ts = synced_at(&db).unwrap();
        assert_eq!(hours_since(&db, &ts), Some(0));
        assert_eq!(hours_since(&db, "not a timestamp"), None);
    }

    #[test]
    fn tombstones_add_list_and_remove() {
        let db = pool();
        add_tombstone(&db, "opus").unwrap();
        add_tombstone(&db, "opus").unwrap(); // idempotent
        assert_eq!(list_tombstones(&db), vec!["opus"]);
        remove_tombstone(&db, "opus").unwrap();
        assert!(list_tombstones(&db).is_empty());
    }
}

pub mod schema;
pub mod tasks;
pub mod projects;
pub mod stats;
pub mod activity;
pub mod snippets;
pub mod templates;
pub mod attachments;
pub mod webhooks;
pub mod roles;
pub mod auth;
pub mod dependencies;
pub mod scans;
pub mod settings;

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Arc;

pub type DbPool = Arc<Mutex<Connection>>;

static DB_POOL: OnceCell<DbPool> = OnceCell::new();
static DATA_DIR: OnceCell<PathBuf> = OnceCell::new();

pub fn init_db(data_dir: &str) -> DbPool {
    let data_path = PathBuf::from(data_dir);
    std::fs::create_dir_all(&data_path).ok();
    DATA_DIR.set(data_path.clone()).ok();

    let db_path = data_path.join("data.db");

    // Legacy migration
    let legacy_path = data_path.join("tasks.db");
    if !db_path.exists() && legacy_path.exists() {
        std::fs::copy(&legacy_path, &db_path).ok();
    }

    let conn = Connection::open(&db_path).expect("Failed to open database");
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
        .expect("Failed to set PRAGMA");

    schema::create_tables(&conn);
    schema::run_migrations(&conn);

    let pool = Arc::new(Mutex::new(conn));
    DB_POOL.set(pool.clone()).ok();
    pool
}

pub fn get_db() -> DbPool {
    DB_POOL.get().expect("Database not initialized").clone()
}

pub fn get_data_dir() -> PathBuf {
    DATA_DIR.get().expect("Data directory not set").clone()
}

/// Execute a closure within a SQLite transaction.
/// Automatically commits on success, rolls back on error.
pub fn with_transaction<F, T>(db: &DbPool, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let conn = db.lock();
    conn.execute_batch("BEGIN IMMEDIATE").map_err(|e| format!("begin: {}", e))?;
    match f(&conn) {
        Ok(result) => {
            conn.execute_batch("COMMIT").map_err(|e| format!("commit: {}", e))?;
            Ok(result)
        }
        Err(e) => {
            conn.execute_batch("ROLLBACK").ok();
            Err(e)
        }
    }
}

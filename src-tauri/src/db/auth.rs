use rusqlite::params;
use sha2::{Sha256, Digest};
use super::DbPool;

fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_api_key(db: &DbPool) -> String {
    let key = hex::encode(rand::random::<[u8; 32]>());
    let hash = hash_key(&key);
    let conn = db.lock();
    if let Err(e) = conn.execute(
        "INSERT INTO auth_config (id, api_key_hash, enabled) VALUES (1, ?1, 1) ON CONFLICT(id) DO UPDATE SET api_key_hash=excluded.api_key_hash, enabled=1",
        params![hash],
    ) { log::error!("generate_api_key: {}", e); }
    key
}

pub fn disable_auth(db: &DbPool) {
    let conn = db.lock();
    if let Err(e) = conn.execute(
        "INSERT INTO auth_config (id, enabled) VALUES (1, 0) ON CONFLICT(id) DO UPDATE SET enabled=0",
        [],
    ) { log::error!("disable_auth: {}", e); }
}

pub fn is_auth_enabled(db: &DbPool) -> bool {
    let conn = db.lock();
    let result: Option<(i64, Option<String>)> = conn
        .prepare("SELECT enabled, api_key_hash FROM auth_config WHERE id=1")
        .ok()
        .and_then(|mut s| s.query_row([], |r| Ok((r.get(0)?, r.get(1)?))).ok());
    match result {
        Some((enabled, hash)) => enabled == 1 && hash.as_ref().map_or(false, |h| !h.is_empty()),
        None => false,
    }
}

pub fn validate_key(db: &DbPool, token: &str) -> bool {
    let conn = db.lock();
    let stored: Option<(i64, String)> = conn
        .prepare("SELECT enabled, api_key_hash FROM auth_config WHERE id=1")
        .ok()
        .and_then(|mut s| s.query_row([], |r| Ok((r.get(0)?, r.get::<_, String>(1)?))).ok());
    match stored {
        Some((enabled, hash)) => enabled == 1 && hash_key(token) == hash,
        None => false,
    }
}

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data.db');
const LEGACY_PATH = join(__dirname, '..', '..', 'tasks.db');

const SQL = await initSqlJs();
const dbPath = existsSync(DB_PATH) ? DB_PATH : existsSync(LEGACY_PATH) ? LEGACY_PATH : DB_PATH;
const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Debounced save
let saveTimer = null;
export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    try { writeFileSync(DB_PATH, Buffer.from(db.export())); } catch (e) { console.error('[DB] Save error:', e.message); }
    saveTimer = null;
  }, 100);
}

export function saveSync() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { writeFileSync(DB_PATH, Buffer.from(db.export())); } catch (e) { console.error('[DB] Save error:', e.message); }
}

// Query helpers
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try { stmt.bind(params); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows; }
  finally { stmt.free(); }
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  try { stmt.bind(params); return stmt.step() ? stmt.getAsObject() : null; }
  finally { stmt.free(); }
}

export function run(sql, params = []) {
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id, changes() as changes");
  save();
  return { lastInsertRowid: Number(result[0]?.values[0]?.[0] ?? 0) };
}

// Cross-platform graceful shutdown
process.on('SIGINT', saveSync);   // Ctrl+C on all platforms
process.on('SIGTERM', saveSync);  // Docker/systemd stop (Unix)
process.on('exit', saveSync);     // Final flush on any exit

export default db;

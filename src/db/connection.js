import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');

// DB storage: CLAUDE_BOARD_DATA env > projectRoot/data/ directory
const dataDir = process.env.CLAUDE_BOARD_DATA || join(projectRoot, 'data');
try {
  mkdirSync(dataDir, { recursive: true });
} catch {}

const DB_PATH = join(dataDir, 'data.db');
const LEGACY_PATH = join(dataDir, 'tasks.db');

// Migrate legacy DB from project root to data/ if needed
const legacyRootDb = join(projectRoot, 'data.db');
const legacyRootTasks = join(projectRoot, 'tasks.db');
if (!existsSync(DB_PATH) && !existsSync(LEGACY_PATH)) {
  if (existsSync(legacyRootDb)) copyFileSync(legacyRootDb, DB_PATH);
  else if (existsSync(legacyRootTasks)) copyFileSync(legacyRootTasks, LEGACY_PATH);
}

// sql.js wasm: use unpacked path in Electron
const sqlJsRoot = __dirname.includes('app.asar') ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname;
const SQL = await initSqlJs({
  locateFile: (file) => join(sqlJsRoot, '..', '..', 'node_modules', 'sql.js', 'dist', file),
});
const dbPath = existsSync(DB_PATH) ? DB_PATH : existsSync(LEGACY_PATH) ? LEGACY_PATH : DB_PATH;
const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Debounced save
let saveTimer = null;
export function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(DB_PATH, Buffer.from(db.export()));
    } catch (e) {
      console.error('[DB] Save error:', e.message);
    }
    saveTimer = null;
  }, 100);
}

export function saveSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (e) {
    console.error('[DB] Save error:', e.message);
  }
}

// Query helpers
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    return stmt.step() ? stmt.getAsObject() : null;
  } finally {
    stmt.free();
  }
}

export function run(sql, params = []) {
  db.run(sql, params);
  const result = db.exec('SELECT last_insert_rowid() as id, changes() as changes');
  save();
  return { lastInsertRowid: Number(result[0]?.values[0]?.[0] ?? 0) };
}

// Cross-platform graceful shutdown
process.on('SIGINT', saveSync);
process.on('SIGTERM', saveSync);
process.on('exit', saveSync);

export default db;

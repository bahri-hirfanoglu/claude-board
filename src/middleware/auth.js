import crypto from 'crypto';
import { queryOne, run } from '../db/connection.js';

// Ensure auth config table exists
try {
  const { default: db } = await import('../db/connection.js');
  db.run(`CREATE TABLE IF NOT EXISTS auth_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    api_key_hash TEXT,
    enabled INTEGER DEFAULT 0
  )`);
} catch {}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Generate a new API key and store its hash
export function generateApiKey() {
  const key = crypto.randomBytes(32).toString('hex');
  const hash = hashKey(key);
  run(
    `INSERT INTO auth_config (id, api_key_hash, enabled) VALUES (1, ?, 1)
     ON CONFLICT(id) DO UPDATE SET api_key_hash=excluded.api_key_hash, enabled=1`,
    [hash]
  );
  return key;
}

// Disable auth
export function disableAuth() {
  run(
    `INSERT INTO auth_config (id, enabled) VALUES (1, 0)
     ON CONFLICT(id) DO UPDATE SET enabled=0`,
    []
  );
}

// Check if auth is enabled
export function isAuthEnabled() {
  const row = queryOne('SELECT * FROM auth_config WHERE id=1');
  return row?.enabled === 1 && !!row?.api_key_hash;
}

// Express middleware
export function authMiddleware(req, res, next) {
  const config = queryOne('SELECT * FROM auth_config WHERE id=1');

  // Auth not enabled — allow all
  if (!config || !config.enabled || !config.api_key_hash) {
    return next();
  }

  // Check header: Authorization: Bearer <key>
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'API key required. Set Authorization: Bearer <key>' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (hashKey(token) !== config.api_key_hash) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

// Socket.IO auth middleware
export function socketAuthMiddleware(socket, next) {
  const config = queryOne('SELECT * FROM auth_config WHERE id=1');
  if (!config || !config.enabled || !config.api_key_hash) {
    return next();
  }

  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || hashKey(token) !== config.api_key_hash) {
    return next(new Error('Authentication required'));
  }
  next();
}

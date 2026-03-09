import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function initDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_label TEXT,
      telegram_message_id INTEGER NOT NULL,
      topic_id INTEGER,
      message_date TEXT NOT NULL,
      text_raw TEXT,
      text_normalized TEXT,
      price_raw TEXT,
      price_value REAL,
      price_currency TEXT,
      price_value_eur REAL,
      fx_rate_used REAL,
      fx_date TEXT,
      message_link TEXT,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_id, telegram_message_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      matched_price REAL,
      matched_currency TEXT,
      score REAL DEFAULT 1.0,
      notified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rule_id, message_id),
      FOREIGN KEY(message_id) REFERENCES messages(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      error_text TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function insertMessage(msg) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages (
      channel_id, channel_label, telegram_message_id, topic_id, message_date,
      text_raw, text_normalized, price_raw, price_value,
      price_currency, price_value_eur, fx_rate_used, fx_date,
      message_link, content_hash
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const result = stmt.run(
    msg.channel_id, msg.channel_label, msg.telegram_message_id, msg.topic_id || null, msg.message_date,
    msg.text_raw, msg.text_normalized, msg.price_raw, msg.price_value,
    msg.price_currency, msg.price_value_eur, msg.fx_rate_used, msg.fx_date,
    msg.message_link, msg.content_hash
  );

  return result.lastInsertRowid;
}

export function insertMatch(match) {
  const stmt = db.prepare(`
    INSERT INTO matches (rule_id, message_id, matched_price, matched_currency, score)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    match.ruleId, match.messageId, match.matchedPrice, match.matchedCurrency, match.score || 1.0
  );

  return result.lastInsertRowid;
}

export function insertNotification(notif) {
  const stmt = db.prepare(`
    INSERT INTO notifications (match_id, method, status, error_text)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    notif.matchId, notif.method, notif.status, notif.errorText || null
  );

  return result.lastInsertRowid;
}

export function findRecentDuplicateByHash(hash) {
  // For MVP version 1.1 - just a placeholder or basic check
  const stmt = db.prepare('SELECT id FROM messages WHERE content_hash = ? LIMIT 1');
  return stmt.get(hash);
}

export function getState(key) {
  const stmt = db.prepare('SELECT value FROM state WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

export function setState(key, value) {
  const stmt = db.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  stmt.run(key, value);
}

export function closeDb() {
  if (db) db.close();
}

/**
 * backend/db.js — SQLite 基础层（Node 内置 node:sqlite，零第三方依赖）
 *
 * V2 / V3 的数据全部落在这里：
 *   posts           文章（正文即 Markdown，字段与 V1 的 md 前言一一对应）
 *   moments         瞬间
 *   comments        评论（data 列保存原始 JSON，字段随业务自由扩展）
 *   module_items    工具 / 状态 / 奇奇怪怪等配置型列表
 *   kv              站点配置、友链、通知、IndexNow、Telegram、备份设置、管理员凭据、会话
 *   meta            结构版本号
 *
 * 上传的图片与附件仍然放在 img/ 与 file/ 目录：文件系统更适合存二进制，
 * 数据库里只存它们的相对路径（正文里的 /img/...）。
 *
 * 需要 Node >= 22.5（node:sqlite 从 22.5 开始提供，24 起稳定）。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DB_DIR || path.join(ROOT_DIR, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'blog.db');

if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

// WAL：读写不互相阻塞，备份时可以直接拷 .db 文件
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  hidden INTEGER NOT NULL DEFAULT 0,
  enc INTEGER NOT NULL DEFAULT 0,
  encsalt TEXT NOT NULL DEFAULT '',
  enciv TEXT NOT NULL DEFAULT '',
  enctag TEXT NOT NULL DEFAULT '',
  enchint TEXT NOT NULL DEFAULT '',
  encpwd TEXT NOT NULL DEFAULT '',
  mtime INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  hidden INTEGER NOT NULL DEFAULT 0,
  enc INTEGER NOT NULL DEFAULT 0,
  encsalt TEXT NOT NULL DEFAULT '',
  enciv TEXT NOT NULL DEFAULT '',
  enctag TEXT NOT NULL DEFAULT '',
  enchint TEXT NOT NULL DEFAULT '',
  encpwd TEXT NOT NULL DEFAULT '',
  mtime INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE (post_id, id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);

CREATE TABLE IF NOT EXISTS module_items (
  module TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (module, id)
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0
);
`;

db.exec(SCHEMA);
// 兼容已有数据库：老库没有 encpwd 列时补上（文章加密后后台自动解密用）
for (const table of ['posts', 'moments']) {
  const cols = all('PRAGMA table_info(' + table + ')');
  if (!cols.some((c) => c.name === 'encpwd')) {
    db.exec('ALTER TABLE ' + table + " ADD COLUMN encpwd TEXT NOT NULL DEFAULT ''");
  }
}

db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '2');

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

// 事务：node:sqlite 没有封装的 tx 包装器，自己来
let depth = 0;
function tx(task) {
  if (depth > 0) return task();
  depth++;
  db.exec('BEGIN');
  try {
    const out = task();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (ignored) {}
    throw e;
  } finally {
    depth--;
  }
}

function kvGet(key, fallback) {
  const row = get('SELECT value FROM kv WHERE key = ?', String(key));
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return fallback;
  }
}

function kvSet(key, value) {
  run(
    'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    String(key), JSON.stringify(value), Date.now()
  );
  return value;
}

function kvDel(key) {
  run('DELETE FROM kv WHERE key = ?', String(key));
}

function kvKeys() {
  return all('SELECT key FROM kv ORDER BY key').map(r => r.key);
}

module.exports = {
  db,
  DB_FILE,
  DATA_DIR,
  SCHEMA,
  all,
  get,
  run,
  tx,
  kvGet,
  kvSet,
  kvDel,
  kvKeys
};

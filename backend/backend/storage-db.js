/**
 * backend/storage-db.js — SQLite 存储层（V2 / V3）
 *
 * 与 storage-file.js 导出完全相同的函数签名，server.js / transfer.js / 后台接口
 * 都无感知地用同一套调用，只是数据落库而不是落文件。
 * 想切回文件存储：`STORE=file node server.js`。
 *
 * 二进制（图片 / 附件）仍放 img/ 与 file/，数据库里只存正文中的相对路径。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const mdparse = require('./mdparse');
const text = require('./text');

const VARIANT = 'sqlite';

// 与文件版保持一致的路径常量（升级、导出、备份代码会引用）
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLE_DIR = path.join(ROOT_DIR, 'article');
const MUSINGS_DIR = path.join(ROOT_DIR, 'Musings');
const IMG_DIR = path.join(ROOT_DIR, 'img');
const FILE_DIR = path.join(ROOT_DIR, 'file');

const CN_TIMEZONE = 'Asia/Shanghai';
const cnDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const normalizeTags = mdparse.normalizeTags;
const sanitizeId = text.sanitizeId;
const sanitizeFileName = text.sanitizeFileName;
const collectCascadeIds = text.collectCascadeIds;
const summarizeItem = text.summarizeItem;
const excerptOf = text.excerptOf;
const dateMsOf = text.dateMsOf;
const sortNewestFirst = text.sortNewestFirst;

function cnDateOf(d) {
  return cnDateFmt.format(d instanceof Date ? d : new Date(d));
}

function cnNowStamp() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const p = v => String(v).padStart(2, '0');
  return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate()) +
    ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
}

function getDateFolder() {
  return cnDateOf(new Date());
}

function writeFileAtomic(file, data, encoding) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmp, data, encoding || 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (ignored) {}
    fs.writeFileSync(file, data, encoding || 'utf8');
  }
}

const writeChains = new Map();
function withWriteLock(key, task) {
  const prev = writeChains.get(key) || Promise.resolve();
  const run = prev.then(() => task(), () => task());
  const tail = run.then(() => {}, () => {});
  writeChains.set(key, tail);
  tail.then(() => {
    if (writeChains.get(key) === tail) writeChains.delete(key);
  });
  return run;
}

// ---- 行 ↔ 对象 ----
function rowToItem(row) {
  if (!row) return null;
  let tags = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch (e) {
    tags = normalizeTags(row.tag || '');
  }
  if (!Array.isArray(tags)) tags = normalizeTags(row.tag || '');
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    tag: row.tag,
    tags: tags,
    hidden: Boolean(row.hidden),
    enc: Boolean(row.enc),
    encsalt: row.encsalt || '',
    enciv: row.enciv || '',
    enctag: row.enctag || '',
    enchint: row.enchint || '',
    encpwd: row.encpwd || '',
    mtime: Number(row.mtime) || 0,
    content: row.content || ''
  };
}

function itemToRow(item, table) {
  return [
    item.id,
    String(item.title || ''),
    String(item.date || ''),
    String(item.tag || ''),
    JSON.stringify(Array.isArray(item.tags) ? item.tags : normalizeTags(item.tag || '')),
    item.hidden ? 1 : 0,
    item.enc ? 1 : 0,
    String(item.encsalt || ''),
    String(item.enciv || ''),
    String(item.enctag || ''),
    String(item.enchint || ''),
    String(item.encpwd || ''),
    Number(item.mtime) || 0,
    String(item.content || ''),
    Date.now(),
    Date.now()
  ];
}

const UPSERT_SQL = (table) =>
  'INSERT INTO ' + table + ' (id, title, date, tag, tags, hidden, enc, encsalt, enciv, enctag, enchint, encpwd, mtime, content, created_at, updated_at) ' +
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
  'ON CONFLICT(id) DO UPDATE SET title = excluded.title, date = excluded.date, tag = excluded.tag, tags = excluded.tags, ' +
  'hidden = excluded.hidden, enc = excluded.enc, encsalt = excluded.encsalt, enciv = excluded.enciv, enctag = excluded.enctag, ' +
  'enchint = excluded.enchint, encpwd = excluded.encpwd, mtime = excluded.mtime, content = excluded.content, updated_at = excluded.updated_at';

// ---- 读 ----
// 文章是否存在：给路由层用，避免它们直接摸文件路径
function postExists(id) {
  const safe = String(id || '').trim();
  if (!safe) return false;
  const row = db.get('SELECT 1 AS ok FROM posts WHERE id = ?', safe);
  return Boolean(row && row.ok);
}

function readArticles() {
  const rows = db.all('SELECT * FROM posts ORDER BY mtime DESC');
  return sortNewestFirst(rows.map(rowToItem));
}

function readMusings() {
  const rows = db.all('SELECT * FROM moments ORDER BY mtime DESC');
  return sortNewestFirst(rows.map(rowToItem));
}

function readPostComments(postId) {
  const rows = db.all('SELECT data FROM comments WHERE post_id = ? ORDER BY seq ASC', String(sanitizeId(postId)));
  const list = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      list.push(JSON.parse(rows[i].data));
    } catch (e) { /* 坏数据跳过 */ }
  }
  return list;
}

function savePostComments(postId, commentsList) {
  const post = String(sanitizeId(postId));
  const list = Array.isArray(commentsList) ? commentsList : [];
  db.tx(() => {
    db.run('DELETE FROM comments WHERE post_id = ?', post);
    for (let i = 0; i < list.length; i++) {
      const c = list[i] || {};
      const id = String(c.id != null ? c.id : 'c-' + Date.now() + '-' + i);
      db.run(
        'INSERT OR REPLACE INTO comments (post_id, id, data) VALUES (?, ?, ?)',
        post, id, JSON.stringify(c)
      );
    }
  });
}

function mutatePostComments(postId, mutator) {
  const safeId = String(sanitizeId(postId));
  return withWriteLock('comments:' + safeId, () => {
    const list = readPostComments(safeId);
    const result = mutator(list) || {};
    if (result.changed !== false) savePostComments(safeId, list);
    return result;
  });
}

function readAllCommentsAcrossArticles() {
  const rows = db.all('SELECT post_id, data FROM comments ORDER BY seq ASC');
  const titles = Object.create(null);
  db.all('SELECT id, title FROM posts').forEach(r => { titles[r.id] = r.title; });
  const all = [];
  for (let i = 0; i < rows.length; i++) {
    let c;
    try {
      c = JSON.parse(rows[i].data);
    } catch (e) { continue; }
    c.postId = rows[i].post_id;
    c.postTitle = titles[rows[i].post_id] || rows[i].post_id;
    all.push(c);
  }
  return sortNewestFirst(all);
}

// ---- 配置型模块（tools / status / quirky …）----
function moduleNames() {
  const fixed = ['tools', 'status', 'quirky'];
  const found = db.all('SELECT DISTINCT module FROM module_items').map(r => r.module);
  const names = fixed.slice();
  found.forEach(n => { if (names.indexOf(n) === -1) names.push(n); });
  return names;
}

function getModuleData(mod) {
  if (mod === 'posts') return readArticles();
  if (mod === 'moments') return readMusings();
  if (mod === 'comments') return readAllCommentsAcrossArticles();
  const rows = db.all('SELECT data FROM module_items WHERE module = ? ORDER BY ord DESC', String(mod));
  const list = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      list.push(JSON.parse(rows[i].data));
    } catch (e) { /* 跳过坏行 */ }
  }
  return list;
}

function getConfig() {
  const cfg = {};
  moduleNames().forEach((name) => { cfg[name] = getModuleData(name); });
  return cfg;
}

function saveConfig(cfg) {
  const source = cfg || {};
  db.tx(() => {
    db.run('DELETE FROM module_items');
    const names = Object.keys(source);
    for (let n = 0; n < names.length; n++) {
      const mod = names[n];
      const list = Array.isArray(source[mod]) ? source[mod] : [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i] || {};
        const id = String(item.id != null ? item.id : 'i-' + Date.now() + '-' + i);
        db.run(
          'INSERT OR REPLACE INTO module_items (module, id, data, ord) VALUES (?, ?, ?, ?)',
          mod, id, JSON.stringify(item), Date.now() - i
        );
      }
    }
  });
}

function getHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 10);
}

function buildMdContent(item, type) {
  return mdparse.buildMdText(item, type);
}

function searchArticles(query, limit) {
  return text.rankArticles(readArticles(), query, limit);
}

// ---- 统一写入 / 删除入口（签名与文件版一致）----
function saveItem(mod, input) {
  const item = Object.assign({}, input || {});

  if (mod === 'posts') {
    item.id = sanitizeId(item.id || item.title || ('post-' + Date.now()));
    const exists = db.get('SELECT id, created_at FROM posts WHERE id = ?', item.id);
    if (exists) item.id = exists.id;
    item.date = item.date || cnDateOf(new Date());
    if (!exists || !item.mtime) item.mtime = Date.now();
    db.run(UPSERT_SQL('posts'), ...itemToRow(item, 'posts'));
    return { ok: true, item: Object.assign({}, item), list: readArticles() };
  }

  if (mod === 'moments') {
    item.id = sanitizeId(item.id || ('musing-' + Date.now()));
    const exists = db.get('SELECT id FROM moments WHERE id = ?', item.id);
    if (exists) item.id = exists.id;
    item.date = item.date || cnNowStamp();
    if (!exists || !item.mtime) item.mtime = Date.now();
    db.run(UPSERT_SQL('moments'), ...itemToRow(item, 'moments'));
    return { ok: true, item: Object.assign({}, item), list: readMusings() };
  }

  const module = String(mod);
  item.id = item.id ? String(item.id) : String(Date.now());
  const row = db.get('SELECT data FROM module_items WHERE module = ? AND id = ?', module, item.id);
  if (row) {
    let prev = {};
    try { prev = JSON.parse(row.data); } catch (e) { prev = {}; }
    const merged = Object.assign({}, prev, item);
    db.run('UPDATE module_items SET data = ? WHERE module = ? AND id = ?', JSON.stringify(merged), module, item.id);
    return { ok: true, item: merged, list: getModuleData(module) };
  }
  db.run(
    'INSERT INTO module_items (module, id, data, ord) VALUES (?, ?, ?, ?)',
    module, item.id, JSON.stringify(item), Date.now()
  );
  const list = getModuleData(module);
  return { ok: true, item: list.find(i => String(i.id) === String(item.id)) || item, list: list };
}

function deleteItem(mod, id, options) {
  const opts = options || {};

  if (mod === 'posts') {
    const postId = String(sanitizeId(id));
    db.tx(() => {
      db.run('DELETE FROM posts WHERE id = ?', postId);
      db.run('DELETE FROM comments WHERE post_id = ?', postId);
    });
    return { ok: true, list: readArticles() };
  }

  if (mod === 'moments') {
    db.run('DELETE FROM moments WHERE id = ?', String(sanitizeId(id)));
    return { ok: true, list: readMusings() };
  }

  if (mod === 'comments') {
    const postId = opts.postId ? String(sanitizeId(opts.postId)) : '';
    if (postId) {
      const list = readPostComments(postId);
      const cascade = collectCascadeIds(list, id);
      savePostComments(postId, list.filter(c => !cascade.has(String(c.id))));
    } else {
      const posts = db.all('SELECT DISTINCT post_id FROM comments').map(r => r.post_id);
      posts.forEach((pid) => {
        const list = readPostComments(pid);
        const cascade = collectCascadeIds(list, id);
        const next = list.filter(c => !cascade.has(String(c.id)));
        if (next.length !== list.length) savePostComments(pid, next);
      });
    }
    return { ok: true, list: readAllCommentsAcrossArticles() };
  }

  db.run('DELETE FROM module_items WHERE module = ? AND id = ?', String(mod), String(id));
  return { ok: true, list: getModuleData(mod) };
}

module.exports = {
  variant: VARIANT,
  VARIANT,
  ROOT_DIR,
  ARTICLE_DIR,
  MUSINGS_DIR,
  IMG_DIR,
  FILE_DIR,
  DB_FILE: db.DB_FILE,
  DATA_DIR: db.DATA_DIR,
  getDateFolder,
  sanitizeFileName,
  sanitizeId,
  buildMdContent,
  readArticles,
  postExists,
  readPostComments,
  savePostComments,
  collectCascadeIds,
  readAllCommentsAcrossArticles,
  readMusings,
  getConfig,
  saveConfig,
  getHash,
  getModuleData,
  writeFileAtomic,
  withWriteLock,
  mutatePostComments,
  summarizeItem,
  excerptOf,
  searchArticles,
  normalizeTags,
  saveItem,
  deleteItem
};

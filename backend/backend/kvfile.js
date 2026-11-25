/**
 * backend/kvfile.js — JSON 配置的读写适配层
 *
 * 老代码（site / links / notify / indexnow / telegram / captcha / backup / auth）
 * 都是「一个模块一个 json 文件」。数据库版部署不该满地小文件，所以这里做一层薄适配：
 *
 *   STORE 未设置 / STORE=sqlite → 读写 kv 表，key 取文件相对 data 目录的路径（去掉 .json）
 *   STORE=file                  → 仍然照旧读写那个 json 文件
 *
 * 各模块只把最底层的 readFileSync / writeFileSync 换成 kvfile.readJson / writeJson，
 * 上层的校验、合并、字段裁剪逻辑完全不动。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const db = require('./db');

function useDb() {
  return String(process.env.STORE || '').toLowerCase() !== 'file';
}

/** /path/to/backend/data/site.json → 'site'；data/telegram-map.json → 'telegram-map' */
function keyOf(file) {
  const abs = path.resolve(String(file));
  let rel = path.relative(db.DATA_DIR, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) rel = path.basename(abs);
  return rel.split(path.sep).join('/').replace(/\.json$/i, '');
}

function readJson(file, fallback) {
  if (useDb()) {
    const value = db.kvGet(keyOf(file), undefined);
    return value === undefined ? fallback : value;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, obj, options) {
  if (useDb()) {
    db.kvSet(keyOf(file), obj);
    return true;
  }
  const opts = options || {};
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const body = JSON.stringify(obj, null, 2);
  const tmp = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, body, { encoding: 'utf8', mode: opts.mode || 0o600 });
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (ignored) {}
    fs.writeFileSync(file, body, { encoding: 'utf8', mode: opts.mode || 0o600 });
    return true;
  }
}

function deleteJson(file) {
  if (useDb()) {
    db.kvDel(keyOf(file));
    return true;
  }
  try {
    fs.unlinkSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

/** 是否存在（数据库模式看 kv，文件模式看磁盘） */
function existsJson(file) {
  if (useDb()) return db.kvGet(keyOf(file), undefined) !== undefined;
  return fs.existsSync(file);
}

module.exports = { useDb, keyOf, readJson, writeJson, deleteJson, existsJson };

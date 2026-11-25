/**
 * backend/migrate-import.js — 接收 V1 的便携迁移包（V2 / V3 侧）
 *
 * V1 后台「管理 → 迁移 → 推送到其它站点」会把 data.json + uploads/ 打成一个 zip，
 * 带着 X-Migrate-Token 直接 POST 到本服务的 /api/migrate/import。
 * 令牌存在 kv 表（key = migrate-token），首次启动自动生成，后台可以查看和重置，
 * 这样即使后台页面没打开也能从 V1 一键推过来。
 *
 * 整个流程只依赖存储层的公开接口（saveItem / savePostComments / saveConfig），
 * 因此文件版（STORE=file）与数据库版都能导入同一个包。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const portable = require('./portable');
const storage = require('./storage');
const db = require('./db');
const kvfile = require('./kvfile');

const TOKEN_KEY = 'migrate-token';
const MAX_BYTES = portable.MAX_TOTAL_BYTES + 8 * 1024 * 1024;

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(storage.ROOT_DIR, 'data');

// 便携包里的模块 key → V2/V3 的 kv 键（文件模式下就是 data/<file>）
const MODULE_FILES = {
  site: 'site.json',
  links: 'links.json',
  notify: 'notify.json',
  indexnow: 'indexnow.json',
  telegram: 'telegram.json',
  backupSettings: 'backup-settings.json'
};

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

/** 读取（必要时生成）迁移令牌 */
function getToken() {
  let token = db.kvGet(TOKEN_KEY, '');
  if (!token || typeof token !== 'string') {
    token = newToken();
    db.kvSet(TOKEN_KEY, token);
  }
  return token;
}

function resetToken() {
  const token = newToken();
  db.kvSet(TOKEN_KEY, token);
  return token;
}

/** 恒定时间比较：先各自 SHA-256，再比定长摘要 */
function verifyToken(provided) {
  const candidate = String(provided || '').trim();
  if (!candidate) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(getToken()).digest();
  return crypto.timingSafeEqual(a, b);
}

function readRawBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limitBytes) {
        done = true;
        const err = new Error('迁移包超过大小上限（' + Math.round(limitBytes / 1024 / 1024) + 'MB）');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (e) => {
      if (done) return;
      done = true;
      reject(e);
    });
  });
}

function clearAll() {
  storage.readArticles().forEach((p) => storage.deleteItem('posts', p.id));
  storage.readMusings().forEach((m) => storage.deleteItem('moments', m.id));
  const cfg = storage.getConfig();
  Object.keys(cfg).forEach((mod) => {
    if (Array.isArray(cfg[mod]) && cfg[mod].length) {
      storage.saveConfig(Object.assign({}, storage.getConfig(), { [mod]: [] }));
    }
  });
}

function writeUpload(upload) {
  const name = String(upload.name || '').replace(/\\/g, '/');
  const isImg = name.indexOf('img/') === 0;
  const isFile = name.indexOf('file/') === 0;
  if (!isImg && !isFile) return false;
  const baseDir = isImg ? storage.IMG_DIR : storage.FILE_DIR;
  const rel = name.slice(isImg ? 4 : 5);
  const target = path.resolve(baseDir, rel);
  if (target.indexOf(path.resolve(baseDir) + path.sep) !== 0) return false;   // 防目录穿越
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, upload.data);
  return true;
}

/**
 * 把一个便携包写入当前站点。
 * @param {Buffer} buffer zip 内容
 * @param {{ mode?: 'replace'|'merge' }} options
 */
function applyBundle(buffer, options) {
  const opts = options || {};
  const mode = opts.mode === 'replace' ? 'replace' : 'merge';
  const bundle = portable.readBundle(buffer);
  const warnings = [];
  const stats = {
    mode: mode,
    posts: 0,
    comments: 0,
    moments: 0,
    modules: [],
    uploads: 0,
    auth: false,
    skipped: 0
  };

  if (mode === 'replace') clearAll();

  const posts = bundle.data.posts || [];
  for (let i = 0; i < posts.length; i++) {
    const src = posts[i] || {};
    const item = {
      id: src.id,
      title: src.title,
      date: src.date,
      tag: src.tag,
      tags: src.tags,
      hidden: src.hidden,
      enc: src.enc,
      encsalt: src.encsalt,
      enciv: src.enciv,
      enctag: src.enctag,
      enchint: src.enchint,
      mtime: src.mtime,
      content: src.content
    };
    try {
      const saved = storage.saveItem('posts', item);
      stats.posts++;
      const comments = Array.isArray(src.comments) ? src.comments : [];
      storage.savePostComments(saved.item.id, comments);
      stats.comments += comments.length;
    } catch (e) {
      stats.skipped++;
      warnings.push('文章 ' + (src.id || i) + ' 导入失败：' + (e.message || e));
    }
  }

  const moments = bundle.data.moments || [];
  for (let i = 0; i < moments.length; i++) {
    const src = moments[i] || {};
    try {
      storage.saveItem('moments', {
        id: src.id,
        title: src.title,
        date: src.date,
        tag: src.tag,
        tags: src.tags,
        hidden: src.hidden,
        mtime: src.mtime,
        content: src.content
      });
      stats.moments++;
    } catch (e) {
      stats.skipped++;
      warnings.push('瞬间 ' + (src.id || i) + ' 导入失败：' + (e.message || e));
    }
  }

  // 工具 / 状态 / 奇奇怪怪等配置数组
  const cfg = bundle.data.config || {};
  const currentCfg = storage.getConfig();
  const nextCfg = Object.assign({}, currentCfg);
  Object.keys(cfg).forEach((mod) => {
    if (!Array.isArray(cfg[mod])) return;
    if (mode === 'replace') {
      nextCfg[mod] = cfg[mod];
    } else {
      const merged = (cfg[mod] || []).concat(currentCfg[mod] || []);
      const seen = Object.create(null);
      nextCfg[mod] = merged.filter((item) => {
        const key = String((item && item.id) || JSON.stringify(item));
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
  });
  try {
    storage.saveConfig(nextCfg);
  } catch (e) {
    warnings.push('配置列表写入失败：' + (e.message || e));
  }

  // 站点信息 / 友链 / 通知 / IndexNow / Telegram / 备份设置
  const modules = bundle.data.modules || {};
  Object.keys(MODULE_FILES).forEach((key) => {
    const value = modules[key];
    if (value === undefined || value === null) return;
    try {
      kvfile.writeJson(path.join(DATA_DIR, MODULE_FILES[key]), value, { mode: 0o600 });
      stats.modules.push(key);
    } catch (e) {
      warnings.push('模块 ' + key + ' 写入失败：' + (e.message || e));
    }
  });

  // 上传文件（图片与附件）
  (bundle.uploads || []).forEach((upload) => {
    try {
      if (writeUpload(upload)) stats.uploads++;
      else stats.skipped++;
    } catch (e) {
      warnings.push('附件 ' + upload.name + ' 写入失败：' + (e.message || e));
    }
  });

  // 管理员凭据（可选）：覆盖后请立刻用原站密码重新登录
  if (bundle.data.auth && mode === 'replace') {
    try {
      kvfile.writeJson(path.join(DATA_DIR, 'auth.json'), bundle.data.auth, { mode: 0o600 });
      stats.auth = true;
      warnings.push('管理员凭据已覆盖：请使用来源站点的账号密码重新登录');
    } catch (e) {
      warnings.push('管理员凭据写入失败：' + (e.message || e));
    }
  }

  return {
    ok: true,
    source: {
      format: bundle.manifest.format,
      version: (bundle.manifest.source && bundle.manifest.source.version) || '',
      createdAt: bundle.manifest.createdAt || ''
    },
    stats: stats,
    warnings: warnings
  };
}

/** POST /api/migrate/import?mode=replace|merge */
function handleHttpImport(req, res, reqUrl, auth) {
  const header = req.headers['x-migrate-token'];
  const authed = auth && typeof auth.isAuthenticated === 'function' && auth.isAuthenticated(req);
  if (!authed && !verifyToken(header)) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      ok: false,
      error: '迁移令牌不正确。请在目标站后台「管理 → 迁移」查看令牌，或在 V1 推送时填写。'
    }));
  }

  const mode = String(reqUrl.searchParams.get('mode') || 'merge');
  readRawBody(req, MAX_BYTES).then((buffer) => {
    if (!buffer || !buffer.length) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: '请求体为空，需要上传迁移包（zip）' }));
    }
    let result;
    try {
      result = applyBundle(buffer, { mode: mode });
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(result));
  }).catch((e) => {
    const status = e && e.status ? e.status : 400;
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: e.message || String(e) }));
    }
  });
}

module.exports = {
  TOKEN_KEY,
  MAX_BYTES,
  getToken,
  resetToken,
  verifyToken,
  applyBundle,
  handleHttpImport,
  MODULE_FILES
};

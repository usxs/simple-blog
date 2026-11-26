/**
 * backend/transfer.js — 「迁移 / 导入 / 导出」的后台接口（/api/admin/transfer/*）
 *
 * 挂在 server.js 的 guardAuth 之后，所以这里只管业务，不再做鉴权。
 *
 *   GET  /api/admin/transfer/info        统计 + 支持的导入来源 / 导出目标
 *   POST /api/admin/transfer/migrate     生成便携包并直接下载（body 里选目标版本）
 *   POST /api/admin/transfer/push        把便携包直接推到 V2 / V3 站点
 *   POST /api/admin/transfer/import-md   上传静态博客 ZIP（body 是二进制）+ 落库
 *   POST /api/admin/transfer/export-md   导出 Markdown ZIP
 */

'use strict';

const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const zip = require('./zip');
const portable = require('./portable');
const mdimport = require('./mdimport');
const mdexport = require('./mdexport');

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const PUSH_TIMEOUT_MS = 120 * 1000;

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function sendZip(res, buffer, filename) {
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="' + filename.replace(/[^\w.\-]/g, '_') + '"',
    'Content-Length': String(buffer.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(buffer);
}

function readJson(req, res, limit, cb) {
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > limit) {
      aborted = true;
      sendJson(res, 413, { ok: false, error: '请求体过大' });
      try { req.destroy(); } catch (e) {}
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    try {
      const text = Buffer.concat(chunks).toString('utf8');
      cb(text ? JSON.parse(text) : {});
    } catch (e) {
      sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
    }
  });
  req.on('error', () => {
    if (!aborted) sendJson(res, 400, { ok: false, error: '读取请求体失败' });
  });
}

function readBinary(req, res, limit, cb) {
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > limit) {
      aborted = true;
      sendJson(res, 413, { ok: false, error: '文件过大（上限 256MB）' });
      try { req.destroy(); } catch (e) {}
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    cb(Buffer.concat(chunks));
  });
  req.on('error', () => {
    if (!aborted) sendJson(res, 400, { ok: false, error: '读取上传内容失败' });
  });
}

function countUploads() {
  function walk(dir) {
    if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
    let count = 0;
    let bytes = 0;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      let entries;
      try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) { continue; }
      entries.forEach((ent) => {
        const full = path.join(cur, ent.name);
        if (ent.name.startsWith('.')) return; // .gitkeep / .DS_Store 不算附件
        if (ent.isDirectory()) { stack.push(full); return; }
        if (!ent.isFile()) return;
        count++;
        try { bytes += fs.statSync(full).size; } catch (e) {}
      });
    }
    return { count, bytes };
  }
  const img = walk(storage.IMG_DIR);
  const file = walk(storage.FILE_DIR);
  return { count: img.count + file.count, bytes: img.bytes + file.bytes };
}

function buildInfo() {
  const posts = storage.readArticles();
  const moments = storage.readMusings();
  const comments = posts.reduce((n, p) => n + storage.readPostComments(p.id).length, 0);
  const uploads = countUploads();
  return {
    ok: true,
    variant: storage.variant || 'file',
    storage: storage.variant === 'sqlite' ? 'sqlite' : 'file',
    version: portable.appVersion(),
    portableFormat: portable.PORTABLE_FORMAT,
    limits: { maxUploadBytes: MAX_UPLOAD_BYTES, maxFileBytes: portable.MAX_FILE_BYTES },
    stats: {
      posts: posts.length,
      moments: moments.length,
      comments: comments,
      uploads: uploads.count,
      uploadBytes: uploads.bytes
    },
    sources: Object.keys(mdimport.SOURCES).map(k => ({ key: k, label: mdimport.SOURCES[k].label })),
    targets: Object.keys(mdexport.TARGETS).map(k => ({ key: k, label: mdexport.TARGETS[k].label })),
    migrateTargets: [
      { key: 'v2', label: 'V2 · 前后端分离 + SQLite', hint: 'Cloudflare Pages 前端 + Node 后端 + SQLite 数据库' },
      { key: 'v3', label: 'V3 · 前后端不分离 + SQLite', hint: '单体 SSR，像 Typecho 一样一个进程跑完' }
    ]
  };
}

// ---- 导入落盘（V1 文件存储）----

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 'YYYY-MM-DD HH:mm'（北京时间）-> 毫秒时间戳
function mtimeOf(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return Date.now();
  const ms = Date.parse(m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00') + ':00+08:00');
  return Number.isNaN(ms) ? Date.now() : ms;
}

function uniqueId(baseId, taken) {
  let id = baseId;
  let n = 2;
  while (taken.has(id) || fs.existsSync(path.join(storage.ARTICLE_DIR, id))) {
    id = baseId + '-' + n;
    n++;
    if (n > 9999) break;
  }
  return id;
}

function writeImported(posts, assets) {
  const taken = new Set(storage.readArticles().map(p => String(p.id)));
  const created = [];
  const idMap = Object.create(null);

  posts.forEach((post) => {
    const id = uniqueId(storage.sanitizeId(post.id || post.title || ('imported-' + Date.now())), taken);
    taken.add(id);
    idMap[post.id] = id;
    const item = {
      id: id,
      title: post.title,
      date: post.date,
      tags: post.tags,
      tag: post.tag || (post.tags && post.tags[0]) || '',
      hidden: post.hidden ? 1 : 0,
      mtime: mtimeOf(post.date),
      content: post.content || ''
    };
    // 走存储层：文件版写 article/<id>/<id>.md + comments.json，数据库版写表
    storage.saveItem('posts', item);
    storage.savePostComments(id, []);
    created.push({ id, title: post.title, date: post.date });
  });

  let assetCount = 0;
  (assets || []).forEach((asset) => {
    const owner = idMap[asset.postId];
    if (!owner && asset.postId) return;
    // 视频/图片都放 img 下；target 形如 imported/<postId>/<file>
    const rel = String(asset.target || '').replace(/^\/+/, '');
    if (!rel || rel.indexOf('..') !== -1) return;
    const full = path.join(storage.IMG_DIR, rel);
    ensureDir(path.dirname(full));
    try {
      fs.writeFileSync(full, asset.data);
      assetCount++;
    } catch (e) {}
  });

  return { created, assets: assetCount };
}

// ---- 推送到 V2 / V3 ----

async function pushBundle(payload) {
  const target = String(payload.url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(target)) throw new Error('目标地址需要以 http:// 或 https:// 开头');
  const token = String(payload.token || '').trim();
  if (!token) throw new Error('缺少目标站点的迁移令牌');

  const bundle = portable.buildBundle({
    includeAuth: payload.includeAuth !== false,
    includeUploads: payload.includeUploads !== false
  });

  const mode = payload.mode === 'merge' ? 'merge' : 'replace';
  const endpoint = target + '/api/migrate/import?mode=' + mode;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Migrate-Token': token,
      'X-Portable-Format': portable.PORTABLE_FORMAT
    },
    body: bundle.buffer,
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS)
  });

  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text.slice(0, 500) }; }
  return {
    status: resp.status,
    ok: resp.ok && data && data.ok !== false,
    remote: data,
    bundle: { filename: bundle.filename, size: bundle.buffer.length, stats: bundle.manifest.stats }
  };
}

// ---- 入口 ----

async function handleRequest(req, res, pathname, reqUrl) {
  if (req.method === 'GET' && pathname === '/api/admin/transfer/info') {
    return sendJson(res, 200, buildInfo());
  }

  // 生成便携包并下载
  if (req.method === 'POST' && pathname === '/api/admin/transfer/migrate') {
    return readJson(req, res, 64 * 1024, (body) => {
      try {
        const bundle = portable.buildBundle({
          includeAuth: body.includeAuth !== false,
          includeUploads: body.includeUploads !== false
        });
        sendZip(res, bundle.buffer, bundle.filename);
      } catch (e) {
        sendJson(res, 500, { ok: false, error: '生成迁移包失败：' + (e.message || e) });
      }
    });
  }

  // 直接推送到目标站点
  if (req.method === 'POST' && pathname === '/api/admin/transfer/push') {
    return readJson(req, res, 64 * 1024, async (body) => {
      try {
        const result = await pushBundle(body || {});
        sendJson(res, 200, Object.assign({ ok: true }, result));
      } catch (e) {
        sendJson(res, 502, { ok: false, error: '推送失败：' + (e.message || e) });
      }
    });
  }

  // 导入静态博客 ZIP
  if (req.method === 'POST' && pathname === '/api/admin/transfer/import-md') {
    const source = String(reqUrl.searchParams.get('source') || 'auto');
    const dryRun = reqUrl.searchParams.get('dryRun') === '1';
    return readBinary(req, res, MAX_UPLOAD_BYTES, (buffer) => {
      try {
        if (!buffer.length) return sendJson(res, 400, { ok: false, error: '没有收到文件内容' });
        let files;
        const looksLikeZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
        if (looksLikeZip) {
          files = zip.readZip(buffer);
        } else {
          // 单个 .md 文件也允许
          files = [{ name: String(reqUrl.searchParams.get('name') || 'import.md'), data: buffer, isDir: false }];
        }
        const parsed = mdimport.parseArchive(files, { source: source, withAssets: true });
        if (dryRun) {
          return sendJson(res, 200, {
            ok: true,
            dryRun: true,
            source: parsed.source,
            detected: parsed.detected,
            stats: parsed.stats,
            warnings: parsed.warnings,
            preview: parsed.posts.slice(0, 30).map(p => ({ id: p.id, title: p.title, date: p.date, tags: p.tags, path: p.sourcePath, chars: (p.content || '').length }))
          });
        }
        const result = writeImported(parsed.posts, parsed.assets);
        sendJson(res, 200, {
          ok: true,
          source: parsed.source,
          detected: parsed.detected,
          stats: parsed.stats,
          warnings: parsed.warnings,
          imported: result.created.length,
          assets: result.assets,
          posts: result.created
        });
      } catch (e) {
        sendJson(res, 400, { ok: false, error: '解析失败：' + (e.message || e) });
      }
    });
  }

  // 导出为静态博客格式
  if (req.method === 'POST' && pathname === '/api/admin/transfer/export-md') {
    return readJson(req, res, 256 * 1024, (body) => {
      try {
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
        let posts = storage.readArticles();
        if (ids.length) posts = posts.filter(p => ids.indexOf(String(p.id)) !== -1);
        if (!posts.length) return sendJson(res, 400, { ok: false, error: '没有可导出的文章' });
        const site = require('./site').getSite() || {};
        const result = mdexport.buildExport(posts, {
          target: body.target,
          siteName: site.name || site.title,
          // 正文里的 /img/... 从图片目录里捞出来一起打包
          resolveAsset: (rel) => {
            const full = path.join(storage.IMG_DIR, rel);
            const safe = path.resolve(full);
            if (safe.indexOf(path.resolve(storage.IMG_DIR)) !== 0) return null;
            if (!fs.existsSync(safe) || !fs.statSync(safe).isFile()) return null;
            return { data: fs.readFileSync(safe) };
          }
        });
        const buffer = zip.writeZip(result.files);
        const stamp = new Date().toISOString().slice(0, 10);
        sendZip(res, buffer, 'simple-blog-' + result.target + '-' + stamp + '.zip');
      } catch (e) {
        sendJson(res, 500, { ok: false, error: '导出失败：' + (e.message || e) });
      }
    });
  }

  return sendJson(res, 404, { ok: false, error: '未知的迁移接口' });
}

module.exports = {
  handleRequest,
  buildInfo,
  writeImported,
  MAX_UPLOAD_BYTES
};

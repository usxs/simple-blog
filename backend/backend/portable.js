/**
 * backend/portable.js — 便携迁移包（V1 ⇄ V2 / V3 之间搬家用）
 *
 * 和 backup.js 的整站 tar.gz 不是一回事：
 *   · tar.gz 备份是给「同一个版本自己恢复」用的，里面含 sessions、backups 目录等运行时垃圾；
 *   · 便携包是给「换一个版本继续跑」用的，只带内容 + 配置 + 图片附件，
 *     并且带 manifest 版本号，V2/V3 收到之后可以直接按字段落库。
 *
 * 包结构：
 *   manifest.json          格式版本、来源、统计
 *   data.json              文章（含评论）、瞬间、友链、站点设置、各模块配置
 *   uploads/img/...        原样搬运的图片（正文里的 /img/... 链接不变）
 *   uploads/file/...       原样搬运的附件
 *   README.md              人工可读的说明
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zip = require('./zip');
const storage = require('./storage');

const PORTABLE_FORMAT = 'simple-blog-portable/1';
const AUTH_DATA_DIR = process.env.AUTH_DATA_DIR || path.join(storage.ROOT_DIR, 'data');

// 单文件与总大小上限：迁移包是要走浏览器上传的，超过这个量级该走服务器端 rsync
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

const DATA_MODULES = [
  { key: 'site', file: 'site.json' },
  { key: 'links', file: 'links.json' },
  { key: 'notify', file: 'notify.json' },
  { key: 'indexnow', file: 'indexnow.json' },
  { key: 'telegram', file: 'telegram.json' },
  { key: 'backupSettings', file: 'backup-settings.json' }
];

function appVersion() {
  try {
    return require(path.join(storage.ROOT_DIR, 'package.json')).version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

function readJsonIfExists(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

// 文件名用北京时间，避免服务器 UTC 时区下生成的文件名跟后台显示的时间差 8 小时
function cnStamp(d) {
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const pad = v => String(v).padStart(2, '0');
  return String(t.getUTCFullYear()) + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) +
    pad(t.getUTCHours()) + pad(t.getUTCMinutes()) + pad(t.getUTCSeconds());
}

function walkFiles(dir, prefix, out, budget) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (let i = 0; i < entries.length; i++) {
    const ent = entries[i];
    const full = path.join(dir, ent.name);
    const rel = prefix ? prefix + '/' + ent.name : ent.name;
    if (ent.isDirectory()) {
      if (ent.name === '.git' || ent.name === 'node_modules') continue;
      walkFiles(full, rel, out, budget);
      continue;
    }
    if (!ent.isFile()) continue;
    if (ent.name.startsWith('.')) continue; // .gitkeep / .DS_Store 之类不进包
    let stat;
    try { stat = fs.statSync(full); } catch (e) { continue; }
    if (stat.size > MAX_FILE_BYTES) {
      budget.skipped.push(rel + '（超过 64MB 已跳过）');
      continue;
    }
    if (budget.total + stat.size > MAX_TOTAL_BYTES) {
      budget.skipped.push(rel + '（总量超出上限已跳过）');
      continue;
    }
    budget.total += stat.size;
    out.push({ rel, full, size: stat.size });
  }
}

/**
 * 生成便携包。
 * @param {{ includeAuth?: boolean, includeUploads?: boolean }} options
 */
function buildBundle(options) {
  const opts = options || {};
  const includeAuth = opts.includeAuth !== false;
  const includeUploads = opts.includeUploads !== false;

  const posts = storage.readArticles().map((post) => {
    const item = Object.assign({}, post);
    item.comments = storage.readPostComments(post.id);
    return item;
  });
  const moments = storage.readMusings();
  const config = readJsonIfExists(path.join(storage.ROOT_DIR, 'config.json'), { tools: [], status: [], quirky: [] });

  const modules = {};
  DATA_MODULES.forEach((m) => {
    const value = readJsonIfExists(path.join(AUTH_DATA_DIR, m.file), null);
    if (value) modules[m.key] = value;
  });

  const auth = includeAuth ? readJsonIfExists(path.join(AUTH_DATA_DIR, 'auth.json'), null) : null;

  const budget = { total: 0, skipped: [] };
  const uploads = [];
  if (includeUploads) {
    walkFiles(storage.IMG_DIR, 'img', uploads, budget);
    walkFiles(storage.FILE_DIR, 'file', uploads, budget);
  }

  const commentsCount = posts.reduce((sum, p) => sum + (p.comments ? p.comments.length : 0), 0);
  const manifest = {
    format: PORTABLE_FORMAT,
    createdAt: new Date().toISOString(),
    source: { app: 'simple-blog', variant: 'file', version: appVersion() },
    stats: {
      posts: posts.length,
      moments: moments.length,
      comments: commentsCount,
      uploads: uploads.length,
      uploadBytes: budget.total
    },
    includes: { auth: Boolean(auth), uploads: uploads.length > 0, modules: Object.keys(modules) },
    skipped: budget.skipped
  };

  const data = {
    posts,
    moments,
    modules,
    config,
    auth
  };

  const entries = [
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
    { name: 'data.json', data: JSON.stringify(data) },
    { name: 'README.md', data: readmeFor(manifest) }
  ];
  uploads.forEach((u) => {
    let buf;
    try { buf = fs.readFileSync(u.full); } catch (e) { return; }
    entries.push({ name: 'uploads/' + u.rel, data: buf, mtime: statMtime(u.full) });
  });

  const buffer = zip.writeZip(entries);
  const stamp = cnStamp(new Date());
  return {
    buffer,
    manifest,
    size: buffer.length,
    filename: 'simple-blog-portable-' + stamp + '.zip'
  };
}

function statMtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch (e) { return Date.now(); }
}

function readmeFor(manifest) {
  const s = manifest.stats;
  return [
    '# 简单博客 便携迁移包',
    '',
    '- 格式：`' + PORTABLE_FORMAT + '`',
    '- 导出时间：' + manifest.createdAt,
    '- 来源版本：' + manifest.source.version + '（文件存储版 V1）',
    '- 内容：' + s.posts + ' 篇文章 / ' + s.moments + ' 条瞬间 / ' + s.comments + ' 条评论 / ' + s.uploads + ' 个附件',
    '',
    '## 怎么用',
    '',
    '**方式一（推荐）**：在目标站点后台「设置 → 数据迁移 → 导入便携包」里选择本文件。',
    '**方式二（命令行）**：把本文件放到目标站点目录，执行',
    '',
    '```bash',
    'node scripts/import-portable.js simple-blog-portable-xxxx.zip',
    '```',
    '',
    '## 注意',
    '',
    '· 正文里的图片地址是 `/img/...`，`uploads/img` 下已经按同样的相对路径放好，',
    '  导入后不需要改动 Markdown。',
    '· 若包内含 `auth.json`，导入时会一并带上管理员口令哈希（scrypt），登录密码保持不变。',
    '· 加密文章（`enc: 1`）只搬运密文和盐，解密仍依赖原密码，导入前后都不会明文落地。',
    ''
  ].join('\n');
}

/**
 * 解析便携包（不落盘）。
 * @param {Buffer} buffer
 */
function readBundle(buffer) {
  const entries = zip.readZip(buffer);
  const map = new Map();
  entries.forEach((e) => { if (!e.isDir) map.set(e.name, e.data); });

  const manifestRaw = map.get('manifest.json');
  if (!manifestRaw) throw new Error('迁移包缺少 manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw.toString('utf8'));
  } catch (e) {
    throw new Error('manifest.json 解析失败');
  }
  if (!manifest || String(manifest.format || '').indexOf('simple-blog-portable/') !== 0) {
    throw new Error('不是本程序生成的迁移包（format=' + (manifest && manifest.format) + '）');
  }

  const dataRaw = map.get('data.json');
  if (!dataRaw) throw new Error('迁移包缺少 data.json');
  let data;
  try {
    data = JSON.parse(dataRaw.toString('utf8'));
  } catch (e) {
    throw new Error('data.json 解析失败');
  }

  const uploads = [];
  map.forEach((buf, name) => {
    if (name.indexOf('uploads/') !== 0) return;
    uploads.push({ name: name.slice('uploads/'.length), data: buf });
  });

  return {
    manifest,
    data: {
      posts: Array.isArray(data.posts) ? data.posts : [],
      moments: Array.isArray(data.moments) ? data.moments : [],
      modules: data.modules || {},
      config: data.config || { tools: [], status: [], quirky: [] },
      auth: data.auth || null
    },
    uploads
  };
}

/** 导入前的统计（给确认弹窗用） */
function describe(bundle) {
  const posts = bundle.data.posts || [];
  const comments = posts.reduce((n, p) => n + (Array.isArray(p.comments) ? p.comments.length : 0), 0);
  return {
    format: bundle.manifest.format,
    createdAt: bundle.manifest.createdAt,
    sourceVersion: (bundle.manifest.source && bundle.manifest.source.version) || 'unknown',
    posts: posts.length,
    moments: (bundle.data.moments || []).length,
    comments,
    uploads: bundle.uploads.length,
    hasAuth: Boolean(bundle.data.auth),
    modules: Object.keys(bundle.data.modules || {})
  };
}

module.exports = {
  PORTABLE_FORMAT,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  buildBundle,
  readBundle,
  describe,
  appVersion
};

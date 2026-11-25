#!/usr/bin/env node
/**
 * scripts/migrate-v1-to-v2.js — 把 V1（文件存储版）的数据目录整体搬进 SQLite
 *
 * V1 的数据长这样：
 *   backend/article/<id>/<id>.md + comments.json
 *   backend/Musings/<id>.md
 *   backend/img/**, backend/file/**
 *   backend/config.json            （tools / status / quirky 等模块数组）
 *   backend/data/*.json            （site / links / notify / indexnow / telegram / auth ...）
 *
 * 本脚本直接读这些文件，写进 V2 的库（posts / moments / comments / module_items / kv），
 * 图片与附件按原相对路径复制到目标站点的 img/ 与 file/ 下。
 *
 * 用法：
 *   node scripts/migrate-v1-to-v2.js --v1-dir ../ --db ./data/blog.db
 *   node scripts/migrate-v1-to-v2.js --v1-dir ../ --dry-run
 *
 * 可选：
 *   --db <file>        目标数据库（默认 <backend>/data/blog.db）
 *   --root <dir>       目标后端目录（默认本脚本的上一级）
 *   --dry-run          只统计不写库
 *   --no-uploads       不复制图片与附件
 *   --no-auth          不导入管理员凭据
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { dryRun: false, uploads: true, auth: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--v1-dir') args.v1Dir = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--root') args.root = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-uploads') args.uploads = false;
    else if (a === '--no-auth') args.auth = false;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.v1Dir) {
  console.log([
    '用法: node scripts/migrate-v1-to-v2.js --v1-dir <V1 根目录或 backend 目录> [--db <file>] [--dry-run]',
    '',
    '  --v1-dir     V1 的仓库根目录或 backend 目录（自动识别 article/ 在哪一层）',
    '  --db         目标 SQLite 文件，默认 <backend>/data/blog.db',
    '  --root       目标后端目录，默认本脚本的上一级',
    '  --dry-run    只统计不写库',
    '  --no-uploads 不复制 img/ 与 file/',
    '  --no-auth    不导入 data/auth.json（管理员账号密码）'
  ].join('\n'));
  process.exit(args.help ? 0 : 1);
}

const TARGET_ROOT = path.resolve(args.root || path.join(__dirname, '..'));
const DB_FILE = path.resolve(args.db || path.join(TARGET_ROOT, 'data', 'blog.db'));

// 必须在 require 存储层之前把 DB_FILE 钉死，db.js 是模块级打开数据库的
process.env.DB_FILE = DB_FILE;
if (!process.env.STORE) process.env.STORE = 'sqlite';

const mdparse = require('../backend/mdparse');
const storage = require('../backend/storage');
const kvfile = require('../backend/kvfile');
const db = require('../backend/db');

/** V1 目录可能给的是仓库根，也可能是 backend 子目录 */
function resolveV1Dir(input) {
  const dir = path.resolve(input);
  const candidates = [dir, path.join(dir, 'backend')];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'article')) || fs.existsSync(path.join(c, 'config.json'))) return c;
  }
  // 退而求其次：只给了 article 目录本身
  if (path.basename(dir).toLowerCase() === 'article') return path.dirname(dir);
  return dir;
}

const V1 = resolveV1Dir(args.v1Dir);
const ARTICLE_DIR = path.join(V1, 'article');
const MUSINGS_DIR = path.join(V1, 'Musings');
const IMG_DIR = path.join(V1, 'img');
const FILE_DIR = path.join(V1, 'file');
const CONFIG_FILE = path.join(V1, 'config.json');
const DATA_DIR = path.join(V1, 'data');

function exists(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function listDirs(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.charAt(0) !== '.')
    .map((d) => d.name)
    .sort();
}

function listMd(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.md$/i.test(d.name) && d.name.charAt(0) !== '.')
    .map((d) => d.name)
    .sort();
}

function mtimeOf(file) {
  try { return fs.statSync(file).mtimeMs; } catch (e) { return Date.now(); }
}

function walk(dir, base, out) {
  if (!exists(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((d) => {
    if (d.name.charAt(0) === '.') return;
    const full = path.join(dir, d.name);
    const rel = base ? base + '/' + d.name : d.name;
    if (d.isDirectory()) walk(full, rel, out);
    else if (d.isFile()) out.push({ full: full, rel: rel });
  });
  return out;
}

function copyFiles(files, baseDir, label, report) {
  files.forEach((f) => {
    const target = path.join(baseDir, f.rel);
    const upper = path.resolve(baseDir) + path.sep;
    if (path.resolve(target).indexOf(upper) !== 0) {
      report.warnings.push(label + ' 路径越界，已跳过：' + f.rel);
      return;
    }
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(f.full, target);
      report.uploads++;
    } catch (e) {
      report.warnings.push(label + ' 复制失败 ' + f.rel + '：' + (e.message || e));
    }
  });
}

function main() {
  const report = {
    source: V1,
    target: DB_FILE,
    dryRun: args.dryRun,
    posts: 0,
    comments: 0,
    moments: 0,
    modules: [],
    configModules: [],
    uploads: 0,
    auth: false,
    warnings: []
  };

  // ---- 1. 文章 ----
  const postIds = listDirs(ARTICLE_DIR);
  postIds.forEach((id) => {
    const file = path.join(ARTICLE_DIR, id, id + '.md');
    const md = exists(file)
      ? file
      : path.join(ARTICLE_DIR, id, fs.readdirSync(path.join(ARTICLE_DIR, id)).filter((n) => /\.md$/i.test(n))[0] || '');
    if (!md || !exists(md)) {
      report.warnings.push('跳过无 markdown 的文章目录：' + id);
      return;
    }
    const raw = fs.readFileSync(md, 'utf8');
    const item = mdparse.parseMdText(raw, { id: id, fallbackMtime: mtimeOf(md) });
    if (!args.dryRun) storage.saveItem('posts', item);
    report.posts++;

    const commentsFile = path.join(ARTICLE_DIR, id, 'comments.json');
    const comments = exists(commentsFile) ? readJson(commentsFile, []) : [];
    if (Array.isArray(comments) && comments.length) {
      if (!args.dryRun) storage.savePostComments(id, comments);
      report.comments += comments.length;
    }
  });

  // ---- 2. 瞬间 ----
  listMd(MUSINGS_DIR).forEach((name) => {
    const file = path.join(MUSINGS_DIR, name);
    const raw = fs.readFileSync(file, 'utf8');
    const item = mdparse.parseMdText(raw, {
      id: name.replace(/\.md$/i, ''),
      fallbackMtime: mtimeOf(file)
    });
    if (!args.dryRun) storage.saveItem('moments', item);
    report.moments++;
  });

  // ---- 3. config.json（tools / status / quirky …）----
  if (exists(CONFIG_FILE)) {
    const cfg = readJson(CONFIG_FILE, null);
    if (cfg && typeof cfg === 'object') {
      if (!args.dryRun) storage.saveConfig(cfg);
      report.configModules = Object.keys(cfg).filter((k) => Array.isArray(cfg[k]));
    } else {
      report.warnings.push('config.json 解析失败，已跳过');
    }
  }

  // ---- 4. data/*.json → kv ----
  const KEEP = ['site.json', 'links.json', 'notify.json', 'indexnow.json', 'telegram.json',
    'telegram-map.json', 'backup-settings.json', 'captcha-secret.json'];
  KEEP.forEach((name) => {
    const file = path.join(DATA_DIR, name);
    if (!exists(file)) return;
    const value = readJson(file, undefined);
    if (value === undefined) {
      report.warnings.push(name + ' 解析失败，已跳过');
      return;
    }
    if (!args.dryRun) kvfile.writeJson(path.join(db.DATA_DIR, name), value, { mode: 0o600 });
    report.modules.push(name.replace(/\.json$/, ''));
  });

  if (args.auth) {
    const authFile = path.join(DATA_DIR, 'auth.json');
    if (exists(authFile)) {
      const value = readJson(authFile, undefined);
      if (value === undefined) report.warnings.push('auth.json 解析失败，已跳过');
      else {
        if (!args.dryRun) kvfile.writeJson(path.join(db.DATA_DIR, 'auth.json'), value, { mode: 0o600 });
        report.auth = true;
      }
    }
  }

  // ---- 5. 图片与附件 ----
  if (args.uploads) {
    copyFiles(walk(IMG_DIR, '', []), storage.IMG_DIR, 'img', report);
    copyFiles(walk(FILE_DIR, '', []), storage.FILE_DIR, 'file', report);
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.warnings.length) {
    console.error('\n有 ' + report.warnings.length + ' 条告警，请看上面的 warnings 字段。');
  }
}

try {
  main();
  if (!args.dryRun) db.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
} catch (e) {
  console.error('迁移失败：' + (e && e.stack ? e.stack : e));
  process.exit(1);
}

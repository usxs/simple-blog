#!/usr/bin/env node
/**
 * scripts/import-portable.js — 在服务器上用命令行导入 V1 的便携迁移包
 *
 * 后台「管理 → 迁移」里的「推送到其它站点」需要目标站能被动接收；
 * 如果目标站在内网或你想在部署脚本里完成导入，用这个 CLI 更直接：
 *
 *   node scripts/import-portable.js --file ~/simple-blog-portable-20261125.zip
 *   node scripts/import-portable.js --file bundle.zip --mode replace
 *
 * 参数：
 *   --file <zip>      必填，V1 导出的迁移包
 *   --mode merge|replace  默认 merge（保留现有内容，按 id 覆盖同 id 内容）
 *   --db <file>       目标数据库，默认 <backend>/data/blog.db
 *   --root <dir>      目标后端目录，默认本脚本的上一级
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { mode: 'merge' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '--zip') args.file = argv[++i];
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--db') args.db = argv[++i];
    else if (a === '--root') args.root = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.file) {
  console.log([
    '用法: node scripts/import-portable.js --file <迁移包.zip> [--mode merge|replace] [--db <file>]',
    '',
    '  --file    V1 后台导出的 simple-blog-portable-*.zip（--zip 同义）',
    '  --mode    merge（默认，按 id 覆盖）/ replace（先清空再导入）',
    '  --db      目标 SQLite 文件，默认 <backend>/data/blog.db',
    '  --root    目标后端目录，默认本脚本的上一级'
  ].join('\n'));
  process.exit(args.help ? 0 : 1);
}

const TARGET_ROOT = path.resolve(args.root || path.join(__dirname, '..'));
process.env.DB_FILE = path.resolve(args.db || path.join(TARGET_ROOT, 'data', 'blog.db'));
if (!process.env.STORE) process.env.STORE = 'sqlite';

const migrateImport = require('../backend/migrate-import');
const db = require('../backend/db');

const file = path.resolve(args.file);
if (!fs.existsSync(file)) {
  console.error('找不到迁移包：' + file);
  process.exit(1);
}

try {
  const buffer = fs.readFileSync(file);
  const result = migrateImport.applyBundle(buffer, { mode: args.mode });
  console.log(JSON.stringify(result, null, 2));
  db.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  if (!result.stats.posts && !result.stats.moments) {
    console.error('\n注意：这个包里没有任何文章或瞬间，检查一下是不是空的 V1 站点。');
  }
} catch (e) {
  console.error('导入失败：' + (e && e.stack ? e.stack : e));
  process.exit(1);
}

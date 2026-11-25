/**
 * backend/backup.js — 后台「备份与迁移」
 *
 * 一键把整站打包成可下载的 tar.gz：
 *   backend/        后端代码 + 数据（config.json / article / Musings / img / file / data）
 *   frontend/       前端源码（本机有源码时）或线上静态快照（服务器上通常只有快照）
 *   manifest.json   备份元信息：时间、主机、前端部署版本（version/branch/commit）、文件数、大小
 *   restore.sh      恢复 / 迁移脚本：./restore.sh --prepare-only 体检，./restore.sh 一键迁移
 *   MIGRATION.md    迁移说明
 *   docker-compose.yml + .env.example  可移植的容器编排
 *
 * 打包用系统 tar（Docker 基础镜像 alpine 自带），不引入新的 npm 依赖。
 * 备份产物默认存放在 data/backups/，可通过 BACKUP_DIR 覆盖；只保留最近 BACKUP_KEEP 份。
 */

const fs = require('fs');
const path = require('path');
const kvfile = require('./kvfile');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { ROOT_DIR } = require('./storage');
const { PUBLIC_SITE_URL } = require('./sitemap');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'));
const HISTORY_FILE = path.join(BACKUP_DIR, 'history.json');
const KEEP = Math.max(1, Math.min(50, Number(process.env.BACKUP_KEEP) || 10));
const SITE_URL = String(PUBLIC_SITE_URL || '').replace(/\/+$/, '');

const BACKUP_PREFIX = String(process.env.BACKUP_PREFIX || 'backup-').trim();
const BACKUP_KIND = String(process.env.BACKUP_KIND || 'site-backup').trim();
const DEPLOY_DIR = String(process.env.BACKEND_DEPLOY_DIR || '/srv/simple-blog').replace(/\/+$/, '');
const CONTAINER_NAME = String(process.env.BACKUP_CONTAINER_NAME || 'blog-backend').trim();
const EXCLUDE_NAMES = new Set(['node_modules', '.git', '.DS_Store', '.wrangler', '.work']);
const EXCLUDE_FE_NAMES = new Set(['node_modules', '.git', '.DS_Store', '.wrangler', '.cache']);

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});

function localStamp(d) {
  const t = d instanceof Date ? d : new Date(d || Date.now());
  return dateFmt.format(t) + ' ' + timeFmt.format(t);
}

function fileStamp(d) {
  const t = d instanceof Date ? d : new Date(d || Date.now());
  const two = (n) => String(n).padStart(2, '0');
  // 文件名用北京时间，和后台其它时间保持一致
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(t).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return parts.year + parts.month + parts.day + '-' + parts.hour + parts.minute + parts.second;
}

function relativeToRoot(p) {
  const rel = path.relative(ROOT_DIR, p);
  return rel && !rel.startsWith('..') ? rel : p;
}

function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // 清理上次异常退出留下的临时目录
  let entries = [];
  try { entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true }); } catch (e) { entries = []; }
  entries.filter(e => e.isDirectory() && e.name.startsWith('.work-')).forEach((e) => {
    const full = path.join(BACKUP_DIR, e.name);
    try {
      const st = fs.statSync(full);
      if (Date.now() - st.mtimeMs > 60 * 60 * 1000) fs.rmSync(full, { recursive: true, force: true });
    } catch (ignored) {}
  });
}

function readHistory() {
  const raw = kvfile.readJson(HISTORY_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function writeHistory(list) {
  try {
    kvfile.writeJson(HISTORY_FILE, list, { mode: 0o600 });
  } catch (ignored) { /* 历史记录写失败不影响备份本体 */ }
}

function walk(dir) {
  const files = [];
  const rec = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) rec(full);
      else if (ent.isFile()) {
        try { files.push({ path: full, size: fs.statSync(full).size }); } catch (ignored) {}
      }
    }
  };
  rec(dir);
  return files;
}

function statsOf(dir) {
  const files = walk(dir);
  return { files: files.length, bytes: files.reduce((sum, f) => sum + f.size, 0) };
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

// 有些系统上 /tmp 之类的目录是软链接（macOS: /tmp -> /private/tmp），
// 直接比较字符串会漏掉「备份目录其实在 ROOT 里面」的情况，进而把暂存目录复制进自己。
function realOr(p) {
  try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); }
}

function isExcludedFromBackend(absPath) {
  if (EXCLUDE_NAMES.has(path.basename(absPath))) return true;
  if (isInside(BACKUP_DIR, absPath) || absPath === BACKUP_DIR) return true;
  const real = realOr(absPath);
  const realBackup = realOr(BACKUP_DIR);
  return isInside(realBackup, real) || real === realBackup;
}

function copyBackend(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const stats = { files: 0, bytes: 0 };
  const walk = (srcDir, outDir) => {
    let entries;
    try { entries = fs.readdirSync(srcDir, { withFileTypes: true }); } catch (e) { return; }
    for (const entry of entries) {
      const src = path.join(srcDir, entry.name);
      const out = path.join(outDir, entry.name);
      if (isExcludedFromBackend(src)) continue;
      if (entry.isDirectory()) {
        fs.mkdirSync(out, { recursive: true });
        walk(src, out);
      } else if (entry.isSymbolicLink()) {
        try { fs.symlinkSync(fs.readlinkSync(src), out); } catch (e) { /* 链接失败不影响其它文件 */ }
      } else if (entry.isFile()) {
        try {
          fs.copyFileSync(src, out);
          stats.files += 1;
          stats.bytes += fs.statSync(src).size;
        } catch (e) {
          throw new Error('复制失败：' + entry.name + '（' + e.message + '）');
        }
      }
    }
  };
  // 自己递归复制而不是 fs.cpSync：暂存目录就在 BACKUP_DIR 里，
  // cpSync 不允许「把目录复制进自己的子目录」，递归版可以按需跳过备份目录本身。
  walk(ROOT_DIR, destDir);
  return stats;
}

async function fetchWithTimeout(url, timeoutMs, asJson) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'simple-blog-backup/1.0' }
    });
    if (asJson) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return { ok: resp.ok, status: resp.status, buf };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFrontendVersion() {
  const info = { version: '', branch: '', commit: '', error: '' };
  if (!SITE_URL) { info.error = '未配置站点地址'; return info; }
  try {
    const data = await fetchWithTimeout(SITE_URL + '/version', 6000, true);
    info.version = String((data && data.version) || '');
    info.branch = String((data && data.branch) || '');
    info.commit = String((data && data.commit) || '');
    if (!info.version) info.error = '版本信息为空';
  } catch (e) {
    info.error = (e && e.message) ? e.message : String(e);
  }
  return info;
}

function findFrontendSourceDir() {
  const candidates = [];
  if (process.env.FRONTEND_DIR) candidates.push(path.resolve(process.env.FRONTEND_DIR));
  candidates.push(path.resolve(ROOT_DIR, '..', '前端'));
  candidates.push(path.resolve(ROOT_DIR, '..', 'frontend'));
  candidates.push(path.join(ROOT_DIR, '前端'));
  candidates.push(path.join(ROOT_DIR, 'frontend'));
  // V3 单体版：前端就在 backend/web 里，与后端一起备份即可
  candidates.push(path.join(ROOT_DIR, 'web'));
  for (const dir of candidates) {
    try {
      if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch (ignored) {}
  }
  return '';
}

const SNAPSHOT_FILES = [
  { url: '/', name: 'index.html' },
  { url: '/style.css', name: 'style.css' },
  { url: '/app.js', name: 'app.js' },
  { url: '/markdown.js', name: 'markdown.js' },
  { url: '/robots.txt', name: 'robots.txt' },
  { url: '/sitemap.xml', name: 'sitemap.xml' },
  { url: '/version', name: 'version.json' }
];

async function captureSnapshot(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const captured = [];
  const failed = [];
  for (const item of SNAPSHOT_FILES) {
    try {
      const out = await fetchWithTimeout(SITE_URL + item.url, 8000, false);
      if (!out.ok) throw new Error('HTTP ' + out.status);
      if (out.buf.length > 4 * 1024 * 1024) throw new Error('文件过大，跳过');
      fs.writeFileSync(path.join(destDir, item.name), out.buf);
      captured.push(item.name);
    } catch (e) {
      failed.push(item.url + '（' + ((e && e.message) || e) + '）');
    }
  }
  const note = [
    '# 前端静态快照',
    '',
    '服务器上没有前端源码时，备份脚本会抓取线上前端的静态文件作为快照。',
    'Cloudflare Pages Functions（functions/ 目录下的 [page].js、post/[[slug]].js、version.js、sitemap.xml.js）',
    '是服务端代码，无法从线上抓取，恢复时需要从 Git 仓库重新部署。',
    '',
    '抓取时间：' + localStamp(),
    '抓取成功：' + (captured.length ? captured.join('、') : '无'),
    '抓取失败：' + (failed.length ? failed.join('；') : '无')
  ].join('\n');
  fs.writeFileSync(path.join(destDir, 'SNAPSHOT.md'), note, 'utf8');
  return { files: captured.length, bytes: walk(destDir).reduce((s, f) => s + f.size, 0), captured, failed };
}

async function captureFrontend(destDir, prefetched) {
  fs.mkdirSync(destDir, { recursive: true });
  const version = (prefetched && typeof prefetched === 'object') ? prefetched : await fetchFrontendVersion();
  const result = {
    mode: 'none',
    version: version.version,
    branch: version.branch,
    commit: version.commit,
    versionError: version.error,
    sourceDir: '',
    files: 0,
    bytes: 0,
    captured: [],
    failed: []
  };
  const srcDir = findFrontendSourceDir();
  if (srcDir) {
    const target = path.join(destDir, 'source');
    fs.cpSync(srcDir, target, {
      recursive: true,
      preserveTimestamps: true,
      filter: (src) => !EXCLUDE_FE_NAMES.has(path.basename(src))
    });
    const st = statsOf(target);
    result.mode = 'source';
    result.sourceDir = srcDir;
    result.files = st.files;
    result.bytes = st.bytes;
  } else if (SITE_URL) {
    const snap = await captureSnapshot(path.join(destDir, 'snapshot'));
    if (snap.files > 0) {
      result.mode = 'snapshot';
      result.files = snap.files;
      result.bytes = snap.bytes;
      result.captured = snap.captured;
      result.failed = snap.failed;
    }
  }
  fs.writeFileSync(path.join(destDir, 'version.json'), JSON.stringify({
    version: result.version,
    branch: result.branch,
    commit: result.commit,
    mode: result.mode,
    site: SITE_URL,
    capturedAt: new Date().toISOString(),
    capturedAtLocal: localStamp(),
    error: result.versionError
  }, null, 2), 'utf8');
  return result;
}
const RESTORE_LINES = [
  '#!/usr/bin/env bash',
  '# 一键恢复 / 迁移脚本（由后台「管理 → 备份」生成）',
  '#',
  '# 用法：',
  '#   ./restore.sh --prepare-only   只体检：检查 Docker、文件完整性、磁盘空间，不改动任何东西',
  '#   ./restore.sh                  恢复到 TARGET_DIR（默认 ' + DEPLOY_DIR + '）',
  '#   ./restore.sh --force          覆盖目标目录中已有的数据与 config.json',
  '#   TARGET_DIR=/srv/my-blog ./restore.sh   恢复到其它目录',
  'set -euo pipefail',
  '',
  'HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
  'TARGET="${TARGET_DIR:-' + DEPLOY_DIR + '}"',
  'PORT="${PORT:-33001}"',
  'FORCE=0',
  'PREPARE_ONLY=0',
  '',
  'for arg in "$@"; do',
  '  case "$arg" in',
  '    --prepare-only) PREPARE_ONLY=1 ;;',
  '    --force) FORCE=1 ;;',
  '    -h|--help) sed -n "2,10p" "$0"; exit 0 ;;',
  '    *) echo "未知参数：${arg}（可用：--prepare-only / --force）" >&2; exit 2 ;;',
  '  esac',
  'done',
  '',
  'say()  { printf "\033[1;36m[backup]\033[0m %s\n" "$*"; }',
  'warn() { printf "\033[1;33m[backup]\033[0m %s\n" "$*"; }',
  'die()  { printf "\033[1;31m[backup]\033[0m %s\n" "$*" >&2; exit 1; }',
  '',
  '[ -f "$HERE/manifest.json" ] || die "缺少 manifest.json，请确认备份包已完整解压"',
  '[ -d "$HERE/backend" ] || die "缺少 backend/ 目录"',
  '[ -f "$HERE/backend/server.js" ] || die "缺少 backend/server.js"',
  '[ -f "$HERE/backend/package.json" ] || die "缺少 backend/package.json"',
  '[ -f "$HERE/backend/Dockerfile" ] || die "缺少 backend/Dockerfile"',
  '',
  "FE_VER=\"$(sed -n 's/.*\"version\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p' \"$HERE/manifest.json\" | head -n1)\"",
  "FE_MODE=\"$(sed -n 's/.*\"mode\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p' \"$HERE/manifest.json\" | head -n1)\"",
  'PKG_SIZE="$(du -sh "$HERE" 2>/dev/null | awk "{print \\$1}")"',
  'BACKEND_FILES="$(find "$HERE/backend" -type f 2>/dev/null | wc -l | tr -d " ")"',
  '',
  'say "备份包：$(basename "$HERE")（${PKG_SIZE}，${BACKEND_FILES} 个文件）"',
  'say "前端版本：${FE_VER:-未知}（备份方式：${FE_MODE:-unknown}）"',
  'say "恢复目标：$TARGET"',
  '',
  'MISSING=0',
  'if command -v docker >/dev/null 2>&1; then',
  '  say "Docker：$(docker --version 2>/dev/null)"',
  'else',
  '  warn "未检测到 docker：请先安装 Docker Engine（https://docs.docker.com/engine/install/）"',
  '  MISSING=$((MISSING + 1))',
  'fi',
  'if docker compose version >/dev/null 2>&1; then',
  '  say "Compose：$(docker compose version --short 2>/dev/null || echo v2)"',
  'else',
  '  warn "未检测到 docker compose（需要 Docker Compose v2）"',
  '  MISSING=$((MISSING + 1))',
  'fi',
  '',
  'PROBE_DIR="$TARGET"',
  'while [ ! -d "$PROBE_DIR" ] && [ "$PROBE_DIR" != "/" ]; do PROBE_DIR="$(dirname "$PROBE_DIR")"; done',
  'AVAIL_KB="$(df -Pk "$PROBE_DIR" 2>/dev/null | awk "NR==2 {print \\$4}")"',
  'NEED_KB="$(du -sk "$HERE/backend" 2>/dev/null | awk "{print \\$1}")"',
  'if [ -n "${AVAIL_KB:-}" ] && [ -n "${NEED_KB:-}" ] && [ "$AVAIL_KB" -lt "$NEED_KB" ]; then',
  '  warn "磁盘空间可能不足：需要约 $((NEED_KB / 1024)) MB，可用 $((AVAIL_KB / 1024)) MB"',
  'fi',
  '',
  'if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | awk "{print \\$4}" | grep -q ":$PORT$"; then',
  '  warn "本机 $PORT 端口已被占用，若目标机已有服务在跑请注意端口冲突"',
  'fi',
  '',
  'if [ -d "$TARGET" ]; then',
  '  say "目标目录已存在，已有数据默认不会被覆盖（加 --force 才覆盖）"',
  'else',
  '  say "目标目录不存在，将新建：$TARGET"',
  'fi',
  '',
  'if [ "$PREPARE_ONLY" = "1" ]; then',
  '  if [ "$MISSING" -gt 0 ]; then',
  '    warn "体检完成：有 $MISSING 项环境问题需要先处理，处理后再执行 ./restore.sh"',
  '    exit 1',
  '  fi',
  '  say "体检通过：可以执行 ./restore.sh 开始恢复（首次构建约 1-3 分钟）"',
  '  exit 0',
  'fi',
  '',
  '[ "$MISSING" -eq 0 ] || die "环境未就绪，请先安装 Docker 与 Compose，或先运行 ./restore.sh --prepare-only 查看"',
  '',
  'mkdir -p "$TARGET"',
  '',
  'copy_code() {',
  '  for item in "$HERE/backend"/* "$HERE/backend"/.[!.]*; do',
  '    [ -e "$item" ] || continue',
  '    base="$(basename "$item")"',
  '    case "$base" in',
  '      article|Musings|img|file|data|config.json) continue ;;',
  '    esac',
  '    if [ -d "$item" ]; then rm -rf "$TARGET/$base"; fi',
  '    cp -Rf "$item" "$TARGET/"',
  '  done',
  '}',
  '',
  'copy_data_dir() {',
  '  name="$1"',
  '  src="$HERE/backend/$name"',
  '  [ -d "$src" ] || return 0',
  '  if [ -d "$TARGET/$name" ] && [ -n "$(ls -A "$TARGET/$name" 2>/dev/null)" ] && [ "$FORCE" != "1" ]; then',
  '    warn "保留已有 $name/（要覆盖请加 --force）"',
  '    return 0',
  '  fi',
  '  mkdir -p "$TARGET/$name"',
  '  cp -Rf "$src/." "$TARGET/$name/"',
  '  say "已恢复 $name/"',
  '}',
  '',
  'say "复制后端代码…"',
  'copy_code',
  '',
  'for d in article Musings img file; do copy_data_dir "$d"; done',
  '',
  'if [ -f "$HERE/backend/config.json" ]; then',
  '  if [ -f "$TARGET/config.json" ] && [ "$FORCE" != "1" ]; then',
  '    warn "保留已有 config.json（要覆盖请加 --force）"',
  '  else',
  '    cp -f "$HERE/backend/config.json" "$TARGET/config.json"',
  '    say "已恢复 config.json"',
  '  fi',
  'fi',
  '',
  'if [ -d "$HERE/backend/data" ]; then',
  '  if [ -d "$TARGET/data" ] && [ -n "$(ls -A "$TARGET/data" 2>/dev/null)" ] && [ "$FORCE" != "1" ]; then',
  '    warn "保留已有 data/（管理员密码、会话、站点配置都在这里；要覆盖请加 --force）"',
  '  else',
  '    mkdir -p "$TARGET/data"',
  '    cp -Rf "$HERE/backend/data/." "$TARGET/data/"',
  '    say "已恢复 data/（管理员账号 / 会话 / 站点配置）"',
  '  fi',
  'fi',
  '',
  'if [ ! -f "$TARGET/.env" ] && [ -f "$HERE/.env.example" ]; then',
  '  cp -f "$HERE/.env.example" "$TARGET/.env"',
  '  say "已生成 .env（一般无需修改；如需换域名/密码请编辑）"',
  'fi',
  '',
  'cat > "$TARGET/docker-compose.yml" <<EOF',
  'services:',
  '  backend:',
  '    build: .',
  '    container_name: ' + CONTAINER_NAME,
  '    restart: unless-stopped',
  '    ports:',
  '      - "127.0.0.1:${PORT}:33001"',
  '    environment:',
  '      - TZ=${TZ:-Asia/Shanghai}',
  '      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}',
  '      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}',
  '      - SITE_PUBLIC_URL=${SITE_PUBLIC_URL:-https://example.com}',
  '      - BACKEND_PUBLIC_URL=${BACKEND_PUBLIC_URL:-https://api.example.com}',
  '    volumes:',
  '      - ${TARGET}/config.json:/app/config.json',
  '      - ${TARGET}/article:/app/article',
  '      - ${TARGET}/Musings:/app/Musings',
  '      - ${TARGET}/img:/app/img',
  '      - ${TARGET}/file:/app/file',
  '      - ${TARGET}/data:/app/data',
  '    working_dir: /app',
  'EOF',
  'say "已写入 docker-compose.yml（端口 127.0.0.1:$PORT → 容器 33001）"',
  '',
  'if [ "$(id -u)" = "0" ]; then',
  '  chown -R 1000:1000 "$TARGET" 2>/dev/null || warn "chown 1000:1000 失败，容器可能无法写数据"',
  'elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then',
  '  sudo chown -R 1000:1000 "$TARGET" 2>/dev/null || warn "chown 1000:1000 失败，容器可能无法写数据"',
  'else',
  '  warn "非 root，跳过 chown；若容器报权限错误，请执行：sudo chown -R 1000:1000 $TARGET"',
  'fi',
  '',
  'cd "$TARGET"',
  '# 单文件 bind mount 必须先存在，否则 Docker 会把 config.json 建成目录',
  '[ -f "$TARGET/config.json" ] || : > "$TARGET/config.json"',
  'say "构建并启动容器（首次构建需要 1-3 分钟）…"',
  'docker compose up -d --build',
  '',
  'say "等待后端就绪…"',
  'READY=0',
  'for i in $(seq 1 60); do',
  '  if command -v curl >/dev/null 2>&1; then',
  '    if curl -fsS "http://127.0.0.1:$PORT/api/deploy-version" >/dev/null 2>&1; then READY=1; break; fi',
  '  else',
  '    if docker compose ps --status running 2>/dev/null | grep -q backend; then READY=1; break; fi',
  '  fi',
  '  sleep 2',
  'done',
  '',
  'if [ "$READY" = "1" ]; then',
  '  say "恢复完成：后端已在 127.0.0.1:$PORT 监听"',
  'else',
  '  warn "容器已启动但健康检查未通过，请执行：cd $TARGET && docker compose logs -f backend"',
  'fi',
  '',
  'echo',
  'say "下一步："',
  'echo "  1. 用 nginx / Caddy 把 127.0.0.1:$PORT 反代到你的域名（HTTPS）"',
  'echo "  2. 打开 https://你的域名/<adminPath> 登录后台（adminPath 见 data/site.json 或 SITE_* 配置）"',
  'echo "  3. 文章、评论、图片、配置都在 $TARGET 下，无需额外导入数据库"',
  'echo "  4. 前端如需重新部署：查看包内 frontend/ 与 MIGRATION.md"',
  ''
];
const RESTORE_SH = RESTORE_LINES.join('\n');

function buildRestoreScript() { return RESTORE_SH; }

function buildComposePortable() {
  return [
    '# 可直接在解压后的备份包根目录运行：docker compose up -d --build',
    '# 如果要把数据恢复到标准目录，请优先使用 ./restore.sh',
    'services:',
    '  backend:',
    '    build: ./backend',
    '    container_name: ' + CONTAINER_NAME,
    '    restart: unless-stopped',
    '    ports:',
    '      - "127.0.0.1:${HOST_PORT:-33001}:33001"',
    '    environment:',
    '      - TZ=${TZ:-Asia/Shanghai}',
    '      - ADMIN_USERNAME=${ADMIN_USERNAME:-admin}',
    '      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}',
    '      - SITE_PUBLIC_URL=${SITE_PUBLIC_URL:-https://example.com}',
    '      - BACKEND_PUBLIC_URL=${BACKEND_PUBLIC_URL:-https://api.example.com}',
    '    volumes:',
    '      - ./backend/config.json:/app/config.json',
    '      - ./backend/article:/app/article',
    '      - ./backend/Musings:/app/Musings',
    '      - ./backend/img:/app/img',
    '      - ./backend/file:/app/file',
    '      - ./backend/data:/app/data',
    '    working_dir: /app',
    ''
  ].join('\n');
}

function buildEnvExample() {
  return [
    '# 后端环境变量（docker compose 会自动读取同目录的 .env）',
    '# 迁移后一般不需要修改：管理员密码、密钥、站点配置都随 data/ 一起恢复了。',
    'TZ=Asia/Shanghai',
    'ADMIN_USERNAME=admin',
    '# 留空则沿用备份内的管理员密码（data/auth.json）',
    'ADMIN_PASSWORD=',
    'SITE_PUBLIC_URL=' + (process.env.SITE_PUBLIC_URL || 'https://example.com'),
    'BACKEND_PUBLIC_URL=' + (process.env.BACKEND_PUBLIC_URL || 'https://api.example.com'),
    '# 宿主机监听端口（只监听 127.0.0.1，由 nginx 反代）',
    'HOST_PORT=33001',
    ''
  ].join('\n');
}
function buildMigrationDoc(manifest) {
  const fe = manifest.frontend || {};
  const modeText = fe.mode === 'source' ? '前端源码（完整）'
    : fe.mode === 'snapshot' ? '线上静态快照（不含 Cloudflare Functions 源码）'
      : '未备份前端';
  return [
    '# 备份与迁移说明',
    '',
    '本备份包由后台「管理 → 备份与迁移」生成，包含后端代码、全部数据与前端版本信息。',
    '',
    '| 项目 | 内容 |',
    '| --- | --- |',
    '| 生成时间 | ' + manifest.createdAtLocal + ' |',
    '| 站点 | ' + (manifest.site || '-') + ' |',
    '| 前端版本 | ' + (fe.version || '未知') + ' |',
    '| 前端分支 / 提交 | ' + (fe.branch || '-') + ' / ' + (fe.commit ? String(fe.commit).slice(0, 8) : '-') + ' |',
    '| 前端备份方式 | ' + modeText + ' |',
    '| 后端文件 | ' + manifest.backend.files + ' 个，' + (manifest.backend.bytes / 1048576).toFixed(2) + ' MB |',
    '',
    '## 包里有什么',
    '',
    '- backend/：完整后端目录（server.js、admin.*、backend/ 模块、config.json、article/、Musings/、img/、file/、data/）',
    '- frontend/：' + (fe.mode === 'source'
      ? '前端源码（V1/V2 可直接重新部署到 Cloudflare Pages；V3 单体版就是 backend/web，随服务一起跑）'
      : fe.mode === 'snapshot' ? '线上前端静态快照（index.html、style.css、app.js 等）' : '无'),
    '- manifest.json：备份元信息（含前端部署版本号）',
    '- restore.sh：一键恢复 / 迁移脚本',
    '- docker-compose.yml、.env.example：可移植的容器编排',
    '',
    '## 目标服务器要求',
    '',
    '- Linux（Debian / Ubuntu / CentOS 均可），已安装 Docker Engine 与 Docker Compose v2',
    '- 至少 2 GB 可用磁盘（镜像与 node_modules 约 500 MB，数据按实际大小）',
    '- 80/443 端口留给 nginx 或 Caddy，后端容器只监听 127.0.0.1:33001',
    '',
    '## 一键迁移步骤',
    '',
    '1. 把备份包上传到新服务器并解压：',
    '',
    '   ~~~bash',
    '   mkdir -p /root/site-restore && cd /root/site-restore',
    '   tar -xzf ' + BACKUP_PREFIX + '*.tar.gz --strip-components=1',
    '   chmod +x restore.sh',
    '   ~~~',
    '',
    '2. 体检（不会改动任何文件）：',
    '',
    '   ~~~bash',
    '   ./restore.sh --prepare-only',
    '   ~~~',
    '',
    '3. 执行迁移（默认恢复到 ' + DEPLOY_DIR + '，可用 TARGET_DIR 改路径）：',
    '',
    '   ~~~bash',
    '   TARGET_DIR=' + DEPLOY_DIR + ' ./restore.sh',
    '   ~~~',
    '',
    '   脚本会复制代码与数据、生成 docker-compose.yml 与 .env、修正权限、构建并启动容器，最后做健康检查。',
    '',
    '4. 配置反向代理（示例）：',
    '',
    '   ~~~nginx',
    '   server {',
    '     listen 443 ssl http2;',
    '     server_name api.example.com;',
    '     location / {',
    '       proxy_pass http://127.0.0.1:33001;',
    '       proxy_set_header Host $host;',
    '       proxy_set_header X-Real-IP $remote_addr;',
    '       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '       proxy_set_header X-Forwarded-Proto $scheme;',
    '     }',
    '   }',
    '   ~~~',
    '',
    '5. 打开后台（https://你的域名/<adminPath>），确认文章、评论、图片、瞬间都在。',
    '',
    '## 迁移后检查清单',
    '',
    '- [ ] 后台能登录（账号密码、两步验证、通行密钥沿用备份中的 data/）',
    '- [ ] 前台能读到文章与评论（后端跨域已放行站点域名）',
    '- [ ] 图片 / 附件能正常访问（img/、file/ 已恢复）',
    '- [ ] 站点配置正确（data/site.json：站点名、栏目、探针、IndexNow、Telegram）',
    '- [ ] 反向代理透传 X-Forwarded-For（登录风控与评论 IP 需要真实 IP）',
    '- [ ] 容器日志无报错（docker compose logs -f backend）',
    '',
    '## 前端说明',
    '',
    fe.mode === 'source'
      ? '备份里带的是前端源码，可用 wrangler pages deploy 或 Cloudflare Pages 的 Git 集成重新部署。'
      : fe.mode === 'snapshot'
        ? '备份里只有线上静态快照。Cloudflare Pages Functions（functions/ 下的服务端代码）无法从线上抓取，迁移前端时请从 Git 仓库重新部署；快照可用于比对线上文件。'
        : '本次没有备份前端，迁移前端请从 Git 仓库重新部署。',
    '',
    '前端部署后确认 GET /version 返回的版本号与备份记录一致：',
    '',
    '~~~bash',
    'curl -s https://你的站点/version',
    '~~~',
    '',
    '## 安全提醒',
    '',
    '备份包含 data/auth.json（管理员密码哈希、TOTP 密钥、通行密钥）与 config.json。请把备份包当作密码一样保管：不要上传到公开仓库、网盘公开分享或聊天群。',
    '',
    '## 回滚',
    '',
    '在原服务器上保留旧目录与旧容器，迁移失败时把 nginx 指回原端口即可；本备份包也可用 ./restore.sh --force 覆盖回滚。',
    ''
  ].join('\n');
}

async function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function createTar(srcName, workDir, outFile) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, { COPYFILE_DISABLE: '1' });
    const proc = spawn('tar', ['-czf', outFile, '-C', workDir, srcName], { env });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', (err) => reject(new Error('无法调用系统 tar：' + err.message)));
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error('tar 打包失败（退出码 ' + code + '）：' + stderr.trim().slice(0, 300)));
    });
  });
}

let currentJob = null;
let runningPromise = null;

function jobSnapshot(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    step: job.step,
    stepLabel: job.stepLabel,
    startedAt: job.startedAt,
    startedAtLocal: job.startedAtLocal,
    finishedAt: job.finishedAt,
    fileName: job.fileName,
    size: job.size,
    sha256: job.sha256,
    frontend: job.frontend,
    backend: job.backend,
    webdav: job.webdav,
    error: job.error
  };
}

async function createBackup() {
  ensureDirs();
  const startedAt = new Date();
  const id = 'bk-' + startedAt.getTime();
  const job = {
    id,
    status: 'running',
    step: 'version',
    stepLabel: '读取前端版本',
    startedAt: startedAt.toISOString(),
    startedAtLocal: localStamp(startedAt),
    finishedAt: '',
    fileName: '',
    size: 0,
    sha256: '',
    frontend: null,
    backend: null,
    webdav: null,
    error: ''
  };
  currentJob = job;
  const workRoot = path.join(BACKUP_DIR, '.work-' + id);
  try {
    const version = await fetchFrontendVersion();
    const verPart = String(version.version || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24) || 'unknown';
    const bundleName = BACKUP_PREFIX + fileStamp(startedAt) + '-fe' + verPart;
    const bundleDir = path.join(workRoot, bundleName);
    fs.mkdirSync(bundleDir, { recursive: true });

    job.step = 'backend';
    job.stepLabel = '复制后端与数据';
    const backendStats = copyBackend(path.join(bundleDir, 'backend'));

    job.step = 'frontend';
    job.stepLabel = '备份前端';
    const fe = await captureFrontend(path.join(bundleDir, 'frontend'), version);
    job.frontend = { mode: fe.mode, version: fe.version, branch: fe.branch, commit: fe.commit };
    job.backend = backendStats;

    job.step = 'manifest';
    job.stepLabel = '生成迁移文件';
    const manifest = {
      ok: true,
      kind: BACKUP_KIND,
      schema: 1,
      createdAt: startedAt.toISOString(),
      createdAtLocal: localStamp(startedAt),
      host: os.hostname(),
      node: process.version,
      site: SITE_URL,
      backend: {
        files: backendStats.files,
        bytes: backendStats.bytes,
        excluded: ['node_modules', '.git', '.DS_Store', 'data/backups']
      },
      frontend: {
        mode: fe.mode,
        version: fe.version,
        branch: fe.branch,
        commit: fe.commit,
        sourceDir: fe.sourceDir ? relativeToRoot(fe.sourceDir) : '',
        files: fe.files,
        bytes: fe.bytes,
        versionError: fe.versionError,
        snapshotFiles: fe.captured,
        snapshotFailed: fe.failed
      },
      restore: {
        script: 'restore.sh',
        prepare: './restore.sh --prepare-only',
        guide: 'MIGRATION.md'
      }
    };
    fs.writeFileSync(path.join(bundleDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(path.join(bundleDir, 'restore.sh'), buildRestoreScript(manifest), { encoding: 'utf8', mode: 0o755 });
    fs.writeFileSync(path.join(bundleDir, 'MIGRATION.md'), buildMigrationDoc(manifest), 'utf8');
    fs.writeFileSync(path.join(bundleDir, 'docker-compose.yml'), buildComposePortable(), 'utf8');
    fs.writeFileSync(path.join(bundleDir, '.env.example'), buildEnvExample(), 'utf8');

    job.step = 'archive';
    job.stepLabel = '打包压缩';
    const fileName = bundleName + '.tar.gz';
    const outFile = path.join(BACKUP_DIR, fileName);
    await createTar(bundleName, workRoot, outFile);
    const stat = fs.statSync(outFile);
    const sha256 = await sha256File(outFile);

    const entry = {
      id,
      file: fileName,
      size: stat.size,
      sha256,
      createdAt: startedAt.toISOString(),
      createdAtLocal: localStamp(startedAt),
      frontend: { mode: fe.mode, version: fe.version, branch: fe.branch, commit: fe.commit },
      backend: { files: backendStats.files, bytes: backendStats.bytes }
    };
    // 启用 WebDAV 后每次备份自动上传；上传失败不影响本地备份
    const settings = readSettings();
    if (settings.webdav.enabled && settings.webdav.autoUpload) {
      job.step = 'webdav';
      job.stepLabel = '上传 WebDAV';
      try {
        const up = await uploadArchive(outFile, fileName);
        entry.webdav = { ok: true, url: up.url, uploadedAt: new Date().toISOString() };
        job.webdav = entry.webdav;
        const s = readSettings();
        s.lastError = '';
        writeSettings(s);
      } catch (e) {
        entry.webdav = { ok: false, error: e.message || String(e) };
        job.webdav = entry.webdav;
        const s = readSettings();
        s.lastError = 'WebDAV：' + (e.message || String(e));
        writeSettings(s);
      }
    }
    const history = [entry].concat(readHistory().filter((h) => h && h.file !== fileName));
    writeHistory(history);
    pruneArchives();

    job.status = 'done';
    job.step = 'done';
    job.stepLabel = '完成';
    job.finishedAt = new Date().toISOString();
    job.fileName = fileName;
    job.size = stat.size;
    job.sha256 = sha256;
    job.frontend = entry.frontend;
    job.backend = entry.backend;
    return jobSnapshot(job);
  } catch (err) {
    job.status = 'error';
    job.step = 'error';
    job.stepLabel = '失败';
    job.error = (err && err.message) ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
    console.warn('[backup] 备份失败：', job.error);
    throw err;
  } finally {
    try { fs.rmSync(workRoot, { recursive: true, force: true }); } catch (ignored) {}
    runningPromise = null;
  }
}

function startBackup() {
  if (runningPromise || (currentJob && currentJob.status === 'running')) {
    return { busy: true, job: jobSnapshot(currentJob) };
  }
  runningPromise = createBackup().catch(() => {});
  return { busy: false, job: jobSnapshot(currentJob) };
}

function listArchives() {
  const history = readHistory();
  const alive = history.filter((h) => {
    if (!h || !h.file) return false;
    try { return fs.statSync(path.join(BACKUP_DIR, h.file)).isFile(); } catch (e) { return false; }
  });
  let files = [];
  try { files = fs.readdirSync(BACKUP_DIR).filter((n) => n.startsWith(BACKUP_PREFIX) && n.endsWith('.tar.gz')); } catch (e) { files = []; }
  for (const file of files) {
    if (alive.some((h) => h.file === file)) continue;
    try {
      const st = fs.statSync(path.join(BACKUP_DIR, file));
      alive.push({
        id: file,
        file,
        size: st.size,
        sha256: '',
        createdAt: st.mtime.toISOString(),
        createdAtLocal: localStamp(st.mtime),
        frontend: { mode: 'unknown', version: '', branch: '', commit: '' },
        backend: { files: 0, bytes: 0 }
      });
    } catch (ignored) {}
  }
  alive.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return alive;
}

function pruneArchives() {
  const all = listArchives();
  const limit = getKeep();
  const keep = all.slice(0, limit);
  const drop = all.slice(limit);
  for (const entry of drop) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, entry.file)); } catch (ignored) {}
  }
  writeHistory(keep);
  return keep;
}

function removeArchive(file) {
  const name = path.basename(String(file || ''));
  if (!name || !name.startsWith(BACKUP_PREFIX) || !name.endsWith('.tar.gz')) {
    return { ok: false, error: '文件名不合法' };
  }
  const full = path.join(BACKUP_DIR, name);
  if (!isInside(BACKUP_DIR, full) || full === BACKUP_DIR) return { ok: false, error: '路径不合法' };
  try { fs.unlinkSync(full); } catch (e) {
    if (e && e.code !== 'ENOENT') return { ok: false, error: '删除失败：' + e.message };
  }
  writeHistory(readHistory().filter((h) => h && h.file !== name));
  return { ok: true };
}

function getStatus() {
  let free = 0;
  try { ensureDirs(); } catch (ignored) {}
  try {
    const st = fs.statfsSync(BACKUP_DIR);
    free = st.bavail * st.bsize;
  } catch (ignored) {}
  const frontendDir = findFrontendSourceDir();
  return {
    ok: true,
    running: !!(currentJob && currentJob.status === 'running'),
    job: jobSnapshot(currentJob),
    history: listArchives(),
    config: {
      keep: getKeep(),
      dir: relativeToRoot(BACKUP_DIR),
      site: SITE_URL,
      frontendDir: frontendDir ? relativeToRoot(frontendDir) : '',
      freeBytes: free
    },
    settings: publicSettings()
  };
}

// ---- 备份计划与 WebDAV ----
const SETTINGS_FILE = path.join(DATA_DIR, 'backup-settings.json');
const SETTINGS_DEFAULT = {
  auto: false,
  time: '03:00',
  keep: KEEP,
  webdav: { enabled: false, url: '', username: '', password: '', dir: '/blog-backup', autoUpload: true },
  lastRun: '',
  lastError: ''
};

function cnToday() {
  return dateFmt.format(new Date());
}

function cnNowHM() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return parts.hour + ':' + parts.minute;
}

function normalizeTime(value) {
  const s = String(value == null ? '' : value).trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : SETTINGS_DEFAULT.time;
}

function normalizeDavDir(value) {
  let s = String(value == null ? '' : value).trim();
  if (!s) return SETTINGS_DEFAULT.webdav.dir;
  s = s.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (s.charAt(0) !== '/') s = '/' + s;
  s = s.replace(/\/+$/, '');
  return s || SETTINGS_DEFAULT.webdav.dir;
}

function normalizeDavUrl(value) {
  const s = String(value == null ? '' : value).trim().replace(/\/+$/, '');
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString().replace(/\/+$/, '');
  } catch (e) {
    return '';
  }
}

function mergeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const dav = src.webdav && typeof src.webdav === 'object' ? src.webdav : {};
  return {
    auto: !!src.auto,
    time: normalizeTime(src.time),
    keep: Math.max(1, Math.min(50, Number(src.keep) || KEEP)),
    webdav: {
      enabled: !!dav.enabled,
      url: normalizeDavUrl(dav.url),
      username: String(dav.username == null ? '' : dav.username).trim().slice(0, 100),
      password: String(dav.password == null ? '' : dav.password).slice(0, 300),
      dir: normalizeDavDir(dav.dir),
      autoUpload: dav.autoUpload === undefined ? true : !!dav.autoUpload
    },
    lastRun: String(src.lastRun || '').slice(0, 32),
    lastError: String(src.lastError || '').slice(0, 300)
  };
}

function readSettings() {
  return mergeSettings(kvfile.readJson(SETTINGS_FILE, null));
}

function writeSettings(settings) {
  try {
    kvfile.writeJson(SETTINGS_FILE, mergeSettings(settings), { mode: 0o600 });
  } catch (e) {
    console.warn('[backup] 保存备份设置失败：', e.message);
  }
}

function publicSettings(settings) {
  const s = settings || readSettings();
  return {
    auto: s.auto,
    time: s.time,
    keep: s.keep,
    webdav: {
      enabled: s.webdav.enabled,
      url: s.webdav.url,
      username: s.webdav.username,
      dir: s.webdav.dir,
      autoUpload: s.webdav.autoUpload,
      passwordSet: !!s.webdav.password
    },
    lastRun: s.lastRun,
    lastError: s.lastError
  };
}

/** 保存设置：password 省略或空字符串表示保持原密码 */
function saveSettings(patch) {
  const current = readSettings();
  const p = patch && typeof patch === 'object' ? patch : {};
  const davPatch = p.webdav && typeof p.webdav === 'object' ? p.webdav : null;
  const next = {
    auto: p.auto === undefined ? current.auto : !!p.auto,
    time: p.time === undefined ? current.time : normalizeTime(p.time),
    keep: p.keep === undefined ? current.keep : Math.max(1, Math.min(50, Number(p.keep) || current.keep)),
    webdav: {
      enabled: davPatch && davPatch.enabled !== undefined ? !!davPatch.enabled : current.webdav.enabled,
      url: davPatch && davPatch.url !== undefined ? normalizeDavUrl(davPatch.url) : current.webdav.url,
      username: davPatch && davPatch.username !== undefined ? String(davPatch.username || '').trim().slice(0, 100) : current.webdav.username,
      password: davPatch && davPatch.password ? String(davPatch.password).slice(0, 300) : current.webdav.password,
      dir: davPatch && davPatch.dir !== undefined ? normalizeDavDir(davPatch.dir) : current.webdav.dir,
      autoUpload: davPatch && davPatch.autoUpload !== undefined ? !!davPatch.autoUpload : current.webdav.autoUpload
    },
    lastRun: p.lastRun === undefined ? current.lastRun : String(p.lastRun || '').slice(0, 32),
    lastError: p.lastError === undefined ? current.lastError : String(p.lastError || '').slice(0, 300)
  };
  writeSettings(next);
  return next;
}

function getKeep() {
  try { return readSettings().keep; } catch (e) { return KEEP; }
}

function davAuthHeader(dav) {
  if (!dav.username && !dav.password) return {};
  return { Authorization: 'Basic ' + Buffer.from(String(dav.username || '') + ':' + String(dav.password || '')).toString('base64') };
}

function davTarget(dav, extra) {
  const base = new URL(dav.url);
  const basePath = base.pathname.replace(/\/+$/, '');
  const dirPath = String(dav.dir || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  let full = basePath + (dirPath ? '/' + dirPath : '');
  if (extra) full += '/' + String(extra).split('/').map(encodeURIComponent).join('/');
  return base.origin + full;
}

async function davFetch(url, options, timeoutMs) {
  const opts = Object.assign({}, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 30000);
  opts.signal = controller.signal;
  try {
    return await fetch(url, opts);
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDavDirs(dav) {
  if (!dav.url) throw new Error('WebDAV 地址未填写');
  const base = new URL(dav.url);
  const segs = base.pathname.split('/').filter(Boolean)
    .concat(String(dav.dir || '').split('/').filter(Boolean));
  const auth = davAuthHeader(dav);
  let pathname = '';
  for (let i = 0; i < segs.length; i++) {
    pathname += '/' + encodeURIComponent(segs[i]);
    const target = base.origin + pathname;
    let res;
    try {
      res = await davFetch(target, { method: 'MKCOL', headers: auth }, 30000);
    } catch (e) {
      throw new Error('无法连接 WebDAV：' + (e && e.name === 'AbortError' ? '连接超时' : (e.message || e)));
    }
    // 201 新建 / 200-204 成功 / 301-302 已存在或重定向 / 405 已存在
    if (res.status === 401 || res.status === 403) throw new Error('WebDAV 认证失败（HTTP ' + res.status + '）');
    if (res.status >= 400 && res.status !== 405 && res.status !== 409) {
      throw new Error('WebDAV 创建目录失败（HTTP ' + res.status + '）');
    }
  }
}

async function uploadArchive(filePath, fileName) {
  const settings = readSettings();
  const dav = settings.webdav;
  if (!dav.enabled) throw new Error('WebDAV 未启用');
  if (!dav.url) throw new Error('WebDAV 地址未填写');
  await ensureDavDirs(dav);
  let buf;
  try { buf = fs.readFileSync(filePath); } catch (e) { throw new Error('读取备份文件失败：' + e.message); }
  const target = davTarget(dav, fileName);
  let res;
  try {
    res = await davFetch(target, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/gzip', 'Content-Length': String(buf.length) }, davAuthHeader(dav)),
      body: buf
    }, 300000);
  } catch (e) {
    throw new Error('WebDAV 上传失败：' + (e && e.name === 'AbortError' ? '连接超时' : (e.message || e)));
  }
  if (res.status === 401 || res.status === 403) throw new Error('WebDAV 认证失败（HTTP ' + res.status + '）');
  if (!res.ok) throw new Error('WebDAV 上传失败（HTTP ' + res.status + '）');
  return { ok: true, url: target, size: buf.length };
}

async function testWebdav(patch) {
  const settings = saveSettings(patch || {});
  if (!settings.webdav.url) return { ok: false, error: 'WebDAV 地址未填写' };
  const fileName = '_backup-test-' + Date.now() + '.txt';
  try {
    await ensureDavDirs(settings.webdav);
    const target = davTarget(settings.webdav, fileName);
    const body = Buffer.from('backup webdav test ' + new Date().toISOString(), 'utf8');
    const res = await davFetch(target, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': String(body.length) }, davAuthHeader(settings.webdav)),
      body: body
    }, 60000);
    if (!res.ok) return { ok: false, error: '写入测试文件失败（HTTP ' + res.status + '）' };
    try {
      await davFetch(target, { method: 'DELETE', headers: davAuthHeader(settings.webdav) }, 30000);
    } catch (ignored) {}
    return { ok: true, url: target };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

let schedulerTimer = null;
let scheduledRunning = false;

async function runScheduledBackup() {
  if (scheduledRunning) return;
  if (runningPromise || (currentJob && currentJob.status === 'running')) return;
  scheduledRunning = true;
  try {
    await createBackup();
    const s = readSettings();
    s.lastRun = localStamp(new Date()).slice(0, 16);
    s.lastError = '';
    writeSettings(s);
  } catch (e) {
    const s = readSettings();
    s.lastError = (e && e.message) ? e.message : String(e);
    writeSettings(s);
  } finally {
    scheduledRunning = false;
  }
}

/** 每分钟检查一次：到点且当天没跑过就自动备份（服务器晚启动会在当天补跑） */
function startScheduler() {
  if (schedulerTimer) return schedulerTimer;
  const tick = () => {
    try {
      const s = readSettings();
      if (!s.auto) return;
      const today = cnToday();
      if (s.lastRun && s.lastRun.slice(0, 10) === today) return;
      if (cnNowHM() < s.time) return;
      runScheduledBackup();
    } catch (e) {
      console.warn('[backup] 自动备份检查失败：', e.message);
    }
  };
  schedulerTimer = setInterval(tick, 60 * 1000);
  if (schedulerTimer.unref) schedulerTimer.unref();
  const boot = setTimeout(tick, 5000);
  if (boot.unref) boot.unref();
  return schedulerTimer;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 64 * 1024) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function handleRequest(req, res, pathname, reqUrl) {
  if (req.method === 'GET' && pathname === '/api/admin/backup/status') {
    return sendJson(res, 200, getStatus());
  }

  if (req.method === 'GET' && pathname === '/api/admin/backup/history') {
    return sendJson(res, 200, { ok: true, history: listArchives(), config: getStatus().config });
  }

  if (req.method === 'POST' && pathname === '/api/admin/backup/start') {
    await readBody(req);
    if (runningPromise || (currentJob && currentJob.status === 'running')) {
      return sendJson(res, 409, { ok: false, error: '已有备份任务在进行中', job: jobSnapshot(currentJob) });
    }
    const result = startBackup();
    return sendJson(res, 202, { ok: true, job: result.job });
  }

  if (req.method === 'GET' && pathname === '/api/admin/backup/download') {
    const name = path.basename(String(reqUrl.searchParams.get('file') || ''));
    if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith('.tar.gz')) {
      return sendJson(res, 400, { ok: false, error: '文件名不合法' });
    }
    const full = path.join(BACKUP_DIR, name);
    if (!isInside(BACKUP_DIR, full) || !fs.existsSync(full)) {
      return sendJson(res, 404, { ok: false, error: '备份文件不存在' });
    }
    let stat;
    try { stat = fs.statSync(full); } catch (e) { return sendJson(res, 404, { ok: false, error: '备份文件不存在' }); }
    res.writeHead(200, {
      'Content-Type': 'application/gzip',
      'Content-Disposition': 'attachment; filename="' + name + '"',
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = fs.createReadStream(full);
    stream.on('error', () => { try { res.destroy(); } catch (ignored) {} });
    return stream.pipe(res);
  }

  if (req.method === 'POST' && pathname === '/api/admin/backup/delete') {
    const raw = await readBody(req);
    let file = '';
    try { file = String((JSON.parse(raw || '{}') || {}).file || ''); } catch (e) { file = ''; }
    const out = removeArchive(file);
    return sendJson(res, out.ok ? 200 : 400, out);
  }

  if (req.method === 'GET' && pathname === '/api/admin/backup/settings') {
    return sendJson(res, 200, { ok: true, settings: publicSettings(), config: getStatus().config });
  }

  if (req.method === 'POST' && pathname === '/api/admin/backup/settings') {
    const raw = await readBody(req);
    let patch = {};
    try { patch = JSON.parse(raw || '{}') || {}; } catch (e) { return sendJson(res, 400, { ok: false, error: '请求格式错误' }); }
    const saved = saveSettings(patch);
    return sendJson(res, 200, { ok: true, settings: publicSettings(saved), config: getStatus().config });
  }

  if (req.method === 'POST' && pathname === '/api/admin/backup/webdav-test') {
    const raw = await readBody(req);
    let patch = {};
    try { patch = JSON.parse(raw || '{}') || {}; } catch (e) { patch = {}; }
    const out = await testWebdav(patch);
    return sendJson(res, out.ok ? 200 : 400, out);
  }

  if (req.method === 'POST' && pathname === '/api/admin/backup/webdav-upload') {
    const raw = await readBody(req);
    let file = '';
    try { file = String((JSON.parse(raw || '{}') || {}).file || ''); } catch (e) { file = ''; }
    if (!file) {
      const latest = listArchives()[0];
      file = latest ? latest.file : '';
    }
    const name = path.basename(file);
    if (!name || !name.startsWith(BACKUP_PREFIX) || !name.endsWith('.tar.gz')) {
      return sendJson(res, 400, { ok: false, error: '没有可上传的备份文件' });
    }
    const full = path.join(BACKUP_DIR, name);
    if (!isInside(BACKUP_DIR, full) || !fs.existsSync(full)) {
      return sendJson(res, 404, { ok: false, error: '备份文件不存在' });
    }
    try {
      const out = await uploadArchive(full, name);
      return sendJson(res, 200, out);
    } catch (err) {
      const s = readSettings();
      s.lastError = 'WebDAV：' + (err.message || String(err));
      writeSettings(s);
      return sendJson(res, 400, { ok: false, error: err.message || String(err) });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Not Found' });
}

module.exports = {
  handleRequest,
  startBackup,
  createBackup,
  getStatus,
  listArchives,
  removeArchive,
  readSettings,
  saveSettings,
  publicSettings,
  testWebdav,
  uploadArchive,
  startScheduler,
  runScheduledBackup,
  BACKUP_DIR,
  SETTINGS_FILE,
  KEEP
};

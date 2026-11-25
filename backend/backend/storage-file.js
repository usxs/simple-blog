const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mdparse = require('./mdparse');
const text = require('./text');
const normalizeTags = mdparse.normalizeTags;
const excerptOf = text.excerptOf;
const sanitizeFileName = text.sanitizeFileName;
const sanitizeId = text.sanitizeId;
const collectCascadeIds = text.collectCascadeIds;
const summarizeItem = text.summarizeItem;
const dateMsOf = text.dateMsOf;
const sortNewestFirst = text.sortNewestFirst;

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLE_DIR = path.join(ROOT_DIR, 'article');
const MUSINGS_DIR = path.join(ROOT_DIR, 'Musings');
const IMG_DIR = path.join(ROOT_DIR, 'img');
const FILE_DIR = path.join(ROOT_DIR, 'file');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');

[ARTICLE_DIR, MUSINGS_DIR, IMG_DIR, FILE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    tools: [],
    status: [],
    quirky: []
  }, null, 2), 'utf8');
}

// 中国大陆时区（Asia/Shanghai, UTC+8）：所有落盘日期统一按北京时间生成，
// 不依赖容器/宿主机的系统时区设置
const CN_TIMEZONE = 'Asia/Shanghai';
const cnDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
// 'YYYY-MM-DD'（北京时间）
function cnDateOf(d) {
  return cnDateFmt.format(d instanceof Date ? d : new Date(d));
}

function getDateFolder() {
  // 文章目录 article/YYYY-MM-DD 按北京时间归档
  return cnDateOf(new Date());
}

// ---- 原子写：临时名带 pid + 随机串，避免并发写同一文件时踩到同一个 .tmp ----
// 注意：config.json 这类「单文件 bind mount」不能用 rename 覆盖（会 EBUSY），
// 目录也不一定有写权限，所以失败时退化为直接覆盖写。
function writeFileAtomic(file, data, encoding) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmp, data, encoding || 'utf8');
    fs.renameSync(tmp, file);
    return;
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (ignored) {}
    // 兜底：直接写目标文件（非原子，但保证可用；单文件挂载场景走这里）
    fs.writeFileSync(file, data, encoding || 'utf8');
  }
}

// ---- 进程内串行队列：同一个 key 的「读-改-写」排队执行，避免互相覆盖 ----
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

// ---- 解析缓存：只重新解析真正变过的 .md（mtime + size 判定）----
const mdCache = new Map();

function parseMdFileCached(filePath, fileId) {
  try {
    const stat = fs.statSync(filePath);
    const hit = mdCache.get(filePath);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size && hit.fileId === fileId) {
      return Object.assign({}, hit.parsed);
    }
    const parsed = parseMdFile(filePath, fileId);
    if (!parsed) {
      mdCache.delete(filePath);
      return null;
    }
    mdCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, fileId: fileId, parsed: parsed });
    return Object.assign({}, parsed);
  } catch (e) {
    mdCache.delete(filePath);
    return null;
  }
}

function pruneMdCache(alivePaths) {
  if (mdCache.size <= alivePaths.size * 2 + 32) return;
  mdCache.forEach((_v, key) => {
    if (!alivePaths.has(key)) mdCache.delete(key);
  });
}

// 搜索：算法在 text.js，这里只负责把文件里的文章喂进去
function searchArticles(query, limit) {
  return text.rankArticles(readArticles(), query, limit);
}

function parseMdFile(filePath, fileId) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const stat = fs.statSync(filePath);
    return mdparse.parseMdText(raw, {
      id: String(fileId),
      fallbackDate: cnDateOf(stat.mtime),
      fallbackMtime: stat.mtimeMs
    });
  } catch (err) {
    return null;
  }
}

function buildMdContent(item, type) {
  return mdparse.buildMdText(item, type);
}

function migrateLegacyArticles() {
  try {
    const entries = fs.readdirSync(ARTICLE_DIR, { withFileTypes: true });
    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];
      if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
        const id = ent.name.slice(0, -3);
        const subDir = path.join(ARTICLE_DIR, id);
        if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
        const oldPath = path.join(ARTICLE_DIR, ent.name);
        const newPath = path.join(subDir, ent.name);
        if (!fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
  } catch (e) {}
}
migrateLegacyArticles();

function readArticles() {
  try {
    if (!fs.existsSync(ARTICLE_DIR)) return [];
    const entries = fs.readdirSync(ARTICLE_DIR, { withFileTypes: true });
    const list = [];
    const alive = new Set();

    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];
      if (ent.isDirectory()) {
        const folderName = ent.name;
        const subDir = path.join(ARTICLE_DIR, folderName);
        const mdFiles = fs.readdirSync(subDir).filter(f => f.toLowerCase().endsWith('.md'));
        if (mdFiles.length > 0) {
          const targetMd = mdFiles.includes(folderName + '.md') ? (folderName + '.md') : mdFiles[0];
          const mdPath = path.join(subDir, targetMd);
          alive.add(mdPath);
          const parsed = parseMdFileCached(mdPath, folderName);
          if (parsed) list.push(parsed);
        }
      }
    }
    pruneMdCache(alive);
    return sortNewestFirst(list);
  } catch (e) {
    return [];
  }
}

function readPostComments(postId) {
  try {
    const safeId = sanitizeId(postId);
    const cmtPath = path.join(ARTICLE_DIR, safeId, 'comments.json');
    if (!fs.existsSync(cmtPath)) return [];
    const arr = JSON.parse(fs.readFileSync(cmtPath, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function savePostComments(postId, commentsList) {
  const safeId = sanitizeId(postId);
  const subDir = path.join(ARTICLE_DIR, safeId);
  if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
  writeFileAtomic(path.join(subDir, 'comments.json'), JSON.stringify(commentsList, null, 2));
}

// 在写锁里做「读-改-写」，避免并发请求互相覆盖掉评论
function mutatePostComments(postId, mutator) {
  const safeId = sanitizeId(postId);
  return withWriteLock('comments:' + safeId, () => {
    const list = readPostComments(safeId);
    const result = mutator(list) || {};
    if (result.changed !== false) savePostComments(safeId, list);
    return result;
  });
}

function readAllCommentsAcrossArticles() {
  try {
    if (!fs.existsSync(ARTICLE_DIR)) return [];
    const entries = fs.readdirSync(ARTICLE_DIR, { withFileTypes: true });
    const all = [];
    const articles = readArticles();
    const titleMap = {};
    articles.forEach(a => { titleMap[a.id] = a.title; });

    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];
      if (ent.isDirectory()) {
        const postId = ent.name;
        const cmts = readPostComments(postId);
        for (let j = 0; j < cmts.length; j++) {
          const c = cmts[j];
          c.postId = postId;
          c.postTitle = titleMap[postId] || postId;
          all.push(c);
        }
      }
    }
    return sortNewestFirst(all);
  } catch (e) {
    return [];
  }
}

function readMusings() {
  try {
    if (!fs.existsSync(MUSINGS_DIR)) return [];
    const files = fs.readdirSync(MUSINGS_DIR).filter(f => f.toLowerCase().endsWith('.md'));
    const list = [];
    for (let i = 0; i < files.length; i++) {
      const parsed = parseMdFile(path.join(MUSINGS_DIR, files[i]), files[i].slice(0, -3));
      if (parsed) list.push(parsed);
    }
    return sortNewestFirst(list);
  } catch (e) {
    return [];
  }
}

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return { tools: [], status: [], quirky: [] };
  }
}

function saveConfig(cfg) {
  writeFileAtomic(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 10);
}

function getModuleData(mod) {
  if (mod === 'posts') return readArticles();
  if (mod === 'moments') return readMusings();
  if (mod === 'comments') return readAllCommentsAcrossArticles();
  const cfg = getConfig();
  return Array.isArray(cfg[mod]) ? cfg[mod] : [];
}

// ---- 统一的写入 / 删除入口 ----
// 文件版直接落盘；数据库版（V2 / V3）实现同样的签名，server.js 无需区分存储形态。

function saveItem(mod, input) {
  const item = Object.assign({}, input || {});
  if (mod === 'posts') {
    item.id = sanitizeId(item.id || item.title || ('post-' + Date.now()));
    const subDir = path.join(ARTICLE_DIR, item.id);
    const mdPath = path.join(subDir, item.id + '.md');
    const isNew = !fs.existsSync(mdPath);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    item.date = item.date || cnDateOf(new Date());
    if (isNew || !item.mtime) item.mtime = Date.now();
    writeFileAtomic(mdPath, buildMdContent(item, 'posts'));
    const cmtPath = path.join(subDir, 'comments.json');
    if (!fs.existsSync(cmtPath)) writeFileAtomic(cmtPath, '[]');
    return { ok: true, item: item, list: readArticles() };
  }

  if (mod === 'moments') {
    item.id = sanitizeId(item.id || ('musing-' + Date.now()));
    const filePath = path.join(MUSINGS_DIR, item.id + '.md');
    const isNew = !fs.existsSync(filePath);
    item.date = item.date || cnNowStamp();
    if (isNew || !item.mtime) item.mtime = Date.now();
    writeFileAtomic(filePath, buildMdContent(item, 'moments'));
    return { ok: true, item: item, list: readMusings() };
  }

  const cfg = getConfig();
  if (!Array.isArray(cfg[mod])) cfg[mod] = [];
  item.id = item.id ? String(item.id) : String(Date.now());
  const idx = cfg[mod].findIndex(i => String(i.id) === String(item.id));
  if (idx !== -1) cfg[mod][idx] = Object.assign({}, cfg[mod][idx], item);
  else cfg[mod].unshift(item);
  saveConfig(cfg);
  const list = getConfig()[mod] || [];
  return { ok: true, item: list.find(i => String(i.id) === String(item.id)) || item, list: list };
}

function deleteItem(mod, id, options) {
  const opts = options || {};
  if (mod === 'posts') {
    const subDir = path.join(ARTICLE_DIR, sanitizeId(id));
    if (fs.existsSync(subDir)) fs.rmSync(subDir, { recursive: true, force: true });
    return { ok: true, list: readArticles() };
  }
  if (mod === 'moments') {
    const filePath = path.join(MUSINGS_DIR, sanitizeId(id) + '.md');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true, list: readMusings() };
  }
  if (mod === 'comments') {
    const postId = opts.postId ? sanitizeId(opts.postId) : '';
    if (postId) {
      const list = readPostComments(postId);
      const cascade = collectCascadeIds(list, id);
      savePostComments(postId, list.filter(c => !cascade.has(String(c.id))));
    } else if (fs.existsSync(ARTICLE_DIR)) {
      fs.readdirSync(ARTICLE_DIR, { withFileTypes: true }).forEach((ent) => {
        if (!ent.isDirectory()) return;
        const list = readPostComments(ent.name);
        const cascade = collectCascadeIds(list, id);
        const next = list.filter(c => !cascade.has(String(c.id)));
        if (next.length !== list.length) savePostComments(ent.name, next);
      });
    }
    return { ok: true, list: readAllCommentsAcrossArticles() };
  }
  const cfg = getConfig();
  if (Array.isArray(cfg[mod])) {
    cfg[mod] = cfg[mod].filter(i => String(i.id) !== String(id));
    saveConfig(cfg);
  }
  return { ok: true, list: (getConfig()[mod] || []) };
}

function cnNowStamp() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const p = v => String(v).padStart(2, '0');
  return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate()) +
    ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
}

module.exports = {
  variant: 'file',
  VARIANT: 'file',
  ROOT_DIR,
  ARTICLE_DIR,
  MUSINGS_DIR,
  IMG_DIR,
  FILE_DIR,
  getDateFolder,
  sanitizeFileName,
  sanitizeId,
  buildMdContent,
  readArticles,
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
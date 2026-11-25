const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function sanitizeFileName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  const base = path.basename(String(name || 'file'), ext)
    .replace(/[\\/:*?"<>|\r\n\t\s]+/g, '-')
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '')
    .slice(0, 48) || 'item';
  const safeExt = ext.replace(/[^a-z0-9.]/g, '');
  return `${Date.now()}-${base}${safeExt}`;
}

function sanitizeId(rawId) {
  const str = String(rawId || '').trim();
  const cleaned = str
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || ('post-' + Date.now());
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

// 列表用摘要：去掉正文，只留首行/前 N 个字符
function stripMarkdownForExcerpt(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^:::locked\s+[A-Za-z0-9+/=]+\s*$/gm, ' ')
    .replace(/^:::\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptOf(content, max) {
  const text = stripMarkdownForExcerpt(content);
  const limit = Number(max) || 140;
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

function summarizeItem(item) {
  const locked = Boolean(item && item.enc);
  const out = {
    id: item.id,
    title: item.title,
    date: item.date,
    tag: item.tag,
    tags: Array.isArray(item.tags) ? item.tags : normalizeTags(item.tag || ''),
    hidden: Boolean(item.hidden),
    locked: locked,
    enchint: locked ? String(item.enchint || '') : '',
    mtime: item.mtime,
    excerpt: locked ? '' : excerptOf(item.content, 140)
  };
  return out;
}

// ---- 搜索：中文按子串，英文/数字额外支持子序列（模糊）----
function searchNormalize(text) {
  return String(text || '').toLowerCase().replace(/[\s\u3000]+/g, '');
}

function isSubsequence(needle, haystack) {
  if (!needle) return true;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function snippetAround(text, term, radius) {
  const plain = stripMarkdownForExcerpt(text);
  const lower = plain.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  const r = radius || 48;
  if (idx === -1) return plain.slice(0, r * 2) + (plain.length > r * 2 ? '…' : '');
  const start = Math.max(0, idx - r);
  const end = Math.min(plain.length, idx + term.length + r);
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
}

function scorePost(post, terms) {
  const title = searchNormalize(post.title);
  const tag = searchNormalize([post.tag || '', Array.isArray(post.tags) ? post.tags.join(' ') : ''].join(' '));
  const body = searchNormalize(post.content);
  const bodyRaw = String(post.content || '').toLowerCase();
  let score = 0;
  const hits = [];

  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    let hit = 0;
    if (title === t) hit += 60;
    else if (title.indexOf(t) !== -1) hit += 24;
    else if (isSubsequence(t, title) && /^[a-z0-9#+._-]+$/.test(t)) hit += 10;
    if (tag.indexOf(t) !== -1) hit += 8;
    if (body.indexOf(t) !== -1) hit += 6;
    else if (isSubsequence(t, body) && /^[a-z0-9#+._-]+$/.test(t)) hit += 2;
    if (!hit && bodyRaw.indexOf(t) !== -1) hit += 3;
    if (hit) hits.push(t);
    score += hit;
  }

  return {
    score: score,
    matchedAll: hits.length === terms.length,
    firstTerm: hits[0] || terms[0]
  };
}

function searchArticles(query, limit) {
  const q = String(query || '').trim();
  if (!q) return [];
  const terms = searchNormalize(q).split(/[,，|]+/).filter(Boolean);
  if (!terms.length) return [];

  const posts = readArticles();
  const scored = [];
  for (let i = 0; i < posts.length; i++) {
    if (posts[i].hidden || posts[i].enc) continue;   // 隐藏文章与加密文章不参与公开搜索
    const r = scorePost(posts[i], terms);
    if (r.score <= 0) continue;
    scored.push({ post: posts[i], r: r });
  }

  let picked = scored.filter(x => x.r.matchedAll);
  if (!picked.length) picked = scored;

  picked.sort((a, b) => {
    if (b.r.score !== a.r.score) return b.r.score - a.r.score;
    return (Number(b.post.mtime) || 0) - (Number(a.post.mtime) || 0);
  });

  const max = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const results = picked.slice(0, max).map(x => ({
    id: x.post.id,
    title: x.post.title,
    date: x.post.date,
    tag: x.post.tag,
    tags: Array.isArray(x.post.tags) ? x.post.tags : [],
    score: x.r.score,
    snippet: snippetAround(x.post.content, x.r.firstTerm, 48)
  }));
  return { total: picked.length, results: results };
}

// date 字段 → 可比毫秒数（北京时间锚定）；解析失败回退 mtime
function dateMsOf(item) {
  const raw = String((item && item.date) || '').trim();
  if (raw) {
    let iso = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      iso += 'T00:00:00+08:00';                                  // 纯日期按北京时间零点
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(iso)) {
      iso += '+08:00';                                           // 无时区的日期时间按北京时间
    }
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) return ms;
  }
  return Number(item && item.mtime) || 0;
}

function sortNewestFirst(list) {
  return list.sort((a, b) => {
    const tDiff = dateMsOf(b) - dateMsOf(a);
    if (tDiff !== 0) return tDiff;
    const mDiff = (Number(b.mtime) || 0) - (Number(a.mtime) || 0);
    if (mDiff !== 0) return mDiff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

// 标签：接受字符串（逗号分隔）或数组，去重、去空、限制数量与长度
function normalizeTags(value) {
  // 兼容从静态博客（Hugo / Hexo / Jekyll）导入的 YAML 列表写法：tags: [随笔, 折腾]
  const stripList = (text) => {
    let s = String(text == null ? '' : text).trim();
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    return s.replace(/^["']|["']$/g, '');
  };
  const raw = Array.isArray(value)
    ? value.map(stripList)
    : stripList(value).split(/[,，]/);
  const seen = Object.create(null);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const tag = String(raw[i] == null ? '' : raw[i]).replace(/[\r\n]+/g, ' ').trim().slice(0, 24);
    if (!tag || seen[tag.toLowerCase()]) continue;
    seen[tag.toLowerCase()] = true;
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}

function parseMdFile(filePath, fileId) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const stat = fs.statSync(filePath);
    const fallbackDate = cnDateOf(stat.mtime);
    const meta = { id: fileId, title: fileId, date: fallbackDate, tag: '', mtime: Math.round(stat.mtimeMs) };
    let body = raw;

    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (match) {
      const headerLines = match[1].split(/\r?\n/);
      body = match[2];
      for (let i = 0; i < headerLines.length; i++) {
        const line = headerLines[i];
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim();
          if (k) meta[k] = v;
        }
      }
    }

    const tags = normalizeTags(meta.tags || meta.tag || '');
    const hidden = meta.hidden === '1' || meta.hidden === 'true';
    const enc = meta.enc === '1' || meta.enc === 'true';

    return {
      id: String(fileId),
      title: String(meta.title || fileId),
      date: String(meta.date || fallbackDate),
      tag: String(meta.tag || tags[0] || ''),
      tags: tags,
      hidden: hidden,
      enc: enc,
      encsalt: String(meta.encsalt || ''),
      enciv: String(meta.enciv || ''),
      enctag: String(meta.enctag || ''),
      enchint: String(meta.enchint || ''),
      mtime: Math.round(Number(meta.mtime) || stat.mtimeMs),
      content: String(body || '')
    };
  } catch (err) {
    return null;
  }
}

function buildMdContent(item, type) {
  const cleanTitle = String(item.title || '未命名文章').replace(/[\r\n]+/g, ' ');
  const cleanDate = String(item.date || cnDateOf(new Date())).replace(/[\r\n]+/g, ' ');
  const cleanTag = String(item.tag || '').replace(/[\r\n]+/g, ' ');
  const mtime = Number(item.mtime) || Date.now();
  const tags = normalizeTags(item.tags || item.tag || '');
  const lines = ['---'];
  if (type === 'posts') {
    lines.push('title: ' + cleanTitle);
    lines.push('date: ' + cleanDate);
    lines.push('mtime: ' + mtime);
    if (tags.length) lines.push('tags: ' + tags.join(', '));
    if (item.hidden) lines.push('hidden: 1');
    if (item.enc) {
      lines.push('enc: 1');
      lines.push('encsalt: ' + String(item.encsalt || ''));
      lines.push('enciv: ' + String(item.enciv || ''));
      lines.push('enctag: ' + String(item.enctag || ''));
      if (item.enchint) lines.push('enchint: ' + String(item.enchint).replace(/[\r\n]+/g, ' ').slice(0, 60));
    }
  } else {
    lines.push('date: ' + cleanDate);
    lines.push('mtime: ' + mtime);
    if (cleanTag) lines.push('tag: ' + cleanTag);
  }
  lines.push('---', '');
  return lines.join('\n') + String(item.content || '');
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

// 递归收集某条评论及其所有子孙评论 ID，方便级联删除
function collectCascadeIds(commentsList, targetId) {
  const toDelete = new Set([String(targetId)]);
  let added = true;
  while (added) {
    added = false;
    for (let i = 0; i < commentsList.length; i++) {
      const c = commentsList[i];
      if (c.parentId && toDelete.has(String(c.parentId)) && !toDelete.has(String(c.id))) {
        toDelete.add(String(c.id));
        added = true;
      }
    }
  }
  return toDelete;
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

module.exports = {
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
  normalizeTags
};
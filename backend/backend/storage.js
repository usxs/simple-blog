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

function parseMdFile(filePath, fileId) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const stat = fs.statSync(filePath);
    const fallbackDate = cnDateOf(stat.mtime);
    const meta = { id: fileId, title: fileId, date: fallbackDate, tag: '', mtime: stat.mtimeMs };
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

    return {
      id: String(fileId),
      title: String(meta.title || fileId),
      date: String(meta.date || fallbackDate),
      tag: String(meta.tag || ''),
      mtime: Number(meta.mtime) || stat.mtimeMs,
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
  const lines = ['---'];
  if (type === 'posts') {
    lines.push('title: ' + cleanTitle);
    lines.push('date: ' + cleanDate);
    lines.push('mtime: ' + mtime);
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
    migrateLegacyArticles();
    const entries = fs.readdirSync(ARTICLE_DIR, { withFileTypes: true });
    const list = [];

    for (let i = 0; i < entries.length; i++) {
      const ent = entries[i];
      if (ent.isDirectory()) {
        const folderName = ent.name;
        const subDir = path.join(ARTICLE_DIR, folderName);
        const mdFiles = fs.readdirSync(subDir).filter(f => f.toLowerCase().endsWith('.md'));
        if (mdFiles.length > 0) {
          const targetMd = mdFiles.includes(folderName + '.md') ? (folderName + '.md') : mdFiles[0];
          const parsed = parseMdFile(path.join(subDir, targetMd), folderName);
          if (parsed) list.push(parsed);
        }
      }
    }
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
  const cmtPath = path.join(subDir, 'comments.json');
  fs.writeFileSync(cmtPath, JSON.stringify(commentsList, null, 2), 'utf8');
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
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
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
  getModuleData
};
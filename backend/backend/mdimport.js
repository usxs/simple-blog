/**
 * backend/mdimport.js — 从静态博客（Hugo / Hexo / Jekyll / Astro / Ghost / Obsidian / 通用）导入 Markdown
 *
 * 输入是一个 ZIP 里读出来的文件列表（见 zip.js），输出是本项目能直接落盘的
 * 文章对象数组 + 需要搬运的图片附件。这里不碰文件系统，纯函数，方便测试，
 * 也方便 V2/V3（数据库版）复用同一套解析逻辑。
 *
 * 支持的目录约定：
 *   Hugo     content/**                 （含 page bundle：content/posts/foo/index.md）
 *   Hexo     source/_posts/**
 *   Jekyll   _posts/**  /  _drafts/**
 *   Astro    src/content/**
 *   Ghost    任意位置的 .md + Ghost 导出的 JSON
 *   Obsidian 整个 vault
 *   通用     任何 .md（跳过 node_modules/.git/themes/public/_site/dist 等）
 */

'use strict';

const path = require('path');
const frontmatter = require('./frontmatter');

const SOURCES = {
  auto: { label: '自动识别', dirs: null },
  hugo: { label: 'Hugo', dirs: ['content/'] },
  hexo: { label: 'Hexo', dirs: ['source/_posts/', 'source/_drafts/', '_posts/'] },
  jekyll: { label: 'Jekyll', dirs: ['_posts/', '_drafts/', 'posts/'] },
  astro: { label: 'Astro', dirs: ['src/content/', 'src/pages/'] },
  ghost: { label: 'Ghost', dirs: null },
  obsidian: { label: 'Obsidian', dirs: null },
  generic: { label: '通用 Markdown', dirs: null }
};

const SKIP_SEGMENTS = new Set([
  'node_modules', '.git', '.github', '.obsidian', '.vscode', 'themes', 'public',
  '_site', 'dist', 'build', 'vendor'
]);

const SKIP_NAMES = new Set(['readme.md', 'changelog.md', 'license.md', 'contributing.md']);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);

function normalizeName(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isSkipped(name) {
  const lower = name.toLowerCase();
  const segments = lower.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    if (SKIP_SEGMENTS.has(segments[i])) return true;
  }
  // 静态站点生成器的产物目录
  if (/(^|\/)(themes|public|_site|dist|node_modules)\//.test(lower)) return true;
  const base = segments[segments.length - 1];
  if (SKIP_NAMES.has(base)) return true;
  if (base === '_index.md' || base === 'index.md.template') return true;
  return false;
}

/** 猜一个静态博客类型（给「自动识别」用，也用于界面预填） */
function detectSource(names) {
  const list = names.map(normalizeName);
  const has = (pred) => list.some(pred);
  const hasFile = (file) => has(n => n === file);
  const hasPrefix = (prefix) => has(n => n.startsWith(prefix));

  if (hasFile('_config.yml') && hasPrefix('source/_posts/')) return 'hexo';
  if (hasFile('_config.yml') && hasPrefix('_posts/')) return 'jekyll';
  if ((hasFile('hugo.toml') || hasFile('hugo.yaml') || hasFile('config.toml') || hasFile('config.yaml')) && hasPrefix('content/')) return 'hugo';
  if (hasPrefix('content/') && has(n => /(^|\/)archetypes\//.test(n))) return 'hugo';
  if (hasFile('astro.config.mjs') || hasFile('astro.config.ts') || hasFile('astro.config.js')) return 'astro';
  if (hasPrefix('src/content/')) return 'astro';
  if (hasPrefix('.obsidian/') || hasFile('.obsidian/app.json')) return 'obsidian';
  if (has(n => /(^|\/)ghost.*\.json$/i.test(n))) return 'ghost';
  if (hasPrefix('content/')) return 'hugo';
  return 'generic';
}

function toCnStamp(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(ms));
  const get = (t) => (parts.find(p => p.type === t) || {}).value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return get('year') + '-' + get('month') + '-' + get('day') + ' ' + hour + ':' + get('minute');
}

/**
 * 把各种静态博客的日期写法统一成项目使用的北京时间格式。
 * 'YYYY-MM-DD'（无时间）保持纯日期，其余补到分钟。
 */
function normalizeDate(raw, fallbackMs) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return fallbackMs ? toCnStamp(fallbackMs).slice(0, 10) : '';

  // 纯日期
  const dateOnly = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (dateOnly) return dateOnly[1] + '-' + pad2(dateOnly[2]) + '-' + pad2(dateOnly[3]);

  const m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    const ms = Date.parse(text);
    return Number.isNaN(ms) ? (fallbackMs ? toCnStamp(fallbackMs).slice(0, 10) : '') : toCnStamp(ms);
  }

  const tz = text.match(/([+-])(\d{2}):?(\d{2})\s*$/);
  const isUtc = /[zZ]\s*$/.test(text);
  const hasTime = m[4] !== undefined;
  const ymd = m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  if (!hasTime) return ymd;

  const hms = pad2(m[4]) + ':' + m[5] + ':' + (m[6] || '00');

  // 无时区：就按北京时间理解，不做换算（静态博客作者写的就是本地时间）
  if (!tz && !isUtc) {
    return hms === '00:00:00' ? ymd : m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]) + ' ' + pad2(m[4]) + ':' + m[5];
  }

  // 带时区：换算到北京时间
  const offsetMin = isUtc ? 0 : (tz[1] === '-' ? -1 : 1) * (Number(tz[2]) * 60 + Number(tz[3]));
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) - offsetMin * 60000;
  const stamp = toCnStamp(utcMs);
  return stamp.slice(-5) === '00:00' ? stamp.slice(0, 10) : stamp;
}

function pad2(v) {
  const s = String(v);
  return s.length < 2 ? '0' + s : s;
}

function pickValue(data, keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = data[keys[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function toTagList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const text = String(value == null ? '' : value).trim();
  if (!text) return [];
  return text.split(/[,，、|]/).map(s => s.trim()).filter(Boolean);
}

function firstHeading(body) {
  const m = String(body || '').match(/^#{1,2}[ \t]+(.+)$/m);
  return m ? m[1].trim() : '';
}

function slugifyId(raw) {
  return String(raw || '')
    .replace(/^https?:\/\/[^/]+/i, '')          // Ghost 的 url 字段是绝对地址
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.(md|markdown|html?)$/i, '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function dirOf(name) {
  const idx = name.lastIndexOf('/');
  return idx === -1 ? '' : name.slice(0, idx + 1);
}

function basenameOf(name) {
  const idx = name.lastIndexOf('/');
  return idx === -1 ? name : name.slice(idx + 1);
}

function resolveRelative(baseDir, relPath) {
  const cleaned = relPath.replace(/[?#].*$/, '');
  const joined = path.posix.normalize(baseDir + cleaned);
  return joined.replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * 解析单个 markdown 文本。
 * @returns {{ post: object|null, warnings: string[] }}
 */
function parseMarkdownText(name, text, fallbackMtime) {
  const warnings = [];
  const { format, data, body } = frontmatter.split(text);

  let content = body;
  // Hexo 的摘要切分标记，本项目自己生成摘要，去掉
  content = content.replace(/^[ \t]*<!--\s*more\s*-->[ \t]*$/gim, '');

  const rawTitle = pickValue(data, ['title', 'name', 'heading']);
  const title = String(rawTitle || firstHeading(content) || basenameOf(name).replace(/\.(md|markdown)$/i, '')).trim() || '未命名文章';
  if (/\{\{[<%]/.test(content)) warnings.push('内容含 Hugo/Hexo 短代码，已原样保留');

  const dateRaw = pickValue(data, ['date', 'publishDate', 'pubDate', 'pubdate', 'created_at', 'created', 'published_at', 'lastmod', 'updated']);
  const date = normalizeDate(dateRaw, fallbackMtime);

  const tags = toTagList(pickValue(data, ['tags', 'categories', 'category', 'keywords']));
  const draftFlag = data.draft === true || data.draft === 'true' ||
    data.published === false || data.published === 'false' ||
    data.unpublished === true;
  const hidden = data.hidden === true || data.hidden === '1' || data.hidden === 'true' || draftFlag;

  const slugRaw = pickValue(data, ['slug', 'url', 'permalink', 'id', 'guid']);
  const baseName = basenameOf(name).replace(/\.(md|markdown)$/i, '');
  const withoutDatePrefix = baseName.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const fromName = withoutDatePrefix === 'index' ? basenameOf(dirOf(name).replace(/\/$/, '')) : withoutDatePrefix;
  const id = slugifyId(slugRaw || fromName || baseName) || ('imported-' + Date.now());

  return {
    post: {
      id,
      title,
      date,
      tags,
      tag: tags[0] || '',
      hidden,
      content,
      sourcePath: name,
      format
    },
    warnings
  };
}

/**
 * 解析整个压缩包。
 * @param {Array<{name:string,data:Buffer}>} files
 * @param {{ source?: string, withAssets?: boolean }} options
 */
function parseArchive(files, options) {
  const opts = options || {};
  const all = (files || []).filter(f => f && f.data && !f.isDir);
  const names = all.map(f => normalizeName(f.name));
  const detected = detectSource(names);
  const source = SOURCES[opts.source] && opts.source !== 'auto' ? opts.source : detected;
  const dirs = (SOURCES[source] || SOURCES.generic).dirs;

  const warnings = [];
  const fileMap = new Map();
  all.forEach((f) => { fileMap.set(normalizeName(f.name), f); });

  // 1) 挑出候选 markdown
  let candidates = names.filter(n => /\.(md|markdown)$/i.test(n) && !isSkipped(n));
  if (dirs && dirs.length) {
    const inDirs = candidates.filter(n => dirs.some(d => n.startsWith(d)));
    if (inDirs.length) candidates = inDirs;
    else warnings.push('未在预期的目录（' + dirs.join('、') + '）下找到 Markdown，已回退为全量扫描');
  }
  if (!candidates.length) {
    warnings.push('压缩包里没有找到 .md 文件');
  }

  const usedIds = Object.create(null);
  const posts = [];
  const assets = [];

  candidates.forEach((name) => {
    const entry = fileMap.get(name);
    if (!entry) return;
    let text;
    try {
      text = entry.data.toString('utf8').replace(/^\uFEFF/, '');
    } catch (e) {
      return;
    }
    const fallbackMtime = entry.mtime || Date.now();
    const parsed = parseMarkdownText(name, text, fallbackMtime);
    if (!parsed.post) return;
    parsed.warnings.forEach(w => { if (warnings.indexOf(w) === -1) warnings.push(w); });

    const post = parsed.post;
    // ID 去重：冲突就加序号，保证不互相覆盖
    let id = post.id;
    if (usedIds[id]) {
      let n = 2;
      while (usedIds[id + '-' + n]) n++;
      id = id + '-' + n;
    }
    usedIds[id] = true;
    post.id = id;

    if (opts.withAssets !== false) {
      post.content = collectAssets(post, name, fileMap, assets);
    }
    posts.push(post);
  });

  return {
    source,
    detected,
    posts,
    assets,
    warnings,
    stats: {
      files: all.length,
      markdown: candidates.length,
      posts: posts.length,
      assets: assets.length
    }
  };
}

/**
 * 把正文里引用的本地图片收进 assets，并把链接改写成站内的 /img/imported/<id>/<file>。
 * 只处理相对路径和 /static、/assets、/images 这类可映射到仓库的绝对路径。
 */
function collectAssets(post, sourceName, fileMap, assets) {
  const baseDir = dirOf(sourceName);
  const seen = Object.create(null);
  const rewrite = (ref) => {
    const raw = String(ref || '').trim();
    if (!raw || /^(https?:|data:|mailto:|#|\/\/)/i.test(raw)) return null;
    const candidates = [];
    if (raw.startsWith('/')) {
      const rel = raw.replace(/^\/+/, '');
      ['', 'static/', 'assets/', 'public/', 'src/assets/', 'src/images/'].forEach(prefix => candidates.push(prefix + rel));
    } else {
      candidates.push(resolveRelative(baseDir, raw));
      candidates.push(resolveRelative('', raw));
      ['static/', 'assets/', 'public/'].forEach(prefix => candidates.push(prefix + resolveRelative(baseDir, raw)));
    }
    for (let i = 0; i < candidates.length; i++) {
      const hit = fileMap.get(candidates[i]);
      if (hit && hit.data) return { path: candidates[i], data: hit.data };
    }
    return null;
  };

  const handled = (ref) => {
    if (seen[ref]) return seen[ref];
    const found = rewrite(ref);
    if (!found) { seen[ref] = null; return null; }
    const safeBase = path.posix.basename(found.path).replace(/[\\/:*?"<>|]+/g, '-');
    const target = 'imported/' + post.id + '/' + safeBase;
    if (!assets.some(a => a.target === target)) {
      assets.push({ target, sourcePath: found.path, data: found.data, postId: post.id });
    }
    const url = '/img/' + target;
    seen[ref] = url;
    return url;
  };

  let content = post.content;
  // ![alt](path "title")
  content = content.replace(/(!\[[^\]]*\]\()\s*([^)\s]+)([^)]*\))/g, (m, head, ref, tail) => {
    const url = handled(ref);
    return url ? head + url + tail : m;
  });
  // <img src="path">
  content = content.replace(/(<img[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi, (m, head, ref, tail) => {
    const url = handled(ref);
    return url ? head + url + tail : m;
  });
  return content;
}

module.exports = {
  SOURCES,
  IMAGE_EXT,
  detectSource,
  parseArchive,
  parseMarkdownText,
  normalizeDate,
  toCnStamp,
  slugifyId,
  isSkipped
};

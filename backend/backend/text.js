/**
 * backend/text.js — 摘要、搜索、排序等纯函数
 *
 * 文件存储（storage-file.js）与数据库存储（storage-db.js）共用这一份实现，
 * 保证两种部署下「列表摘要 / 搜索结果 / 时间排序」的表现完全一致。
 */

'use strict';

const path = require('path');
const { normalizeTags } = require('./mdparse');

// 文章 / 瞬间的 ID 直接当目录名与数据库主键用，必须去掉危险字符
function sanitizeId(rawId) {
  const str = String(rawId || '').trim();
  const cleaned = str
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || ('post-' + Date.now());
}

// 上传文件落盘名：时间戳 + 干净的主名 + 原扩展名
function sanitizeFileName(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  const base = path.basename(String(name || 'file'), ext)
    .replace(/[\\/:*?"<>|\r\n\t\s]+/g, '-')
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '')
    .slice(0, 48) || 'item';
  const safeExt = ext.replace(/[^a-z0-9.]/g, '');
  return `${Date.now()}-${base}${safeExt}`;
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

// 列表用摘要：去掉正文里的 Markdown 噪音，只留纯文本
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
  return {
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

/**
 * 在给定的文章数组里搜索（不关心数据来自文件还是数据库）
 * @returns {{ total: number, results: Array }}
 */
function rankArticles(posts, query, limit) {
  const q = String(query || '').trim();
  if (!q) return { total: 0, results: [] };
  const terms = searchNormalize(q).split(/[,，|]+/).filter(Boolean);
  if (!terms.length) return { total: 0, results: [] };

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

module.exports = {
  sanitizeId,
  sanitizeFileName,
  collectCascadeIds,
  stripMarkdownForExcerpt,
  excerptOf,
  summarizeItem,
  searchNormalize,
  isSubsequence,
  snippetAround,
  scorePost,
  rankArticles,
  dateMsOf,
  sortNewestFirst
};

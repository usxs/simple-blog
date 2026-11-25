/**
 * backend/mdparse.js — Markdown 正文 + 前言解析（纯函数，不碰文件系统）
 *
 * V1 的文件存储、V2/V3 的数据库存储、以及 V1 → V2 的迁移脚本都要把同一段
 * Markdown 拆成「字段 + 正文」，拆法必须完全一致，所以统一放在这里。
 *
 * 前言字段（与 buildMdContent 对应）：
 *   title / date / mtime / tags / tag / hidden / enc / encsalt / enciv / enctag / enchint
 */

'use strict';

const frontmatter = require('./frontmatter');

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

/**
 * @param {string} raw 文件全文
 * @param {{ id?: string, fallbackDate?: string, fallbackMtime?: number }} opts
 * @returns {{ id, title, date, tag, tags, hidden, enc, encsalt, enciv, enctag, enchint, mtime, content }}
 */
function parseMdText(raw, opts) {
  const o = opts || {};
  const text = String(raw == null ? '' : raw).replace(/^\uFEFF/, '');
  const fileId = String(o.id || '');
  const fallbackDate = String(o.fallbackDate || '');
  const fallbackMtime = Math.round(Number(o.fallbackMtime) || 0);

  // 前言可能是 YAML（---）也可能是 Hugo 的 TOML（+++），
  // 直接复用 frontmatter.js，块数组 / 行内数组 / 多行字符串都能正确取到
  const parsed = frontmatter.split(text);
  const meta = Object.assign({ id: fileId, title: fileId, date: fallbackDate, tag: '', mtime: fallbackMtime },
    parsed.data || {});
  const body = parsed.body;

  const tags = normalizeTags(meta.tags !== undefined && meta.tags !== null ? meta.tags : meta.tag);
  const boolOf = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'yes';
  const hidden = boolOf(meta.hidden);
  const enc = boolOf(meta.enc);

  return {
    id: fileId,
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
    mtime: Math.round(Number(meta.mtime) || fallbackMtime),
    content: String(body || '')
  };
}

function cnDateNow() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const p = v => String(v).padStart(2, '0');
  return t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
}

/**
 * parseMdText 的逆运算：字段 → Markdown 全文（V1 落盘格式）
 * @param {object} item
 * @param {'posts'|'moments'} type
 */
function buildMdText(item, type) {
  const cleanTitle = String(item.title || '未命名文章').replace(/[\r\n]+/g, ' ');
  const cleanDate = String(item.date || cnDateNow()).replace(/[\r\n]+/g, ' ');
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

module.exports = { parseMdText, normalizeTags, buildMdText };

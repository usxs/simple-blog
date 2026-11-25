/**
 * backend/links.js — 友链
 *
 * 数据存放在 data/links.json：
 *   { "items": [ { id, name, url, icon, note, status, ip, createdAt, updatedAt, reviewedAt } ] }
 *
 * status: pending（待审核）/ approved（已通过）/ rejected（已驳回）
 *
 * 访客在前台「友链」页提交，进后台审核；通过后才会出现在前台列表里。
 */

const fs = require('fs');
const kvfile = require('./kvfile');
const path = require('path');
const crypto = require('crypto');
const { ROOT_DIR } = require('./storage');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');

const MAX_ITEMS = 500;
const NAME_MAX = 30;
const URL_MAX = 200;
const NOTE_MAX = 80;
const REASON_MAX = 120;
const EMAIL_MAX = 120;

// 访客提交频率：同一 IP 每小时最多 5 条，10 分钟内最多 2 条
const RATE = { hourMs: 60 * 60 * 1000, hourMax: 5, burstMs: 10 * 60 * 1000, burstMax: 2 };

function readStore() {
  const data = kvfile.readJson(LINKS_FILE, null);
  if (!data) return { items: [] };
  const items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
  return { items: items.map(normalizeStored).filter(Boolean) };
}

function writeStore(store) {
  const items = (store.items || []).slice(0, MAX_ITEMS);
  try {
    kvfile.writeJson(LINKS_FILE, { items: items }, { mode: 0o644 });
  } catch (e) {
    throw new Error('友链数据写入失败：' + (e.message || e));
  }
}

function normalizeStored(item) {
  if (!item || typeof item !== 'object') return null;
  const url = safeUrl(item.url);
  if (!url) return null;
  const name = String(item.name || '').trim().slice(0, NAME_MAX) || hostOf(url);
  return {
    id: String(item.id || crypto.randomBytes(6).toString('hex')).slice(0, 32),
    name: name,
    url: url,
    icon: safeIcon(item.icon),
    note: String(item.note || '').trim().slice(0, NOTE_MAX),
    email: safeEmail(item.email),
    status: ['pending', 'approved', 'rejected'].indexOf(item.status) === -1 ? 'pending' : item.status,
    rejectReason: String(item.rejectReason || '').trim().slice(0, REASON_MAX),
    ip: String(item.ip || ''),
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(),
    reviewedAt: Number(item.reviewedAt) || 0
  };
}

function safeUrl(value) {
  const raw = String(value || '').trim().slice(0, URL_MAX);
  if (!raw) return '';
  const withProto = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw.replace(/^\/+/, '');
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname || u.hostname.indexOf('.') === -1) return '';
    return u.origin + (u.pathname === '/' ? '' : u.pathname.replace(/\/+$/, '')) + (u.search || '');
  } catch (e) {
    return '';
  }
}

function safeIcon(value) {
  const raw = String(value || '').trim().slice(0, URL_MAX);
  if (!raw) return '';
  // 本站上传的图标（/img/xxx）直接用相对路径即可
  if (raw.charAt(0) === '/') {
    if (raw.indexOf('//') === 0) return '';
    if (!/^\/[A-Za-z0-9._~\/%-]+$/.test(raw)) return '';
    return raw;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return String(u);
  } catch (e) {
    return '';
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') || '友链'; } catch (e) { return '友链'; }
}

// 图标没填时用网站名首字符，前台直接当文字头像渲染
function initialOf(item) {
  const name = String((item && item.name) || '').trim();
  if (!name) return '友';
  const ch = Array.from(name)[0];
  return /[\u4e00-\u9fa5a-zA-Z0-9]/.test(ch) ? ch.toUpperCase() : '友';
}

function safeEmail(value) {
  const raw = String(value == null ? '' : value).trim().slice(0, EMAIL_MAX);
  if (!raw) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
}

function publicView(item) {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    icon: item.icon,
    note: item.note,
    initial: initialOf(item)
  };
}

function adminView(item) {
  return Object.assign(publicView(item), {
    email: item.email || '',
    status: item.status,
    rejectReason: item.rejectReason || '',
    ip: item.ip,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    reviewedAt: item.reviewedAt
  });
}

function listApproved() {
  return readStore().items
    .filter(function (it) { return it.status === 'approved'; })
    .sort(function (a, b) { return a.createdAt - b.createdAt; })
    .map(publicView);
}

function listForAdmin() {
  const items = readStore().items.slice().sort(function (a, b) {
    if (a.status !== b.status) {
      const rank = { pending: 0, approved: 1, rejected: 2 };
      return rank[a.status] - rank[b.status];
    }
    return b.updatedAt - a.updatedAt;
  });
  return items.map(adminView);
}

function overview() {
  const items = readStore().items;
  const count = { pending: 0, approved: 0, rejected: 0 };
  items.forEach(function (it) { count[it.status] = (count[it.status] || 0) + 1; });
  return { count: count, total: items.length };
}

function recentByIp(ip) {
  const now = Date.now();
  return readStore().items.filter(function (it) { return it.ip === ip && now - it.createdAt < RATE.hourMs; });
}

function apply(input, ip) {
  const url = safeUrl(input && input.url);
  const name = String((input && input.name) || '').trim().slice(0, NAME_MAX);
  const icon = safeIcon(input && input.icon);
  const note = String((input && input.note) || '').trim().slice(0, NOTE_MAX);
  const email = safeEmail(input && input.email);
  if (input && input.email && !email) return { ok: false, error: '邮箱格式不正确，可以留空不填' };

  if (!url) return { ok: false, error: '网站地址格式不正确，请填写 https:// 开头的完整地址' };
  if (name.length < 2) return { ok: false, error: '网站名至少 2 个字' };
  if (input && String(input.honeypot || '').trim()) return { ok: false, error: '提交失败，请稍后重试' };

  const store = readStore();
  const dup = store.items.filter(function (it) { return it.url === url; })[0];
  if (dup) {
    if (dup.status === 'approved') return { ok: false, error: '这个网站已经在友链里了' };
    if (dup.status === 'pending') return { ok: false, error: '这个网站已经提交过申请，正在等待审核' };
    // 之前被驳回的，允许重新提交并回到待审核
  }

  const recent = recentByIp(ip);
  const burst = recent.filter(function (it) { return Date.now() - it.createdAt < RATE.burstMs; });
  if (recent.length >= RATE.hourMax) return { ok: false, error: '提交太频繁了，请稍后再试', retryAfter: 600 };
  if (burst.length >= RATE.burstMax) return { ok: false, error: '提交太频繁了，请稍后再试', retryAfter: 300 };

  const now = Date.now();
  let item;
  if (dup) {
    dup.name = name;
    dup.icon = icon;
    dup.note = note;
    dup.email = email;
    dup.status = 'pending';
    dup.reviewedAt = 0;
    dup.updatedAt = now;
    item = dup;
  } else {
    item = {
      id: crypto.randomBytes(6).toString('hex'),
      name: name,
      url: url,
      icon: icon,
      note: note,
      email: email,
      status: 'pending',
    rejectReason: '',
      ip: String(ip || ''),
      createdAt: now,
      updatedAt: now,
      reviewedAt: 0
    };
    store.items.unshift(item);
  }
  writeStore(store);
  return { ok: true, item: publicView(item) };
}

function create(input) {
  const url = safeUrl(input && input.url);
  const name = String((input && input.name) || '').trim().slice(0, NAME_MAX);
  const icon = safeIcon(input && input.icon);
  const note = String((input && input.note) || '').trim().slice(0, NOTE_MAX);
  const email = safeEmail(input && input.email);
  if (!url) return { ok: false, error: '网站地址格式不正确，请填写 https:// 开头的完整地址' };
  if (name.length < 2) return { ok: false, error: '网站名至少 2 个字' };
  if (input && input.email && !email) return { ok: false, error: '邮箱格式不正确，可以留空不填' };

  const store = readStore();
  const dup = store.items.filter(function (it) { return it.url === url; })[0];
  if (dup) return { ok: false, error: '这个网站已经在友链里了（当前状态：' + (dup.status === 'approved' ? '已通过' : dup.status === 'pending' ? '待审核' : '已驳回') + '）' };

  const now = Date.now();
  const item = {
    id: crypto.randomBytes(6).toString('hex'),
    name: name,
    url: url,
    icon: icon,
    note: note,
    email: email,
    status: 'approved',
    ip: 'admin',
    createdAt: now,
    updatedAt: now,
    reviewedAt: now
  };
  store.items.unshift(item);
  writeStore(store);
  return { ok: true, item: adminView(item) };
}

function update(id, patch) {
  const store = readStore();
  const item = store.items.filter(function (it) { return it.id === id; })[0];
  if (!item) return { ok: false, error: '友链不存在' };
  if (patch && patch.name !== undefined) {
    const name = String(patch.name).trim().slice(0, NAME_MAX);
    if (name.length < 2) return { ok: false, error: '网站名至少 2 个字' };
    item.name = name;
  }
  if (patch && patch.url !== undefined) {
    const url = safeUrl(patch.url);
    if (!url) return { ok: false, error: '网站地址格式不正确' };
    const dup = store.items.filter(function (it) { return it.id !== id && it.url === url; })[0];
    if (dup) return { ok: false, error: '这个地址已经被另一条友链使用' };
    item.url = url;
  }
  if (patch && patch.icon !== undefined) item.icon = safeIcon(patch.icon);
  if (patch && patch.note !== undefined) item.note = String(patch.note || '').trim().slice(0, NOTE_MAX);
  if (patch && patch.email !== undefined) item.email = safeEmail(patch.email);
  if (patch && patch.status !== undefined) {
    if (['pending', 'approved', 'rejected'].indexOf(patch.status) === -1) return { ok: false, error: '状态不正确' };
    item.status = patch.status;
    item.reviewedAt = patch.status === 'pending' ? 0 : Date.now();
    // 驳回必须写清原因：会出现在邮件里，也是申请人能看到的唯一反馈
    if (patch.status === 'rejected') {
      const reason = String(patch.rejectReason === undefined ? item.rejectReason || '' : patch.rejectReason).trim().slice(0, REASON_MAX);
      if (!reason) return { ok: false, error: '请填写未通过的原因，申请人会在邮件里看到' };
      item.rejectReason = reason;
    } else if (patch.status === 'approved') {
      item.rejectReason = '';
    }
  }
  item.updatedAt = Date.now();
  writeStore(store);
  return { ok: true, item: adminView(item) };
}

function remove(id) {
  const store = readStore();
  const before = store.items.length;
  store.items = store.items.filter(function (it) { return it.id !== id; });
  if (store.items.length === before) return { ok: false, error: '友链不存在' };
  writeStore(store);
  return { ok: true };
}

function get(id) {
  const item = readStore().items.filter(function (it) { return it.id === id; })[0];
  return item ? adminView(item) : null;
}

module.exports = {
  create,
  LINKS_FILE,
  listApproved,
  listForAdmin,
  overview,
  apply,
  update,
  remove,
  get,
  safeUrl,
  initialOf,
  publicView,
  adminView
};

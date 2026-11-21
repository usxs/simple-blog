/**
 * backend/site.js — 站点展示信息（名称 / 浏览器标题 / 副标题 / 头像字）
 *
 * 存放在 data/site.json，由后台「管理」页维护；前端启动时通过 GET /api/site 拉取，
 * 因此改完立刻生效，不需要重新部署前端。
 *
 * 初始值优先级：data/site.json > 环境变量 > 内置默认值。
 */

const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./storage');

const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(ROOT_DIR, 'data');
const SITE_FILE = path.join(DATA_DIR, 'site.json');

const LIMITS = { name: 40, avatarText: 2, title: 80, subtitle: 200 };

const DEFAULTS = {
  name: process.env.SITE_NAME || '简单博客',
  avatarText: process.env.SITE_AVATAR || '',
  title: process.env.SITE_TITLE || '',
  subtitle: process.env.SITE_SUBTITLE || '这里是我的个人博客，记录技术、折腾与生活。'
};

function readStored() {
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}

function pickText(value, fallback, max) {
  const s = String(value == null ? '' : value).trim();
  if (!s) return fallback;
  return s.slice(0, max);
}

/** 对外返回的站点信息（永远带默认值，字段不会缺失） */
function getSite() {
  const stored = readStored();
  const source = Object.keys(stored).length ? stored : {};
  const name = pickText(source.name, DEFAULTS.name, LIMITS.name);
  const avatarText = pickText(source.avatarText, DEFAULTS.avatarText || name.slice(0, 1), LIMITS.avatarText);
  return {
    name,
    avatarText,
    title: pickText(source.title, DEFAULTS.title || name, LIMITS.title),
    subtitle: pickText(source.subtitle, DEFAULTS.subtitle, LIMITS.subtitle),
    updatedAt: Number(source.updatedAt) || 0
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** 保存站点信息：只接受已知字段，逐项裁剪长度；返回保存后的完整对象 */
function saveSite(patch) {
  const current = getSite();
  const next = {
    name: pickText(patch && patch.name, current.name, LIMITS.name),
    avatarText: pickText(patch && patch.avatarText, current.avatarText, LIMITS.avatarText),
    title: pickText(patch && patch.title, current.title, LIMITS.title),
    subtitle: pickText(patch && patch.subtitle, current.subtitle, LIMITS.subtitle),
    updatedAt: Date.now()
  };
  ensureDataDir();
  const tmp = SITE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o644 });
  fs.renameSync(tmp, SITE_FILE);
  return next;
}

module.exports = { getSite, saveSite, SITE_FILE, LIMITS };
